import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
  hasPendingRequest: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => null,
  logout: async () => {},
  hasPendingRequest: async () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function toRole(value: any): Role {
  const v = String(value ?? "user") as Role;
  return ["user", "provider", "admin", "superadmin", "manager"].includes(v) ? v : "user";
}

async function fetchUser(uid: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        email,
        username,
        role,
        first_name,
        last_name,
        phone,
        blacklist,
        company,
        access,
        status,
        birth_date,
        id_card_number,
        travel_history,
        passport_number,
        passport_expire,
        allergy,
        emergency_phone,
        membership_rank,
        membership_points,
        registered_by,
        createdBy,
        createdAt,
        updatedAt,
        auth_user_id
      `)
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      console.error("fetchUser: Failed to fetch user from users table", {
        error: error.message,
        code: error.code,
        details: error.details,
      });
      return null;
    }
    if (!data) {
      console.warn("fetchUser: No user data found for uid", { uid });
      return null;
    }

    return {
      userId: String(data.id),
      id: String(data.id),
      first_name: String(data.first_name ?? ""),
      last_name: String(data.last_name ?? ""),
      username: String(data.username ?? ""),
      role: toRole(data.role),
      phone: String(data.phone ?? ""),
      email: String(data.email ?? ""),
      password: "",
      blacklist: Boolean(data.blacklist ?? false),
      company: String(data.company ?? ""),
      access: String(data.access ?? "active") as "active" | "suspended",
      status: String(data.status ?? "approved") as "pending" | "approved" | "declined",
      birth_date: String(data.birth_date ?? ""),
      id_card_number: String(data.id_card_number ?? ""),
      travel_history: Array.isArray(data.travel_history) ? data.travel_history : [],
      passport_number: String(data.passport_number ?? ""),
      passport_expire: String(data.passport_expire ?? ""),
      allergy: String(data.allergy ?? ""),
      emergency_phone: String(data.emergency_phone ?? ""),
      membership_rank: String(data.membership_rank ?? ""),
      membership_points: Number(data.membership_points ?? 0),
      registered_by: String(data.registered_by ?? ""),
      createdBy: String(data.createdBy ?? ""),
      createdAt: String(data.createdAt ?? new Date().toISOString()),
      updatedAt: String(data.updatedAt ?? new Date().toISOString()),
      auth_user_id: String(data.auth_user_id ?? ""),
    };
  } catch (error) {
    console.error("fetchUser: Unexpected error", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("AuthProvider: Failed to get session", { error });
          setCurrentUser(null);
          return;
        }
        if (session?.user) {
          const user = await fetchUser(session.user.id);
          if (!user) {
            console.warn("AuthProvider: No user data found in users table", {
              userId: session.user.id,
            });
          }
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("AuthProvider: Unexpected error during init", {
          error,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", { event, session });
      if (event === "PASSWORD_RECOVERY") {
        console.log("Skipping currentUser update for PASSWORD_RECOVERY");
        return; // Skip setting currentUser to avoid redirect
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (!session?.user) {
          setCurrentUser(null);
          return;
        }
        const user = await fetchUser(session.user.id);
        if (!user) {
          console.warn("AuthProvider: No user data found on auth state change", {
            userId: session.user.id,
          });
        }
        setCurrentUser(user);
      }, 500);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, []);

  const hasPendingRequest = async (email: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("pending_users")
        .select("id")
        .eq("email", email)
        .single();
      return !!data;
    } catch {
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("login: Failed to sign in", { error });
      throw error;
    }
    if (!data.session?.user) {
      console.warn("login: No user session after login");
      return null;
    }

    const user = await fetchUser(data.session.user.id);
    if (user) {
      setCurrentUser(user);
    } else {
      console.warn("login: No user data found after login", {
        userId: data.session.user.id,
      });
    }
    return user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        logout,
        hasPendingRequest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};