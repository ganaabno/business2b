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

export function toLegacyCompatRole(role: Role): Role {
  if (role === "subcontractor") return "user";
  if (role === "agent") return "provider";
  return role;
}
