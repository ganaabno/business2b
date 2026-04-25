import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../shared/http/errors.js";
import {
  parseCreateSeatRequestInput,
  parseDecisionInput,
} from "./seatRequests.schema.js";

test("parseCreateSeatRequestInput parses valid payload", () => {
  const parsed = parseCreateSeatRequestInput({
    tourId: "tour-1",
    destination: "Beijing",
    travelDate: "2026-04-22",
    requestedSeats: 4,
    unitPriceMnt: 1250000,
    requestedRole: "agent",
  });

  assert.deepEqual(parsed, {
    tourId: "tour-1",
    destination: "Beijing",
    travelDate: "2026-04-22",
    requestedSeats: 4,
    unitPriceMnt: 1250000,
    requestedRole: "agent",
  });
});

test("parseCreateSeatRequestInput rejects invalid date", () => {
  assert.throws(
    () =>
      parseCreateSeatRequestInput({
        tourId: "tour-1",
        destination: "Beijing",
        travelDate: "22-04-2026",
        requestedSeats: 1,
        unitPriceMnt: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseCreateSeatRequestInput rejects non-positive integer seats", () => {
  assert.throws(
    () =>
      parseCreateSeatRequestInput({
        tourId: "tour-1",
        destination: "Beijing",
        travelDate: "2026-04-22",
        requestedSeats: 0,
        unitPriceMnt: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );

  assert.throws(
    () =>
      parseCreateSeatRequestInput({
        tourId: "tour-1",
        destination: "Beijing",
        travelDate: "2026-04-22",
        requestedSeats: 1.5,
        unitPriceMnt: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseCreateSeatRequestInput rejects negative price and invalid requestedRole", () => {
  assert.throws(
    () =>
      parseCreateSeatRequestInput({
        tourId: "tour-1",
        destination: "Beijing",
        travelDate: "2026-04-22",
        requestedSeats: 2,
        unitPriceMnt: -1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );

  assert.throws(
    () =>
      parseCreateSeatRequestInput({
        tourId: "tour-1",
        destination: "Beijing",
        travelDate: "2026-04-22",
        requestedSeats: 2,
        unitPriceMnt: 100,
        requestedRole: "manager",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseDecisionInput maps note/reason as nullable strings", () => {
  assert.deepEqual(parseDecisionInput({}), { note: null, reason: null });
  assert.deepEqual(parseDecisionInput({ note: "ok", reason: "x" }), {
    note: "ok",
    reason: "x",
  });
});
