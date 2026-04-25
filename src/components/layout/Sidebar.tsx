import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Plane,
  BarChart3,
  Globe,
  Truck,
  Map,
  Activity,
  LogOut,
  ChevronRight,
  Zap,
  Settings,
  HelpCircle,
} from 'lucide-react';
import type { User } from '../../types/type';

interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number | string;
  badgeType?: 'primary' | 'success' | 'warning' | 'danger';
  requireRole?: string[];
  description?: string;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

const getNavGroups = (role: string): NavGroup[] => {
  const adminGroups: NavGroup[] = [
    {
      groupLabel: 'Operations',
      items: [
        {
          label: 'Admin Dashboard',
          icon: <LayoutDashboard size={16} />,
          href: '/admin',
          description: 'Manage users, tours and settings',
        },
        {
          label: 'Manager View',
          icon: <FileText size={16} />,
          href: '/manager',
          description: 'View manager workspace',
        },
      ],
    },
    {
      groupLabel: 'Intelligence',
      items: [
        {
          label: 'Analytics',
          icon: <BarChart3 size={16} />,
          href: '/analytics',
          description: 'Revenue and booking metrics',
        },
        {
          label: 'B2B Monitoring',
          icon: <Activity size={16} />,
          href: '/b2b-monitoring',
          description: 'Monitor seat requests and bindings',
        },
      ],
    },
    {
      groupLabel: 'Data',
      items: [
        {
          label: 'Global Travel',
          icon: <Globe size={16} />,
          href: '/global-travel',
          description: 'Sync global tour inventory',
        },
        {
          label: 'Flight Data',
          icon: <Plane size={16} />,
          href: '/flight-data',
          description: 'Upload and view flight data',
        },
      ],
    },
  ];

  const managerGroups: NavGroup[] = [
    {
      groupLabel: 'Workspace',
      items: [
        {
          label: 'Manager Dashboard',
          icon: <LayoutDashboard size={16} />,
          href: '/manager',
          description: 'Orders, tours, passengers',
        },
      ],
    },
    {
      groupLabel: 'Monitoring',
      items: [
        {
          label: 'B2B Monitoring',
          icon: <Activity size={16} />,
          href: '/b2b-monitoring',
          description: 'Monitor seat requests and bindings',
        },
        {
          label: 'Flight Data',
          icon: <Plane size={16} />,
          href: '/flight-data',
          description: 'Upload and view flight data',
        },
      ],
    },
  ];

  const providerGroups: NavGroup[] = [
    {
      groupLabel: 'Workspace',
      items: [
        {
          label: 'Provider Dashboard',
          icon: <Truck size={16} />,
          href: '/provider',
          description: 'Manage your assigned orders',
        },
        {
          label: 'Flight Data',
          icon: <Plane size={16} />,
          href: '/flight-data',
          description: 'Upload and view flight data',
        },
      ],
    },
  ];

  const agentGroups: NavGroup[] = [
    {
      groupLabel: 'Workspace',
      items: [
        {
          label: 'Agent Workspace',
          icon: <Map size={16} />,
          href: '/agent',
          description: 'Book seats and manage clients',
        },
        {
          label: 'Flight Data',
          icon: <Plane size={16} />,
          href: '/flight-data',
          description: 'Upload and view flight data',
        },
      ],
    },
  ];

  const subcontractorGroups: NavGroup[] = [
    {
      groupLabel: 'Workspace',
      items: [
        {
          label: 'My Workspace',
          icon: <LayoutDashboard size={16} />,
          href: '/subcontractor',
          description: 'Bookings and seat requests',
        },
        {
          label: 'Flight Data',
          icon: <Plane size={16} />,
          href: '/flight-data',
          description: 'Upload and view flight data',
        },
      ],
    },
  ];

  const userGroups: NavGroup[] = [
    {
      groupLabel: 'Workspace',
      items: [
        {
          label: 'My Workspace',
          icon: <LayoutDashboard size={16} />,
          href: '/user',
          description: 'Bookings and passengers',
        },
        {
          label: 'Flight Data',
          icon: <Plane size={16} />,
          href: '/flight-data',
          description: 'Upload and view flight data',
        },
      ],
    },
  ];

  const roleMap: Record<string, NavGroup[]> = {
    admin: adminGroups,
    superadmin: adminGroups,
    manager: managerGroups,
    provider: providerGroups,
    agent: agentGroups,
    subcontractor: subcontractorGroups,
    user: userGroups,
  };

  return roleMap[role] ?? userGroups;
};

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    superadmin: 'Super Admin',
    manager: 'Manager',
    provider: 'Provider',
    agent: 'Agent',
    subcontractor: 'Subcontractor',
    user: 'User',
  };
  return labels[role] ?? role;
};

const getRoleBadgeStyle = (role: string) => {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    admin: { bg: '#1d4ed8', text: '#fff', dot: '#60a5fa' },
    superadmin: { bg: '#1e3a8a', text: '#fff', dot: '#93c5fd' },
    manager: { bg: '#0f766e', text: '#fff', dot: '#5eead4' },
    provider: { bg: '#b45309', text: '#fff', dot: '#fcd34d' },
    agent: { bg: '#6d28d9', text: '#fff', dot: '#c4b5fd' },
    subcontractor: { bg: '#475569', text: '#fff', dot: '#94a3b8' },
    user: { bg: '#475569', text: '#fff', dot: '#94a3b8' },
  };
  return styles[role] ?? styles['user'];
};

export default function Sidebar({ currentUser, onLogout }: SidebarProps) {
  const location = useLocation();
  const role = currentUser.role ?? 'user';
  const navGroups = getNavGroups(role);
  const roleStyle = getRoleBadgeStyle(role);

  const displayName =
    currentUser.username ||
    `${currentUser.first_name ?? ''} ${currentUser.last_name ?? ''}`.trim() ||
    currentUser.email?.split('@')[0] ||
    'User';

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <aside
      className="w-[240px] shrink-0 hidden lg:flex flex-col"
      style={{
        background: 'var(--mono-surface)',
        borderRight: '2px solid var(--mono-border)',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--mono-border)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
            boxShadow: '0 4px 12px rgba(29,78,216,0.35)',
          }}
        >
          <Zap size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-bold text-sm leading-tight tracking-tight"
            style={{ color: 'var(--mono-text)', letterSpacing: '-0.02em' }}
          >
            GTrip B2B
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--mono-text-soft)' }}
          >
            Travel Platform
          </p>
        </div>
      </div>

      {/* User Profile Block */}
      <div
        className="mx-3 my-3 rounded-xl p-3"
        style={{
          background: 'linear-gradient(135deg, var(--mono-accent-soft), var(--mono-surface-muted))',
          border: '1px solid var(--mono-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold leading-tight truncate"
              style={{ color: 'var(--mono-text)' }}
            >
              {displayName}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: roleStyle.dot }}
              />
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: roleStyle.bg,
                  color: roleStyle.text,
                  fontSize: '10px',
                  letterSpacing: '0.03em',
                }}
              >
                {getRoleLabel(role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 pb-3 space-y-5 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            <p
              className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--mono-text-soft)' }}
            >
              {group.groupLabel}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item, idx) => {
                const active = isActive(item.href);
                return (
                  <NavLink
                    key={idx}
                    to={item.href}
                    title={item.description}
                  >
                    <motion.div
                      whileHover={{ x: active ? 0 : 3 }}
                      transition={{ duration: 0.15 }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                        active ? 'text-white' : ''
                      }`}
                      style={
                        active
                          ? {
                              background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
                              color: 'white',
                              boxShadow: '0 4px 14px rgba(29,78,216,0.3)',
                            }
                          : {
                              color: 'var(--mono-text-muted)',
                              background: 'transparent',
                            }
                      }
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
                          (e.currentTarget as HTMLElement).style.color = 'var(--mono-text)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = 'var(--mono-text-muted)';
                        }
                      }}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                          style={{ background: '#60a5fa' }}
                        />
                      )}
                      <span className="shrink-0 ml-1">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && Number(item.badge) > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                          style={{
                            background: active ? 'rgba(255,255,255,0.25)' : '#ef4444',
                            color: 'white',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight size={12} style={{ opacity: 0.7 }} />}
                    </motion.div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div
        className="px-3 py-3 space-y-0.5"
        style={{ borderTop: '1px solid var(--mono-border)' }}
      >
        <button
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--mono-text-soft)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
            (e.currentTarget as HTMLElement).style.color = 'var(--mono-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--mono-text-soft)';
          }}
        >
          <HelpCircle size={16} className="shrink-0" />
          <span>Help & Support</span>
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <LogOut size={16} className="shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
