/**
 * Database Migrations
 *
 * Forge SQL migrations for the app database.
 */

import { migrationRunner } from '@forge/sql';

const createDbObjects = migrationRunner
  .enqueue(
    'v001_create_audit_log_table',
    `CREATE TABLE IF NOT EXISTS audit_log (
      id CHAR(36) PRIMARY KEY,
      timestamp VARCHAR(32) NOT NULL,
      atlassian_account_id VARCHAR(128) NOT NULL,
      tool_name VARCHAR(128) NOT NULL,
      workspace VARCHAR(255),
      repo_slug VARCHAR(255),
      is_error TINYINT NOT NULL DEFAULT 0,
      display_name VARCHAR(256),
      details TEXT
    )`,
  )
  .enqueue(
    'v002_create_audit_log_timestamp_index',
    `CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC)`,
  )
  .enqueue(
    'v003_create_audit_log_account_index',
    `CREATE INDEX IF NOT EXISTS idx_audit_log_account ON audit_log (atlassian_account_id)`,
  )
  .enqueue(
    'v004_create_audit_log_account_timestamp_index',
    `CREATE INDEX IF NOT EXISTS idx_audit_log_account_timestamp
     ON audit_log (atlassian_account_id, timestamp DESC)`,
  )
  .enqueue(
    'v005_create_users_table',
    `CREATE TABLE IF NOT EXISTS users (
      account_id   VARCHAR(128) PRIMARY KEY,
      display_name VARCHAR(256),
      email        VARCHAR(320),
      avatar_url   VARCHAR(1024),
      fetched_at   VARCHAR(32) NOT NULL
    )`,
  );

async function applySqlMigrations(): Promise<boolean> {
  try {
    const executedMigrations = await createDbObjects.run();
    console.log('SQL migrations completed', { executedMigrations });
    return true;
  } catch (error) {
    const err = error as {
      migrationName?: string;
      migrationsYetToRun?: string[];
      code?: string;
      cause?: {
        code?: string;
        responseDetails?: unknown;
        context?: { debug?: unknown; queryType?: string };
      };
    };
    console.error('SQL migrations failed', {
      migrationName: err?.migrationName,
      migrationsYetToRun: err?.migrationsYetToRun,
      code: err?.code,
      causeCode: err?.cause?.code,
      responseDetails: err?.cause?.responseDetails,
      queryType: err?.cause?.context?.queryType,
      debug: err?.cause?.context?.debug,
    });
    return false;
  }
}

export async function runSqlMigrations(): Promise<void> {
  await applySqlMigrations();
}
