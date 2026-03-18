import React, { useEffect, useMemo, useState } from 'react';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import { invoke, getContext, isMockBridgeEnabled } from './bridge';
import { captureEvent } from './posthog';
import AuditLogTab from './AuditLogTab';
import SettingsTab from './SettingsTab';
import ToolsTab from './ToolsTab';
import { WRITE_TOOL_IDS } from '../../src/tools/write-tools';

type OAuthConfigResponse = {
  configured: boolean;
  clientId?: string;
};

type WebTriggerUrlResponse = {
  url: string;
};

type SaveResponse = {
  success: boolean;
  error?: string;
};

type ToolsConfigResponse = {
  tools: Record<string, boolean>;
};

type ReadOnlyResponse = {
  readOnly: boolean;
};

const MAX_CLIENT_ID_LENGTH = 128;
const MAX_CLIENT_SECRET_LENGTH = 256;
const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateClientId(value: string): string | undefined {
  if (value.length > MAX_CLIENT_ID_LENGTH) {
    return `Client ID must be ${MAX_CLIENT_ID_LENGTH} characters or less`;
  }
  if (value && !CLIENT_ID_PATTERN.test(value)) {
    return 'Client ID can only contain alphanumeric characters, underscores, and hyphens';
  }
  return undefined;
}

function validateClientSecret(value: string): string | undefined {
  if (value.length > MAX_CLIENT_SECRET_LENGTH) {
    return `Client Secret must be ${MAX_CLIENT_SECRET_LENGTH} characters or less`;
  }
  return undefined;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [clientId, setClientId] = useState('');
  const [savedClientId, setSavedClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretIsEditing, setSecretIsEditing] = useState(false);
  const [webTriggerUrl, setWebTriggerUrl] = useState('');
  const [toolsConfig, setToolsConfig] = useState<Record<string, boolean>>({});
  const [readOnly, setReadOnly] = useState(true);
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [clientIdError, setClientIdError] = useState<string | undefined>();
  const [clientSecretError, setClientSecretError] = useState<
    string | undefined
  >();

  const callbackUrl = useMemo(
    () => (webTriggerUrl ? `${webTriggerUrl.replace(/\/$/, '')}/callback` : ''),
    [webTriggerUrl],
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [configData, urlData, , toolsData, readOnlyData, slugData] =
          await Promise.all([
            invoke<OAuthConfigResponse>('getOAuthConfig').catch((err) => {
              console.warn('[admin] getOAuthConfig failed:', err);
              setConnectionError(
                err instanceof Error
                  ? err.message
                  : 'Failed to fetch configuration',
              );
              return null;
            }),
            invoke<WebTriggerUrlResponse>('getWebTriggerUrl').catch((err) => {
              console.warn('[admin] getWebTriggerUrl failed:', err);
              setConnectionError(
                err instanceof Error
                  ? err.message
                  : 'Failed to fetch configuration',
              );
              return null;
            }),
            getContext().catch((err) => {
              console.warn('[admin] getContext failed:', err);
              return {};
            }),
            invoke<ToolsConfigResponse>('getToolsConfig').catch((err) => {
              console.warn('[admin] getToolsConfig failed:', err);
              return { tools: {} };
            }),
            invoke<ReadOnlyResponse>('getReadOnlyMode').catch((err) => {
              console.warn('[admin] getReadOnlyMode failed:', err);
              return { readOnly: true };
            }),
            invoke<{ slug: string | null }>('getWorkspaceSlug').catch(() => ({
              slug: null,
            })),
          ] as const);
        if (!isMounted) return;
        if (configData) {
          setConfigured(Boolean(configData.configured));
          if (configData.clientId) {
            setClientId(configData.clientId);
            setSavedClientId(configData.clientId);
          }
        }
        if (urlData?.url) setWebTriggerUrl(urlData.url);
        if (toolsData?.tools) setToolsConfig(toolsData.tools);
        if (readOnlyData) setReadOnly(readOnlyData.readOnly);
        if (slugData?.slug) setWorkspaceSlug(slugData.slug);
      } catch {
        if (!isMounted) return;
        setMessage({
          type: 'error',
          text: 'Failed to load configuration.',
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleReadOnlyChange = async (newReadOnly: boolean) => {
    setReadOnly(newReadOnly);
    captureEvent('admin_read_only_toggled', { readOnly: newReadOnly });
    try {
      await invoke('setReadOnlyMode', { readOnly: newReadOnly });
      if (newReadOnly) {
        // Disable write tools in local state
        const updated = { ...toolsConfig };
        for (const id of WRITE_TOOL_IDS) {
          updated[id] = false;
        }
        setToolsConfig(updated);
      }
    } catch (err) {
      console.error('[admin] setReadOnlyMode failed:', err);
      setReadOnly(!newReadOnly);
      setMessage({
        type: 'error',
        text: 'Failed to save read-only setting. Please try again.',
      });
    }
  };

  const isDirty = clientId !== savedClientId || clientSecret.trim() !== '';

  const handleSecretEditStart = () => {
    setSecretIsEditing(true);
    setClientSecret('');
  };

  const handleSecretEditCancel = () => {
    setSecretIsEditing(false);
    setClientSecret('');
    setClientSecretError(undefined);
  };

  const handleClientIdChange = (value: string) => {
    setClientId(value);
    setClientIdError(validateClientId(value));
  };

  const handleClientSecretChange = (value: string) => {
    setClientSecret(value);
    setClientSecretError(validateClientSecret(value));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setMessage(null);

    const idError = validateClientId(clientId);
    const secretError = validateClientSecret(clientSecret);
    setClientIdError(idError);
    setClientSecretError(secretError);

    if (idError || secretError) {
      return;
    }

    if (!clientId.trim()) {
      setMessage({
        type: 'error',
        text: 'Client ID is required.',
      });
      return;
    }

    if (!configured && !clientSecret.trim()) {
      setMessage({
        type: 'error',
        text: 'Client Secret is required on first configuration.',
      });
      return;
    }

    const payload: Record<string, string> = {
      clientId: clientId.trim(),
    };
    if (clientSecret.trim()) {
      payload.clientSecret = clientSecret.trim();
    }

    try {
      const response = await invoke<SaveResponse>('setOAuthConfig', payload);
      if (response?.success) {
        setConfigured(true);
        setClientSecret('');
        setSecretIsEditing(false);
        setSavedClientId(clientId.trim());
        setMessage({
          type: 'success',
          text: 'Configuration saved.',
        });
      } else {
        setMessage({
          type: 'error',
          text: response?.error || 'Failed to save configuration.',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setMessage({ type: 'error', text: msg });
    }
  };

  return (
    <div style={{ color: 'var(--ds-text)', padding: 0 }}>
      <div style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
        <Tabs
          id="admin-tabs"
          onChange={(index) => {
            const tabNames = ['settings', 'tools', 'audit_log'];
            captureEvent('admin_tab_selected', { tab: tabNames[index] });
          }}
        >
          <TabList>
            <Tab>
              <span style={{ fontWeight: 500 }}>Settings</span>
            </Tab>
            <Tab>
              <span style={{ fontWeight: 500 }}>Tools</span>
            </Tab>
            <Tab>
              <span style={{ fontWeight: 500 }}>Audit Log</span>
            </Tab>
          </TabList>
          <TabPanel>
            <SettingsTab
              isLoading={isLoading}
              configured={configured}
              clientId={clientId}
              clientSecret={clientSecret}
              secretIsEditing={secretIsEditing}
              onSecretEditStart={handleSecretEditStart}
              onSecretEditCancel={handleSecretEditCancel}
              isDirty={isDirty}
              webTriggerUrl={webTriggerUrl}
              callbackUrl={callbackUrl}
              message={message}
              connectionError={connectionError}
              isMockBridgeEnabled={isMockBridgeEnabled}
              onSubmit={handleSubmit}
              onClientIdChange={handleClientIdChange}
              onClientSecretChange={handleClientSecretChange}
              clientIdError={clientIdError}
              clientSecretError={clientSecretError}
              readOnly={readOnly}
              onReadOnlyChange={handleReadOnlyChange}
              workspaceSlug={workspaceSlug}
            />
          </TabPanel>
          <TabPanel>
            <ToolsTab
              toolsConfig={toolsConfig}
              onToolsConfigChange={setToolsConfig}
              readOnly={readOnly}
            />
          </TabPanel>
          <TabPanel>
            <AuditLogTab />
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
