import { useState, useRef } from "react";
import type { Tour, Passenger, User as UserType, ValidationError } from "../types/type";
import Notifications from "../Parts/Notification";
import PassengerFormUser from "../Parts/PassengerFormUser";
import { downloadTemplate } from "../utils/csvUtils";

interface AddPassengerTabUserProps {
  tours: Tour[];
  selectedTour: string;
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  isGroup: boolean;
  setIsGroup: React.Dispatch<React.SetStateAction<boolean>>;
  groupName: string;
  setGroupName: React.Dispatch<React.SetStateAction<string>>;
  addPassenger: () => void;
  addMultiplePassengers: (count: number) => void;
  clearAllPassengers: () => void;
  handleUploadCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updatePassenger: (passengerId: string, field: keyof Passenger, value: any) => Promise<void>;
  removePassenger: (passengerId: string) => void;
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  validateBooking: () => boolean; // Add validateBooking prop
}

export default function AddPassengerTabUser({
  tours,
  selectedTour,
  passengers,
  setPassengers,
  errors,
  isGroup,
  setIsGroup,
  groupName,
  setGroupName,
  addPassenger,
  addMultiplePassengers,
  clearAllPassengers,
  handleUploadCSV,
  updatePassenger,
  removePassenger,
  showNotification,
  currentUser,
  setActiveStep,
  validateBooking, // Receive validateBooking from parent
}: AddPassengerTabUserProps) {
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(null);
  const newPassengerRef = useRef<HTMLDivElement | null>(null);

  const MAX_PASSENGERS = 20;

  const selectedTourData = tours.find((t) => t.title === selectedTour);
  const remainingSeats = selectedTourData?.available_seats !== undefined
    ? Math.max(0, selectedTourData.available_seats - passengers.length)
    : undefined;

  const canAddPassenger = () => {
    if (passengers.length >= MAX_PASSENGERS) return false;
    if (!selectedTourData) return true;
    if (selectedTourData.available_seats === undefined) return true;
    return passengers.length < selectedTourData.available_seats;
  };

  const wrappedShowNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
    showNotification(type, message);
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
              {isGroup ? `Add passengers for ${groupName} on ${selectedTour}` : `Add passengers for ${selectedTour}`}
            </p>
            {remainingSeats !== undefined && (
              <p className={`text-sm font-medium mt-2 ${remainingSeats > 5 ? 'text-green-600' : remainingSeats > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                {remainingSeats} seats available
              </p>
            )}
          </div>

          {!canAddPassenger() && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-red-800">
                  {passengers.length >= MAX_PASSENGERS
                    ? `Maximum ${MAX_PASSENGERS} passengers allowed per booking`
                    : "No more seats available for this tour"}
                </p>
              </div>
            </div>
          )}

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
                      {isGroup ? `${groupName || 'Group Booking'}` : 'Individual Booking'}
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
                      {remainingSeats !== undefined && (
                        <span className={`flex items-center font-medium ${remainingSeats > 5 ? 'text-green-600' : remainingSeats > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {remainingSeats} seats left
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
                    disabled={!canAddPassenger()}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Passenger
                  </button>
                  <button
                    onClick={clearAllPassengers}
                    disabled={passengers.length === 0}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
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
              </div>
            </div>
        </div>

          <PassengerFormUser
            currentUser={currentUser}
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
            validateBooking={validateBooking} // Pass the real validateBooking function
          />
        </div>
      </div>
    </div>
  );
}