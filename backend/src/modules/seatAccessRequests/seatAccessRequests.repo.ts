import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { q } from "../../db/transaction.js";

export type SeatAccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "consumed"
  | "expired";

export type SeatAccessRequestRequestedRole = "subcontractor" | "agent";

export type SeatAccessRequestRow = {
  id: string;
  requester_user_id: string;
  organization_id: string;
  organization_name: string | null;
  requester_role: SeatAccessRequestRequestedRole;
  from_date: string;
  to_date: string;
  destination: string;
  note: string | null;
  status: SeatAccessRequestStatus;
  decision_reason: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  consumed_at: string | null;
  seat_request_id: string | null;
  created_at: string;
  updated_at: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
};

export type SeatAccessRequestForUpdate = {
  id: string;
  requester_user_id: string;
  organization_id: string;
  requester_role: SeatAccessRequestRequestedRole;
  from_date: string;
  to_date: string;
  destination: string;
  status: SeatAccessRequestStatus;
  expires_at: string | null;
  seat_request_id: string | null;
};

export type TourSelectionCandidate = {
  id: string;
  title: string;
  base_price: number | string;
};

export type DepartureSeatStats = {
  capacity: number | string;
  booked: number | string;
  remaining: number | string;
};

const BASE_SELECT = `
  select
    sar.id::text,
    sar.requester_user_id::text,
    sar.organization_id::text,
    o.name as organization_name,
    sar.requester_role::text as requester_role,
    sar.from_date::text,
    sar.to_date::text,
    sar.destination,
    sar.note,
    sar.status::text as status,
    sar.decision_reason,
    sar.reviewed_by::text,
    reviewer.email as reviewed_by_email,
    sar.reviewed_at,
    sar.approved_at,
    sar.expires_at,
    sar.consumed_at,
    sar.seat_request_id::text,
    sar.created_at,
    sar.updated_at,
    requester.first_name as requester_first_name,
    requester.last_name as requester_last_name,
    requester.email as requester_email
  from public.seat_access_requests sar
  left join public.organizations o on o.id = sar.organization_id
  left join public.users requester on requester.id = sar.requester_user_id
  left join public.users reviewer on reviewer.id = sar.reviewed_by
`;

async function runQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
): Promise<QueryResult<T>> {
  if (client) {
    return client.query<T>(sql, params);
  }
  return q<T>(sql, params);
}

export async function createSeatAccessRequestRepo(
  client: PoolClient,
  params: {
    requesterUserId: string;
    organizationId: string;
    requesterRole: SeatAccessRequestRequestedRole;
    fromDate: string;
    toDate: string;
    destination: string;
    note: string | null;
  },
) {
  const { rows } = await client.query<{ id: string }>(
    `
    insert into public.seat_access_requests (
      requester_user_id,
      organization_id,
      requester_role,
      from_date,
      to_date,
      destination,
      note,
      status
    )
    values ($1::uuid, $2::uuid, $3::public.app_role, $4::date, $5::date, $6, $7, 'pending')
    returning id::text
    `,
    [
      params.requesterUserId,
      params.organizationId,
      params.requesterRole,
      params.fromDate,
      params.toDate,
      params.destination,
      params.note,
    ],
  );

  return rows[0]?.id || null;
}

export async function listSeatAccessRequestsRepo(
  filters: {
    userId?: string;
    status?: SeatAccessRequestStatus;
    destination?: string;
    limit?: number;
  },
  client?: PoolClient,
) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`sar.requester_user_id = $${params.length}::uuid`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`sar.status::text = $${params.length}`);
  }
  if (filters.destination) {
    params.push(filters.destination);
    conditions.push(`sar.destination ilike ('%' || $${params.length} || '%')`);
  }

  const whereSql = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const limit = Math.max(1, Math.min(filters.limit ?? 300, 500));
  params.push(limit);

  const { rows } = await runQuery<SeatAccessRequestRow>(
    `
    ${BASE_SELECT}
    ${whereSql}
    order by sar.created_at desc
    limit $${params.length}
    `,
    params,
    client,
  );

  return rows;
}

export async function getSeatAccessRequestByIdRepo(id: string, client?: PoolClient) {
  const { rows } = await runQuery<SeatAccessRequestRow>(
    `
    ${BASE_SELECT}
    where sar.id = $1::uuid
    limit 1
    `,
    [id],
    client,
  );

  return rows[0] || null;
}

export async function getSeatAccessRequestByIdForUpdateRepo(
  client: PoolClient,
  id: string,
) {
  const { rows } = await client.query<SeatAccessRequestForUpdate>(
    `
    select
      id::text,
      requester_user_id::text,
      organization_id::text,
      requester_role::text as requester_role,
      from_date::text,
      to_date::text,
      destination,
      status::text as status,
      expires_at,
      seat_request_id::text
    from public.seat_access_requests
    where id = $1::uuid
    for update
    `,
    [id],
  );

  return rows[0] || null;
}

export async function approveSeatAccessRequestRepo(
  client: PoolClient,
  params: {
    id: string;
    reviewedBy: string;
    decisionReason: string | null;
  },
) {
  await client.query(
    `
    update public.seat_access_requests
    set
      status = 'approved',
      reviewed_by = $2::uuid,
      reviewed_at = now(),
      approved_at = now(),
      decision_reason = $3,
      expires_at = (to_date::timestamptz + interval '1 day'),
      updated_at = now()
    where id = $1::uuid
    `,
    [params.id, params.reviewedBy, params.decisionReason],
  );
}

export async function rejectSeatAccessRequestRepo(
  client: PoolClient,
  params: {
    id: string;
    reviewedBy: string;
    decisionReason: string | null;
  },
) {
  await client.query(
    `
    update public.seat_access_requests
    set
      status = 'rejected',
      reviewed_by = $2::uuid,
      reviewed_at = now(),
      decision_reason = $3,
      updated_at = now()
    where id = $1::uuid
    `,
    [params.id, params.reviewedBy, params.decisionReason],
  );
}

export async function expireSeatAccessRequestRepo(client: PoolClient, id: string) {
  await client.query(
    `
    update public.seat_access_requests
    set
      status = 'expired',
      updated_at = now()
    where id = $1::uuid
    `,
    [id],
  );
}

export async function consumeSeatAccessRequestRepo(
  client: PoolClient,
  params: {
    id: string;
    seatRequestId: string;
  },
) {
  await client.query(
    `
    update public.seat_access_requests
    set
      status = 'consumed',
      consumed_at = now(),
      seat_request_id = $2::uuid,
      updated_at = now()
    where id = $1::uuid
    `,
    [params.id, params.seatRequestId],
  );
}

export async function getTourSelectionCandidateRepo(
  client: PoolClient,
  params: { tourId: string; travelDate: string },
) {
  const { rows } = await client.query<TourSelectionCandidate>(
    `
    with departure_dates as (
      select
        t.id::text as tour_id,
        unnest(
          case
            when pg_typeof(t.dates)::text = 'text[]' then t.dates
            else array[]::text[]
          end
        )::date as departure_date
      from public.tours t
      where t.id = $1
    )
    select
      t.id::text,
      t.title,
      coalesce(t.base_price, 0) as base_price
    from public.tours t
    join departure_dates d on d.tour_id = t.id::text
    where t.id = $1
      and d.departure_date = $2::date
    limit 1
    `,
    [params.tourId, params.travelDate],
  );

  return rows[0] || null;
}

export async function getDepartureSeatStatsRepo(
  client: PoolClient,
  params: { tourId: string; travelDate: string },
) {
  const { rows } = await client.query<DepartureSeatStats>(
    `
    select capacity, booked, remaining
    from public.get_departure_seats($1, $2)
    `,
    [params.tourId, params.travelDate],
  );

  return rows[0] || null;
}
