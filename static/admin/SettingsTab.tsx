import React, { useState } from 'react';
import { openExternalUrl } from './bridge';
import Button from '@atlaskit/button/new';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';
import Textfield from '@atlaskit/textfield';
import Toggle from '@atlaskit/toggle';

type SettingsTabProps = {
  isLoading: boolean;
  configured: boolean;
  clientId: string;
  clientSecret: string;
  secretIsEditing: boolean;
  onSecretEditStart: () => void;
  onSecretEditCancel: () => void;
  isDirty: boolean;
  webTriggerUrl: string;
  callbackUrl: string;
  message: { type: 'error' | 'success'; text: string } | null;
  connectionError: string | null;
  isMockBridgeEnabled: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onClientIdChange: (value: string) => void;
  onClientSecretChange: (value: string) => void;
  clientIdError?: string;
  clientSecretError?: string;
  readOnly: boolean;
  onReadOnlyChange: (readOnly: boolean) => void;
  workspaceSlug?: string;
};

const MAX_CLIENT_ID_LENGTH = 128;
const MAX_CLIENT_SECRET_LENGTH = 256;

const card: React.CSSProperties = {
  padding: 20,
  marginBottom: 20,
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontWeight: 600,
  color: 'var(--ds-text)',
};

const info: React.CSSProperties = {
  color: 'var(--ds-text-subtle)',
  fontSize: 14,
  marginTop: 8,
};

const fieldError: React.CSSProperties = {
  color: 'var(--ds-text-danger)',
  fontSize: 14,
  marginBottom: 8,
};

function EndpointField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 4,
        background: 'var(--ds-background-neutral)',
        border: '1px solid var(--ds-border)',
        fontFamily: 'monospace',
        fontSize: 13,
        color: 'var(--ds-text-subtle)',
        wordBreak: 'break-all',
      }}
    >
      <span style={{ flex: 1 }}>{value}</span>
      <button
        onClick={handleCopy}
        title="Copy to clipboard"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          color: copied ? 'var(--ds-text-success)' : 'var(--ds-text-subtle)',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        {copied ? '✓' : '⧉'}
      </button>
    </div>
  );
}

export default function SettingsTab({
  isLoading,
  configured,
  clientId,
  clientSecret,
  secretIsEditing,
  onSecretEditStart,
  onSecretEditCancel,
  isDirty,
  webTriggerUrl,
  callbackUrl,
  message,
  connectionError,
  isMockBridgeEnabled,
  onSubmit,
  onClientIdChange,
  onClientSecretChange,
  clientIdError,
  clientSecretError,
  readOnly,
  onReadOnlyChange,
  workspaceSlug,
}: SettingsTabProps) {
  const secretIsLocked = configured && !secretIsEditing;
  return (
    <>
      {isMockBridgeEnabled && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage
            appearance="warning"
            title="Dev mode — mock bridge active"
          >
            <p>Running locally. Changes are not persisted to Forge KVS.</p>
          </SectionMessage>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={card}>
          <h2
            style={{
              marginTop: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            OAuth Configuration
            {!isLoading && !connectionError && (
              <Lozenge appearance={configured ? 'success' : 'removed'}>
                {configured ? 'Configured' : 'Not configured'}
              </Lozenge>
            )}
            {isLoading && <Spinner size="small" />}
            {!isLoading && connectionError && (
              <Lozenge appearance="removed">Error</Lozenge>
            )}
          </h2>
          {connectionError && (
            <div style={{ marginBottom: 16 }}>
              <SectionMessage appearance="error">
                <p>Error: {connectionError}</p>
              </SectionMessage>
            </div>
          )}
          <p style={info}>
            Create a Bitbucket OAuth consumer in{' '}
            {workspaceSlug ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openExternalUrl(
                    `https://bitbucket.org/${workspaceSlug}/workspace/settings/api`,
                  );
                }}
              >
                Workspace Settings
              </a>
            ) : (
              'Workspace Settings'
            )}
            . Copy the Client ID and Secret into the form below and Save.
          </p>

          {message && (
            <div style={{ marginBottom: 16 }}>
              <SectionMessage
                appearance={message.type === 'success' ? 'success' : 'error'}
              >
                <p>{message.text}</p>
              </SectionMessage>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="clientId" style={fieldLabel}>
                Client ID
              </label>
              <Textfield
                id="clientId"
                name="clientId"
                value={clientId}
                onChange={(e) =>
                  onClientIdChange((e.target as HTMLInputElement).value)
                }
                placeholder="e.g., abc123..."
                maxLength={MAX_CLIENT_ID_LENGTH}
                isInvalid={Boolean(clientIdError)}
              />
              {clientIdError && <div style={fieldError}>{clientIdError}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Client Secret</label>
              {secretIsLocked ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 4,
                    background: 'var(--ds-background-neutral)',
                    border: '1px solid var(--ds-border)',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: 'var(--ds-text-subtle)',
                  }}
                >
                  <span style={{ flex: 1 }}>••••••••••••••••</span>
                  <Lozenge appearance="success">Set</Lozenge>
                  <button
                    type="button"
                    onClick={onSecretEditStart}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      color: 'var(--ds-link)',
                      fontSize: 13,
                      textDecoration: 'underline',
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Textfield
                    id="clientSecret"
                    name="clientSecret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) =>
                      onClientSecretChange((e.target as HTMLInputElement).value)
                    }
                    placeholder={
                      secretIsEditing
                        ? 'Enter new secret'
                        : 'Your OAuth client secret'
                    }
                    maxLength={MAX_CLIENT_SECRET_LENGTH}
                    isInvalid={Boolean(clientSecretError)}
                    autoFocus={secretIsEditing}
                  />
                  {secretIsEditing && (
                    <button
                      type="button"
                      onClick={onSecretEditCancel}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 0',
                        color: 'var(--ds-text-subtle)',
                        fontSize: 13,
                        textDecoration: 'underline',
                      }}
                    >
                      Cancel — keep existing secret
                    </button>
                  )}
                  {clientSecretError && (
                    <div style={fieldError}>{clientSecretError}</div>
                  )}
                </>
              )}
            </div>

            <Button type="submit" appearance="primary" isDisabled={!isDirty}>
              Save Configuration
            </Button>
          </form>
        </div>

        <div style={card}>
          <h2 style={{ marginTop: 0 }}>Read Only Mode</h2>
          <p style={info}>
            When enabled, all write operations (create PR, merge, approve,
            trigger pipeline) are disabled. AI agents will only have access to
            read-only tools.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 12,
            }}
          >
            <Toggle
              id="read-only-toggle"
              isChecked={readOnly}
              onChange={() => onReadOnlyChange(!readOnly)}
              size="large"
            />
            <span
              style={{
                fontWeight: 600,
                color: readOnly
                  ? 'var(--ds-text-warning)'
                  : 'var(--ds-text-subtle)',
              }}
            >
              {readOnly ? 'Read Only Mode is ON' : 'Read Only Mode is OFF'}
            </span>
          </div>
        </div>

        {webTriggerUrl && (
          <div style={{ ...card, gridColumn: '1 / -1' }}>
            <h2 style={{ marginTop: 0 }}>Endpoints</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>MCP Endpoint URL</label>
              <EndpointField value={webTriggerUrl} />
            </div>
            <div>
              <label style={fieldLabel}>OAuth Callback URL</label>
              <EndpointField value={callbackUrl} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
