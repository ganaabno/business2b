import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger.js";
import { startDeadlineJob } from "./jobs/processDeadlines.job.js";
import { startOutboxRelayJob } from "./jobs/outboxRelay.job.js";
import { startGlobalToursSyncJob } from "./jobs/syncGlobalTours.job.js";

const app = createApp();

app.listen(env.port, () => {
  logger.info(`API listening on :${env.port}`);
});

startGlobalToursSyncJob();

if (env.b2bSeatRequestFlowEnabled) {
  startDeadlineJob();
  startOutboxRelayJob();
} else {
  logger.info("B2B jobs skipped because seat request flow flag is disabled");
}
