# Bitbucket Enterprise MCP Server as Forge App (BETA)

[![CI](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Eulo-Labs/bitbucket-enterprise-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Eulo-Labs/bitbucket-enterprise-mcp)
![Beta](https://img.shields.io/badge/status-beta-yellow)

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server running natively on Atlassian infrastructure with admin controls, audit logging and OAuth.

AI coding assistants (like Claude Code) connect via Streamable HTTP transport through a Forge web trigger, with OAuth 2.0 with PKCE authentication backed by Bitbucket.

## Features

Security:

- audit logging
- read only mode
- tool whitelisting

Tools:

- **Repositories** — list, search, and browse repositories in a workspace
- **Pull Requests** — list, view, create, approve, merge PRs; view diffs and comments
- **Pipelines** — list pipeline runs, view step logs, trigger runs
- **Source** — browse files and directories, read file contents
- **Branches** — list and search branches

## Setup Guide

See [SETUP.md](SETUP.md) for detailed installation and configuration instructions.

## Tool Names

### Repositories

| Tool Name           | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `list_repositories` | List repositories in the workspace with filtering/sorting |
| `get_repository`    | Get detailed information about a specific repository      |

### Pull Requests

| Tool Name                      | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `list_pull_requests`           | List PRs in a repository with optional state filtering |
| `list_workspace_pull_requests` | List PRs across all repositories in the workspace      |
| `get_pull_request`             | Get detailed PR information including commits          |
| `create_pull_request`          | Create a new pull request                              |
| `get_pull_request_diff`        | Get the diff content for a PR                          |
| `list_pull_request_comments`   | List comments on a PR (including inline)               |
| `create_pull_request_comment`  | Create a general or inline comment on a PR             |
| `approve_pull_request`         | Approve a pull request                                 |
| `unapprove_pull_request`       | Remove approval from a PR                              |
| `merge_pull_request`           | Merge a PR with configurable strategy                  |

### Pipelines

| Tool Name                  | Description                            |
| -------------------------- | -------------------------------------- |
| `list_pipelines`           | List pipeline runs in a repository     |
| `list_workspace_pipelines` | List pipelines across all repositories |
| `list_pipeline_steps`      | List steps for a pipeline run          |
| `get_pipeline_step_log`    | Get logs for a pipeline step           |
| `trigger_pipeline`         | Trigger a custom pipeline on a branch  |

### Source & Branches

| Tool Name          | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `get_file_content` | Read file content at a specific ref (branch/tag/commit) |
| `list_directory`   | List files and directories at a path                    |
| `list_branches`    | List branches in a repository with optional filtering   |

### Search

| Tool Name     | Description                                          |
| ------------- | ---------------------------------------------------- |
| `search_code` | Search for code in repositories across the workspace |

## Architecture

```txt
Claude Code  ──HTTP POST──▶  Forge Web Trigger  ──▶  MCP Handler  ──▶  Bitbucket REST API
                                                         │
                                              OAuth 2.0 (Bitbucket)
                                              Sessions (Forge KVS)
```

- **Transport:** Streamable HTTP via a Forge web trigger (dynamic response)
- **Auth:** OAuth 2.0 with PKCE — users authenticate via Bitbucket, tokens stored in Forge KVS
- **Sessions:** KVS-backed with 30-minute TTL

## Development

```bash
pnpm install          # install dependencies
pnpm test             # run tests (vitest)
forge tunnel          # local dev with hot-reload tunnel
forge deploy          # deploy to Forge
forge install --upgrade  # apply manifest changes (new scopes, egress URLs)
```

## File Structure

```
src/
  admin/      Admin panel resolver and validation (OAuth config management)
  audit/      Audit logging (fire-and-forget tool usage tracking)
  bitbucket/  Bitbucket API client wrapper
  db/         Forge SQL database service
  kvs/        Forge KVS service wrapper
  mcp/        MCP protocol layer (handler, auth, sessions, protocol helpers)
  oauth/      OAuth 2.0 flow (metadata, registration, authorize, callback, token)
  posthog/    PostHog analytics client
  tools/      Tool implementations (repos, PRs, pipelines, source, branches)
  utils/      Shared utilities and validation
bin/          Development scripts (deploy-dev, install-dev)
test/         Tests (vitest)
manifest.yml  Forge app manifest
```

## File Reference

### Main Entry

- `src/index.ts` — Main entry point, exports Forge web trigger handlers

### MCP Protocol (`src/mcp/`)

- `src/mcp/handler.ts` — Main MCP request handler (JSON-RPC routing, tool execution)
- `src/mcp/session.ts` — Session management via KVS (30-min TTL)
- `src/mcp/auth.ts` — OAuth token extraction and validation
- `src/mcp/protocol.ts` — JSON-RPC helpers and HTTP response building
- `src/mcp/errors.ts` — JSON-RPC 2.0 error code constants
- `src/mcp/types.ts` — Protocol type definitions
- `src/mcp/resources.ts` — MCP resource registration

### OAuth 2.0 (`src/oauth/`)

- `src/oauth/router.ts` — OAuth endpoint request router
- `src/oauth/handlers.ts` — OAuth endpoint implementations (metadata, register, authorize, callback, token)
- `src/oauth/config.ts` — OAuth configuration and utilities (endpoints, scopes, KVS keys)
- `src/oauth/tokens.ts` — Token minting, validation, and refresh logic
- `src/oauth/clients.ts` — Dynamic client registration (RFC 7591)
- `src/oauth/atlassian.ts` — Bitbucket OAuth integration (authorize, token exchange, user lookup)
- `src/oauth/types.ts` — OAuth type definitions
- `src/oauth/pkce.ts` — PKCE verification (RFC 7636)

### Tools (`src/tools/`)

- `src/tools/index.ts` — Re-exports all tools for convenient importing
- `src/tools/registry.ts` — Tool registry, execution dispatcher, and dynamic key/label generation
- `src/tools/types.ts` — Tool context types and result helpers

#### repositories/

- `list-repositories.ts` — List repositories in the workspace with filtering/sorting
- `get-repository.ts` — Get detailed repository information

#### pull-requests/

- `list-pull-requests.ts` — List PRs in a repository with optional state filtering
- `list-workspace-pull-requests.ts` — List PRs across all repositories in the workspace
- `get-pull-request.ts` — Get detailed PR information including commits
- `create-pull-request.ts` — Create a new pull request
- `get-pull-request-diff.ts` — Get the diff content for a PR
- `list-pull-request-comments.ts` — List comments on a PR (including inline)
- `create-pull-request-comment.ts` — Create a general or inline comment on a PR
- `approve-pull-request.ts` — Approve a pull request
- `unapprove-pull-request.ts` — Remove approval from a PR
- `merge-pull-request.ts` — Merge a PR with configurable strategy

#### pipelines/

- `list-pipelines.ts` — List pipeline runs in a repository
- `list-workspace-pipelines.ts` — List pipelines across all repositories in the workspace
- `list-pipeline-steps.ts` — List steps for a pipeline run
- `get-pipeline-step-log.ts` — Get logs for a pipeline step
- `trigger-pipeline.ts` — Trigger a custom pipeline on a branch

#### source/

- `get-file-content.ts` — Read file content at a specific ref (branch/tag/commit)
- `list-directory.ts` — List files and directories at a path

#### branches/

- `list-branches.ts` — List branches in a repository with optional filtering

#### search/

- `search-code.ts` — Search for code in repositories across the workspace

### Bitbucket API (`src/bitbucket/`)

- `src/bitbucket/client.ts` — HTTP client for Bitbucket REST API
- `src/bitbucket/types.ts` — Bitbucket API type definitions

### Admin (`src/admin/`)

- `src/admin/resolver.ts` — Forge Resolver for admin panel UI
- `src/admin/api.ts` — Web trigger handlers for admin configuration

### Database & Audit (`src/db/`, `src/audit/`)

- `src/db/migrations.ts` — Forge SQL migrations for audit_log table
- `src/audit/log.ts` — Audit logging (fire-and-forget tool usage tracking)
- `src/audit/types.ts` — Audit type definitions

## Licensing

This project is [Fair Source](https://fair.io/) under the [FSL (Functional Source License)](https://fsl.software/). It is free to use and deploy — including inside enterprise environments — but you may not offer it as a competing commercial service. After two years, the code becomes open source under Apache 2.0.
