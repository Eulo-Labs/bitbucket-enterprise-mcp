const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');
// In dev mode on localhost outside Forge iframe, use mock bridge automatically.
const isStandalone = import.meta.env.DEV && !isInIframe && isLocalhost;

const MOCK_TOOLS_CONFIG: Record<string, boolean> = {
  list_repositories: true,
  get_repository: true,
  list_pull_requests: true,
  list_workspace_pull_requests: true,
  get_pull_request: true,
  get_pull_request_diff: true,
  list_pull_request_comments: true,
  list_pipelines: true,
  list_pipeline_steps: true,
  get_pipeline_step_log: true,
  get_file_content: true,
  list_directory: true,
  list_branches: true,
  create_pull_request: true,
  create_pull_request_comment: true,
  approve_pull_request: true,
  unapprove_pull_request: true,
  merge_pull_request: true,
  trigger_pipeline: true,
};

export const invoke = async <T>(
  functionKey: string,
  payload?: unknown,
): Promise<T> => {
  if (isStandalone) {
    console.warn(`[Bridge Mock] invoke called: ${functionKey}`, payload);
    if (functionKey === 'getEnvironment') {
      return { environmentType: 'DEVELOPMENT' } as T;
    }
    if (functionKey === 'getAdminPageData') {
      return {
        oauthConfig: { configured: false },
        webTriggerUrl: 'https://example.atlassian-dev.net/x1/mock-trigger',
        toolsConfig: MOCK_TOOLS_CONFIG,
        readOnly: false,
        workspaceSlug: 'mock-workspace',
      } as T;
    }
    if (functionKey === 'getOAuthConfig') {
      return { configured: false } as T;
    }
    if (functionKey === 'getWebTriggerUrl') {
      return { url: 'https://example.atlassian-dev.net/x1/mock-trigger' } as T;
    }
    if (functionKey === 'getAuditLogs') {
      return { logs: [], total: 0, page: 1, pageSize: 50 } as T;
    }
    if (functionKey === 'getToolsConfig') {
      return { tools: MOCK_TOOLS_CONFIG } as T;
    }
    if (functionKey === 'getReadOnlyMode') {
      return { readOnly: false } as T;
    }
    if (functionKey === 'setReadOnlyMode') {
      return { success: true } as T;
    }
    if (functionKey === 'setOAuthConfig') {
      return { success: true } as T;
    }
    if (functionKey === 'getWorkspaceSlug') {
      return { slug: 'mock-workspace' } as T;
    }
    return {} as T;
  }
  const { invoke: forgeInvoke } = await import('@forge/bridge');
  return forgeInvoke<T>(functionKey, payload);
};

export const view = {
  theme: {
    enable: async () => {
      if (isStandalone) {
        document.documentElement.setAttribute('data-color-mode', 'light');
        document.documentElement.setAttribute('data-theme', 'light:light');
        return;
      }
      const { view: forgeView } = await import('@forge/bridge');
      return forgeView.theme.enable();
    },
  },
};

export const isMockBridgeEnabled = isStandalone;

export const openExternalUrl = async (url: string): Promise<void> => {
  if (isStandalone) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const { router } = await import('@forge/bridge');
  router.open(url);
};
