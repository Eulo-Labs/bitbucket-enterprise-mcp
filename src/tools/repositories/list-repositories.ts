import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';
import type { Repository } from '../../bitbucket/types';

export const listRepositories: ToolHandler = {
  definition: {
    name: 'list_repositories',
    description: `List repositories in the workspace.

Example input:
{ "page": 1, "pagelen": 25 }

Returns:
{ "size": 120, "page": 1, "pagelen": 25, "repositories": [ { "name": "demo", "slug": "demo", "main_branch": "main" } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 100 (default: 25)',
        },
        q: {
          type: 'string',
          description: 'Bitbucket query filter (e.g., \'name ~ "my-repo"\')',
        },
        sort: {
          type: 'string',
          description:
            'Sort field (e.g., "-updated_on" for most recently updated)',
        },
      },
    },
  },

  async execute(args, context: ToolContext) {
    if (args.repo_slug) {
      const repoSlugError = validateRepoSlug(args.repo_slug);
      if (repoSlugError) {
        return textResult(repoSlugError, true);
      }
    }

    const bb = new BitbucketService(context.workspace, context.userToken);

    const data = await bb.listRepositories({
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 25,
      q: args.q as string | undefined,
      sort: args.sort as string | undefined,
    });

    return jsonResult({
      size: data.size,
      page: data.page,
      pagelen: data.pagelen,
      repositories: data.values.map((r: Repository) => ({
        full_name: r.full_name,
        name: r.name,
        slug: r.slug,
        description: r.description,
        language: r.language,
        is_private: r.is_private,
        main_branch: r.mainbranch?.name,
        project: r.project
          ? { key: r.project.key, name: r.project.name }
          : null,
        updated_on: r.updated_on,
        url: r.links.html.href,
      })),
    });
  },
};
