import React, { useEffect } from "react";
import type { Tour, Passenger, ValidationError } from "../types/type";

interface PassengerFormProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  selectedTourData?: Tour;
  errors: ValidationError[];
  updatePassenger: (
    index: number,
    field: keyof Passenger,
    value: any
  ) => Promise<void>;
  removePassenger: (index: number) => void;
  downloadTemplate: () => void;
  handleUploadCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addPassenger: () => void;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  showNotification: (type: "success" | "error", message: string) => void;
  expandedPassengerId: string | null;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  newPassengerRef: React.MutableRefObject<HTMLDivElement | null>;
}

const getPassportExpiryColor = (expiryDate: string): string => {
  if (!expiryDate) return "border-gray-300 bg-white";

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const monthsRemaining = diffTime / (1000 * 60 * 60 * 24 * 30);

  if (monthsRemaining <= 0) return "border-red-500 bg-red-50";
  if (monthsRemaining <= 1) return "border-red-400 bg-red-50";
  if (monthsRemaining <= 3) return "border-orange-400 bg-orange-50";
  if (monthsRemaining <= 7) return "border-yellow-400 bg-yellow-50";
  return "border-green-400 bg-lime-50";
};

// 🧮 AGE CALCULATOR
const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 0;

  const today = new Date();
  const birth = new Date(birthDate);

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

// 🧹 DATE CLEANER - FIXES EMPTY STRING ISSUES
const cleanDateForDB = (
  dateValue: string | undefined | null
): string | null => {
  if (!dateValue || dateValue.trim() === "") {
    return null; // ✅ Return null instead of empty string
  }
  return dateValue.trim(); // ✅ Return cleaned date string
};

export default function PassengerForm({
  passengers,
  errors,
  updatePassenger,
  removePassenger,
  expandedPassengerId,
  setExpandedPassengerId,
  newPassengerRef,
  showNotification,
  setActiveStep,
}: PassengerFormProps) {
  // Toggle passenger expansion
  const togglePassenger = (id: string) => {
    setExpandedPassengerId(expandedPassengerId === id ? null : id);
  };

  // 🧹 CLEAN DATE CHANGE HANDLER - No more empty strings!
  const handleDateChange = async (
    index: number,
    field: keyof Passenger,
    value: string
  ) => {
    // Clean the date value before saving
    const cleanValue = cleanDateForDB(value);
    await updatePassenger(index, field, cleanValue);
  };

  // 🔍 ERROR HELPER
  const getError = (index: number, field: keyof Passenger) => {
    return errors.find((e) => e.field === `passenger_${index}_${field}`);
  };

  // 🎨 REQUIRED FIELDS HELPER - FIXED TYPE ISSUE
  const isRequiredFieldEmpty = (
    passenger: Passenger,
    field: keyof Passenger
  ): boolean => {
    const value = passenger[field];

    const requiredFields: (keyof Passenger)[] = [
      "first_name",
      "last_name",
      "date_of_birth",
      "gender",
      "passport_number",
      "passport_expire",
      "nationality",
      "roomType",
      "hotel",
      "email",
      "phone",
    ] as const;

    if (!requiredFields.includes(field)) return false;

    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return !value;
  };

  // 🎨 INPUT CLASS HELPER
  const getInputClasses = (
    index: number,
    field: keyof Passenger,
    passenger: Passenger,
    customColor?: string
  ) => {
    const error = getError(index, field);
    const isEmptyRequired = isRequiredFieldEmpty(passenger, field);

    if (error || isEmptyRequired) {
      return "border-red-500 bg-red-50";
    }

    if (customColor) {
      return customColor;
    }

    return "border-gray-300";
  };

  // 🚀 NEXT BUTTON HANDLER
  const handleNextClick = async () => {
    console.log("Passenger data before next:", passengers);

    const passengerErrors = errors.filter((e) =>
      e.field?.startsWith("passenger_")
    );

    if (passengerErrors.length > 0) {
      const firstError = passengerErrors[0];
      const parts = firstError.field?.split("_");
      if (!parts || parts.length < 2) return;
      const passengerIndex = parseInt(parts[1]);
      const passenger = passengers[passengerIndex];

      if (passenger) {
        setExpandedPassengerId(passenger.id);
        showNotification(
          "error",
          `Please fix validation errors for Passenger ${passenger.serial_no}`
        );
      } else {
        showNotification(
          "error",
          "Please fix the validation errors before proceeding"
        );
      }
      return;
    }

    setActiveStep(3);
  };

  // 🧹 SERVICES HANDLER
  const handleServicesChange = async (index: number, value: string) => {
    const services = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await updatePassenger(index, "additional_services", services);
  };

  // ✅ FIXED: ONE useEffect for ALL passengers - TOP LEVEL ONLY!
  useEffect(() => {
    // Auto-calculate age for ALL passengers when any date_of_birth changes
    passengers.forEach((passenger, index) => {
      if (passenger.date_of_birth && passenger.date_of_birth.trim() !== "") {
        const age = calculateAge(passenger.date_of_birth);
        if (passenger.age !== age) {
          // Use setTimeout to avoid React batching issues
          setTimeout(() => {
            updatePassenger(index, "age", age);
          }, 0);
        }
      }
    });
  }, [passengers.map((p) => p.date_of_birth).join(","), updatePassenger]); // ✅ Dep on all birthdates!

  if (passengers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No passengers added yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {passengers.map((passenger, index) => {
        // FIXED: Type-safe required fields check
        const requiredFields: (keyof Passenger)[] = [
          "first_name",
          "last_name",
          "date_of_birth",
          "gender",
          "passport_number",
          "passport_expire",
          "nationality",
          "roomType",
          "hotel",
          "email",
          "phone",
        ] as const;

        const hasAnyError = errors.some((e) =>
          e.field?.startsWith(`passenger_${index}_`)
        );
        const hasEmptyRequired = requiredFields.some((field) =>
          isRequiredFieldEmpty(passenger, field)
        );

        return (
          <div
            key={passenger.id}
            className={`bg-white rounded-lg shadow-sm border ${
              hasAnyError || hasEmptyRequired
                ? "border-red-300"
                : "border-gray-200"
            }`}
            ref={index === passengers.length - 1 ? newPassengerRef : null}
          >
            {/* 🏷️ PASSENGER HEADER */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => togglePassenger(passenger.id)}
            >
              <h4
                className={`text-sm font-medium flex items-center flex-wrap ${
                  hasAnyError || hasEmptyRequired
                    ? "text-red-700"
                    : "text-gray-900"
                }`}
              >
                Passenger {passenger.serial_no}
                {passenger.first_name || passenger.last_name
                  ? ` - ${passenger.first_name} ${passenger.last_name}`
                  : ""}
                {passenger.age && passenger.date_of_birth && (
                  <span className="ml-2 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    {passenger.age} years old
                  </span>
                )}
                {(hasAnyError || hasEmptyRequired) && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {hasAnyError ? "! Fix errors" : "! Complete fields"}
                  </span>
                )}
              </h4>

              <svg
                className={`w-5 h-5 transition-transform duration-200 ${
                  expandedPassengerId === passenger.id ? "rotate-180" : ""
                } ${
                  hasAnyError || hasEmptyRequired
                    ? "text-red-500"
                    : "text-gray-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            {expandedPassengerId === passenger.id && (
              <div className="p-4 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 👤 FIRST NAME */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={passenger.first_name || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "first_name",
                          e.target.value.trim()
                        )
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "first_name",
                        passenger
                      )}`}
                      placeholder="First Name"
                    />
                    {getError(index, "first_name") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "first_name")?.message}
                      </p>
                    )}
                  </div>

                  {/* 👤 LAST NAME */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={passenger.last_name || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "last_name",
                          e.target.value.trim()
                        )
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "last_name",
                        passenger
                      )}`}
                      placeholder="Last Name"
                    />
                    {getError(index, "last_name") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "last_name")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🗓️ DATE OF BIRTH - CLEANED! */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={passenger.date_of_birth || ""}
                      onChange={(e) =>
                        handleDateChange(index, "date_of_birth", e.target.value)
                      } // ✅ CLEANED!
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "date_of_birth",
                        passenger
                      )}`}
                    />
                    {getError(index, "date_of_birth") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "date_of_birth")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🧮 AGE - AUTO-CALCULATED */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age <span className="text-green-500">✓</span>
                    </label>
                    <input
                      type="number"
                      value={passenger.age || ""}
                      readOnly
                      className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-lg focus:ring-2 focus:ring-green-500 cursor-not-allowed text-center font-medium text-green-800"
                      placeholder="Auto-calculated"
                      title="Auto-calculated from birth date"
                    />
                    {passenger.date_of_birth && (
                      <p className="text-xs text-green-600 mt-1 flex items-center">
                        <svg
                          className="w-3 h-3 mr-1"
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
                        Auto-calculated from birth date
                      </p>
                    )}
                  </div>

                  {/* ⚧️ GENDER */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={passenger.gender || ""}
                      onChange={(e) =>
                        updatePassenger(index, "gender", e.target.value)
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "gender",
                        passenger
                      )}`}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {getError(index, "gender") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "gender")?.message}
                      </p>
                    )}
                  </div>

                  {/* 📄 PASSPORT NUMBER */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={passenger.passport_number || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "passport_number",
                          e.target.value.trim()
                        )
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "passport_number",
                        passenger
                      )}`}
                      placeholder="Passport Number"
                    />
                    {getError(index, "passport_number") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "passport_number")?.message}
                      </p>
                    )}
                  </div>

                  {/* 📅 PASSPORT EXPIRY - CLEANED! */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Expiry <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={passenger.passport_expire || ""}
                      onChange={(e) =>
                        handleDateChange(
                          index,
                          "passport_expire",
                          e.target.value
                        )
                      } // ✅ CLEANED!
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        getError(index, "passport_expire")
                          ? "border-red-500 bg-red-50"
                          : isRequiredFieldEmpty(passenger, "passport_expire")
                          ? "border-red-500 bg-red-50"
                          : getPassportExpiryColor(
                              passenger.passport_expire || ""
                            )
                      }`}
                    />
                    {getError(index, "passport_expire") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "passport_expire")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🌍 NATIONALITY */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={passenger.nationality || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "nationality",
                          e.target.value.trim()
                        )
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "nationality",
                        passenger
                      )}`}
                      placeholder="Nationality"
                    />
                    {getError(index, "nationality") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "nationality")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🛏️ ROOM TYPE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={passenger.roomType || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "roomType",
                          e.target.value.trim()
                        )
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "roomType",
                        passenger
                      )}`}
                      placeholder="Single, Double, Triple, etc."
                    />
                    {getError(index, "roomType") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "roomType")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🏠 ROOM ALLOCATION */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room Allocation
                    </label>
                    <input
                      type="text"
                      value={passenger.room_allocation || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "room_allocation",
                          e.target.value.trim()
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Room number or allocation notes"
                    />
                  </div>

                  {/* 🏨 HOTEL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hotel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={passenger.hotel || ""}
                      onChange={(e) =>
                        updatePassenger(index, "hotel", e.target.value.trim())
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "hotel",
                        passenger
                      )}`}
                      placeholder="Hotel Name"
                    />
                    {getError(index, "hotel") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "hotel")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🛎️ ADDITIONAL SERVICES */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Services
                    </label>
                    <input
                      type="text"
                      value={passenger.additional_services?.join(", ") || ""}
                      onChange={(e) =>
                        handleServicesChange(index, e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Vegetarian meal, extra bed, airport transfer, etc. (comma-separated)"
                    />
                  </div>

                  {/* ⚠️ ALLERGIES */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Allergies / Medical Conditions
                    </label>
                    <input
                      type="text"
                      value={passenger.allergy || ""}
                      onChange={(e) =>
                        updatePassenger(index, "allergy", e.target.value.trim())
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Peanuts, gluten, medication allergies, etc."
                    />
                  </div>

                  {/* 📧 EMAIL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={passenger.email || ""}
                      onChange={(e) =>
                        updatePassenger(index, "email", e.target.value.trim())
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "email",
                        passenger
                      )}`}
                      placeholder="name@example.com"
                    />
                    {getError(index, "email") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "email")?.message}
                      </p>
                    )}
                  </div>

                  {/* 📞 PHONE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={passenger.phone || ""}
                      onChange={(e) =>
                        updatePassenger(index, "phone", e.target.value.trim())
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${getInputClasses(
                        index,
                        "phone",
                        passenger
                      )}`}
                      placeholder="+1 (555) 123-4567"
                    />
                    {getError(index, "phone") && (
                      <p className="text-sm text-red-600 mt-1">
                        {getError(index, "phone")?.message}
                      </p>
                    )}
                  </div>

                  {/* 🚨 EMERGENCY PHONE */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      value={passenger.emergency_phone || ""}
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "emergency_phone",
                          e.target.value.trim()
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Emergency contact number"
                    />
                  </div>

                  {/* 📎 PASSPORT UPLOAD */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Upload
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        updatePassenger(
                          index,
                          "passport_upload",
                          e.target.files?.[0]
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {passenger.passport_upload && (
                      <p className="text-sm text-green-600 mt-1 flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
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
                        Passport uploaded successfully
                      </p>
                    )}
                  </div>
                </div>

                {/* 🎛️ ACTION BUTTONS */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => removePassenger(index)}
                    disabled={passengers.length === 1}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors duration-200"
                  >
                    Remove Passenger
                  </button>

                  {index === passengers.length - 1 && (
                    <button
                      type="button"
                      onClick={handleNextClick}
                      disabled={hasEmptyRequired || hasAnyError}
                      className={`inline-flex items-center px-6 py-2.5 text-white text-sm font-semibold rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                        hasEmptyRequired || hasAnyError
                          ? "bg-gray-400 cursor-not-allowed shadow-none"
                          : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg"
                      }`}
                    >
                      Next Step
                      <svg
                        className="w-4 h-4 ml-2"
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
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
