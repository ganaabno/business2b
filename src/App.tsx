// src/App.tsx
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Clock, Shield, Menu, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { listUsersAdmin } from "./api/admin";
import { syncGlobalTours } from "./api/b2b";
import {
  fetchToursFromGlobalApi,
  isGlobalApiEnabled,
  mergeGlobalToursWithLocal,
  useGlobalToursFallbackLocal,
  useGlobalToursPrimary,
} from "./api/globalTravel";
import Header from "./Parts/Header";
import type {
  User as UserType,
  Tour,
  Order,
  Passenger,
  ValidationError,
  Role,
} from "./types/type";
import { useAuth, toRole } from "./context/AuthProvider";
import { useTranslation } from "react-i18next";
import Footer from "./Parts/Footer";
import { featureFlags } from "./config/featureFlags";
import { toLegacyCompatRole } from "./utils/roles";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ChatbotProvider } from "./components/Chatbot/ChatbotContext";

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
const B2BMonitoringPage = lazy(() => import("./Pages/B2BMonitoringPage"));
const GlobalTravelInterface = lazy(() => import("./Pages/GlobalTravelPage"));
const Chatbot = lazy(() => import("./components/Chatbot/Chatbot"));
const ChatFloatingWidget = lazy(
  () => import("./components/Chatbot/ChatFloatingWidget"),
);

function getValidPathsByRole(role: Role): string[] {
  const common = ["/change-password", "/reset-password", "/flight-data"];

  switch (role) {
    case "admin":
    case "superadmin":
      return [
        "/user",
        "/subcontractor",
        "/provider",
        "/agent",
        "/admin",
        "/manager",
        "/b2b-monitoring",
        "/global-travel",
        "/analytics",
        ...common,
      ];
    case "manager":
      return ["/manager", "/b2b-monitoring", ...common];
    case "provider":
      return ["/provider", ...common];
    case "agent":
      return ["/agent", ...common];
    case "subcontractor":
      return featureFlags.b2bSeatRequestFlowEnabled
        ? ["/subcontractor", ...common]
        : ["/user", ...common];
    case "user":
    default:
      return featureFlags.b2bSeatRequestFlowEnabled
        ? ["/user", "/subcontractor", ...common]
        : ["/user", ...common];
  }
}

function getPageTitle(pathname: string) {
  switch (pathname) {
    case "/login":
      return "Login";
    case "/signup":
      return "Sign Up";
    case "/forgot-password":
      return "Forgot Password";
    case "/reset-password":
      return "Reset Password";
    case "/change-password":
      return "Change Password";
    case "/admin":
      return "Admin Dashboard";
    case "/manager":
      return "Manager Dashboard";
    case "/provider":
      return "Provider Dashboard";
    case "/agent":
      return "Agent Workspace";
    case "/user":
    case "/subcontractor":
      return "Subcontractor Workspace";
    case "/b2b-monitoring":
      return "B2B Monitoring";
    case "/global-travel":
      return "Global Travel";
    case "/analytics":
      return "Analytics";
    case "/flight-data":
      return "Flight Data";
    default:
      return "GTrip";
  }
}

function AppContent() {
  const { t, i18n } = useTranslation();
  const { currentUser, logout, loading: authLoading } = useAuth();
  const role = useMemo(() => toRole(currentUser?.role), [currentUser]);
  const legacyCompatRole = useMemo(() => toLegacyCompatRole(role), [role]);
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = useMemo(() => {
    const title = getPageTitle(location.pathname);
    return title === "GTrip" ? title : `${title} | GTrip`;
  }, [location.pathname]);
  const htmlLang = useMemo(
    () =>
      String(i18n.language || "")
        .toLowerCase()
        .startsWith("mn")
        ? "mn"
        : "en",
    [i18n.language],
  );

  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const hasLoadedInitialDataRef = useRef(false);
  const lastFocusHealthCheckAtRef = useRef(0);
  const [errors] = useState<ValidationError[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdminUser = role === "admin" || role === "superadmin";

  const hideFooter = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ].includes(location.pathname);

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
    const needsUsers =
      legacyCompatRole === "admin" || legacyCompatRole === "superadmin";
    const needsTours =
      ["admin", "superadmin", "manager"].includes(legacyCompatRole) ||
      role === "provider";
    const needsOrders = ["admin", "superadmin", "manager", "user"].includes(
      legacyCompatRole,
    );
    const needsPassengers = ["admin", "superadmin", "manager", "user"].includes(
      legacyCompatRole,
    );

    const loadData = async () => {
      if (!hasLoadedInitialDataRef.current) {
        setDataLoading(true);
      }
      try {
        const tasks: Promise<void>[] = [];

        if (needsUsers) {
          tasks.push(
            (async () => {
              let usersData: UserType[] = [];
              try {
                usersData = await listUsersAdmin<UserType>();
              } catch (edgeError) {
                const { data: fallbackUsersPlain, error: fallbackPlain } =
                  await supabase.from("users").select("*");

                if (!fallbackPlain) {
                  usersData = fallbackUsersPlain || [];
                } else {
                  console.warn("Failed to load users from all sources", {
                    edgeError,
                    fallbackPlain,
                  });
                  usersData = [];
                }
              }

              if (!cancelled) {
                setUsers(usersData);
              }
            })(),
          );
        }

        if (needsTours) {
          tasks.push(
            (async () => {
              const fetchLocalTours = async () => {
                const { data: toursData } = await supabase
                  .from("tours")
                  .select("*")
                  .order("created_at", { ascending: false });

                return (toursData || []) as Tour[];
              };

              let localTours = await fetchLocalTours();

              const shouldUseGlobalPrimary =
                isGlobalApiEnabled &&
                useGlobalToursPrimary &&
                [
                  "admin",
                  "superadmin",
                  "manager",
                  "provider",
                  "user",
                  "subcontractor",
                  "agent",
                ].includes(legacyCompatRole);

              if (shouldUseGlobalPrimary) {
                try {
                  const globalTours = await fetchToursFromGlobalApi();

                  const canSyncGlobalIntoLocal = [
                    "admin",
                    "superadmin",
                    "manager",
                  ].includes(legacyCompatRole);

                  if (canSyncGlobalIntoLocal) {
                    try {
                      const { data: syncResult } = await syncGlobalTours({
                        dryRun: false,
                        sourceSystem: "global-travel",
                      });

                      const hasSyncChanges =
                        syncResult.inserted > 0 ||
                        syncResult.updated > 0 ||
                        syncResult.linked > 0;

                      if (hasSyncChanges) {
                        localTours = await fetchLocalTours();
                      }
                    } catch (syncError) {
                      console.warn(
                        "Global tours local sync failed; continuing with read-only merge",
                        syncError,
                      );
                    }
                  }

                  const mergedTours = mergeGlobalToursWithLocal(
                    globalTours,
                    localTours,
                  );
                  if (!cancelled) {
                    setTours(mergedTours);
                  }
                  return;
                } catch (globalError) {
                  if (!useGlobalToursFallbackLocal) {
                    throw globalError;
                  }
                  console.warn(
                    "Global tours fetch failed, fallback to local tours",
                    globalError,
                  );
                }
              }

              if (!cancelled) {
                setTours(localTours);
              }
            })(),
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
            })(),
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
            })(),
          );
        }

        await Promise.all(tasks);
      } catch (err) {
        console.error("Critical error:", err);
      } finally {
        if (!cancelled) {
          hasLoadedInitialDataRef.current = true;
          setDataLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [currentUser, role, legacyCompatRole]);

  const homePath = useMemo(() => {
    if (!currentUser) return "/login";
    switch (role) {
      case "admin":
      case "superadmin":
        return "/admin";
      case "agent":
        return "/agent";
      case "provider":
        return "/provider";
      case "manager":
        return "/manager";
      case "subcontractor":
        return featureFlags.b2bSeatRequestFlowEnabled
          ? "/subcontractor"
          : "/user";
      case "user":
      default:
        return featureFlags.b2bSeatRequestFlowEnabled
          ? "/subcontractor"
          : "/user";
    }
  }, [currentUser, role]);

  useEffect(() => {
    if (!currentUser || dataLoading || authLoading) return;

    const validPaths = getValidPathsByRole(role);

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

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFocusHealthCheckAtRef.current < 30_000) return;
      lastFocusHealthCheckAtRef.current = now;

      if (!currentUser) return;
      if (!["/manager", "/provider", "/admin"].includes(location.pathname))
        return;

      try {
        const { error } = await supabase
          .from("tours")
          .select("id", { head: true, count: "exact" })
          .limit(1);
        if (error) {
          console.warn(
            "Focus health check failed for booking path",
            error.message,
          );
        }
      } catch (error) {
        console.warn("Focus health check failed for booking path", error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUser, location.pathname]);

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
            {t("suspendedMessage")}{" "}
            <a
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
      {/* Skip Navigation Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-(--mono-accent) focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-(--mono-ring)"
      >
        Skip to main content
      </a>

      <Helmet prioritizeSeoTags>
        <html lang={htmlLang} />
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="GTrip travel booking platform for tours, partners, seat requests, and operations."
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="color-scheme" content="light" />
      </Helmet>

      <ToastContainer
        limit={1}
        position="top-right"
        autoClose={3000}
        className="mt-14 sm:mt-0"
      />

      {/* ADMIN VIEW SWITCHER - Desktop */}
      {currentUser && isAdminUser && (
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
                    to={
                      featureFlags.b2bSeatRequestFlowEnabled
                        ? "/subcontractor"
                        : "/user"
                    }
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    SubContractor
                  </Link>

                  <Link
                    to="/agent"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Agent
                  </Link>

                  <Link
                    to="/provider"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Provider
                  </Link>

                  {featureFlags.b2bMonitoringEnabled && (
                    <Link
                      to="/b2b-monitoring"
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                    >
                      B2B Monitoring
                    </Link>
                  )}

                  <Link
                    to="/global-travel"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:text-gray-900 hover:bg-gray-100 transition"
                  >
                    Global Travel
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
                    to={
                      featureFlags.b2bSeatRequestFlowEnabled
                        ? "/subcontractor"
                        : "/user"
                    }
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    SubContractor
                  </Link>

                  <Link
                    to="/agent"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    Agent
                  </Link>

                  <Link
                    to="/provider"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    Provider
                  </Link>

                  {featureFlags.b2bMonitoringEnabled && (
                    <Link
                      to="/b2b-monitoring"
                      className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                    >
                      B2B Monitoring
                    </Link>
                  )}

                  <Link
                    to="/global-travel"
                    className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border-l-2 border-transparent hover:border-gray-300"
                  >
                    Global Travel
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
          isUserRole={role === "user" || role === "subcontractor"}
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
        <div id="main-content">
          <Routes>
            {/* AUTH */}
            <Route
              path="/change-password"
              element={
                <ErrorBoundary>
                  {currentUser ? (
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
                  )}
                </ErrorBoundary>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <ErrorBoundary>
                  <ForgotPassword />
                </ErrorBoundary>
              }
            />
            <Route
              path="/reset-password"
              element={
                <ErrorBoundary>
                  <ResetPassword />
                </ErrorBoundary>
              }
            />

            {/* MAIN INTERFACES */}
            <Route
              path="/user"
              element={
                currentUser &&
                (role === "user" ||
                  (!featureFlags.b2bSeatRequestFlowEnabled &&
                    role === "subcontractor") ||
                  ["admin", "superadmin"].includes(role)) ? (
                  <UserInterface
                    orders={orders}
                    setOrders={setOrders}
                    passengers={passengers}
                    setPassengers={setPassengers}
                    errors={errors}
                    showNotification={(type, message) => toast[type](message)}
                    currentUser={currentUser}
                    onLogout={logout}
                    showSeatRequestsTab={[
                      "user",
                      "subcontractor",
                      "admin",
                      "superadmin",
                    ].includes(role)}
                    seatRequestsWorkspaceRole="subcontractor"
                  />
                ) : (
                  <Navigate to={homePath} replace />
                )
              }
            />

            {featureFlags.b2bSeatRequestFlowEnabled && (
              <Route
                path="/subcontractor"
                element={
                  currentUser &&
                  ["subcontractor", "user", "admin", "superadmin"].includes(
                    role,
                  ) ? (
                    <UserInterface
                      orders={orders}
                      setOrders={setOrders}
                      passengers={passengers}
                      setPassengers={setPassengers}
                      errors={errors}
                      showNotification={(type, message) => toast[type](message)}
                      currentUser={currentUser}
                      onLogout={logout}
                      showSeatRequestsTab
                      seatRequestsWorkspaceRole="subcontractor"
                      allowRegisterWithSeatRequests
                    />
                  ) : (
                    <Navigate to={homePath} replace />
                  )
                }
              />
            )}

            <Route
              path="/provider"
              element={
                currentUser &&
                (role === "provider" ||
                  ["admin", "superadmin"].includes(role)) ? (
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
              path="/agent"
              element={
                currentUser &&
                ["agent", "admin", "superadmin"].includes(role) ? (
                  featureFlags.b2bSeatRequestFlowEnabled ? (
                    <UserInterface
                      orders={orders}
                      setOrders={setOrders}
                      passengers={passengers}
                      setPassengers={setPassengers}
                      errors={errors}
                      showNotification={(type, message) => toast[type](message)}
                      currentUser={currentUser}
                      onLogout={logout}
                      showSeatRequestsTab
                      seatRequestsWorkspaceRole="agent"
                      allowRegisterWithSeatRequests
                    />
                  ) : (
                    <div className="mono-container px-4 sm:px-6 lg:px-8 py-8">
                      <div className="mono-card p-6 border border-amber-200 bg-amber-50 space-y-2">
                        <p className="mono-kicker text-amber-700">
                          Agent Workspace
                        </p>
                        <h2 className="mono-title text-xl text-amber-900">
                          Agent workspace is temporarily disabled
                        </h2>
                        <p className="text-sm text-amber-900">
                          Enable{" "}
                          <code>VITE_B2B_SEAT_REQUEST_FLOW_ENABLED=true</code>{" "}
                          to use this workspace.
                        </p>
                      </div>
                    </div>
                  )
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
                (role === "manager" ||
                  ["admin", "superadmin"].includes(role)) ? (
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

            {featureFlags.b2bMonitoringEnabled && (
              <Route
                path="/b2b-monitoring"
                element={
                  currentUser &&
                  ["manager", "admin", "superadmin"].includes(role) ? (
                    <B2BMonitoringPage />
                  ) : (
                    <Navigate to={homePath} replace />
                  )
                }
              />
            )}

            <Route
              path="/global-travel"
              element={
                currentUser && isAdminUser ? (
                  <GlobalTravelInterface />
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
                    <div className="max-w-420 mx-auto py-4 sm:py-6 px-3 sm:px-4 lg:px-8">
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
                <ErrorBoundary>
                  {!currentUser ? (
                    <Login />
                  ) : (
                    <Navigate to={homePath} replace />
                  )}
                </ErrorBoundary>
              }
            />
            <Route
              path="/signup"
              element={
                <ErrorBoundary>
                  {!currentUser ? (
                    <SignUp />
                  ) : (
                    <Navigate to={homePath} replace />
                  )}
                </ErrorBoundary>
              }
            />

            {/* ROOT & FALLBACK */}
            <Route path="/" element={<Navigate to={homePath} replace />} />
            <Route path="*" element={<Navigate to={homePath} replace />} />
            <Route path="/chatbot" element={<Chatbot />} />
          </Routes>
        </div>
      </Suspense>

      {!hideFooter && <Footer />}

      {currentUser && (
        <Suspense fallback={null}>
          <ErrorBoundary>
            <ChatbotProvider>
              <ChatFloatingWidget />
            </ChatbotProvider>
          </ErrorBoundary>
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <Router>
        <AppContent />
      </Router>
    </HelmetProvider>
  );
}
