// src/Parts/Header.tsx
import type { User as UserType } from "../types/type";
import ThemeToggle from "../components/ThemeToggle";

interface HeaderProps {
  currentUser: UserType;
  pendingUsername?: string;
  onLogout: () => Promise<void>;
  isUserRole: boolean;
}

export default function Header({
  currentUser,
  pendingUsername,
  onLogout,
  isUserRole,
}: HeaderProps) {
  const displayName = pendingUsername
    ? pendingUsername
    : currentUser.username ||
      `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() ||
      currentUser.email?.split("@")[0] ||
      "User";

  return (
    <header className="bg-gray-50 border-b border-gray-200">
      <div className="mono-container px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5">
        <div className="flex justify-between items-center gap-2 sm:gap-4">
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 min-w-0 flex-1">
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm lg:text-base xl:text-lg font-medium text-gray-900 tracking-wide leading-tight font-sans truncate">
                <span className="hidden xs:inline">
                  {pendingUsername ? "Reviewing:" : "Welcome,"}
                </span>
                <span className="xs:hidden">Hi,</span> {displayName}
              </h1>

              <div className="flex items-center gap-2 mt-1">
                <span className="mono-badge">
                  {isUserRole ? "User" : "Admin"}
                </span>

                {/* Show this only when reviewing */}
                {pendingUsername && (
                  <span className="mono-badge mono-badge--warning">
                    Pending Approval
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center flex-shrink-0 gap-2">
            <ThemeToggle className="px-2.5 py-2 text-xs sm:text-sm" showLabel={false} />
            <button
              onClick={async () => {
                try {
                  await onLogout();
                } catch (error) {
                  // Silent fail — logout usually works
                }
              }}
              className="mono-button mono-button--ghost px-3 py-2 text-xs sm:text-sm rounded-full"
              aria-label="Log out"
            >
              <svg
                className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 sm:mr-1.5 lg:mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h3a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
