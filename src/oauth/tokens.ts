/**
 * Token Management
 *
 * Handles minting, validating, and refreshing OAuth tokens:
 * - mintTokenPair: Create new access/refresh token pair
 * - validateAccessToken: Verify access token and check expiry
 * - refreshTokens: Exchange refresh token for new token pair
 * - ensureFreshToken: Refresh Atlassian token if within 5 min of expiry
 */

import { store } from '../kvs/service';
import type { OAuthTokenRecord, OAuthRefreshTokenRecord } from './types';
import { KVS_PREFIX, TTL, sha256, generateToken } from './config';
import { refreshAtlassianToken } from './atlassian';

interface AtlassianTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/** Mint a new access token + refresh token pair */
export async function mintTokenPair(
  accountId: string,
  atlassianTokens: AtlassianTokens,
  clientId: string,
): Promise<TokenPair> {
  const accessToken = generateToken(32);
  const refreshToken = generateToken(32);

  const accessTokenHash = await sha256(accessToken);
  const refreshTokenHash = await sha256(refreshToken);

  const now = Date.now();
  const atlassianExpiresAt = now + atlassianTokens.expires_in * 1000;

  const tokenRecord: OAuthTokenRecord = {
    token_hash: accessTokenHash,
    client_id: clientId,
    atlassian_account_id: accountId,
    atlassian_access_token: atlassianTokens.access_token,
    atlassian_refresh_token: atlassianTokens.refresh_token,
    atlassian_token_expires_at: atlassianExpiresAt,
    scope: 'bitbucket',
    created_at: now,
    expires_at: now + TTL.ACCESS_TOKEN_MS,
  };

  const refreshRecord: OAuthRefreshTokenRecord = {
    refresh_token_hash: refreshTokenHash,
    access_token_hash: accessTokenHash,
    client_id: clientId,
    atlassian_account_id: accountId,
    atlassian_access_token: atlassianTokens.access_token,
    atlassian_refresh_token: atlassianTokens.refresh_token,
    atlassian_token_expires_at: atlassianExpiresAt,
    scope: 'bitbucket',
    created_at: now,
    expires_at: now + TTL.REFRESH_TOKEN_MS,
  };

  await Promise.all([
    store.set(`${KVS_PREFIX.TOKEN}${accessTokenHash}`, tokenRecord),
    store.set(`${KVS_PREFIX.REFRESH}${refreshTokenHash}`, refreshRecord),
  ]);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: Math.floor(TTL.ACCESS_TOKEN_MS / 1000),
  };
}

/** Validate an access token and return its record */
export async function validateAccessToken(
  token: string,
): Promise<OAuthTokenRecord | null> {
  const tokenHash = await sha256(token);
  const record = (await store.get(
    `${KVS_PREFIX.TOKEN}${tokenHash}`,
  )) as OAuthTokenRecord | null;

  if (!record) return null;

  // Note: Caller should check expires_at to determine if token is expired
  // We return the record even if expired so caller can use the refresh token

  return record;
}

/** Refresh tokens using a refresh token */
export async function refreshTokens(
  refreshToken: string,
  clientId: string,
): Promise<TokenPair | null> {
  const refreshTokenHash = await sha256(refreshToken);
  const record = (await store.get(
    `${KVS_PREFIX.REFRESH}${refreshTokenHash}`,
  )) as OAuthRefreshTokenRecord | null;

  if (!record) return null;

  // Check expiry
  if (Date.now() > record.expires_at) {
    await store.delete(`${KVS_PREFIX.REFRESH}${refreshTokenHash}`);
    return null;
  }

  // Verify client_id matches
  if (record.client_id !== clientId) {
    return null;
  }

  // Refresh the Atlassian token
  const atlassianTokens = await refreshAtlassianToken(
    record.atlassian_refresh_token,
  );

  // Delete old tokens
  await Promise.all([
    store.delete(`${KVS_PREFIX.REFRESH}${refreshTokenHash}`),
    store.delete(`${KVS_PREFIX.TOKEN}${record.access_token_hash}`),
  ]);

  // Mint new pair
  return mintTokenPair(record.atlassian_account_id, atlassianTokens, clientId);
}

/** Revoke an access token */
export async function revokeToken(token: string): Promise<void> {
  const tokenHash = await sha256(token);
  await store.delete(`${KVS_PREFIX.TOKEN}${tokenHash}`);
}

/** Ensure the Atlassian token is fresh; refresh if within 5 min of expiry */
export async function ensureFreshToken(
  record: OAuthTokenRecord,
): Promise<OAuthTokenRecord> {
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  if (Date.now() + REFRESH_BUFFER_MS < record.atlassian_token_expires_at) {
    return record; // Still fresh
  }

  // Refresh the Atlassian token
  const atlassianTokens = await refreshAtlassianToken(
    record.atlassian_refresh_token,
  );

  // Update the record in KVS
  const updatedRecord: OAuthTokenRecord = {
    ...record,
    atlassian_access_token: atlassianTokens.access_token,
    atlassian_refresh_token: atlassianTokens.refresh_token,
    atlassian_token_expires_at: Date.now() + atlassianTokens.expires_in * 1000,
  };

  await store.set(`${KVS_PREFIX.TOKEN}${record.token_hash}`, updatedRecord);

  return updatedRecord;
}
