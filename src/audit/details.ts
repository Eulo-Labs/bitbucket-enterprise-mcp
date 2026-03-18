/**
 * Audit Details Extractor
 *
 * Extracts tool-specific context from tool arguments for audit logging.
 * Strips redundant top-level columns (workspace, repo_slug) and truncates
 * long string values to keep stored details concise.
 */

const MAX_STRING_LENGTH = 500;

function truncate(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    return value.slice(0, MAX_STRING_LENGTH) + '…';
  }
  return value;
}

function pick(
  args: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in args) {
      result[key] = truncate(args[key]);
    }
  }
  return result;
}

/**
 * Extracts interesting audit details from tool arguments.
 * Returns null for tools with no interesting extra context.
 * Workspace and repo_slug are always omitted (already top-level columns).
 */
export function extractAuditDetails(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> | null {
  switch (toolName) {
    case 'create_pull_request': {
      const details = pick(args, [
        'title',
        'source_branch',
        'destination_branch',
        'description',
        'close_source_branch',
        'reviewers',
      ]);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'merge_pull_request': {
      const details = pick(args, [
        'pull_request_id',
        'merge_strategy',
        'message',
      ]);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'create_pull_request_comment': {
      const details = pick(args, ['pull_request_id', 'content', 'inline_path']);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'approve_pull_request':
    case 'unapprove_pull_request': {
      const details = pick(args, ['pull_request_id']);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'trigger_pipeline': {
      const details = pick(args, ['branch', 'pipeline_name']);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'get_pull_request':
    case 'get_pull_request_diff': {
      const details = pick(args, ['pull_request_id']);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'get_file_content':
    case 'list_directory': {
      const details = pick(args, ['path', 'ref']);
      return Object.keys(details).length > 0 ? details : null;
    }

    case 'get_pipeline_step_log':
    case 'list_pipeline_steps': {
      const details = pick(args, ['pipeline_uuid']);
      return Object.keys(details).length > 0 ? details : null;
    }

    default:
      return null;
  }
}
