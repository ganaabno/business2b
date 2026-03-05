begin;

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'manager', 'subcontractor', 'agent');
  end if;

  if not exists (select 1 from pg_type where typname = 'seat_request_status') then
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

  if not exists (select 1 from pg_type where typname = 'payment_milestone_code') then
    create type public.payment_milestone_code as enum (
      'deposit_6h',
      'reconfirm_100k_if_gt_30d',
      'min_paid_30pct_at_21d',
      'min_paid_50pct_at_14d',
      'min_paid_100pct_at_10d'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'unpaid',
      'partial',
      'paid',
      'overdue',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

alter table public.users
  add column if not exists role_v2 public.app_role;

update public.users
set role_v2 = case lower(coalesce(role, ''))
  when 'user' then 'subcontractor'::public.app_role
  when 'provider' then 'agent'::public.app_role
  when 'manager' then 'manager'::public.app_role
  when 'admin' then 'admin'::public.app_role
  when 'superadmin' then 'admin'::public.app_role
  else 'subcontractor'::public.app_role
end
where role_v2 is null;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text not null unique,
  contact_name text,
  contact_phone text,
  contact_email text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  app_role public.app_role not null,
  is_primary boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_user_id
  on public.organization_members(user_id);

create index if not exists idx_organization_members_org_id
  on public.organization_members(organization_id);

create table if not exists public.organization_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  role_type public.app_role not null check (role_type in ('subcontractor', 'agent')),
  deposit_per_seat_mnt numeric(14, 2) not null default 50000,
  reconfirm_per_seat_mnt numeric(14, 2) not null default 100000,
  pct_due_21d numeric(6, 4) not null default 0.30,
  pct_due_14d numeric(6, 4) not null default 0.50,
  pct_due_10d numeric(6, 4) not null default 1.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seat_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  requester_user_id uuid not null references public.users(id),
  organization_id uuid not null references public.organizations(id),
  requester_role public.app_role not null check (requester_role in ('subcontractor', 'agent')),
  tour_id text not null,
  destination text not null,
  travel_date date not null,
  requested_seats integer not null check (requested_seats > 0),
  unit_price_mnt numeric(14, 2) not null check (unit_price_mnt >= 0),
  total_price_mnt numeric(14, 2) not null check (total_price_mnt >= 0),
  status public.seat_request_status not null default 'pending',
  approval_note text,
  rejection_reason text,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  rejected_by uuid references public.users(id),
  rejected_at timestamptz,
  deposit_due_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seat_requests_requester_date
  on public.seat_requests(requester_user_id, created_at desc);

create index if not exists idx_seat_requests_monitoring
  on public.seat_requests(destination, status, organization_id, created_at desc);

create index if not exists idx_seat_requests_tour_date
  on public.seat_requests(tour_id, travel_date);

create table if not exists public.seat_request_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  seat_request_id uuid not null references public.seat_requests(id) on delete cascade,
  code public.payment_milestone_code not null,
  due_at timestamptz not null,
  required_cumulative_mnt numeric(14, 2) not null check (required_cumulative_mnt >= 0),
  status public.payment_status not null default 'unpaid',
  satisfied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (seat_request_id, code)
);

create index if not exists idx_milestones_due
  on public.seat_request_payment_milestones(status, due_at);

create table if not exists public.seat_request_payments (
  id uuid primary key default gen_random_uuid(),
  seat_request_id uuid not null references public.seat_requests(id) on delete cascade,
  milestone_id uuid references public.seat_request_payment_milestones(id) on delete set null,
  amount_mnt numeric(14, 2) not null check (amount_mnt > 0),
  payment_method text not null,
  external_txn_id text,
  provider text,
  status public.payment_status not null,
  paid_at timestamptz,
  received_by uuid references public.users(id),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (external_txn_id, provider)
);

create index if not exists idx_seat_request_payments_request_id
  on public.seat_request_payments(seat_request_id, created_at desc);

create table if not exists public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_integration_outbox_pending
  on public.integration_outbox(status, next_retry_at, created_at);

create or replace function public.fn_make_request_no()
returns text
language sql
as $$
  select 'SR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 1000000))::text, 6, '0');
$$;

create or replace function public.fn_request_paid_total(p_request_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount_mnt), 0)
  from public.seat_request_payments
  where seat_request_id = p_request_id
    and status = 'paid';
$$;

create or replace function public.fn_sync_milestone_statuses(p_request_id uuid)
returns void
language plpgsql
as $$
declare
  v_paid numeric;
begin
  v_paid := public.fn_request_paid_total(p_request_id);

  update public.seat_request_payment_milestones m
  set
    status = case
      when v_paid >= m.required_cumulative_mnt then 'paid'::public.payment_status
      when now() > m.due_at then 'overdue'::public.payment_status
      when v_paid > 0 then 'partial'::public.payment_status
      else 'unpaid'::public.payment_status
    end,
    satisfied_at = case
      when v_paid >= m.required_cumulative_mnt and m.satisfied_at is null then now()
      when v_paid < m.required_cumulative_mnt then null
      else m.satisfied_at
    end
  where m.seat_request_id = p_request_id;

  if exists (
    select 1
    from public.seat_request_payment_milestones m
    where m.seat_request_id = p_request_id
      and m.code = 'deposit_6h'
      and m.status = 'paid'
  ) then
    update public.seat_requests
    set status = case
      when status = 'approved_waiting_deposit' then 'confirmed_deposit_paid'::public.seat_request_status
      else status
    end,
    updated_at = now()
    where id = p_request_id;
  end if;
end
$$;

create or replace function public.fn_generate_payment_milestones(p_request_id uuid)
returns void
language plpgsql
as $$
declare
  r public.seat_requests%rowtype;
  c public.organization_contracts%rowtype;
  v_deposit numeric(14, 2);
  v_reconfirm numeric(14, 2);
  v_req_21 numeric(14, 2);
  v_req_14 numeric(14, 2);
  v_req_10 numeric(14, 2);
begin
  select * into r
  from public.seat_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'seat_request not found: %', p_request_id;
  end if;

  select * into c
  from public.organization_contracts
  where organization_id = r.organization_id;

  if not found then
    v_deposit := r.requested_seats * 50000;
    v_reconfirm := case when r.travel_date > current_date + 30 then r.requested_seats * 100000 else 0 end;
    v_req_21 := greatest(v_deposit + v_reconfirm, round(r.total_price_mnt * 0.30, 2));
    v_req_14 := greatest(v_req_21, round(r.total_price_mnt * 0.50, 2));
    v_req_10 := round(r.total_price_mnt * 1.00, 2);
  else
    v_deposit := r.requested_seats * c.deposit_per_seat_mnt;
    v_reconfirm := case when r.travel_date > current_date + 30 then r.requested_seats * c.reconfirm_per_seat_mnt else 0 end;
    v_req_21 := greatest(v_deposit + v_reconfirm, round(r.total_price_mnt * c.pct_due_21d, 2));
    v_req_14 := greatest(v_req_21, round(r.total_price_mnt * c.pct_due_14d, 2));
    v_req_10 := round(r.total_price_mnt * c.pct_due_10d, 2);
  end if;

  delete from public.seat_request_payment_milestones where seat_request_id = p_request_id;

  insert into public.seat_request_payment_milestones (seat_request_id, code, due_at, required_cumulative_mnt)
  values
    (p_request_id, 'deposit_6h', r.deposit_due_at, v_deposit),
    (p_request_id, 'min_paid_30pct_at_21d', (r.travel_date::timestamptz - interval '21 day'), v_req_21),
    (p_request_id, 'min_paid_50pct_at_14d', (r.travel_date::timestamptz - interval '14 day'), v_req_14),
    (p_request_id, 'min_paid_100pct_at_10d', (r.travel_date::timestamptz - interval '10 day'), v_req_10);

  if v_reconfirm > 0 then
    insert into public.seat_request_payment_milestones (seat_request_id, code, due_at, required_cumulative_mnt)
    values (p_request_id, 'reconfirm_100k_if_gt_30d', (r.travel_date::timestamptz - interval '30 day'), v_deposit + v_reconfirm);
  end if;
end
$$;

create or replace function public.fn_can_convert_to_booking(p_request_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1 from public.seat_requests r
      where r.id = p_request_id
        and r.status in ('confirmed_deposit_paid', 'completed')
    )
    and not exists (
      select 1
      from public.seat_request_payment_milestones m
      where m.seat_request_id = p_request_id
        and m.due_at <= now()
        and m.status <> 'paid'
    );
$$;

create or replace view public.v_seat_request_monitoring as
select
  sr.id,
  sr.request_no,
  sr.requester_user_id,
  u.first_name,
  u.last_name,
  u.email,
  sr.requester_role,
  sr.organization_id,
  o.name as organization_name,
  sr.tour_id,
  sr.destination,
  sr.travel_date,
  sr.requested_seats,
  sr.status,
  sr.created_at,
  sr.deposit_due_at,
  public.fn_request_paid_total(sr.id) as paid_total_mnt,
  (
    select min(m.due_at)
    from public.seat_request_payment_milestones m
    where m.seat_request_id = sr.id
      and m.status <> 'paid'
  ) as next_deadline_at,
  (
    select m.status
    from public.seat_request_payment_milestones m
    where m.seat_request_id = sr.id
    order by m.due_at asc
    limit 1
  ) as current_payment_state
from public.seat_requests sr
join public.users u on u.id = sr.requester_user_id
join public.organizations o on o.id = sr.organization_id;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.seat_requests enable row level security;
alter table public.seat_request_payment_milestones enable row level security;
alter table public.seat_request_payments enable row level security;

drop policy if exists org_read_own_or_admin on public.organizations;
create policy org_read_own_or_admin
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and u.role_v2 in ('admin', 'manager')
  )
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()::uuid
  )
);

drop policy if exists seat_requests_read_policy on public.seat_requests;
create policy seat_requests_read_policy
on public.seat_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()::uuid
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and u.role_v2 in ('admin', 'manager')
  )
);

drop policy if exists seat_requests_insert_policy on public.seat_requests;
create policy seat_requests_insert_policy
on public.seat_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()::uuid
);

grant select, insert, update on public.organizations to authenticated, service_role;
grant select, insert, update on public.organization_members to authenticated, service_role;
grant select, insert, update on public.seat_requests to authenticated, service_role;
grant select, insert, update on public.seat_request_payment_milestones to authenticated, service_role;
grant select, insert, update on public.seat_request_payments to authenticated, service_role;
grant select, insert, update on public.integration_outbox to service_role;
grant select on public.v_seat_request_monitoring to authenticated, service_role;

grant execute on function public.fn_make_request_no() to authenticated, service_role;
grant execute on function public.fn_request_paid_total(uuid) to authenticated, service_role;
grant execute on function public.fn_sync_milestone_statuses(uuid) to service_role;
grant execute on function public.fn_generate_payment_milestones(uuid) to service_role;
grant execute on function public.fn_can_convert_to_booking(uuid) to authenticated, service_role;

commit;
