/**
 * Bitbucket Service
 *
 * High-level service consolidating all Bitbucket API calls.
 * Provides domain-specific methods for repositories, pull requests, branches, source, and pipelines.
 */

import safeRegex from 'safe-regex2';
import { bbClient, bbPath, assertOk } from './client';
import { captureError } from '../posthog/client';
import type {
  PaginatedResponse,
  Repository,
  PullRequest,
  PullRequestComment,
  Pipeline,
  PipelineStep,
  Branch,
  TreeEntry,
  SearchResponse,
} from './types';

interface ListRepositoriesParams {
  page?: number;
  pagelen?: number;
  q?: string;
  sort?: string;
}

interface GetRepositoryParams {
  repo_slug: string;
}

interface ListPullRequestsParams {
  repo_slug: string;
  state?: string;
  page?: number;
  pagelen?: number;
  q?: string;
}

interface GetPullRequestParams {
  repo_slug: string;
  pr_id: string;
}

interface ListWorkspacePRsParams {
  state?: string;
  page?: number;
  pagelen?: number;
  q?: string;
}

interface CreatePullRequestParams {
  repo_slug: string;
  title: string;
  source_branch: string;
  destination_branch?: string;
  description?: string;
  close_source_branch?: boolean;
  reviewers?: string[];
}

interface MergePullRequestParams {
  repo_slug: string;
  pr_id: string;
  merge_strategy?: string;
  close_source_branch?: boolean;
  message?: string;
}

interface ListPRCommentsParams {
  repo_slug: string;
  pr_id: string;
  page?: number;
  pagelen?: number;
}

interface CreatePRCommentParams {
  repo_slug: string;
  pr_id: string;
  content: string;
  inline_path?: string;
  inline_to?: number;
  inline_from?: number;
  parent_id?: number;
}

interface ListBranchesParams {
  repo_slug: string;
  q?: string;
  sort?: string;
  page?: number;
  pagelen?: number;
}

interface GetFileContentParams {
  repo_slug: string;
  path: string;
  ref?: string;
  max_lines?: number;
}

interface ListDirectoryParams {
  repo_slug: string;
  path?: string;
  ref?: string;
  page?: number;
  pagelen?: number;
}

interface ListPipelinesParams {
  repo_slug: string;
  page?: number;
  pagelen?: number;
}

interface ListWorkspacePipelinesParams {
  last_n?: number;
  q?: string;
}

interface ListPipelineStepsParams {
  repo_slug: string;
  pipeline_uuid: string;
}

interface GetPipelineStepLogParams {
  repo_slug: string;
  pipeline_uuid: string;
  step_uuid: string;
  max_bytes?: number;
  tail_lines?: number;
  grep_pattern?: string;
  context_lines?: number;
}

interface TriggerPipelineParams {
  repo_slug: string;
  branch: string;
  pipeline_name: string;
}

interface SearchCodeParams {
  search_query: string;
  page?: number;
  pagelen?: number;
}

export class BitbucketService {
  constructor(
    private workspace: string,
    private userToken: string,
  ) {}

  async listRepositories(
    params: ListRepositoriesParams,
  ): Promise<PaginatedResponse<Repository>> {
    const { page = 1, pagelen = 25, q, sort } = params;

    const urlParams = new URLSearchParams({
      page: page.toString(),
      pagelen: Math.min(pagelen, 100).toString(),
    });
    if (q) urlParams.set('q', q);
    if (sort) urlParams.set('sort', sort);

    const path =
      bbPath('/2.0/repositories/{workspace}', { workspace: this.workspace }) +
      `?${urlParams}`;

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'list_repositories');

    return (await response.json()) as PaginatedResponse<Repository>;
  }

  async getRepository(params: GetRepositoryParams): Promise<Repository> {
    const { repo_slug } = params;

    const path = bbPath('/2.0/repositories/{workspace}/{repo_slug}', {
      workspace: this.workspace,
      repo_slug,
    });

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'get_repository');

    return (await response.json()) as Repository;
  }

  async listPullRequests(
    params: ListPullRequestsParams,
  ): Promise<PaginatedResponse<PullRequest>> {
    const { repo_slug, state = 'OPEN', page = 1, pagelen = 25, q } = params;

    const urlParams = new URLSearchParams({
      state,
      page: page.toString(),
      pagelen: Math.min(pagelen, 50).toString(),
    });
    if (q) urlParams.set('q', q);

    const path =
      bbPath('/2.0/repositories/{workspace}/{repo_slug}/pullrequests', {
        workspace: this.workspace,
        repo_slug,
      }) + `?${urlParams}`;

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'list_pull_requests');

    return (await response.json()) as PaginatedResponse<PullRequest>;
  }

  async getPullRequest(params: GetPullRequestParams): Promise<PullRequest> {
    const { repo_slug, pr_id } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}',
      {
        workspace: this.workspace,
        repo_slug,
        pr_id,
      },
    );

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'get_pull_request');

    return (await response.json()) as PullRequest;
  }

  async listWorkspacePullRequests(
    params: ListWorkspacePRsParams,
  ): Promise<PaginatedResponse<PullRequest>> {
    const { state = 'OPEN', pagelen = 25, q } = params;

    // Fetch all repos, then fan out per-repo PR queries in parallel
    const reposData = await this.listRepositories({ pagelen: 100 });

    const perRepoPagelen = Math.min(pagelen, 50);
    const results = await Promise.all(
      reposData.values.map(async (repo) => {
        try {
          const data = await this.listPullRequests({
            repo_slug: repo.slug,
            state,
            page: 1,
            pagelen: perRepoPagelen,
            q,
          });
          return data.values;
        } catch (err) {
          console.error(
            `[listWorkspacePullRequests] Failed for repo ${repo.slug}:`,
            err,
          );
          captureError(err instanceof Error ? err : new Error(String(err)), {
            method: 'listWorkspacePullRequests',
          });
          return [];
        }
      }),
    );

    const allPRs = results.flat();

    return {
      size: allPRs.length,
      page: 1,
      pagelen: allPRs.length,
      values: allPRs,
    };
  }

  async createPullRequest(
    params: CreatePullRequestParams,
  ): Promise<PullRequest> {
    const {
      repo_slug,
      title,
      source_branch,
      destination_branch,
      description,
      close_source_branch = false,
      reviewers,
    } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests',
      {
        workspace: this.workspace,
        repo_slug,
      },
    );

    const body: Record<string, unknown> = {
      title,
      source: { branch: { name: source_branch } },
      close_source_branch,
    };
    if (destination_branch) {
      body.destination = { branch: { name: destination_branch } };
    }
    if (description) {
      body.description = description;
    }
    if (reviewers) {
      body.reviewers = reviewers.map((uuid) => ({ uuid }));
    }

    const response = await bbClient.post(
      path,
      JSON.stringify(body),
      undefined,
      this.userToken,
    );
    assertOk(response, 'create_pull_request');

    return (await response.json()) as PullRequest;
  }

  async approvePullRequest(params: GetPullRequestParams): Promise<void> {
    const { repo_slug, pr_id } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/approve',
      {
        workspace: this.workspace,
        repo_slug,
        pr_id,
      },
    );

    const response = await bbClient.post(
      path,
      undefined,
      undefined,
      this.userToken,
    );
    assertOk(response, 'approve_pull_request');
  }

  async unapprovePullRequest(params: GetPullRequestParams): Promise<void> {
    const { repo_slug, pr_id } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/approve',
      {
        workspace: this.workspace,
        repo_slug,
        pr_id,
      },
    );

    const response = await bbClient.delete(path, this.userToken);
    assertOk(response, 'unapprove_pull_request');
  }

  async mergePullRequest(params: MergePullRequestParams): Promise<PullRequest> {
    const {
      repo_slug,
      pr_id,
      merge_strategy = 'merge_commit',
      close_source_branch = false,
      message,
    } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/merge',
      {
        workspace: this.workspace,
        repo_slug,
        pr_id,
      },
    );

    const body: Record<string, unknown> = {
      type: 'pullrequest',
      merge_strategy,
      close_source_branch,
    };
    if (message) {
      body.message = message;
    }

    const response = await bbClient.post(
      path,
      JSON.stringify(body),
      undefined,
      this.userToken,
    );
    assertOk(response, 'merge_pull_request');

    return (await response.json()) as PullRequest;
  }

  async getPullRequestDiff(params: GetPullRequestParams): Promise<string> {
    const { repo_slug, pr_id } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/diff',
      {
        workspace: this.workspace,
        repo_slug,
        pr_id,
      },
    );

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'get_pull_request_diff');

    return await response.text();
  }

  async listPullRequestComments(
    params: ListPRCommentsParams,
  ): Promise<PaginatedResponse<PullRequestComment>> {
    const { repo_slug, pr_id, page = 1, pagelen = 50 } = params;

    const urlParams = new URLSearchParams({
      page: page.toString(),
      pagelen: Math.min(pagelen, 100).toString(),
    });

    const path =
      bbPath(
        '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/comments',
        {
          workspace: this.workspace,
          repo_slug,
          pr_id,
        },
      ) + `?${urlParams}`;

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'list_pull_request_comments');

    return (await response.json()) as PaginatedResponse<PullRequestComment>;
  }

  async createPullRequestComment(
    params: CreatePRCommentParams,
  ): Promise<PullRequestComment> {
    const {
      repo_slug,
      pr_id,
      content,
      inline_path,
      inline_to,
      inline_from,
      parent_id,
    } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pullrequests/{pr_id}/comments',
      {
        workspace: this.workspace,
        repo_slug,
        pr_id,
      },
    );

    const body: Record<string, unknown> = {
      content: { raw: content },
    };
    if (inline_path) {
      body.inline = {
        path: inline_path,
        to: inline_to,
        from: inline_from,
      };
    }
    if (parent_id) {
      body.parent = { id: parent_id };
    }

    const response = await bbClient.post(
      path,
      JSON.stringify(body),
      undefined,
      this.userToken,
    );
    assertOk(response, 'create_pull_request_comment');

    return (await response.json()) as PullRequestComment;
  }

  async listBranches(
    params: ListBranchesParams,
  ): Promise<PaginatedResponse<Branch>> {
    const { repo_slug, q, sort, page = 1, pagelen = 25 } = params;

    const urlParams = new URLSearchParams({
      page: page.toString(),
      pagelen: Math.min(pagelen, 100).toString(),
    });
    if (q) urlParams.set('q', q);
    if (sort) urlParams.set('sort', sort);

    const path =
      bbPath('/2.0/repositories/{workspace}/{repo_slug}/refs/branches', {
        workspace: this.workspace,
        repo_slug,
      }) + `?${urlParams}`;

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'list_branches');

    return (await response.json()) as PaginatedResponse<Branch>;
  }

  async getFileContent(params: GetFileContentParams): Promise<string> {
    const { repo_slug, path: filePath, ref, max_lines } = params;

    const base = bbPath('/2.0/repositories/{workspace}/{repo_slug}/src', {
      workspace: this.workspace,
      repo_slug,
    });
    // When ref is omitted, use the empty string so the API resolves the repo's default branch
    const refSegment = ref ? encodeURIComponent(ref) : '';
    const fullPath = `${base}/${refSegment}/${filePath.split('/').map(encodeURIComponent).join('/')}`;

    const response = await bbClient.get(fullPath, this.userToken);
    assertOk(response, 'get_file_content');

    let content = await response.text();

    if (max_lines) {
      const lines = content.split('\n');
      if (lines.length > max_lines) {
        content =
          lines.slice(0, max_lines).join('\n') +
          `\n\n[TRUNCATED — showing ${max_lines} of ${lines.length} lines. Use max_lines parameter to adjust.]`;
      }
    }

    return content;
  }

  async listDirectory(
    params: ListDirectoryParams,
  ): Promise<PaginatedResponse<TreeEntry>> {
    const {
      repo_slug,
      path: dirPath = '',
      ref,
      page = 1,
      pagelen = 100,
    } = params;

    const base = bbPath('/2.0/repositories/{workspace}/{repo_slug}/src', {
      workspace: this.workspace,
      repo_slug,
    });

    const pathParts = dirPath
      ? `/${dirPath.split('/').map(encodeURIComponent).join('/')}`
      : '';

    const urlParams = new URLSearchParams({
      page: page.toString(),
      pagelen: Math.min(pagelen, 100).toString(),
    });

    // When ref is omitted, omit the ref segment so the API resolves the repo's default branch
    const refSegment = ref ? `/${encodeURIComponent(ref)}` : '';
    const fullPath = `${base}${refSegment}${pathParts || '/'}?${urlParams}`;

    const response = await bbClient.get(fullPath, this.userToken);
    assertOk(response, 'list_directory');

    return (await response.json()) as PaginatedResponse<TreeEntry>;
  }

  async listPipelines(
    params: ListPipelinesParams,
  ): Promise<PaginatedResponse<Pipeline>> {
    const { repo_slug, page = 1, pagelen = 20 } = params;

    const urlParams = new URLSearchParams({
      sort: '-created_on',
      page: page.toString(),
      pagelen: Math.min(pagelen, 100).toString(),
    });

    const path =
      bbPath('/2.0/repositories/{workspace}/{repo_slug}/pipelines', {
        workspace: this.workspace,
        repo_slug,
      }) + `?${urlParams}`;

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'list_pipelines');

    return (await response.json()) as PaginatedResponse<Pipeline>;
  }

  async listWorkspacePipelines(params: ListWorkspacePipelinesParams): Promise<{
    size: number;
    values: Array<Pipeline & { _repository: string }>;
  }> {
    const { last_n = 1 } = params;
    const reposData = await this.listRepositories({ pagelen: 100 });

    const results = await Promise.all(
      reposData.values.map(async (repo) => {
        try {
          const data = await this.listPipelines({
            repo_slug: repo.slug,
            page: 1,
            pagelen: Math.min(last_n, 10),
          });
          return data.values.slice(0, last_n).map((p) => ({
            ...p,
            _repository: repo.full_name,
          }));
        } catch (err) {
          console.error(
            `[listWorkspacePipelines] Failed for repo ${repo.slug}:`,
            err,
          );
          captureError(err instanceof Error ? err : new Error(String(err)), {
            method: 'listWorkspacePipelines',
          });
          return [];
        }
      }),
    );

    const all = results.flat();
    return { size: all.length, values: all };
  }

  async listPipelineSteps(
    params: ListPipelineStepsParams,
  ): Promise<PaginatedResponse<PipelineStep>> {
    const { repo_slug, pipeline_uuid } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pipelines/{pipeline_uuid}/steps',
      {
        workspace: this.workspace,
        repo_slug,
        pipeline_uuid,
      },
    );

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'list_pipeline_steps');

    return (await response.json()) as PaginatedResponse<PipelineStep>;
  }

  async getPipelineStepLog(params: GetPipelineStepLogParams): Promise<string> {
    const {
      repo_slug,
      pipeline_uuid,
      step_uuid,
      max_bytes = 1048576,
      tail_lines,
      grep_pattern,
      context_lines,
    } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pipelines/{pipeline_uuid}/steps/{step_uuid}/log',
      {
        workspace: this.workspace,
        repo_slug,
        pipeline_uuid,
        step_uuid,
      },
    );

    const response = await bbClient.request(path, {
      method: 'GET',
      headers: { Range: `bytes=0-${max_bytes - 1}` },
      userToken: this.userToken,
    });
    assertOk(response, 'get_pipeline_step_log');

    let text = await response.text();

    // Apply tail_lines: keep only the last N lines
    if (tail_lines) {
      const lines = text.split('\n');
      text = lines.slice(-tail_lines).join('\n');
    }

    // Apply grep_pattern: filter to lines matching the regex with context
    if (grep_pattern) {
      const ctx = context_lines ?? 5;
      const lines = text.split('\n');

      // Validate pattern length and safety before constructing RegExp (ReDoS protection)
      let re: RegExp;
      try {
        if (grep_pattern.length > 200 || !safeRegex(grep_pattern)) {
          return '[error: grep_pattern is too complex or unsafe (potential ReDoS)]';
        }
        re = new RegExp(grep_pattern, 'i');
      } catch {
        return `[error: invalid grep_pattern: ${grep_pattern}]`;
      }
      const matchIndices = new Set<number>();

      lines.forEach((line, i) => {
        if (re.test(line)) {
          for (
            let j = Math.max(0, i - ctx);
            j <= Math.min(lines.length - 1, i + ctx);
            j++
          ) {
            matchIndices.add(j);
          }
        }
      });

      if (matchIndices.size === 0) {
        text = `[no lines matched pattern: ${grep_pattern}]`;
      } else {
        const sorted = [...matchIndices].sort((a, b) => a - b);
        const blocks: string[] = [];
        let block: string[] = [];
        let prev = -2;

        for (const i of sorted) {
          if (i > prev + 1) {
            if (block.length) blocks.push(block.join('\n'));
            block = [];
          }
          block.push(lines[i]);
          prev = i;
        }

        if (block.length) blocks.push(block.join('\n'));
        text = blocks.join('\n---\n');
      }
    }

    return text;
  }

  async searchCode(params: SearchCodeParams): Promise<SearchResponse> {
    const { search_query, page = 1, pagelen = 10 } = params;

    const urlParams = new URLSearchParams({
      search_query,
      page: page.toString(),
      pagelen: Math.min(pagelen, 100).toString(),
    });

    const path =
      bbPath('/2.0/workspaces/{workspace}/search/code', {
        workspace: this.workspace,
      }) + `?${urlParams}`;

    const response = await bbClient.get(path, this.userToken);
    assertOk(response, 'search_code');

    return (await response.json()) as SearchResponse;
  }

  async triggerPipeline(params: TriggerPipelineParams): Promise<Pipeline> {
    const { repo_slug, branch, pipeline_name } = params;

    const path = bbPath(
      '/2.0/repositories/{workspace}/{repo_slug}/pipelines/',
      {
        workspace: this.workspace,
        repo_slug,
      },
    );

    const body = JSON.stringify({
      target: {
        type: 'pipeline_ref_target',
        ref_type: 'branch',
        ref_name: branch,
        selector: {
          type: 'custom',
          pattern: pipeline_name.replace(/^custom:\s*/i, '').trim(),
        },
      },
    });

    const response = await bbClient.post(path, body, undefined, this.userToken);
    assertOk(response, 'trigger_pipeline');

    return (await response.json()) as Pipeline;
  }
}
