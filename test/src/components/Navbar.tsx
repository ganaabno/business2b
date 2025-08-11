import { useNavigate } from "react-router-dom";
import type { User } from "../types/type"; // Use type-only import
import "bootstrap/dist/css/bootstrap.min.css";

interface NavbarProps {
  role: User["role"];
  onLogout: () => void;
}

function Navbar({ role, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  const navItems = {
    superadmin: [
      { label: "Super Admin", path: "/super-admin" },
      { label: "Admin", path: "/admin" },
      { label: "User", path: "/user" },
      { label: "Provider", path: "/provider" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
    admin: [
      { label: "Admin", path: "/admin" },
      { label: "User", path: "/user" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
    user: [
      { label: "User", path: "/user" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
    provider: [
      { label: "Provider", path: "/provider" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
  };

  return (
    <nav className="navbar navbar-expand-lg">
      <div className="container-fluid">
        <a className="navbar-brand" href="#">
          {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
        </a>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {navItems[role].map((item, index) => (
              <li className="nav-item" key={index}>
                <a
                  className="nav-link"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.action) {
                      item.action();
                    } else {
                      navigate(item.path);
                    }
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
