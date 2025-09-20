import { useState, useRef } from "react";
import type { Tour, Passenger, User as UserType, ValidationError } from "../types/type";
import Notifications from "../Parts/Notification";
import PassengerFormUser from "../Parts/PassengerFormUser";
import { downloadTemplate } from "../utils/csvUtils";
import { checkSeatLimit } from "../utils/seatLimitChecks";

interface AddPassengerTabUserProps {
  tours: Tour[];
  selectedTour: string;
  departureDate: string;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  addPassenger: () => void;
  addMultiplePassengers: (count: number) => void;
  clearAllPassengers: () => void;
  handleUploadCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updatePassenger: (passengerId: string, field: keyof Passenger, value: any) => Promise<void>;
  removePassenger: (passengerId: string) => void;
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  validateBooking: () => boolean;
}

export default function AddPassengerTabUser({
  tours,
  selectedTour,
  departureDate,
  setDepartureDate,
  passengers,
  setPassengers,
  errors,
  addPassenger,
  addMultiplePassengers,
  clearAllPassengers,
  handleUploadCSV,
  updatePassenger,
  removePassenger,
  showNotification,
  currentUser,
  setActiveStep,
  validateBooking,
}: AddPassengerTabUserProps) {
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(null);
  const newPassengerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_PASSENGERS = 20;
  const isAdmin = currentUser.role === "admin" || currentUser.role === "superadmin";

  const selectedTourData = tours.find((t) => t.title === selectedTour);
  const totalSeats = selectedTourData?.seats ?? 0;
  const remainingSeats = totalSeats !== 0 ? Math.max(0, totalSeats - passengers.length) : undefined;

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
      console.log("No tour found for selectedTour:", selectedTour);
      wrappedShowNotification("error", "Invalid tour selected");
      return false;
    }

    const { isValid, message } = await checkSeatLimit(selectedTourData.id, departureDate);
    wrappedShowNotification(isValid ? "success" : "error", message); // Show message regardless of isValid
    if (!isValid) {
      return false;
    }

    return true;
  };

  const wrappedShowNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
    showNotification(type, message);
  };

  const handleAddPassenger = async () => {
    const canAdd = await canAddPassenger();
    if (!canAdd) return;

    try {
      addPassenger();
      wrappedShowNotification("success", "Passenger added");
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("Error adding passenger:", error);
      wrappedShowNotification("error", "Failed to add passenger");
    }
  };

  const handleAddMultiplePassengers = async () => {
    const canAdd = await canAddPassenger();
    if (!canAdd) return;

    const count = Math.min(5, remainingSeats ?? 5);
    try {
      addMultiplePassengers(count);
      wrappedShowNotification("success", `${count} passengers added`);
      newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("Error adding passengers:", error);
      wrappedShowNotification("error", `Failed to add ${count} passengers`);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const canAdd = await canAddPassenger();
    if (!canAdd) return;

    try {
      handleUploadCSV(e);
      wrappedShowNotification("success", "Passengers imported from CSV");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error uploading CSV:", error);
      wrappedShowNotification("error", "Failed to upload CSV");
    }
  };

  const handleDownloadTemplate = () => {
    downloadTemplate(wrappedShowNotification);
  };

  const totalPrice = passengers.reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <div className="bg-gray-50 py-4">
      <Notifications notification={notification} setNotification={setNotification} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Passengers</h3>
            <p className="text-sm text-gray-600">
              Add passengers for {selectedTourData?.title || "Selected Tour"}
            </p>
            <div className="mt-4">
              <label htmlFor="departureDate" className="block text-sm font-medium text-gray-700 mb-1">
                Departure Date
              </label>
              <input
                id="departureDate"
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some((e) => e.field === "departure") ? "border-red-300" : "border-gray-300"}`}
                aria-invalid={errors.some((e) => e.field === "departure")}
                aria-describedby={errors.some((e) => e.field === "departure") ? "departure-error" : undefined}
              />
              {errors.some((e) => e.field === "departure") && (
                <p id="departure-error" className="text-red-500 text-xs mt-1">
                  Departure date is required
                </p>
              )}
            </div>
            {isAdmin && totalSeats !== 0 && ( // Only show for admins
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p
                  className={`text-sm font-medium ${remainingSeats && remainingSeats > 5 ? "text-green-600" : remainingSeats && remainingSeats > 0 ? "text-orange-600" : "text-red-600"}`}
                >
                  <span className="font-semibold">Total Seats:</span> {totalSeats} |{" "}
                  <span className="font-semibold">Remaining Seats:</span>{" "}
                  {remainingSeats !== undefined ? remainingSeats : "Unlimited"}
                </p>
                {selectedTourData?.base_price !== undefined && (
                  <p className="text-sm font-medium text-gray-600 mt-2">
                    <span className="font-semibold">Base Price:</span> ${selectedTourData.base_price.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {remainingSeats !== undefined && remainingSeats === 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-sm text-red-800">No seats available for this tour. Please choose another.</p>
              </div>
            </div>
          )}

          <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Booking</h3>
                    <p className="text-sm text-slate-600 flex items-center space-x-4">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                          />
                        </svg>
                        {passengers.length} {passengers.length === 1 ? "passenger" : "passengers"}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                          />
                        </svg>
                        ${totalPrice.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAddPassenger}
                    disabled={passengers.length >= MAX_PASSENGERS || !selectedTour || !departureDate || remainingSeats === 0}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Passenger
                  </button>
                  <button
                    onClick={handleAddMultiplePassengers}
                    disabled={passengers.length >= MAX_PASSENGERS || !selectedTour || !departureDate || remainingSeats === 0}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    Add 5 Passengers
                  </button>
                  <button
                    onClick={clearAllPassengers}
                    disabled={passengers.length === 0}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear All
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download Template
                  </button>
                  <label className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleCSVUpload}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {passengers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-600">No passengers added yet. Click "Add Passenger" to start.</p>
              </div>
            ) : (
              passengers.map((passenger) => (
                <div
                  key={passenger.id}
                  ref={passenger.id === expandedPassengerId ? newPassengerRef : null}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4"
                >
                  <PassengerFormUser
                    passengers={passengers}
                    setPassengers={setPassengers}
                    selectedTourData={selectedTourData}
                    errors={errors}
                    updatePassenger={(index, field, value) => updatePassenger(passengers[index].id, field, value)}
                    removePassenger={(index) => removePassenger(passengers[index].id)}
                    downloadTemplate={() => downloadTemplate(wrappedShowNotification)}
                    handleUploadCSV={handleCSVUpload}
                    addPassenger={addPassenger}
                    isGroup={false}
                    setIsGroup={() => { }}
                    groupName=""
                    setGroupName={() => { }}
                    setActiveStep={setActiveStep}
                    showNotification={showNotification}
                    expandedPassengerId={expandedPassengerId}
                    setExpandedPassengerId={setExpandedPassengerId}
                    newPassengerRef={newPassengerRef}
                  />
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setActiveStep(1)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Tour Selection
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Continue to Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}