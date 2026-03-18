import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockValidateAccessToken = vi.hoisted(() => vi.fn());
const mockEnsureFreshToken = vi.hoisted(() => vi.fn());
const mockRefreshAtlassianToken = vi.hoisted(() => vi.fn());

vi.mock('../../src/oauth/tokens', () => ({
  validateAccessToken: mockValidateAccessToken,
  ensureFreshToken: mockEnsureFreshToken,
}));

vi.mock('../../src/oauth/atlassian', () => ({
  refreshAtlassianToken: mockRefreshAtlassianToken,
}));

import { extractBearerToken, authenticateRequest } from '../../src/mcp/auth';
import { KVS_PREFIX } from '../../src/oauth/config';
import type { OAuthTokenRecord } from '../../src/oauth/types';

function makeTokenRecord(
  overrides: Partial<OAuthTokenRecord> = {},
): OAuthTokenRecord {
  return {
    token_hash: 'hash123',
    client_id: 'client-id',
    atlassian_account_id: 'user-account-id',
    atlassian_access_token: 'at-access',
    atlassian_refresh_token: 'at-refresh',
    atlassian_token_expires_at: Date.now() + 3600_000,
    scope: 'bitbucket',
    created_at: Date.now() - 1000,
    expires_at: Date.now() + 3600_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockKvsStore.clear();
});

describe('extractBearerToken()', () => {
  it('returns token from lowercase authorization header', () => {
    expect(extractBearerToken({ authorization: ['Bearer mytoken'] })).toBe(
      'mytoken',
    );
  });

  it('returns token from uppercase Authorization header', () => {
    expect(extractBearerToken({ Authorization: ['Bearer MYTOKEN'] })).toBe(
      'MYTOKEN',
    );
  });

  it('returns null when no auth header is present', () => {
    expect(extractBearerToken({})).toBeNull();
  });

  it("returns null when header doesn't start with 'Bearer '", () => {
    expect(
      extractBearerToken({ authorization: ['Basic dXNlcjpwYXNz'] }),
    ).toBeNull();
  });

  it('trims whitespace from extracted token', () => {
    expect(extractBearerToken({ authorization: ['Bearer   spaced  '] })).toBe(
      'spaced',
    );
  });
});

describe('authenticateRequest()', () => {
  it('returns null when validateAccessToken returns null', async () => {
    mockValidateAccessToken.mockResolvedValueOnce(null);
    const result = await authenticateRequest('bad-token');
    expect(result).toBeNull();
  });

  it('returns { accountId, userToken, tokenRecord } for a valid non-expired token', async () => {
    const record = makeTokenRecord();
    mockValidateAccessToken.mockResolvedValueOnce(record);
    mockEnsureFreshToken.mockResolvedValueOnce(record);

    const result = await authenticateRequest('good-token');
    expect(result).not.toBeNull();
    expect(result!.accountId).toBe('user-account-id');
    expect(result!.userToken).toBe('at-access');
    expect(result!.tokenRecord).toBe(record);
    expect(mockRefreshAtlassianToken).not.toHaveBeenCalled();
  });

  it('calls refreshAtlassianToken and updates KVS when token is expired', async () => {
    const record = makeTokenRecord({ expires_at: Date.now() - 1000 });
    const refreshedAtlassian = {
      access_token: 'new-at-access',
      refresh_token: 'new-at-refresh',
      expires_in: 3600,
    };
    const updatedRecord: OAuthTokenRecord = {
      ...record,
      atlassian_access_token: 'new-at-access',
      atlassian_refresh_token: 'new-at-refresh',
      atlassian_token_expires_at: expect.any(Number) as unknown as number,
    };

    mockValidateAccessToken.mockResolvedValueOnce(record);
    mockRefreshAtlassianToken.mockResolvedValueOnce(refreshedAtlassian);
    mockEnsureFreshToken.mockResolvedValueOnce({
      ...record,
      atlassian_access_token: 'new-at-access',
    });

    await authenticateRequest('expired-token');

    expect(mockRefreshAtlassianToken).toHaveBeenCalledWith(
      record.atlassian_refresh_token,
    );
    expect(mockKvs.set).toHaveBeenCalledWith(
      `${KVS_PREFIX.TOKEN}${record.token_hash}`,
      expect.objectContaining({
        atlassian_access_token: 'new-at-access',
        atlassian_refresh_token: 'new-at-refresh',
      }),
    );
  });

  it('always calls ensureFreshToken before returning', async () => {
    const record = makeTokenRecord();
    const freshRecord = { ...record, atlassian_access_token: 'fresh-token' };
    mockValidateAccessToken.mockResolvedValueOnce(record);
    mockEnsureFreshToken.mockResolvedValueOnce(freshRecord);

    const result = await authenticateRequest('some-token');
    expect(mockEnsureFreshToken).toHaveBeenCalledWith(record);
    expect(result!.userToken).toBe('fresh-token');
  });
});
