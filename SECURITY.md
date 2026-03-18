# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in bitbucket-enterprise-mcp, please report it through [GitHub Security Advisories](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/security/advisories/new) (private reporting).

**Do not open a public issue for security vulnerabilities.**

### What to include

- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected versions (if known)
- Any suggested fixes (optional)

### Response timeline

- **Acknowledgment**: Within 48 hours of your report
- **Initial assessment**: Within 1 week
- **Fix target**: Within 90 days of confirmed vulnerabilities

## Scope

### In scope

- MCP server code and protocol handling
- OAuth flow and token handling
- API key authentication and session management
- Input validation on tool parameters
- Authorization and access control logic

### Out of scope

- Atlassian Forge platform infrastructure
- Bitbucket Cloud REST API
- Third-party dependencies (report these to the respective maintainers)
- Atlassian account or workspace security

## Security Model Overview

- **Authentication**: Bearer token auth with SHA-256 hashed keys stored in Forge KVS
- **Transport**: All connections run through Forge web triggers over HTTPS
- **Storage**: Session and key data stored in Forge KVS (encrypted at rest by Atlassian)
- **Authorization**: User-scoped access via OAuth 2.0 access tokens — no direct app-level credential exposure
- **Input validation**: All tool parameters are validated before use in Bitbucket API calls
- **Path safety**: API path segments use `encodeURIComponent()` to prevent injection

## Supported Versions

This project is pre-1.0. Only the **latest release** receives security patches.

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
| Older   | No        |

## Disclosure Policy

We follow coordinated disclosure:

1. Reporter submits vulnerability privately via GitHub Security Advisories.
2. We confirm, assess severity, and develop a fix.
3. Fix is released and the advisory is published.
4. Reporter is credited in the advisory unless they prefer to remain anonymous.

We ask that reporters allow a reasonable window (up to 90 days) for us to address the issue before any public disclosure.
