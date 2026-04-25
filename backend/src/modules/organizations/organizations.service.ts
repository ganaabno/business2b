import { forbidden, notFound } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import {
  addMemberRepo,
  createOrganizationRepo,
  getOrganizationByIdRepo,
  getPrimaryOrganizationForUserRepo,
} from "./organizations.repo.js";

export async function createOrganizationService(
  user: AuthUser,
  input: {
    name: string;
    registrationNumber: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  },
) {
  const org = await createOrganizationRepo({ ...input, createdBy: user.id });
  await addMemberRepo({
    organizationId: org.id,
    userId: user.id,
    role: user.role,
    isPrimary: true,
  });
  return org;
}

export async function getOrganizationService(user: AuthUser, orgId: string) {
  const org = await getOrganizationByIdRepo(orgId);
  if (!org) throw notFound("Organization not found");

  if (user.role === "admin" || user.role === "manager") {
    return org;
  }

  const primaryOrgId = await getPrimaryOrganizationForUserRepo(user.id);
  if (primaryOrgId !== orgId) {
    throw forbidden("Cannot access this organization");
  }
  return org;
}

export async function addMemberService(
  user: AuthUser,
  orgId: string,
  input: { userId: string; role: string; isPrimary: boolean },
) {
  const org = await getOrganizationByIdRepo(orgId);
  if (!org) throw notFound("Organization not found");

  if (!(user.role === "admin" || user.role === "manager")) {
    const primaryOrgId = await getPrimaryOrganizationForUserRepo(user.id);
    if (primaryOrgId !== orgId) {
      throw forbidden("Only organization owners can add members");
    }
  }

  await addMemberRepo({
    organizationId: orgId,
    userId: input.userId,
    role: input.role,
    isPrimary: input.isPrimary,
  });
}
