import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import type { Passenger, Tour, User as UserType, ValidationError } from "../types/type";
import { validatePassenger, calculateAge, calculateServicePrice } from "../utils/passengerUtils";

// 🧹 DATABASE CLEANER - Only converts to null for DB inserts
const prepareForDatabase = (passenger: Passenger): any => {
  const dbData: any = {
    order_id: passenger.order_id || null,
    user_id: passenger.user_id || null,
    name: passenger.name?.trim() || null,
    room_allocation: passenger.room_allocation.trim() || null,
    serial_no: passenger.serial_no,
    first_name: passenger.first_name.trim() || null,
    last_name: passenger.last_name.trim() || null,
    // ✅ Dates: empty string → null for DB, but keep as string in state
    date_of_birth: passenger.date_of_birth?.trim() === '' ? null : passenger.date_of_birth?.trim(),
    age: passenger.age || null,
    gender: passenger.gender || null,
    passport_number: passenger.passport_number.trim() || null,
    passport_expire: passenger.passport_expire ? (passenger.passport_expire.trim() === '' ? null : passenger.passport_expire.trim()) : null,
    nationality: passenger.nationality.trim() || null,
    roomType: passenger.roomType.trim() || null,
    hotel: passenger.hotel.trim() || null,
    additional_services: passenger.additional_services || null,
    price: passenger.price || null,
    email: passenger.email.trim() || null,
    phone: passenger.phone.trim() || null,
    passport_upload: passenger.passport_upload || null,
    allergy: passenger.allergy.trim() || null,
    emergency_phone: passenger.emergency_phone.trim() || null,
    created_at: passenger.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  return dbData;
};

// 🎣 FIXED HOOK - Strings only in state, nulls only for DB
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

  // ➕ ADD PASSENGER - All strings, no nulls
  const addPassenger = useCallback(() => {
    const newPassenger: Passenger = {
      id: `passenger-${Date.now()}-${initialPassengers.length}`,
      order_id: "",
      user_id: currentUser.id || "",
      tour_title: "",
      departure_date: "",
      name: "",
      room_allocation: "",
      serial_no: (initialPassengers.length + 1).toString(),
      last_name: "",
      first_name: "",
      date_of_birth: "", // ✅ Empty string
      age: 0,
      gender: "",
      passport_number: "",
      passport_expire: "", // ✅ Empty string
      nationality: "Mongolia",
      roomType: initialPassengers.length > 0 && initialPassengers[initialPassengers.length - 1].roomType === "Double"
        ? initialPassengers[initialPassengers.length - 1].roomType
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
      status: "pending",
      is_blacklisted: false,
      blacklisted_date: "",
      notes: "",
      tour_id: "",
      passenger_number: "",
      main_passenger_id: null,
      sub_passenger_count: 0,
      has_sub_passengers: false
    };

    setPassengers(prev => [...prev, newPassenger]);
    showNotification("success", "Passenger added successfully");
  }, [initialPassengers.length, currentUser.id, setPassengers, showNotification]);

  // ✏️ UPDATE PASSENGER - Keep strings only, clean for display
  const updatePassenger = useCallback(async <K extends keyof Passenger>(
    index: number, 
    field: K, 
    value: Passenger[K]
  ) => {
    setLoading(true);

    // Clean the value but keep it as the correct type (string for your types)
    let cleanValue: Passenger[K] = value;
    
    if (typeof value === 'string') {
      cleanValue = value.trim() as Passenger[K];  // Trim but keep as string
    }

    setPassengers(prev => {
      if (index >= prev.length) {
        console.warn(`Passenger index ${index} out of bounds. Current length: ${prev.length}`);
        return prev;
      }

      const updatedPassengers = [...prev];
      const currentPassenger = { ...updatedPassengers[index] };

      // Update the field
      currentPassenger[field] = cleanValue;
      updatedPassengers[index] = currentPassenger;

      // Auto-calculate age
      if (field === "date_of_birth" && (cleanValue as string).trim() !== '') {
        const birthDate = (cleanValue as string).trim();
        if (birthDate) {
          currentPassenger.age = calculateAge(birthDate);
        }
      }

      // Calculate service price
      if (field === "additional_services" && Array.isArray(cleanValue)) {
        const tour = tours.find((t) => t.title === selectedTour);
        if (tour) {
          currentPassenger.price = calculateServicePrice(cleanValue as string[], tour);
        }
      }

      // Update name for group bookings
      if (field === "first_name" || field === "last_name") {
        const first = currentPassenger.first_name || "";
        const last = currentPassenger.last_name || "";
        currentPassenger.name = isGroup 
          ? `${groupName} - ${first} ${last}`.trim() 
          : `${first} ${last}`.trim();
      }

      // Handle passport upload
      if (field === "passport_upload" && cleanValue instanceof File) {
        const uploadPassport = async () => {
          try {
            const fileExt = cleanValue.name.split(".").pop();
            const fileName = `passport_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const { data, error } = await supabase.storage.from("passports").upload(fileName, cleanValue);
            
            if (error) {
              showNotification("error", `Passport upload failed: ${error.message}`);
              setLoading(false);
              return;
            }
            
            // Update with uploaded path (string)
            currentPassenger.passport_upload = data.path;
            updatedPassengers[index] = currentPassenger;
            setPassengers(updatedPassengers);
            showNotification("success", "Passport uploaded successfully");
          } catch (error) {
            showNotification("error", "Failed to upload passport");
          } finally {
            setLoading(false);
          }
        };
        
        uploadPassport();
        return prev; // Don't update state yet - wait for upload
      }

      currentPassenger.updated_at = new Date().toISOString();
      updatedPassengers[index] = currentPassenger;
      
      // Re-validate
      const newErrors: ValidationError[] = [];
      updatedPassengers.forEach((passenger, idx) => {
        const passengerErrors = validatePassenger(passenger);
        passengerErrors.forEach((error) => {
          newErrors.push({ 
            field: `passenger_${idx}_${error.field}`, 
            message: `Passenger ${idx + 1}: ${error.message}` 
          });
        });
      });
      
      setErrors(newErrors);
      
      return updatedPassengers;
    });

    if (!(field === "passport_upload" && value instanceof File)) {
      setLoading(false);  // Only set loading false if not uploading file
    }

  }, [setPassengers, currentUser.id, isGroup, groupName, selectedTour, tours, showNotification, setErrors]);

  // 🗑️ REMOVE PASSENGER
  const removePassenger = useCallback((index: number) => {
    if (initialPassengers.length === 1) {
      showNotification("error", "At least one passenger is required");
      return;
    }
    
    setPassengers(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      // Update serial numbers
      return filtered.map((p, i) => ({ 
        ...p, 
        serial_no: (i + 1).toString()
        // Dates stay as strings - no conversion needed
      }));
    });
    
    showNotification("success", "Passenger removed successfully");
  }, [initialPassengers.length, setPassengers, showNotification]);

  // ✅ VALIDATE BOOKING
  const validateBooking = useCallback((): boolean => {
    const allErrors: ValidationError[] = [];
    
    if (!selectedTour) {
      allErrors.push({ field: "tour", message: "Please select a tour" });
    }
    
    initialPassengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger);
      passengerErrors.forEach((error) => {
        allErrors.push({ 
          field: `passenger_${index}_${error.field}`, 
          message: `Passenger ${index + 1}: ${error.message}` 
        });
      });
    });
    
    setErrors(allErrors);
    return allErrors.length === 0;
  }, [initialPassengers, selectedTour, setErrors]);

  // 💾 SAVE BOOKING - Converts empty strings to null for DB
  const saveBooking = useCallback(async (): Promise<boolean> => {
    if (!validateBooking()) {
      showNotification("error", "Please fix validation errors before saving");
      return false;
    }

    const tour = tours.find((t) => t.title === selectedTour);
    if (!tour) {
      showNotification("error", "Please select a tour");
      return false;
    }

    setLoading(true);
    
    try {
      console.log('🚀 Starting booking save process...');
      
      // Step 1: Prepare passengers for database (empty strings → null)
      const dbPassengers = initialPassengers.map(prepareForDatabase);
      console.log('📝 DB-ready passengers:', dbPassengers);
      
      const { data: savedPassengers, error: passengerError } = await supabase
        .from('passengers')
        .insert(dbPassengers)
        .select('id, *')
        .order('id');

      if (passengerError) {
        console.error('❌ Passenger save error:', passengerError);
        throw new Error(`Failed to save passengers: ${passengerError.message}`);
      }

      console.log('✅ Passengers saved:', savedPassengers);

      // Step 2: Save booking
      const passengerIds = savedPassengers.map((p: any) => p.id);
      const totalPrice = initialPassengers.reduce((sum, p) => sum + (p.price || 0), 0);
      
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          tour_id: tour.id,
          passenger_ids: passengerIds,
          total_price: totalPrice,
          status: 'pending',
          departure_date: tour.departure_date.trim() === '' ? null : tour.departure_date.trim(),  // ✅ Empty → null
          created_by: currentUser.id
        })
        .select('id, *')
        .single();

      if (bookingError) {
        console.error('❌ Booking save error:', bookingError);
        throw new Error(`Failed to save booking: ${bookingError.message}`);
      }

      console.log('✅ Booking saved:', booking);

      // Step 3: Save order
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          booking_id: booking.id,
          order_number: orderNumber,
          total_amount: totalPrice,
          payment_status: 'pending',
          created_by: currentUser.id
        })
        .select('id, *')
        .single();

      if (orderError) {
        console.error('❌ Order save error:', orderError);
        throw new Error(`Failed to save order: ${orderError.message}`);
      }

      console.log('✅ Order saved:', order);

      // Success!
      showNotification('success', `Booking saved successfully! Order: ${orderNumber}`);
      setPassengers([]); // Clear form
      
      return true;

    } catch (error: any) {
      console.error('💥 Full booking save error:', error);
      showNotification('error', `Failed to save booking: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [initialPassengers, selectedTour, tours, currentUser, showNotification, validateBooking, setPassengers]);

  return {
    passengers: initialPassengers,  // ✅ Parent's state - all strings
    setPassengers,                  // ✅ Parent's setter  
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