import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const triggerPipeline: ToolHandler = {
  definition: {
    name: 'trigger_pipeline',
    description: `Trigger a custom pipeline run on a branch.

Example input:
{ "repo_slug": "demo", "branch": "main", "pipeline_name": "deploy-to-production" }

Returns:
{ "uuid": "{...}", "build_number": 124, "state": "PENDING", "ref": "main" }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        branch: { type: 'string', description: 'Branch name to run against' },
        pipeline_name: {
          type: 'string',
          description:
            'Custom pipeline name (e.g. "deploy-to-production" or "custom: deploy-to-production")',
        },
      },
      required: ['repo_slug', 'branch', 'pipeline_name'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.triggerPipeline({
      repo_slug: args.repo_slug as string,
      branch: args.branch as string,
      pipeline_name: args.pipeline_name as string,
    });

    return jsonResult({
      uuid: data.uuid,
      build_number: data.build_number,
      state: data.state.name,
      result: data.state.result?.name ?? null,
      created_on: data.created_on,
      duration_seconds: data.duration_in_seconds,
      ref: data.target.ref_name,
      commit: data.target.commit?.hash?.slice(0, 12),
      trigger: data.trigger.name,
    });
  },
};
