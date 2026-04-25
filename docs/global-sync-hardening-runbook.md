# Global Sync Hardening Runbook

## Goal

Validate that B2B -> Global tour create/update/delete push works without breaking existing local booking/order flows.

## Required flags

- Backend only:
  - `GLOBAL_TOURS_WRITE_ENABLED=true`
  - `GLOBAL_TOURS_WRITE_API_BASE_URL=<global-api-base>`
  - `GLOBAL_TOURS_WRITE_PATH=/api/tours`
  - `GLOBAL_TOURS_PRICE_TABLE_PATH=/api/price_table`
  - `GLOBAL_TOURS_AUTH_PATH=/api/auth/login`
  - `GLOBAL_TOURS_SERVICE_EMAIL=<service-account-email>`
  - `GLOBAL_TOURS_SERVICE_PASSWORD=<service-account-password>`

Keep frontend flags unchanged for this validation.

## Smoke checklist (staging)

1. Create a local tour from admin/manager UI.
   - Expect local create success.
   - Expect backend push result: `remoteAction=created`.
   - If warning exists, local save must still succeed.
2. Update the same tour title/date/seat/price.
   - Expect local update success.
   - Expect backend push result: `remoteAction=updated` or `remoteAction=created` (404 fallback).
3. Delete the same local tour.
   - Expect local delete success.
   - Expect backend push result: `remoteAction=deleted`.
   - Remote 404 must be treated as idempotent delete with warning only.
4. Booking flow safety check.
   - Book the tour from normal booking flow.
   - Confirm local seat decrement still works.
   - Confirm canonical price-row sync endpoint still succeeds/skips safely.

## Log checks

- Search for `audit.global_tour.push` and confirm `warningCount` is low and expected.
- Search for `audit.global_tour.push.price_row_sync_failed` and confirm no repeated spikes.
- Search for `audit.global_tour.price_row_synced` to confirm seat-sync path still active.

## SQL verification

Run `supabase/verification/global_sync_runtime_checks.sql` and verify:

- No duplicate `(source_system, source_tour_id)` rows.
- No large backlog of Global-linked rows with missing dates/seats.
- `global_tours_sync_status` heartbeat is fresh.

## Rollback

- Immediate kill switch: set `GLOBAL_TOURS_WRITE_ENABLED=false`.
- This disables remote push while keeping local create/update/delete and booking flows intact.
