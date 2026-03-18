# Bitbucket Enterprise MCP Server on Atlassian Forge

[![CI](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Eulo-Labs/bitbucket-enterprise-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Eulo-Labs/bitbucket-enterprise-mcp)

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for Bitbucket that runs natively inside Atlassian Forge with admin controls and audit logging.

AI coding assistants (like Claude Code) connect via Streamable HTTP transport through a Forge web trigger, with OAuth 2.0 authentication backed by Bitbucket.

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

## Setup Guide

### Administrator Setup

Complete these steps to install and configure the MCP server for your workspace.

#### 1. Install the App

Install the Bitbucket Enterprise MCP Server directly from the Atlassian Marketplace using the Eulo Labs installation link:

[Install from Atlassian Marketplace](https://developer.atlassian.com/console/install/f29fdb13-c3ac-4e38-a7be-9ca0d8d5b6ac?signature=AYABeDBpVYOCwNheXdrLMHGk9zMAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4IOp8r3eKNYw8z2v%2FEq3%2FfvrZguoGsXpNSaDveR%2FF%2Fo0Bt5hs1j%2Fx52K8v42vF0UdAwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDcG56rhiJSmP9J%2FQwIBEIA7RT9QdtG%2BG9Lxi%2Beo74Putt2YleIAVw8kyhk9Z1pDsaCiPssbX5dpJlAEGepWGtU%2FTsBIAwrhJ1i9GS4AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHijmwVTMt6Oj3F%2B0%2B0cVrojrS8yZ9ktpdfDxqPMSIkvHAFCGonl8VJXtjtHEK4OqVemAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMakSStqRDooWTfkGGAgEQgDtZSic6vkwDgCEMpE2vTaAt%2BV%2FRfOzndriokOhIW4wvTldMELXGrR24OpPjTLnMgVA0Q2RsMRvk7h4NGgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeLKa7Dfn9BgbXaQmJGrkKztjV4vrreTkqr7wGwhqIYs5AdIOsqk6trru96DoVW4baWwAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAyTtepde8IMfkxVeJ8CARCAO2Zd5oAPc0OAc99t7RfWA%2FODGUN6Lix%2BhyqYM8aRBDNaQuPOJr7Ppc5%2Fuc0Lxv9sgOBxqMW%2B6qXVrVFlAgAAAAAMAAAQAAAAAAAAAAAAAAAAAE%2F9%2F1HHpjdBVpeqq7nSQ%2BH%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJcFoo3HpqeMYZTtofKPpdHX1aJRkiC5i29QnrP8wf6U1LgrCqXRY0%2BlU7te3fMxpqod3SoMO7SSV%2BSirAUT9iyBFU%3D&product=bitbucket)

1. Click the link above and follow the Atlassian installation prompts
2. Select the Bitbucket workspace where you want to install the app
3. Grant the requested permissions
4. Once installed, continue to the configuration steps below

> **NOTE:** You can also self-host by deploying this Forge app to your own Atlassian site instead. See the [Development](#development) section for instructions on deploying with `forge deploy`.

#### 2. Create a Bitbucket OAuth Consumer

1. Go to your Bitbucket workspace settings: **Settings > OAuth consumers > Add consumer**
2. Fill in:
   - **Name:** `bitbucket-mcp-server` (or any name you prefer)
   - **Callback URL:** Copy from the admin panel's **Settings** tab (shown as a read-only "OAuth Callback URL" field)
   - **Permissions:** Select the scopes your tools need (Repository Read, Pull Request Read/Write, Pipeline Read, etc.)
3. Save and note the **Key** (client ID) and **Secret** (client secret)

#### 3. Configure the App via Admin Panel

1. In Bitbucket, go to your workspace: **Workspace Settings > Forge Apps > MCP Server Settings**
2. The **Settings** tab displays two read-only fields:
   - **MCP Endpoint URL** — the auto-generated web trigger URL (use this in step 3)
   - **OAuth Callback URL** — use this when creating the OAuth consumer in step 1
3. Enter the OAuth credentials from step 2:
   - **Client ID:** the Key from step 2
   - **Client Secret:** the Secret from step 2
4. Save the configuration

### User Setup

#### 1. Configure your AI Client

Copy the **MCP Endpoint URL** from the admin panel's Settings tab (see Administrator step 3), then configure your AI client.

##### Claude Code

Add the MCP server to your Claude Code configuration. Copy the **MCP Endpoint URL** from the admin panel's Settings tab (see step 3), then add to `~/.claude.json` under `projects > <project-path> > mcpServers`:

```json
{
  "bitbucket-mcp": {
    "type": "http",
    "url": "<mcp-endpoint-url>",
    "oauth": {
      "authServerMetadataUrl": "<mcp-endpoint-url>/.well-known/openid-configuration"
    }
  }
}
```

Or add it via the CLI:

```bash
claude mcp add-json bitbucket-mcp '{"type":"http","url":"<mcp-endpoint-url>","oauth":{"authServerMetadataUrl":"<mcp-endpoint-url>/.well-known/openid-configuration"}}'
```

> **Why `authServerMetadataUrl`?** Forge web triggers can only serve paths under a specific prefix. Standard OAuth metadata discovery (RFC 8414) expects `.well-known` URLs at the domain root, which Forge's infrastructure doesn't route to the app. The `authServerMetadataUrl` override tells Claude Code where to find the metadata directly.

##### Open AI Codex

Codex supports streamable HTTP MCP servers and OAuth login via the CLI.

```bash
codex mcp add bitbucket-mcp --url "<mcp-endpoint-url>"
```

#### 2. Authenticate

Most clients will prompt you to Authenticate under /mcp.

This will open the browser and ask you to give consent to the app connecting to Bitbucket on your behalf.

Scopes approved are clearly displayed.

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
  mcp/        MCP protocol layer (handler, auth, sessions, protocol helpers)
  oauth/      OAuth 2.0 flow (metadata, registration, authorize, callback, token)
  tools/      Tool implementations (repos, PRs, pipelines, source, branches)
  bitbucket/  Bitbucket API client wrapper
  admin/      Admin panel resolver (OAuth config management)
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
