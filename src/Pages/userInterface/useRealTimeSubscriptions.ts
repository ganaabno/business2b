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

interface SupabasePassenger {
  blacklisted_date: null;
  seat_count: number;
  id: string;
  order_id: string;
  user_id: string | null;
  tour_title: string;
  departure_date: string | null;
  name: string;
  room_number: string;
  serial_no: string;
  last_name: string;
  first_name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  nationality: string | null;
  roomType: string | null;
  hotel: string | null;
  additional_services: string[] | null;
  price: number | null;
  email: string | null;
  phone: string | null;
  passport_upload: string | null;
  allergy: string | null;
  emergency_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_blacklisted?: boolean;
  notes?: string | null;
  booking_number: string | null;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "active"
    | "inactive"
    | "cancelled";
  orders?: {
    id: string;
    tour_id: string;
    departureDate: string | null;
    tours?: {
      id: string;
      title: string;
    };
  };
}

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

    // Passenger subscription
    const passengerSubscription = supabase
      .channel(`passengers_channel_${Math.random().toString(36).substring(2)}`) // Unique channel name
      .on(
        "postgres_changes" as any, // Workaround for older supabase-js versions
        {
          event: "*",
          schema: "public",
          table: "passengers",
          filter: `user_id=eq.${currentUser.userId}`,
        },
        async (payload: any) => {
          console.log(
            "Passenger subscription payload:",
            JSON.stringify(payload, null, 2)
          );
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
            console.log(
              "Fetched passenger data:",
              data.map((p: SupabasePassenger) => ({
                id: p.id,
                date_of_birth: p.date_of_birth || "Missing date_of_birth",
                notes: p.notes || "No notes",
                booking_number: p.booking_number || "No booking_number",
              }))
            );
            setPassengers((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              return [
                ...prev.filter((p) => p.order_id !== ""),
                ...data
                  .map(
                    (p: SupabasePassenger): Passenger => ({
                      id: p.id,
                      order_id: p.order_id,
                      user_id: p.user_id,
                      tour_title: p.orders?.tours?.title ||
                        p.tour_title ||
                        "Unknown Tour",
                      departure_date: p.orders?.departureDate || p.departure_date || null,
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
                      pax: null
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

    // Order subscription
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
          console.log(
            "Order subscription payload:",
            JSON.stringify(payload, null, 2)
          );
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

    // Tour subscription
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
          console.log(
            "Tour subscription payload:",
            JSON.stringify(payload, null, 2)
          );
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
              console.error(
                "Error fetching updated tours:",
                JSON.stringify(error, null, 2)
              );
              wrappedShowNotification(
                "error",
                `Failed to refresh tours: ${error.message}`
              );
              return;
            }
            const validatedTours = data.filter((tour): tour is Tour => {
              const isValid = tour.id && tour.title;
              if (!isValid) {
                console.warn(
                  "Invalid tour data:",
                  JSON.stringify(tour, null, 2)
                );
              }
              return isValid;
            });
            console.log(
              "Updated tours:",
              JSON.stringify(validatedTours, null, 2)
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
            console.error(
              "Error in tour real-time handler:",
              JSON.stringify(error, null, 2)
            );
            wrappedShowNotification("error", "Failed to refresh tours");
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error(
            "Tour subscription error:",
            JSON.stringify(error, null, 2)
          );
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
