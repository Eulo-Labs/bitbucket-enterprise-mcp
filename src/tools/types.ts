/**
 * Tool Types
 *
 * Core type definitions for tools:
 * - ToolContext: Execution context (userToken, accountId, workspace)
 * - ToolHandler: Tool definition and execute function
 */

import type { McpToolDefinition, McpToolResult } from '../mcp/types';

export interface ToolContext {
  userToken: string;
  atlassianAccountId: string;
  workspace: string;
}

export interface ToolHandler {
  definition: McpToolDefinition;
  execute: (
    args: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<McpToolResult>;
}
