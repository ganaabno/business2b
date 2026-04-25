import { q } from "../db/transaction.js";
import { env } from "../config/env.js";
import {
  syncGlobalToursSystemService,
  type SyncGlobalToursResult,
} from "../modules/tours/tours.service.js";
import { logger } from "../shared/logger.js";

const GLOBAL_TOURS_SYNC_LOCK_KEY = 9242063;

let inProgress = false;
let syncStatusSchemaWarningLogged = false;

function isSyncStatusSchemaError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703";
}

async function writeSyncStatus(
  stage: "started" | "success" | "failure" | "baseline",
  sql: string,
  params: unknown[],
) {
  try {
    await q(sql, params);
  } catch (error) {
    if (isSyncStatusSchemaError(error)) {
      if (!syncStatusSchemaWarningLogged) {
        logger.warn(
          "Global tours sync status table is unavailable; run latest migrations to enable status tracking",
          { stage, error },
        );
        syncStatusSchemaWarningLogged = true;
      }
      return;
    }

    logger.warn("Failed to persist global tours sync status", {
      stage,
      error,
    });
  }
}

async function upsertBaselineSyncStatus() {
  await writeSyncStatus(
    "baseline",
    `
    insert into public.global_tours_sync_status (
      id,
      source_system,
      enabled,
      interval_ms,
      updated_at
    )
    values (
      1,
      $1::text,
      $2::boolean,
      $3::int,
      now()
    )
    on conflict (id)
    do update set
      source_system = excluded.source_system,
      enabled = excluded.enabled,
      interval_ms = excluded.interval_ms,
      updated_at = now()
    `,
    [
      env.globalToursSyncSourceSystem,
      env.globalToursSyncEnabled,
      env.globalToursSyncIntervalMs,
    ],
  );
}

async function markSyncStarted(startedAtIso: string) {
  await writeSyncStatus(
    "started",
    `
    insert into public.global_tours_sync_status (
      id,
      source_system,
      enabled,
      interval_ms,
      last_started_at,
      updated_at
    )
    values (
      1,
      $1::text,
      $2::boolean,
      $3::int,
      $4::timestamptz,
      now()
    )
    on conflict (id)
    do update set
      source_system = excluded.source_system,
      enabled = excluded.enabled,
      interval_ms = excluded.interval_ms,
      last_started_at = excluded.last_started_at,
      updated_at = now()
    `,
    [
      env.globalToursSyncSourceSystem,
      env.globalToursSyncEnabled,
      env.globalToursSyncIntervalMs,
      startedAtIso,
    ],
  );
}

async function markSyncSuccess(
  startedAtIso: string,
  finishedAtIso: string,
  durationMs: number,
  result: SyncGlobalToursResult,
) {
  await writeSyncStatus(
    "success",
    `
    insert into public.global_tours_sync_status (
      id,
      source_system,
      enabled,
      interval_ms,
      last_started_at,
      last_success_at,
      last_finished_at,
      last_error,
      failure_streak,
      last_duration_ms,
      last_fetched,
      last_normalized,
      last_inserted,
      last_updated,
      last_linked,
      last_skipped,
      last_dry_run,
      updated_at
    )
    values (
      1,
      $1::text,
      $2::boolean,
      $3::int,
      $4::timestamptz,
      $5::timestamptz,
      $6::timestamptz,
      null,
      0,
      $7::int,
      $8::int,
      $9::int,
      $10::int,
      $11::int,
      $12::int,
      $13::int,
      $14::boolean,
      now()
    )
    on conflict (id)
    do update set
      source_system = excluded.source_system,
      enabled = excluded.enabled,
      interval_ms = excluded.interval_ms,
      last_started_at = excluded.last_started_at,
      last_success_at = excluded.last_success_at,
      last_finished_at = excluded.last_finished_at,
      last_error = null,
      failure_streak = 0,
      last_duration_ms = excluded.last_duration_ms,
      last_fetched = excluded.last_fetched,
      last_normalized = excluded.last_normalized,
      last_inserted = excluded.last_inserted,
      last_updated = excluded.last_updated,
      last_linked = excluded.last_linked,
      last_skipped = excluded.last_skipped,
      last_dry_run = excluded.last_dry_run,
      updated_at = now()
    `,
    [
      env.globalToursSyncSourceSystem,
      env.globalToursSyncEnabled,
      env.globalToursSyncIntervalMs,
      startedAtIso,
      finishedAtIso,
      finishedAtIso,
      durationMs,
      result.fetched,
      result.normalized,
      result.inserted,
      result.updated,
      result.linked,
      result.skipped,
      result.dryRun,
    ],
  );
}

async function markSyncFailure(
  startedAtIso: string,
  finishedAtIso: string,
  durationMs: number,
  error: unknown,
) {
  const errorMessage =
    error instanceof Error ? error.message : String(error || "Unknown error");

  await writeSyncStatus(
    "failure",
    `
    insert into public.global_tours_sync_status (
      id,
      source_system,
      enabled,
      interval_ms,
      last_started_at,
      last_failure_at,
      last_finished_at,
      last_error,
      failure_streak,
      last_duration_ms,
      updated_at
    )
    values (
      1,
      $1::text,
      $2::boolean,
      $3::int,
      $4::timestamptz,
      $5::timestamptz,
      $6::timestamptz,
      $7::text,
      1,
      $8::int,
      now()
    )
    on conflict (id)
    do update set
      source_system = excluded.source_system,
      enabled = excluded.enabled,
      interval_ms = excluded.interval_ms,
      last_started_at = excluded.last_started_at,
      last_failure_at = excluded.last_failure_at,
      last_finished_at = excluded.last_finished_at,
      last_error = excluded.last_error,
      failure_streak = coalesce(public.global_tours_sync_status.failure_streak, 0) + 1,
      last_duration_ms = excluded.last_duration_ms,
      updated_at = now()
    `,
    [
      env.globalToursSyncSourceSystem,
      env.globalToursSyncEnabled,
      env.globalToursSyncIntervalMs,
      startedAtIso,
      finishedAtIso,
      finishedAtIso,
      errorMessage.slice(0, 3000),
      durationMs,
    ],
  );
}

async function withGlobalToursSyncAdvisoryLock(runner: () => Promise<void>) {
  const { rows } = await q<{ locked: boolean }>(
    `select pg_try_advisory_lock($1) as locked`,
    [GLOBAL_TOURS_SYNC_LOCK_KEY],
  );

  if (!rows[0]?.locked) {
    return;
  }

  try {
    await runner();
  } finally {
    await q(`select pg_advisory_unlock($1)`, [GLOBAL_TOURS_SYNC_LOCK_KEY]);
  }
}

async function runGlobalToursSync() {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  await markSyncStarted(startedAtIso);

  try {
    const result = await syncGlobalToursSystemService({
      dryRun: false,
      sourceSystem: env.globalToursSyncSourceSystem,
    });

    const finishedAtIso = new Date().toISOString();
    const durationMs = Date.now() - startedAt;

    logger.info("slo.global_tours_sync.run", {
      sourceSystem: result.sourceSystem,
      fetched: result.fetched,
      normalized: result.normalized,
      inserted: result.inserted,
      updated: result.updated,
      linked: result.linked,
      skipped: result.skipped,
      durationMs,
    });

    await markSyncSuccess(startedAtIso, finishedAtIso, durationMs, result);
  } catch (error) {
    const finishedAtIso = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    await markSyncFailure(startedAtIso, finishedAtIso, durationMs, error);
    throw error;
  }
}

export function startGlobalToursSyncJob() {
  if (!env.globalToursSyncEnabled) {
    logger.info("Global tours sync job disabled");
    void upsertBaselineSyncStatus();
    return () => {
      // no-op
    };
  }

  const run = async () => {
    if (inProgress) {
      return;
    }

    inProgress = true;
    try {
      await withGlobalToursSyncAdvisoryLock(async () => {
        await runGlobalToursSync();
      });
    } catch (error) {
      logger.error("Global tours sync job failed", error);
    } finally {
      inProgress = false;
    }
  };

  logger.info("Global tours sync job started", {
    intervalMs: env.globalToursSyncIntervalMs,
    onStartup: env.globalToursSyncOnStartup,
    sourceSystem: env.globalToursSyncSourceSystem,
  });

  void upsertBaselineSyncStatus();

  if (env.globalToursSyncOnStartup) {
    void run();
  }

  const timer = setInterval(() => {
    void run();
  }, env.globalToursSyncIntervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
