# Strict Seat Access Rollout Plan

## Objective

Align sub/agent booking flow to strict policy:

- Sub/agent can submit passengers only after seat request is `confirmed_deposit_paid`.
- Keep manager/provider/admin logic stable.
- Preserve lead/deal and main/sub passenger behavior.

## Locked Decisions

1. Strict mode for sub/agent booking is required.
2. Booking becomes allowed at `confirmed_deposit_paid` (no need to wait for `completed`).

## Current Gap Summary

- Sub/agent still have direct registration paths that can bypass strict seat access in some flows.
- Seat-request eligibility endpoint exists but is not yet wired as a hard blocker for all relevant UI actions.
- Booking records do not consistently carry `seat_request_id` linkage for end-to-end traceability.
- Tour search still has fallback behavior that can broaden results beyond strict destination matching.

## Phase Plan

### Phase 1 - Frontend Strict Gate (low risk)

Goal: block sub/agent passenger submission unless eligible seat request is selected and valid.

Scope:

- `src/App.tsx`
- `src/Pages/UserInterface.tsx`
- `src/hooks/useBooking.ts`
- `src/api/b2b.ts`

Tasks:

1. Add strict feature flag for B2B seat-access-only register mode.
2. For sub/agent, keep left workspace visible (`Your Requests / Register Passenger / Your Bookings`) but lock register actions unless eligibility is true.
3. Call `GET /api/v1/seat-requests/:id/booking-eligibility` and show explicit lock reason when blocked.
4. Keep manager/provider/admin flows unchanged.

Acceptance:

- Sub/agent cannot submit passenger rows before `confirmed_deposit_paid`.
- Existing manager/provider/admin actions still behave exactly as before.

### Phase 2 - Data Linkage + DB Guard (authoritative)

Goal: make bypass impossible at DB level and keep audit trail from seat request to passenger rows.

Scope:

- new migration(s) in `supabase/migrations/`
- `src/hooks/useBooking.ts`
- `src/components/PassengerRequests.tsx`

Tasks:

1. Add `seat_request_id` linkage columns where required (`passenger_requests` first; optionally `orders` and `passengers` for full traceability).
2. Ensure insert/update paths populate linkage for sub/agent strict flow.
3. Add trigger/function guard to reject non-eligible sub/agent inserts.

Acceptance:

- Even if UI is bypassed, DB rejects invalid sub/agent booking inserts.
- Manager approvals preserve linkage into active passengers.

### Phase 3 - Search Strictness and Safety

Goal: ensure selectable tours strictly match approved request window/destination and availability.

Scope:

- `backend/src/modules/tours/tours.service.ts`
- `backend/src/modules/tours/tours.repo.ts`
- `backend/src/modules/seatAccessRequests/seatAccessRequests.repo.ts`

Tasks:

1. Disable destination-relaxed fallback for strict sub/agent path.
2. Enforce active/visible/available tour filters in strict path.
3. Keep manager/admin visibility behavior unchanged.

Acceptance:

- Sub/agent only see tours that satisfy strict request constraints.

### Phase 4 - Payment Rule Alignment

Goal: align milestone calculation with business contract exactly.

Scope:

- new migration in `supabase/migrations/` updating milestone function.

Rules:

- Deposit: 50,000 MNT per seat in 6 hours only when travel date is 30+ days out.
- Near tours (<=30 days): skip 6-hour deposit and go directly to percentage milestones.
- Reconfirm: +100,000 MNT per seat only when travel is 30+ days out.
- Cumulative thresholds as departure approaches:
  - 21-30 days: >= 30%
  - 14-20 days: >= 50%
  - <= 10 days: 100%

Acceptance:

- Generated milestones match contract for edge dates.

### Phase 5 - Blacklist Enforcement

Goal: protect manager from accidental bad approvals.

Scope:

- `src/hooks/useBooking.ts`
- `src/components/PassengerRequests.tsx`

Tasks:

1. Add visible warning for blacklisted passenger in approval/booking path.
2. Optional hard-block with manager override path (configurable).

Acceptance:

- Blacklisted passenger is never silently approved.

## Regression Matrix

1. Agent strict flow end-to-end.
2. Subcontractor strict flow end-to-end.
3. Manager tour/passenger actions.
4. Provider booking confirmation workflow.
5. Admin monitoring and analytics routes.

## SQL Reminder

Already created migrations to run in target DB:

1. `supabase/migrations/20260310_users_role_bridge_compat.sql`
2. `supabase/migrations/20260310_tours_destination_query_perf.sql`
3. `supabase/migrations/20260310_global_tours_sync_status.sql`

Additional migrations to be added during this rollout:

1. Strict booking linkage + DB guard for sub/agent.
2. Milestone rule alignment migration.
