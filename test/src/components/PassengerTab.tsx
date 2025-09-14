import { useState, useMemo, useEffect } from "react";
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false); // Toggle edit mode
  const [isSaving, setIsSaving] = useState<boolean>(false); // Loading state for save
  const passengersPerPage = 10;

  // Fetch passengers with tour_title
  const fetchPassengers = async () => {
    try {
      let query = supabase
        .from("passengers")
        .select(`
          *,
          orders (
            id,
            tour_id,
            tours (
              id,
              title
            )
          )
        `);
      if (currentUser.role === "user") {
        query = query.eq("user_id", currentUser.userId);
      }
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching passengers:", error);
        showNotification("error", `Failed to fetch passengers: ${error.message}`);
        return;
      }
      console.log("Fetched passengers:", data);
      const enrichedPassengers = data.map((p: any) => ({
        ...p,
        tour_title: p.orders?.tours?.title || "Unknown Tour",
        is_blacklisted: p.is_blacklisted || false, // Default to false if missing
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        departure_date: p.orders?.departureDate || p.departure_date || "",
      })) as Passenger[];
      setPassengers(enrichedPassengers);
      console.log("Enriched passengers with is_blacklisted:", enrichedPassengers.map(p => ({ id: p.id, is_blacklisted: p.is_blacklisted })));
    } catch (error) {
      console.error("Unexpected error fetching passengers:", error);
      showNotification("error", "An unexpected error occurred while fetching passengers.");
    }
  };

  // Real-time subscription for passengers
  useEffect(() => {
    fetchPassengers(); // Initial fetch
    const subscription = supabase
      .channel("passengers_tab_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passengers",
          filter: currentUser.role === "user" ? `user_id=eq.${currentUser.userId}` : undefined,
        },
        (payload) => {
          console.log("Real-time passenger update:", payload);
          fetchPassengers(); // Refetch on update
        }
      )
      .subscribe((status) => {
        console.log("Passenger subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from passengers_tab_channel");
      supabase.removeChannel(subscription);
    };
  }, [currentUser.userId, currentUser.role, showNotification]);

  const handlePassengerChange = (id: string, field: keyof Passenger, value: any) => {
    setPassengers((prevPassengers) =>
      prevPassengers.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSaveEdits = async () => {
    if (isSaving) return; // Prevent multiple saves
    setIsSaving(true);
    const previousPassengers = [...passengers]; // Store original state for revert
    try {
      const updates = passengers.map(async (passenger) => {
        const { error } = await supabase
          .from("passengers")
          .update({
            ...passenger,
            updated_at: new Date().toISOString(),
            edited_by: currentUser.id,
          })
          .eq("id", passenger.id);
        return { passenger, error };
      });
      const results = await Promise.all(updates);
      const hasError = results.some((result) => result.error);
      if (hasError) {
        const error = results.find((result) => result.error)?.error;
        console.error("Error updating passengers:", error);
        showNotification("error", `Failed to update passengers: ${error?.message || "Unknown error"}`);
        setPassengers(previousPassengers); // Revert on error
      } else {
        showNotification("success", "Saved completely! 😎");
        setIsEditMode(false); // Exit edit mode after successful save
      }
    } catch (error) {
      console.error("Unexpected error updating passengers:", error);
      showNotification("error", "An unexpected error occurred while updating passengers.");
      setPassengers(previousPassengers);
    } finally {
      setIsSaving(false);
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
      } else {
        console.log(`Deleted passenger id=${id}`);
        showNotification("success", "Passenger deleted successfully");
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting passenger:", error);
      showNotification("error", "An unexpected error occurred while deleting the passenger.");
      setPassengers(previousPassengers);
    }
  };

  const handleBlacklistToggle = async (id: string, isChecked: boolean) => {
    const previousPassengers = [...passengers];
    const updatedPassengers = passengers.map((p) => 
      p.id === id ? { ...p, is_blacklisted: isChecked } : p
    );
    setPassengers(updatedPassengers);
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ is_blacklisted: isChecked, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Error updating blacklist:", error);
        showNotification("error", `Failed to update blacklist: ${error.message}`);
        setPassengers(previousPassengers); // Revert on error
      } else {
        console.log(`Blacklist updated for passenger ${id}: ${isChecked}`);
        showNotification("success", isChecked ? "Passenger blacklisted! 🚫" : "Passenger unblacklisted! ✅");
      }
    } catch (error) {
      console.error("Unexpected error updating blacklist:", error);
      showNotification("error", "An unexpected error occurred while updating blacklist.");
      setPassengers(previousPassengers);
    }
  };

  const filteredPassengers = useMemo(() => {
    // Sort by departure_date first (nearest to furthest)
    return [...passengers]
      .sort((a, b) => {
        const dateA = a.departure_date ? new Date(a.departure_date) : new Date(0); // Treat empty as far past
        const dateB = b.departure_date ? new Date(b.departure_date) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      })
      .filter((passenger) => {
        const matchesName = `${passenger.first_name || ""} ${passenger.last_name || ""}`
          .toLowerCase()
          .includes(passengerNameFilter.toLowerCase());
        const orderIdString = passenger.order_id != null ? String(passenger.order_id) : "";
        const matchesOrder = orderIdString.toLowerCase().includes(passengerOrderFilter.toLowerCase());
        const matchesStatus = passengerStatusFilter === "all" || 
                           passenger.status === passengerStatusFilter || 
                           (!passenger.status && passengerStatusFilter === "active");
        return matchesName && matchesOrder && matchesStatus && !passenger.is_blacklisted; // Exclude blacklisted
      });
  }, [passengers, passengerNameFilter, passengerOrderFilter, passengerStatusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPassengers.length / passengersPerPage);
  const paginatedPassengers = useMemo(() => {
    const startIndex = (currentPage - 1) * passengersPerPage;
    return filteredPassengers.slice(startIndex, startIndex + passengersPerPage);
  }, [filteredPassengers, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
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
              <option value="pending">⏳ Pending</option>
              <option value="approved">✅ Approved</option>
              <option value="rejected">❌ Rejected</option>
              <option value="active">✅ Active</option>
              <option value="inactive">😴 Inactive</option>
              <option value="cancelled">🚫 Cancelled</option>
            </select>
            <div className="mt-2">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-all duration-200 font-semibold text-sm"
              >
                {isEditMode ? "Cancel Edit 😎" : "Edit Passengers xD"}
              </button>
              {isEditMode && (
                <button
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="w-full mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-sm"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 w-48 shadow-sm">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-[108px] z-10 bg-gray-50 w-32 shadow-sm">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure Date</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
              <th className="px-10 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
              <th className="px-12 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gender</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport Expiry</th>
              <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-10 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Blacklist</th>
              <th className="px-10 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedPassengers.map((passenger) => (
              <tr key={passenger.id}>
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white z-0">
                  {isEditMode ? (
                    <input
                      type="text"
                      value={`${passenger.first_name} ${passenger.last_name}`}
                      onChange={(e) => {
                        const [first, ...last] = e.target.value.split(" ");
                        handlePassengerChange(passenger.id, "first_name", first);
                        handlePassengerChange(passenger.id, "last_name", last.join(" "));
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    `${passenger.first_name} ${passenger.last_name}`
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-[108px] bg-white z-0">
                  {passenger.order_id || "N/A"}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <input
                      type="text"
                      value={passenger.tour_title}
                      onChange={(e) => handlePassengerChange(passenger.id, "tour_title", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    passenger.tour_title
                  )}
                </td>
                <td className="px-14 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <input
                      type="date"
                      value={passenger.departure_date}
                      onChange={(e) => handlePassengerChange(passenger.id, "departure_date", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    passenger.departure_date
                  )}
                </td>
                <td className="px-14 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <input
                      type="date"
                      value={passenger.date_of_birth}
                      onChange={(e) => handlePassengerChange(passenger.id, "date_of_birth", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    passenger.date_of_birth
                  )}
                </td>
                <td className="px-10 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <input
                      type="number"
                      value={passenger.age}
                      onChange={(e) => handlePassengerChange(passenger.id, "age", parseInt(e.target.value))}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    passenger.age
                  )}
                </td>
                <td className="px-12 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <select
                      value={passenger.gender}
                      onChange={(e) => handlePassengerChange(passenger.id, "gender", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    passenger.gender
                  )}
                </td>
                <td className="px-14 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <input
                      type="text"
                      value={passenger.passport_number}
                      onChange={(e) => handlePassengerChange(passenger.id, "passport_number", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    passenger.passport_number
                  )}
                </td>
                <td className="px-14 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <input
                      type="date"
                      value={passenger.passport_expiry}
                      onChange={(e) => handlePassengerChange(passenger.id, "passport_expiry", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    passenger.passport_expiry
                  )}
                </td>
                <td className="px-14 py-2 text-sm text-gray-900">
                  {isEditMode ? (
                    <select
                      value={passenger.status}
                      onChange={(e) => handlePassengerChange(passenger.id, "status", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  ) : (
                    passenger.status
                  )}
                </td>
                <td className="px-10 py-2 text-sm text-gray-900">
                  {isEditMode && (
                    <input
                      type="checkbox"
                      checked={passenger.is_blacklisted || false}
                      onChange={(e) => handleBlacklistToggle(passenger.id, e.target.checked)}
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  )}
                  {!isEditMode && (passenger.is_blacklisted ? "Yes" : "No")}
                </td>
                <td className="px-10 py-2 text-sm text-gray-900">
                  {isEditMode && (
                    <button
                      onClick={() => setShowDeleteConfirm(passenger.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredPassengers.length === 0 && (
        <div className="p-4 text-center text-gray-500">No passengers found matching the filters.</div>
      )}
      {totalPages > 1 && (
        <div className="p-4 flex justify-end items-center space-x-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">{`Page ${currentPage} of ${totalPages}`}</span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this passenger?</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePassenger(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}