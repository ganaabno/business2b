import { withTransaction } from "../../db/transaction.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AuthUser } from "../../shared/types/auth.js";
import {
  approveBindingRequestRepo,
  assignPrimaryOrganizationMemberRepo,
  createBindingRequestRepo,
  findOrganizationByMerchantCodeRepo,
  getBindingRequestByIdForUpdateRepo,
  getBindingRequestByIdRepo,
  listBindingRequestsRepo,
  rejectBindingRequestRepo,
  type BindingRequestStatus,
  type BindingRequestedRole,
} from "./bindingRequests.repo.js";

type DatabaseErrorLike = {
  code?: string;
};

function isAdminRole(role: AuthUser["role"]) {
  return role === "admin" || role === "manager";
}

function isEmployeeRole(role: AuthUser["role"]) {
  return role === "subcontractor" || role === "agent";
}

export async function submitBindingRequestService(
  user: AuthUser,
  input: {
    merchantCode: string;
    requestedRole: BindingRequestedRole;
    note: string | null;
  },
) {
  if (!isEmployeeRole(user.role)) {
    throw forbidden("Only subcontractor or agent can submit a binding request");
  }

  const organization = await findOrganizationByMerchantCodeRepo(input.merchantCode);
  if (!organization) {
    throw badRequest("Merchant code not found");
  }

  try {
    const bindingRequestId = await withTransaction(async (client) => {
      return createBindingRequestRepo(client, {
        userId: user.id,
        organizationId: organization.id,
        merchantCode: organization.merchant_code,
        requestedRole: input.requestedRole,
        note: input.note,
      });
    });

    if (!bindingRequestId) {
      throw new Error("Binding request insert returned empty id");
    }

    const row = await getBindingRequestByIdRepo(bindingRequestId);
    if (!row) {
      throw new Error("Binding request created but could not be loaded");
    }

    logger.info("audit.binding_request.submitted", {
      bindingRequestId: row.id,
      userId: user.id,
      organizationId: row.organization_id,
      merchantCode: row.merchant_code,
      requestedRole: row.requested_role,
    });

    return row;
  } catch (error) {
    const dbError = error as DatabaseErrorLike;
    if (dbError.code === "23505") {
      throw badRequest("A pending binding request already exists for this merchant code and role");
    }
    throw error;
  }
}

export async function listBindingRequestsService(
  user: AuthUser,
  filters: {
    status?: BindingRequestStatus;
    organizationId?: string;
    merchantCode?: string;
  },
) {
  return listBindingRequestsRepo({
    userId: isAdminRole(user.role) ? undefined : user.id,
    status: filters.status,
    organizationId: filters.organizationId,
    merchantCode: filters.merchantCode,
  });
}

export async function approveBindingRequestService(
  user: AuthUser,
  bindingRequestId: string,
  reason: string | null,
) {
  if (!isAdminRole(user.role)) {
    throw forbidden("Only admin or manager can approve binding requests");
  }

  const row = await withTransaction(async (client) => {
    const request = await getBindingRequestByIdForUpdateRepo(client, bindingRequestId);
    if (!request) {
      throw notFound("Binding request not found");
    }
    if (request.status !== "pending") {
      throw badRequest("Only pending binding requests can be approved");
    }

    const organization =
      request.organization_id
        ? { id: request.organization_id, merchant_code: request.merchant_code }
        : await findOrganizationByMerchantCodeRepo(request.merchant_code);

    if (!organization) {
      throw badRequest("Cannot approve request: merchant code is not mapped to an organization");
    }

    await approveBindingRequestRepo(client, {
      id: request.id,
      reviewedBy: user.id,
      decisionReason: reason,
      organizationId: organization.id,
    });

    await assignPrimaryOrganizationMemberRepo(client, {
      userId: request.user_id,
      organizationId: organization.id,
      role: request.requested_role,
    });

    const updated = await getBindingRequestByIdRepo(request.id, client);
    if (!updated) {
      throw new Error("Binding request approved but could not be loaded");
    }
    return updated;
  });

  logger.info("audit.binding_request.approved", {
    bindingRequestId: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    reviewedBy: user.id,
    requestedRole: row.requested_role,
  });

  return row;
}

export async function rejectBindingRequestService(
  user: AuthUser,
  bindingRequestId: string,
  reason: string | null,
) {
  if (!isAdminRole(user.role)) {
    throw forbidden("Only admin or manager can reject binding requests");
  }

  const row = await withTransaction(async (client) => {
    const request = await getBindingRequestByIdForUpdateRepo(client, bindingRequestId);
    if (!request) {
      throw notFound("Binding request not found");
    }
    if (request.status !== "pending") {
      throw badRequest("Only pending binding requests can be rejected");
    }

    await rejectBindingRequestRepo(client, {
      id: request.id,
      reviewedBy: user.id,
      decisionReason: reason,
    });

    const updated = await getBindingRequestByIdRepo(request.id, client);
    if (!updated) {
      throw new Error("Binding request rejected but could not be loaded");
    }
    return updated;
  });

  logger.info("audit.binding_request.rejected", {
    bindingRequestId: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    reviewedBy: user.id,
    requestedRole: row.requested_role,
  });

  return row;
}
