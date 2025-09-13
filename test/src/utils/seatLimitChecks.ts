// seatLimitChecks.ts
import { supabase } from "../supabaseClient";

export interface SeatCheckResult {
  isValid: boolean;
  message: string;
  seats: number;
}

export async function checkSeatLimit(tourId: string, departureDate: string): Promise<SeatCheckResult> {
  try {
    // Fetch total seats for the tour
    const { data: tourData, error: tourError } = await supabase
      .from("tours")
      .select("seats")
      .eq("id", tourId)
      .single();

    if (tourError || !tourData) {
      console.error("Error fetching tour seats:", tourError?.message || "No tour data");
      return { isValid: false, message: "Tour not found", seats: 0 };
    }

    const totalSeats = tourData.seats ?? 0;
    console.log(`Total seats for tour ${tourId}: ${totalSeats}`);

    // Count passengers by joining through orders
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("tour_id", tourId)
      .eq("departureDate", departureDate);

    if (orderError) {
      console.error("Error fetching orders:", orderError.message);
      return { isValid: false, message: "Error checking seat availability", seats: 0 };
    }

    const orderIds = orderData?.map((order) => order.id) || [];
    const { count, error: passengerError } = await supabase
      .from("passengers")
      .select("id", { count: "exact" })
      .in("order_id", orderIds);

    if (passengerError) {
      console.error("Error counting passengers:", passengerError.message);
      return { isValid: false, message: "Error checking seat availability", seats: 0 };
    }

    const bookedSeats = count ?? 0;
    const remainingSeats = totalSeats - bookedSeats;

    console.log(
      `Total seats: ${totalSeats}, Booked seats: ${bookedSeats}, Remaining seats: ${remainingSeats}`
    );

    if (remainingSeats <= 0) {
      return {
        isValid: false,
        message: "No seats available for this tour and departure date",
        seats: 0,
      };
    }

    return {
      isValid: true,
      message: `${remainingSeats} seat${remainingSeats > 1 ? "s" : ""} available`,
      seats: remainingSeats,
    };
  } catch (error) {
    console.error("Unexpected error in checkSeatLimit:", error);
    return { isValid: false, message: "Error checking seat availability", seats: 0 };
  }
}