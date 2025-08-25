import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type { Passenger, Tour, User as UserType, ValidationError } from "../types/type";
import { validatePassenger, calculateAge, calculateServicePrice } from "../utils/passengerUtils";

export const usePassengers = (
  initialPassengers: Passenger[],
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>,
  currentUser: UserType,
  selectedTour: string,
  tours: Tour[],
  showNotification: (type: "success" | "error", message: string) => void
) => {
  const [passengers, setPassengersState] = useState<Passenger[]>(initialPassengers);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPassengersState(initialPassengers);
  }, [initialPassengers]);

  const addPassenger = () => {
    const newPassenger: Passenger = {
      id: `passenger-${Date.now()}-${passengers.length}`,
      order_id: "",
      user_id: currentUser.id,
      name: "",
      room_allocation: "",
      serial_no: (passengers.length + 1).toString(),
      last_name: "",
      first_name: "",
      date_of_birth: "",
      age: 0,
      gender: "",
      passport_number: "",
      passport_expiry: "",
      nationality: "Mongolia",
      roomType: passengers.length > 0 && passengers[passengers.length - 1].roomType === "Double"
        ? passengers[passengers.length - 1].roomType
        : "",
      hotel: "",
      additional_services: [],
      price: 0,
      email: "",
      phone: "",
      passport_upload: "",
      allergy: "",
      emergency_phone: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPassengersState([...passengers, newPassenger]);
  };

  const updatePassenger = async (index: number, field: keyof Passenger, value: any) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };

    if (field === "date_of_birth" && value) {
      updatedPassengers[index].age = calculateAge(value);
    }

    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[index].price = calculateServicePrice(value, tour);
      }
    }

    if (field === "first_name" || field === "last_name") {
      const first = updatedPassengers[index].first_name || "";
      const last = updatedPassengers[index].last_name || "";
      updatedPassengers[index].name = isGroup ? `${groupName} - ${first} ${last}`.trim() : `${first} ${last}`.trim();
    }

    if (field === "passport_upload" && value instanceof File) {
      try {
        setLoading(true);
        const fileExt = value.name.split(".").pop();
        const fileName = `passport_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from("passports").upload(fileName, value);
        if (error) {
          showNotification("error", `Passport upload failed: ${error.message}`);
        } else {
          updatedPassengers[index].passport_upload = data.path;
          showNotification("success", "Passport uploaded successfully");
        }
      } catch (error) {
        showNotification("error", "Failed to upload passport");
      } finally {
        setLoading(false);
      }
    }

    updatedPassengers[index].updated_at = new Date().toISOString();
    setPassengersState(updatedPassengers);
  };

  const removePassenger = (index: number) => {
    if (passengers.length === 1) {
      showNotification("error", "At least one passenger is required");
      return;
    }
    setPassengersState(passengers.filter((_, i) => i !== index));
  };

  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour) allErrors.push({ field: "tour", message: "Please select a tour" });
    passengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger);
      passengerErrors.forEach((error) => {
        allErrors.push({ field: `passenger_${index}_${error.field}`, message: `Passenger ${index + 1}: ${error.message}` });
      });
    });
    setErrors(allErrors);
    return allErrors.length === 0;
  };

  return {
    passengers,
    setPassengers: setPassengersState,
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
  };
};