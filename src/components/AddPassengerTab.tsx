import { useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import type { Tour, Passenger, User as UserType, ValidationError, Order, OrderStatus } from "../types/type";
import Notifications from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import TourSelection from "../Parts/TourSelection";
import PassengerForm from "../Parts/PassengerForm";
import BookingSummary from "../Parts/BookingSummary";
import { downloadTemplate } from "../utils/csvUtils";
import { checkSeatLimit } from "../utils/seatLimitChecks";

interface AddPassengerTabProps {
  tours: Tour[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  selectedTour: string;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  errors: ValidationError[];
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
}

// 🧹 SUPER AGGRESSIVE DATE/TIMESTAMP CLEANER
const cleanDateForDB = (dateValue: string | undefined | null): string | null => {
  if (!dateValue || dateValue.trim() === '') {
    return null;
  }
  return dateValue.trim();
};

// 🕒 TIMESTAMP CLEANER - ensures valid ISO string or null
const cleanTimestampForDB = (timestamp: string | undefined | null): string | null => {
  if (!timestamp || timestamp.trim() === "") return null;
  return timestamp.trim();
};

const cleanValueForDB = (field: string, value: any): any => {
  // Clean date fields
  if (['date_of_birth', 'passport_expiry', 'departure_date', 'blacklisted_date'].includes(field)) {
    return cleanDateForDB(value);
  }

  // Clean timestamp fields
  if (['created_at', 'updated_at'].includes(field)) {
    return cleanTimestampForDB(value);
  }

  // Clean departureDate for orders
  if (field === 'departureDate') {
    return cleanDateForDB(value);
  }

  // Clean passport_expire for orders
  if (field === 'passport_expire') {
    return cleanDateForDB(value);
  }

  return value;
};

// ✅ FIXED: Single UUID generator with fallback
const generatePassengerId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.id,
    name: "",
    tour_title: selectedTourData?.title || "",
    departure_date: selectedTourData?.departure_date || "",
    room_allocation: "",
    serial_no: serialNo,
    last_name: "",
    first_name: "",
    date_of_birth: "",
    age: 0,
    gender: "",
    passport_number: "",
    passport_expiry: null,
    nationality: "Mongolia",
    roomType: defaultRoomType,
    hotel: "",
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: "",
    passport_upload: "",
    allergy: "",
    emergency_phone: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "active",
    is_blacklisted: false,
    blacklisted_date: null,
  };
};

export default function AddPassengerTab({
  tours,
  orders,
  setOrders,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  errors,
  showNotification,
  currentUser,
}: AddPassengerTabProps) {
  // ✅ LOCAL STATE FOR CURRENT BOOKING ONLY
  const [bookingPassengers, setBookingPassengers] = useState<Passenger[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInProvider, setShowInProvider] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(null);
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  
  const newPassengerRef = useRef<HTMLDivElement | null>(null);

  const MAX_PASSENGERS = 20;
  
  // 💪 POWER USERS: Admin, Manager, Superadmin - UNLIMITED ACCESS!
  const isPowerUser = currentUser.role === "admin" || 
                     currentUser.role === "manager" || 
                     currentUser.role === "superadmin";

  const filteredTours = isPowerUser ? tours : tours.map(({ available_seats, ...rest }) => rest);
  const selectedTourData = tours.find((t) => t.title === selectedTour);

  // ✅ Use bookingPassengers.length instead of global passengers
  const remainingSeats = isPowerUser
    ? undefined
    : selectedTourData?.available_seats !== undefined
      ? Math.max(0, selectedTourData.available_seats - bookingPassengers.length)
      : undefined;

  // 💪 POWER USERS GET TOTAL DOMINATION
  const canAddPassenger = async () => {
    if (bookingPassengers.length >= MAX_PASSENGERS) {
      wrappedShowNotification("error", `Maximum ${MAX_PASSENGERS} passengers allowed per booking`);
      return false;
    }
    if (!selectedTour || !departureDate) {
      wrappedShowNotification("error", "Please select a tour and departure date");
      return false;
    }
    if (!selectedTourData) {
      wrappedShowNotification("error", "Invalid tour selected");
      return false;
    }
    
    // 💪 POWER USERS: Admin, Manager, Superadmin - UNLIMITED POWER!
    if (isPowerUser) {
      console.log(`💪 ${currentUser.role.toUpperCase()} MODE: Unlimited booking power activated!`);
      return true;
    }

    // Regular users get role-aware seat checking
    console.log("🔢 Regular user: Checking seat availability...");
    const { isValid, message } = await checkSeatLimit(
      selectedTourData.id, 
      departureDate, 
      currentUser.role // Pass the role to the function
    );
    
    if (!isValid) {
      wrappedShowNotification("error", message);
      return false;
    }
    
    console.log("✅ Seat check passed for regular user");
    return true;
  };

  const wrappedShowNotification = useCallback((type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
    showNotification(type, message);
  }, [showNotification]);

  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth || isNaN(new Date(dateOfBirth).getTime())) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return Math.max(0, age);
  };

  const calculateServicePrice = (services: string[], tourData: Tour): number => {
    return services.reduce((sum, serviceName) => {
      const service = tourData.services.find((s) => s.name === serviceName);
      return sum + (service ? service.price : 0);
    }, 0);
  };

  const getPassportExpiryColor = (expiryDate: string): string => {
    if (!expiryDate) return "border-gray-300";
    const expiry = new Date(expiryDate);
    const today = new Date();
    const monthsRemaining = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());
    if (monthsRemaining <= 0) return "border-red-500 bg-red-50";
    if (monthsRemaining <= 1) return "border-red-400 bg-red-50";
    if (monthsRemaining <= 3) return "border-orange-400 bg-orange-50";
    if (monthsRemaining <= 7) return "border-yellow-400 bg-yellow-50";
    return "border-green-400 bg-green-50";
  };

  // ✅ SINGLE PASSENGER ADD ONLY - Clean and simple
  const addPassenger = useCallback(async () => {
    const canAdd = await canAddPassenger();
    if (!canAdd) return;

    try {
      const newPassenger = createNewPassenger(currentUser, bookingPassengers, selectedTourData);
      setBookingPassengers(prev => [...prev, newPassenger]);
      setExpandedPassengerId(newPassenger.id);
      const passengerCount = bookingPassengers.length + 1;
      wrappedShowNotification("success", `Added passenger ${passengerCount}`);
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      wrappedShowNotification("error", "Failed to add passenger. Please try again.");
    }
  }, [bookingPassengers, currentUser, selectedTourData, wrappedShowNotification, canAddPassenger]);

  // ✅ UPDATED: Use bookingPassengers and field-specific loading
  const updatePassenger = async (index: number, field: keyof Passenger, value: any) => {
    if (index < 0 || index >= bookingPassengers.length) {
      wrappedShowNotification("error", "Invalid passenger index");
      return;
    }

    const passengerId = bookingPassengers[index].id;
    const loadingKey = `${passengerId}-${String(field)}`;
    
    const updatedPassengers = [...bookingPassengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };

    if (field === "date_of_birth" && value) {
      updatedPassengers[index].age = calculateAge(value);
    }

    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[index].price = (updatedPassengers[index].price || 0) + calculateServicePrice(value as string[], tour);
      }
    }

    if (field === "first_name" || field === "last_name") {
      const first = updatedPassengers[index].first_name || "";
      const last = updatedPassengers[index].last_name || "";
      updatedPassengers[index].name = `${first} ${last}`.trim();
    }

    // ✅ IMPROVED: Field-specific loading for passport upload
    if (field === "passport_upload" && value instanceof File) {
      setFieldLoading(prev => ({ ...prev, [loadingKey]: true }));
      try {
        const fileExt = value.name.split(".").pop();
        const fileName = `passport_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from("passports").upload(fileName, value);
        if (error) {
          wrappedShowNotification("error", `Passport upload failed: ${error.message}`);
          return;
        }
        updatedPassengers[index].passport_upload = data.path;
        wrappedShowNotification("success", "Passport uploaded successfully");
      } catch (error) {
        wrappedShowNotification("error", "Failed to upload passport");
      } finally {
        setFieldLoading(prev => ({ ...prev, [loadingKey]: false }));
      }
    }

    updatedPassengers[index].updated_at = new Date().toISOString();
    setBookingPassengers(updatedPassengers);
  };

  // ✅ UPDATED: Use bookingPassengers
  const removePassenger = useCallback((index: number) => {
    if (bookingPassengers.length === 1) {
      wrappedShowNotification("error", "At least one passenger is required");
      return;
    }

    if (index < 0 || index >= bookingPassengers.length) {
      wrappedShowNotification("error", "Invalid passenger selection");
      return;
    }

    try {
      const updatedPassengers = bookingPassengers.filter((_, i) => i !== index);
      const reNumberedPassengers = updatedPassengers.map((passenger, i) => ({
        ...passenger,
        serial_no: (i + 1).toString(),
        updated_at: new Date().toISOString(),
      }));
      setBookingPassengers(reNumberedPassengers);
      if (expandedPassengerId === bookingPassengers[index].id) {
        setExpandedPassengerId(null);
      }
      wrappedShowNotification("success", `Removed passenger ${index + 1}`);
    } catch (error) {
      wrappedShowNotification("error", "Failed to remove passenger. Please try again.");
    }
  }, [bookingPassengers, expandedPassengerId, wrappedShowNotification]);

  // ✅ UPDATED: Use bookingPassengers
  const clearAllPassengers = useCallback(() => {
    if (bookingPassengers.length === 0) {
      wrappedShowNotification("error", "No passengers to clear");
      return;
    }

    if (window.confirm(`Are you sure you want to remove all ${bookingPassengers.length} passengers?`)) {
      setBookingPassengers([]);
      setExpandedPassengerId(null);
      wrappedShowNotification("success", "All passengers cleared");
    }
  }, [bookingPassengers.length, wrappedShowNotification]);

  // ✅ UPDATED: Reset uses local state
  const resetBookingForm = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the entire booking? All data will be lost.")) {
      setBookingPassengers([]);
      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod("");
      setActiveStep(1);
      setShowInProvider(false);
      setExpandedPassengerId(null);
      wrappedShowNotification("success", "Booking form reset successfully");
    }
  }, [wrappedShowNotification]);

  // ✅ UPDATED: Use bookingPassengers
  const validatePassenger = (passenger: Passenger, departureDate: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!passenger.first_name.trim()) errors.push({ field: "first_name", message: "First name is required" });
    if (!passenger.last_name.trim()) errors.push({ field: "last_name", message: "Last name is required" });
    if (!passenger.email.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
      errors.push({ field: "email", message: "Valid email is required" });
    if (!passenger.phone.trim()) errors.push({ field: "phone", message: "Phone number is required" });
    if (!passenger.nationality) errors.push({ field: "nationality", message: "Nationality is required" });
    if (!passenger.gender) errors.push({ field: "gender", message: "Gender is required" });
    if (!passenger.passport_number.trim()) errors.push({ field: "passport_number", message: "Passport number is required" });
    if (!passenger.passport_expiry) errors.push({ field: "passport_expiry", message: "Passport expiry date is required" });
    else {
      const expiryDate = new Date(passenger.passport_expiry);
      const minDate = new Date(departureDate);
      minDate.setMonth(minDate.getMonth() + 6);
      if (expiryDate < minDate)
        errors.push({ field: "passport_expiry", message: "Passport must be valid for at least 6 months from departure date" });
    }
    if (!passenger.roomType) errors.push({ field: "roomType", message: "Room type is required" });
    if (!passenger.hotel) errors.push({ field: "hotel", message: "Hotel selection is required" });
    return errors;
  };

  // ✅ UPDATED: Use bookingPassengers
  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour) allErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate) allErrors.push({ field: "departure", message: "Please select a departure date" });
    if (bookingPassengers.length === 0) allErrors.push({ field: "passengers", message: "At least one passenger is required" });
    if (!paymentMethod) allErrors.push({ field: "payment", message: "Please select a payment method" });
    if (currentUser.role !== "user" && !showInProvider) {
      allErrors.push({ field: "show_in_provider", message: "Provider visibility is required" });
    }

    bookingPassengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger, departureDate);
      passengerErrors.forEach((error) => {
        allErrors.push({ field: `passenger_${index}_${error.field}`, message: `Passenger ${index + 1}: ${error.message}` });
      });
    });

    return allErrors.length === 0;
  };

  // 💣 MANAGER-PROOF SAVE ORDER - ABSOLUTE POWER FOR ADMIN, MANAGER, SUPERADMIN!
  const saveOrder = async () => {
    console.log("🚀 SAVE ORDER STARTED!");
    console.log("💪 POWER USER MODE:", isPowerUser, "Role:", currentUser.role);
    console.log("📊 Tour:", selectedTour, "Passengers:", bookingPassengers.length);

    if (!validateBooking()) {
      console.log("❌ Validation failed");
      wrappedShowNotification("error", "Please fix the validation errors before proceeding");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      console.log("❌ Tour not found");
      wrappedShowNotification("error", "Selected tour not found");
      return;
    }

    console.log("📊 Tour Data:", tourData);
    console.log("🪑 Available Seats:", tourData.available_seats);

    // 💪 POWER USERS BYPASS ALL LIMITS - Admin, Manager, Superadmin
    if (isPowerUser) {
      console.log(`💪 ${currentUser.role.toUpperCase()} MODE: SKIPPING ALL SEAT CHECKS - TOTAL DOMINATION!`);
    } else {
      // Regular users ONLY get seat checking
      console.log("🔢 Regular user: Checking available seats...");
      if (tourData.available_seats !== undefined && tourData.available_seats < bookingPassengers.length) {
        console.log("❌ Regular user: Not enough seats");
        wrappedShowNotification("error", "Cannot save booking. The tour is fully booked.");
        return;
      }
      console.log("✅ Regular user: Enough seats available");
    }

    setLoading(true);

    try {
      // ✅ Use bookingPassengers for calculations
      const totalPrice = bookingPassengers.reduce((sum, p) => sum + (p.price || 0), 0);
      const commission = totalPrice * 0.05;

      console.log("💰 Total Price:", totalPrice, "Commission:", commission);

      // 🧹 CREATE ORDER DATA - Use first passenger for order details
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
        passport_expire: firstPassenger?.passport_expiry ? cleanValueForDB('passport_expire', firstPassenger.passport_expiry) : null,
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
        departureDate: cleanValueForDB('departureDate', departureDate),
        total_price: totalPrice,
        total_amount: totalPrice,
        paid_amount: 0,
        balance: totalPrice,
        show_in_provider: currentUser.role !== "user" ? showInProvider : false,
      };

      console.log("🧹 ORDER DATA CREATED:", orderData);

      // Insert order
      console.log("📝 Inserting order...");
      const { data: orderResult, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error("❌ Order insert failed:", orderError);
        throw new Error(`Order creation failed: ${orderError.message}`);
      }
      if (!orderResult) {
        console.error("❌ No order result returned");
        throw new Error("No order data returned");
      }

      const orderId = String(orderResult.id);
      console.log("✅ Order created! ID:", orderId);

      // ✅ IMPROVED: Sequential file uploads to avoid race conditions
      const uploadPassengerFiles = async (passengers: Passenger[]): Promise<string[]> => {
        const uploadedPaths: string[] = [];
        
        for (const passenger of passengers) {
          if (passenger.passport_upload && typeof passenger.passport_upload !== 'string' && passenger.passport_upload !== null) {
            try {
              const file = passenger.passport_upload as File;
              const fileExt = file.name.split(".").pop();
              const fileName = `passport_${orderId}_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from("passports")
                .upload(fileName, file);

              if (!uploadError && uploadData) {
                uploadedPaths.push(uploadData.path);
                console.log(`✅ Passport uploaded for ${passenger.first_name}: ${uploadData.path}`);
              } else {
                console.warn(`⚠️ Failed to upload passport for ${passenger.first_name}:`, uploadError);
                uploadedPaths.push("");
              }
            } catch (uploadError) {
              console.error("Passport upload failed:", uploadError);
              uploadedPaths.push("");
            }
          } else {
            uploadedPaths.push(passenger.passport_upload || "");
          }
        }
        
        return uploadedPaths;
      };

      // Upload files first
      console.log("📁 Uploading passport files...");
      const uploadedPaths = await uploadPassengerFiles(bookingPassengers);
      console.log("✅ File uploads completed");

      // 🧹 CREATE PASSENGER DATA - LET DB GENERATE UUIDs
      const passengerPromises = bookingPassengers.map(async (passenger, index) => {
        const cleanPassenger: any = {
          // ✅ NO ID - Let database generate UUID
          order_id: orderId,
          user_id: currentUser.id,
          tour_title: selectedTour,
          departure_date: cleanValueForDB('departure_date', departureDate),
          name: `${passenger.first_name} ${passenger.last_name}`.trim(),
          room_allocation: passenger.room_allocation?.trim() || "",
          serial_no: (index + 1).toString(),
          last_name: passenger.last_name?.trim() || "",
          first_name: passenger.first_name?.trim() || "",
          date_of_birth: cleanValueForDB('date_of_birth', passenger.date_of_birth),
          age: passenger.age || null,
          gender: passenger.gender?.trim() || null,
          passport_number: passenger.passport_number?.trim() || "",
          passport_expiry: cleanValueForDB('passport_expiry', passenger.passport_expiry),
          nationality: passenger.nationality?.trim() || "Mongolia",
          roomType: passenger.roomType?.trim() || "",
          hotel: passenger.hotel?.trim() || "",
          additional_services: Array.isArray(passenger.additional_services) ? passenger.additional_services : [],
          price: passenger.price || 0,
          email: passenger.email?.trim() || "",
          phone: passenger.phone?.trim() || "",
          passport_upload: uploadedPaths[index] || null,
          allergy: passenger.allergy?.trim() || "",
          emergency_phone: passenger.emergency_phone?.trim() || "",
          status: "active",
          is_blacklisted: passenger.is_blacklisted || false,
          blacklisted_date: cleanValueForDB('blacklisted_date', passenger.blacklisted_date),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        return cleanPassenger;
      });

      const cleanedPassengers = await Promise.all(passengerPromises);
      console.log("🧹 PASSENGER DATA PREPARED:", cleanedPassengers.length, "passengers");

      // Insert passengers
      console.log("👥 Inserting passengers...");
      const { error: passengerError } = await supabase
        .from("passengers")
        .insert(cleanedPassengers);

      if (passengerError) {
        console.error("❌ Passenger insert failed:", passengerError);
        throw new Error(`Passenger creation failed: ${passengerError.message}`);
      }
      console.log("✅ Passengers inserted successfully!");

      // 💪 POWER USERS NEVER UPDATE TOUR SEATS
      if (!isPowerUser && tourData.available_seats !== undefined) {
        console.log("🔢 Regular user: Updating tour seats...");
        const newSeatCount = Math.max(0, tourData.available_seats - bookingPassengers.length);
        const { error: tourUpdateError } = await supabase
          .from("tours")
          .update({
            available_seats: newSeatCount,
            updated_at: new Date().toISOString()
          })
          .eq("id", tourData.id);

        if (tourUpdateError) {
          console.warn("⚠️ Failed to update tour seats:", tourUpdateError.message);
        } else {
          console.log(`✅ Tour seats updated: ${newSeatCount} remaining`);
        }
      } else if (isPowerUser) {
        console.log(`💪 ${currentUser.role.toUpperCase()} MODE: Skipping tour seat updates - UNLIMITED POWER!`);
      }

      // Create complete Order object for local state - Add fake IDs for local state
      const newOrderWithPassengers: Order = {
        id: orderId,
        user_id: orderData.user_id,
        tour_id: orderData.tour_id,
        phone: orderData.phone,
        last_name: orderData.last_name,
        first_name: orderData.first_name,
        email: orderData.email,
        age: orderData.age,
        gender: orderData.gender,
        tour: orderData.tour,
        passport_number: orderData.passport_number,
        passport_expire: orderData.passport_expire,
        passport_copy: orderData.passport_copy,
        commission: orderData.commission,
        created_by: orderData.created_by,
        edited_by: null,
        edited_at: null,
        travel_choice: orderData.travel_choice,
        status: "pending" as OrderStatus,
        hotel: orderData.hotel,
        room_number: orderData.room_number,
        payment_method: orderData.payment_method,
        created_at: orderResult.created_at,
        updated_at: orderResult.updated_at,
        departureDate: orderData.departureDate || departureDate,
        createdBy: orderData.createdBy,
        total_price: orderData.total_price,
        total_amount: orderData.total_amount,
        paid_amount: orderData.paid_amount,
        balance: orderData.balance,
        show_in_provider: orderData.show_in_provider,
        passengers: cleanedPassengers.map((p, index) => ({
          ...p,
          id: generatePassengerId(), // ✅ Add fake IDs for local state only
          passport_upload: uploadedPaths[index] || null,
        })) as Passenger[],
      };

      // Update global orders state
      setOrders(prev => [...prev, newOrderWithPassengers]);
      
      console.log("🎉 BOOKING COMPLETED SUCCESSFULLY!");
      console.log(`💪 ${currentUser.role.toUpperCase()} STATUS:`, isPowerUser ? "UNLIMITED POWER CONFIRMED!" : "Regular booking completed");
      
      wrappedShowNotification("success", `Booking saved successfully! Order ID: ${orderId}`);
      resetBookingForm(); // ✅ This now only resets local booking state
      
    } catch (error) {
      console.error("💥 CRITICAL SAVE ORDER ERROR:", error);
      wrappedShowNotification(
        "error",
        `Error saving booking: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Use bookingPassengers for CSV
  const handleDownloadCSV = () => {
    if (bookingPassengers.length === 0) {
      wrappedShowNotification("error", "No passengers to export");
      return;
    }

    const headers = [
      "Room Allocation", "Serial No", "Last Name", "First Name", "Date of Birth", "Age",
      "Gender", "Passport Number", "Passport Expiry", "Nationality", "Room Type", "Hotel",
      "Additional Services", "Price", "Email", "Phone", "Allergy", "Emergency Phone"
    ];

    const rows = bookingPassengers.map((p) =>
      [
        p.room_allocation, p.serial_no, p.last_name, p.first_name, p.date_of_birth, p.age,
        p.gender, p.passport_number, p.passport_expiry, p.nationality, p.roomType, p.hotel,
        p.additional_services.join(","), p.price, p.email, p.phone, p.allergy || "", p.emergency_phone || ""
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

  // 💪 POWER USERS GET UNLIMITED CSV UPLOADS
  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // 💪 POWER USERS BYPASS ALL CHECKS
    if (isPowerUser) {
      console.log(`💪 ${currentUser.role.toUpperCase()} MODE: CSV upload - UNLIMITED PASSENGERS ALLOWED!`);
    } else {
      // Regular users get seat checking
      const canAdd = await canAddPassenger();
      if (!canAdd) return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        if (lines.length < 2) {
          wrappedShowNotification("error", "CSV file must contain at least a header and one data row");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        const requiredHeaders = [
          "Room Allocation", "Serial No", "Last Name", "First Name", "Date of Birth", "Age",
          "Gender", "Passport Number", "Passport Expiry", "Nationality", "Room Type", "Hotel",
          "Additional Services", "Price", "Email", "Phone", "Allergy", "Emergency Phone"
        ];
        
        if (!requiredHeaders.every((h) => headers.includes(h))) {
          wrappedShowNotification("error", "CSV file is missing required headers");
          return;
        }

        // ✅ ADDED: CSV validation
        const validateCsvRow = (row: Record<string, string>): boolean => {
          const requiredFields = ["First Name", "Last Name", "Email", "Phone"];
          for (const field of requiredFields) {
            if (!row[field] || row[field].length > 100 || row[field].length < 1) return false;
          }
          
          // Email validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(row["Email"])) return false;
          
          // Phone number length check
          if (row["Phone"].replace(/\D/g, '').length < 8) return false;
          
          // Name length validation
          if (row["First Name"].length > 50 || row["Last Name"].length > 50) return false;
          
          return true;
        };

        const data = lines.slice(1)
          .map((line) => {
            const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
            return headers.reduce((obj: Record<string, string>, header, i) => {
              obj[header] = values[i] || "";
              return obj;
            }, {});
          })
          .filter(validateCsvRow); // ✅ Filter invalid rows

        if (data.length === 0) {
          wrappedShowNotification("error", "No valid passenger data found in CSV");
          return;
        }

        console.log(`📊 CSV contains ${data.length} valid passenger rows`);

        // 💪 POWER USERS BYPASS SEAT LIMITS
        if (!isPowerUser && tourData.available_seats !== undefined && data.length + bookingPassengers.length > tourData.available_seats) {
          wrappedShowNotification("error", "Cannot import passengers. The tour is fully booked.");
          return;
        }

        if (bookingPassengers.length + data.length > MAX_PASSENGERS) {
          wrappedShowNotification("error", `Cannot import ${data.length} passengers. Maximum ${MAX_PASSENGERS - bookingPassengers.length} more allowed.`);
          return;
        }

        const newPassengers = data.map((row, idx) => {
          const passenger: Passenger = {
            id: generatePassengerId(),
            order_id: "",
            user_id: currentUser.id,
            name: `${row["First Name"]} ${row["Last Name"]}`.trim(),
            room_allocation: row["Room Allocation"] || "",
            serial_no: (bookingPassengers.length + idx + 1).toString(),
            last_name: row["Last Name"] || "",
            first_name: row["First Name"] || "",
            date_of_birth: row["Date of Birth"] || "",
            age: parseInt(row["Age"]) || calculateAge(row["Date of Birth"]),
            gender: row["Gender"] || "",
            passport_number: row["Passport Number"] || "",
            passport_expiry: cleanDateForDB(row["Passport Expiry"]),
            nationality: row["Nationality"] || "Mongolia",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || "",
            additional_services: row["Additional Services"]
              ? row["Additional Services"]
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
              : [],
            price: parseFloat(row["Price"]) || 0,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: "active",
            tour_title: selectedTour,
            departure_date: cleanDateForDB(departureDate),
            is_blacklisted: false,
            blacklisted_date: null,
          };
          
          // Calculate price with services
          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tourData);
          }
          
          return passenger;
        });

        setBookingPassengers(prev => [...prev, ...newPassengers]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        wrappedShowNotification("success", `Successfully imported ${newPassengers.length} passengers`);
        console.log(`✅ ${newPassengers.length} passengers imported successfully!`);
      } catch (error) {
        console.error("❌ CSV parsing error:", error);
        wrappedShowNotification("error", "Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ✅ MEMOIZED: Use bookingPassengers
  const totalPrice = useMemo(() => 
    bookingPassengers.reduce((sum, p) => sum + (p.price || 0), 0), 
    [bookingPassengers]
  );

  // ✅ CONSOLIDATED: Single navigation handler
  const handleNextStep = useCallback(async () => {
    switch (activeStep) {
      case 1:
        if (!selectedTour || !departureDate) {
          wrappedShowNotification("error", "Please select tour and date");
          return;
        }
        setActiveStep(2);
        break;
      case 2:
        if (bookingPassengers.length === 0) {
          wrappedShowNotification("error", "Add at least one passenger");
          return;
        }
        if (validateBooking()) {
          setActiveStep(3);
        } else {
          wrappedShowNotification("error", "Please fix all validation errors before proceeding");
        }
        break;
      case 3:
        await saveOrder();
        break;
    }
  }, [activeStep, selectedTour, departureDate, bookingPassengers.length, validateBooking, wrappedShowNotification, saveOrder]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Notifications notification={notification} setNotification={setNotification} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Travel Booking</h1>
            {bookingPassengers.length > 0 && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {bookingPassengers.length} passenger{bookingPassengers.length !== 1 ? "s" : ""} • ${totalPrice.toLocaleString()}
              </div>
            )}
          </div>
          {(bookingPassengers.length > 0 || selectedTour || departureDate) && (
            <button
              onClick={resetBookingForm}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Reset Form
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <ProgressSteps activeStep={activeStep} />
        <ErrorSummary errors={errors} />

        {activeStep === 1 && (
          <TourSelection
            tours={filteredTours}
            selectedTour={selectedTour}
            setSelectedTour={setSelectedTour}
            departureDate={departureDate}
            setDepartureDate={setDepartureDate}
            errors={errors}
            setActiveStep={setActiveStep}
            userRole={currentUser.role}
            showAvailableSeats={true}
          />
        )}

        {activeStep === 2 && (
          <>
            {/* 💪 POWER USER HEADER - Clean booking info only */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm border border-slate-200 mb-6">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Booking Details</h3>
                      <p className="text-sm text-slate-600 flex items-center space-x-4">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                          {bookingPassengers.length} {bookingPassengers.length === 1 ? 'passenger' : 'passengers'}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          ${totalPrice.toLocaleString()}
                        </span>
                        {isPowerUser ? (
                          <span className="flex items-center font-medium text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            💪 {currentUser.role.toUpperCase()} MODE: Unlimited seats
                          </span>
                        ) : (
                          remainingSeats !== undefined && (
                            <span className={`flex items-center font-medium ${remainingSeats > 5 ? 'text-green-600' : remainingSeats > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {remainingSeats} seats left
                            </span>
                          )
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-white rounded-b-xl">
                <div className="flex flex-wrap gap-3 justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={addPassenger}
                      disabled={bookingPassengers.length >= MAX_PASSENGERS}
                      className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Passenger
                    </button>
                    <button
                      onClick={clearAllPassengers}
                      className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All
                    </button>
                    <button
                      onClick={() => newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      Jump to Bottom
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => downloadTemplate(wrappedShowNotification)}
                      className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Template
                    </button>
                    <label className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload CSV
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleUploadCSV}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveStep(1)}
                      className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={handleNextStep}
                      disabled={bookingPassengers.length === 0}
                      className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      Next
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ PASSENGER FORM - Uses local bookingPassengers */}
            <PassengerForm
              passengers={bookingPassengers}
              setPassengers={setBookingPassengers}
              selectedTourData={selectedTourData}
              errors={errors}
              updatePassenger={updatePassenger}
              removePassenger={removePassenger}
              downloadTemplate={() => downloadTemplate(wrappedShowNotification)}
              handleUploadCSV={handleUploadCSV}
              addPassenger={addPassenger}
              setActiveStep={setActiveStep}
              showNotification={wrappedShowNotification}
              expandedPassengerId={expandedPassengerId}
              setExpandedPassengerId={setExpandedPassengerId}
              newPassengerRef={newPassengerRef}
            />
          </>
        )}

        {activeStep === 3 && (
          <BookingSummary
            selectedTour={selectedTour}
            departureDate={departureDate}
            passengers={bookingPassengers}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            errors={errors}
            downloadCSV={handleDownloadCSV}
            saveOrder={saveOrder}
            setActiveStep={setActiveStep}
            loading={loading}
            showInProvider={showInProvider}
            setShowInProvider={setShowInProvider}
            currentUser={currentUser}
          />
        )}
      </div>

      {/* 💪 POWER USER MOBILE BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-40">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-600">Step {activeStep} of 3</div>
          <div className="text-sm font-medium text-gray-900">
            {bookingPassengers.length > 0 && (
              <span>{bookingPassengers.length} passenger{bookingPassengers.length !== 1 ? "s" : ""} • ${totalPrice.toLocaleString()}</span>
            )}
          </div>
        </div>

        {activeStep === 2 && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={addPassenger}
              disabled={bookingPassengers.length >= MAX_PASSENGERS}
              className="flex-1 inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              + Add
            </button>
            {bookingPassengers.length > 0 && (
              <button
                onClick={clearAllPassengers}
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            )}
            <button
              onClick={() => newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Bottom
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {activeStep > 1 && (
            <button
              onClick={() => setActiveStep(activeStep - 1)}
              className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          {activeStep < 3 && (
            <button
              onClick={handleNextStep}
              disabled={(activeStep === 1 && (!selectedTour || !departureDate)) || (activeStep === 2 && bookingPassengers.length === 0)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              {activeStep === 1 ? "Continue to Passengers" : "Review Booking"}
              {activeStep === 2 && (
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}
          {activeStep === 3 && (
            <button
              onClick={handleNextStep}
              disabled={loading || !validateBooking()}
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              {loading ? "Saving..." : "Confirm Booking"}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-900">Processing your request...</span>
          </div>
        </div>
      )}
    </div>
  );
}