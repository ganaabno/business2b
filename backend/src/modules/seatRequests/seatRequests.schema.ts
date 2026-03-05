import { badRequest } from "../../shared/http/errors.js";

export function parseCreateSeatRequestInput(input: unknown) {
  const v = (input || {}) as Record<string, unknown>;
  const tourId = String(v.tourId || "").trim();
  const destination = String(v.destination || "").trim();
  const travelDate = String(v.travelDate || "").trim();
  const requestedSeats = Number(v.requestedSeats || 0);
  const unitPriceMnt = Number(v.unitPriceMnt || 0);

  if (!tourId) throw badRequest("tourId is required");
  if (!destination) throw badRequest("destination is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) throw badRequest("travelDate must be YYYY-MM-DD");
  if (!Number.isInteger(requestedSeats) || requestedSeats <= 0) {
    throw badRequest("requestedSeats must be positive integer");
  }
  if (!Number.isFinite(unitPriceMnt) || unitPriceMnt < 0) throw badRequest("unitPriceMnt must be >= 0");

  return { tourId, destination, travelDate, requestedSeats, unitPriceMnt };
}

export function parseDecisionInput(input: unknown) {
  const v = (input || {}) as Record<string, unknown>;
  const note = v.note ? String(v.note) : null;
  const reason = v.reason ? String(v.reason) : null;
  return { note, reason };
}
