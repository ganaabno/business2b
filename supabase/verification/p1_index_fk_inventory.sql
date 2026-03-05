-- Read-only schema inventory checks for P1

-- 1) Required FK inventory
select
  tc.table_name,
  tc.constraint_name,
  ccu.table_name as referenced_table,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as fk_columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in (
    'organizations',
    'organization_members',
    'organization_contracts',
    'seat_requests',
    'seat_request_payment_milestones',
    'seat_request_payments',
    'integration_outbox',
    'organization_binding_requests'
  )
group by 1, 2, 3
order by 1, 2;

-- 2) Unique constraints inventory
select
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as unique_columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
  and tc.table_schema = 'public'
  and tc.table_name in (
    'organizations',
    'organization_members',
    'organization_contracts',
    'seat_requests',
    'seat_request_payment_milestones',
    'seat_request_payments',
    'integration_outbox',
    'organization_binding_requests'
  )
group by 1, 2
order by 1, 2;

-- 3) Index inventory
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'users',
    'organizations',
    'organization_members',
    'organization_contracts',
    'seat_requests',
    'seat_request_payment_milestones',
    'seat_request_payments',
    'integration_outbox',
    'organization_binding_requests'
  )
order by tablename, indexname;
