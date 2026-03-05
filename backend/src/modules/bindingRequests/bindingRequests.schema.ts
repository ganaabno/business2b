import { badRequest } from "../../shared/http/errors.js";
import type { BindingRequestStatus, BindingRequestedRole } from "./bindingRequests.repo.js";

export function parseCreateBindingRequestInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const merchantCode = String(value.merchantCode || "").trim().toUpperCase();
  const requestedRole = String(value.requestedRole || "").trim().toLowerCase();
  const note = value.note ? String(value.note).trim() : null;

  if (!merchantCode) {
    throw badRequest("merchantCode is required");
  }
  if (!/^[A-Z0-9-]{4,64}$/.test(merchantCode)) {
    throw badRequest("merchantCode must be 4-64 chars (A-Z, 0-9, -)");
  }
  if (!isBindingRequestedRole(requestedRole)) {
    throw badRequest("requestedRole must be subcontractor or agent");
  }
  if (note && note.length > 500) {
    throw badRequest("note must be 500 characters or fewer");
  }

  return { merchantCode, requestedRole, note };
}

export function parseBindingDecisionInput(input: unknown) {
  const value = (input || {}) as Record<string, unknown>;
  const reason = value.reason ? String(value.reason).trim() : null;

  if (reason && reason.length > 500) {
    throw badRequest("reason must be 500 characters or fewer");
  }

  return { reason };
}

export function parseBindingListFilters(query: Record<string, unknown>) {
  const statusRaw = typeof query.status === "string" ? query.status.trim().toLowerCase() : undefined;
  const organizationId = typeof query.organizationId === "string" ? query.organizationId.trim() : undefined;
  const merchantCode =
    typeof query.merchantCode === "string" ? query.merchantCode.trim().toUpperCase() : undefined;

  if (organizationId && !/^[0-9a-fA-F-]{36}$/.test(organizationId)) {
    throw badRequest("organizationId must be a valid UUID");
  }

  let status: BindingRequestStatus | undefined;
  if (statusRaw !== undefined && statusRaw !== "") {
    if (!isBindingRequestStatus(statusRaw)) {
      throw badRequest("status must be pending, approved, or rejected");
    }
    status = statusRaw;
  }

  return {
    status,
    organizationId,
    merchantCode,
  };
}

function isBindingRequestedRole(value: string): value is BindingRequestedRole {
  return value === "subcontractor" || value === "agent";
}

function isBindingRequestStatus(value: string): value is BindingRequestStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}
