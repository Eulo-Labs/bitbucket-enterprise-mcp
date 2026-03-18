import { describe, it, expect } from 'vitest';
import {
  MAX_SLUG_LENGTH,
  MAX_STRING_LENGTH,
  MAX_PATH_LENGTH,
  SLUG_PATTERN,
  isValidSlug,
  sanitizeSlug,
  truncateString,
  normalizeWorkspace,
  isValidWorkspace,
  validateRepoSlug,
  sanitizeAndEncodePath,
} from '../../src/utils/validation';

describe('constants', () => {
  it('exports MAX_SLUG_LENGTH as 64', () => {
    expect(MAX_SLUG_LENGTH).toBe(64);
  });

  it('exports MAX_STRING_LENGTH as 256', () => {
    expect(MAX_STRING_LENGTH).toBe(256);
  });

  it('exports SLUG_PATTERN as regex', () => {
    expect(SLUG_PATTERN).toBeInstanceOf(RegExp);
    expect(SLUG_PATTERN.source).toBe('^[a-zA-Z0-9_-]+$');
  });
});

describe('isValidSlug', () => {
  it('returns false for empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidSlug(null as unknown as string)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidSlug(undefined as unknown as string)).toBe(false);
  });

  it('returns false for value exceeding MAX_SLUG_LENGTH', () => {
    expect(isValidSlug('a'.repeat(65))).toBe(false);
  });

  it('returns false for value with invalid characters', () => {
    expect(isValidSlug('my slug')).toBe(false);
    expect(isValidSlug('my.slug')).toBe(false);
    expect(isValidSlug('my.slug@123')).toBe(false);
  });

  it('returns true for valid slug at max length', () => {
    expect(isValidSlug('a'.repeat(64))).toBe(true);
  });

  it('returns true for valid slug with alphanumeric characters', () => {
    expect(isValidSlug('abc123')).toBe(true);
  });

  it('returns true for valid slug with underscores', () => {
    expect(isValidSlug('my_slug')).toBe(true);
  });

  it('returns true for valid slug with hyphens', () => {
    expect(isValidSlug('my-slug')).toBe(true);
  });

  it('returns true for valid slug with mixed characters', () => {
    expect(isValidSlug('mySlug_123')).toBe(true);
  });
});

describe('sanitizeSlug', () => {
  it('removes spaces', () => {
    expect(sanitizeSlug('my slug')).toBe('myslug');
  });

  it('removes special characters', () => {
    expect(sanitizeSlug('my.slug@123')).toBe('myslug123');
  });

  it('truncates to MAX_SLUG_LENGTH', () => {
    const longSlug = 'a'.repeat(100);
    expect(sanitizeSlug(longSlug).length).toBe(MAX_SLUG_LENGTH);
  });

  it('preserves valid characters', () => {
    expect(sanitizeSlug('mySlug_123')).toBe('mySlug_123');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSlug('')).toBe('');
  });

  it('returns empty string for input with only invalid characters', () => {
    expect(sanitizeSlug('@#$%')).toBe('');
  });
});

describe('truncateString', () => {
  it('truncates to default MAX_STRING_LENGTH', () => {
    const longString = 'a'.repeat(300);
    expect(truncateString(longString).length).toBe(MAX_STRING_LENGTH);
  });

  it('truncates to custom max length', () => {
    expect(truncateString('hello world', 5)).toBe('hello');
  });

  it('returns original string if shorter than max length', () => {
    expect(truncateString('hello')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(truncateString('')).toBe('');
  });
});

describe('normalizeWorkspace', () => {
  it('returns undefined for undefined input', () => {
    expect(normalizeWorkspace(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(normalizeWorkspace('')).toBeUndefined();
  });

  it('returns sanitized slug for valid workspace', () => {
    expect(normalizeWorkspace('my-workspace')).toBe('my-workspace');
  });

  it('removes invalid characters', () => {
    expect(normalizeWorkspace('my workspace')).toBe('myworkspace');
    expect(normalizeWorkspace('my@workspace')).toBe('myworkspace');
  });

  it('returns undefined for input that becomes empty after sanitization', () => {
    expect(normalizeWorkspace('@#$%')).toBeUndefined();
  });
});

describe('isValidWorkspace', () => {
  it('returns false for undefined', () => {
    expect(isValidWorkspace(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidWorkspace(null as unknown as string)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidWorkspace('')).toBe(false);
  });

  it('returns false for invalid characters', () => {
    expect(isValidWorkspace('my workspace')).toBe(false);
    expect(isValidWorkspace('my@workspace')).toBe(false);
  });

  it('returns false for value exceeding MAX_SLUG_LENGTH', () => {
    expect(isValidWorkspace('a'.repeat(65))).toBe(false);
  });

  it('returns true for valid workspace', () => {
    expect(isValidWorkspace('my-workspace')).toBe(true);
    expect(isValidWorkspace('workspace123')).toBe(true);
  });

  it('returns true for workspace at max length', () => {
    expect(isValidWorkspace('a'.repeat(64))).toBe(true);
  });
});

describe('MAX_PATH_LENGTH', () => {
  it('exports MAX_PATH_LENGTH as 1024', () => {
    expect(MAX_PATH_LENGTH).toBe(1024);
  });
});

describe('validateRepoSlug', () => {
  it('returns error message for non-string input', () => {
    expect(validateRepoSlug(null)).toBe('repo_slug is required');
    expect(validateRepoSlug(undefined)).toBe('repo_slug is required');
    expect(validateRepoSlug(123)).toBe('repo_slug is required');
  });

  it('returns error message for empty string', () => {
    expect(validateRepoSlug('')).toBe('repo_slug is required');
  });

  it('returns error message for slug exceeding MAX_SLUG_LENGTH', () => {
    expect(validateRepoSlug('a'.repeat(65))).toBe(
      `repo_slug must be ${MAX_SLUG_LENGTH} characters or less`,
    );
  });

  it('returns error message for invalid characters', () => {
    expect(validateRepoSlug('my slug')).toBe(
      'repo_slug must contain only alphanumeric characters, underscores, and hyphens',
    );
    expect(validateRepoSlug('my.slug')).toBe(
      'repo_slug must contain only alphanumeric characters, underscores, and hyphens',
    );
    expect(validateRepoSlug('my@repo')).toBe(
      'repo_slug must contain only alphanumeric characters, underscores, and hyphens',
    );
  });

  it('returns null for valid slug', () => {
    expect(validateRepoSlug('my-repo')).toBeNull();
    expect(validateRepoSlug('my_repo')).toBeNull();
    expect(validateRepoSlug('myrepo123')).toBeNull();
    expect(validateRepoSlug('a'.repeat(64))).toBeNull();
  });
});

describe('sanitizeAndEncodePath', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeAndEncodePath(null)).toBe('');
    expect(sanitizeAndEncodePath(undefined)).toBe('');
    expect(sanitizeAndEncodePath(123)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(sanitizeAndEncodePath('')).toBe('');
  });

  it('returns null for path exceeding MAX_PATH_LENGTH', () => {
    expect(sanitizeAndEncodePath('a'.repeat(1025))).toBeNull();
  });

  it('returns null for path containing parent directory references', () => {
    expect(sanitizeAndEncodePath('../etc/passwd')).toBeNull();
    expect(sanitizeAndEncodePath('foo/../bar')).toBeNull();
    expect(sanitizeAndEncodePath('foo/bar/../baz')).toBeNull();
  });

  it('returns null for path containing tilde', () => {
    expect(sanitizeAndEncodePath('~/config')).toBeNull();
    expect(sanitizeAndEncodePath('foo/~bar')).toBeNull();
  });

  it('encodes path segments', () => {
    expect(sanitizeAndEncodePath('path with spaces/file.txt')).toBe(
      'path%20with%20spaces/file.txt',
    );
    expect(sanitizeAndEncodePath('file%20name')).toBe('file%2520name');
    expect(sanitizeAndEncodePath('path/special#char')).toBe(
      'path/special%23char',
    );
  });

  it('preserves valid path structure', () => {
    expect(sanitizeAndEncodePath('src/components/Button.tsx')).toBe(
      'src/components/Button.tsx',
    );
    expect(sanitizeAndEncodePath('docs/README.md')).toBe('docs/README.md');
  });
});
