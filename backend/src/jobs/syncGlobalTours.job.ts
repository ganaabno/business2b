import { q } from "../db/transaction.js";
import { env } from "../config/env.js";
import { syncGlobalToursSystemService } from "../modules/tours/tours.service.js";
import { logger } from "../shared/logger.js";

const GLOBAL_TOURS_SYNC_LOCK_KEY = 9242063;

let inProgress = false;

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

  const result = await syncGlobalToursSystemService({
    dryRun: false,
    sourceSystem: env.globalToursSyncSourceSystem,
  });

  logger.info("slo.global_tours_sync.run", {
    sourceSystem: result.sourceSystem,
    fetched: result.fetched,
    normalized: result.normalized,
    inserted: result.inserted,
    updated: result.updated,
    linked: result.linked,
    skipped: result.skipped,
    durationMs: Date.now() - startedAt,
  });
}

export function startGlobalToursSyncJob() {
  if (!env.globalToursSyncEnabled) {
    logger.info("Global tours sync job disabled");
    return;
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

  if (env.globalToursSyncOnStartup) {
    void run();
  }

  setInterval(run, env.globalToursSyncIntervalMs);
}
