// src/hooks/usePassengers.ts
import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import type {
  Passenger,
  Tour,
  User as UserType,
  ValidationError,
} from "../types/type";
import {
  validatePassenger,
  calculateAge,
  calculateServicePrice,
} from "../utils/passengerUtils";

// 🧹 Convert empty strings → null only for database insert
const prepareForDatabase = (passenger: Passenger): any => {
  const dbData: any = {
    order_id: passenger.order_id || null,
    user_id: passenger.user_id || null,
    name: passenger.name?.trim() || null,
    room_allocation: passenger.room_allocation?.trim() || null,
    serial_no: passenger.serial_no,
    first_name: passenger.first_name?.trim() || null,
    last_name: passenger.last_name?.trim() || null,
    date_of_birth:
      passenger.date_of_birth?.trim() === ""
        ? null
        : passenger.date_of_birth?.trim(),
    age: passenger.age || null,
    gender: passenger.gender || null,
    passport_number: passenger.passport_number?.trim() || null,
    passport_expire:
      passenger.passport_expire?.trim() === ""
        ? null
        : passenger.passport_expire?.trim(),
    nationality: passenger.nationality?.trim() || null,
    roomType: passenger.roomType?.trim() || null,
    hotel: passenger.hotel?.trim() || null,
    additional_services: passenger.additional_services?.length
      ? passenger.additional_services
      : null,
    price: passenger.price || null,
    email: passenger.email?.trim() || null,
    phone: passenger.phone?.trim() || null,
    passport_upload: passenger.passport_upload || null,
    allergy: passenger.allergy?.trim() || null,
    emergency_phone: passenger.emergency_phone?.trim() || null,
    notes: passenger.notes?.trim() || null,
    created_at: passenger.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return dbData;
};

export const usePassengers = (
  initialPassengers: Passenger[],
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>,
  currentUser: UserType,
  selectedTour: string,
  tours: Tour[],
  showNotification: (type: "success" | "error", message: string) => void
) => {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  // Type guard for File upload
  const isFileUpload = (field: keyof Passenger, value: any): value is File => {
    return field === "passport_upload" && value instanceof File;
  };

  const addPassenger = useCallback(() => {
    const newPassenger: Passenger = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order_id: "",
      user_id: currentUser.id || "",
      tour_title: "",
      departure_date: "",
      name: "",
      room_allocation: "",
      serial_no: (initialPassengers.length + 1).toString(),
      first_name: "",
      last_name: "",
      date_of_birth: "",
      age: 0,
      gender: "",
      passport_number: "",
      passport_expire: "",
      nationality: "Mongolia",
      roomType: "",
      hotel: "",
      additional_services: [],
      price: 0,
      email: "",
      phone: "",
      passport_upload: "",
      allergy: "",
      emergency_phone: "",
      notes: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "pending",
      is_blacklisted: false,
      blacklisted_date: "",
      tour_id: "",
      passenger_number: "",
      main_passenger_id: null,
      sub_passenger_count: 0,
      has_sub_passengers: false,
      booking_number: null,
      orders: null,
      note: "",
      is_request: undefined,
      pax_type: "Adult"
    };

    setPassengers((prev) => [...prev, newPassenger]);
    showNotification("success", "Passenger added");
  }, [
    initialPassengers.length,
    currentUser.id,
    setPassengers,
    showNotification,
  ]);

  const updatePassenger = useCallback(
    async <K extends keyof Passenger>(
      index: number,
      field: K,
      value: Passenger[K]
    ) => {
      setLoading(true);

      let cleanValue: Passenger[K] =
        typeof value === "string" ? (value.trim() as Passenger[K]) : value;

      setPassengers((prev) => {
        if (index >= prev.length) return prev;

        const updated = [...prev];
        const passenger = { ...updated[index] };

        // Handle file upload separately
        if (isFileUpload(field, value)) {
          const file = value as File;
          const upload = async () => {
            try {
              const ext = file.name.split(".").pop() || "jpg";
              const fileName = `passport_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}.${ext}`;

              const { data, error } = await supabase.storage
                .from("passports")
                .upload(fileName, file, { upsert: true });

              if (error) throw error;

              const {
                data: { publicUrl },
              } = supabase.storage.from("passports").getPublicUrl(data.path);

              setPassengers((p) => {
                const final = [...p];
                final[index] = {
                  ...final[index],
                  passport_upload: publicUrl || data.path,
                  updated_at: new Date().toISOString(),
                };
                return final;
              });

              showNotification("success", "Passport uploaded!");
            } catch (err: any) {
              showNotification("error", `Upload failed: ${err.message}`);
            } finally {
              setLoading(false);
            }
          };

          upload();
          return prev; // don't update state yet
        }

        // Normal field update
        (passenger as any)[field] = cleanValue;

        // Auto age
        if (
          field === "date_of_birth" &&
          typeof cleanValue === "string" &&
          cleanValue
        ) {
          passenger.age = calculateAge(cleanValue);
        }

        // Auto price from services
        if (field === "additional_services" && Array.isArray(cleanValue)) {
          const tour = tours.find((t) => t.title === selectedTour);
          if (tour) {
            passenger.price = calculateServicePrice(
              cleanValue as string[],
              tour
            );
          }
        }

        // Update full name
        if (field === "first_name" || field === "last_name") {
          const first = passenger.first_name || "";
          const last = passenger.last_name || "";
          passenger.name = isGroup
            ? `${groupName} - ${first} ${last}`.trim()
            : `${first} ${last}`.trim();
        }

        passenger.updated_at = new Date().toISOString();
        updated[index] = passenger;

        // Revalidate
        const newErrors: ValidationError[] = [];
        updated.forEach((p, i) => {
          validatePassenger(p).forEach((e) => {
            newErrors.push({
              field: `passenger_${i}_${e.field}`,
              message: `Passenger ${i + 1}: ${e.message}`,
            });
          });
        });
        setErrors(newErrors);

        return updated;
      });

      // Turn off loading only if not uploading file
      if (!isFileUpload(field, value)) {
        setLoading(false);
      }
    },
    [
      setPassengers,
      tours,
      selectedTour,
      isGroup,
      groupName,
      showNotification,
      setErrors,
    ]
  );

  const removePassenger = useCallback(
    (index: number) => {
      if (initialPassengers.length === 1) {
        showNotification("error", "At least one passenger required");
        return;
      }

      setPassengers((prev) =>
        prev
          .filter((_, i) => i !== index)
          .map((p, i) => ({ ...p, serial_no: (i + 1).toString() }))
      );
      showNotification("success", "Passenger removed");
    },
    [initialPassengers.length, setPassengers, showNotification]
  );

  const validateBooking = useCallback((): boolean => {
    const allErrors: ValidationError[] = [];

    if (!selectedTour) {
      allErrors.push({ field: "tour", message: "Please select a tour" });
    }

    initialPassengers.forEach((p, i) => {
      validatePassenger(p).forEach((e) => {
        allErrors.push({
          field: `passenger_${i}_${e.field}`,
          message: `Passenger ${i + 1}: ${e.message}`,
        });
      });
    });

    setErrors(allErrors);
    return allErrors.length === 0;
  }, [initialPassengers, selectedTour, setErrors]);

  const saveBooking = useCallback(async (): Promise<boolean> => {
    if (!validateBooking()) {
      showNotification("error", "Fix errors before saving");
      return false;
    }

    const tour = tours.find((t) => t.title === selectedTour);
    if (!tour) {
      showNotification("error", "Tour not found");
      return false;
    }

    setLoading(true);

    try {
      const dbPassengers = initialPassengers.map(prepareForDatabase);

      const { data: savedPassengers, error: pErr } = await supabase
        .from("passengers")
        .insert(dbPassengers)
        .select();

      if (pErr) throw pErr;

      const totalPrice = initialPassengers.reduce(
        (sum, p) => sum + (p.price || 0),
        0
      );

      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          tour_id: tour.id,
          passenger_ids: savedPassengers.map((p: any) => p.id),
          total_price: totalPrice,
          status: "pending",
          departure_date: tour.departure_date || null,
          created_by: currentUser.id,
        })
        .select()
        .single();

      const orderNumber = `ORD-${Date.now()}`;

      await supabase.from("orders").insert({
        booking_id: booking.id,
        order_number: orderNumber,
        total_amount: totalPrice,
        payment_status: "pending",
        created_by: currentUser.id,
      });

      showNotification("success", `Booking saved! Order: ${orderNumber}`);
      setPassengers([]);
      return true;
    } catch (err: any) {
      showNotification("error", `Save failed: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    initialPassengers,
    selectedTour,
    tours,
    currentUser,
    showNotification,
    validateBooking,
    setPassengers,
  ]);

  return {
    passengers: initialPassengers,
    setPassengers,
    errors,
    isGroup,
    setIsGroup,
    groupName,
    setGroupName,
    loading,
    addPassenger,
    updatePassenger,
    removePassenger,
    validateBooking,
    saveBooking,
  };
};
