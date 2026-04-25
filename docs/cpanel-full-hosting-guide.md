# Full cPanel Hosting Guide (Frontend + Backend)

This guide deploys both apps on cPanel:

- Frontend: `https://gtrip.mn`
- Backend API: `https://api.gtrip.mn`

## 1) Prerequisites

- cPanel plan with **Setup Node.js App** enabled.
- Node.js 20+ available in cPanel.
- SSL active for `gtrip.mn`, `www.gtrip.mn`, and `api.gtrip.mn`.
- DNS records point all 3 hosts to the same cPanel server.

## 2) Project layout on server

Recommended server path:

`/home/<cpanel-user>/apps/business2b`

Do not run backend from `public_html`.

## 3) Backend env configuration

Use `deploy/cpanel/backend.env.example` as your template.

Important values to set correctly:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ALLOWED_ORIGINS=https://gtrip.mn,https://www.gtrip.mn`
- `B2B_ROLE_V2_ENABLED=true`
- `B2B_SEAT_REQUEST_FLOW_ENABLED=true`
- `B2B_MONITORING_ENABLED=true`
- `GLOBAL_TASKS_API_PATH=/api/tasks`
- `GLOBAL_TOURS_SERVICE_EMAIL` and `GLOBAL_TOURS_SERVICE_PASSWORD` (required for Global task bridge)

## 4) Frontend env configuration

Use `deploy/cpanel/.env.production.example` as your template.

Critical:

- `VITE_BASE_URL=https://gtrip.mn`
- `VITE_API_BASE_URL=https://api.gtrip.mn`

`VITE_API_BASE_URL` must be the backend origin only (no `/api` path).

## 5) Build commands

From project root:

```bash
npm ci
npm run build:cpanel
```

`build:cpanel` performs:

1. cPanel env validation (`scripts/verifyCpanelEnv.mjs`)
2. backend build (`backend/dist`)
3. frontend build (`dist`)

## 6) Configure Node app in cPanel

In **Setup Node.js App**:

- Application root: `/home/<cpanel-user>/apps/business2b`
- Application URL: `api.gtrip.mn`
- Startup file: `app.cpanel.mjs`
- Node.js version: 20+

Then restart the app.

`app.cpanel.mjs` boots `backend/dist/server.js` and fails fast if backend is not built.

## 7) Publish frontend to gtrip.mn

Upload/copy contents of `dist/` to `public_html/`.

Also copy `deploy/cpanel/frontend/.htaccess` to `public_html/.htaccess`.

This enables React SPA route fallback.

## 8) First-run checks

Backend checks:

- `https://api.gtrip.mn/health` returns JSON
- `https://api.gtrip.mn/api/v1/feature-flags` returns JSON

Frontend checks:

- Open `https://gtrip.mn`
- In browser Network tab, API requests go to `https://api.gtrip.mn/...`
- No "returned HTML instead of JSON" errors

## 9) DB schema readiness (required)

Before enabling full traffic, run:

```bash
npm run db:b2b:status
npm run db:b2b:apply
```

If status says `users.id` is not `uuid`, you are pointing at a legacy DB. Use the canonical Supabase Postgres URL for this backend.

## 10) Update workflow

For each release:

```bash
npm ci
npm run build:cpanel
```

- Restart Node app in cPanel.
- Replace `public_html` files with new `dist/` output.
- Hard-refresh browser / clear CDN cache.
