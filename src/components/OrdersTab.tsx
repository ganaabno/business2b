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
import {
  fetchOrdersFromGlobalApi,
  isGlobalApiEnabled,
} from "../api/globalTravel";
import { syncGlobalPriceRowCanonical } from "../api/b2b";

const schemaCache = { orders: null as boolean | null };
const ordersFetchCache = { lastFetchAt: 0 };

interface OrdersTabProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
}

const safe = (val: any) =>
  val == null || val === "" ? "—" : String(val).trim();

const normalizeOrderStatus = (value: unknown): OrderStatus => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "pending";

  const exact = VALID_ORDER_STATUSES.find((status) => status === normalized);
  if (exact) return exact;

  const lower = normalized.toLowerCase();
  const ci = VALID_ORDER_STATUSES.find(
    (status) => status.toLowerCase() === lower,
  );
  if (ci) return ci;

  if (lower === "paid" || lower === "success") return "confirmed";
  if (lower === "failed" || lower === "declined") return "rejected";
  return "pending";
};

const shortOrderId = (id: string) => {
  const value = String(id || "");
  return value.length > 10 ? value.slice(0, 10) : value;
};

const sourceBadgeClass = (source?: Order["source"]) =>
  source === "global"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-gray-100 text-gray-700 border-gray-200";

const sourceLabel = (source?: Order["source"]) =>
  source === "global" ? "Global" : "Local";

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
  const [sourceFilter, setSourceFilter] = useState<"all" | "global" | "local">(
    "all",
  );
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [hasShowInProvider, setHasShowInProvider] = useState<boolean | null>(
    null,
  );
  const [completingDateKey, setCompletingDateKey] = useState<string | null>(
    null,
  );
  const [undoingDateKey, setUndoingDateKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "all" | "completed">(
    "all",
  );
  const [showBackToTop, setShowBackToTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFetchAtRef = useRef<number>(ordersFetchCache.lastFetchAt);

  const shouldSkipFetch = (force = false) => {
    if (force) return false;
    const now = Date.now();
    if (now - lastFetchAtRef.current < 15000) {
      return true;
    }
    return false;
  };

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

  const hasOrderPassengers = (order: Order) => {
    const paxCount =
      (order.passengers?.length || 0) + (order.passenger_requests?.length || 0);
    return paxCount > 0;
  };

  const mapLocalOrders = (rows: any[]): Order[] => {
    return (rows || []).map((o: any): Order => {
      const creator = o.created_by?.[0];
      return {
        source: "local",
        id: String(o.id),
        user_id: String(o.user_id),
        tour_id: String(o.tour_id),
        phone: o.phone ?? null,
        last_name: o.last_name ?? null,
        first_name: o.first_name ?? null,
        email: o.email ?? null,
        age: o.age ?? null,
        gender: o.gender ?? null,
        tour: o.tours?.title ?? o.tour ?? o.travel_choice ?? null,
        passport_number: o.passport_number ?? null,
        passport_expire: o.passport_expire ?? null,
        created_by: o.created_by ? String(o.created_by) : null,
        createdBy: creator
          ? `${creator.first_name ?? ""} ${creator.last_name ?? ""} (@${
              creator.username ?? creator.email ?? ""
            })`.trim()
          : null,
        status: normalizeOrderStatus(o.status),
        hotel: o.hotel ?? null,
        payment_method: o.payment_method ?? null,
        created_at: o.created_at,
        updated_at: o.updated_at,
        passenger_count: [
          ...(o.passengers || []),
          ...(o.passenger_requests || []),
        ].length,
        departureDate: o.departureDate ?? o.departure_date ?? undefined,
        total_price: Number(o.total_price) || Number(o.amount) || 0,
        show_in_provider: !!o.show_in_provider,
        order_id: String(o.order_id ?? o.id),
        passengers: o.passengers || [],
        passenger_requests: o.passenger_requests || [],
        tour_title: o.tours?.title ?? o.travel_choice ?? undefined,
        note: o.note ?? null,
        passport_copy: null,
        passport_copy_url: null,
        commission: null,
        edited_by: null,
        edited_at: null,
        travel_choice: o.travel_choice || "",
        room_number: null,
        total_amount: 0,
        paid_amount: 0,
        balance: 0,
        booking_confirmation: null,
        room_allocation: "",
        travel_group: null,
      };
    });
  };

  const fetchLocalOrders = async (): Promise<Order[]> => {
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
      .order("created_at", { ascending: false });

    if (error) throw error;
    return mapLocalOrders(data || []).filter(hasOrderPassengers);
  };

  const fetchOrders = async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = opts?.force ?? false;
    const silent = opts?.silent ?? true;
    if (shouldSkipFetch(force)) return;

    try {
      if (isGlobalApiEnabled) {
        const [globalResult, localResult] = await Promise.allSettled([
          fetchOrdersFromGlobalApi(),
          fetchLocalOrders(),
        ]);

        const globalOrders =
          globalResult.status === "fulfilled" ? globalResult.value : [];
        const localOrders =
          localResult.status === "fulfilled" ? localResult.value : [];

        const mergedById = new Map<string, Order>();
        localOrders.forEach((order) => {
          mergedById.set(`local:${String(order.id)}`, order);
        });
        globalOrders.forEach((order) => {
          const key = `global:${String(order.id || order.order_id)}`;
          if (!mergedById.has(key)) {
            mergedById.set(key, { ...order, source: "global" });
          }
        });

        const finalOrders = Array.from(mergedById.values()).filter((order) => {
          if (order.source === "global") return true;
          return hasOrderPassengers(order);
        });
        setOrders(finalOrders);
        lastFetchAtRef.current = Date.now();
        ordersFetchCache.lastFetchAt = lastFetchAtRef.current;

        if (!silent) {
          showNotification(
            "success",
            `Orders loaded (local: ${localOrders.length}, global: ${globalOrders.length})`,
          );
        }
        return;
      }
      const mapped = await fetchLocalOrders();
      setOrders(mapped);
      lastFetchAtRef.current = Date.now();
      ordersFetchCache.lastFetchAt = lastFetchAtRef.current;
      if (!silent) {
        showNotification("success", `Loaded ${mapped.length} orders!`);
      }
    } catch (e: any) {
      if (isGlobalApiEnabled) {
        if (!silent) {
          showNotification(
            "warning",
            "Shared API unavailable, falling back to local data source.",
          );
        }
        try {
          const mapped = await fetchLocalOrders();
          setOrders(mapped);
          lastFetchAtRef.current = Date.now();
          ordersFetchCache.lastFetchAt = lastFetchAtRef.current;
          return;
        } catch {
          showNotification("error", `Fetch failed: ${e.message}`);
          return;
        }
      }

      showNotification("error", `Fetch failed: ${e.message}`);
    }
  };

  useEffect(() => {
    checkOrdersSchema();
    setOrders((prev) =>
      prev.filter(
        (order) => order.source === "global" || hasOrderPassengers(order),
      ),
    );
    fetchOrders({ force: false, silent: true });
    if (orders.length === 0) {
      fetchOrders({ force: true, silent: false });
    }
  }, []);
  // Fixed realtime subscription
  useEffect(() => {
    if (hasShowInProvider === null) return;
    const channel = supabase
      .channel("orders_tab")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders({ silent: true });
        },
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

  const syncGlobalSeatsAfterOrderMutation = async (
    tourId?: string | null,
    departureDate?: string | null,
  ) => {
    const localTourId = String(tourId || "").trim();
    const normalizedDate = String(departureDate || "")
      .trim()
      .slice(0, 10);

    if (!localTourId || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return;
    }

    try {
      await syncGlobalPriceRowCanonical({
        localTourId,
        departureDate: normalizedDate,
      });
    } catch (error) {
      console.warn("OrdersTab: Global seat sync failed after mutation", {
        localTourId,
        departureDate: normalizedDate,
        error,
      });
    }
  };

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

      await syncGlobalSeatsAfterOrderMutation(
        String(allPax?.tour_id || "").trim() || null,
        allPax?.departureDate || null,
      );

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

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      const preferred = tabs[0]?.id as
        | "active"
        | "all"
        | "completed"
        | undefined;
      if (preferred) {
        setActiveTab(preferred);
      }
    }
  }, [tabs, activeTab]);

  const visibleDateGroups = useMemo(() => {
    let list: DateGroup[] =
      activeTab === "all"
        ? departureDateFilter
          ? groupedData.filter((g) => g.date === departureDateFilter)
          : groupedData
        : activeTab === "active"
          ? activeDates
          : completedDates;
    if (customerNameFilter || tourTitleFilter || sourceFilter !== "all") {
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
                const src = (o.source ?? "local") as "local" | "global";
                return (
                  (!cTerm || name.includes(cTerm)) &&
                  (!tTerm || tour.includes(tTerm)) &&
                  (sourceFilter === "all" || src === sourceFilter)
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
    sourceFilter,
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
    <div className="saas-table-wrapper">
       {/* Table Header — structured section with filters */}
       <div className="saas-table-header flex-wrap gap-3">
         <div className="flex flex-col sticky top-[64px] z-999">
           <div className="flex items-center gap-2 mb-0.5">
             <span
               className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
               style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}
             >
               Orders
             </span>
             <span
               className="text-[10px] font-medium px-2 py-0.5 rounded-full"
               style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-soft)', border: '1px solid var(--mono-border)' }}
             >
               Auto-save
             </span>
           </div>
           <h3
             className="text-base font-bold"
             style={{ color: 'var(--mono-text)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}
           >
             {t("ordersManagement")}
           </h3>
           <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-soft)' }}>
             All changes save instantly · Complete/Undo entire date group · MODIFIED
           </p>
         </div>
         <div className="flex flex-wrap gap-2 items-center ml-auto sticky top-[64px] z-999">
           <input
             placeholder="Customer name..."
             value={customerNameFilter}
             onChange={(e) => setCustomerNameFilter(e.target.value)}
             className="mono-input mono-input--sm"
             style={{ width: '150px' }}
           />
           <input
             placeholder="Tour title..."
             value={tourTitleFilter}
             onChange={(e) => setTourTitleFilter(e.target.value)}
             className="mono-input mono-input--sm"
             style={{ width: '140px' }}
           />
           <select
             value={departureDateFilter}
             onChange={(e) => setDepartureDateFilter(e.target.value)}
             className="mono-input mono-input--sm"
             style={{ width: '150px' }}
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
           <select
             value={sourceFilter}
             onChange={(e) =>
               setSourceFilter(e.target.value as "all" | "global" | "local")
             }
             className="mono-input mono-input--sm"
             style={{ width: '130px' }}
           >
             <option value="all">All Sources</option>
             <option value="global">Global Travel</option>
             <option value="local">Local Gtrip</option>
           </select>
         </div>
       </div>
       {/* Tab bar */}
       <div
         style={{ borderBottom: '1.5px solid var(--mono-border)', background: 'var(--mono-surface)' }}
       >
         <div className="px-4 py-2.5 overflow-x-auto sticky top-[112px] z-999">
          <div className="flex items-center gap-1 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={
                  activeTab === tab.id
                    ? {
                        background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(29,78,216,0.25)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--mono-text-muted)',
                        border: '1px solid transparent',
                      }
                }
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--mono-border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }
                }}
              >
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--mono-surface-muted)',
                    color: activeTab === tab.id ? '#fff' : 'var(--mono-text-soft)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
       <div
         ref={containerRef}
         className="overflow-auto"
         style={{ maxHeight: "calc(100vh - 200px)" }}
         onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 300)}
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
                  {/* Date Group Header — elevated with tour info */}
                  <tr>
                    <td colSpan={hasShowInProvider ? 16 : 15} className="p-0">
                      <div
                        className="date-group-header px-4 py-3 flex items-center justify-between"
                        style={{
                          background: 'linear-gradient(135deg, var(--mono-surface-muted), var(--mono-bg-strong))',
                          borderTop: '2px solid var(--mono-border)',
                          borderBottom: '1.5px solid var(--mono-border)',
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-sm font-bold"
                            style={{ color: 'var(--mono-text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                          >
                            {mainTourTitle}
                          </span>
                          <span style={{ color: 'var(--mono-border-strong)' }}>·</span>
                          <span className="departure-badge">
                            {dg.display}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8', border: '1px solid rgba(29,78,216,0.15)' }}
                          >
                            {totalOrders} order{totalOrders !== 1 ? "s" : ""}
                          </span>
                          {hasCompleted && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'rgba(20,184,166,0.1)', color: '#0f766e', border: '1px solid rgba(20,184,166,0.2)' }}
                            >
                              Completed
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {hasActive && (
                            <button
                              onClick={() => handleCompleteAllInDate(dg.key)}
                              disabled={!!completingDateKey || !!undoingDateKey}
                              className="btn-teal"
                              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                            >
                              {completingDateKey === dg.key
                                ? "Completing..."
                                : "Mark Complete"}
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
                                  <RotateCcw className="w-3.5 h-3.5" /> Undo All
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Sticky table column headers */}
                  <tr className="table-header" style={{ background: 'var(--mono-surface-muted)' }}>
                    <th className="sticky left-0 z-30 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] w-14 min-w-14 max-w-[56px]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      #
                    </th>
                    <th className="sticky left-14 z-20 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] w-32 min-w-32 max-w-[128px]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("orderId")}
                    </th>
                    <th className="sticky left-35.5 z-10 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] min-w-35" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("lastName")}
                    </th>
                    <th className="sticky left-70.5 z-10 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] min-w-35" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("firstName")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("gender")}
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("email")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("phone")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("price")}
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("payment")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("status")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("hotel")}
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("roomType")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("room")}
                    </th>
                    <th className="px-6 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] min-w-[320px]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                      {t("notes")}
                    </th>
                    {hasShowInProvider && (
                      <th className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)', borderRight: '1px solid var(--mono-border)' }}>
                        Prov
                      </th>
                    )}
                    <th className="px-12 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--mono-surface-muted)', color: 'var(--mono-text-muted)', borderBottom: '1.5px solid var(--mono-border-strong)' }}>
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
                        const isGlobalOrder = o.source === "global";
                        const globalSummary = isGlobalOrder
                          ? `Global order summary • ${safe(o.tour || o.tour_title)} • ${o.passenger_count || 0} pax • ${safe(o.payment_method)} • ${safe(o.status)}`
                          : t("noPassengers");

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
                              <div className="flex flex-col gap-1">
                                <span>#{shortOrderId(o.id)}</span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold w-fit ${sourceBadgeClass(
                                    o.source,
                                  )}`}
                                >
                                  {sourceLabel(o.source)}
                                </span>
                              </div>
                            </td>
                            <td
                              colSpan={hasShowInProvider ? 14 : 13}
                              className={`px-3 py-3 text-xs italic ${
                                isGlobalOrder
                                  ? "text-emerald-700"
                                  : "text-gray-400"
                              }`}
                            >
                              {globalSummary}
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
                                className="sticky left-0 z-30 px-3 py-3 text-xs font-bold w-14 min-w-14 max-w-14"
                                style={{ ...rowCellStyle, borderRight: '1px solid var(--mono-border)', color: 'var(--mono-text-muted)' }}
                              >
                                {orderIndex + 1}
                              </td>
                            )}
                            {isFirst && (
                              <td
                                rowSpan={arr.length}
                                className="sticky left-14 z-20 px-3 py-3 text-xs font-medium w-32 min-w-32 max-w-32 whitespace-nowrap overflow-hidden text-ellipsis"
                                style={{ ...rowCellStyle, borderRight: '1px solid var(--mono-border)' }}
                                title={String(o.id)}
                              >
                                <div className="flex flex-col gap-1.5">
                                  <span className="font-bold" style={{ color: 'var(--mono-text)' }}>#{shortOrderId(o.id)}</span>
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold w-fit ${sourceBadgeClass(
                                      o.source,
                                    )}`}
                                  >
                                    {sourceLabel(o.source)}
                                  </span>
                                </div>
                              </td>
                            )}

                            <td
                              className="sticky left-35.5 z-10 px-3 py-3 text-xs min-w-35 border-r border-gray-200"
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
                                  disabled={o.source === "global"}
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
                                  disabled={o.source === "global"}
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
                                  disabled={o.source === "global"}
                                  onBlur={(e) => {
                                    if (o.source === "global") return;
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
                                  disabled={o.source === "global"}
                                  onBlur={(e) => {
                                    if (o.source === "global") return;
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
                                  disabled={o.source === "global"}
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
                                      if (o.source === "global") {
                                        showNotification(
                                          "warning",
                                          "Global orders are read-only on Gtrip. Edit from Global Travel admin.",
                                        );
                                        return;
                                      }
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
                                      if (o.source === "global") {
                                        showNotification(
                                          "warning",
                                          "Global orders are read-only on Gtrip.",
                                        );
                                        return;
                                      }
                                      handleDeleteOrder(o.id);
                                    }}
                                    disabled={
                                      deletingOrderId === o.id ||
                                      o.source === "global"
                                    }
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
