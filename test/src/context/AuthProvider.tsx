// src/context/AuthProvider.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (email: string, password: string, name?: string) => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => null,
  signup: async () => null,
  logout: async () => {},
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
    const { data, error } = await supabase.from("users").select("*").eq("id", uid).maybeSingle();
    if (error) return null;
    if (!data) return null;

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
    };
  } catch {
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
          setCurrentUser(null);
          return;
        }
        if (session?.user) {
          const user = await fetchUser(session.user.id);
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (!session?.user) {
          setCurrentUser(null);
          return;
        }
        const user = await fetchUser(session.user.id);
        setCurrentUser(user);
      }, 500);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session?.user) return null;

    const user = await fetchUser(data.session.user.id);
    if (user) setCurrentUser(user);
    return user;
  };

  const signup = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) return null;

    // Insert into users table with extra fields
    const { error: insertError } = await supabase.from("users").insert([
      {
        id: data.user.id,
        email,
        username: name || email.split("@")[0],
        role: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    if (insertError) console.error("Error inserting into users table:", insertError.message);

    const user = await fetchUser(data.user.id);
    if (user) setCurrentUser(user);
    return user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
