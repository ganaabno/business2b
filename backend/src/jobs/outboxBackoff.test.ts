import assert from "node:assert/strict";
import test from "node:test";
import { calculateOutboxBackoffSeconds } from "./outboxBackoff.js";

test("outbox backoff increases exponentially", () => {
  assert.equal(calculateOutboxBackoffSeconds(0, 0), 30);
  assert.equal(calculateOutboxBackoffSeconds(1, 0), 60);
  assert.equal(calculateOutboxBackoffSeconds(2, 0), 120);
});

test("outbox backoff is capped", () => {
  assert.equal(calculateOutboxBackoffSeconds(20, 0), 1800);
});

test("outbox backoff includes bounded jitter", () => {
  const value = calculateOutboxBackoffSeconds(2, 0.9);
  assert.equal(value >= 120 && value <= 144, true);
});
