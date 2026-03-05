begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'binding_request_status') then
    create type public.binding_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

alter table public.organizations
  add column if not exists merchant_code text;

update public.organizations
set merchant_code = 'MRC-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where merchant_code is null
   or btrim(merchant_code) = '';

alter table public.organizations
  alter column merchant_code set not null;

create unique index if not exists organizations_merchant_code_uidx
  on public.organizations (merchant_code);

create or replace function public.fn_set_organization_merchant_code()
returns trigger
language plpgsql
as $$
begin
  if new.merchant_code is null or btrim(new.merchant_code) = '' then
    new.merchant_code := 'MRC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  else
    new.merchant_code := upper(new.merchant_code);
  end if;
  return new;
end
$$;

drop trigger if exists trg_set_organization_merchant_code on public.organizations;
create trigger trg_set_organization_merchant_code
before insert on public.organizations
for each row
execute function public.fn_set_organization_merchant_code();

create table if not exists public.organization_binding_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  merchant_code text not null,
  requested_role public.app_role not null check (requested_role in ('subcontractor', 'agent')),
  status public.binding_request_status not null default 'pending',
  note text,
  decision_reason text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_binding_requests_user_created
  on public.organization_binding_requests(user_id, created_at desc);

create index if not exists idx_org_binding_requests_status_created
  on public.organization_binding_requests(status, created_at desc);

create index if not exists idx_org_binding_requests_org_status
  on public.organization_binding_requests(organization_id, status, created_at desc);

create unique index if not exists org_binding_requests_pending_unique
  on public.organization_binding_requests(user_id, merchant_code, requested_role)
  where status = 'pending';

alter table public.organization_contracts
  add column if not exists group_min_pax integer not null default 10;

alter table public.organization_contracts
  add column if not exists group_max_pax integer not null default 30;

alter table public.organization_contracts
  add column if not exists group_policy_mode text not null default 'off';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_contracts_group_pax_range'
      and conrelid = 'public.organization_contracts'::regclass
  ) then
    alter table public.organization_contracts
      add constraint organization_contracts_group_pax_range
      check (group_min_pax >= 1 and group_max_pax >= group_min_pax) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_contracts_group_policy_mode_allowed'
      and conrelid = 'public.organization_contracts'::regclass
  ) then
    alter table public.organization_contracts
      add constraint organization_contracts_group_policy_mode_allowed
      check (group_policy_mode in ('off', 'validate_only', 'enforce')) not valid;
  end if;
end
$$;

alter table public.organization_contracts validate constraint organization_contracts_group_pax_range;
alter table public.organization_contracts validate constraint organization_contracts_group_policy_mode_allowed;

alter table public.organization_binding_requests enable row level security;

drop policy if exists binding_requests_read_policy on public.organization_binding_requests;
create policy binding_requests_read_policy
on public.organization_binding_requests
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

drop policy if exists binding_requests_insert_policy on public.organization_binding_requests;
create policy binding_requests_insert_policy
on public.organization_binding_requests
for insert
to authenticated
with check (
  user_id = auth.uid()::uuid
  and requested_role in ('subcontractor', 'agent')
  and status = 'pending'
);

drop policy if exists binding_requests_update_policy on public.organization_binding_requests;
create policy binding_requests_update_policy
on public.organization_binding_requests
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

drop policy if exists binding_requests_service_write on public.organization_binding_requests;
create policy binding_requests_service_write
on public.organization_binding_requests
for all
to service_role
using (true)
with check (true);

grant select, insert, update on public.organization_binding_requests to authenticated, service_role;

create or replace function public.fn_passenger_ticketing_lock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(old.itinerary_status, 'No itinerary') in ('With itinerary', 'Hotel + itinerary', 'Roundway ticket') then
    if
      new.order_id is distinct from old.order_id
      or new.user_id is distinct from old.user_id
      or new.tour_id is distinct from old.tour_id
      or new.tour_title is distinct from old.tour_title
      or new.departure_date is distinct from old.departure_date
      or new.name is distinct from old.name
      or new.room_allocation is distinct from old.room_allocation
      or new.serial_no is distinct from old.serial_no
      or new.passenger_number is distinct from old.passenger_number
      or new.last_name is distinct from old.last_name
      or new.first_name is distinct from old.first_name
      or new.date_of_birth is distinct from old.date_of_birth
      or new.age is distinct from old.age
      or new.gender is distinct from old.gender
      or new.passport_number is distinct from old.passport_number
      or new.passport_expire is distinct from old.passport_expire
      or new.nationality is distinct from old.nationality
      or new."roomType" is distinct from old."roomType"
      or new.hotel is distinct from old.hotel
      or new.additional_services is distinct from old.additional_services
      or new.price is distinct from old.price
      or new.email is distinct from old.email
      or new.phone is distinct from old.phone
      or new.passport_upload is distinct from old.passport_upload
      or new.allergy is distinct from old.allergy
      or new.emergency_phone is distinct from old.emergency_phone
      or new.notes is distinct from old.notes
      or new.seat_count is distinct from old.seat_count
      or new.main_passenger_id is distinct from old.main_passenger_id
      or new.sub_passenger_count is distinct from old.sub_passenger_count
      or new.has_sub_passengers is distinct from old.has_sub_passengers
      or new.itinerary_status is distinct from old.itinerary_status
      or new.pax_type is distinct from old.pax_type
      or new.group_color is distinct from old.group_color
    then
      raise exception 'Passenger is locked after ticketing and cannot be edited'
        using errcode = '55000';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_passenger_ticketing_lock on public.passengers;
create trigger trg_passenger_ticketing_lock
before update on public.passengers
for each row
execute function public.fn_passenger_ticketing_lock();

commit;
