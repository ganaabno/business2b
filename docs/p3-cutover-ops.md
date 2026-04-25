# P3 Frontend Cutover + Admin Ops

## Cohort rollout order

1. Internal managers (monitoring only)
2. Selected partner organizations (SubContractor + Agent seat requests)
3. Full rollout

## Flag plan per release

- Release A:
  - `B2B_MONITORING_ENABLED=true`
  - `B2B_ROLE_V2_ENABLED=false`
  - `B2B_SEAT_REQUEST_FLOW_ENABLED=false`
- Release B:
  - `B2B_ROLE_V2_ENABLED=true`
  - `B2B_MONITORING_ENABLED=true`
  - `B2B_SEAT_REQUEST_FLOW_ENABLED=false`
- Release C:
  - `B2B_SEAT_REQUEST_FLOW_ENABLED=true`
  - `B2B_ROLE_V2_ENABLED=true`
  - `B2B_MONITORING_ENABLED=true`
- Release D (group policy validate-only):
  - `B2B_GROUP_POLICY_ENABLED=true`
  - `B2B_GROUP_POLICY_ENFORCE=false`
- Release E (group policy enforce):
  - `B2B_GROUP_POLICY_ENABLED=true`
  - `B2B_GROUP_POLICY_ENFORCE=true`

Rollback is always flag-first (no schema rollback).

## Webhook security controls

- Only allowlisted payment providers are accepted (currently: `qpay`).
- Unknown providers are rejected.
- Signature verification uses raw request body (`x-qpay-signature`).
- Keep `QPAY_WEBHOOK_SECRET` set before enabling `B2B_SEAT_REQUEST_FLOW_ENABLED=true`.

## New frontend screens

- `/subcontractor` -> B2B seat request workspace
- `/agent` -> B2B seat request workspace
- `/b2b-monitoring` -> admin/manager monitoring table with filters + binding approvals

Updated behavior:

- SubContractor/Agent first submits date-range + destination access request.
- Manager/Admin performs one approval (or rejection).
- Approved request unlocks tour selection and seat purchase request.
- 6h deposit timer starts immediately after tour/seat selection.

Legacy `/user` and `/provider` remain intact for compatibility.

## Cross-cutting controls

- Audit logs emitted:
  - `audit.seat_request.created`
  - `audit.seat_request.approved`
  - `audit.seat_request.rejected`
  - `audit.seat_request.cancelled`
  - `audit.binding_request.submitted`
  - `audit.binding_request.approved`
  - `audit.binding_request.rejected`
  - `slo.payment_webhook.success`
- SLO metrics emitted in logs:
  - approval latency (`audit.seat_request.approved.approvalLatencyMs`)
  - webhook success (`slo.payment_webhook.success`)
  - deadline execution lag (`slo.deadline_job.run.lagMs`)
  - booking block violations (`slo.deadline_job.run.bookingBlockViolations`)

## Stability rules

- Keep `users.role` legacy compatibility logic during rollout.
- Never drop legacy columns/policies until two clean release cycles of metrics.
- If errors spike, disable newest flag first and re-check SLO logs.
