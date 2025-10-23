import React from "react";
import { useBooking } from "../hooks/useBooking";
import TourSelection from "../Parts/TourSelection";
import BookingSummary from "../Parts/BookingSummary";
import { BookingActions } from "../addPassengerComponents/BookingActions";
import { downloadTemplate } from "../addPassengerComponents/downloadTemplate";
import Notification from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import { PassengerList } from "./PassengerList";
import { MobileFooter } from "./MobileFooter";
import LeadPassengerForm from "../components/LeadPassengerForm";
import type {
  Tour,
  ValidationError,
  LeadPassenger,
  Order,
  User as UserType,
} from "../types/type";

interface AddPassengerTabProps {
  tours: Tour[];
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

const ROOM_TYPES = ["Single", "King", "Double", "Twin", "Family"];

export default function AddPassengerTab(props: AddPassengerTabProps) {
  const {
    bookingPassengers,
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
    MAX_PASSENGERS,
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
    confirmLeadPassenger,
    paymentMethod, // From useBooking
    setPaymentMethod, // From useBooking
  } = useBooking(props);

  const filteredTours = isPowerUser
    ? props.tours
    : props.tours.map(({ available_seats, ...rest }) => ({
        ...rest,
        available_seats: undefined,
      }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification
        notification={notification}
        setNotification={setNotification}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Travel Booking</h1>
            {bookingPassengers.length > 0 && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {bookingPassengers.length} passenger
                {bookingPassengers.length !== 1 ? "s" : ""} • $
                {totalPrice.toLocaleString()}
              </div>
            )}
          </div>
          {(bookingPassengers.length > 0 ||
            props.selectedTour ||
            props.departureDate) && (
            <button
              onClick={resetBookingForm}
              className="px-4 py-2 text-green-600 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
            >
              Complete Registration
            </button>
          )}
        </div>
      </div>
      <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <ProgressSteps activeStep={activeStep} />
        <ErrorSummary errors={props.errors} />
        {activeStep === 1 && (
          <TourSelection
            tours={filteredTours}
            selectedTour={props.selectedTour}
            setSelectedTour={props.setSelectedTour}
            departure_date={props.departureDate}
            setDepartureDate={props.setDepartureDate}
            errors={props.errors}
            setActiveStep={setActiveStep}
            userRole={props.currentUser.role || "user"}
            showAvailableSeats={true}
          />
        )}
        {activeStep === 2 && (
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
        {activeStep === 3 && (
          <>
            <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm border border-slate-200 mb-6">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                      <svg
                        className="h-5 w-5 text-white"
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
                      <h3 className="text-lg font-bold text-slate-900">
                        Booking Details
                      </h3>
                      <p className="text-sm text-slate-600 flex items-center space-x-4">
                        <span className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                            />
                          </svg>
                          {bookingPassengers.length}{" "}
                          {bookingPassengers.length === 1
                            ? "passenger"
                            : "passengers"}
                        </span>
                        <span className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                            />
                          </svg>
                          ${totalPrice.toLocaleString()}
                        </span>
                        {isPowerUser ? (
                          <span className="flex items-center font-medium text-green-600">
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            💪 {props.currentUser.role?.toUpperCase()} MODE:
                            Unlimited seats
                          </span>
                        ) : (
                          remainingSeats !== undefined && (
                            <span
                              className={`flex items-center font-medium ${
                                remainingSeats > 5
                                  ? "text-green-600"
                                  : remainingSeats > 0
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {remainingSeats} seats left
                            </span>
                          )
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-white rounded-b-xl">
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
                  maxPassengers={MAX_PASSENGERS}
                  canAddPassenger={canAdd}
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
              setNotification={(notification) =>
                props.showNotification(
                  notification.type as "success" | "error",
                  notification.message
                )
              }
              addMainPassenger={() => addMultiplePassengers(1)}
            />
            <div className="flex gap-2 mt-8">
              <button
                onClick={() => setActiveStep(2)}
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
              <button
                onClick={handleNextStep}
                disabled={bookingPassengers.length === 0}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                Review Booking
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
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
        maxPassengers={MAX_PASSENGERS}
        addPassenger={() => addMultiplePassengers(1)}
        clearAllPassengers={clearAllPassengers}
        handleNextStep={handleNextStep}
        newPassengerRef={newPassengerRef}
      />
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-900">Processing your request...</span>
          </div>
        </div>
      )}
    </div>
  );
}
