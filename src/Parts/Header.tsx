import type { User as UserType } from "../types/type";
import Logo from "../assets/last logo.png";

interface HeaderProps {
  currentUser: UserType;
  onLogout: () => Promise<void>;
  isUserRole: boolean;
}

export default function Header({
  currentUser,
  onLogout,
  isUserRole,
}: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-between items-center">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <img
            src={Logo}
            alt="Company Logo"
            className="h-7 w-auto sm:h-9 object-contain transition-transform duration-300 ease-in-out hover:scale-110"
            loading="lazy"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
            <h1 className="text-base sm:text-lg font-medium text-white tracking-wide leading-tight font-sans">
              Welcome, {currentUser.username || currentUser.email}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-900 mt-1.5 sm:mt-0 shadow-sm">
              {isUserRole ? "User" : "Admin"}
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={async () => {
              try {
                await onLogout();
              } catch (error) {
                console.error("Logout failed:", error);
              }
            }}
            className="group inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium rounded-full text-white bg-gradient-to-br from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 focus:ring-red-200 shadow-md transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
            aria-label="Log out"
          >
            <svg
              className="-ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h3a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
