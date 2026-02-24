import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import type { Order, User as UserType } from "../types/type";
import { formatDate } from "../utils/tourUtils";
import { useNotifications } from "../hooks/useNotifications";
import { VALID_ORDER_STATUSES, type OrderStatus } from "../types/type";
import React from "react";
import { RotateCcw, ArrowUp } from "lucide-react";
import { Edit } from "lucide-react";
import EditOrderPassengersModal from "./EditOrderPassengersModal";
import { useTranslation } from "react-i18next";

const schemaCache = { orders: null as boolean | null };

interface OrdersTabProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
}

const safe = (val: any) =>
  val == null || val === "" ? "—" : String(val).trim();

const shortOrderId = (id: string) => {
  const value = String(id || "");
  return value.length > 10 ? value.slice(0, 10) : value;
};

interface TourGroup {
  tourTitle: string;
  orders: Order[];
  isCompleted: boolean;
  key: string;
}

interface DateGroup {
  date: string;
  display: string;
  tours: TourGroup[];
  key: string;
}

export default function OrdersTab({
  orders,
  setOrders,
  currentUser,
}: OrdersTabProps) {
  const { t } = useTranslation();
  const { showNotification } = useNotifications();
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [tourTitleFilter, setTourTitleFilter] = useState("");
  const [departureDateFilter, setDepartureDateFilter] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [hasShowInProvider, setHasShowInProvider] = useState<boolean | null>(
    null,
  );
  const [completingDateKey, setCompletingDateKey] = useState<string | null>(
    null,
  );
  const [undoingDateKey, setUndoingDateKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "all" | "completed">(
    "active",
  );
  const [showBackToTop, setShowBackToTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkOrdersSchema = async () => {
    if (schemaCache.orders !== null) {
      setHasShowInProvider(schemaCache.orders);
      return;
    }
    let hasColumn = false;
    try {
      const { error } = await supabase
        .from("orders")
        .select("show_in_provider")
        .limit(0);
      hasColumn = !error;
    } catch {
      hasColumn = false;
    }
    schemaCache.orders = hasColumn;
    setHasShowInProvider(hasColumn);
  };

  const getPassengerNote = (order: Order): string => {
    const allPax = [
      ...(order.passengers ?? []),
      ...(order.passenger_requests ?? []),
    ];
    const note = allPax.map((p) => p.notes).find((n) => n && n.trim() !== "");
    return note?.trim() || "";
  };

  const getMainPassengerId = (order: Order): string | null => {
    const allPax = [
      ...(order.passengers ?? []),
      ...(order.passenger_requests ?? []),
    ];
    const main = allPax.find((p) => p.main_passenger_id == null);
    return main?.id || allPax[0]?.id || null;
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
      *,
        created_by:users!created_by(id, email, username, first_name, last_name),
        passengers!order_id(
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          age,
          gender,
          passport_number,
          passport_expire,           
          date_of_birth,             
          nationality,               
          room_allocation,
          hotel,                 
          main_passenger_id,
          serial_no,
          roomType,
          notes,
          group_color,
          is_related_to_next,
          pax_type,                  
          itinerary_status,          
          has_baby_bed,
          allergy,
          emergency_phone,
          travel_group_name,
          is_traveling_with_others
        ),
        passenger_requests!order_id(
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          room_allocation,
          hotel,
          main_passenger_id,
          serial_no,
          roomType,
          notes,
          passport_number,
          passport_expire,           
          date_of_birth,
          nationality,
          gender
        ),
        tours!tour_id(id, title)
      `,
        )
        .in("status", VALID_ORDER_STATUSES);

      if (error) throw error;

      const mapped: Order[] = (data || []).map((o: any): Order => {
        const creator = o.created_by?.[0];
        return {
          id: String(o.id),
          user_id: String(o.user_id),
          tour_id: String(o.tour_id),
          phone: o.phone ?? null,
          last_name: o.last_name ?? null,
          first_name: o.first_name ?? null,
          email: o.email ?? null,
          age: o.age ?? null,
          gender: o.gender ?? null,
          tour: o.tours?.title ?? o.tour ?? null,
          passport_number: o.passport_number ?? null,
          passport_expire: o.passport_expire ?? null,
          created_by: o.created_by ? String(o.created_by) : null,
          createdBy: creator
            ? `${creator.first_name ?? ""} ${creator.last_name ?? ""} (@${
                creator.username ?? creator.email ?? ""
              })`.trim()
            : null,
          status: o.status as OrderStatus,
          hotel: o.hotel ?? null,
          payment_method: o.payment_method ?? null,
          created_at: o.created_at,
          updated_at: o.updated_at,
          passenger_count: [
            ...(o.passengers || []),
            ...(o.passenger_requests || []),
          ].length,
          departureDate: o.departureDate ?? undefined,
          total_price: Number(o.total_price) || 0,
          show_in_provider: !!o.show_in_provider,
          order_id: String(o.id),
          passengers: o.passengers || [],
          passenger_requests: o.passenger_requests || [],
          tour_title: o.tours?.title ?? undefined,
          note: o.note ?? null,

          passport_copy: null,
          passport_copy_url: null,
          commission: null,
          edited_by: null,
          edited_at: null,
          travel_choice: "",
          room_number: null,
          total_amount: 0,
          paid_amount: 0,
          balance: 0,
          booking_confirmation: null,
          room_allocation: "",
          travel_group: null,
        };
      });

      setOrders(mapped);
      showNotification("success", `Loaded ${mapped.length} orders!`);
    } catch (e: any) {
      showNotification("error", `Fetch failed: ${e.message}`);
    }
  };

  useEffect(() => {
    checkOrdersSchema();
    fetchOrders();
  }, []);
  // Fixed realtime subscription
  useEffect(() => {
    if (hasShowInProvider === null) return;
    const channel = supabase
      .channel("orders_tab")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        fetchOrders,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasShowInProvider]);

  const fetchWithRetry = async (
    fn: () => Promise<any>,
    retries = 3,
    delay = 1000,
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  };
  const updateOrder = async (id: string, updates: Partial<Order>) => {
    const prev = [...orders];
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    try {
      const payload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
        edited_by: currentUser.id,
      };
      await fetchWithRetry(async () => {
        const { error } = await supabase
          .from("orders")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      });
      showNotification("success", "Updated!");
    } catch (e: any) {
      showNotification("error", e.message || "Update failed");
      setOrders(prev);
    }
  };
  const updateRoomType = async (orderId: string, newRoomType: string) => {
    const trimmed = newRoomType.trim() || null;

    // 1. Optimistic UI update (instant feedback)
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              passengers: (ord.passengers || []).map((p: any) => ({
                ...p,
                roomType: trimmed,
              })),
              passenger_requests: (ord.passenger_requests || []).map(
                (p: any) => ({
                  ...p,
                  roomType: trimmed,
                }),
              ),
            }
          : ord,
      ),
    );

    try {
      // 2. FIND ALL PASSENGER IDs IN THIS ORDER
      const order = orders.find((o) => o.id === orderId);
      const passengerIds = [
        ...(order?.passengers ?? []),
        ...(order?.passenger_requests ?? []),
      ]
        .map((p) => p.id)
        .filter((id): id is string => !!id);

      if (passengerIds.length === 0) {
        showNotification("warning", "No passengers to update room type");
        return;
      }

      const { error } = await supabase
        .from("passengers")
        .update({
          roomType: trimmed,
          updated_at: new Date().toISOString(),
        })
        .in("id", passengerIds);

      if (error) throw error;

      showNotification("success", "Room type updated!");
    } catch (err: any) {
      showNotification("error", "Failed to save room type");
      // Rollback on error
      await fetchOrders();
    }
  };
  const updatePassengerNote = async (passengerId: string, note: string) => {
    const trimmed = note.trim() || null;
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ notes: trimmed, updated_at: new Date().toISOString() })
        .eq("id", passengerId);
      if (error) throw error;
      // Optimistically update local state
      setOrders((prev) =>
        prev.map((order) => ({
          ...order,
          passengers:
            order.passengers?.map((p) =>
              p.id === passengerId ? { ...p, notes: trimmed } : p,
            ) ?? [],
          passenger_requests:
            order.passenger_requests?.map((p) =>
              p.id === passengerId ? { ...p, notes: trimmed } : p,
            ) ?? [],
        })),
      );
      showNotification("success", "Note saved!");
    } catch (e: any) {
      showNotification("error", "Failed to save note");
    }
  };

  const handleCompleteAllInDate = async (dateKey: string) => {
    if (completingDateKey || undoingDateKey) return;
    setCompletingDateKey(dateKey);
    const dateGroup = groupedData.find((dg) => dg.key === dateKey);
    if (!dateGroup) {
      setCompletingDateKey(null);
      return;
    }
    const passengerIds: string[] = dateGroup.tours
      .flatMap((tour) =>
        tour.orders.flatMap((o) => [
          ...(o.passengers ?? []),
          ...(o.passenger_requests ?? []),
        ]),
      )
      .map((p) => p.id)
      .filter((id): id is string => id != null);
    if (passengerIds.length === 0) {
      showNotification("warning", "No passengers to complete");
      setCompletingDateKey(null);
      return;
    }
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .in("id", passengerIds);
      if (error) throw error;
      showNotification(
        "success",
        `Completed ${passengerIds.length} passengers!`,
      );
      await fetchOrders();
      setActiveTab("completed");
    } catch (e: any) {
      showNotification("error", `Failed: ${e.message}`);
    } finally {
      setCompletingDateKey(null);
    }
  };
  const handleUndoAllInDate = async (dateKey: string) => {
    if (undoingDateKey || completingDateKey) return;
    setUndoingDateKey(dateKey);
    const dateGroup = groupedData.find((dg) => dg.key === dateKey);
    if (!dateGroup) {
      setUndoingDateKey(null);
      return;
    }
    const passengerIds: string[] = dateGroup.tours
      .flatMap((tour) =>
        tour.orders.flatMap((o) => [
          ...(o.passengers ?? []),
          ...(o.passenger_requests ?? []),
        ]),
      )
      .map((p) => p.id)
      .filter((id): id is string => id != null);
    if (passengerIds.length === 0) {
      showNotification("warning", "No passengers to undo");
      setUndoingDateKey(null);
      return;
    }
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .in("id", passengerIds);
      if (error) throw error;
      showNotification(
        "success",
        `Reopened ${passengerIds.length} passengers!`,
      );
      await fetchOrders();
      setActiveTab("active");
    } catch (e: any) {
      showNotification("error", `Undo failed: ${e.message}`);
    } finally {
      setUndoingDateKey(null);
    }
  };
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const handleDeleteOrder = async (orderId: string) => {
    if (
      !confirm(
        "Are you 100% sure you want to delete this entire order?\nThis cannot be undone!",
      )
    ) {
      return;
    }
    setDeletingOrderId(orderId);
    try {
      const allPax = orders.find((o) => o.id === orderId);
      const passengerIds = [
        ...(allPax?.passengers ?? []),
        ...(allPax?.passenger_requests ?? []),
      ]
        .map((p) => p.id)
        .filter(Boolean);
      if (passengerIds.length > 0) {
        const { error: paxError } = await supabase
          .from("passengers")
          .delete()
          .in("id", passengerIds);
        if (paxError) throw paxError;
      }
      // Then delete the order
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
      // Remove from local state
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showNotification("success", "Order deleted permanently!");
    } catch (e: any) {
      showNotification("error", `Delete failed: ${e.message}`);
    } finally {
      setDeletingOrderId(null);
    }
  };
  const groupedData = useMemo(() => {
    const map: { [date: string]: DateGroup } = {};
    orders.forEach((order) => {
      const iso = order.departureDate
        ? new Date(order.departureDate).toISOString().split("T")[0]
        : "no-date";
      if (!map[iso]) {
        map[iso] = {
          date: iso,
          display: iso === "no-date" ? "No Date" : formatDate(iso),
          tours: [],
          key: iso,
        };
      }
      const tourTitle = order.tour || "Unknown Tour";
      const tourKey = `${iso}|||${tourTitle}`;
      let tour = map[iso].tours.find((t) => t.key === tourKey);
      if (!tour) {
        tour = { tourTitle, orders: [], isCompleted: false, key: tourKey };
        map[iso].tours.push(tour);
      }
      tour.orders.push(order);
      const allPax = [
        ...(order.passengers ?? []),
        ...(order.passenger_requests ?? []),
      ];
      if (
        order.status === "cancelled" ||
        (allPax.length > 0 && allPax.every((p) => p.status === "completed"))
      ) {
        tour.isCompleted = true;
      }
    });
    return Object.values(map);
  }, [orders]);

  const activeDates = groupedData
    .map((d) => ({ ...d, tours: d.tours.filter((t) => !t.isCompleted) }))
    .filter((d) => d.tours.length > 0);
  const completedDates = groupedData
    .map((d) => ({ ...d, tours: d.tours.filter((t) => t.isCompleted) }))
    .filter((d) => d.tours.length > 0);
  activeDates.sort((a, b) => a.date.localeCompare(b.date));
  completedDates.sort((a, b) => b.date.localeCompare(a.date));
  const tabs = [
    ...(activeDates.length > 0
      ? [
          {
            id: "active",
            label: "Active",
            count: activeDates.reduce(
              (s, d) => s + d.tours.reduce((ss, t) => ss + t.orders.length, 0),
              0,
            ),
          },
        ]
      : []),

    { id: "all", label: "All", count: orders.length },

    ...(completedDates.length > 0
      ? [
          {
            id: "completed",
            label: "Completed",
            count: completedDates.reduce(
              (s, d) => s + d.tours.reduce((ss, t) => ss + t.orders.length, 0),
              0,
            ),
          },
        ]
      : []),
  ];

  const visibleDateGroups = useMemo(() => {
    let list: DateGroup[] =
      activeTab === "all"
        ? departureDateFilter
          ? groupedData.filter((g) => g.date === departureDateFilter)
          : groupedData
        : activeTab === "active"
          ? activeDates
          : completedDates;
    if (customerNameFilter || tourTitleFilter) {
      const cTerm = customerNameFilter.toLowerCase();
      const tTerm = tourTitleFilter.toLowerCase();
      list = list
        .map((dg) => ({
          ...dg,
          tours: dg.tours
            .map((tg) => ({
              ...tg,
              orders: tg.orders.filter((o) => {
                const lead =
                  o.passengers?.[0] || o.passenger_requests?.[0] || o;
                const name = `${safe(lead.first_name)} ${safe(
                  lead.last_name,
                )}`.toLowerCase();
                const tour = safe(o.tour).toLowerCase();
                return (
                  (!cTerm || name.includes(cTerm)) &&
                  (!tTerm || tour.includes(tTerm))
                );
              }),
            }))
            .filter((tg) => tg.orders.length > 0),
        }))
        .filter((dg) => dg.tours.length > 0);
    }
    return list;
  }, [
    activeTab,
    departureDateFilter,
    groupedData,
    activeDates,
    completedDates,
    customerNameFilter,
    tourTitleFilter,
  ]);
  // ADD THIS FUNCTION — SUPER SIMPLE
  const getGroupColor = (orders: Order[], currentOrderIndex: number) => {
    const currentMain =
      orders[currentOrderIndex].passengers?.[0] ||
      orders[currentOrderIndex].passenger_requests?.[0];
    if (!currentMain?.is_related_to_next) return "";
    // If current is related to next → same color as previous group
    if (currentOrderIndex > 0) {
      const prevMain =
        orders[currentOrderIndex - 1].passengers?.[0] ||
        orders[currentOrderIndex - 1].passenger_requests?.[0];
      if (prevMain?.is_related_to_next) {
        return "bg-rose-100"; // or any color you want
      }
    }
    // Start of a new related chain
    const colors = [
      "bg-rose-100",
      "bg-amber-100",
      "bg-emerald-100",
      "bg-sky-100",
      "bg-purple-100",
      "bg-pink-100",
    ];
    const colorIndex = Math.floor(currentOrderIndex / 3); // every 3 orders = new color
    return colors[colorIndex % colors.length];
  };
  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setShowBackToTop(false);
  };
  return (
    <div className="mono-card overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="mono-header">
          <div>
            <h3 className="mono-title text-2xl">{t("ordersManagement")}</h3>
            <p className="mono-subtitle mt-2">
              All changes save instantly • Complete/Undo entire date
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="Customer name..."
              value={customerNameFilter}
              onChange={(e) => setCustomerNameFilter(e.target.value)}
              className="mono-input"
            />
            <input
              placeholder="Tour title..."
              value={tourTitleFilter}
              onChange={(e) => setTourTitleFilter(e.target.value)}
              className="mono-input"
            />
            <select
              value={departureDateFilter}
              onChange={(e) => setDepartureDateFilter(e.target.value)}
              className="mono-input"
            >
              <option value="">{t("allDates")}</option>
              {Array.from(new Set(orders.map((o) => o.departureDate)))
                .filter(Boolean)
                .sort()
                .map((d) => (
                  <option key={d} value={d!}>
                    {formatDate(d!)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
      <div className="border-b border-gray-200">
        <div className="px-3 py-3 overflow-x-auto scrollbar-hide">
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
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: "calc(100vh - 320px)" }}
        onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 500)}
      >
        <style>{`
          .date-group-header {
            position: sticky;
            top: 0;
            z-index: 40;
          }
          .table-header {
            position: sticky;
            top: 0px;
            z-index: 200;
          }
        `}</style>
        <table className="min-w-full mono-table mono-table--compact border-separate border-spacing-0">
          <tbody className="bg-white">
            {visibleDateGroups.map((dg) => {
              const totalOrders = dg.tours.reduce(
                (s, t) => s + t.orders.length,
                0,
              );
              const hasActive = dg.tours.some((t) => !t.isCompleted);
              const hasCompleted = dg.tours.some((t) => t.isCompleted);
              const mainTourTitle = dg.tours[0]?.tourTitle || "Unknown Tour";
              return (
                <React.Fragment key={dg.key}>
                  {/* Header — untouched */}
                  <tr>
                    <td colSpan={hasShowInProvider ? 16 : 15} className="p-0">
                      <div className="date-group-header bg-gray-100 px-3 py-4 font-semibold text-base flex items-center justify-between border-b border-gray-200">
                        <div className="flex flex-wrap items-center gap-3 text-gray-900">
                          <span className="mono-title text-base">
                            {mainTourTitle}
                          </span>
                          <span className="text-gray-400">—</span>
                          <span className="text-gray-700">
                            Departure: {dg.display}
                          </span>
                          <span className="mono-badge">
                            {totalOrders} order{totalOrders !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {hasActive && (
                            <button
                              onClick={() => handleCompleteAllInDate(dg.key)}
                              disabled={!!completingDateKey || !!undoingDateKey}
                              className="mono-button mono-button--sm"
                            >
                              {completingDateKey === dg.key
                                ? "Completing..."
                                : "Complete"}
                            </button>
                          )}
                          {hasCompleted && (
                            <button
                              onClick={() => handleUndoAllInDate(dg.key)}
                              disabled={!!undoingDateKey || !!completingDateKey}
                              className="mono-button mono-button--ghost mono-button--sm"
                            >
                              {undoingDateKey === dg.key ? (
                                "Undoing..."
                              ) : (
                                <>
                                  <RotateCcw className="w-4 h-4" /> Undo All
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr className="table-header bg-gray-50">
                    <th className="sticky left-0 z-30 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] bg-gray-50 w-14 min-w-[56px] max-w-[56px]">
                      #
                    </th>
                    <th className="sticky left-14 z-20 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] bg-gray-50 w-32 min-w-[128px] max-w-[128px]">
                      {t("orderId")}
                    </th>
                    <th className="sticky left-[142px] z-10 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] bg-gray-50 min-w-[140px]">
                      {t("lastName")}
                    </th>
                    <th className="sticky left-[282px] z-10 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] bg-gray-50 min-w-[140px]">
                      {t("firstName")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("gender")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("email")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("phone")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("price")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("payment")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("status")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("hotel")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("roomType")}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("room")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em] min-w-[320px]">
                      {t("notes")}
                    </th>
                    {hasShowInProvider && (
                      <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                        Prov
                      </th>
                    )}
                    <th className="px-12 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-[0.2em]">
                      {t("actions")}
                    </th>
                  </tr>

                  {dg.tours.length > 1 &&
                    dg.tours.slice(1).map((tour) => (
                      <tr key={tour.key}>
                        <td
                          colSpan={hasShowInProvider ? 16 : 15}
                          className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 border-b border-dashed border-gray-300"
                        >
                          Also: <strong>{tour.tourTitle}</strong> (
                          {tour.orders.length} order
                          {tour.orders.length > 1 ? "s" : ""})
                        </td>
                      </tr>
                    ))}

                  {(() => {
                    const ordersWithPassengers = dg.tours
                      .flatMap((t) => t.orders)
                      .map((order) => ({
                        ...order,
                        allPax: [
                          ...(order.passengers ?? []),
                          ...(order.passenger_requests ?? []),
                        ],
                      }));

                    return ordersWithPassengers.map((o, orderIndex) => {
                      const paxInOrder = o.allPax;
                      const mainPax =
                        paxInOrder.find((p) => p.main_passenger_id == null) ||
                        paxInOrder[0] ||
                        null;
                      const room = safe(
                        mainPax?.room_allocation ?? o.room_number,
                      );
                      const displayRoomType =
                        paxInOrder
                          .map((p) => p.roomType)
                          .find((rt) => rt?.trim())
                          ?.trim() || "";
                      const mainPassengerId = getMainPassengerId(o);
                      const isOrderLinked = paxInOrder.some(
                        (p) => p.is_related_to_next,
                      );
                      const orderColor = mainPax?.group_color || null;
                      const rowBg =
                        isOrderLinked && orderColor
                          ? `${orderColor}20`
                          : "#ffffff";
                      const rowCellStyle = { backgroundColor: rowBg } as const;

                      if (paxInOrder.length === 0) {
                        return (
                          <tr
                            key={o.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="sticky left-0 z-30 px-3 py-3 text-xs font-bold text-gray-700 bg-white border-r border-gray-200 w-14 min-w-[56px] max-w-[56px]">
                              {orderIndex + 1}
                            </td>
                            <td
                              className="sticky left-14 z-20 px-3 py-3 text-xs font-medium bg-white border-r border-gray-200 w-32 min-w-[128px] max-w-[128px] whitespace-nowrap overflow-hidden text-ellipsis"
                              title={String(o.id)}
                            >
                              #{shortOrderId(o.id)}
                            </td>
                            <td
                              colSpan={hasShowInProvider ? 14 : 13}
                              className="px-3 py-3 text-xs italic text-gray-400"
                            >
                              {t("noPassengers")}
                            </td>
                          </tr>
                        );
                      }

                      return paxInOrder.map((pax, idx, arr) => {
                        const isFirst = idx === 0;

                        return (
                          <tr
                            key={pax.id}
                            className="transition-all duration-100 relative hover:shadow-[inset_0_0_0_9999px_rgba(15,23,42,0.04)]"
                            style={{
                              backgroundColor: rowBg,
                              borderLeft:
                                isOrderLinked && orderColor
                                  ? `4px solid ${orderColor}`
                                  : "4px solid transparent",
                            }}
                          >
                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="sticky left-0 z-30 px-3 py-3 text-xs font-bold text-gray-700 border-r border-gray-200 w-14 min-w-[56px] max-w-[56px]"
                                style={rowCellStyle}
                              >
                                {orderIndex + 1}
                              </td>
                            )}
                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="sticky left-14 z-20 px-3 py-3 text-xs font-medium border-r border-gray-200 w-32 min-w-[128px] max-w-[128px] whitespace-nowrap overflow-hidden text-ellipsis"
                                style={rowCellStyle}
                                title={String(o.id)}
                              >
                                #{shortOrderId(o.id)}
                              </td>
                            )}

                            <td
                              className="sticky left-[142px] z-10 px-3 py-3 text-xs min-w-[140px] border-r border-gray-200"
                              style={rowCellStyle}
                            >
                              {safe(pax.last_name)}
                            </td>
                            <td
                              className="sticky left-[282px] z-10 px-3 py-3 text-xs font-semibold text-gray-900 min-w-[140px] border-r border-gray-200"
                              style={rowCellStyle}
                            >
                              {safe(pax.first_name)}
                            </td>
                            <td className="px-3 py-3 text-xs">
                              {safe(pax.gender)}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {safe(pax.email)}
                            </td>
                            <td className="px-3 py-3 text-xs">
                              {safe(pax.phone)}
                            </td>

                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="px-3 py-3 text-xs font-bold"
                              >
                                ${o.total_price}
                              </td>
                            )}

                            {isFirst && (
                              <td rowSpan={arr.length} className="px-4 py-3">
                                <select
                                  value={safe(o.payment_method)}
                                  onChange={(e) =>
                                    updateOrder(o.id, {
                                      payment_method: e.target.value || null,
                                    })
                                  }
                                  className="w-full min-w-[120px] px-2 py-1.5 text-xs border rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  <option>Cash</option>
                                  <option>Card</option>
                                  <option>Bank</option>
                                </select>
                              </td>
                            )}

                            {isFirst && (
                              <td rowSpan={arr.length} className="px-3 py-3">
                                <select
                                  value={o.status}
                                  onChange={(e) =>
                                    updateOrder(o.id, {
                                      status: e.target.value as OrderStatus,
                                    })
                                  }
                                  className="w-full min-w-[170px] px-2 py-1.5 text-xs border rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  {VALID_ORDER_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            )}

                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="px-3 py-3 text-xs"
                              >
                                {safe(o.hotel ?? pax.hotel)}
                              </td>
                            )}

                            {isFirst && (
                              <td rowSpan={arr.length} className="px-4 py-3">
                                <input
                                  type="text"
                                  defaultValue={displayRoomType}
                                  onBlur={(e) => {
                                    if (
                                      e.target.value.trim() !== displayRoomType
                                    ) {
                                      updateRoomType(o.id, e.target.value);
                                    }
                                  }}
                                  className="w-full min-w-[140px] px-2 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  placeholder="Twin, Single..."
                                />
                              </td>
                            )}

                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="px-3 py-3 text-xs"
                              >
                                {room}
                              </td>
                            )}

                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="px-6 py-3 align-top min-w-[320px]"
                              >
                                <textarea
                                  defaultValue={getPassengerNote(o)}
                                  onBlur={(e) => {
                                    if (!mainPassengerId) return;
                                    if (
                                      e.target.value.trim() !==
                                      getPassengerNote(o)
                                    ) {
                                      updatePassengerNote(
                                        mainPassengerId,
                                        e.target.value,
                                      );
                                    }
                                  }}
                                  className="w-full min-h-20 px-3 py-2 text-xs border border-gray-300 rounded resize-none focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                  placeholder="No note yet..."
                                  rows={4}
                                />
                              </td>
                            )}

                            {hasShowInProvider && isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="px-2 py-3 text-center"
                              >
                                <input
                                  type="checkbox"
                                  checked={o.show_in_provider}
                                  onChange={(e) =>
                                    updateOrder(o.id, {
                                      show_in_provider: e.target.checked,
                                    })
                                  }
                                />
                              </td>
                            )}

                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="px-4 py-3 text-center"
                              >
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    onClick={() => {
                                      if (
                                        (o.passengers ?? []).length === 0 &&
                                        (o.passenger_requests ?? []).length ===
                                          0
                                      ) {
                                        alert("No passengers in this order!");
                                        return;
                                      }
                                      setEditingOrder(o);
                                    }}
                                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-md"
                                    title="Edit passengers"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOrder(o.id);
                                    }}
                                    disabled={deletingOrderId === o.id}
                                    className={`w-9 h-8 rounded-lg text-white text-sm font-medium transition ${
                                      deletingOrderId === o.id
                                        ? "bg-gray-500"
                                        : "bg-red-600 hover:bg-red-700"
                                    }`}
                                  >
                                    {deletingOrderId === o.id ? "..." : "X"}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      });
                    });
                  })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {visibleDateGroups.length === 0 && (
          <div className="text-center py-20 text-gray-500 text-lg">
            {t("noOrdersMatchFilters")}
          </div>
        )}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:scale-110 transition"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        )}
      </div>

      {editingOrder && (
        <EditOrderPassengersModal
          orderId={editingOrder.id}
          passengers={[
            ...(editingOrder.passengers ?? []),
            ...(editingOrder.passenger_requests ?? []),
          ].map((p: any) => ({
            id: p.id,
            order_id: p.order_id, // шаардлагатай байж болно
            first_name: p.first_name ?? null,
            last_name: p.last_name ?? null,
            email: p.email ?? null,
            phone: p.phone ?? null,
            passport_number: p.passport_number ?? null,
            passport_expire: p.passport_expire ?? null,
            date_of_birth: p.date_of_birth ?? null,
            gender: p.gender ?? null,
            nationality: p.nationality ?? "Mongolia",
            hotel: p.hotel ?? null,
            roomType: p.roomType ?? null,
            pax_type: p.pax_type ?? null,
            itinerary_status: p.itinerary_status ?? "No itinerary",
            allergy: p.allergy ?? null,
            notes: p.notes ?? null,
            has_baby_bed: p.has_baby_bed ?? false,
            group_color: p.group_color ?? null,
            main_passenger_id: p.main_passenger_id ?? null,
            is_related_to_next: p.is_related_to_next ?? false,
            serial_no: p.serial_no ?? null,
            room_allocation: p.room_allocation ?? null,
            emergency_phone: p.emergency_phone ?? null,
            travel_group_name: p.travel_group_name ?? null,
            is_traveling_with_others: p.is_traveling_with_others ?? false,
          }))}
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={() => {
            fetchOrders();
            showNotification("success", "Passengers updated successfully!");
          }}
        />
      )}
    </div>
  );
}
