/**
 * Admin Panel Resolver
 *
 * Forge Resolver for admin panel UI:
 * - getOAuthConfig: Get current OAuth configuration
 * - setOAuthConfig: Store OAuth client_id and secret
 * - deleteOAuthConfig: Remove OAuth configuration
 * - setWorkspace: Set Bitbucket workspace
 * - getWebTriggerUrl: Get the MCP endpoint URL
 * - getAuditLogs: Retrieve tool usage audit logs
 */

import Resolver from '@forge/resolver';
import { store } from '../kvs/service';
import api, { route, getAppContext, webTrigger } from '@forge/api';
import { KVS_PREFIX } from '../oauth/config';
import type { OAuthConfig } from '../oauth/types';
import { getAuditLogs } from '../audit/log';
import { db } from '../db/service';
import { validateWorkspace } from './validation';

let webTriggerUrlCache: string | null = null;

const resolver = new Resolver();

resolver.define('getAdminPageData', async (req) => {
  const ctx = req.context as Record<string, unknown> | undefined;
  const workspaceId = ctx?.workspaceId as string | undefined;

  // Fetch all KVS values in parallel
  const [config, toolsData, readOnlyData, cachedSlug] = await Promise.all([
    store.get(KVS_PREFIX.CONFIG) as Promise<OAuthConfig | null>,
    store.get(KVS_PREFIX.TOOLS_CONFIG) as Promise<Record<
      string,
      boolean
    > | null>,
    store.get(KVS_PREFIX.READ_ONLY_MODE) as Promise<boolean | null>,
    store.get('workspace') as Promise<string | null>,
  ]);

  // Cache web trigger URL in memory
  if (!webTriggerUrlCache) {
    webTriggerUrlCache = await webTrigger.getUrl('mcp-endpoint');
  }

  // Auto-save workspaceId from context (preserve existing behavior)
  if (workspaceId && !cachedSlug) {
    await store.set('workspace', workspaceId);
  }

  // Resolve workspace slug: use KVS cache, else fetch from Bitbucket
  let workspaceSlug = cachedSlug;
  if (!workspaceSlug && workspaceId) {
    try {
      const res = await api
        .asApp()
        .requestBitbucket(route`/2.0/workspaces/${workspaceId}`);
      if (res.ok) {
        const data = (await res.json()) as { slug?: string };
        workspaceSlug = data.slug ?? null;
        if (workspaceSlug) await store.set('workspace', workspaceSlug);
      }
    } catch {
      /* ignore */
    }
  }

  return {
    oauthConfig: config
      ? { configured: true, clientId: config.clientId }
      : { configured: false },
    webTriggerUrl: webTriggerUrlCache ?? '',
    toolsConfig: toolsData ?? {},
    readOnly: readOnlyData !== false,
    workspaceSlug: workspaceSlug ?? null,
  };
});

resolver.define('getOAuthConfig', async (req) => {
  // Auto-save workspace from Forge context (UUID works in Bitbucket API paths)
  const ctx = req.context as Record<string, unknown> | undefined;
  const workspaceId = ctx?.workspaceId as string | undefined;
  if (workspaceId) {
    await store.set('workspace', workspaceId);
  }

  const config = (await store.get(KVS_PREFIX.CONFIG)) as OAuthConfig | null;
  if (!config) return { configured: false };
  return {
    configured: true,
    clientId: config.clientId,
  };
});

resolver.define('setOAuthConfig', async (req) => {
  const payload = req.payload as Record<string, string>;
  const { clientId, clientSecret } = payload;

  if (!clientId) {
    return {
      success: false,
      error: 'clientId is required',
    };
  }

  const baseUrl = await webTrigger.getUrl('mcp-endpoint');

  if (!clientSecret) {
    const existingSecret = await store.getSecret('oauth-client-secret');
    if (!existingSecret) {
      return {
        success: false,
        error: 'clientSecret is required when no secret is configured',
      };
    }
  }

  // Store config (non-secret parts)
  const config: OAuthConfig = { clientId, baseUrl };
  await store.set(KVS_PREFIX.CONFIG, config);

  // Store secret separately when provided
  if (clientSecret) {
    await store.setSecret('oauth-client-secret', clientSecret);
  }

  return { success: true };
});

resolver.define('deleteOAuthConfig', async () => {
  await Promise.all([
    store.delete(KVS_PREFIX.CONFIG),
    store.deleteSecret('oauth-client-secret'),
  ]);
  return { success: true };
});

resolver.define('getWorkspaceSlug', async (req) => {
  const ctx = req.context as Record<string, unknown> | undefined;
  const workspaceId = ctx?.workspaceId as string | undefined;
  if (!workspaceId) return { slug: null };

  try {
    const res = await api
      .asApp()
      .requestBitbucket(route`/2.0/workspaces/${workspaceId}`);
    if (!res.ok) return { slug: null };
    const data = (await res.json()) as { slug?: string };
    const slug = data.slug ?? null;
    if (slug) await store.set('workspace', slug);
    return { slug };
  } catch {
    return { slug: null };
  }
});

resolver.define('setWorkspace', async (req) => {
  const payload = req.payload as Record<string, string>;
  const { workspace } = payload;

  const error = validateWorkspace(workspace);
  if (error) {
    return { success: false, error };
  }

  await store.set('workspace', workspace);
  return { success: true };
});

resolver.define('getWebTriggerUrl', async () => {
  const url = await webTrigger.getUrl('mcp-endpoint');
  return { url };
});

resolver.define('getAuditLogs', async (req) => {
  const payload = req.payload as Record<string, unknown>;
  const page = Number(payload.page);
  const pageSize = Number(payload.pageSize);
  return await getAuditLogs({ page, pageSize });
});

resolver.define('exportAuditLogs', async () => {
  return await db.getAllAuditLogs();
});

resolver.define('getToolsConfig', async () => {
  const tools = (await store.get(KVS_PREFIX.TOOLS_CONFIG)) as Record<
    string,
    boolean
  > | null;
  return { tools: tools ?? {} };
});

resolver.define('setToolsConfig', async (req) => {
  const payload = req.payload as Record<string, unknown>;
  const tools = payload.tools as Record<string, boolean>;
  await store.set(KVS_PREFIX.TOOLS_CONFIG, tools);
  return { success: true };
});

resolver.define('getReadOnlyMode', async () => {
  const readOnly = (await store.get(KVS_PREFIX.READ_ONLY_MODE)) as
    | boolean
    | null;
  return { readOnly: readOnly !== false };
});

resolver.define('setReadOnlyMode', async (req) => {
  const payload = req.payload as Record<string, unknown>;
  const readOnly = payload.readOnly === true;
  await store.set(KVS_PREFIX.READ_ONLY_MODE, readOnly);

  // When enabling read-only, bulk-disable write tools
  if (readOnly) {
    const { WRITE_TOOL_IDS } = await import('../tools/write-tools');
    const currentTools = ((await store.get(KVS_PREFIX.TOOLS_CONFIG)) ??
      {}) as Record<string, boolean>;
    const updated = { ...currentTools };
    for (const id of WRITE_TOOL_IDS) {
      updated[id] = false;
    }
    await store.set(KVS_PREFIX.TOOLS_CONFIG, updated);
  }

  return { success: true };
});

resolver.define('getEnvironment', () => {
  const { environmentType } = getAppContext();
  return { environmentType };
});

export const handleAdminRequest = resolver.getDefinitions();
