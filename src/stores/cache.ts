import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number;
}

const defaultTTL = 5 * 60 * 1000;

function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

export function createCacheStore<T>(name: string, ttl = defaultTTL) {
  return create<{
    data: T | null;
    timestamp: number;
    expiresAt: number;
    setCache: (data: T, customTTL?: number) => void;
    getCache: () => T | null;
    isValid: () => boolean;
    clear: () => void;
    age: () => number;
  }>()(
    persist(
      (set, get) => ({
        data: null,
        timestamp: 0,
        expiresAt: 0,

        setCache: (data: T, customTTL?: number) => {
          const now = Date.now();
          set({
            data,
            timestamp: now,
            expiresAt: now + (customTTL ?? ttl),
          });
        },

        getCache: () => {
          const state = get();
          if (!state.data) return null;
          if (isExpired(state.expiresAt)) {
            set({ data: null, timestamp: 0, expiresAt: 0 });
            return null;
          }
          return state.data;
        },

        isValid: () => {
          const state = get();
          if (!state.data) return false;
          return !isExpired(state.expiresAt);
        },

        clear: () => {
          set({ data: null, timestamp: 0, expiresAt: 0 });
        },

        age: () => {
          const state = get();
          if (!state.timestamp) return Infinity;
          return Date.now() - state.timestamp;
        },
      }),
      {
        name: `cache-${name}`,
      }
    )
  );
}

export function createMemoizedStore<T>(
  name: string,
  fetchFn: () => Promise<T>,
  ttl = defaultTTL
) {
  type CacheState = {
    data: T | null;
    key: string;
    timestamp: number;
    expiresAt: number;
    isLoading: boolean;
    error: Error | null;
  };

  return create<CacheState>()(
    persist(
      (set, get) => ({
        data: null,
        key: "",
        timestamp: 0,
        expiresAt: 0,
        isLoading: false,
        error: null,

        fetch: async (key: string) => {
          const state = get();

          if (state.key === key && state.data && !isExpired(state.expiresAt)) {
            return state.data;
          }

          set({ isLoading: true, error: null, key });

          try {
            const data = await fetchFn();
            const now = Date.now();
            set({
              data,
              timestamp: now,
              expiresAt: now + ttl,
              isLoading: false,
            });
            return data;
          } catch (error) {
            set({
              isLoading: false,
              error: error as Error,
            });
            throw error;
          }
        },

        invalidate: () => {
          set({ data: null, key: "", timestamp: 0, expiresAt: 0, error: null });
        },

        invalidateByKey: (key: string) => {
          const state = get();
          if (state.key === key) {
            set({ data: null, key: "", timestamp: 0, expiresAt: 0, error: null });
          }
        },
      }),
      {
        name: `memo-${name}`,
        partialize: (state) => ({
          data: state.data,
          key: state.key,
          timestamp: state.timestamp,
          expiresAt: state.expiresAt,
        }),
      }
    )
  );
}
