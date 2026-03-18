import type { ToolHandler, ToolContext } from '../types';
import { jsonResultWithUi, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';
import { formatPr } from './format';

export const listPullRequests: ToolHandler = {
  definition: {
    name: 'list_pull_requests',
    description: `List pull requests for a repository. Filter by state (OPEN, MERGED, DECLINED).

Example input:
{ "repo_slug": "demo", "state": "OPEN", "page": 1 }

Returns:
{ "size": 4, "page": 1, "pagelen": 25, "pull_requests": [ { "id": 42, "title": "Fix bug", "state": "OPEN" } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        state: {
          type: 'string',
          description:
            'Filter by state: OPEN, MERGED, DECLINED (default: OPEN)',
        },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 50 (default: 25)',
        },
        q: {
          type: 'string',
          description: 'Bitbucket query filter',
        },
      },
      required: ['repo_slug'],
    },
    _meta: {
      ui: { resourceUri: 'ui://bitbucket-remote/pr-list.html' },
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);

    const data = await bb.listPullRequests({
      repo_slug: args.repo_slug as string,
      state: args.state as string | undefined,
      page: args.page as number | undefined,
      pagelen: args.pagelen as number | undefined,
      q: args.q as string | undefined,
    });

    return jsonResultWithUi({
      size: data.size,
      page: data.page,
      pagelen: data.pagelen,
      pull_requests: data.values.map(formatPr),
    });
  },
};
