import { describe, expect, it } from "vitest";
import {
  normalizeRole,
  resolveUserRoleFromProfile,
  toLegacyCompatRole,
} from "./roles";

describe("normalizeRole", () => {
  it("returns normalized role for supported values", () => {
    expect(normalizeRole("  ADMIN ")).toBe("admin");
    expect(normalizeRole("agent")).toBe("agent");
  });

  it("falls back to user for unsupported values", () => {
    expect(normalizeRole("unknown-role")).toBe("user");
    expect(normalizeRole(null)).toBe("user");
  });
});

describe("resolveUserRoleFromProfile", () => {
  it("prefers workspace_role over legacy fields", () => {
    expect(
      resolveUserRoleFromProfile({
        workspace_role: "manager",
        role_v2: "admin",
        role: "provider",
      }),
    ).toBe("manager");
  });

  it("keeps non-user legacy role when present", () => {
    expect(
      resolveUserRoleFromProfile({
        role: "provider",
        role_v2: "subcontractor",
      }),
    ).toBe("provider");
  });

  it("uses role_v2 mapping when legacy role is user", () => {
    expect(
      resolveUserRoleFromProfile({
        role: "user",
        role_v2: "manager",
      }),
    ).toBe("manager");
  });

  it("falls back to user when no known role exists", () => {
    expect(resolveUserRoleFromProfile({ role_v2: "invalid" })).toBe("user");
    expect(resolveUserRoleFromProfile({})).toBe("user");
  });
});

describe("toLegacyCompatRole", () => {
  it("maps subcontractor back to user for compatibility", () => {
    expect(toLegacyCompatRole("subcontractor")).toBe("user");
  });

  it("keeps other roles unchanged", () => {
    expect(toLegacyCompatRole("agent")).toBe("agent");
  });
});
