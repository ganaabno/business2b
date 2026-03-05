-- Read-only verification checks for P1 rollout
-- Safe to run repeatedly in staging/production

-- 1) Role backfill counts
select
  lower(coalesce(role, 'null')) as legacy_role,
  coalesce(role_v2::text, 'null') as role_v2,
  count(*) as users_count
from public.users
group by 1, 2
order by 1, 2;

-- 2) Expected mappings that should be zero mismatches
select count(*) as mismatch_user_to_subcontractor
from public.users
where lower(coalesce(role, '')) = 'user'
  and role_v2 is distinct from 'subcontractor'::public.app_role;

select count(*) as mismatch_provider_to_agent
from public.users
where lower(coalesce(role, '')) = 'provider'
  and role_v2 is distinct from 'agent'::public.app_role;

select count(*) as mismatch_superadmin_to_admin
from public.users
where lower(coalesce(role, '')) = 'superadmin'
  and role_v2 is distinct from 'admin'::public.app_role;

-- 3) Orphan checks (must be 0)
select count(*) as org_members_orphan_user
from public.organization_members om
left join public.users u on u.id = om.user_id
where u.id is null;

select count(*) as org_members_orphan_org
from public.organization_members om
left join public.organizations o on o.id = om.organization_id
where o.id is null;

select count(*) as seat_requests_orphan_requester
from public.seat_requests sr
left join public.users u on u.id = sr.requester_user_id
where u.id is null;

select count(*) as seat_requests_orphan_org
from public.seat_requests sr
left join public.organizations o on o.id = sr.organization_id
where o.id is null;

select count(*) as milestones_orphan_request
from public.seat_request_payment_milestones m
left join public.seat_requests sr on sr.id = m.seat_request_id
where sr.id is null;

select count(*) as payments_orphan_request
from public.seat_request_payments p
left join public.seat_requests sr on sr.id = p.seat_request_id
where sr.id is null;

select count(*) as binding_requests_orphan_user
from public.organization_binding_requests br
left join public.users u on u.id = br.user_id
where u.id is null;

select count(*) as binding_requests_orphan_org
from public.organization_binding_requests br
left join public.organizations o on o.id = br.organization_id
where br.organization_id is not null
  and o.id is null;

-- 4) Duplicate memberships (must be 0)
select organization_id, user_id, count(*) as dup_count
from public.organization_members
group by 1, 2
having count(*) > 1;

select merchant_code, count(*) as dup_count
from public.organizations
group by 1
having count(*) > 1;

-- 5) Enum validity checks (must be 0 invalid)
select count(*) as invalid_request_status
from public.seat_requests
where status::text not in (
  'pending',
  'rejected',
  'approved_waiting_deposit',
  'confirmed_deposit_paid',
  'cancelled_expired',
  'cancelled_by_admin',
  'cancelled_by_requester',
  'completed'
);

select count(*) as invalid_payment_status_milestones
from public.seat_request_payment_milestones
where status::text not in ('unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'refunded');

select count(*) as invalid_payment_status_payments
from public.seat_request_payments
where status::text not in ('unpaid', 'partial', 'paid', 'overdue', 'cancelled', 'refunded');

select count(*) as invalid_binding_request_status
from public.organization_binding_requests
where status::text not in ('pending', 'approved', 'rejected');

-- 6) Business consistency checks
select count(*) as invalid_total_price_consistency
from public.seat_requests
where round(unit_price_mnt * requested_seats, 2) > total_price_mnt;

select count(*) as invalid_milestone_ordering
from public.organization_contracts
where not (pct_due_21d <= pct_due_14d and pct_due_14d <= pct_due_10d);

select count(*) as invalid_group_pax_ranges
from public.organization_contracts
where not (group_min_pax >= 1 and group_max_pax >= group_min_pax);

select count(*) as invalid_group_policy_mode
from public.organization_contracts
where group_policy_mode not in ('off', 'validate_only', 'enforce');

select count(*) as null_merchant_code_count
from public.organizations
where merchant_code is null
   or btrim(merchant_code) = '';

-- 7) RLS state checks
select
  relname as table_name,
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'organizations',
    'organization_members',
     'seat_requests',
     'seat_request_payment_milestones',
     'seat_request_payments',
     'integration_outbox',
     'organization_binding_requests'
   )
order by relname;

-- 8) Required policies inventory
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'organizations',
    'organization_members',
     'seat_requests',
     'seat_request_payment_milestones',
     'seat_request_payments',
     'integration_outbox',
     'organization_binding_requests'
   )
order by tablename, policyname;
