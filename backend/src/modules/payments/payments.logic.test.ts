import assert from "node:assert/strict";
import test from "node:test";
import {
  computeMilestoneAmountToPay,
  isPaidStatus,
  isMilestoneDeadlineExpired,
  selectDefaultPayableMilestone,
  sumPaidTotalMnt,
} from "./payments.logic.js";

function milestone(input: {
  id: string;
  code?: string;
  dueAt: string | null;
  required: number;
}) {
  return {
    id: input.id,
    code: input.code || "deposit_6h",
    due_at: input.dueAt,
    required_cumulative_mnt: input.required,
    status: "unpaid",
    satisfied_at: null,
  };
}

test("selectDefaultPayableMilestone prefers overdue milestone with highest required amount", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2026-04-05T12:00:00.000Z").getTime();

  try {
    const selected = selectDefaultPayableMilestone([
      milestone({ id: "m1", dueAt: "2026-04-05T09:00:00.000Z", required: 30000 }),
      milestone({ id: "m2", dueAt: "2026-04-05T10:00:00.000Z", required: 50000 }),
      milestone({ id: "m3", dueAt: "2026-04-05T13:00:00.000Z", required: 70000 }),
    ]);

    assert.equal(selected?.id, "m2");
  } finally {
    Date.now = originalNow;
  }
});

test("selectDefaultPayableMilestone resolves equal overdue amounts by earliest due time", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2026-04-05T12:00:00.000Z").getTime();

  try {
    const selected = selectDefaultPayableMilestone([
      milestone({ id: "m1", dueAt: "2026-04-05T10:00:00.000Z", required: 50000 }),
      milestone({ id: "m2", dueAt: "2026-04-05T11:00:00.000Z", required: 50000 }),
    ]);

    assert.equal(selected?.id, "m1");
  } finally {
    Date.now = originalNow;
  }
});

test("selectDefaultPayableMilestone returns earliest upcoming when nothing is overdue", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2026-04-05T09:00:00.000Z").getTime();

  try {
    const selected = selectDefaultPayableMilestone([
      milestone({ id: "m1", dueAt: "2026-04-05T13:00:00.000Z", required: 50000 }),
      milestone({ id: "m2", dueAt: "2026-04-05T11:00:00.000Z", required: 30000 }),
    ]);

    assert.equal(selected?.id, "m2");
  } finally {
    Date.now = originalNow;
  }
});

test("sumPaidTotalMnt counts only paid rows", () => {
  const total = sumPaidTotalMnt([
    { amount_mnt: 10000, status: "paid" },
    { amount_mnt: 25000, status: "partial" },
    { amount_mnt: "15000", status: "PAID" },
  ]);

  assert.equal(total, 25000);
});

test("computeMilestoneAmountToPay subtracts paid cumulative and clamps at zero", () => {
  const remaining = computeMilestoneAmountToPay(
    { required_cumulative_mnt: 60000 },
    [
      { amount_mnt: 10000, status: "paid" },
      { amount_mnt: 20000, status: "partial" },
      { amount_mnt: "25000", status: "paid" },
    ],
  );
  const zeroed = computeMilestoneAmountToPay(
    { required_cumulative_mnt: 10000 },
    [{ amount_mnt: 15000, status: "paid" }],
  );

  assert.equal(remaining, 25000);
  assert.equal(zeroed, 0);
});

test("isPaidStatus handles provider status variants", () => {
  assert.equal(isPaidStatus("paid"), true);
  assert.equal(isPaidStatus("SUCCESS"), true);
  assert.equal(isPaidStatus("completed"), true);
  assert.equal(isPaidStatus("invoice_paid"), true);
  assert.equal(isPaidStatus("pending"), false);
});

test("isMilestoneDeadlineExpired returns true when due time has passed", () => {
  const result = isMilestoneDeadlineExpired(
    { due_at: "2026-04-05T09:00:00.000Z" },
    new Date("2026-04-05T09:00:00.000Z").getTime(),
  );

  assert.equal(result, true);
});

test("isMilestoneDeadlineExpired returns false for upcoming milestones", () => {
  const result = isMilestoneDeadlineExpired(
    { due_at: "2026-04-05T11:00:00.000Z" },
    new Date("2026-04-05T09:00:00.000Z").getTime(),
  );

  assert.equal(result, false);
});
