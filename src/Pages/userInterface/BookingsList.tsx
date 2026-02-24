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

  const ordersById = useMemo(
    () => new Map(orders.map((order) => [String(order.id), order])),
    [orders]
  );
  const toursById = useMemo(
    () => new Map(tours.map((tour) => [String(tour.id), tour])),
    [tours]
  );

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

    setPendingRequests((data as Passenger[]) || []);
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
  }, [fetchPendingRequests]);

  const sortedPassengers = useMemo(() => {
    const userPassengers = passengers
      .filter((p) => p.user_id === currentUser.id)
      .map((passenger) => {
        const order = passenger.order_id
          ? ordersById.get(String(passenger.order_id))
          : undefined;
        const tour = order?.tour_id
          ? toursById.get(String(order.tour_id))
          : undefined;
        return {
          ...passenger,
          tour_title: tour?.title || passenger.tour_title || "Unknown Tour",
          departure_date:
            order?.departureDate || passenger.departure_date || "",
        };
      });

    return userPassengers
      .filter(
        (p): p is { created_at: string } & typeof p => p.created_at !== null
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [passengers, ordersById, toursById, currentUser.id]);

  const sortedPendingRequests = useMemo(() => {
    return pendingRequests
      .filter(
        (p): p is { created_at: string } & typeof p => p.created_at !== null
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [pendingRequests]);

  const paginatedItems = useMemo(() => {
    const pendingWithSource = sortedPendingRequests.map((item) => ({
      ...item,
      source: "pending_request" as const,
    }));

    const passengersWithSource = sortedPassengers.map((item) => ({
      ...item,
      source: "passenger" as const,
    }));

    const combined = [...pendingWithSource, ...passengersWithSource];

    const totalItems = combined.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return {
      items: combined.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      ),
      totalPages,
    };
  }, [sortedPendingRequests, sortedPassengers, currentPage]);

  const { items: displayItems, totalPages } = paginatedItems;

  return displayItems.length > 0 ? (
    <div className="mt-8 mono-card overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-100">
        <h3 className="mono-title text-xl">Your Bookings</h3>
        <p className="mono-subtitle text-sm mt-1">
          Manage and view your travel reservations and pending requests
        </p>
      </div>
      <div className="p-6">
        <div className="space-y-6">
          {displayItems.map((item) => (
            <div
              key={`${item.source}-${item.id}`}
              className="mono-card mono-card--hover p-6 transition-all duration-200"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
                    className={`mono-badge ${
                      item.status === "active"
                        ? "mono-badge--success"
                        : item.status === "pending"
                        ? "mono-badge--warning"
                        : ""
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
              className="mono-button mono-button--ghost"
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
              className="mono-button mono-button--ghost"
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
    <div className="mt-8 mono-card p-6">
      <p className="mono-subtitle">No bookings or pending requests found.</p>
    </div>
  );
}
