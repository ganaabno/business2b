import { env } from "../../config/env.js";
import { withTransaction } from "../../db/transaction.js";
import { badRequest, forbidden } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AuthUser } from "../../shared/types/auth.js";
import {
  classifyTourSyncActionRepo,
  searchToursRepo,
  type TourSyncRowInput,
  upsertTourFromSourceRepo,
} from "./tours.repo.js";
import { parseSearchToursFilters } from "./tours.schema.js";

const discoveredRailwayApiBase = "https://b2c-production.up.railway.app";

type RawGlobalTour = {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  departure_date?: string;
  departureDate?: string;
  seats?: number | string;
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

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

const normalizeStatus = (
  value: unknown,
): TourSyncRowInput["status"] => {
  const raw = String(value || "").trim().toLowerCase();
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

function getGlobalPriceRows(raw: RawGlobalTour): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!key.endsWith("_price_table")) continue;
    if (!Array.isArray(value)) continue;

    for (const row of value) {
      if (row && typeof row === "object") {
        rows.push(row as Record<string, unknown>);
      }
    }
  }
  return rows;
}

function extractGlobalTourDates(raw: RawGlobalTour, priceRows: Array<Record<string, unknown>>) {
  const unique = new Set<string>();

  for (const row of priceRows) {
    const date = asIsoDate(row.departure_date);
    if (date) unique.add(date);
  }

  const fallbackDate = asIsoDate(raw.departure_date || raw.departureDate);
  if (fallbackDate) {
    unique.add(fallbackDate);
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
  const firstPriceRow = priceRows[0] || {};
  const rowSeats = priceRows
    .map((row) => Math.max(0, Math.floor(asFiniteNumber(row.seats))))
    .filter((seats) => seats > 0);
  const seats = rowSeats.length > 0 ? Math.max(...rowSeats) : Math.max(0, Math.floor(asFiniteNumber(raw.seats)));

  const basePrice = Math.max(
    0,
    asFiniteNumber(
      firstPriceRow.adult_price ||
        ((firstPriceRow.prices as Record<string, unknown> | undefined)?.adult_price ??
          raw.base_price),
    ),
  );

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
  const candidateBases = getCandidateGlobalApiBases();
  if (candidateBases.length === 0) {
    throw badRequest("Global tours API base URL is not configured");
  }

  const requestPath = normalizePath(env.globalToursApiPath);
  let lastError: Error | null = null;

  for (const baseUrl of candidateBases) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.globalToursApiTimeoutMs);

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

      const payload = JSON.parse(rawText) as unknown;
      const tours = extractArrayPayload(payload);
      if (!Array.isArray(tours)) {
        throw new Error("Global tours API payload is not an array");
      }

      return tours;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn("global.tours.sync.fetch_failed", {
        baseUrl,
        requestPath,
        error: lastError.message,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Unable to fetch global tours payload");
}

export async function searchToursService(query: Record<string, unknown>) {
  return searchToursRepo(parseSearchToursFilters(query));
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

    dedupedBySource.set(`${mapped.sourceSystem}:${mapped.sourceTourId}`, mapped);
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
  } catch (error: any) {
    if (error?.code === "42703") {
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

export async function syncGlobalToursService(user: AuthUser, input: SyncGlobalToursInput) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can sync global tours");
  }

  return runGlobalToursSync(input, {
    actorUserId: user.id,
    actorRole: user.role,
    createdBy: user.id,
  });
}

export async function syncGlobalToursSystemService(input: SyncGlobalToursInput) {
  return runGlobalToursSync(input, {
    actorUserId: "system:global-tour-sync",
    actorRole: "system",
    createdBy: null,
  });
}
