import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { badRequest } from "../../shared/http/errors.js";
import {
  checkQPayInvoiceStatusService,
  createQPayInvoiceIntentService,
  getSeatRequestPaymentsService,
  processPaymentWebhookService,
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
  if (!deposit) {
    res.json({ data: null });
    return;
  }

  res.json({
    data: {
      seatRequestId: id,
      requiredAmountMnt: Number(deposit.required_cumulative_mnt),
      dueAt: deposit.due_at,
      currency: "MNT",
    },
  });
});

export const createQPayInvoiceIntentController = asyncHandler(async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const body = (req.body || {}) as Record<string, unknown>;
  const milestoneCode =
    typeof body.milestoneCode === "string" && body.milestoneCode.trim().length > 0
      ? body.milestoneCode.trim()
      : undefined;

  const data = await createQPayInvoiceIntentService(req.user!, id, {
    milestoneCode,
  });

  res.json({ data });
});

export const checkQPayInvoiceStatusController = asyncHandler(async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const body = (req.body || {}) as Record<string, unknown>;

  const invoiceId =
    typeof body.invoiceId === "string" && body.invoiceId.trim().length > 0
      ? body.invoiceId.trim()
      : undefined;

  const senderInvoiceNo =
    typeof body.senderInvoiceNo === "string" && body.senderInvoiceNo.trim().length > 0
      ? body.senderInvoiceNo.trim()
      : undefined;

  const data = await checkQPayInvoiceStatusService(req.user!, id, {
    invoiceId,
    senderInvoiceNo,
  });

  res.json({ data });
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
    senderInvoiceNo: normalized.senderInvoiceNo,
    invoiceId: normalized.invoiceId,
    payload: normalized.payload,
  });

  res.status(202).json({ ok: true });
});
