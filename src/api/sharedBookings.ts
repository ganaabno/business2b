import { supabase } from "../supabaseClient";
import type { Passenger } from "../types/type";

type SharedBookingResult = {
  orderId: string;
  totalPrice: number;
  remainingSeats: number;
};

const sanitizePassengerForRpc = (passenger: Passenger) => ({
  tour_title: passenger.tour_title ?? "",
  name: passenger.name ?? "",
  room_allocation: passenger.room_allocation ?? "",
  serial_no: passenger.serial_no ?? "",
  passenger_number: passenger.passenger_number ?? "",
  last_name: passenger.last_name ?? "",
  first_name: passenger.first_name ?? "",
  date_of_birth: passenger.date_of_birth ?? null,
  age: passenger.age ?? null,
  gender: passenger.gender ?? null,
  passport_number: passenger.passport_number ?? "",
  passport_expire: passenger.passport_expire ?? null,
  nationality: passenger.nationality ?? "Mongolia",
  room_type: passenger.roomType ?? null,
  hotel: passenger.hotel ?? null,
  additional_services: Array.isArray(passenger.additional_services)
    ? passenger.additional_services
    : [],
  price: passenger.price ?? 0,
  email: passenger.email ?? null,
  phone: passenger.phone ?? null,
  passport_upload: passenger.passport_upload ?? null,
  allergy: passenger.allergy ?? null,
  emergency_phone: passenger.emergency_phone ?? null,
  status: passenger.status ?? "active",
  notes: passenger.notes ?? null,
  seat_count: passenger.seat_count ?? 1,
  main_passenger_id: passenger.main_passenger_id ?? null,
  sub_passenger_count: passenger.sub_passenger_count ?? 0,
  has_sub_passengers: passenger.has_sub_passengers ?? false,
  itinerary_status: passenger.itinerary_status ?? "No itinerary",
  pax_type: passenger.pax_type ?? "Adult",
  group_color: passenger.group_color ?? null,
  source_passenger_id: null,
});

export async function createSharedBooking(params: {
  userId: string;
  tourId: string;
  tourTitle: string;
  departureDate: string;
  paymentMethod: string | null;
  orderStatus: string;
  source: "b2b" | "b2c";
  sourceOrderId?: string | null;
  passengers: Passenger[];
}): Promise<SharedBookingResult> {
  const { data, error } = await supabase.rpc("book_trip_shared", {
    p_user_id: params.userId,
    p_tour_id: params.tourId,
    p_tour_title: params.tourTitle,
    p_departure_date: params.departureDate,
    p_payment_method: params.paymentMethod,
    p_order_status: params.orderStatus,
    p_order_source: params.source,
    p_source_order_id: params.sourceOrderId ?? null,
    p_passengers: params.passengers.map(sanitizePassengerForRpc),
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Shared booking RPC returned empty response");
  }

  return {
    orderId: String(row.order_id),
    totalPrice: Number(row.total_price ?? 0),
    remainingSeats: Number(row.remaining_seats ?? 0),
  };
}

export async function getDepartureSeatStats(tourId: string, departureDate: string) {
  const { data, error } = await supabase.rpc("get_departure_seats", {
    p_tour_id: tourId,
    p_departure_date: departureDate,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    capacity: Number(row?.capacity ?? 0),
    booked: Number(row?.booked ?? 0),
    remaining: Number(row?.remaining ?? 0),
  };
}
