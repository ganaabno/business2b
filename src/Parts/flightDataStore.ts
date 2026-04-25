// src/Parts/flightDataStore.ts
import { create } from "zustand";
import { supabase } from "../supabaseClient";

export interface FlightRow {
  [key: string]: string | number | null | undefined;
}

type FetchMode = "recent" | "full";

type FetchFlightDataOptions = {
  force?: boolean;
  mode?: FetchMode;
  limit?: number;
};

type FetchResult = {
  source: "network" | "cache" | "skip";
  count: number;
};

type FlightDataCache = {
  data: FlightRow[];
  lastUploadAt?: string | null;
  lastUploadTime?: string;
  lastFetchMode?: FetchMode;
  timestamp: number;
};

type SetDataOptions = {
  lastUploadAt?: string | null;
  lastUploadTime?: string;
  fetchMode?: FetchMode;
  persist?: boolean;
};

interface FlightDataState {
  data: FlightRow[];
  lastUploadTime: string;
  lastFetchMode: FetchMode | null;
  isLoading: boolean;
  setData: (data: FlightRow[], options?: SetDataOptions) => void;
  setLoading: (loading: boolean) => void;
  hydrateFromCache: () => boolean;
  fetchFlightData: (options?: FetchFlightDataOptions) => Promise<FetchResult>;
  subscribeToFlightData: (options?: FetchFlightDataOptions) => () => void;
  clear: () => void;
}

const CACHE_KEY = "flightDataCache";
const DEFAULT_RECENT_LIMIT = 50;
const FULL_PAGE_SIZE = 1000;

const formatUploadTime = (uploadedAt?: string | null): string => {
  if (!uploadedAt) return "";
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" });
};

const readCache = (): FlightDataCache | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FlightDataCache;
  } catch {
    return null;
  }
};

const writeCache = (cache: FlightDataCache) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache failures (quota, privacy mode, etc.)
  }
};

const clearCache = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore cache failures
  }
};

const isModeSufficient = (requested: FetchMode, existing?: FetchMode | null) => {
  if (!existing) return false;
  if (existing === "full") return true;
  return existing === requested;
};

export const useFlightDataStore = create<FlightDataState>((set, get) => {
  const setData = (data: FlightRow[], options: SetDataOptions = {}) => {
    const {
      lastUploadAt,
      lastUploadTime,
      fetchMode = "recent",
      persist = true,
    } = options;
    const resolvedTime = lastUploadTime ?? formatUploadTime(lastUploadAt);
    set({
      data,
      lastUploadTime: resolvedTime,
      lastFetchMode: fetchMode,
      isLoading: false,
    });
    if (persist) {
      writeCache({
        data,
        lastUploadAt: lastUploadAt ?? null,
        lastUploadTime: resolvedTime,
        lastFetchMode: fetchMode,
        timestamp: Date.now(),
      });
    }
  };

  const hydrateFromCache = () => {
    const cache = readCache();
    if (!cache?.data?.length) return false;
    const resolvedTime = cache.lastUploadTime ?? formatUploadTime(cache.lastUploadAt);
    set({
      data: cache.data,
      lastUploadTime: resolvedTime,
      lastFetchMode: cache.lastFetchMode ?? "recent",
      isLoading: false,
    });
    return true;
  };

  const fetchFlightData = async (
    options: FetchFlightDataOptions = {},
  ): Promise<FetchResult> => {
    const { force = false, mode = "recent", limit = DEFAULT_RECENT_LIMIT } =
      options;
    const { data, lastFetchMode, isLoading } = get();

    if (isLoading) {
      return { source: "skip", count: data.length };
    }

    if (!force && data.length > 0 && isModeSufficient(mode, lastFetchMode)) {
      return { source: "skip", count: data.length };
    }

    if (!force && data.length === 0) {
      const cache = readCache();
      if (cache?.data?.length) {
        const resolvedTime =
          cache.lastUploadTime ?? formatUploadTime(cache.lastUploadAt);
        set({
          data: cache.data,
          lastUploadTime: resolvedTime,
          lastFetchMode: cache.lastFetchMode ?? "recent",
          isLoading: false,
        });
        if (isModeSufficient(mode, cache.lastFetchMode ?? "recent")) {
          return { source: "cache", count: cache.data.length };
        }
      }
    }

    set({ isLoading: true });
    try {
      let allRows: FlightRow[] = [];
      let latestUploadAt: string | null = null;

      if (mode === "recent") {
        const { data: rows, error } = await supabase
          .from("flight_data")
          .select("data, uploaded_at")
          .order("uploaded_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        latestUploadAt = rows?.[0]?.uploaded_at ?? null;
        allRows = (rows ?? []).flatMap((item: any) => item.data || []);
      } else {
        let start = 0;
        while (true) {
          const { data: rows, error } = await supabase
            .from("flight_data")
            .select("data, uploaded_at")
            .order("uploaded_at", { ascending: false })
            .range(start, start + FULL_PAGE_SIZE - 1);

          if (error) throw error;
          if (!rows || rows.length === 0) break;

          if (start === 0) {
            latestUploadAt = rows[0]?.uploaded_at ?? null;
          }

          allRows.push(...rows.flatMap((item: any) => item.data || []));

          if (rows.length < FULL_PAGE_SIZE) break;
          start += FULL_PAGE_SIZE;
        }
      }

      setData(allRows, {
        lastUploadAt: latestUploadAt,
        lastUploadTime: formatUploadTime(latestUploadAt),
        fetchMode: mode,
      });

      return { source: "network", count: allRows.length };
    } finally {
      set({ isLoading: false });
    }
  };

  const subscribeToFlightData = (
    options: FetchFlightDataOptions = {},
  ) => {
    const { mode = "recent", limit = DEFAULT_RECENT_LIMIT } = options;
    const channel = supabase
      .channel(`flight_data_${mode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_data" },
        () => {
          void fetchFlightData({ mode, limit, force: true });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    data: [],
    lastUploadTime: "",
    lastFetchMode: null,
    isLoading: false,
    setData,
    setLoading: (loading) => set({ isLoading: loading }),
    hydrateFromCache,
    fetchFlightData,
    subscribeToFlightData,
    clear: () => {
      set({ data: [], lastUploadTime: "", lastFetchMode: null, isLoading: false });
      clearCache();
    },
  };
});
