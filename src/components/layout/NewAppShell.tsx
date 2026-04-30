import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import { cn } from "../../lib/utils";
import { useSidebar } from "../../store/appStore";
import {
  LayoutDashboard,
  Users,
  Plane,
  ShoppingCart,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Bell,
  Search,
  LogOut,
  CheckCircle,
  Ticket,
  UserPlus,
  FileText,
  Building2,
  PhoneIncoming,
  Ban,
  PlaneTakeoff,
  MessageCircle,
  ClipboardList,
} from "lucide-react";

const managerNavItems = [
  { key: "dashboard", label: "Янах самбар", path: "/manager" },
  { key: "tasks", label: "Tasks", path: "/manager/tasks" },
  {
    key: "yourRequests",
    label: "Таны хүсэлтүүд",
    path: "/manager/yourRequests",
  },
  { key: "orders", label: "Захиалгууд", path: "/manager/orders", badge: 100 },
  {
    key: "passengers",
    label: "Бүх зорчигч",
    path: "/manager/passengers",
    badge: 290,
  },
  {
    key: "addPassenger",
    label: "Зорчигч бүртгэх",
    path: "/manager/add-passenger",
  },
  { key: "addTour", label: "Аялал нэмэх", path: "/manager/add-tour" },
  { key: "tours", label: "Аяллын хүснэгт", path: "/manager/tours" },
  { key: "contracts", label: "Гэрээнүүд", path: "/manager/contracts" },
  {
    key: "providerAssignments",
    label: "Провайдер эрх",
    path: "/manager/provider-assignments",
  },
  {
    key: "interestedLeads",
    label: "Сонирхсон lead",
    path: "/manager/interested-leads",
  },
  {
    key: "passengerRequests",
    label: "Зорчигчийн хүсэлт",
    path: "/manager/passenger-requests",
  },
  {
    key: "pendingLeads",
    label: "Lead зорчигч",
    path: "/manager/pending-leads",
    badge: 4,
  },
  { key: "blacklist", label: "Хар жагсаалт", path: "/manager/blacklist" },
  {
    key: "flightData",
    label: "Нислэгийн мэдээлэл",
    path: "/manager/flight-data",
  },
  {
    key: "ProviderInterface",
    label: "Провайдер харагдац",
    path: "/manager/provider-view",
  },
  { key: "chatbot", label: "Чат бот", path: "/manager/chatbot" },
];

const iconMap: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  tasks: ClipboardList,
  orders: ShoppingCart,
  passengers: Users,
  addPassenger: UserPlus,
  addTour: Plane,
  tours: Plane,
  contracts: FileText,
  providerAssignments: Building2,
  interestedLeads: PhoneIncoming,
  passengerRequests: Ticket,
  pendingLeads: CheckCircle,
  blacklist: Ban,
  flightData: PlaneTakeoff,
  ProviderInterface: Building2,
  chatbot: MessageCircle,
};

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const navItems: Record<string, NavItem[]> = {
  admin: [
    { icon: LayoutDashboard, label: "Хяналт", path: "/admin" },
    { icon: Users, label: "Хэрэглэгчид", path: "/admin" },
    { icon: Plane, label: "Аялал", path: "/admin" },
    { icon: ShoppingCart, label: "Захиалга", path: "/admin" },
    { icon: Settings, label: "Тохиргоо", path: "/admin" },
  ],
  manager: managerNavItems.map((item) => ({
    icon: iconMap[item.key] || LayoutDashboard,
    label: item.label,
    path: item.path,
    badge: item.badge,
  })),
  provider: [
    { icon: LayoutDashboard, label: "Хяналт", path: "/provider" },
    { icon: ShoppingCart, label: "Захиалга", path: "/provider" },
    { icon: Users, label: "Зорчигчид", path: "/provider" },
    { icon: Plane, label: "Аялал", path: "/provider" },
  ],
  user: [
    { icon: LayoutDashboard, label: "Миний", path: "/user" },
    { icon: ShoppingCart, label: "Захиалга", path: "/user" },
    { icon: Plane, label: "Аялал", path: "/user" },
  ],
  agent: [
    { icon: LayoutDashboard, label: "Ажилтан", path: "/agent" },
    { icon: ShoppingCart, label: "Захиалга", path: "/agent" },
    { icon: Users, label: "Зорчигчид", path: "/agent" },
  ],
  subcontractor: [
    { icon: LayoutDashboard, label: "Хамтрагч", path: "/subcontractor" },
    { icon: ShoppingCart, label: "Захиалга", path: "/subcontractor" },
    { icon: Plane, label: "Аялал", path: "/subcontractor" },
    { icon: Users, label: "Зорчигчид", path: "/subcontractor" },
  ],
};

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen, isMobileOpen, setOpen, setMobileOpen } = useSidebar();
  const role = currentUser?.role || "user";
  const items = navItems[role as keyof typeof navItems] || navItems.user;
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    }
  }, [setOpen]);

  return (
    <div className="min-h-screen bg-[var(--mono-bg)] flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-[var(--mono-surface)] border-r border-[var(--mono-border)] z-40",
          "transition-all duration-300 ease-[var(--mono-ease)]",
          "hidden lg:flex flex-col",
          isOpen ? "w-64" : "w-20",
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--mono-border)]">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--mono-accent)] flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            {isOpen && (
              <span className="font-bold text-lg text-[var(--mono-text)]">
                GTrip
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(!isOpen)}
            className="p-1.5 rounded-lg hover:bg-[var(--mono-surface-muted)] transition"
          >
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--mono-text-soft)] transition",
                !isOpen && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {items.map((item, idx) => {
            const navKey = managerNavItems[idx]?.key || item.label;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={navKey}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  "hover:bg-[var(--mono-surface-muted)]",
                  isActive
                    ? "bg-[var(--mono-accent-soft)] text-[var(--mono-accent)] font-medium"
                    : "text-[var(--mono-text-soft)]",
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {isOpen && item.badge && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-[var(--mono-border)]">
          <div
            className={cn(
              "flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--mono-surface-muted)] transition",
              !isOpen && "justify-center",
            )}
          >
            <div className="w-9 h-9 rounded-full bg-[var(--mono-accent)] flex items-center justify-center text-white font-medium text-sm">
              {currentUser?.email?.[0]?.toUpperCase() || "U"}
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--mono-text)] truncate">
                  {currentUser?.email}
                </p>
                <p className="text-xs text-[var(--mono-text-soft)] capitalize">
                  {role}
                </p>
              </div>
            )}
            {isOpen && (
              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-[var(--mono-bg)] text-[var(--mono-text-soft)] transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-screen w-72 bg-[var(--mono-surface)] border-r border-[var(--mono-border)] z-50 lg:hidden">
            <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--mono-border)]">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--mono-accent)] flex items-center justify-center">
                  <Plane className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-[var(--mono-text)]">
                  GTrip
                </span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--mono-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="py-4 px-3 space-y-1 overflow-y-auto">
              {items.map((item, idx) => {
                const navKey = managerNavItems[idx]?.key || item.label;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={navKey}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                      isActive
                        ? "bg-[var(--mono-accent-soft)] text-[var(--mono-accent)] font-medium"
                        : "text-[var(--mono-text-soft)]",
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <main
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          isOpen ? "lg:ml-64" : "lg:ml-20",
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-[var(--mono-surface)] border-b border-[var(--mono-border)] flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-[var(--mono-surface-muted)] lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 bg-[var(--mono-surface-muted)] rounded-xl px-3 py-2 w-64">
              <Search className="w-4 h-4 text-[var(--mono-text-soft)]" />
              <input
                type="text"
                placeholder="Хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-[var(--mono-text)] placeholder:text-[var(--mono-text-soft)] w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-[var(--mono-surface-muted)] relative">
              <Bell className="w-5 h-5 text-[var(--mono-text-soft)]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <Link
              to="/change-password"
              className="p-2 rounded-lg hover:bg-[var(--mono-surface-muted)]"
            >
              <Settings className="w-5 h-5 text-[var(--mono-text-soft)]" />
            </Link>
          </div>
        </header>

        {/* Page content - FULLSCREEN for tables */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
