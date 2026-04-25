import { badRequest } from "../../shared/http/errors.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DESTINATION_RANGE_DAYS = 120;

export type SearchToursFilters = {
  from: string;
  to: string;
  destination?: string;
  minSeats?: number;
  minPrice?: number;
  maxPrice?: number;
  accessRequestId?: string;
};

export type ListTourDestinationsFilters = {
  from?: string;
  to?: string;
  minSeats?: number;
};

export function parseListTourDestinationsFilters(
  query: Record<string, unknown>,
): ListTourDestinationsFilters {
  const fromRaw = typeof query.from === "string" ? query.from.trim() : "";
  const toRaw = typeof query.to === "string" ? query.to.trim() : "";

  const from = fromRaw || undefined;
  const to = toRaw || undefined;

  if ((from && !to) || (!from && to)) {
    throw badRequest("from and to must be provided together");
  }

  if (from && !ISO_DATE_RE.test(from)) {
    throw badRequest("from must be YYYY-MM-DD");
  }

  if (to && !ISO_DATE_RE.test(to)) {
    throw badRequest("to must be YYYY-MM-DD");
  }

  if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
    throw badRequest("from must be before or equal to to");
  }

  if (from && to) {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    const dayDiff = Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000));

    if (dayDiff > MAX_DESTINATION_RANGE_DAYS) {
      throw badRequest(
        `date range is too large; use ${MAX_DESTINATION_RANGE_DAYS} days or fewer`,
      );
    }
  }

  const minSeatsRaw =
    query.minSeats !== undefined &&
    query.minSeats !== null &&
    `${query.minSeats}`.trim() !== ""
      ? Number(query.minSeats)
      : undefined;

  if (
    minSeatsRaw !== undefined &&
    (!Number.isInteger(minSeatsRaw) || minSeatsRaw <= 0)
  ) {
    throw badRequest("minSeats must be a positive integer");
  }

  return {
    from,
    to,
    minSeats: minSeatsRaw,
  };
}

export function parseSearchToursFilters(
  query: Record<string, unknown>,
): SearchToursFilters {
  const from = String(query.from || "").trim();
  const to = String(query.to || "").trim();

  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    throw badRequest("from and to are required in YYYY-MM-DD");
  }

  const destination =
    typeof query.destination === "string" && query.destination.trim()
      ? query.destination.trim()
      : undefined;

  const minSeats =
    query.minSeats !== undefined &&
    query.minSeats !== null &&
    `${query.minSeats}`.trim() !== ""
      ? Number(query.minSeats)
      : undefined;
  const minPrice =
    query.minPrice !== undefined &&
    query.minPrice !== null &&
    `${query.minPrice}`.trim() !== ""
      ? Number(query.minPrice)
      : undefined;
  const maxPrice =
    query.maxPrice !== undefined &&
    query.maxPrice !== null &&
    `${query.maxPrice}`.trim() !== ""
      ? Number(query.maxPrice)
      : undefined;

  if (minSeats !== undefined && (!Number.isInteger(minSeats) || minSeats < 0)) {
    throw badRequest("minSeats must be a non-negative integer");
  }
  if (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) {
    throw badRequest("minPrice must be a non-negative number");
  }
  if (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    throw badRequest("maxPrice must be a non-negative number");
  }
  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    minPrice > maxPrice
  ) {
    throw badRequest("minPrice cannot be greater than maxPrice");
  }

  const accessRequestId =
    typeof query.accessRequestId === "string" &&
    query.accessRequestId.trim().length > 0
      ? query.accessRequestId.trim()
      : undefined;

  if (accessRequestId && !UUID_RE.test(accessRequestId)) {
    throw badRequest("accessRequestId must be a valid UUID");
  }

  const parsed: SearchToursFilters = {
    from,
    to,
    destination,
    minSeats,
    minPrice,
    maxPrice,
  };

  if (accessRequestId) {
    parsed.accessRequestId = accessRequestId;
  }

  return parsed;
}

export function parseSyncGlobalToursInput(body: unknown) {
  const value = (body || {}) as Record<string, unknown>;
  const dryRunRaw = value.dryRun;
  const dryRun =
    dryRunRaw === true ||
    dryRunRaw === "true" ||
    dryRunRaw === 1 ||
    dryRunRaw === "1";
  const sourceSystem =
    typeof value.sourceSystem === "string" && value.sourceSystem.trim()
      ? value.sourceSystem.trim().toLowerCase()
      : "global-travel";

  if (sourceSystem.length > 80) {
    throw badRequest("sourceSystem must be 80 characters or fewer");
  }

  let tours: unknown[] | undefined;
  if (value.tours !== undefined) {
    if (!Array.isArray(value.tours)) {
      throw badRequest("tours must be an array when provided");
    }
    tours = value.tours;
  }

  return {
    dryRun,
    sourceSystem,
    tours,
  };
}

export type PushGlobalTourAction = "create" | "update" | "delete";

export type PushGlobalTourInput = {
  action: PushGlobalTourAction;
  localTourId: string | null;
  remoteTourId: string | null;
  tour: Record<string, unknown> | null;
};

export type SyncGlobalPriceRowInput = {
  localTourId: string | null;
  remoteTourId: string | null;
  departureDate: string;
  seats: number;
};

export type SyncGlobalPriceRowCanonicalInput = {
  localTourId: string;
  remoteTourId: string | null;
  departureDate: string;
};

export type EnsureGlobalTourBookableInput = {
  remoteTourId: string;
};

function asNullableId(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > 120) {
    throw badRequest(`${field} is too long`);
  }

  return normalized;
}

export function parsePushGlobalTourInput(body: unknown): PushGlobalTourInput {
  const value = (body || {}) as Record<string, unknown>;

  const actionRaw = String(value.action || "")
    .trim()
    .toLowerCase();
  const action =
    actionRaw === "create" || actionRaw === "update" || actionRaw === "delete"
      ? actionRaw
      : null;

  if (!action) {
    throw badRequest("action must be one of: create, update, delete");
  }

  const localTourId = asNullableId(value.localTourId, "localTourId");
  const remoteTourId = asNullableId(value.remoteTourId, "remoteTourId");

  let tour: Record<string, unknown> | null = null;
  if (value.tour !== undefined && value.tour !== null) {
    if (
      !value.tour ||
      typeof value.tour !== "object" ||
      Array.isArray(value.tour)
    ) {
      throw badRequest("tour must be an object when provided");
    }
    tour = value.tour as Record<string, unknown>;
  }

  if ((action === "create" || action === "update") && !tour) {
    throw badRequest("tour is required for create/update actions");
  }

  return {
    action,
    localTourId,
    remoteTourId,
    tour,
  };
}

export function parseSyncGlobalPriceRowInput(
  body: unknown,
): SyncGlobalPriceRowInput {
  const value = (body || {}) as Record<string, unknown>;

  const localTourId = asNullableId(value.localTourId, "localTourId");
  const remoteTourId = asNullableId(value.remoteTourId, "remoteTourId");

  if (!localTourId && !remoteTourId) {
    throw badRequest("Either localTourId or remoteTourId is required");
  }

  const departureDate = String(value.departureDate || "")
    .trim()
    .slice(0, 10);
  if (!ISO_DATE_RE.test(departureDate)) {
    throw badRequest("departureDate must be YYYY-MM-DD");
  }

  const seats = Number(value.seats);
  if (!Number.isFinite(seats) || !Number.isInteger(seats) || seats < 0) {
    throw badRequest("seats must be a non-negative integer");
  }

  return {
    localTourId,
    remoteTourId,
    departureDate,
    seats,
  };
}

export function parseSyncGlobalPriceRowCanonicalInput(
  body: unknown,
): SyncGlobalPriceRowCanonicalInput {
  const value = (body || {}) as Record<string, unknown>;

  const localTourId = asNullableId(value.localTourId, "localTourId");
  if (!localTourId) {
    throw badRequest("localTourId is required");
  }

  const remoteTourId = asNullableId(value.remoteTourId, "remoteTourId");

  const departureDate = String(value.departureDate || "")
    .trim()
    .slice(0, 10);
  if (!ISO_DATE_RE.test(departureDate)) {
    throw badRequest("departureDate must be YYYY-MM-DD");
  }

  return {
    localTourId,
    remoteTourId,
    departureDate,
  };
}

export function parseEnsureGlobalTourBookableInput(
  body: unknown,
): EnsureGlobalTourBookableInput {
  const value = (body || {}) as Record<string, unknown>;
  const remoteTourId = asNullableId(value.remoteTourId, "remoteTourId");

  if (!remoteTourId) {
    throw badRequest("remoteTourId is required");
  }

  return {
    remoteTourId,
  };
}
