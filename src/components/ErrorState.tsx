import { AlertTriangle, RefreshCw, ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createErrorContext, type ErrorCategory } from "../utils/errorUtils";

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  message?: string;
  category?: ErrorCategory;
  onRetry?: () => void;
  showRetry?: boolean;
  showGoBack?: boolean;
  showContact?: boolean;
  className?: string;
}

export function ErrorState({
  error,
  title,
  message,
  category: initialCategory,
  onRetry,
  showRetry = true,
  showGoBack = true,
  showContact = false,
  className = "",
}: ErrorStateProps) {
  const { t } = useTranslation();

  const context = error ? createErrorContext(error) : null;
  const displayTitle = title || context?.message || t("error.title", "Something went wrong");
  const displayMessage = message || (context && context.category !== "unknown" ? context.message : t("error.message", "An unexpected error occurred"));
  const category = initialCategory || context?.category || "unknown";
  const canRetry = showRetry && (context?.canRetry ?? true);
  const canGoBack = showGoBack && (context?.canGoBack ?? true);
  const actionLabel = context?.actionLabel || t("error.retry", "Retry");

  const categoryIcons: Record<ErrorCategory, string> = {
    network: "🌐",
    validation: "📝",
    auth: "🔐",
    permission: "🚫",
    not_found: "🔍",
    server: "⚙️",
    unknown: "❓",
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="mono-card max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--mono-danger-bg)] flex items-center justify-center">
            <span className="text-3xl">{categoryIcons[category]}</span>
          </div>
        </div>

        <h2 className="mono-title text-xl mb-2">
          {displayTitle}
        </h2>

        <p className="mono-subtitle text-sm mb-6">
          {displayMessage}
        </p>

        {!!error && process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-3 bg-[var(--mono-surface-muted)] rounded-lg text-left">
            <p className="text-xs font-medium text-[var(--mono-text-muted)] mb-1">
              {t("error.details", "Error Details")}
            </p>
            <p className="text-xs text-[var(--mono-text)] font-mono break-words">
              {String(context?.originalError?.message || error)}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="mono-button flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {actionLabel}
            </button>
          )}

          {canGoBack && (
            <Link
              to="-1"
              className="mono-button mono-button--ghost flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("error.goBack", "Go Back")}
            </Link>
          )}

          {showContact && (
            <a
              href="mailto:support@yourapp.com"
              className="mono-button mono-button--ghost flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {t("error.contact", "Contact Support")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface LoadingErrorStateProps {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  loadingMessage?: string;
  className?: string;
}

export function LoadingErrorState({
  isLoading,
  error,
  onRetry,
  loadingMessage,
  className = "",
}: LoadingErrorStateProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--mono-border)] border-solid rounded-full animate-spin border-t-[var(--mono-accent)]" />
          <span className="text-sm text-[var(--mono-text-muted)]">
            {loadingMessage || t("loading", "Loading...")}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  return null;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="mono-card max-w-md w-full p-8 text-center">
        {icon && (
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[var(--mono-surface-muted)] flex items-center justify-center text-[var(--mono-text-muted)]">
              <span className="text-2xl">{icon}</span>
            </div>
          </div>
        )}

        <h2 className="mono-title text-xl mb-2">
          {title}
        </h2>

        {description && (
          <p className="mono-subtitle text-sm mb-6">
            {description}
          </p>
        )}

        {action && (
          <button
            onClick={action.onClick}
            className="mono-button"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
