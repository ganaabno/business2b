// src/App.tsx
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Clock, Shield, Menu, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { listUsersAdmin } from "./api/admin";
import Header from "./Parts/Header";
import type {
  User as UserType,
  Tour,
  Order,
  Passenger,
  ValidationError,
} from "./types/type";
import { useAuth, toRole } from "./context/AuthProvider";
import { useTranslation } from "react-i18next";
import Footer from "./Parts/Footer";

const Login = lazy(() => import("./Pages/Login"));
const SignUp = lazy(() => import("./Pages/SignUp"));
const UserInterface = lazy(() => import("./Pages/UserInterface"));
const AdminInterface = lazy(() => import("./Pages/AdminInterface"));
const ProviderInterface = lazy(() => import("./Pages/ProviderInterface"));
const ManagerInterface = lazy(() => import("./Pages/ManagerInterface"));
const ChangePassword = lazy(() => import("./Pages/ChangePassword"));
const ForgotPassword = lazy(() => import("./Pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));
const AnalyticDashboard = lazy(() => import("./Pages/Overview"));
const FlightDataTab = lazy(() => import("./components/FlightDataTab"));

const VALID_PATHS_BY_ROLE: Record<string, string[]> = {
  admin: [
    "/user",
    "/provider",
    "/admin",
    "/manager",
    "/change-password",
    "/analytics",
    "/reset-password",
    "/flight-data",
  ],
  superadmin: [
    "/user",
    "/provider",
    "/admin",
    "/manager",
    "/change-password",
    "/analytics",
    "/reset-password",
    "/flight-data",
  ],
  provider: [
    "/provider",
    "/change-password",
    "/reset-password",
    "/manager",
    "/flight-data",
  ],
  manager: ["/manager", "/change-password", "/reset-password", "/flight-data"],
  user: ["/user", "/change-password", "/reset-password", "/flight-data"],
};

function AppContent() {
  const { t } = useTranslation();
  const { currentUser, logout, loading: authLoading } = useAuth();
  const role = useMemo(() => toRole(currentUser?.role), [currentUser]);
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [errors] = useState<ValidationError[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setUsers([]);
      setTours([]);
      setOrders([]);
      setPassengers([]);
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const needsUsers = role === "admin" || role === "superadmin";
    const needsTours = ["admin", "superadmin", "manager", "provider"].includes(
      role
    );
    const needsOrders = ["admin", "superadmin", "manager", "user"].includes(
      role
    );
    const needsPassengers = ["admin", "superadmin", "manager", "user"].includes(
      role
    );

    const loadData = async () => {
      setDataLoading(true);
      try {
        const tasks: Promise<void>[] = [];

        if (needsUsers) {
          tasks.push(
            (async () => {
              let usersData: UserType[] = [];
              try {
                usersData = await listUsersAdmin<UserType>();
              } catch (edgeError) {
                const { data: fallbackUsers, error: fallbackError } =
                  await supabase
                    .from("users")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (fallbackError) {
                  throw edgeError;
                }

                usersData = fallbackUsers || [];
              }

              if (!cancelled) {
                setUsers(usersData);
              }
            })()
          );
        }

        if (needsTours) {
          tasks.push(
            (async () => {
              const { data: toursData } = await supabase
                .from("tours")
                .select("*")
                .order("created_at", { ascending: false });
              if (!cancelled) {
                setTours(toursData || []);
              }
            })()
          );
        }

        if (needsOrders) {
          tasks.push(
            (async () => {
              const { data: ordersData } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });
              if (!cancelled) {
                setOrders(ordersData || []);
              }
            })()
          );
        }

        if (needsPassengers) {
          tasks.push(
            (async () => {
              const { data: passengersData } = await supabase
                .from("passengers")
                .select("*")
                .order("created_at", { ascending: false });
              if (!cancelled) {
                setPassengers(passengersData || []);
              }
            })()
          );
        }

        await Promise.all(tasks);
      } catch (err) {
        console.error("Critical error:", err);
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [currentUser, role]);

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

  useEffect(() => {
    if (!currentUser || dataLoading || authLoading) return;

    const validPaths = VALID_PATHS_BY_ROLE[role] || [
      "/user",
      "/change-password",
      "/reset-password",
    ];

    if (location.pathname === "/reset-password") return;

    if (["/login", "/"].includes(location.pathname)) {
      navigate(homePath, { replace: true });
    } else if (!validPaths.includes(location.pathname)) {
      navigate(homePath, { replace: true });
    }
  }, [
    currentUser,
    role,
    dataLoading,
    authLoading,
    navigate,
    homePath,
    location.pathname,
  ]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  if (currentUser && currentUser.status === "pending") {
    return (
      <div className="mono-shell flex flex-col items-center justify-center px-4 py-12">
        <div className="mono-card text-center p-6 sm:p-8 max-w-md w-full mx-auto">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-gray-200">
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" />
          </div>
          <h1 className="mono-title text-xl sm:text-2xl mb-3 sm:mb-4">
            {t("accountPendingApproval")}
          </h1>
          <p className="mono-subtitle text-sm sm:text-base mb-3 sm:mb-4">
            {t("pendingReviewMessage")}
          </p>
          <p className="mono-subtitle text-xs sm:text-sm mb-4 sm:mb-6">
            {t("pendingApprovalMessage")}
          </p>
          <button onClick={logout} className="mono-button w-full sm:w-auto">
            {t("checkLater")}
          </button>
        </div>
      </div>
    );
  }

  if (currentUser && currentUser.access === "suspended") {
    return (
      <div className="mono-shell flex flex-col items-center justify-center px-4 py-12">
        <div className="mono-card text-center p-6 sm:p-8 max-w-md w-full mx-auto">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-gray-200">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" />
          </div>
          <h1 className="mono-title text-xl sm:text-2xl mb-3 sm:mb-4">
            {t("accountSuspended")}
          </h1>
          <p className="mono-subtitle text-sm sm:text-base mb-4 sm:mb-6">
            {t("suspendedMessage")} <a
              href="mailto:support@yourapp.com"
              className="underline font-medium break-all"
            >
              {t("contactSupport")}
            </a>
            .
          </p>
          <button onClick={logout} className="mono-button w-full sm:w-auto">
            {t("signOut")}
          </button>
        </div>
      </div>
    );
  }

  if (authLoading || (currentUser && dataLoading)) {
    return (
      <div className="mono-shell flex items-center justify-center px-4 py-12">
        <div className="mono-panel px-6 py-8 rounded-2xl flex flex-col items-center gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-gray-300 border-solid rounded-full animate-spin border-t-gray-900"></div>
          <p className="text-base sm:text-lg font-medium text-gray-800 text-center">
            {t("loadingDashboard")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer
        limit={1}
        position="top-right"
        autoClose={3000}
        className="mt-14 sm:mt-0"
      />

      {/* ADMIN VIEW SWITCHER - Desktop */}
      {currentUser && ["admin", "superadmin"].includes(role) && (
        <>
          {/* Desktop View */}
          <div className="hidden lg:block border-b border-gray-200 bg-white">
            <div className="mono-container px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border border-gray-200">
                    <svg
                      className="w-4 h-4 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                      />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700 text-sm">
                    {t("viewAs")}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/user"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    {t("userLink")}
                  </Link>

                  <Link
                    to="/provider"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    {t("providerLink")}
                  </Link>

                  <Link
                    to="/admin"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    {t("adminLink")}
                  </Link>

                  <Link
                    to="/manager"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    {t("managerLink")}
                  </Link>

                  <Link
                    to="/analytics"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    {t("chartsLink")}
                  </Link>

                  <Link
                    to="/flight-data"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Flight Data
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile View */}
          <div className="lg:hidden relative bg-white border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 border border-gray-200">
                  <svg
                    className="w-3.5 h-3.5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                    />
                  </svg>
                </div>
                <span className="font-medium text-gray-700 text-xs sm:text-sm">
                  {t("viewAs")}
                </span>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-gray-600" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <div className="absolute top-full left-0 right-0 bg-white shadow-md border-b border-gray-200 z-50">
                <div className="flex flex-col py-2">
                  <Link
                    to="/user"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    {t("userLink")}
                  </Link>

                  <Link
                    to="/provider"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    {t("providerLink")}
                  </Link>

                  <Link
                    to="/admin"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    {t("adminLink")}
                  </Link>

                  <Link
                    to="/manager"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    {t("managerLink")}
                  </Link>

                  <Link
                    to="/analytics"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    {t("chartsLink")}
                  </Link>

                  <Link
                    to="/flight-data"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    Flight Data
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* HEADER */}
      {currentUser && (
        <Header
          currentUser={currentUser}
          onLogout={logout}
          isUserRole={role === "user"}
        />
      )}

      {/* ROUTES */}
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="mono-panel px-6 py-8 rounded-2xl flex flex-col items-center gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-gray-300 border-solid rounded-full animate-spin border-t-gray-900"></div>
              <p className="text-sm sm:text-base font-medium text-gray-700 text-center">
                {t("loadingDashboard")}
              </p>
            </div>
          </div>
        }
      >
        <Routes>
          {/* AUTH */}
          <Route
            path="/change-password"
            element={
              currentUser ? (
                <ChangePassword
                  onChangePassword={async (pw) => {
                    const { error } = await supabase.auth.updateUser({
                      password: pw,
                    });
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

          {/* MAIN INTERFACES */}
          <Route
            path="/user"
            element={
              currentUser &&
              (role === "user" || ["admin", "superadmin"].includes(role)) ? (
                <UserInterface
                  orders={orders}
                  setOrders={setOrders}
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
              currentUser &&
              (role === "provider" || ["admin", "superadmin"].includes(role)) ? (
                <ProviderInterface
                  tours={tours}
                  setTours={setTours}
                  currentUser={currentUser}
                />
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
              currentUser &&
              (role === "manager" || ["admin", "superadmin"].includes(role)) ? (
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

          {/* FLIGHT DATA — ALL ROLES */}
          <Route
            path="/flight-data"
            element={
              currentUser ? (
                <div className="min-h-screen bg-gray-50">
                  <div className="max-w-[105rem] mx-auto py-4 sm:py-6 px-3 sm:px-4 lg:px-8">
                    <FlightDataTab currentUser={currentUser} />
                  </div>
                </div>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* AUTH PAGES */}
          <Route
            path="/login"
            element={
              !currentUser ? <Login /> : <Navigate to={homePath} replace />
            }
          />
          <Route
            path="/signup"
            element={
              !currentUser ? <SignUp /> : <Navigate to={homePath} replace />
            }
          />

          {/* ROOT & FALLBACK */}
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>
      </Suspense>

      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
