import '@atlaskit/css-reset';
import React from 'react';
import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { captureEvent, initPostHog } from './posthog';
import { invoke, view } from './bridge';

void view.theme.enable();
void invoke<{ environmentType: string }>('getEnvironment')
  .then(({ environmentType }) => {
    initPostHog(environmentType);
    captureEvent('admin_page_viewed');
  })
  .catch((err) => {
    console.error('[Main] getEnvironment failed:', err);
    initPostHog();
    captureEvent('admin_page_viewed');
  });

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

createRoot(container).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <ErrorBoundary source="admin">
        <App />
      </ErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>,
);
