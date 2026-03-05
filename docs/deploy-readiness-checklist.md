# Gtrip Deploy Readiness Checklist

This checklist is for shipping Global-tour-primary mode safely.

## 1) Required env vars

Set these in deployment environment:

- `VITE_GLOBAL_API_ENABLED=true`
- `VITE_GLOBAL_API_BASE_URL=https://b2c-production.up.railway.app`
- `VITE_GLOBAL_API_TOURS_PATH=/api/tours`
- `VITE_GLOBAL_API_ORDERS_PATH=/api/payments`
- `VITE_GLOBAL_API_TIMEOUT_MS=8000`
- `VITE_USE_GLOBAL_TOURS_PRIMARY=true`
- `VITE_GLOBAL_TOURS_FALLBACK_LOCAL=true`

## 2) Supabase migration

Run:

- `supabase/migrations/20260225_shared_booking_core.sql`

Then verify in SQL editor:

```sql
select proname
from pg_proc
where proname in ('get_departure_seats', 'book_trip_shared')
order by proname;
```

## 3) Runtime checks

On Admin page, verify:

- Global API status shows `Online`
- Tours count is non-zero
- Recent global rows are visible
- Tour source badges appear (`Global`, `Global + Local`, `Local`)

## 4) Booking checks

From manager/user flow:

- Select a Global-labeled tour
- Create booking with passengers
- Verify booking row and passenger rows are created
- Verify seat stats update via `get_departure_seats`

## 5) Rollback switches

If Global API has issues, set:

- `VITE_USE_GLOBAL_TOURS_PRIMARY=false`

This keeps local tours as primary without code rollback.
