import { describe, it, expect, vi } from 'vitest';

const mockListRepositories = vi.fn();
vi.mock('../../src/bitbucket/service', () => ({
  BitbucketService: vi.fn().mockImplementation(() => ({
    listRepositories: mockListRepositories,
  })),
}));

import {
  getResourceList,
  readResource,
  getDynamicResource,
} from '../../src/mcp/resources';

describe('resources', () => {
  it('getResourceList includes bb://repos dynamic resource', () => {
    const resources = getResourceList();
    const reposResource = resources.find((r) => r.uri === 'bb://repos');
    expect(reposResource).toBeDefined();
    expect(reposResource!.mimeType).toBe('application/json');
    expect(reposResource!.name).toBe('Workspace Repositories');
  });

  it('readResource returns null for unknown URI', () => {
    const entry = readResource('ui://unknown/resource.html');
    expect(entry).toBeNull();
  });

  it('getDynamicResource returns entry for bb://repos', () => {
    const entry = getDynamicResource('bb://repos');
    expect(entry).not.toBeNull();
    expect(entry!.resource.uri).toBe('bb://repos');
  });

  it('getDynamicResource returns null for unknown URI', () => {
    const entry = getDynamicResource('bb://unknown');
    expect(entry).toBeNull();
  });

  it('bb://repos resolver returns valid JSON with expected shape', async () => {
    mockListRepositories.mockResolvedValue({
      size: 1,
      values: [
        {
          full_name: 'test-workspace/my-repo',
          name: 'my-repo',
          slug: 'my-repo',
          description: 'A test repo',
          language: 'TypeScript',
          is_private: true,
          mainbranch: { name: 'main', type: 'branch' },
          project: { key: 'PROJ', name: 'Project', uuid: 'proj-uuid' },
          updated_on: '2026-01-01T00:00:00Z',
          links: {
            html: { href: 'https://bitbucket.org/test-workspace/my-repo' },
          },
        },
      ],
    });

    const entry = getDynamicResource('bb://repos');
    const context = {
      userToken: 'token',
      atlassianAccountId: 'acct',
      workspace: 'test-workspace',
    };
    const result = await entry!.resolve(context);
    const parsed = JSON.parse(result);

    expect(parsed.size).toBe(1);
    expect(Array.isArray(parsed.repositories)).toBe(true);
    expect(parsed.repositories[0].full_name).toBe('test-workspace/my-repo');
    expect(parsed.repositories[0].slug).toBe('my-repo');
    expect(parsed.repositories[0].main_branch).toBe('main');
    expect(parsed.repositories[0].project).toEqual({
      key: 'PROJ',
      name: 'Project',
    });
    expect(parsed.repositories[0].url).toBe(
      'https://bitbucket.org/test-workspace/my-repo',
    );
  });
});
