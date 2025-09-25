import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import type { Passenger, User as UserType, Tour } from "../types/type";
import _ from "lodash";

// Add this type for tour dropdown options
interface TourOption {
  id: string;
  title: string;
}

// Country list (major countries + Mongolia as default)
const COUNTRY_OPTIONS = [
  { value: "Mongolia", label: "🇲🇳 Mongolia" },
  { value: "United States", label: "🇺🇸 United States" },
  { value: "China", label: "🇨🇳 China" },
  { value: "Japan", label: "🇯🇵 Japan" },
  { value: "South Korea", label: "🇰🇷 South Korea" },
  { value: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { value: "Germany", label: "🇩🇪 Germany" },
  { value: "France", label: "🇫🇷 France" },
  { value: "Italy", label: "🇮🇹 Italy" },
  { value: "Spain", label: "🇪🇸 Spain" },
  { value: "Canada", label: "🇨🇦 Canada" },
  { value: "Australia", label: "🇦🇺 Australia" },
  { value: "India", label: "🇮🇳 India" },
  { value: "Russia", label: "🇷🇺 Russia" },
  { value: "Brazil", label: "🇧🇷 Brazil" },
  { value: "Mexico", label: "🇲🇽 Mexico" },
  { value: "South Africa", label: "🇿🇦 South Africa" },
  { value: "Egypt", label: "🇪🇬 Egypt" },
  { value: "Turkey", label: "🇹🇷 Turkey" },
  { value: "Thailand", label: "🇹🇭 Thailand" },
  { value: "Vietnam", label: "🇻🇳 Vietnam" },
  { value: "Philippines", label: "🇵🇭 Philippines" },
  { value: "Indonesia", label: "🇮🇩 Indonesia" },
  { value: "Malaysia", label: "🇲🇾 Malaysia" },
  { value: "Singapore", label: "🇸🇬 Singapore" },
  { value: "New Zealand", label: "🇳🇿 New Zealand" },
  { value: "Sweden", label: "🇸🇪 Sweden" },
  { value: "Norway", label: "🇳🇴 Norway" },
  { value: "Denmark", label: "🇩🇰 Denmark" },
  { value: "Netherlands", label: "🇳🇱 Netherlands" },
  { value: "Belgium", label: "🇧🇪 Belgium" },
  { value: "Switzerland", label: "🇨🇭 Switzerland" },
  { value: "Austria", label: "🇦🇹 Austria" },
  { value: "Poland", label: "🇵🇱 Poland" },
  { value: "Czech Republic", label: "🇨🇿 Czech Republic" },
  { value: "Hungary", label: "🇭🇺 Hungary" },
  { value: "Romania", label: "🇷🇴 Romania" },
  { value: "Bulgaria", label: "🇧🇬 Bulgaria" },
  { value: "Greece", label: "🇬🇷 Greece" },
  { value: "Portugal", label: "🇵🇹 Portugal" },
  { value: "Ireland", label: "🇮🇪 Ireland" },
  { value: "Finland", label: "🇫🇮 Finland" },
  { value: "Iceland", label: "🇮🇸 Iceland" },
  { value: "Argentina", label: "🇦🇷 Argentina" },
  { value: "Chile", label: "🇨🇱 Chile" },
  { value: "Colombia", label: "🇨🇴 Colombia" },
  { value: "Peru", label: "🇵🇪 Peru" },
  { value: "Venezuela", label: "🇻🇪 Venezuela" },
  { value: "Nigeria", label: "🇳🇬 Nigeria" },
  { value: "Kenya", label: "🇰🇪 Kenya" },
  { value: "Ethiopia", label: "🇪🇹 Ethiopia" },
  { value: "Ghana", label: "🇬🇭 Ghana" },
  { value: "Morocco", label: "🇲🇦 Morocco" },
  { value: "Algeria", label: "🇩🇿 Algeria" },
  { value: "Tunisia", label: "🇹🇳 Tunisia" },
  { value: "Israel", label: "🇮🇱 Israel" },
  { value: "Saudi Arabia", label: "🇸🇦 Saudi Arabia" },
  { value: "United Arab Emirates", label: "🇦🇪 United Arab Emirates" },
  { value: "Qatar", label: "🇶🇦 Qatar" },
  { value: "Kuwait", label: "🇰🇼 Kuwait" },
  { value: "Oman", label: "🇴🇲 Oman" },
  { value: "Jordan", label: "🇯🇴 Jordan" },
  { value: "Lebanon", label: "🇱🇧 Lebanon" },
  { value: "Pakistan", label: "🇵🇰 Pakistan" },
  { value: "Bangladesh", label: "🇧🇩 Bangladesh" },
  { value: "Sri Lanka", label: "🇱🇰 Sri Lanka" },
  { value: "Nepal", label: "🇳🇵 Nepal" },
  { value: "Bhutan", label: "🇧🇹 Bhutan" },
  { value: "Myanmar", label: "🇲🇲 Myanmar" },
  { value: "Cambodia", label: "🇰🇭 Cambodia" },
  { value: "Laos", label: "🇱🇦 Laos" },
  { value: "Taiwan", label: "🇹🇼 Taiwan" },
  { value: "Hong Kong", label: "🇭🇰 Hong Kong" },
  { value: "Macau", label: "🇲🇴 Macau" },
];

// Helper function to validate field and return error message
const validateField = (field: keyof Passenger, value: any, passenger: Passenger): string | null => {
  // Handle non-string values first
  if (value === null || value === undefined) {
    value = "";
  }
  
  // Convert numbers to strings for validation
  if (typeof value === 'number') {
    value = value.toString();
  }
  
  // Now safely trim strings
  if (typeof value === 'string') {
    value = value.trim();
  }

  switch (field) {
    case "first_name":
      return value === "" ? "First name is required" : null;
    case "last_name":
      return value === "" ? "Last name is required" : null;
    case "order_id":
      return value === "" ? "Order ID is required" : null;
    case "date_of_birth":
      if (!passenger.date_of_birth) return "Date of birth is required";
      const dob = new Date(passenger.date_of_birth);
      const today = new Date();
      if (dob >= today) return "Date of birth must be in the past";
      if (isNaN(dob.getTime())) return "Invalid date format";
      return null;
    case "gender":
      return !passenger.gender || passenger.gender === "" ? "Gender is required" : null;
    case "passport_number":
      return !passenger.passport_number || passenger.passport_number === "" ? "Passport number is required" : null;
    case "passport_expiry":
      if (!passenger.passport_expiry) return "Passport expiry is required";
      const expiry = new Date(passenger.passport_expiry);
      if (expiry <= new Date()) return "Passport expiry must be in the future";
      if (isNaN(expiry.getTime())) return "Invalid date format";
      return null;
    case "nationality":
      return !passenger.nationality || passenger.nationality === "" ? "Nationality is required" : null;
    case "hotel":
      return !passenger.hotel || passenger.hotel === "" ? "Hotel is required" : null;
    case "status":
      return !passenger.status || passenger.status === "pending" ? "Status is required" : null;
    case "notes":
      return value.length > 1000 ? "Notes cannot exceed 1000 characters" : null;
    default:
      return null;
  }
};

// Helper function to get input class with error styling
const getInputClass = (field: keyof Passenger, passenger: Passenger, isEditMode: boolean) => {
  if (!isEditMode) return "";

  const error = validateField(field, passenger[field], passenger);
  const baseClass = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200";

  if (error) {
    return `${baseClass} border-red-500 bg-red-50 focus:ring-red-300`;
  }

  return `${baseClass} border-gray-300`;
};

interface PassengersTabProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function PassengersTab({ passengers, setPassengers, currentUser, showNotification }: PassengersTabProps) {
  const [passengerNameFilter, setPassengerNameFilter] = useState<string>("");
  const [passengerOrderFilter, setPassengerOrderFilter] = useState<string>("");
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<string>("all");
  const [passengerDepartureFilter, setPassengerDepartureFilter] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [tours, setTours] = useState<TourOption[]>([]);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());
  const passengersPerPage = 10;
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountCount = useRef(0);
  const fetchCount = useRef(0);

  // Function to calculate age from DOB
  const calculateAge = (dob: string | null | undefined): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age : 0;
  };

  // Validate all passengers and update errors
  const validateAllPassengers = useRef(
    _.debounce(() => {
      const errors = new Map<string, string>();
      passengers.forEach((passenger) => {
        const fields: (keyof Passenger)[] = [
          "first_name", "last_name", "order_id", "date_of_birth",
          "gender", "passport_number", "passport_expiry",
          "nationality", "hotel", "status", "notes"
        ];

        fields.forEach((field) => {
          const error = validateField(field, passenger[field], passenger);
          if (error) {
            errors.set(`${passenger.id}_${field}`, error);
          }
        });
      });
      setValidationErrors(errors);
    }, 300)
  ).current;

  // Fetch tours for the tour dropdown
  const fetchTours = useRef(
    _.debounce(async () => {
      try {
        let query = supabase.from("tours").select("id, title").eq("status", "active");
        const { data, error } = await query;
        if (error) {
          console.error("Error fetching tours:", error);
          showNotification("error", `Failed to fetch tours: ${error.message}`);
          return;
        }
        setTours(data as TourOption[]);
        console.log("Fetched tours:", data);
      } catch (error) {
        console.error("Unexpected error fetching tours:", error);
        showNotification("error", "An unexpected error occurred while fetching tours.");
      }
    }, 500)
  ).current;

  // Debounced fetchPassengers
  const fetchPassengers = useRef(
    _.debounce(async () => {
      fetchCount.current += 1;
      console.log(`fetchPassengers called ${fetchCount.current} times`);
      try {
        let query = supabase
          .from("passengers")
          .select(`
            *,
            orders (
              id,
              tour_id,
              departureDate,
              tours (
                id,
                title
              )
            )
          `);
        if (currentUser.role === "user") {
          query = query.eq("user_id", currentUser.userId);
        }
        const { data, error } = await query;
        if (error) {
          console.error("Error fetching passengers:", error);
          showNotification("error", `Failed to fetch passengers: ${error.message}`);
          return;
        }
        console.log("Fetched passengers:", data);
        const enrichedPassengers = data.map((p: any) => ({
          ...p,
          tour_title: p.orders?.tours?.title || "Unknown Tour",
          is_blacklisted: p.is_blacklisted || false,
          status: p.status || "active",
          name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "N/A",
          departure_date: p.orders?.departureDate || "",
          allergy: p.allergy || "",
          nationality: p.nationality || "Mongolia",
          hotel: p.hotel || "",
          age: p.date_of_birth ? calculateAge(p.date_of_birth) : (p.age || 0),
          gender: p.gender || "",
          notes: p.notes || ""
        })) as Passenger[];
        setPassengers(enrichedPassengers);
        console.log("Enriched passengers:", enrichedPassengers);
      } catch (error) {
        console.error("Unexpected error fetching passengers:", error);
        showNotification("error", "An unexpected error occurred while fetching passengers.");
      }
    }, 1000)
  ).current;

  // Debug component mounting
  useEffect(() => {
    mountCount.current += 1;
    console.log(`PassengersTab mounted ${mountCount.current} times`);
  }, []);

  // Fetch tours and setup real-time subscription
  useEffect(() => {
    console.log("useEffect for subscription running");
    fetchTours();
    fetchPassengers();

    if (!subscriptionRef.current) {
      console.log("Setting up passenger subscription");
      subscriptionRef.current = supabase
        .channel("passengers_tab_channel")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "passengers",
            filter: currentUser.role === "user" ? `user_id=eq.${currentUser.userId}` : undefined,
          },
          (payload) => {
            console.log("Real-time passenger update:", payload.eventType, payload);
            if (["INSERT", "UPDATE", "DELETE"].includes(payload.eventType)) {
              fetchPassengers();
            }
          }
        )
        .subscribe((status) => {
          console.log("Passenger subscription status:", status);
        });
    }

    return () => {
      if (subscriptionRef.current) {
        console.log("Unsubscribing from passengers_tab_channel");
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [currentUser.userId, currentUser.role]);

  // Validate when entering edit mode or passengers change
  useEffect(() => {
    if (isEditMode) {
      validateAllPassengers();
    } else {
      setValidationErrors(new Map());
    }
  }, [isEditMode, passengers]);

  const handlePassengerChange = (id: string, field: keyof Passenger, value: any) => {
    console.log(`Updating passenger ${id}, field: ${field}, value: ${value}`);

    // Validate the specific field immediately
    if (isEditMode) {
      const updatedPassengers = passengers.map((p) =>
        p.id === id
          ? {
            ...p,
            [field]:
              field === "age" ? calculateAge(value) :
                field === "status" || field === "gender" ? value || "active" :
                  field === "nationality" ? value || "Mongolia" :
                    value || "",
            ...(field === "date_of_birth" && { age: calculateAge(value) }),
          }
          : p
      );

      setPassengers(updatedPassengers);

      // Update validation errors for this field
      const error = validateField(field, value, updatedPassengers.find(p => p.id === id)!);
      const newErrors = new Map(validationErrors);

      if (error) {
        newErrors.set(`${id}_${field}`, error);
      } else {
        newErrors.delete(`${id}_${field}`);
      }

      setValidationErrors(newErrors);
    } else {
      // Non-edit mode - just update normally
      setPassengers((prevPassengers) =>
        prevPassengers.map((p) =>
          p.id === id
            ? {
              ...p,
              [field]:
                field === "age" ? calculateAge(value) :
                  field === "status" || field === "gender" ? value || "active" :
                    field === "nationality" ? value || "Mongolia" :
                      value || "",
              ...(field === "date_of_birth" && { age: calculateAge(value) }),
            }
            : p
        )
      );
    }
  };

  const hasValidationErrors = () => {
    return Array.from(validationErrors.values()).length > 0;
  };

  const handleSaveEdits = async () => {
    if (isSaving) return;

    // Validate all fields before saving
    validateAllPassengers.flush(); // Force immediate validation

    // Wait a tick for validation to complete
    setTimeout(async () => {
      if (hasValidationErrors()) {
        showNotification("error", "Please fix the validation errors before saving!");
        return;
      }

      setIsSaving(true);
      const previousPassengers = [...passengers];
      try {
        const updates = passengers.map(async (passenger) => {
          const {
            id,
            first_name,
            last_name,
            order_id,
            date_of_birth,
            age,
            gender,
            passport_number,
            passport_expiry,
            nationality,
            hotel,
            allergy,
            status,
            is_blacklisted,
            user_id,
            notes,
            ...rest
          } = passenger;

          let updatePayload: Partial<Record<string, any>> = {
            first_name: first_name || "",
            last_name: last_name || "",
            order_id: order_id || null,
            date_of_birth: date_of_birth || null,
            age: age || null,
            gender: gender || null,
            passport_number: passport_number || null,
            passport_expiry: passport_expiry || null,
            nationality: nationality || "Mongolia",
            hotel: hotel || "",
            allergy: allergy || "",
            status: status || "active",
            is_blacklisted: is_blacklisted || false,
            notes: notes || "",
            updated_at: new Date().toISOString(),
            ...(currentUser.id && { edited_by: currentUser.id }),
          };

          Object.keys(updatePayload).forEach((key) => {
            if (updatePayload[key] === null || updatePayload[key] === undefined) {
              delete updatePayload[key];
            }
          });

          console.log(`Saving passenger ${passenger.id}:`, updatePayload);

          const { error } = await supabase
            .from("passengers")
            .update(updatePayload)
            .eq("id", passenger.id)
            .select();

          return { passenger, error };
        });

        const results = await Promise.all(updates);
        const hasError = results.some((result) => result.error);

        if (hasError) {
          const error = results.find((result) => result.error)?.error;
          console.error("Error updating passengers:", error);
          showNotification("error", `Failed to update passengers: ${error?.message || "Unknown error"}`);
          setPassengers(previousPassengers);
        } else {
          showNotification("success", "Saved completely! 😎");
          setIsEditMode(false);
          fetchPassengers();
        }
      } catch (error) {
        console.error("Unexpected error updating passengers:", error);
        showNotification("error", "An unexpected error occurred while updating passengers.");
        setPassengers(previousPassengers);
      } finally {
        setIsSaving(false);
      }
    }, 100);
  };

  const handleDeletePassenger = async (id: string) => {
    const previousPassengers = [...passengers];
    setPassengers(passengers.filter((p) => p.id !== id));
    try {
      const { error } = await supabase.from("passengers").delete().eq("id", id);
      if (error) {
        console.error("Error deleting passenger:", error);
        showNotification("error", `Failed to delete passenger: ${error.message}`);
        setPassengers(previousPassengers);
      } else {
        console.log(`Deleted passenger id=${id}`);
        showNotification("success", "Passenger deleted successfully");
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting passenger:", error);
      showNotification("error", "An unexpected error occurred while deleting the passenger.");
      setPassengers(previousPassengers);
    }
  };

  const handleBlacklistToggle = async (id: string, isChecked: boolean) => {
    const previousPassengers = [...passengers];
    const updatedPassengers = passengers.map((p) =>
      p.id === id ? { ...p, is_blacklisted: isChecked } : p
    );
    setPassengers(updatedPassengers);
    try {
      const { error } = await supabase
        .from("passengers")
        .update({ is_blacklisted: isChecked, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("Error updating blacklist:", error);
        showNotification("error", `Failed to update blacklist: ${error.message}`);
        setPassengers(previousPassengers);
      } else {
        console.log(`Blacklist updated for passenger ${id}: ${isChecked}`);
        showNotification("success", isChecked ? "Passenger blacklisted! 🚫" : "Passenger unblacklisted! ✅");
      }
    } catch (error) {
      console.error("Unexpected error updating blacklist:", error);
      showNotification("error", "An unexpected error occurred while updating blacklist.");
      setPassengers(previousPassengers);
    }
  };

  const filteredPassengers = useMemo(() => {
    return [...passengers]
      .sort((a, b) => {
        const dateA = a.departure_date ? new Date(a.departure_date) : new Date(0);
        const dateB = b.departure_date ? new Date(b.departure_date) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      })
      .filter((passenger) => {
        const matchesName = `${passenger.first_name || ""} ${passenger.last_name || ""}`
          .toLowerCase()
          .includes(passengerNameFilter.toLowerCase());
        const orderIdString = passenger.order_id != null ? String(passenger.order_id) : "";
        const matchesOrder = orderIdString.toLowerCase().includes(passengerOrderFilter.toLowerCase());
        const matchesStatus = passengerStatusFilter === "all" ||
          passenger.status === passengerStatusFilter ||
          (!passenger.status && passengerStatusFilter === "active");
        const matchesDeparture = !passengerDepartureFilter || passenger.departure_date === passengerDepartureFilter;
        return matchesName && matchesOrder && matchesStatus && matchesDeparture && !passenger.is_blacklisted;
      });
  }, [passengers, passengerNameFilter, passengerOrderFilter, passengerStatusFilter, passengerDepartureFilter]);

  const paginatedPassengers = useMemo(() => {
    const startIndex = (currentPage - 1) * passengersPerPage;
    return filteredPassengers.slice(startIndex, startIndex + passengersPerPage);
  }, [filteredPassengers, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const totalPages = Math.ceil(filteredPassengers.length / passengersPerPage);

  // Helper to get error message for a field
  const getErrorMessage = (passengerId: string, field: keyof Passenger) => {
    const errorKey = `${passengerId}_${field}`;
    return validationErrors.get(errorKey);
  };

  // Helper to check if field has error
  const hasFieldError = (passengerId: string, field: keyof Passenger) => {
    return !!getErrorMessage(passengerId, field);
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative backdrop-blur-sm">
      {/* Header Section with Gradient Background */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">Passengers Management</h3>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
            <span className="text-white font-medium">Total: {filteredPassengers.length}</span>
          </div>
        </div>

        {/* Filter Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group">
            <label className="text-sm font-bold text-white/90 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search by Name
            </label>
            <input
              type="text"
              value={passengerNameFilter}
              onChange={(e) => setPassengerNameFilter(e.target.value)}
              placeholder="Search passengers..."
              className="w-full px-4 py-3 font-bold bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="group">
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              Order ID
            </label>
            <input
              type="text"
              value={passengerOrderFilter}
              onChange={(e) => setPassengerOrderFilter(e.target.value)}
              placeholder="Search by order ID..."
              className="w-full px-4 py-3 font-bold bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="group">
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m4 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-4z" />
              </svg>
              Departure Date
            </label>
            <input
              type="date"
              value={passengerDepartureFilter}
              onChange={(e) => setPassengerDepartureFilter(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="group">
            <label className="block text-sm font-medium text-white/90 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status
            </label>
            <select
              value={passengerStatusFilter}
              onChange={(e) => setPassengerStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-200"
            >
              <option value="all" className="text-gray-900">All Statuses</option>
              <option value="pending" className="text-gray-900">⏳ Pending</option>
              <option value="approved" className="text-gray-900">✅ Approved</option>
              <option value="rejected" className="text-gray-900">❌ Rejected</option>
              <option value="active" className="text-gray-900">✅ Active</option>
              <option value="inactive" className="text-gray-900">😴 Inactive</option>
              <option value="cancelled" className="text-gray-900">🚫 Cancelled</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex-1 px-6 py-3 rounded-3xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 ${isEditMode ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30' : 'bg-white text-blue-600 hover:bg-gray-50 shadow-lg'
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isEditMode ? "M6 18L18 6M6 6l12 12" : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
            </svg>
            <span>{isEditMode ? "Cancel Edit" : "Edit Passengers"}</span>
          </button>

          {isEditMode && (
            <button
              onClick={handleSaveEdits}
              disabled={isSaving || hasValidationErrors()}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg ${hasValidationErrors()
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              {hasValidationErrors() && (
                <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                  ! Fix Errors
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto bg-white/50 backdrop-blur-sm">
        <table className="min-w-full divide-y divide-gray-200/50">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 backdrop-blur-sm">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 min-w-[192px] shadow-lg border-r border-gray-200">
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Name</span>
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-[192px] z-10 bg-gray-50 min-w-[128px] shadow-lg border-r border-gray-200">
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span>Order ID</span>
                </div>
              </th>
              <th className="px-16 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tour</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Departure</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">DOB</th>
              <th className="px-12 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Age</th>
              <th className="px-14 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Gender</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Passport</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Passport Expiry</th>
              <th className="px-12 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nationality</th>
              <th className="px-14 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Hotel</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Allergies</th>
              <th className="px-28 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Notes</th>
              <th className="px-18 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Blacklist</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white/80 backdrop-blur-sm divide-y divide-gray-200/50">
            {paginatedPassengers.map((passenger, index) => {
              console.log(`Rendering passenger ${passenger.id}, status: ${passenger.status}`);
              return (
                <tr key={passenger.id} className={`hover:bg-blue-50/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/30'}`}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white/90 backdrop-blur-sm z-0 border-r border-gray-200 min-w-[192px]">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={passenger.first_name || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "first_name", e.target.value)}
                          placeholder="First Name"
                          className={getInputClass("first_name", passenger, isEditMode)}
                        />
                        {hasFieldError(passenger.id, "first_name") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "first_name")}
                          </p>
                        )}
                        <input
                          type="text"
                          value={passenger.last_name || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "last_name", e.target.value)}
                          placeholder="Last Name"
                          className={getInputClass("last_name", passenger, isEditMode)}
                        />
                        {hasFieldError(passenger.id, "last_name") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "last_name")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {passenger.first_name?.charAt(0) || ""}{passenger.last_name?.charAt(0) || ""}
                        </div>
                        <span className="font-semibold">{`${passenger.first_name || ""} ${passenger.last_name || ""}`.trim() || "N/A"}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900 sticky left-[192px] bg-white/90 backdrop-blur-sm z-0 border-r border-gray-200 min-w-[128px]">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={passenger.order_id || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "order_id", e.target.value)}
                          placeholder="Order ID"
                          className={getInputClass("order_id", passenger, isEditMode)}
                        />
                        {hasFieldError(passenger.id, "order_id") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "order_id")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {passenger.order_id || "N/A"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <select
                        value={passenger.tour_title || ""}
                        onChange={(e) => handlePassengerChange(passenger.id, "tour_title", e.target.value)}
                        className={getInputClass("tour_title" as keyof Passenger, passenger, isEditMode)}
                      >
                        <option value="">Select Tour</option>
                        {tours.map((tour) => (
                          <option key={tour.id} value={tour.title}>
                            {tour.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-medium text-gray-800">{passenger.tour_title || "N/A"}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <input
                        type="date"
                        value={passenger.departure_date || ""}
                        onChange={(e) => handlePassengerChange(passenger.id, "departure_date", e.target.value)}
                        className={getInputClass("departure_date" as keyof Passenger, passenger, isEditMode)}
                      />
                    ) : (
                      <span className="text-gray-700">{passenger.departure_date || "N/A"}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="date"
                          value={passenger.date_of_birth || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "date_of_birth", e.target.value || "")}
                          className={getInputClass("date_of_birth", passenger, isEditMode)}
                          max={new Date().toISOString().split('T')[0]} // Can't select future dates
                        />
                        {hasFieldError(passenger.id, "date_of_birth") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "date_of_birth")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-700">{passenger.date_of_birth || "N/A"}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-semibold text-gray-800">
                      {passenger.age || "N/A"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <select
                          value={passenger.gender || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "gender", e.target.value)}
                          className={getInputClass("gender", passenger, isEditMode)}
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                        {hasFieldError(passenger.id, "gender") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "gender")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${passenger.gender === 'Male' ? 'bg-blue-100 text-blue-800' :
                          passenger.gender === 'Female' ? 'bg-pink-100 text-pink-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {passenger.gender || "N/A"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={passenger.passport_number || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "passport_number", e.target.value)}
                          placeholder="Passport Number"
                          className={getInputClass("passport_number", passenger, isEditMode)}
                        />
                        {hasFieldError(passenger.id, "passport_number") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "passport_number")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{passenger.passport_number || "N/A"}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="date"
                          value={passenger.passport_expiry || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "passport_expiry", e.target.value || "")}
                          className={getInputClass("passport_expiry", passenger, isEditMode)}
                          min={new Date().toISOString().split('T')[0]} // Can't select past dates
                        />
                        {hasFieldError(passenger.id, "passport_expiry") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "passport_expiry")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-700">{passenger.passport_expiry || "N/A"}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <select
                          value={passenger.nationality || "Mongolia"}
                          onChange={(e) => handlePassengerChange(passenger.id, "nationality", e.target.value)}
                          className={getInputClass("nationality", passenger, isEditMode)}
                        >
                          {COUNTRY_OPTIONS.map((country) => (
                            <option key={country.value} value={country.value}>
                              {country.label}
                            </option>
                          ))}
                        </select>
                        {hasFieldError(passenger.id, "nationality") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "nationality")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {passenger.nationality || "🇲🇳 Mongolia"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={passenger.hotel || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "hotel", e.target.value)}
                          placeholder="Hotel"
                          className={getInputClass("hotel", passenger, isEditMode)}
                        />
                        {hasFieldError(passenger.id, "hotel") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "hotel")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        {passenger.hotel || "N/A"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={passenger.allergy || ""}
                        onChange={(e) => handlePassengerChange(passenger.id, "allergy", e.target.value)}
                        placeholder="Allergies"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {passenger.allergy || "None"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <textarea
                          value={passenger.notes || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "notes", e.target.value)}
                          placeholder="Add notes about passenger (e.g., travel issues)"
                          className={getInputClass("notes", passenger, isEditMode)}
                          rows={2}
                        />
                        {hasFieldError(passenger.id, "notes") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "notes")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {passenger.notes || "None"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode ? (
                      <div className="space-y-1">
                        <select
                          value={passenger.status || "active"}
                          onChange={(e) => handlePassengerChange(passenger.id, "status", e.target.value || "active")}
                          className={getInputClass("status", passenger, isEditMode)}
                        >
                          <option value="pending">⏳ Pending</option>
                          <option value="approved">✅ Approved</option>
                          <option value="rejected">❌ Rejected</option>
                          <option value="active">✅ Active</option>
                          <option value="inactive">😴 Inactive</option>
                          <option value="cancelled">🚫 Cancelled</option>
                        </select>
                        {hasFieldError(passenger.id, "status") && (
                          <p className="text-xs text-red-600 mt-1">
                            {getErrorMessage(passenger.id, "status")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${passenger.status === 'approved' || passenger.status === 'active' ? 'bg-green-100 text-green-800' :
                          passenger.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            passenger.status === 'rejected' || passenger.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              passenger.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {passenger.status === 'approved' && '✅ '}
                        {passenger.status === 'active' && '✅ '}
                        {passenger.status === 'pending' && '⏳ '}
                        {passenger.status === 'rejected' && '❌ '}
                        {passenger.status === 'cancelled' && '🚫 '}
                        {passenger.status === 'inactive' && '😴 '}
                        {passenger.status ? passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1) : "Active"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode && (
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={passenger.is_blacklisted || false}
                          onChange={(e) => handleBlacklistToggle(passenger.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    )}
                    {!isEditMode && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${passenger.is_blacklisted ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                        {passenger.is_blacklisted ? "🚫 Yes" : "✅ No"}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900">
                    {isEditMode && (
                      <button
                        onClick={() => setShowDeleteConfirm(passenger.id)}
                        className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredPassengers.length === 0 && (
        <div className="p-12 text-center bg-gradient-to-br from-gray-50 to-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-700 mb-2">No passengers found</h4>
          <p className="text-gray-500">Try adjusting your filters to find what you're looking for.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{((currentPage - 1) * 10) + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * 10, filteredPassengers.length)}</span> of{' '}
              <span className="font-semibold">{filteredPassengers.length}</span> results
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 transition-all duration-200 shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === pageNumber ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 transition-all duration-200 shadow-sm"
              >
                Next
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all duration-300">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Confirm Delete</h3>
            <p className="text-gray-600 text-center mb-8">Are you sure you want to delete this passenger? This action cannot be undone.</p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePassenger(showDeleteConfirm)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}