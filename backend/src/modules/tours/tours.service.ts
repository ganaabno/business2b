import { env } from "../../config/env.js";
import { q, withTransaction } from "../../db/transaction.js";
import { ApiError, badRequest, forbidden } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AuthUser } from "../../shared/types/auth.js";
import {
  createGlobalPriceTableRow,
  createGlobalTour,
  deleteGlobalTour,
  extractGlobalTourId,
  mapLocalTourToGlobalPayload,
  patchGlobalPriceTableRow,
  updateGlobalPriceTableRow,
  updateGlobalTour,
} from "../../integrations/globalTravel/globalTravelWrite.client.js";
import {
  classifyTourSyncActionRepo,
  getGlobalToursSyncStatusRepo,
  getLegacyRouteBasePricesRepo,
  listTourDestinationsRepo,
  searchToursRepo,
  type TourSyncRowInput,
  upsertTourFromSourceLegacyCompatRepo,
  upsertTourFromSourceRepo,
} from "./tours.repo.js";
import { getSeatAccessRequestByIdRepo } from "../seatAccessRequests/seatAccessRequests.repo.js";
import {
  type EnsureGlobalTourBookableInput,
  type ListTourDestinationsFilters,
  parseSearchToursFilters,
  type PushGlobalTourInput,
  type SyncGlobalPriceRowCanonicalInput,
  type SyncGlobalPriceRowInput,
} from "./tours.schema.js";

const discoveredRailwayApiBase = "https://b2c-production.up.railway.app";

type RawGlobalTour = {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  departure_date?: string;
  departureDate?: string;
  departuredate?: string;
  dates?: unknown;
  seats?: number | string;
  available_seats?: number | string;
  base_price?: number | string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  cover_photo?: string;
  country?: string;
  hotel?: string;
  country_temperature?: string;
  duration_day?: string | number;
  duration_night?: string | number;
  group_size?: string | number;
  is_featured?: boolean | string | number;
  genre?: string;
  airlines?: unknown;
  hotels?: Array<{ name?: string } | string>;
  tour_hotels?: Array<{ hotel?: { name?: string } }>;
  services?: Array<{ name?: string; price?: number | string }>;
  show_in_provider?: boolean;
  show_to_user?: boolean;
  priceTable?: unknown;
  price_table?: unknown;
  [key: string]: unknown;
};

export type SyncGlobalToursInput = {
  dryRun: boolean;
  sourceSystem: string;
  tours?: unknown[];
};

type SyncSkippedRow = {
  index: number;
  reason: string;
  sourceTourId: string | null;
  title: string | null;
};

export type SyncGlobalToursResult = {
  sourceSystem: string;
  fetched: number;
  normalized: number;
  inserted: number;
  updated: number;
  linked: number;
  skipped: number;
  dryRun: boolean;
  skippedRows: SyncSkippedRow[];
  processedAt: string;
};

export type PushGlobalTourResult = {
  action: "create" | "update" | "delete";
  remoteAction: "created" | "updated" | "deleted" | "skipped";
  remoteTourId: string | null;
  localTourId: string | null;
  syncedAt: string;
  warning: string | null;
};

export type SyncGlobalPriceRowResult = {
  remoteTourId: string;
  localTourId: string | null;
  departureDate: string;
  seats: number;
  rowId: string;
  tableName: string;
  syncedAt: string;
};

export type SyncGlobalPriceRowCanonicalResult = {
  status: "synced" | "skipped";
  reason: string | null;
  remoteTourId: string | null;
  localTourId: string;
  departureDate: string;
  seats: number;
  rowId: string | null;
  tableName: string | null;
  syncedAt: string;
};

export type EnsureGlobalTourBookableResult = {
  remoteTourId: string;
  localTourId: string;
  action: "inserted" | "updated" | "linked";
  sourceSystem: string;
  syncedAt: string;
};

export type GlobalToursSyncStatus = {
  sourceSystem: string;
  enabled: boolean;
  intervalMs: number;
  staleThresholdMs: number;
  staleMs: number | null;
  healthy: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  failureStreak: number;
  lastDurationMs: number | null;
  metrics: {
    fetched: number | null;
    normalized: number | null;
    inserted: number | null;
    updated: number | null;
    linked: number | null;
    skipped: number | null;
    dryRun: boolean | null;
  };
  updatedAt: string | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DESTINATION_CACHE_TTL_MS = env.isProduction ? 60_000 : 20_000;
const DESTINATION_CACHE_MAX_ITEMS = 200;

type DestinationCacheEntry = {
  data: string[];
  expiresAt: number;
};

const destinationCache = new Map<string, DestinationCacheEntry>();

type SearchToursServiceDeps = {
  searchToursRepo: typeof searchToursRepo;
  getSeatAccessRequestByIdRepo: typeof getSeatAccessRequestByIdRepo;
};

type PushGlobalTourServiceDeps = {
  createGlobalTour: typeof createGlobalTour;
  updateGlobalTour: typeof updateGlobalTour;
  deleteGlobalTour: typeof deleteGlobalTour;
  extractGlobalTourId: typeof extractGlobalTourId;
  findRawGlobalTourByRemoteId: typeof findRawGlobalTourByRemoteId;
  syncGlobalPriceRowForPush: typeof syncGlobalPriceRowForPush;
  linkLocalTourToGlobalSource: typeof linkLocalTourToGlobalSource;
  isGlobalTourNotFoundError: typeof isGlobalTourNotFoundError;
};

const defaultSearchToursServiceDeps: SearchToursServiceDeps = {
  searchToursRepo,
  getSeatAccessRequestByIdRepo,
};

const searchToursServiceDeps: SearchToursServiceDeps = {
  ...defaultSearchToursServiceDeps,
};

const defaultPushGlobalTourServiceDeps: PushGlobalTourServiceDeps = {
  createGlobalTour,
  updateGlobalTour,
  deleteGlobalTour,
  extractGlobalTourId,
  findRawGlobalTourByRemoteId,
  syncGlobalPriceRowForPush,
  linkLocalTourToGlobalSource,
  isGlobalTourNotFoundError,
};

const pushGlobalTourServiceDeps: PushGlobalTourServiceDeps = {
  ...defaultPushGlobalTourServiceDeps,
};

export function __setSearchToursServiceDepsForTests(
  overrides: Partial<SearchToursServiceDeps>,
) {
  Object.assign(searchToursServiceDeps, overrides);
}

export function __resetSearchToursServiceDepsForTests() {
  Object.assign(searchToursServiceDeps, defaultSearchToursServiceDeps);
}

export function __setPushGlobalTourServiceDepsForTests(
  overrides: Partial<PushGlobalTourServiceDeps>,
) {
  Object.assign(pushGlobalTourServiceDeps, overrides);
}

export function __resetPushGlobalTourServiceDepsForTests() {
  Object.assign(pushGlobalTourServiceDeps, defaultPushGlobalTourServiceDeps);
}

const normalizePath = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

function buildGlobalApiPathCandidates(configuredPath: string, defaults: string[]) {
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

function destinationCacheKey(filters: ListTourDestinationsFilters) {
  const from = String(filters.from || "").trim();
  const to = String(filters.to || "").trim();
  const minSeats =
    typeof filters.minSeats === "number" && Number.isFinite(filters.minSeats)
      ? String(Math.max(1, Math.floor(filters.minSeats)))
      : "";

  return `${from}::${to}::${minSeats}`;
}

function readDestinationCache(key: string): string[] | null {
  const entry = destinationCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    destinationCache.delete(key);
    return null;
  }

  return entry.data;
}

function writeDestinationCache(key: string, data: string[]) {
  destinationCache.set(key, {
    data,
    expiresAt: Date.now() + DESTINATION_CACHE_TTL_MS,
  });

  if (destinationCache.size <= DESTINATION_CACHE_MAX_ITEMS) {
    return;
  }

  const now = Date.now();
  for (const [cacheKey, cacheEntry] of destinationCache.entries()) {
    if (cacheEntry.expiresAt <= now) {
      destinationCache.delete(cacheKey);
    }
  }

  while (destinationCache.size > DESTINATION_CACHE_MAX_ITEMS) {
    const oldestKey = destinationCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    destinationCache.delete(oldestKey);
  }
}

function getCandidateGlobalApiBases() {
  const configured = (env.globalToursApiBaseUrl || "").trim();
  const deduped = new Set<string>();

  if (configured) {
    deduped.add(configured.replace(/\/$/, ""));
  }
  deduped.add(discoveredRailwayApiBase);

  return Array.from(deduped);
}

const asFiniteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asIsoDate = (value: unknown): string | null => {
  const text = String(value || "").trim();
  if (!text) return null;
  const candidate = text.slice(0, 10);
  if (!ISO_DATE_RE.test(candidate)) return null;
  return candidate;
};

const asNullableString = (value: unknown) => {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
};

const LEGACY_ROUTE_HINTS: Array<{ route: string; hints: string[] }> = [
  { route: "beijing_janjieje", hints: ["бээжин", "beijing", "пекин"] },
  {
    route: "ho_chi_minh_phu_quoc",
    hints: ["хошимин", "хо ши мин", "ho chi minh"],
  },
  {
    route: "thailand_banggok",
    hints: ["бангкок", "bangkok", "паттая", "pattaya"],
  },
  { route: "shanghai", hints: ["шанхай", "shanghai"] },
  { route: "janjieje", hints: ["жанжиажэ", "janjieje", "zhangjiajie"] },
  { route: "hainan", hints: ["хайнан", "hainan", "санья", "sanya"] },
  { route: "nha_trang", hints: ["натранг", "nha trang"] },
  { route: "phu_quoc", hints: ["фукуок", "phu quoc", "phuquoc"] },
  { route: "phuket", hints: ["пүкет", "phuket"] },
  { route: "halong_bay", hints: ["halong", "ха лонг"] },
  { route: "singapore", hints: ["сингапур", "singapore"] },
  { route: "turkey", hints: ["турк", "turkey", "istanbul"] },
  { route: "japan", hints: ["япон", "japan", "tokyo"] },
  { route: "bali", hints: ["бали", "bali"] },
  { route: "dalyan", hints: ["dalyan", "далянь"] },
  { route: "georgia", hints: ["гүрж", "georgia", "tbilisi"] },
];

function detectLegacyPriceRoute(texts: Array<string | null | undefined>) {
  const source = texts
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .filter((value) => value.length > 0)
    .join(" ");
  if (!source) return null;

  const matched = LEGACY_ROUTE_HINTS.find((entry) =>
    entry.hints.some((hint) => source.includes(hint)),
  );

  return matched?.route || null;
}

async function enrichLegacyBasePrices(params: {
  rows: Array<{
    id: string;
    title: string;
    destination: string;
    base_price: number | string;
  }>;
  from: string;
  to: string;
}) {
  const routesByTourId = new Map<string, string>();
  const routes = new Set<string>();

  params.rows.forEach((row) => {
    if (Number(row.base_price || 0) > 0) return;
    const route = detectLegacyPriceRoute([row.title, row.destination]);
    if (!route) return;
    routesByTourId.set(row.id, route);
    routes.add(route);
  });

  if (routes.size === 0) {
    return params.rows;
  }

  const pricesByRoute = await getLegacyRouteBasePricesRepo({
    from: params.from,
    to: params.to,
    routes: Array.from(routes),
  });

  if (pricesByRoute.size === 0) {
    return params.rows;
  }

  return params.rows.map((row) => {
    if (Number(row.base_price || 0) > 0) return row;
    const route = routesByTourId.get(row.id);
    if (!route) return row;
    const fallbackPrice = pricesByRoute.get(route);
    if (!fallbackPrice || fallbackPrice <= 0) return row;

    return {
      ...row,
      base_price: fallbackPrice,
    };
  });
}

const normalizeStatus = (value: unknown): TourSyncRowInput["status"] => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "active";

  if (raw === "active") return "active";
  if (raw === "inactive") return "inactive";
  if (raw === "hidden") return "hidden";
  if (raw === "pending") return "pending";
  if (raw === "full" || raw === "sold_out" || raw === "sold-out") return "full";
  if (raw === "completed" || raw === "finished") return "completed";

  return "active";
};

const extractArrayPayload = (payload: unknown) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const value = payload as Record<string, unknown>;
  const candidates = [value.data, value.items, value.results, value.tours];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
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
  return Math.max(0, Math.floor(asFiniteNumber(row.seats ?? row.available_seats)));
}

function readGlobalPriceRowAdultPrice(row: Record<string, unknown>) {
  const nestedPrices =
    row.prices && typeof row.prices === "object" && !Array.isArray(row.prices)
      ? (row.prices as Record<string, unknown>)
      : null;

  return Math.max(
    0,
    asFiniteNumber(row.adult_price ?? row.price ?? nestedPrices?.adult_price),
  );
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

type GlobalPriceRowCandidate = {
  tableName: string;
  rowId: string;
  departureDate: string;
  availability: string;
};

function collectGlobalPriceRowCandidates(
  raw: RawGlobalTour,
): GlobalPriceRowCandidate[] {
  const candidates: GlobalPriceRowCandidate[] = [];

  const appendFromTable = (tableNameHint: string, value: unknown) => {
    const rows: Array<Record<string, unknown>> = [];
    appendGlobalPriceRows(rows, value);

    const sourceRecord =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

    const nestedTableName =
      asNullableString(sourceRecord?.table_name) ||
      asNullableString(sourceRecord?.tableName) ||
      asNullableString(sourceRecord?.route_name) ||
      asNullableString(sourceRecord?.routeName) ||
      asNullableString(sourceRecord?.name);

    const tableName =
      tableNameHint === "price_table" && nestedTableName
        ? nestedTableName
        : tableNameHint;

    for (const row of rows) {
      const rowId = asNullableString(row.id);
      const departureDate = readGlobalPriceRowDate(row);

      if (!rowId || !departureDate) {
        continue;
      }

      const availability =
        asNullableString(row.availability) || "Захиалга авч байна";

      candidates.push({
        tableName,
        rowId,
        departureDate,
        availability,
      });
    }
  };

  appendFromTable("price_table", raw.priceTable);
  appendFromTable("price_table", raw.price_table);

  for (const [key, value] of Object.entries(raw)) {
    if (!key.endsWith("_price_table")) continue;
    appendFromTable(key, value);
  }

  return candidates;
}

function extractGlobalTourDates(
  raw: RawGlobalTour,
  priceRows: Array<Record<string, unknown>>,
) {
  const unique = new Set<string>();

  for (const row of priceRows) {
    const date = readGlobalPriceRowDate(row);
    if (date) unique.add(date);
  }

  if (Array.isArray(raw.dates)) {
    for (const dateValue of raw.dates) {
      const date = asIsoDate(dateValue);
      if (date) {
        unique.add(date);
      }
    }
  }

  const fallbackDates = [raw.departure_date, raw.departureDate, raw.departuredate];
  for (const fallbackValue of fallbackDates) {
    const fallbackDate = asIsoDate(fallbackValue);
    if (fallbackDate) {
      unique.add(fallbackDate);
    }
  }

  return Array.from(unique).sort();
}

function extractGlobalHotels(raw: RawGlobalTour) {
  const normalized = new Set<string>();

  if (Array.isArray(raw.hotels)) {
    for (const hotel of raw.hotels) {
      const name =
        typeof hotel === "string"
          ? hotel.trim()
          : typeof hotel?.name === "string"
            ? hotel.name.trim()
            : "";
      if (name) normalized.add(name);
    }
  }

  if (Array.isArray(raw.tour_hotels)) {
    for (const item of raw.tour_hotels) {
      const name =
        typeof item?.hotel?.name === "string" ? item.hotel.name.trim() : "";
      if (name) normalized.add(name);
    }
  }

  const fallbackHotel = asNullableString(raw.hotel);
  if (fallbackHotel) {
    normalized.add(fallbackHotel);
  }

  return Array.from(normalized);
}

function extractGlobalServices(raw: RawGlobalTour) {
  if (!Array.isArray(raw.services)) {
    return [];
  }

  return raw.services
    .map((service) => ({
      name: String(service?.name || "").trim(),
      price: asFiniteNumber(service?.price),
    }))
    .filter((service) => service.name.length > 0);
}

function extractGlobalAirlines(raw: RawGlobalTour) {
  const value = raw.airlines;

  if (Array.isArray(value)) {
    return value
      .map((airline) => String(airline || "").trim())
      .filter((airline) => airline.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((airline) => String(airline || "").trim())
            .filter((airline) => airline.length > 0);
        }
      } catch {
        // fall through
      }
    }

    return trimmed
      .split(/[\n,]/g)
      .map((airline) => airline.trim())
      .filter((airline) => airline.length > 0);
  }

  return [];
}

function mapRawGlobalTourToSyncInput(
  raw: RawGlobalTour,
  sourceSystem: string,
  createdBy: string | null,
): TourSyncRowInput | null {
  const sourceTourId = String(raw.id || "").trim();
  const title = String(raw.title || raw.name || "").trim();

  if (!sourceTourId || !title) {
    return null;
  }

  const priceRows = getGlobalPriceRows(raw);
  const dates = extractGlobalTourDates(raw, priceRows);
  const rowSeats = priceRows.map((row) => readGlobalPriceRowSeats(row));
  const positiveRowSeats = rowSeats.filter((seatCount) => seatCount > 0);
  const hasRowSeatValues = rowSeats.length > 0;
  const fallbackSeats = Math.max(
    0,
    Math.floor(asFiniteNumber(raw.seats ?? raw.available_seats)),
  );

  const seats =
    positiveRowSeats.length > 0
      ? Math.max(...positiveRowSeats)
      : hasRowSeatValues
        ? 0
        : fallbackSeats;

  const rowAdultPrices = priceRows
    .map((row) => readGlobalPriceRowAdultPrice(row))
    .filter((amount) => amount > 0);

  const basePrice =
    rowAdultPrices.length > 0
      ? Math.min(...rowAdultPrices)
      : Math.max(0, asFiniteNumber(raw.base_price));

  return {
    sourceSystem,
    sourceTourId,
    title,
    name: title,
    description: raw.description ? String(raw.description).trim() : null,
    dates,
    departureDate: dates[0] || null,
    seats,
    basePrice,
    hotels: extractGlobalHotels(raw),
    services: extractGlobalServices(raw),
    status: normalizeStatus(raw.status),
    imageKey: raw.cover_photo ? String(raw.cover_photo).trim() : null,
    coverPhoto: raw.cover_photo ? String(raw.cover_photo).trim() : null,
    country: asNullableString(raw.country),
    hotel: asNullableString(raw.hotel),
    countryTemperature: asNullableString(raw.country_temperature),
    durationDay: asNullableString(raw.duration_day),
    durationNight: asNullableString(raw.duration_night),
    groupSize: asNullableString(raw.group_size),
    isFeatured:
      raw.is_featured === true ||
      String(raw.is_featured || "")
        .trim()
        .toLowerCase() === "true",
    genre: asNullableString(raw.genre),
    airlines: extractGlobalAirlines(raw),
    showInProvider:
      typeof raw.show_in_provider === "boolean" ? raw.show_in_provider : true,
    showToUser: typeof raw.show_to_user === "boolean" ? raw.show_to_user : true,
    createdBy,
    sourceUpdatedAt:
      raw.updated_at && String(raw.updated_at).trim()
        ? String(raw.updated_at).trim()
        : raw.created_at && String(raw.created_at).trim()
          ? String(raw.created_at).trim()
          : null,
  };
}

async function fetchGlobalToursFromApi(): Promise<unknown[]> {
  const candidatePaths = buildGlobalApiPathCandidates(env.globalToursApiPath, [
    "/api/tours",
  ]);
  const payload = await fetchGlobalPayloadFromApi(candidatePaths);
  const tours = extractArrayPayload(payload);

  if (!Array.isArray(tours)) {
    throw new Error("Global tours API payload is not an array");
  }

  return tours;
}

async function fetchGlobalPayloadFromApi(candidatePaths: string[]): Promise<unknown> {
  const candidateBases = getCandidateGlobalApiBases();
  if (candidateBases.length === 0) {
    throw badRequest("Global tours API base URL is not configured");
  }

  const normalizedPaths = Array.from(new Set(candidatePaths.map((path) => normalizePath(path))));
  let lastError: Error | null = null;

  for (const baseUrl of candidateBases) {
    for (const requestPath of normalizedPaths) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        env.globalToursApiTimeoutMs,
      );

      try {
        const response = await fetch(`${baseUrl}${requestPath}`, {
          method: "GET",
          signal: controller.signal,
        });

        const rawText = await response.text();
        if (!response.ok) {
          throw new Error(`Global tours API request failed (${response.status})`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
          const preview = rawText.slice(0, 120).replace(/\s+/g, " ").trim();
          throw new Error(
            `Global tours API returned non-JSON payload. Preview: ${preview || "(empty)"}`,
          );
        }

        return JSON.parse(rawText) as unknown;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("global.tours.read_proxy.fetch_failed", {
          baseUrl,
          requestPath,
          error: lastError.message,
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw lastError || new Error("Unable to fetch global tours payload");
}

export async function getGlobalToursProxyPayloadService(_user: AuthUser) {
  void _user;

  const candidatePaths = buildGlobalApiPathCandidates(env.globalToursApiPath, [
    "/api/tours",
  ]);

  try {
    return await fetchGlobalPayloadFromApi(candidatePaths);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown");
    logger.warn("global.tours.proxy.unavailable", {
      error: message,
    });
    throw new ApiError(502, `Global tours proxy unavailable: ${message}`);
  }
}

export async function getGlobalOrdersProxyPayloadService(_user: AuthUser) {
  void _user;

  const candidatePaths = buildGlobalApiPathCandidates(env.globalToursOrdersPath, [
    "/api/payments",
    "/api/orders",
  ]);

  try {
    return await fetchGlobalPayloadFromApi(candidatePaths);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown");
    logger.warn("global.orders.proxy.unavailable", {
      error: message,
    });
    throw new ApiError(502, `Global orders proxy unavailable: ${message}`);
  }
}

async function findRawGlobalTourByRemoteId(remoteTourId: string) {
  const normalizedRemoteTourId = asNullableString(remoteTourId);
  if (!normalizedRemoteTourId) {
    return null;
  }

  const rawRows = await fetchGlobalToursFromApi();
  const rawTour = rawRows.find((row) => {
    if (!row || typeof row !== "object") return false;
    const sourceId = asNullableString((row as RawGlobalTour).id);
    return sourceId === normalizedRemoteTourId;
  }) as RawGlobalTour | undefined;

  return rawTour || null;
}

export async function searchToursService(
  user: AuthUser,
  query: Record<string, unknown>,
) {
  const filters = parseSearchToursFilters(query);

  const runSearch = async (input: {
    from: string;
    to: string;
    destination?: string;
    minSeats?: number;
    minPrice?: number;
    maxPrice?: number;
    allowDestinationRelaxation?: boolean;
  }) => {
    const allowDestinationRelaxation =
      input.allowDestinationRelaxation !== false;

    const scoped = {
      from: input.from,
      to: input.to,
      destination: input.destination,
      minSeats: input.minSeats,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
    };

    const rows = await searchToursServiceDeps.searchToursRepo({
      from: scoped.from,
      to: scoped.to,
      destination: scoped.destination,
      minSeats: scoped.minSeats,
    });
    const enrichedRows = await enrichLegacyBasePrices({
      rows,
      from: scoped.from,
      to: scoped.to,
    });
    const priceFilteredRows = enrichedRows.filter((row) => {
      const basePrice = Number(row.base_price || 0);
      if (typeof scoped.minPrice === "number" && basePrice < scoped.minPrice) {
        return false;
      }
      if (typeof scoped.maxPrice === "number" && basePrice > scoped.maxPrice) {
        return false;
      }
      return true;
    });

    if (
      priceFilteredRows.length > 0 ||
      !scoped.destination ||
      !allowDestinationRelaxation
    ) {
      return priceFilteredRows;
    }

    logger.warn("audit.tours.search.destination_relaxed", {
      actorUserId: user.id,
      actorRole: user.role,
      destination: scoped.destination,
      from: scoped.from,
      to: scoped.to,
    });

    const relaxedRows = await searchToursServiceDeps.searchToursRepo({
      from: scoped.from,
      to: scoped.to,
      destination: undefined,
      minSeats: scoped.minSeats,
    });

    const relaxedEnrichedRows = await enrichLegacyBasePrices({
      rows: relaxedRows,
      from: scoped.from,
      to: scoped.to,
    });

    return relaxedEnrichedRows.filter((row) => {
      const basePrice = Number(row.base_price || 0);
      if (typeof scoped.minPrice === "number" && basePrice < scoped.minPrice) {
        return false;
      }
      if (typeof scoped.maxPrice === "number" && basePrice > scoped.maxPrice) {
        return false;
      }
      return true;
    });
  };

  if (user.role !== "subcontractor" && user.role !== "agent") {
    return runSearch({
      from: filters.from,
      to: filters.to,
      destination: filters.destination,
      minSeats: filters.minSeats,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      allowDestinationRelaxation: true,
    });
  }

  const accessRequestId = filters.accessRequestId || "";
  if (!accessRequestId) {
    throw badRequest(
      "accessRequestId is required for subcontractor/agent tour search",
    );
  }

  const accessRequest =
    await searchToursServiceDeps.getSeatAccessRequestByIdRepo(accessRequestId);
  if (!accessRequest || accessRequest.requester_user_id !== user.id) {
    throw forbidden("Cannot search tours without your approved access request");
  }

  if (accessRequest.status !== "approved") {
    throw badRequest(
      "Seat access request must be approved before searching tours",
    );
  }

  if (
    accessRequest.expires_at &&
    new Date(accessRequest.expires_at).getTime() < Date.now()
  ) {
    throw badRequest("This approval has expired. Please submit a new request");
  }

  return runSearch({
    from: accessRequest.from_date,
    to: accessRequest.to_date,
    destination: accessRequest.destination,
    minSeats: filters.minSeats,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    allowDestinationRelaxation: false,
  });
}

export async function listTourDestinationsService(
  filters: ListTourDestinationsFilters,
) {
  const key = destinationCacheKey(filters);
  const cached = readDestinationCache(key);
  if (cached) {
    return cached;
  }

  const data = await listTourDestinationsRepo(filters);
  writeDestinationCache(key, data);
  return data;
}

export async function getGlobalToursSyncStatusService(): Promise<GlobalToursSyncStatus> {
  const row = await getGlobalToursSyncStatusRepo();

  const sourceSystem =
    String(row?.source_system || "").trim() || env.globalToursSyncSourceSystem;
  const enabled = Boolean(row?.enabled ?? env.globalToursSyncEnabled);
  const intervalMs =
    Number.isFinite(Number(row?.interval_ms)) && Number(row?.interval_ms) > 0
      ? Number(row?.interval_ms)
      : env.globalToursSyncIntervalMs;

  const lastStartedAt = row?.last_started_at || null;
  const lastSuccessAt = row?.last_success_at || null;
  const lastFailureAt = row?.last_failure_at || null;
  const lastFinishedAt = row?.last_finished_at || null;
  const failureStreak = Math.max(0, Number(row?.failure_streak || 0));
  const staleThresholdMs = Math.max(intervalMs * 3, 180_000);

  const lastSuccessMs = lastSuccessAt ? new Date(lastSuccessAt).getTime() : Number.NaN;
  const staleMs = Number.isFinite(lastSuccessMs)
    ? Math.max(0, Date.now() - lastSuccessMs)
    : null;

  const startedMs = lastStartedAt ? new Date(lastStartedAt).getTime() : Number.NaN;
  const finishedMs = lastFinishedAt ? new Date(lastFinishedAt).getTime() : Number.NaN;
  const running = Number.isFinite(startedMs)
    ? !Number.isFinite(finishedMs) || startedMs > finishedMs
    : false;

  const healthy = enabled
    ? staleMs !== null && staleMs <= staleThresholdMs && failureStreak < 5
    : true;

  return {
    sourceSystem,
    enabled,
    intervalMs,
    staleThresholdMs,
    staleMs,
    healthy,
    running,
    lastStartedAt,
    lastSuccessAt,
    lastFailureAt,
    lastFinishedAt,
    lastError: row?.last_error || null,
    failureStreak,
    lastDurationMs:
      row?.last_duration_ms === null || row?.last_duration_ms === undefined
        ? null
        : Math.max(0, Number(row.last_duration_ms || 0)),
    metrics: {
      fetched: row?.last_fetched ?? null,
      normalized: row?.last_normalized ?? null,
      inserted: row?.last_inserted ?? null,
      updated: row?.last_updated ?? null,
      linked: row?.last_linked ?? null,
      skipped: row?.last_skipped ?? null,
      dryRun: row?.last_dry_run ?? null,
    },
    updatedAt: row?.updated_at || null,
  };
}

function isGlobalTourNotFoundError(error: unknown) {
  const message = String((error as { message?: string })?.message || "")
    .trim()
    .toLowerCase();

  return (
    message.includes("(404)") ||
    message.includes("tour not found") ||
    message.includes("not found")
  );
}

function isTourSyncSchemaCompatibilityError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "42703" || code === "42883" || code === "42P01";
}

function resolveRemoteTourId(input: PushGlobalTourInput) {
  if (input.remoteTourId) {
    return input.remoteTourId;
  }

  if (!input.tour) {
    return null;
  }

  const sourceTourId = input.tour.source_tour_id || input.tour.sourceTourId;
  if (typeof sourceTourId === "string" && sourceTourId.trim()) {
    return sourceTourId.trim();
  }

  return null;
}

async function resolveRemoteTourIdFromLocalTour(localTourId: string) {
  const result = await q<{ source_tour_id: string | null }>(
    `
    select source_tour_id
    from public.tours
    where id::text = $1
    limit 1
    `,
    [localTourId],
  );

  const remoteTourId = asNullableString(result.rows[0]?.source_tour_id);
  return remoteTourId;
}

type LocalTourGlobalLink = {
  localTourId: string;
  remoteTourId: string | null;
  sourceSystem: string | null;
};

async function getLocalTourGlobalLink(localTourId: string) {
  const result = await q<{
    id: string;
    source_tour_id: string | null;
    source_system: string | null;
  }>(
    `
    select
      id::text as id,
      source_tour_id,
      source_system
    from public.tours
    where id::text = $1
    limit 1
    `,
    [localTourId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    localTourId: row.id,
    remoteTourId: asNullableString(row.source_tour_id),
    sourceSystem: asNullableString(row.source_system),
  } satisfies LocalTourGlobalLink;
}

async function getCanonicalDepartureSeats(localTourId: string, departureDate: string) {
  const result = await q<{
    capacity: number | string | null;
    booked: number | string | null;
    remaining: number | string | null;
  }>(
    `
    select
      s.capacity,
      s.booked,
      s.remaining
    from public.get_departure_seats($1, $2) s
    limit 1
    `,
    [localTourId, departureDate],
  );

  const row = result.rows[0];
  const capacity = Math.max(0, Math.floor(asFiniteNumber(row?.capacity)));
  const booked = Math.max(0, Math.floor(asFiniteNumber(row?.booked)));
  const remaining = Math.max(0, Math.floor(asFiniteNumber(row?.remaining)));

  return {
    capacity,
    booked,
    remaining,
  };
}

const KNOWN_PRICE_ROUTES = new Set(LEGACY_ROUTE_HINTS.map((entry) => entry.route));

function normalizeGlobalPriceTableName(value: unknown) {
  const raw = asNullableString(value);
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return null;

  const withoutSuffix = normalized.endsWith("_price_table")
    ? normalized.slice(0, -"_price_table".length)
    : normalized;

  if (["price_table", "price_tables", "table"].includes(withoutSuffix)) {
    return null;
  }

  if (KNOWN_PRICE_ROUTES.has(withoutSuffix)) {
    return withoutSuffix;
  }

  if (KNOWN_PRICE_ROUTES.has(normalized)) {
    return normalized;
  }

  return withoutSuffix || normalized;
}

function extractSourceDepartureDate(source: Record<string, unknown>) {
  const direct = asIsoDate(source.departure_date || source.departureDate);
  if (direct) return direct;

  const legacy = asIsoDate(source.departuredate);
  if (legacy) return legacy;

  const dates = source.dates;
  if (Array.isArray(dates)) {
    for (const candidate of dates) {
      const parsed = asIsoDate(candidate);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function pickPrimaryHotelName(source: Record<string, unknown>) {
  const direct = asNullableString(source.hotel);
  if (direct) {
    return direct;
  }

  if (Array.isArray(source.hotels)) {
    for (const hotel of source.hotels) {
      if (typeof hotel === "string") {
        const normalized = asNullableString(hotel);
        if (normalized) return normalized;
        continue;
      }

      if (hotel && typeof hotel === "object") {
        const normalized = asNullableString(
          (hotel as Record<string, unknown>).name,
        );
        if (normalized) return normalized;
      }
    }
  }

  return null;
}

function inferPriceRouteFromSource(source: Record<string, unknown>) {
  const explicitCandidates: unknown[] = [
    source.route_name,
    source.routeName,
    source.table_name,
    source.tableName,
    source.price_table_name,
    source.priceTableName,
    source.price_table_route,
    source.priceTableRoute,
  ];

  for (const candidate of explicitCandidates) {
    const normalized = normalizeGlobalPriceTableName(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const fromGenre = normalizeGlobalPriceTableName(source.genre);
  if (fromGenre && KNOWN_PRICE_ROUTES.has(fromGenre)) {
    return fromGenre;
  }

  const fromCountry = normalizeGlobalPriceTableName(source.country);
  if (fromCountry && KNOWN_PRICE_ROUTES.has(fromCountry)) {
    return fromCountry;
  }

  return detectLegacyPriceRoute([
    asNullableString(source.title),
    asNullableString(source.name),
    asNullableString(source.country),
    asNullableString(source.genre),
    asNullableString(source.description),
  ]);
}

function readRouteNameFromRawTour(rawTour: RawGlobalTour | null) {
  if (!rawTour) return null;

  const extractFromContainer = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }

    const record = candidate as Record<string, unknown>;
    return normalizeGlobalPriceTableName(
      record.route_name ||
        record.routeName ||
        record.table_name ||
        record.tableName ||
        record.name,
    );
  };

  const directRoute =
    extractFromContainer(rawTour.priceTable) ||
    extractFromContainer(rawTour.price_table);
  if (directRoute) {
    return directRoute;
  }

  for (const [key, value] of Object.entries(rawTour)) {
    if (!key.endsWith("_price_table")) continue;

    const byKey = normalizeGlobalPriceTableName(key);
    if (byKey) {
      return byKey;
    }

    const fromValue = extractFromContainer(value);
    if (fromValue) {
      return fromValue;
    }
  }

  return null;
}

function buildGlobalPriceRowPayloadForPush(input: {
  source: Record<string, unknown>;
  remoteTourId: string;
  departureDate: string;
  tableName: string;
}) {
  const source = input.source;
  const seats = Math.max(
    0,
    Math.floor(asFiniteNumber(source.seats ?? source.available_seats)),
  );
  const basePrice = Math.max(
    0,
    asFiniteNumber(source.base_price ?? source.basePrice),
  );
  const status = String(source.status || "")
    .trim()
    .toLowerCase();
  const isFull = status === "full" || seats <= 0;
  const availability = isFull ? "Дүүрсэн" : "Захиалга авч байна";
  const contractTemplateCode = asNullableString(source.genre);
  const hotelName = pickPrimaryHotelName(source);

  const payload: Record<string, unknown> = {
    tour_id: input.remoteTourId,
    departure_date: input.departureDate,
    seats,
    is_full: isFull,
    availability,
    adult_price: String(basePrice),
    with_program: false,
    extra_bed_price: "0",
    infant_price: "0",
    single_supply_price: "0",
  };

  if (contractTemplateCode) {
    payload.contract_template_code = contractTemplateCode;
  }

  if (hotelName) {
    payload.hotel_name = hotelName;
    payload.hotel = hotelName;
  }

  if (input.tableName === "hainan" && !payload.hotel_name) {
    payload.hotel_name = "Hotel";
  }

  return payload;
}

function extractGlobalRowId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const direct = asNullableString((payload as Record<string, unknown>).id);
  if (direct) {
    return direct;
  }

  const nested =
    (payload as Record<string, unknown>).data &&
    typeof (payload as Record<string, unknown>).data === "object"
      ? ((payload as Record<string, unknown>).data as Record<string, unknown>)
      : null;

  return asNullableString(nested?.id);
}

async function syncGlobalPriceRowForPush(input: {
  source: Record<string, unknown>;
  remoteTourId: string;
  rawTour: RawGlobalTour | null;
}) {
  const departureDate = extractSourceDepartureDate(input.source);
  if (!departureDate) {
    return {
      warning:
        "Global price row sync skipped: departure date is missing in local payload.",
      tableName: null,
      rowId: null,
      seats: null,
    };
  }

  const rowCandidates = input.rawTour
    ? collectGlobalPriceRowCandidates(input.rawTour)
    : [];

  const normalizedCandidates = rowCandidates.map((candidate) => ({
    ...candidate,
    tableName:
      normalizeGlobalPriceTableName(candidate.tableName) || candidate.tableName,
  }));

  const exactMatch = normalizedCandidates.find(
    (candidate) => candidate.departureDate === departureDate,
  );

  const inferredTableName =
    exactMatch?.tableName ||
    normalizedCandidates[0]?.tableName ||
    readRouteNameFromRawTour(input.rawTour) ||
    inferPriceRouteFromSource(input.source);

  const tableName = normalizeGlobalPriceTableName(inferredTableName);
  if (!tableName) {
    return {
      warning:
        "Global price row sync skipped: unable to determine price table route for this tour.",
      tableName: null,
      rowId: null,
      seats: null,
    };
  }

  const rowPayload = buildGlobalPriceRowPayloadForPush({
    source: input.source,
    remoteTourId: input.remoteTourId,
    departureDate,
    tableName,
  });

  const seats = Math.max(0, Math.floor(asFiniteNumber(rowPayload.seats)));

  if (exactMatch?.rowId) {
    await patchGlobalPriceTableRow({
      tableName,
      rowId: exactMatch.rowId,
      row: rowPayload,
    });

    return {
      warning: null,
      tableName,
      rowId: exactMatch.rowId,
      seats,
    };
  }

  const createdPayload = await createGlobalPriceTableRow({
    tableName,
    row: rowPayload,
  });

  return {
    warning: null,
    tableName,
    rowId: extractGlobalRowId(createdPayload),
    seats,
  };
}

export async function ensureGlobalTourBookableService(
  user: AuthUser,
  input: EnsureGlobalTourBookableInput,
) {
  const remoteTourId = asNullableString(input.remoteTourId);
  if (!remoteTourId) {
    throw badRequest("remoteTourId is required");
  }

  const rawTour = await findRawGlobalTourByRemoteId(remoteTourId);
  if (!rawTour) {
    throw badRequest(`Global tour not found for id: ${remoteTourId}`);
  }

  const sourceSystem =
    String(env.globalToursSyncSourceSystem || "").trim().toLowerCase() ||
    "global-travel";

  const mappedRow = mapRawGlobalTourToSyncInput(rawTour, sourceSystem, null);
  if (!mappedRow) {
    throw badRequest(
      `Global tour payload is missing required fields for id: ${remoteTourId}`,
    );
  }

  let outcome: { id: string; action: "inserted" | "updated" | "linked" };

  try {
    outcome = await withTransaction(async (client) =>
      upsertTourFromSourceRepo(client, mappedRow),
    );
  } catch (error) {
    if (!isTourSyncSchemaCompatibilityError(error)) {
      throw error;
    }

    logger.warn("audit.global_tour.ensure_bookable.legacy_fallback", {
      actorUserId: user.id,
      actorRole: user.role,
      remoteTourId,
      errorCode: (error as { code?: string } | null)?.code || null,
    });

    outcome = await withTransaction(async (client) =>
      upsertTourFromSourceLegacyCompatRepo(client, mappedRow),
    );
  }

  const syncedAt = new Date().toISOString();

  logger.info("audit.global_tour.ensure_bookable", {
    actorUserId: user.id,
    actorRole: user.role,
    remoteTourId,
    localTourId: outcome.id,
    action: outcome.action,
  });

  return {
    remoteTourId,
    localTourId: outcome.id,
    action: outcome.action,
    sourceSystem,
    syncedAt,
  } satisfies EnsureGlobalTourBookableResult;
}

export async function syncGlobalPriceRowCanonicalService(
  user: AuthUser,
  input: SyncGlobalPriceRowCanonicalInput,
) {
  if (!env.globalToursWriteEnabled) {
    throw badRequest(
      "Global tour write sync is disabled. Set GLOBAL_TOURS_WRITE_ENABLED=true in backend env.",
    );
  }

  const localTourId = input.localTourId;
  const departureDate = input.departureDate;
  const syncedAt = new Date().toISOString();

  const tourLink = await getLocalTourGlobalLink(localTourId);
  if (!tourLink) {
    throw badRequest(`Local tour not found for id: ${localTourId}`);
  }

  const remoteTourId = input.remoteTourId || tourLink.remoteTourId;
  const sourceSystem = String(tourLink.sourceSystem || "")
    .trim()
    .toLowerCase();
  const seatsSnapshot = await getCanonicalDepartureSeats(localTourId, departureDate);

  const asSkipped = (
    reason: string,
  ): SyncGlobalPriceRowCanonicalResult => {
    logger.info("audit.global_tour.price_row_sync_skipped", {
      actorUserId: user.id,
      actorRole: user.role,
      localTourId,
      remoteTourId,
      departureDate,
      seats: seatsSnapshot.remaining,
      reason,
    });

    return {
      status: "skipped",
      reason,
      remoteTourId,
      localTourId,
      departureDate,
      seats: seatsSnapshot.remaining,
      rowId: null,
      tableName: null,
      syncedAt,
    };
  };

  if (!remoteTourId) {
    return asSkipped("Local tour is not linked to Global Travel yet.");
  }

  if (sourceSystem && sourceSystem !== "global-travel") {
    return asSkipped(`Local tour source system is '${sourceSystem}', not Global Travel.`);
  }

  const rawTour = await findRawGlobalTourByRemoteId(remoteTourId);
  if (!rawTour) {
    return asSkipped(`Global tour not found for id: ${remoteTourId}`);
  }

  const rowCandidates = collectGlobalPriceRowCandidates(rawTour);
  const matchedRow = rowCandidates.find((row) => row.departureDate === departureDate);

  if (!matchedRow) {
    return asSkipped(
      `No Global price row found for departure date ${departureDate}.`,
    );
  }

  const seats = seatsSnapshot.remaining;
  const isFull = seats <= 0;

  await updateGlobalPriceTableRow({
    tableName: matchedRow.tableName,
    rowId: matchedRow.rowId,
    seats,
    isFull,
    availability: isFull ? "Дүүрсэн" : matchedRow.availability,
  });

  logger.info("audit.global_tour.price_row_synced", {
    actorUserId: user.id,
    actorRole: user.role,
    localTourId,
    remoteTourId,
    departureDate,
    seats,
    tableName: matchedRow.tableName,
    rowId: matchedRow.rowId,
    mode: "canonical",
  });

  return {
    status: "synced",
    reason: null,
    remoteTourId,
    localTourId,
    departureDate,
    seats,
    rowId: matchedRow.rowId,
    tableName: matchedRow.tableName,
    syncedAt,
  } satisfies SyncGlobalPriceRowCanonicalResult;
}

export async function syncGlobalPriceRowService(
  user: AuthUser,
  input: SyncGlobalPriceRowInput,
) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can sync raw Global price rows");
  }

  if (!env.globalToursWriteEnabled) {
    throw badRequest(
      "Global tour write sync is disabled. Set GLOBAL_TOURS_WRITE_ENABLED=true in backend env.",
    );
  }

  const localTourId = input.localTourId;
  const remoteTourId =
    input.remoteTourId ||
    (localTourId ? await resolveRemoteTourIdFromLocalTour(localTourId) : null);

  if (!remoteTourId) {
    throw badRequest(
      "Unable to resolve remote tour id for seat sync. Ensure the local tour is linked to Global.",
    );
  }

  const rawTour = await findRawGlobalTourByRemoteId(remoteTourId);
  if (!rawTour) {
    throw badRequest(`Global tour not found for id: ${remoteTourId}`);
  }

  const rowCandidates = collectGlobalPriceRowCandidates(rawTour);
  const matchedRow = rowCandidates.find(
    (row) => row.departureDate === input.departureDate,
  );

  if (!matchedRow) {
    throw badRequest(
      `No Global price row found for departure date ${input.departureDate}.`,
    );
  }

  const isFull = input.seats <= 0;
  await updateGlobalPriceTableRow({
    tableName: matchedRow.tableName,
    rowId: matchedRow.rowId,
    seats: input.seats,
    isFull,
    availability: isFull ? "Дүүрсэн" : matchedRow.availability,
  });

  const syncedAt = new Date().toISOString();

  logger.info("audit.global_tour.price_row_synced", {
    actorUserId: user.id,
    actorRole: user.role,
    localTourId,
    remoteTourId,
    departureDate: input.departureDate,
    seats: input.seats,
    tableName: matchedRow.tableName,
    rowId: matchedRow.rowId,
  });

  return {
    remoteTourId,
    localTourId,
    departureDate: input.departureDate,
    seats: input.seats,
    rowId: matchedRow.rowId,
    tableName: matchedRow.tableName,
    syncedAt,
  } satisfies SyncGlobalPriceRowResult;
}

async function linkLocalTourToGlobalSource(
  localTourId: string,
  remoteTourId: string,
) {
  await q(
    `
    update public.tours
    set source_system = 'global-travel',
        source_tour_id = $1,
        updated_at = now()
    where id::text = $2
    `,
    [remoteTourId, localTourId],
  );
}

export async function pushGlobalTourService(
  user: AuthUser,
  input: PushGlobalTourInput,
) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can push tours to Global API");
  }

  if (!env.globalToursWriteEnabled) {
    throw badRequest(
      "Global tour write sync is disabled. Set GLOBAL_TOURS_WRITE_ENABLED=true in backend env.",
    );
  }

  const syncedAt = new Date().toISOString();

  if (input.action === "delete") {
    const remoteTourId = resolveRemoteTourId(input);
    if (!remoteTourId) {
      return {
        action: input.action,
        remoteAction: "skipped",
        remoteTourId: null,
        localTourId: input.localTourId,
        syncedAt,
        warning:
          "Missing remote tour id. Local row deleted, remote delete skipped.",
      } satisfies PushGlobalTourResult;
    }

    let warning: string | null = null;
    try {
      await pushGlobalTourServiceDeps.deleteGlobalTour(remoteTourId);
    } catch (error) {
      if (!pushGlobalTourServiceDeps.isGlobalTourNotFoundError(error)) {
        throw error;
      }

      warning = "Remote tour was not found, treated as already deleted.";
    }

    logger.info("audit.global_tour.push", {
      actorUserId: user.id,
      actorRole: user.role,
      action: input.action,
      remoteAction: "deleted",
      remoteTourId,
      localTourId: input.localTourId,
    });

    return {
      action: input.action,
      remoteAction: "deleted",
      remoteTourId,
      localTourId: input.localTourId,
      syncedAt,
      warning,
    } satisfies PushGlobalTourResult;
  }

  const source = (input.tour || {}) as Record<string, unknown>;
  const payload = mapLocalTourToGlobalPayload(source);
  let remoteTourId = resolveRemoteTourId(input);
  let remoteAction: PushGlobalTourResult["remoteAction"] = "created";

  if (input.action === "create" || !remoteTourId) {
    const createdPayload = await pushGlobalTourServiceDeps.createGlobalTour(payload);
    remoteTourId = pushGlobalTourServiceDeps.extractGlobalTourId(createdPayload) || remoteTourId;
    remoteAction = "created";
  } else {
    try {
      const updatedPayload = await pushGlobalTourServiceDeps.updateGlobalTour(
        remoteTourId,
        payload,
      );
      remoteTourId = pushGlobalTourServiceDeps.extractGlobalTourId(updatedPayload) || remoteTourId;
      remoteAction = "updated";
    } catch (error) {
      if (!pushGlobalTourServiceDeps.isGlobalTourNotFoundError(error)) {
        throw error;
      }

      const createdPayload = await pushGlobalTourServiceDeps.createGlobalTour(payload);
      remoteTourId = pushGlobalTourServiceDeps.extractGlobalTourId(createdPayload) || remoteTourId;
      remoteAction = "created";
    }
  }

  if (input.localTourId && remoteTourId) {
    await pushGlobalTourServiceDeps.linkLocalTourToGlobalSource(
      input.localTourId,
      remoteTourId,
    );
  }

  const warnings: string[] = [];
  let pushedPriceTableName: string | null = null;
  let pushedPriceRowId: string | null = null;
  let pushedSeats: number | null = null;

  if (!remoteTourId) {
    warnings.push("Global API response did not include remote tour id.");
  }

  if (remoteTourId) {
    let rawTour: RawGlobalTour | null = null;
    try {
      rawTour = await pushGlobalTourServiceDeps.findRawGlobalTourByRemoteId(
        remoteTourId,
      );
    } catch (error) {
      logger.warn("audit.global_tour.push.price_row_raw_lookup_failed", {
        actorUserId: user.id,
        actorRole: user.role,
        remoteTourId,
        localTourId: input.localTourId,
        error:
          error instanceof Error ? error.message : String(error || "unknown"),
      });
    }

    try {
      const rowSync = await pushGlobalTourServiceDeps.syncGlobalPriceRowForPush({
        source,
        remoteTourId,
        rawTour,
      });

      pushedPriceTableName = rowSync.tableName;
      pushedPriceRowId = rowSync.rowId;
      pushedSeats = rowSync.seats;

      if (rowSync.warning) {
        warnings.push(rowSync.warning);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error || "unknown");
      warnings.push(`Global price row sync failed: ${message}`);
      logger.warn("audit.global_tour.push.price_row_sync_failed", {
        actorUserId: user.id,
        actorRole: user.role,
        remoteTourId,
        localTourId: input.localTourId,
        action: input.action,
        error: message,
      });
    }
  }

  logger.info("audit.global_tour.push", {
    actorUserId: user.id,
    actorRole: user.role,
    action: input.action,
    remoteAction,
    remoteTourId,
    localTourId: input.localTourId,
    pushedPriceTableName,
    pushedPriceRowId,
    pushedSeats,
    warningCount: warnings.length,
  });

  return {
    action: input.action,
    remoteAction,
    remoteTourId: remoteTourId || null,
    localTourId: input.localTourId,
    syncedAt,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  } satisfies PushGlobalTourResult;
}

async function runGlobalToursSync(
  input: SyncGlobalToursInput,
  context: {
    actorUserId: string;
    actorRole: string;
    createdBy: string | null;
  },
) {
  const sourceSystem = input.sourceSystem.trim().toLowerCase();
  if (!sourceSystem) {
    throw badRequest("sourceSystem is required");
  }

  const rawRows = input.tours ?? (await fetchGlobalToursFromApi());
  const skippedRows: SyncSkippedRow[] = [];

  const dedupedBySource = new Map<string, TourSyncRowInput>();
  rawRows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      skippedRows.push({
        index,
        reason: "row is not an object",
        sourceTourId: null,
        title: null,
      });
      return;
    }

    const mapped = mapRawGlobalTourToSyncInput(
      row as RawGlobalTour,
      sourceSystem,
      context.createdBy,
    );

    if (!mapped) {
      const raw = row as RawGlobalTour;
      skippedRows.push({
        index,
        reason: "missing id or title",
        sourceTourId: raw.id ? String(raw.id) : null,
        title: raw.title ? String(raw.title) : null,
      });
      return;
    }

    dedupedBySource.set(
      `${mapped.sourceSystem}:${mapped.sourceTourId}`,
      mapped,
    );
  });

  const normalizedRows = Array.from(dedupedBySource.values());
  if (normalizedRows.length === 0) {
    return {
      sourceSystem,
      fetched: rawRows.length,
      normalized: 0,
      inserted: 0,
      updated: 0,
      linked: 0,
      skipped: skippedRows.length,
      dryRun: input.dryRun,
      skippedRows,
      processedAt: new Date().toISOString(),
    } satisfies SyncGlobalToursResult;
  }

  let inserted = 0;
  let updated = 0;
  let linked = 0;

  try {
    if (input.dryRun) {
      for (const row of normalizedRows) {
        const action = await classifyTourSyncActionRepo({
          sourceSystem: row.sourceSystem,
          sourceTourId: row.sourceTourId,
          title: row.title,
          departureDate: row.departureDate,
        });

        if (action === "inserted") inserted += 1;
        if (action === "updated") updated += 1;
        if (action === "linked") linked += 1;
      }
    } else {
      await withTransaction(async (client) => {
        for (const row of normalizedRows) {
          const outcome = await upsertTourFromSourceRepo(client, row);
          if (outcome.action === "inserted") inserted += 1;
          if (outcome.action === "updated") updated += 1;
          if (outcome.action === "linked") linked += 1;
        }
      });
    }
  } catch (error: unknown) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "42703") {
      throw badRequest(
        "Database schema missing source identity columns. Apply migration 20260301_tour_source_identity.sql",
      );
    }
    throw error;
  }

  const result = {
    sourceSystem,
    fetched: rawRows.length,
    normalized: normalizedRows.length,
    inserted,
    updated,
    linked,
    skipped: skippedRows.length,
    dryRun: input.dryRun,
    skippedRows,
    processedAt: new Date().toISOString(),
  } satisfies SyncGlobalToursResult;

  logger.info("audit.global_tours.synced", {
    actorUserId: context.actorUserId,
    actorRole: context.actorRole,
    dryRun: input.dryRun,
    sourceSystem: result.sourceSystem,
    fetched: result.fetched,
    normalized: result.normalized,
    inserted: result.inserted,
    updated: result.updated,
    linked: result.linked,
    skipped: result.skipped,
  });

  return result;
}

export async function syncGlobalToursService(
  user: AuthUser,
  input: SyncGlobalToursInput,
) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can sync global tours");
  }

  return runGlobalToursSync(input, {
    actorUserId: user.id,
    actorRole: user.role,
    createdBy: user.id,
  });
}

export async function syncGlobalToursSystemService(
  input: SyncGlobalToursInput,
) {
  return runGlobalToursSync(input, {
    actorUserId: "system:global-tour-sync",
    actorRole: "system",
    createdBy: null,
  });
}
