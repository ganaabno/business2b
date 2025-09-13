import { type Dispatch, type SetStateAction, useCallback, useRef, useState, useMemo, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type { Tour, Passenger, User as UserType, ValidationError, Order } from "../types/type";
import Notifications from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import BookingSummary from "../Parts/BookingSummary";
import TourSelectionUser from "../Pages/userInterface/TourSlelectionUser";
import AddPassengerTabUser from "../components/AddPassengerTabUser";
import { checkSeatLimit } from "../utils/seatLimitChecks";

// Type for Supabase passenger data with nested orders and tours
interface SupabasePassenger {
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
  status: "pending" | "approved" | "rejected" | "active" | "inactive" | "cancelled";
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

// Generate unique passenger ID
const generatePassengerId = (): string => `passenger_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// Create new passenger with smart defaults
const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  selectedTourData?: Tour
): Passenger => {
  const serialNo = (existingPassengers.length + 1).toString();
  const lastPassenger = existingPassengers[existingPassengers.length - 1];

  const defaultRoomType = (() => {
    if (existingPassengers.length === 0) return "";
    if (lastPassenger?.roomType === "Double" && existingPassengers.length % 2 === 1) {
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
    passport_expiry: "",
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
  };
};

// Format date for display
function formatDisplayDate(s: string | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : s;
}

interface UserInterfaceProps {
  tours: Tour[];
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setTours: Dispatch<SetStateAction<Tour[]>>;
  selectedTour: string;
  setSelectedTour: Dispatch<SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: Dispatch<SetStateAction<string>>;
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  onLogout?: () => Promise<void>;
}

export default function UserInterface({
  tours,
  orders,
  setOrders,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  passengers,
  setPassengers,
  errors,
  showNotification,
  currentUser,
  setTours,
}: UserInterfaceProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInProvider, setShowInProvider] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    action: "clearAll" | "resetForm" | null;
    message: string;
  } | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const newPassengerRef = useRef<HTMLDivElement | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(errors);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const MAX_PASSENGERS = 20;

  // Clear passengers for current user when entering step 2
  useEffect(() => {
    if (activeStep === 2) {
      setPassengers((prev) => prev.filter((p) => p.user_id !== currentUser.userId && p.order_id === ""));
    }
  }, [activeStep, currentUser.userId, setPassengers]);

  // Fetch all passengers for the current user
  const userPassengers = useMemo(() => {
    return passengers
      .filter((p) => p.user_id === currentUser.userId)
      .map((passenger) => {
        const order = orders.find((o) => o.id === passenger.order_id);
        const tour = tours.find((t) => t.id === order?.tour_id);
        return {
          ...passenger,
          tour_title: tour?.title || passenger.tour_title || "Unknown Tour",
          departure_date: order?.departureDate || passenger.departure_date || "",
        };
      });
  }, [passengers, orders, tours, currentUser.userId]);

  // Sort passengers by created_at descending
  const sortedPassengers = useMemo(() => {
    return [...userPassengers].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [userPassengers]);

  // Pagination logic
  const totalPages = Math.ceil(sortedPassengers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPassengers = sortedPassengers.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Filter passengers for BookingSummary (unsubmitted only)
  const bookingPassengers = useMemo(() => {
    const tour = tours.find((t) => t.title === selectedTour);
    return passengers
      .filter(
        (p) =>
          p.user_id === currentUser.userId &&
          p.tour_title === tour?.title &&
          p.departure_date === departureDate &&
          p.order_id === ""
      )
      .map((passenger) => {
        const order = orders.find((o) => o.id === passenger.order_id);
        const tourMatch = tours.find((t) => t.id === order?.tour_id || t.title === selectedTour);
        return {
          ...passenger,
          tour_title: tourMatch?.title || passenger.tour_title || "Unknown Tour",
          departure_date: order?.departureDate || passenger.departure_date || "",
        };
      });
  }, [passengers, orders, tours, currentUser.userId, selectedTour, departureDate]);

  // Get selected tour data for passenger creation
  const selectedTourData = useMemo(() => {
    const tour = tours.find((t) => t.title === selectedTour);
    return tour;
  }, [tours, selectedTour]);

  const [remainingSeats, setRemainingSeats] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (selectedTourData?.id && departureDate) {
      checkSeatLimit(selectedTourData.id, departureDate)
        .then(({ seats }) => {
          console.log(`Updated remaining seats for tour ${selectedTourData.id}: ${seats}`);
          setRemainingSeats(seats);
        })
        .catch((error) => {
          console.error("Error fetching remaining seats:", error);
          setRemainingSeats(0);
        });
    } else {
      setRemainingSeats(undefined);
    }
  }, [selectedTourData, departureDate]);

  const canAddPassenger = () => {
    if (bookingPassengers.length >= MAX_PASSENGERS) return false;
    if (!selectedTourData) return false;
    if (remainingSeats === undefined) return true;
    return remainingSeats > 0;
  };

  const wrappedShowNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
      showNotification(type, message);
    },
    [showNotification]
  );

  // Real-time subscriptions for passengers, orders, and tours
  useEffect(() => {
    // Passenger subscription
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
              .select(`
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
              `)
              .eq("user_id", currentUser.userId);
            if (error) {
              console.error("Error fetching updated passengers:", error);
              wrappedShowNotification("error", `Failed to refresh passengers: ${error.message}`);
              return;
            }
            setPassengers(
              data.map((p: SupabasePassenger): Passenger => ({
                id: p.id,
                order_id: p.order_id,
                user_id: p.user_id,
                tour_title: p.orders?.tours?.title || p.tour_title || "Unknown Tour",
                departure_date: p.orders?.departureDate || p.departure_date || "",
                name: p.name,
                room_allocation: p.room_allocation,
                serial_no: p.serial_no,
                last_name: p.last_name,
                first_name: p.first_name,
                date_of_birth: p.date_of_birth,
                age: p.age,
                gender: p.gender,
                passport_number: p.passport_number,
                passport_expiry: p.passport_expiry,
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
              }))
            );
            // Trigger seat limit check after passenger update
            if (selectedTourData?.id && departureDate) {
              const { isValid, message } = await checkSeatLimit(selectedTourData.id, departureDate);
              wrappedShowNotification(isValid ? "success" : "error", message);
            }
          } catch (error) {
            console.error("Error in passenger real-time handler:", error);
            wrappedShowNotification("error", "Failed to refresh passengers");
          }
        }
      )
      .subscribe();

    // Order subscription
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
              .select(`
                *,
                tours (
                  id,
                  title
                )
              `)
              .eq("user_id", currentUser.userId);
            if (error) {
              console.error("Error fetching updated orders:", error);
              wrappedShowNotification("error", `Failed to refresh orders: ${error.message}`);
              return;
            }
            setOrders(
              data.map((o): Order => ({
                id: o.id,
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
              }))
            );
            // Trigger seat limit check after order update
            if (selectedTourData?.id && departureDate) {
              const { isValid, message } = await checkSeatLimit(selectedTourData.id, departureDate);
              wrappedShowNotification(isValid ? "success" : "error", message);
            }
          } catch (error) {
            console.error("Error in order real-time handler:", error);
            wrappedShowNotification("error", "Failed to refresh orders");
          }
        }
      )
      .subscribe();

    // Tour subscription
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
            const { data, error } = await supabase
              .from("tours")
              .select(`
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
              wrappedShowNotification("error", `Failed to refresh tours: ${error.message}`);
              return;
            }
            // Validate data shape
            const validatedTours = data.filter((tour): tour is Tour => {
              const isValid = tour.id && tour.title;
              if (!isValid) {
                console.warn("Invalid tour data:", tour);
              }
              return isValid;
            });
            console.log("Updated tours:", JSON.stringify(validatedTours, null, 2));
            setTours(validatedTours);
            // Trigger seat limit check after tour update
            if (selectedTourData?.id && departureDate) {
              const { isValid, message, seats } = await checkSeatLimit(selectedTourData.id, departureDate);
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
  }, [currentUser.userId, setPassengers, setOrders, setTours, selectedTourData, departureDate, wrappedShowNotification]);

  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  const calculateServicePrice = (services: string[], tourData: Tour): number => {
    return services.reduce((sum, serviceName) => {
      const service = tourData.services.find((s) => s.name === serviceName);
      return sum + (service ? service.price : 0);
    }, tourData.base_price || 0);
  };

  const addPassenger = useCallback(async () => {
    if (!canAddPassenger()) {
      if (bookingPassengers.length >= MAX_PASSENGERS) {
        wrappedShowNotification("error", `Maximum ${MAX_PASSENGERS} passengers allowed per booking`);
      } else {
        wrappedShowNotification("error", "Cannot add passenger. Tour is fully booked or invalid.");
      }
      return;
    }

    try {
      const newPassenger = createNewPassenger(currentUser, bookingPassengers, selectedTourData);
      setPassengers((prev) => [
        ...prev,
        { ...newPassenger, tour_title: selectedTourData?.title || "Unknown Tour", departure_date: departureDate },
      ]);
      setExpandedPassengerId(newPassenger.id);
      wrappedShowNotification("success", `Passenger added`);
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

      // Trigger seat limit check after adding passenger
      if (selectedTourData?.id && departureDate) {
        const { isValid, message } = await checkSeatLimit(selectedTourData.id, departureDate);
        wrappedShowNotification(isValid ? "success" : "error", message);
      }
    } catch (error) {
      console.error("Error adding passenger:", error);
      wrappedShowNotification("error", "Failed to add passenger");
    }
  }, [bookingPassengers, currentUser, selectedTourData, departureDate, wrappedShowNotification, setPassengers]);

  const addMultiplePassengers = useCallback(
    async (count: number) => {
      if (!canAddPassenger() || bookingPassengers.length + count > MAX_PASSENGERS) {
        wrappedShowNotification("error", `Cannot add ${count} passengers. Maximum ${MAX_PASSENGERS} allowed.`);
        return;
      }
      if (selectedTourData?.seats !== undefined && bookingPassengers.length + count > selectedTourData.seats) {
        wrappedShowNotification("error", "Cannot add passengers. Tour is fully booked.");
        return;
      }
      try {
        const newPassengers = Array.from({ length: count }, () =>
          createNewPassenger(currentUser, bookingPassengers, selectedTourData)
        ).map((p, idx) => ({
          ...p,
          serial_no: (bookingPassengers.length + idx + 1).toString(),
          tour_title: selectedTourData?.title || "Unknown Tour",
          departure_date: departureDate,
        }));
        setPassengers((prev) => [...prev, ...newPassengers]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        wrappedShowNotification("success", `${count} passengers added`);
        newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

        // Trigger seat limit check after adding passengers
        if (selectedTourData?.id && departureDate) {
          const { isValid, message } = await checkSeatLimit(selectedTourData.id, departureDate);
          wrappedShowNotification(isValid ? "success" : "error", message);
        }
      } catch (error) {
        console.error("Error adding passengers:", error);
        wrappedShowNotification("error", `Failed to add ${count} passengers`);
      }
    },
    [bookingPassengers, currentUser, selectedTourData, departureDate, wrappedShowNotification, setPassengers, MAX_PASSENGERS]
  );

  const updatePassenger = async (passengerId: string, field: keyof Passenger, value: any) => {
    const updatedPassengers = [...passengers];
    const passengerIndex = passengers.findIndex((p) => p.id === passengerId && p.user_id === currentUser.userId);
    if (passengerIndex === -1) {
      wrappedShowNotification("error", "Passenger not found or not owned by user");
      return;
    }

    updatedPassengers[passengerIndex] = { ...updatedPassengers[passengerIndex], [field]: value };

    if (field === "date_of_birth" && value) {
      updatedPassengers[passengerIndex].age = calculateAge(value);
    }

    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[passengerIndex].price = calculateServicePrice(value as string[], tour);
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
        const fileName = `passport_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from("passports").upload(fileName, value);
        if (error) {
          wrappedShowNotification("error", `Passport upload failed: ${error.message}`);
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

  const removePassenger = useCallback(
    (passengerId: string) => {
      const passengerIndex = passengers.findIndex((p) => p.id === passengerId && p.user_id === currentUser.userId);
      if (passengerIndex === -1) {
        wrappedShowNotification("error", "Passenger not found or not owned by user");
        return;
      }

      if (bookingPassengers.length === 1 && passengers[passengerIndex].order_id === "") {
        wrappedShowNotification("error", "At least one passenger is required for a new booking");
        return;
      }

      try {
        const updatedPassengers = passengers.filter((p) => p.id !== passengerId);
        const reNumberedPassengers = updatedPassengers.map((passenger, i) => ({
          ...passenger,
          serial_no: passenger.user_id === currentUser.userId && passenger.order_id === "" ? (i + 1).toString() : passenger.serial_no,
          updated_at: new Date().toISOString(),
        }));
        setPassengers(reNumberedPassengers);
        if (expandedPassengerId === passengerId) {
          setExpandedPassengerId(null);
        }
        wrappedShowNotification("success", `Passenger removed`);

        // Trigger seat limit check after removing passenger
        if (selectedTourData?.id && departureDate) {
          checkSeatLimit(selectedTourData.id, departureDate).then(({ isValid, message }) => {
            wrappedShowNotification(isValid ? "success" : "error", message);
          });
        }
      } catch (error) {
        console.error("Error removing passenger:", error);
        wrappedShowNotification("error", "Failed to remove passenger");
      }
    },
    [bookingPassengers, passengers, expandedPassengerId, currentUser.userId, selectedTourData, departureDate, wrappedShowNotification, setPassengers]
  );

  const clearAllPassengers = useCallback(() => {
    setShowConfirmModal({
      action: "clearAll",
      message: `Are you sure you want to remove all ${bookingPassengers.length} unsubmitted passengers?`,
    });
  }, [bookingPassengers.length]);

  const resetBookingForm = useCallback(() => {
    setShowConfirmModal({
      action: "resetForm",
      message: "Are you sure you want to reset the entire booking? All unsubmitted data will be lost.",
    });
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (showConfirmModal?.action === "clearAll") {
      if (bookingPassengers.length === 0) {
        wrappedShowNotification("error", "No unsubmitted passengers to clear");
        setShowConfirmModal(null);
        return;
      }
      const updatedPassengers = passengers.filter((p) => p.user_id !== currentUser.userId || p.order_id !== "");
      setPassengers(updatedPassengers);
      setExpandedPassengerId(null);
      wrappedShowNotification("success", "All unsubmitted passengers removed");

      // Trigger seat limit check after clearing passengers
      if (selectedTourData?.id && departureDate) {
        checkSeatLimit(selectedTourData.id, departureDate).then(({ isValid, message }) => {
          wrappedShowNotification(isValid ? "success" : "error", message);
        });
      }
    } else if (showConfirmModal?.action === "resetForm") {
      const updatedPassengers = passengers.filter((p) => p.user_id !== currentUser.userId || p.order_id !== "");
      setPassengers(updatedPassengers);
      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod("");
      setActiveStep(1);
      setShowInProvider(false);
      setExpandedPassengerId(null);
      setValidationErrors([]);
      setIsGroup(false);
      setGroupName("");
      wrappedShowNotification("success", "Booking form reset");
    }
    setShowConfirmModal(null);
  }, [showConfirmModal, bookingPassengers, passengers, currentUser.userId, selectedTourData, departureDate, wrappedShowNotification, setPassengers, setSelectedTour, setDepartureDate]);

  const validatePassenger = (passenger: Passenger, departureDate: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!passenger.first_name.trim()) errors.push({ field: `passenger_${passenger.id}_first_name`, message: "First name is required" });
    if (!passenger.last_name.trim()) errors.push({ field: `passenger_${passenger.id}_last_name`, message: "Last name is required" });
    if (!passenger.email.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
      errors.push({ field: `passenger_${passenger.id}_email`, message: "Valid email is required" });
    if (!passenger.phone.trim()) errors.push({ field: `passenger_${passenger.id}_phone`, message: "Phone number is required" });
    if (!passenger.nationality) errors.push({ field: `passenger_${passenger.id}_nationality`, message: "Nationality is required" });
    if (!passenger.gender) errors.push({ field: `passenger_${passenger.id}_gender`, message: "Gender is required" });
    if (!passenger.passport_number.trim())
      errors.push({ field: `passenger_${passenger.id}_passport_number`, message: "Passport number is required" });
    if (!passenger.passport_expiry)
      errors.push({ field: `passenger_${passenger.id}_passport_expiry`, message: "Passport expiry date is required" });
    else {
      const expiryDate = new Date(passenger.passport_expiry);
      const minDate = new Date(departureDate);
      minDate.setMonth(minDate.getMonth() + 6);
      if (expiryDate < minDate)
        errors.push({
          field: `passenger_${passenger.id}_passport_expiry`,
          message: "Passport must be valid for at least 6 months from departure date",
        });
    }
    if (!passenger.roomType) errors.push({ field: `passenger_${passenger.id}_roomType`, message: "Room type is required" });
    if (!passenger.hotel) errors.push({ field: `passenger_${passenger.id}_hotel`, message: "Hotel selection is required" });
    return errors;
  };

  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour) allErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate) allErrors.push({ field: "departure", message: "Please select a departure date" });
    if (bookingPassengers.length === 0) allErrors.push({ field: "passengers", message: "At least one passenger is required" });

    bookingPassengers.forEach((passenger) => {
      const passengerErrors = validatePassenger(passenger, departureDate);
      allErrors.push(...passengerErrors);
    });

    setValidationErrors(allErrors);
    return allErrors.length === 0;
  };

  const saveOrder = async () => {
    if (!paymentMethod) {
      setValidationErrors([{ field: "payment", message: "Please select a payment method" }]);
      wrappedShowNotification("error", "Please select a payment method");
      return;
    }

    if (!validateBooking()) {
      wrappedShowNotification("error", "Please fix the validation errors before proceeding");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      wrappedShowNotification("error", "Selected tour not found");
      return;
    }

    if (tourData.seats !== undefined && tourData.seats < bookingPassengers.length) {
      wrappedShowNotification("error", "Cannot save booking. The tour is fully booked.");
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
        passport_expire: bookingPassengers[0].passport_expiry || null,
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
        show_in_provider: currentUser.role !== "user" ? showInProvider : true,
        total_price: bookingPassengers.reduce((sum, p) => sum + p.price, 0),
        total_amount: bookingPassengers.length,
        paid_amount: 0,
        balance: bookingPassengers.reduce((sum, p) => sum + p.price, 0),
      };

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([newOrder])
        .select()
        .single();
      if (orderError) throw new Error(`Order insertion failed: ${orderError.message}`);

      const passengersWithOrderId = bookingPassengers.map((p) => {
        const { id, tour_title, departure_date, ...rest } = p;
        return {
          ...rest,
          order_id: orderData.id,
          status: "pending",
          serial_no: rest.serial_no || `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        };
      });

      const { error: passengerError } = await supabase
        .from("passengers")
        .insert(passengersWithOrderId);
      if (passengerError) throw new Error(`Passenger insertion failed: ${passengerError.message}`);

      setOrders((prev) => [
        ...prev,
        {
          ...newOrder,
          id: String(orderData.id),
          passengers: passengersWithOrderId as Passenger[],
          show_in_provider: newOrder.show_in_provider ?? true,
        } as Order,
      ]);

      setPassengers((prev) => prev.filter((p) => !bookingPassengers.some((up) => up.id === p.id)));

      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod("");
      setActiveStep(1);
      setShowInProvider(false);
      setExpandedPassengerId(null);
      setValidationErrors([]);
      setIsGroup(false);
      setGroupName("");

      wrappedShowNotification("success", "Booking request submitted. Awaiting manager approval.");
    } catch (error) {
      console.error("Error saving booking:", error);
      wrappedShowNotification("error", `Error saving booking: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
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
        p.passport_expiry,
        p.nationality,
        p.roomType,
        p.hotel,
        p.additional_services.join(","),
        p.price,
        p.email,
        p.phone,
        p.allergy || "",
        p.emergency_phone || "",
      ].map((v) => `"${v}"`).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking_${selectedTourData?.title || "tour"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    wrappedShowNotification("success", "Booking data exported to CSV");
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          wrappedShowNotification("error", "CSV file must contain at least a header and one data row");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
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
          wrappedShowNotification("error", "CSV file is missing required headers");
          return;
        }

        const data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return headers.reduce((obj: Record<string, string>, header, i) => {
            obj[header] = values[i] || "";
            return obj;
          }, {});
        });

        if (tourData.seats !== undefined && data.length + bookingPassengers.length > tourData.seats) {
          wrappedShowNotification("error", "Cannot import passengers. The tour is fully booked.");
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
            passport_expiry: row["Passport Expiry"] || "",
            nationality: row["Nationality"] || "Mongolia",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || "",
            additional_services: row["Additional Services"]
              ? row["Additional Services"].split(",").map((s: string) => s.trim()).filter(Boolean)
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
          };
          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tourData);
          }
          return passenger;
        });

        setPassengers([...passengers, ...newPassengers]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        wrappedShowNotification("success", `${newPassengers.length} passengers imported from CSV`);
        newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

        // Trigger seat limit check after importing passengers
        if (tourData.id && departureDate) {
          checkSeatLimit(tourData.id, departureDate).then(({ isValid, message }) => {
            wrappedShowNotification(isValid ? "success" : "error", message);
          });
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        wrappedShowNotification("error", "Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const totalPrice = bookingPassengers.reduce((sum, p) => sum + p.price, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Notifications notification={notification} setNotification={setNotification} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <ProgressSteps activeStep={activeStep} />
        <ErrorSummary errors={validationErrors} />

        {activeStep === 1 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Your Booking</h3>
              <p className="text-sm text-gray-600">Select your tour, date, and add passengers to get started</p>
            </div>
            <TourSelectionUser
              tours={tours}
              selectedTour={selectedTour}
              setSelectedTour={setSelectedTour}
              departureDate={departureDate}
              setDepartureDate={setDepartureDate}
              errors={validationErrors}
              setActiveStep={setActiveStep}
              userRole={currentUser.role}
              showAvailableSeats={currentUser.role === "admin" || currentUser.role === "superadmin"}
            />
          </div>
        )}

        {activeStep === 2 && (
          <AddPassengerTabUser
            tours={tours}
            selectedTour={selectedTour}
            departureDate={departureDate}
            setDepartureDate={setDepartureDate}
            passengers={bookingPassengers}
            setPassengers={setPassengers}
            errors={validationErrors}
            addPassenger={addPassenger}
            addMultiplePassengers={addMultiplePassengers}
            clearAllPassengers={clearAllPassengers}
            handleUploadCSV={handleUploadCSV}
            updatePassenger={updatePassenger}
            removePassenger={removePassenger}
            showNotification={wrappedShowNotification}
            currentUser={currentUser}
            setActiveStep={setActiveStep}
            validateBooking={validateBooking}
          />
        )}

        {activeStep === 3 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <BookingSummary
              selectedTour={selectedTourData?.name || ""}
              departureDate={departureDate}
              passengers={bookingPassengers}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              errors={validationErrors}
              saveOrder={saveOrder}
              setActiveStep={setActiveStep}
              loading={loading}
              setShowInProvider={setShowInProvider}
              currentUser={currentUser}
            />
          </div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Action</h3>
              <p className="text-sm text-gray-600 mb-6">{showConfirmModal.message}</p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConfirmModal(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {sortedPassengers.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Bookings</h3>
            <div className="space-y-4">
              {paginatedPassengers.map((passenger) => (
                <div key={passenger.id} className="border-b border-gray-200 py-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Tour:</span> {passenger.tour_title}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Departure:</span> {formatDisplayDate(passenger.departure_date)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Name:</span> {passenger.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Status:</span> {passenger.status}
                  </p>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between mt-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
