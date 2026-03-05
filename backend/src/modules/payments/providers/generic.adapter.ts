import { badRequest } from "../../../shared/http/errors.js";
import type { PaymentProviderAdapter } from "./types.js";

export function buildGenericAdapter(provider: string): PaymentProviderAdapter {
  return {
    provider,
    verifySignature() {
      return;
    },
    normalizePayload(body) {
      const seatRequestId = String(body.seatRequestId || body.seat_request_id || "");
      const amountMnt = Number(body.amountMnt || body.amount || 0);
      const externalTxnId = String(body.externalTxnId || body.txn_id || body.invoice_id || "");
      const paymentMethod = String(body.paymentMethod || body.payment_method || provider);

      if (!seatRequestId || !externalTxnId || !Number.isFinite(amountMnt) || amountMnt <= 0) {
        throw badRequest("Invalid webhook payload");
      }

      return {
        provider,
        seatRequestId,
        amountMnt,
        paymentMethod,
        externalTxnId,
        idempotencyKey: `${provider}:${externalTxnId}`,
        payload: body,
      };
    },
  };
}
