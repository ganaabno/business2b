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

declare global {
  var __bookingPassengers: Passenger[];
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

  const bookingPassengersRef = useRef<Passenger[]>([]);
  useEffect(() => {
    bookingPassengersRef.current = bookingPassengers;
  }, [bookingPassengers]);

  // CHANGE 1: Allow user to add, but only admin/manager save to passengers
  const canAddPassengers = ["admin", "manager", "superadmin", "user"].includes(
    currentUser.role || "user"
  );
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || "user"
  );

  const selectedTourData = tours.find((t) => t.title === selectedTour);
  const effectiveDepartureDate = departureDate;

  // === FETCH EXISTING PASSENGERS ===
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
        return;
      }

      setExistingPassengers(data || []);
    };

    fetchExisting();
  }, [selectedTourData, effectiveDepartureDate, isPowerUser]);

  // === REASSIGN ROOMS ===
  const reassignAllRooms = useCallback(async () => {
    const allPassengers = [
      ...existingPassengers,
      ...bookingPassengersRef.current,
    ];
    const updated = await Promise.all(
      bookingPassengersRef.current.map(async (p) => ({
        ...p,
        room_allocation: await assignRoomAllocation(
          allPassengers,
          p,
          effectiveDepartureDate
        ).catch(() => "M1"),
      }))
    );

    const oldRooms = bookingPassengersRef.current.map((p) => p.room_allocation);
    const newRooms = updated.map((p) => p.room_allocation);

    if (JSON.stringify(oldRooms) !== JSON.stringify(newRooms)) {
      setBookingPassengers(updated);
    }
  }, [existingPassengers, effectiveDepartureDate]);

  useEffect(() => {
    reassignAllRooms();
  }, [existingPassengers, reassignAllRooms]);

  // Clear payment error
  useEffect(() => {
    if (paymentMethod.length > 0) {
      setErrors((prev) => prev.filter((e) => e.field !== "payment"));
    }
  }, [paymentMethod, setErrors]);

  // In useBooking.ts — KEEP IT, but make it safe
  const confirmLeadPassenger = useCallback(() => {
    if (!leadPassengerData) {
      setNotification({ type: "error", message: "No lead data" });
      return;
    }

    // ONLY run if we have leadPassengerData AND no passengers yet
    if (bookingPassengers.length === 0) {
      addMultiplePassengers(1);
    }
  }, [leadPassengerData, bookingPassengers.length]);

  // === UPDATE PASSENGER ===
  const updatePassenger = useCallback(
    async (
      index: number,
      field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
      value: any
    ) => {
      if (index < 0 || index >= bookingPassengers.length) return;

      let updatedPassengers = [...bookingPassengers];
      const passenger = updatedPassengers[index];
      let shouldReassign = false;

      if (field === "hasSubPassengers") {
        // Only when checkbox is clicked → create/remove subs
        updatedPassengers[index] = { ...passenger, has_sub_passengers: value };
        if (!value) {
          updatedPassengers[index].sub_passenger_count = 0;
          updatedPassengers = updatedPassengers.filter(
            (p) => p.main_passenger_id !== passenger.id
          );
        }
        shouldReassign = true;
      } else if (
        field === "subPassengerCount" &&
        passenger.has_sub_passengers
      ) {
        // ONLY create subs when checkbox is ON
        const count = Math.max(0, parseInt(value, 10) || 0);
        updatedPassengers = updatedPassengers.filter(
          (p) => p.main_passenger_id !== passenger.id
        );
        updatedPassengers[index].sub_passenger_count = count;

        if (count > 0) {
          const newSubs = await Promise.all(
            Array.from({ length: count }, async () => {
              const sub = createNewPassengerLocal(
                currentUser,
                updatedPassengers,
                selectedTourData,
                availableHotels,
                {
                  main_passenger_id: passenger.id,
                  roomType: passenger.roomType || "Single",
                  serial_no: passenger.serial_no,
                  departureDate: effectiveDepartureDate,
                }
              );
              sub.room_allocation = await assignRoomAllocation(
                [...existingPassengers, ...updatedPassengers, sub],
                sub,
                effectiveDepartureDate
              ).catch(() => "M1");
              return sub;
            })
          );
          updatedPassengers.splice(index + 1, 0, ...newSubs);
        }
        shouldReassign = true;
      } else {
        // Normal field update
        const updated = {
          ...passenger,
          [field]: cleanValueForDB(field, value),
          updated_at: new Date().toISOString(),
        };
        if (field === "roomType") {
          shouldReassign = true;
          updatedPassengers.forEach((p, i) => {
            if (p.main_passenger_id === passenger.id) {
              updatedPassengers[i].roomType = value;
            }
          });
        }
        updatedPassengers[index] = updated;
      }

      if (shouldReassign) {
        const all = [...existingPassengers, ...updatedPassengers];
        const rooms = await Promise.all(
          updatedPassengers.map((p) =>
            assignRoomAllocation(all, p, effectiveDepartureDate).catch(
              () => "M1"
            )
          )
        );
        updatedPassengers = updatedPassengers.map((p, i) => ({
          ...p,
          room_allocation: rooms[i],
        }));
      }

      setBookingPassengers(updatedPassengers);
    },
    [
      bookingPassengers,
      currentUser,
      selectedTourData,
      availableHotels,
      effectiveDepartureDate,
      existingPassengers,
    ]
  );

  // === ADD MULTIPLE PASSENGERS ===
  const addMultiplePassengers = useCallback(
    async (count: number): Promise<number> => {
      const startIndex = bookingPassengers.length;
      if (count <= 0) return -1;

      const newPassengers: Passenger[] = [];
      for (let i = 0; i < count; i++) {
        const passenger = createNewPassenger(
          currentUser,
          [...bookingPassengers, ...newPassengers],
          selectedTourData,
          availableHotels,
          {},
          effectiveDepartureDate
        );
        passenger.room_allocation = await assignRoomAllocation(
          [...existingPassengers, ...bookingPassengers, ...newPassengers],
          passenger,
          effectiveDepartureDate
        ).catch(() => "M1");
        newPassengers.push(passenger);
      }

      setBookingPassengers((prev) => [...prev, ...newPassengers]);
      setExpandedPassengerId(newPassengers[0]?.id || null);
      return startIndex;
    },
    [
      bookingPassengers.length,
      currentUser,
      selectedTourData,
      availableHotels,
      effectiveDepartureDate,
      existingPassengers,
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
      !!selectedTour &&
      !!departureDate &&
      !!selectedTourData &&
      (isPowerUser || (remainingSeats !== undefined && remainingSeats > 0));
    setCanAdd(canAddValue);
  }, [
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

    const rawHotels = selectedTourData.hotels;
    const hotels: string[] = [];

    if (Array.isArray(rawHotels)) {
      hotels.push(
        ...rawHotels
          .filter((h): h is string => typeof h === "string")
          .map((h) => h.trim())
          .filter((h) => h.length > 0)
      );
    } else if (typeof rawHotels === "string") {
      hotels.push(
        ...rawHotels
          .split(",")
          .map((h) => h.trim())
          .filter((h) => h.length > 0)
      );
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
    if (!selectedTour || !departureDate || !selectedTourData) return false;
    if (!isPowerUser && remainingSeats !== undefined && remainingSeats <= 0)
      return false;
    const { isValid } = await checkSeatLimit(
      selectedTourData.id,
      departureDate,
      currentUser.role
    );
    return isValid;
  }, [
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    remainingSeats,
    currentUser.role,
  ]);

  // === REMOVE PASSENGER ===
  const removePassenger = useCallback(
    async (index: number) => {
      if (bookingPassengers.length === 1) {
        showNotification("error", "At least one passenger is required");
        return;
      }
      const passengerToRemove = bookingPassengers[index];
      let updatedPassengers = [...bookingPassengers];
      const filteredLocal = updatedPassengers
        .filter((_, i) => i !== index)
        .filter((p) => p.main_passenger_id !== passengerToRemove.id);
      const allPassengers = [...existingPassengers, ...filteredLocal];
      const updated = await Promise.all(
        filteredLocal.map(async (p) => ({
          ...p,
          room_allocation: await assignRoomAllocation(
            allPassengers,
            p,
            effectiveDepartureDate
          ).catch(() => "M1"),
        }))
      );

      setBookingPassengers(updated);
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

  useEffect(() => {
    globalThis.__bookingPassengers = bookingPassengers;
  }, [bookingPassengers]);

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
      // === CORRECT GROUPING LOGIC ===
      const groups: Passenger[][] = [];
      let currentGroup: Passenger[] = [];

      bookingPassengers.forEach((p, index) => {
        if (!p.main_passenger_id) {
          let wasLinkedFromPrevious = false;
          for (let j = index - 1; j >= 0; j--) {
            const prev = bookingPassengers[j];
            if (!prev.main_passenger_id) {
              wasLinkedFromPrevious = prev.is_related_to_next === true;
              break;
            }
          }

          if (currentGroup.length > 0 && !wasLinkedFromPrevious) {
            groups.push(currentGroup);
            currentGroup = [];
          }

          currentGroup.push(p);
        } else {
          currentGroup.push(p);
        }
      });

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      const target = isPowerUser ? "passengers" : "passenger_requests";
      const savedOrders: Order[] = [];

      for (const group of groups) {
        const groupPrice = group.reduce((s, p) => s + (p.price || 0), 0);

        const { data: orderResult, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: currentUser.id,
            tour_id: tourData.id,
            departureDate: effectiveDepartureDate,
            total_price: groupPrice,
            status: isPowerUser ? "confirmed" : "pending",
            payment_method: paymentMethod[0] || null,
            travel_choice: "Regular",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError || !orderResult)
          throw orderError || new Error("Order failed");

        const realOrderId = orderResult.id;

        for (const p of group) {
          const cleaned = {
            order_id: realOrderId,
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
            itinerary_status: p.itinerary_status || "No itinerary",
            pax_type: p.pax_type || "Adult",
            group_color: p.group_color || null,
          };

          await supabase.from(target).insert(cleaned);
        }

        if (isPowerUser && tourData.available_seats !== undefined) {
          await supabase
            .from("tours")
            .update({
              available_seats: Math.max(
                0,
                tourData.available_seats - group.length
              ),
            })
            .eq("id", tourData.id);
        }

        savedOrders.push({
          id: orderResult.id,
          tour_title: selectedTour,
          departureDate: effectiveDepartureDate,
          total_price: groupPrice,
          status: isPowerUser ? "confirmed" : "pending",
          payment_method: paymentMethod[0] || null,
          passenger_count: group.length,
        } as Order);
      }

      setOrders((prev) => [...prev, ...savedOrders]);
      showNotification(
        "success",
        `${groups.length} booking${groups.length > 1 ? "s" : ""} created!`
      );
      resetBookingForm();
    } catch (error: any) {
      showNotification("error", error.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

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
    handleDownloadCSV: () => {},
    handleUploadCSV: async () => {},
    handleNextStep,
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
    passengerFormData,
    setPassengerFormData,
    confirmLeadPassenger,
    setBookingPassengers,
  };
};
