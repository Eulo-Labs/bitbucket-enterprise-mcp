/**
 * OAuth Types
 *
 * TypeScript type definitions for OAuth 2.0/2.1:
 * - OAuthClientRegistration: Registered client data
 * - OAuthAuthorizationCode: Authorization code record
 * - OAuthTokenRecord: Access token record in KVS
 * - OAuthRefreshTokenRecord: Refresh token record in KVS
 * - OAuthConfig: App configuration (client_id, base_url)
 */

/** OAuth 2.1 types */

export interface OAuthClientRegistration {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: 'none';
  created_at: number;
}

export interface OAuthAuthorizationCode {
  code_hash: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  atlassian_account_id: string;
  atlassian_access_token: string;
  atlassian_refresh_token: string;
  expires_at: number;
}

export interface OAuthTokenRecord {
  token_hash: string;
  client_id: string;
  atlassian_account_id: string;
  atlassian_access_token: string;
  atlassian_refresh_token: string;
  atlassian_token_expires_at: number;
  scope: string;
  created_at: number;
  expires_at: number;
}

export interface OAuthRefreshTokenRecord {
  refresh_token_hash: string;
  access_token_hash: string;
  client_id: string;
  atlassian_account_id: string;
  atlassian_access_token: string;
  atlassian_refresh_token: string;
  atlassian_token_expires_at: number;
  scope: string;
  created_at: number;
  expires_at: number;
}

export interface OAuthConfig {
  clientId: string;
  baseUrl: string;
}
