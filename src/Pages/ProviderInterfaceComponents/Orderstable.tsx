import { useMemo, useState, useEffect } from "react";
import type { Order, OrderStatus } from "../../types/type";
import { useTranslation } from "react-i18next";
import React from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient";

interface OrdersTableProps {
  orders: Order[];
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  ordersPerPage: number;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  exportOrdersToCSV: () => Promise<void>;
  exportLoading: boolean;
  uniqueDates: string[];
  formatDate: (dateString: string | null) => string;
  refetch: () => void;
}

const safe = (v: any) => (v == null || v === "" ? "—" : String(v).trim());

interface Group {
  date: string;
  tourTitle: string;
  orders: Order[];
  isCompleted: boolean;
  key: string;
}

const safeDepartureDate = (dateStr: string | null | undefined): string => {
  if (!dateStr?.trim()) return "no-date";
  try {
    const cleaned = dateStr.trim();
    const normalized =
      cleaned.includes("T") || cleaned.includes(" ")
        ? cleaned.split("T")[0].split(" ")[0]
        : cleaned;
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch (e) {
    console.warn("Invalid departure date:", dateStr);
  }
  return "no-date";
};

const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  selectedDate,
  setSelectedDate,
  searchTerm,
  setSearchTerm,
  loading,
  updateOrderStatus,
  exportOrdersToCSV,
  exportLoading,
  uniqueDates,
  formatDate,
  refetch,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">(
    "active"
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const [undoingKey, setUndoingKey] = useState<string | null>(null);
  const [localOrders, setLocalOrders] = useState<Order[]>(orders);

  useEffect(() => setLocalOrders(orders), [orders]);

  const formatDisplayDate = (dateStr: string): string => {
    if (dateStr === "no-date") return "No Date";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const groupedData = useMemo(() => {
    const groups: { [key: string]: Group } = {};

    localOrders.forEach((order) => {
      const depDate = safeDepartureDate(order.departureDate);
      const tourTitle = (order.tour ?? "").trim() || t("unknownTour");
      const key = `${depDate}|||${tourTitle}`;

      if (!groups[key]) {
        groups[key] = {
          date: depDate,
          tourTitle,
          orders: [],
          isCompleted: false,
          key,
        };
      }

      groups[key].orders.push(order);

      const allPax = [
        ...(order.passengers ?? []),
        ...(order.passenger_requests ?? []),
      ];

      if (
        order.status === "cancelled" ||
        (allPax.length > 0 && allPax.every((p) => p.status === "completed"))
      ) {
        groups[key].isCompleted = true;
      }
    });

    return Object.values(groups);
  }, [localOrders, t]);

  const allGroups = groupedData;
  const activeGroups = allGroups.filter((g) => !g.isCompleted);
  const completedGroups = allGroups.filter((g) => g.isCompleted);

  activeGroups.sort((a, b) => a.date.localeCompare(b.date));
  completedGroups.sort((a, b) => b.date.localeCompare(a.date));

  const tabs = [
    ...(activeGroups.length > 0
      ? [
          {
            id: "active",
            label: t("active"),
            count: activeGroups.reduce((a, g) => a + g.orders.length, 0),
          },
        ]
      : []),
    ...(completedGroups.length > 0
      ? [
          {
            id: "completed",
            label: t("Completed Tours"),
            count: completedGroups.reduce((a, g) => a + g.orders.length, 0),
          },
        ]
      : []),
    { id: "all", label: t("All Tours"), count: localOrders.length },
  ];

  const visibleGroups = useMemo(() => {
    if (activeTab === "all") {
      return selectedDate
        ? groupedData.filter((g) => g.date === selectedDate)
        : groupedData;
    }
    return activeTab === "completed" ? completedGroups : activeGroups;
  }, [activeTab, selectedDate, groupedData, activeGroups, completedGroups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleCompleteTour = async (groupKey: string) => {
    if (completingKey) return;
    setCompletingKey(groupKey);

    const group = groupedData.find((g) => g.key === groupKey);
    if (!group) return;

    const passengerIds = group.orders
      .flatMap((o) => [
        ...(o.passengers ?? []),
        ...(o.passenger_requests ?? []),
      ])
      .map((p) => p.id)
      .filter(Boolean);

    if (passengerIds.length === 0) {
      toast.warn(t("noPassengersToComplete"));
      setCompletingKey(null);
      return;
    }

    try {
      const { error } = await supabase
        .from("passengers")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .in("id", passengerIds);

      if (error) throw error;
      toast.success(t("Completed"));
      refetch();
      setActiveTab("completed");
    } catch (err: any) {
      toast.error(`${t("failedToComplete")}: ${err.message}`);
    } finally {
      setCompletingKey(null);
    }
  };

  const handleUndoComplete = async (groupKey: string) => {
    if (undoingKey) return;
    setUndoingKey(groupKey);

    const group = groupedData.find((g) => g.key === groupKey);
    if (!group) return;

    const passengerIds = group.orders
      .flatMap((o) => [
        ...(o.passengers ?? []),
        ...(o.passenger_requests ?? []),
      ])
      .map((p) => p.id)
      .filter(Boolean);

    try {
      const { error } = await supabase
        .from("passengers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .in("id", passengerIds);

      if (error) throw error;
      toast.success(t("Success"));
      refetch();
      setActiveTab("active");
    } catch (err: any) {
      toast.error(`${t("failedToUndo")}: ${err.message}`);
    } finally {
      setUndoingKey(null);
    }
  };

  const renderGroup = (group: Group) => {
    const isExpanded = expandedGroups.has(group.key);
    const isCompleting = completingKey === group.key;
    const isUndoing = undoingKey === group.key;

    return (
      <div key={group.key} className="mono-card overflow-hidden mb-4">
        {/* Group Header - Mobile Optimized */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleGroup(group.key)}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && toggleGroup(group.key)
          }
          className="w-full px-4 sm:px-5 lg:px-6 py-4 flex items-start sm:items-center justify-between hover:bg-gray-50 transition cursor-pointer gap-2"
        >
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 truncate">
                {formatDisplayDate(group.date)} — {group.tourTitle}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {group.orders.length} {t("orders")}
                {group.isCompleted && ` • ${t("completed")}`}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
            {group.isCompleted ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUndoComplete(group.key);
                }}
                disabled={isUndoing}
                className="mono-button mono-button--ghost mono-button--sm"
              >
                {isUndoing ? (
                  "..."
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden xs:inline">{t("undo")}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompleteTour(group.key);
                }}
                disabled={isCompleting}
                className="mono-button mono-button--sm"
              >
                {isCompleting ? "..." : t("Complete")}
              </button>
            )}
          </div>
        </div>

        {/* Table - Mobile Card View on Small Screens */}
        {isExpanded && (
            <div className="border-t border-gray-200">
              {/* Desktop Table View */}
              <div className="hidden lg:block p-4 lg:p-6 overflow-x-auto">
                <table className="min-w-full mono-table mono-table--compact mono-table--plain table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="sticky left-0 z-20 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] text-center">
                        #
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Order ID
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Passenger
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Tour
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Departure
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Hotel
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Room Type
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Room
                      </th>
                      <th className="px-20 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Note
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {group.orders.map((order, orderIndex) => {
                    const allPax = [
                      ...(order.passengers ?? []),
                      ...(order.passenger_requests ?? []),
                    ];

                    if (allPax.length === 0) {
                      return (
                        <tr key={order.id}>
                          <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm text-center font-semibold">
                            {orderIndex + 1}
                          </td>
                          <td className="px-4 py-3 text-sm">{order.id}</td>
                          <td className="px-4 py-3 text-sm italic text-gray-500">
                            —
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.tour ?? "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatDate(order.departureDate ?? null)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {safe(order.hotel)}
                          </td>
                          <td className="px-4 py-3 text-sm">—</td>
                          <td className="px-4 py-3 text-sm">
                            {order.room_number ?? "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm italic text-gray-500">
                            —
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <select
                              value={order.status}
                              onChange={(e) =>
                                updateOrderStatus(
                                  order.id,
                                  e.target.value as OrderStatus
                                )
                              }
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="pending">{t("pending")}</option>
                              <option value="confirmed">
                                {t("confirmed")}
                              </option>
                              <option value="cancelled">
                                {t("cancelled")}
                              </option>
                            </select>
                          </td>
                        </tr>
                      );
                    }

                    allPax.sort((a, b) =>
                      a.main_passenger_id == null
                        ? -1
                        : b.main_passenger_id == null
                        ? 1
                        : 0
                    );

                    const mainPax =
                      allPax.find((p) => p.main_passenger_id == null) ||
                      allPax[0];
                    const serialNo = mainPax?.serial_no
                      ? `P${mainPax.serial_no}`
                      : "—";
                    const groupRoom = safe(
                      mainPax?.room_allocation ?? order.room_number
                    );
                    const roomTypeFromAny = allPax
                      .map((p) => p.roomType)
                      .find((rt) => rt && String(rt).trim() !== "");
                    const displayRoomType = roomTypeFromAny
                      ? String(roomTypeFromAny).trim()
                      : "—";
                    const displayHotel = (() => {
                      const paxHotel = allPax
                        .map((p) => p.hotel)
                        .find((h) => h && String(h).trim() !== "");
                      return paxHotel
                        ? String(paxHotel).trim()
                        : safe(order.hotel);
                    })();

                    return (
                      <React.Fragment key={order.id}>
                        {allPax.map((pax, idx) => {
                          const isMain = pax.main_passenger_id == null;
                          const isFirst = idx === 0;

                          return (
                            <tr key={pax.id} className="hover:bg-gray-50 transition-colors">
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="sticky left-0 z-10 bg-white px-4 py-3 text-sm text-center font-semibold align-top"
                                >
                                  {orderIndex + 1}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm font-medium align-top"
                                >
                                  {order.id}
                                </td>
                              )}
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`px-2 py-0.5 text-xs font-bold rounded-lg ${
                                      isMain
                                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
                                        : "bg-gray-200 text-gray-700"
                                    }`}
                                  >
                                    {isMain ? "M" : "S"}
                                  </div>
                                  <div className="font-medium text-gray-900">
                                    {safe(pax.first_name)} {safe(pax.last_name)}
                                    {isMain && (
                                      <span className="ml-1.5 inline-block px-1.5 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-700 rounded">
                                        {serialNo}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top"
                                >
                                  {order.tour ?? "N/A"}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top"
                                >
                                  {formatDate(order.departureDate ?? null)}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top font-medium"
                                >
                                  {displayHotel}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top font-medium"
                                >
                                  {displayRoomType}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top"
                                >
                                  {groupRoom}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top"
                                >
                                  {(() => {
                                    const mainPassenger =
                                      allPax.find(
                                        (p) => p.main_passenger_id == null
                                      ) || allPax[0];
                                    if (!mainPassenger?.id)
                                      return (
                                        <span className="text-gray-400">—</span>
                                      );

                                    return (
                                      <input
                                        type="text"
                                        defaultValue={mainPassenger.notes || ""}
                                        placeholder="Add note..."
                                        onBlur={async (e) => {
                                          const newNote =
                                            e.target.value.trim() || null;
                                          if (newNote === mainPassenger.notes)
                                            return;

                                          setLocalOrders((prev) =>
                                            prev.map((o) =>
                                              o.id === order.id
                                                ? {
                                                    ...o,
                                                    passengers:
                                                      o.passengers?.map((p) =>
                                                        p.id ===
                                                        mainPassenger.id
                                                          ? {
                                                              ...p,
                                                              notes: newNote,
                                                            }
                                                          : p
                                                      ),
                                                    passenger_requests:
                                                      o.passenger_requests?.map(
                                                        (p) =>
                                                          p.id ===
                                                          mainPassenger.id
                                                            ? {
                                                                ...p,
                                                                notes: newNote,
                                                              }
                                                            : p
                                                      ),
                                                  }
                                                : o
                                            )
                                          );

                                          const { error } = await supabase
                                            .from("passengers")
                                            .update({ notes: newNote })
                                            .eq("id", mainPassenger.id);

                                          if (error) {
                                            toast.error("Failed to save note");
                                            refetch();
                                          } else {
                                            toast.success("Note saved");
                                          }
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                      />
                                    );
                                  })()}
                                </td>
                              )}
                              {isFirst && (
                                <td
                                  rowSpan={allPax.length}
                                  className="px-4 py-3 text-sm align-top"
                                >
                                  <select
                                    value={order.status}
                                    onChange={(e) =>
                                      updateOrderStatus(
                                        order.id,
                                        e.target.value as OrderStatus
                                      )
                                    }
                                    className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value="pending">
                                      {t("pending")}
                                    </option>
                                    <option value="confirmed">
                                      {t("confirmed")}
                                    </option>
                                    <option value="cancelled">
                                      {t("cancelled")}
                                    </option>
                                  </select>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            {/* Mobile Card View - FIXED */}
            <div className="lg:hidden p-3 sm:p-4 space-y-3">
              {group.orders.map((order) => {
                const allPax = [
                  ...(order.passengers ?? []),
                  ...(order.passenger_requests ?? []),
                ];

                allPax.sort((a, b) =>
                  a.main_passenger_id == null
                    ? -1
                    : b.main_passenger_id == null
                    ? 1
                    : 0
                );

                const mainPax =
                  allPax.find((p) => p.main_passenger_id == null) || allPax[0];

                // SAME LOGIC AS DESKTOP
                const paxHotel = allPax
                  .map((p) => p.hotel)
                  .find((h) => h && String(h).trim() !== "");
                const displayHotel = paxHotel
                  ? String(paxHotel).trim()
                  : safe(order.hotel);

                const roomTypeFromAny = allPax
                  .map((p) => p.roomType)
                  .find((rt) => rt && String(rt).trim() !== "");
                const displayRoomType = roomTypeFromAny
                  ? String(roomTypeFromAny).trim()
                  : "—";

                const groupRoom = safe(
                  mainPax?.room_allocation ?? order.room_number
                );

                return (
                  <div
                    key={order.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs font-semibold text-gray-500">
                        #{order.id}
                      </div>
                      <select
                        value={order.status}
                        onChange={(e) =>
                          updateOrderStatus(
                            order.id,
                            e.target.value as OrderStatus
                          )
                        }
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="pending">{t("pending")}</option>
                        <option value="confirmed">{t("confirmed")}</option>
                        <option value="cancelled">{t("cancelled")}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Tour:</span>{" "}
                        {order.tour ?? "N/A"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Hotel:
                        </span>{" "}
                        {displayHotel}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Room Type:
                        </span>{" "}
                        {displayRoomType}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Room:</span>{" "}
                        {groupRoom}
                      </div>
                    </div>

                    {/* Passengers list remains the same */}
                    {allPax.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <div className="text-xs font-semibold text-gray-600 mb-1.5">
                          Passengers:
                        </div>
                        <div className="space-y-1">
                          {allPax.map((pax) => {
                            const isMain = pax.main_passenger_id == null;
                            return (
                              <div
                                key={pax.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span
                                  className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                                    isMain
                                      ? "bg-indigo-600 text-white"
                                      : "bg-gray-300 text-gray-700"
                                  }`}
                                >
                                  {isMain ? "M" : "S"}
                                </span>
                                <span>
                                  {safe(pax.first_name)} {safe(pax.last_name)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading)
    return (
      <div className="mono-card p-6 text-sm text-gray-500">
        {t("loadingOrders")}
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="mono-card p-6 text-sm text-gray-500">
        {t("noOrdersFound")}
      </div>
    );

  return (
    <div className="mono-stack">
      <div className="mono-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1">
            <input
              type="text"
              placeholder={t("searchOrders")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mono-input"
            />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mono-input sm:max-w-[220px]"
            >
              <option value="">{t("allDates")}</option>
              {uniqueDates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={exportOrdersToCSV}
            disabled={exportLoading}
            className="mono-button sm:w-auto"
          >
            {exportLoading ? t("exporting") : t("exportToCSV")}
          </button>
        </div>

        <div className="mono-divider my-4" />

        <div className="overflow-x-auto scrollbar-hide">
          <div className="mono-nav min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`mono-nav-item ${
                  activeTab === tab.id ? "mono-nav-item--active" : ""
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {visibleGroups.length === 0 ? (
          <div className="mono-card p-6 text-center text-gray-500 text-sm">
            {activeTab === "active" ? t("noActiveTours") : t("noCompletedTours")}
          </div>
        ) : (
          visibleGroups.map(renderGroup)
        )}
      </div>
    </div>
  );
};

export default OrdersTable;
