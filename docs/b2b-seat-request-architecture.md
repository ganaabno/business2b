# Gtrip B2B Seat Request Architecture

This implementation introduces a production-safe seat request and staged payment workflow for Gtrip while keeping Supabase as the primary write source.

## What was added

- Supabase migrations:
  - `supabase/migrations/20260226_b2b_roles_seat_requests.sql`
  - `supabase/migrations/20260227_b2b_security_reliability_hardening.sql`
  - `supabase/migrations/20260227_shared_booking_locking_patch.sql`
  - `supabase/migrations/20260228_b2b_ch_alignment_bindings_group_policy_ticket_lock.sql`
  - `supabase/migrations/20260229_b2b_access_request_agent_points.sql`
- Backend API: `backend/src/**`
- Runtime jobs:
  - Deadline processor (auto-cancel and milestone refresh)
  - Outbox relay (Neon sync integration point)

## Role model

- `admin`
- `manager`
- `subcontractor` (mapped from legacy `user`)
- `agent` (mapped from legacy `provider`)

The migration adds `users.role_v2` and backfills values from old roles.

## Core database entities

- `organizations`
- `organization_binding_requests`
- `seat_access_requests`
- `organization_members`
- `organization_contracts`
- `seat_requests`
- `seat_request_payment_milestones`
- `seat_request_payments`
- `agent_point_ledger`
- `integration_outbox`
- `v_seat_request_monitoring` (view)

## One-approval access flow (SubContractor/Agent)

1. SubContractor/Agent submits `seat_access_request` with `from_date`, `to_date`, `destination`.
2. Manager/Admin approves or rejects that request.
3. If approved, SubContractor/Agent selects a matching tour + departure date + seat count.
4. System validates available seats and creates seat request in `approved_waiting_deposit` immediately.
5. 6-hour deposit timer starts instantly (`deposit_due_at = now() + 6 hours`).

No second manager approval is required for the exact tour/seat selection.

## Payment milestones

Milestone generation is done by `public.fn_generate_payment_milestones(uuid)`.

- Deposit: `50,000 MNT * seats` due in 6 hours after approval
- Reconfirm (if travel date > 30 days): `100,000 MNT * seats`
- 21 days before departure: minimum cumulative paid >= `30%` of total
- 14 days before departure: minimum cumulative paid >= `50%` of total
- 10 days before departure: minimum cumulative paid >= `100%` of total

Milestones are cumulative and evaluated by `public.fn_sync_milestone_statuses(uuid)`.

## API surface

All authenticated APIs are under `/api/v1`.

- Organizations
  - `POST /api/v1/organizations`
  - `GET /api/v1/organizations/:id`
  - `POST /api/v1/organizations/:id/members`
- Binding Requests
  - `POST /api/v1/binding-requests`
  - `GET /api/v1/binding-requests`
  - `POST /api/v1/binding-requests/:id/approve`
  - `POST /api/v1/binding-requests/:id/reject`
- Seat Access Requests
  - `POST /api/v1/seat-access-requests`
  - `GET /api/v1/seat-access-requests`
  - `POST /api/v1/seat-access-requests/:id/approve`
  - `POST /api/v1/seat-access-requests/:id/reject`
  - `POST /api/v1/seat-access-requests/:id/select-tour`
- Seat Requests
  - `POST /api/v1/seat-requests`
  - `GET /api/v1/seat-requests`
  - `GET /api/v1/seat-requests/:id`
  - `POST /api/v1/seat-requests/:id/approve`
  - `POST /api/v1/seat-requests/:id/reject`
  - `POST /api/v1/seat-requests/:id/cancel`
- Payments
  - `POST /api/v1/payments/seat-requests/:id/deposit-intent`
  - `GET /api/v1/payments/seat-requests/:id/history`
  - `POST /api/v1/payments/webhooks/:provider` (no auth middleware, provider allowlist + signature required)
- Tours
  - `GET /api/v1/tours/search?from=YYYY-MM-DD&to=YYYY-MM-DD&destination=&minSeats=&minPrice=&maxPrice=`
- Monitoring
  - `GET /api/v1/monitoring/seat-requests`
- Profile
  - `GET /api/v1/me/profile`

## Running backend locally

Add env vars:

- `PORT`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `QPAY_WEBHOOK_SECRET`
- `OUTBOX_MAX_RETRIES`
- `B2B_GROUP_POLICY_ENABLED`
- `B2B_GROUP_POLICY_ENFORCE`

Feature flags (P0 safe defaults):

- `B2B_ROLE_V2_ENABLED=false`
- `B2B_SEAT_REQUEST_FLOW_ENABLED=false`
- `B2B_MONITORING_ENABLED=false`
- `B2B_GROUP_POLICY_ENABLED=false`
- `B2B_GROUP_POLICY_ENFORCE=false`

Run:

- `npm run api:dev`
- `npm run api:build`
- `npm run api:start`

## Deployment sequence

1. Apply migration in Supabase SQL editor.
2. Deploy API service with all B2B flags OFF.
3. Enable webhook integrations for payment providers.
4. Enable `B2B_ROLE_V2_ENABLED` first, validate organization/profile reads.
5. Enable `B2B_SEAT_REQUEST_FLOW_ENABLED`, validate request/payment flows.
6. Enable `B2B_MONITORING_ENABLED` last for manager/admin dashboard.
7. Enable `B2B_GROUP_POLICY_ENABLED` with `B2B_GROUP_POLICY_ENFORCE=false` (validation-only).
8. After one clean release cycle, enable `B2B_GROUP_POLICY_ENFORCE=true`.
9. Switch frontend to call API routes for new seat request flows.
10. After full cutover, deprecate legacy role usage.
