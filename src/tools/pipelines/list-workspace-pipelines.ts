import type { ToolHandler, ToolContext } from '../types';
import { jsonResult } from '../results';
import { BitbucketService } from '../../bitbucket/service';
import { formatPipeline } from './format';

export const listWorkspacePipelines: ToolHandler = {
  definition: {
    name: 'list_workspace_pipelines',
    description: `List recent pipeline runs across all repositories in the workspace.

Example input:
{ "last_n": 1 }

Returns:
{ "size": 5, "pipelines": [ { "repository": "acme/demo", "uuid": "{...}", "build_number": 42, "state": "COMPLETED", "result": "SUCCESSFUL" } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        last_n: {
          type: 'number',
          description:
            'Number of most-recent pipeline runs to return per repo (default: 1, max: 10)',
        },
        q: {
          type: 'string',
          description: 'Bitbucket query filter',
        },
      },
    },
  },

  async execute(args, context: ToolContext) {
    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listWorkspacePipelines({
      last_n: (args.last_n as number) || 1,
      q: args.q as string | undefined,
    });

    return jsonResult({
      size: data.size,
      pipelines: data.values.map((p) => ({
        repository: p._repository,
        ...formatPipeline(p),
      })),
    });
  },
};
