import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';
import { formatPr } from './format';

export const createPullRequest: ToolHandler = {
  definition: {
    name: 'create_pull_request',
    description: `Create a new pull request.

Example input:
{ "repo_slug": "demo", "title": "Fix bug", "source_branch": "feature/foo", "destination_branch": "main" }

Returns:
{ "id": 43, "title": "Fix bug", "state": "OPEN" }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        title: { type: 'string', description: 'PR title' },
        source_branch: { type: 'string', description: 'Source branch name' },
        destination_branch: {
          type: 'string',
          description: 'Destination branch name (default: main branch)',
        },
        description: { type: 'string', description: 'PR description' },
        close_source_branch: {
          type: 'boolean',
          description: 'Close source branch on merge (default: false)',
        },
        reviewers: {
          type: 'array',
          description: 'Array of reviewer UUIDs',
          items: { type: 'string' },
        },
      },
      required: ['repo_slug', 'title', 'source_branch'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const pr = await bb.createPullRequest({
      repo_slug: args.repo_slug as string,
      title: args.title as string,
      source_branch: args.source_branch as string,
      destination_branch: args.destination_branch as string | undefined,
      description: args.description as string | undefined,
      close_source_branch: args.close_source_branch as boolean | undefined,
      reviewers: args.reviewers as string[] | undefined,
    });
    return jsonResult(formatPr(pr));
  },
};
