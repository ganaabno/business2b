import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../shared/http/errors.js";
import {
  parseEnsureGlobalTourBookableInput,
  parsePushGlobalTourInput,
  parseSearchToursFilters,
  parseSyncGlobalPriceRowCanonicalInput,
  parseSyncGlobalPriceRowInput,
  parseSyncGlobalToursInput,
} from "./tours.schema.js";

test("parseSearchToursFilters parses valid query values", () => {
  const parsed = parseSearchToursFilters({
    from: "2026-03-01",
    to: "2026-03-31",
    destination: "Beijing",
    minSeats: "2",
    minPrice: "1000000",
    maxPrice: "3000000",
  });

  assert.deepEqual(parsed, {
    from: "2026-03-01",
    to: "2026-03-31",
    destination: "Beijing",
    minSeats: 2,
    minPrice: 1000000,
    maxPrice: 3000000,
  });
});

test("parseSearchToursFilters rejects invalid date range", () => {
  assert.throws(
    () =>
      parseSearchToursFilters({
        from: "2026/03/01",
        to: "2026-03-31",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseSearchToursFilters parses optional accessRequestId", () => {
  const parsed = parseSearchToursFilters({
    from: "2026-03-01",
    to: "2026-03-31",
    accessRequestId: "2f9d2ee4-908d-49f9-a7d6-2e84c2debbd8",
  });

  assert.equal(parsed.accessRequestId, "2f9d2ee4-908d-49f9-a7d6-2e84c2debbd8");
});

test("parseSearchToursFilters rejects invalid accessRequestId", () => {
  assert.throws(
    () =>
      parseSearchToursFilters({
        from: "2026-03-01",
        to: "2026-03-31",
        accessRequestId: "not-a-uuid",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseSyncGlobalToursInput parses defaults", () => {
  const parsed = parseSyncGlobalToursInput({});

  assert.deepEqual(parsed, {
    dryRun: false,
    sourceSystem: "global-travel",
    tours: undefined,
  });
});

test("parseSyncGlobalToursInput parses boolean-like dryRun values", () => {
  assert.equal(parseSyncGlobalToursInput({ dryRun: "true" }).dryRun, true);
  assert.equal(parseSyncGlobalToursInput({ dryRun: "false" }).dryRun, false);
});

test("parseSyncGlobalToursInput rejects non-array tours", () => {
  assert.throws(
    () => parseSyncGlobalToursInput({ tours: { id: 1 } }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parsePushGlobalTourInput parses create payload", () => {
  const parsed = parsePushGlobalTourInput({
    action: "create",
    localTourId: "tour-local-1",
    tour: {
      title: "Test Tour",
      departure_date: "2026-04-01",
    },
  });

  assert.equal(parsed.action, "create");
  assert.equal(parsed.localTourId, "tour-local-1");
  assert.equal(parsed.remoteTourId, null);
  assert.equal(parsed.tour?.title, "Test Tour");
});

test("parsePushGlobalTourInput rejects missing tour for update", () => {
  assert.throws(
    () =>
      parsePushGlobalTourInput({
        action: "update",
        localTourId: "tour-local-1",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parsePushGlobalTourInput accepts delete payload without tour", () => {
  const parsed = parsePushGlobalTourInput({
    action: "delete",
    localTourId: "tour-local-9",
  });

  assert.equal(parsed.action, "delete");
  assert.equal(parsed.localTourId, "tour-local-9");
  assert.equal(parsed.remoteTourId, null);
  assert.equal(parsed.tour, null);
});

test("parsePushGlobalTourInput rejects invalid action", () => {
  assert.throws(
    () =>
      parsePushGlobalTourInput({
        action: "remove",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parsePushGlobalTourInput rejects non-object tour payload", () => {
  assert.throws(
    () =>
      parsePushGlobalTourInput({
        action: "create",
        tour: ["invalid"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseSyncGlobalPriceRowInput parses valid payload", () => {
  const parsed = parseSyncGlobalPriceRowInput({
    localTourId: "tour-local-1",
    departureDate: "2026-04-21",
    seats: 12,
  });

  assert.equal(parsed.localTourId, "tour-local-1");
  assert.equal(parsed.remoteTourId, null);
  assert.equal(parsed.departureDate, "2026-04-21");
  assert.equal(parsed.seats, 12);
});

test("parseSyncGlobalPriceRowInput rejects missing identifiers", () => {
  assert.throws(
    () =>
      parseSyncGlobalPriceRowInput({
        departureDate: "2026-04-21",
        seats: 12,
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseSyncGlobalPriceRowCanonicalInput parses valid payload", () => {
  const parsed = parseSyncGlobalPriceRowCanonicalInput({
    localTourId: "tour-local-1",
    departureDate: "2026-04-22",
  });

  assert.equal(parsed.localTourId, "tour-local-1");
  assert.equal(parsed.remoteTourId, null);
  assert.equal(parsed.departureDate, "2026-04-22");
});

test("parseSyncGlobalPriceRowCanonicalInput rejects missing localTourId", () => {
  assert.throws(
    () =>
      parseSyncGlobalPriceRowCanonicalInput({
        departureDate: "2026-04-22",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("parseEnsureGlobalTourBookableInput parses payload", () => {
  const parsed = parseEnsureGlobalTourBookableInput({
    remoteTourId: "global-tour-42",
  });

  assert.equal(parsed.remoteTourId, "global-tour-42");
});

test("parseEnsureGlobalTourBookableInput rejects missing remoteTourId", () => {
  assert.throws(
    () => parseEnsureGlobalTourBookableInput({}),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});
