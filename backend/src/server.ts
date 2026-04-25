import type { Server } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { db } from "./db/client.js";
import { assertRuntimeDbCompatibility } from "./db/runtimeCompatibility.js";
import { startDeadlineJob } from "./jobs/processDeadlines.job.js";
import { startGlobalToursSyncJob } from "./jobs/syncGlobalTours.job.js";
import { startOutboxRelayJob } from "./jobs/outboxRelay.job.js";
import { logger } from "./shared/logger.js";

type StopFn = () => void;

function listenServer(app: ReturnType<typeof createApp>, port: number) {
  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", reject);
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function stopJobs(stopFns: StopFn[]) {
  for (const stop of stopFns) {
    try {
      stop();
    } catch (error) {
      logger.warn("Failed to stop background job", error);
    }
  }
}

function installShutdownHandlers(server: Server, stopFns: StopFn[]) {
  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode: number) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("API shutdown started", { reason, exitCode });

    const forcedExitTimer = setTimeout(() => {
      logger.error("Forced shutdown timeout reached", { reason });
      process.exit(1);
    }, 15_000);
    forcedExitTimer.unref();

    try {
      await stopJobs(stopFns);
      await closeServer(server);
      await db.end();
      clearTimeout(forcedExitTimer);
      process.exit(exitCode);
    } catch (error) {
      clearTimeout(forcedExitTimer);
      logger.error("API shutdown failed", error);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT", 0);
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM", 0);
  });

  process.once("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
    void shutdown("uncaughtException", 1);
  });

  process.once("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
    void shutdown("unhandledRejection", 1);
  });
}

async function startServer() {
  const stopBackgroundJobs: StopFn[] = [];

  try {
    await assertRuntimeDbCompatibility();

    if (env.b2bRunBackgroundJobs) {
      stopBackgroundJobs.push(startDeadlineJob());
      stopBackgroundJobs.push(startOutboxRelayJob());
      stopBackgroundJobs.push(startGlobalToursSyncJob());
      logger.info("Background jobs started", {
        deadlineProcessor: true,
        outboxRelay: true,
        globalToursSync: true,
        emailNotificationsEnabled: env.emailNotificationsEnabled,
        emailProvider: env.emailProvider,
        emailProviderFallback: env.emailProviderFallback || null,
      });
    } else {
      logger.info("Background jobs disabled by B2B_RUN_BACKGROUND_JOBS=false");
    }

    const app = createApp();
    const server = await listenServer(app, env.port);
    logger.info(`API listening on :${env.port}`);
    installShutdownHandlers(server, stopBackgroundJobs);
  } catch (error) {
    await stopJobs(stopBackgroundJobs);
    await db.end().catch(() => {
      // ignored during startup failure path
    });
    throw error;
  }
}

void startServer().catch((error) => {
  logger.error("API startup failed", error);
  process.exit(1);
});
