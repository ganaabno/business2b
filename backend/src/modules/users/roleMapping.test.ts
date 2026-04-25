import assert from "node:assert/strict";
import test from "node:test";
import { mapRequestedRoleForPersistence } from "./roleMapping.js";

test("mapRequestedRoleForPersistence maps superadmin to admin role_v2 with superadmin workspace", () => {
  const mapped = mapRequestedRoleForPersistence("superadmin");

  assert.deepEqual(mapped, {
    legacyRole: "superadmin",
    roleV2: "admin",
    workspaceRole: "superadmin",
  });
});

test("mapRequestedRoleForPersistence maps agent to provider legacy compatibility", () => {
  const mapped = mapRequestedRoleForPersistence("agent");

  assert.deepEqual(mapped, {
    legacyRole: "provider",
    roleV2: "agent",
    workspaceRole: "agent",
  });
});

test("mapRequestedRoleForPersistence maps subcontractor to user legacy compatibility", () => {
  const mapped = mapRequestedRoleForPersistence("subcontractor");

  assert.deepEqual(mapped, {
    legacyRole: "user",
    roleV2: "subcontractor",
    workspaceRole: "subcontractor",
  });
});

test("mapRequestedRoleForPersistence handles mixed casing and whitespace", () => {
  const mapped = mapRequestedRoleForPersistence("  ProViDer ");

  assert.deepEqual(mapped, {
    legacyRole: "provider",
    roleV2: "agent",
    workspaceRole: "provider",
  });
});

test("mapRequestedRoleForPersistence defaults unknown values to user mapping", () => {
  const mapped = mapRequestedRoleForPersistence("unknown-role");

  assert.deepEqual(mapped, {
    legacyRole: "user",
    roleV2: "subcontractor",
    workspaceRole: "user",
  });
});
