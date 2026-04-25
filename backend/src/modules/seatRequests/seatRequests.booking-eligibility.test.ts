import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateSeatRequestBundleHealth } from "./seatRequests.service.js";

function member(input: {
  id: string;
  status: string;
  nextDeadlineAt?: string | null;
}) {
  return {
    id: input.id,
    request_no: `REQ-${input.id}`,
    status: input.status,
    serial_group_id: "group-1",
    serial_index: 1,
    serial_total: 10,
    next_deadline_at: input.nextDeadlineAt || null,
    current_payment_state: null,
  };
}

function milestone(input: {
  seatRequestId: string;
  code: string;
  dueAt?: string | null;
}) {
  return {
    seat_request_id: input.seatRequestId,
    code: input.code,
    due_at: input.dueAt || null,
    status: "pending",
  };
}

test("evaluateSeatRequestBundleHealth prefers rejected over milestone state", () => {
  const nowMs = Date.parse("2026-04-03T10:00:00.000Z");
  const result = evaluateSeatRequestBundleHealth({
    nowMs,
    members: [member({ id: "a", status: "rejected" })],
    unpaidMilestones: [
      milestone({
        seatRequestId: "a",
        code: "deposit_6h",
        dueAt: "2026-04-03T09:00:00.000Z",
      }),
    ],
  });

  assert.equal(result.bundleHealth, "blocked");
  assert.equal(result.blockReasonCode, "member_rejected");
  assert.equal(result.blockingSeatRequestId, "a");
});

test("evaluateSeatRequestBundleHealth maps cancelled_expired to deposit_timeout", () => {
  const result = evaluateSeatRequestBundleHealth({
    members: [member({ id: "b", status: "cancelled_expired" })],
    unpaidMilestones: [],
  });

  assert.equal(result.bundleHealth, "blocked");
  assert.equal(result.blockReasonCode, "deposit_timeout");
  assert.equal(result.blockingSeatRequestId, "b");
});

test("evaluateSeatRequestBundleHealth marks overdue non-deposit milestone", () => {
  const nowMs = Date.parse("2026-04-03T12:00:00.000Z");
  const result = evaluateSeatRequestBundleHealth({
    nowMs,
    members: [member({ id: "c", status: "confirmed_deposit_paid" })],
    unpaidMilestones: [
      milestone({
        seatRequestId: "c",
        code: "min_paid_50pct_at_14d",
        dueAt: "2026-04-03T11:00:00.000Z",
      }),
    ],
  });

  assert.equal(result.bundleHealth, "blocked");
  assert.equal(result.blockReasonCode, "overdue_milestone");
  assert.equal(result.blockingSeatRequestId, "c");
});

test("evaluateSeatRequestBundleHealth marks pending payment when unpaid remains", () => {
  const nowMs = Date.parse("2026-04-03T12:00:00.000Z");
  const result = evaluateSeatRequestBundleHealth({
    nowMs,
    members: [
      member({
        id: "d",
        status: "approved_waiting_deposit",
        nextDeadlineAt: "2026-04-03T13:00:00.000Z",
      }),
    ],
    unpaidMilestones: [
      milestone({
        seatRequestId: "d",
        code: "deposit_6h",
        dueAt: "2026-04-03T13:00:00.000Z",
      }),
    ],
  });

  assert.equal(result.bundleHealth, "payment_due");
  assert.equal(result.blockReasonCode, "payment_pending");
  assert.equal(result.blockingSeatRequestId, "d");
  assert.equal(result.nextDeadlineAt, "2026-04-03T13:00:00.000Z");
});

test("evaluateSeatRequestBundleHealth returns healthy when all clear", () => {
  const result = evaluateSeatRequestBundleHealth({
    members: [member({ id: "e", status: "confirmed_deposit_paid" })],
    unpaidMilestones: [],
  });

  assert.equal(result.bundleHealth, "healthy");
  assert.equal(result.blockReasonCode, null);
  assert.equal(result.blockingSeatRequestId, null);
});
