import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { badRequest } from "../../shared/http/errors.js";
import {
  getSeatRequestPaymentsService,
  processPaymentWebhookService,
  simulateSeatRequestPaymentService,
} from "./payments.service.js";
import type { PaymentMilestoneRow } from "./payments.repo.js";
import { getPaymentProviderAdapter } from "./providers/index.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

export const getSeatRequestPaymentsController = asyncHandler(async (req: Request, res: Response) => {
  const data = await getSeatRequestPaymentsService(req.user!, getParam(req.params.id));
  res.json({ data });
});

export const createDepositIntentController = asyncHandler(async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const data = await getSeatRequestPaymentsService(req.user!, id);
  const deposit = data.milestones.find((m: PaymentMilestoneRow) => m.code === "deposit_6h");
  if (!deposit) throw badRequest("Deposit milestone not found");

  res.json({
    data: {
      seatRequestId: id,
      requiredAmountMnt: Number(deposit.required_cumulative_mnt),
      dueAt: deposit.due_at,
      currency: "MNT",
    },
  });
});

export const paymentWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const provider = getParam(req.params.provider).toLowerCase();
  const body = (req.body || {}) as Record<string, unknown>;
  const adapter = getPaymentProviderAdapter(provider);

  adapter.verifySignature(req.headers, body, req.rawBody);
  const normalized = adapter.normalizePayload(body, req.headers);
  if (!normalized.idempotencyKey) throw badRequest("Missing idempotency key");

  await processPaymentWebhookService({
    provider: normalized.provider,
    seatRequestId: normalized.seatRequestId,
    amountMnt: normalized.amountMnt,
    paymentMethod: normalized.paymentMethod,
    externalTxnId: normalized.externalTxnId,
    idempotencyKey: normalized.idempotencyKey,
    payload: normalized.payload,
  });

  res.status(202).json({ ok: true });
});

export const simulateSeatRequestPaymentController = asyncHandler(async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const body = (req.body || {}) as Record<string, unknown>;

  const amountRaw = body.amountMnt;
  const amountMnt =
    typeof amountRaw === "number" && Number.isFinite(amountRaw)
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number(amountRaw)
        : undefined;

  const paymentMethod =
    typeof body.paymentMethod === "string" && body.paymentMethod.trim().length > 0
      ? body.paymentMethod.trim()
      : undefined;

  const data = await simulateSeatRequestPaymentService(req.user!, id, {
    amountMnt,
    paymentMethod,
  });

  res.status(202).json({ data });
});
