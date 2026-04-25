export type ErrorCategory = "network" | "validation" | "auth" | "permission" | "not_found" | "server" | "unknown";

export interface ErrorContext {
  category: ErrorCategory;
  message: string;
  originalError?: Error;
  canRetry?: boolean;
  canGoBack?: boolean;
  actionLabel?: string;
}

export function categorizeError(error: unknown): ErrorCategory {
  if (!error) return "unknown";
  
  const err = error as any;
  const status = err.status || err.statusCode;
  const code = err.code;
  const message = err.message?.toLowerCase() || "";

  if (status === 401 || code === "UNAUTHENTICATED" || message.includes("unauthorized") || message.includes("auth")) {
    return "auth";
  }
  
  if (status === 403 || code === "FORBIDDEN" || message.includes("permission") || message.includes("forbidden")) {
    return "permission";
  }
  
  if (status === 404 || code === "NOT_FOUND" || message.includes("not found") || message.includes("does not exist")) {
    return "not_found";
  }
  
  if (status === 422 || status === 400 || message.includes("validation") || message.includes("invalid")) {
    return "validation";
  }
  
  if (status >= 500 || code?.startsWith("5") || message.includes("server error") || message.includes("internal")) {
    return "server";
  }
  
  if (!status && (message.includes("network") || message.includes("fetch") || message.includes("connection") || code === "network")) {
    return "network";
  }
  
  return "unknown";
}

export function getErrorMessage(error: unknown, fallbackMessage = "An error occurred"): string {
  if (!error) return fallbackMessage;
  
  const err = error as any;
  
  if (err.message) return err.message;
  if (err.error_description) return err.error_description;
  if (err.msg) return err.msg;
  if (typeof err === "string") return err;
  
  return fallbackMessage;
}

export function createErrorContext(error: unknown): ErrorContext {
  const category = categorizeError(error);
  const message = getErrorMessage(error);
  
  const config: Record<ErrorCategory, Omit<ErrorContext, "category" | "message" | "originalError">> = {
    network: {
      canRetry: true,
      actionLabel: "Retry",
    },
    validation: {
      canRetry: false,
    },
    auth: {
      canGoBack: true,
      actionLabel: "Log In",
    },
    permission: {
      canGoBack: true,
    },
    not_found: {
      canGoBack: true,
    },
    server: {
      canRetry: true,
      actionLabel: "Retry",
    },
    unknown: {
      canRetry: true,
      actionLabel: "Retry",
    },
  };
  
  return {
    category,
    message,
    originalError: error instanceof Error ? error : undefined,
    ...config[category],
  };
}

export function formatZodErrors(zodError: any): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  
  if (!zodError?.issues) return fieldErrors;
  
  for (const issue of zodError.issues) {
    const path = issue.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  
  return fieldErrors;
}

export function isRetryableError(error: unknown): boolean {
  const category = categorizeError(error);
  return category === "network" || category === "server";
}

export function isAuthError(error: unknown): boolean {
  return categorizeError(error) === "auth";
}
