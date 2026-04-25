import { q } from "../db/transaction.js";
import { syncOutboxEventToNeon } from "../integrations/neon/neonSync.service.js";
import {
  isNotificationEmailOutboxEvent,
  relayNotificationEmailOutboxEvent,
} from "../modules/notifications/notifications.service.js";
import { logger } from "../shared/logger.js";
import { calculateOutboxBackoffSeconds } from "./outboxBackoff.js";
import { env } from "../config/env.js";

type OutboxRow = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
  retry_count: number;
};

const OUTBOX_LOCK_KEY = 9242061;
let inProgress = false;

async function claimOutboxRows(limit: number): Promise<OutboxRow[]> {
  await q(
    `
    update public.integration_outbox
    set status = 'pending'
    where status = 'processing'
      and next_retry_at is not null
      and next_retry_at < now() - interval '15 minutes'
    `,
  );

  const { rows } = await q<OutboxRow>(
    `
    with claim as (
      select id
      from public.integration_outbox
      where status = 'pending'
        and coalesce(next_retry_at, now()) <= now()
      order by created_at asc
      limit $1
      for update skip locked
    )
    update public.integration_outbox o
    set status = 'processing',
        next_retry_at = now()
    from claim
    where o.id = claim.id
    returning o.id::text, o.aggregate_type, o.aggregate_id, o.event_type, o.payload, o.retry_count
    `,
    [limit],
  );

  return rows;
}

async function withOutboxAdvisoryLock(runner: () => Promise<void>) {
  const { rows } = await q<{ locked: boolean }>(
    `select pg_try_advisory_lock($1) as locked`,
    [OUTBOX_LOCK_KEY],
  );

  if (!rows[0]?.locked) {
    return;
  }

  try {
    await runner();
  } finally {
    await q(`select pg_advisory_unlock($1)`, [OUTBOX_LOCK_KEY]);
  }
}

async function processOutboxBatch() {
  const rows = await claimOutboxRows(100);

  for (const row of rows) {
    try {
      if (isNotificationEmailOutboxEvent(row.event_type)) {
        await relayNotificationEmailOutboxEvent(row);
      } else {
        await syncOutboxEventToNeon(row);
      }
      await q(
        `
        update public.integration_outbox
        set status = 'processed', processed_at = now(), next_retry_at = null
        where id = $1::uuid
        `,
        [row.id],
      );
    } catch (error) {
      logger.error("Outbox relay failed", { id: row.id, error });
      const nextRetryCount = row.retry_count + 1;
      const deadLetter = nextRetryCount >= env.outboxMaxRetries;
      const backoffSeconds = calculateOutboxBackoffSeconds(nextRetryCount);

      await q(
        `
        update public.integration_outbox
        set retry_count = $2,
            status = case when $3 then 'dead_letter' else 'pending' end,
            next_retry_at = case
              when $3 then null
              else now() + make_interval(secs => $4)
            end,
            processed_at = null
        where id = $1::uuid
        `,
        [row.id, nextRetryCount, deadLetter, backoffSeconds],
      );

      if (deadLetter) {
        logger.warn("Outbox event moved to dead-letter", {
          id: row.id,
          aggregate: `${row.aggregate_type}:${row.aggregate_id}`,
          eventType: row.event_type,
          retryCount: nextRetryCount,
        });
      }
    }
  }
}

export function startOutboxRelayJob() {
  const run = async () => {
    if (inProgress) {
      return;
    }

    inProgress = true;
    try {
      await withOutboxAdvisoryLock(async () => {
        await processOutboxBatch();
      });
    } catch (error) {
      logger.error("Outbox relay job failed", error);
    } finally {
      inProgress = false;
    }
  };

  void run();
  const timer = setInterval(() => {
    void run();
  }, 30_000);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
