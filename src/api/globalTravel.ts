import { VALID_ORDER_STATUSES, type Order, type Tour } from "../types/type";
import { supabase } from "../supabaseClient";
import { apiBaseUrl } from "./apiBase";
import { ensureGlobalTourBookable, syncGlobalTours } from "./b2b";

const globalApiBaseUrl =
  (import.meta.env.VITE_GLOBAL_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) || "";

const discoveredRailwayApiBase = "https://b2c-production.up.railway.app";

const globalApiProxyBase = "/__global_api";
const globalOrdersPath =
  (import.meta.env.VITE_GLOBAL_API_ORDERS_PATH as string | undefined) ||
  "/api/orders";
const globalToursPath =
  (import.meta.env.VITE_GLOBAL_API_TOURS_PATH as string | undefined) ||
  "/api/tours";

const globalApiEnabledRaw =
  (import.meta.env.VITE_GLOBAL_API_ENABLED as string | undefined) || "";
const globalApiTimeoutRaw =
  (import.meta.env.VITE_GLOBAL_API_TIMEOUT_MS as string | undefined) || "8000";
const globalApiUseBackendProxyRaw =
  (import.meta.env.VITE_GLOBAL_API_USE_BACKEND_PROXY as string | undefined) ||
  "";
const globalApiAllowDirectBrowserRaw =
  (import.meta.env.VITE_GLOBAL_API_ALLOW_DIRECT_BROWSER as string | undefined) ||
  "";
const backendApiBaseUrl = apiBaseUrl;

export const isGlobalApiEnabled =
  globalApiEnabledRaw.trim().toLowerCase() !== "false";

const globalToursPrimaryRaw =
  (import.meta.env.VITE_USE_GLOBAL_TOURS_PRIMARY as string | undefined) || "";
const globalToursFallbackRaw =
  (import.meta.env.VITE_GLOBAL_TOURS_FALLBACK_LOCAL as string | undefined) ||
  "";

export const useGlobalToursPrimary =
  globalToursPrimaryRaw.trim().toLowerCase() !== "false";
export const useGlobalToursFallbackLocal =
  globalToursFallbackRaw.trim().toLowerCase() !== "false";

const globalApiTimeoutMs = (() => {
  const parsed = Number(globalApiTimeoutRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8000;
  return parsed;
})();

function shouldUseBackendProxy() {
  const normalized = globalApiUseBackendProxyRaw.trim().toLowerCase();
  const allowDirect = globalApiAllowDirectBrowserRaw.trim().toLowerCase();
  const isLocalhostRuntime =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized) && isLocalhostRuntime) {
    return false;
  }

  if (!isLocalhostRuntime) {
    if (["1", "true", "yes", "on"].includes(allowDirect)) {
      return false;
    }
    return true;
  }

  return false;
}

const endpointCooldownUntil = new Map<string, number>();
const ENDPOINT_COOLDOWN_MS = 60_000;

const BACKEND_TOURS_PROXY_PATH = "/api/v1/tours/global/proxy";
const BACKEND_ORDERS_PROXY_PATH = "/api/v1/tours/global/proxy/orders";

function endpointKey(baseUrl: string, requestPath: string) {
  return `${baseUrl}${requestPath}`;
}

function getCooldownError(baseUrl: string, requestPath: string, untilMs: number) {
  const waitSeconds = Math.max(1, Math.ceil((untilMs - Date.now()) / 1000));
  return new Error(
    `Global API endpoint temporarily unstable (${baseUrl}${requestPath}). Retry in ~${waitSeconds}s.`,
  );
}

function markEndpointFailure(baseUrl: string, requestPath: string) {
  endpointCooldownUntil.set(
    endpointKey(baseUrl, requestPath),
    Date.now() + ENDPOINT_COOLDOWN_MS,
  );
}

function clearEndpointFailure(baseUrl: string, requestPath: string) {
  endpointCooldownUntil.delete(endpointKey(baseUrl, requestPath));
}

function getGlobalApiBaseUrl() {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return globalApiProxyBase;
  }
  return globalApiBaseUrl;
}

function getCandidateBases() {
  const primary = getGlobalApiBaseUrl();
  const candidates = [primary];
  const allowLocalMultiBaseFallback =
    (import.meta.env.VITE_GLOBAL_API_MULTI_BASE_FALLBACK as string | undefined) ===
    "true";

  if (
    allowLocalMultiBaseFallback &&
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    if (globalApiBaseUrl && globalApiBaseUrl !== primary) {
      candidates.push(globalApiBaseUrl);
    }
    if (discoveredRailwayApiBase && discoveredRailwayApiBase !== primary) {
      candidates.push(discoveredRailwayApiBase);
    }
  }

  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    primary !== discoveredRailwayApiBase
  ) {
    candidates.push(discoveredRailwayApiBase);
  }

  return candidates.filter(Boolean);
}

const normalizePath = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

function resolveBackendUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = normalizePath(path);
  if (!backendApiBaseUrl) {
    return normalizedPath;
  }

  return `${backendApiBaseUrl}${normalizedPath}`;
}

type SupabaseSessionLike = {
  access_token?: string;
  expires_at?: number | null;
};

function isSessionExpiredSoon(session: SupabaseSessionLike | null | undefined) {
  if (!session?.expires_at) {
    return false;
  }

  const expiryMs = Number(session.expires_at) * 1000;
  if (!Number.isFinite(expiryMs)) {
    return false;
  }

  return expiryMs <= Date.now() + 15_000;
}

async function resolveActiveSession(options?: { forceRefresh?: boolean }) {
  const currentSessionResult = await supabase.auth.getSession();
  let session = currentSessionResult.data.session;

  if (options?.forceRefresh || !session || isSessionExpiredSoon(session)) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session || session;
  }

  return session;
}

function parsePayload(rawText: string): unknown {
  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return { error: rawText };
  }
}

function backendErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return `Backend proxy request failed (${status})`;
}

async function fetchJsonViaBackendProxy(proxyPath: string) {
  const session = await resolveActiveSession();
  if (!session?.access_token) {
    throw new Error("Unauthorized: missing auth session. Please sign in again.");
  }

  const response = await fetch(resolveBackendUrl(proxyPath), {
    method: "GET",
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
  });

  const rawText = await response.text();
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const trimmed = rawText.trim().toLowerCase();
  const isHtmlLike =
    contentType.includes("text/html") ||
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html");

  if (isHtmlLike) {
    throw new Error(
      "Backend API target is misconfigured and returned HTML instead of JSON. Set VITE_API_BASE_URL to your backend URL or configure /api proxy routing.",
    );
  }

  const payload = parsePayload(rawText);

  if (!response.ok) {
    throw new Error(backendErrorMessage(payload, response.status));
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: unknown }).data;
  }

  return payload;
}

function buildApiPathCandidates(configuredPath: string, defaults: string[]) {
  const normalizedConfigured = normalizePath(configuredPath);
  const candidates = new Set<string>();

  const addConfigured = () => {
    if (normalizedConfigured.startsWith("/api/v1/")) {
      const withoutV1 = normalizedConfigured.replace(/^\/api\/v1\//, "/api/");
      candidates.add(withoutV1);
      candidates.add(normalizedConfigured);
      return;
    }

    if (normalizedConfigured.startsWith("/api/")) {
      candidates.add(normalizedConfigured);
      return;
    }

    candidates.add(`/api${normalizedConfigured}`);
    candidates.add(normalizedConfigured);
  };

  addConfigured();

  for (const fallback of defaults) {
    candidates.add(normalizePath(fallback));
  }

  return Array.from(candidates);
}

async function parseJsonResponse(response: Response, requestPath: string) {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    throw new Error(
      `Global API request failed (${response.status}) for ${requestPath}`,
    );
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    const preview = rawText.slice(0, 80).replace(/\s+/g, " ").trim();
    throw new Error(
      `Global API endpoint returned non-JSON for ${requestPath}. Preview: ${preview || "(empty)"}`,
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`Invalid JSON from Global API for ${requestPath}`);
  }
}

async function fetchJsonWithBase(baseUrl: string, path: string) {
  const requestPath = normalizePath(path);
  const key = endpointKey(baseUrl, requestPath);
  const cooldownUntil = endpointCooldownUntil.get(key) || 0;
  if (cooldownUntil > Date.now()) {
    throw getCooldownError(baseUrl, requestPath, cooldownUntil);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), globalApiTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: "GET",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const payload = await parseJsonResponse(response, requestPath);
    clearEndpointFailure(baseUrl, requestPath);
    return { payload, requestPath };
  } catch (error) {
    markEndpointFailure(baseUrl, requestPath);
    throw error;
  }
}

async function fetchJson(path: string) {
  const bases = getCandidateBases();
  let lastError: Error | null = null;

  for (const base of bases) {
    try {
      return await fetchJsonWithBase(base, path);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error(`Failed to fetch ${path}`);
}

async function fetchFirstAvailable(paths: string[]) {
  const dedupedPaths = Array.from(
    new Set(paths.map((path) => normalizePath(path))),
  );
  let lastError: Error | null = null;

  for (const path of dedupedPaths) {
    try {
      return await fetchJson(path);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("No available endpoint returned JSON");
}

export type GlobalApiSnapshot = {
  online: boolean;
  message: string;
  toursCount: number | null;
  ordersCount: number | null;
  checkedAt: string;
};

type MaybeOrder = Partial<Order> & {
  id?: string | number;
  passengers?: any[];
  passenger_requests?: any[];
  tours?: { title?: string } | null;
  tour_title?: string;
  departure_date?: string;
  payment_status?: string;
  passenger_count?: number;
  invoice_id?: string | number;
  selected_departure?: {
    departure_date?: string;
    departureDate?: string;
    date?: string;
  } | null;
};

const normalizeOrderStatus = (value: unknown): Order["status"] => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "pending";
  if ((VALID_ORDER_STATUSES as readonly string[]).includes(raw)) {
    return raw as Order["status"];
  }
  if (raw === "paid" || raw === "success") return "confirmed";
  if (raw === "failed" || raw === "declined") return "rejected";
  if (raw === "processing") return "pending";
  return "pending";
};

type RawGlobalTour = {
  id?: string;
  title?: string;
  description?: string;
  departure_date?: string;
  departureDate?: string;
  departuredate?: string;
  dates?: unknown;
  seats?: number | string;
  available_seats?: number | string;
  base_price?: number | string;
  created_at?: string;
  updated_at?: string;
  priceTable?: unknown;
  price_table?: unknown;
  hotels?: Array<{ name?: string }> | string[];
  [key: string]: any;
};

const normalizeTitleKey = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeIdentityKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeDateKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .slice(0, 10);

const buildCanonicalTourKey = (
  sourceSystem?: string | null,
  sourceTourId?: string | null,
) => {
  const normalizedSource = normalizeIdentityKey(sourceSystem);
  const normalizedSourceTourId = String(sourceTourId || "").trim();

  if (!normalizedSource || !normalizedSourceTourId) {
    return null;
  }

  return `${normalizedSource}:${normalizedSourceTourId}`;
};

const getPrimaryTourDate = (tour: Tour) => {
  if (Array.isArray(tour.dates) && tour.dates.length > 0) {
    return normalizeDateKey(tour.dates[0]);
  }

  const legacyDepartureDate = (tour as Tour & { departuredate?: string | null })
    .departuredate;

  return normalizeDateKey(tour.departure_date || legacyDepartureDate);
};

const buildTitleDateKey = (title?: string | null, date?: string | null) => {
  const titleKey = normalizeTitleKey(title);
  const dateKey = normalizeDateKey(date);

  if (!titleKey || !dateKey) {
    return null;
  }

  return `${titleKey}|${dateKey}`;
};

const asIsoDate = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const candidate = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
};

function appendGlobalPriceRows(
  rows: Array<Record<string, unknown>>,
  candidate: unknown,
) {
  if (Array.isArray(candidate)) {
    for (const row of candidate) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }
    return;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return;
  }

  const container = candidate as Record<string, unknown>;
  const nestedCandidates = [
    container.rows,
    container.data,
    container.items,
    container.results,
  ];

  for (const nested of nestedCandidates) {
    if (!Array.isArray(nested)) continue;

    for (const row of nested) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }

    return;
  }
}

function readGlobalPriceRowDate(row: Record<string, unknown>) {
  return asIsoDate(row.departure_date || row.departureDate || row.date);
}

function readGlobalPriceRowSeats(row: Record<string, unknown>) {
  const parsed = Number(row.seats ?? row.available_seats ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function readGlobalPriceRowAdultPrice(row: Record<string, unknown>) {
  const nestedPrices =
    row.prices && typeof row.prices === "object" && !Array.isArray(row.prices)
      ? (row.prices as Record<string, unknown>)
      : null;

  const parsed = Number(row.adult_price ?? row.price ?? nestedPrices?.adult_price ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function getGlobalPriceRows(raw: RawGlobalTour): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  appendGlobalPriceRows(rows, raw.priceTable);
  appendGlobalPriceRows(rows, raw.price_table);

  for (const [key, value] of Object.entries(raw)) {
    if (!key.endsWith("_price_table")) continue;

    appendGlobalPriceRows(rows, value);
  }

  return rows;
}

function extractGlobalTourDates(
  raw: RawGlobalTour,
  rows: Array<Record<string, unknown>>,
): string[] {
  const unique = new Set<string>();

  for (const row of rows) {
    const rowDate = readGlobalPriceRowDate(row);
    if (rowDate) {
      unique.add(rowDate);
    }
  }

  if (Array.isArray(raw.dates)) {
    for (const date of raw.dates) {
      const normalized = asIsoDate(date);
      if (normalized) {
        unique.add(normalized);
      }
    }
  }

  const fallbackDates = [raw.departure_date, raw.departureDate, raw.departuredate];
  for (const fallbackDate of fallbackDates) {
    const normalized = asIsoDate(fallbackDate);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique).sort();
}

function extractGlobalHotels(raw: RawGlobalTour): string[] {
  if (Array.isArray(raw.hotels)) {
    const names = raw.hotels
      .map((hotel: any) => (typeof hotel === "string" ? hotel : hotel?.name))
      .filter((name: any) => typeof name === "string" && name.trim())
      .map((name: string) => name.trim());
    if (names.length > 0) return names;
  }

  if (Array.isArray(raw.tour_hotels)) {
    const fromTourHotels = raw.tour_hotels
      .map((item: any) => item?.hotel?.name)
      .filter((name: any) => typeof name === "string" && name.trim())
      .map((name: string) => name.trim());
    if (fromTourHotels.length > 0) return fromTourHotels;
  }

  const fallbackHotel = asNullableString(raw.hotel);
  if (fallbackHotel) {
    return [fallbackHotel];
  }

  return [];
}

function parseAirlines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];

    if (raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => String(entry || "").trim())
            .filter((entry) => entry.length > 0);
        }
      } catch {
        // fall through
      }
    }

    return raw
      .split(/[\n,]/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function asNullableString(value: unknown): string | null {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function mapGlobalTourToGtripTour(raw: RawGlobalTour): Tour {
  const priceRows = getGlobalPriceRows(raw);
  const dates = extractGlobalTourDates(raw, priceRows);
  const rowSeats = priceRows.map((row) => readGlobalPriceRowSeats(row));
  const positiveRowSeats = rowSeats.filter((seatCount) => seatCount > 0);
  const hasRowSeatValues = rowSeats.length > 0;

  const fallbackSeats = Math.max(
    0,
    Math.floor(Number(raw.seats ?? raw.available_seats ?? 0) || 0),
  );

  const seats =
    positiveRowSeats.length > 0
      ? Math.max(...positiveRowSeats)
      : hasRowSeatValues
        ? 0
        : fallbackSeats;

  const availableFromRaw = Math.max(
    0,
    Math.floor(Number(raw.available_seats ?? raw.seats ?? 0) || 0),
  );
  const availableSeats =
    positiveRowSeats.length > 0
      ? Math.max(...positiveRowSeats)
      : hasRowSeatValues
        ? 0
        : availableFromRaw > 0
          ? availableFromRaw
          : seats;

  const rowAdultPrices = priceRows
    .map((row) => readGlobalPriceRowAdultPrice(row))
    .filter((amount) => amount > 0);
  const basePrice =
    rowAdultPrices.length > 0
      ? Math.min(...rowAdultPrices)
      : Math.max(0, Number(raw.base_price || 0) || 0);

  const hotels = extractGlobalHotels(raw);
  const sourceSystem = "global-travel";
  const sourceTourId = String(raw.id ?? "").trim();
  const resolvedTitle = String(raw.title || raw.name || raw.tour_title || "Unnamed Tour");
  const fallbackId = `global:${normalizeTitleKey(resolvedTitle)}:${dates[0] || raw.created_at || "unknown"}`;
  const coverPhoto = asNullableString(raw.cover_photo);

  return {
    id: sourceTourId || fallbackId,
    source_tag: "global" as const,
    source_system: sourceSystem,
    source_tour_id: sourceTourId || null,
    title: resolvedTitle,
    name: resolvedTitle,
    description: raw.description || "",
    creator_name: "Global API",
    tour_number: null,
    dates,
    departure_date: dates[0],
    seats,
    available_seats: availableSeats,
    hotels,
    country: asNullableString(raw.country),
    hotel: asNullableString(raw.hotel),
    country_temperature: asNullableString(raw.country_temperature),
    duration_day: asNullableString(raw.duration_day),
    duration_night: asNullableString(raw.duration_night),
    group_size: asNullableString(raw.group_size),
    is_featured:
      raw.is_featured === true ||
      String(raw.is_featured || "").trim().toLowerCase() === "true",
    genre: asNullableString(raw.genre),
    airlines: parseAirlines(raw.airlines),
    services: [],
    base_price: basePrice,
    created_by: "global-api",
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    status: "active",
    show_in_provider: true,
    show_to_user: true,
    booking_confirmation: null,
    image_key: coverPhoto,
    cover_photo: coverPhoto,
  };
}

export function mergeGlobalToursWithLocal(
  globalTours: Tour[],
  localTours: Tour[],
): Tour[] {
  const localByCanonicalKey = new Map<string, Tour>();
  const localByTitleDate = new Map<string, Tour>();
  const localByTitle = new Map<string, Tour>();

  for (const localTour of localTours) {
    const canonicalKey = buildCanonicalTourKey(
      localTour.source_system,
      localTour.source_tour_id,
    );
    if (canonicalKey && !localByCanonicalKey.has(canonicalKey)) {
      localByCanonicalKey.set(canonicalKey, localTour);
    }

    const titleDateKey = buildTitleDateKey(
      localTour.title,
      getPrimaryTourDate(localTour),
    );
    if (titleDateKey && !localByTitleDate.has(titleDateKey)) {
      localByTitleDate.set(titleDateKey, localTour);
    }

    const titleKey = normalizeTitleKey(localTour.title);
    if (titleKey && !localByTitle.has(titleKey)) {
      localByTitle.set(titleKey, localTour);
    }
  }

  const matchedLocalIds = new Set<string>();

  const merged = globalTours.map((globalTour) => {
    const canonicalKey = buildCanonicalTourKey(
      globalTour.source_system || "global-travel",
      globalTour.source_tour_id || globalTour.id,
    );
    const titleDateKey = buildTitleDateKey(
      globalTour.title,
      getPrimaryTourDate(globalTour),
    );
    const titleKey = normalizeTitleKey(globalTour.title);

    const localMatch =
      (canonicalKey ? localByCanonicalKey.get(canonicalKey) : undefined) ||
      (titleDateKey ? localByTitleDate.get(titleDateKey) : undefined) ||
      (titleKey ? localByTitle.get(titleKey) : undefined);

    if (!localMatch) return globalTour;

    matchedLocalIds.add(String(localMatch.id));

    const localAvailableSeats =
      typeof localMatch.available_seats === "number" &&
      Number.isFinite(localMatch.available_seats)
        ? Math.max(0, Math.floor(localMatch.available_seats))
        : null;

    const globalAvailableSeats =
      typeof globalTour.available_seats === "number" &&
      Number.isFinite(globalTour.available_seats)
        ? Math.max(0, Math.floor(globalTour.available_seats))
        : null;

    const mergedAvailableSeats =
      globalAvailableSeats !== null && globalAvailableSeats > 0
        ? globalAvailableSeats
        : localAvailableSeats !== null && localAvailableSeats > 0
          ? localAvailableSeats
          : globalAvailableSeats ?? localAvailableSeats;

    return {
      ...globalTour,
      source_tag: "global+local" as const,
      id: localMatch.id,
      source_system:
        localMatch.source_system || globalTour.source_system || null,
      source_tour_id:
        localMatch.source_tour_id || globalTour.source_tour_id || null,
      seats: globalTour.seats > 0 ? globalTour.seats : localMatch.seats,
      available_seats: mergedAvailableSeats ?? undefined,
      dates:
        Array.isArray(globalTour.dates) && globalTour.dates.length > 0
          ? globalTour.dates
          : localMatch.dates,
      departure_date: globalTour.departure_date || localMatch.departure_date,
      status: localMatch.status || globalTour.status,
      show_in_provider:
        localMatch.show_in_provider ?? globalTour.show_in_provider ?? true,
      show_to_user: localMatch.show_to_user ?? globalTour.show_to_user ?? true,
      created_by: localMatch.created_by || globalTour.created_by,
      image_key: globalTour.image_key || localMatch.image_key || null,
      cover_photo:
        globalTour.cover_photo ||
        localMatch.cover_photo ||
        globalTour.image_key ||
        localMatch.image_key ||
        null,
      country: globalTour.country || localMatch.country || null,
      hotel: globalTour.hotel || localMatch.hotel || null,
      country_temperature:
        globalTour.country_temperature || localMatch.country_temperature || null,
      duration_day: globalTour.duration_day || localMatch.duration_day || null,
      duration_night:
        globalTour.duration_night || localMatch.duration_night || null,
      group_size: globalTour.group_size || localMatch.group_size || null,
      is_featured: globalTour.is_featured ?? localMatch.is_featured ?? false,
      genre: globalTour.genre || localMatch.genre || null,
      airlines:
        Array.isArray(globalTour.airlines) && globalTour.airlines.length > 0
          ? globalTour.airlines
          : localMatch.airlines || [],
      booking_confirmation: localMatch.booking_confirmation || null,
    };
  });

  if (!useGlobalToursFallbackLocal) {
    return merged;
  }

  const localOnly = localTours.filter(
    (tour) => !matchedLocalIds.has(String(tour.id)),
  );
  return [...merged, ...localOnly];
}

type LocalTourSyncRow = {
  id: string;
  title?: string | null;
  source_system?: string | null;
  source_tour_id?: string | null;
  departure_date?: string | null;
  departuredate?: string | null;
  dates?: string[] | null;
};

export type GlobalLocalSyncResult = {
  totalGlobal: number;
  inserted: number;
  updated: number;
  linked: number;
  skipped: number;
};

const isMissingColumnError = (error: any) => {
  const message = String(
    error?.message || error?.details || error?.hint || "",
  ).toLowerCase();

  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes("column") ||
    message.includes("schema cache")
  );
};

function normalizeLocalTourDate(row: LocalTourSyncRow) {
  if (Array.isArray(row.dates) && row.dates.length > 0) {
    const fromDates = normalizeDateKey(String(row.dates[0] || ""));
    if (fromDates) {
      return fromDates;
    }
  }

  const modern = normalizeDateKey(row.departure_date);
  if (modern) {
    return modern;
  }

  return normalizeDateKey(row.departuredate);
}

async function loadLocalToursForSync() {
  const selectCandidates = [
    "id,title,source_system,source_tour_id,departure_date,departuredate,dates",
    "id,title,source_system,source_tour_id,departuredate,dates",
    "id,title,source_system,source_tour_id,departure_date",
    "id,title,departure_date,departuredate,dates",
    "id,title,departuredate,dates",
    "id,title,departure_date",
    "id,title",
  ];

  let lastError: unknown = null;

  for (const selectColumns of selectCandidates) {
    const { data, error } = await supabase.from("tours").select(selectColumns);
    if (!error) {
      const supportsSourceColumns =
        selectColumns.includes("source_system") &&
        selectColumns.includes("source_tour_id");

      return {
        rows: (data || []) as unknown as LocalTourSyncRow[],
        supportsSourceColumns,
      };
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  throw (
    lastError || new Error("Failed to read local tours for Global sync")
  );
}

function findLocalTourMatch(
  localRows: LocalTourSyncRow[],
  globalTour: Tour,
  supportsSourceColumns: boolean,
): { row: LocalTourSyncRow; mode: "updated" | "linked" } | null {
  const sourceTourId = String(globalTour.source_tour_id || "").trim();

  if (supportsSourceColumns && sourceTourId) {
    const bySource = localRows.find((row) => {
      return (
        normalizeIdentityKey(row.source_system) === "global-travel" &&
        String(row.source_tour_id || "").trim() === sourceTourId
      );
    });

    if (bySource) {
      return { row: bySource, mode: "updated" };
    }
  }

  const titleKey = normalizeTitleKey(globalTour.title || globalTour.name);
  if (!titleKey) {
    return null;
  }

  const primaryDate = normalizeDateKey(getPrimaryTourDate(globalTour));
  if (primaryDate) {
    const byTitleDate = localRows.find((row) => {
      return (
        normalizeTitleKey(row.title) === titleKey &&
        normalizeLocalTourDate(row) === primaryDate
      );
    });

    if (byTitleDate) {
      return { row: byTitleDate, mode: "linked" };
    }
  }

  const byTitle = localRows.find((row) => normalizeTitleKey(row.title) === titleKey);
  if (byTitle) {
    return { row: byTitle, mode: "linked" };
  }

  return null;
}

function createLocalPayloadVariants(
  globalTour: Tour,
  input: {
    supportsSourceColumns: boolean;
    actorUserId?: string | null;
    includeCreatedFields: boolean;
  },
) {
  const primaryDate = normalizeDateKey(getPrimaryTourDate(globalTour));
  const normalizedDates = Array.isArray(globalTour.dates)
    ? globalTour.dates
        .map((date) => normalizeDateKey(date))
        .filter((date) => date.length > 0)
    : [];

  if (normalizedDates.length === 0 && primaryDate) {
    normalizedDates.push(primaryDate);
  }

  const normalizedHotels = Array.isArray(globalTour.hotels)
    ? globalTour.hotels
        .map((hotel) => String(hotel || "").trim())
        .filter((hotel) => hotel.length > 0)
    : typeof globalTour.hotels === "string"
      ? globalTour.hotels
          .split(/[\n,]/g)
          .map((hotel) => hotel.trim())
          .filter((hotel) => hotel.length > 0)
      : [];

  const safeSeats = Math.max(0, Math.floor(Number(globalTour.seats) || 0));
  const safeAvailableSeats = Math.max(
    0,
    Math.floor(Number(globalTour.available_seats ?? globalTour.seats) || 0),
  );

  const basePayload: Record<string, unknown> = {
    title: String(globalTour.title || globalTour.name || "Unnamed Tour").trim(),
    name: String(globalTour.name || globalTour.title || "Unnamed Tour").trim(),
    description: globalTour.description || "",
    seats: safeSeats,
    available_seats: safeAvailableSeats,
    hotels: normalizedHotels,
    services: Array.isArray(globalTour.services) ? globalTour.services : [],
    base_price: Number(globalTour.base_price || 0),
    status: globalTour.status || "active",
    show_in_provider: globalTour.show_in_provider ?? true,
    show_to_user: globalTour.show_to_user ?? true,
    image_key: globalTour.image_key || globalTour.cover_photo || null,
    updated_at: new Date().toISOString(),
  };

  if (input.supportsSourceColumns && globalTour.source_tour_id) {
    basePayload.source_system = "global-travel";
    basePayload.source_tour_id = globalTour.source_tour_id;
  }

  const createdFields: Record<string, unknown> = input.includeCreatedFields
    ? {
        creator_name: "Global API",
        created_by: input.actorUserId || null,
        created_at: globalTour.created_at || new Date().toISOString(),
      }
    : {};

  return [
    {
      ...basePayload,
      ...createdFields,
      dates: normalizedDates,
      departure_date: primaryDate || null,
    },
    {
      ...basePayload,
      ...createdFields,
      dates: normalizedDates,
      departuredate: primaryDate || null,
    },
    {
      ...basePayload,
      ...createdFields,
      departure_date: primaryDate || null,
    },
    {
      ...basePayload,
      ...createdFields,
      departuredate: primaryDate || null,
    },
  ];
}

async function updateLocalTourWithFallback(
  localTourId: string,
  globalTour: Tour,
  input: { supportsSourceColumns: boolean },
) {
  const payloads = createLocalPayloadVariants(globalTour, {
    supportsSourceColumns: input.supportsSourceColumns,
    includeCreatedFields: false,
  });

  let lastError: unknown = null;

  for (const payload of payloads) {
    const { error } = await supabase.from("tours").update(payload).eq("id", localTourId);
    if (!error) {
      return;
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  throw (
    lastError || new Error("Unable to update local tour from Global tour")
  );
}

async function insertLocalTourWithFallback(
  globalTour: Tour,
  input: {
    supportsSourceColumns: boolean;
    actorUserId?: string | null;
  },
) {
  const payloads = createLocalPayloadVariants(globalTour, {
    supportsSourceColumns: input.supportsSourceColumns,
    actorUserId: input.actorUserId,
    includeCreatedFields: true,
  });

  let lastError: unknown = null;

  for (const payload of payloads) {
    const { data, error } = await supabase
      .from("tours")
      .insert(payload)
      .select("id")
      .single();

    if (!error) {
      return String(data?.id || "").trim() || null;
    }

    lastError = error;
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  throw (
    lastError || new Error("Unable to insert local tour from Global tour")
  );
}

export async function syncGlobalToursToLocal(input?: {
  globalTours?: Tour[];
  actorUserId?: string | null;
}) {
  const { data } = await syncGlobalTours({
    dryRun: false,
    sourceSystem: "global-travel",
    tours: input?.globalTours as Array<Record<string, unknown>> | undefined,
  });

  return {
    totalGlobal: data.fetched,
    inserted: data.inserted,
    updated: data.updated,
    linked: data.linked,
    skipped: data.skipped,
  } satisfies GlobalLocalSyncResult;
}

export async function ensureGlobalTourBookableInLocal(
  tour: Tour,
  actorUserId?: string | null,
) {
  void actorUserId;

  const sourceTag = tour.source_tag ?? "local";
  if (sourceTag !== "global") {
    return String(tour.id || "").trim() || null;
  }

  const remoteTourId = String(tour.source_tour_id || tour.id || "").trim();
  if (!remoteTourId) {
    return null;
  }

  const { data } = await ensureGlobalTourBookable({ remoteTourId });

  return String(data.localTourId || "").trim() || null;
}

function normalizeOrder(raw: MaybeOrder): Order {
  const passengers = Array.isArray(raw.passengers) ? raw.passengers : [];
  const passengerRequests = Array.isArray(raw.passenger_requests)
    ? raw.passenger_requests
    : [];
  const departureFromSelected =
    raw.selected_departure?.departure_date ||
    raw.selected_departure?.departureDate ||
    raw.selected_departure?.date ||
    undefined;

  return {
    source: "global",
    id: String(raw.id ?? raw.order_id ?? raw.invoice_id ?? ""),
    user_id: String(raw.user_id ?? ""),
    tour_id: String(raw.tour_id ?? ""),
    phone: raw.phone ?? null,
    last_name: raw.last_name ?? null,
    first_name: raw.first_name ?? null,
    email: raw.email ?? null,
    age: raw.age ?? null,
    gender: raw.gender ?? null,
    tour: raw.tours?.title ?? raw.tour ?? raw.tour_title ?? null,
    passport_number: raw.passport_number ?? null,
    passport_expire: raw.passport_expire ?? null,
    created_by: raw.created_by ? String(raw.created_by) : null,
    createdBy: raw.createdBy ?? null,
    status: normalizeOrderStatus(raw.status ?? raw.payment_status),
    hotel: raw.hotel ?? null,
    room_number: raw.room_number ?? null,
    payment_method: raw.payment_method ?? null,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? new Date().toISOString(),
    passenger_count:
      Number(raw.passenger_count) ||
      passengers.length + passengerRequests.length,
    departureDate:
      raw.departureDate ||
      raw.departure_date ||
      departureFromSelected ||
      undefined,
    total_price: Number(raw.total_price) || 0,
    total_amount: Number(raw.total_amount) || 0,
    paid_amount: Number(raw.paid_amount) || 0,
    balance: Number(raw.balance) || 0,
    show_in_provider: Boolean(raw.show_in_provider),
    order_id: String(raw.order_id ?? raw.id ?? raw.invoice_id ?? ""),
    booking_confirmation: raw.booking_confirmation ?? null,
    passengers,
    passenger_requests: passengerRequests,
    room_allocation: raw.room_allocation ?? "",
    travel_group: raw.travel_group ?? null,
    note: raw.note ?? null,
    tour_title: raw.tour_title ?? raw.tours?.title ?? undefined,
    passport_copy: raw.passport_copy ?? null,
    passport_copy_url: raw.passport_copy_url ?? null,
    commission: raw.commission ?? null,
    edited_by: raw.edited_by ?? null,
    edited_at: raw.edited_at ?? null,
    travel_choice: raw.travel_choice ?? "",
  };
}

function extractArrayPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.data,
    payload.tours,
    payload.orders,
    payload.items,
    payload.results,
    payload.payments,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

export async function fetchOrdersFromGlobalApi(): Promise<Order[]> {
  const candidateOrderPaths = buildApiPathCandidates(globalOrdersPath, [
    "/api/payments",
  ]);

  if (!isGlobalApiEnabled) {
    throw new Error("Global API mode disabled");
  }

  let payload: unknown;
  if (shouldUseBackendProxy()) {
    payload = await fetchJsonViaBackendProxy(BACKEND_ORDERS_PROXY_PATH);
  } else {
    if (getCandidateBases().length === 0) {
      throw new Error("Global API mode disabled");
    }
    payload = (await fetchFirstAvailable(candidateOrderPaths)).payload;
  }

  const rows = extractArrayPayload(payload);

  if (!Array.isArray(rows)) {
    throw new Error("Invalid orders payload from Global API");
  }

  return rows.map((row: MaybeOrder) => normalizeOrder(row));
}

export async function fetchToursFromGlobalApi(): Promise<Tour[]> {
  const candidateTourPaths = buildApiPathCandidates(globalToursPath, [
    "/api/tours",
  ]);

  if (!isGlobalApiEnabled) {
    throw new Error("Global API mode disabled");
  }

  let payload: unknown;
  if (shouldUseBackendProxy()) {
    payload = await fetchJsonViaBackendProxy(BACKEND_TOURS_PROXY_PATH);
  } else {
    if (getCandidateBases().length === 0) {
      throw new Error("Global API mode disabled");
    }
    payload = (await fetchFirstAvailable(candidateTourPaths)).payload;
  }

  const rows = extractArrayPayload(payload);

  return rows
    .filter((row: RawGlobalTour) => Boolean(row?.title || row?.name))
    .map((row: RawGlobalTour) => mapGlobalTourToGtripTour(row));
}

export async function fetchGlobalApiSnapshot(): Promise<GlobalApiSnapshot> {
  if (shouldUseBackendProxy()) {
    try {
      const toursPayload = await fetchJsonViaBackendProxy(BACKEND_TOURS_PROXY_PATH);
      const tours = extractArrayPayload(toursPayload);

      let ordersCount: number | null = null;
      try {
        const ordersPayload = await fetchJsonViaBackendProxy(BACKEND_ORDERS_PROXY_PATH);
        const orders = extractArrayPayload(ordersPayload);
        ordersCount = Array.isArray(orders) ? orders.length : null;
      } catch {
        ordersCount = null;
      }

      return {
        online: true,
        message: "Global API connected",
        toursCount: Array.isArray(tours) ? tours.length : null,
        ordersCount,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        online: false,
        message: error?.message || "Unable to reach Global API",
        toursCount: null,
        ordersCount: null,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  if (getCandidateBases().length === 0) {
    return {
      online: false,
      message: "Global API URL is not configured",
      toursCount: null,
      ordersCount: null,
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const candidateTourPaths = buildApiPathCandidates(globalToursPath, [
      "/api/tours",
    ]);
    const { payload: toursPayload } = await fetchFirstAvailable(candidateTourPaths);

    const tours = extractArrayPayload(toursPayload);

    return {
      online: true,
      message: "Global API connected",
      toursCount: Array.isArray(tours) ? tours.length : null,
      ordersCount: null,
      checkedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      online: false,
      message: error?.message || "Unable to reach Global API",
      toursCount: null,
      ordersCount: null,
      checkedAt: new Date().toISOString(),
    };
  }
}
