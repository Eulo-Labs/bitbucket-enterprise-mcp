import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      getSecret: vi.fn(),
      setSecret: vi.fn(),
    },
  };
});

import { registerClient, getClient } from '../../src/oauth/clients';

describe('OAuth client registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a client and retrieves it', async () => {
    const client = await registerClient({
      client_name: 'Test Client',
      redirect_uris: ['https://example.com/callback'],
    });

    expect(client.client_id).toBeDefined();
    expect(client.client_name).toBe('Test Client');
    expect(client.redirect_uris).toEqual(['https://example.com/callback']);
    expect(client.token_endpoint_auth_method).toBe('none');
    expect(client.grant_types).toEqual(['authorization_code']);

    const retrieved = await getClient(client.client_id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.client_id).toBe(client.client_id);
  });

  it('allows localhost redirect URIs', async () => {
    const client = await registerClient({
      client_name: 'Dev Client',
      redirect_uris: ['http://localhost:3000/callback'],
    });
    expect(client.client_id).toBeDefined();
  });

  it('rejects non-HTTPS redirect URIs', async () => {
    await expect(
      registerClient({
        client_name: 'Bad Client',
        redirect_uris: ['http://example.com/callback'],
      }),
    ).rejects.toThrow('redirect_uri must use HTTPS');
  });

  it('rejects missing client_name', async () => {
    await expect(
      registerClient({
        client_name: '',
        redirect_uris: ['https://example.com/callback'],
      }),
    ).rejects.toThrow('client_name is required');
  });

  it('rejects empty redirect_uris', async () => {
    await expect(
      registerClient({
        client_name: 'Test',
        redirect_uris: [],
      }),
    ).rejects.toThrow('redirect_uris is required');
  });

  it('rejects non-public clients', async () => {
    await expect(
      registerClient({
        client_name: 'Test',
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'client_secret_basic',
      }),
    ).rejects.toThrow('Only public clients');
  });

  it('returns null for unknown client', async () => {
    const client = await getClient('nonexistent');
    expect(client).toBeNull();
  });
});
