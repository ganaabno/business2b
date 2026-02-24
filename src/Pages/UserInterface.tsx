// UserInterface.tsx
import {
  type Dispatch,
  type SetStateAction,
  useMemo,
  useState,
  useEffect,
  useRef,
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
import ExcelDataTab from "../components/ExcelDataTab";
import { useBooking } from "../hooks/useBooking";
import { downloadTemplate } from "../utils/csvUtils";
import { useTours } from "../hooks/useTours";
import { useFlightDataStore } from "../Parts/flightDataStore";

interface UserInterfaceProps {
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  onLogout?: () => Promise<void>;
}

export default function UserInterface({
  orders,
  setOrders,
  passengers,
  setPassengers,
  errors,
  showNotification,
  currentUser,
}: UserInterfaceProps) {
  const userRole = currentUser.role || "user";
  const { tours, refreshTours } = useTours({ userRole });
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");

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
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
    passengerFormData,
    setPassengerFormData,
    confirmLeadPassenger,
    paymentMethod,
    setPaymentMethod,
  } = useBooking({
    tours,
    setOrders,
    selectedTour,
    setSelectedTour,
    departureDate,
    setDepartureDate,
    errors,
    setErrors: (newErrors) => setValidationErrors(newErrors),
    currentUser,
  });

  const [validationErrors, setValidationErrors] =
    useState<ValidationError[]>(errors);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"bookings" | "leads" | "excel">(
    "bookings"
  );
  const [leadPassengerFormData, setLeadPassengerFormData] = useState<{
    seat_count: number;
    tour_id: string;
    departure_date: string;
  } | null>(null);

  const {
    data: flightData,
    fetchFlightData,
    subscribeToFlightData,
  } = useFlightDataStore();

  useEffect(() => {
    if (activeTab !== "excel") return;
    const loadFlightData = async () => {
      try {
        await fetchFlightData({ mode: "recent", limit: 50 });
      } catch (err: any) {
        showNotification("error", "Өгөгдөл татахад алдаа: " + err.message);
      }
    };

    void loadFlightData();
    const unsubscribe = subscribeToFlightData({ mode: "recent", limit: 50 });
    return unsubscribe;
  }, [activeTab, fetchFlightData, subscribeToFlightData, showNotification]);

  useEffect(() => {
    refreshTours();
  }, [refreshTours]);

  // Sync unsubmitted passengers
  useEffect(() => {
    setPassengers((prev) => {
      const unsubmitted = bookingPassengers.filter((p) => p.order_id === "");
      const newPassengers = [
        ...prev.filter((p) => p.order_id !== ""),
        ...unsubmitted,
      ];
      return JSON.stringify(newPassengers) !== JSON.stringify(prev)
        ? newPassengers
        : prev;
    });
  }, [bookingPassengers, setPassengers]);

  // Reset on step 1
  useEffect(() => {
    if (activeStep === 1) {
      setSelectedTour("");
      setDepartureDate("");
      setPassengers((prev) => prev.filter((p) => p.order_id !== ""));
      setValidationErrors([]);
      setActiveTab("bookings");
    }
  }, [activeStep]);

  const submittedPassengers = useMemo(() => {
    return passengers.filter((p) => p.order_id !== "");
  }, [passengers]);

  useEffect(() => {
    if (passengerFormData) {
      const tour = tours.find((t) => t.id === passengerFormData.tour_id);
      if (tour) {
        setSelectedTour(tour.title);
        setDepartureDate(passengerFormData.departure_date);
      }
    }
  }, [passengerFormData, tours]);

  const handleAddPassengerClick = () => {
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
    <div className="mono-shell">
      <Notifications
        notification={notification}
        setNotification={setNotification}
      />

      <div className="mono-container px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pb-16">
        <div className="mono-stack">
          <ProgressSteps activeStep={activeStep} />
          <ErrorSummary errors={validationErrors} />

        {/* ADD PASSENGER PROMPT */}
        {showPassengerPrompt && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="mono-card p-6 w-full max-w-md">
              <h3 className="mono-title text-lg mb-4">Add Passengers</h3>
              <div className="mb-4">
                <label
                  htmlFor="passengerCount"
                  className="block text-sm font-medium"
                >
                  How many passengers?
                </label>
                <input
                  type="number"
                  id="passengerCount"
                  min="1"
                  value={passengerCountInput}
                  onChange={(e) => setPassengerCountInput(e.target.value)}
                  className="mono-input mt-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowPassengerPrompt(false);
                    setPassengerCountInput("");
                  }}
                  className="mono-button mono-button--ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPassengerPrompt(false);
                    setPassengerCountInput("");
                    newPassengerRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }}
                  className="mono-button"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: TOUR SELECTION */}
        {activeStep === 1 && (
          <div className="animate-fadeIn">
            <TourSelection
              tours={tours}
              selectedTour={selectedTour}
              setSelectedTour={setSelectedTour}
              departure_date={departureDate}
              setDepartureDate={setDepartureDate}
              errors={validationErrors}
              setActiveStep={setActiveStep}
              userRole={userRole}
              showAvailableSeats={false}
            />
          </div>
        )}

        {/* STEP 2: LEAD PASSENGER */}
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

        {/* STEP 3: PASSENGER LIST */}
        {activeStep === 3 && (
          <>
            <div className="sticky top-0 z-10 mono-card mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gray-100 rounded-lg border border-gray-200">
                      <svg
                        className="h-5 w-5 text-gray-700"
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
                      <h3 className="mono-title text-lg">
                        Booking Details
                      </h3>
                      <p className="text-sm text-gray-600 flex flex-wrap items-center gap-4">
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
              <div className="px-6 py-4 bg-gray-50 rounded-b-xl">
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
                  canAddPassenger={canAdd}
                  maxPassengers={0}
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
              setPassengers={function (
                value: SetStateAction<Passenger[]>
              ): void {
                throw new Error("Function not implemented.");
              }}
            />

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setActiveStep(2)}
                className="mono-button mono-button--ghost w-full sm:w-auto"
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
                className="mono-button w-full sm:flex-1"
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

        {/* STEP 4: BOOKING SUMMARY */}
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

        {/* TABS: Bookings | Leads | Excel */}
        {activeStep === 1 && (
          <div className="mt-8">
            <div className="mono-card">
              <div className="mono-tablist">
                <button
                  onClick={() => setActiveTab("bookings")}
                  className={`mono-tab ${
                    activeTab === "bookings" ? "mono-tab--active" : ""
                  }`}
                >
                  Your Bookings
                </button>
                <button
                  onClick={() => setActiveTab("leads")}
                  className={`mono-tab ${
                    activeTab === "leads" ? "mono-tab--active" : ""
                  }`}
                >
                  Your Lead Passengers
                </button>
                <button
                  onClick={() => setActiveTab("excel")}
                  className={`mono-tab ${
                    activeTab === "excel" ? "mono-tab--active" : ""
                  }`}
                >
                  <span className="flex items-center justify-center">
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
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Excel Data
                  </span>
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
                {activeTab === "excel" && (
                  <div className="space-y-6">
                    {flightData.length > 0 ? (
                      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">
                            Нислэгийн Мэдээлэл
                          </h3>
                          <div className="flex items-center gap-3"></div>
                        </div>
                        <ExcelDataTab data={flightData} />
                        <p className="text-xs text-gray-500 mt-3">
                          Data persists across tabs and reloads
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <svg
                          className="w-16 h-16 mx-auto mb-4 text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="text-lg font-medium">Файл оруулаагүй</p>
                        <p className="text-sm">
                          Менежер Excel файл оруулна уу.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <MobileFooter
        activeStep={activeStep}
        bookingPassengers={bookingPassengers}
        setActiveStep={setActiveStep}
        totalPrice={totalPrice}
        canAdd={canAdd}
        addPassenger={handleAddPassengerClick}
        clearAllPassengers={clearAllPassengers}
        handleNextStep={handleNextStep}
        newPassengerRef={newPassengerRef}
        maxPassengers={0}
      />

      {loading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="mono-card px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="text-gray-900">Processing your request...</span>
          </div>
        </div>
      )}
    </div>
  );
}
