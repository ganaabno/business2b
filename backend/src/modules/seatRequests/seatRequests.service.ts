import { withTransaction, q } from "../../db/transaction.js";
import { env } from "../../config/env.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { logger } from "../../shared/logger.js";
import { getPrimaryOrganizationForUserRepo } from "../organizations/organizations.repo.js";
import {
  approveSeatRequestRepo,
  cancelSeatRequestRepo,
  createSeatRequestRepo,
  getOrganizationGroupPolicyRepo,
  getSeatRequestByIdRepo,
  listSeatRequestsRepo,
  rejectSeatRequestRepo,
  type GroupPolicyMode,
} from "./seatRequests.repo.js";
import { canTransitionSeatRequest } from "./seatRequests.state-machine.js";

function assertRequesterRole(role: AuthUser["role"]): role is "subcontractor" | "agent" {
  return role === "subcontractor" || role === "agent";
}

function resolveGroupPolicyMode(mode: GroupPolicyMode): GroupPolicyMode {
  if (mode === "off") {
    return "off";
  }
  if (!env.b2bGroupPolicyEnforce || mode === "validate_only") {
    return "validate_only";
  }
  return "enforce";
}

export async function ensureGroupPolicyGuard(params: {
  user: AuthUser;
  organizationId: string;
  requestedSeats: number;
}) {
  if (!env.b2bGroupPolicyEnabled) {
    return;
  }

  const policy = await getOrganizationGroupPolicyRepo(params.organizationId);
  const effectiveMode = resolveGroupPolicyMode(policy.mode);
  if (effectiveMode === "off") {
    return;
  }

  const minPax = Math.max(1, Math.floor(Number(policy.minPax) || 1));
  const maxPax = Math.max(minPax, Math.floor(Number(policy.maxPax) || minPax));
  const violatesPolicy = params.requestedSeats < minPax || params.requestedSeats > maxPax;

  if (!violatesPolicy) {
    return;
  }

  const message = `Requested seats (${params.requestedSeats}) is outside organization group policy range ${minPax}-${maxPax}`;

  logger.warn("audit.group_policy.violation", {
    userId: params.user.id,
    organizationId: params.organizationId,
    requestedSeats: params.requestedSeats,
    minPax,
    maxPax,
    mode: effectiveMode,
  });

  if (effectiveMode === "enforce") {
    throw badRequest(message);
  }
}

export async function createSeatRequestService(
  user: AuthUser,
  input: {
    tourId: string;
    destination: string;
    travelDate: string;
    requestedSeats: number;
    unitPriceMnt: number;
  },
) {
  if (!assertRequesterRole(user.role)) {
    throw forbidden("Only subcontractor or agent can create seat requests");
  }
  const requesterRole: "subcontractor" | "agent" = user.role;

  const organizationId = user.organizationId || (await getPrimaryOrganizationForUserRepo(user.id));
  if (!organizationId) {
    throw badRequest("User must belong to an organization");
  }

  await ensureGroupPolicyGuard({
    user,
    organizationId,
    requestedSeats: input.requestedSeats,
  });

  return withTransaction(async (client) => {
    const row = await createSeatRequestRepo(client, {
      requesterUserId: user.id,
      organizationId,
      requesterRole,
      tourId: input.tourId,
      destination: input.destination,
      travelDate: input.travelDate,
      requestedSeats: input.requestedSeats,
      unitPriceMnt: input.unitPriceMnt,
    });

    await client.query(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      values ('seat_request', $1, 'seat_request.created', jsonb_build_object('seatRequestId', $1))
      `,
      [row.id],
    );

    logger.info("audit.seat_request.created", {
      seatRequestId: row.id,
      requesterUserId: user.id,
      requesterRole,
      organizationId,
    });

    return row;
  });
}

export async function listSeatRequestsService(
  user: AuthUser,
  filters: { destination?: string; status?: string; organizationId?: string; paymentState?: string },
) {
  if (user.role === "admin" || user.role === "manager") {
    return listSeatRequestsRepo({
      destination: filters.destination,
      status: filters.status,
      organizationId: filters.organizationId,
      paymentState: filters.paymentState,
    });
  }

  return listSeatRequestsRepo({
    userId: user.id,
    organizationId: filters.organizationId || user.organizationId || undefined,
    destination: filters.destination,
    status: filters.status,
    paymentState: filters.paymentState,
  });
}

export async function getSeatRequestService(user: AuthUser, requestId: string) {
  const row = await getSeatRequestByIdRepo(requestId);
  if (!row) throw notFound("Seat request not found");
  if (user.role === "admin" || user.role === "manager") return row;
  if (row.requester_user_id !== user.id) {
    throw forbidden("Cannot access this seat request");
  }
  return row;
}

export async function approveSeatRequestService(user: AuthUser, requestId: string, note: string | null) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can approve requests");
  }

  return withTransaction(async (client) => {
    const current = await getSeatRequestByIdRepo(requestId);
    if (!current) throw notFound("Seat request not found");
    if (!canTransitionSeatRequest(current.status, "approve")) {
      throw badRequest("Invalid status transition for approval");
    }

    const approved = await approveSeatRequestRepo(client, {
      requestId,
      approvedBy: user.id,
      note,
    });
    if (!approved) {
      throw badRequest("Request is not pending or cannot be approved");
    }

    await client.query(`select public.fn_generate_payment_milestones($1::uuid)`, [requestId]);
    await client.query(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      values ('seat_request', $1, 'seat_request.approved', jsonb_build_object('seatRequestId', $1))
      `,
      [requestId],
    );

    logger.info("audit.seat_request.approved", {
      seatRequestId: requestId,
      approvedBy: user.id,
      approvalLatencyMs: Date.now() - new Date(current.created_at).getTime(),
    });
  });
}

export async function rejectSeatRequestService(user: AuthUser, requestId: string, reason: string | null) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can reject requests");
  }
  await withTransaction(async (client) => {
    const current = await getSeatRequestByIdRepo(requestId);
    if (!current) throw notFound("Seat request not found");
    if (!canTransitionSeatRequest(current.status, "reject")) {
      throw badRequest("Invalid status transition for rejection");
    }

    const rejected = await rejectSeatRequestRepo(client, {
      requestId,
      rejectedBy: user.id,
      reason,
    });
    if (!rejected) {
      throw badRequest("Request is not pending or cannot be rejected");
    }

    logger.info("audit.seat_request.rejected", {
      seatRequestId: requestId,
      rejectedBy: user.id,
    });
  });
}

export async function cancelSeatRequestService(user: AuthUser, requestId: string) {
  const row = await getSeatRequestByIdRepo(requestId);
  if (!row) throw notFound("Seat request not found");

  const adminCancel = user.role === "admin" || user.role === "manager";
  const ownCancel = row.requester_user_id === user.id;
  if (!adminCancel && !ownCancel) {
    throw forbidden("Cannot cancel this request");
  }

  await withTransaction(async (client) => {
    const action = adminCancel ? "cancel_by_admin" : "cancel_by_requester";
    if (!canTransitionSeatRequest(row.status, action)) {
      throw badRequest("Invalid status transition for cancellation");
    }

    const cancelled = await cancelSeatRequestRepo(client, {
      requestId,
      cancelledStatus: adminCancel ? "cancelled_by_admin" : "cancelled_by_requester",
    });
    if (!cancelled) {
      throw badRequest("Request cannot be cancelled in current state");
    }

    await client.query(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      values (
        'seat_request',
        $1,
        'seat_request.cancelled',
        jsonb_build_object('seatRequestId', $1, 'cancelledBy', $2, 'status', $3)
      )
      `,
      [requestId, user.id, adminCancel ? "cancelled_by_admin" : "cancelled_by_requester"],
    );

    logger.info("audit.seat_request.cancelled", {
      seatRequestId: requestId,
      cancelledBy: user.id,
      cancelledStatus: adminCancel ? "cancelled_by_admin" : "cancelled_by_requester",
    });
  });
}

export async function canConvertToBooking(requestId: string): Promise<boolean> {
  const { rows } = await q<{ can_book: boolean }>(
    `select public.fn_can_convert_to_booking($1::uuid) as can_book`,
    [requestId],
  );
  return Boolean(rows[0]?.can_book);
}

export async function assertSeatRequestCanConvertToBooking(requestId: string) {
  const eligible = await canConvertToBooking(requestId);
  if (!eligible) {
    throw badRequest("Seat request is blocked by unpaid or overdue payment milestones");
  }
}
