import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import {
  validateRepoSlug,
  sanitizeAndEncodePath,
} from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const listDirectory: ToolHandler = {
  definition: {
    name: 'list_directory',
    description: `List files and directories at a path in a repository.

Example input:
{ "repo_slug": "demo", "path": "src", "ref": "main", "page": 1 }

Returns:
{ "size": 5, "page": 1, "entries": [ { "type": "file", "path": "src/index.ts", "size": 1234 } ] }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
        path: {
          type: 'string',
          description: 'Directory path (default: root)',
        },
        ref: {
          type: 'string',
          description: 'Branch, tag, or commit hash (default: main branch)',
        },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 100 (default: 100)',
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

    if (args.path) {
      const safePath = sanitizeAndEncodePath(args.path);
      if (!safePath) {
        return textResult(
          'Invalid path: must be under 1024 chars, no ".." or "~"',
          true,
        );
      }
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listDirectory({
      repo_slug: args.repo_slug as string,
      path: (args.path as string) || '',
      ref: args.ref as string | undefined,
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 100,
    });

    return jsonResult({
      size: data.size,
      page: data.page,
      entries: data.values.map((e) => ({
        type: e.type === 'commit_directory' ? 'directory' : 'file',
        path: e.path,
        size: e.size,
      })),
    });
  },
};
