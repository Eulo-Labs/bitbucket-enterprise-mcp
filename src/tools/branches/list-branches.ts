import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const listBranches: ToolHandler = {
  definition: {
    name: 'list_branches',
    description: `List branches in a repository.

Example input:
{ "repo_slug": "demo", "page": 1, "pagelen": 25 }

Returns:
{ "size": 10, "page": 1, "branches": [ { "name": "main", "commit": "abc123..." } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        q: {
          type: 'string',
          description: 'Filter query (e.g., \'name ~ "feature"\')',
        },
        sort: {
          type: 'string',
          description:
            'Sort field (e.g., "-target.date" for most recent first)',
        },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 100 (default: 25)',
        },
      },
      required: ['repo_slug'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listBranches({
      repo_slug: args.repo_slug as string,
      q: args.q as string | undefined,
      sort: args.sort as string | undefined,
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 25,
    });

    return jsonResult({
      size: data.size,
      page: data.page,
      branches: data.values.map((b) => ({
        name: b.name,
        commit: b.target.hash.slice(0, 12),
        date: b.target.date,
        message: b.target.message,
        author: b.target.author.user?.display_name ?? b.target.author.raw,
      })),
    });
  },
};
