import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type WebhookEvent = 'quote_created' | 'quote_converted' | 'booking_confirmed';

const webhookUrls: Record<WebhookEvent, string> = {
  quote_created: process.env.WEBHOOK_QUOTE_CREATED_URL || "",
  quote_converted: process.env.WEBHOOK_QUOTE_CONVERTED_URL || "",
  booking_confirmed: process.env.WEBHOOK_BOOKING_CONFIRMED_URL || "",
};

export async function sendWebhook(event: WebhookEvent, data: Record<string, unknown>) {
  const url = webhookUrls[event];
  if (!url) {
    logger.debug("Webhook not configured", { event });
    return;
  }

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GTrip-Event": event,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn("Webhook failed", { event, status: response.status });
      return;
    }

    logger.info("Webhook sent", { event, status: response.status });
  } catch (error) {
    logger.error("Webhook error", { event, error });
  }
}

export async function notifyQuoteCreated(quote: { id: string; destination: string; total_price: number; creator_id: string }) {
  await sendWebhook("quote_created", {
    quote_id: quote.id,
    destination: quote.destination,
    total_price: quote.total_price,
    creator_id: quote.creator_id,
  });
}

export async function notifyQuoteConverted(quoteId: string, bookingId: string, destination: string) {
  await sendWebhook("quote_converted", {
    quote_id: quoteId,
    booking_id: bookingId,
    destination,
  });
}

export async function notifyBookingConfirmed(bookingId: string, totalPrice: number) {
  await sendWebhook("booking_confirmed", {
    booking_id: bookingId,
    total_price: totalPrice,
  });
}