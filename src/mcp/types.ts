/**
 * MCP Protocol Types
 *
 * TypeScript type definitions for the MCP protocol including:
 * - JSON-RPC 2.0 request/response types
 * - MCP-specific types (initialize, tools, resources)
 * - Web trigger event/response types
 * - Session data structure
 */

/** JSON-RPC 2.0 types for MCP protocol */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** MCP-specific types */

export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: {
    name: string;
    version: string;
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  label?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  _meta?: {
    ui?: { resourceUri: string };
  };
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResult {
  content: McpContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpResource {
  uri: string;
  name: string;
  mimeType: string;
}

export interface McpContent {
  type: 'text';
  text: string;
}

/** Web trigger types */

export interface WebTriggerEvent {
  body: string;
  headers: Record<string, string[]>;
  method: string;
  path: string;
  /** Path segments after the web trigger prefix (e.g. "/hello/world") */
  userPath: string;
  queryParameters: Record<string, string[]>;
}

export interface WebTriggerResponse {
  body: string;
  headers: Record<string, string[]>;
  statusCode: number;
}

/** Session data stored in KVS */
export interface SessionData {
  id: string;
  initialized: boolean;
  clientInfo?: {
    name: string;
    version: string;
  };
  atlassianAccountId?: string;
  createdAt: number;
  lastAccessedAt: number;
}
