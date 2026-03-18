import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BitbucketResponse } from '../../src/bitbucket/types';

const { mockPost, mockRequest } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock('../../src/bitbucket/client', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/bitbucket/client')
  >('../../src/bitbucket/client');
  return {
    ...actual,
    bbClient: { post: mockPost, request: mockRequest },
  };
});

import { triggerPipeline, getPipelineStepLog } from '../../src/tools/pipelines';

describe('triggerPipeline', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts a custom selector with normalized pipeline name', async () => {
    const response: BitbucketResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        type: 'pipeline',
        uuid: '{pipeline-uuid}',
        build_number: 42,
        created_on: '2026-03-12T00:00:00Z',
        state: {
          name: 'COMPLETED',
          type: 'pipeline_state',
          result: { name: 'SUCCESSFUL', type: 'pipeline_state_result' },
        },
        duration_in_seconds: 12,
        target: {
          type: 'pipeline_ref_target',
          ref_name: 'main',
          commit: { hash: 'abcdef1234567890' },
          selector: { type: 'custom', pattern: 'deploy-to-production' },
        },
        trigger: { name: 'MANUAL' },
      }),
      text: async () => '',
    };

    mockPost.mockResolvedValue(response);

    const result = await triggerPipeline.execute(
      {
        repo_slug: 'repo',
        branch: 'main',
        pipeline_name: 'custom: deploy-to-production',
      },
      {
        userToken: 'token-123',
        atlassianAccountId: 'account-1',
        workspace: 'ws',
      },
    );

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [path, body, headers, token] = mockPost.mock.calls[0];
    expect(path).toBe('/2.0/repositories/ws/repo/pipelines/');
    expect(headers).toBeUndefined();
    expect(token).toBe('token-123');

    const payload = JSON.parse(body as string);
    expect(payload.target.ref_name).toBe('main');
    expect(payload.target.ref_type).toBe('branch');
    expect(payload.target.selector.type).toBe('custom');
    expect(payload.target.selector.pattern).toBe('deploy-to-production');

    const output = JSON.parse(result.content[0].text);
    expect(output.build_number).toBe(42);
    expect(output.state).toBe('COMPLETED');
    expect(output.result).toBe('SUCCESSFUL');
    expect(output.ref).toBe('main');
    expect(output.trigger).toBe('MANUAL');
  });
});

describe('getPipelineStepLog', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns full text when no parameters are specified', async () => {
    const logContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const response: BitbucketResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => logContent,
    };

    mockRequest.mockResolvedValue(response);

    const result = await getPipelineStepLog.execute(
      {
        repo_slug: 'repo',
        pipeline_uuid: 'uuid-1',
        step_uuid: 'step-1',
      },
      {
        userToken: 'token-123',
        atlassianAccountId: 'account-1',
        workspace: 'ws',
      },
    );

    expect(result.content[0].text).toBe(logContent);
  });

  it('returns last N lines when tail_lines is specified', async () => {
    const logContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const response: BitbucketResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => logContent,
    };

    mockRequest.mockResolvedValue(response);

    const result = await getPipelineStepLog.execute(
      {
        repo_slug: 'repo',
        pipeline_uuid: 'uuid-1',
        step_uuid: 'step-1',
        tail_lines: 2,
      },
      {
        userToken: 'token-123',
        atlassianAccountId: 'account-1',
        workspace: 'ws',
      },
    );

    expect(result.content[0].text).toBe('line 4\nline 5');
  });

  it('filters to matching lines with context when grep_pattern is specified', async () => {
    const logContent = 'line 1\nline 2 error\nline 3\nline 4 error\nline 5';
    const response: BitbucketResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => logContent,
    };

    mockRequest.mockResolvedValue(response);

    const result = await getPipelineStepLog.execute(
      {
        repo_slug: 'repo',
        pipeline_uuid: 'uuid-1',
        step_uuid: 'step-1',
        grep_pattern: 'error',
        context_lines: 1,
      },
      {
        userToken: 'token-123',
        atlassianAccountId: 'account-1',
        workspace: 'ws',
      },
    );

    const text = result.content[0].text;
    expect(text).toContain('line 1');
    expect(text).toContain('line 2 error');
    expect(text).toContain('line 3');
    expect(text).toContain('line 4 error');
    expect(text).toContain('line 5');
  });

  it('returns no match message when grep_pattern has no matches', async () => {
    const logContent = 'line 1\nline 2\nline 3';
    const response: BitbucketResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => logContent,
    };

    mockRequest.mockResolvedValue(response);

    const result = await getPipelineStepLog.execute(
      {
        repo_slug: 'repo',
        pipeline_uuid: 'uuid-1',
        step_uuid: 'step-1',
        grep_pattern: 'notfound',
      },
      {
        userToken: 'token-123',
        atlassianAccountId: 'account-1',
        workspace: 'ws',
      },
    );

    expect(result.content[0].text).toBe('[no lines matched pattern: notfound]');
  });

  it('applies tail_lines first, then grep_pattern', async () => {
    const logContent = 'error 1\nline 2\nline 3\nerror 4\nline 5';
    const response: BitbucketResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => logContent,
    };

    mockRequest.mockResolvedValue(response);

    const result = await getPipelineStepLog.execute(
      {
        repo_slug: 'repo',
        pipeline_uuid: 'uuid-1',
        step_uuid: 'step-1',
        tail_lines: 3,
        grep_pattern: 'error',
        context_lines: 0,
      },
      {
        userToken: 'token-123',
        atlassianAccountId: 'account-1',
        workspace: 'ws',
      },
    );

    const text = result.content[0].text;
    // Should only have error 4, not error 1 (since tail_lines applied first)
    expect(text).toContain('error 4');
    expect(text).not.toContain('error 1');
  });
});
