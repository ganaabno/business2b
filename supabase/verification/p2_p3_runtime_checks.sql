-- Runtime checks for P2/P3 reliability

-- 1) Outbox status distribution
select status, count(*) as rows
from public.integration_outbox
group by status
order by status;

-- 2) Dead-letter backlog
select count(*) as dead_letter_rows
from public.integration_outbox
where status = 'dead_letter';

-- 3) Stuck processing rows (>15m)
select count(*) as processing_stuck_rows
from public.integration_outbox
where status = 'processing'
  and next_retry_at < now() - interval '15 minutes';

-- 4) Seat request status health
select status::text, count(*) as rows
from public.seat_requests
group by status
order by status;

-- 5) Overdue unpaid milestones (booking block pressure)
select count(*) as overdue_unpaid_milestones
from public.seat_request_payment_milestones
where due_at <= now()
  and status <> 'paid';

-- 6) Webhook idempotency safety (duplicates should be 0)
select provider, external_txn_id, count(*) as duplicate_count
from public.seat_request_payments
where external_txn_id is not null
group by provider, external_txn_id
having count(*) > 1;

-- 7) Pending binding requests older than 24h
select count(*) as stale_pending_binding_requests
from public.organization_binding_requests
where status = 'pending'
  and created_at < now() - interval '24 hours';

-- 8) Group policy contracts currently in enforce mode
select count(*) as enforce_mode_contracts
from public.organization_contracts
where group_policy_mode = 'enforce';
