/**
 * Bitbucket API Client
 *
 * HTTP client for Bitbucket REST API:
 * - Validates API paths (must start with /2.0/)
 * - Prevents path traversal attacks
 * - Provides get, post, delete methods
 * - bbPath: Helper to build paths with encoded segments
 * - assertOk: Check response and throw on error
 */

import type { BitbucketRequestOptions, BitbucketResponse } from './types';

const BITBUCKET_API_BASE = 'https://api.bitbucket.org';

/**
 * Bitbucket API client for Forge.
 * All requests use the authenticated user's OAuth token.
 */
export class BitbucketClient {
  async request(
    path: string,
    options: BitbucketRequestOptions,
  ): Promise<BitbucketResponse> {
    // Validate path
    if (!path.startsWith('/2.0/')) {
      throw new Error(`Invalid API path: must start with /2.0/ (got: ${path})`);
    }

    // Validate no path traversal
    const segments = path.split('?')[0].split('/');
    for (const segment of segments) {
      if (!segment) continue;
      const decoded = decodeURIComponent(segment);
      if (decoded === '..' || decoded === '.') {
        throw new Error(`Path traversal detected: ${path}`);
      }
    }

    const url = `${BITBUCKET_API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.userToken}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json() as Promise<unknown>,
      text: () => response.text(),
    };
  }

  async get(path: string, userToken: string): Promise<BitbucketResponse> {
    return this.request(path, { method: 'GET', userToken });
  }

  async post(
    path: string,
    body?: string,
    headers?: Record<string, string>,
    userToken?: string,
  ): Promise<BitbucketResponse> {
    return this.request(path, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', ...headers },
      userToken,
    });
  }

  async delete(path: string, userToken: string): Promise<BitbucketResponse> {
    return this.request(path, { method: 'DELETE', userToken });
  }
}

/** Singleton client instance */
export const bbClient = new BitbucketClient();

/** Helper to build Bitbucket API path with encoded segments */
export function bbPath(
  template: string,
  params: Record<string, string>,
): string {
  let path = template;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}

/** Check API response and throw descriptive error if not ok */
export function assertOk(response: BitbucketResponse, context: string): void {
  if (!response.ok) {
    throw new Error(
      `Bitbucket API error (${context}): ${response.status} ${response.statusText}`,
    );
  }
}
