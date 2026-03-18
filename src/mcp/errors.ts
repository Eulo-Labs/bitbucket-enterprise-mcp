/**
 * JSON-RPC Error Codes
 *
 * Standard JSON-RPC 2.0 error code constants and factory functions
 * for creating error responses (-32700 to -32603).
 */
import type { JsonRpcError } from './types';

/** Standard JSON-RPC 2.0 error codes */
const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export function parseError(data?: unknown): JsonRpcError {
  return { code: ErrorCodes.PARSE_ERROR, message: 'Parse error', data };
}

export function invalidRequest(data?: unknown): JsonRpcError {
  return { code: ErrorCodes.INVALID_REQUEST, message: 'Invalid Request', data };
}

export function methodNotFound(method: string): JsonRpcError {
  return {
    code: ErrorCodes.METHOD_NOT_FOUND,
    message: `Method not found: ${method}`,
  };
}

export function invalidParams(data?: unknown): JsonRpcError {
  return { code: ErrorCodes.INVALID_PARAMS, message: 'Invalid params', data };
}

export function internalError(data?: unknown): JsonRpcError {
  return { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal error', data };
}
