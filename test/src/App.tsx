// src/App.tsx
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import type { Session } from "@supabase/supabase-js";
import Login from "./components/Login";
import ChangePassword from "./components/ChangePassword";
import UserInterface from "./components/UserInterface";
import AdminInterface from "./components/AdminInterface";
import ProviderInterface from "./components/ProviderInterface";
import type { User as UserType, Tour, Order } from "./types/type";
import "./index.css";
import MockLogin from "./MockLogin";

function App() {
  const [useMock, setUseMock] = useState(true); // <-- Toggle between mock & Supabase
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // --- Listen to auth changes (Supabase only) ---
  useEffect(() => {
    if (!useMock) {
      supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

      return () => data.subscription?.unsubscribe?.();
    }
  }, [useMock]);

  // --- Fetch data when logged in (Supabase only) ---
  useEffect(() => {
    if (!useMock && session) fetchData();
  }, [session, useMock]);

  const fetchData = async () => {
    const { data: usersData } = await supabase.from("users").select("*");
    setUsers(usersData || []);

    const { data: toursData } = await supabase.from("tours").select("*");
    setTours(toursData || []);

    const { data: ordersData } = await supabase.from("orders").select("*, passengers(*)");
    setOrders(ordersData || []);
  };

  const handleLogout = async () => {
    if (!useMock) {
      await supabase.auth.signOut();
      setSession(null);
    } else {
      setUsers([]);
      setTours([]);
      setOrders([]);
    }
  };

  const handleChangePassword = async (newPassword: string): Promise<boolean> => {
    if (!session) return false;

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        alert("Failed to change password: " + error.message);
        return false;
      }
      alert("Password updated successfully!");
      return true;
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
      return false;
    }
  };

  if (useMock) {
    return (
      <div>
        <button
          className="fixed top-2 right-2 bg-gray-700 text-white px-3 py-1 rounded z-50"
          onClick={() => setUseMock(false)}
        >
          Switch to Supabase
        </button>
        <MockLogin
          users={users}
          setUsers={setUsers}
          tours={tours}
          setTours={setTours}
          orders={orders}
          setOrders={setOrders}
        />
      </div>
    );
  }

  if (!session) return <Login />;

  const user = session.user;
  const userMetadata = user.user_metadata as Partial<UserType>;
  const role = userMetadata.role || "user";

  return (
    <Router>
      <button
        className="fixed top-2 right-2 bg-gray-700 text-white px-3 py-1 rounded z-50"
        onClick={() => setUseMock(true)}
      >
        Switch to Mock
      </button>

      <Routes>
        <Route
          path="/change-password"
          element={<ChangePassword onChangePassword={handleChangePassword} />}
        />

        <Route
          path="/user"
          element={
            ["user", "admin", "superadmin"].includes(role) ? (
              <UserInterface
                tours={tours}
                orders={orders}
                setOrders={setOrders}
                currentUser={userMetadata as UserType}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" />
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
                currentUser={userMetadata as UserType}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" />
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
                currentUser={userMetadata as UserType}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Navigate to="/user" />} />
      </Routes>
    </Router>
  );
}

export default App;
