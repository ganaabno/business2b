import { useState, useCallback, useRef } from "react";

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: Error | null;
}

const defaultShouldRetry = (error: Error): boolean => {
  const status = (error as any)?.status || (error as any)?.statusCode;
  return !status || status >= 500 || status === 429 || status === "network" || status === undefined;
};

export function useRetry<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    onRetry,
    shouldRetry = defaultShouldRetry,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<boolean>(false);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      abortRef.current = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (abortRef.current) {
          return null;
        }

        try {
          const result = await fn(...args);
          setState({
            isRetrying: false,
            attempt: 0,
            lastError: null,
          });
          return result;
        } catch (error) {
          const err = error as Error;

          if (attempt === maxRetries || !shouldRetry(err)) {
            setState({
              isRetrying: false,
              attempt: attempt + 1,
              lastError: err,
            });
            throw error;
          }

          setState({
            isRetrying: true,
            attempt: attempt + 1,
            lastError: err,
          });

          onRetry?.(attempt + 1, err);

          const waitTime = backoff ? delay * Math.pow(2, attempt) : delay;

          await new Promise((resolve) => {
            timeoutRef.current = setTimeout(resolve, waitTime);
          });
        }
      }

      return null;
    },
    [fn, maxRetries, delay, backoff, shouldRetry, onRetry]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState((prev) => ({ ...prev, isRetrying: false }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({ isRetrying: false, attempt: 0, lastError: null });
  }, [cancel]);

  return {
    ...state,
    execute,
    cancel,
    reset,
  };
}

export interface FetchWithRetryOptions extends RetryOptions {
  immediate?: boolean;
}

export function useFetchWithRetry<T>(
  fetcher: () => Promise<T>,
  options: FetchWithRetryOptions = {}
) {
  const { immediate = false, ...retryOptions } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(immediate);
  const [isSuccess, setIsSuccess] = useState(false);

  const retry = useRetry(
    async () => {
      const result = await fetcher();
      setData(result);
      setIsSuccess(true);
      return result;
    },
    {
      ...retryOptions,
      onRetry: (attempt, error) => {
        console.warn(`Retry attempt ${attempt} due to error:`, error.message);
        retryOptions.onRetry?.(attempt, error);
      },
    }
  );

  const execute = useCallback(async () => {
    setIsLoading(true);
    setIsSuccess(false);
    try {
      await retry.execute();
    } finally {
      setIsLoading(false);
    }
  }, [retry]);

  return {
    data,
    isLoading: isLoading || retry.isRetrying,
    isSuccess,
    error: retry.lastError,
    attempt: retry.attempt,
    execute,
    cancel: retry.cancel,
    reset: () => {
      retry.reset();
      setData(null);
      setIsSuccess(false);
    },
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    shouldRetry = defaultShouldRetry,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as Error;

      if (attempt === maxRetries || !shouldRetry(err)) {
        throw error;
      }

      const waitTime = backoff ? delay * Math.pow(2, attempt) : delay;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw new Error("Retry failed");
}
