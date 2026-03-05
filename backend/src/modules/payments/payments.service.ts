import { withTransaction } from "../../db/transaction.js";
import { env } from "../../config/env.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { logger } from "../../shared/logger.js";
import type { PoolClient } from "pg";
import { getSeatRequestByIdRepo } from "../seatRequests/seatRequests.repo.js";
import {
  getPaymentHistoryRepo,
  getPaymentMilestonesRepo,
  upsertPaymentRepo,
} from "./payments.repo.js";

async function awardAgentPointsIfEligible(client: PoolClient, seatRequestId: string) {
  const { rows } = await client.query(
    `
    select
      sr.requester_user_id::text as requester_user_id,
      sr.requester_role::text as requester_role,
      sr.requested_seats,
      exists (
        select 1
        from public.seat_request_payment_milestones m
        where m.seat_request_id = sr.id
          and m.code = 'deposit_6h'
          and m.status = 'paid'
      ) as deposit_paid
    from public.seat_requests sr
    where sr.id = $1::uuid
    limit 1
    `,
    [seatRequestId],
  );

  const row = rows[0];
  if (!row) {
    return;
  }

  const requesterRole = String(row.requester_role || "");
  const requesterUserId = String(row.requester_user_id || "");
  const requestedSeats = Number(row.requested_seats || 0);
  const depositPaid = Boolean(row.deposit_paid);

  if (requesterRole !== "agent" || !requesterUserId || requestedSeats <= 0 || !depositPaid) {
    return;
  }

  const points = requestedSeats * 10_000;
  const reason = "deposit_confirmed";

  const inserted = await client.query(
    `
    insert into public.agent_point_ledger (user_id, seat_request_id, points, reason)
    values ($1::uuid, $2::uuid, $3, $4)
    on conflict (seat_request_id, reason)
    do nothing
    returning id::text
    `,
    [requesterUserId, seatRequestId, points, reason],
  );

  if ((inserted.rowCount || 0) === 0) {
    return;
  }

  await client.query(
    `
    update public.users
    set membership_points = coalesce(membership_points, 0) + $2
    where id = $1::uuid
    `,
    [requesterUserId, points],
  );

  logger.info("audit.agent_points.awarded", {
    seatRequestId,
    userId: requesterUserId,
    points,
  });
}

export async function getSeatRequestPaymentsService(
  user: AuthUser,
  seatRequestId: string,
) {
  const req = await getSeatRequestByIdRepo(seatRequestId);
  if (!req) {
    return { milestones: [], payments: [] };
  }

  if (
    !(
      user.role === "admin" ||
      user.role === "manager" ||
      req.requester_user_id === user.id
    )
  ) {
    throw forbidden("Cannot view this payment history");
  }

  const [milestones, payments] = await Promise.all([
    getPaymentMilestonesRepo(seatRequestId),
    getPaymentHistoryRepo(seatRequestId),
  ]);
  return { milestones, payments };
}

export async function processPaymentWebhookService(params: {
  provider: string;
  seatRequestId: string;
  amountMnt: number;
  paymentMethod: string;
  externalTxnId: string;
  idempotencyKey: string;
  payload: unknown;
}) {
  await withTransaction(async (client) => {
    const { rows: requestRows } = await client.query<{ status: string }>(
      `
      select status::text
      from public.seat_requests
      where id = $1::uuid
      for update
      `,
      [params.seatRequestId],
    );

    if (requestRows.length === 0) {
      throw notFound("Seat request not found");
    }

    const currentStatus = requestRows[0].status;
    if (!["approved_waiting_deposit", "confirmed_deposit_paid", "completed"].includes(currentStatus)) {
      throw badRequest(`Payment cannot be accepted for seat request in status: ${currentStatus}`);
    }

    const inserted = await upsertPaymentRepo(client, {
      seatRequestId: params.seatRequestId,
      amountMnt: params.amountMnt,
      paymentMethod: params.paymentMethod,
      provider: params.provider,
      externalTxnId: params.externalTxnId,
      status: "paid",
      rawPayload: params.payload,
    });

    if (!inserted) {
      logger.info("slo.payment_webhook.duplicate", {
        provider: params.provider,
        seatRequestId: params.seatRequestId,
        externalTxnId: params.externalTxnId,
      });
      return;
    }

    await client.query(`select public.fn_sync_milestone_statuses($1::uuid)`, [
      params.seatRequestId,
    ]);

    await awardAgentPointsIfEligible(client, params.seatRequestId);

    await client.query(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      values (
        'seat_request',
        $1,
        'seat_request.payment_received',
        jsonb_build_object('seatRequestId', $1, 'provider', $2, 'idempotencyKey', $3)
      )
      `,
      [params.seatRequestId, params.provider, params.idempotencyKey],
    );

    logger.info("slo.payment_webhook.success", {
      provider: params.provider,
      seatRequestId: params.seatRequestId,
      externalTxnId: params.externalTxnId,
      amountMnt: params.amountMnt,
    });
  });
}

export async function simulateSeatRequestPaymentService(
  user: AuthUser,
  seatRequestId: string,
  input: {
    amountMnt?: number;
    paymentMethod?: string;
  },
) {
  if (!env.b2bAdminTestModeEnabled || env.isProduction) {
    throw forbidden("Test payment endpoint is disabled");
  }

  const actorRole = user.actorRole || user.role;
  if (!(actorRole === "admin" || actorRole === "manager")) {
    throw forbidden("Only admin or manager can record test payments");
  }

  const seatRequest = await getSeatRequestByIdRepo(seatRequestId);
  if (!seatRequest) {
    throw notFound("Seat request not found");
  }

  const milestones = await getPaymentMilestonesRepo(seatRequestId);
  const depositMilestone = milestones.find((row) => row.code === "deposit_6h");
  if (!depositMilestone) {
    throw badRequest("Deposit milestone not found");
  }

  const requestedAmount = Number(input.amountMnt || 0);
  const depositAmount = Number(depositMilestone.required_cumulative_mnt || 0);
  const amountMnt = requestedAmount > 0 ? requestedAmount : depositAmount;
  if (!(Number.isFinite(amountMnt) && amountMnt > 0)) {
    throw badRequest("Payment amount must be a positive number");
  }

  const externalTxnId = `test-${seatRequestId}-${Date.now()}`;

  await processPaymentWebhookService({
    provider: "test_mode",
    seatRequestId,
    amountMnt,
    paymentMethod: input.paymentMethod || "AdminTestMode",
    externalTxnId,
    idempotencyKey: externalTxnId,
    payload: {
      source: "admin_test_mode",
      actorId: user.actorId || user.id,
      actorRole,
      effectiveRole: user.role,
    },
  });

  logger.warn("audit.payment.test_mode.simulated", {
    seatRequestId,
    amountMnt,
    actorId: user.actorId || user.id,
    actorRole,
    effectiveRole: user.role,
  });

  return {
    seatRequestId,
    amountMnt,
    externalTxnId,
  };
}
