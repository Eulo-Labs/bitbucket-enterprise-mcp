import React, { useEffect, useState } from 'react';
import Button from '@atlaskit/button/new';
import Lozenge from '@atlaskit/lozenge';
import Spinner from '@atlaskit/spinner';
import { invoke } from './bridge';
import type { AuditLogPage, AuditLogRowWithUser } from '../../src/audit/types';
import { formatTimestamp } from './datetime';

const styles: Record<string, React.CSSProperties> = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid var(--ds-border)',
    color: 'var(--ds-text-subtle)',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--ds-border)',
    color: 'var(--ds-text)',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    fontSize: 14,
    color: 'var(--ds-text-subtle)',
  },
  empty: {
    textAlign: 'center' as const,
    padding: 40,
    color: 'var(--ds-text-subtle)',
    fontSize: 14,
  },
  error: {
    textAlign: 'center' as const,
    padding: 40,
    color: 'var(--ds-text-danger)',
    fontSize: 14,
  },
  card: {
    background: 'var(--ds-surface)',
    borderRadius: 8,
    marginBottom: 20,
    boxShadow: 'var(--ds-shadow-raised)',
    width: '100%',
    boxSizing: 'border-box',
  },
};

function UserAvatar({ row }: { row: AuditLogRowWithUser }) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayName =
    row.user_display_name ?? row.display_name ?? row.atlassian_account_id;
  const initial = displayName.charAt(0).toUpperCase();
  const avatarUrl = row.user_avatar_url;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{ flexShrink: 0, position: 'relative', width: 28, height: 28 }}
      >
        {avatarUrl && !imgFailed ? (
          <img
            src={avatarUrl}
            alt={displayName}
            width={28}
            height={28}
            style={{ borderRadius: '50%', display: 'block' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--ds-background-neutral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--ds-text-subtle)',
            }}
          >
            {initial}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ds-text-subtle)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.user_email ?? (
            <span style={{ fontFamily: 'monospace' }}>
              {row.atlassian_account_id}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface AuditLogDetailProps {
  row: AuditLogRowWithUser;
  onClose: () => void;
}

function AuditLogDetail({ row, onClose }: AuditLogDetailProps) {
  const displayName =
    row.user_display_name ?? row.display_name ?? row.atlassian_account_id;
  const fields: { label: string; value: string }[] = [
    { label: 'ID', value: String(row.id) },
    { label: 'TIME', value: row.timestamp },
    { label: 'USER', value: displayName },
    { label: 'EMAIL', value: row.user_email ?? '—' },
    { label: 'TOOL', value: row.tool_name },
    { label: 'WORKSPACE', value: row.workspace || '—' },
    { label: 'REPOSITORY', value: row.repo_slug || '—' },
    { label: 'STATUS', value: row.is_error ? 'Error' : 'OK' },
  ];

  let detailsJson: string | null = null;
  if (row.details) {
    try {
      detailsJson = JSON.stringify(JSON.parse(row.details), null, 2);
    } catch {
      detailsJson = row.details;
    }
  }

  return (
    <div
      style={{
        width: 400,
        minWidth: 320,
        borderLeft: '1px solid var(--ds-border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        background: 'var(--ds-surface)',
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '2px solid var(--ds-border)',
          position: 'sticky',
          top: 0,
          background: 'var(--ds-surface)',
          zIndex: 1,
        }}
      >
        <span
          style={{ fontWeight: 700, fontSize: 14, color: 'var(--ds-text)' }}
        >
          Event Detail
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--ds-text-subtle)',
            lineHeight: 1,
            padding: '0 4px',
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Field rows */}
      {fields.map(({ label, value }, i) => (
        <React.Fragment key={label}>
          <div
            style={{
              padding: '6px 16px',
              background: 'var(--ds-background-neutral)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ds-text-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {label}
          </div>
          <div
            style={{
              padding: '8px 16px',
              fontSize: 13,
              color: 'var(--ds-text)',
              borderBottom:
                i < fields.length - 1
                  ? '1px solid var(--ds-border)'
                  : undefined,
              wordBreak: 'break-word',
            }}
          >
            {label === 'STATUS' ? (
              <Lozenge appearance={row.is_error ? 'removed' : 'success'}>
                {value}
              </Lozenge>
            ) : label === 'TIME' ? (
              (() => {
                const f = formatTimestamp(value);
                return (
                  <>
                    <div>{f.date}</div>
                    <div
                      style={{ color: 'var(--ds-text-subtle)', fontSize: 12 }}
                    >
                      {f.time}
                    </div>
                  </>
                );
              })()
            ) : (
              value
            )}
          </div>
        </React.Fragment>
      ))}

      {/* Details section */}
      {detailsJson && (
        <>
          <div
            style={{
              padding: '6px 16px',
              background: 'var(--ds-background-neutral)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ds-text-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginTop: 8,
            }}
          >
            DETAILS
          </div>
          <div style={{ padding: '8px 16px' }}>
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--ds-text)',
                background: 'var(--ds-background-neutral)',
                borderRadius: 4,
                padding: '10px 12px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {detailsJson}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function rowsToCsv(rows: AuditLogRowWithUser[]): string {
  const headers = [
    'id',
    'timestamp',
    'user_id',
    'display_name',
    'email',
    'tool',
    'workspace',
    'repository',
    'status',
    'details',
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.timestamp,
        r.atlassian_account_id,
        r.user_display_name ?? r.display_name ?? '',
        r.user_email ?? '',
        r.tool_name,
        r.workspace ?? '',
        r.repo_slug ?? '',
        r.is_error ? 'Error' : 'OK',
        r.details ?? '',
      ]
        .map(escape)
        .join(','),
    ),
  ];
  return lines.join('\n');
}

export default function AuditLogTab() {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AuditLogRowWithUser | null>(
    null,
  );
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    invoke<AuditLogRowWithUser[]>('exportAuditLogs')
      .then((rows) => {
        const csv = rowsToCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => console.error('Export failed', err))
      .finally(() => setIsExporting(false));
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setSelectedRow(null);
    invoke<AuditLogPage>('getAuditLogs', { page, pageSize: 50 })
      .then(setData)
      .catch((err) => {
        console.error(err);
        setData(null);
        setError('Error getting audit logs.');
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '20px 20px 0',
          borderBottom: '1px solid var(--ds-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Audit Log</h2>
        <Button
          appearance="default"
          onClick={handleExport}
          isDisabled={isExporting}
        >
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Table panel */}
        <div
          style={{
            flex: selectedRow ? '1 1 65%' : '1 1 100%',
            padding: 20,
            minWidth: 0,
            overflowX: 'auto',
          }}
        >
          {isLoading ? (
            <div
              style={{ display: 'flex', justifyContent: 'center', padding: 40 }}
            >
              <Spinner size="medium" />
            </div>
          ) : error ? (
            <div style={styles.error}>{error}</div>
          ) : !data || data.logs.length === 0 ? (
            <div style={styles.empty}>No audit logs yet</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Actor</th>
                    <th style={styles.th}>Tool</th>
                    <th style={styles.th}>Repository</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() =>
                        setSelectedRow(selectedRow?.id === row.id ? null : row)
                      }
                      onMouseEnter={() => setHoveredRow(row.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        cursor: 'pointer',
                        background:
                          selectedRow?.id === row.id
                            ? 'var(--ds-background-selected)'
                            : hoveredRow === row.id
                              ? 'var(--ds-background-neutral)'
                              : 'transparent',
                      }}
                    >
                      <td style={styles.td}>
                        {(() => {
                          const f = formatTimestamp(row.timestamp);
                          return (
                            <>
                              <div>{f.date}</div>
                              <div
                                style={{
                                  color: 'var(--ds-text-subtle)',
                                  fontSize: 12,
                                }}
                              >
                                {f.time}
                              </div>
                            </>
                          );
                        })()}
                      </td>
                      <td style={styles.td}>
                        <UserAvatar row={row} />
                      </td>
                      <td style={styles.td}>{row.tool_name}</td>
                      <td style={styles.td}>{row.repo_slug || '—'}</td>
                      <td style={styles.td}>
                        <Lozenge
                          appearance={row.is_error ? 'removed' : 'success'}
                        >
                          {row.is_error ? 'Error' : 'OK'}
                        </Lozenge>
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          textAlign: 'center',
                          padding: '10px 4px',
                          color: 'var(--ds-text-subtle)',
                          fontSize: 16,
                          userSelect: 'none',
                        }}
                      >
                        {selectedRow?.id === row.id ? '▾' : '›'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={styles.pagination}>
                <Button
                  appearance="subtle"
                  isDisabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  appearance="subtle"
                  isDisabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Detail sidebar */}
        {selectedRow && (
          <AuditLogDetail
            row={selectedRow}
            onClose={() => setSelectedRow(null)}
          />
        )}
      </div>
    </div>
  );
}
