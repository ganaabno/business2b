import { supabase } from "../supabaseClient";
import type {
  Tour,
  Passenger,
  User as UserType,
  ValidationError,
  Order,
} from "../types/type";
import { checkSeatLimit } from "../utils/seatLimitChecks";
import { useEffect, useState } from "react";

interface SupabasePassenger {
  subPassengerCount: number;
  hasSubPassengers: boolean;
  mainPassengerId: string | null;
  id: string;
  order_id: string;
  user_id: string | null;
  tour_title: string;
  departure_date: string;
  name: string;
  room_allocation: string;
  serial_no: string;
  last_name: string;
  first_name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  passport_number: string;
  passport_expire: string;
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

export const generatePassengerId = (): string =>
  `passenger_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  selectedTourData?: Tour
): Passenger => {
  const serialNo = (existingPassengers.length + 1).toString();
  const lastPassenger = existingPassengers[existingPassengers.length - 1];

  const defaultRoomType = (() => {
    if (existingPassengers.length === 0) return "";
    if (
      lastPassenger?.roomType === "Double" &&
      existingPassengers.length % 2 === 1
    ) {
      return "Double";
    }
    return "";
  })();

  const inheritedDetails = lastPassenger
    ? {
        nationality: lastPassenger.nationality,
        hotel: lastPassenger.hotel,
        emergency_phone: lastPassenger.emergency_phone,
      }
    : {
        nationality: "Mongolia",
        hotel: "",
        emergency_phone: "",
      };

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.userId,
    tour_title: selectedTourData?.title || "",
    departure_date: "",
    name: "",
    room_allocation: "",
    serial_no: serialNo,
    last_name: "",
    first_name: "",
    date_of_birth: "",
    age: 0,
    gender: "",
    passport_number: "",
    passport_expire: "",
    nationality: inheritedDetails.nationality,
    roomType: defaultRoomType,
    hotel: inheritedDetails.hotel,
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: "",
    passport_upload: "",
    allergy: "",
    emergency_phone: inheritedDetails.emergency_phone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "pending",
    is_blacklisted: false,
    blacklisted_date: new Date().toISOString(),
    notes: "",
    seat_count: 0,
    tour_id: "",
    passenger_number: "",
    main_passenger_id: null,
    sub_passenger_count: 0,
    has_sub_passengers: false,
    booking_number: null,
    orders: null,
    note: "",
    is_request: undefined,
    pax_type: "Adult",
  };
};

export const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()))
    age--;
  return age;
};

export const calculateServicePrice = (
  services: string[],
  tourData: Tour
): number => {
  return services.reduce((sum, serviceName) => {
    const service = tourData.services.find((s) => s.name === serviceName);
    return sum + (service ? service.price : 0);
  }, tourData.base_price || 0);
};

export const validatePassenger = (
  passenger: Passenger,
  departureDate: string
): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!passenger.first_name.trim())
    errors.push({
      field: `passenger_${passenger.id}_first_name`,
      message: "First name is required",
    });
  if (!passenger.last_name.trim())
    errors.push({
      field: `passenger_${passenger.id}_last_name`,
      message: "Last name is required",
    });
  if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
    errors.push({
      field: `passenger_${passenger.id}_email`,
      message: "Valid email is required",
    });
  if (!passenger.phone?.trim())
    errors.push({
      field: `passenger_${passenger.id}_phone`,
      message: "Phone number is required",
    });
  if (!passenger.nationality)
    errors.push({
      field: `passenger_${passenger.id}_nationality`,
      message: "Nationality is required",
    });
  if (!passenger.gender)
    errors.push({
      field: `passenger_${passenger.id}_gender`,
      message: "Gender is required",
    });
  if (!passenger.passport_number?.trim())
    errors.push({
      field: `passenger_${passenger.id}_passport_number`,
      message: "Passport number is required",
    });
  if (!passenger.passport_expire)
    errors.push({
      field: `passenger_${passenger.id}_passport_expire`,
      message: "Passport expire date is required",
    });
  else {
    const expireDate = new Date(passenger.passport_expire);
    const minDate = new Date(departureDate);
    minDate.setMonth(minDate.getMonth() + 6);
    if (expireDate < minDate)
      errors.push({
        field: `passenger_${passenger.id}_passport_expire`,
        message:
          "Passport must be valid for at least 6 months from departure date",
      });
  }
  if (!passenger.roomType)
    errors.push({
      field: `passenger_${passenger.id}_roomType`,
      message: "Room type is required",
    });
  if (!passenger.hotel)
    errors.push({
      field: `passenger_${passenger.id}_hotel`,
      message: "Hotel selection is required",
    });
  return errors;
};

export const usePassengerSubscriptions = ({
  currentUser,
  tours,
  orders,
  setPassengers,
  setOrders,
  setTours,
  selectedTourData,
  departureDate,
  wrappedShowNotification,
}: {
  currentUser: UserType;
  tours: Tour[];
  orders: Order[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  selectedTourData?: Tour;
  departureDate: string;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  useEffect(() => {
    const passengerSubscription = supabase.channel("passengers_channel").on(
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
                      p.orders?.tours?.title || p.tour_title || "Unknown Tour",
                    departure_date:
                      p.orders?.departureDate || p.departure_date || "",
                    name: p.name,
                    room_allocation: p.room_allocation,
                    serial_no: p.serial_no,
                    last_name: p.last_name,
                    first_name: p.first_name,
                    date_of_birth: p.date_of_birth,
                    age: p.age,
                    gender: p.gender,
                    passport_number: p.passport_number,
                    passport_expire: p.passport_expire,
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
                    seat_count: (p as any).seat_count ?? 0,
                    tour_id: p.tour_title,
                    passenger_number: p.passport_number,
                    main_passenger_id: p.mainPassengerId,
                    has_sub_passengers: p.hasSubPassengers,
                    sub_passenger_count: p.subPassengerCount,
                    booking_number: null,
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
          console.error("Error in passenger real-time handler:", error);
          wrappedShowNotification("error", "Failed to refresh passengers");
        }
      }
    );

    const orderSubscription = supabase.channel("orders_channel").on(
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
          const [passengers, setPassengers] = useState<Passenger[]>([]);

          setOrders(
            data.map(
              (o): Order => ({
                id: o.id,
                order_id: String(o.id), // ✅ ADD THIS
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
                room_number: o.room_number,
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
                passport_copy_url: o.passport_copy_url,
                passenger_count: o.passenger_count,
                booking_confirmation: o.booking_confirmation || null,
                room_allocation: "",
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
          console.error("Error in order real-time handler:", error);
          wrappedShowNotification("error", "Failed to refresh orders");
        }
      }
    );

    const tourSubscription = supabase.channel("tours_channel").on(
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
          const validatedTours = data
            .filter((tour) => {
              const isValid = tour.id && tour.title;
              if (!isValid) console.warn("Invalid tour data:", tour);
              return isValid;
            })
            .map((tour) => tour as Tour); // cast after filtering

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
    );

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
    selectedTourData,
    departureDate,
    wrappedShowNotification,
  ]);
};

export const addPassenger = async ({
  currentUser,
  bookingPassengers,
  selectedTourData,
  departureDate,
  setPassengers,
  setExpandedPassengerId,
  wrappedShowNotification,
}: {
  currentUser: UserType;
  bookingPassengers: Passenger[];
  selectedTourData?: Tour;
  departureDate: string;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  const MAX_PASSENGERS = 20;
  if (bookingPassengers.length >= MAX_PASSENGERS) {
    wrappedShowNotification(
      "error",
      `Maximum ${MAX_PASSENGERS} passengers allowed per booking`
    );
    return;
  }
  if (!selectedTourData) {
    wrappedShowNotification("error", "Cannot add passenger. No tour selected.");
    return;
  }
  try {
    const newPassenger = createNewPassenger(
      currentUser,
      bookingPassengers,
      selectedTourData
    );
    setPassengers((prev) => [
      ...prev.filter(
        (p) =>
          p.order_id !== "" || !bookingPassengers.some((bp) => bp.id === p.id)
      ),
      {
        ...newPassenger,
        tour_title: selectedTourData.title || "Unknown Tour",
        departure_date: departureDate,
      },
    ]);
    setExpandedPassengerId(newPassenger.id);
    wrappedShowNotification("success", `Passenger added`);

    if (selectedTourData.id && departureDate) {
      const { isValid, message } = await checkSeatLimit(
        selectedTourData.id,
        departureDate
      );
      wrappedShowNotification(isValid ? "success" : "error", message);
    }
  } catch (error) {
    console.error("Error adding passenger:", error);
    wrappedShowNotification("error", "Failed to add passenger");
  }
};

export const addMultiplePassengers = async ({
  count,
  currentUser,
  bookingPassengers,
  selectedTourData,
  departureDate,
  setPassengers,
  setExpandedPassengerId,
  wrappedShowNotification,
}: {
  count: number;
  currentUser: UserType;
  bookingPassengers: Passenger[];
  selectedTourData?: Tour;
  departureDate: string;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  const MAX_PASSENGERS = 20;
  if (bookingPassengers.length + count > MAX_PASSENGERS) {
    wrappedShowNotification(
      "error",
      `Cannot add ${count} passengers. Maximum ${MAX_PASSENGERS} allowed.`
    );
    return;
  }
  if (
    !selectedTourData ||
    (selectedTourData.seats !== undefined &&
      bookingPassengers.length + count > selectedTourData.seats)
  ) {
    wrappedShowNotification(
      "error",
      "Cannot add passengers. Tour is fully booked or invalid."
    );
    return;
  }

  try {
    const newPassengers = Array.from({ length: count }, () =>
      createNewPassenger(currentUser, bookingPassengers, selectedTourData)
    ).map((p, idx) => ({
      ...p,
      serial_no: (bookingPassengers.length + idx + 1).toString(),
      tour_title: selectedTourData.title || "Unknown Tour",
      departure_date: departureDate,
    }));
    setPassengers((prev) => [
      ...prev.filter(
        (p) =>
          p.order_id !== "" || !bookingPassengers.some((bp) => bp.id === p.id)
      ),
      ...newPassengers,
    ]);
    setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
    wrappedShowNotification("success", `${count} passengers added`);

    if (selectedTourData.id && departureDate) {
      const { isValid, message } = await checkSeatLimit(
        selectedTourData.id,
        departureDate
      );
      wrappedShowNotification(isValid ? "success" : "error", message);
    }
  } catch (error) {
    console.error("Error adding passengers:", error);
    wrappedShowNotification("error", `Failed to add ${count} passengers`);
  }
};

export const updatePassenger = async ({
  id,
  field,
  value,
  passengers,
  tours,
  selectedTour,
  currentUser,
  setPassengers,
  wrappedShowNotification,
  setLoading,
}: {
  id: string;
  field: keyof Passenger;
  value: any;
  passengers: Passenger[];
  tours: Tour[];
  selectedTour: string;
  currentUser: UserType;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const updatedPassengers = [...passengers];
  const passengerIndex = passengers.findIndex(
    (p) => p.id === id && p.user_id === currentUser.userId
  );
  if (passengerIndex === -1) {
    wrappedShowNotification(
      "error",
      "Passenger not found or not owned by user"
    );
    return;
  }

  updatedPassengers[passengerIndex] = {
    ...updatedPassengers[passengerIndex],
    [field]: value,
  };

  if (field === "date_of_birth" && value) {
    updatedPassengers[passengerIndex].age = calculateAge(value);
  }

  if (field === "additional_services") {
    const tour = tours.find((t) => t.title === selectedTour);
    if (tour) {
      updatedPassengers[passengerIndex].price = calculateServicePrice(
        value as string[],
        tour
      );
    }
  }

  if (field === "first_name" || field === "last_name") {
    const first = updatedPassengers[passengerIndex].first_name || "";
    const last = updatedPassengers[passengerIndex].last_name || "";
    updatedPassengers[passengerIndex].name = `${first} ${last}`.trim();
  }

  if (field === "passport_upload" && value instanceof File) {
    try {
      setLoading(true);
      const fileExt = value.name.split(".").pop();
      const fileName = `passport_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("passports")
        .upload(fileName, value);
      if (error) {
        wrappedShowNotification(
          "error",
          `Passport upload failed: ${error.message}`
        );
        return;
      }
      updatedPassengers[passengerIndex].passport_upload = data.path;
      wrappedShowNotification("success", "Passport uploaded");
    } catch (error) {
      wrappedShowNotification("error", "Failed to upload passport");
    } finally {
      setLoading(false);
    }
  }

  updatedPassengers[passengerIndex].updated_at = new Date().toISOString();
  setPassengers(updatedPassengers);
};

export const removePassenger = ({
  id,
  passengers,
  bookingPassengers,
  expandedPassengerId,
  currentUser,
  setPassengers,
  setExpandedPassengerId,
  wrappedShowNotification,
}: {
  id: string;
  passengers: Passenger[];
  bookingPassengers: Passenger[];
  expandedPassengerId: string | null;
  currentUser: UserType;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  const passengerIndex = passengers.findIndex(
    (p) => p.id === id && p.user_id === currentUser.userId
  );
  if (passengerIndex === -1) {
    wrappedShowNotification(
      "error",
      "Passenger not found or not owned by user"
    );
    return;
  }

  if (
    bookingPassengers.length === 1 &&
    passengers[passengerIndex].order_id === ""
  ) {
    wrappedShowNotification(
      "error",
      "At least one passenger is required for a new booking"
    );
    return;
  }

  try {
    const updatedPassengers = passengers.filter((p) => p.id !== id);
    const reNumberedPassengers = updatedPassengers.map((passenger, i) => ({
      ...passenger,
      serial_no:
        passenger.user_id === currentUser.userId && passenger.order_id === ""
          ? (i + 1).toString()
          : passenger.serial_no,
      updated_at: new Date().toISOString(),
    }));
    setPassengers(reNumberedPassengers);
    if (expandedPassengerId === id) {
      setExpandedPassengerId(null);
    }
    wrappedShowNotification("success", `Passenger removed`);
  } catch (error) {
    console.error("Error removing passenger:", error);
    wrappedShowNotification("error", "Failed to remove passenger");
  }
};

export const clearAllPassengers = ({
  bookingPassengers,
  setShowConfirmModal,
}: {
  bookingPassengers: Passenger[];
  setShowConfirmModal: React.Dispatch<
    React.SetStateAction<{
      action: "clearAll" | "resetForm";
      message: string;
    } | null>
  >;
}) => {
  setShowConfirmModal({
    action: "clearAll",
    message: `Are you sure you want to remove all ${bookingPassengers.length} unsubmitted passengers?`,
  });
};

export const resetBookingForm = ({
  setShowConfirmModal,
}: {
  setShowConfirmModal: React.Dispatch<
    React.SetStateAction<{
      action: "clearAll" | "resetForm";
      message: string;
    } | null>
  >;
}) => {
  setShowConfirmModal({
    action: "resetForm",
    message:
      "Are you sure you want to reset the entire booking? All unsubmitted data will be lost.",
  });
};

export const handleConfirmAction = ({
  action,
  bookingPassengers,
  passengers,
  currentUser,
  selectedTourData,
  departureDate,
  setPassengers,
  setExpandedPassengerId,
  setSelectedTour,
  setDepartureDate,
  setPaymentMethod,
  setActiveStep,
  setValidationErrors,
  wrappedShowNotification,
}: {
  action: "clearAll" | "resetForm";
  bookingPassengers: Passenger[];
  passengers: Passenger[];
  currentUser: UserType;
  selectedTourData?: Tour;
  departureDate: string;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  setActiveStep?: React.Dispatch<React.SetStateAction<number>>;
  setPaymentMethod: React.Dispatch<React.SetStateAction<string>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  if (action === "clearAll") {
    if (bookingPassengers.length === 0) {
      wrappedShowNotification("error", "No unsubmitted passengers to clear");
      return;
    }
    const updatedPassengers = passengers.filter(
      (p) => p.user_id !== currentUser.userId || p.order_id !== ""
    );
    setPassengers(updatedPassengers);
    setExpandedPassengerId(null);
    wrappedShowNotification("success", "All unsubmitted passengers removed");

    if (selectedTourData?.id && departureDate) {
      checkSeatLimit(selectedTourData.id, departureDate).then(
        ({ isValid, message }) => {
          wrappedShowNotification(isValid ? "success" : "error", message);
        }
      );
    }
  } else if (action === "resetForm") {
    const updatedPassengers = passengers.filter(
      (p) => p.user_id !== currentUser.userId || p.order_id !== ""
    );
    setPassengers(updatedPassengers);
    setSelectedTour("");
    setDepartureDate("");
    setPaymentMethod("");
    setActiveStep?.("tourSelection" as any);
    setExpandedPassengerId(null);
    setValidationErrors([]);
    wrappedShowNotification("success", "Booking form reset");
  }
};

export const validateBooking = ({
  selectedTour,
  departureDate,
  bookingPassengers,
  setValidationErrors,
}: {
  selectedTour: string;
  departureDate: string;
  bookingPassengers: Passenger[];
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
}): boolean => {
  const allErrors: ValidationError[] = [];
  if (!selectedTour)
    allErrors.push({ field: "tour", message: "Please select a tour" });
  if (!departureDate)
    allErrors.push({
      field: "departure",
      message: "Please select a departure date",
    });
  if (bookingPassengers.length === 0)
    allErrors.push({
      field: "passengers",
      message: "At least one passenger is required",
    });

  bookingPassengers.forEach((passenger) => {
    const passengerErrors = validatePassenger(passenger, departureDate);
    allErrors.push(...passengerErrors);
  });

  setValidationErrors(allErrors);
  return allErrors.length === 0;
};

export const saveOrder = async ({
  tours,
  selectedTour,
  departureDate,
  bookingPassengers,
  paymentMethod,
  currentUser,
  setOrders,
  setPassengers,
  setSelectedTour,
  setDepartureDate,
  setPaymentMethod,
  setExpandedPassengerId,
  setValidationErrors,
  wrappedShowNotification,
  setLoading,
  setActiveStep,
}: {
  tours: Tour[];
  selectedTour: string;
  departureDate: string;
  bookingPassengers: Passenger[];
  paymentMethod: string;
  currentUser: UserType;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  setPaymentMethod: React.Dispatch<React.SetStateAction<string>>;
  setActiveStep?: React.Dispatch<React.SetStateAction<number>>;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  if (!paymentMethod) {
    setValidationErrors([
      { field: "payment", message: "Please select a payment method" },
    ]);
    wrappedShowNotification("error", "Please select a payment method");
    return;
  }

  if (
    !validateBooking({
      selectedTour,
      departureDate,
      bookingPassengers,
      setValidationErrors,
    })
  ) {
    wrappedShowNotification(
      "error",
      "Please fix the validation errors before proceeding"
    );
    return;
  }

  const tourData = tours.find((t) => t.title === selectedTour);
  if (!tourData) {
    wrappedShowNotification("error", "Selected tour not found");
    return;
  }

  if (
    tourData.seats !== undefined &&
    tourData.seats < bookingPassengers.length
  ) {
    wrappedShowNotification(
      "error",
      "Cannot save booking. The tour is fully booked."
    );
    return;
  }

  setLoading(true);

  try {
    const newOrder: Partial<Order> = {
      user_id: currentUser.userId,
      tour_id: tourData.id,
      phone: bookingPassengers[0].phone || null,
      last_name: bookingPassengers[0].last_name || null,
      first_name: bookingPassengers[0].first_name || null,
      email: bookingPassengers[0].email || null,
      age: bookingPassengers[0].age || null,
      gender: bookingPassengers[0].gender || null,
      passport_number: bookingPassengers[0].passport_number || null,
      passport_expire: bookingPassengers[0].passport_expire,
      passport_copy: bookingPassengers[0].passport_upload || null,
      created_by: currentUser.userId,
      createdBy: currentUser.username || currentUser.email,
      tour: tourData.title,
      edited_by: null,
      edited_at: null,
      travel_choice: tourData.title,
      status: "pending",
      hotel: bookingPassengers[0].hotel || null,
      room_number: bookingPassengers[0].room_allocation || null,
      payment_method: paymentMethod,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      departureDate: departureDate,
      show_in_provider: true,

      // ✅ fix: ensure null prices are treated as 0
      total_price: bookingPassengers.reduce(
        (sum, p) => sum + (p.price ?? 0),
        0
      ),
      total_amount: bookingPassengers.length,
      paid_amount: 0,
      balance: bookingPassengers.reduce((sum, p) => sum + (p.price ?? 0), 0),
    };

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([newOrder])
      .select()
      .single();
    if (orderError)
      throw new Error(`Order insertion failed: ${orderError.message}`);

    const passengersWithOrderId = bookingPassengers.map((p) => {
      const { id, tour_title, departure_date, ...rest } = p;
      return {
        ...rest,
        order_id: orderData.id,
        status: "pending",
        serial_no:
          rest.serial_no ||
          `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      };
    });

    const { error: passengerError } = await supabase
      .from("passengers")
      .insert(passengersWithOrderId);
    if (passengerError)
      throw new Error(`Passenger insertion failed: ${passengerError.message}`);

    setOrders((prev) => [
      ...prev,
      {
        ...newOrder,
        id: String(orderData.id),
        passengers: passengersWithOrderId as Passenger[],
        show_in_provider: newOrder.show_in_provider ?? true,
      } as Order,
    ]);

    setPassengers((prev) =>
      prev.filter((p) => !bookingPassengers.some((bp) => bp.id === p.id))
    );
    setSelectedTour("");
    setDepartureDate("");
    setPaymentMethod("");
    setExpandedPassengerId(null);
    setValidationErrors([]);
    wrappedShowNotification(
      "success",
      "Booking request submitted. Awaiting manager approval."
    );
  } catch (error) {
    console.error("Error saving booking:", error);
    wrappedShowNotification(
      "error",
      `Error saving booking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    setLoading(false);
  }
};

export const handleUploadCSV = ({
  e,
  tours,
  selectedTour,
  departureDate,
  bookingPassengers,
  currentUser,
  setPassengers,
  setExpandedPassengerId,
  wrappedShowNotification,
}: {
  e: React.ChangeEvent<HTMLInputElement>;
  tours: Tour[];
  selectedTour: string;
  departureDate: string;
  bookingPassengers: Passenger[];
  currentUser: UserType;
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    wrappedShowNotification("error", "Please upload a CSV file");
    return;
  }

  const tourData = tours.find((t) => t.title === selectedTour);
  if (!tourData) {
    wrappedShowNotification("error", "No tour selected");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        wrappedShowNotification(
          "error",
          "CSV file must contain at least a header and one data row"
        );
        return;
      }

      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));
      const requiredHeaders = [
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
      if (!requiredHeaders.every((h) => headers.includes(h))) {
        wrappedShowNotification(
          "error",
          "CSV file is missing required headers"
        );
        return;
      }

      const data = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        return headers.reduce((obj: Record<string, string>, header, i) => {
          obj[header] = values[i] || "";
          return obj;
        }, {});
      });

      if (
        tourData.seats !== undefined &&
        data.length + bookingPassengers.length > tourData.seats
      ) {
        wrappedShowNotification(
          "error",
          "Cannot import passengers. The tour is fully booked."
        );
        return;
      }

      const newPassengers = data.map((row, idx) => {
        const passenger: Passenger = {
          id: generatePassengerId(),
          order_id: "",
          user_id: currentUser.userId,
          tour_title: tourData.title,
          departure_date: departureDate,
          name: `${row["First Name"]} ${row["Last Name"]}`.trim(),
          room_allocation: row["Room Allocation"] || "",
          serial_no: (bookingPassengers.length + idx + 1).toString(),
          last_name: row["Last Name"] || "",
          first_name: row["First Name"] || "",
          date_of_birth: row["Date of Birth"] || "",
          age: calculateAge(row["Date of Birth"]),
          gender: row["Gender"] || "",
          passport_number: row["Passport Number"] || "",
          passport_expire: row["Passport Expiry"] || "",
          nationality: row["Nationality"] || "Mongolia",
          roomType: row["Room Type"] || "",
          hotel: row["Hotel"] || "",
          additional_services: row["Additional Services"]
            ? row["Additional Services"]
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
          price: parseFloat(row["Price"]) || tourData.base_price || 0,
          email: row["Email"] || "",
          phone: row["Phone"] || "",
          passport_upload: "",
          allergy: row["Allergy"] || "",
          emergency_phone: row["Emergency Phone"] || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "pending",
          is_blacklisted: false,
          blacklisted_date: new Date().toISOString(),
          notes: "",
          seat_count: 0,
          tour_id: "",
          passenger_number: "",
          main_passenger_id: null,
          sub_passenger_count: 0,
          has_sub_passengers: false,
          booking_number: null,
          orders: null,
          note: "",
          is_request: undefined,
          pax_type: "Adult",
        };
        if (tourData && passenger.additional_services.length > 0) {
          passenger.price = calculateServicePrice(
            passenger.additional_services,
            tourData
          );
        }
        return passenger;
      });

      setPassengers((prev) => [
        ...prev.filter(
          (p) =>
            p.order_id !== "" || !bookingPassengers.some((bp) => bp.id === p.id)
        ),
        ...newPassengers,
      ]);
      setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
      wrappedShowNotification(
        "success",
        `${newPassengers.length} passengers imported from CSV`
      );

      if (tourData.id && departureDate) {
        checkSeatLimit(tourData.id, departureDate).then(
          ({ isValid, message }) => {
            wrappedShowNotification(isValid ? "success" : "error", message);
          }
        );
      }
    } catch (error) {
      console.error("Error parsing CSV:", error);
      wrappedShowNotification(
        "error",
        "Failed to parse CSV file. Please check the format."
      );
    }
  };
  reader.readAsText(file);
  e.target.value = "";
};

export const handleDownloadCSV = ({
  bookingPassengers,
  selectedTourData,
  wrappedShowNotification,
}: {
  bookingPassengers: Passenger[];
  selectedTourData?: Tour;
  wrappedShowNotification: (type: "success" | "error", message: string) => void;
}) => {
  if (bookingPassengers.length === 0) {
    wrappedShowNotification("error", "No unsubmitted passengers to export");
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

  const rows = bookingPassengers.map((p) =>
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
      .map((v) => `"${v}"`)
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
  wrappedShowNotification("success", "Booking data exported to CSV");
};
