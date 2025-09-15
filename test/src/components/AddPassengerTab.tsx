import { useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import type { Tour, Passenger, User as UserType, ValidationError, Order } from "../types/type";
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
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  isGroup: boolean;
  setIsGroup: React.Dispatch<React.SetStateAction<boolean>>;
  groupName: string;
  setGroupName: React.Dispatch<React.SetStateAction<string>>;
  addPassenger: () => void;
  updatePassenger: (index: number, field: keyof Passenger, value: any) => Promise<void>;
  removePassenger: (index: number) => void;
  validateBooking: () => boolean;
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
}

const generatePassengerId = () => `passenger_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  isGroup: boolean,
  groupName: string,
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

  const inheritedDetails = isGroup && lastPassenger ? {
    nationality: lastPassenger.nationality,
    hotel: lastPassenger.hotel,
    emergency_phone: lastPassenger.emergency_phone,
  } : {
    nationality: "Mongolia",
    hotel: "",
    emergency_phone: "",
  };

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.id,
    name: "",
    tour_title: selectedTourData?.title || "",
    departure_date: selectedTourData?.departureDate || "",
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
  passengers,
  setPassengers,
  errors,
  isGroup,
  setIsGroup,
  groupName,
  setGroupName,
  showNotification,
  currentUser,
}: AddPassengerTabProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInProvider, setShowInProvider] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(null);
  const newPassengerRef = useRef<HTMLDivElement | null>(null);

  const MAX_PASSENGERS = 20;
  const isManager = currentUser.role === "manager" || currentUser.role === "superadmin";

  const filteredTours = isManager ? tours : tours.map(({ available_seats, ...rest }) => rest);

  const selectedTourData = tours.find((t) => t.title === selectedTour);

  const remainingSeats = isManager
    ? undefined
    : selectedTourData?.available_seats !== undefined
      ? Math.max(0, selectedTourData.available_seats - passengers.length)
      : undefined;

  const canAddPassenger = async () => {
    if (passengers.length >= MAX_PASSENGERS) {
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
    if (isManager) return true; // Managers bypass seat limits
    const { isValid, message } = await checkSeatLimit(selectedTourData.id, departureDate);
    if (!isValid) {
      wrappedShowNotification("error", message);
      return false;
    }
    return true;
  };

  const wrappedShowNotification = useCallback((type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
    showNotification(type, message);
  }, [showNotification]);

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

  const addPassenger = useCallback(async () => {
    const canAdd = await canAddPassenger();
    if (!canAdd) return;

    if (isGroup && !groupName.trim()) {
      wrappedShowNotification("error", "Please enter a group name before adding passengers");
      return;
    }

    try {
      const newPassenger = createNewPassenger(currentUser, passengers, isGroup, groupName, selectedTourData);
      setPassengers(prev => [...prev, newPassenger]);
      setExpandedPassengerId(newPassenger.id);
      const passengerCount = passengers.length + 1;
      const message = isGroup
        ? `Added passenger ${passengerCount} to group "${groupName}"`
        : `Added passenger ${passengerCount}`;
      wrappedShowNotification("success", message);
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      wrappedShowNotification("error", "Failed to add passenger. Please try again.");
    }
  }, [passengers, isGroup, groupName, currentUser, selectedTourData, wrappedShowNotification]);

  const addMultiplePassengers = useCallback(async (count: number) => {
    if (count < 1 || count > 10) {
      wrappedShowNotification("error", "Can add between 1-10 passengers at once");
      return;
    }

    if (passengers.length + count > MAX_PASSENGERS) {
      wrappedShowNotification("error", `Cannot add ${count} passengers. Maximum ${MAX_PASSENGERS} total allowed.`);
      return;
    }

    if (!isManager) {
      const canAdd = await canAddPassenger();
      if (!canAdd) return;
      if (selectedTourData?.available_seats !== undefined && passengers.length + count > selectedTourData.available_seats) {
        wrappedShowNotification("error", `Cannot add ${count} passengers. Only ${selectedTourData.available_seats - passengers.length} seats available.`);
        return;
      }
    }

    if (isGroup && !groupName.trim()) {
      wrappedShowNotification("error", "Please enter a group name before adding passengers");
      return;
    }

    try {
      const newPassengers = Array.from({ length: count }, (_, index) =>
        createNewPassenger(currentUser, [...passengers, ...Array(index).fill(null)], isGroup, groupName, selectedTourData)
      );
      setPassengers(prev => [...prev, ...newPassengers]);
      setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
      wrappedShowNotification("success", `Added ${count} passengers successfully`);
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      wrappedShowNotification("error", "Failed to add passengers. Please try again.");
    }
  }, [passengers, isGroup, groupName, currentUser, selectedTourData, wrappedShowNotification, isManager]);

  const updatePassenger = async (index: number, field: keyof Passenger, value: any) => {
    if (index < 0 || index >= passengers.length) {
      wrappedShowNotification("error", "Invalid passenger index");
      return;
    }

    const updatedPassengers = [...passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };

    if (field === "date_of_birth" && value) {
      updatedPassengers[index].age = calculateAge(value);
    }

    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[index].price = calculateServicePrice(value as string[], tour);
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
          wrappedShowNotification("error", `Passport upload failed: ${error.message}`);
          return;
        }
        updatedPassengers[index].passport_upload = data.path;
        wrappedShowNotification("success", "Passport uploaded successfully");
      } catch (error) {
        wrappedShowNotification("error", "Failed to upload passport");
      } finally {
        setLoading(false);
      }
    }

    updatedPassengers[index].updated_at = new Date().toISOString();
    setPassengers(updatedPassengers);
  };

  const removePassenger = useCallback((index: number) => {
    if (passengers.length === 1) {
      wrappedShowNotification("error", "At least one passenger is required");
      return;
    }

    if (index < 0 || index >= passengers.length) {
      wrappedShowNotification("error", "Invalid passenger selection");
      return;
    }

    try {
      const updatedPassengers = passengers.filter((_, i) => i !== index);
      const reNumberedPassengers = updatedPassengers.map((passenger, i) => ({
        ...passenger,
        serial_no: (i + 1).toString(),
        updated_at: new Date().toISOString(),
      }));
      setPassengers(reNumberedPassengers);
      if (expandedPassengerId === passengers[index].id) {
        setExpandedPassengerId(null);
      }
      wrappedShowNotification("success", `Removed passenger ${index + 1}`);
    } catch (error) {
      wrappedShowNotification("error", "Failed to remove passenger. Please try again.");
    }
  }, [passengers, expandedPassengerId, wrappedShowNotification]);

  const clearAllPassengers = useCallback(() => {
    if (passengers.length === 0) {
      wrappedShowNotification("error", "No passengers to clear");
      return;
    }

    if (window.confirm(`Are you sure you want to remove all ${passengers.length} passengers?`)) {
      setPassengers([]);
      setExpandedPassengerId(null);
      wrappedShowNotification("success", "All passengers cleared");
    }
  }, [passengers.length, wrappedShowNotification]);

  const resetBookingForm = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the entire booking? All data will be lost.")) {
      setPassengers([]);
      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod("");
      setActiveStep(1);
      setIsGroup(false);
      setGroupName("");
      setShowInProvider(false);
      setExpandedPassengerId(null);
      wrappedShowNotification("success", "Booking form reset successfully");
    }
  }, [wrappedShowNotification, setSelectedTour, setDepartureDate, setPassengers]);

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

  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour) allErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate) allErrors.push({ field: "departure", message: "Please select a departure date" });
    if (passengers.length === 0) allErrors.push({ field: "passengers", message: "At least one passenger is required" });
    if (!paymentMethod) allErrors.push({ field: "payment", message: "Please select a payment method" });
    if (currentUser.role !== "user" && !showInProvider) {
      allErrors.push({ field: "show_in_provider", message: "Provider visibility is required" });
    }

    passengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger, departureDate);
      passengerErrors.forEach((error) => {
        allErrors.push({ field: `passenger_${index}_${error.field}`, message: `Passenger ${index + 1}: ${error.message}` });
      });
    });

    return allErrors.length === 0;
  };

  const saveOrder = async () => {
    if (!validateBooking()) {
      wrappedShowNotification("error", "Please fix the validation errors before proceeding");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      wrappedShowNotification("error", "Selected tour not found");
      return;
    }

    if (!isManager && tourData.available_seats !== undefined && tourData.available_seats < passengers.length) {
      wrappedShowNotification("error", "Cannot save booking. The tour is fully booked.");
      return;
    }

    setLoading(true);

    try {
      const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);
      const commission = totalPrice * 0.05;

      const newOrder: Omit<Order, "id" | "passengers"> = {
        user_id: currentUser.userId,
        tour_id: tourData.id,
        phone: passengers[0].phone,
        last_name: passengers[0].last_name,
        first_name: passengers[0].first_name,
        email: passengers[0].email,
        age: passengers[0].age,
        gender: passengers[0].gender,
        passport_number: passengers[0].passport_number,
        passport_expire: passengers[0].passport_expiry,
        passport_copy: passengers[0].passport_upload,
        commission,
        created_by: currentUser.userId,
        createdBy: currentUser.username || currentUser.email,
        tour: tourData.title,
        edited_by: null,
        edited_at: null,
        travel_choice: selectedTour,
        status: "pending",
        hotel: passengers[0].hotel,
        room_number: passengers[0].room_allocation,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departureDate: departureDate,
        total_price: totalPrice,
        total_amount: totalPrice,
        paid_amount: 0,
        balance: totalPrice,
        show_in_provider: currentUser.role !== "user" ? showInProvider : false,
      };

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert(newOrder)
        .select()
        .single();
      if (orderError) throw new Error(orderError.message);

      const orderId = orderData.id as string;

      const passengersWithOrderId: Passenger[] = passengers.map((p) => ({
        ...p,
        order_id: orderId,
        status: p.status ?? "active",
      }));

      const { error: passengerError } = await supabase
        .from("passengers")
        .insert(passengersWithOrderId);
      if (passengerError) throw new Error(passengerError.message);

      if (!isManager && tourData.available_seats !== undefined) {
        const { error: tourUpdateError } = await supabase
          .from("tours")
          .update({ available_seats: tourData.available_seats - passengers.length, updated_at: new Date().toISOString() })
          .eq("id", tourData.id);
        if (tourUpdateError) console.warn("Failed to update tour seats:", tourUpdateError.message);
      }

      setOrders(prev => [
        ...prev,
        {
          ...newOrder,
          id: orderId,
          passengers: passengersWithOrderId,
        },
      ]);

      wrappedShowNotification("success", "Booking saved successfully!");
      resetBookingForm();
    } catch (error) {
      wrappedShowNotification("error", `Error saving booking: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (passengers.length === 0) {
      wrappedShowNotification("error", "No passengers to export");
      return;
    }

    const headers = [
      "Room Allocation", "Serial No", "Last Name", "First Name", "Date of Birth", "Age",
      "Gender", "Passport Number", "Passport Expiry", "Nationality", "Room Type", "Hotel",
      "Additional Services", "Price", "Email", "Phone", "Allergy", "Emergency Phone"
    ];

    const rows = passengers.map((p) =>
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

    if (!isManager) {
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

        const data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return headers.reduce((obj: Record<string, string>, header, i) => {
            obj[header] = values[i] || "";
            return obj;
          }, {});
        });

        if (!isManager && tourData.available_seats !== undefined && data.length + passengers.length > tourData.available_seats) {
          wrappedShowNotification("error", "Cannot import passengers. The tour is fully booked.");
          return;
        }

        const newPassengers = data.map((row, idx) => {
          const passenger: Passenger = {
            id: generatePassengerId(),
            order_id: "",
            user_id: currentUser.id,
            name: isGroup
              ? `${groupName} - ${row["First Name"]} ${row["Last Name"]}`.trim()
              : `${row["First Name"]} ${row["Last Name"]}`.trim(),
            room_allocation: row["Room Allocation"] || "",
            serial_no: (passengers.length + idx + 1).toString(),
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
            departure_date: departureDate,
            is_blacklisted: false,
            blacklisted_date: null,
          };
          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tourData);
          }
          return passenger;
        });

        setPassengers([...passengers, ...newPassengers]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        wrappedShowNotification("success", `Successfully imported ${newPassengers.length} passengers`);
      } catch (error) {
        wrappedShowNotification("error", "Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Notifications notification={notification} setNotification={setNotification} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Travel Booking</h1>
            {passengers.length > 0 && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {passengers.length} passenger{passengers.length !== 1 ? "s" : ""} • ${totalPrice.toLocaleString()}
              </div>
            )}
          </div>
          {(passengers.length > 0 || selectedTour || departureDate) && (
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

        {activeStep === 2 && passengers.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Who's traveling?</h3>
                <p className="text-sm text-gray-600">Choose your booking type to get started</p>
                {remainingSeats !== undefined ? (
                  <p className={`text-sm font-medium mt-2 ${remainingSeats > 5 ? 'text-green-600' : remainingSeats > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                    {remainingSeats} seats available
                  </p>
                ) : isManager && (
                  <p className="text-sm font-medium mt-2 text-green-600">
                    Unlimited seats available
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={async () => {
                    const canAdd = await canAddPassenger();
                    if (canAdd) {
                      setIsGroup(false);
                      setGroupName("");
                      addPassenger();
                    }
                  }}
                  disabled={passengers.length >= MAX_PASSENGERS}
                  className="group relative p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex flex-col items-center">
                    <div className="mb-3 p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">Individual</h4>
                    <p className="text-xs text-gray-600 text-center">Single traveler or couple</p>
                  </div>
                </button>

                <button
                  onClick={async () => {
                    const canAdd = await canAddPassenger();
                    if (canAdd) {
                      setIsGroup(true);
                    }
                  }}
                  disabled={passengers.length >= MAX_PASSENGERS}
                  className="group relative p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl hover:from-green-100 hover:to-emerald-100 hover:border-green-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex flex-col items-center">
                    <div className="mb-3 p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">Group</h4>
                    <p className="text-xs text-gray-600 text-center">Family or tour group</p>
                  </div>
                </button>
              </div>

              {isGroup && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                  <h4 className="font-medium text-green-800 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Group Setup
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Group Name *
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g., Smith Family Tour, Company Outing 2024..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        How many people?
                      </label>
                      <div className="flex items-center space-x-4">
                        <div className="grid grid-cols-5 gap-2 flex-shrink-0">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                            <button
                              key={num}
                              onClick={async () => {
                                if (groupName.trim()) {
                                  await addMultiplePassengers(num);
                                } else {
                                  wrappedShowNotification("error", "Please enter a group name first");
                                }
                              }}
                              disabled={!groupName.trim() || passengers.length + num > MAX_PASSENGERS}
                              className="w-12 h-12 text-sm font-semibold bg-white border-2 border-green-300 text-green-700 rounded-xl hover:bg-green-600 hover:text-white hover:border-green-600 focus:ring-2 focus:ring-green-500 focus:border-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">or</span>
                          <input
                            type="number"
                            min="1"
                            max={MAX_PASSENGERS - passengers.length}
                            placeholder="Custom"
                            className="w-20 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const value = parseInt((e.target as HTMLInputElement).value);
                                if (value && value >= 1 && value <= (MAX_PASSENGERS - passengers.length)) {
                                  if (groupName.trim()) {
                                    await addMultiplePassengers(value);
                                    (e.target as HTMLInputElement).value = '';
                                  } else {
                                    wrappedShowNotification("error", "Please enter a group name first");
                                  }
                                }
                              }
                            }}
                          />
                          <button
                            onClick={async (e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                              const value = parseInt(input.value);
                              if (value && value >= 1 && value <= (MAX_PASSENGERS - passengers.length)) {
                                if (groupName.trim()) {
                                  await addMultiplePassengers(value);
                                  input.value = '';
                                } else {
                                  wrappedShowNotification("error", "Please enter a group name first");
                                }
                              }
                            }}
                            disabled={!groupName.trim()}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">Quick select 1-10 people, or enter a custom number (max {MAX_PASSENGERS - passengers.length})</p>
                    </div>
                  </div>
                </div>
              )}

              {passengers.length >= MAX_PASSENGERS && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm text-red-800">
                      Maximum {MAX_PASSENGERS} passengers allowed per booking
                    </p>
                  </div>
                </div>
              )}
              {!isManager && remainingSeats !== undefined && remainingSeats === 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-sm text-red-800">
                      No more seats available for this tour
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 2 && passengers.length > 0 && (
          <>
            <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm border border-slate-200 mb-6">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                      {isGroup ? (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {isGroup ? `${groupName}` : 'Individual Booking'}
                      </h3>
                      <p className="text-sm text-slate-600 flex items-center space-x-4">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                          {passengers.length} {passengers.length === 1 ? 'passenger' : 'passengers'}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          ${totalPrice.toLocaleString()}
                        </span>
                        {!isManager && remainingSeats !== undefined && (
                          <span className={`flex items-center font-medium ${remainingSeats > 5 ? 'text-green-600' : remainingSeats > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {remainingSeats} seats left
                          </span>
                        )}
                        {isManager && (
                          <span className="flex items-center font-medium text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Unlimited seats
                          </span>
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
                      disabled={passengers.length >= MAX_PASSENGERS}
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
                      onClick={async () => {
                        const isValid = await validateBooking();
                        if (isValid) {
                          setActiveStep(3);
                        } else {
                          wrappedShowNotification("error", "Please fix all validation errors before proceeding");
                        }
                      }}
                      disabled={passengers.length === 0}
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

            <PassengerForm
              passengers={passengers}
              setPassengers={setPassengers}
              selectedTourData={selectedTourData}
              errors={errors}
              updatePassenger={updatePassenger}
              removePassenger={removePassenger}
              downloadTemplate={() => downloadTemplate(wrappedShowNotification)}
              handleUploadCSV={handleUploadCSV}
              addPassenger={addPassenger}
              setActiveStep={setActiveStep}
              isGroup={isGroup}
              setIsGroup={setIsGroup}
              groupName={groupName}
              setGroupName={setGroupName}
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
            passengers={passengers}
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

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-40">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-600">Step {activeStep} of 3</div>
          <div className="text-sm font-medium text-gray-900">
            {passengers.length > 0 && (
              <span>{passengers.length} passenger{passengers.length !== 1 ? "s" : ""} • ${totalPrice.toLocaleString()}</span>
            )}
          </div>
        </div>

        {activeStep === 2 && (
          <div className="flex gap-2 mb-2">
            <button
              onClick={addPassenger}
              disabled={passengers.length >= MAX_PASSENGERS}
              className="flex-1 inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              + Add
            </button>
            {passengers.length > 1 && (
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
              onClick={async () => {
                if (activeStep === 1 && selectedTour && departureDate) setActiveStep(2);
                else if (activeStep === 2 && passengers.length > 0) {
                  const isValid = await validateBooking();
                  if (isValid) setActiveStep(3);
                  else wrappedShowNotification("error", "Please fix all validation errors before proceeding");
                }
              }}
              disabled={(activeStep === 1 && (!selectedTour || !departureDate)) || (activeStep === 2 && passengers.length === 0)}
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
              onClick={saveOrder}
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