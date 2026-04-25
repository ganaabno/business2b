import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();
dotenv.config({ path: "backend/.env", override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const REQUIRED_MIGRATIONS = [
  "20260226_b2b_roles_seat_requests.sql",
  "20260227_b2b_security_reliability_hardening.sql",
  "20260229_b2b_access_request_agent_points.sql",
  "20260305_b2b_qpay_intents_and_milestones.sql",
  "20260305_tour_provider_assignments.sql",
  "20260310_b2b_strict_seat_request_guard.sql",
  "20260310_tours_destination_query_perf.sql",
  "20260310_global_tours_sync_status.sql",
  "20260310_users_role_bridge_compat.sql",
  "20260311_signup_flow_workspace_roles.sql",
  "20260313_users_auth_user_bridge.sql",
  "20260323_b2b_near_tour_skip_deposit.sql",
  "20260402_b2b_access_approval_6h_ttl.sql",
  "20260402_b2b_serial_bundle_enforcement.sql",
  "20260403_b2b_serial_preview_idempotency.sql",
];

const REQUIRED_TABLES = [
  "organizations",
  "organization_members",
  "organization_contracts",
  "seat_requests",
  "seat_request_payment_milestones",
  "seat_request_payments",
  "seat_access_requests",
  "seat_access_request_idempotency",
  "integration_outbox",
];

const REQUIRED_VIEWS = ["v_seat_request_monitoring"];
const REQUIRED_FUNCTIONS = ["fn_generate_payment_milestones"];
const REQUIRED_COLUMNS = {
  users: ["id", "email", "role", "auth_user_id"],
  integration_outbox: ["status", "next_retry_at", "retry_count"],
};

function resolveConnectionString() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
}

async function loadMigrationSql(fileName) {
  const migrationPath = path.join(rootDir, "supabase", "migrations", fileName);
  return readFile(migrationPath, "utf8");
}

async function checkSchema(client) {
  const tableResult = await client.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [REQUIRED_TABLES],
  );

  const viewResult = await client.query(
    `
      select table_name
      from information_schema.views
      where table_schema = 'public'
        and table_name = any($1::text[])
    `,
    [REQUIRED_VIEWS],
  );

  const functionResult = await client.query(
    `
      select routine_name
      from information_schema.routines
      where routine_schema = 'public'
        and routine_name = any($1::text[])
    `,
    [REQUIRED_FUNCTIONS],
  );

  const tablesFound = new Set(tableResult.rows.map((row) => row.table_name));
  const viewsFound = new Set(viewResult.rows.map((row) => row.table_name));
  const functionsFound = new Set(functionResult.rows.map((row) => row.routine_name));

  const missingColumns = {};
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const columnResult = await client.query(
      `
      select lower(column_name) as column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and lower(column_name) = any($2::text[])
      `,
      [tableName, requiredColumns.map((column) => column.toLowerCase())],
    );

    const foundColumns = new Set(columnResult.rows.map((row) => row.column_name));
    const missing = requiredColumns.filter(
      (column) => !foundColumns.has(column.toLowerCase()),
    );

    if (missing.length > 0) {
      missingColumns[tableName] = missing;
    }
  }

  return {
    missingTables: REQUIRED_TABLES.filter((name) => !tablesFound.has(name)),
    missingViews: REQUIRED_VIEWS.filter((name) => !viewsFound.has(name)),
    missingFunctions: REQUIRED_FUNCTIONS.filter((name) => !functionsFound.has(name)),
    missingColumns,
  };
}

async function getUsersIdType(client) {
  const result = await client.query(`
    select data_type, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'id'
    limit 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return String(row.udt_name || row.data_type || "").toLowerCase();
}

async function applyMigrations(client) {
  for (const migration of REQUIRED_MIGRATIONS) {
    const sql = await loadMigrationSql(migration);
    process.stdout.write(`Applying ${migration}... `);
    await client.query(sql);
    process.stdout.write("OK\n");
  }
}

async function ensureCompatibilityPrimitives(client) {
  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end
    $$;
  `);

  await client.query(`create schema if not exists auth;`);
  await client.query(`
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as 'select null::uuid';
  `);
}

async function applyGroupPolicyColumns(client) {
  await client.query(`
    begin;
      alter table public.organization_contracts
        add column if not exists group_min_pax integer not null default 10;

      alter table public.organization_contracts
        add column if not exists group_max_pax integer not null default 30;

      alter table public.organization_contracts
        add column if not exists group_policy_mode text not null default 'off';

      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'organization_contracts_group_pax_range'
            and conrelid = 'public.organization_contracts'::regclass
        ) then
          alter table public.organization_contracts
            add constraint organization_contracts_group_pax_range
            check (group_min_pax >= 1 and group_max_pax >= group_min_pax) not valid;
        end if;
      end
      $$;

      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'organization_contracts_group_policy_mode_allowed'
            and conrelid = 'public.organization_contracts'::regclass
        ) then
          alter table public.organization_contracts
            add constraint organization_contracts_group_policy_mode_allowed
            check (group_policy_mode in ('off', 'validate_only', 'enforce')) not valid;
        end if;
      end
      $$;

      alter table public.organization_contracts validate constraint organization_contracts_group_pax_range;
      alter table public.organization_contracts validate constraint organization_contracts_group_policy_mode_allowed;
    commit;
  `);
}

function printSchemaStatus(status) {
  const missingColumnTables = Object.keys(status.missingColumns);
  if (
    status.missingTables.length === 0 &&
    status.missingViews.length === 0 &&
    status.missingFunctions.length === 0 &&
    missingColumnTables.length === 0
  ) {
    console.log("B2B schema status: READY");
    return;
  }

  console.log("B2B schema status: NOT READY");
  if (status.missingTables.length > 0) {
    console.log(`Missing tables: ${status.missingTables.join(", ")}`);
  }
  if (status.missingViews.length > 0) {
    console.log(`Missing views: ${status.missingViews.join(", ")}`);
  }
  if (status.missingFunctions.length > 0) {
    console.log(`Missing functions: ${status.missingFunctions.join(", ")}`);
  }
  if (missingColumnTables.length > 0) {
    for (const tableName of missingColumnTables) {
      console.log(
        `Missing columns in ${tableName}: ${status.missingColumns[tableName].join(", ")}`,
      );
    }
  }
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "status";
  const connectionString = resolveConnectionString();

  if (!connectionString) {
    console.error("DATABASE_URL or NEON_DATABASE_URL is required.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();
  let exitCode = 0;

  try {
    const usersIdType = await getUsersIdType(client);
    const isUuidUsersId = usersIdType === "uuid";

    if (!isUuidUsersId) {
      console.log(
        "Configured backend DB has legacy users schema (public.users.id is not uuid).",
      );
      console.log(
        "Current type:",
        usersIdType || "(missing)",
        "- standard migrations expect Supabase UUID users.",
      );

      if (mode === "apply") {
        console.log(
          "For legacy schema run: npm run db:b2b:legacy-bootstrap (or set DATABASE_URL to Supabase Postgres and run db:b2b:apply).",
        );
      }

      exitCode = 1;
    }

    if (mode === "apply" && isUuidUsersId) {
      await ensureCompatibilityPrimitives(client);
      await applyMigrations(client);
      await applyGroupPolicyColumns(client);
    }

    const status = await checkSchema(client);
    printSchemaStatus(status);

    const hasMissing =
      status.missingTables.length > 0 ||
      status.missingViews.length > 0 ||
      status.missingFunctions.length > 0 ||
      Object.keys(status.missingColumns).length > 0;

    if (hasMissing) {
      if (mode !== "apply") {
        console.log("Run: npm run db:b2b:apply");
      }
      exitCode = 1;
    }
  } finally {
    await client.end();
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

main().catch((error) => {
  console.error("B2B schema setup failed:", error.message || error);
  process.exit(1);
});
