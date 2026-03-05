export type AdminTestRole =
  | "off"
  | "admin"
  | "manager"
  | "provider"
  | "subcontractor"
  | "agent";

export type AdminTestModeState = {
  role: AdminTestRole;
  organizationId: string;
};

const STORAGE_KEY = "b2b.adminTestMode";

export const DEFAULT_ADMIN_TEST_MODE: AdminTestModeState = {
  role: "off",
  organizationId: "",
};

const VALID_ROLES = new Set<AdminTestRole>([
  "off",
  "admin",
  "manager",
  "provider",
  "subcontractor",
  "agent",
]);

function normalizeRole(value: unknown): AdminTestRole {
  const role = String(value ?? "off").trim().toLowerCase() as AdminTestRole;
  return VALID_ROLES.has(role) ? role : "off";
}

function normalizeOrganizationId(value: unknown): string {
  return String(value ?? "").trim();
}

export function readAdminTestMode(): AdminTestModeState {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_TEST_MODE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ADMIN_TEST_MODE;
    }

    const parsed = JSON.parse(raw) as Partial<AdminTestModeState>;
    return {
      role: normalizeRole(parsed.role),
      organizationId: normalizeOrganizationId(parsed.organizationId),
    };
  } catch {
    return DEFAULT_ADMIN_TEST_MODE;
  }
}

export function writeAdminTestMode(value: AdminTestModeState) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized: AdminTestModeState = {
    role: normalizeRole(value.role),
    organizationId: normalizeOrganizationId(value.organizationId),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage write failures.
  }
}

export function clearAdminTestMode() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage clear failures.
  }
}

export function toBackendActingRole(
  role: AdminTestRole,
): "admin" | "manager" | "subcontractor" | "agent" | null {
  switch (role) {
    case "admin":
      return "admin";
    case "manager":
      return "manager";
    case "provider":
    case "agent":
      return "agent";
    case "subcontractor":
      return "subcontractor";
    default:
      return null;
  }
}

export function isAdminTestModeActive(state: AdminTestModeState): boolean {
  return toBackendActingRole(state.role) !== null || state.organizationId.trim().length > 0;
}

export function roleLabelForAdminTest(role: AdminTestRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "provider":
      return "Provider";
    case "agent":
      return "Agent";
    case "subcontractor":
      return "SubContractor";
    default:
      return "Off";
  }
}
