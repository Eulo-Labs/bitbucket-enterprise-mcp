import posthog from 'posthog-js';

let isInitialized = false;

/**
 * Initialize PostHog with common configuration
 */
export function initPostHog(environment?: string): void {
  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  console.log('[PostHog] Init called with:', {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'undefined',
    apiHost: apiHost || 'undefined',
    environment,
  });

  if (apiKey && apiHost) {
    try {
      posthog.init(apiKey, {
        api_host: apiHost,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_web_experiments: true,
        disable_surveys: true,
        disable_product_tours: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        opt_out_capturing_by_default: false,
        opt_out_persistence_by_default: true,
        persistence: 'memory',
      });
      posthog.register({ app: 'bitbucket-mcp', environment });
      isInitialized = true;
      console.log('[PostHog] Successfully initialized');
    } catch (error) {
      console.error('[PostHog] Init threw an error:', error);
    }
  } else {
    console.log(
      '[PostHog] Missing environment variables. Events will be logged to console only.',
    );
  }
}

/**
 * Capture a custom event
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!isInitialized) {
    console.log('[PostHog] (Simulated) Capture Event:', eventName, properties);
    return;
  }

  try {
    posthog.capture(eventName, properties);
  } catch (error) {
    console.error('[PostHog] Failed to capture event:', eventName, error);
  }
}

/**
 * Capture an exception/error
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  const properties = {
    ...context,
    $exception_message: error.message,
    $exception_type: error.name,
    $exception_stacktrace: error.stack,
  };

  if (!isInitialized) {
    console.log('[PostHog] (Simulated) Capture Exception:', properties);
    return;
  }

  try {
    posthog.capture('$exception', properties);
    console.debug('[PostHog] Exception captured:', error.message);
  } catch (captureError) {
    console.error('[PostHog] Failed to capture exception:', captureError);
  }
}
