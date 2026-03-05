import { supabase } from "../supabaseClient";

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

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

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

function mapRequestedRoleToUserRole(value: unknown) {
  const role = String(value || "user").trim().toLowerCase();
  switch (role) {
    case "admin":
    case "superadmin":
    case "manager":
    case "provider":
    case "agent":
    case "subcontractor":
    case "user":
      return role;
    default:
      return "user";
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
      payload.role = mapRequestedRoleToUserRole(roleRequested);
      payload.access = "active";
    }

    await supabase.from("users").update(payload).eq("id", existingUser.id);
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
    throw new Error("Missing auth session");
  }

  const response = await fetch(resolveBackendUrl("/api/v1/admin/users"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load users (${response.status})`);
  }

  const payload = (await response.json()) as ApiResult<T[]> | { data?: T[] };
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
    throw new Error("Missing auth session");
  }

  const response = await fetch(resolveBackendUrl("/api/v1/admin/users/pending"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to load pending users (${response.status})`);
  }

  const payload = (await response.json()) as ApiResult<T[]> | { data?: T[] };
  const rows =
    payload && typeof payload === "object" && "data" in payload
      ? payload.data
      : undefined;

  return (rows || []) as T[];
}

export async function listUsersAdmin<T>() {
  const byId = new Map<string, any>();
  let tableQuerySucceeded = false;

  const addRows = (rows: any[] | undefined | null) => {
    for (const row of rows || []) {
      const id = String(row?.id || row?.user_id || row?.auth_user_id || "").trim();
      const fallbackId = String(row?.email || "").trim().toLowerCase();
      const key = id || fallbackId;
      if (!key) continue;

      const prev = byId.get(key) || {};
      byId.set(key, { ...prev, ...row });
    }
  };

  try {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      throw error;
    }
    tableQuerySucceeded = true;
    addRows(data as any[]);
  } catch (error) {
    if (!hasLoggedUsersTableIssue) {
      hasLoggedUsersTableIssue = true;
      console.warn("Table users fallback unavailable", error);
    }
  }

  if (
    useBackendAdminUsers &&
    !tableQuerySucceeded &&
    !usersBackendUnavailable &&
    byId.size === 0
  ) {
    try {
      const backendUsers = await listUsersFromBackend<T>();
      addRows(backendUsers as any[]);
    } catch (error) {
      usersBackendUnavailable = true;
      if (!hasLoggedUsersBackendIssue) {
        hasLoggedUsersBackendIssue = true;
        console.warn("Backend user listing unavailable; using fallback sources", error);
      }
    }
  }

  const shouldTryEdge =
    useEdgeAdminFunctions && !usersEdgeUnavailable && !tableQuerySucceeded && byId.size === 0;
  if (shouldTryEdge) {
    try {
      const edgeUsers = await invokeAdminFunction<T[]>("admin-list-users");
      addRows(edgeUsers as any[]);
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
      pendingUsersBackendUnavailable = true;
      if (!hasLoggedPendingUsersBackendIssue) {
        hasLoggedPendingUsersBackendIssue = true;
        console.warn(
          "Backend pending users listing unavailable; using fallback sources",
          error,
        );
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
