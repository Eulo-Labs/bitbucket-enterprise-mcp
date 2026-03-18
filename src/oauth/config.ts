/**
 * OAuth Configuration
 *
 * Defines OAuth endpoints, KVS key prefixes, TTL values, and Bitbucket scopes.
 * Provides utilities for reading config, deriving base URL, SHA-256 hashing,
 * and generating cryptographically random tokens.
 */

import { store } from '../kvs/service';
import type { OAuthConfig } from './types';

/** Bitbucket OAuth 2.0 endpoints */
export const BB_AUTH_URL = 'https://bitbucket.org/site/oauth2/authorize';
export const BB_TOKEN_URL = 'https://bitbucket.org/site/oauth2/access_token';
export const BB_USER_URL = 'https://api.bitbucket.org/2.0/user';
export const BB_USER_EMAILS_URL = 'https://api.bitbucket.org/2.0/user/emails';

/** KVS key prefixes */
export const KVS_PREFIX = {
  CLIENT: 'oauth-client:',
  CODE: 'oauth-code:',
  TOKEN: 'oauth-token:',
  REFRESH: 'oauth-refresh:',
  CONFIG: 'oauth-config',
  PENDING_AUTH: 'oauth-pending:',
  TOOLS_CONFIG: 'tools-config:',
  READ_ONLY_MODE: 'read-only-mode',
} as const;

/** TTLs */
export const TTL = {
  ACCESS_TOKEN_MS: 60 * 60 * 1000, // 1 hour
  REFRESH_TOKEN_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  AUTH_CODE_MS: 10 * 60 * 1000, // 10 minutes
} as const;

/** Bitbucket OAuth scopes we request */
export const BB_SCOPES = [
  'repository',
  'pullrequest',
  'pipeline',
  'project',
  'account',
  'email',
].join(' ');

/** Read OAuth config (3LO client_id, base URL) from KVS */
export async function getOAuthConfig(): Promise<OAuthConfig | null> {
  const config = (await store.get(KVS_PREFIX.CONFIG)) as OAuthConfig | null;
  return config;
}

/** Read 3LO client secret from KVS secrets */
export async function getOAuthClientSecret(): Promise<string | null> {
  const secret = await store.getSecret('oauth-client-secret');
  return (secret as string) || null;
}

/**
 * Derive the web trigger base URL from request headers.
 * Uses Host header + path minus userPath to reconstruct the trigger URL.
 */
export function deriveBaseUrl(
  headers: Record<string, string[]>,
  path: string,
  userPath: string,
): string {
  const host = headers['host']?.[0] || headers['Host']?.[0] || '';
  const proto = headers['x-forwarded-proto']?.[0] || 'https';
  // The trigger base path is the full path minus the user-supplied suffix
  const triggerBasePath = userPath
    ? path.slice(0, path.length - userPath.length)
    : path;
  return `${proto}://${host}${triggerBasePath}`;
}

/** SHA-256 hash helper */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a cryptographically random token */
export function generateToken(bytes: number = 32): string {
  const tokenBytes = new Uint8Array(bytes);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
