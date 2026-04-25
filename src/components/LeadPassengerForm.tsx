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
  leadPassengerData: LeadPassenger | null;
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
    (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
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
  leadPassengerData,
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
    currentUser.role || "",
  );
  const maxSeats = isPowerUser
    ? 100
    : (selectedTourData?.available_seats ?? 10);

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
        message: "This lead passenger is already registered with the same details.",
      });
      return true;
    }
    return false;
  };

  const handleInputChange = (
    field: keyof typeof leadPassenger,
    value: string | number,
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
          Math.floor((expiryDate - now) / 1000),
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
    [setLeadPassengerData, setNotification],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        prev ? { ...prev, status: "confirmed" } : null,
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
    setActiveStep(3);
  };

  useEffect(() => {
    if (leadId && departureDate) {
      const expiryHours = calculateLeadExpiryHours(departureDate);
      const expiresAt = new Date(
        Date.now() + expiryHours * 3600 * 1000,
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
    <div className="mono-stack">
      <div className="sticky top-0 z-10 mono-card mb-4">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gray-100 rounded-lg border border-gray-200">
              <svg
                className="h-4 w-4 text-gray-700"
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
              <h3 className="text-base font-semibold text-gray-900">Lead Passenger</h3>
              <p className="text-xs text-gray-600">
                {selectedTourData?.title || "No tour"} |{" "}
                {calculateLeadExpiryHours(departureDate)}h to complete
              </p>
            </div>
          </div>
        </div>
      </div>

      {leadId && timeLeft !== null && (
        <div className="mb-4 p-2 bg-yellow-50 text-yellow-800 rounded-lg text-xs">
          <p className="font-medium">Reserved: {leadPassenger.first_name} {leadPassenger.last_name}</p>
          <p>Seats: {leadPassenger.seat_count} | Time: {formatTime(timeLeft)}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white p-4 rounded-lg shadow-sm"
      >
        {!leadId && (
          <>
            <div>
              <label
                htmlFor="first_name"
                className="block text-xs font-medium text-gray-700"
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
                className={`mt-0.5 block w-full rounded border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                  errors.first_name ? "border-red-500" : ""
                }`}
                disabled={loading}
              />
              {errors.first_name && (
                <p className="text-red-500 text-xs mt-0.5">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="last_name"
                className="block text-xs font-medium text-gray-700"
              >
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                value={leadPassenger.last_name}
                onChange={(e) =>
                  handleInputChange("last_name", e.target.value)
                }
                className={`mt-0.5 block w-full rounded border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                  errors.last_name ? "border-red-500" : ""
                }`}
                disabled={loading}
              />
              {errors.last_name && (
                <p className="text-red-500 text-xs mt-0.5">{errors.last_name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-medium text-gray-700"
              >
                Phone (Last 4 Digits)
              </label>
              <input
                type="tel"
                id="phone"
                value={leadPassenger.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className={`mt-0.5 block w-full rounded border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                  errors.phone ? "border-red-500" : ""
                }`}
                disabled={loading}
                placeholder="1234"
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-0.5">{errors.phone}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="seat_count"
                className="block text-xs font-medium text-gray-700"
              >
                Seats
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
                className={`mt-0.5 block w-full rounded border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                  errors.seat_count ? "border-red-500" : ""
                }`}
                disabled={loading}
              />
              {errors.seat_count && (
                <p className="text-red-500 text-xs mt-0.5">{errors.seat_count}</p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              setActiveStep(1);
            }}
            className="inline-flex items-center px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded shadow-sm transition-all"
            disabled={loading}
          >
            <svg
              className="w-3.5 h-3.5 mr-1"
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
                className="inline-flex items-center px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded shadow-sm transition-all"
                disabled={loading}
              >
                Skip
              </button>
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition-all disabled:bg-gray-300"
                disabled={loading}
              >
                {loading ? "..." : "Register"}
              </button>
            </>
          )}

          {leadId && (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 inline-flex items-center justify-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded shadow-sm disabled:bg-gray-300 transition-all"
                disabled={loading || leadPassengerData?.status === "confirmed"}
              >
                <svg
                  className="w-3.5 h-3.5 mr-1"
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
                {loading ? "..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded shadow-sm disabled:bg-gray-300 transition-all"
                disabled={loading}
              >
                <svg
                  className="w-3.5 h-3.5 mr-1"
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
                {loading ? "..." : "Cancel"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
