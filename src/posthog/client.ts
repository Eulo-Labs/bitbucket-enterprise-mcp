import { getAppContext } from '@forge/api';
import { PostHog } from 'posthog-node';

const POSTHOG_HOST = 'https://eu.i.posthog.com';

let posthogClient: PostHog | null = null;

/**
 * Initialize PostHog client (singleton)
 */
export function initPostHog(): PostHog | null {
  if (!posthogClient) {
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      console.warn('[PostHog] POSTHOG_API_KEY not set - analytics disabled');
      return null;
    }
    posthogClient = new PostHog(apiKey, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/**
 * Capture a custom event
 */
export function captureEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  context: { workspaceId?: string } = {},
): void {
  const client = initPostHog();
  if (!client) return;

  const distinctId = context.workspaceId || 'anonymous';

  try {
    client.capture({
      distinctId,
      event: eventName,
      properties: {
        ...properties,
        app: 'bitbucket-mcp',
        environment: getAppContext()?.environmentType,
        source: 'backend',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[PostHog] Failed to capture event:', error);
  }
}

/**
 * Capture an error
 */
export function captureError(
  error: Error,
  context: { workspaceId?: string; method?: string } = {},
  additionalProperties: Record<string, unknown> = {},
): void {
  const errorDetails = {
    error_message: error.message,
    error_name: error.name,
    error_stack: error.stack,
    ...additionalProperties,
  };

  captureEvent('error', errorDetails, context);
}

/**
 * Shutdown PostHog client (flush pending events)
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
