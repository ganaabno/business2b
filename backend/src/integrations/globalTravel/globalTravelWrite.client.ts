import { env } from "../../config/env.js";
import { badRequest } from "../../shared/http/errors.js";

type CachedAuthToken = {
  token: string;
  expiresAtMs: number;
};

const TOKEN_SAFETY_BUFFER_MS = 30_000;
const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000;

let cachedToken: CachedAuthToken | null = null;

function normalizePath(path: string) {
  const normalized = String(path || "").trim();
  if (!normalized) return "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function getWriteBaseUrl() {
  const baseUrl = String(env.globalToursWriteApiBaseUrl || "").trim();
  if (!baseUrl) {
    throw badRequest("GLOBAL_TOURS_WRITE_API_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/$/, "");
}

function parseJsonPayload(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const direct = source.message || source.error;
    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }

    if (source.data && typeof source.data === "object") {
      const nested = source.data as Record<string, unknown>;
      const nestedMessage = nested.message || nested.error;
      if (typeof nestedMessage === "string" && nestedMessage.trim()) {
        return nestedMessage.trim();
      }
    }
  }

  return fallback;
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asIsoDate(value: unknown) {
  const raw = asNullableString(value);
  if (!raw) return null;
  const iso = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function decodeJwtExpiryMs(token: string): number | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payloadText = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadText) as { exp?: number };
    if (!Number.isFinite(payload.exp)) return null;
    return Number(payload.exp) * 1000;
  } catch {
    return null;
  }
}

function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const direct = payload as Record<string, unknown>;
  const directToken =
    direct.token || direct.accessToken || direct.access_token || direct.jwt;
  if (typeof directToken === "string" && directToken.trim()) {
    return directToken.trim();
  }

  const nested = direct.data;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    const nestedToken =
      nestedRecord.token ||
      nestedRecord.accessToken ||
      nestedRecord.access_token ||
      nestedRecord.jwt;
    if (typeof nestedToken === "string" && nestedToken.trim()) {
      return nestedToken.trim();
    }
  }

  return null;
}

async function loginGlobalService(forceRefresh = false) {
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresAtMs > Date.now() + TOKEN_SAFETY_BUFFER_MS
  ) {
    return cachedToken.token;
  }

  const email = asNullableString(env.globalToursServiceEmail);
  const password = asNullableString(env.globalToursServicePassword);

  if (!email || !password) {
    throw badRequest(
      "Global tour write credentials are not configured (GLOBAL_TOURS_SERVICE_EMAIL / GLOBAL_TOURS_SERVICE_PASSWORD)",
    );
  }

  const baseUrl = getWriteBaseUrl();
  const authPath = normalizePath(env.globalToursAuthPath);

  const response = await fetch(`${baseUrl}${authPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await response.text();
  const payload = parseJsonPayload(text);

  if (!response.ok) {
    throw new Error(
      `Global auth failed (${response.status}): ${payloadMessage(payload, "Unable to authenticate to Global API")}`,
    );
  }

  const token = extractToken(payload);
  if (!token) {
    throw new Error("Global auth response does not include a bearer token");
  }

  const expiresAtMs =
    decodeJwtExpiryMs(token) || Date.now() + DEFAULT_TOKEN_TTL_MS;

  cachedToken = {
    token,
    expiresAtMs,
  };

  return token;
}

async function requestGlobalApi(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
) {
  const baseUrl = getWriteBaseUrl();
  const requestPath = normalizePath(path);
  const requestUrl = `${baseUrl}${requestPath}`;

  let token = await loginGlobalService(false);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(requestUrl, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const payload = parseJsonPayload(text);

    if (response.status === 401 && attempt === 0) {
      cachedToken = null;
      token = await loginGlobalService(true);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Global API ${method} ${requestPath} failed (${response.status}): ${payloadMessage(
          payload,
          "Request failed",
        )}`,
      );
    }

    return {
      payload,
      status: response.status,
    };
  }

  throw new Error(`Global API ${method} ${requestPath} failed after token refresh`);
}

function compactRecord(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    output[key] = value;
  }

  return output;
}

function slugifyPriceTableKey(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return slug || "tour";
}

function normalizeTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/g)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function pickDepartureDate(source: Record<string, unknown>) {
  const explicit = asIsoDate(source.departure_date);
  if (explicit) return explicit;

  const legacy = asIsoDate(source.departuredate);
  if (legacy) return legacy;

  const dates = source.dates;
  if (Array.isArray(dates)) {
    for (const candidate of dates) {
      const parsed = asIsoDate(candidate);
      if (parsed) return parsed;
    }
  }

  return null;
}

export function mapLocalTourToGlobalPayload(source: Record<string, unknown>) {
  const title = asNullableString(source.title) || asNullableString(source.name);
  if (!title) {
    throw badRequest("tour.title is required for Global sync");
  }

  const departureDate = pickDepartureDate(source);
  if (!departureDate) {
    throw badRequest("tour.departure_date is required for Global sync");
  }

  const genre = asNullableString(source.genre) || null;
  const seats = Math.max(
    0,
    Math.floor(
      asNumber(source.seats, asNumber(source.available_seats, 0)),
    ),
  );
  const basePrice = Math.max(
    0,
    asNumber(source.base_price, asNumber(source.basePrice, 0)),
  );
  const status = String(source.status || "").trim().toLowerCase();
  const country = asNullableString(source.country);

  const coverPhoto =
    asNullableString(source.cover_photo) ||
    asNullableString(source.coverPhoto) ||
    asNullableString(source.image_key) ||
    asNullableString(source.imageKey);

  const priceTableKey = `${slugifyPriceTableKey(genre || title)}_price_table`;

  const priceRow = compactRecord({
    departure_date: departureDate,
    seats,
    adult_price: String(basePrice),
    availability:
      status === "full" || seats <= 0 ? "Дүүрсэн" : "Захиалга авч байна",
    with_program: false,
    extra_bed_price: "0",
    infant_price: "0",
    single_supply_price: "0",
    is_full: status === "full" || seats <= 0,
    booking_options: null,
    contract_template_code: genre,
    prices: {
      adult_price: String(basePrice),
      extra_bed_price: "0",
      infant_price: "0",
      single_supply_price: "0",
    },
  });

  const payload: Record<string, unknown> = compactRecord({
    title,
    description: asNullableString(source.description),
    cover_photo: coverPhoto,
    country,
    hotel: asNullableString(source.hotel),
    country_temperature:
      asNullableString(source.country_temperature) ||
      asNullableString(source.countryTemperature),
    created_at: asNullableString(source.created_at) || new Date().toISOString(),
    group_size:
      asNullableString(source.group_size) || asNullableString(source.groupSize),
    is_featured:
      source.is_featured === true || source.isFeatured === true,
    duration_day:
      asNullableString(source.duration_day) || asNullableString(source.durationDay),
    duration_night:
      asNullableString(source.duration_night) ||
      asNullableString(source.durationNight),
    genre,
    airlines: normalizeTextArray(source.airlines),
    cities: country ? [country] : [],
    hotels: normalizeTextArray(source.hotels),
  });

  payload[priceTableKey] = [priceRow];

  return payload;
}

export function extractGlobalTourId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;
  const direct = source.id;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  if (source.data && typeof source.data === "object") {
    const nested = source.data as Record<string, unknown>;
    const nestedId = nested.id;
    if (typeof nestedId === "string" && nestedId.trim()) {
      return nestedId.trim();
    }
  }

  return null;
}

export async function createGlobalTour(payload: Record<string, unknown>) {
  const writePath = normalizePath(env.globalToursWritePath);
  const { payload: responsePayload } = await requestGlobalApi(
    "POST",
    writePath,
    payload,
  );
  return responsePayload;
}

export async function updateGlobalTour(
  remoteTourId: string,
  payload: Record<string, unknown>,
) {
  const writePath = normalizePath(env.globalToursWritePath);
  const encodedId = encodeURIComponent(remoteTourId);
  const { payload: responsePayload } = await requestGlobalApi(
    "PUT",
    `${writePath}/${encodedId}`,
    payload,
  );
  return responsePayload;
}

export async function deleteGlobalTour(remoteTourId: string) {
  const writePath = normalizePath(env.globalToursWritePath);
  const encodedId = encodeURIComponent(remoteTourId);
  const { payload: responsePayload } = await requestGlobalApi(
    "DELETE",
    `${writePath}/${encodedId}`,
  );
  return responsePayload;
}

export async function updateGlobalPriceTableRow(input: {
  tableName: string;
  rowId: string;
  seats: number;
  isFull: boolean;
  availability: string;
}) {
  const seats = Math.max(0, Math.floor(asNumber(input.seats, 0)));
  const isFull = input.isFull === true;
  const availability =
    asNullableString(input.availability) || (isFull ? "Дүүрсэн" : "Захиалга авч байна");

  return patchGlobalPriceTableRow({
    tableName: input.tableName,
    rowId: input.rowId,
    row: {
      seats,
      is_full: isFull,
      availability,
    },
  });
}

export async function createGlobalPriceTableRow(input: {
  tableName: string;
  row: Record<string, unknown>;
}) {
  const tableName = asNullableString(input.tableName);
  if (!tableName) {
    throw badRequest("tableName is required for price table create");
  }

  const row =
    input.row && typeof input.row === "object" && !Array.isArray(input.row)
      ? input.row
      : null;

  if (!row) {
    throw badRequest("row payload is required for price table create");
  }

  const priceTablePath = normalizePath(env.globalToursPriceTablePath);
  const encodedTableName = encodeURIComponent(tableName);

  const { payload: responsePayload } = await requestGlobalApi(
    "POST",
    `${priceTablePath}/${encodedTableName}`,
    row,
  );

  return responsePayload;
}

export async function patchGlobalPriceTableRow(input: {
  tableName: string;
  rowId: string;
  row: Record<string, unknown>;
}) {
  const tableName = asNullableString(input.tableName);
  const rowId = asNullableString(input.rowId);

  if (!tableName) {
    throw badRequest("tableName is required for price table update");
  }

  if (!rowId) {
    throw badRequest("rowId is required for price table update");
  }

  const row =
    input.row && typeof input.row === "object" && !Array.isArray(input.row)
      ? input.row
      : null;

  if (!row) {
    throw badRequest("row payload is required for price table update");
  }

  const priceTablePath = normalizePath(env.globalToursPriceTablePath);
  const encodedTableName = encodeURIComponent(tableName);
  const encodedRowId = encodeURIComponent(rowId);

  const { payload: responsePayload } = await requestGlobalApi(
    "PUT",
    `${priceTablePath}/${encodedTableName}/${encodedRowId}`,
    row,
  );

  return responsePayload;
}
