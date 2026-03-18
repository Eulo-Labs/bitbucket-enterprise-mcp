import type { ToolHandler, ToolContext } from '../types';
import { textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const unapprovePullRequest: ToolHandler = {
  definition: {
    name: 'unapprove_pull_request',
    description: `Remove approval from a pull request.

Example input:
{ "repo_slug": "demo", "pull_request_id": 42 }

Returns:
Text confirmation message.`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pull_request_id: { type: 'number', description: 'Pull request ID' },
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
    await bb.unapprovePullRequest({
      repo_slug: args.repo_slug as string,
      pr_id: String(args.pull_request_id),
    });
    return textResult('Pull request approval removed.');
  },
};
