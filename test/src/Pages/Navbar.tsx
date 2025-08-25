import { useNavigate } from "react-router-dom";
import type { User } from "../types/type";
import "bootstrap/dist/css/bootstrap.min.css";

interface NavbarProps {
  role: User["role"] | null; // handle missing role
  onLogout: () => void;
}

// Define allowed roles as a type
type Role = "superadmin" | "admin" | "user" | "provider";

// Define nav item structure
interface NavItem {
  label: string;
  path?: string;
  action?: () => void;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  superadmin: [
    { label: "Super Admin Dashboard", path: "/super-admin" },
    { label: "Admin Dashboard", path: "/admin" },
    { label: "User Interface", path: "/user" },
    { label: "Provider Interface", path: "/provider" },
    { label: "Logout", action: () => {} }, // action will be set dynamically
  ],
  admin: [
    { label: "Admin Dashboard", path: "/admin" },
    { label: "User Interface", path: "/user" },
    { label: "Provider Interface", path: "/provider" },
    { label: "Logout", action: () => {} },
  ],
  user: [
    { label: "User Interface", path: "/user" },
    { label: "Logout", action: () => {} },
  ],
  provider: [
    { label: "Provider Interface", path: "/provider" },
    { label: "Logout", action: () => {} },
  ],
};

function Navbar({ role, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  // Ensure role is valid
  if (!role || !(role in NAV_ITEMS)) return null;

  // Clone nav items so we can attach logout action
  const items = NAV_ITEMS[role as Role].map((item) =>
    item.label === "Logout"
      ? { ...item, action: () => { onLogout(); navigate("/login"); } }
      : item
  );

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        <span className="navbar-brand">
          {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
        </span>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {items.map((item, index) => (
              <li className="nav-item" key={index}>
                <a
                  className="nav-link"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.action) item.action();
                    else if (item.path) navigate(item.path);
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
