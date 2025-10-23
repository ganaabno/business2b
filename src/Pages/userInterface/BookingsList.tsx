import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import type {
  Tour,
  Passenger,
  Order,
  User as UserType,
} from "../../types/type";

interface BookingsListProps {
  passengers: Passenger[];
  orders: Order[];
  tours: Tour[];
  currentUser: UserType;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

const formatDisplayDate = (s: string | undefined): string => {
  if (!s) return "";
  const d = new Date(s);
  return !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : s;
};

export default function BookingsList({
  passengers,
  orders,
  tours,
  currentUser,
  currentPage,
  setCurrentPage,
}: BookingsListProps) {
  const itemsPerPage = 10;
  const [pendingRequests, setPendingRequests] = useState<Passenger[]>([]);

  const fetchPendingRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from("passenger_requests")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "pending");
    if (error) {
      console.error("Error fetching pending requests:", error);
      return;
    }
    console.log("Fetched pending requests:", JSON.stringify(data, null, 2));
    setPendingRequests(data || []);
  }, [currentUser.id]);

  useEffect(() => {
    fetchPendingRequests();

    const subscription = supabase
      .channel("passenger_requests_user")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passenger_requests",
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => fetchPendingRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchPendingRequests, currentUser.id]);

  const sortedPassengers = useMemo(() => {
    const userPassengers = passengers
      .filter((p) => p.user_id === currentUser.id)
      .map((passenger) => {
        const order = orders.find((o) => o.id === passenger.order_id);
        const tour = tours.find((t) => t.id === order?.tour_id);
        return {
          ...passenger,
          tour_title: tour?.title || passenger.tour_title || "Unknown Tour",
          departure_date:
            order?.departureDate || passenger.departure_date || "",
        };
      });
    return [...userPassengers].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [passengers, orders, tours, currentUser.id]);

  const sortedPendingRequests = useMemo(() => {
    return [...pendingRequests].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [pendingRequests]);

  const paginatedItems = useMemo(() => {
    // Combine pending requests and passengers with a source indicator
    const pendingWithSource = sortedPendingRequests.map((item) => ({
      ...item,
      source: "pending_request",
    }));
    const passengersWithSource = sortedPassengers.map((item) => ({
      ...item,
      source: "passenger",
    }));
    // Combine and sort by created_at
    return [...pendingWithSource, ...passengersWithSource]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [sortedPendingRequests, sortedPassengers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(
    (sortedPassengers.length + sortedPendingRequests.length) / itemsPerPage
  );

  return sortedPassengers.length > 0 || sortedPendingRequests.length > 0 ? (
    <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
        <h3 className="text-xl font-bold text-gray-900">Your Bookings</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage and view your travel reservations and pending requests
        </p>
      </div>
      <div className="p-8">
        <div className="space-y-6">
          {paginatedItems.map((item) => (
            <div
              key={`${item.source}-${item.id}`}
              className="group bg-gray-50 hover:bg-gray-100 rounded-lg p-6 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-md"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Tour
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.tour_title}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Departure
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatDisplayDate(item.departure_date || "")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Passenger
                  </p>
                  <p className="text-sm text-gray-700">{item.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === "active"
                        ? "bg-green-100 text-green-800"
                        : item.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
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
            <span className="text-sm text-gray-600">
              Page <span className="font-semibold">{currentPage}</span> of{" "}
              <span className="font-semibold">{totalPages}</span>
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
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
      </div>
    </div>
  ) : (
    <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-100 p-8">
      <p className="text-gray-600">No bookings or pending requests found.</p>
    </div>
  );
}
