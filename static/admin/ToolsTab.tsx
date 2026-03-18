import React from 'react';
import Button from '@atlaskit/button';
import { Checkbox } from '@atlaskit/checkbox';
import Lozenge from '@atlaskit/lozenge';
import Tooltip from '@atlaskit/tooltip';
import SectionMessage from '@atlaskit/section-message';
import { invoke } from './bridge';
import { captureEvent } from './posthog';
import { WRITE_TOOL_IDS } from '../../src/tools/write-tools';

type ToolCategory = {
  category: string;
  tools: { id: string; label: string }[];
};

type ToolsTabProps = {
  toolsConfig: Record<string, boolean>;
  onToolsConfigChange: (config: Record<string, boolean>) => void;
  readOnly: boolean;
};

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    category: 'Repositories',
    tools: [
      { id: 'list_repositories', label: 'List Repositories' },
      { id: 'get_repository', label: 'Get Repository' },
    ],
  },
  {
    category: 'Pull Requests',
    tools: [
      { id: 'list_pull_requests', label: 'List Pull Requests' },
      { id: 'list_workspace_pull_requests', label: 'List Workspace PRs' },
      { id: 'get_pull_request', label: 'Get Pull Request' },
      { id: 'get_pull_request_diff', label: 'Get PR Diff' },
      { id: 'list_pull_request_comments', label: 'List PR Comments' },
      { id: 'create_pull_request', label: 'Create Pull Request' },
      { id: 'create_pull_request_comment', label: 'Create PR Comment' },
      { id: 'approve_pull_request', label: 'Approve PR' },
      { id: 'unapprove_pull_request', label: 'Unapprove PR' },
      { id: 'merge_pull_request', label: 'Merge PR' },
    ],
  },
  {
    category: 'Pipelines',
    tools: [
      { id: 'list_pipelines', label: 'List Pipelines' },
      { id: 'list_pipeline_steps', label: 'List Pipeline Steps' },
      { id: 'get_pipeline_step_log', label: 'Get Pipeline Log' },
      { id: 'trigger_pipeline', label: 'Trigger Pipeline' },
    ],
  },
  {
    category: 'Source Code',
    tools: [
      { id: 'get_file_content', label: 'Get File Content' },
      { id: 'list_directory', label: 'List Directory' },
    ],
  },
  {
    category: 'Branches',
    tools: [{ id: 'list_branches', label: 'List Branches' }],
  },
];

const ALL_TOOL_IDS = TOOL_CATEGORIES.flatMap((c) => c.tools.map((t) => t.id));

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--ds-surface)',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    boxShadow: 'var(--ds-shadow-raised)',
  },
  categoryHeading: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--ds-text-subtle)',
    marginTop: 24,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid var(--ds-border)',
  },
  categoryFirst: {
    marginTop: 0,
  },
  info: {
    color: 'var(--ds-text-subtle)',
    fontSize: 14,
    marginTop: 8,
  },
};

export default function ToolsTab({
  toolsConfig,
  onToolsConfigChange,
  readOnly,
}: ToolsTabProps) {
  const handleSelectAll = () => {
    const allEnabled: Record<string, boolean> = {};
    ALL_TOOL_IDS.forEach((key) => {
      // In read-only mode, only enable read-only tools
      allEnabled[key] = readOnly ? !WRITE_TOOL_IDS.has(key) : true;
    });
    onToolsConfigChange(allEnabled);
    invoke('setToolsConfig', { tools: allEnabled }).catch(() => {});
  };

  const handleDeselectAll = () => {
    const allDisabled: Record<string, boolean> = {};
    ALL_TOOL_IDS.forEach((key) => (allDisabled[key] = false));
    onToolsConfigChange(allDisabled);
    invoke('setToolsConfig', { tools: allDisabled }).catch(() => {});
  };

  const handleToolToggle = (toolId: string, checked: boolean) => {
    captureEvent(checked ? 'admin_tool_selected' : 'admin_tool_deselected', {
      tool: toolId,
    });
    const newConfig = {
      ...toolsConfig,
      [toolId]: checked,
    };
    onToolsConfigChange(newConfig);
    invoke('setToolsConfig', { tools: newConfig }).catch(() => {});
  };

  return (
    <div style={styles.card}>
      <h2 style={{ marginTop: 0 }}>Tool Configuration</h2>
      <p style={styles.info}>
        Enable or disable individual tools. Disabled tools will return an error
        when called.
      </p>

      {readOnly && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="warning" title="Read Only Mode is active">
            <p>
              Write tools are disabled and cannot be toggled on. Turn off Read
              Only Mode in the Settings tab to re-enable them.
            </p>
          </SectionMessage>
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button appearance="primary" onClick={handleSelectAll}>
          Select All
        </Button>
        <Button appearance="subtle" onClick={handleDeselectAll}>
          Deselect All
        </Button>
      </div>

      {TOOL_CATEGORIES.map((cat, idx) => (
        <div key={cat.category}>
          <h3
            style={{
              ...styles.categoryHeading,
              ...(idx === 0 ? styles.categoryFirst : {}),
            }}
          >
            {cat.category}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {cat.tools.map((tool) => {
              const isWriteTool = WRITE_TOOL_IDS.has(tool.id);
              const isDisabledByReadOnly = readOnly && isWriteTool;
              const isChecked =
                !isDisabledByReadOnly && toolsConfig[tool.id] !== false;

              const toolItem = (
                <div
                  style={{
                    cursor: isDisabledByReadOnly ? 'not-allowed' : 'pointer',
                    padding: '4px 12px',
                    background: isDisabledByReadOnly
                      ? 'var(--ds-background-disabled)'
                      : 'var(--ds-background-neutral)',
                    borderRadius: 4,
                    border: '1px solid var(--ds-border)',
                    opacity: isDisabledByReadOnly ? 0.6 : 1,
                  }}
                >
                  <Checkbox
                    isChecked={isChecked}
                    isDisabled={isDisabledByReadOnly}
                    onChange={(e) =>
                      handleToolToggle(tool.id, e.target.checked)
                    }
                    label={
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            color: isDisabledByReadOnly
                              ? 'var(--ds-text-disabled)'
                              : 'var(--ds-text)',
                          }}
                        >
                          {tool.label}
                        </span>
                        {isWriteTool && !isDisabledByReadOnly && (
                          <Lozenge appearance="default">Write</Lozenge>
                        )}
                      </span>
                    }
                  />
                </div>
              );

              if (isDisabledByReadOnly) {
                return (
                  <Tooltip
                    key={tool.id}
                    content="This tool is unavailable because you are in read only mode. Turn off read only mode first to enable this"
                  >
                    {(tooltipProps: React.HTMLAttributes<HTMLDivElement>) => (
                      <div {...tooltipProps}>{toolItem}</div>
                    )}
                  </Tooltip>
                );
              }

              return <React.Fragment key={tool.id}>{toolItem}</React.Fragment>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
