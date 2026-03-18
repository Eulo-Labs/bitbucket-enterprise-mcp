import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';
import { formatPr } from './format';

export const getPullRequest: ToolHandler = {
  definition: {
    name: 'get_pull_request',
    description: `Get detailed information about a specific pull request.

Example input:
{ "repo_slug": "demo", "pull_request_id": 42 }

Returns:
{ "id": 42, "title": "Fix bug", "state": "OPEN", "source_branch": "feature/foo" }`,
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
    const pr = await bb.getPullRequest({
      repo_slug: args.repo_slug as string,
      pr_id: String(args.pull_request_id),
    });
    return jsonResult({
      ...formatPr(pr),
      source_commit: pr.source.commit?.hash,
      destination_commit: pr.destination.commit?.hash,
      merge_commit: pr.merge_commit?.hash,
      close_source_branch: pr.close_source_branch,
    });
  },
};
