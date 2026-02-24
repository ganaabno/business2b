import { useState, useEffect, useRef, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../supabaseClient";
import type {
  Order,
  Tour,
  User as UserType,
  Passenger,
  OrderStatus,
} from "../types/type";
import { useTranslation } from "react-i18next";
import DashboardHeader from "../Pages/ProviderInterfaceComponents/Dashboardheader";
import StatsCards from "./ProviderInterfaceComponents/StatsCards";
import OrdersTable from "../Pages/ProviderInterfaceComponents/Orderstable";
import BookingConfirmationTab from "../Pages/ProviderInterfaceComponents/BookingConfirmation";
import AddTourTab from "../components/AddTourTab";
import { Users, CheckCircle, Settings, Edit, Globe } from "lucide-react";
import PassengerTable from "../components/PassengerTable";

const schemaCache = {
  tours: null as boolean | null,
  orders: null as boolean | null,
};

interface ProviderInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
}

interface RawOrder {
  id: number | string;
  user_id: number | string;
  tour_id: number | string;
  phone?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  tour?: string | null;
  passport_number?: string | null;
  passport_expire?: string | null;
  passport_copy?: string | null;
  commission?: number | null;
  created_by?: string | number | null;
  edited_by?: string | number | null;
  edited_at?: string | null;
  travel_choice?: string;
  status: string;
  hotel?: string | null;
  room_number?: string | null;
  payment_method?: string | null;
  created_at: string;
  updated_at: string;
  departureDate?: string | null;
  total_price: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  show_in_provider?: boolean;
  createdBy?: string | null;
  passengers?: Passenger[] | null;
  users?: { email?: string | null } | null;
  booking_confirmations?: {
    id?: string;
    order_id: string;
    bus_number: string | null;
    guide_name: string | null;
    weather_emergency: string | null;
    updated_by: string | null;
    updated_at: string | null;
  } | null;
  passenger_requests?: Passenger[] | null;
}

function ProviderInterface({
  tours,
  setTours,
  currentUser,
}: ProviderInterfaceProps) {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasShowInProviderTours, setHasShowInProviderTours] = useState<
    boolean | null
  >(null);
  const [hasShowInProviderOrders, setHasShowInProviderOrders] = useState<
    boolean | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "orders" | "tours" | "booking" | "addTour" | "passengers"
  >("orders");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasFetchedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  // Language toggle
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "zh" : "en");
  };

  // Close mobile menu when tab changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchTerm]);

  // Fetch with retry logic
  const fetchWithRetry = async (
    fn: () => Promise<any>,
    retries = 3,
    delay = 1000,
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  };

  // Refresh Supabase session
  const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      toast.error(t("failedToRefreshSchema"));
    }
    return data.session;
  };

  const checkOrdersSchema = async () => {
    if (schemaCache.orders !== null) {
      setHasShowInProviderOrders(schemaCache.orders);
      return;
    }
    let hasColumn = false;
    try {
      const { data: rpcData, error: rpcError } = await fetchWithRetry(
        async () => supabase.rpc("get_table_columns", { table_name: "orders" }),
      );
      if (rpcError) throw rpcError;
      hasColumn =
        Array.isArray(rpcData) &&
        rpcData.some((col: any) => col.column_name === "show_in_provider");
    } catch (rpcError) {
      try {
        const { data: schemaData, error: schemaError } = await fetchWithRetry(
          async () =>
            supabase
              .from("information_schema.columns")
              .select("column_name")
              .eq("table_schema", "public")
              .eq("table_name", "orders")
              .eq("column_name", "show_in_provider"),
        );
        if (schemaError) throw schemaError;
        hasColumn = schemaData.length > 0;
      } catch (schemaError) {
        toast.error(t("failedToVerifyOrdersSchema"));
        return;
      }
    }
    schemaCache.orders = hasColumn;
    setHasShowInProviderOrders(hasColumn);
  };

  const checkToursSchema = async () => {
    if (schemaCache.tours !== null) {
      setHasShowInProviderTours(schemaCache.tours);
      return;
    }
    let hasColumn = false;
    try {
      const { data: rpcData, error: rpcError } = await fetchWithRetry(
        async () => supabase.rpc("get_table_columns", { table_name: "tours" }),
      );
      if (rpcError) throw rpcError;
      hasColumn =
        Array.isArray(rpcData) &&
        rpcData.some((col: any) => col.column_name === "show_in_provider");
    } catch (rpcError) {
      try {
        const { data: schemaData, error: schemaError } = await fetchWithRetry(
          async () =>
            supabase
              .from("information_schema.columns")
              .select("column_name")
              .eq("table_schema", "public")
              .eq("table_name", "tours")
              .eq("column_name", "show_in_provider"),
        );
        if (schemaError) throw schemaError;
        hasColumn = schemaData.length > 0;
      } catch (schemaError) {
        toast.error(t("failedToVerifyToursSchema"));
        return;
      }
    }
    schemaCache.tours = hasColumn;
    setHasShowInProviderTours(hasColumn);
  };

  const fetchOrders = async () => {
    if (hasShowInProviderOrders === null) return;
    setLoading(true);

    const selectString = `
  id,
  user_id,
  tour_id,
  phone,
  last_name,
  first_name,
  email,
  age,
  gender,
  tour,
  passport_number,
  passport_expire,
  passport_copy,
  commission,
  created_by,
  edited_by,
  edited_at,
  travel_choice,
  status,
  hotel,
  room_number,
  payment_method,
  created_at,
  updated_at,
  departureDate,
  total_price,
  total_amount,
  paid_amount,
  balance,
  show_in_provider,
  createdBy,
  passengers!order_id(
    id,
    first_name,
    last_name,
    age,
    date_of_birth,
    gender,
    passport_number,
    passport_expire,
    nationality,
    notes,
    booking_number,
    roomType,
    room_allocation,
    status,
    hotel,
    serial_no,      
    main_passenger_id,
    itinerary_status,
    pax_type,
    passport_upload,
    has_baby_bed,
    is_related_to_next,
    group_color
  ),
  users!created_by(email),
  booking_confirmations(
    id,
    bus_number,
    guide_name,
    weather_emergency,
    updated_by,
    updated_at
  ),
  tours!tour_id(title)
`;

    let query = supabase
      .from("orders")
      .select(selectString)
      .in("status", ["confirmed", "pending"]);

    if (hasShowInProviderOrders) {
      query = query.eq("show_in_provider", true);
    }

    const mapToOrders = (
      rawData: any[],
      includeCreatorEmail: boolean,
    ): Order[] => {
      return rawData.map((order: any) => {
        const creatorEmail = includeCreatorEmail
          ? (order.users?.email ?? null)
          : null;

        return {
          id: String(order.id),
          user_id: String(order.user_id ?? ""),
          tour_id: String(order.tour_id ?? ""),
          phone: order.phone ?? null,
          last_name: order.last_name ?? null,
          first_name: order.first_name ?? null,
          email: order.email ?? null,
          age: order.age ?? null,
          gender: order.gender ?? null,
          tour: order.tours?.title?.trim() || order.tour?.trim() || "",
          passport_number: order.passport_number ?? null,
          passport_expire: order.passport_expire ?? null,
          passport_copy: order.passport_copy ?? null,
          commission: order.commission ?? null,
          created_by: order.created_by ? String(order.created_by) : null,
          edited_by: order.edited_by ? String(order.edited_by) : null,
          edited_at: order.edited_at ?? null,
          travel_choice: order.travel_choice ?? "",
          status: order.status as OrderStatus,
          hotel: order.hotel ?? null,
          room_number: order.room_number ?? null,
          payment_method: order.payment_method ?? null,
          created_at: order.created_at ?? "",
          updated_at: order.updated_at ?? "",
          departureDate: order.departureDate ?? "",
          createdBy:
            creatorEmail ??
            order.createdBy ??
            (order.created_by ? String(order.created_by) : "Unknown"),
          total_price: Number(order.total_price) || 0,
          total_amount: Number(order.total_amount) || 0,
          paid_amount: Number(order.paid_amount) || 0,
          balance: Number(order.balance) || 0,
          show_in_provider: hasShowInProviderOrders
            ? !!order.show_in_provider
            : true,
          order_id: String(order.id),
          passenger_count:
            (order.passengers?.length ?? 0) || (order.first_name ? 1 : 0),
          booking_confirmation: order.booking_confirmations
            ? {
                order_id: String(order.id),
                bus_number: order.booking_confirmations.bus_number ?? null,
                guide_name: order.booking_confirmations.guide_name ?? null,
                weather_emergency:
                  order.booking_confirmations.weather_emergency ?? null,
                updated_by: order.booking_confirmations.updated_by ?? null,
                updated_at: order.booking_confirmations.updated_at ?? null,
              }
            : null,
          passport_copy_url: null,
          passengers:
            order.passengers?.map((p: any) => ({
              id: p.id,
              first_name: p.first_name || "N/A",
              last_name: p.last_name || "",
              date_of_birth: p.date_of_birth || null,
              gender: p.gender || null,
              passport_number: p.passport_number || null,
              passport_expire: p.passport_expire || null,
              nationality: p.nationality || "Mongolia",
              notes: p.notes || null,
              booking_number: p.booking_number
                ? String(p.booking_number)
                : null,
              roomType: p.roomType || null,
              room_allocation: p.room_allocation || null,
              status: (p.status as "active" | "completed") || "active",
              hotel: p.hotel || null,
              serial_no: p.serial_no || null,
              main_passenger_id: p.main_passenger_id || null,
              pax_type: p.pax_type || "Adult",
              itinerary_status: p.itinerary_status || "No itinerary",
              passport_upload: p.passport_upload || null,
              has_baby_bed: p.has_baby_bed || false,
              group_color: p.group_color ?? null,
              is_related_to_next: p.is_related_to_next ?? false,
            })) ?? [],
          room_allocation: order.room_number ?? "",
        } as Order;
      });
    };

    try {
      const { data, error } = await fetchWithRetry(async () => await query);

      if (error) throw error;

      if (data && data.length > 0) {
        const ordersWithTotals = mapToOrders(data, true);
        setOrders(ordersWithTotals);
        return;
      }

      toast.warn(t("partialDataLoaded"));

      const fallbackQuery = supabase
        .from("orders")
        .select(selectString.replace(", users!created_by(email)", ""))
        .in("status", ["confirmed", "pending"]);

      if (hasShowInProviderOrders) {
        fallbackQuery.eq("show_in_provider", true);
      }

      const { data: fallbackData, error: fallbackError } = await fetchWithRetry(
        async () => await fallbackQuery,
      );

      if (fallbackError) throw fallbackError;

      const ordersWithTotals = mapToOrders(fallbackData || [], false);
      setOrders(ordersWithTotals);
    } catch (error: any) {
      toast.error(t("failedToFetchOrders"));
    } finally {
      setLoading(false);
    }
  };

  // REFETCH FUNCTION — CRITICAL FOR PassengerTable
  const refetch = useCallback(() => {
    fetchOrders();
  }, [hasShowInProviderOrders]);

  const fetchCreatorEmails = async () => {
    try {
      const toursWithEmails = await Promise.all(
        tours.map(async (tour) => {
          if (tour.created_by && !tour.creator_name) {
            const { data, error } = await fetchWithRetry(async () =>
              supabase
                .from("users")
                .select("email")
                .eq("id", tour.created_by)
                .single(),
            );
            return {
              ...tour,
              creator_name: error
                ? "Unknown Creator"
                : data.email || "Unknown Creator",
            };
          }
          return tour;
        }),
      );
      setTours(toursWithEmails);
    } catch (error) {
      toast.error(t("failedToFetchCreatorEmails"));
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const initialize = async () => {
      await Promise.all([checkOrdersSchema(), checkToursSchema()]);
      await fetchOrders();
      if (tours.some((tour) => !tour.creator_name)) {
        await fetchCreatorEmails();
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const interval = setInterval(
      async () => {
        await refreshSession();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error(t("loginForRealTime"));
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (
      hasShowInProviderOrders !== null &&
      hasShowInProviderOrders &&
      orders.length === 0
    ) {
      fetchOrders();
    }
  }, [hasShowInProviderOrders]);

  useEffect(() => {
    if (hasShowInProviderOrders === null || hasShowInProviderTours === null)
      return;

    const setupSubscriptions = () => {
      const statuses = ["confirmed", "pending"];
      const channels: any[] = [];

      statuses.forEach((status) => {
        const filter = hasShowInProviderOrders
          ? `status=eq.${status},show_in_provider=eq.true`
          : `status=eq.${status}`;
        const channel = supabase
          .channel(
            `provider_orders_${status}_${Math.random()
              .toString(36)
              .substring(2)}`,
          )
          .on(
            "postgres_changes" as any,
            {
              event: "*",
              schema: "public",
              table: "orders",
              select: `
                id,
                user_id,
                tour_id,
                phone,
                last_name,
                first_name,
                email,
                age,
                gender,
                tour,
                passport_number,
                passport_expire,
                passport_copy,
                commission,
                created_by,
                edited_by,
                edited_at,
                travel_choice,
                status,
                hotel,
                room_number,
                payment_method,
                created_at,
                updated_at,
                departureDate,
                total_price,
                total_amount,
                paid_amount,
                balance,
                show_in_provider,
                createdBy,
                passengers!order_id(
                id,
                first_name,
                last_name,
                age,
                date_of_birth,
                gender,
                passport_number,
                passport_expire,
                nationality,
                notes,
                booking_number,
                roomType,
                room_allocation,status),
                users!created_by(email),
                booking_confirmations(
                id,
                bus_number,
                guide_name,
                weather_emergency,
                updated_by,
                updated_at,
                hotel,
                serial_no,
                main_passenger_id,
                passport_upload,
                has_baby_bed,
                is_related_to_next,
                group_color
                )
              `,
              filter,
            },
            (payload) => {
              if (payload.eventType === "UPDATE") {
                if (
                  hasShowInProviderOrders &&
                  payload.new.show_in_provider === false
                ) {
                  setOrders((prev) =>
                    prev.filter((order) => order.id !== String(payload.new.id)),
                  );
                } else {
                  setOrders((prev) => {
                    const updatedOrders = prev.map((order) =>
                      order.id === String(payload.new.id)
                        ? ({
                            ...order,
                            ...payload.new,
                            id: String(payload.new.id),
                            user_id: String(payload.new.user_id),
                            tour_id: String(payload.new.tour_id),
                            created_by: payload.new.created_by
                              ? String(payload.new.created_by)
                              : null,
                            edited_by: payload.new.edited_by
                              ? String(payload.new.edited_by)
                              : null,
                            passenger_count:
                              payload.new.passengers?.length ||
                              (payload.new.first_name ? 1 : 0),
                            total_amount: payload.new.total_amount,
                            total_price: payload.new.total_price,
                            paid_amount: payload.new.paid_amount,
                            balance: payload.new.balance,
                            show_in_provider: hasShowInProviderOrders
                              ? (payload.new.show_in_provider ?? true)
                              : true,
                            createdBy:
                              payload.new.users?.email ??
                              payload.new.createdBy ??
                              (payload.new.created_by
                                ? String(payload.new.created_by)
                                : null),
                            departureDate: payload.new.departureDate ?? "",
                            order_id: String(payload.new.id),
                            booking_confirmation: payload.new
                              .booking_confirmations
                              ? {
                                  order_id: String(payload.new.id),
                                  bus_number:
                                    payload.new.booking_confirmations
                                      .bus_number ?? null,
                                  guide_name:
                                    payload.new.booking_confirmations
                                      .guide_name ?? null,
                                  weather_emergency:
                                    payload.new.booking_confirmations
                                      .weather_emergency ?? null,
                                  updated_by:
                                    payload.new.booking_confirmations
                                      .updated_by ?? null,
                                  updated_at:
                                    payload.new.booking_confirmations
                                      .updated_at ?? null,
                                }
                              : null,
                            passport_copy_url: null,
                            passengers:
                              payload.new.passengers?.map((p: any) => ({
                                id: p.id,
                                first_name: p.first_name || "N/A",
                                last_name: p.last_name || "",
                                date_of_birth: p.date_of_birth || null,
                                gender: p.gender || null,
                                passport_number: p.passport_number || null,
                                passport_expire: p.passport_expire || null,
                                nationality: p.nationality || "Mongolia",
                                notes: p.notes || null,
                                booking_number: p.booking_number
                                  ? String(p.booking_number)
                                  : null,
                                roomType: p.roomType || null,
                                room_allocation: p.room_allocation || null,
                                status:
                                  (p.status as "active" | "completed") ||
                                  "active",
                                hotel: p.hotel || null,
                                serial_no: p.serial_no || null,
                                main_passenger_id: p.main_passenger_id || null,
                                pax_type: p.pax_type || "Adult",
                                itinerary_status:
                                  p.itinerary_status || "No itinerary",
                                passport_upload: p.passport_upload || null,
                                has_baby_bed: p.has_baby_bed || false,
                              })) ?? [],
                          } as Order)
                        : order,
                    );
                    return updatedOrders;
                  });
                }
              } else if (payload.eventType === "INSERT") {
                if (
                  ["confirmed", "pending"].includes(payload.new.status) &&
                  (!hasShowInProviderOrders || payload.new.show_in_provider)
                ) {
                  setOrders((prev) => [
                    ...prev,
                    {
                      id: String(payload.new.id),
                      user_id: String(payload.new.user_id),
                      tour_id: String(payload.new.tour_id),
                      phone: payload.new.phone ?? null,
                      last_name: payload.new.last_name ?? null,
                      first_name: payload.new.first_name ?? null,
                      email: payload.new.email ?? null,
                      age: payload.new.age ?? null,
                      gender: payload.new.gender ?? null,
                      tour: payload.new.tour ?? null,
                      passport_number: payload.new.passport_number ?? null,
                      passport_expire: payload.new.passport_expire ?? null,
                      passport_copy: payload.new.passport_copy ?? null,
                      commission: payload.new.commission ?? null,
                      created_by: payload.new.created_by
                        ? String(payload.new.created_by)
                        : null,
                      edited_by: payload.new.edited_by
                        ? String(payload.new.edited_by)
                        : null,
                      edited_at: payload.new.edited_at ?? null,
                      travel_choice: payload.new.travel_choice ?? "",
                      status: payload.new.status as OrderStatus,
                      hotel: payload.new.hotel ?? null,
                      room_number: payload.new.room_number ?? null,
                      payment_method: payload.new.payment_method ?? null,
                      created_at: payload.new.created_at,
                      updated_at: payload.new.updated_at,
                      departureDate: payload.new.departureDate ?? "",
                      createdBy:
                        payload.new.users?.email ??
                        payload.new.createdBy ??
                        (payload.new.created_by
                          ? String(payload.new.created_by)
                          : null),
                      total_price: payload.new.total_price,
                      total_amount: payload.new.total_amount,
                      paid_amount: payload.new.paid_amount,
                      balance: payload.new.balance,
                      show_in_provider: hasShowInProviderOrders
                        ? (payload.new.show_in_provider ?? true)
                        : true,
                      order_id: String(payload.new.id),
                      passenger_count:
                        payload.new.passengers?.length ||
                        (payload.new.first_name ? 1 : 0),
                      booking_confirmation: payload.new.booking_confirmations
                        ? {
                            order_id: String(payload.new.id),
                            bus_number:
                              payload.new.booking_confirmations.bus_number ??
                              null,
                            guide_name:
                              payload.new.booking_confirmations.guide_name ??
                              null,
                            weather_emergency:
                              payload.new.booking_confirmations
                                .weather_emergency ?? null,
                            updated_by:
                              payload.new.booking_confirmations.updated_by ??
                              null,
                            updated_at:
                              payload.new.booking_confirmations.updated_at ??
                              null,
                          }
                        : null,
                      passport_copy_url: null,
                      passengers:
                        payload.new.passengers?.map((p: any) => ({
                          id: p.id,
                          first_name: p.first_name || "N/A",
                          last_name: p.last_name || "",
                          date_of_birth: p.date_of_birth || null,
                          gender: p.gender || null,
                          passport_number: p.passport_number || null,
                          passport_expire: p.passport_expire || null,
                          nationality: p.nationality || "Mongolia",
                          notes: p.notes || null,
                          booking_number: p.booking_number
                            ? String(p.booking_number)
                            : null,
                          roomType: p.roomType || null,
                          room_allocation: p.room_allocation || null,
                          status:
                            (p.status as "active" | "completed") || "active",
                          hotel: p.hotel || null,
                          serial_no: p.serial_no || null,
                          main_passenger_id: p.main_passenger_id || null,
                          pax_type: p.pax_type || "Adult",
                          itinerary_status:
                            p.itinerary_status || "No itinerary",
                          passport_upload: p.passport_upload || null,
                          has_baby_bed: p.has_baby_bed || false,
                        })) ?? [],
                    } as Order,
                  ]);
                }
              } else if (payload.eventType === "DELETE") {
                setOrders((prev) =>
                  prev.filter((order) => order.id !== String(payload.old.id)),
                );
              }
            },
          )
          .subscribe((status, error) => {
            if (error) {
              toast.error(t("loginForRealTime"));
              refreshSession();
            }
          });
        channels.push(channel);
      });

      const tourSubscription = supabase
        .channel(`rovider_tours_${Math.random().toString(36).substring(2)}`)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: "tours",
            select: `
              id,
              title,
              name,
              departure_date,
              created_by,
              creator_name:users!created_by(email),
              description,
              hotels,
              dates,
              seats,
              status,
              show_in_provider,
              services,
              base_price,
              created_at,
              updated_at,
              available_seats,
              price_base,
              tour_number
            `,
            filter: hasShowInProviderTours
              ? "show_in_provider=eq.true"
              : undefined,
          },
          (payload) => {
            const mapToTour = (data: any): Tour => ({
              id: String(data.id),
              title: data.title || "Untitled Tour",
              name: data.name || "Unknown Tour",
              departure_date:
                data.departure_date || data.departureDate || "1970-01-01",
              created_by: data.created_by || "system",
              description: data.description || "",
              hotels: data.hotels || [],
              dates: data.dates || [],
              seats: Number(data.seats) || 0,
              status: data.status || "active",
              show_in_provider: hasShowInProviderTours
                ? (data.show_in_provider ?? true)
                : null,
              services: data.services || [],
              base_price: data.base_price || 0,
              created_at: data.created_at || undefined,
              updated_at: data.updated_at || undefined,
              available_seats: data.available_seats || 0,
              price_base: data.price_base || undefined,
              creator_name:
                typeof data.creator_name === "object"
                  ? data.creator_name?.email || "Unknown Creator"
                  : data.creator_name || "Unknown Creator",
              tour_number: data.tour_number || "0",
              booking_confirmation: data.booking_confirmation
                ? {
                    order_id: data.booking_confirmation.order_id || "",
                    bus_number: data.booking_confirmation.bus_number ?? null,
                    guide_name: data.booking_confirmation.guide_name ?? null,
                    weather_emergency:
                      data.booking_confirmation.weather_emergency ?? null,
                    updated_by: data.booking_confirmation.updated_by ?? null,
                    updated_at: data.booking_confirmation.updated_at ?? null,
                  }
                : null,
              image_key: "",
              show_to_user: undefined,
            });

            if (payload.eventType === "UPDATE") {
              if (
                hasShowInProviderTours &&
                payload.new.show_in_provider === false
              ) {
                setTours((prev) =>
                  prev.filter((tour) => tour.id !== payload.new.id),
                );
              } else {
                setTours((prev) =>
                  prev.map((tour) =>
                    tour.id === payload.new.id ? mapToTour(payload.new) : tour,
                  ),
                );
              }
            } else if (payload.eventType === "INSERT") {
              if (
                (!hasShowInProviderTours || payload.new?.show_in_provider) &&
                payload.new?.id &&
                payload.new?.title &&
                payload.new?.name &&
                payload.new?.departure_date &&
                payload.new?.created_by
              ) {
                setTours((prev) => [...prev, mapToTour(payload.new)]);
              }
            } else if (payload.eventType === "DELETE") {
              setTours((prev) =>
                prev.filter((tour) => tour.id !== String(payload.old.id)),
              );
            }
          },
        )
        .subscribe((status, error) => {
          if (error) {
            toast.error(t("loginForRealTime"));
            refreshSession();
          }
        });
      channels.push(tourSubscription);

      // Add passengers subscription
      const passengerSubscription = supabase
        .channel(`passengers_${Math.random().toString(36).substring(2)}`)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: "passengers",
            select:
              "id,first_name,last_name,age,date_of_birth,gender,passport_number,passport_expire,nationality,notes,booking_number,roomType,room_allocation",
          },
          (payload) => {
            fetchOrders(); // Refresh orders to update passengers
          },
        );
      channels.push(passengerSubscription);

      subscriptionRef.current = channels;
    };

    setupSubscriptions();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.forEach((channel: any) =>
          supabase.removeChannel(channel),
        );
      }
    };
  }, [hasShowInProviderOrders, hasShowInProviderTours, setTours]);

  // Refresh on tab switch
  useEffect(() => {
    if (activeTab === "passengers") {
      fetchOrders();
    }
  }, [activeTab]);

  const exportOrdersToCSV = async () => {
    if (filteredOrders.length === 0) {
      toast.warn(t("noOrdersToExport"));
      return;
    }
    setExportLoading(true);
    try {
      const headers = [
        t("orderId"),
        t("tour"),
        t("departureDate"),
        t("passengers"),
        t("status"),
        t("totalAmount"),
        t("createdBy"),
        "Edited At",
        "Payment Method",
        "Phone",
        "First Name",
        "Last Name",
        "Email",
        "Age",
        "Gender",
        "Commission",
        "Hotel",
        "Room Number",
        "Bus Number",
        "Guide Name",
        "Weather/Emergency",
      ];
      const csvRows = filteredOrders.map((order) => [
        order.id,
        order.tour || "N/A",
        order.departureDate
          ? new Date(order.departureDate).toLocaleDateString(
              i18n.language === "zh" ? "zh-CN" : "en-US",
            )
          : t("notSet"),
        order.passenger_count,
        t(order.status),
        `${order.total_amount?.toFixed(2) || "0.00"}`,
        order.createdBy || order.created_by || "N/A",
        order.edited_at
          ? new Date(order.edited_at).toLocaleDateString(
              i18n.language === "zh" ? "zh-CN" : "en-US",
            )
          : "N/A",
        order.payment_method || "N/A",
        order.phone || "N/A",
        order.first_name || "N/A",
        order.last_name || "N/A",
        order.email || "N/A",
        order.age || "N/A",
        order.gender || "N/A",
        order.commission ? `${order.commission.toFixed(2)}` : "N/A",
        order.hotel || "N/A",
        order.room_number || "N/A",
        order.booking_confirmation?.bus_number || "N/A",
        order.booking_confirmation?.guide_name || "N/A",
        order.booking_confirmation?.weather_emergency || "N/A",
      ]);
      const csvContent = [
        headers.join(","),
        ...csvRows.map((row) =>
          row
            .map((field) => `"${String(field).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `provider-orders-${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess", { count: filteredOrders.length }));
    } catch (error) {
      toast.error(t("exportFailed"));
    } finally {
      setExportLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const previousOrders = [...orders];
    const updatedOrders = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status,
            edited_by: currentUser.id,
            edited_at: new Date().toISOString(),
          }
        : o,
    );
    setOrders(updatedOrders);
    try {
      const { error } = await fetchWithRetry(async () =>
        supabase
          .from("orders")
          .update({
            status,
            edited_by: currentUser.id,
            edited_at: new Date().toISOString(),
          })
          .eq("id", orderId),
      );
      if (error) throw error;
      toast.success(t("orderStatusUpdated"));
    } catch (error) {
      toast.error(t("orderStatusUpdateFailed"));
      setOrders(previousOrders);
    }
  };

  const confirmedOrders = orders.filter((order) => {
    const include =
      ["confirmed", "pending"].includes(order.status) &&
      (!hasShowInProviderOrders || order.show_in_provider === true);
    return include;
  });

  const uniqueDates = Array.from(
    new Set(
      confirmedOrders.map((order) =>
        order.departureDate
          ? new Date(order.departureDate).toLocaleDateString(
              i18n.language === "zh" ? "zh-CN" : "en-US",
            )
          : t("notSet"),
      ),
    ),
  ).sort();

  const filteredOrders = confirmedOrders.filter((order) => {
    const lowerTerm = searchTerm.toLowerCase();
    return (
      (selectedDate
        ? (order.departureDate
            ? new Date(order.departureDate).toLocaleDateString(
                i18n.language === "zh" ? "zh-CN" : "en-US",
              )
            : t("notSet")) === selectedDate
        : true) &&
      (order.phone?.toLowerCase().includes(lowerTerm) ||
        order.first_name?.toLowerCase().includes(lowerTerm) ||
        order.last_name?.toLowerCase().includes(lowerTerm) ||
        (order.departureDate
          ? new Date(order.departureDate).toLocaleDateString(
              i18n.language === "zh" ? "zh-CN" : "en-US",
            )
          : t("notSet")
        ).includes(lowerTerm))
    );
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("notSet");
    try {
      return new Date(dateString).toLocaleDateString(
        i18n.language === "zh" ? "zh-CN" : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        },
      );
    } catch {
      return t("invalidDate");
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    toast[type](message);
  };

  const tabs = [
    { id: "orders" as const, label: t("orders"), icon: Users },
    {
      id: "booking" as const,
      label: t("bookingConfirmation"),
      icon: CheckCircle,
    },
    {
      id: "addTour" as const,
      label: t("tourManagement"),
      icon: Settings,
    },
    {
      id: "passengers" as const,
      label: t("passengers"),
      icon: Edit,
    },
  ];

  const allPassengers = confirmedOrders.flatMap((order) => {
    const orderId = String(order.id); // ← THIS WAS MISSING!
    return (
      order.passengers?.map((passenger) => ({
        id: passenger.id,
        first_name: passenger.first_name || "N/A",
        last_name: passenger.last_name || "Unavailable",
        age: passenger.age || null,
        date_of_birth: passenger.date_of_birth || null,
        gender: passenger.gender || null,
        passport_number: passenger.passport_number || null,
        passport_expire: passenger.passport_expire || null,
        nationality: passenger.nationality || "Mongolia",
        notes: passenger.notes || null,
        departure_date: order.departureDate || null,
        tour_title: order.tour || "Unknown Tour",
        status: (passenger.status as "active" | "completed") || "active",
        room_allocation: passenger.room_allocation || null,
        booking_number: passenger.booking_number
          ? String(passenger.booking_number)
          : null,
        hotel: (passenger.hotel || order.hotel)?.trim() || null,
        pax: order.passenger_count || 1,
        roomType: passenger.roomType || null,
        order_id: orderId, // ← THIS IS THE FIX!!!
        pax_type: passenger.pax_type || "Adult",
        itinerary_status: passenger.itinerary_status || "No itinerary",
        passport_upload: passenger.passport_upload || null,
        has_baby_bed: passenger.has_baby_bed || false,
        is_related_to_next: passenger.is_related_to_next ?? false,
        group_color: passenger.group_color ?? null,
      })) || []
    );
  });

  return (
    <div className="mono-shell">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-14 sm:mt-0"
      />

      {/* Header + Language Switch */}
      <div className="bg-white border-b border-gray-200">
        <div className="mono-container px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end">
          <button
            onClick={toggleLanguage}
            className="mono-button mono-button--ghost text-xs sm:text-sm"
          >
            <Globe className="w-4 h-4" />
            <span>{i18n.language === "en" ? "中文" : "EN"}</span>
          </button>
        </div>
      </div>

      <div className="mono-container px-4 sm:px-6 lg:px-8 py-6 pb-16 sm:pb-20">
        <div className="mono-stack">
          <DashboardHeader />

          {/* Tabs */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="mono-nav min-w-max lg:min-w-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`mono-nav-item ${
                      active ? "mono-nav-item--active" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="mono-stack">
            {activeTab === "orders" && (
              <>
                <StatsCards
                  orders={confirmedOrders}
                  tours={tours.filter(
                    (t) => !hasShowInProviderTours || t.show_in_provider,
                  )}
                />
                <OrdersTable
                  orders={filteredOrders}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  loading={loading}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  ordersPerPage={10}
                  updateOrderStatus={updateOrderStatus}
                  exportOrdersToCSV={exportOrdersToCSV}
                  exportLoading={exportLoading}
                  uniqueDates={uniqueDates}
                  formatDate={(d) =>
                    d
                      ? new Date(d).toLocaleDateString(
                          i18n.language === "zh" ? "zh-CN" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )
                      : t("notSet")
                  }
                  refetch={refetch}
                />
              </>
            )}

            {activeTab === "booking" && (
              <BookingConfirmationTab
                orders={filteredOrders}
                currentUser={currentUser}
                setOrders={setOrders}
                formatDate={(d) =>
                  d
                    ? new Date(d).toLocaleDateString(
                        i18n.language === "zh" ? "zh-CN" : "en-US",
                        { year: "numeric", month: "long", day: "numeric" },
                      )
                    : t("notSet")
                }
              />
            )}

            {activeTab === "addTour" && (
              <AddTourTab
                tours={tours}
                setTours={setTours}
                currentUser={currentUser}
                showNotification={(type, msg) => toast[type](msg)}
              />
            )}

            {activeTab === "passengers" && (
              <PassengerTable
                passengers={allPassengers}
                selectedDate={selectedDate || null}
                refetch={refetch}
              />
            )}
          </div>
        </div>

        <div className="h-16 sm:h-12 lg:hidden" />
      </div>
    </div>
  );
}

export default ProviderInterface;
