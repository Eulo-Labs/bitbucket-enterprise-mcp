import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @forge/kvs before importing tokens
vi.mock('@forge/kvs', () => {
  const store = new Map<string, unknown>();
  return {
    kvs: {
      get: vi.fn(async (key: string) => {
        if (!store.has(key)) {
          const error = new Error('KEY_NOT_FOUND') as Error & { code?: string };
          error.code = 'KEY_NOT_FOUND';
          throw error;
        }
        return store.get(key);
      }),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      getSecret: vi.fn(async () => 'test-secret'),
      setSecret: vi.fn(),
      deleteSecret: vi.fn(),
    },
    asApp: vi.fn(),
    assumeTrustedRoute: vi.fn((path: string) => path),
  };
});

// Mock atlassian module
vi.mock('../../src/oauth/atlassian', () => ({
  refreshAtlassianToken: vi.fn(async () => ({
    access_token: 'refreshed-atl-token',
    refresh_token: 'refreshed-atl-refresh',
    expires_in: 3600,
  })),
}));

import {
  mintTokenPair,
  validateAccessToken,
  refreshTokens,
  revokeToken,
  ensureFreshToken,
} from '../../src/oauth/tokens';
import type { OAuthTokenRecord } from '../../src/oauth/types';

describe('OAuth tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mints and validates a token pair', async () => {
    const pair = await mintTokenPair(
      'account-123',
      {
        access_token: 'atl-access',
        refresh_token: 'atl-refresh',
        expires_in: 3600,
      },
      'client-abc',
    );

    expect(pair.access_token).toBeDefined();
    expect(pair.refresh_token).toBeDefined();
    expect(pair.token_type).toBe('Bearer');
    expect(pair.expires_in).toBe(3600);

    // Validate the access token
    const record = await validateAccessToken(pair.access_token);
    expect(record).not.toBeNull();
    expect(record!.atlassian_account_id).toBe('account-123');
    expect(record!.client_id).toBe('client-abc');
    expect(record!.atlassian_access_token).toBe('atl-access');
  });

  it('returns null for unknown token', async () => {
    const record = await validateAccessToken('nonexistent-token');
    expect(record).toBeNull();
  });

  it('revokes a token', async () => {
    const pair = await mintTokenPair(
      'account-123',
      {
        access_token: 'atl-access',
        refresh_token: 'atl-refresh',
        expires_in: 3600,
      },
      'client-abc',
    );

    await revokeToken(pair.access_token);

    const record = await validateAccessToken(pair.access_token);
    expect(record).toBeNull();
  });

  it('refreshes tokens', async () => {
    const pair = await mintTokenPair(
      'account-123',
      {
        access_token: 'atl-access',
        refresh_token: 'atl-refresh',
        expires_in: 3600,
      },
      'client-abc',
    );

    const newPair = await refreshTokens(pair.refresh_token, 'client-abc');
    expect(newPair).not.toBeNull();
    expect(newPair!.access_token).toBeDefined();
    expect(newPair!.access_token).not.toBe(pair.access_token);
  });

  it('rejects refresh with wrong client_id', async () => {
    const pair = await mintTokenPair(
      'account-123',
      {
        access_token: 'atl-access',
        refresh_token: 'atl-refresh',
        expires_in: 3600,
      },
      'client-abc',
    );

    const newPair = await refreshTokens(pair.refresh_token, 'wrong-client');
    expect(newPair).toBeNull();
  });

  it('ensureFreshToken returns same record if not expired', async () => {
    const record: OAuthTokenRecord = {
      token_hash: 'hash',
      client_id: 'client',
      atlassian_account_id: 'account',
      atlassian_access_token: 'token',
      atlassian_refresh_token: 'refresh',
      atlassian_token_expires_at: Date.now() + 3600000, // 1hr from now
      scope: 'bitbucket',
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    const result = await ensureFreshToken(record);
    expect(result.atlassian_access_token).toBe('token'); // unchanged
  });

  it('ensureFreshToken refreshes if token near expiry', async () => {
    const record: OAuthTokenRecord = {
      token_hash: 'hash',
      client_id: 'client',
      atlassian_account_id: 'account',
      atlassian_access_token: 'old-token',
      atlassian_refresh_token: 'refresh',
      atlassian_token_expires_at: Date.now() + 60000, // 1 min — within 5min buffer
      scope: 'bitbucket',
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    };

    const result = await ensureFreshToken(record);
    expect(result.atlassian_access_token).toBe('refreshed-atl-token');
  });
});
