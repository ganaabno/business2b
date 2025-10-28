import React, { useState, useEffect, useMemo, useRef } from "react";
import { parse, isValid, format } from "date-fns";
import type { Passenger, Tour } from "../types/type";
import { supabase } from "../supabaseClient";

interface PassengerFormFieldsProps {
  passenger: Passenger;
  index: number;
  selectedTourData?: Tour;
  passengers: Passenger[] | undefined;
  errors: any[];
  updatePassenger: (
    index: number,
    field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
    value: any
  ) => void;
  expanded: boolean;
  fieldLoading: Record<string, boolean>;
  nationalities: string[];
  roomTypes: string[];
  hotels: string[];
  setNotification: (notification: { type: string; message: string }) => void;
  departureDate: string;
}

export const PassengerFormFields: React.FC<PassengerFormFieldsProps> = ({
  passenger,
  index,
  selectedTourData,
  passengers = [],
  errors,
  updatePassenger,
  expanded,
  fieldLoading,
  nationalities,
  roomTypes,
  hotels,
  setNotification,
  departureDate = "",
}) => {
  const [localRoomType, setLocalRoomType] = useState(
    passenger.roomType || "Single"
  );
  const [uploadLoading, setUploadLoading] = useState(false);
  const previousRoom = useRef<string>("");

  // Memoize deps to avoid unnecessary re-renders
  const passengerDeps = useMemo(
    () => ({
      main_passenger_id: passenger.main_passenger_id,
      has_sub_passengers: passenger.has_sub_passengers,
      sub_passenger_count: passenger.sub_passenger_count,
    }),
    [
      passenger.main_passenger_id,
      passenger.has_sub_passengers,
      passenger.sub_passenger_count,
    ]
  );

  // Log room changes
  useEffect(() => {
    if (
      previousRoom.current &&
      previousRoom.current !== passenger.room_allocation
    ) {
      console.log(
        `P${passenger.serial_no}: ${previousRoom.current} → ${passenger.room_allocation}`
      );
    }
    previousRoom.current = passenger.room_allocation;
  }, [passenger.room_allocation, passenger.serial_no]);

  const getFieldError = (field: string) => {
    return errors.find(
      (error: any) =>
        error.field === `passenger_${passenger.serial_no}_${field}`
    );
  };

  const handleRoomTypeChange = (roomType: string) => {
    setLocalRoomType(roomType);
    updatePassenger(index, "roomType", roomType);
  };

  const getPassportExpiryColor = (expiryDate: string | null): string => {
    if (!expiryDate) return "border-gray-300";
    const expiry = new Date(expiryDate);
    const today = new Date();
    const monthsRemaining =
      (expiry.getFullYear() - today.getFullYear()) * 12 +
      (expiry.getMonth() - today.getMonth());
    if (monthsRemaining <= 0) return "border-red-500 bg-red-50";
    if (monthsRemaining <= 1) return "border-red-400 bg-red-50";
    if (monthsRemaining <= 3) return "border-orange-400 bg-orange-50";
    if (monthsRemaining <= 7) return "border-yellow-400 bg-yellow-50";
    return "border-green-400 bg-green-50";
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const formats = ["yyyy-MM-dd", "d-MM-yy", "dd-MM-yy", "M-d-yy", "MM-dd-yy"];
    for (const fmt of formats) {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
    }
    return dateStr;
  };

  const handlePassportUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${passenger.id}/passport.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("passport")
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("passport")
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        updatePassenger(index, "passport_upload", urlData.publicUrl);
        setNotification({ type: "success", message: "Passport uploaded!" });
      } else {
        setNotification({ type: "error", message: "Failed to get URL" });
      }
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error.message.includes("security")
          ? "Permission denied"
          : `Upload failed: ${error.message}`,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleServiceChange = (serviceName: string, checked: boolean) => {
    const current = passenger.additional_services || [];
    const updated = checked
      ? [...current, serviceName]
      : current.filter((s) => s !== serviceName);
    updatePassenger(index, "additional_services", updated);
  };

  if (!expanded) return null;

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Sub-Passenger Controls — Only for Main */}
      {!passenger.main_passenger_id && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={passenger.has_sub_passengers || false}
              onChange={(e) =>
                updatePassenger(index, "hasSubPassengers", e.target.checked)
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700">
              Add Sub-Passengers
            </label>
          </div>
          {passenger.has_sub_passengers && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Sub-Passengers
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={passenger.sub_passenger_count || ""}
                onChange={(e) =>
                  updatePassenger(index, "subPassengerCount", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}

      {/* PAX TYPE — REPLACES "FAX" */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pax Type *
          </label>
          <select
            value={passenger.pax_type || "Adult"}
            onChange={(e) => updatePassenger(index, "pax_type", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("pax_type") ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="Adult">Adult</option>
            <option value="Child">Child</option>
          </select>
          {getFieldError("pax_type") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("pax_type").message}
            </p>
          )}
        </div>
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Serial No
          </label>
          <input
            type="text"
            value={passenger.serial_no || ""}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={passenger.first_name || ""}
            onChange={(e) =>
              updatePassenger(index, "first_name", e.target.value)
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("first_name") ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="First name"
          />
          {getFieldError("first_name") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("first_name").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={passenger.last_name || ""}
            onChange={(e) =>
              updatePassenger(index, "last_name", e.target.value)
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("last_name") ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Last name"
          />
          {getFieldError("last_name") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("last_name").message}
            </p>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            value={passenger.email || ""}
            onChange={(e) => updatePassenger(index, "email", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("email") ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="example@email.com"
          />
          {getFieldError("email") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("email").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone *
          </label>
          <input
            type="tel"
            value={passenger.phone || ""}
            onChange={(e) => updatePassenger(index, "phone", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("phone") ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="+976..."
          />
          {getFieldError("phone") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("phone").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Emergency Phone
          </label>
          <input
            type="tel"
            value={passenger.emergency_phone || ""}
            onChange={(e) =>
              updatePassenger(index, "emergency_phone", e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Emergency contact"
          />
        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth *
          </label>
          <input
            type="date"
            value={formatDate(passenger.date_of_birth)}
            onChange={(e) =>
              updatePassenger(index, "date_of_birth", e.target.value)
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("date_of_birth")
                ? "border-red-500"
                : "border-gray-300"
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Age
          </label>
          <input
            type="number"
            value={passenger.age != null ? passenger.age.toString() : ""}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gender *
          </label>
          <select
            value={passenger.gender || ""}
            onChange={(e) => updatePassenger(index, "gender", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("gender") ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {getFieldError("gender") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("gender").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nationality *
          </label>
          <select
            value={passenger.nationality || ""}
            onChange={(e) =>
              updatePassenger(index, "nationality", e.target.value)
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("nationality")
                ? "border-red-500"
                : "border-gray-300"
            }`}
          >
            {nationalities.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {getFieldError("nationality") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("nationality").message}
            </p>
          )}
        </div>
      </div>

      {/* Passport */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Passport Number *
          </label>
          <input
            type="text"
            value={passenger.passport_number || ""}
            onChange={(e) =>
              updatePassenger(index, "passport_number", e.target.value)
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("passport_number")
                ? "border-red-500"
                : "border-gray-300"
            }`}
            placeholder="Passport number"
          />
          {getFieldError("passport_number") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("passport_number").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Passport Expiry *
          </label>
          <input
            type="date"
            value={formatDate(passenger.passport_expire)}
            onChange={(e) =>
              updatePassenger(index, "passport_expire", e.target.value)
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("passport_expire")
                ? "border-red-500"
                : getPassportExpiryColor(passenger.passport_expire)
            }`}
          />
          {getFieldError("passport_expire") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("passport_expire").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Passport Upload
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handlePassportUpload}
              className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {(fieldLoading[`${passenger.id}-passport_upload`] ||
              uploadLoading) && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          {passenger.passport_upload &&
            typeof passenger.passport_upload === "string" && (
              <p className="mt-1 text-sm text-green-600">Uploaded</p>
            )}
        </div>
      </div>

      {/* Accommodation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Type
          </label>
          <select
            value={localRoomType}
            onChange={(e) => handleRoomTypeChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("roomType") ? "border-red-500" : "border-gray-300"
            }`}
            disabled={!!passenger.main_passenger_id}
          >
            <option value="Single">Single</option>
            <option value="Double">Double</option>
            {roomTypes.map((rt) => (
              <option key={rt} value={rt}>
                {rt}
              </option>
            ))}
          </select>
          {getFieldError("roomType") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("roomType").message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Allocation
          </label>
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
              {passenger.room_allocation || "—"}
              {passenger.room_allocation && (
                <span className="ml-1 opacity-70">
                  (
                  {
                    passengers.filter(
                      (p) => p.room_allocation === passenger.room_allocation
                    ).length
                  }{" "}
                  pax)
                </span>
              )}
            </span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hotel *
          </label>
          <select
            value={passenger.hotel || ""}
            onChange={(e) => updatePassenger(index, "hotel", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              getFieldError("hotel") ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Select Hotel</option>
            {hotels.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          {getFieldError("hotel") && (
            <p className="mt-1 text-sm text-red-600">
              {getFieldError("hotel").message}
            </p>
          )}
        </div>
      </div>

      {/* Services & Allergies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Services
          </label>
          {selectedTourData?.services && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedTourData.services.map((s) => (
                <label key={s.name} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={(passenger.additional_services || []).includes(
                      s.name
                    )}
                    onChange={(e) =>
                      handleServiceChange(s.name, e.target.checked)
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {s.name} (${s.price})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Allergies
          </label>
          <input
            type="text"
            value={passenger.allergy || ""}
            onChange={(e) => updatePassenger(index, "allergy", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter any allergies"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={passenger.notes || ""}
          onChange={(e) => updatePassenger(index, "notes", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Additional notes"
          rows={4}
        />
      </div>
    </div>
  );
};
