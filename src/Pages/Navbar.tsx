import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "../types/type";

interface NavbarProps {
  role: User["role"] | null;
  onLogout: () => void;
}

type Role = "superadmin" | "admin" | "user" | "provider";

interface NavItem {
  label: string;
  path: string;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  superadmin: [
    { label: "Admin", path: "/admin" },
    { label: "Manager", path: "/manager" },
    { label: "Provider", path: "/provider" },
    { label: "User", path: "/user" },
  ],
  admin: [
    { label: "Admin", path: "/admin" },
    { label: "Manager", path: "/manager" },
    { label: "Provider", path: "/provider" },
    { label: "User", path: "/user" },
  ],
  provider: [
    { label: "Provider", path: "/provider" },
    { label: "Manager", path: "/manager" },
  ],
  user: [{ label: "User", path: "/user" }],
};

export default function Navbar({ role, onLogout }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = useMemo(() => {
    if (!role || !(role in NAV_ITEMS)) {
      return [];
    }
    return NAV_ITEMS[role as Role];
  }, [role]);

  if (navItems.length === 0) {
    return null;
  }

  return (
    <nav className="border-b border-gray-200 bg-gray-50">
      <div className="mono-container px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-kicker mr-2">Workspace</span>
          <div className="mono-nav">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`mono-nav-item ${isActive ? "mono-nav-item--active" : ""}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onLogout();
              navigate("/login");
            }}
            className="mono-button mono-button--ghost ml-auto"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
