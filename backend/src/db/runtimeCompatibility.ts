import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { q } from "./transaction.js";

type ColumnRow = {
  column_name: string;
  udt_name: string;
};

async function getColumnRows(tableName: string) {
  const { rows } = await q<ColumnRow>(
    `
    select lower(column_name) as column_name,
           lower(udt_name) as udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = $1
    order by ordinal_position
    `,
    [tableName],
  );

  return rows;
}

function formatIssues(issues: string[]) {
  return issues.map((issue, index) => `${index + 1}. ${issue}`).join(" ");
}

export async function assertRuntimeDbCompatibility() {
  const issues: string[] = [];
  const warnings: string[] = [];

  const usersColumns = await getColumnRows("users");
  const usersColumnSet = new Set(usersColumns.map((row) => row.column_name));
  const usersIdType = usersColumns.find((row) => row.column_name === "id")?.udt_name || null;

  if (!usersIdType) {
    issues.push("public.users.id column is missing");
  } else if (usersIdType !== "uuid") {
    issues.push(`public.users.id must be uuid (found ${usersIdType})`);
  }

  for (const requiredColumn of ["email", "role"]) {
    if (!usersColumnSet.has(requiredColumn)) {
      issues.push(`public.users.${requiredColumn} column is missing`);
    }
  }

  if (!usersColumnSet.has("auth_user_id")) {
    warnings.push(
      "public.users.auth_user_id column is missing; auth lookup falls back to id/email only",
    );
  }

  if (env.b2bSeatRequestFlowEnabled) {
    const outboxColumns = await getColumnRows("integration_outbox");
    const outboxColumnSet = new Set(outboxColumns.map((row) => row.column_name));

    for (const requiredColumn of ["status", "next_retry_at", "retry_count"]) {
      if (!outboxColumnSet.has(requiredColumn)) {
        issues.push(
          `public.integration_outbox.${requiredColumn} is missing while B2B seat-request flow is enabled`,
        );
      }
    }

    const seatRequestColumns = await getColumnRows("seat_requests");
    const seatRequestColumnSet = new Set(
      seatRequestColumns.map((row) => row.column_name),
    );

    for (const requiredColumn of [
      "serial_group_id",
      "serial_index",
      "serial_total",
    ]) {
      if (!seatRequestColumnSet.has(requiredColumn)) {
        issues.push(
          `public.seat_requests.${requiredColumn} is missing while B2B seat-request flow is enabled`,
        );
      }
    }

    const accessColumns = await getColumnRows("seat_access_requests");
    const accessColumnSet = new Set(accessColumns.map((row) => row.column_name));
    for (const requiredColumn of ["serial_count", "serial_group_id"]) {
      if (!accessColumnSet.has(requiredColumn)) {
        issues.push(
          `public.seat_access_requests.${requiredColumn} is missing while B2B seat-request flow is enabled`,
        );
      }
    }

    const idempotencyColumns = await getColumnRows(
      "seat_access_request_idempotency",
    );
    const idempotencyColumnSet = new Set(
      idempotencyColumns.map((row) => row.column_name),
    );
    for (const requiredColumn of [
      "access_request_id",
      "requester_user_id",
      "idempotency_key",
      "status",
      "response_payload",
    ]) {
      if (!idempotencyColumnSet.has(requiredColumn)) {
        issues.push(
          `public.seat_access_request_idempotency.${requiredColumn} is missing while B2B seat-request flow is enabled`,
        );
      }
    }
  }

  if (warnings.length > 0) {
    logger.warn("Runtime DB compatibility warnings", { warnings });
  }

  if (issues.length === 0) {
    return;
  }

  const detailText = formatIssues(issues);
  const remediation =
    "Use canonical Supabase Postgres for DATABASE_URL and run npm run db:b2b:apply. " +
    "For temporary local bypass only, set B2B_ALLOW_LEGACY_DB=true.";

  if (!env.isProduction) {
    logger.warn("Runtime DB compatibility issues detected (development mode - continuing)", {
      issues,
      remediation,
    });
    return;
  }

  if (env.b2bAllowLegacyDb) {
    logger.warn("Runtime DB compatibility check bypassed because B2B_ALLOW_LEGACY_DB=true", {
      issues,
    });
    return;
  }

  throw new Error(`Runtime database compatibility check failed. ${detailText} ${remediation}`);
}
