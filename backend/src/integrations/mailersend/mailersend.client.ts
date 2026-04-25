import { EmailParams, MailerSend, Recipient, Sender } from "mailersend";
import { env } from "../../config/env.js";
import { badRequest } from "../../shared/http/errors.js";

type MailerSendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
};

type ParsedMailbox = {
  email: string;
  name: string | null;
};

let mailerSendClient: MailerSend | null = null;

function isValidEmail(email: string) {
  return email.includes("@") && !email.startsWith("@") && !email.endsWith("@");
}

function parseMailbox(raw: string): ParsedMailbox {
  const value = String(raw || "").trim();
  if (!value) {
    throw badRequest("Email address is required");
  }

  const namedMatch = value.match(/^(.*)<([^<>]+)>$/);
  if (namedMatch) {
    const name = namedMatch[1].trim().replace(/^\"|\"$/g, "") || null;
    const email = namedMatch[2].trim().toLowerCase();
    if (!isValidEmail(email)) {
      throw badRequest("Invalid sender email format");
    }
    return { email, name };
  }

  const email = value.toLowerCase();
  if (!isValidEmail(email)) {
    throw badRequest("Invalid sender email format");
  }

  return { email, name: null };
}

function getMailerSendClient() {
  if (!env.mailersendApiKey) {
    throw badRequest("MailerSend configuration is incomplete");
  }

  if (!mailerSendClient) {
    mailerSendClient = new MailerSend({
      apiKey: env.mailersendApiKey,
    });
  }

  return mailerSendClient;
}

export async function sendEmailViaMailerSend(input: MailerSendEmailInput) {
  if (!env.emailFrom) {
    throw badRequest("EMAIL_FROM is required for notification emails");
  }

  const client = getMailerSendClient();
  const fromMailbox = parseMailbox(env.emailFrom);
  const sender = new Sender(fromMailbox.email, fromMailbox.name || undefined);
  const recipients = [new Recipient(input.to)];

  const params = new EmailParams()
    .setFrom(sender)
    .setTo(recipients)
    .setSubject(input.subject)
    .setHtml(input.html)
    .setText(input.text);

  const replyToRaw = String(input.replyTo || env.emailReplyTo || "").trim();
  if (replyToRaw) {
    const replyToMailbox = parseMailbox(replyToRaw);
    params.setReplyTo(
      new Sender(replyToMailbox.email, replyToMailbox.name || undefined),
    );
  }

  try {
    return await client.email.send(params);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error || "Failed to send email via MailerSend");
    throw new Error(`MailerSend email send failed: ${message.slice(0, 400)}`);
  }
}
