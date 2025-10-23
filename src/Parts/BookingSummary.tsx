import {
  MapPin,
  Calendar,
  Users,
  DollarSign,
  CreditCard,
  Eye,
  AlertTriangle,
  Download,
  Save,
  User,
  EyeIcon,
} from "lucide-react";
import type {
  Passenger,
  ValidationError,
  User as UserType,
} from "../types/type";
import React, { useEffect, useMemo } from "react";

interface BookingSummaryProps {
  selectedTour?: string;
  departureDate: string;
  passengers: Passenger[];
  paymentMethod: string[];
  setPaymentMethod: (value: string[]) => void;
  errors: ValidationError[];
  setErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  downloadCSV?: () => void;
  saveOrder: () => Promise<void>;
  setActiveStep: (value: number) => void;
  loading: boolean;
  showInProvider?: boolean;
  setShowInProvider?: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser: UserType;
  onBack: () => void;
}

const cleanDateForDB = (dateValue: any): string | null => {
  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === "" ||
    dateValue === " " ||
    dateValue === false ||
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

const calculateAge = (
  dateOfBirth: string | undefined | null
): number | string => {
  const cleanBirthDate = cleanDateForDB(dateOfBirth);
  if (!cleanBirthDate) return "N/A";

  const today = new Date();
  const birthDate = new Date(cleanBirthDate);

  if (isNaN(birthDate.getTime())) return "N/A";

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

const validatePassenger = (
  passenger: Passenger,
  departureDate: string
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const { serial_no = "Unknown" } = passenger;

  if (!passenger.first_name?.trim())
    errors.push({
      field: `passenger_${serial_no}_first_name`,
      message: `Passenger ${serial_no}: First name is required`,
    });
  if (!passenger.last_name?.trim())
    errors.push({
      field: `passenger_${serial_no}_last_name`,
      message: `Passenger ${serial_no}: Last name is required`,
    });
  if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
    errors.push({
      field: `passenger_${serial_no}_email`,
      message: `Passenger ${serial_no}: Valid email is required`,
    });
  if (!passenger.phone?.trim())
    errors.push({
      field: `passenger_${serial_no}_phone`,
      message: `Passenger ${serial_no}: Phone number is required`,
    });
  if (!passenger.nationality?.trim())
    errors.push({
      field: `passenger_${serial_no}_nationality`,
      message: `Passenger ${serial_no}: Nationality is required`,
    });
  if (!passenger.date_of_birth)
    errors.push({
      field: `passenger_${serial_no}_date_of_birth`,
      message: `Passenger ${serial_no}: Date of birth is required`,
    });
  if (!passenger.passport_number?.trim())
    errors.push({
      field: `passenger_${serial_no}_passport_number`,
      message: `Passenger ${serial_no}: Passport number is required`,
    });
  if (!passenger.roomType?.trim())
    errors.push({
      field: `passenger_${serial_no}_roomType`,
      message: `Passenger ${serial_no}: Room type is required`,
    });
  if (!passenger.hotel?.trim())
    errors.push({
      field: `passenger_${serial_no}_hotel`,
      message: `Passenger ${serial_no}: Hotel selection is required`,
    });
  return errors;
};

export default function BookingSummary({
  selectedTour,
  departureDate,
  passengers,
  paymentMethod,
  setPaymentMethod,
  errors,
  setErrors,
  downloadCSV,
  saveOrder,
  setActiveStep,
  showInProvider,
  setShowInProvider,
  loading,
  currentUser,
  onBack,
}: BookingSummaryProps) {
  const cleanedPassengers = useMemo(() => {
    return passengers.map((passenger) => ({
      ...passenger,
      date_of_birth: cleanDateForDB(passenger.date_of_birth),
      passport_expire: cleanDateForDB(passenger.passport_expire),
    }));
  }, [passengers]);

  const totalPrice = cleanedPassengers.reduce(
    (sum, p) => sum + (p.price || 0),
    0
  );

  const hasValidationErrors = useMemo(() => {
    const passengerErrors = cleanedPassengers.flatMap((p) =>
      validatePassenger(p, departureDate)
    );
    return errors.length > 0 || passengerErrors.length > 0;
  }, [cleanedPassengers, errors, departureDate]);

  const cleanDepartureDate = cleanDateForDB(departureDate);

  const paymentMethods = [
    "Cash",
    "Bank Transfer",
    "StorePay",
    "Pocket",
    "DariFinance",
    "Hutul Nomuun",
    "MonPay",
    "Barter",
    "Loan",
    "Credit Card",
  ];

  const handlePaymentMethodChange = (method: string) => {
    const newPaymentMethods = paymentMethod.includes(method)
      ? paymentMethod.filter((m) => m !== method)
      : [...paymentMethod, method];
    console.log("BookingSummary: Updated paymentMethod", newPaymentMethods);
    setPaymentMethod(newPaymentMethods);
    if (newPaymentMethods.length > 0) {
      setErrors((prev) => prev.filter((e) => e.field !== "payment"));
    }
  };

  const handleSaveOrder = async () => {
    console.log("BookingSummary: handleSaveOrder called", {
      paymentMethod,
      passengersLength: cleanedPassengers.length,
      hasValidationErrors,
      errors,
    });

    // Clear previous errors
    setErrors([]);

    // Validate passengers
    const passengerErrors = cleanedPassengers.flatMap((p) =>
      validatePassenger(p, departureDate)
    );
    if (passengerErrors.length > 0) {
      setErrors(passengerErrors);
      console.log(
        "BookingSummary: Passenger validation errors",
        passengerErrors
      );
      return;
    }

    // Validate payment method
    if (paymentMethod.length === 0) {
      setErrors([
        {
          field: "payment",
          message: "At least one payment method is required",
        },
      ]);
      console.log("BookingSummary: Payment method validation failed");
      return;
    }

    try {
      console.log(
        "BookingSummary: Calling saveOrder with paymentMethod:",
        paymentMethod
      );
      await saveOrder();
      console.log("BookingSummary: saveOrder successful, moving to step 1");
      setActiveStep(1); // Changed to step 1 for "super normal" flow
    } catch (error) {
      console.error("BookingSummary: Save error:", error);
      setErrors([
        {
          field: "general",
          message: "Failed to save booking. Please try again.",
        },
      ]);
    }
  };

  // Log button state for debugging
  // useEffect(() => {
  //   const passengerErrors = cleanedPassengers.flatMap((p) =>
  //     validatePassenger(p, departureDate)
  //   );
  //   console.log("BookingSummary: Confirm Booking button state", {
  //     loading,
  //     paymentMethod,
  //     paymentMethodLength: paymentMethod.length,
  //     passengersLength: cleanedPassengers.length,
  //     hasValidationErrors,
  //     errors,
  //     passengerErrors,
  //     cleanedPassengers,
  //   });
  // }, [
  //   loading,
  //   paymentMethod,
  //   cleanedPassengers,
  //   hasValidationErrors,
  //   errors,
  //   departureDate,
  // ]);

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <p className="text-sm text-red-800 font-medium">
                Please fix the following validation errors before proceeding:
              </p>
              <ul className="list-disc list-inside text-sm text-red-800 mt-2">
                {errors
                  .filter((error) => error.field !== "show_in_provider")
                  .map((error, index) => (
                    <li key={index}>
                      {error.field}: {error.message}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <Eye className="w-5 h-5 mr-2" />
          Booking Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-blue-50 rounded-lg">
              <MapPin className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">Tour Package</h4>
                <p className="text-sm text-gray-600">
                  {selectedTour || "Not selected"}
                </p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-green-50 rounded-lg">
              <Calendar className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">Departure Date</h4>
                <p className="text-sm text-gray-600">
                  {cleanDepartureDate
                    ? new Date(cleanDepartureDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Date not set"}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-purple-50 rounded-lg">
              <Users className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">Total Passengers</h4>
                <p className="text-sm text-gray-600">
                  {cleanedPassengers.length} passengers
                </p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-orange-50 rounded-lg">
              <DollarSign className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">Total Price</h4>
                <p className="text-lg font-bold text-gray-900">
                  ${totalPrice.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  Commission: ${(totalPrice * 0.05).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Payment Methods</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {paymentMethods.map((method) => (
            <label
              key={method}
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                paymentMethod.includes(method)
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input
                type="checkbox"
                name="paymentMethod"
                value={method}
                checked={paymentMethod.includes(method)}
                onChange={() => handlePaymentMethodChange(method)}
                className="sr-only"
              />
              <CreditCard className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">{method}</span>
            </label>
          ))}
        </div>
        {errors.some((e) => e.field === "payment") && (
          <p className="mt-2 text-sm text-red-600">
            At least one payment method is required
          </p>
        )}
      </div>

      {currentUser.role !== "user" && setShowInProvider && (
        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 mb-4">Booking Options</h4>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInProvider ?? false}
              onChange={(e) => setShowInProvider(e.target.checked)}
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              aria-label="Show booking in provider dashboard (optional)"
            />
            <EyeIcon className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-700">
              Show to provider dashboard (optional)
            </span>
          </label>
        </div>
      )}

      <div className="border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Passenger Details</h4>
        <div className="space-y-3">
          {cleanedPassengers.map((passenger) => (
            <div
              key={passenger.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {passenger.first_name?.trim() || "N/A"}{" "}
                    {passenger.last_name?.trim() || ""}
                  </p>
                  <p className="text-sm text-gray-600">
                    {passenger.nationality?.trim() || "N/A"} •{" "}
                    {passenger.gender?.trim() || "N/A"} • Age:{" "}
                    {calculateAge(passenger.date_of_birth)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Room: {passenger.roomType?.trim() || "N/A"} • Hotel:{" "}
                    {passenger.hotel?.trim() || "N/A"}
                  </p>
                  {passenger.additional_services?.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Services: {passenger.additional_services.join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">
                  ${(passenger.price || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  {passenger.additional_services?.length || 0} services
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => {
              console.log(
                "BookingSummary: Back button clicked, moving to step 3"
              );
              onBack();
            }}
            className="flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Passengers
          </button>
          <button
            onClick={downloadCSV}
            disabled={cleanedPassengers.length === 0}
            className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </button>
          <button
            onClick={handleSaveOrder}
            disabled={
              loading ||
              paymentMethod.length === 0 ||
              cleanedPassengers.length === 0 ||
              hasValidationErrors
            }
            className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-1"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Confirm Booking
              </>
            )}
          </button>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="space-y-1 text-xs">
                <li>
                  • Please ensure all passenger information is accurate before
                  confirming
                </li>
                <li>
                  • All information should be entered in English or Latin
                  characters only
                </li>
                <li>
                  • Passport must be valid for at least 6 months from departure
                  date
                </li>
                <li>• Changes after confirmation may incur additional fees</li>
                <li>
                  • You will receive a confirmation email once booking is
                  processed
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
