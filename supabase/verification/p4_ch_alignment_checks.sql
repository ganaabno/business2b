-- CH-aligned checks: binding workflow, group policy, ticketing lock

-- 1) Organization merchant code health
select count(*) as merchant_code_missing
from public.organizations
where merchant_code is null
   or btrim(merchant_code) = '';

select merchant_code, count(*) as duplicate_count
from public.organizations
group by merchant_code
having count(*) > 1;

-- 2) Binding request lifecycle distribution
select status::text, count(*) as rows
from public.organization_binding_requests
group by status
order by status;

-- 3) Duplicate pending binding requests should be zero
select user_id::text, merchant_code, requested_role::text, count(*) as duplicate_count
from public.organization_binding_requests
where status = 'pending'
group by user_id, merchant_code, requested_role
having count(*) > 1;

-- 4) Group policy contract validity
select count(*) as invalid_group_policy_ranges
from public.organization_contracts
where group_min_pax < 1
   or group_max_pax < group_min_pax;

select count(*) as invalid_group_policy_mode
from public.organization_contracts
where group_policy_mode not in ('off', 'validate_only', 'enforce');

-- 5) Ticketing lock trigger inventory
select
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  t.tgenabled as trigger_enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'passengers'
  and t.tgname = 'trg_passenger_ticketing_lock'
  and not t.tgisinternal;

-- 6) Binding table RLS/policy inventory
select relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname = 'organization_binding_requests';

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'organization_binding_requests'
order by policyname;

-- 7) Seat access request lifecycle
select status::text, count(*) as rows
from public.seat_access_requests
group by status
order by status;

-- 8) Duplicate pending seat access requests should be zero
select requester_user_id::text, from_date, to_date, lower(destination) as destination_key, count(*) as duplicate_count
from public.seat_access_requests
where status = 'pending'
group by requester_user_id, from_date, to_date, lower(destination)
having count(*) > 1;

-- 9) Access-request to seat-request link integrity
select count(*) as consumed_without_seat_request
from public.seat_access_requests
where status = 'consumed'
  and seat_request_id is null;

select count(*) as seat_request_with_missing_access
from public.seat_requests sr
where sr.access_request_id is not null
  and not exists (
    select 1
    from public.seat_access_requests sar
    where sar.id = sr.access_request_id
  );

-- 10) Agent points ledger integrity
select reason, count(*) as rows
from public.agent_point_ledger
group by reason
order by reason;

select seat_request_id::text, reason, count(*) as duplicate_count
from public.agent_point_ledger
group by seat_request_id, reason
having count(*) > 1;

-- 11) Seat access / points table policy inventory
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('seat_access_requests', 'agent_point_ledger')
order by relname;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('seat_access_requests', 'agent_point_ledger')
order by tablename, policyname;
