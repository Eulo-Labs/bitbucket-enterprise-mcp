/**
 * Atlassian/Bitbucket OAuth Integration
 *
 * Implements Bitbucket OAuth 2.0 3-legged flow:
 * - buildAtlassianAuthUrl: Build authorization URL with PKCE params
 * - exchangeAtlassianCode: Exchange authorization code for tokens
 * - refreshAtlassianToken: Refresh expired access token
 * - getAtlassianUser: Get user profile from Bitbucket API
 */

import {
  BB_AUTH_URL,
  BB_TOKEN_URL,
  BB_USER_URL,
  BB_USER_EMAILS_URL,
  BB_SCOPES,
  getOAuthConfig,
  getOAuthClientSecret,
} from './config';

interface BitbucketTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scopes: string;
}

interface BitbucketUser {
  account_id: string;
  uuid: string;
  display_name: string;
  nickname: string;
  avatar_url: string | null;
}

/** Build the Bitbucket OAuth authorization URL */
export async function buildAtlassianAuthUrl(
  state: string,
  callbackUrl: string,
): Promise<string> {
  const config = await getOAuthConfig();
  if (!config) throw new Error('OAuth not configured');

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: callbackUrl,
    state,
    scope: BB_SCOPES,
  });

  const url = `${BB_AUTH_URL}?${params}`;
  return url;
}

/** Exchange a Bitbucket authorization code for tokens */
export async function exchangeAtlassianCode(
  code: string,
  callbackUrl: string,
): Promise<BitbucketTokenResponse> {
  const config = await getOAuthConfig();
  if (!config) throw new Error('OAuth not configured');

  const clientSecret = await getOAuthClientSecret();
  if (!clientSecret) throw new Error('OAuth client secret not configured');

  // Bitbucket uses form-encoded body with Basic auth
  const response = await fetch(BB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${config.clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Bitbucket token exchange failed: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as BitbucketTokenResponse;
}

/** Refresh a Bitbucket access token */
export async function refreshAtlassianToken(
  refreshToken: string,
): Promise<BitbucketTokenResponse> {
  const config = await getOAuthConfig();
  if (!config) throw new Error('OAuth not configured');

  const clientSecret = await getOAuthClientSecret();
  if (!clientSecret) throw new Error('OAuth client secret not configured');

  const response = await fetch(BB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${config.clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Bitbucket token refresh failed: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as BitbucketTokenResponse;
}

/** Get the Bitbucket user profile for an access token */
export async function getAtlassianUser(
  accessToken: string,
): Promise<BitbucketUser> {
  const response = await fetch(BB_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `Bitbucket user lookup failed: ${response.status} ${response.statusText}`,
    );
  }

  const user = (await response.json()) as Record<string, unknown>;
  const links = user.links as Record<string, unknown> | undefined;
  return {
    account_id: (user.account_id as string) || (user.uuid as string),
    uuid: user.uuid as string,
    display_name: user.display_name as string,
    nickname: user.nickname as string,
    avatar_url:
      ((links?.avatar as Record<string, unknown>)?.href as string) ?? null,
  };
}

/** Get the primary confirmed email for an access token */
export async function getAtlassianUserEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(BB_USER_EMAILS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const values = data.values as Array<Record<string, unknown>> | undefined;
  const primary = values?.find(
    (v) => v.is_primary === true && v.is_confirmed === true,
  );
  return (primary?.email as string) ?? null;
}
