import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthenticatedUserContext } from "./auth.middleware.js";

test("buildAuthenticatedUserContext uses matched profile id for database writes", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      id: "0a9ac845-9a6c-4ad6-b709-9d4d6a4c6f7c",
      role: "manager",
    },
    primaryOrganizationId: "org-1",
  });

  assert.equal(user.id, "0a9ac845-9a6c-4ad6-b709-9d4d6a4c6f7c");
  assert.equal(user.actorId, "8961de14-13ec-4b6c-9d54-fe0ed66c866b");
  assert.equal(user.role, "manager");
  assert.equal(user.actorRole, "manager");
  assert.equal(user.organizationId, "org-1");
});

test("buildAuthenticatedUserContext falls back to auth user id when profile id is missing", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      role_v2: "admin",
    },
    primaryOrganizationId: null,
  });

  assert.equal(user.id, "8961de14-13ec-4b6c-9d54-fe0ed66c866b");
  assert.equal(user.actorId, "8961de14-13ec-4b6c-9d54-fe0ed66c866b");
  assert.equal(user.role, "admin");
  assert.equal(user.actorRole, "admin");
  assert.equal(user.organizationId, null);
});

test("buildAuthenticatedUserContext prefers workspace_role over role_v2 and role", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      id: "0a9ac845-9a6c-4ad6-b709-9d4d6a4c6f7c",
      workspace_role: "admin",
      role_v2: "subcontractor",
      role: "user",
    },
    primaryOrganizationId: null,
  });

  assert.equal(user.role, "admin");
  assert.equal(user.actorRole, "admin");
});

test("buildAuthenticatedUserContext maps workspace_role provider to agent", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      workspace_role: "provider",
      role_v2: "admin",
      role: "admin",
    },
    primaryOrganizationId: null,
  });

  assert.equal(user.role, "agent");
  assert.equal(user.actorRole, "agent");
});

test("buildAuthenticatedUserContext falls back to role_v2 when workspace_role is missing", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      role_v2: "manager",
      role: "user",
    },
    primaryOrganizationId: null,
  });

  assert.equal(user.role, "manager");
  assert.equal(user.actorRole, "manager");
});

test("buildAuthenticatedUserContext falls back to legacy role when workspace_role and role_v2 are missing", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      role: "provider",
    },
    primaryOrganizationId: null,
  });

  assert.equal(user.role, "agent");
  assert.equal(user.actorRole, "agent");
});

test("buildAuthenticatedUserContext defaults to subcontractor for unsupported role values", () => {
  const user = buildAuthenticatedUserContext({
    authUserId: "8961de14-13ec-4b6c-9d54-fe0ed66c866b",
    payload: {
      workspace_role: "nonsense",
    },
    primaryOrganizationId: null,
  });

  assert.equal(user.role, "subcontractor");
  assert.equal(user.actorRole, "subcontractor");
});
