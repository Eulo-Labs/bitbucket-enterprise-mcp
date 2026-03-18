import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const mergePullRequest: ToolHandler = {
  definition: {
    name: 'merge_pull_request',
    label: 'Merge Pull Request',
    description: `Merge a pull request. Supports merge strategies: merge_commit, squash, fast_forward.

Example input:
{ "repo_slug": "demo", "pull_request_id": 42, "merge_strategy": "squash" }

Returns:
{ "id": 42, "title": "Fix bug", "state": "MERGED", "merge_commit": "abc123..." }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pull_request_id: { type: 'number', description: 'Pull request ID' },
        merge_strategy: {
          type: 'string',
          description:
            'Merge strategy: merge_commit, squash, or fast_forward (default: merge_commit)',
        },
        close_source_branch: {
          type: 'boolean',
          description: 'Close source branch after merge (default: false)',
        },
        message: {
          type: 'string',
          description: 'Custom merge commit message',
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
    const pr = await bb.mergePullRequest({
      repo_slug: args.repo_slug as string,
      pr_id: String(args.pull_request_id),
      merge_strategy: args.merge_strategy as string | undefined,
      close_source_branch: args.close_source_branch as boolean | undefined,
      message: args.message as string | undefined,
    });
    return jsonResult({
      id: pr.id,
      title: pr.title,
      state: pr.state,
      merge_commit: pr.merge_commit?.hash,
    });
  },
};
