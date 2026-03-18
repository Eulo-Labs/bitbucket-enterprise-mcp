import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebTriggerEvent } from '../../src/mcp/types';

// Mock @forge/kvs
vi.mock('@forge/kvs', () => {
  const store = new Map<string, unknown>();
  return {
    kvs: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
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

// Mock OAuth config
vi.mock('../../src/oauth/config', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    getOAuthConfig: vi.fn(async () => ({
      clientId: 'test-3lo-client',
      baseUrl: 'https://example.com/mcp',
    })),
    getOAuthClientSecret: vi.fn(async () => 'test-3lo-secret'),
  };
});

// Mock atlassian module
vi.mock('../../src/oauth/atlassian', () => ({
  buildAtlassianAuthUrl: vi.fn(
    async (state: string) =>
      `https://auth.atlassian.com/authorize?state=${state}`,
  ),
  exchangeAtlassianCode: vi.fn(async () => ({
    access_token: 'atl-access-token',
    refresh_token: 'atl-refresh-token',
    expires_in: 3600,
  })),
  getAtlassianUser: vi.fn(async () => ({
    account_id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: '',
  })),
  refreshAtlassianToken: vi.fn(async () => ({
    access_token: 'refreshed-atl-token',
    refresh_token: 'refreshed-atl-refresh',
    expires_in: 3600,
  })),
}));

import {
  handleMetadata,
  handleRegister,
  handleToken,
  handleAuthorize,
} from '../../src/oauth/handlers';
import { getOAuthConfig } from '../../src/oauth/config';
import { kvs } from '@forge/kvs';

function makeEvent(
  method: string,
  body: unknown = '',
  path: string = '/mcp',
  queryParameters: Record<string, string[]> = {},
): WebTriggerEvent {
  return {
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'content-type': ['application/json'],
    },
    path,
    queryParameters,
  };
}

describe('OAuth handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleMetadata', () => {
    it('returns RFC 8414 metadata', async () => {
      const res = handleMetadata('https://example.com/mcp');
      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body.issuer).toBe('https://example.com/mcp');
      expect(body.authorization_endpoint).toBe(
        'https://example.com/mcp/authorize',
      );
      expect(body.token_endpoint).toBe('https://example.com/mcp/token');
      expect(body.registration_endpoint).toBe(
        'https://example.com/mcp/register',
      );
      expect(body.code_challenge_methods_supported).toEqual(['S256']);
    });
  });

  describe('handleRegister', () => {
    it('registers a new client', async () => {
      const event = makeEvent('POST', {
        client_name: 'Test Client',
        redirect_uris: ['https://example.com/callback'],
      });
      const res = await handleRegister(event);
      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.body);
      expect(body.client_id).toBeDefined();
      expect(body.client_name).toBe('Test Client');
    });

    it('returns 400 for invalid registration', async () => {
      const event = makeEvent('POST', {
        client_name: '',
        redirect_uris: ['https://example.com/callback'],
      });
      const res = await handleRegister(event);
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid JSON', async () => {
      const event = makeEvent('POST', 'not json');
      event.body = 'not json';
      const res = await handleRegister(event);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('handleToken', () => {
    it('returns 400 for unsupported grant type', async () => {
      const event = makeEvent('POST', {
        grant_type: 'client_credentials',
      });
      const res = await handleToken(event);
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('unsupported_grant_type');
    });

    it('returns 400 for missing auth code params', async () => {
      const event = makeEvent('POST', {
        grant_type: 'authorization_code',
      });
      const res = await handleToken(event);
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('invalid_request');
    });

    it('returns 400 for missing refresh token params', async () => {
      const event = makeEvent('POST', {
        grant_type: 'refresh_token',
      });
      const res = await handleToken(event);
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('invalid_request');
    });
  });

  describe('handleAuthorize', () => {
    it('returns 503 and does not write KVS when OAuth is not configured', async () => {
      vi.mocked(getOAuthConfig).mockResolvedValueOnce(null);

      // Register a client first so client validation passes
      const registerEvent = makeEvent('POST', {
        client_name: 'Test Client',
        redirect_uris: ['https://client.example.com/callback'],
      });
      const registerRes = await handleRegister(registerEvent);
      const { client_id } = JSON.parse(registerRes.body);

      vi.clearAllMocks();
      vi.mocked(getOAuthConfig).mockResolvedValueOnce(null);

      const event = makeEvent('GET', '', '/authorize', {
        client_id: [client_id],
        redirect_uri: ['https://client.example.com/callback'],
        response_type: ['code'],
        code_challenge: ['abc123challenge'],
        state: ['random-state'],
      });

      const res = await handleAuthorize(event);
      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('temporarily_unavailable');
      expect(body.error_description).toBe(
        'OAuth is not yet configured on this server. Contact your administrator.',
      );
      expect(vi.mocked(kvs.set)).not.toHaveBeenCalled();
    });
  });
});
