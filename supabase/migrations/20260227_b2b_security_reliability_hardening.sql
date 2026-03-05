begin;

-- =============================================
-- B2B security/reliability hardening (P1-P3 fixpack)
-- =============================================

create sequence if not exists public.seat_request_no_seq;

create or replace function public.fn_make_request_no()
returns text
language sql
security definer
set search_path = public
as $$
  select 'SR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.seat_request_no_seq')::text, 8, '0');
$$;

revoke all on function public.fn_make_request_no() from public;
grant execute on function public.fn_make_request_no() to authenticated, service_role;

grant usage, select on sequence public.seat_request_no_seq to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_role_allowed'
      and conrelid = 'public.organization_members'::regclass
  ) then
    alter table public.organization_members
      add constraint organization_members_role_allowed
      check (app_role in ('admin', 'manager', 'subcontractor', 'agent')) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_contracts_pct_order'
      and conrelid = 'public.organization_contracts'::regclass
  ) then
    alter table public.organization_contracts
      add constraint organization_contracts_pct_order
      check (pct_due_21d <= pct_due_14d and pct_due_14d <= pct_due_10d) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seat_requests_total_consistency'
      and conrelid = 'public.seat_requests'::regclass
  ) then
    alter table public.seat_requests
      add constraint seat_requests_total_consistency
      check (round(unit_price_mnt * requested_seats, 2) <= total_price_mnt) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_outbox_status_allowed'
      and conrelid = 'public.integration_outbox'::regclass
  ) then
    alter table public.integration_outbox
      add constraint integration_outbox_status_allowed
      check (status in ('pending', 'processing', 'processed', 'dead_letter')) not valid;
  end if;
end
$$;

alter table public.organization_members validate constraint organization_members_role_allowed;
alter table public.organization_contracts validate constraint organization_contracts_pct_order;
alter table public.seat_requests validate constraint seat_requests_total_consistency;
alter table public.integration_outbox validate constraint integration_outbox_status_allowed;

create index if not exists idx_users_role_v2 on public.users(role_v2);
create index if not exists idx_seat_requests_status_due on public.seat_requests(status, deposit_due_at);
create index if not exists idx_outbox_status_created on public.integration_outbox(status, created_at);
create index if not exists idx_milestones_request_status_due
  on public.seat_request_payment_milestones(seat_request_id, status, due_at);
create index if not exists idx_payments_request_status_created
  on public.seat_request_payments(seat_request_id, status, created_at desc);

alter table public.organizations enable row level security;
alter table public.seat_requests enable row level security;
alter table public.seat_request_payment_milestones enable row level security;
alter table public.seat_request_payments enable row level security;
alter table public.integration_outbox enable row level security;

create or replace function public.fn_is_org_member(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = p_user_id
  );
$$;

revoke all on function public.fn_is_org_member(uuid, uuid) from public;
grant execute on function public.fn_is_org_member(uuid, uuid) to authenticated, service_role;

drop policy if exists org_read_own_or_admin on public.organizations;
create policy org_read_own_or_admin
on public.organizations
for select
to authenticated
using (
  public.fn_is_org_member(organizations.id, auth.uid()::uuid)
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists org_insert_policy on public.organizations;
create policy org_insert_policy
on public.organizations
for insert
to authenticated
with check (
  created_by = auth.uid()::uuid
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager', 'subcontractor', 'agent')
  )
);

drop policy if exists org_update_policy on public.organizations;
create policy org_update_policy
on public.organizations
for update
to authenticated
using (
  created_by = auth.uid()::uuid
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
)
with check (
  created_by = auth.uid()::uuid
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists org_members_read_policy on public.organization_members;
create policy org_members_read_policy
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()::uuid
  or public.fn_is_org_member(organization_members.organization_id, auth.uid()::uuid)
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists org_members_insert_policy on public.organization_members;
create policy org_members_insert_policy
on public.organization_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
  or exists (
    select 1
    from public.organizations o
    where o.id = organization_members.organization_id
      and o.created_by = auth.uid()::uuid
  )
);

drop policy if exists org_members_update_policy on public.organization_members;
create policy org_members_update_policy
on public.organization_members
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
  or exists (
    select 1
    from public.organizations o
    where o.id = organization_members.organization_id
      and o.created_by = auth.uid()::uuid
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
  or exists (
    select 1
    from public.organizations o
    where o.id = organization_members.organization_id
      and o.created_by = auth.uid()::uuid
  )
);

drop policy if exists seat_requests_update_policy on public.seat_requests;
create policy seat_requests_update_policy
on public.seat_requests
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

drop policy if exists milestones_read_policy on public.seat_request_payment_milestones;
create policy milestones_read_policy
on public.seat_request_payment_milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.seat_requests sr
    where sr.id = seat_request_payment_milestones.seat_request_id
      and (
        sr.requester_user_id = auth.uid()::uuid
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()::uuid
            and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
        )
      )
  )
);

drop policy if exists seat_payments_read_policy on public.seat_request_payments;
create policy seat_payments_read_policy
on public.seat_request_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.seat_requests sr
    where sr.id = seat_request_payments.seat_request_id
      and (
        sr.requester_user_id = auth.uid()::uuid
        or exists (
          select 1
          from public.users u
          where u.id = auth.uid()::uuid
            and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
        )
      )
  )
);

drop policy if exists seat_requests_service_write on public.seat_requests;
create policy seat_requests_service_write
on public.seat_requests
for all
to service_role
using (true)
with check (true);

drop policy if exists milestones_service_write on public.seat_request_payment_milestones;
create policy milestones_service_write
on public.seat_request_payment_milestones
for all
to service_role
using (true)
with check (true);

drop policy if exists seat_payments_service_write on public.seat_request_payments;
create policy seat_payments_service_write
on public.seat_request_payments
for all
to service_role
using (true)
with check (true);

drop policy if exists outbox_service_write on public.integration_outbox;
create policy outbox_service_write
on public.integration_outbox
for all
to service_role
using (true)
with check (true);

drop policy if exists outbox_backend_write on public.integration_outbox;
create policy outbox_backend_write
on public.integration_outbox
for all
to public
using (true)
with check (true);

commit;
