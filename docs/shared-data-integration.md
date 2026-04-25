# Shared Data Integration (B2B <-> Global API)

This project now includes a safe first-step integration path to consume shared orders from `global-travel` API.

## Feature flags

- `VITE_GLOBAL_API_ENABLED=true|false`
- `VITE_GLOBAL_API_BASE_URL=https://global-travel.mn`

When `VITE_GLOBAL_API_ENABLED=true`, `OrdersTab` tries to load orders from:

- `GET {VITE_GLOBAL_API_BASE_URL}/api/orders`

If that call fails, it falls back to the current Supabase source.

## Why this approach

- Avoids risky big-bang migration.
- Allows gradual endpoint-by-endpoint cutover.
- Keeps B2B functional even if shared API is temporarily unavailable.

## Next migration steps

1. Add shared API endpoints for order mutations used by B2B:
   - update order status/payment
   - update room type
   - update passenger notes
   - delete order
2. Route B2B writes through shared API with server-side auth.
3. Disable Supabase writes for shared entities once parity is verified.
4. Add reconciliation checks for seat counts and passenger totals.

## Security notes

- Keep Neon connection strings backend-only.
- Do not expose DB credentials in frontend env (`VITE_*`).
- Use shared API auth and role checks for all writes.
