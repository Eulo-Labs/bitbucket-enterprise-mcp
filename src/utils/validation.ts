/**
 * Input Validation and Sanitization Utilities
 *
 * Provides common validation and sanitization functions for user inputs.
 * Used for defense-in-depth across the application.
 */

export const MAX_SLUG_LENGTH = 64;
export const MAX_STRING_LENGTH = 256;
export const MAX_PATH_LENGTH = 1024;
export const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidSlug(value: string): boolean {
  return (
    Boolean(value) &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(value)
  );
}

export function sanitizeSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_SLUG_LENGTH);
}

export function truncateString(
  value: string,
  maxLength: number = MAX_STRING_LENGTH,
): string {
  return value.slice(0, maxLength);
}

export function normalizeWorkspace(
  workspace: string | undefined,
): string | undefined {
  if (!workspace) return undefined;
  const sanitized = sanitizeSlug(workspace);
  return sanitized || undefined;
}

export function isValidWorkspace(workspace: string | undefined): boolean {
  if (!workspace) return false;
  return isValidSlug(workspace) && workspace.length <= MAX_SLUG_LENGTH;
}

export function validateRepoSlug(slug: unknown): string | null {
  if (typeof slug !== 'string' || !slug) {
    return 'repo_slug is required';
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return `repo_slug must be ${MAX_SLUG_LENGTH} characters or less`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return 'repo_slug must contain only alphanumeric characters, underscores, and hyphens';
  }
  return null;
}

export function sanitizeAndEncodePath(path: unknown): string | null {
  if (typeof path !== 'string' || !path) {
    return '';
  }
  if (path.length > MAX_PATH_LENGTH) {
    return null;
  }
  if (path.includes('..') || path.includes('~')) {
    return null;
  }
  return path.split('/').map(encodeURIComponent).join('/');
}
