import sql, { migrationRunner } from '@forge/sql';
import type {
  AuditEntry,
  AuditLogRowWithUser,
  AuditLogPage,
  UserRow,
} from '../audit/types';

const TABLE_NAME = 'audit_log';

async function ensureTable(): Promise<void> {}

async function upsertUser(u: {
  account_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
}): Promise<void> {
  await sql
    .prepare(
      `INSERT INTO users (account_id, display_name, email, avatar_url, fetched_at) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), email=COALESCE(VALUES(email),email), avatar_url=COALESCE(VALUES(avatar_url),avatar_url), fetched_at=VALUES(fetched_at)`,
    )
    .bindParams(
      u.account_id,
      u.display_name,
      u.email ?? null,
      u.avatar_url ?? null,
      new Date().toISOString(),
    )
    .execute();
}

async function getUserById(accountId: string): Promise<UserRow | null> {
  const r = await sql
    .prepare(`SELECT * FROM users WHERE account_id = ?`)
    .bindParams(accountId)
    .execute();
  return (r.rows as UserRow[])[0] ?? null;
}

async function insertAuditLog(entry: AuditEntry): Promise<void> {
  await ensureTable();

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await sql
    .prepare(
      `INSERT INTO ${TABLE_NAME} (id, timestamp, atlassian_account_id, tool_name, workspace, repo_slug, is_error, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bindParams(
      id,
      timestamp,
      entry.atlassianAccountId,
      entry.toolName,
      entry.workspace ?? '',
      entry.repoSlug ?? '',
      entry.isError ? 1 : 0,
      entry.details != null ? JSON.stringify(entry.details) : null,
    )
    .execute();
}

async function getAuditLogs({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): Promise<AuditLogPage> {
  await ensureTable();

  const safePageSize = normalizePositiveInt(pageSize, 50, 100);
  const safePage = normalizePositiveInt(page, 1, 100000);
  const offset = (safePage - 1) * safePageSize;
  const limit = safePageSize;

  const [rowsResult, countResult] = await Promise.all([
    sql
      .prepare(
        `SELECT a.*, u.display_name AS user_display_name, u.email AS user_email, u.avatar_url AS user_avatar_url
         FROM ${TABLE_NAME} a LEFT JOIN users u ON a.atlassian_account_id = u.account_id
         ORDER BY a.timestamp DESC LIMIT ${limit} OFFSET ${offset}`,
      )
      .execute(),
    sql.prepare(`SELECT COUNT(*) as cnt FROM ${TABLE_NAME}`).execute(),
  ]);

  const logs: AuditLogRowWithUser[] = (
    rowsResult.rows as AuditLogRowWithUser[]
  ).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    atlassian_account_id: row.atlassian_account_id,
    display_name: row.display_name || null,
    tool_name: row.tool_name,
    workspace: row.workspace || null,
    repo_slug: row.repo_slug || null,
    is_error: row.is_error,
    details: row.details || null,
    user_display_name: row.user_display_name ?? null,
    user_email: row.user_email ?? null,
    user_avatar_url: row.user_avatar_url ?? null,
  }));

  const total = (countResult.rows as { cnt: number }[])[0].cnt;

  return { logs, total, page: safePage, pageSize: safePageSize };
}

function normalizePositiveInt(
  value: number,
  fallback: number,
  max: number,
): number {
  const numeric = Number.isFinite(value) ? Math.floor(value) : fallback;
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(numeric, max);
}

async function getAllAuditLogs(limit = 10000): Promise<AuditLogRowWithUser[]> {
  await ensureTable();

  const result = await sql
    .prepare(
      `SELECT a.*, u.display_name AS user_display_name, u.email AS user_email, u.avatar_url AS user_avatar_url
       FROM ${TABLE_NAME} a LEFT JOIN users u ON a.atlassian_account_id = u.account_id
       ORDER BY a.timestamp DESC LIMIT ${limit}`,
    )
    .execute();

  return (result.rows as AuditLogRowWithUser[]).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    atlassian_account_id: row.atlassian_account_id,
    display_name: row.display_name || null,
    tool_name: row.tool_name,
    workspace: row.workspace || null,
    repo_slug: row.repo_slug || null,
    is_error: row.is_error,
    details: row.details || null,
    user_display_name: row.user_display_name ?? null,
    user_email: row.user_email ?? null,
    user_avatar_url: row.user_avatar_url ?? null,
  }));
}

export const db = {
  insertAuditLog,
  getAuditLogs,
  getAllAuditLogs,
  upsertUser,
  getUserById,
  migrationRunner,
};
