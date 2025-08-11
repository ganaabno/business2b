
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Login from "./components/Login";
import ChangePassword from "./components/ChangePasswrod";
import UserInterface from "./components/UserInterface";
import type { Order } from "./types/type"; // Adjust the import path as necessary
import type { User, Tour } from "./types/type"; // Adjust the import path as necessary
import "./index.css";

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(() => {
    const stored = localStorage.getItem("users");
    return stored
      ? JSON.parse(stored)
      : [
          {
            username: "super",
            password: "superpass",
            role: "superadmin",
            access: "active",
            createdBy: "system",
            createdAt: new Date().toISOString(),
            lastLogin: null,
          },
          {
            username: "enerel",
            password: "enerelgtc",
            role: "admin",
            company: "GTC",
            access: "active",
            createdBy: "system",
            createdAt: new Date().toISOString(),
            lastLogin: null,
          },
          {
            username: "happyworld",
            password: "happyworldpass",
            role: "user",
            company: "Happy World",
            access: "active",
            createdBy: "system",
            createdAt: new Date().toISOString(),
            lastLogin: null,
          },
          {
            username: "sanyaholiday",
            password: "holidaypass",
            role: "provider",
            access: "active",
            createdBy: "system",
            createdAt: new Date().toISOString(),
            lastLogin: null,
          },
        ];
  });
  const [tours, setTours] = useState<Tour[]>(() => {
    const stored = localStorage.getItem("tours");
    return stored
      ? JSON.parse(stored)
      : [
          {
            name: "Beach Tour",
            dates: ["2025-09-01", "2025-09-15"],
            seats: 50,
            hotels: ["Hotel A", "Hotel B"],
            services: [
              { name: "Spa", price: 100 },
              { name: "Tour Guide", price: 50 },
            ],
            createdBy: "system",
            createdAt: new Date().toISOString(),
          },
        ];
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const stored = localStorage.getItem("orders");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem("users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("tours", JSON.stringify(tours));
  }, [tours]);

  useEffect(() => {
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);

  const handleLogin = (username: string, password: string) => {
    try {
      const user = users.find(
        (u) => u.username === username && u.password === password && u.access !== "suspended"
      );
      if (user) {
        const updatedUser = { ...user, lastLogin: new Date().toISOString() };
        setUsers(users.map((u) => (u.username === user.username ? updatedUser : u)));
        setCurrentUser(updatedUser);
        return true;
      }
      alert("Invalid username, password, or account suspended");
      return false;
    } catch (e) {
      console.error("Login error:", e);
      alert("An error occurred during login. Please try again.");
      return false;
    }
  };

  const handleChangePassword = (username: string, newPassword: string) => {
    try {
      const userIndex = users.findIndex((u) => u.username === username);
      if (userIndex !== -1) {
        setUsers(
          users.map((u, i) =>
            i === userIndex ? { ...u, password: newPassword } : u
          )
        );
        alert("Password changed successfully");
        return true;
      }
      alert("User not found");
      return false;
    } catch (e) {
      console.error("Change password error:", e);
      alert("An error occurred during password change. Please try again.");
      return false;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={<Login onLogin={handleLogin} />}
        />
        <Route
          path="/change-password"
          element={<ChangePassword onChangePassword={handleChangePassword} />}
        />
        <Route
          path="/user"
          element={
            currentUser && currentUser.role === "user" ? (
              <UserInterface
                tours={tours}
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;