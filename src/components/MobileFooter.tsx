// components/MobileFooter.tsx
import React from "react";
import type { Passenger } from "../types/type";
import { useState } from "react";

interface MobileFooterProps {
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  bookingPassengers: Passenger[];
  totalPrice: number;
  canAdd: boolean;
  maxPassengers: number;
  addPassenger: () => void;
  clearAllPassengers: () => void;
  handleNextStep: () => void;
  newPassengerRef: React.RefObject<HTMLDivElement | null>;
  selectedTour?: string;
  departureDate?: string;}

export const MobileFooter: React.FC<MobileFooterProps> = ({
  selectedTour,
  departureDate,
  bookingPassengers,
  totalPrice,
  canAdd,
  maxPassengers,
  addPassenger,
  clearAllPassengers,
  handleNextStep,
  newPassengerRef,
} : MobileFooterProps) => {
  const [activeStep, setActiveStep] = useState(1);
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-40">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-600">Step {activeStep} of 3</div>
        <div className="text-sm font-medium text-gray-900">
          {bookingPassengers.length > 0 && (
            <span>
              {bookingPassengers.length} passenger{bookingPassengers.length !== 1 ? "s" : ""} • ${totalPrice.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      {activeStep === 2 && (
        <div className="flex gap-2 mb-2">
          <button
            onClick={addPassenger}
            disabled={!canAdd || bookingPassengers.length >= maxPassengers}
            className="flex-1 inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            + Add
          </button>
          {bookingPassengers.length > 0 && (
            <button
              onClick={clearAllPassengers}
              className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          )}
          <button
            onClick={() => newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Bottom
          </button>
        </div>
      )}
      <div className="flex gap-2">
        {activeStep > 1 && (
          <button
            onClick={() => setActiveStep(activeStep - 1)}
            className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        {activeStep < 3 && (
          <button
            onClick={handleNextStep}
            disabled={(activeStep === 1 && (!selectedTour?.trim() || !departureDate?.trim())) || (activeStep === 2 && bookingPassengers.length === 0)}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            {activeStep === 1 ? "Continue to Passengers" : "Review Booking"}
          </button>
        )}
      </div>
    </div>
  );
};