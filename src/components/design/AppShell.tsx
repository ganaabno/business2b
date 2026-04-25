import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { User } from "../../types/type";

interface AppShellProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  showSidebar?: boolean;
  showTopBar?: boolean;
}

export default function AppShell({
  children,
  currentUser,
  onLogout,
  showSidebar = true,
  showTopBar = true,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const theme = document.documentElement.getAttribute("data-theme");
    setIsDarkMode(theme === "dark");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleTheme = () => {
    const newTheme = isDarkMode ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          currentUser={currentUser}
          onLogout={onLogout}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      )}

      {/* Main Content Area */}
      <div
        className={`main-content ${sidebarCollapsed && showSidebar ? "sidebar--collapsed" : ""}`}
      >
        {/* Top Bar */}
        {showTopBar && (
          <TopBar
            currentUser={currentUser}
            onLogout={onLogout}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
        )}

        {/* Page Content */}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
