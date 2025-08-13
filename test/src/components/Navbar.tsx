import { useNavigate } from "react-router-dom";
import type { User } from "../types/type";
import "bootstrap/dist/css/bootstrap.min.css";

interface NavbarProps {
  role: User["role"];
  onLogout: () => void;
}

function Navbar({ role, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  const navItems = {
    superadmin: [
      { label: "Super Admin Dashboard", path: "/super-admin" },
      { label: "Admin Dashboard", path: "/admin" },
      { label: "User Interface", path: "/user" },
      { label: "Provider Interface", path: "/provider" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
    admin: [
      { label: "Admin Dashboard", path: "/admin" },
      { label: "User Interface", path: "/user" },
      { label: "Provider Interface", path: "/provider" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
    user: [
      { label: "User Interface", path: "/user" }, 
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
    provider: [
      { label: "Provider Interface", path: "/provider" },
      { label: "Logout", action: () => { onLogout(); navigate("/login"); } },
    ],
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        <a className="navbar-brand" href="#">
          {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
        </a>
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