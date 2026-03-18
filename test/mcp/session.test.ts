import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @forge/kvs kvs
const mockStore: Record<string, unknown> = {};
vi.mock('@forge/kvs', () => ({
  kvs: {
    get: vi.fn(async (key: string) => {
      if (!(key in mockStore)) {
        const error = new Error('KEY_NOT_FOUND') as Error & { code?: string };
        error.code = 'KEY_NOT_FOUND';
        throw error;
      }
      return mockStore[key];
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      mockStore[key] = value;
    }),
    delete: vi.fn(async (key: string) => {
      delete mockStore[key];
    }),
  },
}));

import {
  createSession,
  getSession,
  deleteSession,
} from '../../src/mcp/session';

describe('session', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
    vi.clearAllMocks();
  });

  it('creates and retrieves a session', async () => {
    const session = await createSession({
      name: 'test-client',
      version: '1.0',
    });
    expect(session.id).toBeDefined();
    expect(session.initialized).toBe(true);
    expect(session.clientInfo?.name).toBe('test-client');

    const loaded = await getSession(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(session.id);
  });

  it('returns null for unknown session', async () => {
    const result = await getSession('nonexistent');
    expect(result).toBeNull();
  });

  it('deletes a session', async () => {
    const session = await createSession();
    await deleteSession(session.id);
    const result = await getSession(session.id);
    expect(result).toBeNull();
  });

  it('expires old sessions', async () => {
    const session = await createSession();
    // Manually set lastAccessedAt to 31 minutes ago
    const key = `mcp-session:${session.id}`;
    const stored = mockStore[key] as Record<string, unknown>;
    stored.lastAccessedAt = Date.now() - 31 * 60 * 1000;

    const result = await getSession(session.id);
    expect(result).toBeNull();
  });
});
