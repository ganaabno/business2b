import { useMemo } from "react";
import type { Passenger } from "../types/type";

interface ActiveTabProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  currentUser: any;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function ActiveTab({ passengers }: ActiveTabProps) {
  const activePassengers = useMemo(() => {
    return passengers.filter((p) => !p.is_blacklisted && p.status === "active");
  }, [passengers]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Passengers</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full mono-table divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activePassengers.map((passenger) => (
              <tr key={passenger.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {passenger.first_name} {passenger.last_name}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {passenger.order_id ?? "N/A"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {passenger.tour_title || "Unknown Tour"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activePassengers.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No active passengers</h3>
            <p className="text-gray-500">No active passengers found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
