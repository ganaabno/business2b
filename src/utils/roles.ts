import type { Role } from "../types/type";

const ROLE_SET = new Set<Role>([
  "user",
  "provider",
  "admin",
  "superadmin",
  "manager",
  "subcontractor",
  "agent",
]);

export function normalizeRole(value: unknown): Role {
  const normalized = String(value ?? "user").trim().toLowerCase() as Role;
  return ROLE_SET.has(normalized) ? normalized : "user";
}

function asRoleOrNull(value: unknown): Role | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return ROLE_SET.has(normalized as Role) ? (normalized as Role) : null;
}

export function resolveUserRoleFromProfile(payload: {
  workspace_role?: unknown;
  role?: unknown;
  role_v2?: unknown;
}): Role {
  const workspaceRole = asRoleOrNull(payload.workspace_role);
  if (workspaceRole) return workspaceRole;

  const legacyRole = asRoleOrNull(payload.role);
  const roleV2 = String(payload.role_v2 ?? "").trim().toLowerCase();

  if (legacyRole && legacyRole !== "user") {
    return legacyRole;
  }

  if (legacyRole === "user") {
    if (roleV2 === "subcontractor") return "subcontractor";
    if (roleV2 === "manager") return "manager";
    if (roleV2 === "admin") return "admin";
    return "user";
  }

  if (roleV2 === "subcontractor") return "subcontractor";
  if (roleV2 === "manager") return "manager";
  if (roleV2 === "admin") return "admin";
  if (roleV2 === "agent") return "agent";
  return "user";
}

export function toLegacyCompatRole(role: Role): Role {
  if (role === "subcontractor") return "user";
  return role;
}
