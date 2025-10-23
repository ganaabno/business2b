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
  id: string;
  order_id: string;
  user_id: string | null;
  tour_title: string;
  departure_date: string;
  name: string;
  room_number: string; // Changed from room_allocation to match database
  serial_no: string;
  last_name: string;
  first_name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  passport_number: string;
  passport_expiry: string;
  nationality: string;
  roomType: string;
  hotel: string;
  additional_services: string[];
  price: number;
  email: string;
  phone: string;
  passport_upload: string;
  allergy: string;
  emergency_phone: string;
  created_at: string;
  updated_at: string;
  is_blacklisted?: boolean;
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
    departureDate: string;
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

    const passengerSubscription = supabase
      .channel("passengers_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passengers",
          filter: `user_id=eq.${currentUser.userId}`,
        },
        async (payload) => {
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
              console.error("Error fetching updated passengers:", error);
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
                    (p: SupabasePassenger): Passenger => ({
                      id: p.id,
                      order_id: p.order_id,
                      user_id: p.user_id,
                      tour_title:
                        p.orders?.tours?.title ||
                        p.tour_title ||
                        "Unknown Tour",
                      departure_date:
                        p.orders?.departureDate || p.departure_date || "",
                      tour_id: p.orders?.tour_id || "",
                      passenger_number: p.serial_no || "",
                      name: p.name,
                      room_allocation: p.room_number, // Changed to room_number
                      serial_no: p.serial_no,
                      last_name: p.last_name,
                      first_name: p.first_name,
                      date_of_birth: p.date_of_birth,
                      age: p.age,
                      gender: p.gender,
                      passport_number: p.passport_number,
                      passport_expire: p.passport_expiry,
                      nationality: p.nationality,
                      roomType: p.roomType,
                      hotel: p.hotel,
                      additional_services: p.additional_services,
                      price: p.price,
                      email: p.email,
                      phone: p.phone,
                      passport_upload: p.passport_upload,
                      allergy: p.allergy,
                      emergency_phone: p.emergency_phone,
                      created_at: p.created_at,
                      updated_at: p.updated_at,
                      status: p.status,
                      is_blacklisted: p.is_blacklisted ?? false,
                      blacklisted_date: (p as any).blacklisted_date ?? null,
                      notes: (p as any).notes ?? null,
                      seat_count: (p as any).seat_count || 1,
                      main_passenger_id: null,
                      sub_passenger_count: 0,
                      has_sub_passengers: false,
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
            console.error("Error in passenger real-time handler:", error);
            wrappedShowNotification("error", "Failed to refresh passengers");
          }
        }
      )
      .subscribe();

    const orderSubscription = supabase
      .channel("orders_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${currentUser.userId}`,
        },
        async (payload) => {
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
              console.error("Error fetching updated orders:", error);
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
                  user_id: o.user_id,
                  tour_id: o.tour_id,
                  departureDate: o.departureDate,
                  tour: o.tours?.title || o.tour || "Unknown Tour",
                  phone: o.phone,
                  last_name: o.last_name,
                  first_name: o.first_name,
                  email: o.email,
                  age: o.age,
                  gender: o.gender,
                  passport_number: o.passport_number,
                  passport_expire: o.passport_expire,
                  passport_copy: o.passport_copy,
                  created_by: o.created_by,
                  createdBy: o.createdBy,
                  edited_by: o.edited_by,
                  edited_at: o.edited_at,
                  travel_choice: o.travel_choice,
                  status: o.status,
                  hotel: o.hotel,
                  room_number: o.room_number ?? "", // Map room_number from database
                  payment_method: o.payment_method,
                  created_at: o.created_at,
                  updated_at: o.updated_at,
                  show_in_provider: o.show_in_provider,
                  total_price: o.total_price,
                  total_amount: o.total_amount,
                  paid_amount: o.paid_amount,
                  balance: o.balance,
                  commission: o.commission || 0,
                  passengers: passengers.filter((p) => p.order_id === o.id),
                  passenger_count: passengers.filter((p) => p.order_id === o.id)
                    .length,
                  passport_copy_url: o.passport_copy_url ?? null,
                  booking_confirmation: o.booking_confirmation ?? null,
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
            console.error("Error in order real-time handler:", error);
            wrappedShowNotification("error", "Failed to refresh orders");
          }
        }
      )
      .subscribe();

    const tourSubscription = supabase
      .channel("tours_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tours",
        },
        async (payload) => {
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
            const validatedTours = data.filter((tour): tour is Tour => {
              const isValid = tour.id && tour.title;
              if (!isValid) {
                console.warn("Invalid tour data:", tour);
              }
              return isValid;
            });
            console.log(
              "Updated tours:",
              JSON.stringify(validatedTours, null, 2)
            );
            setTours(validatedTours);
            if (selectedTourData?.id && departureDate) {
              const { isValid, message, seats } = await checkSeatLimit(
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
      .subscribe();

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
