import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MapPin, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import type {
  User as UserType,
  PassengerInLead,
  LeadPassenger,
} from "../types/type";

interface ManageLeadProps {
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  setLeadPassengerData: React.Dispatch<
    React.SetStateAction<LeadPassenger | null>
  >;
  setPassengerFormData: React.Dispatch<
    React.SetStateAction<{
      seat_count: number;
      tour_id: string;
      departure_date: string;
    } | null>
  >;
}

export default function ManageLead({
  currentUser,
  showNotification,
  setActiveStep,
  setLeadPassengerData,
  setPassengerFormData,
}: ManageLeadProps) {
  const [passengers, setPassengers] = useState<PassengerInLead[]>([]);
  const [showActionsModal, setShowActionsModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [leadPassengerFormData, setLeadPassengerFormData] = useState<{
    seat_count: number;
    tour_id: string;
    departure_date: string;
  } | null>(null);
  const itemsPerPage = 10;
  const actionButtonRefs = useRef<Map<string, HTMLButtonElement | null>>(
    new Map()
  );

  // Update current time every second for countdown timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch and subscribe to user's lead passengers
  useEffect(() => {
    const fetchPassengers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("passengers_in_lead")
          .select(
            `
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
            `
          )
          .eq("user_id", currentUser.id)
          .in("status", ["pending", "confirmed", "cancelled"])
          .order("created_at", { ascending: false });

        if (error) {
          showNotification("error", `Failed to fetch leads: ${error.message}`);
          setPassengers([]);
          return;
        }


        const mapped = (data || []).map((row: any) => ({
          ...row,
          tour: { title: row.tour_title || "No Tour" },
          tour_title: row.tour_title || "No Tour",
          created_by: row.users?.username || "Unknown",
        }));

        setPassengers(mapped);
      } catch (error) {
        showNotification(
          "error",
          "An unexpected error occurred while fetching leads."
        );
        setPassengers([]);
      } finally {
        setLoading(false);
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
          filter: `user_id=eq.${currentUser.id}`,
        },
        async (payload) => {

          const newRow = payload.new as
            | (PassengerInLead & { users?: { username: string } })
            | undefined;
          const oldRow = payload.old as PassengerInLead | undefined;

          if (!newRow && !oldRow) return;

          const fetchUsername = async (userId: string): Promise<string> => {
            const { data, error } = await supabase
              .from("users")
              .select("username")
              .eq("id", userId)
              .single();
            if (error) {
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
            setPassengers((prev) => [mappedRow, ...prev]);
          } else if (payload.eventType === "UPDATE" && newRow) {
            const username = await fetchUsername(newRow.user_id);
            const mappedRow: PassengerInLead = {
              ...newRow,
              tour: { title: newRow.tour_title || "No Tour" },
              tour_title: newRow.tour_title || "No Tour",
              created_by: username,
            };
            setPassengers((prev) =>
              prev.map((p) => (p.id === newRow.id ? mappedRow : p))
            );
          } else if (payload.eventType === "DELETE" && oldRow) {
            setPassengers((prev) => prev.filter((p) => p.id !== oldRow.id));
            actionButtonRefs.current.delete(oldRow.id); // Clean up ref on delete
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          showNotification(
            "error",
            `Real-time subscription failed: ${error.message}`
          );
        }
      });

    return () => {
      supabase.removeChannel(subscription);
      actionButtonRefs.current.clear(); // Clean up refs on unmount
    };
  }, [currentUser, showNotification]);

  const handleConfirm = async (passenger: PassengerInLead) => {
    const diff =
      new Date(passenger.expires_at).getTime() - new Date().getTime();
    if (diff <= 0) {
      showNotification("error", "Cannot confirm expired lead");
      return;
    }

    const previousPassengers = [...passengers];
    try {
      const { error } = await supabase
        .from("passengers_in_lead")
        .update({ status: "confirmed" })
        .eq("id", passenger.id);

      if (error) {
        throw error;
      }

      const leadPassengerData: LeadPassenger = {
        id: passenger.id,
        tour_id: passenger.tour_id,
        departure_date: passenger.departure_date,
        last_name: passenger.last_name,
        first_name: passenger.first_name,
        phone: passenger.phone,
        seat_count: passenger.seat_count,
        status: "confirmed",
        created_at: passenger.created_at,
        expires_at: passenger.expires_at,
        user_id: passenger.user_id,
        tour_title: passenger.tour_title,
      };

      setLeadPassengerData(leadPassengerData);
      setPassengerFormData({
        seat_count: passenger.seat_count,
        tour_id: passenger.tour_id,
        departure_date: passenger.departure_date,
      });
      setActiveStep(3);
      setPassengers((prev) => prev.filter((p) => p.id !== passenger.id));
      actionButtonRefs.current.delete(passenger.id); // Clean up ref on confirm
      showNotification(
        "success",
        `Lead confirmed, adding ${passenger.seat_count} passenger forms`
      );
    } catch (error) {
      showNotification("error", "Failed to confirm lead");
      setPassengers(previousPassengers);
    } finally {
      setShowActionsModal(null);
    }
  };

  const handleDeletePassenger = async (id: string) => {
    const previousPassengers = [...passengers];
    setPassengers(passengers.filter((p) => p.id !== id));
    try {
      const { error } = await supabase
        .from("passengers_in_lead")
        .delete()
        .eq("id", id);
      if (error) {
        showNotification(
          "error",
          `Failed to delete lead passenger: ${error.message}`
        );
        setPassengers(previousPassengers);
      } else {
        actionButtonRefs.current.delete(id); // Clean up ref on delete
        showNotification("success", "Lead passenger deleted successfully");
      }
    } catch (error) {
      showNotification(
        "error",
        "An unexpected error occurred while deleting the lead passenger."
      );
      setPassengers(previousPassengers);
    } finally {
      setShowActionsModal(null);
    }
  };

  const formatCountdown = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - currentTime.getTime();

    if (diffMs <= 0) return "Expired";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  };

  // Handle dropdown positioning
  const handleActionButtonClick = (
    passengerId: string,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    const button = actionButtonRefs.current.get(passengerId);
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const dropdownHeight = 150; // Approximate height of dropdown (adjust as needed)
    const spaceBelow = windowHeight - rect.bottom;

    // Determine if dropdown should open upwards
    const shouldOpenUpwards = spaceBelow < dropdownHeight;

    setShowActionsModal((prev) => (prev === passengerId ? null : passengerId));

    // Update dropdown position in DOM after state update
    setTimeout(() => {
      const dropdown = document.querySelector(`#dropdown-${passengerId}`);
      if (dropdown) {
        dropdown.classList.remove("mt-2", "mb-2", "bottom-0", "top-0");
        if (shouldOpenUpwards) {
          dropdown.classList.add("bottom-0", "mb-2");
        } else {
          dropdown.classList.add("top-0", "mt-2");
        }
      }
    }, 0);
  };

  // Sort passengers: pending first, then confirmed, then cancelled
  const sortedPassengers = [...passengers].sort((a, b) => {
    const statusOrder = { pending: 1, confirmed: 2, cancelled: 3 };
    return (
      statusOrder[a.status as keyof typeof statusOrder] -
        statusOrder[b.status as keyof typeof statusOrder] ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  // Paginate sorted passengers
  const paginatedPassengers = sortedPassengers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(sortedPassengers.length / itemsPerPage);

  return (
    <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <ToastContainer />
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          Your Lead Passengers ({passengers.length})
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage and view your lead passengers
        </p>
      </div>
      <div className="p-8">
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
            <p className="text-gray-600">Loading your leads...</p>
          </div>
        ) : passengers.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <p className="text-gray-600">No lead passengers.</p>
            <p className="text-sm text-gray-400 mt-1">
              Your lead passengers will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="min-w-full mono-table divide-y divide-gray-200">
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
                      Phone (Last 4)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Seats
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Departure Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Created By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedPassengers.map((passenger) => (
                    <tr
                      key={passenger.id}
                      className="hover:bg-gray-100 transition-all duration-200"
                    >
                      <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                        {passenger.id.slice(0, 6)}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                        {passenger.tour_title || "No Tour"}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                        {`${passenger.first_name} ${passenger.last_name}`}
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
                        {passenger.departure_date
                          ? format(
                              new Date(passenger.departure_date),
                              "yyyy-MM-dd"
                            )
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                        {passenger.created_by}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            passenger.status === "pending"
                              ? "bg-red-100 text-red-800"
                              : passenger.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {passenger.status === "pending"
                            ? `⏰ ${formatCountdown(passenger.expires_at)}`
                            : passenger.status.charAt(0).toUpperCase() +
                              passenger.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          ref={(el) => {
                            actionButtonRefs.current.set(passenger.id, el);
                          }}
                          onClick={(e) =>
                            handleActionButtonClick(passenger.id, e)
                          }
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="Actions"
                          aria-label={`Actions for lead passenger ${passenger.first_name} ${passenger.last_name}`}
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {showActionsModal === passenger.id && (
                          <div
                            id={`dropdown-${passenger.id}`}
                            className="absolute right-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20"
                          >
                            <button
                              onClick={() => handleConfirm(passenger)}
                              className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
                              aria-label="Confirm lead passenger"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() =>
                                handleDeletePassenger(passenger.id)
                              }
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors"
                              aria-label="Delete lead passenger"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setShowActionsModal(null)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                              aria-label="Cancel actions"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Previous
                </button>
                <span className="text-sm text-gray-600 mx-4">
                  Page <span className="font-semibold">{currentPage}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span>
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
