/**
 * KVS Service Layer
 *
 * Centralises all @forge/kvs access. Callers never need to catch KEY_NOT_FOUND —
 * get/getSecret return null when the key is absent.
 */
import { kvs } from '@forge/kvs';

async function get(key: string): Promise<unknown> {
  try {
    return await kvs.get(key);
  } catch (e) {
    if ((e as Error & { code?: string }).code === 'KEY_NOT_FOUND') {
      return null;
    }
    throw e;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  await kvs.set(key, value);
}

async function del(key: string): Promise<void> {
  await kvs.delete(key);
}

async function getSecret(key: string): Promise<unknown> {
  try {
    return await kvs.getSecret(key);
  } catch (e) {
    if ((e as Error & { code?: string }).code === 'KEY_NOT_FOUND') {
      return null;
    }
    throw e;
  }
}

async function setSecret(key: string, value: unknown): Promise<void> {
  await kvs.setSecret(key, value);
}

async function deleteSecret(key: string): Promise<void> {
  await kvs.deleteSecret(key);
}

export const store = {
  get,
  set,
  delete: del,
  getSecret,
  setSecret,
  deleteSecret,
};
