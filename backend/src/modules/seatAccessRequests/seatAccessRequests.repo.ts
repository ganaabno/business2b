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
  planned_seats: number;
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
  serial_count: number;
  serial_group_id: string | null;
  created_at: string;
  updated_at: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_username: string | null;
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
  planned_seats: number;
  status: SeatAccessRequestStatus;
  approved_at: string | null;
  expires_at: string | null;
  seat_request_id: string | null;
  serial_count: number;
  serial_group_id: string | null;
};

export type TourSelectionCandidate = {
  id: string;
  title: string;
  country: string | null;
  cities: string[];
  base_price: number | string;
  available_seats: number | string | null;
  departure_date: string;
};

export type DepartureSeatStats = {
  capacity: number | string;
  booked: number | string;
  remaining: number | string;
};

export type SeatAccessSelectionIdempotencyRow = {
  created: boolean;
  status: "processing" | "completed";
  response_payload: unknown | null;
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
    sar.planned_seats,
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
    coalesce(sar.serial_count, 1) as serial_count,
    sar.serial_group_id::text,
    sar.created_at,
    sar.updated_at,
    coalesce(
      nullif(to_jsonb(requester) ->> 'first_name', ''),
      nullif(to_jsonb(requester) ->> 'firstname', '')
    ) as requester_first_name,
    coalesce(
      nullif(to_jsonb(requester) ->> 'last_name', ''),
      nullif(to_jsonb(requester) ->> 'lastname', '')
    ) as requester_last_name,
    coalesce(
      nullif(to_jsonb(requester) ->> 'username', ''),
      nullif(to_jsonb(requester) ->> 'user_name', ''),
      nullif(to_jsonb(requester) ->> 'name', '')
    ) as requester_username,
    coalesce(
      nullif(requester.email, ''),
      nullif(to_jsonb(requester) ->> 'email', '')
    ) as requester_email
  from public.seat_access_requests sar
  left join public.organizations o on o.id = sar.organization_id
  left join lateral (
    select u.*
    from public.users u
    where u.id::text = sar.requester_user_id::text
       or coalesce(
         nullif(to_jsonb(u) ->> 'auth_user_id', ''),
         nullif(to_jsonb(u) ->> 'userid', '')
       ) = sar.requester_user_id::text
    limit 1
  ) requester on true
  left join public.users reviewer on reviewer.id::text = sar.reviewed_by::text
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
      plannedSeats: number;
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
      planned_seats,
      note,
      status
    )
    values ($1::uuid, $2::uuid, $3::public.app_role, $4::date, $5::date, $6, $7, $8, 'pending')
    returning id::text
    `,
    [
      params.requesterUserId,
      params.organizationId,
      params.requesterRole,
      params.fromDate,
      params.toDate,
      params.destination,
      params.plannedSeats,
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
      planned_seats,
      status::text as status,
      approved_at,
      expires_at,
      seat_request_id::text
      ,coalesce(serial_count, 1) as serial_count
      ,serial_group_id::text
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
      expires_at = (now() + interval '6 hour'),
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
    serialGroupId: string | null;
    serialCount: number;
  },
) {
  await client.query(
    `
    update public.seat_access_requests
    set
      status = 'consumed',
      consumed_at = now(),
      seat_request_id = $2::uuid,
      serial_group_id = coalesce($3::uuid, serial_group_id),
      serial_count = greatest(coalesce(serial_count, 1), coalesce($4::int, 1)),
      updated_at = now()
    where id = $1::uuid
    `,
    [params.id, params.seatRequestId, params.serialGroupId, params.serialCount],
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
            when pg_typeof(t.dates)::text = 'text[]' and cardinality(t.dates) > 0 then t.dates
            when t.departuredate is not null then array[t.departuredate::text]
            else array[$2::text]
          end
        )::date as departure_date
      from public.tours t
      where t.id::text = $1::text
    )
    select
      t.id::text,
      t.title,
      nullif(btrim(t.country), '') as country,
      coalesce(t.cities, array[]::text[]) as cities,
      coalesce(t.base_price, 0) as base_price,
      d.departure_date::text as departure_date,
      (
        case
          when coalesce(stats.remaining, 0) > 0 then coalesce(stats.remaining, 0)
          when coalesce(t.available_seats, 0) > 0 then coalesce(t.available_seats, 0)
          when d.departure_date is null
               and t.departuredate is null
               and cardinality(coalesce(t.dates, array[]::text[])) = 0
            then coalesce(t.seats, 0)
          else coalesce(stats.remaining, t.available_seats, 0)
        end
      ) as available_seats
    from public.tours t
    join departure_dates d on d.tour_id = t.id::text
    left join lateral public.get_departure_seats(
      t.id::text,
      coalesce(d.departure_date::text, $2::text)
    ) stats on true
    where t.id::text = $1::text
      and d.departure_date = $2::date
    limit 1
    `,
    [params.tourId, params.travelDate],
  );

  return rows[0] || null;
}

export async function listNextTourSelectionCandidatesByTitleRepo(
  client: PoolClient,
  params: {
    title: string;
    startDateExclusive: string;
    limit: number;
  },
) {
  const safeLimit = Math.max(1, Math.min(Math.floor(params.limit), 50));
  const { rows } = await client.query<TourSelectionCandidate>(
    `
    with departure_dates as (
      select
        t.id::text as tour_id,
        coalesce(nullif(btrim(t.title), ''), nullif(btrim(t.name), '')) as title,
        raw_date.value::date as departure_date
      from public.tours t
      cross join lateral unnest(
          case
            when pg_typeof(t.dates)::text = 'text[]' and cardinality(t.dates) > 0 then t.dates
            when t.departuredate is not null then array[t.departuredate::text]
            else array[]::text[]
          end
      ) as raw_date(value)
      where lower(coalesce(t.status, 'active')) = 'active'
        and raw_date.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        and lower(trim(coalesce(t.title, t.name, ''))) = lower(trim($1))
        and raw_date.value::date > $2::date
    ),
    deduped as (
      select distinct on (d.tour_id, d.departure_date)
        d.tour_id,
        d.title,
        d.departure_date
      from departure_dates d
      order by d.tour_id, d.departure_date
    )
    select
      t.id::text,
      deduped.title,
      nullif(btrim(t.country), '') as country,
      coalesce(t.cities, array[]::text[]) as cities,
      coalesce(t.base_price, 0) as base_price,
      deduped.departure_date::text as departure_date,
      (
        case
          when coalesce(stats.remaining, 0) > 0 then coalesce(stats.remaining, 0)
          when coalesce(t.available_seats, 0) > 0 then coalesce(t.available_seats, 0)
          when deduped.departure_date is null
               and t.departuredate is null
               and cardinality(coalesce(t.dates, array[]::text[])) = 0
            then coalesce(t.seats, 0)
          else coalesce(stats.remaining, t.available_seats, 0)
        end
      ) as available_seats
    from deduped
    join public.tours t on t.id::text = deduped.tour_id
    left join lateral public.get_departure_seats(
      t.id::text,
      deduped.departure_date::text
    ) stats on true
    order by deduped.departure_date asc, t.id::text asc
    limit $3::int
    `,
    [params.title, params.startDateExclusive, safeLimit],
  );

  return rows;
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

export async function beginSeatAccessSelectionIdempotencyRepo(
  client: PoolClient,
  params: {
    accessRequestId: string;
    requesterUserId: string;
    idempotencyKey: string;
    requestPayload: Record<string, unknown>;
  },
) {
  const { rows } = await client.query<SeatAccessSelectionIdempotencyRow>(
    `
    with inserted as (
      insert into public.seat_access_request_idempotency (
        access_request_id,
        requester_user_id,
        idempotency_key,
        status,
        request_payload,
        response_payload,
        updated_at
      )
      values (
        $1::uuid,
        $2::uuid,
        $3,
        'processing',
        $4::jsonb,
        null,
        now()
      )
      on conflict (access_request_id, requester_user_id, idempotency_key)
      do nothing
      returning true as created, status::text as status, response_payload
    )
    select created, status, response_payload
    from inserted

    union all

    select false as created, status::text as status, response_payload
    from public.seat_access_request_idempotency
    where access_request_id = $1::uuid
      and requester_user_id = $2::uuid
      and idempotency_key = $3
    limit 1
    `,
    [
      params.accessRequestId,
      params.requesterUserId,
      params.idempotencyKey,
      JSON.stringify(params.requestPayload || {}),
    ],
  );

  return rows[0] || null;
}

export async function completeSeatAccessSelectionIdempotencyRepo(
  client: PoolClient,
  params: {
    accessRequestId: string;
    requesterUserId: string;
    idempotencyKey: string;
    responsePayload: Record<string, unknown>;
  },
) {
  await client.query(
    `
    update public.seat_access_request_idempotency
    set
      status = 'completed',
      response_payload = $4::jsonb,
      updated_at = now()
    where access_request_id = $1::uuid
      and requester_user_id = $2::uuid
      and idempotency_key = $3
    `,
    [
      params.accessRequestId,
      params.requesterUserId,
      params.idempotencyKey,
      JSON.stringify(params.responsePayload || {}),
    ],
  );
}
