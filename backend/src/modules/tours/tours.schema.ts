import { badRequest } from "../../shared/http/errors.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSearchToursFilters(query: Record<string, unknown>) {
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
    query.minSeats !== undefined && query.minSeats !== null && `${query.minSeats}`.trim() !== ""
      ? Number(query.minSeats)
      : undefined;
  const minPrice =
    query.minPrice !== undefined && query.minPrice !== null && `${query.minPrice}`.trim() !== ""
      ? Number(query.minPrice)
      : undefined;
  const maxPrice =
    query.maxPrice !== undefined && query.maxPrice !== null && `${query.maxPrice}`.trim() !== ""
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

  return {
    from,
    to,
    destination,
    minSeats,
    minPrice,
    maxPrice,
  };
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
