"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import {
  handleError,
  getRecoveryActions,
  type AppError,
} from "@/lib/utils/error-handler";

interface Props {
  children: ReactNode;
  fallback?: (error: AppError, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: AppError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const appError = handleError(error, {
      component: "ErrorBoundary",
      action: "render",
    });

    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    handleError(error, {
      component: "ErrorBoundary",
      action: "componentDidCatch",
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: AppError;
  onRetry: () => void;
}

function DefaultErrorFallback({ error, onRetry }: DefaultErrorFallbackProps) {
  const recoveryActions = getRecoveryActions(error.code);

  const getSeverityColor = () => {
    switch (error.severity) {
      case "critical":
        return "border-red-500 bg-red-50";
      case "high":
        return "border-red-400 bg-red-50";
      case "medium":
        return "border-yellow-400 bg-yellow-50";
      case "low":
        return "border-blue-400 bg-blue-50";
      default:
        return "border-gray-400 bg-gray-50";
    }
  };

  const getSeverityIcon = () => {
    switch (error.severity) {
      case "critical":
      case "high":
        return <AlertTriangle className="w-8 h-8 text-red-500" />;
      case "medium":
        return <AlertTriangle className="w-8 h-8 text-yellow-500" />;
      case "low":
        return <AlertTriangle className="w-8 h-8 text-blue-500" />;
      default:
        return <AlertTriangle className="w-8 h-8 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className={`max-w-md w-full border-2 rounded-lg p-6 ${getSeverityColor()}`}
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">{getSeverityIcon()}</div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h1>

          <p className="text-gray-700 mb-4">{error.userMessage}</p>

          {/* Error Details (for development) */}
          {process.env.NODE_ENV === "development" && (
            <details className="mb-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
                <div>
                  <strong>Code:</strong> {error.code}
                </div>
                <div>
                  <strong>Message:</strong> {error.message}
                </div>
                <div>
                  <strong>Time:</strong> {error.timestamp.toLocaleString()}
                </div>
                {error.context && (
                  <div>
                    <strong>Context:</strong>{" "}
                    {JSON.stringify(error.context, null, 2)}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Recovery Actions */}
          <div className="space-y-2">
            {recoveryActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  action.primary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {action.label === "Refresh Page" && (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {action.label === "Go Home" && <Home className="w-4 h-4" />}
                  {action.label === "Retry" && (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>{action.label}</span>
                </div>
              </button>
            ))}

            {/* Component-level retry */}
            <button
              onClick={onRetry}
              className="w-full px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium hover:bg-blue-200 transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </div>
            </button>
          </div>

          {/* Report Issue */}
          <div className="mt-4 pt-4 border-t border-gray-300">
            <button
              onClick={() => {
                const subject = encodeURIComponent(
                  `Error Report: ${error.code}`
                );
                const body = encodeURIComponent(
                  `
Error Code: ${error.code}
User Message: ${error.userMessage}
Technical Message: ${error.message}
Time: ${error.timestamp.toISOString()}
Context: ${JSON.stringify(error.context, null, 2)}
                `.trim()
                );

                window.open(
                  `mailto:support@example.com?subject=${subject}&body=${body}`
                );
              }}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-1"
            >
              <Bug className="w-4 h-4" />
              Report this issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: AppError, retry: () => void) => ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}
