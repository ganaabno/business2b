import { badRequest } from "../../shared/http/errors.js";
import type { SeatAccessRequestStatus } from "./seatAccessRequests.repo.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCreateSeatAccessRequestInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const fromDate = String(value.fromDate || "").trim();
  const toDate = String(value.toDate || "").trim();
  const destination = String(value.destination || "").trim();
  const note = value.note ? String(value.note).trim() : null;
  const plannedSeats = Number(value.plannedSeats || value.planned_seats || 0);
  const requestedRoleRaw = String(value.requestedRole || value.requested_role || "")
    .trim()
    .toLowerCase();

  if (!ISO_DATE_RE.test(fromDate)) {
    throw badRequest("fromDate must be YYYY-MM-DD");
  }
  if (!ISO_DATE_RE.test(toDate)) {
    throw badRequest("toDate must be YYYY-MM-DD");
  }
  if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
    throw badRequest("fromDate must be before or equal to toDate");
  }
  if (destination.length < 2 || destination.length > 120) {
    throw badRequest("destination must be 2-120 characters");
  }
  if (note && note.length > 500) {
    throw badRequest("note must be 500 characters or fewer");
  }
  if (!Number.isInteger(plannedSeats) || plannedSeats <= 0) {
    throw badRequest("plannedSeats must be a positive integer");
  }

  let requestedRole: "subcontractor" | "agent" | undefined;
  if (requestedRoleRaw) {
    if (requestedRoleRaw !== "subcontractor" && requestedRoleRaw !== "agent") {
      throw badRequest("requestedRole must be subcontractor or agent");
    }
    requestedRole = requestedRoleRaw;
  }

  return { fromDate, toDate, destination, note, plannedSeats, requestedRole };
}

export function parseSeatAccessRequestListFilters(query: Record<string, unknown>) {
  const statusRaw =
    typeof query.status === "string" ? query.status.trim().toLowerCase() : undefined;
  const destination =
    typeof query.destination === "string" ? query.destination.trim() : undefined;

  let status: SeatAccessRequestStatus | undefined;
  if (statusRaw !== undefined && statusRaw !== "") {
    if (!isSeatAccessRequestStatus(statusRaw)) {
      throw badRequest("status must be pending, approved, rejected, consumed, or expired");
    }
    status = statusRaw;
  }

  return { status, destination };
}

export function parseSeatAccessDecisionInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const reason = value.reason ? String(value.reason).trim() : null;

  if (reason && reason.length > 500) {
    throw badRequest("reason must be 500 characters or fewer");
  }

  return { reason };
}

export function parseSelectTourFromAccessInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const tourId = String(value.tourId || "").trim();
  const travelDateRaw = String(value.travelDate || "").trim();
  const travelDate = travelDateRaw.slice(0, 10);
  const requestedSeats = Number(value.requestedSeats || 0);
  const serialCount = Number(value.serialCount || value.serial_count || 1);

  if (!tourId) {
    throw badRequest("tourId is required");
  }
  if (!ISO_DATE_RE.test(travelDate)) {
    throw badRequest("travelDate must be YYYY-MM-DD");
  }
  if (!Number.isInteger(requestedSeats) || requestedSeats <= 0) {
    throw badRequest("requestedSeats must be a positive integer");
  }
  if (!Number.isInteger(serialCount) || serialCount <= 0) {
    throw badRequest("serialCount must be a positive integer");
  }
  if (![1, 10, 11, 12].includes(serialCount)) {
    throw badRequest("serialCount must be one of: 1, 10, 11, 12");
  }

  return { tourId, travelDate, requestedSeats, serialCount };
}

function isSeatAccessRequestStatus(value: string): value is SeatAccessRequestStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "consumed" ||
    value === "expired"
  );
}
