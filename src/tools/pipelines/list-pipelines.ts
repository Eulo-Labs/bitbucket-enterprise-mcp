import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const listPipelines: ToolHandler = {
  definition: {
    name: 'list_pipelines',
    description: `List pipelines for a repository, sorted by most recent first.

Example input:
{ "repo_slug": "demo", "page": 1, "pagelen": 20 }

Returns:
{ "size": 2, "page": 1, "pipelines": [ { "uuid": "{...}", "build_number": 123, "state": "COMPLETED" } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 100 (default: 20)',
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
    const data = await bb.listPipelines({
      repo_slug: args.repo_slug as string,
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 20,
    });

    return jsonResult({
      size: data.size,
      page: data.page,
      pipelines: data.values.map((p) => ({
        uuid: p.uuid,
        build_number: p.build_number,
        state: p.state.name,
        result: p.state.result?.name ?? null,
        created_on: p.created_on,
        duration_seconds: p.duration_in_seconds,
        ref: p.target.ref_name,
        commit: p.target.commit?.hash?.slice(0, 12),
        trigger: p.trigger.name,
      })),
    });
  },
};
