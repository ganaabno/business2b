import type { User as UserType } from "../types/type";

interface HeaderProps {
  currentUser: UserType;
  onLogout: () => void;
  isUserRole: boolean;
}

export default function Header({ currentUser, onLogout, isUserRole }: HeaderProps) {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isUserRole ? "Book Your Adventure" : "Booking Overview"}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isUserRole ? "Plan your perfect tour experience" : "View all tour bookings"}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Welcome, {currentUser.first_name} {currentUser.last_name}
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}