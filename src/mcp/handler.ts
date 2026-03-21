import type {
  WebTriggerEvent,
  WebTriggerResponse,
  JsonRpcRequest,
  SessionData,
  McpInitializeParams,
  McpToolCallParams,
} from './types';
import {
  parseJsonRpc,
  jsonRpcResult,
  jsonRpcError,
  httpResponse,
  isNotification,
  unauthorizedResponse,
  PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
  SERVER_TITLE,
  SERVER_DESCRIPTION,
} from './protocol';
import { methodNotFound, internalError, invalidParams } from './errors';
import { extractBearerToken, authenticateRequest } from './auth';
import type { AuthResult } from './auth';
import { createSession, getSession, deleteSession } from './session';
import { getToolDefinitions, callTool } from '../tools/registry';
import {
  getResourceList,
  getResourceTemplates,
  readResource,
  getDynamicResource,
  getDynamicTemplate,
} from './resources';
import { logToolCall } from '../audit/log';
import { extractAuditDetails } from '../audit/details';
import { captureEvent, captureError, shutdownPostHog } from '../posthog/client';
import { routeOAuthRequest } from '../oauth/router';
import { getOAuthConfig, deriveBaseUrl } from '../oauth/config';
import { ensureFreshToken } from '../oauth/tokens';
import { getOrFetchUser } from '../db/users';
import { store } from '../kvs/service';
import type { ToolContext } from '../tools/types';

/**
 * MCP Protocol Handler
 *
 * Main web trigger handler for MCP requests. Routes JSON-RPC 2.0 requests
 * to appropriate handlers (initialize, tools/list, tools/call, resources/*).
 * Handles OAuth authentication, session management, and tool execution.
 */
export async function handleMcpRequest(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse> {
  // Handle CORS preflight for any path (uses shared CORS headers from httpResponse)
  if (event.method === 'OPTIONS') {
    return httpResponse(204, '');
  }

  // Route OAuth endpoints first (metadata, register, authorize, callback, token)
  const oauthResponse = await routeOAuthRequest(event);
  if (oauthResponse) return oauthResponse;

  // Handle DELETE for session termination
  if (event.method === 'DELETE') {
    const sessionId = getSessionIdFromHeaders(event.headers);
    if (sessionId) {
      await deleteSession(sessionId);
    }
    return httpResponse(200, { ok: true });
  }

  // Only accept POST for MCP JSON-RPC
  if (event.method !== 'POST') {
    return httpResponse(405, { error: 'Method not allowed' });
  }

  let messages: JsonRpcRequest | JsonRpcRequest[];
  try {
    messages = parseJsonRpc(event.body);
  } catch (err) {
    const rpcErr = err as { code: number; message: string; data?: unknown };
    return httpResponse(400, {
      jsonrpc: '2.0',
      id: null,
      error: rpcErr,
    });
  }

  // Check if this is an initialize/ping request (doesn't require auth per MCP spec)
  const UNAUTHENTICATED_METHODS = new Set(['initialize', 'ping']);
  const isInitializeRequest = !Array.isArray(messages)
    ? UNAUTHENTICATED_METHODS.has(messages.method)
    : messages.some((msg) => UNAUTHENTICATED_METHODS.has(msg.method));

  // Validate auth (skip for initialize request)
  const token = extractBearerToken(event.headers);
  const sessionId = getSessionIdFromHeaders(event.headers);

  let authResult: AuthResult | null | undefined;
  let session: SessionData | null | undefined;

  if (!isInitializeRequest) {
    if (!token) {
      return await buildUnauthorizedResponse(event);
    }
    // Validate OAuth token and get session in parallel
    const [authResultRaw, sessionRaw] = await Promise.all([
      authenticateRequest(token),
      sessionId ? getSession(sessionId) : Promise.resolve(null),
    ]);
    authResult = authResultRaw;
    session = sessionRaw;

    if (!authResult) {
      captureEvent('auth_failure', {}, {});
      return await buildUnauthorizedResponse(event);
    }
  } else {
    // For initialize request, just get existing session if provided
    if (sessionId) {
      session = await getSession(sessionId);
    }
  }

  // Handle single message - reject batch requests
  if (Array.isArray(messages)) {
    return httpResponse(200, {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32601,
        message: 'Method not found',
        data: 'Batch requests are not supported on this server',
      },
    });
  }

  const result = await routeMessage(messages, sessionId, session, authResult);
  if (result.httpError) return result.httpError;

  const headers: Record<string, string[]> = {
    'MCP-Protocol-Version': [PROTOCOL_VERSION],
  };
  if (result.newSessionId) {
    headers['Mcp-Session-Id'] = [result.newSessionId];
  }

  // Per JSON-RPC 2.0, a message without an id is a notification and MUST NOT
  // receive a response. The MCP spec agrees — but it also mandates that servers
  // respond to `initialize`. Some clients send initialize without an id (treating
  // it as a fire-and-forget), which would leave them hung with no capabilities.
  // We intentionally carve out `initialize` from the notification short-circuit
  // so those clients still complete the handshake. The response carries id: null,
  // the JSON-RPC 2.0 convention for "couldn't determine the request id".
  const isInitialize = messages.method === 'initialize';
  if (isNotification(messages) && !isInitialize) {
    void shutdownPostHog();
    return httpResponse(204, '', headers);
  }

  void shutdownPostHog();
  return httpResponse(200, result.response, headers);
}

async function buildUnauthorizedResponse(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse> {
  // Prefer configured baseUrl, fall back to deriving from request
  const config = await getOAuthConfig();
  const baseUrl =
    config?.baseUrl || deriveBaseUrl(event.headers, event.path, event.userPath);

  // RFC 9728: resource_metadata points to the protected resource metadata,
  // which in turn lists authorization_servers for the client to discover.
  const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
  return unauthorizedResponse(metadataUrl);
}

function getSessionIdFromHeaders(
  headers: Record<string, string[]>,
): string | undefined {
  return headers['mcp-session-id']?.[0] || headers['Mcp-Session-Id']?.[0];
}

interface RouteResult {
  response?: unknown;
  newSessionId?: string;
  httpError?: WebTriggerResponse;
}

async function routeMessage(
  msg: JsonRpcRequest,
  sessionId?: string,
  session?: SessionData | null,
  authResult?: AuthResult | null,
): Promise<RouteResult> {
  try {
    switch (msg.method) {
      case 'initialize':
        return await handleInitialize(msg);

      case 'notifications/initialized':
        return {};

      case 'ping':
        return { response: jsonRpcResult(msg.id ?? null, {}) };

      case 'tools/list':
        return await handleToolsList(msg, sessionId, session);

      case 'tools/call':
        return await handleToolsCall(msg, sessionId, session, authResult);

      case 'resources/list':
        return handleResourcesList(msg, sessionId, session);

      case 'resources/read':
        return await handleResourcesRead(msg, sessionId, session, authResult);

      default:
        return {
          response: jsonRpcError(msg.id ?? null, methodNotFound(msg.method)),
        };
    }
  } catch (err) {
    console.error(`Error handling ${msg.method}:`, err);
    captureError(err instanceof Error ? err : new Error(String(err)), {
      method: msg.method,
    });
    return {
      response: jsonRpcError(
        msg.id ?? null,
        internalError(err instanceof Error ? err.message : 'Unknown error'),
      ),
    };
  }
}

async function handleInitialize(msg: JsonRpcRequest): Promise<RouteResult> {
  const params = msg.params as unknown as McpInitializeParams | undefined;

  const session = await createSession(params?.clientInfo);

  return {
    response: jsonRpcResult(msg.id ?? null, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
        resources: {},
        session: {},
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        title: SERVER_TITLE,
        description: SERVER_DESCRIPTION,
      },
    }),
    newSessionId: session.id,
  };
}

function requireSession(
  sessionId: string | undefined,
  session: SessionData | null | undefined,
): WebTriggerResponse | null {
  if (!sessionId) {
    return httpResponse(400, {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message: 'Bad Request: Mcp-Session-Id header is required',
      },
    });
  }

  if (!session) {
    return httpResponse(404, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Session not found' },
    });
  }

  return null;
}

async function handleToolsList(
  msg: JsonRpcRequest,
  sessionId?: string,
  session?: SessionData | null,
): Promise<RouteResult> {
  const sessionError = requireSession(sessionId, session);
  if (sessionError) return { httpError: sessionError };

  const tools = await getToolDefinitions();
  return {
    response: jsonRpcResult(msg.id ?? null, { tools }),
  };
}

async function handleToolsCall(
  msg: JsonRpcRequest,
  sessionId?: string,
  session?: SessionData | null,
  authResult?: AuthResult | null,
): Promise<RouteResult> {
  const sessionError = requireSession(sessionId, session);
  if (sessionError) return { httpError: sessionError };

  const params = msg.params as unknown as McpToolCallParams | undefined;
  if (!params?.name) {
    return {
      response: jsonRpcError(
        msg.id ?? null,
        invalidParams('Missing tool name'),
      ),
    };
  }

  if (!authResult) {
    console.error(
      '[tools/call] Authentication context missing for tool:',
      params.name,
    );
    return {
      response: jsonRpcError(
        msg.id ?? null,
        internalError('Authentication context missing'),
      ),
    };
  }

  // Read workspace from KVS (stored by admin panel on first load)
  const workspace = (await store.get('workspace')) as string;
  if (!workspace) {
    console.error('[tools/call] Workspace not configured');
    return {
      response: jsonRpcError(
        msg.id ?? null,
        internalError('Workspace not configured. Open the admin panel first.'),
      ),
    };
  }

  // Ensure fresh Atlassian token before calling tool
  let freshRecord = authResult.tokenRecord;
  try {
    freshRecord = await ensureFreshToken(authResult.tokenRecord);
  } catch (err) {
    console.error(
      '[tools/call] Token refresh failed, using current token:',
      err,
    );
    captureError(err instanceof Error ? err : new Error(String(err)), {
      method: 'ensureFreshToken',
    });
  }

  const toolContext: ToolContext = {
    userToken: freshRecord.atlassian_access_token,
    atlassianAccountId: freshRecord.atlassian_account_id,
    workspace,
  };

  let finalResult = await callTool(
    params.name,
    params.arguments ?? {},
    toolContext,
  );

  // If tool got a Bitbucket 401, try refreshing once and retrying
  if (
    finalResult.isError &&
    finalResult.content[0]?.text?.includes('401') &&
    freshRecord.atlassian_refresh_token
  ) {
    try {
      const refreshedRecord = await ensureFreshToken({
        ...freshRecord,
        atlassian_token_expires_at: 0, // Force refresh
      });
      const retryContext: ToolContext = {
        userToken: refreshedRecord.atlassian_access_token,
        atlassianAccountId: refreshedRecord.atlassian_account_id,
        workspace,
      };
      finalResult = await callTool(
        params.name,
        params.arguments ?? {},
        retryContext,
      );
    } catch (err) {
      console.error('[tools/call] Token refresh retry failed:', err);
      captureError(err instanceof Error ? err : new Error(String(err)), {
        method: 'ensureFreshToken',
      });
    }
  }

  const toolArgs = params.arguments ?? {};

  // Fire-and-forget: cache user profile once, parallel with logToolCall
  void getOrFetchUser(
    freshRecord.atlassian_account_id,
    freshRecord.atlassian_access_token,
  );

  const details = extractAuditDetails(params.name, toolArgs);

  logToolCall({
    atlassianAccountId: freshRecord.atlassian_account_id,
    toolName: params.name,
    workspace,
    repoSlug: (toolArgs.repo_slug as string) || null,
    isError: Boolean(finalResult.isError),
    details,
  });

  captureEvent(
    'tool_call',
    {
      tool_name: params.name,
      is_error: Boolean(finalResult.isError),
    },
    { workspaceId: workspace },
  );

  return {
    response: jsonRpcResult(msg.id ?? null, finalResult),
  };
}

function handleResourcesList(
  msg: JsonRpcRequest,
  sessionId?: string,
  session?: SessionData | null,
): RouteResult {
  const sessionError = requireSession(sessionId, session);
  if (sessionError) return { httpError: sessionError };

  return {
    response: jsonRpcResult(msg.id ?? null, {
      resources: getResourceList(),
      resourceTemplates: getResourceTemplates(),
    }),
  };
}

type ResourceContextResult = { toolContext: ToolContext } | RouteResult;

function isResourceContext(
  result: ResourceContextResult,
): result is { toolContext: ToolContext } {
  return 'toolContext' in result;
}

/** Validates auth and workspace, refreshes token, returns a ToolContext ready for resource resolution. */
async function prepareResourceContext(
  msgId: unknown,
  authResult?: AuthResult | null,
): Promise<ResourceContextResult> {
  if (!authResult) {
    return {
      response: jsonRpcError(
        msgId as string | number | null,
        internalError('Authentication context missing'),
      ),
    };
  }

  const workspace = (await store.get('workspace')) as string;
  if (!workspace) {
    return {
      response: jsonRpcError(
        msgId as string | number | null,
        internalError('Workspace not configured. Open the admin panel first.'),
      ),
    };
  }

  let freshRecord = authResult.tokenRecord;
  try {
    freshRecord = await ensureFreshToken(authResult.tokenRecord);
  } catch (err) {
    console.error(
      '[resources/read] Token refresh failed, using current token:',
      err,
    );
    captureError(err instanceof Error ? err : new Error(String(err)), {
      method: 'ensureFreshToken',
    });
  }

  return {
    toolContext: {
      userToken: freshRecord.atlassian_access_token,
      atlassianAccountId: freshRecord.atlassian_account_id,
      workspace,
    },
  };
}

async function handleResourcesRead(
  msg: JsonRpcRequest,
  sessionId?: string,
  session?: SessionData | null,
  authResult?: AuthResult | null,
): Promise<RouteResult> {
  const sessionError = requireSession(sessionId, session);
  if (sessionError) return { httpError: sessionError };

  const uri = (msg.params as Record<string, unknown> | undefined)
    ?.uri as string;
  if (!uri) {
    return {
      response: jsonRpcError(msg.id ?? null, invalidParams('Missing uri')),
    };
  }

  const entry = readResource(uri);
  if (entry) {
    return {
      response: jsonRpcResult(msg.id ?? null, {
        contents: [
          {
            uri: entry.resource.uri,
            mimeType: entry.resource.mimeType,
            text: entry.content,
          },
        ],
      }),
    };
  }

  const dynamicEntry = getDynamicResource(uri);
  if (dynamicEntry) {
    const ctxResult = await prepareResourceContext(msg.id ?? null, authResult);
    if (!isResourceContext(ctxResult)) return ctxResult;

    const content = await dynamicEntry.resolve(ctxResult.toolContext);
    return {
      response: jsonRpcResult(msg.id ?? null, {
        contents: [
          {
            uri: dynamicEntry.resource.uri,
            mimeType: dynamicEntry.resource.mimeType,
            text: content,
          },
        ],
      }),
    };
  }

  const templateMatch = getDynamicTemplate(uri);
  if (templateMatch) {
    const ctxResult = await prepareResourceContext(msg.id ?? null, authResult);
    if (!isResourceContext(ctxResult)) return ctxResult;

    const content = await templateMatch.entry.resolve(
      ctxResult.toolContext,
      templateMatch.params,
    );
    return {
      response: jsonRpcResult(msg.id ?? null, {
        contents: [
          {
            uri,
            mimeType: templateMatch.entry.resource.mimeType,
            text: content,
          },
        ],
      }),
    };
  }

  return {
    response: jsonRpcError(msg.id ?? null, {
      code: -32002,
      message: `Resource not found: ${uri}`,
    }),
  };
}
