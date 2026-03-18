/**
 * Session Management - minimal currently
 *
 * Creates, retrieves, and deletes MCP sessions stored in Forge KVS.
 * Sessions have a 30-minute TTL and store client info from initialize request.
 */
import { store } from '../kvs/service';
import type { SessionData } from './types';

const SESSION_PREFIX = 'mcp-session:';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Create a new session */
export async function createSession(clientInfo?: {
  name: string;
  version: string;
}): Promise<SessionData> {
  const idBytes = new Uint8Array(16);
  crypto.getRandomValues(idBytes);
  const id = Array.from(idBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const session: SessionData = {
    id,
    initialized: true,
    clientInfo,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  await store.set(`${SESSION_PREFIX}${id}`, session);
  return session;
}

/** Load and validate a session */
export async function getSession(id: string): Promise<SessionData | null> {
  const session = (await store.get(
    `${SESSION_PREFIX}${id}`,
  )) as SessionData | null;
  if (!session) return null;

  // Check expiry
  if (Date.now() - session.lastAccessedAt > SESSION_TTL_MS) {
    await store.delete(`${SESSION_PREFIX}${id}`);
    return null;
  }

  // Update last accessed (fire-and-forget — just bookkeeping for TTL)
  session.lastAccessedAt = Date.now();
  store.set(`${SESSION_PREFIX}${id}`, session).catch(() => {});
  return session;
}

/** Delete a session */
export async function deleteSession(id: string): Promise<void> {
  await store.delete(`${SESSION_PREFIX}${id}`);
}
