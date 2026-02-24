import { supabase } from "../supabaseClient";

type ApiResult<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

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

export async function listUsersAdmin<T>() {
  return invokeAdminFunction<T[]>("admin-list-users");
}

export async function changeUserRoleAdmin(userId: string, role: string) {
  return invokeAdminFunction<null>("admin-change-role", { userId, role });
}

export async function deleteUserAdmin(userId: string) {
  return invokeAdminFunction<null>("admin-delete-user", { userId });
}

export async function listPendingUsersAdmin<T>() {
  return invokeAdminFunction<T[]>("admin-list-pending-users");
}

export async function getPendingUserAdmin<T>(pendingUserId: string) {
  return invokeAdminFunction<T | null>("admin-get-pending-user", {
    pendingUserId,
  });
}

export async function approvePendingUserAdmin(pendingUserId: string) {
  return invokeAdminFunction<null>("admin-approve-request", { pendingUserId });
}

export async function declinePendingUserAdmin(
  pendingUserId: string,
  reason?: string,
) {
  return invokeAdminFunction<null>("admin-decline-request", {
    pendingUserId,
    reason,
  });
}

export async function checkEmailExists(email: string) {
  return invokeAdminFunction<boolean>("public-check-email", { email });
}
