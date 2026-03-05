import { badRequest } from "../../../shared/http/errors.js";
import { verifyHmacSha256Signature } from "./signature.js";
import type { PaymentProviderAdapter } from "./types.js";

export const qpayAdapter: PaymentProviderAdapter = {
  provider: "qpay",
  verifySignature(headers, body, rawBody) {
    const secret = process.env.QPAY_WEBHOOK_SECRET || "";
    if (!secret) {
      throw badRequest("QPay webhook secret is not configured");
    }
    verifyHmacSha256Signature({
      headers,
      body,
      rawBody,
      secret,
      signatureHeaderName: "x-qpay-signature",
    });
  },
  normalizePayload(body) {
    const seatRequestId = String(body.seatRequestId || body.seat_request_id || "");
    const amountMnt = Number(body.amountMnt || body.amount || 0);
    const externalTxnId = String(body.externalTxnId || body.txn_id || body.invoice_id || "");
    const paymentMethod = String(body.paymentMethod || body.payment_method || "qpay");

    if (!seatRequestId || !externalTxnId || !Number.isFinite(amountMnt) || amountMnt <= 0) {
      throw badRequest("Invalid QPay webhook payload");
    }

    return {
      provider: "qpay",
      seatRequestId,
      amountMnt,
      paymentMethod,
      externalTxnId,
      idempotencyKey: `qpay:${externalTxnId}`,
      payload: body,
    };
  },
};
