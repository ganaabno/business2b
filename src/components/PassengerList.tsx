// components/PassengerList.tsx
import React from "react";
import { PassengerFormFields } from "../addPassengerComponents/PassengerFormFields";
import type { Passenger, Tour, ValidationError } from "../types/type";

interface PassengerListProps {
  passengers: Passenger[];
  selectedTourData?: Tour;
  errors: ValidationError[];
  updatePassenger: (index: number, field: keyof Passenger, value: any) => void;
  removePassenger: (index: number) => void;
  expandedPassengerId: string | null;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  fieldLoading: Record<string, boolean>;
  newPassengerRef: React.RefObject<HTMLDivElement | null>;
  nationalities: string[];
  roomTypes: string[];
  hotels: string[];
}

export const PassengerList: React.FC<PassengerListProps> = ({
  passengers,
  selectedTourData,
  errors,
  updatePassenger,
  removePassenger,
  expandedPassengerId,
  setExpandedPassengerId,
  fieldLoading,
  newPassengerRef,
  nationalities,
  roomTypes,
  hotels,
}) => {
  return (
    <div className="space-y-6">
      {passengers.map((passenger, index) => (
        <div
          key={passenger.id}
          ref={index === passengers.length - 1 ? newPassengerRef : null}
          className={`border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 ${expandedPassengerId === passenger.id ? "ring-2 ring-blue-500 shadow-lg" : "hover:shadow-md"}`}
        >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                  <span className="text-sm font-semibold text-blue-800">{passenger.serial_no}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {passenger.first_name} {passenger.last_name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {passenger.email || "No email"} • {passenger.nationality || "Mongolia"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    passenger.roomType === "Single" || passenger.roomType === "King"
                      ? "bg-green-100 text-green-800"
                      : passenger.roomType === "Double" || passenger.roomType === "Twin"
                        ? "bg-blue-100 text-blue-800"
                        : passenger.roomType === "Family"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {passenger.roomType || "No room type"}
                </span>
                <button
                  onClick={() => setExpandedPassengerId(expandedPassengerId === passenger.id ? null : passenger.id)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className={`w-5 h-5 transform ${expandedPassengerId === passenger.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => removePassenger(index)}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          {expandedPassengerId === passenger.id && (
            <div className="p-6 bg-white">
              <PassengerFormFields
                passenger={passenger}
                index={index}
                selectedTourData={selectedTourData}
                errors={errors}
                updatePassenger={updatePassenger}
                expanded={true}
                fieldLoading={fieldLoading}
                nationalities={nationalities}
                roomTypes={roomTypes}
                hotels={hotels}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};