/**
 * Bitbucket API Types
 *
 * TypeScript type definitions for Bitbucket REST API:
 * - BitbucketRequestOptions/Response: HTTP client types
 * - PaginatedResponse: Standard paginated response wrapper
 * - Repository, PullRequest, PullRequestComment: Data models
 * - Pipeline, PipelineStep: CI/CD types
 * - Branch, TreeEntry: VCS types
 */

/** Bitbucket API response types */

export interface BitbucketRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  userToken?: string; // Required for all Bitbucket API calls
}

export interface BitbucketResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export interface PaginatedResponse<T> {
  size?: number;
  page?: number;
  pagelen?: number;
  next?: string;
  previous?: string;
  values: T[];
}

export interface Repository {
  type: 'repository';
  uuid: string;
  full_name: string;
  name: string;
  slug: string;
  description: string;
  is_private: boolean;
  created_on: string;
  updated_on: string;
  language: string;
  mainbranch?: { name: string; type: string };
  project?: { key: string; name: string; uuid: string };
  links: { html: { href: string } };
}

export interface PullRequest {
  type: 'pullrequest';
  id: number;
  title: string;
  description: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  created_on: string;
  updated_on: string;
  author: { display_name: string; uuid: string; nickname: string };
  source: {
    branch: { name: string };
    repository: { full_name: string };
    commit?: { hash: string };
  };
  destination: {
    branch: { name: string };
    repository: { full_name: string };
    commit?: { hash: string };
  };
  merge_commit?: { hash: string };
  close_source_branch: boolean;
  comment_count: number;
  task_count: number;
  reviewers: Array<{ display_name: string; uuid: string }>;
  links: { html: { href: string } };
}

export interface PullRequestComment {
  id: number;
  content: { raw: string; markup: string; html: string };
  created_on: string;
  updated_on: string;
  user: { display_name: string; uuid: string; nickname: string };
  inline?: {
    from?: number;
    to?: number;
    path: string;
  };
  parent?: { id: number };
}

export interface Pipeline {
  type: 'pipeline';
  uuid: string;
  build_number: number;
  created_on: string;
  state: {
    name: string;
    type: string;
    result?: { name: string; type: string };
    stage?: { name: string; type: string };
  };
  duration_in_seconds?: number;
  target: {
    type: string;
    ref_name?: string;
    commit?: { hash: string };
    selector?: { type: string; pattern: string };
  };
  trigger: { name: string };
}

export interface PipelineStep {
  uuid: string;
  name?: string;
  state: {
    name: string;
    type: string;
    result?: { name: string; type: string };
  };
  duration_in_seconds?: number;
  script_commands?: Array<{ name: string; command: string }>;
}

export interface Branch {
  name: string;
  type: 'branch';
  target: {
    hash: string;
    date: string;
    message: string;
    author: { raw: string; user?: { display_name: string } };
  };
}

export interface TreeEntry {
  type: 'commit_directory' | 'commit_file';
  path: string;
  size?: number;
  commit?: { hash: string };
}

interface CodeSearchSegment {
  text: string;
  match: boolean;
}

interface CodeSearchLine {
  line: number;
  segments: CodeSearchSegment[];
}

interface CodeSearchContentMatch {
  lines: CodeSearchLine[];
}

export interface CodeSearchResult {
  type: 'code_search_result';
  content_matches: CodeSearchContentMatch[];
  path_matches: { text: string; match: boolean }[];
  file: {
    path: string;
    type: string;
    links?: { self?: { href: string } };
    commit?: { hash: string; repository?: { full_name: string } };
  };
}

export interface SearchResponse {
  size: number;
  page: number;
  pagelen: number;
  query_substituted: boolean;
  values: CodeSearchResult[];
}
