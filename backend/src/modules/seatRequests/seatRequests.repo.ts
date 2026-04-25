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
  serial_group_id: string;
  serial_index: number;
  serial_total: number;
};

export type OrganizationGroupPolicy = {
  mode: GroupPolicyMode;
  minPax: number;
  maxPax: number;
};

export type SeatRequestBundleMemberRow = {
  id: string;
  request_no: string;
  status: string;
  serial_group_id: string;
  serial_index: number;
  serial_total: number;
  next_deadline_at: string | null;
  current_payment_state: string | null;
};

export type SeatRequestBundleMilestoneRow = {
  seat_request_id: string;
  code: string;
  due_at: string | null;
  status: string;
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
  const { rows } = await client.query<{
    id: string;
    request_no: string;
    serial_group_id: string;
    serial_index: number;
    serial_total: number;
  }>(
    `
    with generated as (
      select gen_random_uuid() as request_id
    )
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
      serial_group_id,
      serial_index,
      serial_total,
      status
    )
    select
      generated.request_id,
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
      generated.request_id,
      1,
      1,
      'pending'
    from generated
    returning id::text, request_no, serial_group_id::text, serial_index, serial_total
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
    serialGroupId: string;
    serialIndex: number;
    serialTotal: number;
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
      serial_group_id,
      serial_index,
      serial_total,
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
      $10::uuid,
      $11::int,
      $12::int,
      'approved_waiting_deposit',
      now(),
      'Auto-approved via seat access request',
      case
        when ($11::int = 1 and $12::int > 1) then now() + interval '6 hour'
        when $6::date > current_date + 30 then now() + interval '6 hour'
        else null
      end,
      $13::uuid
    )
    returning
      id::text,
      request_no,
      status::text,
      deposit_due_at,
      serial_group_id::text,
      serial_index,
      serial_total
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
      params.serialGroupId,
      params.serialIndex,
      params.serialTotal,
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
      coalesce(sr.serial_group_id::text, sr.id::text) as serial_group_id,
      coalesce(sr.serial_index, 1) as serial_index,
      coalesce(sr.serial_total, 1) as serial_total,
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

export async function listSeatRequestBundleMembersRepo(requestId: string) {
  const { rows } = await q<SeatRequestBundleMemberRow>(
    `
    with target as (
      select coalesce(sr.serial_group_id, sr.id) as serial_group_id
      from public.seat_requests sr
      where sr.id = $1::uuid
      limit 1
    )
    select
      sr.id::text,
      sr.request_no,
      sr.status::text,
      coalesce(sr.serial_group_id::text, sr.id::text) as serial_group_id,
      coalesce(sr.serial_index, 1) as serial_index,
      coalesce(sr.serial_total, 1) as serial_total,
      mon.next_deadline_at,
      mon.current_payment_state::text
    from public.seat_requests sr
    join target t on coalesce(sr.serial_group_id, sr.id) = t.serial_group_id
    left join public.v_seat_request_monitoring mon on mon.id = sr.id
    order by coalesce(sr.serial_index, 1) asc, sr.travel_date asc, sr.created_at asc
    `,
    [requestId],
  );

  return rows;
}

export async function listSeatRequestBundleUnpaidMilestonesRepo(requestId: string) {
  const { rows } = await q<SeatRequestBundleMilestoneRow>(
    `
    with target as (
      select coalesce(sr.serial_group_id, sr.id) as serial_group_id
      from public.seat_requests sr
      where sr.id = $1::uuid
      limit 1
    )
    select
      m.seat_request_id::text,
      m.code::text,
      m.due_at,
      m.status::text
    from public.seat_request_payment_milestones m
    join public.seat_requests sr on sr.id = m.seat_request_id
    join target t on coalesce(sr.serial_group_id, sr.id) = t.serial_group_id
    where m.status::text <> 'paid'
    order by m.due_at asc nulls last, coalesce(sr.serial_index, 1) asc
    `,
    [requestId],
  );

  return rows;
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
      deposit_due_at = case
        when travel_date > current_date + 30 then now() + interval '6 hour'
        else null
      end,
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
