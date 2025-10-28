// src/hooks/useBooking.ts
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  createNewPassenger,
  createNewPassengerLocal,
} from "../utils/bookingUtils";

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
  const [existingPassengers, setExistingPassengers] = useState<Passenger[]>([]);
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

  // REF TO BREAK LOOP
  const bookingPassengersRef = useRef<Passenger[]>([]);
  useEffect(() => {
    bookingPassengersRef.current = bookingPassengers;
  }, [bookingPassengers]);

  const MAX_PASSENGERS = 20;
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || "user"
  );

  const selectedTourData = tours.find((t) => t.title === selectedTour);
  const effectiveDepartureDate = departureDate;

  // === FETCH EXISTING PASSENGERS FROM DB ===
  useEffect(() => {
    if (!selectedTourData || !effectiveDepartureDate) {
      setExistingPassengers([]);
      return;
    }

    const fetchExisting = async () => {
      const target = isPowerUser ? "passengers" : "passenger_requests";
      const { data, error } = await supabase
        .from(target)
        .select("*")
        .eq("tour_id", selectedTourData.id)
        .eq("departure_date", effectiveDepartureDate);

      if (error) {
        console.error("Failed to fetch existing passengers:", error);
        return;
      }

      setExistingPassengers(data || []);
    };

    fetchExisting();
  }, [selectedTourData, effectiveDepartureDate, isPowerUser]);

  // === REASSIGN ROOMS — NO LOOP ===
  const reassignAllRooms = useCallback(() => {
    const allPassengers = [
      ...existingPassengers,
      ...bookingPassengersRef.current,
    ];
    const updated = bookingPassengersRef.current.map((p) => ({
      ...p,
      room_allocation: assignRoomAllocation(
        allPassengers,
        p,
        effectiveDepartureDate
      ),
    }));

    const oldRooms = bookingPassengersRef.current.map((p) => p.room_allocation);
    const newRooms = updated.map((p) => p.room_allocation);

    if (JSON.stringify(oldRooms) !== JSON.stringify(newRooms)) {
      setBookingPassengers(updated);
    }
  }, [existingPassengers, effectiveDepartureDate]);

  // === ONLY RUN WHEN DB CHANGES ===
  useEffect(() => {
    reassignAllRooms();
  }, [existingPassengers, reassignAllRooms]);

  // Clear payment error
  useEffect(() => {
    if (paymentMethod.length > 0) {
      setErrors((prev) => prev.filter((e) => e.field !== "payment"));
    }
  }, [paymentMethod, setErrors]);

  const confirmLeadPassenger = useCallback(() => {
    if (!leadPassengerData) {
      setNotification({ type: "error", message: "No lead passenger data" });
      return;
    }
    addMultiplePassengers(1);
  }, []);

  // === UPDATE PASSENGER ===
  const updatePassenger = useCallback(
    (
      index: number,
      field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
      value: any
    ) => {
      if (index < 0 || index >= bookingPassengers.length) return;

      const updatedPassengers = [...bookingPassengers];
      const mainPassenger = updatedPassengers[index];
      let shouldReassign = false;

      if (field === "hasSubPassengers") {
        updatedPassengers[index] = {
          ...mainPassenger,
          has_sub_passengers: value,
        };
        if (!value) {
          updatedPassengers[index].sub_passenger_count = 0;
          const subs = updatedPassengers.filter(
            (p) => p.main_passenger_id === mainPassenger.id
          );
          updatedPassengers.splice(
            updatedPassengers.findIndex((p) => p.id === mainPassenger.id) + 1,
            subs.length
          );
        }
        shouldReassign = true;
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
          const toAdd = newSubCount - currentSubCount;
          const newSubs = Array.from({ length: toAdd }, () =>
            createNewPassengerLocal(
              currentUser,
              updatedPassengers,
              selectedTourData,
              availableHotels,
              {
                main_passenger_id: mainPassenger.id,
                roomType: mainPassenger.roomType || "Single",
                room_allocation: mainPassenger.room_allocation,
                serial_no: mainPassenger.serial_no,
                departureDate: effectiveDepartureDate,
              }
            )
          );
          updatedPassengers.splice(index + currentSubCount + 1, 0, ...newSubs);
        } else if (newSubCount < currentSubCount) {
          updatedPassengers.splice(
            updatedPassengers.findIndex((p) => p.id === mainPassenger.id) +
              newSubCount +
              1,
            currentSubCount - newSubCount
          );
        }
        shouldReassign = true;
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
            calculateServicePrice(value, selectedTourData);
        }

        if (field === "first_name" || field === "last_name") {
          updatedPassengers[index].name = `${
            updatedPassengers[index].first_name || ""
          } ${updatedPassengers[index].last_name || ""}`.trim();
        }

        if (field === "roomType") {
          shouldReassign = true;
        }

        updatedPassengers[index].updated_at = new Date().toISOString();
      }

      setBookingPassengers(updatedPassengers);

      if (shouldReassign) {
        const allPassengers = [...existingPassengers, ...updatedPassengers];
        const newRooms = updatedPassengers.map((p) =>
          assignRoomAllocation(allPassengers, p, effectiveDepartureDate)
        );
        const oldRooms = updatedPassengers.map((p) => p.room_allocation);
        if (JSON.stringify(newRooms) !== JSON.stringify(oldRooms)) {
          reassignAllRooms();
        }
      }
    },
    [
      bookingPassengers,
      currentUser,
      selectedTourData,
      availableHotels,
      effectiveDepartureDate,
      existingPassengers,
      reassignAllRooms,
    ]
  );

  const remainingSeats = useMemo(() => {
    if (isPowerUser || !selectedTourData?.available_seats) return undefined;
    return Math.max(
      0,
      selectedTourData.available_seats -
        (bookingPassengers.length + (leadPassengerData?.seat_count || 0))
    );
  }, [
    isPowerUser,
    selectedTourData,
    bookingPassengers.length,
    leadPassengerData,
  ]);

  useEffect(() => {
    const canAddValue =
      bookingPassengers.length < MAX_PASSENGERS &&
      !!selectedTour &&
      !!departureDate &&
      !!selectedTourData &&
      (isPowerUser || (remainingSeats !== undefined && remainingSeats > 0));
    setCanAdd(canAddValue);
  }, [
    bookingPassengers.length,
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    remainingSeats,
  ]);

  // HOTELS
  useEffect(() => {
    if (!selectedTourData?.hotels) {
      setAvailableHotels([]);
      return;
    }
    const raw = selectedTourData.hotels;
    let hotels: string[] = [];
    if (Array.isArray(raw)) {
      hotels = raw
        .filter((h): h is string => typeof h === "string")
        .map((h) => h.trim())
        .filter(Boolean);
    } else if (typeof raw === "string") {
      hotels = raw
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean);
    }
    setAvailableHotels(hotels);
  }, [selectedTourData]);

  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
    },
    []
  );

  const calculateAge = useCallback(
    (dateOfBirth: string | undefined | null): number => {
      const dob = new Date(cleanValueForDB("date_of_birth", dateOfBirth) || "");
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      return Math.max(0, age);
    },
    []
  );

  const calculateServicePrice = useCallback(
    (services: string[], tourData: Tour): number => {
      return services.reduce((sum, name) => {
        const s = tourData.services.find((x) => x.name === name);
        return sum + (s?.price || 0);
      }, 0);
    },
    []
  );

  const canAddPassenger = useCallback(async () => {
    if (bookingPassengers.length >= MAX_PASSENGERS) return false;
    if (!selectedTour || !departureDate || !selectedTourData) return false;
    if (!isPowerUser && remainingSeats !== undefined && remainingSeats <= 0)
      return false;
    if (
      leadPassengerData?.seat_count !== undefined &&
      bookingPassengers.length >= leadPassengerData.seat_count
    )
      return false;
    const { isValid } = await checkSeatLimit(
      selectedTourData.id,
      departureDate,
      currentUser.role
    );
    return isValid;
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

  // === ADD PASSENGERS ===
  const addMultiplePassengers = useCallback(
    async (count: number) => {
      if (!(await canAddPassenger())) return;

      const availableSlots = isPowerUser
        ? MAX_PASSENGERS - bookingPassengers.length
        : Math.min(
            MAX_PASSENGERS - bookingPassengers.length,
            remainingSeats ?? MAX_PASSENGERS,
            leadPassengerData?.seat_count ?? MAX_PASSENGERS
          );
      const actualCount = Math.min(count, availableSlots);
      if (actualCount <= 0) return;

      const newPassengers = Array.from({ length: actualCount }, (_, idx) => {
        const isMain = idx === 0 && leadPassengerData;
        const passenger = createNewPassenger(
          currentUser,
          bookingPassengers,
          selectedTourData,
          availableHotels,
          isMain
            ? {
                first_name: leadPassengerData.first_name,
                last_name: leadPassengerData.last_name,
                phone: leadPassengerData.phone,
              }
            : {},
          effectiveDepartureDate
        );
        if (isMain) {
          passenger.serial_no = `P${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 4)}`;
        }
        return passenger;
      });

      const allPassengers = [
        ...existingPassengers,
        ...bookingPassengers,
        ...newPassengers,
      ];
      const updatedWithRooms = newPassengers.map((p) => ({
        ...p,
        room_allocation: assignRoomAllocation(
          allPassengers,
          p,
          effectiveDepartureDate
        ),
        departure_date: effectiveDepartureDate,
      }));

      setBookingPassengers((prev) => [...prev, ...updatedWithRooms]);
      setExpandedPassengerId(updatedWithRooms[0].id);
      showNotification(
        "success",
        `Added ${actualCount} passenger${actualCount > 1 ? "s" : ""}`
      );
      newPassengerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    },
    [
      canAddPassenger,
      bookingPassengers,
      currentUser,
      selectedTourData,
      availableHotels,
      remainingSeats,
      leadPassengerData,
      isPowerUser,
      showNotification,
      effectiveDepartureDate,
      existingPassengers,
    ]
  );

  // === REMOVE PASSENGER ===
  const removePassenger = useCallback(
    (index: number) => {
      if (bookingPassengers.length === 1) {
        showNotification("error", "At least one passenger is required");
        return;
      }
      const passengerToRemove = bookingPassengers[index];
      setBookingPassengers((prev) => {
        const filteredLocal = prev
          .filter((_, i) => i !== index)
          .filter((p) => p.main_passenger_id !== passengerToRemove.id);
        const allPassengers = [...existingPassengers, ...filteredLocal];
        const updated = filteredLocal.map((p) => ({
          ...p,
          room_allocation: assignRoomAllocation(
            allPassengers,
            p,
            effectiveDepartureDate
          ),
        }));
        if (
          JSON.stringify(updated.map((p) => p.room_allocation)) !==
          JSON.stringify(filteredLocal.map((p) => p.room_allocation))
        ) {
          return updated;
        }
        return filteredLocal;
      });
      if (expandedPassengerId === bookingPassengers[index].id)
        setExpandedPassengerId(null);
      showNotification("success", `Removed passenger ${index + 1}`);
    },
    [
      bookingPassengers,
      expandedPassengerId,
      showNotification,
      effectiveDepartureDate,
      existingPassengers,
    ]
  );

  const clearAllPassengers = useCallback(() => {
    if (bookingPassengers.length === 0) return;
    if (window.confirm(`Remove all ${bookingPassengers.length} passengers?`)) {
      setBookingPassengers([]);
      setExpandedPassengerId(null);
      showNotification("success", "All passengers cleared");
    }
  }, [bookingPassengers.length, showNotification]);

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
    showNotification("success", "Booking form reset");
  }, [setSelectedTour, setDepartureDate, setErrors, showNotification]);

  // === VALIDATION ===
  const validatePassenger = useCallback(
    (passenger: Passenger, depDate: string): ValidationError[] => {
      const errors: ValidationError[] = [];
      const { serial_no } = passenger;
      if (!passenger.first_name?.trim())
        errors.push({
          field: `passenger_${serial_no}_first_name`,
          message: `P${serial_no}: First name required`,
        });
      if (!passenger.last_name?.trim())
        errors.push({
          field: `passenger_${serial_no}_last_name`,
          message: `P${serial_no}: Last name required`,
        });
      if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
        errors.push({
          field: `passenger_${serial_no}_email`,
          message: `P${serial_no}: Valid email required`,
        });
      if (!passenger.phone?.trim())
        errors.push({
          field: `passenger_${serial_no}_phone`,
          message: `P${serial_no}: Phone required`,
        });
      if (!passenger.nationality?.trim())
        errors.push({
          field: `passenger_${serial_no}_nationality`,
          message: `P${serial_no}: Nationality required`,
        });
      if (!passenger.date_of_birth?.trim())
        errors.push({
          field: `passenger_${serial_no}_date_of_birth`,
          message: `P${serial_no}: DOB required`,
        });
      if (!passenger.passport_number?.trim())
        errors.push({
          field: `passenger_${serial_no}_passport_number`,
          message: `P${serial_no}: Passport required`,
        });
      if (!passenger.roomType?.trim())
        errors.push({
          field: `passenger_${serial_no}_roomType`,
          message: `P${serial_no}: Room type required`,
        });
      if (!passenger.hotel?.trim())
        errors.push({
          field: `passenger_${serial_no}_hotel`,
          message: `P${serial_no}: Hotel required`,
        });
      if (passenger.passport_expire) {
        const exp = cleanValueForDB(
          "passport_expire",
          passenger.passport_expire
        );
        const dep = cleanValueForDB("departure_date", depDate);
        if (exp && dep) {
          const min = new Date(dep);
          min.setMonth(min.getMonth() + 6);
          if (new Date(exp) < min) {
            errors.push({
              field: `passenger_${serial_no}_passport_expire`,
              message: `P${serial_no}: Passport must be valid 6+ months from departure`,
            });
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
        allErrors.push({ field: "tour", message: "Select tour" });
      if (!departureDate?.trim())
        allErrors.push({ field: "departure", message: "Select date" });
      if (step >= 3 && bookingPassengers.length === 0 && !leadPassengerData)
        allErrors.push({
          field: "passengers",
          message: "Add at least one passenger",
        });
      if (step === 4 && paymentMethod.length === 0)
        allErrors.push({ field: "payment", message: "Select payment method" });
      bookingPassengers.forEach((p) =>
        allErrors.push(...validatePassenger(p, effectiveDepartureDate))
      );
      setErrors(allErrors);
      return allErrors.length === 0;
    },
    [
      selectedTour,
      departureDate,
      bookingPassengers,
      paymentMethod,
      leadPassengerData,
      validatePassenger,
      setErrors,
      effectiveDepartureDate,
    ]
  );

  // === SAVE ORDER ===
  const saveOrder = async () => {
    if (!validateBooking(4)) {
      showNotification("error", "Fix validation errors");
      return;
    }
    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) return;

    setLoading(true);
    try {
      const totalPrice = bookingPassengers.reduce(
        (s, p) => s + (p.price || 0),
        0
      );
      const orderData = {
        user_id: currentUser.id,
        tour_id: tourData.id,
        departureDate: effectiveDepartureDate,
        total_price: totalPrice,
        status: isPowerUser ? "confirmed" : "pending",
        payment_method: paymentMethod[0] || null,
        travel_choice: "Regular",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: orderResult, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError || !orderResult)
        throw orderError || new Error("Order failed");

      const orderId = String(orderResult.id);
      const target = isPowerUser ? "passengers" : "passenger_requests";

      for (const p of bookingPassengers) {
        const cleaned = {
          order_id: parseInt(orderId, 10),
          user_id: currentUser.id,
          tour_id: tourData.id,
          tour_title: selectedTour,
          departure_date: effectiveDepartureDate
            ? cleanValueForDB("departure_date", effectiveDepartureDate)
            : null,
          name: `${p.first_name} ${p.last_name}`.trim(),
          room_allocation: p.room_allocation || "",
          serial_no: p.serial_no || "",
          passenger_number: p.passenger_number || `PAX-${Date.now()}`,
          last_name: p.last_name || "",
          first_name: p.first_name || "",
          date_of_birth: cleanValueForDB("date_of_birth", p.date_of_birth),
          age: p.age || null,
          gender: p.gender || null,
          passport_number: p.passport_number || "",
          passport_expire: cleanValueForDB(
            "passport_expire",
            p.passport_expire
          ),
          nationality: p.nationality || "Mongolia",
          roomType: p.roomType || "",
          hotel: p.hotel || "",
          additional_services: p.additional_services || [],
          price: p.price || 0,
          email: p.email || "",
          phone: p.phone || "",
          passport_upload: p.passport_upload || null,
          allergy: p.allergy || "",
          emergency_phone: p.emergency_phone || "",
          status: isPowerUser ? "active" : "pending",
          is_blacklisted: false,
          notes: p.notes || "",
          seat_count: p.seat_count || 1,
          main_passenger_id: p.main_passenger_id || null,
          sub_passenger_count: p.sub_passenger_count || 0,
          has_sub_passengers: p.has_sub_passengers || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: inserted } = await supabase
          .from(target)
          .insert(cleaned)
          .select()
          .single();
        if (!inserted) continue;

        const { data: allForDate } = await supabase
          .from(target)
          .select("*")
          .eq("departure_date", effectiveDepartureDate);
        const room = assignRoomAllocation(
          allForDate || [],
          inserted,
          effectiveDepartureDate
        );
        await supabase
          .from(target)
          .update({ room_allocation: room })
          .eq("id", inserted.id);
      }

      if (isPowerUser && tourData.available_seats !== undefined) {
        await supabase
          .from("tours")
          .update({
            available_seats: Math.max(
              0,
              tourData.available_seats - bookingPassengers.length
            ),
          })
          .eq("id", tourData.id);
      }

      const newOrder: Order = {
        id: orderResult.id,
        user_id: currentUser.id,
        tour_id: tourData.id,
        tour_title: selectedTour,
        departureDate: effectiveDepartureDate,
        total_price: totalPrice,
        status: isPowerUser ? "confirmed" : "pending",
        payment_method: paymentMethod[0] || null,
        created_at: new Date().toISOString(),
        phone: null,
        last_name: null,
        first_name: null,
        email: null,
        age: null,
        gender: null,
        tour: null,
        passport_number: null,
        passport_expire: null,
        passport_copy: null,
        passport_copy_url: null,
        commission: null,
        created_by: null,
        createdBy: null,
        edited_by: null,
        edited_at: null,
        travel_choice: "Regular",
        hotel: null,
        room_number: null,
        updated_at: "",
        passenger_count: 0,
        total_amount: 0,
        paid_amount: 0,
        balance: 0,
        show_in_provider: false,
        order_id: "",
        booking_confirmation: null,
        passengers: [],
        room_allocation: "",
      };

      setOrders((prev) => [...prev, newOrder]);
      showNotification(
        "success",
        isPowerUser ? "Booking confirmed" : "Submitted for approval"
      );
      resetBookingForm();
    } catch (error: any) {
      console.error("Save error:", error);
      showNotification("error", error.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = useCallback(() => {}, [
    bookingPassengers,
    selectedTour,
  ]);
  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {};

  const totalPrice = bookingPassengers.reduce((s, p) => s + (p.price || 0), 0);

  const handleNextStep = useCallback(async () => {
    switch (activeStep) {
      case 1:
        if (!selectedTour || !departureDate) return;
        setActiveStep(2);
        break;
      case 2:
        setActiveStep(3);
        break;
      case 3:
        if (bookingPassengers.length === 0) return;
        if (validateBooking(activeStep)) setActiveStep(4);
        break;
      case 4:
        if (!loading && validateBooking(activeStep)) await saveOrder();
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
    passengerFormData,
    setPassengerFormData,
    confirmLeadPassenger,
  };
};
