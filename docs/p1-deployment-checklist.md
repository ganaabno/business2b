# P1 Deployment Checklist (Data Model + Security Foundation)

This checklist executes P1 safely with additive migrations only.

## Scope

- Additive schema for role_v2, organizations, seat requests, milestones, payments, outbox
- Backfill verification and integrity checks
- RLS hardening for new tables
- No destructive operations on legacy working flows

## Migration order

0. `supabase/migrations/20260225_shared_booking_core.sql` (prerequisite if not already applied)
1. `supabase/migrations/20260226_b2b_roles_seat_requests.sql`
2. `supabase/migrations/20260226_b2b_p1_rls_hardening.sql` (no-op placeholder)
3. `supabase/migrations/20260227_b2b_security_reliability_hardening.sql`
4. `supabase/migrations/20260227_shared_booking_locking_patch.sql`
5. `supabase/migrations/20260228_b2b_ch_alignment_bindings_group_policy_ticket_lock.sql`
6. `supabase/migrations/20260229_b2b_access_request_agent_points.sql`

## Zero-downtime apply guidance

- Apply during low traffic window.
- Keep all B2B flags OFF during schema migration:
  - `B2B_ROLE_V2_ENABLED=false`
  - `B2B_SEAT_REQUEST_FLOW_ENABLED=false`
  - `B2B_MONITORING_ENABLED=false`
  - `B2B_GROUP_POLICY_ENABLED=false`
  - `B2B_GROUP_POLICY_ENFORCE=false`
- Do not disable legacy routes/screens.
- Confirm API and frontend health after each migration before enabling any flags.

## Verification (read-only SQL)

Run and archive outputs:

1. `supabase/verification/p1_backfill_and_integrity_checks.sql`
2. `supabase/verification/p1_index_fk_inventory.sql`
3. `supabase/verification/p2_p3_runtime_checks.sql`
4. `supabase/verification/p4_ch_alignment_checks.sql`

Pass conditions:

- Role backfill mismatch counts are zero:
  - user -> subcontractor
  - provider -> agent
  - superadmin -> admin
- Orphan counts are zero.
- Duplicate org membership rows are zero.
- Invalid enum checks are zero.
- Required FK/UNIQUE/INDEX inventory is present.

## RLS validation matrix

Test with authenticated user tokens by role:

- Admin
  - Can read all organizations, seat requests, payments, milestones.
  - Can update seat request states.
- Manager
  - Same operational visibility as admin.
- Subcontractor (legacy user)
  - Can read own org + own requests + own payment/milestones.
  - Cannot read all orgs/requests.
- Agent (legacy provider)
  - Same scoped access as subcontractor.

## Regression checks (legacy untouched)

- Manager dashboard book passenger flow works.
- Existing orders/passengers/tours flows unchanged.
- Alt+Tab focus does not trigger disruptive reload behavior.

## Exit criteria

- All migrations applied successfully.
- Verification SQL pass conditions satisfied.
- RLS matrix validated.
- Legacy flows pass smoke test.
- Flags remain OFF until P2/P3 cutover plan.
