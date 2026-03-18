/**
 * JSON-RPC Protocol Helpers
 *
 * Utility functions for parsing and building JSON-RPC 2.0 messages,
 * HTTP response construction with CORS headers, and 401 responses
 * with RFC 9728 resource metadata for OAuth discovery.
 */
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  WebTriggerResponse,
} from './types';
import { parseError, invalidRequest } from './errors';

const PROTOCOL_VERSION = '2025-11-25';
const SERVER_NAME = 'bitbucket-remote';
const SERVER_VERSION = '0.1.0';
const SERVER_TITLE = 'Bitbucket Enterprise MCP Server';
const SERVER_DESCRIPTION =
  'Enterprise MCP server for Bitbucket - manage repositories, pull requests, pipelines, and more';

export {
  PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
  SERVER_TITLE,
  SERVER_DESCRIPTION,
};

/** Parse a JSON-RPC request from raw body string */
export function parseJsonRpc(body: string): JsonRpcRequest | JsonRpcRequest[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw parseError('Invalid JSON');
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw invalidRequest('Empty batch');
    }
    return parsed.map(validateJsonRpcMessage);
  }

  return validateJsonRpcMessage(parsed);
}

function validateJsonRpcMessage(msg: unknown): JsonRpcRequest {
  if (
    typeof msg !== 'object' ||
    msg === null ||
    !('jsonrpc' in msg) ||
    (msg as Record<string, unknown>).jsonrpc !== '2.0' ||
    !('method' in msg) ||
    typeof (msg as Record<string, unknown>).method !== 'string'
  ) {
    throw invalidRequest('Invalid JSON-RPC 2.0 message');
  }
  return msg as JsonRpcRequest;
}

/** Create a JSON-RPC success response */
export function jsonRpcResult(
  id: string | number | null,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

/** Create a JSON-RPC error response */
export function jsonRpcError(
  id: string | number | null,
  error: { code: number; message: string; data?: unknown },
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error };
}

/** CORS headers included on every response so browsers can read them */
const CORS_HEADERS: Record<string, string[]> = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['GET, POST, DELETE, OPTIONS'],
  'Access-Control-Allow-Headers': [
    'Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
  ],
  'Access-Control-Expose-Headers': [
    'WWW-Authenticate, Mcp-Session-Id, X-Resource-Metadata',
  ],
};

/** Build a web trigger HTTP response */
export function httpResponse(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string[]>,
): WebTriggerResponse {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': ['application/json'],
      ...CORS_HEADERS,
      ...extraHeaders,
    },
    statusCode,
  };
}

/** Check if a JSON-RPC message is a notification (no id) */
export function isNotification(msg: JsonRpcRequest): boolean {
  return msg.id === undefined || msg.id === null;
}

/** Build a 401 response with WWW-Authenticate header pointing to metadata URL */
export function unauthorizedResponse(metadataUrl: string): WebTriggerResponse {
  return {
    body: JSON.stringify({ error: 'Unauthorized' }),
    headers: {
      'Content-Type': ['application/json'],
      ...CORS_HEADERS,
      // Standard header — may be stripped by Forge's edge proxy
      'WWW-Authenticate': [`Bearer resource_metadata="${metadataUrl}"`],
      // Fallback: custom header in case edge proxy strips WWW-Authenticate
      'X-Resource-Metadata': [metadataUrl],
    },
    statusCode: 401,
  };
}
