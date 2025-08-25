import { useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import type { Passenger, User as UserType } from "../types/type";

interface PassengersTabProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function PassengersTab({ passengers, setPassengers, currentUser, showNotification }: PassengersTabProps) {
  const [passengerNameFilter, setPassengerNameFilter] = useState<string>("");
  const [passengerOrderFilter, setPassengerOrderFilter] = useState<string>("");
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handlePassengerChange = async (id: string, field: keyof Passenger, value: any) => {
    const previousPassengers = [...passengers];
    const updatedPassengers = passengers.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    setPassengers(updatedPassengers);
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Error updating passenger:", error);
        showNotification("error", `Failed to update passenger: ${error.message}`);
        setPassengers(previousPassengers);
      }
    } catch (error) {
      console.error("Unexpected error updating passenger:", error);
      showNotification("error", "An unexpected error occurred while updating the passenger.");
      setPassengers(previousPassengers);
    }
  };

  const handleDeletePassenger = async (id: string) => {
    const previousPassengers = [...passengers];
    setPassengers(passengers.filter((p) => p.id !== id));
    try {
      const { error } = await supabase.from("passengers").delete().eq("id", id);
      if (error) {
        console.error("Error deleting passenger:", error);
        showNotification("error", `Failed to delete passenger: ${error.message}`);
        setPassengers(previousPassengers);
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting passenger:", error);
      showNotification("error", "An unexpected error occurred while deleting the passenger.");
      setPassengers(previousPassengers);
    }
  };

  const filteredPassengers = useMemo(() => {
    return passengers.filter((passenger) => {
      const matchesName = `${passenger.first_name || ""} ${passenger.last_name || ""}`
        .toLowerCase()
        .includes(passengerNameFilter.toLowerCase());
      const orderIdString = passenger.order_id != null ? String(passenger.order_id) : "";
      const matchesOrder = orderIdString.toLowerCase().includes(passengerOrderFilter.toLowerCase());
      const matchesStatus = passengerStatusFilter === "all" || 
                           passenger.status === passengerStatusFilter || 
                           (!passenger.status && passengerStatusFilter === "active");
      return matchesName && matchesOrder && matchesStatus;
    });
  }, [passengers, passengerNameFilter, passengerOrderFilter, passengerStatusFilter]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Passengers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name</label>
            <input
              type="text"
              value={passengerNameFilter}
              onChange={(e) => setPassengerNameFilter(e.target.value)}
              placeholder="Search passengers..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
            <input
              type="text"
              value={passengerOrderFilter}
              onChange={(e) => setPassengerOrderFilter(e.target.value)}
              placeholder="Search by order ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={passengerStatusFilter}
              onChange={(e) => setPassengerStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 w-48 shadow-sm">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-[108px] z-10 bg-gray-50 w-32 shadow-sm">Order ID</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
              <th className="px-10 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
              <th className="px-12 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gender</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport Expiry</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nationality</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Allocation</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hotel</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Additional Services</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Allergies</th>
              <th className="px-24 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
              <th className="px-18 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
              <th className="px-18 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Emergency Phone</th>
              <th className="px-48 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPassengers.map((passenger) => (
              <tr key={passenger.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-white w-48 shadow-sm">
                  <div className="text-sm font-medium text-gray-900">
                    {passenger.first_name} {passenger.last_name}
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap sticky left-[108px] z-10 bg-white w-32 shadow-sm">
                  <input
                    type="text"
                    value={passenger.order_id ?? ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "order_id", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Order ID..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="date"
                    value={passenger.date_of_birth || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "date_of_birth", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="number"
                    value={passenger.age || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "age", parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Age..."
                    min="0"
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <select
                    value={passenger.gender || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "gender", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.passport_number || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "passport_number", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Passport..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="date"
                    value={passenger.passport_expiry || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "passport_expiry", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.nationality || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "nationality", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nationality..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.roomType || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "roomType", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Room Type..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.room_allocation || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "room_allocation", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Room Alloc..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.hotel || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "hotel", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Hotel..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.additional_services?.join(", ") || ""}
                    onChange={(e) =>
                      handlePassengerChange(passenger.id, "additional_services", e.target.value.split(",").map((s) => s.trim()))
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Services..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="text"
                    value={passenger.allergy || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "allergy", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Allergies..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="email"
                    value={passenger.email || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "email", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Email..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="tel"
                    value={passenger.phone || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "phone", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <input
                    type="tel"
                    value={passenger.emergency_phone || ""}
                    onChange={(e) => handlePassengerChange(passenger.id, "emergency_phone", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Emergency..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <select
                    value={passenger.status || "active"}
                    onChange={(e) => handlePassengerChange(passenger.id, "status", e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="active">✅ Active</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {showDeleteConfirm === passenger.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDeletePassenger(passenger.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(passenger.id)}
                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                      title="Delete passenger"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}