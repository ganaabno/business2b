import type { PoolClient } from "pg";
import { q } from "../../db/transaction.js";

export type SeatRequestStatus =
  | "pending"
  | "rejected"
  | "approved_waiting_deposit"
  | "confirmed_deposit_paid"
  | "cancelled_expired"
  | "cancelled_by_admin"
  | "cancelled_by_requester"
  | "completed";

export type GroupPolicyMode = "off" | "validate_only" | "enforce";

export type CreatedSeatRequestRow = {
  id: string;
  request_no: string;
  status: string;
  deposit_due_at: string | null;
};

export type OrganizationGroupPolicy = {
  mode: GroupPolicyMode;
  minPax: number;
  maxPax: number;
};

export async function createSeatRequestRepo(
  client: PoolClient,
  params: {
    requesterUserId: string;
    organizationId: string;
    requesterRole: "subcontractor" | "agent";
    tourId: string;
    destination: string;
    travelDate: string;
    requestedSeats: number;
    unitPriceMnt: number;
  },
) {
  const totalPrice = params.unitPriceMnt * params.requestedSeats;
  const { rows } = await client.query<{ id: string; request_no: string }>(
    `
    insert into public.seat_requests (
      id,
      request_no,
      requester_user_id,
      organization_id,
      requester_role,
      tour_id,
      destination,
      travel_date,
      requested_seats,
      unit_price_mnt,
      total_price_mnt,
      status
    )
    values (
      gen_random_uuid(),
      public.fn_make_request_no(),
      $1::uuid,
      $2::uuid,
      $3::public.app_role,
      $4,
      $5,
      $6::date,
      $7,
      $8,
      $9,
      'pending'
    )
    returning id::text, request_no
    `,
    [
      params.requesterUserId,
      params.organizationId,
      params.requesterRole,
      params.tourId,
      params.destination,
      params.travelDate,
      params.requestedSeats,
      params.unitPriceMnt,
      totalPrice,
    ],
  );
  return rows[0];
}

export async function createApprovedSeatRequestFromAccessRepo(
  client: PoolClient,
  params: {
    requesterUserId: string;
    organizationId: string;
    requesterRole: "subcontractor" | "agent";
    tourId: string;
    destination: string;
    travelDate: string;
    requestedSeats: number;
    unitPriceMnt: number;
    accessRequestId: string;
  },
) {
  const totalPrice = params.unitPriceMnt * params.requestedSeats;
  const { rows } = await client.query<CreatedSeatRequestRow>(
    `
    insert into public.seat_requests (
      id,
      request_no,
      requester_user_id,
      organization_id,
      requester_role,
      tour_id,
      destination,
      travel_date,
      requested_seats,
      unit_price_mnt,
      total_price_mnt,
      status,
      approved_at,
      approval_note,
      deposit_due_at,
      access_request_id
    )
    values (
      gen_random_uuid(),
      public.fn_make_request_no(),
      $1::uuid,
      $2::uuid,
      $3::public.app_role,
      $4,
      $5,
      $6::date,
      $7,
      $8,
      $9,
      'approved_waiting_deposit',
      now(),
      'Auto-approved via seat access request',
      now() + interval '6 hour',
      $10::uuid
    )
    returning id::text, request_no, status::text, deposit_due_at
    `,
    [
      params.requesterUserId,
      params.organizationId,
      params.requesterRole,
      params.tourId,
      params.destination,
      params.travelDate,
      params.requestedSeats,
      params.unitPriceMnt,
      totalPrice,
      params.accessRequestId,
    ],
  );

  return rows[0];
}

export async function listSeatRequestsRepo(filters: {
  userId?: string;
  organizationId?: string;
  destination?: string;
  status?: string;
  paymentState?: string;
}) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`sr.requester_user_id = $${params.length}::uuid`);
  }
  if (filters.organizationId) {
    params.push(filters.organizationId);
    conditions.push(`sr.organization_id = $${params.length}::uuid`);
  }
  if (filters.destination) {
    params.push(filters.destination);
    conditions.push(`sr.destination = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`sr.status::text = $${params.length}`);
  }
  if (filters.paymentState) {
    params.push(filters.paymentState);
    conditions.push(
      `coalesce(mon.current_payment_state::text, 'unpaid') = $${params.length}`,
    );
  }

  const whereSql =
    conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

  const { rows } = await q(
    `
    select
      sr.id::text,
      sr.request_no,
      sr.requester_user_id::text,
      sr.organization_id::text,
      sr.requester_role::text,
      sr.tour_id,
      sr.destination,
      sr.travel_date,
      sr.requested_seats,
      sr.total_price_mnt,
      sr.status::text,
      sr.created_at,
      sr.deposit_due_at,
      mon.current_payment_state::text as payment_state,
      mon.next_deadline_at
    from public.seat_requests sr
    left join public.v_seat_request_monitoring mon on mon.id = sr.id
    ${whereSql}
    order by sr.created_at desc
    `,
    params,
  );
  return rows;
}

export async function getOrganizationGroupPolicyRepo(
  organizationId: string,
): Promise<OrganizationGroupPolicy> {
  const { rows } = await q<{
    mode: GroupPolicyMode;
    min_pax: number | string;
    max_pax: number | string;
  }>(
    `
    select
      coalesce(group_policy_mode, 'off')::text as mode,
      coalesce(group_min_pax, 10) as min_pax,
      coalesce(group_max_pax, 30) as max_pax
    from public.organization_contracts
    where organization_id = $1::uuid
    limit 1
    `,
    [organizationId],
  );

  const row = rows[0];
  if (!row) {
    return {
      mode: "off",
      minPax: 10,
      maxPax: 30,
    };
  }

  return {
    mode: row.mode,
    minPax: Number(row.min_pax),
    maxPax: Number(row.max_pax),
  };
}

export async function getSeatRequestByIdRepo(id: string) {
  const { rows } = await q(
    `
    select
      sr.*,
      mon.organization_name,
      mon.paid_total_mnt,
      mon.next_deadline_at,
      mon.current_payment_state
    from public.seat_requests sr
    left join public.v_seat_request_monitoring mon on mon.id = sr.id
    where sr.id = $1::uuid
    `,
    [id],
  );
  return rows[0] || null;
}

export async function approveSeatRequestRepo(
  client: PoolClient,
  params: { requestId: string; approvedBy: string; note: string | null },
) {
  const { rows } = await client.query<{ id: string }>(
    `
    update public.seat_requests
    set
      status = 'approved_waiting_deposit',
      approved_by = $2::uuid,
      approved_at = now(),
      approval_note = $3,
      deposit_due_at = now() + interval '6 hour',
      updated_at = now()
    where id = $1::uuid
      and status = 'pending'
    returning id::text
    `,
    [params.requestId, params.approvedBy, params.note],
  );
  return rows[0] || null;
}

export async function rejectSeatRequestRepo(
  client: PoolClient,
  params: { requestId: string; rejectedBy: string; reason: string | null },
) {
  const { rows } = await client.query<{ id: string }>(
    `
    update public.seat_requests
    set
      status = 'rejected',
      rejected_by = $2::uuid,
      rejected_at = now(),
      rejection_reason = $3,
      updated_at = now()
    where id = $1::uuid
      and status = 'pending'
    returning id::text
    `,
    [params.requestId, params.rejectedBy, params.reason],
  );
  return rows[0] || null;
}

export async function cancelSeatRequestRepo(
  client: PoolClient,
  params: {
    requestId: string;
    cancelledStatus: "cancelled_by_admin" | "cancelled_by_requester";
  },
) {
  const { rows } = await client.query<{ id: string }>(
    `
    update public.seat_requests
    set
      status = $2::public.seat_request_status,
      cancelled_at = now(),
      updated_at = now()
    where id = $1::uuid
      and status in ('pending', 'approved_waiting_deposit', 'confirmed_deposit_paid')
    returning id::text
    `,
    [params.requestId, params.cancelledStatus],
  );
  return rows[0] || null;
}
