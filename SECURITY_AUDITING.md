# Security Auditing & Publishing Results

This document outlines the strategy for auditing this project and publishing verifiable security results. The goal is to provide transparency and "Proof of Security" to users and contributors.

## 1. Automated Security Scanning (CI/CD)

We use several automated tools to continuously audit the codebase. Results are published via the **Security** tab and status badges.

| Tool                  | Purpose                                                     | Status/Report                                                                                                                                                                                                     |
| :-------------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub CodeQL**     | Static Analysis (SAST) for logic flaws and vulnerabilities. | [Security Alerts](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/security/code-scanning)                                                                                                                   |
| **Secret Scanning**   | Prevents accidental leaks of API keys or credentials.       | [Secret Scanning](https://github.com/Eulo-Labs/bitbucket-enterprise-mcp/security/secret-scanning)                                                                                                                 |
| **OpenSSF Scorecard** | Audits repository health (MFA, branch protection, etc.).    | [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Eulo-Labs/bitbucket-enterprise-mcp/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Eulo-Labs/bitbucket-enterprise-mcp) |

## 2. Supply Chain Integrity

To ensure the code you run is the code we audited, we implement the following:

- **Artifact Attestations**: Every release is cryptographically signed using GitHub's artifact attestation system.
- **Software Bill of Materials (SBOM)**: A machine-readable `SBOM.json` (CycloneDX/SPDX) is attached to every GitHub Release.
- **Signed Commits**: All maintainers are required to sign commits with GPG/SSH keys.

## 3. Manual Audit Checklist

In addition to automated scans, the following manual audits are performed periodically:

- [ ] **Auth Flow Review**: Verify OAuth 2.0 PKCE implementation and token storage security (Forge KVS).
- [ ] **Input Sanitization**: Audit all `src/tools/` for proper parameter validation and encoding.
- [ ] **Dependency Hygiene**: Periodic review of dependencies for "abandonware" or high-risk transitive packages.
- [ ] **Least Privilege**: Verify that Forge manifest permissions (`remotes`, `scopes`) are minimal.

## 4. How to View Results

- **For Users**: Check the badges in the `README.md` and the "Security" tab on GitHub.
- **For Auditors**: Detailed SARIF reports from CodeQL and SBOM files are available in the **Actions** artifacts and **Releases** page.
- **For Researchers**: Please see our [SECURITY.md](./SECURITY.md) for vulnerability disclosure instructions.

## 5. Compliance & Standards

This project aims to align with the following standards:

- **OpenSSF OSPS Baseline**: Level 1 (Universal Floor).
- **GitHub Security Best Practices**: Enforced via Repository Rules and Branch Protection.
