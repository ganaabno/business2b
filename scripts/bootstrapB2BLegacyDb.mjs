import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();
dotenv.config({ path: "backend/.env", override: false });

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";

if (!connectionString) {
  console.error("Missing DATABASE_URL/NEON_DATABASE_URL");
  process.exit(1);
}

const SQL = [
  `create extension if not exists pgcrypto;`,
  `
  do $$
  begin
    if not exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'app_role'
    ) then
      create type public.app_role as enum ('admin', 'manager', 'subcontractor', 'agent');
    end if;
  end
  $$;
  `,
  `
  do $$
  begin
    if not exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'seat_access_request_status'
    ) then
      create type public.seat_access_request_status as enum (
        'pending', 'approved', 'rejected', 'consumed', 'expired'
      );
    end if;
  end
  $$;
  `,
  `
  do $$
  begin
    if not exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'seat_request_status'
    ) then
      create type public.seat_request_status as enum (
        'pending',
        'rejected',
        'approved_waiting_deposit',
        'confirmed_deposit_paid',
        'cancelled_expired',
        'cancelled_by_admin',
        'cancelled_by_requester',
        'completed'
      );
    end if;
  end
  $$;
  `,
  `
  do $$
  begin
    if not exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'payment_status'
    ) then
      create type public.payment_status as enum ('unpaid', 'partial', 'paid');
    end if;
  end
  $$;
  `,
  `
  do $$
  begin
    if not exists (
      select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'milestone_status'
    ) then
      create type public.milestone_status as enum ('pending', 'paid', 'waived', 'overdue');
    end if;
  end
  $$;
  `,
  `
  create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    registration_number text,
    merchant_code text unique,
    contact_name text,
    contact_phone text,
    contact_email text,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  `,
  `
  create table if not exists public.organization_members (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    user_id uuid not null,
    app_role public.app_role not null default 'subcontractor',
    is_primary boolean not null default false,
    joined_at timestamptz not null default now(),
    unique (organization_id, user_id)
  );
  `,
  `
  create index if not exists idx_org_members_user_id
    on public.organization_members (user_id);
  `,
  `
  create table if not exists public.organization_contracts (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null unique,
    deposit_per_seat_mnt numeric not null default 50000,
    reconfirm_per_seat_mnt numeric not null default 100000,
    group_min_pax integer not null default 10,
    group_max_pax integer not null default 30,
    group_policy_mode text not null default 'off',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  `,
  `
  create table if not exists public.organization_binding_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    organization_id uuid,
    merchant_code text not null,
    requested_role public.app_role not null,
    status text not null default 'pending',
    note text,
    decision_reason text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  `,
  `
  create table if not exists public.seat_access_requests (
    id uuid primary key default gen_random_uuid(),
    requester_user_id uuid not null,
    organization_id uuid not null,
    requester_role public.app_role not null,
    from_date date not null,
    to_date date not null,
    destination text not null,
    planned_seats integer not null check (planned_seats > 0),
    note text,
    status public.seat_access_request_status not null default 'pending',
    decision_reason text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    approved_at timestamptz,
    expires_at timestamptz,
    consumed_at timestamptz,
    seat_request_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  `,
  `
  alter table public.seat_access_requests
    drop constraint if exists seat_access_requests_requester_role_check;
  alter table public.seat_access_requests
    add constraint seat_access_requests_requester_role_check
    check (requester_role in ('subcontractor', 'agent'));
  `,
  `
  create index if not exists idx_sar_requester_created
    on public.seat_access_requests (requester_user_id, created_at desc);
  `,
  `
  create table if not exists public.seat_requests (
    id uuid primary key default gen_random_uuid(),
    request_no text not null unique,
    requester_user_id uuid not null,
    organization_id uuid not null,
    requester_role public.app_role not null,
    tour_id text not null,
    destination text not null,
    travel_date date not null,
    requested_seats integer not null check (requested_seats > 0),
    unit_price_mnt numeric not null default 0,
    total_price_mnt numeric not null default 0,
    status public.seat_request_status not null default 'pending',
    approved_by uuid,
    approved_at timestamptz,
    approval_note text,
    rejected_by uuid,
    rejected_at timestamptz,
    rejection_reason text,
    cancelled_at timestamptz,
    deposit_due_at timestamptz,
    access_request_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  `,
  `
  create index if not exists idx_sr_requester_created
    on public.seat_requests (requester_user_id, created_at desc);
  `,
  `
  create index if not exists idx_sr_org_created
    on public.seat_requests (organization_id, created_at desc);
  `,
  `
  create table if not exists public.seat_request_payment_milestones (
    id uuid primary key default gen_random_uuid(),
    seat_request_id uuid not null,
    code text not null,
    due_at timestamptz,
    required_cumulative_mnt numeric not null default 0,
    status public.milestone_status not null default 'pending',
    satisfied_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (seat_request_id, code)
  );
  `,
  `
  create table if not exists public.seat_request_payments (
    id uuid primary key default gen_random_uuid(),
    seat_request_id uuid not null,
    amount_mnt numeric not null,
    payment_method text not null,
    provider text not null,
    external_txn_id text not null,
    status public.payment_status not null default 'paid',
    paid_at timestamptz,
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (external_txn_id, provider)
  );
  `,
  `
  create table if not exists public.seat_request_payment_intents (
    id uuid primary key default gen_random_uuid(),
    seat_request_id uuid not null,
    milestone_code text not null,
    provider text not null,
    sender_invoice_no text not null,
    external_invoice_id text,
    external_txn_id text,
    amount_mnt numeric not null,
    currency text not null default 'MNT',
    status text not null default 'created',
    created_by uuid,
    payload jsonb not null default '{}'::jsonb,
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider, sender_invoice_no)
  );
  `,
  `
  create table if not exists public.integration_outbox (
    id uuid primary key default gen_random_uuid(),
    aggregate_type text not null,
    aggregate_id text not null,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'pending',
    retry_count integer not null default 0,
    next_retry_at timestamptz,
    processed_at timestamptz,
    last_error text,
    created_at timestamptz not null default now()
  );
  `,
  `
  do $$
  begin
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'integration_outbox'
        and column_name = 'next_attempt_at'
    ) and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'integration_outbox'
        and column_name = 'next_retry_at'
    ) then
      alter table public.integration_outbox
        rename column next_attempt_at to next_retry_at;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'integration_outbox'
        and column_name = 'status'
    ) then
      alter table public.integration_outbox
        add column status text not null default 'pending';
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'integration_outbox'
        and column_name = 'next_retry_at'
    ) then
      alter table public.integration_outbox
        add column next_retry_at timestamptz;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'integration_outbox'
        and column_name = 'retry_count'
    ) then
      alter table public.integration_outbox
        add column retry_count integer not null default 0;
    end if;
  end
  $$;
  `,
  `
  create table if not exists public.integration_outbox_deadletter (
    id bigserial primary key,
    outbox_id bigint,
    aggregate_type text,
    aggregate_id text,
    event_type text,
    payload jsonb,
    last_error text,
    created_at timestamptz not null default now()
  );
  `,
  `
  alter table public.tours
    add column if not exists dates text[];
  alter table public.tours
    add column if not exists departuredate date;
  alter table public.tours
    add column if not exists base_price numeric;
  alter table public.tours
    add column if not exists seats integer;
  alter table public.tours
    add column if not exists available_seats integer;
  alter table public.tours
    add column if not exists updated_at timestamptz;

  update public.tours
  set
    dates = coalesce(dates, case when departuredate is not null then array[departuredate::text] else array[]::text[] end),
    base_price = coalesce(base_price, 0),
    seats = coalesce(seats, nullif(regexp_replace(coalesce(group_size, ''), '[^0-9]', '', 'g'), '')::int, 0),
    available_seats = coalesce(available_seats, seats, 0),
    updated_at = coalesce(updated_at, now())
  where dates is null
     or base_price is null
     or seats is null
     or available_seats is null
     or updated_at is null;
  `,
  `
  create or replace function public.fn_make_request_no()
  returns text
  language plpgsql
  as $$
  declare
    suffix text;
  begin
    suffix := lpad((floor(random() * 1000000))::int::text, 6, '0');
    return 'SR-' || to_char(now(), 'YYYYMMDD') || '-' || suffix;
  end;
  $$;
  `,
  `
  create or replace function public.get_departure_seats(p_tour_id text, p_travel_date text)
  returns table (capacity integer, booked integer, remaining integer)
  language sql
  as $$
    select
      greatest(coalesce(t.seats, 0), 0) as capacity,
      0::integer as booked,
      greatest(coalesce(t.available_seats, t.seats, 0), 0) as remaining
    from public.tours t
    where t.id::text = p_tour_id
    limit 1
  $$;
  `,
  `
  create or replace function public.fn_generate_payment_milestones(p_seat_request_id uuid)
  returns void
  language plpgsql
  as $$
  declare
    v_requested_seats integer;
    v_due_at timestamptz;
    v_required numeric;
  begin
    select
      greatest(coalesce(sr.requested_seats, 1), 1),
      coalesce(sr.deposit_due_at, now() + interval '6 hour')
    into v_requested_seats, v_due_at
    from public.seat_requests sr
    where sr.id = p_seat_request_id;

    if v_requested_seats is null then
      return;
    end if;

    v_required := greatest(v_requested_seats * 50000, 0);

    insert into public.seat_request_payment_milestones (
      seat_request_id,
      code,
      due_at,
      required_cumulative_mnt,
      status
    )
    values (p_seat_request_id, 'deposit_6h', v_due_at, v_required, 'pending')
    on conflict (seat_request_id, code)
    do update set
      due_at = excluded.due_at,
      required_cumulative_mnt = excluded.required_cumulative_mnt,
      updated_at = now();
  end;
  $$;
  `,
  `
  create or replace function public.fn_sync_milestone_statuses(p_seat_request_id uuid)
  returns void
  language plpgsql
  as $$
  declare
    v_paid_total numeric;
  begin
    select coalesce(sum(amount_mnt), 0)
    into v_paid_total
    from public.seat_request_payments
    where seat_request_id = p_seat_request_id
      and status = 'paid';

    update public.seat_request_payment_milestones
    set
      status = case
        when v_paid_total >= required_cumulative_mnt then 'paid'::public.milestone_status
        when due_at is not null and due_at < now() then 'overdue'::public.milestone_status
        else 'pending'::public.milestone_status
      end,
      satisfied_at = case
        when v_paid_total >= required_cumulative_mnt then coalesce(satisfied_at, now())
        else null
      end,
      updated_at = now()
    where seat_request_id = p_seat_request_id;

    update public.seat_requests sr
    set
      status = case
        when v_paid_total >= coalesce(sr.total_price_mnt, 0) and coalesce(sr.total_price_mnt, 0) > 0 then 'completed'::public.seat_request_status
        when v_paid_total > 0 then 'confirmed_deposit_paid'::public.seat_request_status
        else sr.status
      end,
      updated_at = now()
    where sr.id = p_seat_request_id
      and sr.status in ('approved_waiting_deposit', 'confirmed_deposit_paid', 'completed');
  end;
  $$;
  `,
  `
  create or replace function public.fn_can_convert_to_booking(p_seat_request_id uuid)
  returns boolean
  language sql
  as $$
    select not exists (
      select 1
      from public.seat_request_payment_milestones m
      where m.seat_request_id = p_seat_request_id
        and m.status in ('pending', 'overdue')
    );
  $$;
  `,
  `
  create or replace view public.v_seat_request_monitoring as
  with paid as (
    select
      p.seat_request_id,
      coalesce(sum(p.amount_mnt), 0) as paid_total_mnt
    from public.seat_request_payments p
    where p.status = 'paid'
    group by p.seat_request_id
  ),
  milestone_next as (
    select
      m.seat_request_id,
      min(m.due_at) filter (where m.status in ('pending', 'overdue')) as next_deadline_at
    from public.seat_request_payment_milestones m
    group by m.seat_request_id
  )
  select
    sr.id,
    sr.request_no,
    sr.requester_user_id,
    sr.organization_id,
    o.name as organization_name,
    sr.requester_role,
    sr.tour_id,
    sr.destination,
    sr.travel_date,
    sr.requested_seats,
    sr.unit_price_mnt,
    sr.total_price_mnt,
    sr.status,
    sr.deposit_due_at,
    sr.created_at,
    sr.updated_at,
    coalesce(p.paid_total_mnt, 0) as paid_total_mnt,
    mn.next_deadline_at,
    case
      when coalesce(p.paid_total_mnt, 0) <= 0 then 'unpaid'::public.payment_status
      when coalesce(p.paid_total_mnt, 0) < coalesce(sr.total_price_mnt, 0) then 'partial'::public.payment_status
      else 'paid'::public.payment_status
    end as current_payment_state
  from public.seat_requests sr
  left join public.organizations o on o.id = sr.organization_id
  left join paid p on p.seat_request_id = sr.id
  left join milestone_next mn on mn.seat_request_id = sr.id;
  `,
  `
  insert into public.organizations (id, name, registration_number, merchant_code, created_at, updated_at)
  values (
    '00000000-0000-0000-0000-000000000111'::uuid,
    'B2B Test Organization',
    'TEST-REG-001',
    'MRC-TEST-001',
    now(),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    registration_number = excluded.registration_number,
    merchant_code = excluded.merchant_code,
    updated_at = now();
  `,
  `
  insert into public.organization_contracts (
    organization_id,
    deposit_per_seat_mnt,
    reconfirm_per_seat_mnt,
    group_min_pax,
    group_max_pax,
    group_policy_mode,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000111'::uuid,
    50000,
    100000,
    1,
    200,
    'off',
    now(),
    now()
  )
  on conflict (organization_id) do update set
    deposit_per_seat_mnt = excluded.deposit_per_seat_mnt,
    reconfirm_per_seat_mnt = excluded.reconfirm_per_seat_mnt,
    group_min_pax = excluded.group_min_pax,
    group_max_pax = excluded.group_max_pax,
    group_policy_mode = excluded.group_policy_mode,
    updated_at = now();
  `,
  `
  insert into public.organization_members (
    organization_id,
    user_id,
    app_role,
    is_primary,
    joined_at
  )
  select
    '00000000-0000-0000-0000-000000000111'::uuid,
    u.id::uuid,
    case
      when lower(coalesce(u.role, '')) like 'admin%' then 'admin'::public.app_role
      when lower(coalesce(u.role, '')) like 'manager%' then 'manager'::public.app_role
      when lower(coalesce(u.role, '')) in ('agent', 'provider') then 'agent'::public.app_role
      else 'subcontractor'::public.app_role
    end,
    true,
    now()
  from public.users u
  where u.id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  on conflict (organization_id, user_id)
  do update set
    app_role = excluded.app_role,
    is_primary = excluded.is_primary;
  `,
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const statement of SQL) {
      await client.query(statement);
    }
    console.log("B2B legacy DB bootstrap: complete");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("B2B legacy DB bootstrap failed:", error.message || error);
  process.exit(1);
});
