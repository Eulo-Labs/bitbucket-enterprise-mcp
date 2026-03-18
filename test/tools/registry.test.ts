import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks — must be declared before any module import that triggers registry.ts
const mockKvsStore = vi.hoisted(() => new Map<string, unknown>());
const mockKvs = vi.hoisted(() => ({
  get: vi.fn(async (key: string) => mockKvsStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    mockKvsStore.set(key, value);
  }),
  delete: vi.fn(),
  getSecret: vi.fn(),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

vi.mock('@forge/kvs', () => ({ kvs: mockKvs }));

// Mock @forge/api (required by transitive deps)
vi.mock('@forge/api', () => ({
  storage: { get: vi.fn(), set: vi.fn() },
  asApp: vi.fn(),
  asUser: vi.fn(),
  assumeTrustedRoute: vi.fn((p: string) => p),
}));

// Mock individual tool modules to avoid real Bitbucket API calls
vi.mock('../../src/tools/repositories', () => ({
  listRepositories: {
    definition: { name: 'list_repositories' },
    execute: vi.fn(async () => ({
      content: [{ type: 'text', text: 'repos' }],
    })),
  },
  getRepository: {
    definition: { name: 'get_repository' },
    execute: vi.fn(async () => ({ content: [{ type: 'text', text: 'repo' }] })),
  },
}));
vi.mock('../../src/tools/pull-requests', () => ({
  listPullRequests: {
    definition: { name: 'list_pull_requests' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  listWorkspacePullRequests: {
    definition: { name: 'list_workspace_pull_requests' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  getPullRequest: {
    definition: { name: 'get_pull_request' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  createPullRequest: {
    definition: { name: 'create_pull_request' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  getPullRequestDiff: {
    definition: { name: 'get_pull_request_diff' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  listPullRequestComments: {
    definition: { name: 'list_pull_request_comments' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  createPullRequestComment: {
    definition: { name: 'create_pull_request_comment' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  approvePullRequest: {
    definition: { name: 'approve_pull_request' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  unapprovePullRequest: {
    definition: { name: 'unapprove_pull_request' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  mergePullRequest: {
    definition: { name: 'merge_pull_request' },
    execute: vi.fn(async () => ({ content: [] })),
  },
}));
vi.mock('../../src/tools/pipelines', () => ({
  listPipelines: {
    definition: { name: 'list_pipelines' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  listPipelineSteps: {
    definition: { name: 'list_pipeline_steps' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  getPipelineStepLog: {
    definition: { name: 'get_pipeline_step_log' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  triggerPipeline: {
    definition: { name: 'trigger_pipeline' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  listWorkspacePipelines: {
    definition: { name: 'list_workspace_pipelines' },
    execute: vi.fn(async () => ({ content: [] })),
  },
}));
vi.mock('../../src/tools/source', () => ({
  getFileContent: {
    definition: { name: 'get_file_content' },
    execute: vi.fn(async () => ({ content: [] })),
  },
  listDirectory: {
    definition: { name: 'list_directory' },
    execute: vi.fn(async () => ({ content: [] })),
  },
}));
vi.mock('../../src/tools/branches', () => ({
  listBranches: {
    definition: { name: 'list_branches' },
    execute: vi.fn(async () => ({ content: [] })),
  },
}));
vi.mock('../../src/tools/search', () => ({
  searchCode: {
    definition: { name: 'search_code' },
    execute: vi.fn(async () => ({ content: [] })),
  },
}));

import {
  getToolKeys,
  getToolDefinitions,
  callTool,
} from '../../src/tools/registry';
import { WRITE_TOOL_IDS } from '../../src/tools/write-tools';
import { KVS_PREFIX } from '../../src/oauth/config';

const mockContext = { workspace: 'ws', userToken: 'tok', accountId: 'acc' };

beforeEach(() => {
  vi.clearAllMocks();
  mockKvsStore.clear();
});

describe('getToolKeys()', () => {
  it('returns a non-empty array containing known tool names', () => {
    const keys = getToolKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('list_repositories');
    expect(keys).toContain('get_pull_request');
    expect(keys).toContain('create_pull_request');
  });
});

describe('getToolDefinitions()', () => {
  it('returns only read tools when no KVS flags are set (default read-only)', async () => {
    const defs = await getToolDefinitions();
    const names = defs.map((d) => d.name);
    expect(names).toContain('list_repositories');
    for (const writeId of WRITE_TOOL_IDS) {
      expect(names).not.toContain(writeId);
    }
  });

  it('excludes write tools when read-only-mode is true', async () => {
    mockKvsStore.set(KVS_PREFIX.READ_ONLY_MODE, true);
    const defs = await getToolDefinitions();
    const names = defs.map((d) => d.name);
    for (const writeId of WRITE_TOOL_IDS) {
      expect(names).not.toContain(writeId);
    }
    expect(names).toContain('list_repositories');
  });

  it('excludes a tool whose key is set to false in tools-config', async () => {
    mockKvsStore.set(KVS_PREFIX.TOOLS_CONFIG, { list_repositories: false });
    const defs = await getToolDefinitions();
    const names = defs.map((d) => d.name);
    expect(names).not.toContain('list_repositories');
    expect(names).toContain('get_repository');
  });
});

describe('callTool()', () => {
  it('returns error result for unknown tool name', async () => {
    const result = await callTool('nonexistent_tool', {}, mockContext);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('Unknown tool'),
    });
  });

  it('returns error when calling a write tool in read-only mode', async () => {
    mockKvsStore.set(KVS_PREFIX.READ_ONLY_MODE, true);
    const result = await callTool('create_pull_request', {}, mockContext);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('read-only'),
    });
  });

  it('returns error for a disabled tool', async () => {
    mockKvsStore.set(KVS_PREFIX.TOOLS_CONFIG, { list_repositories: false });
    const result = await callTool('list_repositories', {}, mockContext);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('disabled'),
    });
  });

  it('delegates to handler.execute and returns its result', async () => {
    const result = await callTool('list_repositories', {}, mockContext);
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toMatchObject({ text: 'repos' });
  });

  it('catches thrown errors from handler.execute and returns error result', async () => {
    const { listRepositories } = await import('../../src/tools/repositories');
    vi.mocked(listRepositories.execute).mockRejectedValueOnce(
      new Error('Boom'),
    );
    const result = await callTool('list_repositories', {}, mockContext);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('Boom'),
    });
  });
});
