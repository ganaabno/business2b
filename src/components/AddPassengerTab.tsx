import React, { useCallback, useEffect, useRef } from "react";

import type {
  ValidationError,
  Order,
  User as UserType,
  Tour,
} from "../types/type";
import { downloadTemplate } from "../addPassengerComponents/downloadTemplate";
import { BookingActions } from "../addPassengerComponents/BookingActions";
import LeadPassengerForm from "../components/LeadPassengerForm";
import BookingSummary from "../Parts/BookingSummary";
import TourSelection from "../Parts/TourSelection";
import ProgressSteps from "../Parts/ProgressSteps";
import { useBooking } from "../hooks/useBooking";
import Notification from "../Parts/Notification";
import ErrorSummary from "../Parts/ErrorSummary";
import { PassengerList } from "./PassengerList";
import { MobileFooter } from "./MobileFooter";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

const sanitizeDate = (date: string | null | undefined): string => {
  if (!date) return "";
  const trimmed = date.trim();
  return trimmed === "" ? "" : trimmed;
};

const formatDisplayDate = (value: string | null | undefined): string => {
  const normalized = sanitizeDate(value);
  if (!normalized) return "";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

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
  prefilledLead?: {
    leadId: any;
    name: string;
    phone: string;
    passengerCount: number;
    tourId: string;
    departureDate: string | null;
  } | null;
  onPrefilledLeadConsumed?: () => void;
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
  const { currentUser, prefilledLead, onPrefilledLeadConsumed, showNotification } =
    props;
  const { t } = useTranslation();
  const userRole = currentUser.role || "user";
  const tours = props.tours;

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
    csvImportPreview,
    handleConfirmCsvImport,
    handleCancelCsvImport,
    handleNextStep,
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
    confirmLeadPassenger,
    paymentMethod,
    setPaymentMethod,
  } = useBooking({ ...props, tours, csvImportMode: "preview" });

  const appliedLeadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!prefilledLead) {
      appliedLeadKeyRef.current = null;
    }
  }, [prefilledLead]);

  useEffect(() => {
    if (!prefilledLead) return;

    const leadKey = [
      prefilledLead.leadId || "",
      prefilledLead.name || "",
      prefilledLead.phone || "",
      prefilledLead.passengerCount || 0,
      prefilledLead.tourId || "",
      prefilledLead.departureDate || "",
    ].join("|");

    if (appliedLeadKeyRef.current === leadKey) return;

    (window as any).__currentLeadId = prefilledLead.leadId;

    // Wait for tours to be loaded AND not empty
    if (tours.length === 0) {
      return; // Will re-run when tours finish loading
    }
    appliedLeadKeyRef.current = leadKey;
    onPrefilledLeadConsumed?.();
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
        toast.error(t("managerTourNotFound", { tourId }));
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
          t("managerLeadGroupNote", { count: passengerCount }),
        );
      }

      toast.success(
        t("managerLeadLoaded", { name, count: passengerCount }),
        { duration: 8000 },
      );
    };

    applyLead();
  }, [prefilledLead, tours, onPrefilledLeadConsumed, t]); // This combo will re-run when tours load

  // AUTO-FETCH TOUR DATA WHEN TOUR IS SET FROM LEAD
  useEffect(() => {
    if (!props.selectedTour || selectedTourData) return;

    // Find the tour by title (since tourId from lead is actually the title)
    const foundTour = tours.find(
      (t) =>
        t.title === props.selectedTour ||
        t.name === props.selectedTour ||
        t.tour_number === props.selectedTour,
    );

    if (foundTour) {
      // Force refresh selectedTourData by setting the actual title
      props.setSelectedTour(foundTour.title);

      // Trigger hotel loading & age calc
      setTimeout(() => {}, 100);
    }
  }, [props.selectedTour, tours, selectedTourData]);

  const hasStartedBooking =
    bookingPassengers.length > 0 || props.selectedTour || props.departureDate;

  const handleQuickAdd = useCallback(
    async (requestedCount: number) => {
      if (!canAdd) {
        showNotification(
          "error",
          t("managerSelectTourAndDateFirst"),
        );
        return;
      }

      const allowedCount =
        !isPowerUser && remainingSeats !== undefined
          ? Math.min(requestedCount, Math.max(remainingSeats, 0))
          : requestedCount;

      if (allowedCount <= 0) {
        showNotification("error", t("managerNoSeatsLeftForAdditional"));
        return;
      }

      await addMultiplePassengers(allowedCount);

      if (allowedCount < requestedCount) {
        showNotification(
          "error",
          t("managerLimitedSeatAddNotice", { count: allowedCount }),
        );
      }
    },
    [
      addMultiplePassengers,
      canAdd,
      isPowerUser,
      remainingSeats,
      showNotification,
      t,
    ],
  );

  return (
    <div className="mono-shell">
      <Notification
        notification={notification}
        setNotification={setNotification}
      />

      <div className="mono-container px-4 sm:px-6 lg:px-8 pb-24 md:pb-8">
        <div className="mono-card p-5 sm:p-6 mt-2 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mono-kicker">{t("managerWorkspaceKicker")}</p>
              <h1 className="mono-title text-2xl sm:text-3xl mt-1">
                {t("managerPassengerRegistrationTitle")}
              </h1>
              <p className="mono-subtitle text-sm mt-2">
                {t("managerPassengerRegistrationSubtitle")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="mono-badge">
                {bookingPassengers.length}{" "}
                {bookingPassengers.length === 1
                  ? t("passengerSingular")
                  : t("passengerPlural")}
              </span>
              <span className="mono-badge">${totalPrice.toLocaleString()}</span>
              {isPowerUser ? (
                <span className="mono-badge mono-badge--success">
                  {t("managerUnlimitedSeats")}
                </span>
              ) : (
                remainingSeats !== undefined && (
                  <span
                    className={`mono-badge ${
                      remainingSeats > 5
                        ? "mono-badge--success"
                        : remainingSeats > 0
                          ? "mono-badge--warning"
                          : "mono-badge--danger"
                    }`}
                  >
                    {t("seatsLeft", { count: remainingSeats })}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="mono-panel px-3 py-2">
              <p className="text-xs text-gray-500">{t("managerSelectedTourLabel")}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {props.selectedTour || t("notSet")}
              </p>
            </div>
            <div className="mono-panel px-3 py-2">
              <p className="text-xs text-gray-500">{t("managerDepartureDateLabel")}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {formatDisplayDate(props.departureDate) || t("notSet")}
              </p>
            </div>
            <div className="mono-panel px-3 py-2">
              <p className="text-xs text-gray-500">{t("managerCurrentStepLabel")}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {t("managerStepOf", { step: activeStep, total: 4 })}
              </p>
            </div>
          </div>

          {hasStartedBooking && (
            <button
              onClick={resetBookingForm}
              className="mono-button mono-button--ghost mono-button--sm mt-4"
            >
              {t("managerStartNewBooking")}
            </button>
          )}
        </div>

        <div className="mono-stack">
          <ProgressSteps activeStep={activeStep} />
          <ErrorSummary errors={props.errors} />

          {activeStep === 1 && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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

              <aside className="mono-card p-5 h-fit">
                <h3 className="mono-title text-base">{t("managerQuickChecklistTitle")}</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>{t("managerChecklistLine1")}</li>
                  <li>{t("managerChecklistLine2")}</li>
                  <li>{t("managerChecklistLine3")}</li>
                  <li>{t("managerChecklistLine4")}</li>
                </ul>

                {selectedTourData && (
                  <div className="mt-4 mono-panel p-3 text-xs text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium text-gray-800">{t("managerTourLabel")}:</span>{" "}
                      {selectedTourData.title}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">{t("managerHotelsLabel")}:</span>{" "}
                      {Array.isArray(selectedTourData.hotels)
                        ? selectedTourData.hotels.length
                        : String(selectedTourData.hotels || "")
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean).length}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">{t("managerServicesLabel")}:</span>{" "}
                      {selectedTourData.services?.length || 0}
                    </p>
                  </div>
                )}
              </aside>
            </div>
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
              <div className="sticky top-0 z-10 mono-card overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="mono-title text-lg">
                        {t("managerPassengerEntryTitle")}
                      </h3>
                      <p className="mono-subtitle text-sm mt-1">
                        {t("managerPassengerEntrySubtitle")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="mono-badge">
                        {bookingPassengers.length} {t("managerPaxAbbr")}
                      </span>
                      <span className="mono-badge">
                        ${totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="mono-button mono-button--subtle mono-button--sm"
                      onClick={() => handleQuickAdd(1)}
                    >
                      {t("managerQuickAddOne")}
                    </button>
                    <button
                      type="button"
                      className="mono-button mono-button--subtle mono-button--sm"
                      onClick={() => handleQuickAdd(5)}
                    >
                      {t("managerQuickAddFive")}
                    </button>
                    <button
                      type="button"
                      className="mono-button mono-button--subtle mono-button--sm"
                      onClick={() => handleQuickAdd(10)}
                    >
                      {t("managerQuickAddTen")}
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 bg-white">
                  <BookingActions
                    bookingPassengers={bookingPassengers}
                    selectedTour={props.selectedTour}
                    totalPrice={totalPrice}
                    addPassenger={() => handleQuickAdd(1)}
                    clearAllPassengers={clearAllPassengers}
                    resetBookingForm={resetBookingForm}
                    handleDownloadTemplate={() => downloadTemplate(showNotification)}
                    handleUploadCSV={handleUploadCSV}
                    handleDownloadCSV={handleDownloadCSV}
                    newPassengerRef={newPassengerRef}
                    canAddPassenger={canAdd}
                    maxPassengers={0}
                    variant="manager"
                  />
                </div>

                {csvImportPreview.open && (
                  <div className="px-6 pb-5">
                    <div className="mono-panel p-4 border border-gray-200">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {t("csvPreviewTitle")}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {csvImportPreview.fileName || t("notSet")}
                          </p>
                          <p className="text-xs text-gray-600 mt-2">
                            {t("csvPreviewSummary", {
                              total: csvImportPreview.summary.total,
                              ready: csvImportPreview.summary.ready,
                              warning: csvImportPreview.summary.warning,
                              blocked: csvImportPreview.summary.blocked,
                            })}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="mono-button mono-button--ghost mono-button--sm"
                            onClick={handleCancelCsvImport}
                          >
                            {t("cancel")}
                          </button>
                          <button
                            type="button"
                            className="mono-button mono-button--sm"
                            onClick={handleConfirmCsvImport}
                            disabled={
                              csvImportPreview.summary.ready +
                                csvImportPreview.summary.warning ===
                              0
                            }
                          >
                            {t("csvPreviewConfirmImport")}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                        {csvImportPreview.rows.slice(0, 20).map((row) => (
                          <div
                            key={`csv-preview-${row.rowNumber}`}
                            className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {t("csvRowLabel", { row: row.rowNumber })}: {row.data.firstName} {row.data.lastName}
                              </p>
                              {row.blockers[0] && (
                                <p className="text-xs text-red-700 mt-0.5">{row.blockers[0]}</p>
                              )}
                              {!row.blockers[0] && row.warnings[0] && (
                                <p className="text-xs text-amber-700 mt-0.5">{row.warnings[0]}</p>
                              )}
                            </div>

                            <span
                              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                row.status === "blocked"
                                  ? "bg-red-100 text-red-700"
                                  : row.status === "warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {row.status === "blocked"
                                ? t("csvStatusBlocked")
                                : row.status === "warning"
                                  ? t("csvStatusWarning")
                                  : t("csvStatusReady")}
                            </span>
                          </div>
                        ))}

                        {csvImportPreview.rows.length > 20 && (
                          <p className="text-xs text-gray-500">
                            {t("csvPreviewMoreRows", {
                              count: csvImportPreview.rows.length - 20,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                setNotification={(notificationValue) =>
                  showNotification(
                    notificationValue.type as "success" | "error",
                    notificationValue.message,
                  )
                }
                addMainPassenger={() => handleQuickAdd(1)}
                setPassengers={setBookingPassengers}
                managerMode
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setActiveStep(prefilledLead ? 1 : 2)}
                  className="mono-button mono-button--ghost"
                >
                  {t("back")}
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={bookingPassengers.length === 0}
                  className="mono-button sm:flex-1"
                >
                  {t("reviewBooking")}
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
      </div>

      <MobileFooter
        activeStep={activeStep}
        bookingPassengers={bookingPassengers}
        setActiveStep={setActiveStep}
        selectedTour={props.selectedTour}
        departureDate={props.departureDate}
        totalPrice={totalPrice}
        canAdd={canAdd}
        addPassenger={() => addMultiplePassengers(1)}
        clearAllPassengers={clearAllPassengers}
        handleNextStep={handleNextStep}
        newPassengerRef={newPassengerRef}
        maxPassengers={0}
      />

      {loading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="mono-card px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            <span className="text-sm font-medium text-gray-800">
              {t("processingRequest")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
