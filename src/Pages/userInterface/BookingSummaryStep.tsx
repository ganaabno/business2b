import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Tour,
  Passenger,
  ValidationError,
  User as UserType,
  Order,
} from "../../types/type";
import BookingSummary from "../../Parts/BookingSummary";
import { supabase } from "../../supabaseClient";

interface BookingSummaryStepProps {
  tours: Tour[];
  selectedTour: string;
  departureDate: string;
  passengers: Passenger[];
  paymentMethod: string[];
  setPaymentMethod: Dispatch<SetStateAction<string[]>>;
  errors: ValidationError[];
  setErrors: Dispatch<SetStateAction<ValidationError[]>>;
  showNotification: (type: "success" | "error", message: string) => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  showInProvider: boolean;
  setShowInProvider: Dispatch<SetStateAction<boolean>>;
  currentUser: UserType;
  setActiveStep: Dispatch<SetStateAction<number>>;
  setSelectedTour: Dispatch<SetStateAction<string>>;
  setDepartureDate: Dispatch<SetStateAction<string>>;
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setExpandedPassengerId: Dispatch<SetStateAction<string | null>>;
}

export default function BookingSummaryStep({
  tours,
  selectedTour,
  departureDate,
  passengers,
  paymentMethod,
  setPaymentMethod,
  errors,
  setErrors,
  showNotification,
  setLoading,
  loading,
  showInProvider,
  setShowInProvider,
  currentUser,
  setActiveStep,
  setSelectedTour,
  setDepartureDate,
  setPassengers,
  setOrders,
  setExpandedPassengerId,
}: BookingSummaryStepProps) {
  const selectedTourData = tours.find((t: Tour) => t.title === selectedTour);

  // Log props for debugging
  console.log("BookingSummaryStep: Props", {
    selectedTour,
    departureDate,
    passengersLength: passengers.length,
    paymentMethod,
    errors,
    loading,
    showInProvider,
  });

  const handleDownloadCSV = useCallback(() => {
    if (passengers.length === 0) {
      showNotification("error", "No unsubmitted passengers to export");
      return;
    }

    const headers = [
      "Room Allocation",
      "Serial No",
      "Last Name",
      "First Name",
      "Date of Birth",
      "Age",
      "Gender",
      "Passport Number",
      "Passport Expiry",
      "Nationality",
      "Room Type",
      "Hotel",
      "Additional Services",
      "Price",
      "Email",
      "Phone",
      "Allergy",
      "Emergency Phone",
    ];

    const rows = passengers.map((p) =>
      [
        p.room_allocation,
        p.serial_no,
        p.last_name,
        p.first_name,
        p.date_of_birth,
        p.age,
        p.gender,
        p.passport_number,
        p.passport_expire,
        p.nationality,
        p.roomType,
        p.hotel,
        p.additional_services.join(","),
        p.price,
        p.email,
        p.phone,
        p.allergy || "",
        p.emergency_phone || "",
      ]
        .map((v) => `"${v || ""}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking_${selectedTourData?.title || "tour"}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification("success", "Booking data exported to CSV");
  }, [passengers, selectedTourData, showNotification]);

  const saveOrder = useCallback(async () => {
    console.log("BookingSummaryStep: saveOrder called", {
      paymentMethod,
      passengersLength: passengers.length,
      selectedTour,
      departureDate,
    });

    const tourData = tours.find((t: Tour) => t.title === selectedTour);
    if (!tourData) {
      showNotification("error", "Selected tour not found");
      return;
    }

    if (tourData.seats !== undefined && tourData.seats < passengers.length) {
      showNotification(
        "error",
        "Cannot save booking. The tour is fully booked."
      );
      return;
    }

    setLoading(true);
    try {
      const totalPrice = passengers.reduce((sum, p) => sum + (p.price || 0), 0);
      const commission = totalPrice * 0.05;

      const newOrder: Partial<Order> = {
        user_id: currentUser.userId,
        tour_id: tourData.id,
        phone: passengers[0]?.phone || null,
        last_name: passengers[0]?.last_name || null,
        first_name: passengers[0]?.first_name || null,
        email: passengers[0]?.email || null,
        age: passengers[0]?.age || null,
        gender: passengers[0]?.gender || null,
        passport_number: passengers[0]?.passport_number || null,
        passport_expire: passengers[0]?.passport_expire || null,
        passport_copy: passengers[0]?.passport_upload || null,
        created_by: currentUser.userId,
        createdBy: currentUser.username || currentUser.email || "Unknown",
        tour: tourData.title,
        edited_by: null,
        edited_at: null,
        travel_choice: tourData.title,
        status: currentUser.role !== "user" ? "confirmed" : "pending",
        hotel: passengers[0]?.hotel || null,
        room_number: passengers[0]?.room_allocation || null,
        payment_method: paymentMethod.join(","), // Store as comma-separated string
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departureDate: departureDate,
        show_in_provider: currentUser.role !== "user" ? showInProvider : false,
        total_price: totalPrice,
        total_amount: totalPrice,
        paid_amount: 0,
        balance: totalPrice,
        commission,
        passenger_count: passengers.length,
      };

      console.log("BookingSummaryStep: saveOrder inserting order", {
        newOrder,
      });

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([newOrder])
        .select()
        .single();
      if (orderError) {
        console.error("BookingSummaryStep: Order insertion failed", {
          orderError,
          details: orderError?.details,
          hint: orderError?.hint,
          code: orderError?.code,
        });
        throw new Error(`Order insertion failed: ${orderError.message}`);
      }

      const passengersWithOrderId = passengers.map((p) => {
        const { id, tour_title, departure_date, ...rest } = p;
        return {
          ...rest,
          order_id: orderData.id,
          status: currentUser.role !== "user" ? "active" : "pending",
          serial_no:
            rest.serial_no ||
            `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        };
      });

      console.log("BookingSummaryStep: Inserting passengers", {
        passengersWithOrderId,
      });

      const { error: passengerError } = await supabase
        .from("passengers")
        .insert(passengersWithOrderId);
      if (passengerError) {
        console.error("BookingSummaryStep: Passenger insertion failed", {
          passengerError,
          details: passengerError?.details,
          hint: passengerError?.hint,
          code: passengerError?.code,
        });
        throw new Error(
          `Passenger insertion failed: ${passengerError.message}`
        );
      }

      setOrders((prev) => [
        ...prev,
        {
          ...newOrder,
          id: String(orderData.id),
          passengers: passengersWithOrderId as Passenger[],
          show_in_provider: newOrder.show_in_provider ?? false,
        } as Order,
      ]);

      // Reset state for a clean step 1
      setPassengers([]);
      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod([]);
      setActiveStep(1);
      setShowInProvider(false);
      setExpandedPassengerId(null);
      setErrors([]);

      // Delay notification for smoother UX
      setTimeout(() => {
        showNotification(
          "success",
          currentUser.role !== "user"
            ? "Booking confirmed successfully"
            : "Booking request submitted. Awaiting manager approval."
        );
      }, 300);
    } catch (error) {
      console.error("BookingSummaryStep: Error saving booking", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      showNotification(
        "error",
        `Error saving booking: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  }, [
    paymentMethod,
    tours,
    selectedTour,
    passengers,
    currentUser,
    departureDate,
    showInProvider,
    setErrors,
    showNotification,
    setLoading,
    setOrders,
    setPassengers,
    setSelectedTour,
    setDepartureDate,
    setPaymentMethod,
    setActiveStep,
    setShowInProvider,
    setExpandedPassengerId,
  ]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <BookingSummary
        selectedTour={selectedTourData?.name || selectedTour}
        departureDate={departureDate}
        passengers={passengers}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        errors={errors}
        setErrors={setErrors}
        downloadCSV={handleDownloadCSV}
        saveOrder={saveOrder}
        setActiveStep={setActiveStep}
        loading={loading}
        showInProvider={showInProvider}
        setShowInProvider={setShowInProvider}
        currentUser={currentUser}
        onBack={() => setActiveStep(3)}
      />
    </div>
  );
}
