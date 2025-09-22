import React, { useState } from "react";
import type { Passenger, Tour } from "../types/type";

interface PassengerFormFieldsProps {
  passenger: Passenger;
  index: number;
  selectedTourData?: Tour;
  errors: any[];
  updatePassenger: (index: number, field: keyof Passenger, value: any) => void;
  expanded: boolean;
  fieldLoading: Record<string, boolean>;
  nationalities: string[];
  roomTypes: string[];
  hotels: string[];
}

export const PassengerFormFields: React.FC<PassengerFormFieldsProps> = ({
  passenger,
  index,
  selectedTourData,
  errors,
  updatePassenger,
  expanded,
  fieldLoading,
  nationalities,
  roomTypes,
  hotels
}) => {
  const [localRoomType, setLocalRoomType] = useState(passenger.roomType || "");
  
  const getFieldError = (field: string) => {
    return errors.find((error: any) => error.field === `passenger_${index}_${field}`);
  };

  const handleRoomTypeChange = (roomType: string) => {
    setLocalRoomType(roomType);
    updatePassenger(index, "roomType", roomType);
  };

  const getPassportExpiryColor = (expiryDate: string | null): string => {
    if (!expiryDate) return "border-gray-300";
    const expiry = new Date(expiryDate);
    const today = new Date();
    const monthsRemaining = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());
    if (monthsRemaining <= 0) return "border-red-500 bg-red-50";
    if (monthsRemaining <= 1) return "border-red-400 bg-red-50";
    if (monthsRemaining <= 3) return "border-orange-400 bg-orange-50";
    if (monthsRemaining <= 7) return "border-yellow-400 bg-yellow-50";
    return "border-green-400 bg-green-50";
  };

  if (!expanded) return null;

  return (
    <div className="space-y-4">
      {/* Personal Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Serial No</label>
          <input
            type="text"
            value={passenger.serial_no || ""}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            type="text"
            value={passenger.first_name || ""}
            onChange={(e) => updatePassenger(index, "first_name", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('first_name') ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="First name"
          />
          {getFieldError('first_name') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('first_name').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input
            type="text"
            value={passenger.last_name || ""}
            onChange={(e) => updatePassenger(index, "last_name", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('last_name') ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Last name"
          />
          {getFieldError('last_name') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('last_name').message}</p>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={passenger.email || ""}
            onChange={(e) => updatePassenger(index, "email", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('email') ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="example@email.com"
          />
          {getFieldError('email') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('email').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            value={passenger.phone || ""}
            onChange={(e) => updatePassenger(index, "phone", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('phone') ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="+976..."
          />
          {getFieldError('phone') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('phone').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
          <input
            type="tel"
            value={passenger.emergency_phone || ""}
            onChange={(e) => updatePassenger(index, "emergency_phone", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Emergency contact"
          />
        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
          <input
            type="date"
            value={passenger.date_of_birth || ""}
            onChange={(e) => updatePassenger(index, "date_of_birth", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('date_of_birth') ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number"
            // ✅ FIXED: Convert number | null to string for input value
            value={passenger.age != null ? passenger.age.toString() : ""}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
          <select
            // ✅ FIXED: Convert string | null to string for select value
            value={passenger.gender || ""}
            onChange={(e) => updatePassenger(index, "gender", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('gender') ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {getFieldError('gender') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('gender').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nationality *</label>
          <select
            // ✅ FIXED: Convert string | null to string for select value
            value={passenger.nationality || ""}
            onChange={(e) => updatePassenger(index, "nationality", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('nationality') ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            {nationalities.map((nationality) => (
              <option key={nationality} value={nationality}>
                {nationality}
              </option>
            ))}
          </select>
          {getFieldError('nationality') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('nationality').message}</p>
          )}
        </div>
      </div>

      {/* Passport Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number *</label>
          <input
            type="text"
            value={passenger.passport_number || ""}
            onChange={(e) => updatePassenger(index, "passport_number", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('passport_number') ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Passport number"
          />
          {getFieldError('passport_number') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('passport_number').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Passport Expiry *</label>
          <input
            type="date"
            value={passenger.passport_expiry || ""}
            onChange={(e) => updatePassenger(index, "passport_expiry", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('passport_expiry') ? 'border-red-500' : getPassportExpiryColor(passenger.passport_expiry)
            }`}
          />
          {getFieldError('passport_expiry') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('passport_expiry').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Passport Upload</label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => e.target.files && updatePassenger(index, "passport_upload", e.target.files[0])}
              className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {fieldLoading[`${passenger.id}-passport_upload`] && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
          {passenger.passport_upload && typeof passenger.passport_upload === 'string' && (
            <p className="mt-1 text-sm text-green-600">✓ Uploaded</p>
          )}
        </div>
      </div>

      {/* Accommodation Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
          <select
            value={localRoomType}
            onChange={(e) => handleRoomTypeChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('roomType') ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select Room Type</option>
            {roomTypes.map((roomType) => (
              <option key={roomType} value={roomType}>
                {roomType}
              </option>
            ))}
          </select>
          {getFieldError('roomType') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('roomType').message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room Allocation</label>
          <input
            type="text"
            value={passenger.room_allocation || ""}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            placeholder="Auto-assigned"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hotel *</label>
          <select
            // ✅ FIXED: Convert string | null to string for select value
            value={passenger.hotel || ""}
            onChange={(e) => updatePassenger(index, "hotel", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('hotel') ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select Hotel</option>
            {hotels.map((hotel) => (
              <option key={hotel} value={hotel}>
                {hotel}
              </option>
            ))}
          </select>
          {getFieldError('hotel') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('hotel').message}</p>
          )}
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Services</label>
          {selectedTourData?.services && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedTourData.services.map((service) => (
                <label key={service.name} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    // ✅ FIXED: Ensure additional_services is always an array
                    checked={(passenger.additional_services || []).includes(service.name)}
                    onChange={(e) => {
                      const currentServices = passenger.additional_services || [];
                      const services = e.target.checked
                        ? [...currentServices, service.name]
                        : currentServices.filter(s => s !== service.name);
                      updatePassenger(index, "additional_services", services);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{service.name} (+${service.price})</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Allergies/Medical</label>
          <textarea
            value={passenger.allergy || ""}
            onChange={(e) => updatePassenger(index, "allergy", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Any allergies or medical conditions?"
          />
        </div>
      </div>

      {/* Price Display */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Price:</span>
          <span className="text-lg font-bold text-gray-900">
            ${passenger.price != null ? passenger.price.toLocaleString() : '0'}
          </span>
        </div>
      </div>
    </div>
  );
};