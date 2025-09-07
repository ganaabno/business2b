import type { Tour, Passenger, ValidationError, User as UserType } from "../types/type";

interface PassengerFormUserProps {
  currentUser: UserType;
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  selectedTourData?: Tour;
  errors: ValidationError[];
  updatePassenger: (passengerId: string, field: keyof Passenger, value: any) => Promise<void>;
  removePassenger: (passengerId: string) => void;
  downloadTemplate: () => void;
  handleUploadCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addPassenger: () => void;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  isGroup: boolean;
  setIsGroup: React.Dispatch<React.SetStateAction<boolean>>;
  groupName: string;
  setGroupName: React.Dispatch<React.SetStateAction<string>>;
  showNotification: (type: "success" | "error", message: string) => void;
  expandedPassengerId: string | null;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  newPassengerRef: React.MutableRefObject<HTMLDivElement | null>;
  validateBooking: () => boolean;
}

const getPassportExpiryColor = (expiryDate: string): string => {
  if (!expiryDate) return 'border-gray-300 bg-white';
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const monthsRemaining = diffTime / (1000 * 60 * 60 * 24 * 30);

  if (monthsRemaining <= 0) return 'border-red-500 bg-red-50';
  if (monthsRemaining <= 1) return 'border-red-400 bg-red-50';
  if (monthsRemaining <= 3) return 'border-orange-400 bg-orange-50';
  if (monthsRemaining <= 7) return 'border-yellow-400 bg-yellow-50';
  return 'border-green-400 bg-lime-50';
};

export default function PassengerFormUser({
  passengers,
  errors,
  updatePassenger,
  removePassenger,
  setActiveStep,
  expandedPassengerId,
  setExpandedPassengerId,
  newPassengerRef,
  showNotification,
  validateBooking,
}: PassengerFormUserProps) {
  const togglePassenger = (id: string) => {
    setExpandedPassengerId(expandedPassengerId === id ? null : id);
  };

  const handleNextClick = () => {
    console.log("Passenger data before next:", passengers);
    if (!validateBooking()) {
      // Find the first passenger with errors
      const firstError = errors.find((e) => e.field.startsWith("passenger_"));
      if (firstError) {
        const passengerId = firstError.field.split("_")[1];
        setExpandedPassengerId(passengerId); // Expand the passenger form with errors
        showNotification(
          "error",
          `Please fix validation errors for Passenger ${passengers.find((p) => p.id === passengerId)?.serial_no || ""}`
        );
      } else {
        showNotification("error", "Please fix the validation errors before proceeding");
      }
      return;
    }
    setActiveStep(3);
  };

  return (
    <div className="space-y-4">
      {passengers.map((passenger) => (
        <div
          key={passenger.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200"
          ref={passenger.id === passengers[passengers.length - 1].id ? newPassengerRef : null}
        >
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100"
            onClick={() => togglePassenger(passenger.id)}
          >
            <h4 className="text-sm font-medium text-gray-900">
              Passenger {passenger.serial_no}{" "}
              {passenger.first_name || passenger.last_name
                ? `- ${passenger.first_name} ${passenger.last_name}`
                : ""}
            </h4>
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform ${expandedPassengerId === passenger.id ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {expandedPassengerId === passenger.id && (
            <div className="p-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={passenger.first_name || ""}
                    onChange={(e) => updatePassenger(passenger.id, "first_name", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_first_name`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="First Name"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_first_name`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_first_name`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={passenger.last_name || ""}
                    onChange={(e) => updatePassenger(passenger.id, "last_name", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_last_name`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="Last Name"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_last_name`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_last_name`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={passenger.date_of_birth || ""}
                    onChange={(e) =>
                      updatePassenger(passenger.id, "date_of_birth", e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find(
                      (e) => e.field === `passenger_${passenger.id}_date_of_birth`
                    )
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_date_of_birth`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_date_of_birth`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    value={passenger.gender || ""}
                    onChange={(e) => updatePassenger(passenger.id, "gender", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_gender`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.find((e) => e.field === `passenger_${passenger.id}_gender`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_gender`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number *</label>
                  <input
                    type="text"
                    value={passenger.passport_number || ""}
                    onChange={(e) => updatePassenger(passenger.id, "passport_number", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_passport_number`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="Passport Number"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_passport_number`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_passport_number`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry *</label>
                  <input
                    type="date"
                    value={passenger.passport_expiry || ""}
                    onChange={(e) => updatePassenger(passenger.id, "passport_expiry", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_passport_expiry`)
                      ? "border-red-500 bg-red-50"
                      : getPassportExpiryColor(passenger.passport_expiry || "")
                      }`}
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_passport_expiry`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_passport_expiry`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality *</label>
                  <select
                    value={passenger.nationality || ""}
                    onChange={(e) => updatePassenger(passenger.id, "nationality", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_nationality`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                  >
                    <option value="default">Mongolia</option>
                    <option value="Male">China</option>
                    <option value="Female">France</option>
                    <option value="Other">Russia</option>
                  </select>
                  {errors.find((e) => e.field === `passenger_${passenger.id}_nationality`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_nationality`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
                  <input
                    type="text"
                    value={passenger.roomType || ""}
                    onChange={(e) => updatePassenger(passenger.id, "roomType", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_roomType`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="Room Type"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_roomType`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_roomType`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Allocation</label>
                  <input
                    type="text"
                    value={passenger.room_allocation || ""}
                    onChange={(e) => updatePassenger(passenger.id, "room_allocation", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Room Allocation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotel *</label>
                  <input
                    type="text"
                    value={passenger.hotel || ""}
                    onChange={(e) => updatePassenger(passenger.id, "hotel", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_hotel`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="Hotel"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_hotel`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_hotel`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Services</label>
                  <input
                    type="text"
                    value={passenger.additional_services?.join(", ") || ""}
                    onChange={(e) =>
                      updatePassenger(
                        passenger.id,
                        "additional_services",
                        e.target.value.split(",").map((s) => s.trim())
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Services (comma-separated)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <input
                    type="text"
                    value={passenger.allergy || ""}
                    onChange={(e) => updatePassenger(passenger.id, "allergy", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Allergies"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={passenger.email || ""}
                    onChange={(e) => updatePassenger(passenger.id, "email", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_email`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="Email"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_email`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_email`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={passenger.phone || ""}
                    onChange={(e) => updatePassenger(passenger.id, "phone", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.find((e) => e.field === `passenger_${passenger.id}_phone`)
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                      }`}
                    placeholder="Phone"
                  />
                  {errors.find((e) => e.field === `passenger_${passenger.id}_phone`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${passenger.id}_phone`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    value={passenger.emergency_phone || ""}
                    onChange={(e) => updatePassenger(passenger.id, "emergency_phone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Emergency Phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Upload</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => updatePassenger(passenger.id, "passport_upload", e.target.files?.[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => removePassenger(passenger.id)}
                  disabled={passengers.length === 1}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Remove Passenger
                </button>
                <button
                  onClick={handleNextClick}
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
          )}
        </div>
      ))}
    </div>
  );
}