import { useState, useCallback } from "react";
import { parse, isValid, format } from "date-fns"; // Add date-fns imports
import { supabase } from "../supabaseClient";
import type { Tour, Passenger, User as UserType, Order } from "../types/type";

interface SendRequestsHandlerProps {
  bookingPassengers: Passenger[];
  selectedTour: string;
  departureDate: string;
  paymentMethod: string;
  currentUser: UserType;
  tours: Tour[];
  isPowerUser: boolean;
  showInProvider: boolean;
  setNotification: React.Dispatch<React.SetStateAction<any>>;
  resetBookingForm: () => void;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

// Utility function to generate a passenger ID
const generatePassengerId = () => crypto.randomUUID(); // Define generatePassengerId

const cleanDateForDB = (date: string | undefined | null): string | null => {
  if (!date || date.trim() === "") return null;
  const formats = [
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "d-MM-yy",
    "dd-MM-yy",
    "MM/dd/yyyy",
    "M/d/yy",
    "MM/dd/yy",
  ];
  let parsedDate: Date | null = null;
  for (const fmt of formats) {
    try {
      parsedDate = parse(date.trim(), fmt, new Date());
      if (isValid(parsedDate)) break;
    } catch (e) {
      continue;
    }
  }
  return parsedDate && isValid(parsedDate)
    ? format(parsedDate, "yyyy-MM-dd")
    : null;
};

export function useSendRequestsHandler({
  bookingPassengers,
  selectedTour,
  departureDate,
  paymentMethod,
  currentUser,
  tours,
  isPowerUser,
  showInProvider,
  setNotification,
  resetBookingForm,
  setOrders,
}: SendRequestsHandlerProps) {
  const [loading, setLoading] = useState(false);

  const sendRequest = useCallback(async () => {

    if (!selectedTour || !departureDate) {
      setNotification({
        type: "error",
        message: "Please select a tour and departure date",
      });
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      setNotification({ type: "error", message: "Selected tour not found" });
      return;
    }

    if (
      !isPowerUser &&
      tourData.available_seats !== undefined &&
      tourData.available_seats < bookingPassengers.length
    ) {
      return;
    }

    setLoading(true);
    try {
      if (isPowerUser) {
        // Manager: Insert directly to orders and passengers
        const totalPrice = bookingPassengers.reduce(
          (sum, p) => sum + (p.price || 0),
          0
        );
        const commission = totalPrice * 0.05;
        const firstPassenger = bookingPassengers[0];

        const orderData = {
          user_id: currentUser.id,
          tour_id: tourData.id,
          phone: firstPassenger?.phone?.trim() || null,
          last_name: firstPassenger?.last_name?.trim() || null,
          first_name: firstPassenger?.first_name?.trim() || null,
          email: firstPassenger?.email?.trim() || null,
          age: firstPassenger?.age || null,
          gender: firstPassenger?.gender?.trim() || null,
          passport_number: firstPassenger?.passport_number?.trim() || null,
          passport_expire: cleanDateForDB(firstPassenger?.passport_expire),
          passport_copy: firstPassenger?.passport_upload || null,
          commission,
          created_by: currentUser.id,
          createdBy: currentUser.username || currentUser.email,
          tour: tourData.title,
          travel_choice: selectedTour,
          status: "pending",
          hotel: firstPassenger?.hotel?.trim() || null,
          room_number: firstPassenger?.room_allocation?.trim() || null,
          payment_method: paymentMethod || null,
          departureDate: cleanDateForDB(departureDate),
          total_price: totalPrice,
          total_amount: totalPrice,
          paid_amount: 0,
          balance: totalPrice,
          show_in_provider: showInProvider,
        };

        const { data: orderResult, error: orderError } = await supabase
          .from("orders")
          .insert(orderData)
          .select()
          .single();

        if (orderError || !orderResult) {
          throw new Error(orderError?.message || "No order data returned");
        }

        const orderId = String(orderResult.id);
        const uploadedPaths = await Promise.all(
          bookingPassengers.map(async (passenger) => {
            if (
              passenger.passport_upload &&
              typeof passenger.passport_upload !== "string"
            ) {
              const file = passenger.passport_upload as File;
              const fileExt = file.name.split(".").pop();
              const fileName = `passport_${orderId}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2)}.${fileExt}`;
              const { data, error } = await supabase.storage
                .from("passports")
                .upload(fileName, file);
              return error ? "" : data.path;
            }
            return passenger.passport_upload || "";
          })
        );

        const cleanedPassengers = bookingPassengers.map((passenger, index) => ({
          order_id: orderId,
          user_id: currentUser.id,
          tour_title: selectedTour,
          departure_date: cleanDateForDB(departureDate),
          name: `${passenger.first_name} ${passenger.last_name}`.trim(),
          room_allocation: passenger.room_allocation?.trim() || "",
          serial_no: passenger.serial_no,
          last_name: passenger.last_name?.trim() || "",
          first_name: passenger.first_name?.trim() || "",
          date_of_birth: cleanDateForDB(passenger.date_of_birth) ?? "",
          age: passenger.age || null,
          gender: passenger.gender?.trim() || "",
          passport_number: passenger.passport_number?.trim() || "",
          passport_expire: cleanDateForDB(passenger.passport_expire),
          nationality: passenger.nationality?.trim() || "Mongolia",
          roomType: passenger.roomType?.trim() || "",
          hotel: passenger.hotel?.trim() || "",
          additional_services: Array.isArray(passenger.additional_services)
            ? passenger.additional_services
            : [],
          price: passenger.price || 0,
          email: passenger.email?.trim() || "",
          phone: passenger.phone?.trim() || "",
          passport_upload: uploadedPaths[index] || null,
          allergy: passenger.allergy?.trim() || "",
          emergency_phone: passenger.emergency_phone?.trim() || "",
          status: "active",
          is_blacklisted: passenger.is_blacklisted || false,
          blacklisted_date: cleanDateForDB(passenger.blacklisted_date),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error: passengerError } = await supabase
          .from("passengers")
          .insert(cleanedPassengers);
        if (passengerError) throw new Error(passengerError.message);

        if (!isPowerUser && tourData.available_seats !== undefined) {
          const newSeatCount = Math.max(
            0,
            tourData.available_seats - bookingPassengers.length
          );
          const { error: tourUpdateError } = await supabase
            .from("tours")
            .update({
              available_seats: newSeatCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", tourData.id);
          if (tourUpdateError)
            console.warn(
              "Failed to update tour seats:",
              tourUpdateError.message
            );
        }

        const newOrder: Order = {
          id: orderId,
          ...orderData,
          created_at: orderResult.created_at,
          updated_at: orderResult.updated_at,
          departureDate: cleanDateForDB(departureDate) || "",
          total_price: totalPrice,
          total_amount: totalPrice,
          balance: totalPrice,
          paid_amount: 0,
          show_in_provider: showInProvider,
          created_by: currentUser.id,
          createdBy: currentUser.username || currentUser.email,
          user_id: currentUser.id,
          tour_id: tourData.id,
          travel_choice: selectedTour,
          status: "pending",
          age: firstPassenger?.age || null,
          hotel: firstPassenger?.hotel || null,
          room_number: firstPassenger?.room_allocation || null,
          phone: firstPassenger?.phone || null,
          last_name: firstPassenger?.last_name || null,
          first_name: firstPassenger?.first_name || null,
          email: firstPassenger?.email || null,
          tour: tourData.title,
          passport_number: firstPassenger?.passport_number || null,
          passport_expire: cleanDateForDB(firstPassenger?.passport_expire),
          passport_copy: firstPassenger?.passport_upload || null,
          commission,
          payment_method: paymentMethod || null,
          passengers: cleanedPassengers.map((p, index) => ({
            ...p,
            id: generatePassengerId(), // Use the defined function
            passport_upload: uploadedPaths[index] || null,
          })) as Passenger[],
          edited_by: null,
          edited_at: null,
          passport_copy_url: null,
          passenger_count: 0,
          booking_confirmation: null,
          order_id: "",
          room_allocation: "",
          passenger_requests: [],
          travel_group: null
        };

        setOrders((prev) => [...prev, newOrder]);
        setNotification({
          type: "success",
          message: `Booking saved successfully! Order ID: ${orderId}`,
        });
      } else {
        // User: Insert to passenger_requests
        const totalPrice = bookingPassengers.reduce(
          (sum, p) => sum + (p.price || 0),
          0
        );
        const cleanedPassengers = bookingPassengers.map((passenger, index) => ({
          id: crypto.randomUUID(),
          user_id: currentUser.id,
          tour_id: tourData.id,
          tour_title: selectedTour,
          departure_date: cleanDateForDB(departureDate),
          name: `${passenger.first_name} ${passenger.last_name}`.trim(),
          room_allocation: passenger.room_allocation?.trim() || "",
          serial_no: passenger.serial_no,
          last_name: passenger.last_name?.trim() || "",
          first_name: passenger.first_name?.trim() || "",
          date_of_birth: cleanDateForDB(passenger.date_of_birth) ?? "",
          age: passenger.age || null,
          gender: passenger.gender?.trim() || "",
          passport_number: passenger.passport_number?.trim() || "",
          passport_expire: cleanDateForDB(passenger.passport_expire),
          nationality: passenger.nationality?.trim() || "Mongolia",
          roomType: passenger.roomType?.trim() || "",
          hotel: passenger.hotel?.trim() || "",
          additional_services: Array.isArray(passenger.additional_services)
            ? passenger.additional_services
            : [],
          price: passenger.price || 0,
          email: passenger.email?.trim() || "",
          phone: passenger.phone?.trim() || "",
          passport_upload: passenger.passport_upload || "",
          allergy: passenger.allergy?.trim() || "",
          emergency_phone: passenger.emergency_phone?.trim() || "",
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error: requestError } = await supabase
          .from("passenger_requests")
          .insert(cleanedPassengers);
        if (requestError) throw new Error(requestError.message);

        setNotification({
          type: "success",
          message: "Booking request submitted successfully!",
        });
      }

      resetBookingForm();
    } catch (error) {
      setNotification({
        type: "error",
        message: `Error saving booking: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  }, [
    bookingPassengers,
    selectedTour,
    departureDate,
    paymentMethod,
    currentUser,
    tours,
    isPowerUser,
    showInProvider,
    setNotification,
    resetBookingForm,
    setOrders,
  ]);

  return { sendRequest, loading };
}
