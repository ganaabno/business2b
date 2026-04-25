import { withTransaction } from "../../db/transaction.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { logger } from "../../shared/logger.js";
import type { PoolClient } from "pg";
import { getSeatRequestByIdRepo } from "../seatRequests/seatRequests.repo.js";
import {
  createSeatRequestPaymentIntentRepo,
  findSeatRequestIdByPaymentIntentRepo,
  getLatestSeatRequestPaymentIntentRepo,
  getPaymentHistoryRepo,
  getPaymentMilestonesRepo,
  markSeatRequestPaymentIntentPaidRepo,
  upsertPaymentRepo,
} from "./payments.repo.js";
import {
  checkQPayInvoicePayment,
  createQPayInvoice,
} from "./providers/qpay.client.js";
import {
  computeMilestoneAmountToPay,
  isMilestoneDeadlineExpired,
  isPaidStatus,
  selectDefaultPayableMilestone,
} from "./payments.logic.js";

const PAYMENT_DEADLINE_EXPIRED_MESSAGE =
  "Payment deadline has expired. Please contact admin or manager.";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function tryExtractSeatRequestId(senderInvoiceNo: string | undefined) {
  const text = String(senderInvoiceNo || "").trim();
  if (!text) return "";
  const matched = text.match(UUID_RE);
  return matched ? matched[0] : "";
}

function normalizeJsonObject(value: unknown) {
  if (!value) return {} as Record<string, unknown>;

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {} as Record<string, unknown>;
    }
  }

  return {} as Record<string, unknown>;
}

function normalizeText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function resolveDeepLink(payload: Record<string, unknown>) {
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter((row) => row && typeof row === "object")
    : [];

  const fromUrls = normalizeText((urls[0] as { link?: unknown } | undefined)?.link);
  if (fromUrls) return fromUrls;

  return normalizeText(payload.invoice_url);
}

function resolveInvoiceId(payload: Record<string, unknown>) {
  return normalizeText(payload.invoice_id) || normalizeText(payload.invoice_no);
}

function pickPositiveAmount(...values: Array<unknown>) {
  for (const value of values) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) {
      return Math.round(amount);
    }
  }
  return 0;
}

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

export type QPayInvoiceIntentResult = {
  seatRequestId: string;
  requestNo: string;
  milestoneCode: string;
  amountMnt: number;
  currency: "MNT";
  dueAt: string | null;
  invoiceId: string | null;
  senderInvoiceNo: string;
  qrText: string | null;
  qrImage: string | null;
  invoiceUrl: string | null;
  deepLink: string | null;
  raw: Record<string, unknown>;
  reusedIntent?: boolean;
};

export type QPayInvoiceStatusResult = {
  seatRequestId: string;
  milestoneCode: string;
  amountMnt: number;
  currency: "MNT";
  invoiceId: string | null;
  senderInvoiceNo: string;
  provider: "qpay";
  status: "pending" | "paid";
  externalTxnId: string | null;
  checkedAt: string;
  raw: Record<string, unknown>;
};

export async function createQPayInvoiceIntentService(
  user: AuthUser,
  seatRequestId: string,
  input?: {
    milestoneCode?: string;
  },
): Promise<QPayInvoiceIntentResult> {
  const seatRequest = await getSeatRequestByIdRepo(seatRequestId);
  if (!seatRequest) {
    throw notFound("Seat request not found");
  }

  if (
    !(
      user.role === "admin" ||
      user.role === "manager" ||
      seatRequest.requester_user_id === user.id
    )
  ) {
    throw forbidden("Cannot create invoice for this seat request");
  }

  const requestStatus = String(seatRequest.status || "").toLowerCase();
  if (
    ["rejected", "cancelled_expired", "cancelled_by_admin", "cancelled_by_requester"].includes(
      requestStatus,
    )
  ) {
    throw badRequest("Cannot create payment invoice for cancelled/rejected request");
  }

  const [milestones, payments] = await Promise.all([
    getPaymentMilestonesRepo(seatRequestId),
    getPaymentHistoryRepo(seatRequestId),
  ]);

  const unpaidMilestones = milestones.filter(
    (row) => String(row.status || "").toLowerCase() !== "paid",
  );

  if (unpaidMilestones.length === 0) {
    throw badRequest("All payment milestones are already satisfied");
  }

  const payableMilestones = unpaidMilestones.filter(
    (milestone) => !isMilestoneDeadlineExpired(milestone),
  );

  if (payableMilestones.length === 0) {
    throw badRequest(PAYMENT_DEADLINE_EXPIRED_MESSAGE);
  }

  const requestedCode = String(input?.milestoneCode || "").trim().toLowerCase();
  const targetMilestone = requestedCode
    ? payableMilestones.find(
        (milestone) =>
          String(milestone.code || "").toLowerCase() === requestedCode,
      )
    : selectDefaultPayableMilestone(payableMilestones);

  const requestedOverdueMilestone = requestedCode
    ? unpaidMilestones.find(
        (milestone) =>
          String(milestone.code || "").toLowerCase() === requestedCode &&
          isMilestoneDeadlineExpired(milestone),
      )
    : null;

  if (requestedOverdueMilestone) {
    throw badRequest(PAYMENT_DEADLINE_EXPIRED_MESSAGE);
  }

  if (!targetMilestone) {
    throw badRequest("Requested milestone is not payable");
  }

  if (isMilestoneDeadlineExpired(targetMilestone)) {
    throw badRequest(PAYMENT_DEADLINE_EXPIRED_MESSAGE);
  }

  const amountToPay = computeMilestoneAmountToPay(targetMilestone, payments);

  if (!(Number.isFinite(amountToPay) && amountToPay > 0)) {
    throw badRequest("Selected milestone is already covered by previous payments");
  }

  const milestoneCode = String(targetMilestone.code || "unknown");
  const existingIntent = await getLatestSeatRequestPaymentIntentRepo(seatRequestId, {
    provider: "qpay",
    milestoneCode,
    statusNot: "paid",
  });

  if (existingIntent) {
    const existingAmount = Number(existingIntent.amount_mnt || 0);
    if (Number.isFinite(existingAmount) && Math.round(existingAmount) === amountToPay) {
      const payload = normalizeJsonObject(existingIntent.payload);
      const invoiceId =
        normalizeText(existingIntent.external_invoice_id) || resolveInvoiceId(payload);

      return {
        seatRequestId,
        requestNo: String(seatRequest.request_no || seatRequestId),
        milestoneCode,
        amountMnt: amountToPay,
        currency: "MNT",
        dueAt: targetMilestone.due_at,
        invoiceId,
        senderInvoiceNo: existingIntent.sender_invoice_no,
        qrText: normalizeText(payload.qr_text),
        qrImage: normalizeText(payload.qr_image),
        invoiceUrl: normalizeText(payload.invoice_url),
        deepLink: resolveDeepLink(payload),
        raw: payload,
        reusedIntent: true,
      };
    }
  }

  const senderSuffix = Date.now().toString(36).slice(-5);
  const senderInvoiceNo = `sr-${seatRequestId}-${senderSuffix}`;
  const requestNo = String(seatRequest.request_no || seatRequestId);
  const qpayInvoice = await createQPayInvoice({
    senderInvoiceNo,
    amountMnt: amountToPay,
    description: `Seat request ${requestNo} - ${milestoneCode}`,
  });

  const qpayPayload = (qpayInvoice as Record<string, unknown>) || {};
  const invoiceId = resolveInvoiceId(qpayPayload);
  const deepLink = resolveDeepLink(qpayPayload);

  await withTransaction(async (client) => {
    await createSeatRequestPaymentIntentRepo(client, {
      seatRequestId,
      milestoneCode,
      provider: "qpay",
      senderInvoiceNo,
      externalInvoiceId: invoiceId,
      amountMnt: amountToPay,
      currency: "MNT",
      createdBy: user.id,
      rawPayload: qpayPayload,
    });
  });

  return {
    seatRequestId,
    requestNo,
    milestoneCode,
    amountMnt: amountToPay,
    currency: "MNT",
    dueAt: targetMilestone.due_at,
    invoiceId,
    senderInvoiceNo,
    qrText: normalizeText(qpayPayload.qr_text),
    qrImage: normalizeText(qpayPayload.qr_image),
    invoiceUrl: normalizeText(qpayPayload.invoice_url),
    deepLink,
    raw: qpayPayload,
    reusedIntent: false,
  };
}

export async function checkQPayInvoiceStatusService(
  user: AuthUser,
  seatRequestId: string,
  input?: {
    invoiceId?: string;
    senderInvoiceNo?: string;
  },
): Promise<QPayInvoiceStatusResult> {
  const seatRequest = await getSeatRequestByIdRepo(seatRequestId);
  if (!seatRequest) {
    throw notFound("Seat request not found");
  }

  if (
    !(
      user.role === "admin" ||
      user.role === "manager" ||
      seatRequest.requester_user_id === user.id
    )
  ) {
    throw forbidden("Cannot check payment status for this seat request");
  }

  const normalizedInvoiceId = normalizeText(input?.invoiceId);
  const normalizedSenderInvoiceNo = normalizeText(input?.senderInvoiceNo);

  let paymentIntent = null;
  if (normalizedInvoiceId || normalizedSenderInvoiceNo) {
    paymentIntent = await getLatestSeatRequestPaymentIntentRepo(seatRequestId, {
      provider: "qpay",
      externalInvoiceId: normalizedInvoiceId || undefined,
      senderInvoiceNo: normalizedSenderInvoiceNo || undefined,
    });

    if (!paymentIntent && normalizedInvoiceId && normalizedSenderInvoiceNo) {
      paymentIntent = await getLatestSeatRequestPaymentIntentRepo(seatRequestId, {
        provider: "qpay",
        externalInvoiceId: normalizedInvoiceId,
      });

      if (!paymentIntent) {
        paymentIntent = await getLatestSeatRequestPaymentIntentRepo(seatRequestId, {
          provider: "qpay",
          senderInvoiceNo: normalizedSenderInvoiceNo,
        });
      }
    }

    if (!paymentIntent) {
      throw badRequest("QPay invoice intent not found for this seat request");
    }
  } else {
    paymentIntent = await getLatestSeatRequestPaymentIntentRepo(seatRequestId, {
      provider: "qpay",
      statusNot: "paid",
    });

    if (!paymentIntent) {
      paymentIntent = await getLatestSeatRequestPaymentIntentRepo(seatRequestId, {
        provider: "qpay",
      });
    }
  }

  if (!paymentIntent) {
    throw badRequest("No QPay invoice found for this seat request");
  }

  const milestones = await getPaymentMilestonesRepo(seatRequestId);
  const activeMilestones = milestones.filter(
    (row) => String(row.status || "").toLowerCase() !== "paid",
  );
  const blockingMilestone = selectDefaultPayableMilestone(activeMilestones);
  if (blockingMilestone && isMilestoneDeadlineExpired(blockingMilestone)) {
    throw badRequest(PAYMENT_DEADLINE_EXPIRED_MESSAGE);
  }

  const intentPayload = normalizeJsonObject(paymentIntent.payload);
  const invoiceId =
    normalizedInvoiceId ||
    normalizeText(paymentIntent.external_invoice_id) ||
    resolveInvoiceId(intentPayload);

  if (!invoiceId) {
    throw badRequest("QPay invoice id is missing for status check");
  }

  const senderInvoiceNo =
    normalizedSenderInvoiceNo || paymentIntent.sender_invoice_no;
  const statusPayload = await checkQPayInvoicePayment(invoiceId);
  const rows = Array.isArray(statusPayload.rows)
    ? statusPayload.rows.filter((row) => row && typeof row === "object")
    : [];
  const paidRow = rows.find((row) => isPaidStatus((row as Record<string, unknown>).payment_status));

  if (!paidRow) {
    return {
      seatRequestId,
      milestoneCode: String(paymentIntent.milestone_code || "unknown"),
      amountMnt: Math.max(0, Math.round(Number(paymentIntent.amount_mnt || 0))),
      currency: "MNT",
      invoiceId,
      senderInvoiceNo,
      provider: "qpay",
      status: "pending",
      externalTxnId: null,
      checkedAt: new Date().toISOString(),
      raw: (statusPayload as Record<string, unknown>) || {},
    };
  }

  const paidRowRecord = paidRow as Record<string, unknown>;
  const externalTxnId =
    normalizeText(paidRowRecord.payment_id) ||
    normalizeText(paidRowRecord.txn_id) ||
    normalizeText(paidRowRecord.transaction_id) ||
    invoiceId;

  const amountMnt = pickPositiveAmount(
    paidRowRecord.paid_amount,
    paidRowRecord.amount,
    statusPayload.paid_amount,
    paymentIntent.amount_mnt,
  );

  if (!(amountMnt > 0)) {
    throw badRequest("Paid amount is missing in QPay status response");
  }

  await processPaymentWebhookService({
    provider: "qpay",
    seatRequestId,
    amountMnt,
    paymentMethod: "qpay",
    externalTxnId,
    idempotencyKey: `qpay:${externalTxnId}`,
    senderInvoiceNo,
    invoiceId,
    payload: {
      ...(statusPayload as Record<string, unknown>),
      invoice_id: invoiceId,
      sender_invoice_no: senderInvoiceNo,
      payment_id: externalTxnId,
      payment_status: paidRowRecord.payment_status || "PAID",
      amount: amountMnt,
    },
  });

  return {
    seatRequestId,
    milestoneCode: String(paymentIntent.milestone_code || "unknown"),
    amountMnt,
    currency: "MNT",
    invoiceId,
    senderInvoiceNo,
    provider: "qpay",
    status: "paid",
    externalTxnId,
    checkedAt: new Date().toISOString(),
    raw: (statusPayload as Record<string, unknown>) || {},
  };
}

export async function processPaymentWebhookService(params: {
  provider: string;
  seatRequestId?: string;
  amountMnt: number;
  paymentMethod: string;
  externalTxnId: string;
  idempotencyKey: string;
  senderInvoiceNo?: string;
  invoiceId?: string;
  payload: unknown;
}) {
  await withTransaction(async (client) => {
    let resolvedSeatRequestId = String(params.seatRequestId || "").trim();

    if (!resolvedSeatRequestId) {
      resolvedSeatRequestId = tryExtractSeatRequestId(params.senderInvoiceNo);
    }

    if (!resolvedSeatRequestId) {
      resolvedSeatRequestId =
        (await findSeatRequestIdByPaymentIntentRepo(client, {
          provider: params.provider,
          externalInvoiceId: params.invoiceId || params.externalTxnId,
          senderInvoiceNo: params.senderInvoiceNo,
        })) || "";
    }

    if (!resolvedSeatRequestId) {
      throw badRequest("Unable to resolve seat request for payment webhook");
    }

    const { rows: requestRows } = await client.query<{ status: string }>(
      `
      select status::text
      from public.seat_requests
      where id = $1::uuid
      for update
      `,
      [resolvedSeatRequestId],
    );

    if (requestRows.length === 0) {
      throw notFound("Seat request not found");
    }

    const currentStatus = requestRows[0].status;
    if (
      !["approved_waiting_deposit", "confirmed_deposit_paid", "completed"].includes(
        currentStatus,
      )
    ) {
      throw badRequest(
        `Payment cannot be accepted for seat request in status: ${currentStatus}`,
      );
    }

    const { rows: milestones } = await client.query<{
      id: string;
      code: string;
      due_at: string | null;
      required_cumulative_mnt: number | string;
      status: string;
      satisfied_at: string | null;
    }>(
      `
      select
        id::text,
        code::text,
        due_at,
        required_cumulative_mnt,
        status::text,
        satisfied_at
      from public.seat_request_payment_milestones
      where seat_request_id = $1::uuid
      order by due_at asc
      `,
      [resolvedSeatRequestId],
    );

    const activeMilestones = milestones.filter(
      (row) => String(row.status || "").toLowerCase() !== "paid",
    );
    const blockingMilestone = selectDefaultPayableMilestone(activeMilestones);
    if (blockingMilestone && isMilestoneDeadlineExpired(blockingMilestone)) {
      throw badRequest(PAYMENT_DEADLINE_EXPIRED_MESSAGE);
    }

    const inserted = await upsertPaymentRepo(client, {
      seatRequestId: resolvedSeatRequestId,
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
        seatRequestId: resolvedSeatRequestId,
        externalTxnId: params.externalTxnId,
      });
      return;
    }

    await markSeatRequestPaymentIntentPaidRepo(client, {
      provider: params.provider,
      externalInvoiceId: params.invoiceId || params.externalTxnId,
      senderInvoiceNo: params.senderInvoiceNo,
      externalTxnId: params.externalTxnId,
      rawPayload: params.payload,
    });

    await client.query(`select public.fn_sync_milestone_statuses($1::uuid)`, [
      resolvedSeatRequestId,
    ]);

    await awardAgentPointsIfEligible(client, resolvedSeatRequestId);

    await client.query(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      values (
        'seat_request',
        $1::text,
        'seat_request.payment_received',
        jsonb_build_object('seatRequestId', $1::text, 'provider', $2::text, 'idempotencyKey', $3::text)
      )
      `,
      [resolvedSeatRequestId, params.provider, params.idempotencyKey],
    );

    logger.info("slo.payment_webhook.success", {
      provider: params.provider,
      seatRequestId: resolvedSeatRequestId,
      externalTxnId: params.externalTxnId,
      amountMnt: params.amountMnt,
    });
  });
}
