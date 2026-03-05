import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../shared/http/errors.js";
import { parseSearchToursFilters, parseSyncGlobalToursInput } from "./tours.schema.js";

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
