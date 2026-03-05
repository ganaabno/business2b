begin;

grant select on table public.pending_users to authenticated, service_role;

drop policy if exists pending_users_admin_manager_read on public.pending_users;
create policy pending_users_admin_manager_read
on public.pending_users
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()::uuid
      and coalesce(to_jsonb(u)->>'role_v2', lower(u.role), 'subcontractor') in (
        'admin',
        'manager',
        'superadmin'
      )
  )
);

commit;
