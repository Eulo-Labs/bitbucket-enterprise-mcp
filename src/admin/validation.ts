/**
 * Admin Validation Functions
 *
 * Shared validation functions for admin API and resolver.
 */

import { getToolKeys } from '../tools/registry';
import { MAX_SLUG_LENGTH, isValidSlug } from '../utils/validation';

const MAX_CLIENT_ID_LENGTH = 128;
const MAX_CLIENT_SECRET_LENGTH = 256;

const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

type ToolKey = ReturnType<typeof getToolKeys>[number];

export function validateClientId(value: string): string | undefined {
  if (!value) return 'Client ID is required';
  if (value.length > MAX_CLIENT_ID_LENGTH) {
    return `Client ID must be ${MAX_CLIENT_ID_LENGTH} characters or less`;
  }
  if (!CLIENT_ID_PATTERN.test(value)) {
    return 'Client ID can only contain alphanumeric characters, underscores, and hyphens';
  }
  return undefined;
}

export function validateClientSecret(
  value: string | undefined,
): string | undefined {
  if (value && value.length > MAX_CLIENT_SECRET_LENGTH) {
    return `Client Secret must be ${MAX_CLIENT_SECRET_LENGTH} characters or less`;
  }
  return undefined;
}

export function validateToolKeys(
  tools: unknown,
): tools is Partial<Record<ToolKey, boolean>> {
  if (!tools || typeof tools !== 'object') return false;
  const entries = Object.entries(tools);
  if (entries.length === 0) return true;
  const validKeys = new Set(getToolKeys());
  return entries.every(([key]) => validKeys.has(key as ToolKey));
}

export function validateWorkspace(workspace: string): string | undefined {
  if (!workspace) return 'workspace is required';
  if (!isValidSlug(workspace)) {
    return `workspace must be ${MAX_SLUG_LENGTH} characters or less and can only contain alphanumeric characters, underscores, and hyphens`;
  }
  return undefined;
}
