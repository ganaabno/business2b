import { logger } from "../../shared/logger.js";
import { env } from "../../config/env.js";

export async function syncOutboxEventToNeon(event: {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
}) {
  if (!env.neonWriteUrl) {
    throw new Error("NEON_WRITE_URL is not configured");
  }

  const contract = {
    eventId: event.id,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    eventType: event.event_type,
    occurredAt: new Date().toISOString(),
    payload: event.payload,
  };

  const response = await fetch(env.neonWriteUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": event.id,
      "x-event-type": event.event_type,
    },
    body: JSON.stringify(contract),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neon sync failed (${response.status}): ${text.slice(0, 300)}`);
  }

  logger.info("Neon sync placeholder: event captured", {
    id: event.id,
    type: event.event_type,
    aggregate: `${event.aggregate_type}:${event.aggregate_id}`,
  });

  return { ok: true };
}
