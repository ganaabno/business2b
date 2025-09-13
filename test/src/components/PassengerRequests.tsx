import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import type { Passenger, ValidationError, Tour } from "../types/type";
import { CheckCircle, XCircle } from "lucide-react";

interface PassengerWithUser extends Passenger {
  registeredBy: string;
  orderDepartureDate: string;
  orderTourTitle: string;
  orders: {
    id: string;
    tour_id: string;
    departureDate: string;
    createdBy: string;
    user_id: string;
    tours: Tour | null;
  } | null;
}

interface PassengerRequestsProps {
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function PassengerRequests({ showNotification }: PassengerRequestsProps) {
  const [passengers, setPassengers] = useState<PassengerWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    action: "approve" | "reject" | null;
    passengerId: string | null;
    message: string;
  } | null>(null);
  const [errors] = useState<ValidationError[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Format date for display
  const formatDisplayDate = (s: string | undefined): string => {
    if (!s) return "";
    const d = new Date(s);
    return !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : s;
  };

  // Fetch passenger requests with user info, sorted by created_at descending
  const fetchPassengerRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("passengers")
        .select(`
          *,
          orders (
            id,
            tour_id,
            departureDate,
            createdBy,
            user_id,
            tours (
              id,
              title,
              seats,
              departuredate,
              status,
              show_in_provider,
              description,
              creator_name,
              tour_number,
              name,
              dates,
              hotels,
              services,
              created_by,
              created_at,
              updated_at,
              base_price
            )
          ),
          users (
            id,
            email,
            username
          )
        `)
        .neq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching passenger requests:", error);
        showNotification("error", `Failed to fetch passenger requests: ${error.message}`);
        return;
      }

      const passengerData = data.map((p: any) => ({
        ...p,
        registeredBy: p.orders?.createdBy || p.users?.username || p.users?.email || "Unknown User",
        orderDepartureDate: p.orders?.departureDate || p.departure_date || "",
        orderTourTitle: p.orders?.tours?.title || p.tour_title || "Unknown Tour",
        orders: p.orders
          ? {
              id: p.orders.id,
              tour_id: p.orders.tour_id,
              departureDate: p.orders.departureDate,
              createdBy: p.orders.createdBy,
              user_id: p.orders.user_id,
              tours: p.orders.tours
                ? {
                    id: p.orders.tours.id,
                    title: p.orders.tours.title,
                    seats: p.orders.tours.seats ?? 0,
                    departureDate: p.orders.tours.departuredate || "",
                    status: p.orders.tours.status,
                    show_in_provider: p.orders.tours.show_in_provider,
                    description: p.orders.tours.description || "",
                    creator_name: p.orders.tours.creator_name || "",
                    tour_number: p.orders.tours.tour_number || "",
                    name: p.orders.tours.name || p.orders.tours.title,
                    dates: p.orders.tours.dates || [],
                    hotels: p.orders.tours.hotels || [],
                    services: p.orders.tours.services || [],
                    created_by: p.orders.tours.created_by || "",
                    created_at: p.orders.tours.created_at || "",
                    updated_at: p.orders.tours.updated_at || "",
                    base_price: p.orders.tours.base_price ?? 0,
                  }
                : null,
            }
          : null,
      })) as PassengerWithUser[];

      setPassengers(passengerData);
      console.log("Fetched passenger requests:", passengerData);
    } catch (error) {
      console.error("Unexpected error fetching passenger requests:", error);
      showNotification("error", "Failed to fetch passenger requests");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Real-time subscription for passengers
  useEffect(() => {
    fetchPassengerRequests();

    const subscription = supabase
      .channel("passenger_requests_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passengers",
        },
        async (payload) => {
          console.log("Real-time passenger update:", payload);
          await fetchPassengerRequests();
        }
      )
      .subscribe((status) => {
        console.log("Passenger requests subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from passenger_requests_channel");
      supabase.removeChannel(subscription);
    };
  }, [fetchPassengerRequests]);

  // Approve passenger
  const approvePassenger = async (passengerId: string) => {
    setLoading(true);
    try {
      const passenger = passengers.find((p) => p.id === passengerId);
      if (!passenger) {
        showNotification("error", "Passenger not found");
        return;
      }

      // If previously rejected, check seat availability
      if (passenger.status === "rejected") {
        const tourId = passenger.orders?.tour_id;
        if (tourId) {
          const { data: tourData, error: tourError } = await supabase
            .from("tours")
            .select("seats")
            .eq("id", tourId)
            .single();
          if (tourError) {
            console.error("Error fetching tour:", tourError);
            showNotification("error", `Failed to fetch tour: ${tourError.message}`);
            return;
          }
          if (tourData.seats !== undefined && tourData.seats <= 0) {
            showNotification("error", "Cannot approve passenger: No seats available");
            return;
          }
        }
      }

      // Update passenger status to 'active'
      const { error: passengerError } = await supabase
        .from("passengers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", passengerId);
      if (passengerError) {
        console.error("Error approving passenger:", passengerError);
        showNotification("error", `Failed to approve passenger: ${passengerError.message}`);
        return;
      }

      // Update seats if moving from pending/rejected to active
      if (passenger.status !== "active") {
        const tourId = passenger.orders?.tour_id;
        if (tourId) {
          const { data: tourData, error: tourError } = await supabase
            .from("tours")
            .select("seats")
            .eq("id", tourId)
            .single();
          if (tourError) {
            console.error("Error fetching tour:", tourError);
            showNotification("error", `Failed to fetch tour: ${tourError.message}`);
            return;
          }
          if (tourData.seats !== undefined && tourData.seats > 0) {
            const { error: updateError } = await supabase
              .from("tours")
              .update({ seats: tourData.seats - 1 })
              .eq("id", tourId);
            if (updateError) {
              console.error("Error updating seats:", updateError);
              showNotification("error", `Failed to update seats: ${updateError.message}`);
              return;
            }
            console.log(`Updated seats for tour ${tourId}: ${tourData.seats - 1}`);
          }
        }
      }

      showNotification("success", "Passenger approved successfully");
      await fetchPassengerRequests();
    } catch (error) {
      console.error("Unexpected error approving passenger:", error);
      showNotification("error", "Failed to approve passenger");
    } finally {
      setLoading(false);
    }
  };

  // Reject passenger
  const rejectPassenger = async (passengerId: string) => {
    setLoading(true);
    try {
      const passenger = passengers.find((p) => p.id === passengerId);
      if (!passenger) {
        showNotification("error", "Passenger not found");
        return;
      }

      // If previously approved, increment seats
      if (passenger.status === "active") {
        const tourId = passenger.orders?.tour_id;
        if (tourId) {
          const { data: tourData, error: tourError } = await supabase
            .from("tours")
            .select("seats")
            .eq("id", tourId)
            .single();
          if (tourError) {
            console.error("Error fetching tour:", tourError);
            showNotification("error", `Failed to fetch tour: ${tourError.message}`);
            return;
          }
          if (tourData.seats !== undefined) {
            const { error: updateError } = await supabase
              .from("tours")
              .update({ seats: tourData.seats + 1 })
              .eq("id", tourId);
            if (updateError) {
              console.error("Error updating seats:", updateError);
              showNotification("error", `Failed to update seats: ${updateError.message}`);
              return;
            }
            console.log(`Updated seats for tour ${tourId}: ${tourData.seats + 1}`);
          }
        }
      }

      // Update passenger status to 'rejected'
      const { error } = await supabase
        .from("passengers")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", passengerId);
      if (error) {
        console.error("Error rejecting passenger:", error);
        showNotification("error", `Failed to reject passenger: ${error.message}`);
        return;
      }

      showNotification("success", "Passenger rejected successfully");
      await fetchPassengerRequests();
    } catch (error) {
      console.error("Unexpected error rejecting passenger:", error);
      showNotification("error", "Failed to reject passenger");
    } finally {
      setLoading(false);
    }
  };

  // Handle confirm action for approve/reject
  const handleConfirmAction = () => {
    if (!showConfirmModal?.passengerId) return;

    if (showConfirmModal.action === "approve") {
      approvePassenger(showConfirmModal.passengerId);
    } else if (showConfirmModal.action === "reject") {
      rejectPassenger(showConfirmModal.passengerId);
    }

    setShowConfirmModal(null);
  };

  // Pagination logic
  const totalPages = Math.ceil(passengers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPassengers = passengers.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Passenger Requests</h3>
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <ul className="list-disc list-inside text-sm text-red-800">
            {errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}
      {passengers.length === 0 ? (
        <p className="text-gray-600">No pending passenger requests.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Passport
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tour
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPassengers.map((passenger) => (
                  <tr key={passenger.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {passenger.first_name} {passenger.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {passenger.passport_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {passenger.orderTourTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDisplayDate(passenger.orderDepartureDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {passenger.registeredBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          passenger.status === "active"
                            ? "bg-green-100 text-green-800"
                            : passenger.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() =>
                            setShowConfirmModal({
                              action: "approve",
                              passengerId: passenger.id,
                              message: `Approve passenger ${passenger.first_name} ${passenger.last_name}?`,
                            })
                          }
                          className="text-green-600 hover:text-green-800"
                          title="Approve passenger"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setShowConfirmModal({
                              action: "reject",
                              passengerId: passenger.id,
                              message: `Reject passenger ${passenger.first_name} ${passenger.last_name}?`,
                            })
                          }
                          className="text-red-600 hover:text-red-800"
                          title="Reject passenger"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
            >
              Previous
            </button>
            <span className="self-center text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{showConfirmModal.message}</h3>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-900">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}