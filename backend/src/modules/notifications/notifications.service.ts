import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "../../config/env.js";
import { q } from "../../db/transaction.js";
import { sendEmailViaMailerSend } from "../../integrations/mailersend/mailersend.client.js";
import { sendEmailViaResend } from "../../integrations/resend/resend.client.js";
import { logger } from "../../shared/logger.js";
import {
  buildAdminTestEmail,
  buildPaymentDueSoonEmail,
  buildPendingUserApprovedEmail,
  buildPendingUserDeclinedEmail,
  buildSeatAccessApprovedEmail,
  buildSeatAccessRejectedEmail,
  buildSeatRequestApprovedEmail,
  buildSeatRequestCancelledEmail,
  buildSeatRequestRejectedEmail,
} from "./emailTemplates.js";

const NOTIFICATION_EMAIL_EVENT_TYPE = "notification.email.send";
const NOTIFICATION_EMAIL_DEDUP_INDEX = "ux_integration_outbox_email_dedup";

type NotificationEmailTemplateId =
  | "pending_user.approved"
  | "pending_user.declined"
  | "seat_access.approved"
  | "seat_access.rejected"
  | "seat_request.approved"
  | "seat_request.rejected"
  | "seat_request.cancelled"
  | "payment.reminder_due_soon"
  | "admin.test";

type NotificationEmailPayload = {
  version: 1;
  channel: "email";
  template: NotificationEmailTemplateId;
  dedupKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
  metadata: Record<string, unknown>;
};

type NotificationRelayEvent = {
  id: string;
  event_type: string;
  payload: unknown;
};

type EmailProvider = "mailersend" | "resend";

type PgErrorLike = {
  code?: string;
  constraint?: string;
  message?: string;
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeProvider(value: unknown): EmailProvider | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "mailersend" || normalized === "resend") {
    return normalized;
  }
  return null;
}

function resolveRelayProviders() {
  const primary = normalizeProvider(env.emailProvider);
  if (!primary) {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${normalizeText(env.emailProvider) || "(empty)"}`);
  }

  const fallback = normalizeProvider(env.emailProviderFallback);
  if (!fallback || fallback === primary) {
    return [primary] as EmailProvider[];
  }

  return [primary, fallback] as EmailProvider[];
}

function normalizeEmail(value: unknown) {
  const email = normalizeText(value).toLowerCase();
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return "";
  }
  return email;
}

function resolveAppUrl(path: string) {
  const base = normalizeText(env.emailAppBaseUrl).replace(/\/$/, "");
  if (!base) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function isDuplicateOutboxNotificationError(error: unknown) {
  const dbError = error as PgErrorLike;
  return (
    dbError?.code === "23505" &&
    (dbError.constraint === NOTIFICATION_EMAIL_DEDUP_INDEX ||
      normalizeText(dbError.message).includes(NOTIFICATION_EMAIL_DEDUP_INDEX))
  );
}

async function runQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
): Promise<QueryResult<T>> {
  if (client) {
    return client.query<T>(sql, params);
  }
  return q<T>(sql, params);
}

function createPayload(params: {
  template: NotificationEmailTemplateId;
  dedupKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  metadata?: Record<string, unknown>;
}): NotificationEmailPayload {
  return {
    version: 1,
    channel: "email",
    template: params.template,
    dedupKey: params.dedupKey,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: normalizeText(env.emailReplyTo) || null,
    metadata: params.metadata || {},
  };
}

async function enqueueNotificationEmail(params: {
  dedupKey: string;
  to: string | null | undefined;
  template: NotificationEmailTemplateId;
  aggregateId: string;
  subject: string;
  text: string;
  html: string;
  metadata?: Record<string, unknown>;
  client?: PoolClient;
}) {
  if (!env.emailNotificationsEnabled) {
    return false;
  }

  const to = normalizeEmail(params.to);
  if (!to) {
    return false;
  }

  const dedupKey = normalizeText(params.dedupKey);
  if (!dedupKey) {
    return false;
  }

  const payload = createPayload({
    template: params.template,
    dedupKey,
    to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    metadata: params.metadata,
  });

  try {
    const result = await runQuery(
      `
      insert into public.integration_outbox (aggregate_type, aggregate_id, event_type, payload)
      select
        'notification',
        $1::text,
        $2::text,
        $3::jsonb
      where not exists (
        select 1
        from public.integration_outbox existing
        where existing.event_type = $2::text
          and coalesce(existing.payload ->> 'dedupKey', '') = $4::text
      )
      `,
      [
        params.aggregateId,
        NOTIFICATION_EMAIL_EVENT_TYPE,
        JSON.stringify(payload),
        dedupKey,
      ],
      params.client,
    );

    return Boolean(result.rowCount && result.rowCount > 0);
  } catch (error) {
    if (isDuplicateOutboxNotificationError(error)) {
      return false;
    }
    throw error;
  }
}

function parseNotificationEmailPayload(rawPayload: unknown): NotificationEmailPayload {
  if (!rawPayload || typeof rawPayload !== "object") {
    throw new Error("Invalid notification payload: expected object");
  }

  const payload = rawPayload as Record<string, unknown>;
  const version = Number(payload.version || 0);
  if (version !== 1) {
    throw new Error(`Unsupported notification payload version: ${version}`);
  }

  if (normalizeText(payload.channel) !== "email") {
    throw new Error("Invalid notification payload: channel must be email");
  }

  const to = normalizeEmail(payload.to);
  const subject = normalizeText(payload.subject);
  const text = normalizeText(payload.text);
  const html = normalizeText(payload.html);
  const dedupKey = normalizeText(payload.dedupKey);
  const template = normalizeText(payload.template) as NotificationEmailTemplateId;

  if (!to || !subject || !text || !html || !dedupKey || !template) {
    throw new Error("Invalid notification payload: missing required email fields");
  }

  const replyTo = normalizeText(payload.replyTo) || null;
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>)
      : {};

  return {
    version: 1,
    channel: "email",
    template,
    dedupKey,
    to,
    subject,
    text,
    html,
    replyTo,
    metadata,
  };
}

export function isNotificationEmailOutboxEvent(eventType: string) {
  return normalizeText(eventType) === NOTIFICATION_EMAIL_EVENT_TYPE;
}

export async function relayNotificationEmailOutboxEvent(event: NotificationRelayEvent) {
  const payload = parseNotificationEmailPayload(event.payload);

  if (!env.emailNotificationsEnabled) {
    logger.info("notification.email.skipped.disabled", {
      eventId: event.id,
      dedupKey: payload.dedupKey,
      template: payload.template,
    });
    return;
  }

  const providers = resolveRelayProviders();
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      if (provider === "mailersend") {
        await sendEmailViaMailerSend({
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
          replyTo: payload.replyTo,
        });
      } else {
        await sendEmailViaResend({
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
          replyTo: payload.replyTo,
          idempotencyKey: payload.dedupKey || event.id,
        });
      }

      logger.info("notification.email.sent", {
        eventId: event.id,
        template: payload.template,
        dedupKey: payload.dedupKey,
        provider,
        usedFallback: provider !== providers[0],
      });
      return;
    } catch (error) {
      lastError = error;
      logger.warn("notification.email.provider_failed", {
        eventId: event.id,
        template: payload.template,
        dedupKey: payload.dedupKey,
        provider,
        error,
      });
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new Error("Email relay failed for all configured providers"));
}

export async function getUserEmailForNotification(userId: string, client?: PoolClient) {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) {
    return null;
  }

  const { rows } = await runQuery<{ email: string | null }>(
    `
    select nullif(btrim(email), '') as email
    from public.users
    where id::text = $1
    limit 1
    `,
    [normalizedUserId],
    client,
  );

  return normalizeEmail(rows[0]?.email) || null;
}

export async function enqueuePendingUserDecisionEmail(params: {
  pendingUserId: string;
  recipientEmail: string | null;
  status: "approved" | "declined";
  reason: string | null;
  client?: PoolClient;
}) {
  const appUrl = resolveAppUrl("/login");
  const content =
    params.status === "approved"
      ? buildPendingUserApprovedEmail({ appUrl })
      : buildPendingUserDeclinedEmail({ reason: params.reason, appUrl });

  return enqueueNotificationEmail({
    dedupKey: `pending_user:${params.pendingUserId}:${params.status}`,
    to: params.recipientEmail,
    template: `pending_user.${params.status}`,
    aggregateId: params.pendingUserId,
    subject: content.subject,
    text: content.text,
    html: content.html,
    metadata: {
      pendingUserId: params.pendingUserId,
      status: params.status,
    },
    client: params.client,
  });
}

export async function enqueueSeatAccessDecisionEmail(params: {
  seatAccessRequestId: string;
  recipientEmail: string | null;
  status: "approved" | "rejected";
  destination: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
  expiresAt: string | null;
  client?: PoolClient;
}) {
  const appUrl = resolveAppUrl("/login");
  const content =
    params.status === "approved"
      ? buildSeatAccessApprovedEmail({
          destination: params.destination,
          fromDate: params.fromDate,
          toDate: params.toDate,
          expiresAt: params.expiresAt,
          appUrl,
        })
      : buildSeatAccessRejectedEmail({
          destination: params.destination,
          reason: params.reason,
          appUrl,
        });

  return enqueueNotificationEmail({
    dedupKey: `seat_access:${params.seatAccessRequestId}:${params.status}`,
    to: params.recipientEmail,
    template: `seat_access.${params.status}`,
    aggregateId: params.seatAccessRequestId,
    subject: content.subject,
    text: content.text,
    html: content.html,
    metadata: {
      seatAccessRequestId: params.seatAccessRequestId,
      status: params.status,
    },
    client: params.client,
  });
}

export async function enqueueSeatRequestStatusEmail(params: {
  seatRequestId: string;
  requestNo: string;
  recipientEmail: string | null;
  status:
    | "approved"
    | "rejected"
    | "cancelled_by_admin"
    | "cancelled_by_requester"
    | "cancelled_expired";
  reason: string | null;
  destination: string;
  travelDate: string;
  client?: PoolClient;
}) {
  const appUrl = resolveAppUrl("/login");
  const content =
    params.status === "approved"
      ? buildSeatRequestApprovedEmail({
          requestNo: params.requestNo,
          destination: params.destination,
          travelDate: params.travelDate,
          appUrl,
        })
      : params.status === "rejected"
        ? buildSeatRequestRejectedEmail({
            requestNo: params.requestNo,
            reason: params.reason,
            appUrl,
          })
        : buildSeatRequestCancelledEmail({
            requestNo: params.requestNo,
            status: params.status,
            reason: params.reason,
            appUrl,
          });

  const template: NotificationEmailTemplateId =
    params.status === "approved"
      ? "seat_request.approved"
      : params.status === "rejected"
        ? "seat_request.rejected"
        : "seat_request.cancelled";

  return enqueueNotificationEmail({
    dedupKey: `seat_request:${params.seatRequestId}:${params.status}`,
    to: params.recipientEmail,
    template,
    aggregateId: params.seatRequestId,
    subject: content.subject,
    text: content.text,
    html: content.html,
    metadata: {
      seatRequestId: params.seatRequestId,
      status: params.status,
      requestNo: params.requestNo,
    },
    client: params.client,
  });
}

export async function enqueuePaymentDueSoonEmail(params: {
  seatRequestId: string;
  milestoneId: string;
  requestNo: string;
  recipientEmail: string | null;
  milestoneCode: string;
  dueAt: string;
  destination: string;
  travelDate: string;
  leadLabel: string;
  leadKey: string;
  client?: PoolClient;
}) {
  const appUrl = resolveAppUrl("/login");
  const content = buildPaymentDueSoonEmail({
    requestNo: params.requestNo,
    destination: params.destination,
    travelDate: params.travelDate,
    milestoneCode: params.milestoneCode,
    dueAt: params.dueAt,
    leadLabel: params.leadLabel,
    appUrl,
  });

  return enqueueNotificationEmail({
    dedupKey: `payment_due_soon:${params.milestoneId}:${params.leadKey}`,
    to: params.recipientEmail,
    template: "payment.reminder_due_soon",
    aggregateId: params.seatRequestId,
    subject: content.subject,
    text: content.text,
    html: content.html,
    metadata: {
      seatRequestId: params.seatRequestId,
      milestoneId: params.milestoneId,
      milestoneCode: params.milestoneCode,
      dueAt: params.dueAt,
      leadLabel: params.leadLabel,
      leadKey: params.leadKey,
    },
    client: params.client,
  });
}

export async function enqueueAdminTestEmail(params: {
  recipientEmail: string;
  requestedByUserId: string;
  client?: PoolClient;
}) {
  const appUrl = resolveAppUrl("/admin");
  const content = buildAdminTestEmail({
    requestedByUserId: params.requestedByUserId,
    generatedAtIso: new Date().toISOString(),
    appUrl,
  });

  return enqueueNotificationEmail({
    dedupKey: `admin_test:${params.requestedByUserId}:${Date.now()}`,
    to: params.recipientEmail,
    template: "admin.test",
    aggregateId: params.requestedByUserId,
    subject: content.subject,
    text: content.text,
    html: content.html,
    metadata: {
      requestedByUserId: params.requestedByUserId,
    },
    client: params.client,
  });
}
