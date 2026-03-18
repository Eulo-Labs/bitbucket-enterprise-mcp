/**
 * Enterprise MCP Server on Bitbucket
 *
 * Main entry point that exports handlers for Forge web triggers.
 * - handleMcpRequest: MCP protocol handler (JSON-RPC over Streamable HTTP)
 * - handleAdminRequest: Admin panel resolver (GraphQL)
 * - runSqlMigrations: Database migration runner
 */
import { handleMcpRequest } from './mcp/handler';
import { handleAdminRequest } from './admin/resolver';
import { runSqlMigrations } from './db/migrations';

export { handleMcpRequest, handleAdminRequest, runSqlMigrations };
