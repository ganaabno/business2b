begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seat_access_request_status') then
    create type public.seat_access_request_status as enum (
      'pending',
      'approved',
      'rejected',
      'consumed',
      'expired'
    );
  end if;
end
$$;

create table if not exists public.seat_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_role public.app_role not null check (requester_role in ('subcontractor', 'agent')),
  from_date date not null,
  to_date date not null,
  destination text not null,
  note text,
  status public.seat_access_request_status not null default 'pending',
  decision_reason text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  seat_request_id uuid references public.seat_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seat_access_requests_date_window check (from_date <= to_date)
);

create index if not exists idx_seat_access_requests_user_created
  on public.seat_access_requests(requester_user_id, created_at desc);

create index if not exists idx_seat_access_requests_status_created
  on public.seat_access_requests(status, created_at desc);

create index if not exists idx_seat_access_requests_destination_window
  on public.seat_access_requests(destination, from_date, to_date, status);

create unique index if not exists seat_access_requests_pending_unique
  on public.seat_access_requests(requester_user_id, from_date, to_date, lower(destination))
  where status = 'pending';

alter table public.seat_requests
  add column if not exists access_request_id uuid references public.seat_access_requests(id) on delete set null;

create unique index if not exists seat_requests_access_request_uidx
  on public.seat_requests(access_request_id)
  where access_request_id is not null;

alter table public.seat_access_requests enable row level security;

drop policy if exists seat_access_requests_read_policy on public.seat_access_requests;
create policy seat_access_requests_read_policy
on public.seat_access_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()::uuid
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists seat_access_requests_insert_policy on public.seat_access_requests;
create policy seat_access_requests_insert_policy
on public.seat_access_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()::uuid
  and requester_role in ('subcontractor', 'agent')
  and status = 'pending'
);

drop policy if exists seat_access_requests_update_policy on public.seat_access_requests;
create policy seat_access_requests_update_policy
on public.seat_access_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists seat_access_requests_service_policy on public.seat_access_requests;
create policy seat_access_requests_service_policy
on public.seat_access_requests
for all
to service_role
using (true)
with check (true);

grant select, insert, update on public.seat_access_requests to authenticated, service_role;

create table if not exists public.agent_point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  seat_request_id uuid not null references public.seat_requests(id) on delete cascade,
  points integer not null check (points > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (seat_request_id, reason)
);

create index if not exists idx_agent_point_ledger_user_created
  on public.agent_point_ledger(user_id, created_at desc);

alter table public.agent_point_ledger enable row level security;

drop policy if exists agent_point_ledger_read_policy on public.agent_point_ledger;
create policy agent_point_ledger_read_policy
on public.agent_point_ledger
for select
to authenticated
using (
  user_id = auth.uid()::uuid
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists agent_point_ledger_service_policy on public.agent_point_ledger;
create policy agent_point_ledger_service_policy
on public.agent_point_ledger
for all
to service_role
using (true)
with check (true);

grant select on public.agent_point_ledger to authenticated, service_role;
grant insert on public.agent_point_ledger to service_role;

commit;
