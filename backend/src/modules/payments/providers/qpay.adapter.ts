import { badRequest } from "../../../shared/http/errors.js";
import { verifyHmacSha256Signature } from "./signature.js";
import type { PaymentProviderAdapter } from "./types.js";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function extractSeatRequestId(senderInvoiceNo: string) {
  const trimmed = senderInvoiceNo.trim();
  if (!trimmed) return "";
  const uuidMatch = trimmed.match(UUID_RE);
  return uuidMatch ? uuidMatch[0] : "";
}

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
    const senderInvoiceNo = String(
      body.sender_invoice_no || body.senderInvoiceNo || body.sender_invoice_id || "",
    );
    const seatRequestId = String(
      body.seatRequestId || body.seat_request_id || extractSeatRequestId(senderInvoiceNo),
    );
    const amountMnt = Number(body.amountMnt || body.amount || 0);
    const invoiceId = String(body.invoice_id || body.invoiceId || "");
    const externalTxnId = String(
      body.externalTxnId ||
        body.txn_id ||
        body.payment_id ||
        invoiceId ||
        body.payment_id_reference ||
        "",
    );
    const paymentMethod = String(body.paymentMethod || body.payment_method || "qpay");

    if (!externalTxnId || !Number.isFinite(amountMnt) || amountMnt <= 0) {
      throw badRequest("Invalid QPay webhook payload");
    }

    return {
      provider: "qpay",
      seatRequestId,
      amountMnt,
      paymentMethod,
      externalTxnId,
      idempotencyKey: `qpay:${externalTxnId}`,
      senderInvoiceNo: senderInvoiceNo || undefined,
      invoiceId: invoiceId || undefined,
      payload: body,
    };
  },
};
