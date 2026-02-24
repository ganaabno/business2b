import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { supabase } from "../../supabaseClient";
import type {
  Tour,
  Passenger,
  Order,
  User as UserType,
} from "../../types/type";
import { checkSeatLimit } from "../../utils/seatLimitChecks";

interface UseRealTimeSubscriptionsProps {
  currentUser: UserType;
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setTours: Dispatch<SetStateAction<Tour[]>>;
  selectedTour: string;
  departureDate: string;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
  tours: Tour[];
  passengers: Passenger[];
}

export default function useRealTimeSubscriptions({
  currentUser,
  setPassengers,
  setOrders,
  setTours,
  selectedTour,
  departureDate,
  wrappedShowNotification,
  tours,
  passengers,
}: UseRealTimeSubscriptionsProps) {
  useEffect(() => {
    const selectedTourData = tours.find((t: Tour) => t.title === selectedTour);

    // === PASSENGER SUBSCRIPTION ===
    const passengerSubscription = supabase
      .channel(`passengers_channel_${Math.random().toString(36).substring(2)}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "passengers",
          filter: `user_id=eq.${currentUser.userId}`,
        },
        async (payload: any) => {
          try {
            const { data, error } = await supabase
              .from("passengers")
              .select(
                `
                *,
                orders (
                  id,
                  tour_id,
                  departureDate,
                  tours (
                    id,
                    title
                  )
                )
              `
              )
              .eq("user_id", currentUser.userId);
            if (error) {
              console.error(
                "Error fetching updated passengers:",
                JSON.stringify(error, null, 2)
              );
              wrappedShowNotification(
                "error",
                `Failed to refresh passengers: ${error.message}`
              );
              return;
            }
         
            setPassengers((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              return [
                ...prev.filter((p) => p.order_id !== ""),
                ...data
                  .map(
                    (p: any): Passenger => ({
                      id: p.id,
                      order_id: p.order_id,
                      user_id: p.user_id,
                      tour_title:
                        p.orders?.tours?.title ||
                        p.tour_title ||
                        "Unknown Tour",
                      departure_date:
                        p.orders?.departureDate || p.departure_date || null,
                      tour_id: p.orders?.tour_id || "",
                      passenger_number: p.serial_no || "",
                      name: p.name,
                      room_allocation: p.room_number || "",
                      serial_no: p.serial_no,
                      last_name: p.last_name || "",
                      first_name: p.first_name || "",
                      date_of_birth: p.date_of_birth || null,
                      age: p.age || null,
                      gender: p.gender || null,
                      passport_number: p.passport_number || null,
                      passport_expire: p.passport_expiry || null,
                      nationality: p.nationality || null,
                      roomType: p.roomType || null,
                      hotel: p.hotel || null,
                      additional_services: p.additional_services || [],
                      price: p.price || null,
                      email: p.email || null,
                      phone: p.phone || null,
                      passport_upload: p.passport_upload || null,
                      allergy: p.allergy || null,
                      emergency_phone: p.emergency_phone || null,
                      created_at: p.created_at || null,
                      updated_at: p.updated_at || null,
                      status: p.status,
                      is_blacklisted: p.is_blacklisted ?? false,
                      blacklisted_date: p.blacklisted_date ?? null,
                      notes: p.notes ?? null,
                      seat_count: p.seat_count || 1,
                      main_passenger_id: null,
                      sub_passenger_count: 0,
                      has_sub_passengers: false,
                      booking_number: p.booking_number || null,
                      orders: null,
                      note: "",
                      is_request: undefined,
                      pax_type: "Adult",
                    })
                  )
                  .filter((p) => !existingIds.has(p.id) || p.order_id !== ""),
              ];
            });
            if (selectedTourData?.id && departureDate) {
              const { isValid, message } = await checkSeatLimit(
                selectedTourData.id,
                departureDate
              );
              wrappedShowNotification(isValid ? "success" : "error", message);
            }
          } catch (error) {
            console.error(
              "Error in passenger real-time handler:",
              JSON.stringify(error, null, 2)
            );
            wrappedShowNotification("error", "Failed to refresh passengers");
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error(
            "Passenger subscription error:",
            JSON.stringify(error, null, 2)
          );
          wrappedShowNotification("error", "Passenger subscription failed");
        }
      });

    // === ORDER SUBSCRIPTION ===
    const orderSubscription = supabase
      .channel(`orders_channel_${Math.random().toString(36).substring(2)}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${currentUser.userId}`,
        },
        async (payload: any) => {
          try {
            const { data, error } = await supabase
              .from("orders")
              .select(
                `
                *,
                tours (
                  id,
                  title
                )
              `
              )
              .eq("user_id", currentUser.userId);
            if (error) {
              console.error(
                "Error fetching updated orders:",
                JSON.stringify(error, null, 2)
              );
              wrappedShowNotification(
                "error",
                `Failed to refresh orders: ${error.message}`
              );
              return;
            }
            setOrders(
              data.map(
                (o): Order => ({
                  id: o.id,
                  order_id: String(o.id),
                  user_id: o.user_id || null,
                  tour_id: o.tour_id || "",
                  departureDate: o.departureDate || null,
                  tour: o.tours?.title || o.tour || "Unknown Tour",
                  phone: o.phone || null,
                  last_name: o.last_name || null,
                  first_name: o.first_name || null,
                  email: o.email || null,
                  age: o.age || null,
                  gender: o.gender || null,
                  passport_number: o.passport_number || null,
                  passport_expire: o.passport_expire || null,
                  passport_copy: o.passport_copy || null,
                  created_by: o.created_by || null,
                  createdBy: o.createdBy || null,
                  edited_by: o.edited_by || null,
                  edited_at: o.edited_at || null,
                  travel_choice: o.travel_choice || "",
                  status: o.status || "pending",
                  hotel: o.hotel || null,
                  room_number: o.room_number || "",
                  payment_method: o.payment_method || null,
                  created_at: o.created_at || null,
                  updated_at: o.updated_at || null,
                  show_in_provider: o.show_in_provider ?? true,
                  total_price: o.total_price || 0,
                  total_amount: o.total_amount || 0,
                  paid_amount: o.paid_amount || 0,
                  balance: o.balance || 0,
                  commission: o.commission || 0,
                  passengers: passengers.filter((p) => p.order_id === o.id),
                  passenger_count: passengers.filter((p) => p.order_id === o.id)
                    .length,
                  passport_copy_url: o.passport_copy_url || null,
                  booking_confirmation: o.booking_confirmation || null,
                  room_allocation: o.room_number || "",
                  passenger_requests: [],
                  travel_group: null
                })
              )
            );
            if (selectedTourData?.id && departureDate) {
              const { isValid, message } = await checkSeatLimit(
                selectedTourData.id,
                departureDate
              );
              wrappedShowNotification(isValid ? "success" : "error", message);
            }
          } catch (error) {
            console.error(
              "Error in order real-time handler:",
              JSON.stringify(error, null, 2)
            );
            wrappedShowNotification("error", "Failed to refresh orders");
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error(
            "Order subscription error:",
            JSON.stringify(error, null, 2)
          );
          wrappedShowNotification("error", "Order subscription failed");
        }
      });

    // === TOUR SUBSCRIPTION — FIXED BLOCK ===
    // === TOUR SUBSCRIPTION — FINAL FIXED VERSION ===
    const tourSubscription = supabase
      .channel(`tours_channel_${Math.random().toString(36).substring(2)}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "tours",
        },
        async (payload: any) => {
     
          try {
            const { data, error } = await supabase.from("tours").select(`
            id,
            title,
            name,
            description,
            seats,
            base_price,
            dates,
            hotels,
            services
          `);

            if (error) {
              console.error("Error fetching updated tours:", error);
              wrappedShowNotification(
                "error",
                `Failed to refresh tours: ${error.message}`
              );
              return;
            }

            // FORCE TYPE + FILTER + MAP
            const validatedTours: Tour[] = (data as any[])
              .filter((tour: any) => tour?.id && tour?.title)
              .map(
                (t: any): Tour => ({
                  ...t,
                  creator_name: t.creator_name ?? "Unknown",
                  tour_number: t.tour_number ?? "",
                  created_by: t.created_by ?? "system",
                  created_at: t.created_at ?? null,
                  updated_at: t.updated_at ?? null,
                  name: t.name ?? "",
                  description: t.description ?? "",
                  seats: t.seats ?? 0,
                  base_price: t.base_price ?? 0,
                  dates: Array.isArray(t.dates)
                    ? t.dates
                    : t.dates
                    ? [t.dates]
                    : [],
                  hotels: Array.isArray(t.hotels)
                    ? t.hotels
                    : t.hotels
                    ? [t.hotels]
                    : [],
                  services: Array.isArray(t.services) ? t.services : [],
                  departure_date: t.departure_date ?? undefined,
                })
              );
            setTours(validatedTours);

            if (selectedTourData?.id && departureDate) {
              const { isValid, message } = await checkSeatLimit(
                selectedTourData.id,
                departureDate
              );
              wrappedShowNotification(isValid ? "success" : "error", message);
            }
          } catch (error) {
            console.error("Error in tour real-time handler:", error);
            wrappedShowNotification("error", "Failed to refresh tours");
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("Tour subscription error:", error);
          wrappedShowNotification("error", "Tour subscription failed");
        }
      });

    return () => {
      supabase.removeChannel(passengerSubscription);
      supabase.removeChannel(orderSubscription);
      supabase.removeChannel(tourSubscription);
    };
  }, [
    currentUser.userId,
    setPassengers,
    setOrders,
    setTours,
    selectedTour,
    departureDate,
    wrappedShowNotification,
    tours,
    passengers,
  ]);
}
