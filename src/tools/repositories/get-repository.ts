import type { ToolHandler, ToolContext } from '../types';
import { jsonResult, textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const getRepository: ToolHandler = {
  definition: {
    name: 'get_repository',
    description: `Get detailed information about a specific Bitbucket repository.

Example input:
{ "repo_slug": "demo" }

Returns:
{ "full_name": "acme/demo", "name": "demo", "main_branch": "main", "is_private": true }`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_slug: { type: 'string', description: 'Repository slug' },
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

    const r = await bb.getRepository({ repo_slug: args.repo_slug as string });

    return jsonResult({
      full_name: r.full_name,
      name: r.name,
      slug: r.slug,
      description: r.description,
      language: r.language,
      is_private: r.is_private,
      main_branch: r.mainbranch?.name,
      project: r.project ? { key: r.project.key, name: r.project.name } : null,
      created_on: r.created_on,
      updated_on: r.updated_on,
      url: r.links.html.href,
    });
  },
};
