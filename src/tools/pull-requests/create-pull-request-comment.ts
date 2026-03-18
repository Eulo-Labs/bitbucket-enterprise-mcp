import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const createPullRequestComment: ToolHandler = {
  definition: {
    name: 'create_pull_request_comment',
    description: `Create a comment on a pull request. Supports inline comments on specific files/lines.

Example input:
{ "repo_slug": "demo", "pull_request_id": 42, "content": "LGTM", "inline_path": "src/a.ts", "inline_to": 12 }

Returns:
{ "id": 101, "content": "LGTM", "author": "Jane", "created_on": "2025-01-02T03:04:05Z" }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pull_request_id: { type: 'number', description: 'Pull request ID' },
        content: { type: 'string', description: 'Comment content (Markdown)' },
        inline_path: {
          type: 'string',
          description: 'File path for inline comment',
        },
        inline_to: {
          type: 'number',
          description: 'Line number for inline comment (new file)',
        },
        inline_from: {
          type: 'number',
          description: 'Line number for inline comment (old file)',
        },
        parent_id: {
          type: 'number',
          description: 'Parent comment ID for replies',
        },
      },
      required: ['repo_slug', 'pull_request_id', 'content'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const c = await bb.createPullRequestComment({
      repo_slug: args.repo_slug as string,
      pr_id: String(args.pull_request_id),
      content: args.content as string,
      inline_path: args.inline_path as string | undefined,
      inline_to: args.inline_to as number | undefined,
      inline_from: args.inline_from as number | undefined,
      parent_id: args.parent_id as number | undefined,
    });
    return jsonResult({
      id: c.id,
      content: c.content.raw,
      author: c.user.display_name,
      created_on: c.created_on,
    });
  },
};
