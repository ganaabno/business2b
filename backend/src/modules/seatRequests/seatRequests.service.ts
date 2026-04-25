import { withTransaction, q } from "../../db/transaction.js";
import { env } from "../../config/env.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { logger } from "../../shared/logger.js";
import {
  ensureFallbackOrganizationRepo,
  FALLBACK_ORGANIZATION_ID,
  getOrganizationByIdRepo,
  getPrimaryOrganizationForUserRepo,
} from "../organizations/organizations.repo.js";
import {
  approveSeatRequestRepo,
  cancelSeatRequestRepo,
  createSeatRequestRepo,
  getOrganizationGroupPolicyRepo,
  getSeatRequestByIdRepo,
  listSeatRequestBundleMembersRepo,
  listSeatRequestBundleUnpaidMilestonesRepo,
  listSeatRequestsRepo,
  rejectSeatRequestRepo,
  type GroupPolicyMode,
  type SeatRequestBundleMemberRow,
  type SeatRequestBundleMilestoneRow,
} from "./seatRequests.repo.js";
import {
  enqueueSeatRequestStatusEmail,
  getUserEmailForNotification,
} from "../notifications/notifications.service.js";
import { canTransitionSeatRequest } from "./seatRequests.state-machine.js";

export type SeatRequestBundleHealth = "healthy" | "payment_due" | "blocked";

export type SeatRequestBlockReasonCode =
  | "member_rejected"
  | "member_cancelled"
  | "deposit_timeout"
  | "overdue_milestone"
  | "payment_pending"
  | "booking_not_ready";

type EvaluatedSeatRequestBundleHealth = {
  bundleHealth: SeatRequestBundleHealth;
  blockReasonCode: SeatRequestBlockReasonCode | null;
  blockingSeatRequestId: string | null;
  nextDeadlineAt: string | null;
};

function assertRequesterRole(role: AuthUser["role"]): role is "subcontractor" | "agent" {
  return role === "subcontractor" || role === "agent";
}

function isAdminRole(role: AuthUser["role"]) {
  return role === "admin" || role === "manager";
}

async function resolveOrganizationIdForSeatRequest(user: AuthUser) {
  if (user.organizationId) {
    return user.organizationId;
  }

  const primaryOrgId = await getPrimaryOrganizationForUserRepo(user.id);
  if (primaryOrgId) {
    return primaryOrgId;
  }

  if (!assertRequesterRole(user.role) && !isAdminRole(user.role)) {
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
    context: "seat_request",
  });

  return fallbackOrg.id;
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

const REJECTED_STATUSES = new Set(["rejected"]);
const CANCELLED_STATUSES = new Set([
  "cancelled_by_admin",
  "cancelled_by_requester",
]);
const EXPIRED_STATUSES = new Set(["cancelled_expired"]);

function toTimestampMs(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function pickEarliestDeadline(
  members: SeatRequestBundleMemberRow[],
  milestones: SeatRequestBundleMilestoneRow[],
) {
  let earliestMs = Number.POSITIVE_INFINITY;
  let earliestValue: string | null = null;

  for (const member of members) {
    const ms = toTimestampMs(member.next_deadline_at);
    if (Number.isFinite(ms) && ms < earliestMs) {
      earliestMs = ms;
      earliestValue = member.next_deadline_at;
    }
  }

  for (const milestone of milestones) {
    const ms = toTimestampMs(milestone.due_at);
    if (Number.isFinite(ms) && ms < earliestMs) {
      earliestMs = ms;
      earliestValue = milestone.due_at;
    }
  }

  return earliestValue;
}

export function evaluateSeatRequestBundleHealth(params: {
  members: SeatRequestBundleMemberRow[];
  unpaidMilestones: SeatRequestBundleMilestoneRow[];
  nowMs?: number;
}): EvaluatedSeatRequestBundleHealth {
  const members = params.members || [];
  const unpaidMilestones = params.unpaidMilestones || [];
  const nowMs = Number.isFinite(params.nowMs) ? Number(params.nowMs) : Date.now();

  const nextDeadlineAt = pickEarliestDeadline(members, unpaidMilestones);

  const rejectedMember = members.find((member) =>
    REJECTED_STATUSES.has(String(member.status || "").toLowerCase()),
  );
  if (rejectedMember) {
    return {
      bundleHealth: "blocked",
      blockReasonCode: "member_rejected",
      blockingSeatRequestId: rejectedMember.id,
      nextDeadlineAt,
    };
  }

  const cancelledMember = members.find((member) =>
    CANCELLED_STATUSES.has(String(member.status || "").toLowerCase()),
  );
  if (cancelledMember) {
    return {
      bundleHealth: "blocked",
      blockReasonCode: "member_cancelled",
      blockingSeatRequestId: cancelledMember.id,
      nextDeadlineAt,
    };
  }

  const expiredMember = members.find((member) =>
    EXPIRED_STATUSES.has(String(member.status || "").toLowerCase()),
  );
  if (expiredMember) {
    return {
      bundleHealth: "blocked",
      blockReasonCode: "deposit_timeout",
      blockingSeatRequestId: expiredMember.id,
      nextDeadlineAt,
    };
  }

  const overdueMilestone = unpaidMilestones.find((milestone) => {
    const dueMs = toTimestampMs(milestone.due_at);
    return Number.isFinite(dueMs) && dueMs <= nowMs;
  });
  if (overdueMilestone) {
    const milestoneCode = String(overdueMilestone.code || "").toLowerCase();
    return {
      bundleHealth: "blocked",
      blockReasonCode:
        milestoneCode === "deposit_6h" ? "deposit_timeout" : "overdue_milestone",
      blockingSeatRequestId: overdueMilestone.seat_request_id,
      nextDeadlineAt,
    };
  }

  if (unpaidMilestones.length > 0) {
    const pendingSeatRequestId = unpaidMilestones[0]?.seat_request_id || null;
    return {
      bundleHealth: "payment_due",
      blockReasonCode: "payment_pending",
      blockingSeatRequestId: pendingSeatRequestId,
      nextDeadlineAt,
    };
  }

  return {
    bundleHealth: "healthy",
    blockReasonCode: null,
    blockingSeatRequestId: null,
    nextDeadlineAt,
  };
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
    requestedRole?: "subcontractor" | "agent";
  },
) {
  if (!assertRequesterRole(user.role) && !isAdminRole(user.role)) {
    throw forbidden("Only subcontractor, agent, admin, or manager can create seat requests");
  }
  const requesterRoleFromInput = input.requestedRole;
  const requesterRole: "subcontractor" | "agent" = assertRequesterRole(user.role)
    ? user.role
    : requesterRoleFromInput || "subcontractor";

  if (assertRequesterRole(user.role) && requesterRoleFromInput && requesterRoleFromInput !== user.role) {
    throw forbidden("requestedRole must match your account role");
  }

  const organizationId = await resolveOrganizationIdForSeatRequest(user);
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
  if (isAdminRole(user.role)) {
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
  if (isAdminRole(user.role)) return row;
  if (row.requester_user_id !== user.id) {
    throw forbidden("Cannot access this seat request");
  }
  return row;
}

function defaultBlockMessageForCode(code: SeatRequestBlockReasonCode | null) {
  switch (code) {
    case "member_rejected":
      return "A serial member is rejected. Registration is blocked for this bundle.";
    case "member_cancelled":
      return "A serial member is cancelled. Registration is blocked for this bundle.";
    case "deposit_timeout":
      return "Deposit window expired for one serial member. Registration is blocked.";
    case "overdue_milestone":
      return "A payment milestone is overdue in this serial bundle.";
    case "payment_pending":
      return "Payment is pending for this serial bundle.";
    case "booking_not_ready":
      return "Booking is not ready for this serial bundle yet.";
    default:
      return null;
  }
}

export async function getSeatRequestBookingEligibilityService(
  user: AuthUser,
  requestId: string,
) {
  const request = await getSeatRequestService(user, requestId);
  const canBook = await canConvertToBooking(requestId);

  const [bundleMembers, unpaidMilestones] = await Promise.all([
    listSeatRequestBundleMembersRepo(requestId),
    listSeatRequestBundleUnpaidMilestonesRepo(requestId),
  ]);

  const evaluated = evaluateSeatRequestBundleHealth({
    members: bundleMembers,
    unpaidMilestones,
  });

  const normalizedStatus = String(request.status || "").toLowerCase();
  const bookingReadyStatuses = new Set(["confirmed_deposit_paid", "completed"]);

  let blockReasonCode = evaluated.blockReasonCode;
  let bundleHealth = evaluated.bundleHealth;
  let blockingSeatRequestId = evaluated.blockingSeatRequestId;

  if (bundleHealth === "healthy" && !bookingReadyStatuses.has(normalizedStatus)) {
    bundleHealth = "payment_due";
    blockReasonCode = "booking_not_ready";
    blockingSeatRequestId = requestId;
  }

  if (!canBook && bundleHealth === "healthy") {
    bundleHealth = "blocked";
    blockReasonCode = blockReasonCode || "booking_not_ready";
    blockingSeatRequestId = blockingSeatRequestId || requestId;
  }

  return {
    seatRequestId: requestId,
    status: request.status,
    canBook,
    blocked: !canBook,
    serialGroupId: String(request.serial_group_id || request.id || requestId),
    bundleHealth,
    blockReasonCode,
    blockMessage: defaultBlockMessageForCode(blockReasonCode),
    blockingSeatRequestId,
    nextDeadlineAt: evaluated.nextDeadlineAt,
  };
}

export async function approveSeatRequestService(user: AuthUser, requestId: string, note: string | null) {
  if (!isAdminRole(user.role)) {
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

    try {
      const recipientEmail = await getUserEmailForNotification(
        String(current.requester_user_id || ""),
        client,
      );
      await enqueueSeatRequestStatusEmail({
        seatRequestId: requestId,
        requestNo: String(current.request_no || requestId),
        recipientEmail,
        status: "approved",
        reason: null,
        destination: String(current.destination || ""),
        travelDate: String(current.travel_date || ""),
        client,
      });
    } catch (error) {
      logger.warn("notification.seat_request.approved.enqueue_failed", {
        seatRequestId: requestId,
        error,
      });
    }
  });
}

export async function rejectSeatRequestService(user: AuthUser, requestId: string, reason: string | null) {
  if (!isAdminRole(user.role)) {
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

    try {
      const recipientEmail = await getUserEmailForNotification(
        String(current.requester_user_id || ""),
        client,
      );
      await enqueueSeatRequestStatusEmail({
        seatRequestId: requestId,
        requestNo: String(current.request_no || requestId),
        recipientEmail,
        status: "rejected",
        reason: reason || null,
        destination: String(current.destination || ""),
        travelDate: String(current.travel_date || ""),
        client,
      });
    } catch (error) {
      logger.warn("notification.seat_request.rejected.enqueue_failed", {
        seatRequestId: requestId,
        error,
      });
    }
  });
}

export async function cancelSeatRequestService(user: AuthUser, requestId: string) {
  const row = await getSeatRequestByIdRepo(requestId);
  if (!row) throw notFound("Seat request not found");

  const adminCancel = isAdminRole(user.role);
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

    try {
      const recipientEmail = await getUserEmailForNotification(
        String(row.requester_user_id || ""),
        client,
      );
      await enqueueSeatRequestStatusEmail({
        seatRequestId: requestId,
        requestNo: String(row.request_no || requestId),
        recipientEmail,
        status: adminCancel ? "cancelled_by_admin" : "cancelled_by_requester",
        reason: adminCancel ? "Cancelled by admin" : "Cancelled by requester",
        destination: String(row.destination || ""),
        travelDate: String(row.travel_date || ""),
        client,
      });
    } catch (error) {
      logger.warn("notification.seat_request.cancelled.enqueue_failed", {
        seatRequestId: requestId,
        error,
      });
    }
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
