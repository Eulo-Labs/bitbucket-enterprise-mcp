/**
 * OAuth Request Router
 *
 * Routes incoming requests to appropriate OAuth endpoints based on path:
 * - /.well-known/oauth-authorization-server (metadata)
 * - /.well-known/oauth-protected-resource (resource metadata)
 * - /register (dynamic client registration)
 * - /authorize (authorization code flow start)
 * - /callback (authorization code exchange)
 * - /token (token exchange/refresh)
 */
import type { WebTriggerEvent, WebTriggerResponse } from '../mcp/types';
import { deriveBaseUrl, getOAuthConfig } from './config';
import {
  handleMetadata,
  handleProtectedResourceMetadata,
  handleRegister,
  handleAuthorize,
  handleCallback,
  handleToken,
} from './handlers';

/** Resolve the base URL from config or from the incoming request. */
async function resolveBaseUrl(event: WebTriggerEvent): Promise<string> {
  const config = await getOAuthConfig();
  return (
    config?.baseUrl || deriveBaseUrl(event.headers, event.path, event.userPath)
  );
}

/** Route OAuth requests based on path suffix. Returns null if not an OAuth path. */
export async function routeOAuthRequest(
  event: WebTriggerEvent,
): Promise<WebTriggerResponse | null> {
  const path = event.path;

  // OPTIONS is handled globally in the main handler before we get here.

  // Strip any leading path segments (Forge web trigger adds prefix)
  // Match on the last path component(s)
  if (
    path.endsWith('/.well-known/oauth-authorization-server') ||
    path.endsWith('/.well-known/openid-configuration')
  ) {
    if (event.method !== 'GET') {
      return methodNotAllowed();
    }
    return handleMetadata(await resolveBaseUrl(event));
  }

  if (path.endsWith('/.well-known/oauth-protected-resource')) {
    if (event.method !== 'GET') {
      return methodNotAllowed();
    }
    return handleProtectedResourceMetadata(await resolveBaseUrl(event));
  }

  if (path.endsWith('/register')) {
    if (event.method !== 'POST') {
      return methodNotAllowed();
    }
    return handleRegister(event);
  }

  if (path.endsWith('/authorize')) {
    if (event.method !== 'GET') {
      return methodNotAllowed();
    }
    return handleAuthorize(event);
  }

  if (path.endsWith('/callback')) {
    if (event.method !== 'GET') {
      return methodNotAllowed();
    }
    return handleCallback(event);
  }

  if (path.endsWith('/token')) {
    if (event.method !== 'POST') {
      return methodNotAllowed();
    }
    return handleToken(event);
  }

  // Not an OAuth path
  return null;
}

function methodNotAllowed(): WebTriggerResponse {
  return {
    body: JSON.stringify({ error: 'method_not_allowed' }),
    headers: { 'Content-Type': ['application/json'] },
    statusCode: 405,
  };
}
