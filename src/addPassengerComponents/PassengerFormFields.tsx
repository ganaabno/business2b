import React, { useState, useMemo, memo } from "react";
import { parse, isValid, format } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import type { Passenger, Tour } from "../types/type";
import { supabase } from "../supabaseClient";
import { calculateAge } from "../utils/tourUtils";

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

export const PassengerFormFields: React.FC<PassengerFormFieldsProps> = memo(
  ({
    passenger,
    index,
    selectedTourData,
    errors,
    updatePassenger,
    expanded,
    fieldLoading,
    nationalities,
    roomTypes,
    hotels,
    setNotification,
  }) => {
    const [localRoomType, setLocalRoomType] = useState(
      passenger.roomType || "Select a room"
    );
    const [uploadLoading, setUploadLoading] = useState(false);

    // Debounce frequent updates (text inputs)
    const debouncedUpdate = useDebouncedCallback(
      (
        field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
        value: any
      ) => {
        updatePassenger(index, field, value);
      },
    );

    // Immediate updates for checkboxes/selects (low frequency)
    const immediateUpdate = (
      field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
      value: any
    ) => {
      updatePassenger(index, field, value);
    };

    // Memoized formatted dates
    const formattedDob = useMemo(
      () => formatDate(passenger.date_of_birth),
      [passenger.date_of_birth]
    );
    const formattedExpiry = useMemo(
      () => formatDate(passenger.passport_expire),
      [passenger.passport_expire]
    );

    // Precompute errors for this passenger only
    const passengerErrors = useMemo(() => {
      const prefix = `passenger_${passenger.serial_no}_`;
      return errors.reduce((acc, err) => {
        if (err.field?.startsWith(prefix)) {
          acc[err.field.replace(prefix, "")] = err;
        }
        return acc;
      }, {} as Record<string, any>);
    }, [errors, passenger.serial_no]);

    const getError = (field: string) => passengerErrors[field];

    // Calculate age directly (cheap operation)
    const age = passenger.date_of_birth
      ? calculateAge(passenger.date_of_birth)
      : null;

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

    function formatDate(dateStr: string | null | undefined): string {
      if (!dateStr) return "";
      const formats = [
        "yyyy-MM-dd",
        "d-MM-yy",
        "dd-MM-yy",
        "M-d-yy",
        "MM-dd-yy",
        "dd/MM/yyyy",
      ];
      for (const fmt of formats) {
        const parsed = parse(dateStr, fmt, new Date());
        if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
      }
      return "";
    }

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
          immediateUpdate("passport_upload", urlData.publicUrl);
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
      immediateUpdate("additional_services", updated);
    };

    const handleRoomTypeChange = (roomType: string) => {
      setLocalRoomType(roomType);
      immediateUpdate("roomType", roomType);
    };

    if (!expanded) return null;

    return (
      <div className="space-y-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        {/* ONLY FOR MAIN PASSENGERS — SUB PASSENGERS SECTION */}
        {!passenger.main_passenger_id && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={passenger.has_sub_passengers || false}
                  onChange={(e) =>
                    immediateUpdate("hasSubPassengers", e.target.checked)
                  }
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-900">
                  Has Sub-Passengers?
                </label>
              </div>

              {passenger.has_sub_passengers && (
                <div className="ml-8 flex justify-between">
                  <label className="block text-sm text-gray-700 mb-1">
                    Number of sub-passengers
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={passenger.sub_passenger_count || ""}
                    onChange={(e) =>
                      immediateUpdate(
                        "subPassengerCount",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-60 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {passenger.sub_passenger_count || 0} sub-passenger(s) will
                    be added
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAX TYPE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pax Type *
            </label>
            <select
              value={passenger.pax_type || ""}
              onChange={(e) => {
                const newType = e.target.value as "Adult" | "Child" | "Infant";
                immediateUpdate("pax_type", newType);
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("pax_type") ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="" disabled>
                Select Pax Type *
              </option>
              <option value="Adult">Adult</option>
              <option value="Child">Child</option>
              <option value="Infant">Infant</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flight & Hotel Status *
            </label>
            <select
              value={passenger.itinerary_status ?? ""}
              onChange={(e) =>
                immediateUpdate("itinerary_status", e.target.value)
              }
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("itinerary_status")
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            >
              <option value="" disabled>
                Select Flight & Hotel Status *
              </option>
              <option value="With itinerary">With itinerary</option>
              <option value="No itinerary">No itinerary</option>
              <option value="Hotel + itinerary">Hotel + itinerary</option>
              <option value="Hotel">Hotel only</option>
              <option value="Roundway ticket">Roundway ticket</option>
            </select>
            <div className="mt-2">
              {passenger.itinerary_status &&
              passenger.itinerary_status !== "No itinerary" ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                  {passenger.itinerary_status}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                  No itinerary
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={passenger.has_baby_bed || false}
                onChange={(e) =>
                  immediateUpdate("has_baby_bed", e.target.checked)
                }
                className="h-7 w-7 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
              />
              <div>
                <span className="text-gray-800 flex items-center gap-2">
                  Baby Bed
                </span>
                {passenger.has_baby_bed && (
                  <p className="mt-1 text-sm text-green-500">
                    Baby bed requested
                  </p>
                )}
              </div>
            </label>
          </div>
        </div>

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
              Surname(Овог) *
            </label>
            <input
              type="text"
              value={passenger.last_name || ""}
              onChange={(e) => debouncedUpdate("last_name", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("last_name") ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Surname"
            />
            {getError("last_name") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("last_name").message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Given Name(Нэр) *
            </label>
            <input
              type="text"
              value={passenger.first_name || ""}
              onChange={(e) => debouncedUpdate("first_name", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("first_name") ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Given name"
            />
            {getError("first_name") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("first_name").message}
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
              onChange={(e) => debouncedUpdate("email", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("email") ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="example@email.com"
            />
            {getError("email") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("email").message}
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
              onChange={(e) => debouncedUpdate("phone", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("phone") ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="+976..."
            />
            {getError("phone") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("phone").message}
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
                debouncedUpdate("emergency_phone", e.target.value)
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
              value={formattedDob}
              onChange={(e) => immediateUpdate("date_of_birth", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("date_of_birth") ? "border-red-500" : "border-gray-300"
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray670 mb-1">
              Age
            </label>
            <input
              type="number"
              value={age != null ? age.toString() : ""}
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
              onChange={(e) => immediateUpdate("gender", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("gender") ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {getError("gender") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("gender").message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nationality *
            </label>
            <select
              value={passenger.nationality || ""}
              onChange={(e) => immediateUpdate("nationality", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("nationality") ? "border-red-500" : "border-gray-300"
              }`}
            >
              {nationalities.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {getError("nationality") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("nationality").message}
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
                debouncedUpdate("passport_number", e.target.value)
              }
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("passport_number")
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
              placeholder="Passport number"
            />
            {getError("passport_number") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("passport_number").message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passport Expiry *
            </label>
            <input
              type="date"
              value={formattedExpiry}
              onChange={(e) =>
                immediateUpdate("passport_expire", e.target.value)
              }
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("passport_expire")
                  ? "border-red-500"
                  : getPassportExpiryColor(passenger.passport_expire)
              }`}
            />
            {getError("passport_expire") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("passport_expire").message}
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
                getError("roomType") ? "border-red-500" : "border-gray-300"
              }`}
              disabled={!!passenger.main_passenger_id}
            >
              <option value="">Select Room Type</option>
              {roomTypes.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
            {getError("roomType") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("roomType").message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Allocation
            </label>
            <div>
              <span className="inline-flex items-center px-14 py-2 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                {passenger.room_allocation || "—"}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hotel *
            </label>
            <select
              value={passenger.hotel || ""}
              onChange={(e) => immediateUpdate("hotel", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                getError("hotel") ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select Hotel</option>
              {hotels.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            {getError("hotel") && (
              <p className="mt-1 text-sm text-red-600">
                {getError("hotel").message}
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
              onChange={(e) => debouncedUpdate("allergy", e.target.value)}
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
            onChange={(e) => debouncedUpdate("notes", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Additional notes"
            rows={4}
          />
        </div>
      </div>
    );
  },
  (prev, next) => {
    // Only re-render if something actually relevant changed
    return (
      prev.passenger === next.passenger &&
      prev.index === next.index &&
      prev.expanded === next.expanded &&
      prev.errors === next.errors &&
      prev.fieldLoading === next.fieldLoading &&
      prev.selectedTourData?.services === next.selectedTourData?.services &&
      prev.nationalities === next.nationalities &&
      prev.roomTypes === next.roomTypes &&
      prev.hotels === next.hotels
    );
  }
);

PassengerFormFields.displayName = "PassengerFormFields";
