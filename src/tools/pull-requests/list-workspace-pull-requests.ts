import type { ToolHandler, ToolContext } from '../types';
import { jsonResultWithUi } from '../results';
import { BitbucketService } from '../../bitbucket/service';
import { formatPr } from './format';

export const listWorkspacePullRequests: ToolHandler = {
  definition: {
    name: 'list_workspace_pull_requests',
    description: `List pull requests across all repositories in the workspace.

Example input:
{ "state": "OPEN", "page": 1 }

Returns:
{ "size": 10, "page": 1, "pagelen": 25, "pull_requests": [ { "id": 42, "title": "Fix bug", "state": "OPEN", "repository": "acme/demo" } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
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
    },
  },

  async execute(args, context: ToolContext) {
    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listWorkspacePullRequests({
      state: (args.state as string) || 'OPEN',
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 25,
      q: args.q as string | undefined,
    });

    return jsonResultWithUi({
      size: data.size,
      page: data.page,
      pagelen: data.pagelen,
      pull_requests: data.values.map((pr) => ({
        ...formatPr(pr),
        repository: pr.destination.repository.full_name,
      })),
    });
  },
};
