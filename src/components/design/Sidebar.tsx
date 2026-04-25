import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Plane,
  Users,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  Globe,
  Calendar,
  BarChart3,
  Inbox,
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
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: <LayoutDashboard size={18} />, href: '/admin' },
      { label: 'Analytics', icon: <BarChart3 size={18} />, href: '/analytics' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Requests', icon: <Inbox size={18} />, href: '/b2b-monitoring', badge: 0, badgeType: 'primary' },
      { label: 'Bookings', icon: <FileText size={18} />, href: '/bookings' },
      { label: 'Tours', icon: <Plane size={18} />, href: '/tours' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Passengers', icon: <Users size={18} />, href: '/passengers' },
      { label: 'Payments', icon: <CreditCard size={18} />, href: '/payments' },
      { label: 'Calendar', icon: <Calendar size={18} />, href: '/calendar' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', icon: <Settings size={18} />, href: '/admin-settings' },
    ],
  },
];

function getBadgeClass(type?: 'primary' | 'success' | 'warning' | 'danger') {
  switch (type) {
    case 'success': return 'badge badge--accent';
    case 'warning': return 'badge badge--warning';
    case 'danger': return 'badge badge--danger';
    default: return 'badge badge--primary';
  }
}

export default function Sidebar({ currentUser, onLogout, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Overview', 'Operations', 'Management', 'System']);

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <div className="sidebar-header">
          <div className="flex items-center justify-center h-10">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Globe size={18} className="text-white" />
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav py-4">
          {navigation.flatMap(section => section.items).map((item, idx) => (
            <NavLink
              key={idx}
              to={item.href}
              className={`sidebar-item justify-center ${isActive(item.href) ? 'sidebar-item--active' : ''}`}
              title={item.label}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onToggleCollapse}
            className="sidebar-item justify-center w-full"
            title="Expand sidebar"
          >
            <Menu size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Globe size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>B2B Travel</div>
            <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{currentUser.role}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navigation.map((section, sectionIdx) => (
          <div key={sectionIdx} className="sidebar-section">
            {section.title && (
              <div className="flex items-center justify-between px-3 mb-1">
                <span className="sidebar-section-title">{section.title}</span>
                <button
                  onClick={() => toggleSection(section.title!)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {expandedSections.includes(section.title!) ? (
                    <ChevronDown size={12} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={12} className="text-gray-400" />
                  )}
                </button>
              </div>
            )}
            
            {(!section.title || expandedSections.includes(section.title!)) && (
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => (
                  <NavLink
                    key={itemIdx}
                    to={item.href}
                    className={`sidebar-item ${isActive(item.href) ? 'sidebar-item--active' : ''}`}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>
                    <span className="sidebar-item-label">{item.label}</span>
                    {item.badge !== undefined && Number(item.badge) > 0 && (
                      <span className={`sidebar-item-badge ${getBadgeClass(item.badgeType)}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="sidebar-item text-red-600 hover:bg-red-50 w-full"
        >
          <LogOut size={18} />
          <span className="sidebar-item-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}