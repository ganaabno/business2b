// UserInterface.tsx
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
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
import { SkeletonTable, SkeletonCard } from "../components/Skeleton";
import Notifications from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import TourSelection from "../Parts/TourSelection";
import LeadPassengerForm from "../components/LeadPassengerForm";
import { PassengerList } from "../components/PassengerList";
import { BookingActions } from "../addPassengerComponents/BookingActions";
import BookingSummary from "../Parts/BookingSummary";
import { MobileFooter } from "../components/MobileFooter";
import B2BSeatRequestsPage from "./B2BSeatRequestsPage";
import { useBooking } from "../hooks/useBooking";
import { downloadTemplate } from "../utils/csvUtils";
import { useTours } from "../hooks/useTours";
import { useFlightDataStore } from "../Parts/flightDataStore";
import { useTranslation } from "react-i18next";
import { featureFlags } from "../config/featureFlags";
import {
  getSeatRequestBookingEligibility,
  listSeatRequests,
  type B2BSeatRequestBookingEligibility,
  type B2BSeatRequestRow,
} from "../api/b2b";
import { extractTourDepartureDates } from "../utils/tourDates";
import { getWorkspaceRoleContent } from "../modules/workspace/config/workspaceRoleConfig";
import {
  useWorkspaceProgress,
  type WorkspaceTabKey,
} from "../modules/workspace/hooks/useWorkspaceProgress";
import WorkspaceExperienceHeader from "../modules/workspace/components/WorkspaceExperienceHeader";
import {
  WorkspaceDesktopSectionNav,
  WorkspaceMobileSectionNav,
  type WorkspaceSectionItem,
} from "../modules/workspace/components/WorkspaceSectionNav";
import WorkspaceBookingsPanel from "../modules/workspace/components/WorkspaceBookingsPanel";
import RegisterBlockedCard from "../modules/register/components/RegisterBlockedCard";
import SeatAccessGatePanel from "../modules/register/components/SeatAccessGatePanel";
import PassengerCountPromptModal from "../modules/register/components/PassengerCountPromptModal";
import { ConversationalChat } from "../components/Chat";

const REGISTER_APPROVED_SEAT_REQUEST_STATUSES = new Set([
  "approved_waiting_deposit",
  "confirmed_deposit_paid",
  "completed",
]);

const normalizeSeatRequestStatus = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeDateOnly = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .split("T")[0] || "";

type SeatRequestsNavigationIntent = {
  action: "openPayments";
  seatRequestId: string;
  nonce: number;
};

interface UserInterfaceProps {
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  onLogout?: () => Promise<void>;
  showSeatRequestsTab?: boolean;
  seatRequestsWorkspaceRole?: "subcontractor" | "agent";
  allowRegisterWithSeatRequests?: boolean;
}

export default function UserInterface({
  orders,
  setOrders,
  passengers,
  setPassengers,
  errors,
  showNotification,
  currentUser,
  showSeatRequestsTab = false,
  seatRequestsWorkspaceRole = "subcontractor",
  allowRegisterWithSeatRequests = false,
}: UserInterfaceProps) {
  const { i18n, t } = useTranslation();
  const normalizedLanguage = String(
    i18n.resolvedLanguage || i18n.language || "en",
  ).toLowerCase();
  const isEnglishLanguage = normalizedLanguage.startsWith("en");
  const isMongolianLanguage = normalizedLanguage.startsWith("mn");
  const userRole = currentUser.role || "user";
  const normalizedUserRole = String(currentUser.role || "user")
    .trim()
    .toLowerCase();
  const isPowerUserRole = ["admin", "manager", "superadmin"].includes(
    normalizedUserRole,
  );
  const requestOnlyRegistrationMode =
    showSeatRequestsTab && !allowRegisterWithSeatRequests;
  const isAgentWorkspace = seatRequestsWorkspaceRole === "agent";
  const workspaceRoleKind = isAgentWorkspace ? "agent" : "subcontractor";
  const workspaceRoleContent = useMemo(
    () => getWorkspaceRoleContent(workspaceRoleKind, isMongolianLanguage),
    [isMongolianLanguage, workspaceRoleKind],
  );
  const workspaceInterfaceLabel = workspaceRoleContent.interfaceLabel;
  const workspaceKickerLabel = workspaceRoleContent.kickerLabel;
  const agentRegisterBadgeLabel =
    workspaceRoleContent.registerEnabledBadgeLabel;
  const seatRequestContextEnabled =
    showSeatRequestsTab &&
    allowRegisterWithSeatRequests &&
    ["subcontractor", "agent"].includes(seatRequestsWorkspaceRole);
  const seatRequestTourFilterEnabled =
    seatRequestContextEnabled && !isPowerUserRole;
  const strictSeatAccessBookingEnabled =
    featureFlags.b2bStrictSeatAccessBooking && seatRequestContextEnabled;
  const strictSeatAccessGateVisible =
    strictSeatAccessBookingEnabled && !isPowerUserRole;
  const seatRequestContextNeeded =
    showSeatRequestsTab ||
    strictSeatAccessGateVisible ||
    seatRequestTourFilterEnabled;
  const { tours, refreshTours } = useTours({ userRole });
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [strictSeatRequests, setStrictSeatRequests] = useState<
    B2BSeatRequestRow[]
  >([]);
  const [strictSelectedSeatRequestId, setStrictSelectedSeatRequestId] =
    useState("");
  const [strictSeatRequestEligibility, setStrictSeatRequestEligibility] =
    useState<B2BSeatRequestBookingEligibility | null>(null);
  const [strictGateLoading, setStrictGateLoading] = useState(false);
  const [strictEligibilityLoading, setStrictEligibilityLoading] =
    useState(false);
  const [strictGateError, setStrictGateError] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabKey>(() =>
    showSeatRequestsTab ? "requests" : "register",
  );
  const [seatRequestsNavigationIntent, setSeatRequestsNavigationIntent] =
    useState<SeatRequestsNavigationIntent | null>(null);

  const strictSelectedSeatRequest = useMemo(
    () =>
      strictSeatRequests.find(
        (row) => row.id === strictSelectedSeatRequestId,
      ) || null,
    [strictSeatRequests, strictSelectedSeatRequestId],
  );

  const registerApprovedSeatRequests = useMemo(() => {
    if (!seatRequestTourFilterEnabled) {
      return [];
    }

    return strictSeatRequests
      .filter((row) =>
        REGISTER_APPROVED_SEAT_REQUEST_STATUSES.has(
          normalizeSeatRequestStatus(row.status),
        ),
      )
      .filter((row) => String(row.tour_id || "").trim().length > 0)
      .sort((a, b) => {
        const left = new Date(b.created_at || "").getTime();
        const right = new Date(a.created_at || "").getTime();
        return left - right;
      });
  }, [seatRequestTourFilterEnabled, strictSeatRequests]);

  const registerSeatRequestOptions = useMemo(() => {
    if (!seatRequestTourFilterEnabled) {
      return strictSeatRequests;
    }

    return registerApprovedSeatRequests;
  }, [
    registerApprovedSeatRequests,
    seatRequestTourFilterEnabled,
    strictSeatRequests,
  ]);

  const registerScopedTours = useMemo(() => {
    if (!seatRequestTourFilterEnabled) {
      return tours;
    }

    const allowedDatesByTourId = new Map<string, Set<string>>();
    for (const request of registerApprovedSeatRequests) {
      const tourId = String(request.tour_id || "").trim();
      const travelDate = normalizeDateOnly(request.travel_date);
      if (!tourId || !travelDate) {
        continue;
      }

      const existingDates = allowedDatesByTourId.get(tourId);
      if (existingDates) {
        existingDates.add(travelDate);
      } else {
        allowedDatesByTourId.set(tourId, new Set([travelDate]));
      }
    }

    if (allowedDatesByTourId.size === 0) {
      return [];
    }

    return tours
      .filter((tour) => allowedDatesByTourId.has(String(tour.id || "").trim()))
      .map((tour) => {
        const tourId = String(tour.id || "").trim();
        const allowedDates = allowedDatesByTourId.get(tourId);
        if (!allowedDates || allowedDates.size === 0) {
          return tour;
        }

        const normalizedTourDates = Array.from(
          new Set(
            extractTourDepartureDates(tour).map((value) =>
              normalizeDateOnly(value),
            ),
          ),
        ).filter(Boolean);

        const scopedDates = normalizedTourDates.filter((date) =>
          allowedDates.has(date),
        );

        const normalizedDeparture = normalizeDateOnly(tour.departure_date);
        const scopedDepartureDate = allowedDates.has(normalizedDeparture)
          ? normalizedDeparture
          : scopedDates[0] ||
            Array.from(allowedDates)[0] ||
            tour.departure_date;

        return {
          ...tour,
          dates:
            scopedDates.length > 0 ? scopedDates : Array.from(allowedDates),
          departure_date: scopedDepartureDate,
        };
      });
  }, [registerApprovedSeatRequests, seatRequestTourFilterEnabled, tours]);

  const strictSeatRequestCanRegister =
    !strictSeatAccessGateVisible ||
    Boolean(strictSeatRequestEligibility?.canBook);

  const strictRequestedSeats = Math.max(
    0,
    Math.floor(Number(strictSelectedSeatRequest?.requested_seats || 0) || 0),
  );

  const loadStrictSeatRequests = useCallback(async () => {
    if (!seatRequestContextNeeded) {
      setStrictSeatRequests([]);
      setStrictSelectedSeatRequestId("");
      setStrictSeatRequestEligibility(null);
      setStrictGateError(null);
      return;
    }

    setStrictGateLoading(true);
    setStrictGateError(null);

    try {
      const response = await listSeatRequests();
      const rows = [...(response.data || [])].sort((a, b) => {
        const left = new Date(b.created_at || "").getTime();
        const right = new Date(a.created_at || "").getTime();
        return left - right;
      });

      const approvedRows = rows.filter((row) =>
        REGISTER_APPROVED_SEAT_REQUEST_STATUSES.has(
          normalizeSeatRequestStatus(row.status),
        ),
      );

      setStrictSeatRequests(rows);
      setStrictSelectedSeatRequestId((previousId) => {
        if (previousId && rows.some((row) => row.id === previousId)) {
          return previousId;
        }

        const preferred =
          approvedRows.find(
            (row) =>
              normalizeSeatRequestStatus(row.status) ===
              "confirmed_deposit_paid",
          ) ||
          approvedRows.find(
            (row) => normalizeSeatRequestStatus(row.status) === "completed",
          ) ||
          approvedRows[0] ||
          rows.find((row) => row.status === "confirmed_deposit_paid") ||
          rows.find((row) => row.status === "completed") ||
          rows[0];

        return preferred?.id || "";
      });
    } catch (error: unknown) {
      setStrictSeatRequests([]);
      setStrictSelectedSeatRequestId("");
      setStrictSeatRequestEligibility(null);
      setStrictGateError(
        error instanceof Error
          ? error.message
          : t("seatAccessGateErrorFallback"),
      );
    } finally {
      setStrictGateLoading(false);
    }
  }, [seatRequestContextNeeded, t]);

  useEffect(() => {
    if (!seatRequestContextNeeded || workspaceTab === "bookings") {
      return;
    }

    void loadStrictSeatRequests();
  }, [loadStrictSeatRequests, seatRequestContextNeeded, workspaceTab]);

  useEffect(() => {
    if (!strictSeatAccessGateVisible || !strictSelectedSeatRequestId) {
      setStrictSeatRequestEligibility(null);
      setStrictEligibilityLoading(false);
      return;
    }

    let cancelled = false;
    setStrictEligibilityLoading(true);
    setStrictGateError(null);

    getSeatRequestBookingEligibility(strictSelectedSeatRequestId)
      .then((response) => {
        if (cancelled) return;
        setStrictSeatRequestEligibility(response.data || null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStrictSeatRequestEligibility(null);
        setStrictGateError(
          error instanceof Error
            ? error.message
            : t("seatAccessGateErrorFallback"),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setStrictEligibilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [strictSeatAccessGateVisible, strictSelectedSeatRequestId, t]);

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
    setBookingPassengers,
  } = useBooking({
    tours: registerScopedTours,
    setOrders,
    selectedTour,
    setSelectedTour,
    departureDate,
    setDepartureDate,
    errors,
    setErrors: (newErrors) => setValidationErrors(newErrors),
    currentUser,
    strictSeatAccessGateEnabled: strictSeatAccessGateVisible,
    strictSeatRequestId: strictSelectedSeatRequestId || null,
    strictSeatRequestCanBook: strictSeatRequestCanRegister,
    strictSeatRequestTourId: strictSelectedSeatRequest?.tour_id || null,
    strictSeatRequestTravelDate: strictSelectedSeatRequest?.travel_date || null,
    strictSeatRequestSeats: strictRequestedSeats,
  });

  const strictSelectedSeatUsedSeats = useMemo(
    () =>
      bookingPassengers.reduce(
        (sum, passenger) =>
          sum + Math.max(1, Math.floor(Number(passenger.seat_count || 1) || 1)),
        0,
      ),
    [bookingPassengers],
  );

  const submittedPassengers = useMemo(
    () => passengers.filter((passenger) => passenger.order_id !== ""),
    [passengers],
  );

  const [validationErrors, setValidationErrors] =
    useState<ValidationError[]>(errors);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"bookings" | "leads" | "excel">(
    "bookings",
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
    if (workspaceTab !== "bookings" || activeTab !== "excel") return;
    const loadFlightData = async () => {
      try {
        await fetchFlightData({ mode: "recent", limit: 50 });
      } catch (err: any) {
        showNotification(
          "error",
          `${t("flightDataLoadFailedPrefix")}${err.message}`,
        );
      }
    };

    void loadFlightData();
    const unsubscribe = subscribeToFlightData({ mode: "recent", limit: 50 });
    return unsubscribe;
  }, [
    workspaceTab,
    activeTab,
    fetchFlightData,
    subscribeToFlightData,
    showNotification,
  ]);

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

  useEffect(() => {
    if (activeStep > 1) {
      setWorkspaceTab(requestOnlyRegistrationMode ? "requests" : "register");
    }
  }, [activeStep, requestOnlyRegistrationMode]);

  useEffect(() => {
    if (!showSeatRequestsTab && workspaceTab === "requests") {
      setWorkspaceTab("register");
    }
  }, [showSeatRequestsTab, workspaceTab]);

  useEffect(() => {
    if (workspaceTab !== "register" && showPassengerPrompt) {
      setShowPassengerPrompt(false);
      setPassengerCountInput("");
    }
  }, [
    workspaceTab,
    showPassengerPrompt,
    setShowPassengerPrompt,
    setPassengerCountInput,
  ]);

  const strictRegisterLocked =
    strictSeatAccessGateVisible && !strictSeatRequestCanRegister;
  const registerApprovedToursMissing =
    seatRequestTourFilterEnabled && registerScopedTours.length === 0;
  const approvedSeatRequestCount = useMemo(
    () =>
      strictSeatRequests.filter((request) =>
        REGISTER_APPROVED_SEAT_REQUEST_STATUSES.has(
          normalizeSeatRequestStatus(request.status),
        ),
      ).length,
    [strictSeatRequests],
  );
  const pendingSeatRequestCount = useMemo(
    () =>
      strictSeatRequests.filter(
        (request) => normalizeSeatRequestStatus(request.status) === "pending",
      ).length,
    [strictSeatRequests],
  );
  const urgentSeatRequestCount = useMemo(() => {
    const now = Date.now();
    return strictSeatRequests.filter((request) => {
      const status = normalizeSeatRequestStatus(request.status);
      if (!status.includes("approved") && !status.includes("confirmed")) {
        return false;
      }

      if (!request.deposit_due_at) {
        return false;
      }

      const dueAt = new Date(request.deposit_due_at).getTime();
      if (!Number.isFinite(dueAt)) {
        return false;
      }

      const diff = dueAt - now;
      return diff > 0 && diff <= 60 * 60 * 1000;
    }).length;
  }, [strictSeatRequests]);

  const workspaceSectionItems = useMemo<WorkspaceSectionItem[]>(() => {
    const items: WorkspaceSectionItem[] = [];

    if (showSeatRequestsTab) {
      items.push({
        key: "requests",
        label: t("workspaceGuidedWorkflow"),
        description: isMongolianLanguage
          ? pendingSeatRequestCount > 0
            ? `Түлээгдэж буй хүсэлт (${pendingSeatRequestCount}) - Эхлэхэд clicк хийнэ үү`
            : "Батлагдсан хүсэлтээ аваад аялал сонгоно уу"
          : pendingSeatRequestCount > 0
            ? `Pending approval (${pendingSeatRequestCount}) - Click to continue`
            : "Approved requests - Select tour to continue",
        badge: pendingSeatRequestCount > 0 ? pendingSeatRequestCount : null,
      });

      items.push({
        key: "history",
        label: t("workspaceHistoryPayments"),
        description: isMongolianLanguage
          ? "Хүсэлтийн түүх, төлбөрийн milestone, QPay invoice, төлөлт"
          : "Request history, payment milestones, QPay invoice, transactions",
        badge: null,
      });

      items.push({
        key: "register",
        label: t("workspaceRegisterPassenger"),
        description: isMongolianLanguage
          ? "Аялал сонгоод зорчигчийн мэдээлэл оруулах"
          : "Tour selection → Add passenger details",
        badge: bookingPassengers.length > 0 ? bookingPassengers.length : null,
      });

      items.push({
        key: "bookings",
        label: t("workspaceYourBookings"),
        description: isMongolianLanguage
          ? "Илгээсэн захиалга, lead, excel файл татах"
          : "Submitted bookings → Download leads → Export excel",
        badge:
          submittedPassengers.length > 0 ? submittedPassengers.length : null,
      });

      items.push({
        key: "chatbot",
        label: t("chatbot"),
        description: isMongolianLanguage
          ? "Тооцоо, асуультай туслах"
          : "Calculator, Q&A support",
        badge: null,
      });
    } else {
      items.push({
        key: "register",
        label: t("workspaceRegisterPassenger"),
        description: isMongolianLanguage
          ? "Аялал сонгоод зорчигч бүртгэх"
          : "Select tour and register passengers",
        badge: bookingPassengers.length > 0 ? bookingPassengers.length : null,
      });

      items.push({
        key: "bookings",
        label: t("workspaceYourBookings"),
        description: isMongolianLanguage
          ? "Илгээсэн захиалга"
          : "Submitted bookings",
        badge:
          submittedPassengers.length > 0 ? submittedPassengers.length : null,
      });

      items.push({
        key: "chatbot",
        label: t("chatbot"),
        description: isMongolianLanguage
          ? "Тооцоо, асуультай туслах"
          : "Calculator, Q&A support",
        badge: null,
      });
    }

    return items;
  }, [
    bookingPassengers.length,
    isMongolianLanguage,
    pendingSeatRequestCount,
    showSeatRequestsTab,
    submittedPassengers.length,
    t,
  ]);

  const workspaceTitle =
    workspaceTab === "requests"
      ? t("workspaceGuidedWorkflow")
      : workspaceTab === "history"
        ? t("workspaceHistoryPayments")
        : workspaceTab === "register"
          ? t("workspaceRegisterPassenger")
          : workspaceTab === "chatbot"
            ? t("chatbot")
            : t("workspaceYourBookings");

  const workspaceSubtitle =
    workspaceTab === "requests"
      ? showSeatRequestsTab
        ? isMongolianLanguage
          ? "Access хүсэлт илгээж, менежерээр батлуулна уу"
          : "Submit access request and wait manager approval"
        : t("workspaceSubtitleRequests")
      : workspaceTab === "history"
        ? isMongolianLanguage
          ? "Хүсэлтийн түүх, төлбөрийн milestone, QPay invoice, төлөлт"
          : "Request history, payment milestones, QPay invoice, transactions"
        : workspaceTab === "register"
          ? requestOnlyRegistrationMode
            ? t("workspaceSubtitleRegisterLocked")
            : isMongolianLanguage
              ? "Аялал сонгоод зорчигчийн мэдээлэл оруулна уу"
              : "Select tour and add passenger details"
          : workspaceTab === "chatbot"
            ? isMongolianLanguage
              ? "Тооцоо хийж, асуультай холбоо барих"
              : "Calculate prices and get support"
            : isMongolianLanguage
              ? "Илгээсэн захиалга болон lead мэдээлэл"
              : "Submitted bookings and lead records";

  const workspaceMetrics = useMemo(() => {
    const metrics: Array<{ label: string; value: string | number }> = [
      {
        label: showSeatRequestsTab
          ? isMongolianLanguage
            ? "Хүлээгдэж буй (батлуулалт)"
            : "Pending approval"
          : isMongolianLanguage
            ? "Яаралтай төлбөр"
            : "Urgent payment",
        value: showSeatRequestsTab
          ? pendingSeatRequestCount
          : urgentSeatRequestCount,
      },
      {
        label: isMongolianLanguage ? "Нөөцөлсөн зорчигч" : "Draft passengers",
        value: bookingPassengers.length,
      },
      {
        label: isMongolianLanguage ? "Илгээсэн" : "Submitted",
        value: submittedPassengers.length,
      },
    ];

    return metrics;
  }, [
    bookingPassengers.length,
    isMongolianLanguage,
    pendingSeatRequestCount,
    showSeatRequestsTab,
    submittedPassengers.length,
    urgentSeatRequestCount,
  ]);

  const { progressItems, nextAction } = useWorkspaceProgress({
    isMongolianLanguage,
    showSeatRequestsTab,
    workspaceTab,
    activeStep,
    requestOnlyRegistrationMode,
    strictRegisterLocked,
    registerApprovedToursMissing,
    strictGateLoading,
    strictEligibilityLoading,
    seatRequestCount: strictSeatRequests.length,
    approvedSeatRequestCount,
    bookingPassengersCount: bookingPassengers.length,
    submittedPassengersCount: submittedPassengers.length,
  });

  const scrollToWorkspaceSection = useCallback((sectionId: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const scrollToRegisterStep = useCallback(
    (step: number) => {
      const sectionIdByStep: Record<number, string> = {
        1: "register-step-1-section",
        2: "register-step-2-section",
        3: "register-step-3-section",
        4: "register-step-4-section",
      };
      const safeStep = Math.max(1, Math.min(4, Math.floor(Number(step) || 1)));
      const sectionId = sectionIdByStep[safeStep] || "register-step-1-section";

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          scrollToWorkspaceSection(sectionId);
        }, 120);
      }
    },
    [scrollToWorkspaceSection],
  );

  const runWorkspaceNextAction = useCallback(() => {
    if (nextAction.disabled) {
      return;
    }

    setWorkspaceTab(nextAction.targetTab);

    if (nextAction.targetTab === "register") {
      const targetStep =
        nextAction.targetStep || Math.max(1, Math.min(activeStep, 4));
      if (nextAction.targetStep) {
        setActiveStep(nextAction.targetStep);
      }
      scrollToRegisterStep(targetStep);
      return;
    }

    if (nextAction.targetTab === "requests" && typeof window !== "undefined") {
      window.setTimeout(() => {
        scrollToWorkspaceSection("workspace-requests-section");
      }, 120);
      return;
    }

    if (nextAction.targetTab === "bookings" && typeof window !== "undefined") {
      window.setTimeout(() => {
        scrollToWorkspaceSection("workspace-bookings-section");
      }, 120);
    }
  }, [
    activeStep,
    nextAction,
    scrollToRegisterStep,
    scrollToWorkspaceSection,
    setActiveStep,
  ]);

  const languageToggleActions = (
    <div className="mono-panel p-1 inline-flex items-center gap-1 self-start sm:self-auto">
      <button
        type="button"
        onClick={() => i18n.changeLanguage("en")}
        className={`mono-button ${isEnglishLanguage ? "" : "mono-button--ghost"}`}
      >
        {t("languageEnglish")}
      </button>
      <button
        type="button"
        onClick={() => i18n.changeLanguage("mn")}
        className={`mono-button ${isMongolianLanguage ? "" : "mono-button--ghost"}`}
      >
        {t("languageMongolian")}
      </button>
    </div>
  );

  const workspaceNextActionLabel = isMongolianLanguage
    ? "Одоо хийх зүйл"
    : "Do this next";

  const strictSelectedMetaText = useMemo(() => {
    if (!strictSelectedSeatRequest) {
      return "";
    }

    return t("seatAccessGateRequestMeta", {
      requestNo: strictSelectedSeatRequest.request_no,
      destination: strictSelectedSeatRequest.destination,
      date: strictSelectedSeatRequest.travel_date,
    });
  }, [strictSelectedSeatRequest, t]);

  const strictBundleHealth =
    strictSeatRequestEligibility?.bundleHealth ||
    (strictSeatRequestCanRegister ? "healthy" : "payment_due");

  const strictBundleHealthLabel = useMemo(() => {
    if (strictBundleHealth === "healthy") {
      return t("seatAccessGateHealthHealthy");
    }
    if (strictBundleHealth === "blocked") {
      return t("seatAccessGateHealthBlocked");
    }
    return t("seatAccessGateHealthPaymentDue");
  }, [strictBundleHealth, t]);

  const strictBlockReasonText = useMemo(() => {
    const code = strictSeatRequestEligibility?.blockReasonCode;
    switch (code) {
      case "member_rejected":
        return t("seatAccessGateReasonMemberRejected");
      case "member_cancelled":
        return t("seatAccessGateReasonMemberCancelled");
      case "deposit_timeout":
        return t("seatAccessGateReasonDepositTimeout");
      case "overdue_milestone":
        return t("seatAccessGateReasonOverdueMilestone");
      case "payment_pending":
        return t("seatAccessGateReasonPaymentPending");
      case "booking_not_ready":
        return t("seatAccessGateReasonBookingNotReady");
      default:
        return strictSeatRequestEligibility?.blockMessage || null;
    }
  }, [
    strictSeatRequestEligibility?.blockMessage,
    strictSeatRequestEligibility?.blockReasonCode,
    t,
  ]);

  const strictNextDeadlineText = useMemo(() => {
    const value = strictSeatRequestEligibility?.nextDeadlineAt;
    if (!value) {
      return null;
    }

    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) {
      return null;
    }

    return t("seatAccessGateNextDeadline", {
      date: new Date(timestamp).toLocaleString(),
    });
  }, [strictSeatRequestEligibility?.nextDeadlineAt, t]);

  useEffect(() => {
    if (strictRegisterLocked && activeStep > 1) {
      setActiveStep(1);
    }
  }, [activeStep, setActiveStep, strictRegisterLocked]);

  useEffect(() => {
    if (
      !strictSeatAccessGateVisible ||
      workspaceTab !== "register" ||
      !strictSelectedSeatRequest
    ) {
      return;
    }

    const requestDate = normalizeDateOnly(
      strictSelectedSeatRequest.travel_date,
    );
    const selectedDepartureDate = normalizeDateOnly(departureDate);
    const matchedTour = registerScopedTours.find(
      (tour) =>
        String(tour.id || "") ===
        String(strictSelectedSeatRequest.tour_id || ""),
    );

    const shouldResetStep =
      activeStep > 1 &&
      ((requestDate &&
        selectedDepartureDate &&
        selectedDepartureDate !== requestDate) ||
        (matchedTour && selectedTour && selectedTour !== matchedTour.title));

    if (matchedTour && selectedTour !== matchedTour.title) {
      setSelectedTour(matchedTour.title);
    }

    if (requestDate && selectedDepartureDate !== requestDate) {
      setDepartureDate(requestDate);
    }

    if (shouldResetStep) {
      setActiveStep(1);
    }
  }, [
    activeStep,
    departureDate,
    registerScopedTours,
    selectedTour,
    setActiveStep,
    strictSeatAccessGateVisible,
    strictSelectedSeatRequest,
    workspaceTab,
  ]);

  useEffect(() => {
    if (!seatRequestTourFilterEnabled || workspaceTab !== "register") {
      return;
    }

    if (
      strictSelectedSeatRequestId &&
      !registerSeatRequestOptions.some(
        (row) => row.id === strictSelectedSeatRequestId,
      )
    ) {
      setStrictSelectedSeatRequestId(registerSeatRequestOptions[0]?.id || "");
    }
  }, [
    registerSeatRequestOptions,
    seatRequestTourFilterEnabled,
    strictSelectedSeatRequestId,
    workspaceTab,
  ]);

  useEffect(() => {
    if (!seatRequestTourFilterEnabled || workspaceTab !== "register") {
      return;
    }

    if (registerScopedTours.length === 0) {
      if (selectedTour) {
        setSelectedTour("");
      }
      if (departureDate) {
        setDepartureDate("");
      }
      if (activeStep > 1) {
        setActiveStep(1);
      }
      return;
    }

    const normalizedSelectedTour = selectedTour.trim().toLowerCase();
    const selectedScopedTour = registerScopedTours.find(
      (tour) => tour.title.trim().toLowerCase() === normalizedSelectedTour,
    );

    if (!selectedScopedTour) {
      const fallbackTour = registerScopedTours[0];
      const fallbackDate = normalizeDateOnly(
        extractTourDepartureDates(fallbackTour)[0],
      );

      if (selectedTour !== fallbackTour.title) {
        setSelectedTour(fallbackTour.title);
      }
      if (fallbackDate && normalizeDateOnly(departureDate) !== fallbackDate) {
        setDepartureDate(fallbackDate);
      }
      if (activeStep > 1) {
        setActiveStep(1);
      }
      return;
    }

    const allowedDates = extractTourDepartureDates(selectedScopedTour)
      .map((value) => normalizeDateOnly(value))
      .filter(Boolean);
    const normalizedDeparture = normalizeDateOnly(departureDate);

    if (
      allowedDates.length > 0 &&
      (!normalizedDeparture || !allowedDates.includes(normalizedDeparture))
    ) {
      setDepartureDate(allowedDates[0]);
      if (activeStep > 1) {
        setActiveStep(1);
      }
    }
  }, [
    activeStep,
    departureDate,
    registerScopedTours,
    seatRequestTourFilterEnabled,
    selectedTour,
    workspaceTab,
  ]);

  useEffect(() => {
    if (passengerFormData) {
      const tour = registerScopedTours.find(
        (t) => t.id === passengerFormData.tour_id,
      );
      if (tour) {
        setSelectedTour(tour.title);
        setDepartureDate(passengerFormData.departure_date);
      }
    }
  }, [passengerFormData, registerScopedTours]);

  const handleAddPassengerClick = () => {
    if (!canAdd) {
      showNotification("error", t("cannotAddPassengers"));
      return;
    }
    setShowPassengerPrompt(true);
  };

  const historySectionNavigationIntent =
    useMemo<SeatRequestsNavigationIntent | null>(() => {
      if (workspaceTab !== "history") {
        return null;
      }

      return {
        action: "openPayments",
        seatRequestId: strictSelectedSeatRequestId || "",
        nonce: Date.now(),
      };
    }, [strictSelectedSeatRequestId, workspaceTab]);

  const handleWorkspaceSectionSelect = useCallback(
    (key: WorkspaceTabKey) => {
      setWorkspaceTab(key);
      if (key === "history") {
        setSeatRequestsNavigationIntent(null);
      }
    },
    [setWorkspaceTab],
  );

  return (
    <div className="mono-shell">
      <Notifications
        notification={notification}
        setNotification={setNotification}
      />

      <div className="flex items-start">
        <WorkspaceDesktopSectionNav
          items={workspaceSectionItems}
          activeKey={workspaceTab}
          onSelect={handleWorkspaceSectionSelect}
          title={t("workspaceSections")}
          subtitle={workspaceInterfaceLabel}
        />

        <div className="flex-1">
          <div className="mono-container px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pb-16">
            <WorkspaceMobileSectionNav
              items={workspaceSectionItems}
              activeKey={workspaceTab}
              onSelect={handleWorkspaceSectionSelect}
            />

            <div className="mono-stack">
              {workspaceTab !== "chatbot" && (
                <WorkspaceExperienceHeader
                  kicker={workspaceKickerLabel}
                  title={workspaceTitle}
                  subtitle={workspaceSubtitle}
                  workflowLabel={workspaceRoleContent.workflowLabel}
                  nextActionLabel={workspaceNextActionLabel}
                  badgeLabel={
                    showSeatRequestsTab && approvedSeatRequestCount > 0
                      ? isMongolianLanguage
                        ? `${approvedSeatRequestCount} батлагдсан`
                        : `${approvedSeatRequestCount} approved`
                      : showSeatRequestsTab
                        ? isMongolianLanguage
                          ? "Хүсэлт илгээх шаардлагатай"
                          : "Submit request required"
                        : null
                  }
                  progressItems={progressItems}
                  nextAction={nextAction}
                  onRunNextAction={runWorkspaceNextAction}
                  metrics={workspaceMetrics}
                  rightActions={languageToggleActions}
                />
              )}

              {workspaceTab === "requests" && showSeatRequestsTab && (
                <div id="workspace-requests-section">
                  <B2BSeatRequestsPage
                    currentUser={currentUser}
                    workspaceRole={seatRequestsWorkspaceRole}
                    onContinueToRegister={() => setWorkspaceTab("register")}
                    navigationIntent={seatRequestsNavigationIntent}
                    onNavigationIntentHandled={() =>
                      setSeatRequestsNavigationIntent(null)
                    }
                  />
                </div>
              )}

              {workspaceTab === "history" && showSeatRequestsTab && (
                <div id="workspace-history-section">
                  <B2BSeatRequestsPage
                    currentUser={currentUser}
                    workspaceRole={seatRequestsWorkspaceRole}
                    onContinueToRegister={() => setWorkspaceTab("register")}
                    navigationIntent={historySectionNavigationIntent}
                  />
                </div>
              )}

              {workspaceTab === "register" && requestOnlyRegistrationMode && (
                <RegisterBlockedCard
                  title={t("registrationRequestBasedTitle")}
                  description={t("registrationRequestBasedBody")}
                  ctaLabel={t("goToYourRequests")}
                  onCtaClick={() => setWorkspaceTab("requests")}
                />
              )}

              {workspaceTab === "register" && !requestOnlyRegistrationMode && (
                <>
                  {strictSeatAccessGateVisible && (
                    <SeatAccessGatePanel
                      t={t}
                      strictSeatRequestCanRegister={
                        strictSeatRequestCanRegister
                      }
                      strictBundleHealth={strictBundleHealth}
                      strictBundleHealthLabel={strictBundleHealthLabel}
                      strictSelectedSeatRequestId={strictSelectedSeatRequestId}
                      onSelectSeatRequest={setStrictSelectedSeatRequestId}
                      strictGateLoading={strictGateLoading}
                      strictEligibilityLoading={strictEligibilityLoading}
                      registerSeatRequestOptions={registerSeatRequestOptions}
                      onRefresh={() => {
                        void loadStrictSeatRequests();
                      }}
                      strictSelectedMetaText={strictSelectedMetaText}
                      strictSelectedSeatUsedSeats={strictSelectedSeatUsedSeats}
                      strictRequestedSeats={strictRequestedSeats}
                      hasSelectedSeatRequest={Boolean(
                        strictSelectedSeatRequest,
                      )}
                      strictGateError={strictGateError}
                      strictBlockReasonText={strictBlockReasonText}
                      strictBlockingSeatRequestId={
                        strictSeatRequestEligibility?.blockingSeatRequestId ||
                        null
                      }
                      strictNextDeadlineText={strictNextDeadlineText}
                      strictRegisterLocked={strictRegisterLocked}
                      onOpenRequests={() => setWorkspaceTab("requests")}
                      onOpenBlockingPaymentPlan={(requestId) => {
                        setSeatRequestsNavigationIntent({
                          action: "openPayments",
                          seatRequestId: requestId,
                          nonce: Date.now(),
                        });
                        setWorkspaceTab("requests");
                      }}
                    />
                  )}

                  {registerApprovedToursMissing && (
                    <RegisterBlockedCard
                      title={t("seatAccessGateNoApprovedTitle")}
                      description={t("seatAccessGateNoApprovedBody")}
                      ctaLabel={t("goToYourRequests")}
                      onCtaClick={() => setWorkspaceTab("requests")}
                    />
                  )}

                  {!strictRegisterLocked && !registerApprovedToursMissing && (
                    <>
                      <ProgressSteps activeStep={activeStep} />
                      <ErrorSummary errors={validationErrors} />

                      <PassengerCountPromptModal
                        show={showPassengerPrompt}
                        t={t}
                        passengerCountInput={passengerCountInput}
                        onPassengerCountChange={setPassengerCountInput}
                        onCancel={() => {
                          setShowPassengerPrompt(false);
                          setPassengerCountInput("");
                        }}
                        onConfirm={() => {
                          setShowPassengerPrompt(false);
                          setPassengerCountInput("");
                          newPassengerRef.current?.scrollIntoView({
                            behavior: "smooth",
                          });
                        }}
                      />

                      {/* STEP 1: TOUR SELECTION */}
                      {activeStep === 1 && (
                        <div
                          id="register-step-1-section"
                          className="animate-fadeIn"
                        >
                          <TourSelection
                            tours={registerScopedTours}
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
                        <div id="register-step-2-section">
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
                        </div>
                      )}

                      {/* STEP 3: PASSENGER LIST */}
                      {activeStep === 3 && (
                        <div id="register-step-3-section">
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
                                      {t("bookingDetails")}
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
                                          ? t("passengerSingular")
                                          : t("passengerPlural")}
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
                                          {t("seatsLeft", {
                                            count: remainingSeats,
                                          })}
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
                            roomTypes={[
                              "Single",
                              "Double",
                              "Twin",
                              "Family",
                              "King",
                            ]}
                            hotels={availableHotels}
                            setNotification={() => {}}
                            addMainPassenger={() => addMultiplePassengers(1)}
                            setPassengers={setBookingPassengers}
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
                              {t("back")}
                            </button>
                            <button
                              onClick={handleNextStep}
                              disabled={bookingPassengers.length === 0}
                              className="mono-button w-full sm:flex-1"
                            >
                              {t("reviewBooking")}
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
                        </div>
                      )}

                      {/* STEP 4: BOOKING SUMMARY */}
                      {activeStep === 4 && (
                        <div id="register-step-4-section">
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
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {workspaceTab === "bookings" && (
                <WorkspaceBookingsPanel
                  t={t}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  submittedPassengers={submittedPassengers}
                  orders={orders}
                  tours={tours}
                  currentUser={currentUser}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  showNotification={showNotification}
                  setActiveStep={setActiveStep}
                  setLeadPassengerData={setLeadPassengerData}
                  setLeadPassengerFormData={setLeadPassengerFormData}
                  flightData={flightData}
                />
              )}

              {workspaceTab === "chatbot" && (
                <div className="h-[calc(100vh-12rem)]">
                  <ConversationalChat />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {workspaceTab === "register" &&
        !requestOnlyRegistrationMode &&
        !strictRegisterLocked &&
        !registerApprovedToursMissing && (
          <MobileFooter
            activeStep={activeStep}
            bookingPassengers={bookingPassengers}
            setActiveStep={setActiveStep}
            selectedTour={selectedTour}
            departureDate={departureDate}
            totalPrice={totalPrice}
            canAdd={canAdd}
            addPassenger={handleAddPassengerClick}
            clearAllPassengers={clearAllPassengers}
            handleNextStep={handleNextStep}
            newPassengerRef={newPassengerRef}
            maxPassengers={0}
          />
        )}

      {loading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="mono-card px-6 py-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="text-gray-900">{t("processingRequest")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
