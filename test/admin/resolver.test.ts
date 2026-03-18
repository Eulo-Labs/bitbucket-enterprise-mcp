import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory KVS store
const mockKvsStore = vi.hoisted(() => new Map<string, unknown>());
const mockKvs = vi.hoisted(() => ({
  get: vi.fn(async (key: string) => mockKvsStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    mockKvsStore.set(key, value);
  }),
  delete: vi.fn(async (key: string) => {
    mockKvsStore.delete(key);
  }),
  getSecret: vi.fn(async () => null),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

vi.mock('@forge/kvs', () => ({ kvs: mockKvs }));

// Mock @forge/api
const mockGetAppContext = vi.hoisted(() =>
  vi.fn(() => ({ environmentType: 'DEVELOPMENT' })),
);
const mockGetUrl = vi.hoisted(() =>
  vi.fn(async () => 'https://example.atlassian.net/trigger/url'),
);

vi.mock('@forge/api', () => ({
  getAppContext: mockGetAppContext,
  webTrigger: { getUrl: mockGetUrl },
  storage: { get: vi.fn(), set: vi.fn() },
  asApp: vi.fn(),
  asUser: vi.fn(),
  assumeTrustedRoute: vi.fn((p: string) => p),
}));

// Mock audit log
vi.mock('../../src/audit/log', () => ({
  getAuditLogs: vi.fn(async () => ({
    entries: [],
    total: 0,
    page: 1,
    pageSize: 10,
  })),
}));

// Mock db service
vi.mock('../../src/db/service', () => ({
  db: { getAllAuditLogs: vi.fn(async () => []) },
}));

// Mock validateWorkspace to avoid pulling in registry
const mockValidateWorkspace = vi.hoisted(() =>
  vi.fn((_: string) => undefined as string | undefined),
);
vi.mock('../../src/admin/validation', () => ({
  validateWorkspace: mockValidateWorkspace,
}));

// Mock tool registry and write-tools (needed transitively)
vi.mock('../../src/tools/write-tools', () => ({
  WRITE_TOOL_IDS: new Set(['create_pull_request', 'merge_pull_request']),
}));

vi.mock('../../src/tools/registry', () => ({
  getToolKeys: vi.fn(() => [
    'list_repositories',
    'create_pull_request',
    'merge_pull_request',
  ]),
}));

import { handleAdminRequest } from '../../src/admin/resolver';
import { KVS_PREFIX } from '../../src/oauth/config';

/** Helper to invoke a named resolver handler */
async function invoke(
  functionKey: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
) {
  return handleAdminRequest(
    { call: { functionKey, payload, jobId: undefined }, context },
    {},
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockKvsStore.clear();
});

describe('getOAuthConfig', () => {
  it('returns { configured: false } when KVS has no config', async () => {
    const result = await invoke('getOAuthConfig');
    expect(result).toEqual({ configured: false });
  });

  it('returns { configured: true, clientId } when config exists', async () => {
    mockKvsStore.set(KVS_PREFIX.CONFIG, {
      clientId: 'my-client',
      baseUrl: 'https://x',
    });
    const result = await invoke('getOAuthConfig');
    expect(result).toEqual({ configured: true, clientId: 'my-client' });
  });

  it('auto-saves workspaceId from req.context to KVS when present', async () => {
    await invoke('getOAuthConfig', {}, { workspaceId: 'ws-uuid-123' });
    expect(mockKvs.set).toHaveBeenCalledWith('workspace', 'ws-uuid-123');
  });
});

describe('setOAuthConfig', () => {
  it('returns error when clientId is missing', async () => {
    const result = await invoke('setOAuthConfig', { clientSecret: 'secret' });
    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('clientId'),
    });
  });

  it('returns error when clientSecret is absent and no stored secret exists', async () => {
    mockGetUrl.mockResolvedValueOnce('https://x');
    const result = await invoke('setOAuthConfig', { clientId: 'my-client' });
    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('clientSecret'),
    });
  });

  it('saves config and secret to KVS when both provided', async () => {
    mockGetUrl.mockResolvedValueOnce('https://x');
    const result = await invoke('setOAuthConfig', {
      clientId: 'cid',
      clientSecret: 'csec',
    });
    expect(result).toEqual({ success: true });
    expect(mockKvs.set).toHaveBeenCalledWith(
      KVS_PREFIX.CONFIG,
      expect.objectContaining({ clientId: 'cid' }),
    );
    expect(mockKvs.setSecret).toHaveBeenCalledWith(
      'oauth-client-secret',
      'csec',
    );
  });

  it('succeeds with only clientId when a secret is already stored', async () => {
    mockGetUrl.mockResolvedValueOnce('https://x');
    mockKvs.getSecret.mockResolvedValueOnce('existing-secret');
    const result = await invoke('setOAuthConfig', { clientId: 'cid' });
    expect(result).toEqual({ success: true });
  });
});

describe('deleteOAuthConfig', () => {
  it('calls kvs.delete and kvs.deleteSecret, returns { success: true }', async () => {
    mockKvsStore.set(KVS_PREFIX.CONFIG, { clientId: 'x' });
    const result = await invoke('deleteOAuthConfig');
    expect(result).toEqual({ success: true });
    expect(mockKvs.delete).toHaveBeenCalledWith(KVS_PREFIX.CONFIG);
    expect(mockKvs.deleteSecret).toHaveBeenCalledWith('oauth-client-secret');
  });
});

describe('setWorkspace', () => {
  it('returns error when validateWorkspace returns an error string', async () => {
    mockValidateWorkspace.mockReturnValueOnce('workspace is required');
    const result = await invoke('setWorkspace', { workspace: '' });
    expect(result).toMatchObject({
      success: false,
      error: 'workspace is required',
    });
  });

  it('saves workspace and returns { success: true } for valid input', async () => {
    mockValidateWorkspace.mockReturnValueOnce(undefined);
    const result = await invoke('setWorkspace', { workspace: 'my-ws' });
    expect(result).toEqual({ success: true });
    expect(mockKvs.set).toHaveBeenCalledWith('workspace', 'my-ws');
  });
});

describe('getWebTriggerUrl', () => {
  it('returns { url } from webTrigger.getUrl', async () => {
    const result = await invoke('getWebTriggerUrl');
    expect(result).toEqual({
      url: 'https://example.atlassian.net/trigger/url',
    });
  });
});

describe('getToolsConfig', () => {
  it('returns { tools: {} } when KVS is empty', async () => {
    const result = await invoke('getToolsConfig');
    expect(result).toEqual({ tools: {} });
  });

  it('returns stored tools map when present', async () => {
    const toolsMap = { list_repositories: true, create_pull_request: false };
    mockKvsStore.set(KVS_PREFIX.TOOLS_CONFIG, toolsMap);
    const result = await invoke('getToolsConfig');
    expect(result).toEqual({ tools: toolsMap });
  });
});

describe('setToolsConfig', () => {
  it('saves tools map to KVS and returns { success: true }', async () => {
    const tools = { list_repositories: false };
    const result = await invoke('setToolsConfig', { tools });
    expect(result).toEqual({ success: true });
    expect(mockKvs.set).toHaveBeenCalledWith(KVS_PREFIX.TOOLS_CONFIG, tools);
  });
});

describe('getReadOnlyMode', () => {
  it('returns { readOnly: true } when KVS value is null (default on)', async () => {
    const result = await invoke('getReadOnlyMode');
    expect(result).toEqual({ readOnly: true });
  });

  it('returns { readOnly: true } when KVS value is true', async () => {
    mockKvsStore.set(KVS_PREFIX.READ_ONLY_MODE, true);
    const result = await invoke('getReadOnlyMode');
    expect(result).toEqual({ readOnly: true });
  });
});

describe('setReadOnlyMode', () => {
  it('saves value to KVS', async () => {
    await invoke('setReadOnlyMode', { readOnly: false });
    expect(mockKvs.set).toHaveBeenCalledWith(KVS_PREFIX.READ_ONLY_MODE, false);
  });

  it('bulk-sets WRITE_TOOL_IDS to false in tools-config when readOnly is true', async () => {
    await invoke('setReadOnlyMode', { readOnly: true });
    expect(mockKvs.set).toHaveBeenCalledWith(
      KVS_PREFIX.TOOLS_CONFIG,
      expect.objectContaining({
        create_pull_request: false,
        merge_pull_request: false,
      }),
    );
  });
});

describe('getEnvironment', () => {
  it('returns { environmentType } from getAppContext()', async () => {
    mockGetAppContext.mockReturnValueOnce({ environmentType: 'STAGING' });
    const result = await invoke('getEnvironment');
    expect(result).toEqual({ environmentType: 'STAGING' });
  });
});
