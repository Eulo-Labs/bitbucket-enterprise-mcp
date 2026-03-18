/**
 * Write Tool IDs
 *
 * Single source of truth for which tools perform write operations.
 * Shared between backend (registry.ts) and frontend (ToolsTab.tsx).
 */

export const WRITE_TOOL_IDS = new Set([
  'create_pull_request',
  'create_pull_request_comment',
  'approve_pull_request',
  'unapprove_pull_request',
  'merge_pull_request',
  'trigger_pipeline',
]);
