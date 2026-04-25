import { env } from "../../config/env.js";
import { badRequest } from "../../shared/http/errors.js";

type ResendSendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
  idempotencyKey?: string | null;
};

function requireResendConfig() {
  if (!env.resendApiKey) {
    throw badRequest("Resend configuration is incomplete");
  }

  if (!env.emailFrom) {
    throw badRequest("EMAIL_FROM is required for notification emails");
  }
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      raw: text,
    } as Record<string, unknown>;
  }
}

export async function sendEmailViaResend(input: ResendSendEmailInput) {
  requireResendConfig();

  const payload: Record<string, unknown> = {
    from: env.emailFrom,
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: input.html,
  };

  const replyTo = String(input.replyTo || env.emailReplyTo || "").trim();
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.resendApiKey}`,
    "Content-Type": "application/json",
  };

  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = await parseJsonSafe(response);
  if (!response.ok) {
    const errorText =
      String(body.message || body.error || body.raw || "Failed to send email via Resend").slice(0, 400);
    throw new Error(`Resend email send failed (${response.status}): ${errorText}`);
  }

  return body;
}
