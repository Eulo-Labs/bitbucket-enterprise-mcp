import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const listPipelineSteps: ToolHandler = {
  definition: {
    name: 'list_pipeline_steps',
    description: `List steps for a specific pipeline run.

Example input:
{ "repo_slug": "demo", "pipeline_uuid": "{...}" }

Returns:
{ "steps": [ { "uuid": "{...}", "name": "Build", "state": "COMPLETED", "result": "SUCCESSFUL" } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pipeline_uuid: {
          type: 'string',
          description: 'Pipeline UUID (from list_pipelines)',
        },
      },
      required: ['repo_slug', 'pipeline_uuid'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listPipelineSteps({
      repo_slug: args.repo_slug as string,
      pipeline_uuid: args.pipeline_uuid as string,
    });

    return jsonResult({
      steps: data.values.map((s) => ({
        uuid: s.uuid,
        name: s.name,
        state: s.state.name,
        result: s.state.result?.name ?? null,
        duration_seconds: s.duration_in_seconds,
      })),
    });
  },
};
