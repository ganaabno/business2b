import type { PoolClient } from "pg";
import { q } from "../../db/transaction.js";

export type PaymentMilestoneRow = {
  id: string;
  code: string;
  due_at: string | null;
  required_cumulative_mnt: number | string;
  status: string;
  satisfied_at: string | null;
};

export type PaymentHistoryRow = {
  id: string;
  amount_mnt: number | string;
  payment_method: string;
  provider: string;
  status: string;
  paid_at: string | null;
  external_txn_id: string;
  created_at: string;
};

export type PaymentIntentLookup = {
  seat_request_id: string;
};

export type SeatRequestPaymentIntentRow = {
  id: string;
  seat_request_id: string;
  milestone_code: string;
  provider: string;
  sender_invoice_no: string;
  external_invoice_id: string | null;
  amount_mnt: number | string;
  currency: string;
  status: string;
  external_txn_id: string | null;
  payload: unknown;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getPaymentMilestonesRepo(seatRequestId: string) {
  const { rows } = await q<PaymentMilestoneRow>(
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
    [seatRequestId],
  );
  return rows;
}

export async function getPaymentHistoryRepo(seatRequestId: string) {
  const { rows } = await q<PaymentHistoryRow>(
    `
    select
      id::text,
      amount_mnt,
      payment_method,
      provider,
      status::text,
      paid_at,
      external_txn_id,
      created_at
    from public.seat_request_payments
    where seat_request_id = $1::uuid
    order by created_at desc
    `,
    [seatRequestId],
  );
  return rows;
}

export async function upsertPaymentRepo(
  client: PoolClient,
  params: {
    seatRequestId: string;
    amountMnt: number;
    paymentMethod: string;
    provider: string;
    externalTxnId: string;
    status: "paid" | "partial" | "unpaid";
    rawPayload: unknown;
  },
) {
  const result = await client.query(
    `
    insert into public.seat_request_payments (
      seat_request_id,
      amount_mnt,
      payment_method,
      provider,
      external_txn_id,
      status,
      paid_at,
      raw_payload
    )
    values ($1::uuid, $2, $3, $4, $5, $6::public.payment_status, now(), $7::jsonb)
    on conflict (external_txn_id, provider)
    do nothing
    `,
    [
      params.seatRequestId,
      params.amountMnt,
      params.paymentMethod,
      params.provider,
      params.externalTxnId,
      params.status,
      JSON.stringify(params.rawPayload ?? {}),
    ],
  );

  return (result.rowCount || 0) > 0;
}

export async function createSeatRequestPaymentIntentRepo(
  client: PoolClient,
  params: {
    seatRequestId: string;
    milestoneCode: string;
    provider: string;
    senderInvoiceNo: string;
    externalInvoiceId: string | null;
    amountMnt: number;
    currency: string;
    createdBy: string;
    rawPayload: unknown;
  },
) {
  await client.query(
    `
    insert into public.seat_request_payment_intents (
      seat_request_id,
      milestone_code,
      provider,
      sender_invoice_no,
      external_invoice_id,
      amount_mnt,
      currency,
      status,
      created_by,
      payload
    )
    values ($1::uuid, $2, $3, $4, nullif($5, ''), $6, $7, 'created', $8::uuid, $9::jsonb)
    on conflict (provider, sender_invoice_no)
    do update set
      external_invoice_id = coalesce(excluded.external_invoice_id, seat_request_payment_intents.external_invoice_id),
      amount_mnt = excluded.amount_mnt,
      currency = excluded.currency,
      payload = excluded.payload,
      updated_at = now()
    `,
    [
      params.seatRequestId,
      params.milestoneCode,
      params.provider,
      params.senderInvoiceNo,
      params.externalInvoiceId || "",
      params.amountMnt,
      params.currency,
      params.createdBy,
      JSON.stringify(params.rawPayload ?? {}),
    ],
  );
}

export async function findSeatRequestIdByPaymentIntentRepo(
  client: PoolClient,
  params: {
    provider: string;
    externalInvoiceId?: string;
    senderInvoiceNo?: string;
  },
) {
  const { rows } = await client.query<PaymentIntentLookup>(
    `
    select seat_request_id::text
    from public.seat_request_payment_intents
    where provider = $1
      and (
        ($2::text <> '' and external_invoice_id = $2)
        or ($3::text <> '' and sender_invoice_no = $3)
      )
    order by created_at desc
    limit 1
    `,
    [params.provider, params.externalInvoiceId || "", params.senderInvoiceNo || ""],
  );

  return rows[0]?.seat_request_id || null;
}

export async function markSeatRequestPaymentIntentPaidRepo(
  client: PoolClient,
  params: {
    provider: string;
    externalInvoiceId?: string;
    senderInvoiceNo?: string;
    externalTxnId: string;
    rawPayload: unknown;
  },
) {
  await client.query(
    `
    update public.seat_request_payment_intents
    set
      status = 'paid',
      external_invoice_id = coalesce(nullif($2, ''), external_invoice_id),
      external_txn_id = nullif($4, ''),
      paid_at = now(),
      payload = $5::jsonb,
      updated_at = now()
    where provider = $1
      and (
        ($2::text <> '' and external_invoice_id = $2)
        or ($3::text <> '' and sender_invoice_no = $3)
      )
    `,
    [
      params.provider,
      params.externalInvoiceId || "",
      params.senderInvoiceNo || "",
      params.externalTxnId,
      JSON.stringify(params.rawPayload ?? {}),
    ],
  );
}

export async function getLatestSeatRequestPaymentIntentRepo(
  seatRequestId: string,
  filters?: {
    provider?: string;
    milestoneCode?: string;
    status?: string;
    statusNot?: string;
    externalInvoiceId?: string;
    senderInvoiceNo?: string;
  },
) {
  const conditions = ["seat_request_id = $1::uuid"];
  const params: unknown[] = [seatRequestId];

  if (filters?.provider) {
    params.push(filters.provider);
    conditions.push(`provider = $${params.length}`);
  }

  if (filters?.milestoneCode) {
    params.push(filters.milestoneCode);
    conditions.push(`milestone_code = $${params.length}`);
  }

  if (filters?.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters?.statusNot) {
    params.push(filters.statusNot);
    conditions.push(`status <> $${params.length}`);
  }

  if (filters?.externalInvoiceId) {
    params.push(filters.externalInvoiceId);
    conditions.push(`external_invoice_id = $${params.length}`);
  }

  if (filters?.senderInvoiceNo) {
    params.push(filters.senderInvoiceNo);
    conditions.push(`sender_invoice_no = $${params.length}`);
  }

  const { rows } = await q<SeatRequestPaymentIntentRow>(
    `
    select
      id::text,
      seat_request_id::text,
      milestone_code::text,
      provider,
      sender_invoice_no,
      external_invoice_id,
      amount_mnt,
      currency,
      status,
      external_txn_id,
      payload,
      paid_at,
      created_at,
      updated_at
    from public.seat_request_payment_intents
    where ${conditions.join(" and ")}
    order by created_at desc
    limit 1
    `,
    params,
  );

  return rows[0] || null;
}
