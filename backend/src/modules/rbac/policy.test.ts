import test from "node:test";
import assert from "node:assert/strict";
import { can } from "./policy.js";

test("tours sync permission is restricted to admin and manager", () => {
  assert.equal(can("admin", "tours:sync"), true);
  assert.equal(can("manager", "tours:sync"), true);
  assert.equal(can("subcontractor", "tours:sync"), false);
  assert.equal(can("agent", "tours:sync"), false);
});

test("subcontractor and agent keep seat request create permission", () => {
  assert.equal(can("subcontractor", "seatRequest:create"), true);
  assert.equal(can("agent", "seatRequest:create"), true);
  assert.equal(can("manager", "seatRequest:create"), false);
});

test("canonical global sync is available for booking roles", () => {
  assert.equal(can("admin", "tours:sync:canonical"), true);
  assert.equal(can("manager", "tours:sync:canonical"), true);
  assert.equal(can("subcontractor", "tours:sync:canonical"), true);
  assert.equal(can("agent", "tours:sync:canonical"), true);
});

test("raw global sync remains privileged", () => {
  assert.equal(can("admin", "tours:sync:raw"), true);
  assert.equal(can("manager", "tours:sync:raw"), true);
  assert.equal(can("subcontractor", "tours:sync:raw"), false);
  assert.equal(can("agent", "tours:sync:raw"), false);
});

test("user management is admin-only", () => {
  assert.equal(can("admin", "users:view"), true);
  assert.equal(can("admin", "users:manage"), true);

  assert.equal(can("manager", "users:view"), false);
  assert.equal(can("manager", "users:manage"), false);
  assert.equal(can("subcontractor", "users:view"), false);
  assert.equal(can("agent", "users:manage"), false);
});
