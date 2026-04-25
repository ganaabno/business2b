import { Component, type ReactNode, type ErrorInfo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) =>
          key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[400px] items-center justify-center px-4 py-8">
      <div className="mono-card max-w-md w-full p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[var(--mono-danger-bg)] flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-[var(--mono-danger-text)]" />
          </div>
        </div>

        <h2 className="mono-title text-xl mb-2">
          {t("somethingWentWrong", "Something went wrong")}
        </h2>

        <p className="mono-subtitle text-sm mb-6">
          {t(
            "errorBoundaryMessage",
            "An unexpected error occurred. Please try again or return to the home page."
          )}
        </p>

        {error && (
          <div className="mb-6 p-3 bg-[var(--mono-surface-muted)] rounded-lg text-left">
            <p className="text-xs font-medium text-[var(--mono-text-muted)] mb-1">
              {t("errorDetails", "Error Details")}
            </p>
            <p className="text-sm text-[var(--mono-text)] font-mono break-words">
              {error.message || t("unknownError", "Unknown error")}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset}
            className="mono-button mono-button--ghost flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t("tryAgain", "Try Again")}
          </button>

          <Link to="/" className="mono-button flex items-center gap-2">
            <Home className="w-4 h-4" />
            {t("goHome", "Go Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      resetKeys={[window.location.pathname]}
      onError={(error, errorInfo) => {
        console.error("Route error:", error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
