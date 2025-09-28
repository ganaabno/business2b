import React from "react";
import type { Passenger } from "../types/type";

interface BookingActionsProps {
  bookingPassengers: Passenger[];
  selectedTour: string;
  totalPrice: number;
  addPassenger: () => void;
  clearAllPassengers: () => void;
  resetBookingForm: () => void;
  handleDownloadCSV: () => void;
  handleDownloadTemplate: () => void; // ✅ add this line
  handleUploadCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  newPassengerRef: React.RefObject<HTMLDivElement | null>;
  maxPassengers: number;
  canAddPassenger: boolean;
}

export const BookingActions: React.FC<BookingActionsProps> = ({
  bookingPassengers,
  selectedTour,
  totalPrice,
  addPassenger,
  clearAllPassengers,
  resetBookingForm,
  handleDownloadCSV,
  handleUploadCSV,
  newPassengerRef,
  maxPassengers,
  canAddPassenger
}) => {
  return (
    <div className="flex flex-wrap gap-3 justify-between">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={addPassenger}
          disabled={!canAddPassenger || bookingPassengers.length >= maxPassengers}
          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Passenger
        </button>
        <button
          onClick={clearAllPassengers}
          disabled={bookingPassengers.length === 0}
          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear All
        </button>
        <button
          onClick={() => newPassengerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          disabled={bookingPassengers.length === 0}
          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Jump to Bottom
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownloadCSV}
          disabled={bookingPassengers.length === 0}
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Template
        </button>
        <label className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleUploadCSV}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
};