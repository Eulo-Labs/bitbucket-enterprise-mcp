import { describe, it, expect } from 'vitest';
import {
  parseJsonRpc,
  jsonRpcResult,
  jsonRpcError,
  httpResponse,
  isNotification,
} from '../../src/mcp/protocol';

describe('parseJsonRpc', () => {
  it('parses a valid JSON-RPC request', () => {
    const result = parseJsonRpc(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    );
    expect(result).toEqual({ jsonrpc: '2.0', id: 1, method: 'ping' });
  });

  it('parses a batch of requests', () => {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ];
    const result = parseJsonRpc(JSON.stringify(batch));
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonRpc('not json')).toThrow();
  });

  it('throws on empty batch', () => {
    expect(() => parseJsonRpc('[]')).toThrow();
  });

  it('throws on missing jsonrpc field', () => {
    expect(() =>
      parseJsonRpc(JSON.stringify({ id: 1, method: 'ping' })),
    ).toThrow();
  });

  it('throws on missing method field', () => {
    expect(() =>
      parseJsonRpc(JSON.stringify({ jsonrpc: '2.0', id: 1 })),
    ).toThrow();
  });
});

describe('jsonRpcResult', () => {
  it('creates a result response', () => {
    const res = jsonRpcResult(1, { tools: [] });
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] },
    });
  });
});

describe('jsonRpcError', () => {
  it('creates an error response', () => {
    const res = jsonRpcError(1, { code: -32600, message: 'Invalid' });
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32600, message: 'Invalid' },
    });
  });
});

describe('httpResponse', () => {
  it('creates a web trigger response', () => {
    const res = httpResponse(200, { ok: true });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toEqual(['application/json']);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('handles string body', () => {
    const res = httpResponse(204, '');
    expect(res.body).toBe('');
  });

  it('merges extra headers', () => {
    const res = httpResponse(200, {}, { 'Mcp-Session-Id': ['abc'] });
    expect(res.headers['Mcp-Session-Id']).toEqual(['abc']);
  });
});

describe('isNotification', () => {
  it('returns true for messages without id', () => {
    expect(
      isNotification({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    ).toBe(true);
  });

  it('returns false for messages with id', () => {
    expect(isNotification({ jsonrpc: '2.0', id: 1, method: 'ping' })).toBe(
      false,
    );
  });
});
