/**
 * Tool Result Helpers
 *
 * Helper functions for creating MCP tool results:
 * - textResult: Create text response
 * - jsonResult: Create JSON response with optional metadata
 * - safeResult: Ensure response doesn't exceed 4MB limit
 */

import type { McpToolResult } from '../mcp/types';

const MAX_SIZE = 4 * 1024 * 1024;

export function textResult(text: string, isError?: boolean): McpToolResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

export function jsonResult(
  data: unknown,
  metadata?: { truncated?: boolean; total_size?: number },
): McpToolResult {
  const text = JSON.stringify(metadata ? { ...metadata, data } : data, null, 2);
  return safeResult(text);
}

export function jsonResultWithUi(
  data: unknown,
  metadata?: { truncated?: boolean; total_size?: number },
): McpToolResult {
  const result = jsonResult(data, metadata);
  result.structuredContent = metadata
    ? { ...metadata, ...(data as object) }
    : (data as Record<string, unknown>);
  return result;
}

export function safeResult(text: string, isError?: boolean): McpToolResult {
  if (text.length > MAX_SIZE) {
    const truncated = text.slice(0, MAX_SIZE - 200);
    return {
      content: [
        {
          type: 'text',
          text:
            truncated +
            '\n\n[TRUNCATED — response exceeded 4MB limit. Use more specific parameters to reduce output.]',
        },
      ],
    };
  }
  return { content: [{ type: 'text', text }], isError };
}
