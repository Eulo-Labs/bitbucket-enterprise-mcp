/**
 * PKCE Verification
 *
 * Implements RFC 7636 PKCE (Proof Key for Code Exchange):
 * - verifyCodeChallenge: Verify code_verifier against code_challenge
 * Supports S256 method only (plain is not secure).
 */

/** PKCE (RFC 7636) verification for OAuth 2.1 */

/** Verify a PKCE code challenge against the code verifier */
export async function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string,
): Promise<boolean> {
  if (method !== 'S256') {
    return false;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Base64url encode the hash (RFC 4648 §5)
  const hashArray = new Uint8Array(hashBuffer);
  const base64 = btoa(String.fromCharCode(...hashArray));
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64url === codeChallenge;
}
