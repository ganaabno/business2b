import { supabase } from "../supabaseClient";
import { apiBaseUrl } from "./apiBase";

const apiBase = apiBaseUrl;
const localApiTarget =
  (import.meta.env.VITE_LOCAL_API_TARGET || "http://localhost:8080").replace(/\/$/, "");

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
  serial_group_id: string;
  serial_index: number;
  serial_total: number;
  status: string;
  payment_state: string | null;
  deposit_due_at: string | null;
  next_deadline_at: string | null;
  created_at: string;
};

export type B2BSeatRequestBookingEligibility = {
  seatRequestId: string;
  status: string;
  canBook: boolean;
  blocked: boolean;
  serialGroupId: string;
  bundleHealth: "healthy" | "payment_due" | "blocked";
  blockReasonCode:
    | "member_rejected"
    | "member_cancelled"
    | "deposit_timeout"
    | "overdue_milestone"
    | "payment_pending"
    | "booking_not_ready"
    | null;
  blockMessage: string | null;
  blockingSeatRequestId: string | null;
  nextDeadlineAt: string | null;
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
  planned_seats: number;
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
  serial_count: number;
  serial_group_id: string | null;
  created_at: string;
  updated_at: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_username: string | null;
  requester_email: string | null;
};

export type B2BSeatAccessSerialPreviewChainRow = {
  index: number;
  tour_id: string;
  title: string;
  destination: string;
  travel_date: string;
  unit_price_mnt: number;
  available_seats: number;
  enough_seats: boolean;
};

export type B2BSeatAccessSerialPreview = {
  access_request_id: string;
  serial_count: number;
  requested_seats: number;
  ready: boolean;
  has_seat_shortage: boolean;
  requires_first_payment_6h: boolean;
  first_payment_mnt: number;
  first_payment_formula: string;
  chain: B2BSeatAccessSerialPreviewChainRow[];
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

export type B2BQPayInvoiceIntent = {
  seatRequestId: string;
  requestNo: string;
  milestoneCode: string;
  amountMnt: number;
  currency: string;
  dueAt: string | null;
  invoiceId: string | null;
  senderInvoiceNo: string;
  qrText: string | null;
  qrImage: string | null;
  invoiceUrl: string | null;
  deepLink: string | null;
  raw: Record<string, unknown>;
  reusedIntent?: boolean;
};

export type B2BQPayInvoiceStatus = {
  seatRequestId: string;
  milestoneCode: string;
  amountMnt: number;
  currency: string;
  invoiceId: string | null;
  senderInvoiceNo: string;
  provider: string;
  status: "pending" | "paid";
  externalTxnId: string | null;
  checkedAt: string;
  raw: Record<string, unknown>;
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

export type B2BGlobalTourSyncStatus = {
  sourceSystem: string;
  enabled: boolean;
  intervalMs: number;
  staleThresholdMs: number;
  staleMs: number | null;
  healthy: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  failureStreak: number;
  lastDurationMs: number | null;
  metrics: {
    fetched: number | null;
    normalized: number | null;
    inserted: number | null;
    updated: number | null;
    linked: number | null;
    skipped: number | null;
    dryRun: boolean | null;
  };
  updatedAt: string | null;
};

export type B2BSyncGlobalPriceRowResult = {
  remoteTourId: string;
  localTourId: string | null;
  departureDate: string;
  seats: number;
  rowId: string;
  tableName: string;
  syncedAt: string;
};

export type B2BSyncGlobalPriceRowCanonicalResult = {
  status: "synced" | "skipped";
  reason: string | null;
  remoteTourId: string | null;
  localTourId: string;
  departureDate: string;
  seats: number;
  rowId: string | null;
  tableName: string | null;
  syncedAt: string;
};

export type B2BEnsureGlobalTourBookableResult = {
  remoteTourId: string;
  localTourId: string;
  action: "inserted" | "updated" | "linked";
  sourceSystem: string;
  syncedAt: string;
};

export type B2BPushGlobalTourResult = {
  action: "create" | "update" | "delete";
  remoteAction: "created" | "updated" | "deleted" | "skipped";
  remoteTourId: string | null;
  localTourId: string | null;
  syncedAt: string;
  warning: string | null;
};

export type B2BMonitoringRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  requester_username: string | null;
  email: string | null;
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
  requester_username: string | null;
  requester_email: string | null;
};

export type B2BApiFeatureFlags = {
  b2bRoleV2Enabled: boolean;
  b2bSeatRequestFlowEnabled: boolean;
  b2bMonitoringEnabled: boolean;
  b2bGroupPolicyEnabled: boolean;
  b2bGroupPolicyEnforce: boolean;
  b2bSerialEnforcementEnabled: boolean;
};

export type B2BTaskPriority = "low" | "medium" | "high" | "urgent";

export type B2BGlobalTask = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  sortOrder: number;
  isCompleted: boolean;
  assigneeId: string | null;
  assigneeIds?: string[];
  assigneeName?: string | null;
  assigneeNames?: string[];
  creatorId: string;
  creatorName?: string | null;
  dueDate: string | null;
  approvedAt: string | null;
  approvedById?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type B2BGlobalTaskAssignee = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
};

function resolveUrl(path: string) {
  return apiBase ? `${apiBase}${path}` : path;
}

function backendUnavailableMessage() {
  const target = apiBase || `Vite proxy -> ${localApiTarget}`;
  return `B2B API is unreachable (${target}). Start backend with "npm run api:dev" and ensure the API target is correct.`;
}

type SupabaseSessionLike = {
  access_token?: string;
  expires_at?: number | null;
};

function isSessionExpiredSoon(session: SupabaseSessionLike | null | undefined) {
  if (!session?.expires_at) {
    return false;
  }

  const expiryMs = Number(session.expires_at) * 1000;
  if (!Number.isFinite(expiryMs)) {
    return false;
  }

  return expiryMs <= Date.now() + 15_000;
}

async function resolveActiveSession(options?: { forceRefresh?: boolean }) {
  const currentSessionResult = await supabase.auth.getSession();
  let session = currentSessionResult.data.session;

  if (options?.forceRefresh || !session || isSessionExpiredSoon(session)) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session || session;
  }

  return session;
}

async function authHeaders(options?: { forceRefresh?: boolean }) {
  const session = await resolveActiveSession(options);

  if (!session?.access_token) {
    throw new Error("Unauthorized: missing auth session. Please sign in again.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${session.access_token}`,
  };

  return headers;
}

async function fetchWithAuthHeaders(
  path: string,
  init: RequestInit | undefined,
  headers: Record<string, string>,
) {
  const mergedHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    mergedHeaders.set(key, value);
  }

  const initHeaders = new Headers(init?.headers || undefined);
  initHeaders.forEach((value, key) => {
    mergedHeaders.set(key, value);
  });

  return fetch(resolveUrl(path), {
    ...init,
    headers: mergedHeaders,
  });
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

function isHtmlLikeResponse(response: Response, text: string) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const trimmed = text.trim().toLowerCase();

  return (
    contentType.includes("text/html") ||
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html")
  );
}

function extractErrorMessage(payload: unknown, status: number): string {
  let rawError = "";
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") {
      rawError = error.trim();
    }
  }

  const normalized = rawError.toLowerCase();
  if (
    normalized.includes("econnrefused") ||
    normalized.includes("proxy error") ||
    normalized.includes("fetch failed") ||
    normalized.includes("connect etimedout")
  ) {
    return backendUnavailableMessage();
  }

  if (normalized.includes("b2b database schema is not ready")) {
    return rawError;
  }

  if (status === 401) {
    if (rawError) {
      if (
        normalized.includes("invalid token") ||
        normalized.includes("user profile not found") ||
        normalized.includes("missing bearer token")
      ) {
        return `${rawError}. Sign out/in again. If it still fails, ensure this account exists in backend public.users (approved/provisioned) and verify backend DATABASE_URL points to the same Supabase project/schema as frontend auth.`;
      }

      return rawError;
    }

    return "Unauthorized. Please sign in again.";
  }

  if (status === 403) {
    if (rawError) {
      return rawError;
    }
    return "Forbidden. Your role does not have access to this action.";
  }

  if (status === 404) {
    return "B2B API route not found. Ensure backend is running and B2B seat-request flag is enabled.";
  }

  if (rawError) {
    return rawError;
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
    res = await fetchWithAuthHeaders(path, init, headers);
  } catch {
    throw new Error(backendUnavailableMessage());
  }

  if (res.status === 401) {
    try {
      const refreshedHeaders = await authHeaders({ forceRefresh: true });
      const maybeRetry = await fetchWithAuthHeaders(path, init, refreshedHeaders);
      res = maybeRetry;
    } catch {
      // Ignore refresh/retry errors and preserve original 401 handling below.
    }
  }

  const text = await res.text();
  if (isHtmlLikeResponse(res, text)) {
    throw new Error(
      "Backend API target returned HTML instead of JSON. Set VITE_API_BASE_URL to your API domain or configure /api reverse-proxy routing.",
    );
  }

  const payload = parsePayload(text);

  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, res.status));
  }

  return payload as ApiEnvelope<T>;
}

async function publicApiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(resolveUrl(path), init);
  } catch {
    throw new Error(backendUnavailableMessage());
  }

  const text = await res.text();
  if (isHtmlLikeResponse(res, text)) {
    throw new Error(
      "Backend API target returned HTML instead of JSON. Set VITE_API_BASE_URL to your API domain or configure /api reverse-proxy routing.",
    );
  }

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
  requestedRole?: "subcontractor" | "agent";
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
  plannedSeats: number;
  note?: string;
  requestedRole?: "subcontractor" | "agent";
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
    serialCount: number;
    idempotencyKey?: string;
  },
) {
  const { idempotencyKey, ...payload } = input;
  return apiFetch<{
    id: string;
    request_no: string;
    status: string;
    deposit_due_at: string | null;
    serial_group_id: string;
    serial_total: number;
    serial_created_count: number;
    created_request_ids: string[];
    idempotency_replayed?: boolean;
  }>(
    `/api/v1/seat-access-requests/${id}/select-tour`,
    {
      method: "POST",
      headers: idempotencyKey
        ? {
            "idempotency-key": idempotencyKey,
          }
        : undefined,
      body: JSON.stringify(payload),
    },
  );
}

export function previewSeatAccessSerialSelection(
  id: string,
  input: {
    tourId: string;
    travelDate: string;
    requestedSeats: number;
    serialCount: number;
  },
) {
  return apiFetch<B2BSeatAccessSerialPreview>(
    `/api/v1/seat-access-requests/${id}/serial-preview`,
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

export function getSeatRequestBookingEligibility(id: string) {
  return apiFetch<B2BSeatRequestBookingEligibility>(
    `/api/v1/seat-requests/${id}/booking-eligibility`,
  );
}

export function getB2BApiFeatureFlags() {
  return apiFetch<B2BApiFeatureFlags>("/api/v1/feature-flags", {
    method: "GET",
  });
}

export function getB2BApiFeatureFlagsPublic() {
  return publicApiFetch<B2BApiFeatureFlags>("/api/v1/feature-flags", {
    method: "GET",
  });
}

export function getSeatRequestPayments(id: string) {
  return apiFetch<B2BSeatRequestPayments>(`/api/v1/payments/seat-requests/${id}/history`);
}

export function createDepositIntent(id: string) {
  return apiFetch<B2BDepositIntent | null>(`/api/v1/payments/seat-requests/${id}/deposit-intent`, {
    method: "POST",
  });
}

export function createQPayInvoiceIntent(
  id: string,
  input?: {
    milestoneCode?: string;
  },
) {
  return apiFetch<B2BQPayInvoiceIntent>(`/api/v1/payments/seat-requests/${id}/qpay-invoice`, {
    method: "POST",
    body: JSON.stringify({
      milestoneCode: input?.milestoneCode,
    }),
  });
}

export function checkQPayInvoiceStatus(
  id: string,
  input?: {
    invoiceId?: string;
    senderInvoiceNo?: string;
  },
) {
  return apiFetch<B2BQPayInvoiceStatus>(`/api/v1/payments/seat-requests/${id}/qpay-status`, {
    method: "POST",
    body: JSON.stringify({
      invoiceId: input?.invoiceId,
      senderInvoiceNo: input?.senderInvoiceNo,
    }),
  });
}

export function getProfileOverview() {
  return apiFetch<B2BProfileOverview>("/api/v1/me/profile");
}

export function searchB2BTours(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return apiFetch<B2BTourSearchRow[]>(`/api/v1/tours/search?${query}`);
}

export function listB2BTourDestinations(params?: {
  from?: string;
  to?: string;
  minSeats?: string;
}) {
  const query = new URLSearchParams(
    Object.entries({
      from: params?.from || "",
      to: params?.to || "",
      minSeats: params?.minSeats || "",
    }).filter(([, value]) => value !== ""),
  ).toString();

  return apiFetch<string[]>(
    `/api/v1/tours/destinations${query ? `?${query}` : ""}`,
  );
}

export function syncGlobalTours(input?: {
  dryRun?: boolean;
  sourceSystem?: string;
  tours?: Array<Record<string, unknown>>;
}) {
  return apiFetch<B2BGlobalTourSyncResult>("/api/v1/tours/sync/global", {
    method: "POST",
    body: JSON.stringify({
      dryRun: Boolean(input?.dryRun ?? false),
      sourceSystem: input?.sourceSystem || undefined,
      tours: Array.isArray(input?.tours) ? input?.tours : undefined,
    }),
  });
}

export function getGlobalToursSyncStatus() {
  return apiFetch<B2BGlobalTourSyncStatus>("/api/v1/tours/sync/global/status");
}

export function syncGlobalPriceRow(input: {
  localTourId?: string | null;
  remoteTourId?: string | null;
  departureDate: string;
  seats: number;
}) {
  return apiFetch<B2BSyncGlobalPriceRowResult>("/api/v1/tours/sync/global/price-row", {
    method: "POST",
    body: JSON.stringify({
      localTourId: input.localTourId || undefined,
      remoteTourId: input.remoteTourId || undefined,
      departureDate: input.departureDate,
      seats: input.seats,
    }),
  });
}

export function syncGlobalPriceRowCanonical(input: {
  localTourId: string;
  departureDate: string;
  remoteTourId?: string | null;
}) {
  return apiFetch<B2BSyncGlobalPriceRowCanonicalResult>(
    "/api/v1/tours/sync/global/price-row/canonical",
    {
      method: "POST",
      body: JSON.stringify({
        localTourId: input.localTourId,
        remoteTourId: input.remoteTourId || undefined,
        departureDate: input.departureDate,
      }),
    },
  );
}

export function ensureGlobalTourBookable(input: { remoteTourId: string }) {
  return apiFetch<B2BEnsureGlobalTourBookableResult>(
    "/api/v1/tours/sync/global/ensure-bookable",
    {
      method: "POST",
      body: JSON.stringify({
        remoteTourId: input.remoteTourId,
      }),
    },
  );
}

export function pushGlobalTour(input: {
  action: "create" | "update" | "delete";
  localTourId?: string | null;
  remoteTourId?: string | null;
  tour?: Record<string, unknown> | null;
}) {
  return apiFetch<B2BPushGlobalTourResult>("/api/v1/tours/sync/global/push", {
    method: "POST",
    body: JSON.stringify({
      action: input.action,
      localTourId: input.localTourId || undefined,
      remoteTourId: input.remoteTourId || undefined,
      tour: input.tour || undefined,
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

export function listGlobalTaskAssignees() {
  return apiFetch<{ users: B2BGlobalTaskAssignee[] }>(
    "/api/v1/global-tasks/assignees",
  );
}

export function listGlobalMyTasks() {
  return apiFetch<{ tasks: B2BGlobalTask[] }>("/api/v1/global-tasks/my");
}

export function listGlobalTasks() {
  return apiFetch<{ tasks: B2BGlobalTask[] }>("/api/v1/global-tasks");
}

export function createGlobalTask(input: {
  title?: string | null;
  description: string;
  priority?: B2BTaskPriority;
  assigneeId?: string | null;
  assigneeIds?: string[];
  dueDate?: string | null;
  sortOrder?: number | null;
}) {
  return apiFetch<{ task: B2BGlobalTask | null }>("/api/v1/global-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: input.title || undefined,
      description: input.description,
      priority: input.priority || "medium",
      assigneeId: input.assigneeId || undefined,
      assigneeIds: input.assigneeIds,
      dueDate: input.dueDate || undefined,
      sortOrder:
        typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
          ? input.sortOrder
          : undefined,
    }),
  });
}

export function updateGlobalTask(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    priority?: B2BTaskPriority;
    isCompleted?: boolean;
    assigneeId?: string | null;
    assigneeIds?: string[];
    dueDate?: string | null;
  },
) {
  return apiFetch<{ task: B2BGlobalTask | null }>(`/api/v1/global-tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function approveGlobalTask(id: string) {
  return apiFetch<{ task: B2BGlobalTask | null }>(
    `/api/v1/global-tasks/${id}/approve`,
    {
      method: "POST",
    },
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
