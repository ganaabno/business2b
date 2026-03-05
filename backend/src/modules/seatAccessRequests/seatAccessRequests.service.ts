import { withTransaction } from "../../db/transaction.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { getPrimaryOrganizationForUserRepo } from "../organizations/organizations.repo.js";
import {
  createApprovedSeatRequestFromAccessRepo,
  type SeatRequestStatus,
} from "../seatRequests/seatRequests.repo.js";
import { ensureGroupPolicyGuard } from "../seatRequests/seatRequests.service.js";
import {
  approveSeatAccessRequestRepo,
  consumeSeatAccessRequestRepo,
  createSeatAccessRequestRepo,
  expireSeatAccessRequestRepo,
  getDepartureSeatStatsRepo,
  getSeatAccessRequestByIdForUpdateRepo,
  getSeatAccessRequestByIdRepo,
  getTourSelectionCandidateRepo,
  listSeatAccessRequestsRepo,
  rejectSeatAccessRequestRepo,
  type SeatAccessRequestRequestedRole,
  type SeatAccessRequestStatus,
} from "./seatAccessRequests.repo.js";

type DatabaseErrorLike = {
  code?: string;
};

function isAdminRole(role: AuthUser["role"]) {
  return role === "admin" || role === "manager";
}

function isEmployeeRole(role: AuthUser["role"]): role is SeatAccessRequestRequestedRole {
  return role === "subcontractor" || role === "agent";
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function toDateMs(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

export async function submitSeatAccessRequestService(
  user: AuthUser,
  input: {
    fromDate: string;
    toDate: string;
    destination: string;
    note: string | null;
  },
) {
  if (!isEmployeeRole(user.role)) {
    throw forbidden("Only subcontractor or agent can submit seat access requests");
  }
  const requesterRole: SeatAccessRequestRequestedRole = user.role;

  const organizationId = user.organizationId || (await getPrimaryOrganizationForUserRepo(user.id));
  if (!organizationId) {
    throw badRequest("User must belong to an organization");
  }

  try {
    const id = await withTransaction(async (client) => {
      return createSeatAccessRequestRepo(client, {
        requesterUserId: user.id,
        organizationId,
        requesterRole,
        fromDate: input.fromDate,
        toDate: input.toDate,
        destination: input.destination,
        note: input.note,
      });
    });

    if (!id) {
      throw new Error("Seat access request insert returned empty id");
    }

    const row = await getSeatAccessRequestByIdRepo(id);
    if (!row) {
      throw new Error("Seat access request created but could not be loaded");
    }

    logger.info("audit.seat_access_request.submitted", {
      seatAccessRequestId: row.id,
      userId: user.id,
      organizationId: row.organization_id,
      destination: row.destination,
      fromDate: row.from_date,
      toDate: row.to_date,
    });

    return row;
  } catch (error) {
    const dbError = error as DatabaseErrorLike;
    if (dbError.code === "23505") {
      throw badRequest("A pending request already exists for this destination and date range");
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
  return listSeatAccessRequestsRepo({
    userId: isAdminRole(user.role) ? undefined : user.id,
    status: filters.status,
    destination: filters.destination,
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

  return row;
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
      decisionReason: reason,
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

  return row;
}

export async function selectTourFromSeatAccessRequestService(
  user: AuthUser,
  accessRequestId: string,
  input: {
    tourId: string;
    travelDate: string;
    requestedSeats: number;
  },
) {
  if (!isEmployeeRole(user.role)) {
    throw forbidden("Only subcontractor or agent can select tours for approved requests");
  }

  return withTransaction(async (client) => {
    const accessRequest = await getSeatAccessRequestByIdForUpdateRepo(client, accessRequestId);
    if (!accessRequest) {
      throw notFound("Seat access request not found");
    }
    if (accessRequest.requester_user_id !== user.id) {
      throw forbidden("Cannot use another user's seat access request");
    }
    if (accessRequest.status !== "approved") {
      throw badRequest("Seat access request must be approved before selecting tour/seats");
    }
    if (accessRequest.seat_request_id) {
      throw badRequest("This seat access request has already been used");
    }

    if (accessRequest.expires_at && new Date(accessRequest.expires_at).getTime() < Date.now()) {
      await expireSeatAccessRequestRepo(client, accessRequest.id);
      throw badRequest("This approval has expired. Please submit a new request");
    }

    const fromMs = toDateMs(accessRequest.from_date);
    const toMs = toDateMs(accessRequest.to_date);
    const travelMs = toDateMs(input.travelDate);

    if (travelMs < fromMs || travelMs > toMs) {
      throw badRequest("Selected travel date is outside approved date range");
    }

    const tour = await getTourSelectionCandidateRepo(client, {
      tourId: input.tourId,
      travelDate: input.travelDate,
    });
    if (!tour) {
      throw badRequest("Tour is not available on selected departure date");
    }

    const requestedDestination = normalizeText(accessRequest.destination);
    const tourDestination = normalizeText(tour.title || "");
    if (!tourDestination.includes(requestedDestination)) {
      throw badRequest("Selected tour does not match approved destination");
    }

    const stats = await getDepartureSeatStatsRepo(client, {
      tourId: input.tourId,
      travelDate: input.travelDate,
    });
    const remaining = Number(stats?.remaining ?? 0);
    if (input.requestedSeats > remaining) {
      throw badRequest(`DOnt have enough seats. Remaining seats: ${remaining}`);
    }

    await ensureGroupPolicyGuard({
      user,
      organizationId: accessRequest.organization_id,
      requestedSeats: input.requestedSeats,
    });

    const seatRequest = await createApprovedSeatRequestFromAccessRepo(client, {
      requesterUserId: accessRequest.requester_user_id,
      organizationId: accessRequest.organization_id,
      requesterRole: accessRequest.requester_role,
      tourId: input.tourId,
      destination: tour.title,
      travelDate: input.travelDate,
      requestedSeats: input.requestedSeats,
      unitPriceMnt: Number(tour.base_price || 0),
      accessRequestId: accessRequest.id,
    });

    await client.query(`select public.fn_generate_payment_milestones($1::uuid)`, [seatRequest.id]);

    await consumeSeatAccessRequestRepo(client, {
      id: accessRequest.id,
      seatRequestId: seatRequest.id,
    });

    await client.query(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      values
        ('seat_request', $1, 'seat_request.created', jsonb_build_object('seatRequestId', $1, 'viaAccessRequest', $2)),
        ('seat_request', $1, 'seat_request.approved', jsonb_build_object('seatRequestId', $1, 'autoApproved', true, 'viaAccessRequest', $2))
      `,
      [seatRequest.id, accessRequest.id],
    );

    logger.info("audit.seat_access_request.consumed", {
      seatAccessRequestId: accessRequest.id,
      seatRequestId: seatRequest.id,
      userId: accessRequest.requester_user_id,
      organizationId: accessRequest.organization_id,
      requestedSeats: input.requestedSeats,
      seatRequestStatus: seatRequest.status as SeatRequestStatus,
    });

    return seatRequest;
  });
}
