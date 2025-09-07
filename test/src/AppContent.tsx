// src/App.tsx
import { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import Login from "./Pages/Login";
import UserInterface from "./Pages/UserInterface";
import AdminInterface from "./Pages/AdminInterface";
import ProviderInterface from "./Pages/ProviderInterface";
import ManagerInterface from "./Pages/ManagerInterface";
import ChangePassword from "./Pages/ChangePassword";
import Header from "./Parts/Header";
import type { User as UserType, Role, Tour, Order, Passenger } from "./types/type";

// Convert string to valid Role
function toRole(value: any): Role {
  const v = String(value ?? "user") as Role;
  return ["admin", "superadmin", "provider", "user", "manager"].includes(v) ? v : "user";
}

// App content that depends on currentUser and role
function AppContent() {
  const { currentUser, loading } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  const role = useMemo(() => toRole(currentUser?.role), [currentUser]);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine home path based on role
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

  // Redirect if current path invalid
  useEffect(() => {
    if (!currentUser || loading) return;

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
  }, [currentUser, role, loading, navigate, homePath, location.pathname]);

  // Loading screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-4 border-blue-600 border-solid rounded-full animate-spin border-t-transparent"></div>
          <p className="text-lg font-medium text-gray-800">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show Login
  if (!currentUser) {
    return <Login />;
  }

  // Pending / Declined account access
  if (currentUser.access === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50">
        <div className="text-center p-6 bg-yellow-100 rounded-xl shadow-md">
          <h1 className="text-2xl font-bold text-yellow-800 mb-4">Your request is pending</h1>
          <p className="text-yellow-700">Wait until an admin approves your account.</p>
        </div>
      </div>
    );
  }

  if (currentUser.access === "declined") {
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

  // Logout handler
  const handleLogout = async () => {
    window.location.href = "/login";
  };

  const handleChangePassword = async (newPassword: string): Promise<boolean> => {
    alert("Password updated successfully!");
    return true;
  };

  return (
    <>
      {["admin", "superadmin"].includes(role) && (
        <div className="flex items-center gap-3 p-3 border-b border-gray-200 bg-white">
          <span className="font-semibold text-gray-800">View as:</span>
          <a href="/user" className="text-blue-600 hover:text-blue-800">
            User
          </a>
          <a href="/provider" className="text-blue-600 hover:text-blue-800">
            Provider
          </a>
          <a href="/admin" className="text-blue-600 hover:text-blue-800">
            Admin
          </a>
          <a href="/manager" className="text-blue-600 hover:text-blue-800">
            Manager
          </a>
        </div>
      )}

      <Header currentUser={currentUser} onLogout={handleLogout} isUserRole={role === "user"} />

      <Routes>
        <Route path="/change-password" element={<ChangePassword onChangePassword={handleChangePassword} />} />

        <Route
          path="/user"
          element={
            role === "user" ? (
              <UserInterface
                tours={tours}
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
                selectedTour=""
                setSelectedTour={() => {}}
                departureDate=""
                setDepartureDate={() => {}}
                passengers={passengers}
                setPassengers={setPassengers}
                errors={[]}
                isGroup={false}
                setIsGroup={() => {}}
                groupName=""
                setGroupName={() => {}}
                addPassenger={() => {}}
                updatePassenger={async () => {}}
                removePassenger={() => {}}
                validateBooking={() => true}
                showNotification={(type, message) => alert(`${type}: ${message}`)}
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
            role === "provider" ? (
              <ProviderInterface tours={tours} setTours={setTours} currentUser={currentUser} onLogout={handleLogout} />
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
            role === "manager" ? (
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

// Wrap everything with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
