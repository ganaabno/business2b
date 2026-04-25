import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";
import { normalizeRole, resolveUserRoleFromProfile } from "../utils/roles";

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

function mapProfileToUser(data: Record<string, unknown>): User {
  return {
    userId: String(data.id),
    id: String(data.id),
    first_name: String(data.first_name ?? data.firstname ?? ""),
    last_name: String(data.last_name ?? data.lastname ?? ""),
    username: String(data.username ?? ""),
    role: resolveUserRoleFromProfile(
      data as {
        role?: unknown;
        role_v2?: unknown;
        workspace_role?: unknown;
      },
    ),
    workspace_role: String(
      (data as { workspace_role?: unknown }).workspace_role ?? "",
    ),
    phone: String(data.phone ?? data.phone_number ?? ""),
    email: String(data.email ?? ""),
    password: "",
    blacklist: Boolean(data.blacklist ?? false),
    company: String(data.company ?? data.company_name ?? ""),
    access: String(data.access ?? "active") as "active" | "suspended",
    status: String(data.status ?? "approved") as
      | "pending"
      | "approved"
      | "declined",
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
    createdAt: String(data.createdAt ?? data.created_at ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? data.updated_at ?? new Date().toISOString()),
    auth_user_id: String(data.auth_user_id ?? ""),
  };
}

async function fetchUser(uid: string, emailHint?: string | null): Promise<User | null> {
  try {
    const byId = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (byId.data) {
      return mapProfileToUser(byId.data as Record<string, unknown>);
    }

    if (byId.error && !isMissingColumnError(byId.error)) {
      return null;
    }

    const byAuthUserId = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", uid)
      .maybeSingle();

    if (byAuthUserId.data) {
      return mapProfileToUser(byAuthUserId.data as Record<string, unknown>);
    }

    if (byAuthUserId.error && !isMissingColumnError(byAuthUserId.error)) {
      return null;
    }

    const normalizedEmail = String(emailHint || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const byEmail = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (byEmail.error || !byEmail.data) {
      return null;
    }

    return mapProfileToUser(byEmail.data as Record<string, unknown>);
  } catch (error) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------------------------------- */
  /* Initialise auth state              */
  /* ---------------------------------- */
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setCurrentUser(null);
          return;
        }

        if (session?.user) {
          const user = await fetchUser(session.user.id, session.user.email);
          if (!user) {
          }
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    void init();

    /* ---------------------------------- */
    /* Listen to auth events              */
    /* ---------------------------------- */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        return; // Skip setting currentUser to avoid redirect
      }

      if (event === "TOKEN_REFRESHED") {
        return; // Avoid unnecessary app-wide reload on tab/app focus
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (!session?.user) {
          setCurrentUser(null);
          return;
        }
        const user = await fetchUser(session.user.id, session.user.email);
        if (!user) {
        }
        setCurrentUser(user);
      }, 500);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, []);

  /* ---------------------------------- */
  /* API methods                        */
  /* ---------------------------------- */
  const hasPendingRequest = async (email: string): Promise<boolean> => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("pending_users")
        .select("id, status")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (error) {
        return false;
      }

      return (
        !!data &&
        String((data as { status?: string })?.status || "pending")
          .trim()
          .toLowerCase() === "pending"
      );
    } catch {
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      throw error;
    }
    if (!data.session?.user) return null;

    const user = await fetchUser(data.session.user.id, data.session.user.email);
    if (user) {
      setCurrentUser(user);
    } else {
      throw new Error(
        "Account is authenticated but profile is not provisioned yet. Please contact admin.",
      );
    }
    return user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, loading, login, logout, hasPendingRequest }}
    >
      {children}
    </AuthContext.Provider>
  );
};
