import { describe, it, expect } from 'vitest';
import {
  validateClientId,
  validateClientSecret,
  validateToolKeys,
  validateWorkspace,
} from '../../src/admin/validation';

describe('validateClientId', () => {
  it('returns error for empty value', () => {
    expect(validateClientId('')).toBe('Client ID is required');
  });

  it('returns error for value exceeding max length', () => {
    const longId = 'a'.repeat(129);
    expect(validateClientId(longId)).toBe(
      'Client ID must be 128 characters or less',
    );
  });

  it('returns error for invalid characters', () => {
    expect(validateClientId('client@id')).toBe(
      'Client ID can only contain alphanumeric characters, underscores, and hyphens',
    );
  });

  it('returns undefined for valid client ID', () => {
    expect(validateClientId('my-client-id')).toBeUndefined();
    expect(validateClientId('client123')).toBeUndefined();
    expect(validateClientId('CLIENT_ID')).toBeUndefined();
  });

  it('returns undefined for client ID at max length', () => {
    const maxId = 'a'.repeat(128);
    expect(validateClientId(maxId)).toBeUndefined();
  });
});

describe('validateClientSecret', () => {
  it('returns undefined for undefined value', () => {
    expect(validateClientSecret(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(validateClientSecret('')).toBeUndefined();
  });

  it('returns error for value exceeding max length', () => {
    const longSecret = 'a'.repeat(257);
    expect(validateClientSecret(longSecret)).toBe(
      'Client Secret must be 256 characters or less',
    );
  });

  it('returns undefined for valid client secret', () => {
    expect(validateClientSecret('secret123')).toBeUndefined();
    expect(validateClientSecret('a'.repeat(256))).toBeUndefined();
  });
});

describe('validateToolKeys', () => {
  it('returns false for non-object', () => {
    expect(validateToolKeys(null)).toBe(false);
    expect(validateToolKeys(undefined)).toBe(false);
    expect(validateToolKeys('string')).toBe(false);
    expect(validateToolKeys(123)).toBe(false);
  });

  it('returns true for empty object', () => {
    expect(validateToolKeys({})).toBe(true);
  });

  it('returns true for object with all valid keys', () => {
    expect(
      validateToolKeys({
        list_repositories: true,
        get_repository: false,
      }),
    ).toBe(true);
  });

  it('returns false for object with invalid keys', () => {
    expect(validateToolKeys({ invalid_tool: true })).toBe(false);
    expect(
      validateToolKeys({
        list_repositories: true,
        invalid_tool: false,
      }),
    ).toBe(false);
  });

  it('returns true for object with all TOOL_KEYS', () => {
    const allTools = {
      list_repositories: true,
      get_repository: true,
      list_pull_requests: true,
      list_workspace_pull_requests: true,
      get_pull_request: true,
      get_pull_request_diff: true,
      list_pull_request_comments: true,
      list_pipelines: true,
      list_pipeline_steps: true,
      get_pipeline_step_log: true,
      get_file_content: true,
      list_directory: true,
      list_branches: true,
      create_pull_request: true,
      create_pull_request_comment: true,
      approve_pull_request: true,
      unapprove_pull_request: true,
      merge_pull_request: true,
      trigger_pipeline: true,
    };
    expect(validateToolKeys(allTools)).toBe(true);
  });
});

describe('validateWorkspace', () => {
  it('returns error for empty value', () => {
    expect(validateWorkspace('')).toBe('workspace is required');
  });

  it('returns error for value exceeding max length', () => {
    const longWorkspace = 'a'.repeat(65);
    expect(validateWorkspace(longWorkspace)).toBe(
      'workspace must be 64 characters or less and can only contain alphanumeric characters, underscores, and hyphens',
    );
  });

  it('returns error for invalid characters', () => {
    expect(validateWorkspace('my workspace')).toBe(
      'workspace must be 64 characters or less and can only contain alphanumeric characters, underscores, and hyphens',
    );
    expect(validateWorkspace('workspace@123')).toBe(
      'workspace must be 64 characters or less and can only contain alphanumeric characters, underscores, and hyphens',
    );
  });

  it('returns undefined for valid workspace', () => {
    expect(validateWorkspace('my-workspace')).toBeUndefined();
    expect(validateWorkspace('workspace123')).toBeUndefined();
    expect(validateWorkspace('WORKSPACE')).toBeUndefined();
  });

  it('returns undefined for workspace at max length', () => {
    const maxWorkspace = 'a'.repeat(64);
    expect(validateWorkspace(maxWorkspace)).toBeUndefined();
  });
});
