/**
 * Tool Registry
 *
 * Registers all MCP tools and handles tool execution:
 * - getToolDefinitions: Returns all registered tool definitions
 * - callTool: Executes a tool by name with provided arguments
 * - getToolKeys: Returns all registered tool names
 * Tools are loaded from individual modules (repositories, pull-requests, etc.)
 */

import type { McpToolDefinition, McpToolResult } from '../mcp/types';
import type { ToolHandler, ToolContext } from './types';
import { textResult } from './results';
import { WRITE_TOOL_IDS } from './write-tools';
import { store } from '../kvs/service';
import { KVS_PREFIX } from '../oauth/config';

import { listRepositories, getRepository } from './repositories';
import {
  listPullRequests,
  listWorkspacePullRequests,
  getPullRequest,
  createPullRequest,
  getPullRequestDiff,
  listPullRequestComments,
  createPullRequestComment,
  approvePullRequest,
  unapprovePullRequest,
  mergePullRequest,
} from './pull-requests';
import {
  listPipelines,
  listPipelineSteps,
  getPipelineStepLog,
  triggerPipeline,
  listWorkspacePipelines,
} from './pipelines';
import { getFileContent, listDirectory } from './source';
import { listBranches } from './branches';
import { searchCode } from './search';

const tools: Map<string, ToolHandler> = new Map();

function register(handler: ToolHandler) {
  tools.set(handler.definition.name, handler);
}

// Phase 1: Read-only tools
register(listRepositories);
register(getRepository);
register(listPullRequests);
register(listWorkspacePullRequests);
register(getPullRequest);
register(getPullRequestDiff);
register(listPullRequestComments);
register(listPipelines);
register(listWorkspacePipelines);
register(listPipelineSteps);
register(getPipelineStepLog);
register(getFileContent);
register(listDirectory);
register(listBranches);
register(searchCode);

// Phase 2: Write tools
register(createPullRequest);
register(createPullRequestComment);
register(approvePullRequest);
register(unapprovePullRequest);
register(mergePullRequest);
register(triggerPipeline);

/** Check if read-only mode is enabled */
async function isReadOnlyMode(): Promise<boolean> {
  const val = await store.get(KVS_PREFIX.READ_ONLY_MODE);
  return val === true;
}

/** Get all tool definitions for tools/list - excludes disabled tools and write tools in read-only mode */
export async function getToolDefinitions(): Promise<McpToolDefinition[]> {
  const [enabledTools, readOnly] = await Promise.all([
    getEnabledToolKeys(),
    isReadOnlyMode(),
  ]);
  return Array.from(tools.values())
    .filter((t) => {
      if (!enabledTools.has(t.definition.name)) return false;
      if (readOnly && WRITE_TOOL_IDS.has(t.definition.name)) return false;
      return true;
    })
    .map((t) => t.definition);
}

/** Get all registered tool names */
export function getToolKeys(): readonly string[] {
  return Array.from(tools.keys());
}

type ToolKey = ReturnType<typeof getToolKeys>[number];

const DEFAULT_TOOLS_ENABLED: Record<ToolKey, boolean> = Object.fromEntries(
  getToolKeys().map((key) => [key, true]),
) as Record<ToolKey, boolean>;

async function isToolEnabled(toolName: string): Promise<boolean> {
  const saved = (await store.get(KVS_PREFIX.TOOLS_CONFIG)) as Partial<
    Record<ToolKey, boolean>
  > | null;
  const tools = saved
    ? { ...DEFAULT_TOOLS_ENABLED, ...saved }
    : DEFAULT_TOOLS_ENABLED;
  return tools[toolName as ToolKey] ?? true;
}

async function getEnabledToolKeys(): Promise<Set<string>> {
  const saved = (await store.get(KVS_PREFIX.TOOLS_CONFIG)) as Partial<
    Record<ToolKey, boolean>
  > | null;
  const tools = saved
    ? { ...DEFAULT_TOOLS_ENABLED, ...saved }
    : DEFAULT_TOOLS_ENABLED;
  const enabled = new Set<string>();
  for (const key of getToolKeys()) {
    if (tools[key as ToolKey] !== false) {
      enabled.add(key);
    }
  }
  return enabled;
}

/** Execute a tool by name */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<McpToolResult> {
  const handler = tools.get(name);
  if (!handler) {
    return textResult(`Unknown tool: ${name}`, true);
  }

  // Reject write tools when read-only mode is active
  if (WRITE_TOOL_IDS.has(name) && (await isReadOnlyMode())) {
    return textResult(
      `Tool '${name}' is unavailable because the workspace is in read-only mode`,
      true,
    );
  }

  const enabled = await isToolEnabled(name);
  if (!enabled) {
    return textResult(`Tool '${name}' is currently disabled by admin`, true);
  }

  try {
    return await handler.execute(args, context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return textResult(`Tool error: ${message}`, true);
  }
}
