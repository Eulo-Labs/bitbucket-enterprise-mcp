/**
 * OAuth Request Handlers
 *
 * Implements OAuth 2.0 endpoints:
 * - handleMetadata: RFC 8414 authorization server metadata
 * - handleProtectedResourceMetadata: RFC 9728 protected resource metadata
 * - handleRegister: RFC 7591 dynamic client registration
 * - handleAuthorize: Start OAuth flow, redirect to Bitbucket
 * - handleCallback: Exchange code for tokens
 * - handleToken: Token exchange (authorization_code, refresh_token)
 */

import { store } from '../kvs/service';
import type { WebTriggerEvent, WebTriggerResponse } from '../mcp/types';
import type { OAuthAuthorizationCode } from './types';
import {
  KVS_PREFIX,
  TTL,
  sha256,
  generateToken,
  getOAuthConfig,
} from './config';
import { registerClient, getClient } from './clients';
import { verifyCodeChallenge } from './pkce';
import { mintTokenPair, refreshTokens } from './tokens';
import {
  buildAtlassianAuthUrl,
  exchangeAtlassianCode,
  getAtlassianUser,
} from './atlassian';

function jsonResponse(
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string[]>,
): WebTriggerResponse {
  return {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': ['application/json'],
      'Cache-Control': ['no-store'],
      'Access-Control-Allow-Origin': ['*'],
      'Access-Control-Allow-Methods': ['GET, POST, DELETE, OPTIONS'],
      'Access-Control-Allow-Headers': [
        'Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id',
      ],
      'Access-Control-Expose-Headers': [
        'WWW-Authenticate, Mcp-Session-Id, X-Resource-Metadata',
      ],
      ...extraHeaders,
    },
    statusCode,
  };
}

function redirectResponse(location: string): WebTriggerResponse {
  return {
    body: '',
    headers: {
      Location: [location],
    },
    statusCode: 302,
  };
}

function errorResponse(
  statusCode: number,
  error: string,
  description: string,
): WebTriggerResponse {
  return jsonResponse(statusCode, { error, error_description: description });
}

/** GET /.well-known/oauth-authorization-server — RFC 8414 metadata
 *  Also serves as /.well-known/openid-configuration for OIDC-compatible clients.
 *  Includes required OIDC fields so clients that validate as OIDC don't reject it. */
export function handleMetadata(baseUrl: string): WebTriggerResponse {
  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    jwks_uri: `${baseUrl}/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  };

  return jsonResponse(200, metadata);
}

/** GET /.well-known/oauth-protected-resource — RFC 9728 protected resource metadata */
export function handleProtectedResourceMetadata(
  baseUrl: string,
): WebTriggerResponse {
  const metadata = {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: [
      'read:repository',
      'read:pullrequest',
      'write:pullrequest',
      'read:pipeline',
      'write:pipeline',
      'read:project',
      'read:workspace',
      'read:user',
    ],
    bearer_methods_supported: ['header', 'body'],
  };

  return jsonResponse(200, metadata);
}

/** POST /register — Dynamic Client Registration (RFC 7591) */
export async function handleRegister(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body);
  } catch {
    return errorResponse(400, 'invalid_request', 'Invalid JSON body');
  }

  try {
    const client = await registerClient({
      client_name: body.client_name as string,
      redirect_uris: body.redirect_uris as string[],
      grant_types: body.grant_types as string[] | undefined,
      token_endpoint_auth_method: body.token_endpoint_auth_method as
        | string
        | undefined,
    });
    return jsonResponse(201, client);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(400, 'invalid_client_metadata', message);
  }
}

/** GET /authorize — Start OAuth authorization flow */
export async function handleAuthorize(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse> {
  const params = event.queryParameters;

  const clientId = params['client_id']?.[0];
  const redirectUri = params['redirect_uri']?.[0];
  const responseType = params['response_type']?.[0];
  const codeChallenge = params['code_challenge']?.[0];
  const codeChallengeMethod = params['code_challenge_method']?.[0];
  const state = params['state']?.[0];
  const scope = params['scope']?.[0];

  // Validate required params
  const missingParams = [
    !clientId && 'client_id',
    !redirectUri && 'redirect_uri',
    !responseType && 'response_type',
    !codeChallenge && 'code_challenge',
    !state && 'state',
  ].filter(Boolean);
  if (missingParams.length > 0) {
    return errorResponse(
      400,
      'invalid_request',
      `Missing required parameters: ${missingParams.join(', ')}`,
    );
  }

  if (responseType !== 'code') {
    return errorResponse(
      400,
      'unsupported_response_type',
      'Only response_type=code is supported',
    );
  }

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return errorResponse(
      400,
      'invalid_request',
      'Only S256 code_challenge_method is supported',
    );
  }

  // Verify client exists and redirect_uri is registered
  const client = await getClient(clientId);
  if (!client) {
    return errorResponse(400, 'invalid_client', 'Unknown client_id');
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    console.error('[authorize] redirect_uri mismatch', {
      received: redirectUri,
      registered: client.redirect_uris,
      clientId,
    });
    return errorResponse(
      400,
      'invalid_request',
      `redirect_uri is not registered for this client. Received: ${redirectUri}, registered: ${JSON.stringify(client.redirect_uris)}`,
    );
  }

  // Check OAuth config before any side effects
  const config = await getOAuthConfig();
  if (!config) {
    return errorResponse(
      503,
      'temporarily_unavailable',
      'OAuth is not yet configured on this server. Contact your administrator.',
    );
  }
  const callbackUrl = `${config.baseUrl}/callback`;

  // Store pending authorization state
  const pendingState = generateToken(16);
  await store.set(`${KVS_PREFIX.PENDING_AUTH}${pendingState}`, {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod || 'S256',
    client_state: state,
    scope: scope || 'bitbucket',
    created_at: Date.now(),
    expires_at: Date.now() + TTL.AUTH_CODE_MS,
  });

  // Redirect to Atlassian authorization
  const atlassianUrl = await buildAtlassianAuthUrl(pendingState, callbackUrl);
  return redirectResponse(atlassianUrl);
}

/** GET /callback — Atlassian OAuth callback */
export async function handleCallback(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse> {
  const params = event.queryParameters;
  const atlassianCode = params['code']?.[0];
  const state = params['state']?.[0];
  const error = params['error']?.[0];

  if (error) {
    const errorDescription =
      params['error_description']?.[0] || 'Authorization denied';
    return errorResponse(400, 'access_denied', errorDescription);
  }

  if (!atlassianCode || !state) {
    return errorResponse(400, 'invalid_request', 'Missing code or state');
  }

  // Retrieve pending auth
  const pending = (await store.get(`${KVS_PREFIX.PENDING_AUTH}${state}`)) as {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: string;
    client_state: string;
    scope: string;
    expires_at: number;
  } | null;

  if (!pending) {
    return errorResponse(400, 'invalid_request', 'Invalid or expired state');
  }

  // Check expiry
  if (Date.now() > pending.expires_at) {
    await store.delete(`${KVS_PREFIX.PENDING_AUTH}${state}`);
    return errorResponse(
      400,
      'invalid_request',
      'Authorization request expired',
    );
  }

  // Clean up pending state
  await store.delete(`${KVS_PREFIX.PENDING_AUTH}${state}`);

  // Exchange Atlassian code for tokens
  const config = await getOAuthConfig();
  if (!config) {
    return errorResponse(500, 'server_error', 'OAuth not configured');
  }
  const callbackUrl = `${config.baseUrl}/callback`;

  let atlassianTokens;
  try {
    atlassianTokens = await exchangeAtlassianCode(atlassianCode, callbackUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Atlassian code exchange failed:', message);
    return errorResponse(
      500,
      'server_error',
      'Failed to exchange authorization code',
    );
  }

  // Get user identity
  let user;
  try {
    user = await getAtlassianUser(atlassianTokens.access_token);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Atlassian user lookup failed:', message);
    return errorResponse(500, 'server_error', 'Failed to get user identity');
  }

  // Mint MCP authorization code
  const mcpCode = generateToken(32);
  const mcpCodeHash = await sha256(mcpCode);

  const authCode: OAuthAuthorizationCode = {
    code_hash: mcpCodeHash,
    client_id: pending.client_id,
    redirect_uri: pending.redirect_uri,
    code_challenge: pending.code_challenge,
    code_challenge_method: 'S256',
    atlassian_account_id: user.account_id,
    atlassian_access_token: atlassianTokens.access_token,
    atlassian_refresh_token: atlassianTokens.refresh_token,
    expires_at: Date.now() + TTL.AUTH_CODE_MS,
  };

  await store.set(`${KVS_PREFIX.CODE}${mcpCodeHash}`, authCode);

  // Redirect back to client with MCP auth code
  const redirectUrl = new URL(pending.redirect_uri);
  redirectUrl.searchParams.set('code', mcpCode);
  redirectUrl.searchParams.set('state', pending.client_state);

  return redirectResponse(redirectUrl.toString());
}

/** POST /token — Token exchange */
export async function handleToken(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse> {
  let body: Record<string, string>;
  try {
    // Support both JSON and form-encoded
    const contentType =
      event.headers['content-type']?.[0] ||
      event.headers['Content-Type']?.[0] ||
      '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(new URLSearchParams(event.body));
    } else {
      body = JSON.parse(event.body);
    }
  } catch {
    return errorResponse(400, 'invalid_request', 'Invalid request body');
  }

  const grantType = body.grant_type;

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(body);
  } else if (grantType === 'refresh_token') {
    return handleRefreshTokenGrant(body);
  } else {
    return errorResponse(
      400,
      'unsupported_grant_type',
      `Unsupported grant_type: ${grantType}`,
    );
  }
}

async function handleAuthorizationCodeGrant(
  body: Record<string, string>,
): Promise<WebTriggerResponse> {
  const { code, client_id, redirect_uri, code_verifier } = body;

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return errorResponse(
      400,
      'invalid_request',
      'Missing required parameters: code, client_id, redirect_uri, code_verifier',
    );
  }

  // Verify client exists
  const client = await getClient(client_id);
  if (!client) {
    return errorResponse(400, 'invalid_client', 'Unknown client_id');
  }

  // Look up auth code
  const codeHash = await sha256(code);
  const authCode = (await store.get(
    `${KVS_PREFIX.CODE}${codeHash}`,
  )) as OAuthAuthorizationCode | null;

  if (!authCode) {
    return errorResponse(
      400,
      'invalid_grant',
      'Invalid or expired authorization code',
    );
  }

  // Check expiry
  if (Date.now() > authCode.expires_at) {
    await store.delete(`${KVS_PREFIX.CODE}${codeHash}`);
    return errorResponse(400, 'invalid_grant', 'Authorization code expired');
  }

  // Verify client_id matches
  if (authCode.client_id !== client_id) {
    await store.delete(`${KVS_PREFIX.CODE}${codeHash}`);
    return errorResponse(400, 'invalid_grant', 'client_id mismatch');
  }

  // Verify redirect_uri matches
  if (authCode.redirect_uri !== redirect_uri) {
    await store.delete(`${KVS_PREFIX.CODE}${codeHash}`);
    return errorResponse(400, 'invalid_grant', 'redirect_uri mismatch');
  }

  // Verify PKCE
  const pkceValid = await verifyCodeChallenge(
    code_verifier,
    authCode.code_challenge,
    authCode.code_challenge_method,
  );
  if (!pkceValid) {
    await store.delete(`${KVS_PREFIX.CODE}${codeHash}`);
    return errorResponse(400, 'invalid_grant', 'PKCE verification failed');
  }

  // Delete the used auth code (single-use)
  await store.delete(`${KVS_PREFIX.CODE}${codeHash}`);

  // Mint MCP token pair
  const tokenPair = await mintTokenPair(
    authCode.atlassian_account_id,
    {
      access_token: authCode.atlassian_access_token,
      refresh_token: authCode.atlassian_refresh_token,
      expires_in: 3600, // Atlassian tokens are typically 1hr
    },
    client_id,
  );

  return jsonResponse(200, tokenPair);
}

async function handleRefreshTokenGrant(
  body: Record<string, string>,
): Promise<WebTriggerResponse> {
  const { refresh_token, client_id } = body;

  if (!refresh_token || !client_id) {
    return errorResponse(
      400,
      'invalid_request',
      'Missing required parameters: refresh_token, client_id',
    );
  }

  const tokenPair = await refreshTokens(refresh_token, client_id);
  if (!tokenPair) {
    return errorResponse(
      400,
      'invalid_grant',
      'Invalid or expired refresh token',
    );
  }

  return jsonResponse(200, tokenPair);
}
