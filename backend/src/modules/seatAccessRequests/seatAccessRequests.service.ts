import { withTransaction } from "../../db/transaction.js";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { env } from "../../config/env.js";
import {
  ensureFallbackOrganizationRepo,
  FALLBACK_ORGANIZATION_ID,
  getOrganizationByIdRepo,
  getPrimaryOrganizationForUserRepo,
} from "../organizations/organizations.repo.js";
import {
  createApprovedSeatRequestFromAccessRepo,
  type SeatRequestStatus,
} from "../seatRequests/seatRequests.repo.js";
import { ensureGroupPolicyGuard } from "../seatRequests/seatRequests.service.js";
import {
  approveSeatAccessRequestRepo,
  beginSeatAccessSelectionIdempotencyRepo,
  completeSeatAccessSelectionIdempotencyRepo,
  consumeSeatAccessRequestRepo,
  createSeatAccessRequestRepo,
  expireSeatAccessRequestRepo,
  getDepartureSeatStatsRepo,
  getSeatAccessRequestByIdForUpdateRepo,
  getSeatAccessRequestByIdRepo,
  listNextTourSelectionCandidatesByTitleRepo,
  getTourSelectionCandidateRepo,
  listSeatAccessRequestsRepo,
  rejectSeatAccessRequestRepo,
  type SeatAccessRequestRow,
  type SeatAccessRequestRequestedRole,
  type SeatAccessRequestStatus,
  type TourSelectionCandidate,
} from "./seatAccessRequests.repo.js";
import { enrichRequesterIdentityRows } from "../auth/requesterIdentity.js";
import { enqueueSeatAccessDecisionEmail } from "../notifications/notifications.service.js";
import { searchToursRepo } from "../tours/tours.repo.js";

type DatabaseErrorLike = {
  code?: string;
};

function isAdminRole(role: AuthUser["role"]) {
  return role === "admin" || role === "manager";
}

function isEmployeeRole(
  role: AuthUser["role"],
): role is SeatAccessRequestRequestedRole {
  return role === "subcontractor" || role === "agent";
}

function canSubmitSeatAccessRequest(user: AuthUser) {
  return isEmployeeRole(user.role) || isAdminRole(user.role);
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function destinationMatchesApprovedRequest(params: {
  approvedDestination: string;
  tour: {
    title: string;
    country: string | null;
    cities: string[];
  };
}) {
  const needle = normalizeText(params.approvedDestination);
  if (!needle) {
    return true;
  }

  const candidates = [
    params.tour.title,
    params.tour.country,
    ...(Array.isArray(params.tour.cities) ? params.tour.cities : []),
  ]
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);

  if (candidates.length === 0) {
    return false;
  }

  return candidates.some(
    (value) => value.includes(needle) || needle.includes(value),
  );
}

function toDateMs(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

const DEFAULT_DECLINE_MESSAGE =
  "Sorry your request has been declined, try again after a while.";
const ACCESS_APPROVAL_TTL_MS = 6 * 60 * 60 * 1000;
const SERIAL_BUNDLE_ALLOWED_COUNTS = new Set([10, 11, 12]);
const SERIAL_FIRST_PAYMENT_PER_SEAT_MNT = 50000;

type ResolvedSerialSelectionInput = {
  serialCount: number;
  requestedSeats: number;
};

type SerialCandidateWithAvailability = TourSelectionCandidate & {
  remaining_seats: number;
  enough_seats: boolean;
};

function toTimestampMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function resolveAccessApprovalExpiryMs(accessRequest: {
  approved_at: string | null;
  expires_at: string | null;
}) {
  const approvedAtMs = toTimestampMs(accessRequest.approved_at);
  if (approvedAtMs !== null) {
    return approvedAtMs + ACCESS_APPROVAL_TTL_MS;
  }

  return toTimestampMs(accessRequest.expires_at);
}

function resolveSerialSelectionInput(input: {
  requestedSeats: number;
  serialCount: number;
}): ResolvedSerialSelectionInput {
  const requestedSeats = Math.max(
    1,
    Math.floor(Number(input.requestedSeats) || 1),
  );
  const requestedSerialCount = Math.max(
    1,
    Math.floor(Number(input.serialCount) || 1),
  );
  const serialCount = env.b2bSerialEnforcementEnabled
    ? requestedSerialCount
    : 1;

  if (
    env.b2bSerialEnforcementEnabled &&
    !SERIAL_BUNDLE_ALLOWED_COUNTS.has(serialCount)
  ) {
    throw badRequest("serialCount must be one of: 10, 11, 12");
  }

  if (!env.b2bSerialEnforcementEnabled && requestedSerialCount > 1) {
    throw badRequest("Serial bundle purchasing is currently disabled");
  }

  return {
    serialCount,
    requestedSeats,
  };
}

function normalizeIdempotencyKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .slice(0, 180);
}

function buildSeatSelectionIdempotencyKey(params: {
  accessRequestId: string;
  requesterUserId: string;
  tourId: string;
  travelDate: string;
  requestedSeats: number;
  serialCount: number;
}) {
  return [
    "seat-access-selection",
    params.accessRequestId,
    params.requesterUserId,
    params.tourId,
    params.travelDate,
    String(params.requestedSeats),
    String(params.serialCount),
  ].join(":");
}

function asRecordOrNull(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function computeRemainingSeats(params: {
  stats: {
    remaining: number | string;
    capacity: number | string;
    booked: number | string;
  } | null;
  candidateRemaining: number | string | null;
}) {
  const statsRemaining = Number(params.stats?.remaining ?? 0);
  const statsCapacity = Number(params.stats?.capacity ?? 0);
  const statsBooked = Number(params.stats?.booked ?? 0);
  const candidateRemaining = Number(params.candidateRemaining ?? 0);
  let remaining =
    statsRemaining > 0 || candidateRemaining <= 0
      ? statsRemaining
      : candidateRemaining;

  if (remaining <= 0 && statsBooked === 0 && statsCapacity > 0) {
    remaining = statsCapacity;
  }

  return Math.max(0, Math.floor(Number(remaining) || 0));
}

function shouldRequireSingleDeposit(travelDate: string) {
  const travelMs = toDateMs(travelDate);
  const thresholdDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const thresholdMs = toDateMs(thresholdDate);
  return travelMs > thresholdMs;
}

async function assertSeatAccessSelectable(
  client: PoolClient,
  user: AuthUser,
  accessRequestId: string,
) {
  const accessRequest = await getSeatAccessRequestByIdForUpdateRepo(
    client,
    accessRequestId,
  );
  if (!accessRequest) {
    throw notFound("Seat access request not found");
  }

  if (!isAdminRole(user.role) && accessRequest.requester_user_id !== user.id) {
    throw forbidden("Cannot use another user's seat access request");
  }

  if (accessRequest.status === "consumed") {
    throw badRequest("This seat access request has already been used");
  }

  if (accessRequest.status !== "approved") {
    throw badRequest(
      "Seat access request must be approved before selecting tour/seats",
    );
  }

  if (accessRequest.seat_request_id) {
    throw badRequest("This seat access request has already been used");
  }

  const approvalExpiryMs = resolveAccessApprovalExpiryMs(accessRequest);
  if (approvalExpiryMs !== null && approvalExpiryMs <= Date.now()) {
    await expireSeatAccessRequestRepo(client, accessRequest.id);
    throw badRequest("This approval has expired. Please submit a new request");
  }

  return accessRequest;
}

async function resolveSerialCandidatesForSelection(
  client: PoolClient,
  params: {
    accessRequest: {
      destination: string;
      from_date: string;
      to_date: string;
    };
    tourId: string;
    travelDate: string;
    serialCount: number;
  },
) {
  const fromMs = toDateMs(params.accessRequest.from_date);
  const toMs = toDateMs(params.accessRequest.to_date);
  const travelMs = toDateMs(params.travelDate);

  if (travelMs < fromMs || travelMs > toMs) {
    throw badRequest("Selected travel date is outside approved date range");
  }

  const tour = await getTourSelectionCandidateRepo(client, {
    tourId: params.tourId,
    travelDate: params.travelDate,
  });
  if (!tour) {
    throw badRequest("Tour is not available on selected departure date");
  }

  if (
    !destinationMatchesApprovedRequest({
      approvedDestination: params.accessRequest.destination,
      tour,
    })
  ) {
    throw badRequest("Selected tour does not match approved destination");
  }

  const serialCandidates: TourSelectionCandidate[] = [
    {
      ...tour,
      departure_date: String(tour.departure_date || params.travelDate).slice(
        0,
        10,
      ),
    },
  ];

  if (params.serialCount > 1) {
    const anchorTitle = String(tour.title || "").trim();
    if (!anchorTitle) {
      throw badRequest("Selected tour title is required for serial purchase");
    }

    const nextTours = await listNextTourSelectionCandidatesByTitleRepo(client, {
      title: anchorTitle,
      startDateExclusive: params.travelDate,
      limit: params.serialCount - 1,
    });

    if (nextTours.length < params.serialCount - 1) {
      throw badRequest(
        `Not enough upcoming serial tours. Required ${params.serialCount}, available ${nextTours.length + 1}`,
      );
    }

    serialCandidates.push(
      ...nextTours.slice(0, params.serialCount - 1).map((row) => ({
        ...row,
        departure_date: String(row.departure_date || "").slice(0, 10),
      })),
    );
  }

  for (const candidate of serialCandidates) {
    if (!candidate.departure_date) {
      throw badRequest("Serial tour candidate has invalid departure date");
    }

    if (
      !destinationMatchesApprovedRequest({
        approvedDestination: params.accessRequest.destination,
        tour: candidate,
      })
    ) {
      throw badRequest(
        "One of serial tours does not match approved destination",
      );
    }
  }

  return serialCandidates;
}

async function acquireSerialSelectionLocks(
  client: PoolClient,
  candidates: TourSelectionCandidate[],
) {
  const lockKeys = [
    ...new Set(
      candidates
        .map((candidate) => {
          const date = String(candidate.departure_date || "").slice(0, 10);
          return `${normalizeText(candidate.title)}|${candidate.id}|${date}`;
        })
        .filter((value) => value.length > 0),
    ),
  ].sort();

  for (const lockKey of lockKeys) {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
  }
}

async function enrichSerialCandidatesWithAvailability(
  client: PoolClient,
  params: {
    candidates: TourSelectionCandidate[];
    requestedSeats: number;
  },
) {
  const rows: SerialCandidateWithAvailability[] = [];

  for (const candidate of params.candidates) {
    const stats = await getDepartureSeatStatsRepo(client, {
      tourId: candidate.id,
      travelDate: candidate.departure_date,
    });

    const remainingSeats = computeRemainingSeats({
      stats,
      candidateRemaining: candidate.available_seats,
    });

    rows.push({
      ...candidate,
      remaining_seats: remainingSeats,
      enough_seats: params.requestedSeats <= remainingSeats,
    });
  }

  return rows;
}

async function resolveOrganizationIdForSeatAccess(user: AuthUser) {
  if (user.organizationId) {
    return user.organizationId;
  }

  const primaryOrgId = await getPrimaryOrganizationForUserRepo(user.id);
  if (primaryOrgId) {
    return primaryOrgId;
  }

  if (!isEmployeeRole(user.role) && !isAdminRole(user.role)) {
    return null;
  }

  const fallbackOrg =
    (await getOrganizationByIdRepo(FALLBACK_ORGANIZATION_ID)) ||
    (await ensureFallbackOrganizationRepo({ createdBy: user.id }));
  if (!fallbackOrg) {
    return null;
  }

  logger.warn("audit.organization.unbound_request_fallback_applied", {
    userId: user.id,
    role: user.role,
    organizationId: fallbackOrg.id,
    context: "seat_access_request",
  });

  return fallbackOrg.id;
}

async function enrichSeatAccessRow(row: SeatAccessRequestRow) {
  const [enriched] = await enrichRequesterIdentityRows({
    rows: [row],
    getRequesterAuthUserId: (item) => item.requester_user_id,
  });
  return enriched || row;
}

async function ensureBookableToursExistForApproval(request: {
  destination: string;
  from_date: string;
  to_date: string;
  planned_seats: number;
}) {
  const minSeats = Math.max(1, Math.floor(Number(request.planned_seats) || 1));

  const strictMatches = await searchToursRepo({
    from: request.from_date,
    to: request.to_date,
    destination: request.destination,
    minSeats,
  });

  if (strictMatches.length > 0) {
    return;
  }

  const broadMatches = await searchToursRepo({
    from: request.from_date,
    to: request.to_date,
    minSeats,
  });

  if (broadMatches.length === 0) {
    throw badRequest(
      "Cannot approve request: no tours are currently available for the selected date range and seat count",
    );
  }

  throw badRequest(
    `Cannot approve request: no tours currently match destination "${request.destination}" for ${request.from_date} to ${request.to_date}. Ask requester to submit a destination that exists in current inventory.`,
  );
}

export async function submitSeatAccessRequestService(
  user: AuthUser,
  input: {
    fromDate: string;
    toDate: string;
    destination: string;
    note: string | null;
    plannedSeats: number;
    requestedRole?: SeatAccessRequestRequestedRole;
  },
) {
  if (!canSubmitSeatAccessRequest(user)) {
    throw forbidden(
      "Only subcontractor, agent, admin, or manager can submit seat access requests",
    );
  }
  const requesterRoleFromInput = input.requestedRole;
  const requesterRole: SeatAccessRequestRequestedRole = isEmployeeRole(
    user.role,
  )
    ? user.role
    : requesterRoleFromInput || "subcontractor";

  if (
    isEmployeeRole(user.role) &&
    requesterRoleFromInput &&
    requesterRoleFromInput !== user.role
  ) {
    throw forbidden("requestedRole must match your account role");
  }

  const resolvedOrganizationId = await resolveOrganizationIdForSeatAccess(user);

  if (!resolvedOrganizationId) {
    throw badRequest("User must belong to an organization");
  }

  try {
    const id = await withTransaction(async (client) => {
      return createSeatAccessRequestRepo(client, {
        requesterUserId: user.id,
        organizationId: resolvedOrganizationId,
        requesterRole,
        fromDate: input.fromDate,
        toDate: input.toDate,
        destination: input.destination,
        note: input.note,
        plannedSeats: input.plannedSeats,
      });
    });

    if (!id) {
      throw new Error("Seat access request insert returned empty id");
    }

    const row = await getSeatAccessRequestByIdRepo(id);
    if (!row) {
      throw new Error("Seat access request created but could not be loaded");
    }

    const enrichedRow = await enrichSeatAccessRow(row);

    logger.info("audit.seat_access_request.submitted", {
      seatAccessRequestId: enrichedRow.id,
      userId: user.id,
      organizationId: enrichedRow.organization_id,
      destination: enrichedRow.destination,
      fromDate: enrichedRow.from_date,
      toDate: enrichedRow.to_date,
    });

    return enrichedRow;
  } catch (error) {
    const dbError = error as DatabaseErrorLike;
    if (dbError.code === "23505") {
      throw badRequest(
        "A pending request already exists for this destination and date range",
      );
    }
    throw error;
  }
}

export async function listSeatAccessRequestsService(
  user: AuthUser,
  filters: {
    status?: SeatAccessRequestStatus;
    destination?: string;
  },
) {
  const rows = await listSeatAccessRequestsRepo({
    userId: isAdminRole(user.role) ? undefined : user.id,
    status: filters.status,
    destination: filters.destination,
  });

  return enrichRequesterIdentityRows({
    rows,
    getRequesterAuthUserId: (item) => item.requester_user_id,
  });
}

export async function approveSeatAccessRequestService(
  user: AuthUser,
  id: string,
  reason: string | null,
) {
  if (!isAdminRole(user.role)) {
    throw forbidden("Only admin or manager can approve seat access requests");
  }

  const preflight = await getSeatAccessRequestByIdRepo(id);
  if (!preflight) {
    throw notFound("Seat access request not found");
  }
  if (preflight.status !== "pending") {
    throw badRequest("Only pending seat access requests can be approved");
  }

  await ensureBookableToursExistForApproval(preflight);

  const row = await withTransaction(async (client) => {
    const request = await getSeatAccessRequestByIdForUpdateRepo(client, id);
    if (!request) {
      throw notFound("Seat access request not found");
    }
    if (request.status !== "pending") {
      throw badRequest("Only pending seat access requests can be approved");
    }

    await approveSeatAccessRequestRepo(client, {
      id: request.id,
      reviewedBy: user.id,
      decisionReason: reason,
    });

    const updated = await getSeatAccessRequestByIdRepo(request.id, client);
    if (!updated) {
      throw new Error("Seat access request approved but could not be loaded");
    }
    return updated;
  });

  logger.info("audit.seat_access_request.approved", {
    seatAccessRequestId: row.id,
    userId: row.requester_user_id,
    reviewedBy: user.id,
    organizationId: row.organization_id,
  });

  try {
    await enqueueSeatAccessDecisionEmail({
      seatAccessRequestId: row.id,
      recipientEmail: row.requester_email,
      status: "approved",
      destination: row.destination,
      fromDate: row.from_date,
      toDate: row.to_date,
      reason: row.decision_reason,
      expiresAt: row.expires_at,
    });
  } catch (error) {
    logger.warn("notification.seat_access.approved.enqueue_failed", {
      seatAccessRequestId: row.id,
      error,
    });
  }

  return enrichSeatAccessRow(row);
}

export async function rejectSeatAccessRequestService(
  user: AuthUser,
  id: string,
  reason: string | null,
) {
  if (!isAdminRole(user.role)) {
    throw forbidden("Only admin or manager can reject seat access requests");
  }

  const row = await withTransaction(async (client) => {
    const request = await getSeatAccessRequestByIdForUpdateRepo(client, id);
    if (!request) {
      throw notFound("Seat access request not found");
    }
    if (request.status !== "pending") {
      throw badRequest("Only pending seat access requests can be rejected");
    }

    await rejectSeatAccessRequestRepo(client, {
      id: request.id,
      reviewedBy: user.id,
      decisionReason: reason || DEFAULT_DECLINE_MESSAGE,
    });

    const updated = await getSeatAccessRequestByIdRepo(request.id, client);
    if (!updated) {
      throw new Error("Seat access request rejected but could not be loaded");
    }
    return updated;
  });

  logger.info("audit.seat_access_request.rejected", {
    seatAccessRequestId: row.id,
    userId: row.requester_user_id,
    reviewedBy: user.id,
    organizationId: row.organization_id,
  });

  try {
    await enqueueSeatAccessDecisionEmail({
      seatAccessRequestId: row.id,
      recipientEmail: row.requester_email,
      status: "rejected",
      destination: row.destination,
      fromDate: row.from_date,
      toDate: row.to_date,
      reason: row.decision_reason,
      expiresAt: row.expires_at,
    });
  } catch (error) {
    logger.warn("notification.seat_access.rejected.enqueue_failed", {
      seatAccessRequestId: row.id,
      error,
    });
  }

  return enrichSeatAccessRow(row);
}

export async function previewSeatAccessSerialSelectionService(
  user: AuthUser,
  accessRequestId: string,
  input: {
    tourId: string;
    travelDate: string;
    requestedSeats: number;
    serialCount: number;
  },
) {
  if (!isEmployeeRole(user.role) && !isAdminRole(user.role)) {
    throw forbidden(
      "Only subcontractor, agent, admin, or manager can preview serial selections",
    );
  }

  const resolvedInput = resolveSerialSelectionInput(input);

  return withTransaction(async (client) => {
    const accessRequest = await assertSeatAccessSelectable(
      client,
      user,
      accessRequestId,
    );
    const serialCandidates = await resolveSerialCandidatesForSelection(client, {
      accessRequest,
      tourId: input.tourId,
      travelDate: input.travelDate,
      serialCount: resolvedInput.serialCount,
    });
    const enrichedCandidates = await enrichSerialCandidatesWithAvailability(
      client,
      {
        candidates: serialCandidates,
        requestedSeats: resolvedInput.requestedSeats,
      },
    );

    const hasSeatShortage = enrichedCandidates.some(
      (candidate) => !candidate.enough_seats,
    );
    const requiresFirstPaymentWithin6h =
      resolvedInput.serialCount > 1 ||
      shouldRequireSingleDeposit(input.travelDate);
    const multiplier =
      resolvedInput.serialCount > 1 ? resolvedInput.serialCount : 1;

    return {
      access_request_id: accessRequest.id,
      serial_count: resolvedInput.serialCount,
      requested_seats: resolvedInput.requestedSeats,
      ready: !hasSeatShortage,
      has_seat_shortage: hasSeatShortage,
      requires_first_payment_6h: requiresFirstPaymentWithin6h,
      first_payment_mnt: requiresFirstPaymentWithin6h
        ? resolvedInput.requestedSeats *
          SERIAL_FIRST_PAYMENT_PER_SEAT_MNT *
          multiplier
        : 0,
      first_payment_formula: requiresFirstPaymentWithin6h
        ? `${SERIAL_FIRST_PAYMENT_PER_SEAT_MNT} * ${resolvedInput.requestedSeats} * ${multiplier}`
        : "0",
      chain: enrichedCandidates.map((candidate, index) => ({
        index: index + 1,
        tour_id: candidate.id,
        title: candidate.title,
        destination: candidate.title,
        travel_date: candidate.departure_date,
        unit_price_mnt: Number(candidate.base_price || 0),
        available_seats: candidate.remaining_seats,
        enough_seats: candidate.enough_seats,
      })),
    };
  });
}

export async function selectTourFromSeatAccessRequestService(
  user: AuthUser,
  accessRequestId: string,
  input: {
    tourId: string;
    travelDate: string;
    requestedSeats: number;
    serialCount: number;
    idempotencyKey?: string;
  },
) {
  if (!isEmployeeRole(user.role) && !isAdminRole(user.role)) {
    throw forbidden(
      "Only subcontractor, agent, admin, or manager can select tours for approved requests",
    );
  }

  const resolvedInput = resolveSerialSelectionInput(input);

  return withTransaction(async (client) => {
    const accessRequestForIdempotency =
      await getSeatAccessRequestByIdForUpdateRepo(client, accessRequestId);
    if (!accessRequestForIdempotency) {
      throw notFound("Seat access request not found");
    }
    if (
      !isAdminRole(user.role) &&
      accessRequestForIdempotency.requester_user_id !== user.id
    ) {
      throw forbidden("Cannot use another user's seat access request");
    }

    const idempotencyKey =
      normalizeIdempotencyKey(input.idempotencyKey) ||
      buildSeatSelectionIdempotencyKey({
        accessRequestId,
        requesterUserId: accessRequestForIdempotency.requester_user_id,
        tourId: input.tourId,
        travelDate: input.travelDate,
        requestedSeats: resolvedInput.requestedSeats,
        serialCount: resolvedInput.serialCount,
      });

    const idempotencyRow = await beginSeatAccessSelectionIdempotencyRepo(
      client,
      {
        accessRequestId,
        requesterUserId: accessRequestForIdempotency.requester_user_id,
        idempotencyKey,
        requestPayload: {
          tourId: input.tourId,
          travelDate: input.travelDate,
          requestedSeats: resolvedInput.requestedSeats,
          serialCount: resolvedInput.serialCount,
        },
      },
    );

    if (!idempotencyRow) {
      throw new Error(
        "Failed to initialize seat-access selection idempotency state",
      );
    }

    if (!idempotencyRow.created) {
      const existingResponse = asRecordOrNull(idempotencyRow.response_payload);
      if (idempotencyRow.status === "completed" && existingResponse) {
        return {
          ...existingResponse,
          idempotency_replayed: true,
        };
      }

      throw badRequest(
        "Same seat selection request is already processing. Please retry shortly.",
      );
    }

    const accessRequest = await assertSeatAccessSelectable(
      client,
      user,
      accessRequestId,
    );
    const serialCandidates = await resolveSerialCandidatesForSelection(client, {
      accessRequest,
      tourId: input.tourId,
      travelDate: input.travelDate,
      serialCount: resolvedInput.serialCount,
    });

    await acquireSerialSelectionLocks(client, serialCandidates);

    const candidatesWithAvailability =
      await enrichSerialCandidatesWithAvailability(client, {
        candidates: serialCandidates,
        requestedSeats: resolvedInput.requestedSeats,
      });

    const insufficientCandidate = candidatesWithAvailability.find(
      (candidate) => !candidate.enough_seats,
    );
    if (insufficientCandidate) {
      throw badRequest(
        `Don't have enough seats for serial ${insufficientCandidate.departure_date}. Remaining seats: ${insufficientCandidate.remaining_seats}`,
      );
    }

    await ensureGroupPolicyGuard({
      user,
      organizationId: accessRequest.organization_id,
      requestedSeats: resolvedInput.requestedSeats,
    });

    const serialGroupId = randomUUID();
    const createdSeatRequests: Array<{
      id: string;
      request_no: string;
      status: string;
      deposit_due_at: string | null;
      serial_group_id: string;
      serial_index: number;
      serial_total: number;
      tour_id: string;
      travel_date: string;
      destination: string;
    }> = [];

    for (let index = 0; index < candidatesWithAvailability.length; index += 1) {
      const candidate = candidatesWithAvailability[index];
      const created = await createApprovedSeatRequestFromAccessRepo(client, {
        requesterUserId: accessRequest.requester_user_id,
        organizationId: accessRequest.organization_id,
        requesterRole: accessRequest.requester_role,
        tourId: candidate.id,
        destination: candidate.title,
        travelDate: candidate.departure_date,
        requestedSeats: resolvedInput.requestedSeats,
        unitPriceMnt: Number(candidate.base_price || 0),
        accessRequestId: accessRequest.id,
        serialGroupId,
        serialIndex: index + 1,
        serialTotal: resolvedInput.serialCount,
      });

      await client.query(
        `select public.fn_generate_payment_milestones($1::uuid)`,
        [created.id],
      );

      createdSeatRequests.push({
        ...created,
        tour_id: candidate.id,
        travel_date: candidate.departure_date,
        destination: candidate.title,
      });
    }

    const primaryRequest = createdSeatRequests[0];
    await consumeSeatAccessRequestRepo(client, {
      id: accessRequest.id,
      seatRequestId: primaryRequest.id,
      serialGroupId,
      serialCount: resolvedInput.serialCount,
    });

    for (const created of createdSeatRequests) {
      await client.query(
        `
        insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
        values
          (
            'seat_request',
            $1::text,
            'seat_request.created',
            jsonb_build_object(
              'seatRequestId',
              $1::text,
              'viaAccessRequest',
              $2::text,
              'serialGroupId',
              $3::text,
              'serialIndex',
              $4,
              'serialTotal',
              $5
            )
          ),
          (
            'seat_request',
            $1::text,
            'seat_request.approved',
            jsonb_build_object(
              'seatRequestId',
              $1::text,
              'autoApproved',
              true,
              'viaAccessRequest',
              $2::text,
              'serialGroupId',
              $3::text,
              'serialIndex',
              $4,
              'serialTotal',
              $5
            )
          )
        `,
        [
          created.id,
          accessRequest.id,
          serialGroupId,
          created.serial_index,
          resolvedInput.serialCount,
        ],
      );
    }

    const responsePayload = {
      ...primaryRequest,
      serial_group_id: serialGroupId,
      serial_total: resolvedInput.serialCount,
      serial_created_count: createdSeatRequests.length,
      created_request_ids: createdSeatRequests.map((row) => row.id),
      created_requests: createdSeatRequests,
      idempotency_replayed: false,
    };

    await completeSeatAccessSelectionIdempotencyRepo(client, {
      accessRequestId,
      requesterUserId: accessRequest.requester_user_id,
      idempotencyKey,
      responsePayload,
    });

    logger.info("audit.seat_access_request.consumed", {
      seatAccessRequestId: accessRequest.id,
      seatRequestId: primaryRequest.id,
      userId: accessRequest.requester_user_id,
      organizationId: accessRequest.organization_id,
      requestedSeats: resolvedInput.requestedSeats,
      seatRequestStatus: primaryRequest.status as SeatRequestStatus,
      serialGroupId,
      serialCount: resolvedInput.serialCount,
      createdSeatRequestIds: createdSeatRequests.map((row) => row.id),
      idempotencyKey,
    });

    return responsePayload;
  });
}
