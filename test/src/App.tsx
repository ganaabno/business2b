import { useState, useEffect, useMemo, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Login from "./components/Login";
import UserInterface from "./components/UserInterface";
import AdminInterface from "./components/AdminInterface";
import ProviderInterface from "./components/ProviderInterface";
import ChangePassword from "./components/ChangePassword";
import type { User as UserType, Role, Tour, Order } from "./types/type";

// Helper to coerce any value to a valid Role
function toRole(value: any): Role {
  const v = String(value ?? "user") as Role;
  return v === "admin" || v === "superadmin" || v === "provider" || v === "user" ? v : "user";
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);

  const role = useMemo<Role>(() => toRole(currentUser?.role), [currentUser]);

  // Prevent double init in React 18 StrictMode (dev)
  const initedRef = useRef(false);

  // Restore auth session on first load and hydrate currentUser from public.users
  useEffect(() => {
    if (initedRef.current) {
      console.log("[boot] Skipping duplicate init due to StrictMode");
      return;
    }
    initedRef.current = true;

    console.log("[boot] Starting initialization...");
    let cancelled = false;

    // Shorter watchdog for faster debugging
    const watchdog = setTimeout(() => {
      if (!cancelled) {
        console.warn("[boot] Watchdog triggered after 3s — forcing boot complete");
        setBooting(false);
      }
    }, 3000);

    const init = async () => {
      try {
        console.log("[boot] Step 1: Checking supabase client...");
        if (!supabase) {
          console.error("[boot] Supabase client is undefined!");
          return;
        }

        console.log("[boot] Step 2: Getting session...");
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        console.log("[boot] Session result:", { sessionData, sessionErr });

        if (sessionErr) {
          console.error("[boot] getSession error:", sessionErr);
          return;
        }

        let userId: string | null = sessionData?.session?.user?.id ?? null;
        console.log("[boot] User ID from session:", userId);

        // If no session, try getUser
        if (!userId) {
          console.log("[boot] Step 3: No session, trying getUser...");
          const { data: authData, error: authErr } = await supabase.auth.getUser();
          console.log("[boot] getUser result:", { authData, authErr });

          if (authErr) {
            console.error("[boot] getUser error:", authErr);
            return;
          }
          userId = authData?.user?.id ?? null;
          console.log("[boot] User ID from getUser:", userId);
        }

        // If there is a logged-in user, hydrate profile
        if (userId) {
          console.log("[boot] Step 4: Fetching user profile for ID:", userId);
          const { data: row, error: rowErr } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          console.log("[boot] User profile result:", { row, rowErr });

          if (rowErr) {
            console.error("[boot] Fetch current user row error:", rowErr);
          } else if (row) {
            console.log("[boot] Step 5: Creating user object from row:", row);
            try {
              console.log("[boot] Step 5a: Processing basic fields...");
              const full: UserType = {
                userId: String(row.id),
                id: String(row.id),
                first_name: String(row.first_name ?? ""),
                last_name: String(row.last_name ?? ""),
                username: String(row.username ?? ""),
                role: toRole(row.role),
                phone: String(row.phone ?? ""),
                email: String(row.email ?? ""),
                password: "",
                blacklist: Boolean(row.blacklist ?? false),
                company: String(row.company ?? ""),
                access: String(row.access ?? "active"),
                birth_date: String(row.birth_date ?? ""),
                id_card_number: String(row.id_card_number ?? ""),
                travel_history: Array.isArray(row.travel_history) ? row.travel_history : [],
                passport_number: String(row.passport_number ?? ""),
                passport_expire: String(row.passport_expire ?? ""),
                allergy: String(row.allergy ?? ""),
                emergency_phone: String(row.emergency_phone ?? ""),
                membership_rank: String(row.membership_rank ?? ""),
                membership_points: Number(row.membership_points ?? 0),
                registered_by: String(row.registered_by ?? ""),
                createdBy: String(row.createdBy ?? ""),
                createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
                updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
              };
              console.log("[boot] Step 5b: User object created successfully:", full);
              console.log("[boot] Step 6: Setting current user...");
              setCurrentUser(full);
              console.log("[boot] Step 6a: Current user set successfully");
            } catch (userObjError) {
              console.error("[boot] Error creating user object:", userObjError);
            }
          } else {
            console.warn("[boot] No public.users row found for auth user", userId);
          }
        } else {
          console.info("[boot] No active session - user not logged in");
        }
      } catch (e) {
        console.error("[boot] Unexpected init error:", e);
      } finally {
        console.log("[boot] Step 7: Boot complete, setting booting to false");
        setBooting(false);
        clearTimeout(watchdog);
      }
    };

    console.log("[boot] About to call init()...");
    init().then(() => {
      console.log("[boot] init() completed successfully");
    }).catch((err) => {
      console.error("[boot] init() failed:", err);
      if (!cancelled) {
        console.log("[boot] Force completing boot due to init error");
        setBooting(false);
        clearTimeout(watchdog);
      }
    });

    // Keep session/user in sync with auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("[auth change] Auth state changed:", _event, session?.user?.id);
      if (!session?.user) {
        setCurrentUser(null);
        return;
      }
      const { data: row, error } = await supabase.from("users").select("*").eq("id", session.user.id).maybeSingle();
      if (error) {
        console.error("[auth change] load users row error:", error);
        return;
      }
      if (row) {
        const full: UserType = {
          userId: String(row.id),
          id: String(row.id),
          first_name: String(row.first_name ?? ""),
          last_name: String(row.last_name ?? ""),
          username: String(row.username ?? ""),
          role: toRole(row.role),
          phone: String(row.phone ?? ""),
          email: String(row.email ?? ""),
          password: "",
          blacklist: Boolean(row.blacklist ?? false),
          company: String(row.company ?? ""),
          access: String(row.access ?? "active"),
          birth_date: String(row.birth_date ?? ""),
          id_card_number: String(row.id_card_number ?? ""),
          travel_history: Array.isArray(row.travel_history) ? row.travel_history : [],
          passport_number: String(row.passport_number ?? ""),
          passport_expire: String(row.passport_expire ?? ""),
          allergy: String(row.allergy ?? ""),
          emergency_phone: String(row.emergency_phone ?? ""),
          membership_rank: String(row.membership_rank ?? ""),
          membership_points: Number(row.membership_points ?? 0),
          registered_by: String(row.registered_by ?? ""),
          createdBy: String(row.createdBy ?? ""),
          createdAt: new Date(row.createdAt ?? Date.now()),
          updatedAt: new Date(row.updatedAt ?? Date.now()),
        };
        setCurrentUser(full);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  // Fetch data when logged in or role changes
  useEffect(() => {
    if (!currentUser) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Users: only admins should load all users
      if (role === "admin" || role === "superadmin") {
        const { data: usersData, error: usersErr } = await supabase.from("users").select("*");
        if (usersErr) console.error("Load users error:", usersErr);
        setUsers((usersData as any) || []);
      } else {
        // For non-admins, optionally load just self
        const { data: me } = await supabase.from("users").select("*").eq("id", currentUser!.id).maybeSingle();
        setUsers(me ? [me as any] : []);
      }

      // Tours: all authenticated can read (per policies)
      const { data: toursData, error: toursErr } = await supabase.from("tours").select("*");
      if (toursErr) console.error("Load tours error:", toursErr);
      setTours((toursData as any) || []);

      // Orders: admins get all, others get their own
      if (role === "admin" || role === "superadmin") {
        const { data: ordersData, error: ordersErr } = await supabase.from("orders").select("*, passengers(*)");
        if (ordersErr) console.error("Load orders error:", ordersErr);
        setOrders((ordersData as any) || []);
      } else {
        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("*, passengers(*)")
          .eq("user_id", currentUser!.id);
        if (ordersErr) console.error("Load orders error:", ordersErr);
        setOrders((ordersData as any) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  // Realtime: live-update currentUser when their row changes (e.g., role edited in DB)
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`user-row-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `id=eq.${currentUser.id}`,
        },
        (payload: any) => {
          const row = (payload.new || payload.old) as any;
          if (!row) return;

          const updated: UserType = {
            ...currentUser,
            first_name: String(row.first_name ?? ""),
            last_name: String(row.last_name ?? ""),
            username: String(row.username ?? ""),
            role: ["admin", "superadmin", "provider", "user"].includes(row.role) ? row.role : "user",
            phone: String(row.phone ?? ""),
            email: String(row.email ?? ""),
            blacklist: Boolean(row.blacklist ?? false),
            company: String(row.company ?? ""),
            access: String(row.access ?? "active"),
            birth_date: String(row.birth_date ?? ""),
            id_card_number: String(row.id_card_number ?? ""),
            travel_history: Array.isArray(row.travel_history) ? row.travel_history : [],
            passport_number: String(row.passport_number ?? ""),
            passport_expire: String(row.passport_expire ?? ""),
            allergy: String(row.allergy ?? ""),
            emergency_phone: String(row.emergency_phone ?? ""),
            membership_rank: String(row.membership_rank ?? ""),
            membership_points: Number(row.membership_points ?? 0),
            registered_by: String(row.registered_by ?? ""),
            createdBy: String(row.createdBy ?? ""),
            createdAt: new Date(row.createdAt ?? currentUser.createdAt),
            updatedAt: new Date(row.updatedAt ?? Date.now()),
            id: String(row.id),
            userId: String(row.id),
            password: "",
          };
          setCurrentUser(updated);

          // Immediately refetch data because role may have changed
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]);
    setTours([]);
    setOrders([]);
  };

  const handleChangePassword = async (newPassword: string): Promise<boolean> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert("Failed to change password: " + error.message);
      return false;
    }
    alert("Password updated successfully!");
    return true;
  };

  // While restoring session
  if (booting) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  // Not logged in yet: show Login
  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  // Decide the default home route by role
  const homePath =
    role === "admin" || role === "superadmin"
      ? "/admin"
      : role === "provider"
      ? "/provider"
      : "/user";

  return (
    <Router>
      {["admin", "superadmin"].includes(role) && (
        <div style={{ padding: 12, display: "flex", gap: 12, borderBottom: "1px solid #eee" }}>
          <span style={{ fontWeight: 600 }}>View as:</span>
          <Link to="/user">User</Link>
          <Link to="/provider">Provider</Link>
          <Link to="/admin">Admin</Link>
        </div>
      )}

      <Routes>
        <Route path="/change-password" element={<ChangePassword onChangePassword={handleChangePassword} />} />

        <Route
          path="/user"
          element={
            ["user", "provider", "admin", "superadmin"].includes(role) ? (
              <UserInterface
                tours={tours}
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />

        <Route
          path="/provider"
          element={
            ["provider", "admin", "superadmin"].includes(role) ? (
              <ProviderInterface
                tours={tours}
                setTours={setTours}
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />

        <Route
          path="/admin"
          element={
            ["admin", "superadmin"].includes(role) ? (
              <AdminInterface
                users={users}
                setUsers={setUsers}
                tours={tours}
                setTours={setTours}
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />

        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/login" element={<Navigate to={homePath} replace />} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </Router>
  );
}