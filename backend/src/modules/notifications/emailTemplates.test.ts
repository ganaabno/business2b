import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaymentDueSoonEmail,
  buildPendingUserApprovedEmail,
  buildPendingUserDeclinedEmail,
  buildSeatAccessApprovedEmail,
  buildSeatAccessRejectedEmail,
  buildSeatRequestApprovedEmail,
  buildSeatRequestCancelledEmail,
  buildSeatRequestRejectedEmail,
} from "./emailTemplates.js";

test("buildPendingUserApprovedEmail includes approved wording", () => {
  const result = buildPendingUserApprovedEmail({ appUrl: "https://gtrip.mn/login" });
  assert.match(result.subject, /approved/i);
  assert.match(result.text, /signup request/i);
  assert.match(result.html, /Open B2B portal/i);
});

test("buildPendingUserDeclinedEmail includes reason", () => {
  const result = buildPendingUserDeclinedEmail({
    reason: "Incomplete company info",
    appUrl: "https://gtrip.mn/login",
  });
  assert.match(result.subject, /declined/i);
  assert.match(result.text, /Incomplete company info/);
});

test("buildSeatAccessApprovedEmail includes expiry details", () => {
  const result = buildSeatAccessApprovedEmail({
    destination: "Korea",
    fromDate: "2026-05-01",
    toDate: "2026-05-31",
    expiresAt: "2026-04-04T10:00:00.000Z",
    appUrl: "https://gtrip.mn/login",
  });

  assert.match(result.subject, /Seat access approved/i);
  assert.match(result.text, /Approval expires at/i);
});

test("buildSeatAccessRejectedEmail includes reason", () => {
  const result = buildSeatAccessRejectedEmail({
    destination: "Japan",
    reason: "Date range mismatch",
    appUrl: "https://gtrip.mn/login",
  });

  assert.match(result.subject, /Seat access rejected/i);
  assert.match(result.text, /Date range mismatch/);
});

test("buildSeatRequest templates include request number", () => {
  const approved = buildSeatRequestApprovedEmail({
    requestNo: "SR-20260403-000001",
    destination: "Japan",
    travelDate: "2026-06-10",
    appUrl: "https://gtrip.mn/login",
  });
  const rejected = buildSeatRequestRejectedEmail({
    requestNo: "SR-20260403-000002",
    reason: "Not enough capacity",
    appUrl: "https://gtrip.mn/login",
  });
  const cancelled = buildSeatRequestCancelledEmail({
    requestNo: "SR-20260403-000003",
    status: "cancelled_expired",
    reason: "Deposit overdue",
    appUrl: "https://gtrip.mn/login",
  });

  assert.match(approved.subject, /SR-20260403-000001/);
  assert.match(rejected.subject, /SR-20260403-000002/);
  assert.match(cancelled.subject, /SR-20260403-000003/);
});

test("buildPaymentDueSoonEmail includes milestone and lead label", () => {
  const result = buildPaymentDueSoonEmail({
    requestNo: "SR-20260403-000004",
    destination: "Thailand",
    travelDate: "2026-07-12",
    milestoneCode: "deposit_6h",
    dueAt: "2026-04-04T08:00:00.000Z",
    leadLabel: "120 minutes before due",
    appUrl: "https://gtrip.mn/login",
  });

  assert.match(result.subject, /Payment due soon/i);
  assert.match(result.text, /120 minutes before due/);
  assert.match(result.text, /Deposit/);
});
