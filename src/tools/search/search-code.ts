import type { ToolHandler, ToolContext } from '../types';
import { textResult } from '../results';
import { validateRepoSlug } from '../../utils/validation';
import { BitbucketService } from '../../bitbucket/service';

export const searchCode: ToolHandler = {
  definition: {
    name: 'search_code',
    description: `Search code across the workspace using Bitbucket's code search.
    Optionally scope to a specific repository with repo_slug.

Example input:
{ "search_query": "TODO", "repo_slug": "my-repo" }

Returns:
{ "size": 3, "results": [{ "file": "src/foo.ts", "repo": "ws/my-repo", "matches": [...] }] }`,
    inputSchema: {
      type: 'object',
      properties: {
        search_query: {
          type: 'string',
          description: 'Search query (Bitbucket syntax)',
        },
        repo_slug: {
          type: 'string',
          description: 'Limit search to this repository (optional)',
        },
        page: { type: 'number', description: 'Page number (default: 1)' },
        pagelen: {
          type: 'number',
          description: 'Results per page, max 100 (default: 10)',
        },
      },
      required: ['search_query'],
    },
  },

  async execute(args, context: ToolContext) {
    let query = args.search_query as string;

    if (args.repo_slug) {
      const err = validateRepoSlug(args.repo_slug);
      if (err) return textResult(err, true);
      query = `${query} repo:${args.repo_slug as string}`;
    }

    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.searchCode({
      search_query: query,
      page: (args.page as number) || 1,
      pagelen: (args.pagelen as number) || 10,
    });

    const rows = data.values.map((r) => {
      // Bitbucket search API doesn't return commit object; parse repo/commit from the self link
      // URL format: /2.0/repositories/{workspace}/{repo}/src/{commit}/{path}
      const selfHref: string = r.file.links?.self?.href ?? '';
      const linkMatch = selfHref.match(
        /\/repositories\/([^/]+\/[^/]+)\/src\/([0-9a-f]+)\//,
      );
      const repo =
        linkMatch?.[1] ?? r.file.commit?.repository?.full_name ?? '(unknown)';
      const commit = (linkMatch?.[2] ?? r.file.commit?.hash ?? '').slice(0, 8);
      const matchLines = r.content_matches
        .flatMap((cm) =>
          cm.lines.filter((l) => l.segments.some((s) => s.match)),
        )
        .map(
          (l) =>
            `L${l.line}: ${l.segments
              .map((s) => s.text)
              .join('')
              .trim()}`,
        )
        .join('; ');
      return { repo, file: r.file.path, commit, matches: matchLines };
    });

    const header = '| Repo | File | Commit | Match |';
    const sep = '|------|------|--------|-------|';
    const body = rows
      .map((r) => `| ${r.repo} | ${r.file} | ${r.commit} | ${r.matches} |`)
      .join('\n');

    const summary = `${data.size} result(s)${data.query_substituted ? ' (query substituted)' : ''}`;
    return textResult(`${summary}\n\n${header}\n${sep}\n${body}`);
  },
};
