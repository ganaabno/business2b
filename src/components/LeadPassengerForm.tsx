import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import type {
  Tour,
  User as UserType,
  Notification as NotificationType,
  LeadPassenger,
} from "../types/type";

interface LeadPassengerFormProps {
  selectedTour: string;
  departureDate: string;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  currentUser: UserType;
  selectedTourData?: Tour;
  leadPassengerData: LeadPassenger | null; // Added
  setLeadPassengerData: React.Dispatch<
    React.SetStateAction<LeadPassenger | null>
  >;
  setNotification: React.Dispatch<
    React.SetStateAction<NotificationType | null>
  >;
  confirmLeadPassenger: () => void;
}

const cleanDateForDB = (dateValue: any): string | null => {
  if (
    !dateValue ||
    (typeof dateValue === "string" && dateValue.trim() === "") ||
    (typeof dateValue === "string" &&
      !isNaN(Date.parse(dateValue)) &&
      new Date(dateValue).toString() === "Invalid Date")
  ) {
    return null;
  }
  const cleaned = String(dateValue).trim();
  const parsedDate = new Date(cleaned);
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
};

const calculateLeadExpiryHours = (departureDate: string): number => {
  const departure = new Date(departureDate);
  const now = new Date();
  const diffDays = Math.ceil(
    (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return 0;
  return Math.min(2 * Math.ceil(diffDays / 7), 24);
};

export default function LeadPassengerForm({
  selectedTour,
  departureDate,
  setActiveStep,
  currentUser,
  selectedTourData,
  leadPassengerData, // Added to destructured props
  setLeadPassengerData,
  setNotification,
  confirmLeadPassenger,
}: LeadPassengerFormProps) {
  const [leadPassenger, setLeadPassenger] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    seat_count: "" as string | number,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || ""
  );
  const maxSeats = isPowerUser ? 100 : selectedTourData?.available_seats ?? 10;

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!leadPassenger.first_name.trim())
      newErrors.first_name = "First name is required";
    if (!leadPassenger.last_name.trim())
      newErrors.last_name = "Last name is required";
    if (
      !leadPassenger.phone.trim() ||
      !/^[0-9]{4}$/.test(leadPassenger.phone.replace(/\D/g, ""))
    ) {
      newErrors.phone = "Exactly 4 digits are required for phone number";
    }
    const seatCountNum = parseInt(leadPassenger.seat_count as string);
    if (isNaN(seatCountNum) || seatCountNum < 1)
      newErrors.seat_count = "At least one seat is required";
    if (
      !isPowerUser &&
      selectedTourData?.available_seats &&
      seatCountNum > selectedTourData.available_seats
    ) {
      newErrors.seat_count = `Cannot reserve more than ${selectedTourData.available_seats} seats`;
    }
    if (seatCountNum > maxSeats) {
      newErrors.seat_count = `Cannot reserve more than ${maxSeats} seats`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [leadPassenger, selectedTourData, isPowerUser, maxSeats]);

  const checkDuplicateLead = async (): Promise<boolean> => {
    const seatCountNum = parseInt(leadPassenger.seat_count as string);
    if (isNaN(seatCountNum)) return false;

    const { data, error } = await supabase
      .from("passengers_in_lead")
      .select("id, first_name, last_name, phone, seat_count")
      .eq("status", "pending")
      .eq("phone", leadPassenger.phone.replace(/\D/g, "").slice(-4))
      .eq("seat_count", seatCountNum)
      .eq("first_name", leadPassenger.first_name.trim())
      .eq("last_name", leadPassenger.last_name.trim());

    if (error) {
      console.error("Error checking duplicate lead:", error);
      setNotification({
        type: "error",
        message: `Failed to check duplicates: ${error.message}`,
      });
      return false;
    }

    if (data && data.length > 0) {
      setNotification({
        type: "error",
        message:
          "This lead passenger is already registered with the same details.",
      });
      return true;
    }
    return false;
  };

  const handleInputChange = (
    field: keyof typeof leadPassenger,
    value: string | number
  ) => {
    setLeadPassenger((prev) => ({ ...prev, [field]: value }));
  };

  const startTimer = useCallback(
    (expiresAt: string) => {
      const expiryDate = new Date(expiresAt).getTime();
      const updateTimer = () => {
        const now = new Date().getTime();
        const timeRemaining = Math.max(
          0,
          Math.floor((expiryDate - now) / 1000)
        );
        setTimeLeft(timeRemaining);

        if (timeRemaining <= 0) {
          setLeadPassengerData(null);
          setLeadId(null);
          setLeadPassenger({
            first_name: "",
            last_name: "",
            phone: "",
            seat_count: "",
          });
          setNotification({
            type: "error",
            message: "Lead reservation expired. Please try again.",
          });
        }
      };

      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    },
    [setLeadPassengerData, setNotification]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(
      "LeadPassengerForm: handleSubmit called with leadPassenger:",
      leadPassenger
    );
    if (!validateForm()) {
      setNotification({
        type: "error",
        message: "Please fix all errors before submitting",
      });
      return;
    }

    if (!selectedTourData || !selectedTour || !departureDate) {
      setNotification({
        type: "error",
        message: "No tour or departure date selected",
      });
      return;
    }

    const isDuplicate = await checkDuplicateLead();
    if (isDuplicate) return;

    setLoading(true);
    try {
      const expiryHours = calculateLeadExpiryHours(departureDate);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const seatCountNum = parseInt(leadPassenger.seat_count as string);
      if (isNaN(seatCountNum)) throw new Error("Invalid seat count");

      const leadData: LeadPassenger = {
        id: crypto.randomUUID(),
        tour_id: selectedTourData.id,
        tour_title: selectedTourData.title,
        departure_date: cleanDateForDB(departureDate) || "",
        last_name: leadPassenger.last_name.trim(),
        first_name: leadPassenger.first_name.trim(),
        phone: leadPassenger.phone.replace(/\D/g, "").slice(-4),
        seat_count: seatCountNum,
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        user_id: currentUser.id,
      };

      const { data, error } = await supabase
        .from("passengers_in_lead")
        .insert(leadData)
        .select()
        .single();

      if (error) throw new Error(`Lead submission failed: ${error.message}`);
      if (!data) throw new Error("No data returned from lead submission");

      console.log("LeadPassengerForm: Inserted leadData:", leadData);
      setLeadId(data.id);
      setLeadPassengerData(data);
      setTimeLeft(expiryHours * 3600);
      setNotification({
        type: "success",
        message: `Lead passenger registered. You have ${expiryHours} hour${
          expiryHours !== 1 ? "s" : ""
        } to confirm or cancel the reservation.`,
      });
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to register lead passenger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!leadId || !leadPassengerData) {
      setNotification({
        type: "error",
        message: "No lead passenger to confirm",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("passengers_in_lead")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw new Error(`Failed to confirm lead: ${error.message}`);

      setLeadPassengerData((prev) =>
        prev ? { ...prev, status: "confirmed" } : null
      );
      setNotification({
        type: "success",
        message: "Lead passenger confirmed. Adding passenger forms.",
      });
      confirmLeadPassenger();
      setActiveStep(3);
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to confirm lead passenger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!leadId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("passengers_in_lead")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw new Error(`Failed to cancel lead: ${error.message}`);

      setLeadPassengerData(null);
      setLeadId(null);
      setLeadPassenger({
        first_name: "",
        last_name: "",
        phone: "",
        seat_count: "",
      });
      setTimeLeft(null);
      setNotification({
        type: "success",
        message: "Lead passenger cancelled.",
      });
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to cancel lead passenger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    console.log(
      "LeadPassengerForm: handleSkip called, setting activeStep to 3"
    );
    setActiveStep(3);
  };

  useEffect(() => {
    if (leadId && departureDate) {
      const expiryHours = calculateLeadExpiryHours(departureDate);
      const expiresAt = new Date(
        Date.now() + expiryHours * 3600 * 1000
      ).toISOString();
      const cleanup = startTimer(expiresAt);
      return cleanup;
    }
  }, [leadId, departureDate, startTimer]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${secs
      .toString()
      .padStart(2, "0")}s`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Lead Passenger Information
              </h3>
              <p className="text-sm text-slate-600">
                Tour: {selectedTourData?.title || "Not selected"} |{" "}
                {calculateLeadExpiryHours(departureDate)} hour
                {calculateLeadExpiryHours(departureDate) !== 1 ? "s" : ""} to
                complete
              </p>
            </div>
          </div>
        </div>
      </div>

      {leadId && timeLeft !== null && (
        <div className="mb-6 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
          <h4 className="text-sm font-medium">Lead Passenger Details</h4>
          <p className="text-sm">
            Name: {leadPassenger.first_name} {leadPassenger.last_name}
          </p>
          <p className="text-sm">
            Phone (last 4 digits): {leadPassenger.phone}
          </p>
          <p className="text-sm">Seats Reserved: {leadPassenger.seat_count}</p>
          <p className="text-sm flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l1.5 1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Time remaining: {formatTime(timeLeft)}
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-6 rounded-xl shadow-md"
      >
        {!leadId && (
          <>
            <div>
              <label
                htmlFor="first_name"
                className="block text-sm font-medium text-gray-700"
              >
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                value={leadPassenger.first_name}
                onChange={(e) =>
                  handleInputChange("first_name", e.target.value)
                }
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.first_name ? "border-red-500" : ""
                }`}
                disabled={loading}
              />
              {errors.first_name && (
                <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="last_name"
                className="block text-sm font-medium text-gray-700"
              >
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                value={leadPassenger.last_name}
                onChange={(e) => handleInputChange("last_name", e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.last_name ? "border-red-500" : ""
                }`}
                disabled={loading}
              />
              {errors.last_name && (
                <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone Number (Last 4 Digits)
              </label>
              <input
                type="tel"
                id="phone"
                value={leadPassenger.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.phone ? "border-red-500" : ""
                }`}
                disabled={loading}
                placeholder="e.g., 1234"
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="seat_count"
                className="block text-sm font-medium text-gray-700"
              >
                Number of Seats
              </label>
              <input
                type="number"
                id="seat_count"
                min="1"
                max={maxSeats}
                value={leadPassenger.seat_count}
                onChange={(e) =>
                  handleInputChange("seat_count", e.target.value)
                }
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.seat_count ? "border-red-500" : ""
                }`}
                disabled={loading}
                placeholder="Enter seats (1-10)"
              />
              {errors.seat_count && (
                <p className="text-red-500 text-sm mt-1">{errors.seat_count}</p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={() => {
              console.log(
                "LeadPassengerForm: Back button clicked, moving to step 1"
              );
              setActiveStep(1);
            }}
            className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            disabled={loading}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          {!leadId && (
            <>
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                disabled={loading}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Skip to Add Passengers
              </button>
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                disabled={loading}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {loading ? "Submitting..." : "Register Lead Passenger"}
              </button>
            </>
          )}

          {leadId && (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                disabled={loading || leadPassengerData?.status === "confirmed"}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {loading ? "Confirming..." : "Confirm Lead Passenger"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                disabled={loading}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {loading ? "Cancelling..." : "Cancel Lead"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
