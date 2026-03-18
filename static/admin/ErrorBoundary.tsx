import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from './posthog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  source?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    captureException(error, {
      componentStack: errorInfo.componentStack,
      source: this.props.source || 'admin-error-boundary',
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '20px',
            fontFamily: 'sans-serif',
            color: '#de350b',
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>Something went wrong</h3>
          <p>An unexpected error occurred. Please refresh the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
