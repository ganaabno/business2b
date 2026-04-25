import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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

const normalizeDepartureDate = (value: string | undefined | null): string => {
  if (!value) return "no-date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "no-date";
  }

  return date.toISOString().slice(0, 10);
};

const toStatusLabel = (status: string | undefined): string => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function BookingsList({
  passengers,
  orders,
  tours,
  currentUser,
  currentPage,
  setCurrentPage,
}: BookingsListProps) {
  const { t } = useTranslation();
  const itemsPerPage = 10;
  const [pendingRequests, setPendingRequests] = useState<Passenger[]>([]);
  const [tourFilter, setTourFilter] = useState("all");
  const [departureFilter, setDepartureFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const ordersById = useMemo(
    () => new Map(orders.map((order) => [String(order.id), order])),
    [orders],
  );
  const toursById = useMemo(
    () => new Map(tours.map((tour) => [String(tour.id), tour])),
    [tours],
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
        () => fetchPendingRequests(),
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
          tour_title: tour?.title || passenger.tour_title || t("unknownTour"),
          departure_date:
            order?.departureDate || passenger.departure_date || "",
        };
      });

    return userPassengers
      .filter(
        (p): p is { created_at: string } & typeof p => p.created_at !== null,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [passengers, ordersById, toursById, currentUser.id, t]);

  const sortedPendingRequests = useMemo(() => {
    return pendingRequests
      .filter(
        (p): p is { created_at: string } & typeof p => p.created_at !== null,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [pendingRequests]);

  const combinedItems = useMemo(() => {
    const pendingWithSource = sortedPendingRequests.map((item) => ({
      ...item,
      source: "pending_request" as const,
    }));

    const passengersWithSource = sortedPassengers.map((item) => ({
      ...item,
      source: "passenger" as const,
    }));

    return [...pendingWithSource, ...passengersWithSource];
  }, [sortedPendingRequests, sortedPassengers]);

  const tourOptions = useMemo(() => {
    return Array.from(
      new Set(combinedItems.map((item) => item.tour_title || t("unknownTour"))),
    ).sort((a, b) => a.localeCompare(b));
  }, [combinedItems, t]);

  const departureOptions = useMemo(() => {
    return Array.from(
      new Set(
        combinedItems.map((item) =>
          normalizeDepartureDate(item.departure_date),
        ),
      ),
    ).sort();
  }, [combinedItems]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(
        combinedItems
          .map((item) => String(item.status || "").toLowerCase())
          .filter((status) => status.length > 0),
      ),
    ).sort();
  }, [combinedItems]);

  const filteredItems = useMemo(() => {
    return combinedItems.filter((item) => {
      const itemTour = item.tour_title || t("unknownTour");
      const itemDate = normalizeDepartureDate(item.departure_date);
      const itemStatus = String(item.status || "").toLowerCase();

      if (tourFilter !== "all" && itemTour !== tourFilter) return false;
      if (departureFilter !== "all" && itemDate !== departureFilter)
        return false;
      if (statusFilter !== "all" && itemStatus !== statusFilter) return false;

      return true;
    });
  }, [combinedItems, tourFilter, departureFilter, statusFilter, t]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tourFilter, departureFilter, statusFilter, setCurrentPage]);

  const paginatedItems = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    const safePage = Math.min(currentPage, totalPages);

    return {
      items: filteredItems.slice(
        (safePage - 1) * itemsPerPage,
        safePage * itemsPerPage,
      ),
      totalPages,
    };
  }, [filteredItems, currentPage]);

  const { items: displayItems, totalPages } = paginatedItems;
  const hasAnyItems = combinedItems.length > 0;
  const hasActiveFilters =
    tourFilter !== "all" || departureFilter !== "all" || statusFilter !== "all";

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  return hasAnyItems ? (
    <div className="mono-card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="mono-title text-lg">{t("registeredPassengers")}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {t("compactBookingTableByPassenger")}
          </p>
        </div>
        <span className="mono-badge">
          {t("itemsCount", {
            count: filteredItems.length,
            total: combinedItems.length,
          })}
        </span>
      </div>

      <div className="px-5 py-3 border-b border-gray-200 bg-white">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1fr),auto]">
          <select
            value={tourFilter}
            onChange={(e) => setTourFilter(e.target.value)}
            className="mono-select text-sm"
          >
            <option value="all">{t("allTours")}</option>
            {tourOptions.map((tour) => (
              <option key={tour} value={tour}>
                {tour}
              </option>
            ))}
          </select>

          <select
            value={departureFilter}
            onChange={(e) => setDepartureFilter(e.target.value)}
            className="mono-select text-sm"
          >
            <option value="all">{t("allDepartures")}</option>
            {departureOptions.map((dateKey) => (
              <option key={dateKey} value={dateKey}>
                {dateKey === "no-date"
                  ? t("noDate")
                  : formatDisplayDate(dateKey)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mono-select text-sm"
          >
            <option value="all">{t("allStatuses")}</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {toStatusLabel(status)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setTourFilter("all");
              setDepartureFilter("all");
              setStatusFilter("all");
            }}
            className="mono-button mono-button--ghost px-3 py-2 text-sm"
            disabled={!hasActiveFilters}
          >
            {t("reset")}
          </button>
        </div>
      </div>

      <div className="mono-table-shell border-0 rounded-none shadow-none">
        <div className="mono-table-scroll">
          <table className="mono-table mono-table--compact mono-table--plain">
            <thead>
              <tr>
                <th>{t("tour")}</th>
                <th>{t("departure")}</th>
                <th>{t("passenger")}</th>
                <th>{t("source")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-sm text-gray-500"
                  >
                    {t("noMatchingPassengers")}
                  </td>
                </tr>
              ) : (
                displayItems.map((item) => {
                  const passengerName =
                    item.name ||
                    [item.last_name, item.first_name]
                      .filter(Boolean)
                      .join(" ") ||
                    "-";
                  const sourceLabel =
                    item.source === "pending_request"
                      ? t("pendingRequest")
                      : t("registered");

                  return (
                    <tr key={`${item.source}-${item.id}`}>
                      <td>{item.tour_title || t("unknownTour")}</td>
                      <td>
                        {formatDisplayDate(item.departure_date || "") || "-"}
                      </td>
                      <td>{passengerName}</td>
                      <td>
                        <span className="mono-badge">{sourceLabel}</span>
                      </td>
                      <td>
                        <span
                          className={`mono-badge ${
                            item.status === "active"
                              ? "mono-badge--success"
                              : item.status === "pending"
                                ? "mono-badge--warning"
                                : ""
                          }`}
                        >
                          {toStatusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && displayItems.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="mono-button mono-button--ghost"
          >
            {t("previous")}
          </button>
          <span className="text-sm text-gray-600">
            {t("pageOf", { current: currentPage, total: totalPages })}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="mono-button mono-button--ghost"
          >
            {t("next")}
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="mono-card p-6">
      <p className="mono-subtitle">{t("noBookingsOrPendingRequests")}</p>
    </div>
  );
}
