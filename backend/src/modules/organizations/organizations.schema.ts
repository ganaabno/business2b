import { badRequest } from "../../shared/http/errors.js";

export function parseCreateOrganizationInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const name = String(value.name || "").trim();
  const registrationNumber = String(value.registrationNumber || "").trim();
  const contactName = value.contactName ? String(value.contactName).trim() : null;
  const contactPhone = value.contactPhone ? String(value.contactPhone).trim() : null;
  const contactEmail = value.contactEmail ? String(value.contactEmail).trim() : null;

  if (name.length < 2 || name.length > 150) {
    throw badRequest("Organization name must be 2-150 characters");
  }
  if (registrationNumber.length < 2 || registrationNumber.length > 64) {
    throw badRequest("Registration number must be 2-64 characters");
  }

  return { name, registrationNumber, contactName, contactPhone, contactEmail };
}

export function parseAddMemberInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const userId = String(value.userId || "").trim();
  const role = String(value.role || "").trim();
  const isPrimary = Boolean(value.isPrimary ?? false);

  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
    throw badRequest("Invalid userId");
  }
  if (!["subcontractor", "agent", "manager", "admin"].includes(role)) {
    throw badRequest("Invalid role");
  }

  return { userId, role, isPrimary };
}
