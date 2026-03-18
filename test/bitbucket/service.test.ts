import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so they're available when the mock factory runs
const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('../../src/bitbucket/client', async (importActual) => {
  const actual =
    await importActual<typeof import('../../src/bitbucket/client')>();
  return {
    ...actual,
    bbClient: {
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
      patch: vi.fn(),
      request: vi.fn(),
    },
  };
});

vi.mock('../../src/posthog/client', () => ({
  captureError: vi.fn(),
}));

import { BitbucketService } from '../../src/bitbucket/service';

function makeOkResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function makeErrorResponse(status = 404, statusText = 'Not Found') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => '',
  };
}

const WORKSPACE = 'my-workspace';
const USER_TOKEN = 'user-bearer-token';

let service: BitbucketService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new BitbucketService(WORKSPACE, USER_TOKEN);
});

describe('listRepositories()', () => {
  it('calls GET with page/pagelen query params and returns parsed JSON', async () => {
    const fakeData = {
      size: 1,
      page: 1,
      pagelen: 25,
      values: [{ slug: 'repo1' }],
    };
    mockGet.mockResolvedValueOnce(makeOkResponse(fakeData));

    const result = await service.listRepositories({ page: 2, pagelen: 10 });

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      USER_TOKEN,
    );
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('pagelen=10'),
      USER_TOKEN,
    );
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining(`/2.0/repositories/${WORKSPACE}`),
      USER_TOKEN,
    );
    expect(result).toEqual(fakeData);
  });

  it('includes q param when provided', async () => {
    mockGet.mockResolvedValueOnce(makeOkResponse({ values: [] }));
    await service.listRepositories({ q: 'name~foo' });
    // URLSearchParams encodes ~ as %7E
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('q=name'),
      USER_TOKEN,
    );
  });
});

describe('getPullRequest()', () => {
  it('URL-encodes repo_slug and pr_id in path', async () => {
    const fakePr = { id: 42, title: 'Test PR' };
    mockGet.mockResolvedValueOnce(makeOkResponse(fakePr));

    const result = await service.getPullRequest({
      repo_slug: 'my repo',
      pr_id: '42',
    });

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('my%20repo'),
      USER_TOKEN,
    );
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/pullrequests/42'),
      USER_TOKEN,
    );
    expect(result).toEqual(fakePr);
  });
});

describe('createPullRequest()', () => {
  it('POSTs correct JSON body with title, source branch, and reviewers', async () => {
    const fakePr = { id: 1, title: 'New PR' };
    mockPost.mockResolvedValueOnce(makeOkResponse(fakePr));

    const result = await service.createPullRequest({
      repo_slug: 'my-repo',
      title: 'New PR',
      source_branch: 'feature/x',
      destination_branch: 'main',
      reviewers: ['{uuid-1}'],
    });

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/pullrequests'),
      expect.stringContaining('"title":"New PR"'),
      undefined,
      USER_TOKEN,
    );
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"feature/x"'),
      undefined,
      USER_TOKEN,
    );
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('{uuid-1}'),
      undefined,
      USER_TOKEN,
    );
    expect(result).toEqual(fakePr);
  });
});

describe('mergePullRequest()', () => {
  it('POSTs to correct merge endpoint with merge strategy and message', async () => {
    const fakeMerged = { id: 5, state: 'MERGED' };
    mockPost.mockResolvedValueOnce(makeOkResponse(fakeMerged));

    await service.mergePullRequest({
      repo_slug: 'my-repo',
      pr_id: '5',
      merge_strategy: 'squash',
      message: 'squash it',
    });

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/pullrequests/5/merge'),
      expect.stringContaining('"squash"'),
      undefined,
      USER_TOKEN,
    );
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"squash it"'),
      undefined,
      USER_TOKEN,
    );
  });
});

describe('error propagation', () => {
  it('propagates error when assertOk throws on non-2xx status', async () => {
    mockGet.mockResolvedValueOnce(makeErrorResponse(403, 'Forbidden'));
    await expect(service.listRepositories({})).rejects.toThrow(
      /403.*Forbidden/,
    );
  });

  it('propagates error from getPullRequest on 404', async () => {
    mockGet.mockResolvedValueOnce(makeErrorResponse(404, 'Not Found'));
    await expect(
      service.getPullRequest({ repo_slug: 'repo', pr_id: '99' }),
    ).rejects.toThrow(/404/);
  });
});
