import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionSeatRequest } from "./seatRequests.state-machine.js";

test("pending allows approve/reject", () => {
  assert.equal(canTransitionSeatRequest("pending", "approve"), true);
  assert.equal(canTransitionSeatRequest("pending", "reject"), true);
});

test("approved_waiting_deposit blocks reject", () => {
  assert.equal(canTransitionSeatRequest("approved_waiting_deposit", "reject"), false);
});

test("confirmed_deposit_paid allows complete only among progression actions", () => {
  assert.equal(canTransitionSeatRequest("confirmed_deposit_paid", "complete"), true);
  assert.equal(canTransitionSeatRequest("confirmed_deposit_paid", "deposit_paid"), false);
});
