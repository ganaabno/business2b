import { supabase } from "../supabaseClient";
import { apiBaseUrl } from "./apiBase";

type ApiResult<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

const useEdgeAdminFunctions =
  (import.meta.env.VITE_USE_EDGE_ADMIN_FUNCTIONS as string | undefined) ===
  "true";
const useBackendAdminUsers =
  (import.meta.env.VITE_USE_BACKEND_ADMIN_USERS as string | undefined) ===
  "true";
const useBackendPendingUsers =
  (import.meta.env.VITE_USE_BACKEND_PENDING_USERS as string | undefined) ===
  "true";

const apiBase = apiBaseUrl;

function resolveBackendUrl(path: string) {
  return apiBase ? `${apiBase}${path}` : path;
}

let pendingUsersEdgeUnavailable = false;
let pendingUsersBackendUnavailable = false;
let usersBackendUnavailable = false;
let usersEdgeUnavailable = false;
let hasLoggedUsersBackendIssue = false;
let hasLoggedUsersEdgeIssue = false;
let hasLoggedUsersTableIssue = false;
let hasLoggedPendingUsersBackendIssue = false;

type BackendRequestError = Error & {
  status?: number;
};

function buildBackendRequestError(status: number, message: string) {
  const error = new Error(message) as BackendRequestError;
  error.status = status;
  return error;
}

function shouldFallbackFromEdge(error: unknown) {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("failed to send a request") ||
    message.includes("network") ||
    message.includes("err_failed") ||
    message.includes("edge function")
  );
}

function shouldFallbackFromBackend(error: unknown) {
  const status = (error as BackendRequestError)?.status;
  if (status === 404 || status === 405 || status === 502) {
    return true;
  }

  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("err_failed") ||
    message.includes("serving html") ||
    message.includes("not valid json")
  );
}

function isAuthSessionBackendError(error: unknown) {
  const status = (error as BackendRequestError)?.status;
  if (status === 401 || status === 403) {
    return true;
  }

  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    message.includes("missing auth session") ||
    message.includes("invalid token") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("user profile not found")
  );
}

async function parseBackendErrorMessage(
  response: Response,
  fallback: string,
) {
  const text = await response.text();
  let message = text || fallback;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const parsedMessage = String(parsed?.error || parsed?.message || "").trim();
    if (parsedMessage) {
      message = parsedMessage;
    }
  } catch {
    // keep plain text message
  }
  return message;
}

async function parseBackendSuccessPayload<T>(response: Response, fallback: string) {
  const text = await response.text();
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const trimmed = text.trim().toLowerCase();
  const isHtmlLike =
    contentType.includes("text/html") ||
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html");

  if (isHtmlLike) {
    throw buildBackendRequestError(
      502,
      `${fallback}. Backend URL is serving HTML. Set VITE_API_BASE_URL to your API domain or configure /api reverse-proxy routing.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw buildBackendRequestError(
      502,
      `${fallback}. Backend response is not valid JSON.`,
    );
  }
}

function isMissingWorkspaceRoleColumnError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("workspace_role")
  );
}

function mapRequestedRoleForPersistence(value: unknown): {
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
} {
  const role = String(value || "user").trim().toLowerCase();
  switch (role) {
    case "superadmin":
      return { legacyRole: "superadmin", roleV2: "admin", workspaceRole: "superadmin" };
    case "admin":
      return { legacyRole: "admin", roleV2: "admin", workspaceRole: "admin" };
    case "manager":
      return { legacyRole: "manager", roleV2: "manager", workspaceRole: "manager" };
    case "provider":
      return { legacyRole: "provider", roleV2: "agent", workspaceRole: "provider" };
    case "agent":
      return { legacyRole: "provider", roleV2: "agent", workspaceRole: "agent" };
    case "subcontractor":
      return { legacyRole: "user", roleV2: "subcontractor", workspaceRole: "subcontractor" };
    case "user":
      return { legacyRole: "user", roleV2: "subcontractor", workspaceRole: "user" };
    default:
      return { legacyRole: "user", roleV2: "subcontractor", workspaceRole: "user" };
  }
}

async function updatePublicUserApprovalState(
  email: string,
  roleRequested: unknown,
  nextStatus: "approved" | "declined",
) {
  if (!email) return;

  try {
    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (lookupError || !existingUser?.id) {
      return;
    }

    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: nowIso,
      updated_at: nowIso,
    };

    if (nextStatus === "approved") {
      const mappedRole = mapRequestedRoleForPersistence(roleRequested);
      payload.role = mappedRole.legacyRole;
      payload.role_v2 = mappedRole.roleV2;
      payload.workspace_role = mappedRole.workspaceRole;
      payload.access = "active";
    }

    let { error: updateError } = await supabase
      .from("users")
      .update(payload)
      .eq("id", existingUser.id);

    if (updateError && isMissingWorkspaceRoleColumnError(updateError)) {
      delete payload.workspace_role;
      const retry = await supabase
        .from("users")
        .update(payload)
        .eq("id", existingUser.id);
      updateError = retry.error;
    }

    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    console.warn("Unable to sync public.users after pending status update", error);
  }
}

async function updatePendingUserStatusDirect(
  pendingUserId: string,
  nextStatus: "approved" | "declined",
  reason?: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actorId = user?.id || null;
  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> =
    nextStatus === "approved"
      ? {
          status: "approved",
          approved_by: actorId,
          approved_at: nowIso,
          notes: null,
        }
      : {
          status: "declined",
          approved_by: actorId,
          approved_at: null,
          notes: reason || "Declined by admin",
        };

  const { data, error } = await supabase
    .from("pending_users")
    .update(payload)
    .eq("id", pendingUserId)
    .eq("status", "pending")
    .select("id, email, role_requested, status")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || `Failed to ${nextStatus} request`);
  }

  if (!data) {
    const { data: existingRow, error: existingError } = await supabase
      .from("pending_users")
      .select("id, status")
      .eq("id", pendingUserId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message || "Failed to verify request status");
    }

    if (!existingRow) {
      throw new Error("Pending request not found");
    }

    const existingStatus = String(existingRow.status || "").trim().toLowerCase();
    if (existingStatus === nextStatus) {
      return null;
    }

    throw new Error(`Request is already ${existingStatus || "processed"}`);
  }

  await updatePublicUserApprovalState(
    String((data as { email?: string | null }).email || ""),
    (data as { role_requested?: string | null }).role_requested,
    nextStatus,
  );

  return null;
}

function normalizePendingRows<T>(rows: any[] | undefined | null): T[] {
  return (rows || []).map((row) => ({
    ...row,
    status:
      typeof row?.status === "string" && row.status.trim().length > 0
        ? row.status
        : "pending",
  })) as T[];
}

function filterPendingRows<T extends { status?: string }>(rows: T[]): T[] {
  return rows.filter(
    (row) => String(row?.status || "pending").trim().toLowerCase() === "pending",
  );
}

async function invokeAdminFunction<T>(
  functionName: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    throw new Error(error.message || `Failed to call ${functionName}`);
  }

  const payload = data as ApiResult<T> | T;
  if (
    payload &&
    typeof payload === "object" &&
    "ok" in (payload as Record<string, unknown>) &&
    (payload as ApiResult<T>).ok === false
  ) {
    throw new Error(
      (payload as ApiResult<T>).error || `Failed to call ${functionName}`,
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    return (payload as ApiResult<T>).data as T;
  }

  return payload as T;
}

async function listUsersFromBackend<T>() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw buildBackendRequestError(401, "Missing auth session");
  }

  const response = await fetch(resolveBackendUrl("/api/v1/admin/users"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const message = await parseBackendErrorMessage(
      response,
      `Failed to load users (${response.status})`,
    );
    throw buildBackendRequestError(response.status, message);
  }

  const payload = await parseBackendSuccessPayload<ApiResult<T[]> | { data?: T[] }>(
    response,
    "Failed to parse users response",
  );
  const rows =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : undefined;

  return (rows || []) as T[];
}

async function listPendingUsersFromBackend<T>() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw buildBackendRequestError(401, "Missing auth session");
  }

  const response = await fetch(resolveBackendUrl("/api/v1/admin/users/pending"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const message = await parseBackendErrorMessage(
      response,
      `Failed to load pending users (${response.status})`,
    );
    throw buildBackendRequestError(response.status, message);
  }

  const payload = await parseBackendSuccessPayload<ApiResult<T[]> | { data?: T[] }>(
    response,
    "Failed to parse pending users response",
  );
  const rows =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : undefined;

  return (rows || []) as T[];
}

async function submitPendingUserDecisionToBackend(
  pendingUserId: string,
  decision: "approve" | "decline",
  reason?: string,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw buildBackendRequestError(401, "Missing auth session");
  }

  const response = await fetch(
    resolveBackendUrl(
      `/api/v1/admin/users/pending/${encodeURIComponent(pendingUserId)}/${decision}`,
    ),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );

  if (!response.ok) {
    const message = await parseBackendErrorMessage(
      response,
      `Failed to ${decision} pending user (${response.status})`,
    );
    throw buildBackendRequestError(response.status, message);
  }

  return null;
}

async function submitUserRoleChangeToBackend(userId: string, role: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw buildBackendRequestError(401, "Missing auth session");
  }

  const response = await fetch(
    resolveBackendUrl(`/api/v1/admin/users/${encodeURIComponent(userId)}/role`),
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    },
  );

  if (!response.ok) {
    const message = await parseBackendErrorMessage(
      response,
      `Failed to change role (${response.status})`,
    );
    throw buildBackendRequestError(response.status, message);
  }

  return null;
}

async function submitAdminTestEmailToBackend(recipientEmail: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw buildBackendRequestError(401, "Missing auth session");
  }

  const response = await fetch(
    resolveBackendUrl("/api/v1/admin/users/notifications/test-email"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipientEmail }),
    },
  );

  if (!response.ok) {
    const message = await parseBackendErrorMessage(
      response,
      `Failed to send test email (${response.status})`,
    );
    throw buildBackendRequestError(response.status, message);
  }

  const payload = await parseBackendSuccessPayload<
    ApiResult<{ queued?: boolean; message?: string; recipientEmail?: string }> | {
      data?: { queued?: boolean; message?: string; recipientEmail?: string };
    }
  >(response, "Failed to parse send-test-email response");

  const data =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : undefined;

  return data || { queued: false, message: "Unknown response" };
}

export async function listUsersAdmin<T>() {
  const byId = new Map<string, any>();
  let tableQuerySucceeded = false;
  let backendUsersError: unknown = null;

  const addRows = (
    rows: any[] | undefined | null,
    options: { preserveExisting?: boolean } = {},
  ) => {
    for (const row of rows || []) {
      const authUserId = String(row?.auth_user_id || "").trim();
      const emailKey = String(row?.email || "").trim().toLowerCase();
      const localId = String(row?.id || row?.user_id || "").trim();
      const key = authUserId || emailKey || localId;
      if (!key) continue;

      const prev = byId.get(key) || {};
      byId.set(
        key,
        options.preserveExisting ? { ...row, ...prev } : { ...prev, ...row },
      );
    }
  };

  try {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      throw error;
    }
    tableQuerySucceeded = true;
    addRows(data as any[], { preserveExisting: false });
  } catch (error) {
    if (!hasLoggedUsersTableIssue) {
      hasLoggedUsersTableIssue = true;
      console.warn("Table users fallback unavailable", error);
    }
  }

  if (!usersBackendUnavailable && (useBackendAdminUsers || !useEdgeAdminFunctions)) {
    try {
      const backendUsers = await listUsersFromBackend<T>();
      addRows(backendUsers as any[], { preserveExisting: tableQuerySucceeded });
    } catch (error) {
      backendUsersError = error;

      if (shouldFallbackFromBackend(error)) {
        usersBackendUnavailable = true;
        if (!hasLoggedUsersBackendIssue) {
          hasLoggedUsersBackendIssue = true;
          console.warn("Backend user listing unavailable; using fallback sources", error);
        }
      } else if (isAuthSessionBackendError(error)) {
        if (!hasLoggedUsersBackendIssue) {
          hasLoggedUsersBackendIssue = true;
          console.warn(
            "Backend user listing skipped due missing/expired auth session",
            error,
          );
        }
      } else if (!hasLoggedUsersBackendIssue) {
        hasLoggedUsersBackendIssue = true;
        console.warn("Backend user listing failed", error);
      }
    }
  }

  const shouldTryEdge =
    useEdgeAdminFunctions && !usersEdgeUnavailable && !tableQuerySucceeded && byId.size === 0;
  if (shouldTryEdge) {
    try {
      const edgeUsers = await invokeAdminFunction<T[]>("admin-list-users");
      addRows(edgeUsers as any[], { preserveExisting: tableQuerySucceeded });
    } catch (error) {
      usersEdgeUnavailable = true;
      if (!hasLoggedUsersEdgeIssue) {
        hasLoggedUsersEdgeIssue = true;
        console.warn("Edge users listing unavailable; disabling edge fallback", error);
      }
    }
  }

  const merged = Array.from(byId.values());
  if (merged.length === 0) {
    if (backendUsersError && isAuthSessionBackendError(backendUsersError)) {
      throw backendUsersError as Error;
    }
    throw new Error("Failed to load users from all available sources");
  }

  const sorted = [...merged].sort((a: any, b: any) => {
    const aDate =
      a?.created_at || a?.createdAt || a?.updated_at || a?.updatedAt || "";
    const bDate =
      b?.created_at || b?.createdAt || b?.updated_at || b?.updatedAt || "";
    return String(bDate).localeCompare(String(aDate));
  });

  return sorted as T[];
}

export async function changeUserRoleAdmin(userId: string, role: string) {
  if (!usersBackendUnavailable && (useBackendAdminUsers || !useEdgeAdminFunctions)) {
    try {
      return await submitUserRoleChangeToBackend(userId, role);
    } catch (error) {
      if (!shouldFallbackFromBackend(error)) {
        throw error;
      }

      usersBackendUnavailable = true;
      if (!hasLoggedUsersBackendIssue) {
        hasLoggedUsersBackendIssue = true;
        console.warn(
          "Backend role update unavailable; falling back to direct table update",
          error,
        );
      }
    }
  }

  if (!useEdgeAdminFunctions) {
    const mappedRole = mapRequestedRoleForPersistence(role);
    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      role: mappedRole.legacyRole,
      role_v2: mappedRole.roleV2,
      workspace_role: mappedRole.workspaceRole,
      updatedAt: nowIso,
      updated_at: nowIso,
    };

    const { data, error: initialError } = await supabase
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    let error = initialError;

    if (error && isMissingWorkspaceRoleColumnError(error)) {
      delete payload.workspace_role;
      const retry = await supabase
        .from("users")
        .update(payload)
        .eq("id", userId)
        .select("id")
        .maybeSingle();
      error = retry.error;
      if (!error && !retry.data) {
        throw new Error("User profile not found; backend role sync is required");
      }
    }

    if (!error && !data) {
      throw new Error("User profile not found; backend role sync is required");
    }

    if (error) {
      throw new Error(error.message || "Failed to change user role");
    }

    return null;
  }

  return invokeAdminFunction<null>("admin-change-role", { userId, role });
}

export async function deleteUserAdmin(userId: string) {
  return invokeAdminFunction<null>("admin-delete-user", { userId });
}

export async function listPendingUsersAdmin<T>() {
  let tableError: unknown = null;
  let tableLookupSucceeded = false;

  try {
    const { data, error } = await supabase
      .from("pending_users")
      .select(
        "*, agent_contract_versions:contract_version_id(id, version_no, title, file_url)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!error) {
      tableLookupSucceeded = true;
      const normalized = normalizePendingRows<T>(data || []);
      if (normalized.length > 0) {
        return normalized;
      }
    } else {
      tableError = new Error(error.message || "Failed to load pending users");
    }
  } catch (error) {
    tableError = error;
  }

  try {
    const { data, error } = await supabase
      .from("pending_users")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!error) {
      tableLookupSucceeded = true;
      const normalized = normalizePendingRows<T>(data || []);
      if (normalized.length > 0) {
        return normalized;
      }
    } else if (!tableError) {
      tableError = new Error(error.message || "Failed to load pending users");
    }
  } catch (error) {
    if (!tableError) tableError = error;
  }

  try {
    const { data, error } = await supabase
      .from("pending_users")
      .select(
        "*, agent_contract_versions:contract_version_id(id, version_no, title, file_url)",
      )
      .order("created_at", { ascending: false });
    if (!error) {
      tableLookupSucceeded = true;
      const normalized = normalizePendingRows<T & { status?: string }>(data || []);
      const filtered = filterPendingRows(normalized) as T[];
      if (filtered.length > 0) {
        return filtered;
      }
    }
  } catch (error) {
    if (!tableError) tableError = error;
    // continue fallback chain
  }

  try {
    const { data, error } = await supabase
      .from("pending_users")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) {
      tableLookupSucceeded = true;
      const normalized = normalizePendingRows<T & { status?: string }>(data || []);
      const filtered = filterPendingRows(normalized) as T[];
      if (filtered.length > 0) {
        return filtered;
      }
    } else if (!tableError) {
      tableError = new Error(error.message || "Failed to load pending users");
    }
  } catch (error) {
    if (!tableError) tableError = error;
    // continue fallback chain
  }

  const shouldTryBackendFallback =
    !pendingUsersBackendUnavailable &&
    (useBackendPendingUsers || tableLookupSucceeded);

  if (shouldTryBackendFallback) {
    try {
      const backendRows = await listPendingUsersFromBackend<T & { status?: string }>();
      const filtered = filterPendingRows(normalizePendingRows(backendRows)) as T[];

      if (filtered.length > 0 || useBackendPendingUsers) {
        return filtered;
      }
    } catch (error) {
      if (shouldFallbackFromBackend(error)) {
        pendingUsersBackendUnavailable = true;
        if (!hasLoggedPendingUsersBackendIssue) {
          hasLoggedPendingUsersBackendIssue = true;
          console.warn(
            "Backend pending users listing unavailable; using fallback sources",
            error,
          );
        }
      } else if (!hasLoggedPendingUsersBackendIssue) {
        hasLoggedPendingUsersBackendIssue = true;
        console.warn("Backend pending users listing skipped", error);
      }
    }
  }

  if (useEdgeAdminFunctions && !pendingUsersEdgeUnavailable) {
    try {
      const edgeRows = await invokeAdminFunction<T[] | (T & { status?: string })[]>(
        "admin-list-pending-users",
      );
      const filtered = filterPendingRows(
        normalizePendingRows(edgeRows as (T & { status?: string })[]),
      ) as T[];

      return filtered;
    } catch (edgeError) {
      pendingUsersEdgeUnavailable = true;
      console.warn("pending users table and edge lookup both failed", {
        tableError,
        edgeError,
      });
      if (tableError) {
        throw tableError as Error;
      }
      throw edgeError;
    }
  }

  if (tableError) {
    throw tableError as Error;
  }

  return [];
}

export async function getPendingUserAdmin<T>(pendingUserId: string) {
  try {
    const { data, error } = await supabase
      .from("pending_users")
      .select(
        "*, agent_contract_versions:contract_version_id(id, version_no, title, file_url)",
      )
      .eq("id", pendingUserId)
      .maybeSingle();

    if (!error) {
      return (data as T | null) || null;
    }
  } catch {
    // fall through to basic lookup / edge fallback
  }

  try {
    const { data, error } = await supabase
      .from("pending_users")
      .select("*")
      .eq("id", pendingUserId)
      .maybeSingle();

    if (!error) {
      return (data as T | null) || null;
    }
  } catch {
    // fallback to edge function
  }

  if (!useEdgeAdminFunctions) {
    throw new Error("Failed to load pending user details");
  }

  return invokeAdminFunction<T | null>("admin-get-pending-user", {
    pendingUserId,
  });
}

export async function approvePendingUserAdmin(pendingUserId: string) {
  const shouldTryBackend = useBackendPendingUsers || !useEdgeAdminFunctions;

  if (shouldTryBackend) {
    try {
      return await submitPendingUserDecisionToBackend(pendingUserId, "approve");
    } catch (error) {
      if (!shouldFallbackFromBackend(error)) {
        throw error;
      }

      pendingUsersBackendUnavailable = true;
      if (!hasLoggedPendingUsersBackendIssue) {
        hasLoggedPendingUsersBackendIssue = true;
        console.warn(
          "Backend approve endpoint unavailable; falling back to legacy approval path",
          error,
        );
      }
    }
  }

  if (useEdgeAdminFunctions) {
    try {
      return await invokeAdminFunction<null>("admin-approve-request", {
        pendingUserId,
      });
    } catch (error) {
      if (!shouldFallbackFromEdge(error)) {
        throw error;
      }
      console.warn(
        "Edge approve request unavailable; falling back to direct table update",
        error,
      );
    }
  }

  return updatePendingUserStatusDirect(pendingUserId, "approved");
}

export async function declinePendingUserAdmin(
  pendingUserId: string,
  reason?: string,
) {
  const shouldTryBackend = useBackendPendingUsers || !useEdgeAdminFunctions;

  if (shouldTryBackend) {
    try {
      return await submitPendingUserDecisionToBackend(
        pendingUserId,
        "decline",
        reason,
      );
    } catch (error) {
      if (!shouldFallbackFromBackend(error)) {
        throw error;
      }

      pendingUsersBackendUnavailable = true;
      if (!hasLoggedPendingUsersBackendIssue) {
        hasLoggedPendingUsersBackendIssue = true;
        console.warn(
          "Backend decline endpoint unavailable; falling back to legacy decline path",
          error,
        );
      }
    }
  }

  if (useEdgeAdminFunctions) {
    try {
      return await invokeAdminFunction<null>("admin-decline-request", {
        pendingUserId,
        reason,
      });
    } catch (error) {
      if (!shouldFallbackFromEdge(error)) {
        throw error;
      }
      console.warn(
        "Edge decline request unavailable; falling back to direct table update",
        error,
      );
    }
  }

  return updatePendingUserStatusDirect(pendingUserId, "declined", reason);
}

export async function checkEmailExists(email: string) {
  if (!useEdgeAdminFunctions) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to validate email");
    }

    return Boolean(data);
  }

  return invokeAdminFunction<boolean>("public-check-email", { email });
}

export async function sendAdminTestEmail(recipientEmail: string) {
  const normalized = String(recipientEmail || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Valid recipient email is required");
  }

  return submitAdminTestEmailToBackend(normalized);
}
