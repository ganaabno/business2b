import {
  type Dispatch,
  type SetStateAction,
  useMemo,
  useState,
  useEffect,
} from "react";
import type {
  Tour,
  Passenger,
  User as UserType,
  ValidationError,
  Order,
  LeadPassenger,
} from "../types/type";
import Notifications from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import TourSelection from "../Parts/TourSelection";
import LeadPassengerForm from "../components/LeadPassengerForm";
import { PassengerList } from "../components/PassengerList";
import { BookingActions } from "../addPassengerComponents/BookingActions";
import BookingSummary from "../Parts/BookingSummary";
import { MobileFooter } from "../components/MobileFooter";
import BookingsList from "../Pages/userInterface/BookingsList";
import ManageLead from "../components/ManageLead";
import { useBooking } from "../hooks/useBooking";
import { downloadTemplate } from "../utils/csvUtils";

interface UserInterfaceProps {
  tours: Tour[];
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setTours: Dispatch<SetStateAction<Tour[]>>;
  selectedTour: string;
  setSelectedTour: Dispatch<SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: Dispatch<SetStateAction<string>>;
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  onLogout?: () => Promise<void>;
}

export default function UserInterface({
  tours,
  orders,
  setOrders,
  setTours,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  passengers,
  setPassengers,
  errors,
  showNotification,
  currentUser,
}: UserInterfaceProps) {
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
    showPassengerPrompt,
    setShowPassengerPrompt,
    passengerCountInput,
    setPassengerCountInput,
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
    passengerFormData,
    setPassengerFormData,
    confirmLeadPassenger,
    paymentMethod, // From useBooking
    setPaymentMethod, // From useBooking
  } = useBooking({
    tours,
    setOrders,
    selectedTour,
    setSelectedTour,
    departureDate,
    setDepartureDate,
    errors,
    setErrors: (newErrors) => {
      setValidationErrors(newErrors);
    },
    currentUser,
  });

  const [validationErrors, setValidationErrors] =
    useState<ValidationError[]>(errors);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"bookings" | "leads">("bookings");
  const [leadPassengerFormData, setLeadPassengerFormData] = useState<{
    seat_count: number;
    tour_id: string;
    departure_date: string;
  } | null>(null);

  // Debug rendering and state reset
  useEffect(() => {
    console.log("UserInterface: Rendering", {
      isPowerUser,
      showPassengerPrompt,
      bookingPassengersLength: bookingPassengers.length,
      activeStep,
      activeTab,
      selectedTour,
      departureDate,
      passengersLength: passengers.length,
      paymentMethod,
    });
  }, [
    isPowerUser,
    showPassengerPrompt,
    bookingPassengers,
    activeStep,
    activeTab,
    selectedTour,
    departureDate,
    passengers,
    paymentMethod,
  ]);

  // Sync passengers with bookingPassengers (unsubmitted passengers)
  useEffect(() => {
    setPassengers((prev) => {
      const unsubmitted = bookingPassengers.filter((p) => p.order_id === "");
      const newPassengers = [
        ...prev.filter((p) => p.order_id !== ""),
        ...unsubmitted,
      ];
      // Only update if passengers have actually changed to avoid infinite loop
      if (JSON.stringify(newPassengers) !== JSON.stringify(prev)) {
        return newPassengers;
      }
      return prev;
    });
  }, [bookingPassengers, setPassengers]);

  useEffect(() => {
    if (activeStep === 1) {
      console.log("UserInterface: Resetting props for step 1");
      setSelectedTour((prev) => (prev === "" ? prev : ""));
      setDepartureDate((prev) => (prev === "" ? prev : ""));
      setPassengers((prev) => {
        const filtered = prev.filter((p) => p.order_id !== "");
        return JSON.stringify(filtered) !== JSON.stringify(prev)
          ? filtered
          : prev;
      });
      setValidationErrors((prev) => (prev.length === 0 ? prev : []));
      setActiveTab((prev) => (prev === "bookings" ? prev : "bookings"));
    }
  }, [
    activeStep,
    setSelectedTour,
    setDepartureDate,
    setPassengers,
    setActiveTab,
  ]);

  // Filter submitted passengers
  const submittedPassengers = useMemo(() => {
    return passengers.filter((p) => p.order_id !== "");
  }, [passengers]);

  useEffect(() => {
    if (passengerFormData) {
      const tour = tours.find((t) => t.id === passengerFormData.tour_id);
      if (tour) {
        console.log("UserInterface: Setting tour and departure date", {
          tour_title: tour.title,
          departure_date: passengerFormData.departure_date,
        });
        setSelectedTour((prev) => (prev === tour.title ? prev : tour.title));
        setDepartureDate((prev) =>
          prev === passengerFormData.departure_date
            ? prev
            : passengerFormData.departure_date
        );
      }
    }
  }, [passengerFormData, tours, setSelectedTour, setDepartureDate]);  

  // Calculate max passengers for prompt
  const maxPassengersForPrompt = Math.min(
    MAX_PASSENGERS - bookingPassengers.length,
    remainingSeats !== undefined ? remainingSeats : MAX_PASSENGERS,
    leadPassengerData?.seat_count !== undefined
      ? leadPassengerData.seat_count - bookingPassengers.length
      : MAX_PASSENGERS
  );

  // Handle Add Passenger click
  const handleAddPassengerClick = () => {
    console.log("UserInterface: Add Passenger clicked", {
      isPowerUser,
      showPassengerPrompt,
      canAdd,
      remainingSeats,
      leadPassengerData,
      selectedTour,
      departureDate,
    });
    if (!canAdd) {
      showNotification(
        "error",
        "Cannot add passengers: Check tour, date, or seat availability"
      );
      return;
    }
    setShowPassengerPrompt(true);
  };

  return (
    <div className="px-64 py-12 bg-gray-50">
      <Notifications
        notification={notification}
        setNotification={setNotification}
      />

      <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <ProgressSteps activeStep={activeStep} />
        <ErrorSummary errors={validationErrors} />

        {showPassengerPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 debug-modal">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add Passengers</h3>
              <div className="mb-4">
                <label
                  htmlFor="passengerCount"
                  className="block text-sm font-medium text-gray-700"
                >
                  How many passengers? (Max: {maxPassengersForPrompt})
                </label>
                <input
                  type="number"
                  id="passengerCount"
                  min="1"
                  max={maxPassengersForPrompt}
                  value={passengerCountInput}
                  onChange={(e) => {
                    console.log(
                      "UserInterface: passengerCountInput changed to",
                      e.target.value
                    );
                    setPassengerCountInput(e.target.value);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    console.log("UserInterface: Cancel prompt clicked");
                    setShowPassengerPrompt(false);
                    setPassengerCountInput("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    console.log(
                      "UserInterface: Add passengers clicked, count:",
                      passengerCountInput
                    );
                    const count = parseInt(passengerCountInput) || 0;
                    if (count <= 0 || count > maxPassengersForPrompt) {
                      showNotification(
                        "error",
                        `Please enter a valid number of passengers (1-${maxPassengersForPrompt})`
                      );
                      return;
                    }
                    addMultiplePassengers(count);
                    setShowPassengerPrompt(false);
                    setPassengerCountInput("");
                    newPassengerRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {activeStep === 1 && (
          <div className="animate-fade-in">
            <TourSelection
              tours={tours}
              selectedTour={selectedTour}
              setSelectedTour={setSelectedTour}
              departure_date={departureDate}
              setDepartureDate={setDepartureDate}
              errors={validationErrors}
              setActiveStep={setActiveStep}
              userRole={currentUser.role || "user"}
              showAvailableSeats={false}
            />
          </div>
        )}

        {activeStep === 2 && (
          <LeadPassengerForm
            selectedTour={selectedTour}
            departureDate={departureDate}
            setActiveStep={setActiveStep}
            currentUser={currentUser}
            selectedTourData={selectedTourData}
            setLeadPassengerData={setLeadPassengerData}
            setNotification={setNotification}
            confirmLeadPassenger={confirmLeadPassenger}
            leadPassengerData={leadPassengerData}
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
                        {remainingSeats !== undefined && (
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
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-white rounded-b-xl">
                <BookingActions
                  bookingPassengers={bookingPassengers}
                  selectedTour={selectedTour}
                  totalPrice={totalPrice}
                  addPassenger={handleAddPassengerClick}
                  clearAllPassengers={clearAllPassengers}
                  resetBookingForm={resetBookingForm}
                  handleDownloadCSV={handleDownloadCSV}
                  handleDownloadTemplate={() =>
                    downloadTemplate(showNotification)
                  }
                  handleUploadCSV={handleUploadCSV}
                  newPassengerRef={newPassengerRef}
                  maxPassengers={MAX_PASSENGERS}
                  canAddPassenger={canAdd}
                />
              </div>
            </div>
            <PassengerList
              passengers={bookingPassengers}
              selectedTourData={selectedTourData}
              errors={validationErrors}
              updatePassenger={updatePassenger}
              removePassenger={removePassenger}
              expandedPassengerId={expandedPassengerId}
              setExpandedPassengerId={setExpandedPassengerId}
              fieldLoading={fieldLoading}
              newPassengerRef={newPassengerRef}
              nationalities={[
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
              ]}
              roomTypes={["Single", "Double", "Twin", "Family", "King"]}
              hotels={availableHotels}
              setNotification={() => {}}
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
            selectedTour={selectedTour}
            departureDate={departureDate}
            passengers={bookingPassengers}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            errors={validationErrors}
            setErrors={setValidationErrors}
            downloadCSV={handleDownloadCSV}
            saveOrder={handleNextStep}
            setActiveStep={setActiveStep}
            loading={loading}
            showInProvider={showInProvider}
            setShowInProvider={setShowInProvider}
            currentUser={currentUser}
            onBack={() => setActiveStep(3)}
          />
        )}

        {activeStep === 1 && (
          <div className="mt-8">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("bookings")}
                  className={`flex-1 py-4 px-6 text-sm font-semibold text-center transition-all duration-200 ${
                    activeTab === "bookings"
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-gray-900 border-b-2 border-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Your Bookings
                </button>
                <button
                  onClick={() => setActiveTab("leads")}
                  className={`flex-1 py-4 px-6 text-sm font-semibold text-center transition-all duration-200 ${
                    activeTab === "leads"
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-gray-900 border-b-2 border-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Your Lead Passengers
                </button>
              </div>
              <div className="p-8">
                {activeTab === "bookings" && (
                  <BookingsList
                    passengers={submittedPassengers}
                    orders={orders}
                    tours={tours}
                    currentUser={currentUser}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                  />
                )}
                {activeTab === "leads" && (
                  <ManageLead
                    currentUser={currentUser}
                    showNotification={showNotification}
                    setActiveStep={setActiveStep}
                    setLeadPassengerData={setLeadPassengerData}
                    setPassengerFormData={setLeadPassengerFormData}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <MobileFooter
        activeStep={activeStep}
        bookingPassengers={bookingPassengers}
        setActiveStep={setActiveStep}
        totalPrice={totalPrice}
        canAdd={canAdd}
        maxPassengers={MAX_PASSENGERS}
        addPassenger={handleAddPassengerClick}
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
