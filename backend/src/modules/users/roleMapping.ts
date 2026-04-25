export type RoleMapping = {
  legacyRole: string;
  roleV2: "admin" | "manager" | "subcontractor" | "agent";
  workspaceRole:
    | "admin"
    | "superadmin"
    | "manager"
    | "provider"
    | "agent"
    | "subcontractor"
    | "user";
};

function normalizeInputRole(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function mapRequestedRoleForPersistence(value: unknown): RoleMapping {
  const role = normalizeInputRole(value);

  switch (role) {
    case "superadmin":
      return {
        legacyRole: "superadmin",
        roleV2: "admin",
        workspaceRole: "superadmin",
      };
    case "admin":
      return { legacyRole: "admin", roleV2: "admin", workspaceRole: "admin" };
    case "manager":
      return {
        legacyRole: "manager",
        roleV2: "manager",
        workspaceRole: "manager",
      };
    case "provider":
      return {
        legacyRole: "provider",
        roleV2: "agent",
        workspaceRole: "provider",
      };
    case "agent":
      return {
        legacyRole: "provider",
        roleV2: "agent",
        workspaceRole: "agent",
      };
    case "subcontractor":
      return {
        legacyRole: "user",
        roleV2: "subcontractor",
        workspaceRole: "subcontractor",
      };
    case "user":
    default:
      return {
        legacyRole: "user",
        roleV2: "subcontractor",
        workspaceRole: "user",
      };
  }
}
