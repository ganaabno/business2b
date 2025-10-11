import type { Dispatch, SetStateAction } from "react";
import type { Tour, ValidationError } from "../../types/type";
import TourSelectionUser from "../../Pages/userInterface/TourSelectionUser";

interface TourSelectionStepProps {
  tours: Tour[];
  selectedTour: string;
  setSelectedTour: Dispatch<SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: Dispatch<SetStateAction<string>>;
  errors: ValidationError[];
  setActiveStep: Dispatch<SetStateAction<number>>;
  userRole: string;
  showAvailableSeats: boolean;
}

export default function TourSelectionStep({
  tours,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  errors,
  setActiveStep,
  userRole,
  showAvailableSeats,
}: TourSelectionStepProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Your Booking</h3>
        <p className="text-sm text-gray-600">Select your tour, date, and add passengers to get started</p>
      </div>
      <TourSelectionUser
        tours={tours}
        selectedTour={selectedTour}
        setSelectedTour={setSelectedTour}
        departureDate={departureDate}
        setDepartureDate={setDepartureDate}
        errors={errors}
        setActiveStep={setActiveStep}
        userRole={userRole}
        showAvailableSeats={showAvailableSeats}
      />
    </div>
  );
}