/**
 * Authentication
 *
 * Extracts and validates OAuth Bearer tokens from Authorization header.
 * Validates tokens against KVS-stored token records and ensures Atlassian
 * access tokens are fresh (refreshes if needed).
 */
import { store } from '../kvs/service';
import { validateAccessToken, ensureFreshToken } from '../oauth/tokens';
import { refreshAtlassianToken } from '../oauth/atlassian';
import { KVS_PREFIX } from '../oauth/config';
import type { OAuthTokenRecord } from '../oauth/types';

/** Extract Bearer token from Authorization header */
export function extractBearerToken(
  headers: Record<string, string[]>,
): string | null {
  const authHeader =
    headers['authorization']?.[0] || headers['Authorization']?.[0];
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

export interface AuthResult {
  accountId: string;
  userToken: string;
  tokenRecord: OAuthTokenRecord;
}

/** Authenticate a request using OAuth token validation */
export async function authenticateRequest(
  token: string,
): Promise<AuthResult | null> {
  const record = await validateAccessToken(token);
  if (!record) return null;

  // If MCP access token is expired, refresh Atlassian tokens in-place
  if (Date.now() > record.expires_at) {
    const atlassianTokens = await refreshAtlassianToken(
      record.atlassian_refresh_token,
    );

    const updatedRecord: OAuthTokenRecord = {
      ...record,
      atlassian_access_token: atlassianTokens.access_token,
      atlassian_refresh_token: atlassianTokens.refresh_token,
      atlassian_token_expires_at:
        Date.now() + atlassianTokens.expires_in * 1000,
    };

    await store.set(`${KVS_PREFIX.TOKEN}${record.token_hash}`, updatedRecord);
  }

  // Ensure the Atlassian token is fresh (within 5 min buffer)
  const freshRecord = await ensureFreshToken(record);

  return {
    accountId: freshRecord.atlassian_account_id,
    userToken: freshRecord.atlassian_access_token,
    tokenRecord: freshRecord,
  };
}
