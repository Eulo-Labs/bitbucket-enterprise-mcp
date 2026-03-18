import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const listPullRequestComments: ToolHandler = {
  definition: {
    name: 'list_pull_request_comments',
    description: `List comments on a pull request, including inline code comments.

Example input:
{ "repo_slug": "demo", "pull_request_id": 42, "page": 1, "pagelen": 50 }

Returns:
{ "size": 3, "page": 1, "comments": [ { "id": 1, "content": "...", "author": "Jane", "inline": { "path": "src/a.ts", "from": 10, "to": 12 } } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pull_request_id: { type: 'number', description: 'Pull request ID' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 100 (default: 50)',
        },
      },
      required: ['repo_slug', 'pull_request_id'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listPullRequestComments({
      repo_slug: args.repo_slug as string,
      pr_id: String(args.pull_request_id),
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 50,
    });

    return jsonResult({
      size: data.size,
      page: data.page,
      comments: data.values.map((c) => ({
        id: c.id,
        content: c.content.raw,
        author: c.user.display_name,
        created_on: c.created_on,
        updated_on: c.updated_on,
        inline: c.inline
          ? { path: c.inline.path, from: c.inline.from, to: c.inline.to }
          : null,
        parent_id: c.parent?.id ?? null,
      })),
    });
  },
};
