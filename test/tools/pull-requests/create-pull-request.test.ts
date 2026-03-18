import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPullRequest } from '../../../src/tools/pull-requests/create-pull-request';
import type { ToolContext } from '../../../src/tools/types';

// Mock validation
vi.mock('../../../src/utils/validation', () => ({
  validateRepoSlug: vi.fn(),
}));
import { validateRepoSlug } from '../../../src/utils/validation';

// Mock BitbucketService
const mockCreatePullRequest = vi.fn();
vi.mock('../../../src/bitbucket/service', () => ({
  BitbucketService: vi.fn().mockImplementation(() => ({
    createPullRequest: mockCreatePullRequest,
  })),
}));

// Mock formatPr
vi.mock('../../../src/tools/pull-requests/format', () => ({
  formatPr: vi.fn((pr) => ({ formatted: true, ...pr })),
}));

const mockContext: ToolContext = {
  workspace: 'test-workspace',
  userToken: 'test-token',
  atlassianAccountId: 'test-account-id',
};

describe('createPullRequest tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error result if validateRepoSlug fails', async () => {
    vi.mocked(validateRepoSlug).mockReturnValue('Invalid slug');

    const result = await createPullRequest.execute(
      { repo_slug: 'bad slug', title: 't', source_branch: 's' },
      mockContext,
    );

    expect(validateRepoSlug).toHaveBeenCalledWith('bad slug');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Invalid slug');
    expect(mockCreatePullRequest).not.toHaveBeenCalled();
  });

  it('calls service.createPullRequest with correct arguments', async () => {
    vi.mocked(validateRepoSlug).mockReturnValue(null);
    mockCreatePullRequest.mockResolvedValue({ id: 1, title: 'PR 1' });

    const args = {
      repo_slug: 'my-repo',
      title: 'Fix bug',
      source_branch: 'feature/bug',
      destination_branch: 'main',
      description: 'Fixes #123',
      close_source_branch: true,
      reviewers: ['user-uuid'],
    };

    const result = await createPullRequest.execute(args, mockContext);

    expect(validateRepoSlug).toHaveBeenCalledWith('my-repo');
    expect(mockCreatePullRequest).toHaveBeenCalledWith({
      repo_slug: 'my-repo',
      title: 'Fix bug',
      source_branch: 'feature/bug',
      destination_branch: 'main',
      description: 'Fixes #123',
      close_source_branch: true,
      reviewers: ['user-uuid'],
    });

    expect(result.isError).toBeFalsy();
    // content should be JSON result
    const json = JSON.parse(result.content[0].text);
    expect(json).toEqual({ formatted: true, id: 1, title: 'PR 1' });
  });

  it('handles optional arguments correctly', async () => {
    vi.mocked(validateRepoSlug).mockReturnValue(null);
    mockCreatePullRequest.mockResolvedValue({ id: 2, title: 'PR 2' });

    const args = {
      repo_slug: 'my-repo',
      title: 'Simple PR',
      source_branch: 'feature/simple',
    };

    await createPullRequest.execute(args, mockContext);

    expect(mockCreatePullRequest).toHaveBeenCalledWith({
      repo_slug: 'my-repo',
      title: 'Simple PR',
      source_branch: 'feature/simple',
      destination_branch: undefined,
      description: undefined,
      close_source_branch: undefined,
      reviewers: undefined,
    });
  });

  it('propagates service errors', async () => {
    vi.mocked(validateRepoSlug).mockReturnValue(null);
    mockCreatePullRequest.mockRejectedValue(new Error('Service failure'));

    await expect(
      createPullRequest.execute(
        { repo_slug: 'r', title: 't', source_branch: 's' },
        mockContext,
      ),
    ).rejects.toThrow('Service failure');
  });
});
