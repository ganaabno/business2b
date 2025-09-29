import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Trash2, MapPin } from "lucide-react";
import type { User as UserType, PassengerInLead } from "../types/type";
import { format } from "date-fns";

interface PassengersInLeadProps {
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function PassengersInLead({ currentUser, showNotification }: PassengersInLeadProps) {
  const [passengers, setPassengers] = useState<PassengerInLead[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for ticking timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchPassengers = async () => {
      setLoading(true);
      console.log("Fetching passengers for user:", currentUser.id); // Debug: Log user
      try {
        // Fetch from passengers_in_lead with join on users for username
        let { data, error } = await supabase
          .from("passengers_in_lead")
          .select(`
            id,
            tour_id,
            tour_title,
            first_name,
            last_name,
            phone,
            seat_count,
            departure_date,
            status,
            created_at,
            expires_at,
            user_id,
            users!passengers_in_lead_user_id_fkey(username)
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching passengers:", error);
          showNotification("error", `Failed to fetch pending leads: ${error.message}`);
          setPassengers([]);
          return;
        }

        console.log("Supabase response:", data); // Debug: Log raw response

        // Map data to PassengerInLead, including username as created_by
        const mapped = (data || []).map((row: any) => ({
          ...row,
          tour: { title: row.tour_title || "No Tour" },
          tour_title: row.tour_title || "No Tour",
          created_by: row.users?.username || "Unknown",
        }));

        console.log("Mapped passengers:", mapped); // Debug: Log mapped data
        setPassengers(mapped);
      } catch (error) {
        console.error("Unexpected error fetching passengers:", error);
        showNotification("error", "An unexpected error occurred while fetching pending leads.");
        setPassengers([]);
      } finally {
        setLoading(false);
        console.log("Loading state:", false); // Debug: Log loading state
      }
    };

    fetchPassengers();

    const subscription = supabase
      .channel("passengers_in_lead_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passengers_in_lead",
          filter: "status=eq.pending",
        },
        async (payload) => {
          console.log("Real-time payload:", payload); // Debug: Log payload

          const newRow = payload.new as PassengerInLead & { users?: { username: string } } | undefined;
          const oldRow = payload.old as PassengerInLead | undefined;

          if (!newRow && !oldRow) return;

          // Fetch username for new or updated rows
          const fetchUsername = async (userId: string): Promise<string> => {
            const { data, error } = await supabase
              .from("users")
              .select("username")
              .eq("id", userId)
              .single();
            if (error) {
              console.error("Error fetching username:", error);
              return "Unknown";
            }
            return data?.username || "Unknown";
          };

          if (payload.eventType === "INSERT" && newRow) {
            const username = await fetchUsername(newRow.user_id);
            const mappedRow: PassengerInLead = {
              ...newRow,
              tour: { title: newRow.tour_title || "No Tour" },
              tour_title: newRow.tour_title || "No Tour",
              created_by: username,
            };
            console.log("Real-time INSERT:", mappedRow); // Debug: Log new row
            setPassengers((prev) => [mappedRow, ...prev]);
          } else if (payload.eventType === "UPDATE" && newRow) {
            const username = await fetchUsername(newRow.user_id);
            const mappedRow: PassengerInLead = {
              ...newRow,
              tour: { title: newRow.tour_title || "No Tour" },
              tour_title: newRow.tour_title || "No Tour",
              created_by: username,
            };
            console.log("Real-time UPDATE:", mappedRow); // Debug: Log updated row
            setPassengers((prev) =>
              prev.map((p) => (p.id === newRow.id ? mappedRow : p))
            );
          } else if (payload.eventType === "DELETE" && oldRow) {
            console.log("Real-time DELETE:", oldRow.id); // Debug: Log deleted ID
            setPassengers((prev) => prev.filter((p) => p.id !== oldRow.id));
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("Subscription error:", error);
          showNotification("error", `Real-time subscription failed: ${error.message}`);
        }
        console.log("Subscription status:", status); // Debug: Log subscription status
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser, showNotification]);

  const handleDeletePassenger = async (id: string) => {
    const previousPassengers = [...passengers];
    setPassengers(passengers.filter((p) => p.id !== id));
    try {
      const { error } = await supabase.from("passengers_in_lead").delete().eq("id", id);
      if (error) {
        console.error("Error deleting passenger:", error);
        showNotification("error", `Failed to delete passenger: ${error.message}`);
        setPassengers(previousPassengers);
      } else {
        showNotification("success", "Passenger deleted successfully");
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting passenger:", error);
      showNotification("error", "An unexpected error occurred while deleting the passenger.");
      setPassengers(previousPassengers);
    }
  };

  const formatCountdown = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - currentTime.getTime();

    if (diffMs <= 0) {
      return "Expired";
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <ToastContainer />
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Pending Lead Passengers ({passengers.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 12a8 8 0 0116 0 8 8 0 01-16 0zm8-8v2m0 12v2m8-8h-2m-12 0H4m15.364 4.364l-1.414-1.414m-12.728 0L6.636 13.95M16.95 6.636l-1.414 1.414M7.05 16.95l-1.414-1.414"
                />
              </svg>
              <p className="text-gray-500">Loading pending leads...</p>
            </div>
          ) : passengers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-gray-500">No pending lead passengers.</p>
              <p className="text-sm text-gray-400 mt-1">Lead passengers with pending status will appear here.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Lead ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Tour
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Seats
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Time Left
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {passengers.map((passenger) => (
                  <tr key={passenger.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      {passenger.id.slice(0, 6)}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      {passenger.tour_title || "No Tour"}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      {passenger.first_name} {passenger.last_name}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      {passenger.phone}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        💺 {passenger.seat_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      {passenger.created_by}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ⏰ {formatCountdown(passenger.expires_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {showDeleteConfirm === passenger.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeletePassenger(passenger.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(passenger.id)}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}