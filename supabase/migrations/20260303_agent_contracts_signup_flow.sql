begin;

create table if not exists public.agent_contract_versions (
  id uuid primary key default gen_random_uuid(),
  version_no integer not null,
  title text not null,
  body_markdown text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_active boolean not null default false,
  file_path text,
  file_url text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_no)
);

create index if not exists idx_agent_contract_versions_active
  on public.agent_contract_versions(is_active, status, created_at desc);

create index if not exists idx_agent_contract_versions_status
  on public.agent_contract_versions(status, created_at desc);

alter table public.pending_users
  add column if not exists contract_version_id uuid references public.agent_contract_versions(id) on delete set null,
  add column if not exists contract_accepted_at timestamptz,
  add column if not exists contract_signed_name text,
  add column if not exists contract_denied_at timestamptz;

alter table public.pending_users
  drop constraint if exists pending_users_role_requested_check;

alter table public.pending_users
  add constraint pending_users_role_requested_check
  check (role_requested in ('user', 'manager', 'provider', 'agent'));

alter table public.agent_contract_versions enable row level security;

drop policy if exists agent_contract_versions_public_active_read on public.agent_contract_versions;
create policy agent_contract_versions_public_active_read
on public.agent_contract_versions
for select
to anon, authenticated
using (status = 'published' and is_active = true);

drop policy if exists agent_contract_versions_manager_read_all on public.agent_contract_versions;
create policy agent_contract_versions_manager_read_all
on public.agent_contract_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists agent_contract_versions_manager_write on public.agent_contract_versions;
create policy agent_contract_versions_manager_write
on public.agent_contract_versions
for all
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

drop policy if exists agent_contract_versions_service_role_all on public.agent_contract_versions;
create policy agent_contract_versions_service_role_all
on public.agent_contract_versions
for all
to service_role
using (true)
with check (true);

grant select on public.agent_contract_versions to anon, authenticated, service_role;
grant insert, update, delete on public.agent_contract_versions to authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('agent-contracts', 'agent-contracts', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "agent_contracts_public_read" on storage.objects;
create policy "agent_contracts_public_read"
on storage.objects
for select
to public
using (bucket_id = 'agent-contracts');

drop policy if exists "agent_contracts_manager_insert" on storage.objects;
create policy "agent_contracts_manager_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agent-contracts'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists "agent_contracts_manager_update" on storage.objects;
create policy "agent_contracts_manager_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'agent-contracts'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
)
with check (
  bucket_id = 'agent-contracts'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

drop policy if exists "agent_contracts_manager_delete" on storage.objects;
create policy "agent_contracts_manager_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agent-contracts'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(u.role_v2::text, lower(u.role), 'subcontractor') in ('admin', 'manager')
  )
);

commit;
