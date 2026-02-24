import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";

// Convert DB role to Role type
function toRole(value: any): Role {
  const v = String(value ?? "user") as Role;
  return ["user", "provider", "admin", "superadmin", "manager"].includes(v)
    ? v
    : "user";
}

// Login function
export async function loginUser(
  email: string,
  password: string
): Promise<User | null> {
  try {
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });
    if (authError) throw authError;
    if (!authData.user) return null;

    const uid = authData.user.id;
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) return null;

    const user: User = {
      userId: String(userData.id),
      id: String(userData.id),
      first_name: String(userData.first_name ?? ""),
      last_name: String(userData.last_name ?? ""),
      username: String(userData.username ?? ""),
      role: toRole(userData.role),
      status: ["pending", "declined", "approved"].includes(
        String(userData.status)
      )
        ? (userData.status as "pending" | "declined" | "approved")
        : "pending", // fallback
      email: String(userData.email ?? ""),
      password: "",
      phone: String(userData.phone ?? ""),
      blacklist: Boolean(userData.blacklist ?? false),
      access: (userData.access === "suspended" ? "suspended" : "active"),
      company: String(userData.company ?? ""),
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
      createdAt: "",
      updatedAt: "",
      travel_history: Array.isArray(userData.travel_history)
        ? userData.travel_history
        : [],
    };
    return user;
  } catch (err: any) {
    return null;
  }
}

// Signup request (sends confirmation link)
export async function signupUser(
  email: string,
  password: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/pending", // redirect after signup
      },
    });
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Signup error:", err);
    return false;
  }
}
  