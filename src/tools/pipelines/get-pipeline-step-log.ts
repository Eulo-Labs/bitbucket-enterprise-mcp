import type { ToolHandler, ToolContext } from '../types';
import { textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const getPipelineStepLog: ToolHandler = {
  definition: {
    name: 'get_pipeline_step_log',
    description: `Get logs for a specific pipeline step. Supports max_bytes, tail_lines, and grep_pattern for efficient log filtering.

Example input:
{ "repo_slug": "demo", "pipeline_uuid": "{...}", "step_uuid": "{...}", "tail_lines": 50 }
{ "repo_slug": "demo", "pipeline_uuid": "{...}", "step_uuid": "{...}", "grep_pattern": "error|fail", "context_lines": 5 }

Returns:
Text log output (string).`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        pipeline_uuid: { type: 'string', description: 'Pipeline UUID' },
        step_uuid: { type: 'string', description: 'Step UUID' },
        max_bytes: {
          type: 'number',
          description: 'Maximum bytes to retrieve (default: 1048576 = 1MB)',
        },
        tail_lines: {
          type: 'number',
          description:
            'Return only the last N lines of the log. Useful for finding errors without fetching full build output.',
        },
        grep_pattern: {
          type: 'string',
          description:
            'Regex pattern to filter log lines. Returns matching lines with surrounding context.',
        },
        context_lines: {
          type: 'number',
          description:
            'Lines of context to include around each grep_pattern match (default: 5).',
        },
      },
      required: ['repo_slug', 'pipeline_uuid', 'step_uuid'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const log = await bb.getPipelineStepLog({
      repo_slug: args.repo_slug as string,
      pipeline_uuid: args.pipeline_uuid as string,
      step_uuid: args.step_uuid as string,
      max_bytes: args.max_bytes as number | undefined,
      tail_lines: args.tail_lines as number | undefined,
      grep_pattern: args.grep_pattern as string | undefined,
      context_lines: args.context_lines as number | undefined,
    });
    return textResult(log);
  },
};
