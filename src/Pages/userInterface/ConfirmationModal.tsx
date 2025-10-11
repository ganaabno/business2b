import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Tour, Passenger, ValidationError, User as UserType } from "../../types/type";
import { checkSeatLimit } from "../../utils/seatLimitChecks";

interface ConfirmationModalProps {
  showConfirmModal: { action: "clearAll" | "resetForm" | null; message: string } | null;
  setShowConfirmModal: Dispatch<
    SetStateAction<
      | { action: "clearAll" | "resetForm" | null; message: string }
      | null
    >
  >;
  bookingPassengers: Passenger[];
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  setExpandedPassengerId: Dispatch<SetStateAction<string | null>>;
  setSelectedTour: Dispatch<SetStateAction<string>>;
  setDepartureDate: Dispatch<SetStateAction<string>>;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  setActiveStep: Dispatch<SetStateAction<number>>;
  setShowInProvider: Dispatch<SetStateAction<boolean>>;
  setValidationErrors: Dispatch<SetStateAction<ValidationError[]>>;
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  selectedTourData?: Tour;
  departureDate: string;
}

export default function ConfirmationModal({
  showConfirmModal,
  setShowConfirmModal,
  bookingPassengers,
  passengers,
  setPassengers,
  setExpandedPassengerId,
  setSelectedTour,
  setDepartureDate,
  setPaymentMethod,
  setActiveStep,
  setShowInProvider,
  setValidationErrors,
  showNotification,
  currentUser,
  selectedTourData,
  departureDate,
}: ConfirmationModalProps) {
  const handleConfirmAction = useCallback(() => {
    if (showConfirmModal?.action === "clearAll") {
      if (bookingPassengers.length === 0) {
        showNotification("error", "No unsubmitted passengers to clear");
        setShowConfirmModal(null);
        return;
      }
      const updatedPassengers = passengers.filter((p) => p.user_id !== currentUser.userId || p.order_id !== "");
      setPassengers(updatedPassengers);
      setExpandedPassengerId(null);
      showNotification("success", "All unsubmitted passengers removed");

      if (selectedTourData?.id && departureDate) {
        checkSeatLimit(selectedTourData.id, departureDate).then(({ isValid, message }) => {
          showNotification(isValid ? "success" : "error", message);
        });
      }
    } else if (showConfirmModal?.action === "resetForm") {
      const updatedPassengers = passengers.filter((p) => p.user_id !== currentUser.userId || p.order_id !== "");
      setPassengers(updatedPassengers);
      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod("");
      setActiveStep(1);
      setShowInProvider(false);
      setExpandedPassengerId(null);
      setValidationErrors([]);

      showNotification("success", "Booking form reset");
    }
    setShowConfirmModal(null);
  }, [
    showConfirmModal,
    bookingPassengers,
    passengers,
    currentUser.userId,
    selectedTourData,
    departureDate,
    showNotification,
    setPassengers,
    setSelectedTour,
    setDepartureDate,
    setPaymentMethod,
    setActiveStep,
    setShowInProvider,
    setValidationErrors,
    setExpandedPassengerId,
  ]);

  if (!showConfirmModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Action</h3>
        <p className="text-sm text-gray-600 mb-6">{showConfirmModal.message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => setShowConfirmModal(null)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAction}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}