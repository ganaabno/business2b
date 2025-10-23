import { useState, useCallback, useRef, useEffect } from "react";
import { parse, isValid, format } from "date-fns";
import { supabase } from "../supabaseClient";
import type {
  Tour,
  Passenger,
  User as UserType,
  ValidationError,
  Order,
  Notification as NotificationType,
  LeadPassenger,
  PassengerFormData,
} from "../types/type";
import { checkSeatLimit } from "../utils/seatLimitChecks";
import { assignRoomAllocation } from "../addPassengerComponents/roomAllocationLogic";
import {
  cleanValueForDB,
  generatePassengerId,
  createNewPassenger,
  createNewPassengerLocal,
} from "../utils/bookingUtils";

type CreateNewPassengerExtraFields = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  main_passenger_id?: string | null;
  roomType?: string;
  room_allocation?: string;
  serial_no?: string;
};

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
  const [paymentMethod, setPaymentMethod] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInProvider, setShowInProvider] = useState(false);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(
    null
  );
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [canAdd, setCanAdd] = useState(true);
  const [availableHotels, setAvailableHotels] = useState<string[]>([]);
  const [notification, setNotification] = useState<NotificationType | null>(
    null
  );
  const [leadPassengerData, setLeadPassengerData] =
    useState<LeadPassenger | null>(null);
  const [showPassengerPrompt, setShowPassengerPrompt] = useState(false);
  const [passengerCountInput, setPassengerCountInput] = useState("");
  const [passengerFormData, setPassengerFormData] =
    useState<PassengerFormData | null>(null);
  const newPassengerRef = useRef<HTMLDivElement | null>(null);

  const MAX_PASSENGERS = 20;
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || "user"
  );

  // Clear payment error when paymentMethod changes
  useEffect(() => {
    if (paymentMethod.length > 0) {
      setErrors((prev) => prev.filter((e) => e.field !== "payment"));
    }
  }, [paymentMethod, setErrors]);

  const confirmLeadPassenger = useCallback(() => {
    if (!leadPassengerData) {
      setNotification({
        type: "error",
        message: "No lead passenger data to confirm",
      });
      return;
    }
    console.log("useBooking: confirmLeadPassenger called", {
      seat_count: leadPassengerData.seat_count,
      tour_id: leadPassengerData.tour_id,
      departure_date: leadPassengerData.departure_date,
    });
    addMultiplePassengers(1);
  }, [leadPassengerData]);

  const updatePassenger = async (
    index: number,
    field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
    value: any
  ) => {
    if (index < 0 || index >= bookingPassengers.length) return;

    const passengerId = bookingPassengers[index].id;
    const loadingKey = `${passengerId}-${String(field)}`;

    const updatedPassengers = [...bookingPassengers];
    const mainPassenger = updatedPassengers[index];

    if (field === "hasSubPassengers") {
      updatedPassengers[index] = {
        ...mainPassenger,
        has_sub_passengers: value,
      };
      if (!value) {
        updatedPassengers[index].sub_passenger_count = 0;
        const subPassengers = updatedPassengers.filter(
          (p) => p.main_passenger_id === mainPassenger.id
        );
        updatedPassengers.splice(
          updatedPassengers.findIndex((p) => p.id === mainPassenger.id) + 1,
          subPassengers.length
        );
      }
    } else if (field === "subPassengerCount") {
      const currentSubCount = updatedPassengers.filter(
        (p) => p.main_passenger_id === mainPassenger.id
      ).length;
      const newSubCount = parseInt(value, 10) || 0;
      updatedPassengers[index] = {
        ...mainPassenger,
        sub_passenger_count: newSubCount,
      };

      if (newSubCount > currentSubCount) {
        const subPassengersToAdd = newSubCount - currentSubCount;
        const newSubPassengers = Array.from(
          { length: subPassengersToAdd },
          () =>
            createNewPassengerLocal(
              currentUser,
              updatedPassengers,
              selectedTourData,
              availableHotels,
              {
                main_passenger_id: mainPassenger.id,
                roomType: mainPassenger.roomType,
                room_allocation: mainPassenger.room_allocation,
                serial_no: mainPassenger.serial_no,
              }
            )
        );
        updatedPassengers.splice(
          index + currentSubCount + 1,
          0,
          ...newSubPassengers
        );
      } else if (newSubCount < currentSubCount) {
        const subPassengers = updatedPassengers.filter(
          (p) => p.main_passenger_id === mainPassenger.id
        );
        updatedPassengers.splice(
          updatedPassengers.findIndex((p) => p.id === mainPassenger.id) +
            newSubCount +
            1,
          currentSubCount - newSubCount
        );
      }
    } else {
      updatedPassengers[index] = {
        ...mainPassenger,
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
        updatedPassengers.forEach((p, i) => {
          if (p.main_passenger_id === mainPassenger.id) {
            updatedPassengers[i] = {
              ...p,
              roomType: value,
              room_allocation: roomAllocation,
            };
          }
        });
      }

      if (field === "passport_upload" && value instanceof File) {
        setFieldLoading((prev) => ({ ...prev, [loadingKey]: true }));
        try {
          const fileExt = value.name.split(".").pop();
          const fileName = `passport_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2)}.${fileExt}`;
          console.log("updatePassenger: Uploading passport", { fileName });
          const { data, error } = await supabase.storage
            .from("passports")
            .upload(fileName, value);
          if (error) {
            console.error("updatePassenger: Passport upload failed", { error });
            throw new Error(error.message);
          }
          updatedPassengers[index].passport_upload = data.path;
          setNotification({
            type: "success",
            message: "Passport uploaded successfully",
          });
        } catch (error) {
          console.error("updatePassenger: Error uploading passport", error);
          setNotification({
            type: "error",
            message: "Failed to upload passport",
          });
        } finally {
          setFieldLoading((prev) => ({ ...prev, [loadingKey]: false }));
        }
      }

      updatedPassengers[index].updated_at = new Date().toISOString();
    }

    setBookingPassengers(updatedPassengers);
  };

  useEffect(() => {
    console.log("useBooking: Initialized", {
      currentUserId: currentUser.id,
      currentUserRole: currentUser.role || "user",
      isPowerUser,
      selectedTour,
      departureDate,
      remainingSeats,
      leadPassengerData,
    });
  }, [
    currentUser.id,
    currentUser.role,
    isPowerUser,
    selectedTour,
    departureDate,
    leadPassengerData,
  ]);

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
    const canAddValue =
      bookingPassengers.length < MAX_PASSENGERS &&
      !!selectedTour &&
      !!departureDate &&
      !!selectedTourData &&
      (isPowerUser ||
        (remainingSeats !== undefined &&
          remainingSeats > 0 &&
          (leadPassengerData?.seat_count === undefined ||
            bookingPassengers.length < leadPassengerData.seat_count)));
    console.log("useBooking: canAdd updated", {
      canAdd: canAddValue,
      bookingPassengersLength: bookingPassengers.length,
      selectedTour,
      departureDate,
      selectedTourDataExists: !!selectedTourData,
      remainingSeats,
      leadPassengerData,
    });
    setCanAdd(canAddValue);
  }, [
    bookingPassengers.length,
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    remainingSeats,
    leadPassengerData,
  ]);

  useEffect(() => {
    if (selectedTourData?.hotels) {
      const hotelsField = selectedTourData.hotels as string[] | string;
      const hotels = Array.isArray(hotelsField)
        ? hotelsField.filter(
            (hotel) => typeof hotel === "string" && hotel.trim().length > 0
          )
        : typeof hotelsField === "string" && hotelsField.trim().length > 0
        ? hotelsField
            .split(",")
            .map((h: string) => h.trim())
            .filter((h) => h.length > 0)
        : [];
      setAvailableHotels(hotels);
    } else {
      setAvailableHotels([]);
    }
  }, [selectedTourData]);

  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      console.log("useBooking: showNotification", { type, message });
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
    },
    []
  );

  const calculateAge = useCallback(
    (dateOfBirth: string | undefined | null): number => {
      const cleanBirthDate = cleanValueForDB("date_of_birth", dateOfBirth);
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
    console.log("useBooking: canAddPassenger called", {
      bookingPassengersLength: bookingPassengers.length,
      selectedTour,
      departureDate,
      selectedTourDataExists: !!selectedTourData,
      remainingSeats,
      leadPassengerData,
      isPowerUser,
    });
    if (bookingPassengers.length >= MAX_PASSENGERS) {
      setNotification({
        type: "error",
        message: `Maximum ${MAX_PASSENGERS} passengers allowed per booking`,
      });
      console.log(
        "useBooking: canAddPassenger failed - Max passengers reached"
      );
      return false;
    }
    if (!selectedTour || !departureDate || !selectedTourData) {
      setNotification({
        type: "error",
        message: "Please select a tour and departure date",
      });
      console.log("useBooking: canAddPassenger failed - Missing tour or date");
      return false;
    }
    if (!isPowerUser) {
      if (remainingSeats !== undefined && remainingSeats <= 0) {
        setNotification({
          type: "error",
          message: "No seats available for this tour",
        });
        console.log("useBooking: canAddPassenger failed - No seats available");
        return false;
      }
      if (
        leadPassengerData?.seat_count !== undefined &&
        bookingPassengers.length >= leadPassengerData.seat_count
      ) {
        setNotification({
          type: "error",
          message: `Cannot add more passengers: exceeds lead passenger limit of ${leadPassengerData.seat_count}`,
        });
        console.log(
          "useBooking: canAddPassenger failed - Lead passenger seat limit"
        );
        return false;
      }
      const { isValid, message } = await checkSeatLimit(
        selectedTourData.id,
        departureDate,
        currentUser.role
      );
      if (!isValid) {
        setNotification({ type: "error", message });
        console.log("useBooking: canAddPassenger failed - checkSeatLimit", {
          message,
        });
        return false;
      }
    }
    return true;
  }, [
    bookingPassengers.length,
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    remainingSeats,
    leadPassengerData,
    currentUser.role,
  ]);

  const addMultiplePassengers = useCallback(
    async (count: number) => {
      console.log("useBooking: addMultiplePassengers called", {
        count,
        isPowerUser,
        remainingSeats,
        leadPassengerData,
        bookingPassengersLength: bookingPassengers.length,
      });
      if (!(await canAddPassenger())) {
        console.log("useBooking: canAddPassenger returned false");
        return;
      }

      const availableSlots = isPowerUser
        ? MAX_PASSENGERS - bookingPassengers.length
        : Math.min(
            MAX_PASSENGERS - bookingPassengers.length,
            remainingSeats !== undefined ? remainingSeats : MAX_PASSENGERS,
            leadPassengerData?.seat_count !== undefined
              ? leadPassengerData.seat_count - bookingPassengers.length
              : MAX_PASSENGERS
          );
      const actualCount = Math.min(count, availableSlots);

      if (actualCount <= 0) {
        setNotification({
          type: "error",
          message: "No available slots for new passengers",
        });
        console.log(
          "useBooking: addMultiplePassengers failed - No available slots"
        );
        return;
      }

      try {
        const newPassengers = Array.from({ length: actualCount }, (_, idx) =>
          createNewPassenger(
            currentUser,
            bookingPassengers,
            selectedTourData,
            availableHotels,
            idx === 0 && leadPassengerData
              ? {
                  first_name: leadPassengerData.first_name,
                  last_name: leadPassengerData.last_name,
                  phone: leadPassengerData.phone,
                }
              : {}
          )
        );

        setBookingPassengers((prev) => {
          const updated = [...prev, ...newPassengers];
          console.log("useBooking: Updating bookingPassengers", {
            previousLength: prev.length,
            newPassengersLength: newPassengers.length,
            totalLength: updated.length,
          });
          return updated.map((passenger, idx) => ({
            ...passenger,
            room_allocation:
              idx >= prev.length
                ? assignRoomAllocation(updated, idx, passenger.roomType)
                : passenger.room_allocation,
          }));
        });

        setExpandedPassengerId(newPassengers[0].id);
        console.log("useBooking: setExpandedPassengerId", newPassengers[0].id);
        setNotification({
          type: "success",
          message: `Added ${actualCount} passenger${
            actualCount !== 1 ? "s" : ""
          }`,
        });
        newPassengerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch (error) {
        console.error("useBooking: Error in addMultiplePassengers", error);
        setNotification({
          type: "error",
          message: "Failed to add passengers. Please try again.",
        });
      }
    },
    [
      bookingPassengers,
      currentUser,
      selectedTourData,
      availableHotels,
      canAddPassenger,
      remainingSeats,
      leadPassengerData,
      isPowerUser,
    ]
  );

  useEffect(() => {
    if (leadPassengerData && bookingPassengers.length > 0) {
      const first = bookingPassengers[0];
      if (!first.first_name || !first.last_name || !first.phone) {
        console.log(
          "useBooking: Populating first passenger details from lead",
          {
            first_name: leadPassengerData.first_name,
            last_name: leadPassengerData.last_name,
            phone: leadPassengerData.phone,
          }
        );
        updatePassenger(0, "first_name", leadPassengerData.first_name);
        updatePassenger(0, "last_name", leadPassengerData.last_name);
        updatePassenger(0, "phone", leadPassengerData.phone);
      }
    }
  }, [leadPassengerData, bookingPassengers, updatePassenger]);

  const removePassenger = useCallback(
    (index: number) => {
      if (bookingPassengers.length === 1) {
        setNotification({
          type: "error",
          message: "At least one passenger is required",
        });
        return;
      }
      const passengerToRemove = bookingPassengers[index];
      const updatedPassengers = bookingPassengers
        .filter((_, i) => i !== index)
        .filter((p) => p.main_passenger_id !== passengerToRemove.id)
        .map((passenger, i) => ({
          ...passenger,
          serial_no: (i + 1).toString(),
          updated_at: new Date().toISOString(),
        }));
      setBookingPassengers(updatedPassengers);
      if (expandedPassengerId === bookingPassengers[index].id) {
        setExpandedPassengerId(null);
      }
      setNotification({
        type: "success",
        message: `Removed passenger ${index + 1}`,
      });
    },
    [bookingPassengers, expandedPassengerId]
  );

  const clearAllPassengers = useCallback(() => {
    if (bookingPassengers.length === 0) {
      setNotification({ type: "error", message: "No passengers to clear" });
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to remove all ${bookingPassengers.length} passengers?`
      )
    ) {
      setBookingPassengers([]);
      setExpandedPassengerId(null);
      setNotification({ type: "success", message: "All passengers cleared" });
    }
  }, [bookingPassengers.length]);

  const resetBookingForm = useCallback(() => {
    setBookingPassengers([]);
    setSelectedTour("");
    setDepartureDate("");
    setPaymentMethod([]);
    setActiveStep(1);
    setShowInProvider(false);
    setExpandedPassengerId(null);
    setErrors([]);
    setLeadPassengerData(null);
    setPassengerFormData(null);
    setShowPassengerPrompt(false);
    setPassengerCountInput("");
    setNotification({
      type: "success",
      message: "Booking form reset successfully",
    });
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
      if (!passenger.date_of_birth?.trim())
        errors.push({
          field: `passenger_${serial_no}_date_of_birth`,
          message: `Passenger ${serial_no}: Date of birth is required`,
        });
      if (!passenger.passport_number?.trim())
        errors.push({
          field: `passenger_${serial_no}_passport_number`,
          message: `Passenger ${serial_no}: Passport number is required`,
        });
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
      if (passenger.passport_expire) {
        const cleanExpireDate = cleanValueForDB(
          "passport_expire",
          passenger.passport_expire
        );
        if (!cleanExpireDate) {
          errors.push({
            field: `passenger_${serial_no}_passport_expire`,
            message: `Passenger ${serial_no}: Invalid passport expire date format`,
          });
        } else {
          const expireDate = new Date(cleanExpireDate);
          const cleanDepDate = cleanValueForDB("departure_date", departureDate);
          if (!cleanDepDate) {
            errors.push({
              field: `passenger_${serial_no}_passport_expire`,
              message: `Passenger ${serial_no}: Invalid departure date`,
            });
          } else {
            const minDate = new Date(cleanDepDate);
            minDate.setMonth(minDate.getMonth() + 6);
            if (isNaN(expireDate.getTime()) || expireDate < minDate) {
              errors.push({
                field: `passenger_${serial_no}_passport_expire`,
                message: `Passenger ${serial_no}: Passport must be valid for at least 6 months from departure date`,
              });
            }
          }
        }
      }
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
        if (paymentMethod.length === 0)
          allErrors.push({
            field: "payment",
            message: "Please select at least one payment method",
          });
      }

      bookingPassengers.forEach((passenger) =>
        allErrors.push(...validatePassenger(passenger, departureDate))
      );

      console.log("useBooking: validateBooking", {
        step,
        allErrors,
        selectedTour,
        departureDate,
        paymentMethod,
        bookingPassengersLength: bookingPassengers.length,
        leadPassengerData,
      });
      setErrors(allErrors);
      return allErrors.length === 0;
    },
    [
      selectedTour,
      departureDate,
      bookingPassengers,
      paymentMethod,
      isPowerUser,
      leadPassengerData,
      validatePassenger,
      setErrors,
    ]
  );

  const saveOrder = async () => {
    console.log("saveOrder: Starting save process", {
      userId: currentUser.id,
      userRole: currentUser.role || "user",
      isPowerUser,
      selectedTour,
      departureDate,
      passengerCount: bookingPassengers.length,
      paymentMethod,
    });

    if (!validateBooking(4)) {
      setNotification({
        type: "error",
        message: "Please fix the validation errors before proceeding",
      });
      console.log("saveOrder: Validation failed", { errors });
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      setNotification({ type: "error", message: "Selected tour not found" });
      console.log("saveOrder: Tour not found", { selectedTour });
      return;
    }

    if (
      !isPowerUser &&
      tourData.available_seats !== undefined &&
      tourData.available_seats < bookingPassengers.length
    ) {
      setNotification({
        type: "error",
        message: "Cannot save booking: No seats available",
      });
      console.log("saveOrder: Insufficient seats", {
        availableSeats: tourData.available_seats,
        passengerCount: bookingPassengers.length,
      });
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
        passport_expire: cleanValueForDB(
          "passport_expire",
          firstPassenger?.passport_expire
        ),
        passport_copy: firstPassenger?.passport_upload || null,
        commission,
        created_by: currentUser.id,
        createdBy: currentUser.username || currentUser.email || "Unknown",
        tour: tourData.title,
        travel_choice: selectedTour,
        status: isPowerUser ? "confirmed" : "pending",
        hotel: firstPassenger?.hotel?.trim() || null,
        room_number: firstPassenger?.room_allocation?.trim() || null,
        payment_method: paymentMethod.join(","), // Store as comma-separated string
        departureDate: cleanValueForDB("departure_date", departureDate) || null,
        total_price: totalPrice,
        total_amount: totalPrice,
        paid_amount: 0,
        balance: totalPrice,
        show_in_provider: isPowerUser ? showInProvider : false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("saveOrder: Inserting order", { orderData });

      const { data: orderResult, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError || !orderResult) {
        console.error("saveOrder: Order insertion failed", {
          orderError,
          details: orderError?.details,
          hint: orderError?.hint,
          code: orderError?.code,
        });
        throw new Error(orderError?.message || "No order data returned");
      }

      const orderId = String(orderResult.id);
      console.log("saveOrder: Order inserted", { orderId });

      const uploadedPaths = await Promise.all(
        bookingPassengers.map(async (passenger, index) => {
          if (
            passenger.passport_upload &&
            typeof passenger.passport_upload !== "string"
          ) {
            const file = passenger.passport_upload as File;
            const fileExt = file.name.split(".").pop();
            const fileName = `passport_${orderId}_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2)}.${fileExt}`;
            console.log("saveOrder: Uploading passport", {
              fileName,
              passengerIndex: index,
            });
            const { data, error } = await supabase.storage
              .from("passports")
              .upload(fileName, file);
            if (error) {
              console.error("saveOrder: Passport upload failed", {
                error,
                passengerIndex: index,
                details: error?.message,
              });
              return "";
            }
            return data.path;
          }
          return passenger.passport_upload || "";
        })
      );

      const cleanedPassengers = await Promise.all(
        bookingPassengers.map(async (passenger, index) => ({
          order_id: parseInt(orderId, 10),
          user_id: currentUser.id || null,
          tour_id: tourData.id,
          tour_title: selectedTour,
          departure_date:
            cleanValueForDB("departure_date", departureDate) || null,
          name:
            `${passenger.first_name || ""} ${
              passenger.last_name || ""
            }`.trim() || undefined,
          room_allocation: passenger.room_allocation?.trim() || "",
          serial_no: passenger.serial_no || (index + 1).toString(),
          passenger_number: passenger.passenger_number || `PAX-${index + 1}`,
          last_name: passenger.last_name?.trim() || "",
          first_name: passenger.first_name?.trim() || "",
          date_of_birth:
            cleanValueForDB("date_of_birth", passenger.date_of_birth) || "",
          age: passenger.age || null,
          gender: passenger.gender?.trim() || null,
          passport_number: passenger.passport_number?.trim() || "",
          passport_expire:
            cleanValueForDB("passport_expire", passenger.passport_expire) ||
            null,
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
          status: isPowerUser ? "active" : "pending",
          is_blacklisted: passenger.is_blacklisted || false,
          blacklisted_date:
            cleanValueForDB("blacklisted_date", passenger.blacklisted_date) ||
            null,
          notes: passenger.notes?.trim() || "",
          seat_count: passenger.seat_count || 1,
          main_passenger_id: passenger.main_passenger_id || null,
          sub_passenger_count: passenger.sub_passenger_count || 0,
          has_sub_passengers: passenger.has_sub_passengers || false,
          created_at: passenger.created_at || new Date().toISOString(),
          updated_at: passenger.updated_at || new Date().toISOString(),
        }))
      );

      const targetTable = isPowerUser ? "passengers" : "passenger_requests";
      console.log("saveOrder: Inserting passengers", {
        targetTable,
        passengerCount: cleanedPassengers.length,
        passengerData: cleanedPassengers,
      });

      const { data: insertedPassengers, error: passengerError } = await supabase
        .from(targetTable)
        .insert(cleanedPassengers)
        .select();

      if (passengerError) {
        console.error(
          `saveOrder: Passenger insertion failed in ${targetTable}`,
          {
            passengerError,
            details: passengerError?.details,
            hint: passengerError?.hint,
            code: passengerError?.code,
          }
        );
        throw new Error(passengerError.message);
      }

      console.log("saveOrder: Passengers inserted successfully", {
        targetTable,
        insertedPassengerIds: insertedPassengers?.map((p) => p.id) || [],
      });

      if (isPowerUser && tourData.available_seats !== undefined) {
        const newSeatCount = Math.max(
          0,
          tourData.available_seats - bookingPassengers.length
        );
        console.log("saveOrder: Updating tour seats", {
          tourId: tourData.id,
          currentSeats: tourData.available_seats,
          newSeatCount,
        });
        const { error: tourUpdateError } = await supabase
          .from("tours")
          .update({
            available_seats: newSeatCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tourData.id);
        if (tourUpdateError) {
          console.warn(
            "saveOrder: Failed to update tour seats",
            tourUpdateError.message
          );
          setNotification({
            type: "error",
            message: `Failed to update tour seats: ${tourUpdateError.message}`,
          });
        }
      }

      const newOrder: Order = {
        id: orderId,
        ...orderData,
        created_at: orderResult.created_at,
        updated_at: orderResult.updated_at,
        departureDate: cleanValueForDB("departure_date", departureDate) || "",
        total_price: totalPrice,
        total_amount: totalPrice,
        balance: totalPrice,
        paid_amount: 0,
        show_in_provider: isPowerUser ? showInProvider : false,
        created_by: currentUser.id,
        createdBy: currentUser.username || currentUser.email || "Unknown",
        user_id: currentUser.id,
        tour_id: tourData.id,
        travel_choice: selectedTour,
        status: isPowerUser ? "confirmed" : "pending",
        age: firstPassenger?.age || null,
        gender: firstPassenger?.gender || null,
        hotel: firstPassenger?.hotel || null,
        room_number: firstPassenger?.room_allocation || null,
        phone: firstPassenger?.phone || null,
        last_name: firstPassenger?.last_name || null,
        first_name: firstPassenger?.first_name?.trim() || null,
        email: firstPassenger?.email || null,
        tour: tourData.title,
        passport_number: firstPassenger?.passport_number || null,
        passport_expire: cleanValueForDB(
          "passport_expire",
          firstPassenger?.passport_expire
        ),
        passport_copy: firstPassenger?.passport_upload || null,
        passport_copy_url: null,
        commission,
        passenger_count: cleanedPassengers.length,
        order_id: orderId,
        payment_method: paymentMethod.join(","),
        passengers: cleanedPassengers.map((p, index) => ({
          ...p,
          id: insertedPassengers?.[index]?.id || generatePassengerId(),
          passport_upload: uploadedPaths[index] || null,
          order_id: String(p.order_id),
          passenger_number: p.passenger_number || `PAX-${index + 1}`,
          main_passenger_id: p.main_passenger_id || null,
          has_sub_passengers: p.has_sub_passengers || false,
          sub_passenger_count: p.sub_passenger_count || 0,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        })) as Passenger[],
        edited_by: null,
        edited_at: null,
        booking_confirmation: null,
      };

      setOrders((prev) => [...prev, newOrder]);
      setNotification({
        type: "success",
        message: `Booking ${
          isPowerUser ? "confirmed" : "submitted for approval"
        }`,
      });
      console.log("saveOrder: Order saved successfully", {
        orderId,
        targetTable,
        passengerIds: insertedPassengers?.map((p) => p.id) || [],
      });
      resetBookingForm();
    } catch (error) {
      console.error("saveOrder: Failed to save booking", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      });
      setNotification({
        type: "error",
        message: `Error saving booking: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = useCallback(() => {
    if (bookingPassengers.length === 0) {
      setNotification({ type: "error", message: "No passengers to export" });
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
      "Main Passenger ID",
      "Sub Passenger Count",
      "Has Sub Passengers",
      "Notes",
    ];

    const rows = bookingPassengers.map((p) =>
      [
        p.serial_no,
        p.last_name,
        p.first_name,
        cleanValueForDB("date_of_birth", p.date_of_birth) || "",
        p.age,
        p.gender,
        p.passport_number,
        cleanValueForDB("passport_expire", p.passport_expire) || "",
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
        p.main_passenger_id || "",
        p.sub_passenger_count || 0,
        p.has_sub_passengers || false,
        p.notes || "",
      ]
        .map((v) => `"${v || ""}"`)
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
    setNotification({
      type: "success",
      message: "CSV downloaded successfully",
    });
  }, [bookingPassengers, selectedTour]);

  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      setNotification({ type: "error", message: "Please upload a CSV file" });
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      setNotification({ type: "error", message: "No tour selected" });
      return;
    }

    if (!isPowerUser && !(await canAddPassenger())) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          setNotification({
            type: "error",
            message: "CSV file must contain at least a header and one data row",
          });
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
          "Main Passenger ID",
          "Sub Passenger Count",
          "Has Sub Passengers",
          "Notes",
        ];

        if (!requiredHeaders.every((h) => headers.includes(h))) {
          setNotification({
            type: "error",
            message: "CSV file is missing required headers",
          });
          return;
        }

        const validateCsvRow = (row: Record<string, string>): boolean => {
          const requiredFields = [
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Nationality",
            "Room Type",
            "Hotel",
            "Passport Number",
          ];
          for (const field of requiredFields) {
            if (!row[field] || row[field].trim().length === 0) {
              return false;
            }
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row["Email"])) {
            return false;
          }
          if (row["Phone"].replace(/\D/g, "").length < 8) {
            return false;
          }
          if (row["First Name"].length > 50 || row["Last Name"].length > 50) {
            return false;
          }
          const cleanDateOfBirth = cleanValueForDB(
            "date_of_birth",
            row["Date of Birth"]
          );
          if (!cleanDateOfBirth) {
            return false;
          }
          if (row["Passport Expiry"]) {
            const cleanDate = cleanValueForDB(
              "passport_expiry",
              row["Passport Expiry"]
            );
            if (!cleanDate) {
              return false;
            }
          }
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
          setNotification({
            type: "error",
            message: "No valid passenger data found in CSV",
          });
          return;
        }

        const availableSlots = isPowerUser
          ? MAX_PASSENGERS - bookingPassengers.length
          : Math.min(
              MAX_PASSENGERS - bookingPassengers.length,
              tourData.available_seats !== undefined
                ? tourData.available_seats - bookingPassengers.length
                : MAX_PASSENGERS,
              leadPassengerData?.seat_count !== undefined
                ? leadPassengerData.seat_count - bookingPassengers.length
                : MAX_PASSENGERS
            );

        if (data.length > availableSlots) {
          setNotification({
            type: "error",
            message: `Cannot import ${data.length} passengers. Only ${availableSlots} seats available.`,
          });
          return;
        }

        const now = new Date().toISOString();
        const csvPassengers: Passenger[] = data.map((row, idx) => {
          const baseSerial = bookingPassengers.length + idx + 1;
          const services = row["Additional Services"]
            ? row["Additional Services"]
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];
          const servicePrice = calculateServicePrice(services, tourData);
          const cleanPassportExpiry = cleanValueForDB(
            "passport_expiry",
            row["Passport Expiry"]
          );
          const cleanDateOfBirth =
            cleanValueForDB("date_of_birth", row["Date of Birth"]) || "";
          return {
            id: generatePassengerId(),
            order_id: "",
            user_id: currentUser.id || null,
            tour_id: tourData.id,
            tour_title: selectedTour,
            departure_date:
              cleanValueForDB("departure_date", departureDate) || null,
            name:
              `${row["First Name"]} ${row["Last Name"]}`.trim() || undefined,
            room_allocation: row["Room Allocation"] || "",
            serial_no: row["Serial No"] || baseSerial.toString(),
            passenger_number: row["Passenger Number"] || `PAX-${baseSerial}`,
            last_name: row["Last Name"] || "",
            first_name: row["First Name"] || "",
            date_of_birth: cleanDateOfBirth,
            age:
              parseInt(row["Age"]) ||
              calculateAge(row["Date of Birth"]) ||
              null,
            gender: row["Gender"] || null,
            passport_number: row["Passport Number"] || "",
            passport_expire: cleanPassportExpiry || null,
            nationality: row["Nationality"] || "Mongolia",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || availableHotels[0] || "",
            additional_services: services,
            price: tourData.base_price + servicePrice,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: row["Passport Upload"] || null,
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            status: isPowerUser ? "active" : "pending",
            is_blacklisted: row["Is Blacklisted"] === "true" || false,
            blacklisted_date:
              cleanValueForDB("blacklisted_date", row["Blacklisted Date"]) ||
              null,
            notes: row["Notes"] || "",
            seat_count: parseInt(row["Seat Count"]) || 1,
            main_passenger_id: row["Main Passenger ID"] || null,
            sub_passenger_count: parseInt(row["Sub Passenger Count"]) || 0,
            has_sub_passengers: row["Has Sub Passengers"] === "true" || false,
            created_at: now,
            updated_at: now,
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
        setNotification({
          type: "success",
          message: `Successfully imported ${newPassengers.length} passengers`,
        });
      } catch (error) {
        console.error("useBooking: Error in handleUploadCSV", error);
        setNotification({
          type: "error",
          message: "Failed to parse CSV file. Please check the format.",
        });
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
    console.log("useBooking: handleNextStep called", {
      activeStep,
      paymentMethod,
      errors,
      bookingPassengersLength: bookingPassengers.length,
      loading,
    });
    switch (activeStep) {
      case 1:
        if (!selectedTour?.trim() || !departureDate?.trim()) {
          setNotification({
            type: "error",
            message: "Please select tour and date",
          });
          return;
        }
        setActiveStep(2);
        break;
      case 2:
        setActiveStep(3);
        break;
      case 3:
        if (bookingPassengers.length === 0) {
          setNotification({
            type: "error",
            message: "Add at least one passenger",
          });
          return;
        }
        if (validateBooking(activeStep)) {
          setErrors((prev) =>
            prev.filter(
              (e) => e.field !== "payment" && e.field !== "show_in_provider"
            )
          );
          setActiveStep(4);
        } else {
          setNotification({
            type: "error",
            message: "Please fix all validation errors before proceeding",
          });
        }
        break;
      case 4:
        if (!loading && validateBooking(activeStep)) {
          console.log("useBooking: Proceeding to saveOrder");
          await saveOrder();
        } else if (!loading) {
          console.log("useBooking: Validation failed in step 4", { errors });
          setNotification({
            type: "error",
            message: "Please fix all validation errors before confirming",
          });
        } else {
          console.log("useBooking: SaveOrder in progress, loading true");
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
    paymentMethod,
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
    passengerFormData,
    setPassengerFormData,
    confirmLeadPassenger,
  };
};
