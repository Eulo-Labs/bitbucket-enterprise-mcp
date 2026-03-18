import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({ values: [] }),
  text: async () => 'user response text',
}));
vi.stubGlobal('fetch', mockFetch);

import { BitbucketClient, bbPath, assertOk } from '../../src/bitbucket/client';

describe('BitbucketClient', () => {
  let client: BitbucketClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BitbucketClient();
  });

  it('uses fetch with Bearer token', async () => {
    await client.get('/2.0/repositories/workspace', 'user-token-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.bitbucket.org/2.0/repositories/workspace',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-token-123',
        }),
      }),
    );
  });

  it('passes userToken through post()', async () => {
    await client.post(
      '/2.0/repositories/workspace/repo/pullrequests',
      '{"title":"test"}',
      undefined,
      'user-token-456',
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/2.0/repositories/workspace/repo/pullrequests'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-token-456',
          'Content-Type': 'application/json',
        }),
        body: '{"title":"test"}',
      }),
    );
  });

  it('passes userToken through delete()', async () => {
    await client.delete('/2.0/repositories/workspace/repo', 'user-token-789');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/2.0/repositories/workspace/repo'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-token-789',
        }),
      }),
    );
  });

  it('rejects invalid paths', async () => {
    await expect(client.get('/1.0/invalid', 'token')).rejects.toThrow(
      'must start with /2.0/',
    );
  });

  it('rejects path traversal', async () => {
    await expect(client.get('/2.0/../etc/passwd', 'token')).rejects.toThrow(
      'Path traversal',
    );
  });
});

describe('bbPath', () => {
  it('encodes path segments', () => {
    const path = bbPath('/2.0/repositories/{workspace}/{repo}', {
      workspace: 'my workspace',
      repo: 'my/repo',
    });
    expect(path).toBe('/2.0/repositories/my%20workspace/my%2Frepo');
  });
});

describe('assertOk', () => {
  it('does not throw for ok responses', () => {
    expect(() =>
      assertOk(
        {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
          text: async () => '',
        },
        'test',
      ),
    ).not.toThrow();
  });

  it('throws for non-ok responses', () => {
    expect(() =>
      assertOk(
        {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
          text: async () => '',
        },
        'test',
      ),
    ).toThrow('404 Not Found');
  });
});
