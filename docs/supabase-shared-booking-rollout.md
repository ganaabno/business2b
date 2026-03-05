# Supabase Shared Booking Rollout (Option A)

This runbook applies the new canonical booking path in one shared Supabase database.

## 1) Run SQL migration

Open Supabase Dashboard -> SQL Editor and run:

- `supabase/migrations/20260225_shared_booking_core.sql`

It creates:

- `orders.source`, `orders.source_order_id`, `passengers.source_passenger_id`
- Unique idempotency index on `(source, source_order_id)`
- `get_departure_seats(tour_id, departure_date)`
- `book_trip_shared(...)` transactional RPC

## 2) Verify functions exist

Run this in SQL Editor:

```sql
select proname
from pg_proc
where proname in ('get_departure_seats', 'book_trip_shared')
order by proname;
```

Expected: both rows returned.

## 3) Verify idempotency index

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'orders'
  and indexname = 'orders_source_source_order_id_uidx';
```

Expected: one row returned.

## 4) Smoke test booking RPC

Use SQL Editor:

```sql
select *
from public.book_trip_shared(
  p_user_id := 'replace-with-user-id',
  p_tour_id := 'replace-with-tour-id',
  p_tour_title := 'Test Tour',
  p_departure_date := '2026-03-10',
  p_payment_method := 'Cash',
  p_order_status := 'confirmed',
  p_order_source := 'b2b',
  p_source_order_id := 'smoke-test-1',
  p_passengers := jsonb_build_array(
    jsonb_build_object(
      'first_name','Smoke',
      'last_name','Tester',
      'phone','99112233',
      'email','smoke@example.com',
      'seat_count',1,
      'price',1000000,
      'room_type','Twin',
      'hotel','Test Hotel',
      'status','active',
      'pax_type','Adult'
    )
  )
);
```

Run it twice with the same `p_source_order_id`.

Expected:

- Second call returns the same `order_id` (no duplicate order)

## 5) Validate seat stats

```sql
select *
from public.get_departure_seats('replace-with-tour-id', '2026-03-10');
```

Expected:

- `booked` increases after booking
- `remaining` decreases and never goes below zero
