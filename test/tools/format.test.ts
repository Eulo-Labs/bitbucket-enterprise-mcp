import { describe, it, expect } from 'vitest';
import { formatPipeline } from '../../src/tools/pipelines/format';
import { formatPr } from '../../src/tools/pull-requests/format';
import type { Pipeline } from '../../src/bitbucket/types';
import type { PullRequest } from '../../src/bitbucket/types';

function makePipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  return {
    uuid: '{pipeline-uuid-1}',
    build_number: 42,
    created_on: '2024-01-15T10:00:00Z',
    duration_in_seconds: 120,
    state: {
      name: 'COMPLETED',
      result: { name: 'SUCCESSFUL' },
    },
    target: {
      ref_name: 'main',
      commit: { hash: 'abcdef123456789012' },
    },
    trigger: { name: 'PUSH' },
    ...overrides,
  } as Pipeline;
}

function makePr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 7,
    title: 'My PR',
    description: 'A description',
    state: 'OPEN',
    author: { display_name: 'Alice' },
    source: { branch: { name: 'feature/foo' } },
    destination: { branch: { name: 'main' } },
    created_on: '2024-01-01T00:00:00Z',
    updated_on: '2024-01-02T00:00:00Z',
    comment_count: 3,
    task_count: 1,
    reviewers: [{ display_name: 'Bob' }, { display_name: 'Carol' }],
    links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/7' } },
    ...overrides,
  } as unknown as PullRequest;
}

describe('formatPipeline', () => {
  it('formats all fields correctly', () => {
    const result = formatPipeline(makePipeline());
    expect(result).toEqual({
      uuid: '{pipeline-uuid-1}',
      build_number: 42,
      state: 'COMPLETED',
      result: 'SUCCESSFUL',
      created_on: '2024-01-15T10:00:00Z',
      duration_seconds: 120,
      ref: 'main',
      commit: 'abcdef123456',
      trigger: 'PUSH',
    });
  });

  it('slices commit hash to 12 characters', () => {
    const result = formatPipeline(makePipeline());
    expect(result.commit).toHaveLength(12);
    expect(result.commit).toBe('abcdef123456');
  });

  it('returns null for result when state.result is absent', () => {
    const p = makePipeline({
      state: { name: 'IN_PROGRESS' },
    } as Partial<Pipeline>);
    const result = formatPipeline(p);
    expect(result.result).toBeNull();
  });

  it('handles undefined commit without crashing', () => {
    const p = makePipeline({
      target: { ref_name: 'main', commit: undefined },
    } as Partial<Pipeline>);
    const result = formatPipeline(p);
    expect(result.commit).toBeUndefined();
  });
});

describe('formatPr', () => {
  it('formats all fields correctly', () => {
    const result = formatPr(makePr());
    expect(result).toEqual({
      id: 7,
      title: 'My PR',
      description: 'A description',
      state: 'OPEN',
      author: 'Alice',
      source_branch: 'feature/foo',
      destination_branch: 'main',
      created_on: '2024-01-01T00:00:00Z',
      updated_on: '2024-01-02T00:00:00Z',
      comment_count: 3,
      task_count: 1,
      reviewers: ['Bob', 'Carol'],
      url: 'https://bitbucket.org/ws/repo/pull-requests/7',
    });
  });

  it('maps reviewers to display names', () => {
    const result = formatPr(makePr());
    expect(result.reviewers).toEqual(['Bob', 'Carol']);
  });

  it('returns empty array when reviewers is null', () => {
    const result = formatPr(makePr({ reviewers: null as unknown as [] }));
    expect(result.reviewers).toEqual([]);
  });

  it('returns empty array when reviewers is undefined', () => {
    const result = formatPr(makePr({ reviewers: undefined }));
    expect(result.reviewers).toEqual([]);
  });
});
