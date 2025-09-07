import { type Dispatch, type SetStateAction, useCallback, useRef, useState, useMemo, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type { Tour, Passenger, User as UserType, ValidationError, Order } from "../types/type";
import Notifications from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import BookingSummary from "../Parts/BookingSummary";
import TourSelection from "../Parts/TourSelection";
import AddPassengerTabUser from "../components/AddPassengerTabUser";

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
    tour_title: selectedTourData?.title || "",
    departure_date: "",
    user_id: currentUser.userId,
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
    return passengers
      .filter(
        (p) =>
          p.user_id === currentUser.userId &&
          p.tour_title === selectedTour &&
          p.departure_date === departureDate &&
          p.order_id === ""
      )
      .map((passenger) => {
        const order = orders.find((o) => o.id === passenger.order_id);
        const tour = tours.find((t) => t.id === order?.tour_id);
        return {
          ...passenger,
          tour_title: tour?.title || passenger.tour_title || "Unknown Tour",
          departure_date: order?.departureDate || passenger.departure_date || "",
        };
      });
  }, [passengers, orders, tours, currentUser.userId, selectedTour, departureDate]);

  // Get selected tour data for passenger creation
  const selectedTourData = useMemo(() => {
    return tours.find((t) => t.title === selectedTour);
  }, [tours, selectedTour]);

  const remainingSeats =
    selectedTourData?.available_seats !== undefined
      ? Math.max(0, selectedTourData.available_seats - bookingPassengers.length)
      : undefined;

  const canAddPassenger = () => {
    if (bookingPassengers.length >= MAX_PASSENGERS) return false;
    if (!selectedTourData) return true;
    if (selectedTourData.available_seats === undefined) return true;
    return bookingPassengers.length < selectedTourData.available_seats;
  };

  const wrappedShowNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
      showNotification(type, message);
    },
    [showNotification]
  );

  // Real-time subscription for passengers
  useEffect(() => {
    const subscription = supabase
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
          console.log("Real-time passenger update:", payload);
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
            console.log("Fetched updated passengers:", data);
            setPassengers(
              data.map((p: any) => ({
                ...p,
                tour_title: p.orders?.tours?.title || p.tour_title || "Unknown Tour",
                departure_date: p.orders?.departureDate || p.departure_date || "",
              }))
            );
          } catch (error) {
            console.error("Error in real-time handler:", error);
            wrappedShowNotification("error", "Failed to refresh passengers");
          }
        }
      )
      .subscribe((status) => {
        console.log("Passenger subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from passengers_channel");
      supabase.removeChannel(subscription);
    };
  }, [currentUser.userId, wrappedShowNotification, setPassengers]);

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
    }, 0);
  };

  const addPassenger = useCallback(() => {
    if (!canAddPassenger()) {
      if (bookingPassengers.length >= MAX_PASSENGERS) {
        wrappedShowNotification("error", `Maximum ${MAX_PASSENGERS} passengers allowed per booking`);
      } else if (selectedTourData?.available_seats !== undefined) {
        wrappedShowNotification("error", "Cannot add more passengers. Tour is fully booked.");
      }
      return;
    }

    try {
      const newPassenger = createNewPassenger(currentUser, bookingPassengers, selectedTourData);
      setPassengers((prev) => [
        ...prev,
        { ...newPassenger, tour_title: selectedTour, departure_date: departureDate },
      ]);
      setExpandedPassengerId(newPassenger.id);
      const passengerCount = bookingPassengers.length + 1;
      wrappedShowNotification("success", `Added passenger ${passengerCount}`);
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      wrappedShowNotification("error", "Failed to add passenger. Please try again.");
    }
  }, [bookingPassengers, currentUser, selectedTourData, wrappedShowNotification, setPassengers, selectedTour, departureDate]);

  const updatePassenger = async (passengerId: string, field: keyof Passenger, value: any) => {
    const updatedPassengers = [...passengers];
    const passengerIndex = passengers.findIndex((p) => p.id === passengerId && p.user_id === currentUser.userId);
    if (passengerIndex === -1) {
      console.error(`Passenger not found or not owned by user: id=${passengerId}, userId=${currentUser.userId}`);
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
        wrappedShowNotification("success", "Passport uploaded successfully");
      } catch (error) {
        wrappedShowNotification("error", "Failed to upload passport");
      } finally {
        setLoading(false);
      }
    }

    updatedPassengers[passengerIndex].updated_at = new Date().toISOString();
    setPassengers(updatedPassengers);
    console.log(`Updated passenger id=${passengerId}, field=${field}, value=`, value);
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
        wrappedShowNotification("success", `Removed passenger`);
      } catch (error) {
        wrappedShowNotification("error", "Failed to remove passenger. Please try again.");
      }
    },
    [bookingPassengers, passengers, expandedPassengerId, currentUser.userId, wrappedShowNotification, setPassengers]
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
      wrappedShowNotification("success", "All unsubmitted passengers cleared");
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
      wrappedShowNotification("success", "Booking form reset successfully");
    }
    setShowConfirmModal(null);
  }, [showConfirmModal, bookingPassengers, passengers, currentUser.userId, wrappedShowNotification, setPassengers, setSelectedTour, setDepartureDate]);

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

    console.log("Validation errors:", allErrors);
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

    if (tourData.available_seats !== undefined && tourData.available_seats < bookingPassengers.length) {
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
        travel_choice: selectedTour,
        status: "pending",
        hotel: bookingPassengers[0].hotel || null,
        room_number: bookingPassengers[0].room_allocation || null,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departureDate: departureDate,
        show_in_provider: currentUser.role !== "user" ? showInProvider : true,
      };

      console.log("Submitting order:", newOrder);
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

      console.log("Submitting passenger requests:", passengersWithOrderId);
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

      wrappedShowNotification("success", "Passenger registration request sent! Pretty please, await manager approval 😊");
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
    a.download = `booking_${selectedTour}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    wrappedShowNotification("success", "CSV downloaded successfully");
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

        if (tourData.available_seats !== undefined && data.length + bookingPassengers.length > tourData.available_seats) {
          wrappedShowNotification("error", "Cannot import passengers. The tour is fully booked.");
          return;
        }

        const newPassengers = data.map((row, idx) => {
          const passenger: Passenger = {
            id: generatePassengerId(),
            order_id: "",
            user_id: currentUser.userId,
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
            price: parseFloat(row["Price"]) || 0,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: "pending",
            tour_title: selectedTour,
            departure_date: departureDate,
          };
          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tourData);
          }
          return passenger;
        });

        setPassengers([...passengers, ...newPassengers]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        wrappedShowNotification("success", `Successfully imported ${newPassengers.length} passengers`);
        newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (error) {
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
              {remainingSeats !== undefined && (
                <p
                  className={`text-sm font-medium mt-2 ${remainingSeats > 5 ? "text-green-600" : remainingSeats > 0 ? "text-orange-600" : "text-red-600"
                    }`}
                >
                  {remainingSeats} seats available
                </p>
              )}
            </div>
            <TourSelection
              tours={tours}
              selectedTour={selectedTour}
              setSelectedTour={setSelectedTour}
              departureDate={departureDate}
              setDepartureDate={setDepartureDate}
              errors={validationErrors}
              setActiveStep={setActiveStep}
              userRole={currentUser.role}
              showAvailableSeats={currentUser.role !== "user"}
            />
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Your Passengers</h4>
              {sortedPassengers.length === 0 ? (
                <p className="text-gray-600">No passengers added yet. Add a passenger to continue.</p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Passport
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tour
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Departure
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedPassengers.map((passenger, index) => (
                          <tr key={passenger.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {index + 1}  {/* <-- this gives 1, 2, 3, ... */}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {passenger.first_name} {passenger.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {passenger.passport_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {passenger.tour_title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDisplayDate(passenger.departure_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${passenger.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : passenger.status === "rejected"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                              >
                                {passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {passenger.order_id === "" && (
                                <button
                                  onClick={() => removePassenger(passenger.id)}
                                  className="text-red-600 hover:text-red-800"
                                  disabled={loading}
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="self-center text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <AddPassengerTabUser
            tours={tours}
            selectedTour={selectedTour}
            passengers={bookingPassengers}
            setPassengers={setPassengers}
            errors={validationErrors}
            isGroup={false}
            setIsGroup={() => { }}
            groupName=""
            setGroupName={() => { }}
            addPassenger={addPassenger}
            addMultiplePassengers={() => { }}
            clearAllPassengers={clearAllPassengers}
            handleUploadCSV={handleUploadCSV}
            updatePassenger={updatePassenger}
            removePassenger={removePassenger}
            showNotification={showNotification}
            currentUser={currentUser}
            setActiveStep={setActiveStep}
            validateBooking={validateBooking}
          />
        )}

        {activeStep === 3 && (
          <BookingSummary
            selectedTour={selectedTour}
            departureDate={departureDate}
            passengers={bookingPassengers}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            errors={validationErrors}
            downloadCSV={handleDownloadCSV}
            saveOrder={saveOrder}
            setActiveStep={setActiveStep}
            loading={loading}
            showInProvider={showInProvider}
            setShowInProvider={setShowInProvider}
            currentUser={currentUser}
          />
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{showConfirmModal.message}</h3>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-900">Processing your request...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}