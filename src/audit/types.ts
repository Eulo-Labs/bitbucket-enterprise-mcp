/**
 * Audit Types
 *
 * TypeScript type definitions for audit logging:
 * - AuditEntry: Input for logging tool calls
 * - AuditLogRow: Database row structure
 * - AuditLogPage: Paginated log response
 */

export interface AuditEntry {
  atlassianAccountId: string;
  toolName: string;
  workspace: string | null;
  repoSlug: string | null;
  isError: boolean;
  details?: Record<string, unknown> | null;
}

export interface UserRow {
  account_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  fetched_at: string;
}

interface AuditLogRow {
  id: string;
  timestamp: string;
  atlassian_account_id: string;
  display_name: string | null;
  tool_name: string;
  workspace: string | null;
  repo_slug: string | null;
  is_error: number; // SQLite boolean
  details: string | null;
}

export interface AuditLogRowWithUser extends AuditLogRow {
  user_display_name: string | null;
  user_email: string | null;
  user_avatar_url: string | null;
}

export interface AuditLogPage {
  logs: AuditLogRowWithUser[];
  total: number;
  page: number;
  pageSize: number;
}
