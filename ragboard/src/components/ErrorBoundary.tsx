import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo?.componentStack}
            </details>
            <button onClick={this.handleRetry} className="retry-button">
              Try again
            </button>
          </div>
          
          <style jsx>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 20px;
              background-color: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              margin: 20px;
            }
            
            .error-boundary-content {
              text-align: center;
              max-width: 600px;
            }
            
            .error-boundary h2 {
              color: #dc2626;
              margin-bottom: 16px;
              font-size: 24px;
              font-weight: 600;
            }
            
            .error-boundary details {
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              padding: 12px;
              margin: 16px 0;
              text-align: left;
              font-family: monospace;
              font-size: 12px;
              color: #374151;
              overflow: auto;
              max-height: 300px;
            }
            
            .retry-button {
              background-color: #3b82f6;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            
            .retry-button:hover {
              background-color: #2563eb;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Unhandled error:', error, errorInfo);
    // You could also send this to an error reporting service
  };
};

// Higher-order component version
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default ErrorBoundary;