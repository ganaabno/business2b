import { env } from "../../../config/env.js";
import { badRequest } from "../../../shared/http/errors.js";

type QPayTokenResponse = {
  access_token?: string;
  token_type?: string;
};

type QPayUrlLink = {
  name?: string;
  description?: string;
  link?: string;
};

export type QPayInvoiceResponse = {
  invoice_id?: string;
  invoice_no?: string;
  qr_text?: string;
  qr_image?: string;
  invoice_url?: string;
  urls?: QPayUrlLink[];
  [key: string]: unknown;
};

export type QPayPaymentCheckRow = {
  payment_status?: string;
  payment_id?: string;
  txn_id?: string;
  transaction_id?: string;
  amount?: number | string;
  paid_amount?: number | string;
  [key: string]: unknown;
};

export type QPayPaymentCheckResponse = {
  count?: number;
  paid_amount?: number | string;
  rows?: QPayPaymentCheckRow[];
  [key: string]: unknown;
};

export type CreateQPayInvoiceInput = {
  senderInvoiceNo: string;
  amountMnt: number;
  description: string;
};

function requireQPayConfig() {
  if (!env.qpayBaseUrl || !env.qpayClientId || !env.qpayClientSecret || !env.qpayInvoiceCode) {
    throw badRequest("QPay configuration is incomplete");
  }
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function fetchQPayToken() {
  requireQPayConfig();
  const basic = Buffer.from(`${env.qpayClientId}:${env.qpayClientSecret}`).toString("base64");

  const response = await fetch(`${env.qpayBaseUrl}/auth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const payload = (await parseJsonSafe(response)) as QPayTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw badRequest("Failed to authenticate with QPay");
  }

  return payload.access_token;
}

export async function createQPayInvoice(input: CreateQPayInvoiceInput): Promise<QPayInvoiceResponse> {
  requireQPayConfig();

  if (!input.senderInvoiceNo.trim()) {
    throw badRequest("senderInvoiceNo is required");
  }

  if (!(Number.isFinite(input.amountMnt) && input.amountMnt > 0)) {
    throw badRequest("amountMnt must be a positive number");
  }

  const accessToken = await fetchQPayToken();

  const payload: Record<string, unknown> = {
    invoice_code: env.qpayInvoiceCode,
    sender_invoice_no: input.senderInvoiceNo,
    invoice_receiver_code: "terminal",
    invoice_description: input.description,
    amount: Math.round(input.amountMnt),
  };

  if (env.qpayCallbackUrl) {
    payload.callback_url = env.qpayCallbackUrl;
  }

  const response = await fetch(`${env.qpayBaseUrl}/invoice`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const invoice = (await parseJsonSafe(response)) as QPayInvoiceResponse;
  if (!response.ok || !invoice || (!invoice.invoice_id && !invoice.qr_text && !invoice.invoice_url)) {
    throw badRequest("Failed to create QPay invoice");
  }

  return invoice;
}

export async function checkQPayInvoicePayment(
  invoiceId: string,
): Promise<QPayPaymentCheckResponse> {
  requireQPayConfig();

  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw badRequest("invoiceId is required");
  }

  const accessToken = await fetchQPayToken();

  const response = await fetch(`${env.qpayBaseUrl}/payment/check`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: normalizedInvoiceId,
    }),
  });

  const payload = (await parseJsonSafe(response)) as QPayPaymentCheckResponse;
  if (!response.ok) {
    throw badRequest("Failed to check QPay payment status");
  }

  return payload || {};
}
