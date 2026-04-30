export type NormalizedWebhookPayment = {
  provider: string;
  seatRequestId: string;
  amountMnt: number;
  paymentMethod: string;
  externalTxnId: string;
  idempotencyKey: string;
  senderInvoiceNo?: string;
  invoiceId?: string;
  payload: unknown;
};

export type PaymentProviderAdapter = {
  provider: string;
  verifySignature(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    rawBody?: Buffer,
  ): void;
  normalizePayload(
    body: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedWebhookPayment;
};