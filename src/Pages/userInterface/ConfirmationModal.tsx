import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Tour, Passenger, ValidationError, User as UserType } from "../../types/type";
import { checkSeatLimit } from "../../utils/seatLimitChecks";
import { Modal } from "../../components/Modal";

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
    <Modal
      open={!!showConfirmModal}
      onOpenChange={(open) => !open && setShowConfirmModal(null)}
      title="Confirm Action"
      description={showConfirmModal.message}
      size="sm"
    >
      <div className="flex gap-3 justify-end mt-4">
        <button
          onClick={() => setShowConfirmModal(null)}
          className="mono-button mono-button--ghost px-4 py-2"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirmAction}
          className="mono-button px-4 py-2"
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}
