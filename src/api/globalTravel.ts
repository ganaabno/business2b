import { VALID_ORDER_STATUSES, type Order, type Tour } from "../types/type";

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

export const isGlobalApiEnabled =
  globalApiEnabledRaw.trim().toLowerCase() === "true";

const globalToursPrimaryRaw =
  (import.meta.env.VITE_USE_GLOBAL_TOURS_PRIMARY as string | undefined) || "";
const globalToursFallbackRaw =
  (import.meta.env.VITE_GLOBAL_TOURS_FALLBACK_LOCAL as string | undefined) ||
  "";

export const useGlobalToursPrimary =
  globalToursPrimaryRaw.trim().toLowerCase() === "true";
export const useGlobalToursFallbackLocal =
  globalToursFallbackRaw.trim().toLowerCase() !== "false";

const globalApiTimeoutMs = (() => {
  const parsed = Number(globalApiTimeoutRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8000;
  return parsed;
})();

const endpointCooldownUntil = new Map<string, number>();
const ENDPOINT_COOLDOWN_MS = 60_000;

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
  created_at?: string;
  updated_at?: string;
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

function getGlobalPriceRows(raw: RawGlobalTour): any[] {
  const rows: any[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.endsWith("_price_table")) continue;
    if (!Array.isArray(value)) continue;
    for (const row of value) {
      if (row && typeof row === "object") {
        rows.push(row);
      }
    }
  }
  return rows;
}

function extractGlobalTourDates(rows: any[]): string[] {
  const unique = new Set<string>();
  for (const row of rows) {
    const date = row?.departure_date;
    if (typeof date === "string" && date.trim()) {
      unique.add(date.trim());
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
  const dates = extractGlobalTourDates(priceRows);
  const firstRow = priceRows[0] || {};
  const seats = Number(firstRow.seats ?? 0) || 0;
  const basePrice =
    Number(firstRow.adult_price ?? firstRow?.prices?.adult_price ?? 0) || 0;
  const hotels = extractGlobalHotels(raw);
  const sourceSystem = "global-travel";
  const sourceTourId = String(raw.id ?? "").trim();
  const fallbackId = `global:${normalizeTitleKey(raw.title)}:${dates[0] || raw.created_at || "unknown"}`;
  const coverPhoto = asNullableString(raw.cover_photo);

  return {
    id: sourceTourId || fallbackId,
    source_tag: "global" as const,
    source_system: sourceSystem,
    source_tour_id: sourceTourId || null,
    title: String(raw.title || "Unnamed Tour"),
    name: String(raw.title || "Unnamed Tour"),
    description: raw.description || "",
    creator_name: "Global API",
    tour_number: null,
    dates,
    departure_date: dates[0],
    seats,
    available_seats: seats,
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

    return {
      ...globalTour,
      source_tag: "global+local" as const,
      id: localMatch.id,
      source_system:
        localMatch.source_system || globalTour.source_system || null,
      source_tour_id:
        localMatch.source_tour_id || globalTour.source_tour_id || null,
      seats: globalTour.seats > 0 ? globalTour.seats : localMatch.seats,
      available_seats:
        typeof localMatch.available_seats === "number"
          ? localMatch.available_seats
          : globalTour.available_seats,
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

  if (!isGlobalApiEnabled || getCandidateBases().length === 0) {
    throw new Error("Global API mode disabled");
  }

  const { payload } = await fetchFirstAvailable(candidateOrderPaths);
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

  if (!isGlobalApiEnabled || getCandidateBases().length === 0) {
    throw new Error("Global API mode disabled");
  }

  const { payload } = await fetchFirstAvailable(candidateTourPaths);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  if (!Array.isArray(rows)) {
    throw new Error("Invalid tours payload from Global API");
  }

  return rows
    .filter((row: RawGlobalTour) => Boolean(row?.title))
    .map((row: RawGlobalTour) => mapGlobalTourToGtripTour(row));
}

export async function fetchGlobalApiSnapshot(): Promise<GlobalApiSnapshot> {
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
