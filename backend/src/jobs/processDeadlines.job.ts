import { q, withTransaction } from "../db/transaction.js";
import { env } from "../config/env.js";
import {
  enqueuePaymentDueSoonEmail,
  enqueueSeatRequestStatusEmail,
} from "../modules/notifications/notifications.service.js";
import { logger } from "../shared/logger.js";

const DEADLINE_LOCK_KEY = 9242062;
let inProgress = false;
const DEPOSIT_TIMEOUT_DECLINE_REASON =
  "Deposit was not paid within 6 hours. Request was declined automatically.";

type AutoCancelledRequestRow = {
  id: string;
  request_no: string;
  destination: string;
  travel_date: string;
  rejection_reason: string | null;
  recipient_email: string | null;
};

type UpcomingReminderRow = {
  milestone_id: string;
  milestone_code: string;
  due_at: string;
  seat_request_id: string;
  request_no: string;
  destination: string;
  travel_date: string;
  recipient_email: string | null;
};

function resolveReminderWindow(code: string) {
  const normalizedCode = String(code || "").trim().toLowerCase();
  if (normalizedCode === "deposit_6h") {
    const minutes = Math.max(1, env.paymentReminderDepositLeadMinutes);
    return {
      leadLabel: `${minutes} minutes before due`,
      leadKey: `${minutes}m`,
    };
  }

  const hours = Math.max(1, env.paymentReminderStandardLeadHours);
  return {
    leadLabel: `${hours} hours before due`,
    leadKey: `${hours}h`,
  };
}

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
    const { rows } = await client.query<AutoCancelledRequestRow>(
      `
      with expired_seed as (
        select
          sr.id,
          coalesce(sr.serial_group_id, sr.id) as serial_group_id
        from public.seat_requests sr
        where sr.status = 'approved_waiting_deposit'
          and sr.deposit_due_at is not null
          and sr.deposit_due_at < now()
          and exists (
            select 1
            from public.seat_request_payment_milestones m
            where m.seat_request_id = sr.id
              and m.code = 'deposit_6h'
              and m.status::text <> 'paid'
          )
      ),
      target_groups as (
        select distinct serial_group_id
        from expired_seed
      ),
      updated as (
        update public.seat_requests sr
        set
          status = 'cancelled_expired',
          cancelled_at = now(),
          rejection_reason = coalesce(
            nullif(trim(coalesce(sr.rejection_reason, '')), ''),
            $1
          ),
          updated_at = now()
        where coalesce(sr.serial_group_id, sr.id) in (
          select tg.serial_group_id from target_groups tg
        )
          and sr.status in ('pending', 'approved_waiting_deposit', 'confirmed_deposit_paid')
        returning
          sr.id::text,
          sr.request_no,
          sr.destination,
          sr.travel_date::text,
          sr.rejection_reason
      )
      select
        updated.id,
        updated.request_no,
        updated.destination,
        updated.travel_date,
        updated.rejection_reason,
        nullif(btrim(u.email), '') as recipient_email
      from updated
      left join public.seat_requests sr on sr.id::text = updated.id
      left join public.users u on u.id = sr.requester_user_id
      `,
      [DEPOSIT_TIMEOUT_DECLINE_REASON],
    );

    if (rows.length > 0) {
      logger.warn("Auto-cancelled expired deposit requests", {
        count: rows.length,
        sampleRequestIds: rows.slice(0, 20).map((r) => r.id),
      });

      for (const row of rows) {
        try {
          await enqueueSeatRequestStatusEmail({
            seatRequestId: row.id,
            requestNo: row.request_no,
            recipientEmail: row.recipient_email,
            status: "cancelled_expired",
            reason: row.rejection_reason,
            destination: row.destination,
            travelDate: row.travel_date,
            client,
          });
        } catch (error) {
          logger.warn("notification.seat_request.cancelled_expired.enqueue_failed", {
            seatRequestId: row.id,
            error,
          });
        }
      }
    }
  });
}

async function refreshMilestoneStatuses() {
  const startedAt = Date.now();
  const { rows } = await q<{ id: string }>(
    `
    select distinct seat_request_id::text as id
    from public.seat_request_payment_milestones
    where status::text <> 'paid'
    order by id
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

async function enqueueDueSoonPaymentReminders() {
  const { rows } = await q<UpcomingReminderRow>(
    `
    select
      m.id::text as milestone_id,
      m.code::text as milestone_code,
      m.due_at,
      sr.id::text as seat_request_id,
      sr.request_no,
      sr.destination,
      sr.travel_date::text,
      nullif(btrim(u.email), '') as recipient_email
    from public.seat_request_payment_milestones m
    join public.seat_requests sr on sr.id = m.seat_request_id
    left join public.users u on u.id = sr.requester_user_id
    where m.status::text in ('unpaid', 'partial')
      and m.due_at > now()
      and sr.status::text in ('approved_waiting_deposit', 'confirmed_deposit_paid', 'completed')
      and (
        (
          m.code = 'deposit_6h'
          and m.due_at <= now() + make_interval(mins => $1::int)
        )
        or (
          m.code <> 'deposit_6h'
          and m.due_at <= now() + make_interval(hours => $2::int)
        )
      )
    order by m.due_at asc
    limit 1000
    `,
    [
      Math.max(1, env.paymentReminderDepositLeadMinutes),
      Math.max(1, env.paymentReminderStandardLeadHours),
    ],
  );

  let queuedCount = 0;
  for (const row of rows) {
    const window = resolveReminderWindow(row.milestone_code);
    try {
      const queued = await enqueuePaymentDueSoonEmail({
        seatRequestId: row.seat_request_id,
        milestoneId: row.milestone_id,
        requestNo: row.request_no,
        recipientEmail: row.recipient_email,
        milestoneCode: row.milestone_code,
        dueAt: row.due_at,
        destination: row.destination,
        travelDate: row.travel_date,
        leadLabel: window.leadLabel,
        leadKey: window.leadKey,
      });
      if (queued) {
        queuedCount += 1;
      }
    } catch (error) {
      logger.warn("notification.payment_due_soon.enqueue_failed", {
        seatRequestId: row.seat_request_id,
        milestoneId: row.milestone_id,
        error,
      });
    }
  }

  if (queuedCount > 0) {
    logger.info("notification.payment_due_soon.queued", {
      queuedCount,
      scannedRows: rows.length,
    });
  }
}

export function startDeadlineJob() {
  const run = async () => {
    if (inProgress) {
      return;
    }

    inProgress = true;
    try {
      await withDeadlineAdvisoryLock(async () => {
        try {
          await refreshMilestoneStatuses();
        } catch (error) {
          logger.error("Deadline milestone refresh failed", error);
        }

        try {
          await enqueueDueSoonPaymentReminders();
        } catch (error) {
          logger.error("Deadline payment reminder enqueue failed", error);
        }

        try {
          await processExpiredDeposits();
        } catch (error) {
          logger.error("Deadline deposit expiry failed", error);
        }
      });
    } catch (error) {
      logger.error("Deadline processor failed", error);
    } finally {
      inProgress = false;
    }
  };

  void run();
  const timer = setInterval(() => {
    void run();
  }, 60_000);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
