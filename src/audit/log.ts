/**
 * Audit Logging
 *
 * Records tool usage to the audit_log table:
 * - logToolCall: Fire-and-forget audit entry (never blocks tool execution)
 * - getAuditLogs: Retrieve paginated audit logs with filtering
 * Tracks: account, tool name, workspace, repo, error status, timestamp
 */

import { db } from '../db/service';
import { captureError } from '../posthog/client';
import type { AuditEntry, AuditLogPage } from './types';

/** Fire-and-forget audit log entry. Never awaited by caller. */
export function logToolCall(entry: AuditEntry): void {
  void db.insertAuditLog(entry).catch((err: unknown) => {
    console.error('[audit] Failed to insert audit log:', err);
    captureError(err instanceof Error ? err : new Error(String(err)), {
      method: 'insertAuditLog',
    });
  });
}

export async function getAuditLogs({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): Promise<AuditLogPage> {
  return db.getAuditLogs({ page, pageSize });
}
