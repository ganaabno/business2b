import React, { useEffect, useRef, useState } from "react";

import type {
  ValidationError,
  Order,
  User as UserType,
  Tour,
  Passenger,
} from "../types/type";
import { downloadTemplate } from "../addPassengerComponents/downloadTemplate";
import { BookingActions } from "../addPassengerComponents/BookingActions";
import LeadPassengerForm from "../components/LeadPassengerForm";
import BookingSummary from "../Parts/BookingSummary";
import TourList from "../components/tours/TourList";
import TourSelection from "../Parts/TourSelection";
import ProgressSteps from "../Parts/ProgressSteps";
import { useBooking } from "../hooks/useBooking";
import Notification from "../Parts/Notification";
import ErrorSummary from "../Parts/ErrorSummary";
import { PassengerList } from "./PassengerList";
import { MobileFooter } from "./MobileFooter";
import { useTours } from "../hooks/useTours";
import { toast } from "react-hot-toast";

const sanitizeDate = (date: string | null | undefined): string => {
  if (!date) return "";
  const trimmed = date.trim();
  return trimmed === "" ? "" : trimmed;
};

interface AddPassengerTabProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  selectedTour: string;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  errors: ValidationError[];
  setErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
  prefilledLead?: {
    leadId: any;
    name: string;
    phone: string;
    passengerCount: number;
    tourId: string;
    departureDate: string | null;
  } | null;
}

const NATIONALITIES = [
  "Mongolia",
  "USA",
  "Canada",
  "UK",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "China",
  "South Korea",
  "India",
  "Russia",
  "Brazil",
  "South Africa",
];

const ROOM_TYPES = [
  "Single",
  "King",
  "Double",
  "Twin",
  "Family",
  "Twin + Extra Bed",
  "King + Extra Bed",
];

export default function AddPassengerTab(props: AddPassengerTabProps) {
  const { currentUser, prefilledLead } = props;
  const userRole = currentUser.role || "user";
  const [hasAppliedLead, setHasAppliedLead] = useState(false);

  const { tours, loading: toursLoading, refreshTours } = useTours({ userRole });

  const {
    bookingPassengers,
    setBookingPassengers,
    activeStep,
    setActiveStep,
    loading,
    showInProvider,
    setShowInProvider,
    expandedPassengerId,
    setExpandedPassengerId,
    fieldLoading,
    canAdd,
    availableHotels,
    newPassengerRef,
    isPowerUser,
    selectedTourData,
    remainingSeats,
    totalPrice,
    addMultiplePassengers,
    updatePassenger,
    removePassenger,
    clearAllPassengers,
    resetBookingForm,
    handleDownloadCSV,
    handleUploadCSV,
    handleNextStep,
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
    confirmLeadPassenger,
    paymentMethod,
    setPaymentMethod,
  } = useBooking({ ...props, tours });

  const hasAppliedLeadRef = useRef(false);

  useEffect(() => {
    if (!prefilledLead || hasAppliedLeadRef.current) return;

    (window as any).__currentLeadId = prefilledLead.leadId;

    // Wait for tours to be loaded AND not empty
    if (toursLoading || tours.length === 0) {
      return; // Will re-run when tours finish loading
    }
    hasAppliedLeadRef.current = true;
    setLeadPassengerData(null);
    setActiveStep(3);

    const applyLead = async () => {
      const { name, phone, passengerCount, tourId, departureDate } =
        prefilledLead;

      // BULLETPROOF TOUR MATCHING
      let matchedTour = tours.find((t) => t.id === tourId); // UUID first

      if (!matchedTour) {
        const normalize = (s: string) =>
          s?.toLowerCase().trim().replace(/\s+/g, " ");
        const search = normalize(tourId);
        matchedTour = tours.find((t) => {
          return (
            normalize(t.title) === search ||
            normalize(t.name) === search ||
            normalize(t.title).includes(search) ||
            search.includes(normalize(t.title))
          );
        });
      }

      if (!matchedTour) {
        toast.error(`Tour not found: "${tourId}". Please select manually.`);
        return;
      }

      props.setSelectedTour(matchedTour.title);
      if (departureDate) props.setDepartureDate(departureDate.trim());

      const [first, ...last] = name.trim().split(/\s+/);
      const firstName = first || "";
      const lastName = last.join(" ") || "";

      const idx = await addMultiplePassengers(1);
      if (idx === -1) return;

      updatePassenger(idx, "first_name", firstName);
      updatePassenger(idx, "last_name", lastName);
      updatePassenger(idx, "phone", phone || "");
      updatePassenger(idx, "name", name.trim());
      updatePassenger(idx, "nationality", "Mongolia");
      updatePassenger(idx, "roomType", "Twin");

      if (passengerCount > 1) {
        updatePassenger(
          idx,
          "notes",
          `From Lead → Group of ${passengerCount} passengers`
        );
      }

      toast.success(
        `${name} (${passengerCount} pax) loaded — hotels & age ready!`,
        { duration: 8000 }
      );
    };

    applyLead();
  }, [prefilledLead, tours, toursLoading]); // This combo will re-run when tours load

  // AUTO-FETCH TOUR DATA WHEN TOUR IS SET FROM LEAD
  useEffect(() => {
    if (!props.selectedTour || selectedTourData) return;

    // Find the tour by title (since tourId from lead is actually the title)
    const foundTour = tours.find(
      (t) =>
        t.title === props.selectedTour ||
        t.name === props.selectedTour ||
        t.tour_number === props.selectedTour
    );

    if (foundTour) {
      // Force refresh selectedTourData by setting the actual title
      props.setSelectedTour(foundTour.title);

      // Trigger hotel loading & age calc
      setTimeout(() => {}, 100);
    }
  }, [props.selectedTour, tours, selectedTourData]);

  useEffect(() => {
    refreshTours();
  }, [refreshTours]);

  if (toursLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading tours...</p>
        </div>
      </div>
    );
  }

  const hasStartedBooking =
    bookingPassengers.length > 0 || props.selectedTour || props.departureDate;

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification
        notification={notification}
        setNotification={setNotification}
      />

      <div className="max-w-[105rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Travel Booking</h1>
            {bookingPassengers.length > 0 && (
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                {bookingPassengers.length} passenger
                {bookingPassengers.length > 1 && "s"} • $
                {totalPrice.toLocaleString()}
              </div>
            )}
          </div>

          {hasStartedBooking && (
            <button
              onClick={resetBookingForm}
              className="px-5 py-2.5 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100 transition-colors"
            >
              ✕ Start New Booking
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[105rem] mx-auto px-4 sm:px-6 lg:px-8">
        <ProgressSteps activeStep={activeStep} />
        <ErrorSummary errors={props.errors} />

        {/* STEP 1: Tour Selection */}
        {activeStep === 1 && (
          <>
            <TourSelection
              tours={tours}
              selectedTour={props.selectedTour}
              setSelectedTour={props.setSelectedTour}
              departure_date={props.departureDate}
              setDepartureDate={props.setDepartureDate}
              errors={props.errors}
              setActiveStep={setActiveStep}
              userRole={userRole}
              showAvailableSeats={isPowerUser}
            />

            <div className="mt-10">
              <TourList
                tours={tours}
                editingId={null}
                editForm={{}}
                setEditForm={() => {}}
                onStartEdit={() => {}}
                onCancelEdit={() => {}}
                showDeleteConfirm={null}
                setShowDeleteConfirm={() => {}}
                onRefresh={refreshTours}
                onSaveEdit={async () => {}}
                onDelete={async () => {}}
                onStatusChange={async () => {}}
              />
            </div>
          </>
        )}

        {activeStep === 2 && !prefilledLead && (
          <LeadPassengerForm
            selectedTour={props.selectedTour}
            departureDate={props.departureDate}
            setActiveStep={setActiveStep}
            currentUser={props.currentUser}
            selectedTourData={selectedTourData}
            setLeadPassengerData={setLeadPassengerData}
            setNotification={setNotification}
            leadPassengerData={leadPassengerData}
            confirmLeadPassenger={confirmLeadPassenger}
          />
        )}

        {/* STEP 3: Passenger List */}
        {activeStep === 3 && (
          <>
            <div className="sticky top-0 z-10 bg-white rounded-xl shadow-lg border border-slate-200 mb-8 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-5 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-600 rounded-lg">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Booking Details
                      </h3>
                      <p className="text-sm text-slate-600 flex flex-wrap items-center gap-4 mt-1">
                        <span>
                          {bookingPassengers.length} passenger
                          {bookingPassengers.length > 1 && "s"}
                        </span>
                        <span className="font-semibold">
                          ${totalPrice.toLocaleString()}
                        </span>
                        {isPowerUser ? (
                          <span className="text-green-600 font-medium">
                            ⚡ Power User: Unlimited seats
                          </span>
                        ) : (
                          remainingSeats !== undefined && (
                            <span
                              className={`font-medium ${
                                remainingSeats > 5
                                  ? "text-green-600"
                                  : remainingSeats > 0
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {remainingSeats} seat{remainingSeats !== 1 && "s"}{" "}
                              left
                            </span>
                          )
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-white">
                <BookingActions
                  bookingPassengers={bookingPassengers}
                  selectedTour={props.selectedTour}
                  totalPrice={totalPrice}
                  addPassenger={() => addMultiplePassengers(1)}
                  clearAllPassengers={clearAllPassengers}
                  resetBookingForm={resetBookingForm}
                  handleDownloadTemplate={() =>
                    downloadTemplate(props.showNotification)
                  }
                  handleUploadCSV={handleUploadCSV}
                  handleDownloadCSV={handleDownloadCSV}
                  newPassengerRef={newPassengerRef}
                  canAddPassenger={canAdd}
                  maxPassengers={0}
                />
              </div>
            </div>

            <PassengerList
              passengers={bookingPassengers}
              selectedTourData={selectedTourData}
              errors={props.errors}
              updatePassenger={updatePassenger}
              removePassenger={removePassenger}
              expandedPassengerId={expandedPassengerId}
              setExpandedPassengerId={setExpandedPassengerId}
              fieldLoading={fieldLoading}
              newPassengerRef={newPassengerRef}
              nationalities={NATIONALITIES}
              roomTypes={ROOM_TYPES}
              hotels={availableHotels}
              setNotification={(n) =>
                props.showNotification(n.type as "success" | "error", n.message)
              }
              addMainPassenger={() => addMultiplePassengers(1)}
              setPassengers={setBookingPassengers}
            />

            <div className="flex gap-4 mt-10">
              <button
                onClick={() => setActiveStep(2)}
                className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                ← Back
              </button>
              <button
                onClick={handleNextStep}
                disabled={bookingPassengers.length === 0}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition shadow-md hover:shadow-lg"
              >
                Review Booking →
              </button>
            </div>
          </>
        )}

        {activeStep === 4 && (
          <BookingSummary
            selectedTour={props.selectedTour}
            departureDate={props.departureDate}
            passengers={bookingPassengers}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            errors={props.errors}
            setErrors={props.setErrors}
            downloadCSV={handleDownloadCSV}
            saveOrder={handleNextStep}
            setActiveStep={setActiveStep}
            loading={loading}
            showInProvider={showInProvider}
            setShowInProvider={setShowInProvider}
            currentUser={props.currentUser}
            onBack={() => setActiveStep(3)}
          />
        )}
      </div>

      <MobileFooter
        activeStep={activeStep}
        bookingPassengers={bookingPassengers}
        setActiveStep={setActiveStep}
        totalPrice={totalPrice}
        canAdd={canAdd}
        addPassenger={() => addMultiplePassengers(1)}
        clearAllPassengers={clearAllPassengers}
        handleNextStep={handleNextStep}
        newPassengerRef={newPassengerRef}
        maxPassengers={0}
      />

      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-8 py-6 flex items-center gap-4 shadow-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="text-lg font-medium text-gray-800">
              Processing your request...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
