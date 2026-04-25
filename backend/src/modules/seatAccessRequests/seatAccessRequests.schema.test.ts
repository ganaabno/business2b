import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../shared/http/errors.js";
import {
  parseCreateSeatAccessRequestInput,
  parseSeatAccessDecisionInput,
  parseSeatAccessRequestListFilters,
  parseSelectTourFromAccessInput,
} from "./seatAccessRequests.schema.js";

test("parseCreateSeatAccessRequestInput parses valid payload", () => {
  const parsed = parseCreateSeatAccessRequestInput({
    fromDate: "2026-05-01",
    toDate: "2026-05-20",
    destination: "Seoul",
    plannedSeats: 4,
    note: "Team request",
    requestedRole: "agent",
  });

  assert.deepEqual(parsed, {
    fromDate: "2026-05-01",
    toDate: "2026-05-20",
    destination: "Seoul",
    plannedSeats: 4,
    note: "Team request",
    requestedRole: "agent",
  });
});

test("parseCreateSeatAccessRequestInput rejects invalid date range", () => {
  assert.throws(
    () =>
      parseCreateSeatAccessRequestInput({
        fromDate: "05-01-2026",
        toDate: "2026-05-20",
        destination: "Seoul",
        plannedSeats: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );

  assert.throws(
    () =>
      parseCreateSeatAccessRequestInput({
        fromDate: "2026-05-20",
        toDate: "2026-05-01",
        destination: "Seoul",
        plannedSeats: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseCreateSeatAccessRequestInput rejects invalid plannedSeats and requestedRole", () => {
  assert.throws(
    () =>
      parseCreateSeatAccessRequestInput({
        fromDate: "2026-05-01",
        toDate: "2026-05-20",
        destination: "Seoul",
        plannedSeats: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );

  assert.throws(
    () =>
      parseCreateSeatAccessRequestInput({
        fromDate: "2026-05-01",
        toDate: "2026-05-20",
        destination: "Seoul",
        plannedSeats: 2,
        requestedRole: "admin",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseSeatAccessRequestListFilters parses status and destination", () => {
  const parsed = parseSeatAccessRequestListFilters({
    status: " approved ",
    destination: "  Ulaanbaatar ",
  });

  assert.deepEqual(parsed, {
    status: "approved",
    destination: "Ulaanbaatar",
  });
});

test("parseSeatAccessRequestListFilters rejects unsupported status", () => {
  assert.throws(
    () => parseSeatAccessRequestListFilters({ status: "archived" }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseSeatAccessDecisionInput maps reason as nullable", () => {
  assert.deepEqual(parseSeatAccessDecisionInput({}), { reason: null });
  assert.deepEqual(parseSeatAccessDecisionInput({ reason: "ok" }), {
    reason: "ok",
  });
});

test("parseSelectTourFromAccessInput validates serialCount and date", () => {
  const parsed = parseSelectTourFromAccessInput({
    tourId: "tour-1",
    travelDate: "2026-06-11T00:00:00.000Z",
    requestedSeats: 3,
    serialCount: 11,
  });

  assert.deepEqual(parsed, {
    tourId: "tour-1",
    travelDate: "2026-06-11",
    requestedSeats: 3,
    serialCount: 11,
  });

  assert.throws(
    () =>
      parseSelectTourFromAccessInput({
        tourId: "tour-1",
        travelDate: "2026-06-11",
        requestedSeats: 3,
        serialCount: 2,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});
