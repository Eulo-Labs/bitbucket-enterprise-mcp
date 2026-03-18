import type { ToolHandler, ToolContext } from '../types';
import { textResult } from '../results';
import {
  validateRepoSlug,
  sanitizeAndEncodePath,
} from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const getFileContent: ToolHandler = {
  definition: {
    name: 'get_file_content',
    description: `Get the content of a file from a repository at a specific ref (branch, tag, or commit).

Example input:
{ "repo_slug": "demo", "path": "src/index.ts", "ref": "main", "max_lines": 200 }

Returns:
Text file content (string). May be truncated when max_lines is set.`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        path: {
          type: 'string',
          description: 'File path within the repository',
        },
        ref: {
          type: 'string',
          description:
            'Branch name, tag, or commit hash (default: main branch)',
        },
        max_lines: {
          type: 'number',
          description: 'Maximum lines to return (default: 10000)',
        },
      },
      required: ['repo_slug', 'path'],
    },
  },

  async execute(args, context: ToolContext) {
    const repoSlugError = validateRepoSlug(args.repo_slug);
    if (repoSlugError) {
      return textResult(repoSlugError, true);
    }

    const safePath = sanitizeAndEncodePath(args.path);
    if (!safePath) {
      return textResult(
        'Invalid path: must be under 1024 chars, no ".." or "~"',
        true,
      );
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const content = await bb.getFileContent({
      repo_slug: args.repo_slug as string,
      path: args.path as string,
      ref: args.ref as string | undefined,
      max_lines: (args.max_lines as number) || 10000,
    });
    return textResult(content);
  },
};
