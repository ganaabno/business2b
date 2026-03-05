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
