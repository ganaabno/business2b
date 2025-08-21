import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../supabaseClient";
import PassengerForm from "../Parts/PassengerForm";
import Notification from "../Parts/Notification";
import TourSelection from "../Parts/TourSelection"; // Import TourSelection
import type { User as UserType, Tour, Order, Passenger, ValidationError } from "../types/type";

// Define interface for component props
interface ManagerInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  currentUser: UserType;
  onLogout: () => void;
}


export default function ManagerInterface({
  tours,
  setTours,
  orders,
  setOrders,
  passengers: initialPassengers,
  setPassengers,
  currentUser,
  onLogout,
}: ManagerInterfaceProps) {
  // State declarations
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState(""); // Added for TourSelection
  const [passengers, setPassengersState] = useState<Passenger[]>(initialPassengers);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tours" | "orders" | "addTour" | "passengers" | "addPassenger">("tours");
  const [newTour, setNewTour] = useState({
    title: "",
    name: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
    description: "",
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [dateFilterStart, setDateFilterStart] = useState<string>("");
  const [dateFilterEnd, setDateFilterEnd] = useState<string>("");
  const [passengerNameFilter, setPassengerNameFilter] = useState<string>("");
  const [passengerOrderFilter, setPassengerOrderFilter] = useState<string>("");
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Sync passengers state with props
  useEffect(() => {
    setPassengersState(initialPassengers);
  }, [initialPassengers]);

  // Notification handler
  const showNotification = useCallback((type: "success" | "error", message: string) => {
    setNotification({ type, message });
    toast[type](message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Passenger validation
  const validatePassenger = (passenger: Passenger): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!passenger.first_name?.trim()) errors.push({ field: "first_name", message: "First name is required" });
    if (!passenger.last_name?.trim()) errors.push({ field: "last_name", message: "Last name is required" });
    if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
      errors.push({ field: "email", message: "Valid email is required" });
    if (!passenger.phone?.trim()) errors.push({ field: "phone", message: "Phone number is required" });
    if (!passenger.nationality) errors.push({ field: "nationality", message: "Nationality is required" });
    if (!passenger.gender) errors.push({ field: "gender", message: "Gender is required" });
    if (!passenger.passport_number?.trim()) errors.push({ field: "passport_number", message: "Passport number is required" });
    if (!passenger.passport_expiry) errors.push({ field: "passport_expiry", message: "Passport expiry date is required" });
    if (!passenger.roomType) errors.push({ field: "roomType", message: "Room type is required" });
    if (!passenger.hotel) errors.push({ field: "hotel", message: "Hotel selection is required" });
    return errors;
  };

  // Calculate age
  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  // Calculate service price
  const calculateServicePrice = (services: string[], tourData: Tour): number => {
    return services.reduce((sum, serviceName) => {
      const service = tourData.services?.find((s) => s.name === serviceName);
      return sum + (service ? service.price : 0);
    }, 0);
  };

  // Add passenger
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

  // Update passenger
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

  // Remove passenger
  const removePassenger = (index: number) => {
    if (passengers.length === 1) {
      showNotification("error", "At least one passenger is required");
      return;
    }
    setPassengersState(passengers.filter((_, i) => i !== index));
  };

  // Validate booking
  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour) allErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate) allErrors.push({ field: "departure", message: "Please select a departure date" });
    if (passengers.length === 0) allErrors.push({ field: "passengers", message: "At least one passenger is required" });

    passengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger);
      passengerErrors.forEach((error) => {
        allErrors.push({ field: `passenger_${index}_${error.field}`, message: `Passenger ${index + 1}: ${error.message}` });
      });
    });

    setErrors(allErrors);
    return allErrors.length === 0;
  };

  // Save passenger
  const savePassenger = async () => {
    if (!validateBooking()) {
      showNotification("error", "Please fix the validation errors before proceeding");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification("error", "Selected tour not found");
      return;
    }

    setLoading(true);

    try {
      // Create order
      const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);
      const newOrder = {
        user_id: currentUser.id,
        tour_id: tourData.id,
        phone: passengers[0].phone,
        last_name: passengers[0].last_name,
        first_name: passengers[0].first_name,
        age: passengers[0].age,
        gender: passengers[0].gender,
        passport_number: passengers[0].passport_number,
        passport_expire: passengers[0].passport_expiry,
        passport_copy: passengers[0].passport_upload,
        commission: totalPrice * 0.05,
        created_by: currentUser.id,
        createdBy: currentUser.username || currentUser.email,
        tour: tourData.title,
        edited_by: null,
        edited_at: null,
        travel_choice: selectedTour,
        status: "pending",
        hotel: passengers[0].hotel,
        room_number: passengers[0].room_allocation,
        payment_method: "manual",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departureDate: departureDate,
        total_price: totalPrice,
      };

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert(newOrder)
        .select()
        .single();
      if (orderError) throw new Error(orderError.message);

      const orderId = orderData.id;
      const passengersWithOrderId = passengers.map((p) => ({
        ...p,
        order_id: orderId,
        updated_at: new Date().toISOString(),
      }));

      // Insert passengers
      const { data, error: passengerError } = await supabase
        .from("passengers")
        .insert(passengersWithOrderId)
        .select();

      if (passengerError) throw new Error(passengerError.message);

      // Update tour seats
      if (tourData.available_seats !== undefined) {
        const { error: tourUpdateError } = await supabase
          .from("tours")
          .update({ available_seats: tourData.available_seats - passengers.length, updated_at: new Date().toISOString() })
          .eq("id", tourData.id);
        if (tourUpdateError) console.warn("Failed to update tour seats:", tourUpdateError.message);
      }

      // Update state
      setPassengers(data as Passenger[]);
      setOrders([...orders, { ...orderData, passengers: passengersWithOrderId }]);
      showNotification("success", "Passengers saved successfully!");

      // Reset form
      setPassengersState([]);
      setSelectedTour("");
      setDepartureDate("");
      setErrors([]);
      setIsGroup(false);
      setGroupName("");
      setActiveStep(0);
    } catch (error) {
      showNotification("error", `Error saving passengers: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // CSV Download
  const downloadCSV = () => {
    if (passengers.length === 0) {
      showNotification("error", "No passengers to export");
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

    const rows = passengers.map((p) =>
      [
        p.room_allocation || "",
        p.serial_no || "",
        p.last_name || "",
        p.first_name || "",
        p.date_of_birth || "",
        p.age || "",
        p.gender || "",
        p.passport_number || "",
        p.passport_expiry || "",
        p.nationality || "",
        p.roomType || "",
        p.hotel || "",
        p.additional_services?.join(",") || "",
        p.price || "",
        p.email || "",
        p.phone || "",
        p.allergy || "",
        p.emergency_phone || "",
      ].map((v) => `"${v}"`).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `passengers_${selectedTour}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification("success", "CSV downloaded successfully");
  };

  // CSV Template Download
  const downloadTemplate = () => {
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
    const sampleRow = [
      "101",
      "1",
      "Doe",
      "John",
      "1990-01-01",
      "33",
      "Male",
      "A12345678",
      "2030-01-01",
      "Mongolia",
      "Single",
      "Hotel A",
      "Service1,Service2",
      "100",
      "john@email.com",
      "+976 99999999",
      "None",
      "+976 88888888",
    ];
    const csv = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "passenger_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification("success", "Template downloaded successfully");
  };

  // Handle CSV Upload
  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showNotification("error", "Please upload a CSV file");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification("error", "No tour selected");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          showNotification("error", "CSV file must contain at least a header and one data row");
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
          showNotification("error", "CSV file is missing required headers");
          return;
        }

        const data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return headers.reduce((obj: Record<string, string>, header, i) => {
            obj[header] = values[i] || "";
            return obj;
          }, {});
        });

        if (tourData.available_seats !== undefined && data.length + passengers.length > tourData.available_seats) {
          showNotification("error", "Cannot import passengers. The tour is fully booked.");
          return;
        }

        const newPassengers = data.map((row, idx) => {
          const passenger: Passenger = {
            id: `passenger-${Date.now()}-${idx}`,
            order_id: "",
            user_id: currentUser.id,
            name: `${row["First Name"]} ${row["Last Name"]}`.trim(),
            room_allocation: row["Room Allocation"] || "",
            serial_no: row["Serial No"] || (idx + 1).toString(),
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
            price: 0,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tourData);
          }

          return passenger;
        });

        setPassengersState([...passengers, ...newPassengers]);
        showNotification("success", `Successfully imported ${newPassengers.length} passengers`);
      } catch (error) {
        showNotification("error", "Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Not set";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  const handleTourChange = async (id: string, field: keyof Tour, value: any) => {
    const updatedTours = tours.map((t) => (t.id === id ? { ...t, [field]: value } : t));
    setTours(updatedTours);
    try {
      const { error } = await supabase
        .from("tours")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Error updating tour:", error);
        showNotification("error", `Failed to update tour: ${error.message}`);
        setTours(tours); // Revert state on failure
      }
    } catch (error) {
      console.error("Unexpected error updating tour:", error);
      showNotification("error", "An unexpected error occurred while updating the tour.");
      setTours(tours); // Revert state on failure
    }
  };

  const handleOrderChange = async (orderId: string, field: string, value: string) => {
    const previousOrders = [...orders];
    const updatedOrders = orders.map((o) =>
      o.id === orderId ? { ...o, [field]: value, edited_by: currentUser.id, edited_at: new Date().toISOString() } : o
    );
    setOrders(updatedOrders);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ [field]: value, edited_by: currentUser.id, edited_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) {
        console.error("Error updating order:", error);
        toast.error(`Failed to update order: ${error.message}`);
        setOrders(previousOrders);
      } else {
        toast.success("Order updated successfully!");
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Unexpected error updating order.");
      setOrders(previousOrders);
    }
  };

  const handlePassengerChange = async (id: string, field: keyof Passenger, value: any) => {
    const previousPassengers = [...passengers];
    const updatedPassengers = passengers.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    setPassengersState(updatedPassengers);
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Error updating passenger:", error);
        showNotification("error", `Failed to update passenger: ${error.message}`);
        setPassengersState(previousPassengers);
      }
    } catch (error) {
      console.error("Unexpected error updating passenger:", error);
      showNotification("error", "An unexpected error occurred while updating the passenger.");
      setPassengersState(previousPassengers);
    }
  };

  const handleAddTour = async () => {
    if (!newTour.departure_date) {
      showNotification("error", "Departure date is required");
      return;
    }
    if (!newTour.title.trim()) {
      showNotification("error", "Tour title is required");
      return;
    }

    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      dates: newTour.departure_date ? [newTour.departure_date] : [],
      seats: newTour.seats ? parseInt(newTour.seats, 10) : null,
      hotels: newTour.hotels.trim() ? newTour.hotels.trim().split(",").map((h) => h.trim()) : [],
      services: newTour.services.trim()
        ? newTour.services.trim().split(",").map((s) => ({ name: s.trim(), price: 0 }))
        : [],
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active", // Default status for new tours
    };

    try {
      const { data, error } = await supabase.from("tours").insert([tourData]).select().single();
      if (error) {
        console.error("Supabase error:", error);
        showNotification("error", `Error adding tour: ${error.message}`);
        return;
      }

      setTours([...tours, data as Tour]);
      setNewTour({
        title: "",
        name: "",
        departure_date: "",
        seats: "",
        hotels: "",
        services: "",
        description: "",
      });
      showNotification("success", "Tour added successfully!");
    } catch (error) {
      console.error("Error adding tour:", error);
      showNotification("error", "An unexpected error occurred while adding the tour.");
    }
  };

  const handleDeleteTour = async (id: string) => {
    const previousTours = [...tours];
    setTours(tours.filter((t) => t.id !== id));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", id);
      if (error) {
        console.error("Error deleting tour:", error);
        showNotification("error", `Failed to delete tour: ${error.message}`);
        setTours(previousTours);
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting tour:", error);
      showNotification("error", "An unexpected error occurred while deleting the tour.");
      setTours(previousTours);
    }
  };

  const handleDeletePassenger = async (id: string) => {
    const previousPassengers = [...passengers];
    setPassengersState(passengers.filter((p) => p.id !== id));
    try {
      const { error } = await supabase.from("passengers").delete().eq("id", id);
      if (error) {
        console.error("Error deleting passenger:", error);
        showNotification("error", `Failed to delete passenger: ${error.message}`);
        setPassengersState(previousPassengers);
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting passenger:", error);
      showNotification("error", "An unexpected error occurred while deleting the passenger.");
      setPassengersState(previousPassengers);
    }
  };

  const filteredTours = useMemo(() => {
    return tours.filter((tour) => {
      const matchesTitle = tour.title.toLowerCase().includes(titleFilter.toLowerCase());
      const matchesStatus = statusFilter === "all" || tour.status === statusFilter;

      const tourDate = tour.dates?.[0];
      let matchesDate = true;

      if (tourDate) {
        const tourDateObj = new Date(tourDate);
        if (dateFilterStart) {
          const startDate = new Date(dateFilterStart);
          matchesDate = matchesDate && tourDateObj >= startDate;
        }
        if (dateFilterEnd) {
          const endDate = new Date(dateFilterEnd);
          matchesDate = matchesDate && tourDateObj <= endDate;
        }
      }

      return matchesTitle && matchesStatus && matchesDate;
    });
  }, [tours, titleFilter, statusFilter, dateFilterStart, dateFilterEnd]);

  const filteredPassengers = useMemo(() => {
    return passengers.filter((passenger) => {
      const matchesName = `${passenger.first_name || ""} ${passenger.last_name || ""}`
        .toLowerCase()
        .includes(passengerNameFilter.toLowerCase());
      const orderIdString = passenger.order_id != null ? String(passenger.order_id) : "";
      const matchesOrder = orderIdString.toLowerCase().includes(passengerOrderFilter.toLowerCase());
      const matchesStatus = passengerStatusFilter === "all" || passenger.status === passengerStatusFilter;
      return matchesName && matchesOrder && matchesStatus;
    });
  }, [passengers, passengerNameFilter, passengerOrderFilter, passengerStatusFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage your tours, orders, and passengers efficiently</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v-7a3 3 0 00-3-3H5" />
            </svg>
            Logout
          </button>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {["tours", "orders", "addTour", "passengers", "addPassenger"].map((tab) => (
                <button
                  key={tab}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  onClick={() => setActiveTab(tab as "tours" | "orders" | "addTour" | "passengers" | "addPassenger")}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {tab === "tours" && (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                      )}
                      {tab === "orders" && (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      )}
                      {tab === "addTour" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      )}
                      {tab === "passengers" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                      )}
                      {tab === "addPassenger" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                      )}
                    </svg>
                    <span>{tab === "addPassenger" ? "Add Passenger" : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                    {tab !== "addTour" && tab !== "addPassenger" && (
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-semibold ml-2">
                        {tab === "tours" ? tours.length : tab === "orders" ? orders.length : passengers.length}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === "tours" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tours</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search by Title</label>
                  <input
                    type="text"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    placeholder="Search tours..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <div className="flex space-x-2">
                    <input
                      type="date"
                      value={dateFilterStart}
                      onChange={(e) => setDateFilterStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <input
                      type="date"
                      value={dateFilterEnd}
                      onChange={(e) => setDateFilterEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="full">Full</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTours.map((tour) => (
                    <tr key={tour.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={tour.title}
                          onChange={(e) => handleTourChange(tour.id, "title", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Tour title..."
                        />
                        <textarea
                          value={tour.description || ""}
                          onChange={(e) => handleTourChange(tour.id, "description", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          placeholder="Description..."
                        />
                        <input
                          type="text"
                          value={tour.hotels?.join(", ") || ""}
                          onChange={(e) => handleTourChange(tour.id, "hotels", e.target.value.split(",").map((h) => h.trim()))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Hotels (comma-separated)..."
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="date"
                          value={tour.dates?.[0] || ""}
                          onChange={(e) => {
                            handleTourChange(tour.id, "dates", [e.target.value]);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <div className="text-sm text-gray-500 mt-1">{formatDate(tour.dates?.[0])}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={tour.seats || ""}
                          onChange={(e) => handleTourChange(tour.id, "seats", parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="0"
                          placeholder="Seats"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={tour.status || "active"}
                          onChange={(e) => handleTourChange(tour.id, "status", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="active">✅ Active</option>
                          <option value="inactive">⏸️ Inactive</option>
                          <option value="full">🚫 Full</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {showDeleteConfirm === tour.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDeleteTour(tour.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(tour.id)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                            title="Delete tour"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Visible to Provider</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passengers</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order, index) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={order.status === "confirmed"}
                          onChange={(e) => handleOrderChange(order.id, "status", e.target.checked ? "confirmed" : "pending")}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          title="Check to make visible to providers"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold mr-3 shadow-md">
                            {order.first_name?.charAt(0) || "?"}
                            {order.last_name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.first_name || "N/A"} {order.last_name || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={order.travel_choice || ""}
                          onChange={(e) => handleOrderChange(order.id, "travel_choice", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
                          placeholder="Travel choice..."
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          value={order.departureDate || ""}
                          onChange={(e) => handleOrderChange(order.id, "departureDate", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 bg-white"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          👥 {order.passengers?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status || ""}
                          onChange={(e) => handleOrderChange(order.id, "status", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 bg-white text-sm"
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="confirmed">✅ Confirmed</option>
                          <option value="cancelled">❌ Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-green-600">${order.commission?.toLocaleString() || 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "passengers" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Passengers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name</label>
                  <input
                    type="text"
                    value={passengerNameFilter}
                    onChange={(e) => setPassengerNameFilter(e.target.value)}
                    placeholder="Search passengers..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                  <input
                    type="text"
                    value={passengerOrderFilter}
                    onChange={(e) => setPassengerOrderFilter(e.target.value)}
                    placeholder="Search by order ID..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={passengerStatusFilter}
                    onChange={(e) => setPassengerStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 w-48 shadow-sm">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-[108px] z-10 bg-gray-50 w-32 shadow-sm">Order ID</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
                    <th className="px-10 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                    <th className="px-12 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gender</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport Expiry</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nationality</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Allocation</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hotel</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Additional Services</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Allergies</th>
                    <th className="px-24 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-18 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                    <th className="px-18 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Emergency Phone</th>
                    <th className="px-48 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPassengers.map((passenger) => (
                    <tr key={passenger.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-white w-48 shadow-sm">
                        <div className="text-sm font-medium text-gray-900">
                          {passenger.first_name} {passenger.last_name}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap sticky left-[108px] z-10 bg-white w-32 shadow-sm">
                        <input
                          type="text"
                          value={passenger.order_id ?? ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "order_id", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Order ID..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          value={passenger.date_of_birth || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "date_of_birth", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          value={passenger.age || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "age", parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Age..."
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <select
                          value={passenger.gender || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "gender", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.passport_number || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "passport_number", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Passport..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          value={passenger.passport_expiry || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "passport_expiry", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.nationality || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "nationality", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Nationality..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.roomType || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "roomType", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Room Type..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.room_allocation || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "room_allocation", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Room Alloc..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.hotel || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "hotel", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Hotel..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.additional_services?.join(", ") || ""}
                          onChange={(e) =>
                            handlePassengerChange(passenger.id, "additional_services", e.target.value.split(",").map((s) => s.trim()))
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Services..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.allergy || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "allergy", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Allergies..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="email"
                          value={passenger.email || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "email", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Email..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="tel"
                          value={passenger.phone || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "phone", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Phone..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="tel"
                          value={passenger.emergency_phone || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "emergency_phone", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Emergency..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <select
                          value={passenger.status || "active"}
                          onChange={(e) => handlePassengerChange(passenger.id, "status", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="active">✅ Active</option>
                          <option value="cancelled">❌ Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {showDeleteConfirm === passenger.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDeletePassenger(passenger.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(passenger.id)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                            title="Delete passenger"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "addTour" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Add New Tour
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.title}
                    onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
                    placeholder="Enter tour title..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={newTour.departure_date}
                    onChange={(e) => setNewTour({ ...newTour, departure_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.seats}
                    onChange={(e) => setNewTour({ ...newTour, seats: e.target.value })}
                    placeholder="Number of seats"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotels (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="Hotel A, Hotel B, Hotel C"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.hotels}
                    onChange={(e) => setNewTour({ ...newTour, hotels: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Services</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.services}
                    onChange={(e) => setNewTour({ ...newTour, services: e.target.value })}
                    placeholder="Tour services..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    value={newTour.description}
                    onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                    rows={3}
                    placeholder="Tour description..."
                  />
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={handleAddTour}
                  disabled={!newTour.title || !newTour.departure_date}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Tour
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  All Tours ({tours.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                {tours.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500">No tours available yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first tour using the form above.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour Details</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tours.map((tour) => (
                        <tr key={tour.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{tour.title}</div>
                            {tour.name && tour.name !== tour.title && (
                              <div className="text-xs text-gray-500 mt-1">📛 {tour.name}</div>
                            )}
                            <div className="text-sm text-gray-500 mt-1">{tour.description || "No description"}</div>
                            {tour.hotels && tour.hotels.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">🏨 {tour.hotels.join(", ")}</div>
                            )}
                            {tour.services && tour.services.length > 0 && (
                              <div className="text-xs text-green-600 mt-1">
                                {tour.services.map((service, idx) => (
                                  <div key={idx}>
                                    🔧 {service.name} (${service.price})
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(tour.dates?.[0])}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              💺 {tour.seats ?? "No limit"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${tour.status === "active"
                                ? "bg-green-100 text-green-800"
                                : tour.status === "inactive"
                                  ? "bg-gray-100 text-gray-800"
                                  : tour.status === "full"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                            >
                              {tour.status === "active"
                                ? "✅ Active"
                                : tour.status === "inactive"
                                  ? "⏸️ Inactive"
                                  : tour.status === "full"
                                    ? "🚫 Full"
                                    : "📍 " + (tour.status || "Active")}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {showDeleteConfirm === tour.id ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleDeleteTour(tour.id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowDeleteConfirm(tour.id)}
                                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg" title="Delete tour">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "addPassenger" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Passenger
              </h3>

              {/* Stepper */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep >= 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        }`}
                    >
                      1
                    </div>
                    <span className="text-sm font-medium">Select Tour</span>
                  </div>
                  <div className="h-px w-16 bg-gray-300"></div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        }`}
                    >
                      2
                    </div>
                    <span className="text-sm font-medium">Passenger Details</span>
                  </div>
                  <div className="h-px w-16 bg-gray-300"></div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${activeStep >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        }`}
                    >
                      3
                    </div>
                    <span className="text-sm font-medium">Review & Save</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Tour Selection */}
              {activeStep === 0 && (
                <div className="space-y-4">
                  <TourSelection
                    tours={tours}
                    selectedTour={selectedTour}
                    setSelectedTour={setSelectedTour}
                    departureDate={departureDate}
                    setDepartureDate={setDepartureDate}
                    errors={errors}                 
                    setActiveStep={setActiveStep}   
                    userRole={currentUser.role}     
                    showAvailableSeats={true}
                  />

                  {errors.some((e) => e.field === "tour") && (
                    <p className="text-red-600 text-sm">{errors.find((e) => e.field === "tour")?.message}</p>
                  )}
                  {errors.some((e) => e.field === "departure") && (
                    <p className="text-red-600 text-sm">{errors.find((e) => e.field === "departure")?.message}</p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setActiveStep(1)}
                      disabled={!selectedTour || !departureDate}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Passenger Details */}
              {activeStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isGroup}
                        onChange={(e) => setIsGroup(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Group Booking</span>
                    </label>
                    {isGroup && (
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Enter group name"
                        className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {passengers.map((passenger, index) => (
                    <div key={passenger.id} className="border-t pt-4">
                      <PassengerForm
                        passengers={passengers}
                        setPassengers={setPassengers}
                        selectedTourData={tours.find((t) => t.title === selectedTour)}
                        errors={errors}
                        updatePassenger={updatePassenger}
                        removePassenger={removePassenger}
                        downloadTemplate={downloadTemplate}
                        handleUploadCSV={handleUploadCSV}
                        addPassenger={addPassenger}
                        setActiveStep={setActiveStep}
                        isGroup={isGroup}
                        setIsGroup={setIsGroup}
                        groupName={groupName}
                        setGroupName={setGroupName}
                        showNotification={showNotification}
                      />
                    </div>
                  ))}

                  {errors.some((e) => e.field === "passengers") && (
                    <p className="text-red-600 text-sm">{errors.find((e) => e.field === "passengers")?.message}</p>
                  )}

                  <div className="flex justify-between items-center">
                    <button
                      onClick={addPassenger}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add Passenger
                    </button>
                    <div className="space-x-2">
                      <button
                        onClick={() => setActiveStep(0)}
                        className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setActiveStep(2)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={downloadTemplate}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download CSV Template
                      </button>
                      <label className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center cursor-pointer">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Upload CSV
                        <input type="file" accept=".csv" onChange={handleUploadCSV} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Save */}
              {activeStep === 2 && (
                <div className="space-y-6">
                  <h4 className="text-lg font-semibold text-gray-900">Review Booking</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">Tour: {selectedTour}</p>
                    <p className="text-sm font-medium text-gray-700">Departure: {formatDate(departureDate)}</p>
                    <p className="text-sm font-medium text-gray-700">Passengers: {passengers.length}</p>
                    {isGroup && <p className="text-sm font-medium text-gray-700">Group Name: {groupName}</p>}
                    <p className="text-sm font-medium text-gray-700">
                      Total Price: ${passengers.reduce((sum, p) => sum + p.price, 0).toLocaleString()}
                    </p>
                  </div>

                  {passengers.map((passenger, index) => (
                    <div key={passenger.id} className="border-t pt-4">
                      <h5 className="text-sm font-medium text-gray-900">Passenger {index + 1}</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <p>Name: {passenger.first_name} {passenger.last_name}</p>
                        <p>Email: {passenger.email}</p>
                        <p>Phone: {passenger.phone}</p>
                        <p>Nationality: {passenger.nationality}</p>
                        <p>Gender: {passenger.gender}</p>
                        <p>Passport Number: {passenger.passport_number}</p>
                        <p>Passport Expiry: {formatDate(passenger.passport_expiry)}</p>
                        <p>Room Type: {passenger.roomType}</p>
                        <p>Hotel: {passenger.hotel}</p>
                        <p>Additional Services: {passenger.additional_services?.join(", ") || "None"}</p>
                        <p>Allergy: {passenger.allergy || "None"}</p>
                        <p>Emergency Phone: {passenger.emergency_phone || "None"}</p>
                      </div>
                    </div>
                  ))}

                  {errors.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h5 className="text-sm font-medium text-red-800">Validation Errors</h5>
                      <ul className="list-disc list-inside text-sm text-red-600">
                        {errors.map((error, idx) => (
                          <li key={idx}>{error.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setActiveStep(1)}
                      className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Back
                    </button>
                    <div className="space-x-2">
                      <button
                        onClick={downloadCSV}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export as CSV
                      </button>
                      <button
                        onClick={savePassenger}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                      >
                        {loading ? (
                          <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        Save Booking
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Notification
          notification={notification}         // the whole object
          setNotification={setNotification}   // setter
        />
      </div>
    </div>
  );
}
