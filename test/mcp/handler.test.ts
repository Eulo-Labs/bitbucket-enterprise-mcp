import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMcpRequest } from '../../src/mcp/handler';
import type { WebTriggerEvent } from '../../src/mcp/types';

const PROTOCOL_VERSION = '2025-11-25';
const SERVER_NAME = 'bitbucket-remote';

// Mock @forge/api storage
vi.mock('@forge/api', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getSecret: vi.fn(),
    setSecret: vi.fn(),
    deleteSecret: vi.fn(),
  },
  asApp: vi.fn(),
  asUser: vi.fn(),
  assumeTrustedRoute: vi.fn((path: string) => path),
}));

// Mock @forge/kvs — workspace stored under 'workspace' key
vi.mock('@forge/kvs', () => ({
  kvs: {
    get: vi.fn(async (key: string) => {
      if (key === 'workspace') return 'test-workspace';
      return null;
    }),
    set: vi.fn(),
    delete: vi.fn(),
    getSecret: vi.fn(),
    setSecret: vi.fn(),
    deleteSecret: vi.fn(),
  },
}));

// Mock auth to accept a test token
vi.mock('../../src/mcp/auth', () => ({
  extractBearerToken: vi.fn((headers: Record<string, string[]>) => {
    const auth = headers['authorization']?.[0] || headers['Authorization']?.[0];
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7).trim();
  }),
  authenticateRequest: vi.fn(async (token: string) =>
    token === 'test-token'
      ? {
          accountId: 'test-account-id',
          userToken: 'test-atlassian-token',
          tokenRecord: {
            token_hash: 'test-hash',
            client_id: 'test-client',
            atlassian_account_id: 'test-account-id',
            atlassian_access_token: 'test-atlassian-token',
            atlassian_refresh_token: 'test-refresh-token',
            atlassian_token_expires_at: Date.now() + 3600000,
            scope: 'bitbucket',
            created_at: Date.now(),
            expires_at: Date.now() + 3600000,
          },
        }
      : null,
  ),
}));

// Mock session
vi.mock('../../src/mcp/session', () => ({
  createSession: vi.fn(async () => ({
    id: 'test-session-id',
    initialized: true,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  })),
  getSession: vi.fn(async (id: string) =>
    id === 'test-session-id'
      ? {
          id: 'test-session-id',
          initialized: true,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
        }
      : null,
  ),
  deleteSession: vi.fn(async () => {}),
}));

// Mock OAuth router — return null (not an OAuth path)
vi.mock('../../src/oauth/router', () => ({
  routeOAuthRequest: vi.fn(async () => null),
}));

// Mock OAuth config
vi.mock('../../src/oauth/config', () => ({
  getOAuthConfig: vi.fn(async () => ({
    clientId: 'test-3lo-client',
    baseUrl: 'https://example.com/mcp',
  })),
  KVS_PREFIX: {
    CLIENT: 'oauth-client:',
    CODE: 'oauth-code:',
    TOKEN: 'oauth-token:',
    REFRESH: 'oauth-refresh:',
    CONFIG: 'oauth-config',
    PENDING_AUTH: 'oauth-pending:',
  },
}));

// Mock ensureFreshToken
vi.mock('../../src/oauth/tokens', () => ({
  ensureFreshToken: vi.fn(async (record: unknown) => record),
}));

// Mock BitbucketService for dynamic resources
vi.mock('../../src/bitbucket/service', () => ({
  BitbucketService: vi.fn().mockImplementation(() => ({
    listRepositories: vi.fn(async () => ({
      size: 1,
      values: [
        {
          full_name: 'test-workspace/my-repo',
          name: 'my-repo',
          slug: 'my-repo',
          description: 'A test repo',
          language: 'TypeScript',
          is_private: false,
          mainbranch: { name: 'main', type: 'branch' },
          project: null,
          updated_on: '2026-01-01T00:00:00Z',
          links: {
            html: { href: 'https://bitbucket.org/test-workspace/my-repo' },
          },
        },
      ],
    })),
  })),
}));

function makeEvent(
  method: string,
  body: unknown,
  headers?: Record<string, string[]>,
): WebTriggerEvent {
  return {
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      authorization: ['Bearer test-token'],
      ...headers,
    },
    path: '/x1/test',
    userPath: '/x1/test',
    queryParameters: {},
  };
}

describe('handleMcpRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST/DELETE methods', async () => {
    const event = makeEvent('GET', '');
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(405);
  });

  it('returns 200 for DELETE (session termination)', async () => {
    const event = makeEvent('DELETE', '');
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when no auth header', async () => {
    const event: WebTriggerEvent = {
      method: 'POST',
      body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
      headers: {},
      path: '/x1/test',
      queryParameters: {},
      userPath: '/x1/test',
    };
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with WWW-Authenticate for invalid token', async () => {
    const event = makeEvent(
      'POST',
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      {
        authorization: ['Bearer wrong-token'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']?.[0]).toContain('resource_metadata');
  });

  it('handles initialize method', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(body.result.serverInfo.name).toBe(SERVER_NAME);
    expect(res.headers['Mcp-Session-Id']).toBeDefined();
  });

  it('handles ping method', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result).toEqual({});
  });

  it('handles notifications/initialized with 202', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(202);
  });

  it('handles tools/list method with valid session', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['test-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result.tools).toBeDefined();
    expect(Array.isArray(body.result.tools)).toBe(true);
    expect(body.result.tools.length).toBeGreaterThan(0);

    // Check tool definitions have required fields
    const tool = body.result.tools[0];
    expect(tool.name).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
  });

  it('returns 400 when tools/list called without session', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32000);
  });

  it('returns 404 when tools/list called with invalid session', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['invalid-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(404);

    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32001);
  });

  it('DELETE terminates the session', async () => {
    const { deleteSession } = await import('../../src/mcp/session');
    const event = makeEvent('DELETE', '', {
      authorization: ['Bearer test-token'],
      'mcp-session-id': ['test-session-id'],
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);
    expect(deleteSession).toHaveBeenCalledWith('test-session-id');
  });

  it('returns method not found for unknown methods', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'unknown/method',
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(-32601);
  });

  it('returns 400 for invalid JSON body', async () => {
    const event = makeEvent('POST', 'not valid json');
    event.body = 'not valid json';
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(400);
  });

  it('handles initialize without an id (sent as notification)', async () => {
    // The MCP spec requires initialize to be a Request (with id), but some clients
    // omit the id, making it technically a JSON-RPC notification. Per spec, servers
    // MUST NOT respond to notifications — but silently dropping initialize would
    // leave the client hung with no capabilities. We deliberately respond anyway
    // with id: null (the JSON-RPC 2.0 convention for "couldn't determine request id")
    // so that lenient clients can still complete the handshake.
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      // no id field — this is what makes it a notification in JSON-RPC 2.0
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'buggy-client', version: '0.1' },
      },
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(body.result.serverInfo.name).toBe(SERVER_NAME);
    expect(body.id).toBeNull();
  });

  it('initialize response includes resources capability', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    });
    const res = await handleMcpRequest(event);
    const body = JSON.parse(res.body);
    expect(body.result.capabilities.resources).toEqual({});
  });

  it('handles resources/list with valid session', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['test-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result.resources).toBeDefined();
    expect(Array.isArray(body.result.resources)).toBe(true);
    expect(body.result.resources.length).toBeGreaterThan(0);

    const reposResource = body.result.resources.find(
      (r: { uri: string }) => r.uri === 'bb://repos',
    );
    expect(reposResource).toBeDefined();
    expect(reposResource.mimeType).toBe('application/json');
  });

  it('handles resources/read with valid URI', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/read',
        params: { uri: 'bb://repos' },
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['test-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result.contents).toBeDefined();
    expect(body.result.contents[0].uri).toBe('bb://repos');
    expect(body.result.contents[0].mimeType).toBe('application/json');
  });

  it('handles resources/read with unknown URI', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'resources/read',
        params: { uri: `ui://${SERVER_NAME}/unknown.html` },
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['test-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(-32002);
  });

  it('resources/list requires session', async () => {
    const event = makeEvent('POST', {
      jsonrpc: '2.0',
      id: 6,
      method: 'resources/list',
    });
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(400);
  });

  it('resources/list includes bb://repos dynamic resource', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'resources/list',
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['test-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    const reposResource = body.result.resources.find(
      (r: { uri: string }) => r.uri === 'bb://repos',
    );
    expect(reposResource).toBeDefined();
    expect(reposResource.mimeType).toBe('application/json');
  });

  it('handles resources/read with bb://repos URI', async () => {
    const event = makeEvent(
      'POST',
      {
        jsonrpc: '2.0',
        id: 8,
        method: 'resources/read',
        params: { uri: 'bb://repos' },
      },
      {
        authorization: ['Bearer test-token'],
        'mcp-session-id': ['test-session-id'],
      },
    );
    const res = await handleMcpRequest(event);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.result.contents).toBeDefined();
    expect(body.result.contents[0].uri).toBe('bb://repos');
    expect(body.result.contents[0].mimeType).toBe('application/json');

    const data = JSON.parse(body.result.contents[0].text);
    expect(data.size).toBe(1);
    expect(Array.isArray(data.repositories)).toBe(true);
    expect(data.repositories[0].slug).toBe('my-repo');
  });
});
