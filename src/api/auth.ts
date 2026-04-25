import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";
import { normalizeRole, resolveUserRoleFromProfile } from "../utils/roles";

// Convert DB role to Role type
function toRole(value: any): Role {
  return normalizeRole(value);
}

type DbErrorLike = {
  code?: string;
  message?: string;
};

function isMissingColumnError(error: unknown) {
  const dbError = error as DbErrorLike;
  const message = String(dbError?.message || "").toLowerCase();
  return (
    dbError?.code === "42703" ||
    dbError?.code === "PGRST204" ||
    message.includes("column")
  );
}

function mapProfileToUser(userData: Record<string, unknown>): User {
  return {
    userId: String(userData.id),
    id: String(userData.id),
    first_name: String(userData.first_name ?? userData.firstname ?? ""),
    last_name: String(userData.last_name ?? userData.lastname ?? ""),
    username: String(userData.username ?? ""),
    role: toRole(
      resolveUserRoleFromProfile(
        userData as {
          role?: unknown;
          role_v2?: unknown;
          workspace_role?: unknown;
        },
      ),
    ),
    workspace_role: String(
      (userData as { workspace_role?: unknown }).workspace_role ?? "",
    ),
    status: ["pending", "declined", "approved"].includes(
      String(userData.status),
    )
      ? (userData.status as "pending" | "declined" | "approved")
      : "pending",
    email: String(userData.email ?? ""),
    password: "",
    phone: String(userData.phone ?? userData.phone_number ?? ""),
    blacklist: Boolean(userData.blacklist ?? false),
    access:
      String(userData.access || "").toLowerCase() === "suspended"
        ? "suspended"
        : "active",
    company: String(userData.company ?? userData.company_name ?? ""),
    birth_date: String(userData.birth_date ?? ""),
    id_card_number: String(userData.id_card_number ?? ""),
    passport_number: String(userData.passport_number ?? ""),
    passport_expire: String(userData.passport_expire ?? ""),
    allergy: String(userData.allergy ?? ""),
    emergency_phone: String(userData.emergency_phone ?? ""),
    membership_rank: String(userData.membership_rank ?? ""),
    membership_points: Number(userData.membership_points ?? 0),
    registered_by: String(userData.registered_by ?? ""),
    createdBy: String(userData.createdBy ?? ""),
    createdAt: String(userData.createdAt ?? userData.created_at ?? ""),
    updatedAt: String(userData.updatedAt ?? userData.updated_at ?? ""),
    travel_history: Array.isArray(userData.travel_history)
      ? userData.travel_history
      : [],
    auth_user_id: String(userData.auth_user_id ?? ""),
  };
}

// Login function
export async function loginUser(
  email: string,
  password: string,
): Promise<User | null> {
  try {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
    if (authError) throw authError;
    if (!authData.user) return null;

    const uid = authData.user.id;
    const { data: byId, error: byIdError } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (byId) {
      return mapProfileToUser(byId as Record<string, unknown>);
    }

    if (byIdError && !isMissingColumnError(byIdError)) {
      throw byIdError;
    }

    const { data: byAuthUserId, error: byAuthUserIdError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", uid)
      .maybeSingle();

    if (byAuthUserId) {
      return mapProfileToUser(byAuthUserId as Record<string, unknown>);
    }

    if (byAuthUserIdError && !isMissingColumnError(byAuthUserIdError)) {
      throw byAuthUserIdError;
    }

    const { data: byEmail, error: byEmailError } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (byEmailError) throw byEmailError;
    if (!byEmail) return null;

    return mapProfileToUser(byEmail as Record<string, unknown>);
  } catch (err: any) {
    return null;
  }
}

// Signup request (sends confirmation link)
export async function signupUser(
  email: string,
  password: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/pending",
      },
    });
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Signup error:", err);
    return false;
  }
}
