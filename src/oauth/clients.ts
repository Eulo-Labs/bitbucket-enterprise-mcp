/**
 * OAuth Client Registration
 *
 * Implements RFC 7591 Dynamic Client Registration:
 * - registerClient: Register new OAuth clients with redirect URIs
 * - getClient: Retrieve registered client by client_id
 * Only supports public clients (no client secrets, PKCE required).
 */

import { store } from '../kvs/service';
import type { OAuthClientRegistration } from './types';
import { KVS_PREFIX, generateToken } from './config';

/** Register a new OAuth client (RFC 7591 Dynamic Client Registration) */
export async function registerClient(registration: {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
  token_endpoint_auth_method?: string;
}): Promise<OAuthClientRegistration> {
  // Validate required fields
  if (!registration.client_name) {
    throw new Error('client_name is required');
  }
  if (!registration.redirect_uris || registration.redirect_uris.length === 0) {
    throw new Error('redirect_uris is required and must not be empty');
  }

  // Validate redirect URIs
  for (const uri of registration.redirect_uris) {
    try {
      const parsed = new URL(uri);
      // Allow localhost for development, require HTTPS otherwise
      if (
        parsed.protocol !== 'https:' &&
        parsed.hostname !== 'localhost' &&
        parsed.hostname !== '127.0.0.1'
      ) {
        throw new Error(
          `redirect_uri must use HTTPS (except localhost): ${uri}`,
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('redirect_uri')) throw e;
      throw new Error(`Invalid redirect_uri: ${uri}`, { cause: e });
    }
  }

  // Public clients only — no client_secret, PKCE required
  if (
    registration.token_endpoint_auth_method &&
    registration.token_endpoint_auth_method !== 'none'
  ) {
    throw new Error(
      'Only public clients (token_endpoint_auth_method: none) are supported',
    );
  }

  const client_id = generateToken(16); // 32 hex chars

  const client: OAuthClientRegistration = {
    client_id,
    client_name: registration.client_name,
    redirect_uris: registration.redirect_uris,
    grant_types: registration.grant_types || ['authorization_code'],
    token_endpoint_auth_method: 'none',
    created_at: Date.now(),
  };

  await store.set(`${KVS_PREFIX.CLIENT}${client_id}`, client);

  return client;
}

/** Retrieve a registered client by client_id */
export async function getClient(
  clientId: string,
): Promise<OAuthClientRegistration | null> {
  return (await store.get(
    `${KVS_PREFIX.CLIENT}${clientId}`,
  )) as OAuthClientRegistration | null;
}
