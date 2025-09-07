import type { Tour, Passenger, ValidationError } from "../types/type";

interface PassengerFormProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  selectedTourData?: Tour;
  errors: ValidationError[];
  updatePassenger: (index: number, field: keyof Passenger, value: any) => Promise<void>;
  removePassenger: (index: number) => void;
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
}

export default function PassengerForm({
  passengers,
  errors,
  updatePassenger,
  removePassenger,
  expandedPassengerId,
  setExpandedPassengerId,
  newPassengerRef,
}: PassengerFormProps) {
  const togglePassenger = (id: string) => {
    setExpandedPassengerId(expandedPassengerId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {passengers.map((passenger, index) => (
        <div
          key={passenger.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200"
          ref={index === passengers.length - 1 ? newPassengerRef : null}
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
              className={`w-5 h-5 text-gray-600 transition-transform ${
                expandedPassengerId === passenger.id ? "rotate-180" : ""
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
                    value={passenger.first_name}
                    onChange={(e) => updatePassenger(index, "first_name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="First Name"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_first_name`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_first_name`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={passenger.last_name}
                    onChange={(e) => updatePassenger(index, "last_name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Last Name"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_last_name`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_last_name`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={passenger.date_of_birth}
                    onChange={(e) => updatePassenger(index, "date_of_birth", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_date_of_birth`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_date_of_birth`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    value={passenger.gender}
                    onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.find((e) => e.field === `passenger_${index}_gender`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_gender`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number *</label>
                  <input
                    type="text"
                    value={passenger.passport_number}
                    onChange={(e) => updatePassenger(index, "passport_number", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Passport Number"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_passport_number`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_passport_number`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry *</label>
                  <input
                    type="date"
                    value={passenger.passport_expiry}
                    onChange={(e) => updatePassenger(index, "passport_expiry", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_passport_expiry`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_passport_expiry`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality *</label>
                  <input
                    type="text"
                    value={passenger.nationality}
                    onChange={(e) => updatePassenger(index, "nationality", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Nationality"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_nationality`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_nationality`)?.message}
                    </p>
                  )}
              </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
                  <input
                    type="text"
                    value={passenger.roomType}
                    onChange={(e) => updatePassenger(index, "roomType", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Room Type"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_roomType`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_roomType`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room Allocation</label>
                  <input
                    type="text"
                    value={passenger.room_allocation}
                    onChange={(e) => updatePassenger(index, "room_allocation", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Room Allocation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotel *</label>
                  <input
                    type="text"
                    value={passenger.hotel}
                    onChange={(e) => updatePassenger(index, "hotel", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Hotel"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_hotel`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_hotel`)?.message}
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
                        index,
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
                    value={passenger.allergy}
                    onChange={(e) => updatePassenger(index, "allergy", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Allergies"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={passenger.email}
                    onChange={(e) => updatePassenger(index, "email", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Email"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_email`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_email`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={passenger.phone}
                    onChange={(e) => updatePassenger(index, "phone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone"
                  />
                  {errors.find((e) => e.field === `passenger_${index}_phone`) && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.find((e) => e.field === `passenger_${index}_phone`)?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    value={passenger.emergency_phone}
                    onChange={(e) => updatePassenger(index, "emergency_phone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Emergency Phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passport Upload</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => updatePassenger(index, "passport_upload", e.target.files?.[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => removePassenger(index)}
                  disabled={passengers.length === 1}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Remove Passenger
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}