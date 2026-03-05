import { supabase } from "../supabaseClient";
import {
  readAdminTestMode,
  toBackendActingRole,
} from "../utils/adminTestMode";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const localApiTarget =
  (import.meta.env.VITE_LOCAL_API_TARGET || "http://localhost:8080").replace(/\/$/, "");
const b2bAdminTestModeEnabled =
  String(import.meta.env.VITE_B2B_ADMIN_TEST_MODE_ENABLED || "false").toLowerCase() ===
  "true";

type ApiEnvelope<T> = {
  data: T;
};

export type B2BSeatRequestRow = {
  id: string;
  request_no: string;
  tour_id: string;
  travel_date: string;
  destination: string;
  requested_seats: number;
  status: string;
  payment_state: string | null;
  deposit_due_at: string | null;
  next_deadline_at: string | null;
  created_at: string;
};

export type B2BSeatAccessRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "consumed"
  | "expired";

export type B2BSeatAccessRequestRow = {
  id: string;
  requester_user_id: string;
  organization_id: string;
  organization_name: string | null;
  requester_role: "subcontractor" | "agent";
  from_date: string;
  to_date: string;
  destination: string;
  note: string | null;
  status: B2BSeatAccessRequestStatus;
  decision_reason: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  consumed_at: string | null;
  seat_request_id: string | null;
  created_at: string;
  updated_at: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
};

export type B2BPaymentMilestoneRow = {
  id: string;
  code: string;
  due_at: string | null;
  required_cumulative_mnt: number;
  status: string;
  satisfied_at: string | null;
};

export type B2BPaymentHistoryRow = {
  id: string;
  amount_mnt: number;
  payment_method: string;
  provider: string;
  status: string;
  paid_at: string | null;
  external_txn_id: string;
  created_at: string;
};

export type B2BSeatRequestPayments = {
  milestones: B2BPaymentMilestoneRow[];
  payments: B2BPaymentHistoryRow[];
};

export type B2BDepositIntent = {
  seatRequestId: string;
  requiredAmountMnt: number;
  dueAt: string | null;
  currency: string;
};

export type B2BProfileOverview = {
  organization: {
    id: string;
    name: string;
    registration_number: string | null;
    merchant_code: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  } | null;
  activeRequests: Array<Record<string, unknown>>;
  paymentHistory: Array<Record<string, unknown>>;
  seatPurchaseHistory: Array<Record<string, unknown>>;
  bindingRequests: B2BBindingRequestRow[];
};

export type B2BTourSearchRow = {
  id: string;
  title: string;
  destination: string;
  departure_date: string;
  base_price: number;
  available_seats: number;
};

export type B2BGlobalTourSyncResult = {
  sourceSystem: string;
  fetched: number;
  normalized: number;
  inserted: number;
  updated: number;
  linked: number;
  skipped: number;
  dryRun: boolean;
  skippedRows: Array<{
    index: number;
    reason: string;
    sourceTourId: string | null;
    title: string | null;
  }>;
  processedAt: string;
};

export type B2BMonitoringRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  organization_name: string;
  requester_role: string;
  requested_seats: number;
  destination: string;
  created_at: string;
  current_payment_state: string | null;
  status: string;
  next_deadline_at: string | null;
};

export type B2BBindingRequestStatus = "pending" | "approved" | "rejected";

export type B2BBindingRequestRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  organization_name: string | null;
  merchant_code: string;
  requested_role: "subcontractor" | "agent";
  status: B2BBindingRequestStatus;
  note: string | null;
  decision_reason: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
};

function resolveUrl(path: string) {
  return apiBase ? `${apiBase}${path}` : path;
}

function backendUnavailableMessage() {
  const target = apiBase || `Vite proxy -> ${localApiTarget}`;
  return `B2B API is unreachable (${target}). Start backend with \"npm run api:dev\" and ensure the API target is correct.`;
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Unauthorized: missing auth session. Please sign in again.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${session.access_token}`,
  };

  if (b2bAdminTestModeEnabled) {
    const mode = readAdminTestMode();
    const actingRole = toBackendActingRole(mode.role);
    const orgId = mode.organizationId.trim();

    if (actingRole) {
      headers["x-acting-role"] = actingRole;
    }

    if (orgId) {
      headers["x-acting-org-id"] = orgId;
    }
  }

  return headers;
}

function parsePayload(text: string): unknown {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (status === 401) {
    return "Unauthorized. Please sign in again.";
  }

  if (status === 403) {
    return "Forbidden. Your role does not have access to this action.";
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return `Request failed: ${status}`;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error(backendUnavailableMessage());
  }

  const text = await res.text();
  const payload = parsePayload(text);

  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, res.status));
  }

  return payload as ApiEnvelope<T>;
}

export function createSeatRequest(input: {
  tourId: string;
  destination: string;
  travelDate: string;
  requestedSeats: number;
  unitPriceMnt: number;
}) {
  return apiFetch<{ id: string; request_no: string }>("/api/v1/seat-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createSeatAccessRequest(input: {
  fromDate: string;
  toDate: string;
  destination: string;
  note?: string;
}) {
  return apiFetch<B2BSeatAccessRequestRow>("/api/v1/seat-access-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listSeatAccessRequests(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch<B2BSeatAccessRequestRow[]>(
    `/api/v1/seat-access-requests${query ? `?${query}` : ""}`,
  );
}

export function approveSeatAccessRequest(id: string, reason?: string) {
  return apiFetch<B2BSeatAccessRequestRow>(`/api/v1/seat-access-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || null }),
  });
}

export function rejectSeatAccessRequest(id: string, reason?: string) {
  return apiFetch<B2BSeatAccessRequestRow>(`/api/v1/seat-access-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || null }),
  });
}

export function selectTourFromSeatAccessRequest(
  id: string,
  input: {
    tourId: string;
    travelDate: string;
    requestedSeats: number;
  },
) {
  return apiFetch<{ id: string; request_no: string; status: string; deposit_due_at: string | null }>(
    `/api/v1/seat-access-requests/${id}/select-tour`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function listSeatRequests(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch<B2BSeatRequestRow[]>(
    `/api/v1/seat-requests${query ? `?${query}` : ""}`,
  );
}

export function getSeatRequestPayments(id: string) {
  return apiFetch<B2BSeatRequestPayments>(`/api/v1/payments/seat-requests/${id}/history`);
}

export function createDepositIntent(id: string) {
  return apiFetch<B2BDepositIntent>(`/api/v1/payments/seat-requests/${id}/deposit-intent`, {
    method: "POST",
  });
}

export function simulateSeatRequestPayment(
  id: string,
  input?: {
    amountMnt?: number;
    paymentMethod?: string;
  },
) {
  return apiFetch<{ seatRequestId: string; amountMnt: number; externalTxnId: string }>(
    `/api/v1/payments/seat-requests/${id}/test-pay`,
    {
      method: "POST",
      body: JSON.stringify({
        amountMnt: input?.amountMnt,
        paymentMethod: input?.paymentMethod,
      }),
    },
  );
}

export function getProfileOverview() {
  return apiFetch<B2BProfileOverview>("/api/v1/me/profile");
}

export function searchB2BTours(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return apiFetch<B2BTourSearchRow[]>(`/api/v1/tours/search?${query}`);
}

export function syncGlobalTours(input?: {
  dryRun?: boolean;
  sourceSystem?: string;
}) {
  return apiFetch<B2BGlobalTourSyncResult>("/api/v1/tours/sync/global", {
    method: "POST",
    body: JSON.stringify({
      dryRun: Boolean(input?.dryRun ?? false),
      sourceSystem: input?.sourceSystem || undefined,
    }),
  });
}

export function listMonitoringSeatRequests(
  params: Record<string, string> = {},
) {
  const query = new URLSearchParams(params).toString();
  return apiFetch<B2BMonitoringRow[]>(
    `/api/v1/monitoring/seat-requests${query ? `?${query}` : ""}`,
  );
}

export function createBindingRequest(input: {
  merchantCode: string;
  requestedRole: "subcontractor" | "agent";
  note?: string;
}) {
  return apiFetch<B2BBindingRequestRow>("/api/v1/binding-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listBindingRequests(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch<B2BBindingRequestRow[]>(
    `/api/v1/binding-requests${query ? `?${query}` : ""}`,
  );
}

export function approveBindingRequest(id: string, reason?: string) {
  return apiFetch<B2BBindingRequestRow>(
    `/api/v1/binding-requests/${id}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
    },
  );
}

export function rejectBindingRequest(id: string, reason?: string) {
  return apiFetch<B2BBindingRequestRow>(
    `/api/v1/binding-requests/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
    },
  );
}
