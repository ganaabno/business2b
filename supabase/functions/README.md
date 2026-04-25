Required Edge Functions

The frontend now calls these Supabase Edge Functions:

- `admin-list-users`
- `admin-change-role`
- `admin-delete-user`
- `admin-list-pending-users`
- `admin-get-pending-user`
- `admin-approve-request`
- `admin-decline-request`
- `public-check-email`

Expected request/response contract:

- Request: JSON body with the documented fields.
- Response: `{ ok: boolean, data?: any, error?: string }`.

Security requirements:

- `admin-*` functions must validate JWT and allow only `admin`/`superadmin`.
- Service role key must only exist in function secrets/runtime, never in frontend env.
- `public-check-email` should be rate-limited and return only boolean existence.
