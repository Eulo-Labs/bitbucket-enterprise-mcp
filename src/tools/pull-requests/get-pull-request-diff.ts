import type { ToolHandler, ToolContext } from '../types';
import { textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const getPullRequestDiff: ToolHandler = {
  definition: {
    name: 'get_pull_request_diff',
    description: `Get the diff for a pull request. Supports max_lines to limit output size.

Example input:
{ "repo_slug": "demo", "pull_request_id": 42, "max_lines": 2000 }

Returns:
Text diff output (string).`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pull_request_id: { type: 'number', description: 'Pull request ID' },
        max_lines: {
          type: 'number',
          description: 'Maximum number of diff lines to return (default: 5000)',
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
    const fullDiff = await bb.getPullRequestDiff({
      repo_slug: args.repo_slug as string,
      pr_id: String(args.pull_request_id),
    });
    const maxLines = (args.max_lines as number) || 5000;
    const lines = fullDiff.split('\n');

    if (lines.length <= maxLines) {
      return textResult(fullDiff);
    }

    const truncated = lines.slice(0, maxLines).join('\n');
    return textResult(
      truncated +
        `\n\n[TRUNCATED — showing ${maxLines} of ${lines.length} lines. Use max_lines parameter to adjust.]`,
    );
  },
};
