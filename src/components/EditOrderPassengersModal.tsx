// EditOrderPassengersModal.tsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { X, Save } from "lucide-react";

const COLOR_PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
  "#6366f1",
  "#14b8a6",
  "#d946ef",
];

const COUNTRY_OPTIONS = [
  { value: "Mongolia", label: "🇲🇳 Mongolia" },
  { value: "United States", label: "🇺🇸 United States" },
  { value: "China", label: "🇨🇳 China" },
  { value: "Japan", label: "🇯🇵 Japan" },
  { value: "South Korea", label: "🇰🇷 South Korea" },
  { value: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { value: "Germany", label: "🇩🇪 Germany" },
  { value: "France", label: "🇫🇷 France" },
  { value: "Italy", label: "🇮🇹 Italy" },
  { value: "Spain", label: "🇪🇸 Spain" },
  { value: "Canada", label: "🇨🇦 Canada" },
  { value: "Australia", label: "🇦🇺 Australia" },
  { value: "India", label: "🇮🇳 India" },
  { value: "Russia", label: "🇷🇺 Russia" },
  { value: "Brazil", label: "🇧🇷 Brazil" },
  { value: "Mexico", label: "🇲🇽 Mexico" },
  { value: "South Africa", label: "🇿🇦 South Africa" },
  { value: "Egypt", label: "🇪🇬 Egypt" },
  { value: "Turkey", label: "🇹🇷 Turkey" },
  { value: "Thailand", label: "🇹🇭 Thailand" },
  { value: "Vietnam", label: "🇻🇳 Vietnam" },
  { value: "Philippines", label: "🇵🇭 Philippines" },
  { value: "Indonesia", label: "🇮🇩 Indonesia" },
  { value: "Malaysia", label: "🇲🇾 Malaysia" },
  { value: "Singapore", label: "🇸🇬 Singapore" },
  { value: "New Zealand", label: "🇳🇿 New Zealand" },
  { value: "Sweden", label: "🇸🇪 Sweden" },
  { value: "Norway", label: "🇳🇴 Norway" },
  { value: "Denmark", label: "🇩🇰 Denmark" },
  { value: "Netherlands", label: "🇳🇱 Netherlands" },
  { value: "Belgium", label: "🇧🇪 Belgium" },
  { value: "Switzerland", label: "🇨🇭 Switzerland" },
  { value: "Austria", label: "🇦🇹 Austria" },
  { value: "Poland", label: "🇵🇱 Poland" },
  { value: "Czech Republic", label: "🇨🇿 Czech Republic" },
  { value: "Hungary", label: "🇭🇺 Hungary" },
  { value: "Romania", label: "🇷🇴 Romania" },
  { value: "Bulgaria", label: "🇧🇬 Bulgaria" },
  { value: "Greece", label: "🇬🇷 Greece" },
  { value: "Portugal", label: "🇵🇹 Portugal" },
  { value: "Ireland", label: "🇮🇪 Ireland" },
  { value: "Finland", label: "🇫🇮 Finland" },
  { value: "Iceland", label: "🇮🇸 Iceland" },
  { value: "Argentina", label: "🇦🇷 Argentina" },
  { value: "Chile", label: "🇨🇱 Chile" },
  { value: "Colombia", label: "🇨🇴 Colombia" },
  { value: "Peru", label: "🇵🇪 Peru" },
  { value: "Venezuela", label: "🇻🇪 Venezuela" },
  { value: "Nigeria", label: "🇳🇬 Nigeria" },
  { value: "Kenya", label: "🇰🇪 Kenya" },
  { value: "Ethiopia", label: "🇪🇹 Ethiopia" },
  { value: "Ghana", label: "🇬🇭 Ghana" },
  { value: "Morocco", label: "🇲🇦 Morocco" },
  { value: "Algeria", label: "🇩🇿 Algeria" },
  { value: "Tunisia", label: "🇹🇳 Tunisia" },
  { value: "Israel", label: "🇮🇱 Israel" },
  { value: "Saudi Arabia", label: "🇸🇦 Saudi Arabia" },
  { value: "United Arab Emirates", label: "🇦🇪 United Arab Emirates" },
  { value: "Qatar", label: "🇶🇦 Qatar" },
  { value: "Kuwait", label: "🇰🇼 Kuwait" },
  { value: "Oman", label: "🇴🇲 Oman" },
  { value: "Jordan", label: "🇯🇴 Jordan" },
  { value: "Lebanon", label: "🇱🇧 Lebanon" },
  { value: "Pakistan", label: "🇵🇰 Pakistan" },
  { value: "Bangladesh", label: "🇧🇩 Bangladesh" },
  { value: "Sri Lanka", label: "🇱🇰 Sri Lanka" },
  { value: "Nepal", label: "🇳🇵 Nepal" },
  { value: "Bhutan", label: "🇧🇹 Bhutan" },
  { value: "Myanmar", label: "🇲🇲 Myanmar" },
  { value: "Cambodia", label: "🇰🇭 Cambodia" },
  { value: "Laos", label: "🇱🇦 Laos" },
  { value: "Taiwan", label: "🇹🇼 Taiwan" },
  { value: "Hong Kong", label: "🇭🇰 Hong Kong" },
  { value: "Macau", label: "🇲🇴 Macau" },
];

interface EditablePassenger {
  id: string;
  order_id?: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  passport_number: string | null;
  passport_expire: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  hotel: string | null;
  roomType: string | null;
  pax_type: "Adult" | "Child" | "Infant" | null;
  itinerary_status: string | null;
  allergy: string | null;
  notes: string | null;
  has_baby_bed: boolean;
  group_color: string | null;
  main_passenger_id: string | null;
  is_related_to_next: boolean;
  serial_no: string | null;
  room_allocation: string | null;
  emergency_phone: string | null;
  travel_group_name: string | null;
  is_traveling_with_others: boolean;
}

interface EditOrderPassengersModalProps {
  orderId: string;
  passengers: EditablePassenger[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditOrderPassengersModal({
  orderId,
  passengers: initialPassengers,
  isOpen,
  onClose,
  onSaved,
}: EditOrderPassengersModalProps) {
  const [passengers, setPassengers] =
    useState<EditablePassenger[]>(initialPassengers);
  const [saving, setSaving] = useState(false);
  const [sharedGroupColor, setSharedGroupColor] = useState<string | null>(
    initialPassengers[0]?.group_color || null
  );

  if (!isOpen) return null;

  const updatePassenger = (
    id: string,
    field: keyof EditablePassenger,
    value: any
  ) => {
    setPassengers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleSharedColorChange = (color: string | null) => {
    setSharedGroupColor(color);
    setPassengers((prev) => prev.map((p) => ({ ...p, group_color: color })));
  };

  const hasEmptyRequiredField = (pax: EditablePassenger) => {
    return (
      !pax.first_name?.trim() ||
      !pax.last_name?.trim() ||
      !pax.email?.trim() ||
      !pax.phone?.trim() ||
      !pax.passport_number?.trim() ||
      !pax.passport_expire ||
      !pax.date_of_birth ||
      !pax.gender ||
      !pax.nationality ||
      !pax.hotel?.trim()
    );
  };

  const handleSave = async () => {
    if (passengers.some(hasEmptyRequiredField)) {
      alert("Please fill in all required fields (marked with red border)");
      return;
    }

    setSaving(true);
    try {
      const updates = passengers.map((p) => ({
        id: p.id,
        first_name: p.first_name?.trim() || null,
        last_name: p.last_name?.trim() || null,
        email: p.email?.trim() || null,
        phone: p.phone?.trim() || null,
        passport_number: p.passport_number?.trim() || null,
        passport_expire: p.passport_expire || null,
        date_of_birth: p.date_of_birth || null,
        gender: p.gender || null,
        nationality: p.nationality || "Mongolia",
        hotel: p.hotel?.trim() || null,
        roomType: p.roomType?.trim() || null,
        pax_type: p.pax_type || null,
        itinerary_status: p.itinerary_status || "No itinerary",
        allergy: p.allergy?.trim() || null,
        notes: p.notes?.trim() || null,
        has_baby_bed: p.has_baby_bed,
        group_color: p.group_color || null,
        main_passenger_id: p.main_passenger_id || null,
        is_related_to_next: p.is_related_to_next,
        serial_no: p.serial_no || null,
        room_allocation: p.room_allocation?.trim() || null,
        emergency_phone: p.emergency_phone?.trim() || null,
        travel_group_name: p.travel_group_name?.trim() || null,
        is_traveling_with_others: p.is_traveling_with_others,
      }));

      const { error } = await supabase
        .from("passengers")
        .upsert(updates, { onConflict: "id" });

      if (error) throw error;

      onSaved();
      onClose();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Order #{orderId} • {passengers.length} Passenger
            {passengers.length > 1 ? "s" : ""}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Shared Group Color */}
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
          <label className="block text-lg font-bold text-gray-800 mb-4">
            Group Color (Applies to all passengers)
          </label>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleSharedColorChange(null)}
              className={`w-16 h-16 rounded-xl border-4 transition-all shadow-md ${
                sharedGroupColor === null
                  ? "border-blue-600 ring-4 ring-blue-200"
                  : "border-gray-300"
              } bg-gray-200 flex items-center justify-center`}
            >
              <span className="text-4xl text-gray-500">×</span>
            </button>
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => handleSharedColorChange(color)}
                style={{ backgroundColor: color }}
                className={`w-16 h-16 rounded-xl border-4 transition-all shadow-lg hover:scale-110 ${
                  sharedGroupColor === color
                    ? "border-blue-600 ring-4 ring-blue-200 scale-110"
                    : "border-white"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-10">
          {passengers.map((pax, idx) => (
            <div
              key={pax.id}
              className="border-2 border-gray-200 rounded-2xl p-8 bg-gradient-to-br from-gray-50 to-white"
            >
              <h3 className="text-xl font-bold text-indigo-700 mb-6">
                Passenger {idx + 1} {idx === 0 && "(Main Passenger)"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First & Last Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={pax.first_name || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "first_name",
                        e.target.value || null
                      )
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.first_name?.trim()
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                    placeholder="Given name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={pax.last_name || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "last_name",
                        e.target.value || null
                      )
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.last_name?.trim()
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                    placeholder="Surname"
                  />
                </div>

                {/* Email & Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={pax.email || ""}
                    onChange={(e) =>
                      updatePassenger(pax.id, "email", e.target.value || null)
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.email?.trim()
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                    placeholder="example@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={pax.phone || ""}
                    onChange={(e) =>
                      updatePassenger(pax.id, "phone", e.target.value || null)
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.phone?.trim()
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                    placeholder="+976 ..."
                  />
                </div>

                {/* Passport */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Passport Number *
                  </label>
                  <input
                    type="text"
                    value={pax.passport_number || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "passport_number",
                        e.target.value || null
                      )
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.passport_number?.trim()
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Passport Expiry *
                  </label>
                  <input
                    type="date"
                    value={pax.passport_expire || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "passport_expire",
                        e.target.value || null
                      )
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.passport_expire
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                {/* DOB & Nationality */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={pax.date_of_birth || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "date_of_birth",
                        e.target.value || null
                      )
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.date_of_birth
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nationality *
                  </label>
                  <select
                    value={pax.nationality || "Mongolia"}
                    onChange={(e) =>
                      updatePassenger(pax.id, "nationality", e.target.value)
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.nationality
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gender & Pax Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gender *
                  </label>
                  <select
                    value={pax.gender || ""}
                    onChange={(e) =>
                      updatePassenger(pax.id, "gender", e.target.value || null)
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.gender
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pax Type
                  </label>
                  <select
                    value={pax.pax_type || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "pax_type",
                        e.target.value || null
                      )
                    }
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Type</option>
                    <option value="Adult">Adult</option>
                    <option value="Child">Child</option>
                    <option value="Infant">Infant</option>
                  </select>
                </div>

                {/* Hotel & Room Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hotel *
                  </label>
                  <input
                    type="text"
                    value={pax.hotel || ""}
                    onChange={(e) =>
                      updatePassenger(pax.id, "hotel", e.target.value || null)
                    }
                    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                      !pax.hotel?.trim()
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 focus:border-blue-500"
                    } focus:ring-2 focus:ring-blue-500`}
                    placeholder="e.g. Shangri-La"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Room Type
                  </label>
                  <input
                    type="text"
                    value={pax.roomType || ""}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "roomType",
                        e.target.value || null
                      )
                    }
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Twin, Single, Deluxe..."
                  />
                </div>

                {/* Itinerary Status */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Itinerary Status
                  </label>
                  <select
                    value={pax.itinerary_status || "No itinerary"}
                    onChange={(e) =>
                      updatePassenger(
                        pax.id,
                        "itinerary_status",
                        e.target.value || "No itinerary"
                      )
                    }
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="With itinerary">With itinerary</option>
                    <option value="No itinerary">No itinerary</option>
                    <option value="Hotel + itinerary">Hotel + itinerary</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Roundway ticket">Roundway ticket</option>
                  </select>
                </div>

                {/* Allergies & Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Allergies
                  </label>
                  <input
                    type="text"
                    value={pax.allergy || ""}
                    onChange={(e) =>
                      updatePassenger(pax.id, "allergy", e.target.value || null)
                    }
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Nuts, Dairy"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={pax.notes || ""}
                    onChange={(e) =>
                      updatePassenger(pax.id, "notes", e.target.value || null)
                    }
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Any special requests or notes..."
                  />
                </div>

                {/* Baby Bed */}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pax.has_baby_bed || false}
                      onChange={(e) =>
                        updatePassenger(
                          pax.id,
                          "has_baby_bed",
                          e.target.checked
                        )
                      }
                      className="w-6 h-6 text-pink-600 rounded focus:ring-pink-500"
                    />
                    <span className="text-lg font-medium text-gray-800">
                      Request Baby Bed
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-4 p-6 border-t bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-300 hover:bg-gray-400 rounded-xl font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || passengers.some(hasEmptyRequiredField)}
            className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-3 transition shadow-lg ${
              passengers.some(hasEmptyRequiredField)
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
            }`}
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                {" "}
                <Save className="w-5 h-5" /> Save All Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
