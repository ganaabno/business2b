import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type {
  Tour,
  Passenger,
  User as UserType,
  ValidationError,
  Order,
  Notification as NotificationType,
} from "../types/type";
import { checkSeatLimit } from "../utils/seatLimitChecks";
import { assignRoomAllocation } from "../addPassengerComponents/roomAllocationLogic";
import {
  cleanDateForDB,
  cleanValueForDB,
  generatePassengerId,
  createNewPassenger,
} from "../utils/bookingUtils";

interface LeadPassenger {
  id: string;
  tour_id: string;
  departure_date: string;
  last_name: string;
  first_name: string;
  phone: string;
  seat_count: number;
  status: "pending" | "confirmed" | "declined";
  created_at: string;
  expires_at: string;
  user_id: string;
  tour_title: string | null;
}

interface UseBookingProps {
  tours: Tour[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  selectedTour: string;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  errors: ValidationError[];
  setErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  currentUser: UserType;
}

export const useBooking = ({
  tours,
  setOrders,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  errors,
  setErrors,
  currentUser,
}: UseBookingProps) => {
  const [bookingPassengers, setBookingPassengers] = useState<Passenger[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInProvider, setShowInProvider] = useState(false);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(
    null
  );
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [canAdd, setCanAdd] = useState(true);
  const [showPassengerPrompt, setShowPassengerPrompt] = useState(false);
  const [passengerCountInput, setPassengerCountInput] = useState("");
  const [availableHotels, setAvailableHotels] = useState<string[]>([]);
  const [notification, setNotification] = useState<NotificationType | null>(
    null
  );
  const [leadPassengerData, setLeadPassengerData] =
    useState<LeadPassenger | null>(null);
  const newPassengerRef = useRef<HTMLDivElement | null>(null);

  const MAX_PASSENGERS = 20;
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role? currentUser.role : ""
  );

  const selectedTourData = tours.find((t) => t.title === selectedTour);
  const remainingSeats = isPowerUser
    ? undefined
    : selectedTourData?.available_seats !== undefined
    ? Math.max(
        0,
        selectedTourData.available_seats -
          (bookingPassengers.length + (leadPassengerData?.seat_count || 0))
      )
    : undefined;

  useEffect(() => {
    if (selectedTourData?.hotels) {
      const hotelsField = selectedTourData.hotels as string[] | string; // ✅ tell TS what this is

      const hotels = Array.isArray(hotelsField)
        ? hotelsField.filter(
            (hotel) => typeof hotel === "string" && hotel.trim().length > 0
          )
        : typeof hotelsField === "string" && hotelsField.trim().length > 0
        ? hotelsField
            .split(",")
            .map((h: string) => h.trim()) // ✅ give 'h' a type
            .filter((h) => h.length > 0)
        : [];

      setAvailableHotels(hotels);
    } else {
      setAvailableHotels([]);
    }
  }, [selectedTourData]);

  useEffect(() => {
    setCanAdd(
      bookingPassengers.length < MAX_PASSENGERS &&
        !!selectedTour &&
        !!departureDate &&
        !!selectedTourData &&
        (isPowerUser || (remainingSeats !== undefined && remainingSeats > 0))
    );
  }, [
    bookingPassengers.length,
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    remainingSeats,
  ]);

  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
    },
    []
  );

  const calculateAge = useCallback(
    (dateOfBirth: string | undefined | null): number => {
      const cleanBirthDate = cleanDateForDB(dateOfBirth);
      if (!cleanBirthDate) return 0;
      const dob = new Date(cleanBirthDate);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()))
        age--;
      return Math.max(0, age);
    },
    []
  );

  const calculateServicePrice = useCallback(
    (services: string[], tourData: Tour): number => {
      return services.reduce((sum, serviceName) => {
        const service = tourData.services.find((s) => s.name === serviceName);
        return sum + (service ? service.price : 0);
      }, 0);
    },
    []
  );

  const canAddPassenger = useCallback(async () => {
    if (bookingPassengers.length >= MAX_PASSENGERS) {
      showNotification(
        "error",
        `Maximum ${MAX_PASSENGERS} passengers allowed per booking`
      );
      return false;
    }
    if (!selectedTour || !departureDate || !selectedTourData) {
      showNotification("error", "Please select a tour and departure date");
      return false;
    }
    if (isPowerUser) return true;

    const { isValid, message } = await checkSeatLimit(
      selectedTourData.id,
      departureDate,
      currentUser.role
    );
    if (!isValid) {
      showNotification("error", message);
      return false;
    }
    return true;
  }, [
    bookingPassengers.length,
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    currentUser.role,
  ]);

  const addMultiplePassengers = useCallback(
    async (count: number) => {
      if (!(await canAddPassenger())) return;

      const availableSlots = MAX_PASSENGERS - bookingPassengers.length;
      const actualCount = Math.min(count, availableSlots);

      if (actualCount <= 0) {
        showNotification("error", "No available slots for new passengers");
        return;
      }

      try {
        const newPassengers = Array.from({ length: actualCount }, () =>
          createNewPassenger(
            currentUser,
            bookingPassengers,
            selectedTourData,
            availableHotels
          )
        );

        setBookingPassengers((prev) => {
          const updated = [...prev, ...newPassengers];
          return updated.map((passenger, idx) => ({
            ...passenger,
            room_allocation:
              idx >= prev.length
                ? assignRoomAllocation(updated, idx, passenger.roomType)
                : passenger.room_allocation,
          }));
        });

        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        showNotification(
          "success",
          `Added ${actualCount} passenger${actualCount !== 1 ? "s" : ""}`
        );
        newPassengerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (error) {
        showNotification(
          "error",
          "Failed to add passengers. Please try again."
        );
      }
    },
    [
      bookingPassengers,
      currentUser,
      selectedTourData,
      availableHotels,
      showNotification,
      canAddPassenger,
    ]
  );

  const updatePassenger = async (
    index: number,
    field: keyof Passenger,
    value: any
  ) => {
    if (index < 0 || index >= bookingPassengers.length) return;

    const passengerId = bookingPassengers[index].id;
    const loadingKey = `${passengerId}-${String(field)}`;

    const updatedPassengers = [...bookingPassengers];
    updatedPassengers[index] = {
      ...updatedPassengers[index],
      [field]: cleanValueForDB(field, value),
    };

    if (field === "date_of_birth" && value) {
      updatedPassengers[index].age = calculateAge(value);
    }

    if (field === "additional_services" && selectedTourData) {
      updatedPassengers[index].price =
        selectedTourData.base_price +
        calculateServicePrice(value as string[], selectedTourData);
    }

    if (field === "first_name" || field === "last_name") {
      updatedPassengers[index].name = `${
        updatedPassengers[index].first_name || ""
      } ${updatedPassengers[index].last_name || ""}`.trim();
    }

    if (field === "roomType" && value) {
      const roomAllocation = assignRoomAllocation(
        updatedPassengers,
        index,
        value
      );
      updatedPassengers[index].room_allocation = roomAllocation;
      if (value === "Family") {
        for (
          let i = index + 1;
          i < Math.min(index + 3, updatedPassengers.length);
          i++
        ) {
          updatedPassengers[i].room_allocation = roomAllocation;
        }
      }
    }

    if (field === "passport_upload" && value instanceof File) {
      setFieldLoading((prev) => ({ ...prev, [loadingKey]: true }));
      try {
        const fileExt = value.name.split(".").pop();
        const fileName = `passport_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage
          .from("passports")
          .upload(fileName, value);
        if (error) throw new Error(error.message);
        updatedPassengers[index].passport_upload = data.path;
        showNotification("success", "Passport uploaded successfully");
      } catch (error) {
        showNotification("error", "Failed to upload passport");
      } finally {
        setFieldLoading((prev) => ({ ...prev, [loadingKey]: false }));
      }
    }

    updatedPassengers[index].updated_at = new Date().toISOString();
    setBookingPassengers(updatedPassengers);
  };

  const removePassenger = useCallback(
    (index: number) => {
      if (bookingPassengers.length === 1) {
        showNotification("error", "At least one passenger is required");
        return;
      }
      const updatedPassengers = bookingPassengers
        .filter((_, i) => i !== index)
        .map((passenger, i) => ({
          ...passenger,
          serial_no: (i + 1).toString(),
          updated_at: new Date().toISOString(),
        }));
      setBookingPassengers(updatedPassengers);
      if (expandedPassengerId === bookingPassengers[index].id) {
        setExpandedPassengerId(null);
      }
      showNotification("success", `Removed passenger ${index + 1}`);
    },
    [bookingPassengers, expandedPassengerId]
  );

  const clearAllPassengers = useCallback(() => {
    if (bookingPassengers.length === 0) {
      showNotification("error", "No passengers to clear");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to remove all ${bookingPassengers.length} passengers?`
      )
    ) {
      setBookingPassengers([]);
      setExpandedPassengerId(null);
      showNotification("success", "All passengers cleared");
    }
  }, [bookingPassengers.length]);

  const resetBookingForm = useCallback(() => {
    setBookingPassengers([]);
    setSelectedTour("");
    setDepartureDate("");
    setPaymentMethod("");
    setActiveStep(1);
    setShowInProvider(false);
    setExpandedPassengerId(null);
    setErrors([]);
    setLeadPassengerData(null);
    showNotification("success", "Booking reset successfully!");
  }, [setSelectedTour, setDepartureDate, setErrors]);

  const validatePassenger = useCallback(
    (passenger: Passenger, departureDate: string): ValidationError[] => {
      const errors: ValidationError[] = [];
      const { serial_no } = passenger;

      if (!passenger.first_name?.trim())
        errors.push({
          field: `passenger_${serial_no}_first_name`,
          message: `Passenger ${serial_no}: First name is required`,
        });
      if (!passenger.last_name?.trim())
        errors.push({
          field: `passenger_${serial_no}_last_name`,
          message: `Passenger ${serial_no}: Last name is required`,
        });
      if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
        errors.push({
          field: `passenger_${serial_no}_email`,
          message: `Passenger ${serial_no}: Valid email is required`,
        });
      if (!passenger.phone?.trim())
        errors.push({
          field: `passenger_${serial_no}_phone`,
          message: `Passenger ${serial_no}: Phone number is required`,
        });
      if (!passenger.nationality?.trim())
        errors.push({
          field: `passenger_${serial_no}_nationality`,
          message: `Passenger ${serial_no}: Nationality is required`,
        });
      if (!passenger.gender?.trim())
        errors.push({
          field: `passenger_${serial_no}_gender`,
          message: `Passenger ${serial_no}: Gender is required`,
        });
      if (!passenger.passport_number?.trim())
        errors.push({
          field: `passenger_${serial_no}_passport_number`,
          message: `Passenger ${serial_no}: Passport number is required`,
        });
      if (!passenger.passport_expiry) {
        errors.push({
          field: `passenger_${serial_no}_passport_expiry`,
          message: `Passenger ${serial_no}: Passport expiry date is required`,
        });
      } else {
        const expiryDate = new Date(passenger.passport_expiry);
        const minDate = new Date(departureDate);
        minDate.setMonth(minDate.getMonth() + 6);
        if (isNaN(expiryDate.getTime()) || expiryDate < minDate) {
          errors.push({
            field: `passenger_${serial_no}_passport_expiry`,
            message: `Passenger ${serial_no}: Passport must be valid for at least 6 months from departure date`,
          });
        }
      }
      if (!passenger.roomType?.trim())
        errors.push({
          field: `passenger_${serial_no}_roomType`,
          message: `Passenger ${serial_no}: Room type is required`,
        });
      if (!passenger.hotel?.trim())
        errors.push({
          field: `passenger_${serial_no}_hotel`,
          message: `Passenger ${serial_no}: Hotel selection is required`,
        });

      return errors;
    },
    []
  );

  const validateBooking = useCallback(
    (step: number): boolean => {
      const allErrors: ValidationError[] = [];

      if (!selectedTour?.trim())
        allErrors.push({ field: "tour", message: "Please select a tour" });
      if (!departureDate?.trim())
        allErrors.push({
          field: "departure",
          message: "Please select a departure date",
        });
      if (step >= 3 && bookingPassengers.length === 0 && !leadPassengerData) {
        allErrors.push({
          field: "passengers",
          message: "At least one passenger is required",
        });
      }
      if (step === 4) {
        if (!paymentMethod?.trim())
          allErrors.push({
            field: "payment",
            message: "Please select a payment method",
          });
        if (isPowerUser && !showInProvider) {
          allErrors.push({
            field: "show_in_provider",
            message: "Provider visibility is required for power users",
          });
        }
      }

      bookingPassengers.forEach((passenger) =>
        allErrors.push(...validatePassenger(passenger, departureDate))
      );

      setErrors(allErrors);
      return allErrors.length === 0;
    },
    [
      selectedTour,
      departureDate,
      bookingPassengers,
      paymentMethod,
      showInProvider,
      isPowerUser,
      leadPassengerData,
      validatePassenger,
      setErrors,
    ]
  );

  const saveOrder = async () => {
    if (!validateBooking(4)) {
      showNotification(
        "error",
        "Please fix the validation errors before proceeding"
      );
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification("error", "Selected tour not found");
      return;
    }

    if (
      !isPowerUser &&
      tourData.available_seats !== undefined &&
      tourData.available_seats < bookingPassengers.length
    ) {
      showNotification(
        "error",
        "Cannot save booking. The tour is fully booked."
      );
      return;
    }

    setLoading(true);
    try {
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
        passport_expiry: cleanValueForDB(
          "passport_expiry",
          firstPassenger?.passport_expiry
        ),
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
        show_in_provider: isPowerUser ? showInProvider : false,
      };

      const { data: orderResult, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError || !orderResult)
        throw new Error(orderError?.message || "No order data returned");

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

      const cleanedPassengers = await Promise.all(
        bookingPassengers.map(async (passenger, index) => ({
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
          passport_expiry: cleanDateForDB(passenger.passport_expiry),
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
          blacklisted_date: cleanValueForDB(
            "blacklisted_date",
            passenger.blacklisted_date
          ),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      );

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
          console.warn("Failed to update tour seats:", tourUpdateError.message);
      }

      const newOrder: Order = {
        id: orderId,
        ...orderData,
        created_at: orderResult.created_at,
        updated_at: orderResult.updated_at,
        departureDate: cleanValueForDB("departureDate", departureDate),
        total_price: totalPrice,
        total_amount: totalPrice,
        balance: totalPrice,
        paid_amount: 0,
        show_in_provider: isPowerUser ? showInProvider : false,
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
        passport_expire: cleanValueForDB(
          "passport_expiry",
          firstPassenger?.passport_expiry
        ),
        passport_copy: firstPassenger?.passport_upload || null,
        commission,
        payment_method: paymentMethod || null,
        passengers: cleanedPassengers.map((p, index) => ({
          ...p,
          id: generatePassengerId(),
          passport_upload: uploadedPaths[index] || null,
        })) as Passenger[],

        // ✅ Add missing fields
        edited_by: null,
        edited_at: null,
      };

      setOrders((prev) => [...prev, newOrder]);
      showNotification(
        "success",
        `Booking saved successfully! Order ID: ${orderId}`
      );
      resetBookingForm();
    } catch (error) {
      showNotification(
        "error",
        `Error saving booking: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = useCallback(() => {
    if (bookingPassengers.length === 0) {
      showNotification("error", "No passengers to export");
      return;
    }

    const headers = [
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
      "Room Allocation",
      "Additional Services",
      "Price",
      "Email",
      "Phone",
      "Allergy",
      "Emergency Phone",
    ];

    const rows = bookingPassengers.map((p) =>
      [
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
        p.room_allocation,
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
    a.download = `booking_${selectedTour}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification("success", "CSV downloaded successfully");
  }, [bookingPassengers, selectedTour, showNotification]);

  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      showNotification("error", "Please upload a CSV file");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification("error", "No tour selected");
      return;
    }

    if (!isPowerUser && !(await canAddPassenger())) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          showNotification(
            "error",
            "CSV file must contain at least a header and one data row"
          );
          return;
        }

        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/"/g, ""));
        const requiredHeaders = [
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
          "Room Allocation",
          "Additional Services",
          "Price",
          "Email",
          "Phone",
          "Allergy",
          "Emergency Phone",
        ];

        if (!requiredHeaders.every((h) => headers.includes(h))) {
          showNotification("error", "CSV file is missing required headers");
          return;
        }

        const validateCsvRow = (row: Record<string, string>): boolean => {
          const requiredFields = ["First Name", "Last Name", "Email", "Phone"];
          for (const field of requiredFields) {
            if (!row[field] || row[field].length > 100 || row[field].length < 1)
              return false;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row["Email"])) return false;
          if (row["Phone"].replace(/\D/g, "").length < 8) return false;
          if (row["First Name"].length > 50 || row["Last Name"].length > 50)
            return false;
          return true;
        };

        const data = lines
          .slice(1)
          .map((line) => {
            const values = line
              .split(",")
              .map((v) => v.trim().replace(/"/g, ""));
            return headers.reduce((obj: Record<string, string>, header, i) => {
              obj[header] = values[i] || "";
              return obj;
            }, {});
          })
          .filter(validateCsvRow);

        if (data.length === 0) {
          showNotification("error", "No valid passenger data found in CSV");
          return;
        }

        if (
          !isPowerUser &&
          tourData.available_seats !== undefined &&
          data.length + bookingPassengers.length > tourData.available_seats
        ) {
          showNotification(
            "error",
            "Cannot import passengers. The tour is fully booked."
          );
          return;
        }

        if (bookingPassengers.length + data.length > MAX_PASSENGERS) {
          showNotification(
            "error",
            `Cannot import ${data.length} passengers. Maximum ${
              MAX_PASSENGERS - bookingPassengers.length
            } more allowed.`
          );
          return;
        }

        const csvPassengers: Passenger[] = data.map((row, idx) => {
          const baseSerial = bookingPassengers.length + idx + 1;
          const services = row["Additional Services"]
            ? row["Additional Services"]
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];
          const servicePrice = calculateServicePrice(services, tourData);
          return {
            id: generatePassengerId(),
            order_id: "",
            user_id: currentUser.id,
            name: `${row["First Name"]} ${row["Last Name"]}`.trim(),
            tour_title: selectedTour,
            departure_date: cleanDateForDB(departureDate),
            room_allocation: row["Room Allocation"] || "",
            serial_no: baseSerial.toString(),
            last_name: row["Last Name"] || "",
            first_name: row["First Name"] || "",
            date_of_birth: cleanDateForDB(row["Date of Birth"]) ?? "",
            age: parseInt(row["Age"]) || calculateAge(row["Date of Birth"]),
            gender: row["Gender"] || "",
            passport_number: row["Passport Number"] || "",
            passport_expiry: cleanDateForDB(row["Passport Expiry"]),
            nationality: row["Nationality"] || "Mongolia",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || availableHotels[0] || "",
            additional_services: services,
            price: tourData.base_price + servicePrice,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: "active",
            is_blacklisted: false,
            blacklisted_date: null,
            notes: "",
          };
        });

        const newPassengers = csvPassengers.map((passenger, idx) => ({
          ...passenger,
          room_allocation: assignRoomAllocation(
            [...bookingPassengers, ...csvPassengers.slice(0, idx)],
            bookingPassengers.length + idx,
            passenger.roomType
          ),
        }));

        setBookingPassengers((prev) => [...prev, ...newPassengers]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        showNotification(
          "success",
          `Successfully imported ${newPassengers.length} passengers`
        );
      } catch (error) {
        showNotification(
          "error",
          "Failed to parse CSV file. Please check the format."
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const totalPrice = bookingPassengers.reduce(
    (sum, p) => sum + (p.price || 0),
    0
  );

  const handleNextStep = useCallback(async () => {
    switch (activeStep) {
      case 1:
        if (!selectedTour?.trim() || !departureDate?.trim()) {
          showNotification("error", "Please select tour and date");
          return;
        }
        setActiveStep(2);
        break;
      case 2:
        break;
      case 3:
        if (bookingPassengers.length === 0) {
          showNotification("error", "Add at least one passenger");
          return;
        }
        if (validateBooking(activeStep)) {
          setErrors((prev) =>
            prev.filter(
              (e) => e.field !== "payment" && e.field !== "show_in_provider"
            )
          );
          setActiveStep(4); // Go to Review & Book
        } else {
          showNotification(
            "error",
            "Please fix all validation errors before proceeding"
          );
        }
        break;
      case 4:
        if (!loading && validateBooking(activeStep)) {
          await saveOrder();
        } else if (!loading) {
          showNotification(
            "error",
            "Please fix all validation errors before confirming"
          );
        }
        break;
    }
  }, [
    activeStep,
    selectedTour,
    departureDate,
    bookingPassengers.length,
    validateBooking,
    loading,
    saveOrder,
  ]);

  return {
    bookingPassengers,
    activeStep,
    setActiveStep,
    paymentMethod,
    setPaymentMethod,
    loading,
    showInProvider,
    setShowInProvider,
    expandedPassengerId,
    setExpandedPassengerId,
    fieldLoading,
    canAdd,
    showPassengerPrompt,
    setShowPassengerPrompt,
    passengerCountInput,
    setPassengerCountInput,
    availableHotels,
    newPassengerRef,
    isPowerUser,
    selectedTourData,
    remainingSeats,
    totalPrice,
    addMultiplePassengers,
    updatePassenger,
    removePassenger,
    clearAllPassengers,
    resetBookingForm,
    handleDownloadCSV,
    handleUploadCSV,
    handleNextStep,
    MAX_PASSENGERS,
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
  };
};
