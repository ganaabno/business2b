import React, { useState } from 'react';
import { Search, Bell, ChevronDown, User, Settings, LogOut, Moon, Sun } from 'lucide-react';
import type { User as UserType } from '../../types/type';

interface TopBarProps {
  currentUser: UserType;
  onLogout: () => void;
  onToggleTheme?: () => void;
  isDarkMode?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function TopBar({
  currentUser,
  onLogout,
  onToggleTheme,
  isDarkMode = false,
}: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = currentUser.first_name && currentUser.last_name
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : currentUser.email || 'User';

  return (
    <header className="topbar">
      {/* Left Side */}
      <div className="topbar-left">
        <div className="text-sm font-medium text-gray-900">
          {currentUser.role === 'admin' || currentUser.role === 'superadmin'
            ? 'Admin'
            : currentUser.role === 'manager'
            ? 'Manager'
            : currentUser.role === 'provider'
            ? 'Provider'
            : 'Dashboard'}
        </div>
      </div>

      {/* Center - Search */}
      <div className="topbar-center">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tours, bookings, passengers..."
            className="input pl-9 pr-4"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Side */}
      <div className="topbar-right">
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="btn btn--ghost btn-icon"
          title={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn btn--ghost btn-icon relative"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-100">
                <h3 className="font-semibold text-sm">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-4 text-center text-sm text-gray-500">
                  No new notifications
                </div>
              </div>
              <div className="p-2 border-t border-gray-100">
                <button className="btn btn--ghost btn--sm w-full">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
              {getInitials(displayName)}
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-100">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {displayName}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {currentUser.email}
                </div>
              </div>
              <div className="p-1">
                <button className="btn btn--ghost w-full justify-start text-sm">
                  <User size={16} />
                  Profile
                </button>
                <button className="btn btn--ghost w-full justify-start text-sm">
                  <Settings size={16} />
                  Settings
                </button>
              </div>
              <div className="p-1 border-t border-gray-100">
                <button
                  onClick={onLogout}
                  className="btn btn--ghost w-full justify-start text-sm text-red-600"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}