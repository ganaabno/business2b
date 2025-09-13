// src/context/AuthProvider.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => null,
  logout: async () => { },
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
    console.log(`Fetching user with ID: ${uid}`);
    const { data, error } = await supabase.from("users").select("*").eq("id", uid).maybeSingle();
    if (error) {
      console.error("fetchUser error:", error.message);
      return null;
    }
    if (!data) {
      console.warn(`No user found for ID: ${uid}`);
      return null;
    }

    console.log("User fetched successfully:", data);
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
      access: String(data.access ?? "active") as "active" | "suspended", // Match DB schema
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
      createdAt: String(data.createdAt ?? new Date().toISOString()), // Keep as string
      updatedAt: String(data.updatedAt ?? new Date().toISOString()), // Keep as string
    };
  } catch (err) {
    console.error("Unexpected error in fetchUser:", err);
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
        console.log("Starting auth initialization");
        // Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const sessionResult = await Promise.race([
          sessionPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Session fetch timeout")), 5000)),
        ]);
        const { data: { session }, error } = sessionResult as any;
        if (error) {
          console.error("getSession error:", error.message);
          setCurrentUser(null);
          return;
        }
        console.log("Session fetched:", session ? "User present" : "No session");
        if (session?.user) {
          const user = await fetchUser(session.user.id);
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Error in auth initialization:", err);
        setCurrentUser(null);
      } finally {
        console.log("Auth initialization complete, setting loading to false");
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event, session ? "User present" : "No session");
      // Debounce to prevent multiple rapid SIGNED_IN events
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          if (!session?.user) {
            console.log("No user in session, clearing currentUser");
            setCurrentUser(null);
            return;
          }
          const user = await fetchUser(session.user.id);
          console.log("Setting currentUser from auth state change:", user);
          setCurrentUser(user);
        } catch (err) {
          console.error("Error in onAuthStateChange:", err);
          setCurrentUser(null);
        }
      }, 500);
    });

    return () => {
      console.log("Unsubscribing from auth state changes");
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log("Attempting login for:", email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Login error:", error.message);
      throw error;
    }
    if (!data.session?.user) {
      console.warn("No user in login session");
      return null;
    }
    const user = await fetchUser(data.session.user.id);
    if (user) {
      console.log("Login successful, setting currentUser:", user);
      setCurrentUser(user);
    }
    return user;
  };

  const logout = async () => {
    console.log("Logging out");
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};