import { useState, useEffect, useMemo, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Login from "./components/Login";
import UserInterface from "./components/UserInterface";
import AdminInterface from "./components/AdminInterface";
import ProviderInterface from "./components/ProviderInterface";
import ChangePassword from "./components/ChangePassword";
import ManagerInterface from "./components/ManagerInterface";
import type { User as UserType, Role, Tour, Order, Passenger } from "./types/type";

function toRole(value: any): Role {
  console.log("[toRole] Input value:", value);
  const v = String(value ?? "user") as Role;
  console.log("[toRole] Coerced to string:", v);
  const result = v === "admin" || v === "superadmin" || v === "provider" || v === "user" || v === "manager" ? v : "user";
  console.log("[toRole] Final role:", result);
  return result;
}

function AppContent({
  currentUser,
  role,
  booting,
  loading,
  users,
  tours,
  orders,
  passengers,
  setUsers,
  setTours,
  setOrders,
  setPassengers,
  handleLogout,
  handleChangePassword,
}: {
  currentUser: UserType | null;
  role: Role;
  booting: boolean;
  loading: boolean;
  users: UserType[];
  tours: Tour[];
  orders: Order[];
  passengers: Passenger[];
  setUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  handleLogout: () => Promise<void>;
  handleChangePassword: (newPassword: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const homePath = useMemo(
    () =>
      role === "admin" || role === "superadmin"
        ? "/admin"
        : role === "provider"
          ? "/provider"
          : role === "manager"
            ? "/manager"
            : "/user",
    [role]
  );

  useEffect(() => {
    if (!currentUser || booting) return;

    const validPaths = ["admin", "superadmin"].includes(role)
      ? ["/user", "/provider", "/admin", "/manager", "/change-password"]
      : role === "provider"
        ? ["/user", "/provider", "/change-password"]
        : role === "manager"
          ? ["/user", "/manager", "/change-password"]
          : ["/user", "/change-password"];

    if (!validPaths.includes(location.pathname)) {
      console.log("[redirect] Current path is invalid for role:", location.pathname, "Navigating to:", homePath);
      navigate(homePath, { replace: true });
    } else {
      console.log("[redirect] Current path is valid:", location.pathname, "No redirect needed");
    }
  }, [currentUser, role, booting, navigate, homePath, location.pathname]);

  if (booting || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-4 border-blue-600 border-solid rounded-full animate-spin border-t-transparent"></div>
          <p className="text-lg font-medium text-gray-800">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={(user) => { }} />;
  }

  return (
    <>
      {["admin", "superadmin"].includes(role) && (
        <div className="flex items-center gap-3 p-3 border-b border-gray-200 bg-white">
          <span className="font-semibold text-gray-800">View as:</span>
          <Link to="/user" className="text-blue-600 hover:text-blue-800">User</Link>
          <Link to="/provider" className="text-blue-600 hover:text-blue-800">Provider</Link>
          <Link to="/admin" className="text-blue-600 hover:text-blue-800">Admin</Link>
          <Link to="/manager" className="text-blue-600 hover:text-blue-800">Manager</Link>
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
            ["provider", "admin", "superadmin", "manager"].includes(role) ? (
              <ProviderInterface
                tours={tours}
                setTours={setTours}
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

        <Route
          path="/manager"
          element={
            ["manager", "admin", "superadmin"].includes(role) ? (
              <ManagerInterface
                tours={tours}
                setTours={setTours}
                orders={orders}
                setOrders={setOrders}
                passengers={passengers}
                setPassengers={setPassengers}
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
    </>
  );
}

// Rest of the App component remains unchanged
export default function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);

  const role = useMemo<Role>(() => toRole(currentUser?.role), [currentUser]);
  console.log("[App] Current user role:", role, "Current user:", currentUser);

  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current) {
      console.log("[boot] Skipping duplicate init due to StrictMode");
      return;
    }
    initedRef.current = true;

    console.log("[boot] Starting initialization...");
    let cancelled = false;

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
                passport_expire: String(row.passport_expiry ?? ""),
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
              setCurrentUser(full);
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

    init().catch((err) => {
      console.error("[boot] init() failed:", err);
      setBooting(false);
      clearTimeout(watchdog);
    });

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
          passport_expire: String(row.passport_expiry ?? ""),
          allergy: String(row.allergy ?? ""),
          emergency_phone: String(row.emergency_phone ?? ""),
          membership_rank: String(row.membership_rank ?? ""),
          membership_points: Number(row.membership_points ?? 0),
          registered_by: String(row.registered_by ?? ""),
          createdBy: String(row.createdBy ?? ""),
          createdAt: new Date(row.createdAt ?? Date.now()),
          updatedAt: new Date(row.updatedAt ?? Date.now()),
        };
        console.log("[auth change] Setting currentUser:", full);
        setCurrentUser(full);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (role === "admin" || role === "superadmin" || role === "manager") {
        const { data: usersData, error: usersErr } = await supabase.from("users").select("*");
        if (usersErr) console.error("Load users error:", usersErr);
        setUsers((usersData as any) || []);
      } else {
        const { data: me } = await supabase.from("users").select("*").eq("id", currentUser!.id).maybeSingle();
        setUsers(me ? [me as any] : []);
      }

      const { data: toursData, error: toursErr } = await supabase.from("tours").select("*");
      if (toursErr) console.error("Load tours error:", toursErr);
      setTours((toursData as any) || []);

      if (role === "admin" || role === "superadmin" || role === "manager") {
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

      if (role === "admin" || role === "superadmin" || role === "manager") {
        const { data: passengersData, error: passengersErr } = await supabase.from("passengers").select("*");
        if (passengersErr) console.error("Load passengers error:", passengersErr);
        setPassengers((passengersData as any) || []);
      } else {
        setPassengers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchData();
  }, [currentUser?.id, role]);

  const handleLogout = async () => {
    console.log("[App] Logging out user:", currentUser?.email);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]);
    setTours([]);
    setOrders([]);
    setPassengers([]);
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

  return (
    <Router>
      <AppContent
        currentUser={currentUser}
        role={role}
        booting={booting}
        loading={loading}
        users={users}
        tours={tours}
        orders={orders}
        passengers={passengers}
        setUsers={setUsers}
        setTours={setTours}
        setOrders={setOrders}
        setPassengers={setPassengers}
        handleLogout={handleLogout}
        handleChangePassword={handleChangePassword}
      />
    </Router>
  );
}