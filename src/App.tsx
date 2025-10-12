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
import { Clock, Shield, Users, AlertCircle } from "lucide-react";
import { supabase } from "./supabaseClient";
import { supabaseAdmin } from "./utils/adminClient";
import Login from "./Pages/Login";
import SignUp from "./Pages/SignUp";
import UserInterface from "./Pages/UserInterface";
import AdminInterface from "./Pages/AdminInterface";
import ProviderInterface from "./Pages/ProviderInterface";
import ManagerInterface from "./Pages/ManagerInterface";
import ChangePassword from "./Pages/ChangePassword";
import ForgotPassword from "./Pages/ForgotPassword"; // New
import ResetPassword from "./Pages/ResetPassword"; // New
import Header from "./Parts/Header";
import AnalyticDashboard from "./Pages/Overview";
import type { User as UserType, Tour, Order, Passenger, ValidationError } from "./types/type";
import { AuthProvider, useAuth, toRole } from "./context/AuthProvider";
import { toast } from "react-toastify";

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
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const forceRefreshUsers = async () => {
    console.log('🔄 FORCE REFRESH - Fetching ALL users with admin bypass...');
    try {
      const { data: allUsers, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .order('createdAt', { ascending: false });

      console.log('🔍 FORCE REFRESH RESULT:', {
        count: allUsers?.length || 0,
        users: allUsers?.map(u => ({ id: u.id, email: u.email, role: u.role })),
        error: error?.message,
      });

      if (!error && allUsers) {
        setUsers(allUsers);
        toast.success(`Found ${allUsers.length} users!`);
      } else {
        console.error('❌ FORCE REFRESH ERROR:', error);
        toast.error(`Error: ${error?.message}`);
      }
    } catch (err) {
      console.error('💥 FORCE REFRESH FAILED:', err);
      toast.error('Failed to force refresh users');
    }
  };

  const validateBooking = () => {
    const newErrors: ValidationError[] = [];
    if (!selectedTour) newErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate) newErrors.push({ field: "departure", message: "Please select a departure date" });
    if (passengers.length === 0) newErrors.push({ field: "passengers", message: "At least one passenger is required" });
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

  if (currentUser && currentUser.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50">
        <div className="text-center p-6 bg-yellow-100 rounded-xl shadow-md max-w-md mx-auto">
          <div className="w-16 h-16 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-yellow-800 mb-4">Account Pending Approval</h1>
          <p className="text-yellow-700 mb-4">Your account request is under review.</p>
          <p className="text-sm text-yellow-600 mb-6">An admin will approve your account shortly. You'll receive an email notification.</p>
          <button
            onClick={logout}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Check Later
          </button>
        </div>
      </div>
    );
  }

  if (currentUser && currentUser.access === "suspended") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-6 bg-red-100 rounded-xl shadow-md max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-800 mb-4">Account Suspended</h1>
          <p className="text-red-700 mb-6">
            Your account has been temporarily suspended. If you believe this is an error, please{" "}
            <a href="mailto:support@yourapp.com" className="text-red-900 underline font-medium">
              contact support
            </a>.
          </p>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!currentUser || booting || authLoading) return;

    const validPaths =
      ["admin", "superadmin"].includes(role)
        ? ["/user", "/provider", "/admin", "/manager", "/change-password", "/analytics", "/reset-password"]
        : role === "provider"
          ? ["/provider", "/change-password", "/reset-password"]
          : role === "manager"
            ? ["/manager", "/change-password", "/reset-password"]
            : ["/user", "/change-password", "/reset-password"];

    // Allow /reset-password even if authenticated
    if (location.pathname === "/reset-password") return;

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
          <p className="text-lg font-medium text-gray-800">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentUser && ["admin", "superadmin"].includes(role) && (
        <div className="relative bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 p-4 mx-auto">
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

              <Link
                to="/analytics"
                className="group relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 transition-all duration-200 rounded-lg hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-orange-100"
              >
                <span className="relative z-10">Charts</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent opacity-50"></div>
        </div>
      )}

      {currentUser && <Header currentUser={currentUser} onLogout={logout} isUserRole={role === "user"} />}

      <Routes>
        <Route
          path="/change-password"
          element={
            currentUser ? (
              <ChangePassword
                onChangePassword={async (pw) => {
                  const { error } = await supabase.auth.updateUser({ password: pw });
                  return !error;
                }}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/user"
          element={
            currentUser && (role === "user" || ["admin", "superadmin"].includes(role)) ? (
              <UserInterface
                tours={tours}
                orders={orders}
                setOrders={setOrders}
                setTours={setTours}
                selectedTour={selectedTour}
                setSelectedTour={setSelectedTour}
                departureDate={departureDate}
                setDepartureDate={setDepartureDate}
                passengers={passengers}
                setPassengers={setPassengers}
                errors={errors}
                showNotification={(type, message) => toast[type](message)}
                currentUser={currentUser}
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
            currentUser && (role === "provider" || ["admin", "superadmin"].includes(role)) ? (
              <ProviderInterface tours={tours} setTours={setTours} currentUser={currentUser} />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            currentUser && ["admin", "superadmin"].includes(role) ? (
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
            currentUser && (role === "manager" || ["admin", "superadmin"].includes(role)) ? (
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
        <Route
          path="/analytics"
          element={
            currentUser && ["admin", "superadmin"].includes(role) ? (
              <AnalyticDashboard
                tours={tours}
                orders={orders}
                passengers={passengers}
                currentUser={currentUser}
              />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />
        <Route
          path="/login"
          element={
            !currentUser ? (
              <Login />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />
        <Route
          path="/signup"
          element={
            !currentUser ? (
              <SignUp />
            ) : (
              <Navigate to={homePath} replace />
            )
          }
        />
        <Route path="/" element={<Navigate to={homePath} replace />} />
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
        console.log('🚀 INITIAL DATA FETCH STARTING...');

        let usersData: UserType[] = [];
        const { data: regularUsers, error: regularError } = await supabase
          .from("users")
          .select("*")
          .order('createdAt', { ascending: false });

        console.log('🔍 REGULAR USERS FETCH:', {
          count: regularUsers?.length || 0,
          error: regularError?.message,
        });

        if (regularError || (regularUsers && regularUsers.length <= 1)) {
          console.log('🔄 SWITCHING TO ADMIN BYPASS...');
          try {
            const { data: adminUsers, error: adminError } = await supabaseAdmin
              .from("users")
              .select("*")
              .order('createdAt', { ascending: false });

            console.log('🔍 ADMIN BYPASS USERS FETCH:', {
              count: adminUsers?.length || 0,
              users: adminUsers?.map(u => ({ id: u.id, email: u.email, role: u.role })),
              error: adminError?.message,
            });

            if (!adminError && adminUsers) {
              usersData = adminUsers;
              console.log('✅ ADMIN BYPASS SUCCESS - Using admin users data');
            } else {
              console.error('❌ ADMIN BYPASS FAILED:', adminError);
              usersData = regularUsers || [];
              toast.error(`Failed to fetch users: ${adminError?.message || 'Unknown error'}`);
            }
          } catch (adminErr) {
            console.error('💥 ADMIN BYPASS EXCEPTION:', adminErr);
            usersData = regularUsers || [];
            toast.error('Failed to fetch users');
          }
        } else {
          usersData = regularUsers || [];
          console.log('✅ REGULAR FETCH SUCCESS - Using regular users data');
        }

        setUsers(usersData);
        console.log(`📊 USERS LOADED: ${usersData.length} total`);

        const { data: toursData, error: toursError } = await supabase
          .from("tours")
          .select("*")
          .order('created_at', { ascending: false });

        if (toursError) {
          console.error('❌ TOURS ERROR:', toursError);
          toast.error(`Failed to fetch tours: ${toursError.message}`);
        } else {
          setTours(toursData || []);
          console.log(`📊 TOURS LOADED: ${toursData?.length || 0}`);
        }

        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('❌ ORDERS ERROR:', ordersError);
          toast.error(`Failed to fetch orders: ${ordersError.message}`);
        } else {
          setOrders(ordersData || []);
          console.log(`📊 ORDERS LOADED: ${ordersData?.length || 0}`);
        }

        const { data: passengersData, error: passengersError } = await supabase
          .from("passengers")
          .select("*")
          .order('created_at', { ascending: false });

        if (passengersError) {
          console.error('❌ PASSENGERS ERROR:', passengersError);
          toast.error(`Failed to fetch passengers: ${passengersError.message}`);
        } else {
          setPassengers(passengersData || []);
          console.log(`📊 PASSENGERS LOADED: ${passengersData?.length || 0}`);
        }

        console.log('✅ INITIAL DATA FETCH COMPLETE');
      } catch (err) {
        console.error("💥 CRITICAL ERROR fetching data:", err);
        toast.error('Failed to fetch initial data');
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