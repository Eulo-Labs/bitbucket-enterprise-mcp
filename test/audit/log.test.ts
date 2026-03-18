import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockInsertAuditLog, mockGetAuditLogs, mockCaptureError } = vi.hoisted(
  () => ({
    mockInsertAuditLog: vi.fn(),
    mockGetAuditLogs: vi.fn(),
    mockCaptureError: vi.fn(),
  }),
);

// Mock db service
vi.mock('../../src/db/service', () => ({
  db: {
    insertAuditLog: mockInsertAuditLog,
    getAuditLogs: mockGetAuditLogs,
  },
}));

// Mock PostHog
vi.mock('../../src/posthog/client', () => ({
  captureError: mockCaptureError,
}));

import { logToolCall, getAuditLogs } from '../../src/audit/log';
import type { AuditEntry } from '../../src/audit/types';

describe('logToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls db.insertAuditLog with the provided entry', () => {
    const entry: AuditEntry = {
      atlassianAccountId: 'acc-123',
      toolName: 'test_tool',
      isError: false,
    };

    mockInsertAuditLog.mockResolvedValue(undefined);

    logToolCall(entry);

    expect(mockInsertAuditLog).toHaveBeenCalledWith(entry);
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('handles db errors gracefully (fire-and-forget)', async () => {
    const entry: AuditEntry = {
      atlassianAccountId: 'acc-123',
      toolName: 'test_tool',
      isError: true,
    };

    const dbError = new Error('DB Connection Failed');
    mockInsertAuditLog.mockRejectedValue(dbError);

    // logToolCall is void, but we need to wait for the promise to settle
    // Since logToolCall does not return the promise, we rely on the fact that
    // the catch block is attached synchronously. However, the catch block is async.
    // We can't await logToolCall directly.
    //
    // Best effort: call it, then wait a tick.
    logToolCall(entry);

    // Wait for microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockInsertAuditLog).toHaveBeenCalledWith(entry);
    expect(mockCaptureError).toHaveBeenCalledWith(dbError, {
      method: 'insertAuditLog',
    });
  });
});

describe('getAuditLogs', () => {
  it('delegates to db.getAuditLogs', async () => {
    const mockResult = { logs: [], total: 0, page: 1, pageSize: 50 };
    mockGetAuditLogs.mockResolvedValue(mockResult);

    const result = await getAuditLogs({ page: 2, pageSize: 10 });

    expect(mockGetAuditLogs).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
    expect(result).toBe(mockResult);
  });
});
