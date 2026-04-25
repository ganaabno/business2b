import { useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Bell, LogOut, ChevronRight, Home, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import type { User as UserType } from '../../types/type';
import { useAuth } from '../../context/AuthProvider';
import ThemeToggle from '../../components/ThemeToggle';

interface TopBarProps {
  currentUser: UserType;
  onLogout: () => Promise<void>;
}

const ROUTE_META: Record<string, { title: string; crumbs: { label: string; href?: string }[] }> = {
  '/admin': {
    title: 'Admin Dashboard',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Admin' }],
  },
  '/manager': {
    title: 'Manager Dashboard',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Manager' }],
  },
  '/analytics': {
    title: 'Analytics',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Analytics' }],
  },
  '/b2b-monitoring': {
    title: 'B2B Monitoring',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'B2B Monitoring' }],
  },
  '/global-travel': {
    title: 'Global Travel',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Global Travel' }],
  },
  '/flight-data': {
    title: 'Flight Data',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Flight Data' }],
  },
  '/provider': {
    title: 'Provider Dashboard',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Provider' }],
  },
  '/agent': {
    title: 'Agent Workspace',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Agent' }],
  },
  '/subcontractor': {
    title: 'My Workspace',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Workspace' }],
  },
  '/user': {
    title: 'My Workspace',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Workspace' }],
  },
  '/change-password': {
    title: 'Change Password',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'Settings' }, { label: 'Change Password' }],
  },
};

const HIDE_TOPBAR_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'];

const TopBar = ({ currentUser, onLogout }: TopBarProps) => {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hideTopBar = HIDE_TOPBAR_PATHS.includes(location.pathname);

  const handleLogout = async () => {
    await onLogout();
    navigate('/login');
  };

  const displayName = useMemo(() => {
    return (
      currentUser.username ||
      `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim() ||
      currentUser.email?.split('@')[0] ||
      'User'
    );
  }, [currentUser]);

  const routeMeta = ROUTE_META[location.pathname] ?? {
    title: 'GTrip',
    crumbs: [{ label: 'Home', href: '/' }],
  };

  if (hideTopBar || authLoading) {
    return null;
  }

  return (
    <motion.header
      initial={{ y: -4, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="sticky top-0 z-30"
      style={{
        background: 'var(--mono-surface)',
        borderBottom: '1.5px solid var(--mono-border)',
        boxShadow: '0 1px 8px rgba(29,78,216,0.06)',
      }}
    >
      <div className="flex items-center justify-between px-6 h-14 gap-4">
        {/* Left: Page Title + Breadcrumbs */}
        <div className="flex flex-col justify-center min-w-0">
          {/* Breadcrumb row */}
          <nav className="flex items-center gap-1 mb-0.5" aria-label="Breadcrumb">
            <Home size={11} style={{ color: 'var(--mono-text-soft)' }} />
            {routeMeta.crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={10} style={{ color: 'var(--mono-text-soft)' }} />
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="text-[11px] transition-colors"
                    style={{ color: 'var(--mono-text-soft)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--mono-accent)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--mono-text-soft)';
                    }}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--mono-text-muted)' }}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
          {/* Page Title */}
          <h1
            className="text-base font-bold leading-tight truncate"
            style={{
              color: 'var(--mono-text)',
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-display)',
            }}
          >
            {routeMeta.title}
          </h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <button
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              color: 'var(--mono-text-muted)',
              background: 'var(--mono-surface-muted)',
              border: '1px solid var(--mono-border)',
              minWidth: '160px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--mono-accent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--mono-border)';
            }}
          >
            <Search size={13} />
            <span className="text-xs">Quick search...</span>
            <kbd
              className="ml-auto text-[10px] px-1 py-0.5 rounded"
              style={{
                background: 'var(--mono-border)',
                color: 'var(--mono-text-soft)',
                fontFamily: 'monospace',
              }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              className="p-2 rounded-lg transition-all"
              aria-label="Notifications"
              style={{ color: 'var(--mono-text-muted)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
                (e.currentTarget as HTMLElement).style.color = 'var(--mono-text)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--mono-text-muted)';
              }}
            >
              <Bell className="w-4 h-4" />
            </button>
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center text-[9px] font-bold text-white rounded-full pointer-events-none"
              style={{ background: '#ef4444' }}
            >
              3
            </span>
          </div>

          {/* Divider */}
          <div
            className="h-6 w-px"
            style={{ background: 'var(--mono-border)' }}
          />

          {/* Theme Toggle */}
          <ThemeToggle className="px-2 py-2 text-xs" showLabel={false} />

          {/* User Avatar + Logout */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
                color: '#fff',
                boxShadow: '0 2px 6px rgba(29,78,216,0.3)',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p
                className="text-xs font-semibold leading-tight"
                style={{ color: 'var(--mono-text)' }}
              >
                {displayName}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            aria-label="Log out"
            style={{
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.2)';
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
};

export default TopBar;
