import { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { supabase } from "./supabaseClient";
import Login from "./Pages/Login";
import UserInterface from "./Pages/UserInterface";
import AdminInterface from "./Pages/AdminInterface";
import ProviderInterface from "./Pages/ProviderInterface";
import ManagerInterface from "./Pages/ManagerInterface";
import ChangePassword from "./Pages/ChangePassword";
import type { User as UserType, Tour, Order, Passenger, ValidationError } from "./types/type";
import Header from "./Parts/Header";
import { AuthProvider, useAuth, toRole } from "./context/AuthProvider";

function AppContent({
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
}: {
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
}) {
  const { currentUser, logout, loading: authLoading } = useAuth();
  const role = useMemo(() => toRole(currentUser?.role), [currentUser]);
  const navigate = useNavigate();
  const location = useLocation();

  // State for UserInterface
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Passenger management functions
  const addPassenger = () => {
    // This will be implemented in UserInterface, so we pass it through
    // For now, it can be a placeholder or moved to AppContent if needed
  };

  const updatePassenger = async (index: number, field: keyof Passenger, value: any) => {
    // This will be implemented in UserInterface
  };

  const removePassenger = (index: number) => {
    // This will be implemented in UserInterface
  };

  const validateBooking = () => {
    const newErrors: ValidationError[] = [];
    if (!selectedTour) newErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate) newErrors.push({ field: "departure", message: "Please select a departure date" });
    if (passengers.length === 0) newErrors.push({ field: "passengers", message: "At least one passenger is required" });
    // Add more validations as needed (e.g., from UserInterface's validateBooking)
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const homePath = useMemo(() => {
    if (!currentUser) return "/login";
    switch (currentUser.role) {
      case "admin":
      case "superadmin":
        return "/admin";
      case "provider":
        return "/provider";
      case "manager":
        return "/manager";
      default:
        return "/user";
    }
  }, [currentUser]);

  // Pending / Declined check
  if (currentUser && currentUser.access === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50">
        <div className="text-center p-6 bg-yellow-100 rounded-xl shadow-md">
          <h1 className="text-2xl font-bold text-yellow-800 mb-4">Your request is pending</h1>
          <p className="text-yellow-700">Wait until an admin approves your account.</p>
        </div>
      </div>
    );
  }

  if (currentUser && currentUser.access === "declined") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-6 bg-red-100 rounded-xl shadow-md">
          <h1 className="text-2xl font-bold text-red-800 mb-4">Your request has been declined</h1>
          <p className="text-red-700">
            If you think this is a mistake, please{" "}
            <a href="mailto:support@example.com" className="text-red-900 underline">
              contact us
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!currentUser || booting || authLoading) return;

    const validPaths =
      ["admin", "superadmin"].includes(role)
        ? ["/user", "/provider", "/admin", "/manager", "/change-password"]
        : role === "provider"
          ? ["/provider", "/change-password"]
          : role === "manager"
            ? ["/manager", "/change-password"]
            : ["/user", "/change-password"];

    if (["/login", "/"].includes(location.pathname)) {
      navigate(homePath, { replace: true });
    } else if (!validPaths.includes(location.pathname)) {
      navigate(homePath, { replace: true });
    }
  }, [currentUser, role, booting, authLoading, navigate, homePath, location.pathname]);

  if (booting || authLoading) {
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
    return <Login />;
  }

  return (
    <>
      {["admin", "superadmin"].includes(role) && (
        <div className="relative bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
              <span className="font-medium text-gray-700 text-sm">View as:</span>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <Link
                to="/user"
                className="group relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-blue-100"
              >
                <span className="relative z-10">User</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>

              <Link
                to="/provider"
                className="group relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-emerald-600 transition-all duration-200 rounded-lg hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-emerald-100"
              >
                <span className="relative z-10">Provider</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>

              <Link
                to="/admin"
                className="group relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-purple-600 transition-all duration-200 rounded-lg hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-purple-100"
              >
                <span className="relative z-10">Admin</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>

              <Link
                to="/manager"
                className="group relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-amber-600 transition-all duration-200 rounded-lg hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-amber-100"
              >
                <span className="relative z-10">Manager</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent opacity-50"></div>
        </div>
      )}

      <Header currentUser={currentUser} onLogout={logout} isUserRole={role === "user"} />

      <Routes>
        <Route
          path="/change-password"
          element={<ChangePassword onChangePassword={async (pw) => { const { error } = await supabase.auth.updateUser({ password: pw }); return !error; }} />}
        />
        <Route
          path="/user"
          element={
            role === "user" || ["admin", "superadmin"].includes(role) ? (
              <UserInterface
                tours={tours}
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
                selectedTour={selectedTour}
                setSelectedTour={setSelectedTour}
                departureDate={departureDate}
                setDepartureDate={setDepartureDate}
                passengers={passengers}
                setPassengers={setPassengers}
                errors={errors}
                isGroup={isGroup}
                setIsGroup={setIsGroup}
                groupName={groupName}
                setGroupName={setGroupName}
                addPassenger={addPassenger}
                updatePassenger={updatePassenger}
                removePassenger={removePassenger}
                validateBooking={validateBooking}
                showNotification={(type: any, message: any) => alert(`${type}: ${message}`)}
                onLogout={logout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />
        <Route
          path="/provider"
          element={
            role === "provider" || ["admin", "superadmin"].includes(role) ? (
              <ProviderInterface tours={tours} setTours={setTours} currentUser={currentUser} />
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
                onLogout={logout}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />
        <Route
          path="/manager"
          element={
            role === "manager" || ["admin", "superadmin"].includes(role) ? (
              <ManagerInterface
                tours={tours}
                setTours={setTours}
                orders={orders}
                setOrders={setOrders}
                passengers={passengers}
                setPassengers={setPassengers}
                currentUser={currentUser}
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

export default function App() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch users
        const { data: usersData, error: usersError } = await supabase.from("users").select("*");
        if (usersError) throw usersError;
        setUsers(usersData || []);

        // Fetch tours
        const { data: toursData, error: toursError } = await supabase.from("tours").select("*");
        if (toursError) throw toursError;
        setTours(toursData || []);

        // Fetch orders
        const { data: ordersData, error: ordersError } = await supabase.from("orders").select("*");
        if (ordersError) throw ordersError;
        setOrders(ordersData || []);

        // Fetch passengers
        const { data: passengersData, error: passengersError } = await supabase.from("passengers").select("*");
        if (passengersError) throw passengersError;
        setPassengers(passengersData || []);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setBooting(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <AppContent
          booting={booting}
          loading={false}
          users={users}
          tours={tours}
          orders={orders}
          passengers={passengers}
          setUsers={setUsers}
          setTours={setTours}
          setOrders={setOrders}
          setPassengers={setPassengers}
        />
      </AuthProvider>
    </Router>
  );
}