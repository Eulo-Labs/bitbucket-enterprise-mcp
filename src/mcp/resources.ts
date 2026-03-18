/**
 * MCP Resources
 *
 * Registers MCP resources (static content exposed to clients).
 * Currently registers the PR List HTML UI for MCP Apps integration.
 */

import type { McpResource } from './types';
import type { ToolContext } from '../tools/types';
import { BitbucketService } from '../bitbucket/service';
import { formatPr } from '../tools/pull-requests/format';
import { formatPipeline } from '../tools/pipelines/format';

interface ResourceEntry {
  resource: McpResource;
  content: string;
}

type ResourceResolver = (context: ToolContext) => Promise<string>;

interface DynamicResourceEntry {
  resource: McpResource;
  resolve: ResourceResolver;
}

type TemplateResolver = (
  context: ToolContext,
  params: Record<string, string>,
) => Promise<string>;

interface DynamicTemplateEntry {
  resource: McpResource & { uriTemplate: string };
  pattern: RegExp;
  paramNames: string[];
  resolve: TemplateResolver;
}

const resources = new Map<string, ResourceEntry>();
const dynamicResources = new Map<string, DynamicResourceEntry>();
const dynamicTemplates: DynamicTemplateEntry[] = [];

function registerDynamic(resource: McpResource, resolve: ResourceResolver) {
  dynamicResources.set(resource.uri, { resource, resolve });
}

function registerDynamicTemplate(
  resource: McpResource & { uriTemplate: string },
  resolve: TemplateResolver,
) {
  const paramNames: string[] = [];
  const regexStr = resource.uriTemplate.replace(/\{([^}]+)\}/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  const pattern = new RegExp(`^${regexStr}$`);
  dynamicTemplates.push({ resource, pattern, paramNames, resolve });
}

export function getResourceList(): McpResource[] {
  return [
    ...Array.from(resources.values()).map((e) => e.resource),
    ...Array.from(dynamicResources.values()).map((e) => e.resource),
  ];
}

export function getResourceTemplates(): Array<{
  uriTemplate: string;
  name: string;
  mimeType: string;
}> {
  return dynamicTemplates.map((t) => ({
    uriTemplate: t.resource.uriTemplate,
    name: t.resource.name,
    mimeType: t.resource.mimeType ?? 'application/json',
  }));
}

export function readResource(
  uri: string,
): { resource: McpResource; content: string } | null {
  return resources.get(uri) ?? null;
}

export function getDynamicResource(uri: string): DynamicResourceEntry | null {
  return dynamicResources.get(uri) ?? null;
}

export function getDynamicTemplate(
  uri: string,
): { entry: DynamicTemplateEntry; params: Record<string, string> } | null {
  for (const entry of dynamicTemplates) {
    const match = entry.pattern.exec(uri);
    if (match) {
      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { entry, params };
    }
  }
  return null;
}

// Register dynamic resources
registerDynamic(
  {
    uri: 'bb://repos',
    name: 'Workspace Repositories',
    mimeType: 'application/json',
  },
  async (context) => {
    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listRepositories({ page: 1, pagelen: 100 });
    return JSON.stringify(
      {
        size: data.size,
        repositories: data.values.map((r) => ({
          full_name: r.full_name,
          name: r.name,
          slug: r.slug,
          description: r.description,
          language: r.language,
          is_private: r.is_private,
          main_branch: r.mainbranch?.name,
          project: r.project
            ? { key: r.project.key, name: r.project.name }
            : null,
          updated_on: r.updated_on,
          url: r.links.html.href,
        })),
      },
      null,
      2,
    );
  },
);

// Register dynamic resource templates
registerDynamicTemplate(
  {
    uriTemplate: 'bb://prs/{repo_slug}',
    uri: 'bb://prs/{repo_slug}',
    name: 'Pull Requests',
    mimeType: 'application/json',
  },
  async (context, { repo_slug }) => {
    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listPullRequests({
      repo_slug,
      pagelen: 50,
      state: 'ALL',
    });
    return JSON.stringify(
      { size: data.size, pull_requests: data.values.map(formatPr) },
      null,
      2,
    );
  },
);

registerDynamicTemplate(
  {
    uriTemplate: 'bb://pipelines/{repo_slug}',
    uri: 'bb://pipelines/{repo_slug}',
    name: 'Pipelines',
    mimeType: 'application/json',
  },
  async (context, { repo_slug }) => {
    const bb = new BitbucketService(context.workspace, context.userToken);
    const data = await bb.listPipelines({ repo_slug, page: 1, pagelen: 25 });
    return JSON.stringify(
      { size: data.size, pipelines: data.values.map(formatPipeline) },
      null,
      2,
    );
  },
);
