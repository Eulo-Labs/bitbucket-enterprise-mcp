import { describe, it, expect } from 'vitest';
import { verifyCodeChallenge } from '../../src/oauth/pkce';

describe('PKCE verification', () => {
  it('verifies a valid S256 code challenge', async () => {
    // Known test vector: code_verifier → SHA-256 → base64url
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    // Compute expected challenge: SHA-256 of verifier, base64url encoded
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const base64 = btoa(String.fromCharCode(...hashArray));
    const expectedChallenge = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await verifyCodeChallenge(
      codeVerifier,
      expectedChallenge,
      'S256',
    );
    expect(result).toBe(true);
  });

  it('rejects an invalid code verifier', async () => {
    const result = await verifyCodeChallenge(
      'wrong-verifier',
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      'S256',
    );
    expect(result).toBe(false);
  });

  it('rejects non-S256 methods', async () => {
    const result = await verifyCodeChallenge('verifier', 'challenge', 'plain');
    expect(result).toBe(false);
  });
});
