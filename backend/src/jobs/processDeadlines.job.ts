import { q, withTransaction } from "../db/transaction.js";
import { logger } from "../shared/logger.js";

const DEADLINE_LOCK_KEY = 9242062;
let inProgress = false;

async function withDeadlineAdvisoryLock(runner: () => Promise<void>) {
  const { rows } = await q<{ locked: boolean }>(
    `select pg_try_advisory_lock($1) as locked`,
    [DEADLINE_LOCK_KEY],
  );

  if (!rows[0]?.locked) {
    return;
  }

  try {
    await runner();
  } finally {
    await q(`select pg_advisory_unlock($1)`, [DEADLINE_LOCK_KEY]);
  }
}

async function processExpiredDeposits() {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `
      update public.seat_requests
      set status = 'cancelled_expired', cancelled_at = now(), updated_at = now()
      where status = 'approved_waiting_deposit'
        and deposit_due_at is not null
        and deposit_due_at < now()
        and id in (
          select m.seat_request_id
          from public.seat_request_payment_milestones m
          where m.code = 'deposit_6h'
            and m.status <> 'paid'
        )
      returning id::text
      `,
    );

    if (rows.length > 0) {
      logger.warn("Auto-cancelled expired deposit requests", {
        count: rows.length,
        sampleRequestIds: rows.slice(0, 20).map((r) => r.id),
      });
    }
  });
}

async function refreshMilestoneStatuses() {
  const startedAt = Date.now();
  const { rows } = await q<{ id: string }>(
    `
    select distinct seat_request_id::text as id
    from public.seat_request_payment_milestones
    where status in ('unpaid', 'partial', 'overdue')
    order by seat_request_id
    limit 5000
    `,
  );

  for (const row of rows) {
    await q(`select public.fn_sync_milestone_statuses($1::uuid)`, [row.id]);
  }

  const { rows: blockedRows } = await q<{ count: string }>(
    `
    select count(*)::text as count
    from public.seat_request_payment_milestones m
    where m.due_at <= now()
      and m.status <> 'paid'
    `,
  );

  logger.info("slo.deadline_job.run", {
    processedRequests: rows.length,
    bookingBlockViolations: Number(blockedRows[0]?.count || "0"),
    lagMs: Date.now() - startedAt,
  });
}

export function startDeadlineJob() {
  const run = async () => {
    if (inProgress) {
      return;
    }

    inProgress = true;
    try {
      await withDeadlineAdvisoryLock(async () => {
        await refreshMilestoneStatuses();
        await processExpiredDeposits();
      });
    } catch (error) {
      logger.error("Deadline processor failed", error);
    } finally {
      inProgress = false;
    }
  };

  void run();
  setInterval(run, 60_000);
}
