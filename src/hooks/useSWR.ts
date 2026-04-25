import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SWRState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  lastUpdated: number | null;
  revalidateOnMount?: boolean;
}

export interface SWRActions<T> {
  setData: (data: T) => void;
  setError: (error: Error) => void;
  setLoading: (loading: boolean) => void;
  setValidating: (validating: boolean) => void;
  mutate: (data: T | ((prev: T) => T)) => void;
  reset: () => void;
}

export interface SWROptions {
  revalidateOnMount?: boolean;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  dedupingInterval?: number;
  errorRetryInterval?: number;
  errorRetryCount?: number;
  refreshInterval?: number;
}

const defaultOptions: SWROptions = {
  revalidateOnMount: true,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryInterval: 5000,
  errorRetryCount: 3,
  refreshInterval: 0,
};

export function createSWRStore<T>(
  key: string,
  options: SWROptions = defaultOptions
) {
  return create<SWRState<T> & SWRActions<T>>()(
    persist(
      (set, get) => ({
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
        lastUpdated: null,
        revalidateOnMount: options.revalidateOnMount ?? true,

        setData: (data: T) =>
          set({
            data,
            error: null,
            isLoading: false,
            isValidating: false,
            lastUpdated: Date.now(),
          }),

        setError: (error: Error) =>
          set({
            error,
            isLoading: false,
            isValidating: false,
          }),

        setLoading: (isLoading: boolean) =>
          set({ isLoading }),

        setValidating: (isValidating: boolean) =>
          set({ isValidating }),

        mutate: (dataOrFn: T | ((prev: T) => T)) =>
          set((state) => ({
            data:
              typeof dataOrFn === "function"
                ? (dataOrFn as (prev: T) => T)(state.data as T)
                : dataOrFn,
            lastUpdated: Date.now(),
          })),

        reset: () =>
          set({
            data: null,
            error: null,
            isLoading: false,
            isValidating: false,
            lastUpdated: null,
          }),
      }),
      {
        name: `swr-${key}`,
        partialize: (state) => ({
          data: state.data,
          lastUpdated: state.lastUpdated,
        }),
      }
    )
  );
}

export interface UseSWRReturn<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  lastUpdated: number | null;
  mutate: (data: T | ((prev: T) => T)) => void;
  reset: () => void;
  execute: () => Promise<void>;
  revalidate: () => Promise<void>;
  isStale: boolean;
  shouldRevalidate: boolean;
}

type Fetcher<T> = () => Promise<T>;

export function useSWR<T>(
  key: string,
  fetcher: Fetcher<T>,
  options: SWROptions = defaultOptions
): UseSWRReturn<T> {
  const store = createSWRStore<T>(key, options);
  const state = store();
  const lastRequestTime = { current: 0 };
  const retryCount = { current: 0 };
  const abortController = { current: null as AbortController | null };

  const execute = async (force = false) => {
    const now = Date.now();
    const dedupingInterval = options.dedupingInterval ?? 2000;
    const errorRetryCount = options.errorRetryCount ?? 3;

    if (!force && state.isValidating) return;
    if (!force && now - lastRequestTime.current < dedupingInterval) return;

    lastRequestTime.current = now;
    store.getState().setValidating(true);

    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    try {
      store.getState().setLoading(true);
      const data = await fetcher();
      store.getState().setData(data);
      retryCount.current = 0;
    } catch (error) {
      const err = error as Error;
      if (err.name === "AbortError") return;
      
      store.getState().setError(err);
      
      if (retryCount.current < errorRetryCount) {
        retryCount.current++;
        const retryInterval = options.errorRetryInterval ?? 5000;
        setTimeout(() => execute(true), retryInterval);
      }
    }
  };

  const refreshInterval = options.refreshInterval ?? 0;
  const isStale = state.lastUpdated
    ? Date.now() - state.lastUpdated > refreshInterval
    : true;

  const shouldRevalidate =
    options.revalidateOnMount ?? true
      ? true
      : !state.data;

  return {
    ...state,
    mutate: store.getState().mutate,
    reset: store.getState().reset,
    execute,
    revalidate: () => execute(true),
    isStale,
    shouldRevalidate,
  };
}

export function createSWRHook<T>() {
  return function useSWRHook(
    key: string,
    fetcher: Fetcher<T>,
    options: SWROptions = defaultOptions
  ) {
    return useSWR(key, fetcher, options);
  };
}

export const createDataCache = <T,>() => {
  const cache = new Map<string, { data: T; expiresAt: number }>();

  return {
    get: (key: string): T | null => {
      const entry = cache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
      }
      return entry.data;
    },
    set: (key: string, data: T, ttlMs = 300000) => {
      cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    },
    delete: (key: string) => cache.delete(key),
    clear: () => cache.clear(),
    has: (key: string): boolean => {
      const entry = cache.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return false;
      }
      return true;
    },
  };
};
