import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import {
  fetchToursFromGlobalApi,
  isGlobalApiEnabled,
} from "../api/globalTravel";
import {
  checkQPayInvoiceStatus,
  createBindingRequest,
  createDepositIntent,
  createQPayInvoiceIntent,
  createSeatAccessRequest,
  getB2BApiFeatureFlagsPublic,
  getProfileOverview,
  getSeatRequestPayments,
  listB2BTourDestinations,
  listSeatAccessRequests,
  listSeatRequests,
  previewSeatAccessSerialSelection,
  searchB2BTours,
  selectTourFromSeatAccessRequest,
} from "../api/b2b";
import type {
  B2BBindingRequestRow,
  B2BDepositIntent,
  B2BPaymentMilestoneRow,
  B2BProfileOverview,
  B2BQPayInvoiceIntent,
  B2BSeatAccessRequestRow,
  B2BSeatAccessSerialPreview,
  B2BSeatRequestPayments,
  B2BSeatRequestRow,
  B2BTourSearchRow,
} from "../api/b2b";
import { featureFlags } from "../config/featureFlags";
import type { User } from "../types/type";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import SeatRequestStatusNotice from "../modules/seatRequests/components/SeatRequestStatusNotice";
import SeatAccessRequestCard from "../modules/seatRequests/components/SeatAccessRequestCard";
import RecentAccessRequestsPanel from "../modules/seatRequests/components/RecentAccessRequestsPanel";
import LoadMoreListFooter from "../modules/seatRequests/components/LoadMoreListFooter";
import { useLoadMorePagination } from "../modules/seatRequests/hooks/useLoadMorePagination";

type Props = {
  currentUser: User;
  workspaceRole?: WorkspaceRole;
  onContinueToRegister?: () => void;
  navigationIntent?: SeatRequestsNavigationIntent | null;
  onNavigationIntentHandled?: () => void;
};
type BindingRole = "subcontractor" | "agent";
type WorkspaceRole = "subcontractor" | "agent";
type SeatRequestsNavigationIntent = {
  action: "openPayments";
  seatRequestId: string;
  nonce: number;
};
type SeatWorkflowPhase =
  | "blocked"
  | "needs_access"
  | "awaiting_approval"
  | "ready_to_select"
  | "payment_expired"
  | "payment_due"
  | "paid_register_open";

type PaymentConfirmationState = {
  provider: string;
  amountMnt: number;
  checkedAt: string;
  externalTxnId: string | null;
  milestoneCode: string | null;
};

const DEFAULT_DECLINE_MESSAGE =
  "Sorry your request has been declined, try again after a while.";
const SEAT_FLOW_DISABLED_MESSAGE =
  "B2B seat request backend flag is OFF. Set B2B_SEAT_REQUEST_FLOW_ENABLED=true and restart backend.";
const ACCESS_REQUEST_ROLE_REQUIRED_MESSAGE =
  "Only subcontractor, agent, admin, or manager can submit seat access requests.";
const DEPOSIT_PER_SEAT_MNT = 50000;
const SERIAL_COUNT_OPTIONS = [10, 11, 12] as const;
const DEPOSIT_SKIP_THRESHOLD_DAYS = 30;
const ACCESS_APPROVAL_TTL_MS = 6 * 60 * 60 * 1000;
const TOUR_LIST_BATCH_SIZE = 10;
const HISTORY_LIST_BATCH_SIZE = 12;
const allowGlobalDestinationFallback =
  String(import.meta.env.VITE_B2B_DESTINATION_GLOBAL_FALLBACK || "true")
    .trim()
    .toLowerCase() !== "false";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function bindingStatusClass(status: B2BBindingRequestRow["status"]) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function accessStatusClass(status: B2BSeatAccessRequestRow["status"]) {
  if (status === "approved" || status === "consumed") {
    return "bg-green-100 text-green-700";
  }
  if (status === "rejected" || status === "expired") {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-100 text-amber-700";
}

function requestStatusClass(status: string) {
  if (status.includes("rejected") || status.includes("cancelled")) {
    return "bg-red-100 text-red-700";
  }
  if (
    status.includes("approved") ||
    status.includes("confirmed") ||
    status === "completed"
  ) {
    return "bg-green-100 text-green-700";
  }
  return "bg-amber-100 text-amber-700";
}

function requestStatusLabel(request: B2BSeatRequestRow, useMongolian = false) {
  const normalized = String(request.status || "").toLowerCase();
  if (normalized === "approved_waiting_deposit") {
    if (!request.deposit_due_at) {
      return useMongolian
        ? "Батлагдсан - шаталсан хувьт төлбөр эхэлсэн"
        : "Approved - percentage milestones active";
    }

    return useMongolian
      ? "Батлагдсан - эхний төлбөр 6 цагт"
      : "Approved - first payment due in 6h";
  }
  if (normalized === "cancelled_expired") {
    return useMongolian
      ? "Цуцлагдсан - 6 цагийн төлбөрийн хугацаа хэтэрсэн"
      : "Declined - 6h payment timeout";
  }
  return String(request.status || "-").replaceAll("_", " ");
}

function toRoleLabel(role: BindingRole, useMongolian = false) {
  if (role === "agent") {
    return useMongolian ? "Агент" : "Agent";
  }

  return useMongolian ? "Туслан гүйцэтгэгч" : "SubContractor";
}

function accessStatusLabel(
  status: B2BSeatAccessRequestRow["status"],
  useMongolian = false,
) {
  if (!useMongolian) {
    return status;
  }

  switch (status) {
    case "pending":
      return "Хүлээгдэж байна";
    case "approved":
      return "Батлагдсан";
    case "rejected":
      return "Татгалзсан";
    case "consumed":
      return "Ашиглагдсан";
    case "expired":
      return "Хугацаа дууссан";
    default:
      return status;
  }
}

function bindingStatusLabel(
  status: B2BBindingRequestRow["status"],
  useMongolian = false,
) {
  if (!useMongolian) {
    return status;
  }

  switch (status) {
    case "pending":
      return "Хүлээгдэж байна";
    case "approved":
      return "Батлагдсан";
    case "rejected":
      return "Татгалзсан";
    default:
      return status;
  }
}

function paymentStateLabel(state: string | null, useMongolian = false) {
  const normalized = String(state || "unpaid").toLowerCase();
  if (!useMongolian) {
    return normalized;
  }

  if (normalized === "paid") {
    return "төлөгдсөн";
  }

  if (normalized === "partial") {
    return "хэсэгчлэн төлсөн";
  }

  return "төлөгдөөгүй";
}

function formatMnt(value: number) {
  return `${Math.round(value).toLocaleString()} MNT`;
}

function paymentMilestoneLabel(code: string, useMongolian = false) {
  const normalized = String(code || "").toLowerCase();
  switch (normalized) {
    case "deposit_6h":
      return useMongolian
        ? "Эхний төлбөр (6 цагийн дотор)"
        : "First payment (within 6h)";
    case "reconfirm_100k_if_gt_30d":
      return useMongolian
        ? "Дахин баталгаажуулалт (+100,000 MNT/суудал, 21+ хоног)"
        : "Reconfirm (+100,000 MNT/seat for 21+ days)";
    case "min_paid_30pct_at_21d":
      return useMongolian
        ? "T-20 өдөрт 30%-иас багагүй төлсөн байх (14-20 хоногийн өмнө)"
        : "Minimum 30% paid by T-20d (14-20 days out)";
    case "min_paid_50pct_at_14d":
      return useMongolian
        ? "T-14 өдөрт 50%-иас багагүй төлсөн байх (10-14 хоногийн өмнө)"
        : "Minimum 50% paid by T-14d (10-14 days out)";
    case "min_paid_100pct_at_10d":
      return useMongolian
        ? "T-9 өдөрт 100% төлсөн байх (9-өөс бага хоног)"
        : "Minimum 100% paid by T-9d (under 9 days)";
    default:
      return code;
  }
}

function normalizeQPayQrImageSrc(qrImage: string | null | undefined) {
  const value = String(qrImage || "").trim();
  if (!value) {
    return null;
  }

  if (
    value.startsWith("data:image/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

function resolveQPayShortUrl(raw: Record<string, unknown> | null | undefined) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidates = [
    raw.qPay_shortUrl,
    raw.qpay_short_url,
    raw.short_url,
    raw.shortUrl,
    raw.invoice_url,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value.startsWith("https://") || value.startsWith("http://")) {
      return value;
    }
  }

  return null;
}

function formatCountdown(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h:${String(minutes).padStart(2, "0")}m:${String(seconds).padStart(2, "0")}s`;
}

function countdownMeta(
  dueAt: string | null,
  nowMs: number,
  useMongolian = false,
) {
  if (!dueAt) {
    return {
      label: "-",
      className: "text-gray-500",
    };
  }

  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) {
    return {
      label: dueAt,
      className: "text-gray-700",
    };
  }

  const diff = dueTime - nowMs;
  if (diff <= 0) {
    return {
      label: useMongolian ? "Хугацаа дууссан" : "Expired",
      className: "text-red-700 font-semibold",
    };
  }

  if (diff <= 10 * 60 * 1000) {
    return {
      label: useMongolian
        ? `${formatCountdown(diff)} үлдсэн`
        : `${formatCountdown(diff)} left`,
      className: "text-red-700 font-semibold",
    };
  }

  if (diff <= 60 * 60 * 1000) {
    return {
      label: useMongolian
        ? `${formatCountdown(diff)} үлдсэн`
        : `${formatCountdown(diff)} left`,
      className: "text-amber-700 font-semibold",
    };
  }

  return {
    label: useMongolian
      ? `${formatCountdown(diff)} үлдсэн`
      : `${formatCountdown(diff)} left`,
    className: "text-gray-700",
  };
}

function resolveAccessApprovalDeadline(
  accessRequest:
    | Pick<B2BSeatAccessRequestRow, "approved_at" | "expires_at">
    | null
    | undefined,
) {
  if (!accessRequest) {
    return null;
  }

  const approvedAtMs = accessRequest.approved_at
    ? new Date(accessRequest.approved_at).getTime()
    : Number.NaN;
  if (Number.isFinite(approvedAtMs)) {
    return new Date(approvedAtMs + ACCESS_APPROVAL_TTL_MS).toISOString();
  }

  const expiresAtMs = accessRequest.expires_at
    ? new Date(accessRequest.expires_at).getTime()
    : Number.NaN;
  if (Number.isFinite(expiresAtMs)) {
    return new Date(expiresAtMs).toISOString();
  }

  return null;
}

function normalizeDateKey(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, 10);
}

function formatDateTime(value: string | null | undefined, fallback = "-") {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  const timestamp = new Date(text).getTime();
  if (Number.isNaN(timestamp)) {
    return text;
  }

  return new Date(timestamp).toLocaleString();
}

function createClientRequestKey() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function parseDateOnlyUtcMs(value: string | null | undefined) {
  const normalized = normalizeDateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function daysUntilTravelDate(
  value: string | null | undefined,
  nowMs = Date.now(),
) {
  const targetMs = parseDateOnlyUtcMs(value);
  if (targetMs === null) {
    return null;
  }

  const todayKey = new Date(nowMs).toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(todayMs)) {
    return null;
  }

  return Math.floor((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

function shouldUseDepositForTravelDate(
  travelDate: string | null | undefined,
  nowMs = Date.now(),
) {
  const daysUntilTravel = daysUntilTravelDate(travelDate, nowMs);
  if (daysUntilTravel === null) {
    return true;
  }
  return daysUntilTravel > DEPOSIT_SKIP_THRESHOLD_DAYS;
}

function recommendedNearTourPercent(
  travelDate: string | null | undefined,
  nowMs = Date.now(),
) {
  const daysUntilTravel = daysUntilTravelDate(travelDate, nowMs);
  if (daysUntilTravel !== null && daysUntilTravel <= 9) {
    return 100;
  }
  if (daysUntilTravel !== null && daysUntilTravel <= 14) {
    return 50;
  }
  return 30;
}

function milestoneDueAtMs(value: string | null | undefined) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function isDueAtExpired(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) {
    return false;
  }

  const dueMs = new Date(value).getTime();
  return Number.isFinite(dueMs) && dueMs <= nowMs;
}

function pickNextPayableMilestone(
  milestones: B2BPaymentMilestoneRow[] | null | undefined,
  nowMs: number,
) {
  const unpaid = (milestones || []).filter(
    (milestone) => String(milestone.status || "").toLowerCase() !== "paid",
  );

  if (unpaid.length === 0) {
    return null;
  }

  const overdue = unpaid.filter((milestone) => {
    if (!milestone.due_at) {
      return false;
    }
    const due = new Date(milestone.due_at).getTime();
    return Number.isFinite(due) && due <= nowMs;
  });

  if (overdue.length > 0) {
    return overdue.reduce((best, current) => {
      const bestRequired = Number(best.required_cumulative_mnt || 0);
      const currentRequired = Number(current.required_cumulative_mnt || 0);

      if (currentRequired > bestRequired) {
        return current;
      }

      if (currentRequired < bestRequired) {
        return best;
      }

      return milestoneDueAtMs(current.due_at) < milestoneDueAtMs(best.due_at)
        ? current
        : best;
    });
  }

  return [...unpaid].sort(
    (a, b) => milestoneDueAtMs(a.due_at) - milestoneDueAtMs(b.due_at),
  )[0];
}

function seatRequestIsTerminal(status: string) {
  const normalized = String(status || "").toLowerCase();
  return (
    normalized === "completed" ||
    normalized === "rejected" ||
    normalized.includes("cancelled")
  );
}

function seatRequestNeedsDepositTimer(request: B2BSeatRequestRow) {
  if (!request.deposit_due_at) return false;
  if (request.payment_state === "paid") return false;
  return !seatRequestIsTerminal(request.status);
}

function recommendedSeatCount(
  plannedSeats: number | string | null | undefined,
  availableSeats: number | string | null | undefined,
) {
  const planned = Math.max(0, Math.floor(Number(plannedSeats || 0) || 0));
  const available = Math.max(0, Math.floor(Number(availableSeats || 0) || 0));

  if (available <= 0) return 1;
  if (planned > 0) return Math.min(planned, available);
  return 1;
}

export default function B2BSeatRequestsPage({
  currentUser,
  workspaceRole,
  onContinueToRegister,
  navigationIntent,
  onNavigationIntentHandled,
}: Props) {
  const { i18n } = useTranslation();
  const normalizedLanguage = String(
    i18n.resolvedLanguage || i18n.language || "en",
  ).toLowerCase();
  const isMongolianLanguage = normalizedLanguage.startsWith("mn");
  const tr = useCallback(
    (english: string, mongolian: string) =>
      isMongolianLanguage ? mongolian : english,
    [isMongolianLanguage],
  );

  const [requests, setRequests] = useState<B2BSeatRequestRow[]>([]);
  const [accessRequests, setAccessRequests] = useState<
    B2BSeatAccessRequestRow[]
  >([]);
  const [profile, setProfile] = useState<B2BProfileOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [selectionSubmitting, setSelectionSubmitting] = useState(false);
  const [bindingSubmitting, setBindingSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessFormInlineError, setAccessFormInlineError] = useState<
    string | null
  >(null);
  const [selectionInlineError, setSelectionInlineError] = useState<
    string | null
  >(null);
  const [
    recentlySubmittedAccessRequestId,
    setRecentlySubmittedAccessRequestId,
  ] = useState("");
  const [backendSeatFlowEnabled, setBackendSeatFlowEnabled] = useState<
    boolean | null
  >(null);
  const [backendSerialEnforcementEnabled, setBackendSerialEnforcementEnabled] =
    useState(true);
  const isSeatFlowDisabled = backendSeatFlowEnabled === false;
  const [workspaceTab, setWorkspaceTab] = useState<"yourRequests" | "history">(
    "yourRequests",
  );
  const [historyView, setHistoryView] = useState<
    "access" | "seat" | "payments"
  >("payments");
  const [tours, setTours] = useState<B2BTourSearchRow[]>([]);
  const [selectedAccessRequestId, setSelectedAccessRequestId] = useState("");
  const [selectedSeatRequestId, setSelectedSeatRequestId] = useState("");
  const [expandedRecentAccessRequestId, setExpandedRecentAccessRequestId] =
    useState("");
  const [selectedTour, setSelectedTour] = useState<B2BTourSearchRow | null>(
    null,
  );
  const [requestedSeats, setRequestedSeats] = useState(1);
  const [selectedSerialCount, setSelectedSerialCount] = useState<number>(10);
  const [serialPreview, setSerialPreview] =
    useState<B2BSeatAccessSerialPreview | null>(null);
  const [serialPreviewLoading, setSerialPreviewLoading] = useState(false);
  const [serialPreviewError, setSerialPreviewError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [paymentDetails, setPaymentDetails] =
    useState<B2BSeatRequestPayments | null>(null);
  const [depositIntent, setDepositIntent] = useState<B2BDepositIntent | null>(
    null,
  );
  const [qpayInvoice, setQPayInvoice] = useState<B2BQPayInvoiceIntent | null>(
    null,
  );
  const [qpayStatusChecking, setQPayStatusChecking] = useState(false);
  const [lastPaymentConfirmation, setLastPaymentConfirmation] =
    useState<PaymentConfirmationState | null>(null);
  const [tourFilters, setTourFilters] = useState({
    minSeats: "",
    minPrice: "",
    maxPrice: "",
  });
  const [destinationOptions, setDestinationOptions] = useState<string[]>([]);
  const [lastKnownDestinationOptions, setLastKnownDestinationOptions] =
    useState<string[]>([]);
  const [destinationOptionsSource, setDestinationOptionsSource] = useState<
    "exact" | "current_window" | "broad" | "global_api" | "none"
  >("none");
  const [accessForm, setAccessForm] = useState({
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      .toISOString()
      .slice(0, 10),
    destination: "",
    plannedSeats: "1",
    note: "",
  });
  const [adminRequestedRole, setAdminRequestedRole] = useState<BindingRole>(
    workspaceRole || "subcontractor",
  );
  const [debouncedTourFilters] = useDebounce(tourFilters, 350);
  const [debouncedAccessForm] = useDebounce(accessForm, 350);
  const [debouncedRequestedSeats] = useDebounce(requestedSeats, 250);
  const [debouncedSelectedSerialCount] = useDebounce(selectedSerialCount, 250);
  const cacheRef = useRef<Record<string, B2BTourSearchRow[]>>({});
  const destinationCacheRef = useRef<Record<string, string[]>>({});
  const qpayStatusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectionIdempotencyRef = useRef<{ fingerprint: string; key: string }>({
    fingerprint: "",
    key: "",
  });

  const defaultBindingRole = useMemo<BindingRole>(() => {
    if (workspaceRole) {
      return workspaceRole;
    }

    return currentUser.role === "provider" || currentUser.role === "agent"
      ? "agent"
      : "subcontractor";
  }, [currentUser.role, workspaceRole]);

  const [bindingForm, setBindingForm] = useState<{
    merchantCode: string;
    requestedRole: BindingRole;
    note: string;
  }>({
    merchantCode: "",
    requestedRole: defaultBindingRole,
    note: "",
  });

  const effectiveDestinationOptions = useMemo(
    () =>
      destinationOptions.length > 0
        ? destinationOptions
        : lastKnownDestinationOptions,
    [destinationOptions, lastKnownDestinationOptions],
  );

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setBindingForm((prev) => ({ ...prev, requestedRole: defaultBindingRole }));
  }, [defaultBindingRole]);

  useEffect(() => {
    if (workspaceRole) {
      setAdminRequestedRole(workspaceRole);
    }
  }, [workspaceRole]);

  const selectedAccessRequest = useMemo(() => {
    return (
      accessRequests.find(
        (row) =>
          row.id === selectedAccessRequestId && row.status === "approved",
      ) ||
      accessRequests.find((row) => row.status === "approved") ||
      null
    );
  }, [accessRequests, selectedAccessRequestId]);

  const approvedAccessCount = useMemo(
    () => accessRequests.filter((row) => row.status === "approved").length,
    [accessRequests],
  );
  const hasApprovedAccess = approvedAccessCount > 0;
  const latestRejectedAccess = useMemo(
    () => accessRequests.find((row) => row.status === "rejected") || null,
    [accessRequests],
  );
  const pendingAccessCount = useMemo(
    () => accessRequests.filter((row) => row.status === "pending").length,
    [accessRequests],
  );
  const recentAccessRequests = useMemo(
    () => accessRequests.slice(0, 5),
    [accessRequests],
  );

  useEffect(() => {
    if (recentAccessRequests.length === 0) {
      if (expandedRecentAccessRequestId) {
        setExpandedRecentAccessRequestId("");
      }
      return;
    }

    if (
      expandedRecentAccessRequestId &&
      recentAccessRequests.some((row) => row.id === expandedRecentAccessRequestId)
    ) {
      return;
    }

    if (
      recentlySubmittedAccessRequestId &&
      recentAccessRequests.some(
        (row) => row.id === recentlySubmittedAccessRequestId,
      )
    ) {
      setExpandedRecentAccessRequestId(recentlySubmittedAccessRequestId);
      return;
    }

    setExpandedRecentAccessRequestId(recentAccessRequests[0]?.id || "");
  }, [
    expandedRecentAccessRequestId,
    recentAccessRequests,
    recentlySubmittedAccessRequestId,
  ]);

  const latestActiveTourRequestByTourDate = useMemo(() => {
    const byKey = new Map<string, B2BSeatRequestRow>();

    requests.forEach((request) => {
      if (seatRequestIsTerminal(request.status)) {
        return;
      }

      const tourId = String(request.tour_id || "").trim();
      const travelDate = normalizeDateKey(request.travel_date);
      if (!tourId || !travelDate) {
        return;
      }

      const key = `${tourId}::${travelDate}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, request);
        return;
      }

      const existingTime = new Date(existing.created_at).getTime();
      const currentTime = new Date(request.created_at).getTime();
      if (Number.isNaN(existingTime) || currentTime > existingTime) {
        byKey.set(key, request);
      }
    });

    return byKey;
  }, [requests]);
  const liveDepositTimers = useMemo(
    () =>
      requests
        .filter((request) => seatRequestNeedsDepositTimer(request))
        .sort((a, b) => {
          const aTime = new Date(a.deposit_due_at || "").getTime();
          const bTime = new Date(b.deposit_due_at || "").getTime();
          return aTime - bTime;
        })
        .slice(0, 5),
    [requests],
  );
  const effectiveMinSeatsFilter = useMemo(() => {
    const manualMinSeats = Number(tourFilters.minSeats || 0);
    if (Number.isFinite(manualMinSeats) && manualMinSeats > 0) {
      return String(Math.floor(manualMinSeats));
    }

    const plannedSeats = Number(selectedAccessRequest?.planned_seats || 0);
    if (Number.isFinite(plannedSeats) && plannedSeats > 0) {
      return String(Math.floor(plannedSeats));
    }

    return "";
  }, [tourFilters.minSeats, selectedAccessRequest]);
  const declineMessage =
    latestRejectedAccess?.decision_reason?.trim() ||
    tr(
      DEFAULT_DECLINE_MESSAGE,
      "Уучлаарай, таны хүсэлт татгалзагдлаа. Дараа дахин оролдоно уу.",
    );
  const depositIntentCountdown = useMemo(
    () =>
      countdownMeta(depositIntent?.dueAt || null, nowMs, isMongolianLanguage),
    [depositIntent?.dueAt, nowMs, isMongolianLanguage],
  );
  const selectedAccessApprovalDeadline = useMemo(
    () => resolveAccessApprovalDeadline(selectedAccessRequest),
    [selectedAccessRequest?.approved_at, selectedAccessRequest?.expires_at],
  );
  const selectedAccessExpiryCountdown = useMemo(
    () =>
      countdownMeta(selectedAccessApprovalDeadline, nowMs, isMongolianLanguage),
    [selectedAccessApprovalDeadline, nowMs, isMongolianLanguage],
  );
  const selectedTourDateKey = normalizeDateKey(selectedTour?.departure_date);
  const selectedTourAvailableSeats = Math.max(
    0,
    Math.floor(Number(selectedTour?.available_seats || 0) || 0),
  );
  const selectedTourUnitPriceMnt = Math.max(
    0,
    Number(selectedTour?.base_price || 0) || 0,
  );
  const recommendedRequestedSeats = useMemo(
    () =>
      recommendedSeatCount(
        selectedAccessRequest?.planned_seats,
        selectedTourAvailableSeats,
      ),
    [selectedAccessRequest?.planned_seats, selectedTourAvailableSeats],
  );
  const requestedSeatsExceedsAvailability =
    Boolean(selectedTour) &&
    selectedTourAvailableSeats > 0 &&
    requestedSeats > selectedTourAvailableSeats;
  const serialCountOptions = useMemo<number[]>(
    () => (backendSerialEnforcementEnabled ? [...SERIAL_COUNT_OPTIONS] : [1]),
    [backendSerialEnforcementEnabled],
  );
  const selectedSerialCountSupported =
    serialCountOptions.includes(selectedSerialCount);
  const serialBundleEnabled = selectedSerialCount > 1;
  const selectedTourUsesDepositStep = useMemo(
    () =>
      serialBundleEnabled ||
      shouldUseDepositForTravelDate(selectedTour?.departure_date, nowMs),
    [serialBundleEnabled, selectedTour?.departure_date, nowMs],
  );
  const normalizedRequestedSeats = Math.max(
    1,
    Math.floor(Number(requestedSeats) || 1),
  );
  const backendFirstPaymentMnt = Number(serialPreview?.first_payment_mnt || 0);
  const estimatedTotalMnt = normalizedRequestedSeats * selectedTourUnitPriceMnt;
  const estimatedDepositMnt = selectedTourUsesDepositStep
    ? backendFirstPaymentMnt > 0
      ? backendFirstPaymentMnt
      : normalizedRequestedSeats *
        DEPOSIT_PER_SEAT_MNT *
        (serialBundleEnabled ? selectedSerialCount : 1)
    : 0;
  const estimatedFirstMilestonePercent = selectedTourUsesDepositStep
    ? null
    : recommendedNearTourPercent(selectedTour?.departure_date, nowMs);
  const estimatedFirstMilestoneMnt =
    estimatedFirstMilestonePercent === null
      ? 0
      : Math.round(estimatedTotalMnt * (estimatedFirstMilestonePercent / 100));
  const hasActiveTourFilters =
    Boolean(tourFilters.minSeats.trim()) ||
    Boolean(tourFilters.minPrice.trim()) ||
    Boolean(tourFilters.maxPrice.trim());
  const serialPreviewTours = serialPreview?.chain || [];
  const serialPreviewReady =
    !serialBundleEnabled ||
    Boolean(
      serialPreview &&
      serialPreview.ready &&
      serialPreview.chain.length >= selectedSerialCount,
    );
  const serialPreviewMatchesSelection =
    !serialBundleEnabled ||
    Boolean(
      serialPreview &&
      serialPreview.access_request_id === selectedAccessRequest?.id &&
      serialPreview.serial_count === selectedSerialCount &&
      serialPreview.requested_seats === normalizedRequestedSeats &&
      serialPreview.chain[0]?.tour_id === selectedTour?.id &&
      normalizeDateKey(serialPreview.chain[0]?.travel_date) ===
        selectedTourDateKey,
    );
  const serialPreviewSeatShortage =
    serialBundleEnabled &&
    serialPreviewTours.some((tour) => !tour.enough_seats);
  const seatSelectionFingerprint = useMemo(() => {
    if (!selectedAccessRequest || !selectedTour || !selectedTourDateKey) {
      return "";
    }

    return [
      selectedAccessRequest.id,
      selectedTour.id,
      selectedTourDateKey,
      normalizedRequestedSeats,
      selectedSerialCount,
    ].join("|");
  }, [
    normalizedRequestedSeats,
    selectedAccessRequest,
    selectedSerialCount,
    selectedTour,
    selectedTourDateKey,
  ]);

  useEffect(() => {
    if (!seatSelectionFingerprint) {
      selectionIdempotencyRef.current = {
        fingerprint: "",
        key: "",
      };
      return;
    }

    if (
      selectionIdempotencyRef.current.fingerprint === seatSelectionFingerprint
    ) {
      return;
    }

    selectionIdempotencyRef.current = {
      fingerprint: seatSelectionFingerprint,
      key: createClientRequestKey(),
    };
  }, [seatSelectionFingerprint]);

  useEffect(() => {
    if (
      isSeatFlowDisabled ||
      !selectedAccessRequest ||
      !selectedTour ||
      !selectedTourDateKey
    ) {
      setSerialPreview(null);
      setSerialPreviewError("");
      setSerialPreviewLoading(false);
      return;
    }

    const requestedSeatsValue = Math.max(
      1,
      Math.floor(Number(debouncedRequestedSeats) || 1),
    );
    const serialCountValue = Math.max(
      1,
      Math.floor(Number(debouncedSelectedSerialCount) || 1),
    );

    let cancelled = false;
    setSerialPreviewLoading(true);
    setSerialPreviewError("");

    void previewSeatAccessSerialSelection(selectedAccessRequest.id, {
      tourId: selectedTour.id,
      travelDate: selectedTourDateKey,
      requestedSeats: requestedSeatsValue,
      serialCount: serialCountValue,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setSerialPreview(response.data || null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setSerialPreview(null);
        setSerialPreviewError(
          getErrorMessage(
            error,
            tr(
              "Failed to preview serial tours. Please refresh and retry.",
              "Serial аяллыг урьдчилан шалгаж чадсангүй. Хуудсаа шинэчлээд дахин оролдоно уу.",
            ),
          ),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setSerialPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedRequestedSeats,
    debouncedSelectedSerialCount,
    isSeatFlowDisabled,
    selectedAccessRequest,
    selectedTour,
    selectedTourDateKey,
    tr,
  ]);
  const qpayQrImageSrc = useMemo(
    () => normalizeQPayQrImageSrc(qpayInvoice?.qrImage),
    [qpayInvoice?.qrImage],
  );
  const qpayShortUrl = useMemo(
    () => resolveQPayShortUrl(qpayInvoice?.raw),
    [qpayInvoice?.raw],
  );
  const paidPayments = useMemo(
    () =>
      (paymentDetails?.payments || []).filter(
        (row) => String(row.status || "").toLowerCase() === "paid",
      ),
    [paymentDetails?.payments],
  );
  const paidTotalMnt = useMemo(
    () =>
      paidPayments.reduce((sum, row) => {
        const amount = Number(row.amount_mnt || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [paidPayments],
  );
  const sortedPaymentMilestones = useMemo(
    () =>
      [...(paymentDetails?.milestones || [])].sort((a, b) => {
        const aTime = a.due_at
          ? new Date(a.due_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.due_at
          ? new Date(b.due_at).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    [paymentDetails?.milestones],
  );
  const nextUnpaidMilestone = useMemo(
    () => pickNextPayableMilestone(sortedPaymentMilestones, nowMs),
    [sortedPaymentMilestones, nowMs],
  );
  const nextMilestoneExpired = useMemo(
    () => isDueAtExpired(nextUnpaidMilestone?.due_at, nowMs),
    [nextUnpaidMilestone?.due_at, nowMs],
  );
  const hasPaymentMilestones = sortedPaymentMilestones.length > 0;
  const allMilestonesPaid = hasPaymentMilestones && !nextUnpaidMilestone;
  const totalPaymentPlanMnt = useMemo(
    () =>
      sortedPaymentMilestones.reduce((maxValue, milestone) => {
        const required = Number(milestone.required_cumulative_mnt || 0);
        if (!Number.isFinite(required)) {
          return maxValue;
        }
        return Math.max(maxValue, required);
      }, 0),
    [sortedPaymentMilestones],
  );
  const nextMilestoneAmountToPayMnt = useMemo(() => {
    if (!nextUnpaidMilestone) {
      return 0;
    }

    const required = Number(nextUnpaidMilestone.required_cumulative_mnt || 0);
    if (!Number.isFinite(required)) {
      return 0;
    }

    return Math.max(0, Math.round(required - paidTotalMnt));
  }, [nextUnpaidMilestone, paidTotalMnt]);
  const nextMilestonePercentOfTotal = useMemo(() => {
    if (!nextUnpaidMilestone || !(totalPaymentPlanMnt > 0)) {
      return null;
    }

    const required = Number(nextUnpaidMilestone.required_cumulative_mnt || 0);
    if (!(Number.isFinite(required) && required > 0)) {
      return null;
    }

    const percentage = (required / totalPaymentPlanMnt) * 100;
    const bounded = Math.max(0, Math.min(100, percentage));
    return Math.round(bounded * 10) / 10;
  }, [nextUnpaidMilestone, totalPaymentPlanMnt]);
  const paidPercentOfTotal = useMemo(() => {
    if (!(totalPaymentPlanMnt > 0)) {
      return 0;
    }

    const percentage = (paidTotalMnt / totalPaymentPlanMnt) * 100;
    const bounded = Math.max(0, Math.min(100, percentage));
    return Math.round(bounded * 10) / 10;
  }, [paidTotalMnt, totalPaymentPlanMnt]);
  const nextMilestoneUrgency = useMemo(() => {
    const dueAt = nextUnpaidMilestone?.due_at;
    if (!dueAt) {
      return {
        containerClass: "border-indigo-200 bg-indigo-50",
        badgeClass: "bg-indigo-100 text-indigo-800",
        badgeText: tr("Next Action", "Дараагийн үйлдэл"),
      };
    }

    const dueMs = new Date(dueAt).getTime();
    if (Number.isNaN(dueMs)) {
      return {
        containerClass: "border-indigo-200 bg-indigo-50",
        badgeClass: "bg-indigo-100 text-indigo-800",
        badgeText: tr("Next Action", "Дараагийн үйлдэл"),
      };
    }

    const diff = dueMs - nowMs;
    if (diff <= 0) {
      return {
        containerClass: "border-red-200 bg-red-50",
        badgeClass: "bg-red-100 text-red-800",
        badgeText: tr("Expired", "Хугацаа дууссан"),
      };
    }

    if (diff <= 60 * 60 * 1000) {
      return {
        containerClass: "border-red-200 bg-red-50",
        badgeClass: "bg-red-100 text-red-800",
        badgeText: tr("Urgent", "Яаралтай"),
      };
    }

    if (diff <= 6 * 60 * 60 * 1000) {
      return {
        containerClass: "border-amber-200 bg-amber-50",
        badgeClass: "bg-amber-100 text-amber-800",
        badgeText: tr("Due Soon", "Удахгүй төлөх"),
      };
    }

    return {
      containerClass: "border-indigo-200 bg-indigo-50",
      badgeClass: "bg-indigo-100 text-indigo-800",
      badgeText: tr("Next Action", "Дараагийн үйлдэл"),
    };
  }, [nextUnpaidMilestone?.due_at, nowMs, tr]);
  const nextMilestoneCountdown = useMemo(
    () =>
      countdownMeta(
        nextUnpaidMilestone?.due_at || null,
        nowMs,
        isMongolianLanguage,
      ),
    [nextUnpaidMilestone?.due_at, nowMs, isMongolianLanguage],
  );
  const paymentSuccessState = lastPaymentConfirmation;

  const selectedHistorySeatRequest = useMemo(
    () => requests.find((row) => row.id === selectedSeatRequestId) || null,
    [requests, selectedSeatRequestId],
  );

  const historyActionSummary = useMemo(() => {
    if (requests.length === 0) {
      return {
        panelClass: "border-gray-200 bg-gray-50 text-gray-800",
        badgeClass: "mono-badge",
        badgeLabel: tr("No active request", "Идэвхтэй хүсэлт алга"),
        title: tr(
          "Create your first seat request",
          "Эхний seat request-ээ үүсгэнэ үү",
        ),
        description: tr(
          "Open Your Requests and send one access request to start the flow.",
          "Урсгалаа эхлүүлэхийн тулд Your Requests хэсгээс access хүсэлт илгээнэ үү.",
        ),
        ctaLabel: tr("Open Your Requests", "Your Requests нээх"),
        action: "openRequests" as const,
        disabled: false,
      };
    }

    if (!selectedSeatRequestId || !selectedHistorySeatRequest) {
      return {
        panelClass: "border-amber-300 bg-amber-50 text-amber-900",
        badgeClass: "mono-badge mono-badge--warning",
        badgeLabel: tr("Select request", "Хүсэлт сонгох"),
        title: tr(
          "Choose a seat request to continue",
          "Үргэлжлүүлэхийн тулд seat request-ээ сонгоно уу",
        ),
        description: tr(
          "Pick one request below to load payment milestones and QPay actions.",
          "Төлбөрийн milestone болон QPay үйлдлийг харахын тулд доороос нэг хүсэлт сонгоно уу.",
        ),
        ctaLabel: tr("Select below", "Доороос сонгох"),
        action: "none" as const,
        disabled: true,
      };
    }

    if (paymentLoading) {
      return {
        panelClass: "border-gray-200 bg-gray-50 text-gray-800",
        badgeClass: "mono-badge",
        badgeLabel: tr("Loading", "Ачаалж байна"),
        title: tr("Loading payment plan", "Төлбөрийн төлөв ачаалж байна"),
        description: tr(
          "Please wait while we fetch milestones for the selected request.",
          "Сонгосон хүсэлтийн milestone мэдээллийг ачаалж байна. Түр хүлээнэ үү.",
        ),
        ctaLabel: tr("Please wait", "Түр хүлээнэ үү"),
        action: "none" as const,
        disabled: true,
      };
    }

    if (nextMilestoneExpired && nextUnpaidMilestone) {
      return {
        panelClass: "border-red-300 bg-red-50 text-red-900",
        badgeClass: "mono-badge mono-badge--danger",
        badgeLabel: tr("Deadline expired", "Хугацаа дууссан"),
        title: tr(
          "Payment window has ended",
          "Төлбөр хийх хугацаа дууссан",
        ),
        description: tr(
          "This milestone is no longer payable online. Contact admin/manager to continue this request.",
          "Энэ milestone-ийг онлайнаар төлөх боломжгүй болсон. Хүсэлтээ үргэлжлүүлэх бол админ/менежертэй холбогдоно уу.",
        ),
        ctaLabel: tr("Deadline expired", "Хугацаа дууссан"),
        action: "none" as const,
        disabled: true,
      };
    }

    if (nextUnpaidMilestone) {
      return {
        panelClass: "border-red-300 bg-red-50 text-red-900",
        badgeClass: "mono-badge mono-badge--danger",
        badgeLabel: tr("Payment required", "Төлбөр шаардлагатай"),
        title: tr(
          "Pay next milestone",
          "Дараагийн milestone төлөх",
        ),
        description: tr(
          `${selectedHistorySeatRequest.request_no}: ${formatMnt(nextMilestoneAmountToPayMnt)} · ${nextMilestoneCountdown.label}`,
          `${selectedHistorySeatRequest.request_no}: ${formatMnt(nextMilestoneAmountToPayMnt)} · ${nextMilestoneCountdown.label}`,
        ),
        ctaLabel: tr("Open payment", "Төлбөр нээх"),
        action: "openPayments" as const,
        disabled: false,
      };
    }

    if (allMilestonesPaid) {
      return {
        panelClass: "border-green-300 bg-green-50 text-green-900",
        badgeClass: "mono-badge mono-badge--success",
        badgeLabel: tr("All paid", "Бүгд төлөгдсөн"),
        title: tr(
          `${selectedHistorySeatRequest.request_no}: no pending payment`,
          `${selectedHistorySeatRequest.request_no}: төлөгдөөгүй төлбөр алга`,
        ),
        description: tr(
          "This request payment plan is complete.",
          "Энэ хүсэлтийн төлбөрийн төлөвлөгөө бүрэн дууссан байна.",
        ),
        ctaLabel: tr("View details", "Дэлгэрэнгүй харах"),
        action: "openPayments" as const,
        disabled: false,
      };
    }

    return {
      panelClass: "border-gray-200 bg-gray-50 text-gray-800",
      badgeClass: "mono-badge",
      badgeLabel: tr("Need refresh", "Шинэчлэх шаардлагатай"),
      title: tr("Payment plan data is not ready", "Төлбөрийн төлөвлөгөө бэлэн биш байна"),
      description: tr(
        "Refresh payment details for the selected request.",
        "Сонгосон хүсэлтийн төлбөрийн мэдээллийг шинэчилнэ үү.",
      ),
      ctaLabel: tr("Refresh payment data", "Төлбөрийн мэдээлэл шинэчлэх"),
      action: "refresh" as const,
      disabled: false,
    };
  }, [
    allMilestonesPaid,
    nextMilestoneAmountToPayMnt,
    nextMilestoneCountdown.label,
    nextMilestoneExpired,
    nextUnpaidMilestone,
    paymentLoading,
    requests,
    selectedHistorySeatRequest,
    selectedSeatRequestId,
    tr,
  ]);

  const {
    visibleItems: visibleTours,
    visibleCount: visibleToursCount,
    totalCount: totalToursCount,
    loadMore: loadMoreTours,
  } = useLoadMorePagination(tours, {
    initialCount: TOUR_LIST_BATCH_SIZE,
    step: TOUR_LIST_BATCH_SIZE,
  });

  const {
    visibleItems: visibleAccessHistoryRows,
    visibleCount: visibleAccessHistoryCount,
    totalCount: totalAccessHistoryCount,
    loadMore: loadMoreAccessHistory,
  } = useLoadMorePagination(accessRequests, {
    initialCount: HISTORY_LIST_BATCH_SIZE,
    step: HISTORY_LIST_BATCH_SIZE,
  });

  const {
    visibleItems: visibleSeatHistoryRows,
    visibleCount: visibleSeatHistoryCount,
    totalCount: totalSeatHistoryCount,
    loadMore: loadMoreSeatHistory,
  } = useLoadMorePagination(requests, {
    initialCount: HISTORY_LIST_BATCH_SIZE,
    step: HISTORY_LIST_BATCH_SIZE,
  });

  const recentBindingRequests = profile?.bindingRequests || [];

  const activeAgentPoints = useMemo(() => {
    return Number(currentUser.membership_points || 0);
  }, [currentUser.membership_points]);
  const normalizedCurrentRole = String(currentUser.role || "").toLowerCase();
  const isEmployeeSubmitter =
    normalizedCurrentRole === "subcontractor" ||
    normalizedCurrentRole === "agent";
  const isAdminWorkspaceSubmitter =
    normalizedCurrentRole === "admin" ||
    normalizedCurrentRole === "superadmin" ||
    normalizedCurrentRole === "manager";
  const effectiveAccessRequestedRole: BindingRole = isEmployeeSubmitter
    ? (normalizedCurrentRole as BindingRole)
    : adminRequestedRole;
  const canSubmitAccessRequest =
    !isSeatFlowDisabled && (isEmployeeSubmitter || isAdminWorkspaceSubmitter);
  const hasValidRequestedSeats =
    Number.isInteger(requestedSeats) && requestedSeats > 0;
  const canConfirmSeatRequest =
    Boolean(selectedTour) &&
    selectedSerialCountSupported &&
    hasValidRequestedSeats &&
    !requestedSeatsExceedsAvailability &&
    !serialPreviewLoading &&
    serialPreviewMatchesSelection &&
    serialPreviewReady &&
    !serialPreviewSeatShortage &&
    !serialPreviewError &&
    !selectionSubmitting &&
    !isSeatFlowDisabled;
  const confirmBlockers = useMemo(() => {
    if (canConfirmSeatRequest) {
      return [] as string[];
    }

    const blockers: string[] = [];

    if (isSeatFlowDisabled) {
      blockers.push(
        tr(
          "Seat request flow is currently disabled on backend.",
          "Seat request flow одоогоор backend дээр унтраалттай байна.",
        ),
      );
    }

    if (!selectedSerialCountSupported) {
      blockers.push(
        tr(
          "Selected serial count is not supported by backend settings.",
          "Сонгосон serial тоо backend тохиргоонд дэмжигдээгүй байна.",
        ),
      );
    }

    if (!hasValidRequestedSeats) {
      blockers.push(
        tr(
          "Requested seats must be a positive integer.",
          "Суудлын тоо 0-ээс их бүхэл тоо байх ёстой.",
        ),
      );
    }

    if (requestedSeatsExceedsAvailability) {
      blockers.push(
        tr(
          "Requested seats exceed available seats for selected tour.",
          "Хүссэн суудлын тоо сонгосон аяллын үлдэгдлээс их байна.",
        ),
      );
    }

    if (serialPreviewLoading) {
      blockers.push(
        tr(
          "Serial preview is still loading.",
          "Serial урьдчилсан шалгалт ачаалж байна.",
        ),
      );
    }

    if (serialPreviewError) {
      blockers.push(serialPreviewError);
    }

    if (!serialPreviewMatchesSelection) {
      blockers.push(
        tr(
          "Serial preview is outdated for current selection. Please wait for refresh.",
          "Одоогийн сонголтод serial урьдчилсан шалгалт хоцорсон байна. Шинэчлэгдэхийг түр хүлээнэ үү.",
        ),
      );
    }

    if (!serialPreviewReady) {
      blockers.push(
        tr(
          "Serial chain is incomplete. Choose another departure or lower serial count.",
          "Serial дараалал бүрэн биш байна. Өөр огноо сонгох эсвэл serial тоог бууруулна уу.",
        ),
      );
    }

    if (serialPreviewSeatShortage) {
      blockers.push(
        tr(
          "At least one serial tour has fewer seats than requested.",
          "Serial аяллуудын дор хаяж нэг нь хүссэнээс бага суудалтай байна.",
        ),
      );
    }

    if (selectionSubmitting) {
      blockers.push(
        tr(
          "Submission is in progress. Please wait.",
          "Илгээж байна. Түр хүлээнэ үү.",
        ),
      );
    }

    return blockers;
  }, [
    canConfirmSeatRequest,
    hasValidRequestedSeats,
    isSeatFlowDisabled,
    requestedSeatsExceedsAvailability,
    selectedSerialCountSupported,
    selectionSubmitting,
    serialPreviewError,
    serialPreviewLoading,
    serialPreviewMatchesSelection,
    serialPreviewReady,
    serialPreviewSeatShortage,
    tr,
  ]);

  const hasAnyPendingPayment = useMemo(
    () =>
      requests.some((request) => {
        if (seatRequestIsTerminal(request.status)) {
          return false;
        }

        return (
          String(request.payment_state || "unpaid").toLowerCase() !== "paid"
        );
      }),
    [requests],
  );

  const workflowPhase = useMemo<SeatWorkflowPhase>(() => {
    if (isSeatFlowDisabled) {
      return "blocked";
    }

    if (nextMilestoneExpired) {
      return "payment_expired";
    }

    if (nextUnpaidMilestone || hasAnyPendingPayment) {
      return "payment_due";
    }

    if (requests.length > 0) {
      return "paid_register_open";
    }

    if (!hasApprovedAccess && accessRequests.length === 0) {
      return "needs_access";
    }

    if (!hasApprovedAccess) {
      return "awaiting_approval";
    }

    return "ready_to_select";
  }, [
    accessRequests.length,
    hasAnyPendingPayment,
    hasApprovedAccess,
    isSeatFlowDisabled,
    nextMilestoneExpired,
    nextUnpaidMilestone,
    requests.length,
  ]);

  const workflowSummary = useMemo(() => {
    const map: Record<
      SeatWorkflowPhase,
      {
        badgeClass: string;
        badgeLabel: string;
        title: string;
        description: string;
        ctaLabel: string;
        action:
          | "openAccess"
          | "openSelection"
          | "openPayments"
          | "goRegister"
          | "openHistory";
      }
    > = {
      blocked: {
        badgeClass: "mono-badge mono-badge--danger",
        badgeLabel: tr("Blocked", "Түгжигдсэн"),
        title: tr(
          "Seat request workflow is unavailable",
          "Seat request урсгал боломжгүй байна",
        ),
        description: tr(
          "Please ask admin to enable seat request flow in backend settings.",
          "Backend тохиргоонд seat request урсгалыг асаахыг админаас хүснэ үү.",
        ),
        ctaLabel: tr("Open History", "Түүх нээх"),
        action: "openHistory",
      },
      needs_access: {
        badgeClass: "mono-badge mono-badge--warning",
        badgeLabel: tr("Step 1", "Алхам 1"),
        title: tr(
          "Send access request",
          "Access хүсэлт илгээх",
        ),
        description: tr(
          "Fill date range, destination, and planned seats for manager/admin approval.",
          "Менежер/админаар батлуулахын тулд огноо, чиглэл, төлөвлөсөн суудлаа оруулна уу.",
        ),
        ctaLabel: tr("Open Access Form", "Access form руу орох"),
        action: "openAccess",
      },
      awaiting_approval: {
        badgeClass: "mono-badge mono-badge--warning",
        badgeLabel: tr("Pending", "Хүлээгдэж буй"),
        title: tr("Waiting for approval", "Баталгаажуулалт хүлээж байна"),
        description: tr(
          "Request is sent. After approval, you can pick a tour and confirm seats.",
          "Хүсэлт илгээгдсэн. Батлагдсаны дараа аяллаа сонгож суудлаа баталгаажуулна.",
        ),
        ctaLabel: tr("Review Requests", "Хүсэлтээ шалгах"),
        action: "openAccess",
      },
      ready_to_select: {
        badgeClass: "mono-badge",
        badgeLabel: tr("Step 2", "Алхам 2"),
        title: tr(
          "Choose approved request and tour",
          "Батлагдсан хүсэлт ба аяллаа сонгох",
        ),
        description: tr(
          "Select one approved window, then choose matching tour and seat count.",
          "Нэг батлагдсан хүрээг сонгоод тохирох аялал, суудлын тоогоо сонгоно уу.",
        ),
        ctaLabel: tr("Open Tour Selection", "Аялал сонголт руу орох"),
        action: "openSelection",
      },
      payment_expired: {
        badgeClass: "mono-badge mono-badge--danger",
        badgeLabel: tr("Expired", "Хугацаа дууссан"),
        title: tr("Payment deadline expired", "Төлбөрийн хугацаа дууссан"),
        description: tr(
          "This milestone can no longer be paid online. Contact admin/manager to continue.",
          "Энэ milestone-ийг онлайнаар цааш төлөх боломжгүй. Үргэлжлүүлэх бол админ/менежертэй холбогдоно уу.",
        ),
        ctaLabel: tr("Open Payment Details", "Төлбөрийн дэлгэрэнгүй нээх"),
        action: "openPayments",
      },
      payment_due: {
        badgeClass: "mono-badge mono-badge--warning",
        badgeLabel: tr("Payment pending", "Төлбөр хүлээгдэж"),
        title: tr("Continue to payment", "Төлбөр хийх"),
        description: tr(
          "Go to History & Payments to view and complete payment.",
          "Түүх ба төлбөрүүд хэсэг рүү орж төлбөрөө хийнэ үү.",
        ),
        ctaLabel: tr("Go to Payments", "Төлбөр рүү очих"),
        action: "openPayments",
      },
      paid_register_open: {
        badgeClass: "mono-badge mono-badge--success",
        badgeLabel: tr("Ready", "Бэлэн"),
        title: tr("Passenger registration is open", "Зорчигч бүртгэл нээлттэй"),
        description: tr(
          "Your payment requirement is met. Continue to passenger registration.",
          "Төлбөрийн шаардлага хангагдсан. Зорчигч бүртгэл рүү шилжинэ үү.",
        ),
        ctaLabel: tr("Continue to Register", "Бүртгэл рүү шилжих"),
        action: "goRegister",
      },
    };

    return map[workflowPhase];
  }, [tr, workflowPhase]);

  const workflowSteps = useMemo(
    () => [
      {
        key: "access",
        label: tr("1. Access request", "1. Access хүсэлт"),
        hint: tr("Submit and get approved", "Илгээж батлуулах"),
        status:
          workflowPhase === "blocked"
            ? "pending"
            : workflowPhase === "needs_access" ||
                workflowPhase === "awaiting_approval"
              ? "active"
              : "done",
      },
      {
        key: "selection",
        label: tr("2. Tour selection", "2. Аялал сонголт"),
        hint: tr("Choose tour and seats", "Аялал, суудал сонгох"),
        status:
          workflowPhase === "ready_to_select"
            ? "active"
            : workflowPhase === "needs_access" ||
                workflowPhase === "awaiting_approval"
              ? "pending"
              : "done",
      },
      {
        key: "payment",
        label: tr("3. Payment", "3. Төлбөр"),
        hint: tr("Pay due milestone", "Milestone төлөх"),
        status:
          workflowPhase === "payment_due" || workflowPhase === "payment_expired"
            ? "active"
            : workflowPhase === "paid_register_open"
              ? "done"
              : "pending",
      },
    ],
    [tr, workflowPhase],
  );

  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const runWorkflowSummaryAction = useCallback(() => {
    if (workflowSummary.action === "openAccess") {
      setWorkspaceTab("yourRequests");
      scrollToSection("seat-access-request-section");
      return;
    }

    if (workflowSummary.action === "openSelection") {
      setWorkspaceTab("yourRequests");
      scrollToSection("approved-request-search-section");
      return;
    }

    if (workflowSummary.action === "openPayments") {
      setWorkspaceTab("history");
      setHistoryView("payments");
      if (!selectedSeatRequestId && requests[0]?.id) {
        setSelectedSeatRequestId(requests[0].id);
      }
      scrollToSection("payment-milestones-section");
      return;
    }

    if (workflowSummary.action === "goRegister") {
      onContinueToRegister?.();
      return;
    }

    setWorkspaceTab("history");
    setHistoryView("payments");
  }, [
    onContinueToRegister,
    requests,
    scrollToSection,
    selectedSeatRequestId,
    workflowSummary.action,
  ]);

  const loadBase = useCallback(
    async (options?: { silent?: boolean }) => {
      setLoading(true);
      setErrorMessage("");
      try {
        const flagsRes = await getB2BApiFeatureFlagsPublic().catch(() => null);
        const flagsPayload =
          (
            flagsRes as {
              data?: {
                b2bSeatRequestFlowEnabled?: boolean;
                b2bSerialEnforcementEnabled?: boolean;
              };
            } | null
          )?.data ??
          (flagsRes as {
            b2bSeatRequestFlowEnabled?: boolean;
            b2bSerialEnforcementEnabled?: boolean;
          } | null);
        const seatFlowEnabled = flagsPayload?.b2bSeatRequestFlowEnabled;
        const serialEnforcementEnabled =
          flagsPayload?.b2bSerialEnforcementEnabled;

        if (serialEnforcementEnabled === false) {
          setBackendSerialEnforcementEnabled(false);
        } else if (serialEnforcementEnabled === true) {
          setBackendSerialEnforcementEnabled(true);
        }

        if (seatFlowEnabled === false) {
          setBackendSeatFlowEnabled(false);
          const message = tr(
            SEAT_FLOW_DISABLED_MESSAGE,
            "B2B суудлын хүсэлтийн backend flag OFF байна. B2B_SEAT_REQUEST_FLOW_ENABLED=true болгож backend-аа restart хийнэ үү.",
          );
          setRequests([]);
          setAccessRequests([]);
          setTours([]);
          setProfile(null);
          setErrorMessage(message);
          return;
        }

        if (seatFlowEnabled === true) {
          setBackendSeatFlowEnabled(true);
        }

        const [reqRes, profileRes, accessRes] = await Promise.all([
          listSeatRequests(),
          featureFlags.b2bRoleV2Enabled
            ? getProfileOverview().catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
          listSeatAccessRequests(),
        ]);

        setRequests(reqRes.data || []);
        setProfile(profileRes.data || null);
        setAccessRequests(accessRes.data || []);
      } catch (error: unknown) {
        const message = getErrorMessage(
          error,
          tr(
            "Failed to load B2B seat workflow data",
            "B2B суудлын процессын өгөгдлийг ачаалж чадсангүй",
          ),
        );
        setErrorMessage(message);
        if (!options?.silent) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [tr],
  );

  const loadPaymentDetails = useCallback(async (seatRequestId: string) => {
    if (!seatRequestId) return;
    setPaymentLoading(true);
    try {
      const [paymentsResponse, depositResponse] = await Promise.all([
        getSeatRequestPayments(seatRequestId),
        createDepositIntent(seatRequestId).catch(() => null),
      ]);

      setPaymentDetails(
        paymentsResponse.data || { milestones: [], payments: [] },
      );
      setDepositIntent(depositResponse?.data || null);
    } catch (error: unknown) {
      setPaymentDetails(null);
      setDepositIntent(null);
      toast.error(
        getErrorMessage(
          error,
          tr(
            "Failed to load payment milestones",
            "Төлбөрийн шатны мэдээллийг ачаалж чадсангүй",
          ),
        ),
      );
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  const stopQPayStatusPolling = useCallback(() => {
    if (qpayStatusPollRef.current) {
      clearInterval(qpayStatusPollRef.current);
      qpayStatusPollRef.current = null;
    }
  }, []);

  const refreshPaymentViews = useCallback(
    async (seatRequestId: string) => {
      await Promise.all([
        loadBase({ silent: true }),
        loadPaymentDetails(seatRequestId),
      ]);
    },
    [loadBase, loadPaymentDetails],
  );

  const checkQPayInvoicePaymentStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!selectedSeatRequestId || !qpayInvoice) {
        return false;
      }

      if (nextMilestoneExpired) {
        if (!options?.silent) {
          toast.error(
            tr(
              "Payment deadline has expired. Contact admin or manager to continue.",
              "Төлбөрийн хугацаа дууссан. Үргэлжлүүлэх бол админ эсвэл менежертэй холбогдоно уу.",
            ),
          );
        }
        return false;
      }

      const invoiceId = String(qpayInvoice.invoiceId || "").trim();
      const senderInvoiceNo = String(qpayInvoice.senderInvoiceNo || "").trim();

      if (!invoiceId && !senderInvoiceNo) {
        return false;
      }

      if (!options?.silent) {
        setQPayStatusChecking(true);
      }

      try {
        const response = await checkQPayInvoiceStatus(selectedSeatRequestId, {
          invoiceId: invoiceId || undefined,
          senderInvoiceNo: senderInvoiceNo || undefined,
        });

        const normalizedStatus = String(
          response.data?.status || "",
        ).toLowerCase();
        if (normalizedStatus === "paid") {
          stopQPayStatusPolling();
          setQPayInvoice(null);
          setLastPaymentConfirmation({
            provider: String(response.data?.provider || "qpay"),
            amountMnt: Math.max(
              0,
              Math.round(Number(response.data?.amountMnt || 0)),
            ),
            checkedAt: String(
              response.data?.checkedAt || new Date().toISOString(),
            ),
            externalTxnId:
              String(response.data?.externalTxnId || "").trim() || null,
            milestoneCode:
              String(response.data?.milestoneCode || "").trim() || null,
          });
          await refreshPaymentViews(selectedSeatRequestId);

          if (!options?.silent) {
            toast.success(
              tr(
                "Payment confirmed. Milestones are refreshed.",
                "Төлбөр баталгаажлаа. Milestone мэдээлэл шинэчлэгдлээ.",
              ),
            );
          }

          return true;
        }

        return false;
      } catch (error: unknown) {
        if (!options?.silent) {
          toast.error(
            getErrorMessage(
              error,
              tr(
                "Failed to check QPay payment",
                "QPay төлбөр шалгаж чадсангүй",
              ),
            ),
          );
        }
        return false;
      } finally {
        if (!options?.silent) {
          setQPayStatusChecking(false);
        }
      }
    },
    [
      nextMilestoneExpired,
      qpayInvoice,
      refreshPaymentViews,
      selectedSeatRequestId,
      stopQPayStatusPolling,
      tr,
    ],
  );

  const runHistoryPrimaryAction = useCallback(() => {
    if (historyActionSummary.action === "openRequests") {
      setWorkspaceTab("yourRequests");
      return;
    }

    if (historyActionSummary.action === "openPayments") {
      setHistoryView("payments");
      if (!selectedSeatRequestId && requests[0]?.id) {
        setSelectedSeatRequestId(requests[0].id);
      }
      scrollToSection("payment-milestones-section");
      return;
    }

    if (historyActionSummary.action === "refresh") {
      if (selectedSeatRequestId) {
        void loadPaymentDetails(selectedSeatRequestId);
      } else {
        void loadBase({ silent: true });
      }
    }
  }, [
    historyActionSummary.action,
    loadBase,
    loadPaymentDetails,
    requests,
    scrollToSection,
    selectedSeatRequestId,
  ]);

  const openRecentRequestPayments = useCallback(
    (seatRequestId: string) => {
      const normalizedSeatRequestId = String(seatRequestId || "").trim();
      if (!normalizedSeatRequestId) {
        return;
      }

      setWorkspaceTab("history");
      setHistoryView("payments");
      setSelectedSeatRequestId(normalizedSeatRequestId);

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          scrollToSection("payment-milestones-section");
        });
      }
    },
    [scrollToSection],
  );

  const openRecentRequestSelection = useCallback(
    (accessRequestId: string) => {
      const normalizedAccessRequestId = String(accessRequestId || "").trim();
      if (!normalizedAccessRequestId) {
        return;
      }

      setWorkspaceTab("yourRequests");
      setSelectedAccessRequestId(normalizedAccessRequestId);

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          scrollToSection("approved-request-search-section");
        });
      }
    },
    [scrollToSection],
  );

  const openRecentAccessHistory = useCallback(() => {
    setWorkspaceTab("history");
    setHistoryView("access");

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        scrollToSection("seat-request-history-section");
      });
    }
  }, [scrollToSection]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    const pollMs = 45000;
    const runRefresh = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void loadBase({ silent: true });
    };

    const timer = setInterval(runRefresh, pollMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadBase({ silent: true });
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [loadBase]);

  useEffect(() => {
    const from = String(debouncedAccessForm.fromDate || "").trim();
    const to = String(debouncedAccessForm.toDate || "").trim();
    const hasExactRange =
      Boolean(from) &&
      Boolean(to) &&
      new Date(from).getTime() <= new Date(to).getTime();
    const plannedSeats = Number(debouncedAccessForm.plannedSeats || 0);
    const minSeats =
      Number.isInteger(plannedSeats) && plannedSeats > 0
        ? String(Math.floor(plannedSeats))
        : undefined;
    const minSeatsNumber = Math.max(0, Math.floor(Number(minSeats || 0) || 0));

    const now = new Date();
    const fallbackFrom = now.toISOString().slice(0, 10);
    const fallbackTo = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 120)
      .toISOString()
      .slice(0, 10);

    const candidates: Array<{
      source: "exact" | "current_window" | "broad";
      params: { from?: string; to?: string; minSeats?: string };
    }> = [];

    if (hasExactRange) {
      candidates.push({
        source: "exact",
        params: { from, to, minSeats },
      });
    }

    candidates.push({
      source: "current_window",
      params: { from: fallbackFrom, to: fallbackTo, minSeats },
    });

    candidates.push({
      source: "broad",
      params: { minSeats },
    });

    const uniqueCandidates = Array.from(
      new Map(
        candidates.map((candidate) => [
          JSON.stringify({
            from: candidate.params.from || "",
            to: candidate.params.to || "",
            minSeats: candidate.params.minSeats || "",
          }),
          candidate,
        ]),
      ).values(),
    );

    let cancelled = false;

    const resolveDestinationOptions = async () => {
      for (const candidate of uniqueCandidates) {
        const cacheKey = JSON.stringify({
          from: candidate.params.from || "",
          to: candidate.params.to || "",
          minSeats: candidate.params.minSeats || "",
        });

        let options = destinationCacheRef.current[cacheKey];

        if (!options) {
          try {
            const response = await listB2BTourDestinations(candidate.params);
            options = response.data || [];
          } catch {
            options = [];
          }

          destinationCacheRef.current[cacheKey] = options;

          const keys = Object.keys(destinationCacheRef.current);
          if (keys.length > 40) {
            delete destinationCacheRef.current[keys[0]];
          }
        }

        if (cancelled) {
          return;
        }

        if (options.length > 0) {
          setDestinationOptions(options);
          setLastKnownDestinationOptions(options);
          setDestinationOptionsSource(candidate.source);
          return;
        }
      }

      if (allowGlobalDestinationFallback && isGlobalApiEnabled) {
        const globalFallbackKey = JSON.stringify({
          source: "global_api",
          from: hasExactRange ? from : "",
          to: hasExactRange ? to : "",
          minSeats: minSeats || "",
        });

        let globalOptions = destinationCacheRef.current[globalFallbackKey];

        if (!globalOptions) {
          try {
            const globalTours = await fetchToursFromGlobalApi();
            const destinationMap = new Map<string, string>();

            globalTours.forEach((tour) => {
              const availableSeats = Math.max(
                0,
                Math.floor(
                  Number(
                    tour.available_seats ??
                      tour.seats ??
                      (tour as { seat?: number | string }).seat ??
                      0,
                  ) || 0,
                ),
              );
              if (minSeatsNumber > 0 && availableSeats < minSeatsNumber) {
                return;
              }

              const primaryDeparture = normalizeDateKey(
                tour.departure_date ||
                  (Array.isArray(tour.dates) && tour.dates.length > 0
                    ? String(tour.dates[0] || "")
                    : ""),
              );

              if (hasExactRange) {
                if (!primaryDeparture) {
                  return;
                }

                const departureMs = new Date(primaryDeparture).getTime();
                if (Number.isNaN(departureMs)) {
                  return;
                }

                if (
                  departureMs < new Date(from).getTime() ||
                  departureMs > new Date(to).getTime()
                ) {
                  return;
                }
              }

              const label = String(tour.title || tour.country || "").trim();
              if (!label) {
                return;
              }

              const key = label.toLowerCase();
              if (!destinationMap.has(key)) {
                destinationMap.set(key, label);
              }
            });

            globalOptions = Array.from(destinationMap.values()).sort((a, b) =>
              a.localeCompare(b),
            );
          } catch {
            globalOptions = [];
          }

          destinationCacheRef.current[globalFallbackKey] = globalOptions;

          const keys = Object.keys(destinationCacheRef.current);
          if (keys.length > 40) {
            delete destinationCacheRef.current[keys[0]];
          }
        }

        if (cancelled) {
          return;
        }

        if (globalOptions.length > 0) {
          setDestinationOptions(globalOptions);
          setLastKnownDestinationOptions(globalOptions);
          setDestinationOptionsSource("global_api");
          return;
        }
      }

      if (!cancelled) {
        setDestinationOptions([]);
        setDestinationOptionsSource("none");
      }
    };

    void resolveDestinationOptions();

    return () => {
      cancelled = true;
    };
  }, [
    debouncedAccessForm.fromDate,
    debouncedAccessForm.plannedSeats,
    debouncedAccessForm.toDate,
  ]);

  useEffect(() => {
    if (!destinationOptions.length) {
      return;
    }

    const selectedDestination = String(accessForm.destination || "")
      .trim()
      .toLowerCase();
    if (!selectedDestination) {
      return;
    }

    const stillAvailable = destinationOptions.some(
      (option) => option.trim().toLowerCase() === selectedDestination,
    );

    if (!stillAvailable) {
      setAccessForm((prev) => ({ ...prev, destination: "" }));
    }
  }, [accessForm.destination, destinationOptions]);

  useEffect(() => {
    if (!selectedAccessRequest) {
      setTours([]);
      return;
    }

    const key = JSON.stringify({
      accessRequestId: selectedAccessRequest.id,
      from: selectedAccessRequest.from_date,
      to: selectedAccessRequest.to_date,
      destination: selectedAccessRequest.destination,
      minSeats: effectiveMinSeatsFilter,
      minPrice: debouncedTourFilters.minPrice,
      maxPrice: debouncedTourFilters.maxPrice,
    });

    if (cacheRef.current[key]) {
      setTours(cacheRef.current[key]);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    searchB2BTours(
      Object.fromEntries(
        Object.entries({
          accessRequestId: selectedAccessRequest.id,
          from: selectedAccessRequest.from_date,
          to: selectedAccessRequest.to_date,
          destination: selectedAccessRequest.destination,
          minSeats: effectiveMinSeatsFilter,
          minPrice: debouncedTourFilters.minPrice,
          maxPrice: debouncedTourFilters.maxPrice,
        }).filter(([, value]) => value !== ""),
      ) as Record<string, string>,
    )
      .then((res) => {
        if (cancelled) return;
        const data = res.data || [];
        cacheRef.current[key] = data;
        setTours(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTours([]);
          toast.error(
            getErrorMessage(
              error,
              tr("Failed to search tours", "Аялал хайхад алдаа гарлаа"),
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedTourFilters, effectiveMinSeatsFilter, selectedAccessRequest]);

  useEffect(() => {
    if (
      selectedAccessRequest &&
      selectedAccessRequestId !== selectedAccessRequest.id
    ) {
      setSelectedAccessRequestId(selectedAccessRequest.id);
    }
  }, [selectedAccessRequest, selectedAccessRequestId]);

  useEffect(() => {
    setSelectedSerialCount((previous) => {
      if (serialCountOptions.includes(previous)) {
        return previous;
      }

      return serialCountOptions[0] || 1;
    });
  }, [serialCountOptions]);

  useEffect(() => {
    setAccessFormInlineError(null);
  }, [
    accessForm.destination,
    accessForm.fromDate,
    accessForm.plannedSeats,
    accessForm.toDate,
    canSubmitAccessRequest,
    isSeatFlowDisabled,
  ]);

  useEffect(() => {
    setSelectionInlineError(null);
  }, [
    isSeatFlowDisabled,
    requestedSeats,
    serialPreviewError,
    serialPreviewLoading,
    serialPreviewReady,
    serialPreviewSeatShortage,
    selectedAccessRequestId,
    selectedSerialCount,
    selectedTour?.id,
    selectedTourDateKey,
  ]);

  useEffect(() => {
    if (!selectedTour) return;

    const selectedKey = `${selectedTour.id}::${normalizeDateKey(selectedTour.departure_date)}`;
    const stillVisible = tours.some((tour) => {
      const tourKey = `${tour.id}::${normalizeDateKey(tour.departure_date)}`;
      return tourKey === selectedKey;
    });

    if (!stillVisible) {
      setSelectedTour(null);
      setRequestedSeats(1);
    }
  }, [selectedTour, tours]);

  useEffect(() => {
    if (!selectedTour) return;

    setRequestedSeats((previous) => {
      const normalizedPrevious = Math.max(1, Math.floor(Number(previous) || 1));
      if (
        selectedTourAvailableSeats > 0 &&
        normalizedPrevious > selectedTourAvailableSeats
      ) {
        return recommendedRequestedSeats;
      }
      return normalizedPrevious;
    });
  }, [recommendedRequestedSeats, selectedTour, selectedTourAvailableSeats]);

  useEffect(() => {
    if (!navigationIntent || navigationIntent.action !== "openPayments") {
      return;
    }

    const targetSeatRequestId = String(
      navigationIntent.seatRequestId || "",
    ).trim();
    if (!targetSeatRequestId) {
      onNavigationIntentHandled?.();
      return;
    }

    setWorkspaceTab("history");
    setHistoryView("payments");
    setSelectedSeatRequestId(targetSeatRequestId);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const element = document.getElementById("payment-milestones-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    onNavigationIntentHandled?.();
  }, [navigationIntent, onNavigationIntentHandled]);

  useEffect(() => {
    if (requests.length === 0) {
      setSelectedSeatRequestId("");
      setPaymentDetails(null);
      setDepositIntent(null);
      return;
    }

    if (!requests.some((row) => row.id === selectedSeatRequestId)) {
      setSelectedSeatRequestId(requests[0].id);
    }
  }, [requests, selectedSeatRequestId]);

  useEffect(() => {
    if (!selectedSeatRequestId) {
      stopQPayStatusPolling();
      setQPayStatusChecking(false);
      setQPayInvoice(null);
      setLastPaymentConfirmation(null);
      return;
    }

    stopQPayStatusPolling();
    setQPayStatusChecking(false);
    setQPayInvoice(null);
    setLastPaymentConfirmation(null);
    void loadPaymentDetails(selectedSeatRequestId);
  }, [selectedSeatRequestId, loadPaymentDetails, stopQPayStatusPolling]);

  useEffect(() => {
    if (!selectedSeatRequestId || !nextMilestoneExpired) {
      return;
    }

    stopQPayStatusPolling();
    setQPayStatusChecking(false);
    setQPayInvoice(null);
  }, [nextMilestoneExpired, selectedSeatRequestId, stopQPayStatusPolling]);

  useEffect(() => {
    stopQPayStatusPolling();

    if (!selectedSeatRequestId || !qpayInvoice) {
      return;
    }

    const invoiceId = String(qpayInvoice.invoiceId || "").trim();
    const senderInvoiceNo = String(qpayInvoice.senderInvoiceNo || "").trim();
    if (!invoiceId && !senderInvoiceNo) {
      return;
    }

    qpayStatusPollRef.current = setInterval(() => {
      void checkQPayInvoicePaymentStatus({ silent: true });
    }, 5000);

    return () => {
      stopQPayStatusPolling();
    };
  }, [
    checkQPayInvoicePaymentStatus,
    qpayInvoice,
    selectedSeatRequestId,
    stopQPayStatusPolling,
  ]);

  useEffect(() => {
    return () => {
      stopQPayStatusPolling();
    };
  }, [stopQPayStatusPolling]);

  const submitAccessRequest = async () => {
    if (accessSubmitting) return;
    if (isSeatFlowDisabled) {
      setAccessFormInlineError(
        tr(
          SEAT_FLOW_DISABLED_MESSAGE,
          "B2B суудлын хүсэлтийн backend flag OFF байна. B2B_SEAT_REQUEST_FLOW_ENABLED=true болгож backend-аа restart хийнэ үү.",
        ),
      );
      return;
    }
    if (!canSubmitAccessRequest) {
      setAccessFormInlineError(
        tr(
          ACCESS_REQUEST_ROLE_REQUIRED_MESSAGE,
          "Зөвхөн subcontractor, agent, admin эсвэл manager seat access хүсэлт илгээх боломжтой.",
        ),
      );
      return;
    }
    if (!accessForm.destination.trim()) {
      setAccessFormInlineError(
        tr("Destination is required", "Чиглэл заавал шаардлагатай"),
      );
      return;
    }
    const plannedSeats = Number(accessForm.plannedSeats || 0);
    if (!Number.isInteger(plannedSeats) || plannedSeats <= 0) {
      setAccessFormInlineError(
        tr(
          "Planned seats must be a positive integer",
          "Төлөвлөсөн суудлын тоо 0-ээс их бүхэл тоо байх ёстой",
        ),
      );
      return;
    }
    if (
      new Date(accessForm.fromDate).getTime() >
      new Date(accessForm.toDate).getTime()
    ) {
      setAccessFormInlineError(
        tr(
          "From date must be before or equal to To date",
          "Эхлэх огноо нь дуусах огнооноос өмнө эсвэл тэнцүү байх ёстой",
        ),
      );
      return;
    }

    setAccessFormInlineError(null);
    setAccessSubmitting(true);
    try {
      const response = await createSeatAccessRequest({
        fromDate: accessForm.fromDate,
        toDate: accessForm.toDate,
        destination: accessForm.destination.trim(),
        plannedSeats,
        note: accessForm.note.trim() || undefined,
        requestedRole: effectiveAccessRequestedRole,
      });

      if (response.data) {
        setAccessRequests((prev) => [
          response.data,
          ...prev.filter((row) => row.id !== response.data.id),
        ]);
        setRecentlySubmittedAccessRequestId(response.data.id);
      }

      toast.success(
        tr(
          "Request sent to manager/admin for approval",
          "Хүсэлтийг менежер/админд батлуулахаар илгээлээ",
        ),
      );
      setAccessForm((prev) => ({
        ...prev,
        destination: "",
        plannedSeats: "1",
        note: "",
      }));
      await loadBase();
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        tr(
          "Failed to submit seat access request",
          "Seat access хүсэлт илгээж чадсангүй",
        ),
      );
      setAccessFormInlineError(message);
      toast.error(message);
    } finally {
      setAccessSubmitting(false);
    }
  };

  const submitBinding = async () => {
    if (bindingSubmitting) return;

    const merchantCode = bindingForm.merchantCode.trim().toUpperCase();
    if (!merchantCode) {
      toast.error(
        tr("Merchant code is required", "Merchant код заавал шаардлагатай"),
      );
      return;
    }

    setBindingSubmitting(true);
    try {
      await createBindingRequest({
        merchantCode,
        requestedRole: bindingForm.requestedRole,
        note: bindingForm.note.trim() || undefined,
      });
      toast.success(
        tr("Binding request submitted", "Холбох хүсэлтийг илгээлээ"),
      );
      setBindingForm((prev) => ({ ...prev, merchantCode: "", note: "" }));
      await loadBase();
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(
          error,
          tr(
            "Failed to submit binding request",
            "Холбох хүсэлт илгээж чадсангүй",
          ),
        ),
      );
    } finally {
      setBindingSubmitting(false);
    }
  };

  const submitTourSelection = async () => {
    if (selectionSubmitting) return;
    if (isSeatFlowDisabled) {
      setSelectionInlineError(
        tr(
          SEAT_FLOW_DISABLED_MESSAGE,
          "B2B суудлын хүсэлтийн backend flag OFF байна. B2B_SEAT_REQUEST_FLOW_ENABLED=true болгож backend-аа restart хийнэ үү.",
        ),
      );
      return;
    }
    if (!selectedAccessRequest) {
      setSelectionInlineError(
        tr(
          "Choose an approved request first",
          "Эхлээд батлагдсан хүсэлтээ сонгоно уу",
        ),
      );
      return;
    }
    if (!selectedTour) {
      setSelectionInlineError(
        tr("Choose a tour first", "Эхлээд аяллаа сонгоно уу"),
      );
      return;
    }

    const travelDate = normalizeDateKey(selectedTour.departure_date);
    if (!travelDate) {
      setSelectionInlineError(
        tr(
          "Selected tour date is invalid. Refresh and choose again.",
          "Сонгосон аяллын огноо буруу байна. Хуудсаа шинэчлээд дахин сонгоно уу.",
        ),
      );
      return;
    }

    const parsedRequested = Number(requestedSeats || 0);
    const available = Number(selectedTour.available_seats || 0);
    if (!Number.isFinite(parsedRequested) || parsedRequested <= 0) {
      setSelectionInlineError(
        tr(
          "Requested seats must be a positive integer",
          "Захиалах суудлын тоо 0-ээс их бүхэл тоо байх ёстой",
        ),
      );
      return;
    }
    const requested = Math.max(1, Math.floor(parsedRequested));
    if (requested > available) {
      setSelectionInlineError(
        tr("Don't have enough seats", "Хангалттай суудал алга"),
      );
      return;
    }

    if (serialPreviewLoading) {
      setSelectionInlineError(
        tr(
          "Serial preview is still loading. Please wait a moment.",
          "Serial урьдчилсан шалгалт ачаалж байна. Түр хүлээнэ үү.",
        ),
      );
      return;
    }

    if (
      serialPreviewError ||
      !serialPreviewReady ||
      serialPreviewSeatShortage
    ) {
      setSelectionInlineError(
        serialPreviewError ||
          tr(
            "Serial preview is not ready for confirmation. Please review chain availability.",
            "Serial урьдчилсан шалгалт баталгаажихад бэлэн биш байна. Дарааллын боломжоо шалгана уу.",
          ),
      );
      return;
    }

    const idempotencyKey = selectionIdempotencyRef.current.key || undefined;

    setSelectionInlineError(null);
    setSelectionSubmitting(true);
    try {
      const response = await selectTourFromSeatAccessRequest(
        selectedAccessRequest.id,
        {
          tourId: selectedTour.id,
          travelDate,
          requestedSeats: requested,
          serialCount: selectedSerialCount,
          idempotencyKey,
        },
      );

      const hasDepositTimer = Boolean(response.data.deposit_due_at);
      const serialTotal = Math.max(
        1,
        Number(response.data.serial_total || selectedSerialCount || 1),
      );
      const isSerialBundle = serialTotal > 1;
      toast.success(
        isSerialBundle
          ? tr(
              `Serial bundle (${serialTotal} tours) confirmed. First serial payment timer (6h) started.`,
              `${serialTotal} аяллын serial багц баталгаажлаа. Эхний serial төлбөрийн 6 цагийн таймер эхэллээ.`,
            )
          : hasDepositTimer
            ? tr(
                `Seat request ${response.data.request_no} confirmed. First payment timer (6h) started.`,
                `Seat request ${response.data.request_no} баталгаажлаа. Эхний төлбөрийн 6 цагийн таймер эхэллээ.`,
              )
            : tr(
                `Seat request ${response.data.request_no} confirmed. Near departure skips the 6h first-payment timer and starts percentage milestones.`,
                `Seat request ${response.data.request_no} баталгаажлаа. Ойрын огноотой тул эхний төлбөрийн 6 цагийн таймер алгасагдаж, шаталсан хувьт төлбөр эхэллээ.`,
              ),
      );
      if (response.data.idempotency_replayed) {
        toast.info(
          tr(
            "This request was already processed. Showing existing serial bundle result.",
            "Энэ хүсэлт өмнө нь боловсруулагдсан байна. Өмнөх serial багцын үр дүнг харууллаа.",
          ),
        );
      }
      setSelectedTour(null);
      setRequestedSeats(1);
      await loadBase();
      setSelectedSeatRequestId(response.data.id);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        tr(
          "Failed to create seat request from approved access",
          "Батлагдсан access хүсэлтээс seat request үүсгэж чадсангүй",
        ),
      );
      setSelectionInlineError(message);
      toast.error(message);
    } finally {
      setSelectionSubmitting(false);
    }
  };

  const submitQPayInvoice = async () => {
    if (!selectedSeatRequestId || invoiceSubmitting) {
      return;
    }

    if (nextMilestoneExpired) {
      toast.error(
        tr(
          "Payment deadline has expired. Contact admin or manager to continue.",
          "Төлбөрийн хугацаа дууссан. Үргэлжлүүлэх бол админ эсвэл менежертэй холбогдоно уу.",
        ),
      );
      return;
    }

    if (allMilestonesPaid) {
      toast.success(
        tr(
          "All payment milestones are already paid.",
          "Бүх төлбөрийн milestone бүрэн төлөгдсөн байна.",
        ),
      );
      return;
    }

    if (isSeatFlowDisabled) {
      toast.error(
        tr(
          SEAT_FLOW_DISABLED_MESSAGE,
          "B2B суудлын хүсэлтийн backend flag OFF байна. B2B_SEAT_REQUEST_FLOW_ENABLED=true болгож backend-аа restart хийнэ үү.",
        ),
      );
      return;
    }

    setInvoiceSubmitting(true);
    try {
      const response = await createQPayInvoiceIntent(selectedSeatRequestId, {
        milestoneCode: nextUnpaidMilestone?.code,
      });
      if (!response.data) {
        throw new Error(
          tr(
            "QPay invoice response is empty",
            "QPay invoice хариу хоосон байна",
          ),
        );
      }
      setQPayInvoice(response.data);
      toast.success(
        response.data.reusedIntent
          ? tr(
              "Using your existing QPay invoice. Complete payment in the app.",
              "Өмнөх QPay invoice-ийг дахин ашиглаж байна. Аппаар төлбөрөө хийнэ үү.",
            )
          : tr("QPay invoice created", "QPay invoice амжилттай үүслээ"),
      );
      void checkQPayInvoicePaymentStatus({ silent: true });
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(
          error,
          tr("Failed to create QPay invoice", "QPay invoice үүсгэж чадсангүй"),
        ),
      );
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  return (
    <div className="mono-container px-4 pb-24 pt-2 sm:px-6 sm:pb-3 sm:pt-3 lg:px-8 space-y-4">
      <div className="mono-card p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`mono-button ${workspaceTab === "yourRequests" ? "" : "mono-button--ghost"}`}
            onClick={() => setWorkspaceTab("yourRequests")}
          >
            {tr("Guided Workflow", "Чиглүүлсэн урсгал")}
          </button>
          <button
            type="button"
            className={`mono-button ${workspaceTab === "history" ? "" : "mono-button--ghost"}`}
            onClick={() => {
              setWorkspaceTab("history");
              setHistoryView("payments");
            }}
          >
            {tr("History & Payments", "Түүх ба төлбөрүүд")}
          </button>
        </div>
        {errorMessage ? (
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        ) : null}
      </div>

      {workspaceTab === "yourRequests" && (
        <>
          <div className="mono-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className={workflowSummary.badgeClass}>
                  {workflowSummary.badgeLabel}
                </span>
                <p className="mt-2 text-base font-semibold text-gray-900">
                  {workflowSummary.title}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {workflowSummary.description}
                </p>
              </div>
              <button
                type="button"
                className="mono-button mono-button--sm"
                onClick={runWorkflowSummaryAction}
              >
                {workflowSummary.ctaLabel}
              </button>
            </div>
          </div>

          <SeatRequestStatusNotice
            tr={tr}
            hasApprovedAccess={hasApprovedAccess}
            approvedAccessCount={approvedAccessCount}
            showRejectedNotice={Boolean(latestRejectedAccess)}
            declineMessage={declineMessage}
            showAgentPoints={defaultBindingRole === "agent"}
            activeAgentPoints={activeAgentPoints}
          />

          <div className="space-y-4">
          <p className="text-xs text-gray-500 md:hidden">
            {tr("Current step", "Одоогийн алхам")}: {workflowSummary.badgeLabel} -{" "}
            {workflowSummary.title}
          </p>

          <div className="hidden gap-2 md:grid md:grid-cols-3">
            {workflowSteps.map((step) => (
              <div
                key={step.key}
                className={`rounded-lg border px-3 py-2 ${
                  step.status === "done"
                    ? "border-green-300 bg-green-50 text-green-800"
                    : step.status === "active"
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <p className="text-xs font-semibold">{step.label}</p>
                <p className="mt-1 text-[11px] opacity-90">{step.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <SeatAccessRequestCard
                tr={tr}
                accessForm={accessForm}
                setAccessForm={setAccessForm}
                isAdminWorkspaceSubmitter={isAdminWorkspaceSubmitter}
                adminRequestedRole={adminRequestedRole}
                setAdminRequestedRole={setAdminRequestedRole}
                effectiveDestinationOptions={effectiveDestinationOptions}
                destinationOptionsSource={destinationOptionsSource}
                accessSubmitting={accessSubmitting}
                canSubmitAccessRequest={canSubmitAccessRequest}
                inlineError={accessFormInlineError}
                onSubmitAccessRequest={submitAccessRequest}
              />

              <div
                id="approved-request-search-section"
                className="mono-card p-4 sm:p-5 space-y-4"
              >
                <h3 className="font-semibold">
                  {tr(
                    "2) Select Approved Request + Search Tours",
                    "2) Батлагдсан хүсэлт сонгох + Аялал хайх",
                  )}
                </h3>
                {accessRequests.filter((row) => row.status === "approved")
                  .length === 0 ? (
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>
                      {tr(
                        "No approved access requests yet. Ask manager/admin to approve one request first.",
                        "Одоогоор батлагдсан access хүсэлт алга. Эхлээд менежер/админаас нэг хүсэлтээ батлуулна уу.",
                      )}
                    </p>
                    {pendingAccessCount > 0 && (
                      <p className="text-amber-700">
                        {tr(
                          `You have ${pendingAccessCount} pending request${pendingAccessCount > 1 ? "s" : ""} waiting for review.`,
                          `Танд хянагдаж байгаа ${pendingAccessCount} хүлээгдэж буй хүсэлт байна.`,
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <select
                      className="mono-input"
                      value={selectedAccessRequestId}
                      onChange={(e) =>
                        setSelectedAccessRequestId(e.target.value)
                      }
                    >
                      {accessRequests
                        .filter((row) => row.status === "approved")
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.destination} | {row.from_date} - {row.to_date}{" "}
                            | {row.planned_seats} {tr("seats", "суудал")}
                          </option>
                        ))}
                    </select>

                    {selectedAccessRequest && (
                      <div className="mono-panel p-3 text-sm space-y-1">
                        <p>
                          <span className="font-medium">
                            {tr("Approved Window", "Батлагдсан хугацаа")}:
                          </span>{" "}
                          {selectedAccessRequest.from_date} -{" "}
                          {selectedAccessRequest.to_date}
                        </p>
                        <p>
                          <span className="font-medium">
                            {tr("Approved Destination", "Батлагдсан чиглэл")}:
                          </span>{" "}
                          {selectedAccessRequest.destination}
                        </p>
                        <p>
                          <span className="font-medium">
                            {tr(
                              "Approval expires (6h)",
                              "Баталгаажуулалт дуусах (6 цаг)",
                            )}
                            :
                          </span>{" "}
                          {selectedAccessApprovalDeadline
                            ? new Date(
                                selectedAccessApprovalDeadline,
                              ).toLocaleString()
                            : tr("N/A", "Байхгүй")}
                        </p>
                        <p>
                          <span className="font-medium">
                            {tr(
                              "Approval Time Left (max 6h)",
                              "Баталгаажуулалтын үлдсэн хугацаа (6 цаг)",
                            )}
                            :
                          </span>{" "}
                          <span
                            className={selectedAccessExpiryCountdown.className}
                          >
                            {selectedAccessExpiryCountdown.label}
                          </span>
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        className="mono-input"
                        placeholder={tr("Min seats", "Суудлын доод тоо")}
                        value={tourFilters.minSeats}
                        onChange={(e) =>
                          setTourFilters((prev) => ({
                            ...prev,
                            minSeats: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="mono-input"
                        placeholder={tr("Min price", "Үнийн доод хязгаар")}
                        value={tourFilters.minPrice}
                        onChange={(e) =>
                          setTourFilters((prev) => ({
                            ...prev,
                            minPrice: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="mono-input"
                        placeholder={tr("Max price", "Үнийн дээд хязгаар")}
                        value={tourFilters.maxPrice}
                        onChange={(e) =>
                          setTourFilters((prev) => ({
                            ...prev,
                            maxPrice: e.target.value,
                          }))
                        }
                      />
                    </div>
                    {selectedAccessRequest && !tourFilters.minSeats.trim() && (
                      <p className="text-xs text-gray-500">
                        {tr(
                          `Auto seat filter active: showing tours with at least ${selectedAccessRequest.planned_seats} seats. Enter Min seats to override.`,
                          `Автомат суудлын шүүлтүүр идэвхтэй: дор хаяж ${selectedAccessRequest.planned_seats} суудалтай аяллуудыг харуулж байна. Дээрээс нь өөрчлөх бол суудлын доод тоог оруулна уу.`,
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <p className="text-gray-500">
                        {searchLoading
                          ? tr("Searching tours...", "Аялал хайж байна...")
                          : tr(
                              `Showing ${tours.length} matching tour${tours.length === 1 ? "" : "s"}.`,
                              `${tours.length} тохирох аялал олдлоо.`,
                            )}
                      </p>
                      <button
                        className="mono-button mono-button--ghost"
                        onClick={() =>
                          setTourFilters({
                            minSeats: "",
                            minPrice: "",
                            maxPrice: "",
                          })
                        }
                        disabled={!hasActiveTourFilters}
                      >
                        {tr("Reset filters", "Шүүлтүүр цэвэрлэх")}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {tr(
                        "Tip: payment timers refresh every 5 seconds (orange under 1h, red under 10m).",
                        "Зөвлөгөө: төлбөрийн таймер 5 секунд тутам шинэчлэгдэнэ (1 цагаас доош бол улбар, 10 минутаас доош бол улаан).",
                      )}
                    </p>

                    <div className="mono-table-shell">
                      <div className="mono-table-scroll">
                        {searchLoading && (
                          <p className="text-sm text-gray-500 mb-2">
                            {tr("Searching tours...", "Аялал хайж байна...")}
                          </p>
                        )}
                        <table className="mono-table mono-table--compact mono-table--sticky min-w-[760px]">
                          <thead>
                            <tr>
                              <th>{tr("Tour", "Аялал")}</th>
                              <th>{tr("Date", "Огноо")}</th>
                              <th>{tr("Base Price", "Суурь үнэ")}</th>
                              <th>{tr("Available", "Үлдэгдэл")}</th>
                              <th>{tr("Action", "Үйлдэл")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleTours.map((tour) => {
                              const tourDateKey = `${tour.id}::${normalizeDateKey(
                                tour.departure_date,
                              )}`;
                              const linkedRequest =
                                latestActiveTourRequestByTourDate.get(
                                  tourDateKey,
                                ) || null;
                              const needsPayment = linkedRequest
                                ? seatRequestNeedsDepositTimer(linkedRequest)
                                : false;
                              const isDepositPaid =
                                linkedRequest?.payment_state === "paid";
                              const linkedTimer = countdownMeta(
                                linkedRequest?.deposit_due_at || null,
                                nowMs,
                                isMongolianLanguage,
                              );

                              const inlineStatus = (() => {
                                if (!linkedRequest) {
                                  return null;
                                }
                                if (needsPayment) {
                                  return {
                                    label: linkedTimer.label,
                                    className: linkedTimer.className,
                                  };
                                }
                                if (isDepositPaid) {
                                  return {
                                    label: tr(
                                      "First payment paid",
                                      "Эхний төлбөр төлөгдсөн",
                                    ),
                                    className: "text-green-700 font-semibold",
                                  };
                                }
                                return {
                                  label: linkedRequest.status.replaceAll(
                                    "_",
                                    " ",
                                  ),
                                  className: "text-gray-600",
                                };
                              })();
                              const normalizedTourDate = normalizeDateKey(
                                tour.departure_date,
                              );
                              const isSelectedTour =
                                selectedTour?.id === tour.id &&
                                selectedTourDateKey === normalizedTourDate;
                              const hasAvailableSeats =
                                Number(tour.available_seats || 0) > 0;

                              return (
                                <tr
                                  key={`${tour.id}-${tour.departure_date}`}
                                  className={isSelectedTour ? "bg-blue-50" : ""}
                                >
                                  <td>{tour.title || tour.destination}</td>
                                  <td>{tour.departure_date}</td>
                                  <td>
                                    {formatMnt(Number(tour.base_price || 0))}
                                  </td>
                                  <td>{Number(tour.available_seats || 0)}</td>
                                  <td>
                                    <div className="flex flex-col items-start gap-1 py-1">
                                      {linkedRequest && inlineStatus && (
                                        <span
                                          className={`text-xs ${inlineStatus.className}`}
                                        >
                                          {inlineStatus.label}
                                        </span>
                                      )}
                                      {linkedRequest && (
                                        <span className="text-[11px] text-gray-500">
                                          {linkedRequest.request_no}
                                        </span>
                                      )}
                                      <button
                                        className="mono-button mono-button--ghost"
                                        disabled={
                                          !linkedRequest && !hasAvailableSeats
                                        }
                                        onClick={() => {
                                          if (linkedRequest) {
                                            setSelectedSeatRequestId(
                                              linkedRequest.id,
                                            );
                                            setWorkspaceTab("history");
                                            setHistoryView("payments");
                                            return;
                                          }

                                          setSelectedTour(tour);
                                          setRequestedSeats(
                                            recommendedSeatCount(
                                              selectedAccessRequest?.planned_seats,
                                              tour.available_seats,
                                            ),
                                          );
                                        }}
                                      >
                                        {linkedRequest
                                          ? needsPayment
                                            ? tr(
                                                "Pay / View Plan",
                                                "Төлөх / Төлөв харах",
                                              )
                                            : tr("View Plan", "Төлөв харах")
                                          : isSelectedTour
                                            ? tr("Selected", "Сонгогдсон")
                                            : hasAvailableSeats
                                              ? tr("Select", "Сонгох")
                                              : tr("Sold Out", "Дүүрсэн")}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {!searchLoading && visibleTours.length === 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-amber-700">
                              {tr(
                                `No tours currently match approved destination "${selectedAccessRequest?.destination || ""}" in this window. Ask manager/admin to approve a request with an available destination.`,
                                `Энэ хугацаанд "${selectedAccessRequest?.destination || ""}" чиглэлтэй тохирох аялал одоогоор алга. Менежер/админаас боломжтой чиглэлтэй хүсэлт батлуулах шаардлагатай.`,
                              )}
                            </p>
                            <p className="text-sm text-gray-500">
                              {tr(
                                "You can also choose another approved request or adjust min seats/price filters.",
                                "Мөн өөр батлагдсан хүсэлт сонгох эсвэл суудал/үнийн шүүлтүүрээ өөрчилж болно.",
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <LoadMoreListFooter
                      tr={tr}
                      visibleCount={visibleToursCount}
                      totalCount={totalToursCount}
                      onLoadMore={loadMoreTours}
                      loading={searchLoading}
                    />

                    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                      <h4 className="font-semibold">
                        {tr("3) Confirm Seats", "3) Суудал баталгаажуулах")}
                      </h4>
                      {!selectedTour ? (
                        <p className="text-sm text-gray-500">
                          {tr(
                            "Select one tour row above first.",
                            "Эхлээд дээрх хүснэгтээс нэг аялал сонгоно уу.",
                          )}
                        </p>
                      ) : (
                        <>
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {serialBundleEnabled
                              ? tr(
                                  "Serial mode: selecting one departure commits the next serial tours of the same title. First payment is required within 6 hours.",
                                  "Serial горим: нэг аялал сонгоход ижил нэртэй дараагийн serial аяллууд хамт баталгаажна. Эхний төлбөрийг 6 цагийн дотор төлнө.",
                                )
                              : selectedTourUsesDepositStep
                                ? tr(
                                    "Confirming creates the seat request instantly and starts the 6-hour first-payment timer.",
                                    "Баталгаажуулмагц seat request шууд үүсэж, эхний төлбөрийн 6 цагийн таймер эхэлнэ.",
                                  )
                                : tr(
                                    "Near tour: 6-hour first-payment timer is skipped. Payment starts directly from percentage milestones.",
                                    "Ойрын аялал: эхний төлбөрийн 6 цагийн таймер алгасагдана. Төлбөр шаталсан хувьт milestone-оос шууд эхэлнэ.",
                                  )}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="mono-panel p-3">
                              <p className="text-xs text-gray-500">
                                {tr("Tour", "Аялал")}
                              </p>
                              <p className="text-sm font-semibold mt-1">
                                {selectedTour.title}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {selectedTourDateKey ||
                                  selectedTour.departure_date}
                              </p>
                            </div>
                            <div className="mono-panel p-3">
                              <p className="text-xs text-gray-500">
                                {tr("Available Seats", "Боломжтой суудал")}
                              </p>
                              <p className="text-sm font-semibold mt-1">
                                {selectedTourAvailableSeats}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {tr("Unit Price", "Нэгж үнэ")}:{" "}
                                {formatMnt(selectedTourUnitPriceMnt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <span>
                              {tr(
                                "Recommended seats",
                                "Санал болгож буй суудал",
                              )}
                              : {recommendedRequestedSeats}
                            </span>
                            <button
                              className="mono-button mono-button--ghost"
                              onClick={() =>
                                setRequestedSeats(recommendedRequestedSeats)
                              }
                              disabled={
                                requestedSeats === recommendedRequestedSeats
                              }
                            >
                              {tr(
                                "Use recommended",
                                "Санал болгосон тоог ашиглах",
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="space-y-1">
                              <span className="text-xs font-medium text-gray-600">
                                {tr("Serial tour count", "Serial аяллын тоо")}
                              </span>
                              <select
                                className="mono-input"
                                value={selectedSerialCount}
                                onChange={(event) =>
                                  setSelectedSerialCount(
                                    Number(event.target.value) ||
                                      serialCountOptions[0] ||
                                      1,
                                  )
                                }
                              >
                                {serialCountOptions.map((count) => (
                                  <option key={count} value={count}>
                                    {count}
                                  </option>
                                ))}
                              </select>
                              {!backendSerialEnforcementEnabled && (
                                <p className="text-xs text-gray-500">
                                  {tr(
                                    "Serial bundles are disabled by backend; single-tour selection only.",
                                    "Backend тохиргоогоор serial багц унтраалттай; зөвхөн нэг аялал сонгоно.",
                                  )}
                                </p>
                              )}
                            </label>
                            <div className="mono-panel p-3">
                              <p className="text-xs text-gray-500">
                                {tr(
                                  "First serial payment formula",
                                  "Эхний serial төлбөрийн томъёо",
                                )}
                              </p>
                              <p className="mt-1 text-sm font-semibold">
                                {serialPreview?.first_payment_formula ||
                                  `50,000 * ${Math.max(
                                    1,
                                    Math.floor(Number(requestedSeats) || 1),
                                  )} * ${selectedSerialCount}`}
                              </p>
                            </div>
                          </div>
                          {serialBundleEnabled && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-2">
                              <p className="font-semibold text-gray-700">
                                {tr(
                                  `Serial preview (${serialPreviewTours.length}/${selectedSerialCount})`,
                                  `Serial урьдчилсан жагсаалт (${serialPreviewTours.length}/${selectedSerialCount})`,
                                )}
                              </p>
                              {serialPreviewLoading && (
                                <p className="text-gray-500">
                                  {tr(
                                    "Checking serial chain availability...",
                                    "Serial аяллын боломж шалгаж байна...",
                                  )}
                                </p>
                              )}
                              {serialPreviewError && (
                                <p className="text-red-700 font-medium">
                                  {serialPreviewError}
                                </p>
                              )}
                              {serialPreviewTours.length > 0 && (
                                <div className="space-y-1">
                                  {serialPreviewTours.map((tour, index) => (
                                    <p
                                      key={`${tour.tour_id}-${tour.travel_date}`}
                                      className="text-gray-700"
                                    >
                                      #{index + 1} {tour.travel_date} -{" "}
                                      {tour.title} (
                                      {tr("Available", "Үлдэгдэл")}:{" "}
                                      {Number(tour.available_seats || 0)})
                                    </p>
                                  ))}
                                </div>
                              )}
                              {!serialPreviewReady && (
                                <p className="text-red-700 font-medium">
                                  {tr(
                                    `Need ${selectedSerialCount} upcoming departures with this title. Please pick another departure or lower serial count.`,
                                    `Энэ нэртэй ${selectedSerialCount} дараалсан аялал олдсонгүй. Өөр огноо сонгох эсвэл serial тоог өөрчилнө үү.`,
                                  )}
                                </p>
                              )}
                              {serialPreviewSeatShortage && (
                                <p className="text-red-700 font-medium">
                                  {tr(
                                    "At least one serial tour has fewer seats than requested.",
                                    "Serial аяллуудын нэг нь хүссэн суудлаас бага үлдэгдэлтэй байна.",
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="w-full sm:max-w-xs">
                            <input
                              className="mono-input"
                              type="number"
                              min={1}
                              max={selectedTourAvailableSeats || undefined}
                              value={requestedSeats}
                              onChange={(e) =>
                                setRequestedSeats(() => {
                                  const parsed = Math.max(
                                    1,
                                    Math.floor(Number(e.target.value) || 1),
                                  );
                                  if (selectedTourAvailableSeats > 0) {
                                    return Math.min(
                                      parsed,
                                      selectedTourAvailableSeats,
                                    );
                                  }
                                  return parsed;
                                })
                              }
                            />
                          </div>
                          {requestedSeatsExceedsAvailability && (
                            <p className="text-xs text-red-700 font-medium">
                              {tr(
                                "Requested seats exceed availability. Max available",
                                "Хүссэн суудлын тоо үлдэгдлээс их байна. Хамгийн ихдээ",
                              )}
                              : {selectedTourAvailableSeats}
                            </p>
                          )}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="mono-panel p-3">
                              <p className="text-xs text-gray-500">
                                {tr("Estimated Total", "Нийт тооцоолсон дүн")}
                              </p>
                              <p className="text-sm font-semibold mt-1">
                                {formatMnt(estimatedTotalMnt)}
                              </p>
                            </div>
                            <div className="mono-panel p-3">
                              <p className="text-xs text-gray-500">
                                {serialBundleEnabled
                                  ? tr(
                                      "First Serial Payment (within 6h)",
                                      "Эхний serial төлбөр (6 цагийн дотор)",
                                    )
                                  : selectedTourUsesDepositStep
                                    ? tr(
                                        "Required First Payment (within 6h)",
                                        "Шаардлагатай эхний төлбөр (6 цагийн дотор)",
                                      )
                                    : tr(
                                        "First Percentage Milestone",
                                        "Эхний хувьт milestone",
                                      )}
                              </p>
                              <p className="text-sm font-semibold mt-1">
                                {formatMnt(
                                  selectedTourUsesDepositStep
                                    ? estimatedDepositMnt
                                    : estimatedFirstMilestoneMnt,
                                )}
                              </p>
                              {!selectedTourUsesDepositStep && (
                                <p className="mt-1 text-xs text-gray-600">
                                  {tr(
                                    `Target at this stage: ${estimatedFirstMilestonePercent}% of total`,
                                    `Энэ шатанд: нийт дүнгийн ${estimatedFirstMilestonePercent}%`,
                                  )}
                                </p>
                              )}
                              {serialBundleEnabled && (
                                <p className="mt-1 text-xs text-gray-600">
                                  {tr(
                                    "Formula: 50,000 * seats * serial count",
                                    "Томъёо: 50,000 * суудал * serial тоо",
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                          {!canConfirmSeatRequest &&
                            confirmBlockers.length > 0 && (
                              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                                <p className="font-semibold">
                                  {tr(
                                    "Before confirming, fix these items:",
                                    "Баталгаажуулахын өмнө дараахыг засна уу:",
                                  )}
                                </p>
                                <ul className="list-disc space-y-1 pl-4">
                                  {confirmBlockers.map((item, index) => (
                                    <li key={`${index}-${item}`}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          {selectionInlineError && (
                            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800">
                              {selectionInlineError}
                            </div>
                          )}
                          <button
                            className="mono-button w-full sm:w-auto"
                            onClick={submitTourSelection}
                            disabled={!canConfirmSeatRequest}
                          >
                            {selectionSubmitting
                              ? tr("Submitting...", "Илгээж байна...")
                              : tr(
                                  "Confirm Seat Request",
                                  "Seat request баталгаажуулах",
                                )}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <RecentAccessRequestsPanel
                recentAccessRequests={recentAccessRequests}
                recentlySubmittedAccessRequestId={recentlySubmittedAccessRequestId}
                expandedRecentAccessRequestId={expandedRecentAccessRequestId}
                requests={requests}
                isMongolianLanguage={isMongolianLanguage}
                tr={tr}
                onExpand={setExpandedRecentAccessRequestId}
                onContinueRequest={openRecentRequestSelection}
                onOpenAccessHistory={openRecentAccessHistory}
                onOpenPaymentPlan={openRecentRequestPayments}
                resolveAccessApprovalDeadline={resolveAccessApprovalDeadline}
                formatDateTime={formatDateTime}
                accessStatusClass={accessStatusClass}
                accessStatusLabel={accessStatusLabel}
                toRoleLabel={toRoleLabel}
                requestStatusClass={requestStatusClass}
                requestStatusLabel={requestStatusLabel}
                paymentStateLabel={paymentStateLabel}
              />

              <div className="mono-card p-4 sm:p-5">
                <h3 className="font-semibold mb-3">
                  {tr(
                    "Live First-Payment Timers",
                    "Шууд эхний төлбөрийн таймер",
                  )}
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  {tr(
                    "Serial first payment is 50,000 MNT x seats x serial count within 6 hours. After first payment, date-based milestones continue.",
                    "Эхний serial төлбөр нь 50,000 MNT x суудал x serial тоо (6 цагийн дотор). Эхний төлбөрийн дараа огноонд суурилсан milestone үргэлжилнэ.",
                  )}
                </p>
                {liveDepositTimers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {tr(
                      "No active 6h first-payment timers right now.",
                      "Одоогоор идэвхтэй 6 цагийн эхний төлбөрийн таймер алга.",
                    )}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {liveDepositTimers.map((request) => {
                      const timer = countdownMeta(
                        request.deposit_due_at,
                        nowMs,
                        isMongolianLanguage,
                      );
                      return (
                        <div
                          key={request.id}
                          className="rounded-lg border border-gray-200 bg-white p-3 text-sm space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {request.request_no}
                              </p>
                              {Number(request.serial_total || 1) > 1 && (
                                <p className="text-[11px] text-gray-500">
                                  {tr(
                                    `Serial ${request.serial_index}/${request.serial_total}`,
                                    `Serial ${request.serial_index}/${request.serial_total}`,
                                  )}
                                </p>
                              )}
                            </div>
                            <span className={timer.className}>
                              {timer.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {request.destination}
                          </p>
                          <p className="text-xs text-gray-500">
                            {tr("Due At", "Төлөх хугацаа")}{" "}
                            {request.deposit_due_at
                              ? new Date(
                                  request.deposit_due_at,
                                ).toLocaleString()
                              : "-"}
                          </p>
                          <button
                            className="mono-button mono-button--ghost"
                            onClick={() => {
                              setSelectedSeatRequestId(request.id);
                              setWorkspaceTab("history");
                              setHistoryView("payments");
                            }}
                          >
                            {tr("Open Payment Plan", "Төлбөрийн төлөв нээх")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <details className="mono-card">
                <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-4 font-semibold">
                  {tr("Organization Profile", "Байгууллагын мэдээлэл")}
                </summary>
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-2 border-t border-gray-200">
                  <p className="text-sm mt-3">
                    <span className="font-medium">
                      {tr("Organization", "Байгууллага")}:
                    </span>{" "}
                    {profile?.organization?.name ||
                      tr("Not bound", "Холбогдоогүй")}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">
                      {tr("Merchant code", "Merchant код")}:
                    </span>{" "}
                    {profile?.organization?.merchant_code ||
                      tr("N/A", "Байхгүй")}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">
                      {tr("Reg. No", "Регистрийн дугаар")}:
                    </span>{" "}
                    {profile?.organization?.registration_number ||
                      tr("N/A", "Байхгүй")}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">
                      {tr("Active requests", "Идэвхтэй хүсэлт")}:
                    </span>{" "}
                    {profile?.activeRequests?.length || 0}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">
                      {tr("Payment records", "Төлбөрийн бүртгэл")}:
                    </span>{" "}
                    {profile?.paymentHistory?.length || 0}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">
                      {tr("Seat history", "Seat түүх")}:
                    </span>{" "}
                    {profile?.seatPurchaseHistory?.length || 0}
                  </p>
                </div>
              </details>

              {featureFlags.b2bRoleV2Enabled ? (
                <details className="mono-card">
                  <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-4 font-semibold">
                    {tr("Employee Binding Request", "Ажилтны холбох хүсэлт")}
                  </summary>
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-3 space-y-3 border-t border-gray-200">
                    <input
                      className="mono-input"
                      placeholder={tr(
                        "Merchant code (e.g. MRC-ABC123)",
                        "Merchant код (ж: MRC-ABC123)",
                      )}
                      value={bindingForm.merchantCode}
                      onChange={(e) =>
                        setBindingForm((prev) => ({
                          ...prev,
                          merchantCode: e.target.value,
                        }))
                      }
                    />
                    <select
                      className="mono-input"
                      value={bindingForm.requestedRole}
                      onChange={(e) =>
                        setBindingForm((prev) => ({
                          ...prev,
                          requestedRole: e.target.value as BindingRole,
                        }))
                      }
                    >
                      <option value="subcontractor">
                        {toRoleLabel("subcontractor", isMongolianLanguage)}
                      </option>
                      <option value="agent">
                        {toRoleLabel("agent", isMongolianLanguage)}
                      </option>
                    </select>
                    <textarea
                      className="mono-input"
                      placeholder={tr(
                        "Optional note to reviewer",
                        "Хянагчид үлдээх нэмэлт тайлбар (заавал биш)",
                      )}
                      rows={3}
                      value={bindingForm.note}
                      onChange={(e) =>
                        setBindingForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                    />
                    <button
                      className="mono-button"
                      onClick={submitBinding}
                      disabled={bindingSubmitting}
                    >
                      {bindingSubmitting
                        ? tr("Submitting...", "Илгээж байна...")
                        : tr("Submit Binding Request", "Холбох хүсэлт илгээх")}
                    </button>
                  </div>
                </details>
              ) : (
                <div className="mono-card p-4 sm:p-5 text-sm text-gray-500">
                  {tr(
                    "Organization binding workflow is disabled",
                    "Байгууллага холбох workflow идэвхгүй байна",
                  )}{" "}
                  (`B2B_ROLE_V2_ENABLED=false`).
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}

      {workspaceTab === "history" && (
        <>
          {historyView === "payments" && (
            <div className="mono-card p-4 sm:p-5 space-y-3">
              <div className={`rounded-lg border px-3 py-3 ${historyActionSummary.panelClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={historyActionSummary.badgeClass}>
                    {historyActionSummary.badgeLabel}
                  </span>
                  <button
                    type="button"
                    className="mono-button mono-button--sm"
                    onClick={runHistoryPrimaryAction}
                    disabled={historyActionSummary.disabled}
                  >
                    {historyActionSummary.ctaLabel}
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold">{historyActionSummary.title}</p>
                <p className="mt-1 text-xs opacity-90">{historyActionSummary.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-600">
                    {tr("Current request", "Одоогийн хүсэлт")}
                  </span>
                  <select
                    className="mono-input"
                    value={selectedSeatRequestId}
                    onChange={(event) => setSelectedSeatRequestId(event.target.value)}
                    disabled={requests.length === 0}
                  >
                    <option value="">{tr("Select request", "Хүсэлт сонгох")}</option>
                    {requests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.request_no} | {request.destination} |{" "}
                        {formatDateTime(request.travel_date, request.travel_date || "-")}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="mono-button mono-button--ghost"
                  onClick={() => {
                    if (selectedSeatRequestId) {
                      void loadPaymentDetails(selectedSeatRequestId);
                    }
                  }}
                  disabled={!selectedSeatRequestId || paymentLoading}
                >
                  {paymentLoading
                    ? tr("Refreshing...", "Шинэчилж байна...")
                    : tr("Refresh", "Шинэчлэх")}
                </button>
              </div>
            </div>
          )}

          <div className="mono-card p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`mono-button mono-button--sm ${historyView === "payments" ? "" : "mono-button--ghost"}`}
                onClick={() => setHistoryView("payments")}
              >
                {tr("Payments", "Төлбөр")}
              </button>
              <button
                type="button"
                className={`mono-button mono-button--sm ${historyView === "access" ? "" : "mono-button--ghost"}`}
                onClick={() => setHistoryView("access")}
              >
                {tr("Access history", "Access түүх")} ({accessRequests.length})
              </button>
              <button
                type="button"
                className={`mono-button mono-button--sm ${historyView === "seat" ? "" : "mono-button--ghost"}`}
                onClick={() => setHistoryView("seat")}
              >
                {tr("Seat request history", "Seat request түүх")} ({requests.length})
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {tr(
                "Default view is Payments. Open other history only when needed.",
                "Анхдагч нь Төлбөр хэсэг. Бусад түүхийг шаардлагатай үед нээнэ үү.",
              )}
            </p>
          </div>

          {historyView === "access" && (
            <div
              id="seat-request-history-section"
              className="mono-card p-4 sm:p-5"
            >
              <details
                className="group"
                {...(historyView === "access" ? { open: true } : {})}
              >
                <summary className="mono-collapsible-summary">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {tr(
                        "Seat Access Request History",
                        "Seat access хүсэлтийн түүх",
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tr("Total", "Нийт")}: {accessRequests.length}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600 group-open:hidden">
                    {tr("Show", "Нээх")}
                  </span>
                  <span className="hidden text-xs text-gray-600 group-open:inline">
                    {tr("Hide", "Хаах")}
                  </span>
                </summary>

                <div className="pt-3">
                  {loading ? (
                    <p className="text-sm text-gray-500">
                      {tr("Loading...", "Ачаалж байна...")}
                    </p>
                  ) : accessRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {tr(
                        "No access requests yet.",
                        "Одоогоор access хүсэлт алга.",
                      )}
                    </p>
                  ) : (
                    <>
                      <div className="mono-table-shell">
                        <div className="mono-table-scroll">
                          <table className="mono-table mono-table--compact mono-table--sticky min-w-[920px]">
                            <thead>
                              <tr>
                                <th>{tr("Destination", "Чиглэл")}</th>
                                <th>{tr("Planned Seats", "Төлөвлөсөн суудал")}</th>
                                <th>{tr("Date Window", "Огнооны хүрээ")}</th>
                                <th>{tr("Status", "Төлөв")}</th>
                                <th>{tr("Decision", "Шийдвэр")}</th>
                                <th>{tr("Seat Request ID", "Seat request ID")}</th>
                                <th>{tr("Created", "Үүсгэсэн")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleAccessHistoryRows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.destination}</td>
                                  <td>{row.planned_seats}</td>
                                  <td>
                                    {row.from_date} - {row.to_date}
                                  </td>
                                  <td>
                                    <span
                                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${accessStatusClass(row.status)}`}
                                    >
                                      {accessStatusLabel(
                                        row.status,
                                        isMongolianLanguage,
                                      )}
                                    </span>
                                  </td>
                                  <td>{row.decision_reason || "-"}</td>
                                  <td>{row.seat_request_id || "-"}</td>
                                  <td>{new Date(row.created_at).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="mt-3">
                        <LoadMoreListFooter
                          tr={tr}
                          visibleCount={visibleAccessHistoryCount}
                          totalCount={totalAccessHistoryCount}
                          onLoadMore={loadMoreAccessHistory}
                          loading={loading}
                        />
                      </div>
                    </>
                  )}
                </div>
              </details>
            </div>
          )}

          {historyView === "seat" && (
            <div className="mono-card p-4 sm:p-5">
              <details
                className="group"
                {...(historyView === "seat" ? { open: true } : {})}
              >
                <summary className="mono-collapsible-summary">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {tr(
                        "Seat Request History",
                        "Seat request-ийн түүх",
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tr("Total", "Нийт")}: {requests.length}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600 group-open:hidden">
                    {tr("Show", "Нээх")}
                  </span>
                  <span className="hidden text-xs text-gray-600 group-open:inline">
                    {tr("Hide", "Хаах")}
                  </span>
                </summary>

                <div className="pt-3">
                  {loading ? (
                    <p className="text-sm text-gray-500">
                      {tr("Loading...", "Ачаалж байна...")}
                    </p>
                  ) : requests.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {tr(
                        "No seat requests yet.",
                        "Одоогоор seat request байхгүй.",
                      )}
                    </p>
                  ) : (
                    <>
                      <div className="mono-table-shell">
                        <div className="mono-table-scroll">
                          <table className="mono-table mono-table--compact mono-table--sticky min-w-[1080px]">
                            <thead>
                              <tr>
                                <th>{tr("Request", "Хүсэлт")}</th>
                                <th>{tr("Destination", "Чиглэл")}</th>
                                <th>{tr("Travel Date", "Аяллын огноо")}</th>
                                <th>{tr("Seats", "Суудал")}</th>
                                <th>{tr("Status", "Төлөв")}</th>
                                <th>{tr("Payment", "Төлбөр")}</th>
                                <th>
                                  {tr(
                                    "Deposit Timer (if any)",
                                    "Урьдчилгааны таймер (байвал)",
                                  )}
                                </th>
                                <th>{tr("Created", "Үүсгэсэн")}</th>
                                <th>{tr("Action", "Үйлдэл")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleSeatHistoryRows.map((request) => {
                                const depositTimer = countdownMeta(
                                  request.deposit_due_at,
                                  nowMs,
                                  isMongolianLanguage,
                                );

                                return (
                                  <tr key={request.id}>
                                    <td>
                                      <div className="space-y-1">
                                        <p>{request.request_no}</p>
                                        {Number(request.serial_total || 1) > 1 && (
                                          <p className="text-[11px] text-gray-500">
                                            {tr(
                                              `Serial ${request.serial_index}/${request.serial_total}`,
                                              `Serial ${request.serial_index}/${request.serial_total}`,
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </td>
                                    <td>{request.destination}</td>
                                    <td>
                                      {formatDateTime(
                                        request.travel_date,
                                        request.travel_date || "-",
                                      )}
                                    </td>
                                    <td>{request.requested_seats}</td>
                                    <td>
                                      <span
                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${requestStatusClass(request.status)}`}
                                      >
                                        {requestStatusLabel(
                                          request,
                                          isMongolianLanguage,
                                        )}
                                      </span>
                                    </td>
                                    <td>
                                      {paymentStateLabel(
                                        request.payment_state,
                                        isMongolianLanguage,
                                      )}
                                    </td>
                                    <td>
                                      <span className={depositTimer.className}>
                                        {depositTimer.label}
                                      </span>
                                    </td>
                                    <td>
                                      {new Date(request.created_at).toLocaleString()}
                                    </td>
                                    <td>
                                      <button
                                        className="mono-button mono-button--ghost"
                                        onClick={() => {
                                          setSelectedSeatRequestId(request.id);
                                          setHistoryView("payments");
                                        }}
                                      >
                                        {tr(
                                          "View Payment Plan",
                                          "Төлбөрийн төлөв харах",
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="mt-3">
                        <LoadMoreListFooter
                          tr={tr}
                          visibleCount={visibleSeatHistoryCount}
                          totalCount={totalSeatHistoryCount}
                          onLoadMore={loadMoreSeatHistory}
                          loading={loading}
                        />
                      </div>
                    </>
                  )}
                </div>
              </details>
            </div>
          )}

          {historyView === "payments" && !selectedSeatRequestId && (
              <div className="mono-card p-4 sm:p-5 text-sm text-gray-600">
                {tr(
                  "Pick a seat request from history to load its payment milestones and QPay actions.",
                  "Төлбөрийн milestone болон QPay үйлдлийг харахын тулд түүхээс seat request сонгоно уу.",
                )}
              </div>
            )}

          {historyView === "payments" && selectedSeatRequestId && (
              <div
                id="payment-milestones-section"
                className="mono-card p-4 sm:p-5 space-y-4"
              >
                <h3 className="font-semibold">
                  {tr("Payment details", "Төлбөрийн дэлгэрэнгүй")}
                </h3>

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {tr("Current request", "Одоогийн хүсэлт")}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedHistorySeatRequest?.request_no || selectedSeatRequestId}
                      </p>
                      <p className="text-xs text-gray-600">
                        {selectedHistorySeatRequest
                          ? `${selectedHistorySeatRequest.destination} · ${formatDateTime(
                              selectedHistorySeatRequest.travel_date,
                              selectedHistorySeatRequest.travel_date || "-",
                            )}`
                          : tr("Request details unavailable", "Хүсэлтийн дэлгэрэнгүй байхгүй")}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="mono-button mono-button--ghost mono-button--sm"
                      onClick={() => {
                        if (selectedSeatRequestId) {
                          void loadPaymentDetails(selectedSeatRequestId);
                        }
                      }}
                      disabled={paymentLoading}
                    >
                      {paymentLoading
                        ? tr("Refreshing...", "Шинэчилж байна...")
                        : tr("Refresh", "Шинэчлэх")}
                    </button>
                  </div>
                </div>

                {paymentLoading ? (
                  <p className="text-sm text-gray-500">
                    {tr(
                      "Loading payment milestones...",
                      "Төлбөрийн шатлал ачаалж байна...",
                    )}
                  </p>
                ) : (
                  <>
                    {depositIntent && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            {tr("Action Required", "Шаардлагатай үйлдэл")}
                          </span>
                          <p className="font-semibold text-amber-900">
                            {tr(
                              "First payment milestone",
                              "Эхний төлбөрийн milestone",
                            )}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-md border border-amber-200 bg-white/80 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-amber-800">
                              {tr("First Payment Due", "Эхний төлбөрийн дүн")}
                            </p>
                            <p className="mt-1 text-lg font-bold text-slate-900">
                              {formatMnt(
                                Number(depositIntent.requiredAmountMnt || 0),
                              )}
                            </p>
                          </div>

                          <div className="rounded-md border border-amber-200 bg-white/80 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-amber-800">
                              {tr("Due At", "Төлөх хугацаа")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {depositIntent.dueAt
                                ? new Date(depositIntent.dueAt).toLocaleString()
                                : "-"}
                            </p>
                          </div>

                          <div className="rounded-md border border-amber-200 bg-white/80 p-2">
                            <p className="text-[11px] uppercase tracking-wide text-amber-800">
                              {tr("Time Left", "Үлдсэн хугацаа")}
                            </p>
                            <p
                              className={`mt-1 text-base font-bold ${depositIntentCountdown.className}`}
                            >
                              {depositIntentCountdown.label}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentSuccessState && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            {tr("Success", "Амжилттай")}
                          </span>
                          <p className="font-semibold text-emerald-900">
                            {tr(
                              "Payment completed successfully",
                              "Төлбөр амжилттай баталгаажлаа",
                            )}
                          </p>
                        </div>
                        <p>
                          <span className="font-medium">
                            {tr("Confirmed Amount", "Баталгаажсан дүн")}:
                          </span>{" "}
                          {formatMnt(paymentSuccessState.amountMnt)}
                        </p>
                        <p>
                          <span className="font-medium">
                            {tr("Confirmed At", "Баталгаажсан цаг")}:
                          </span>{" "}
                          {paymentSuccessState.checkedAt
                            ? new Date(
                                paymentSuccessState.checkedAt,
                              ).toLocaleString()
                            : "-"}
                        </p>
                        {paymentSuccessState.milestoneCode && (
                          <p>
                            <span className="font-medium">
                              {tr("Paid Milestone", "Төлөгдсөн milestone")}:
                            </span>{" "}
                            {paymentMilestoneLabel(
                              paymentSuccessState.milestoneCode,
                              isMongolianLanguage,
                            )}
                          </p>
                        )}
                        {paymentSuccessState.externalTxnId && (
                          <p>
                            <span className="font-medium">TXN:</span>{" "}
                            {paymentSuccessState.externalTxnId}
                          </p>
                        )}
                      </div>
                    )}

                    {hasPaymentMilestones &&
                      (nextUnpaidMilestone ? (
                        nextMilestoneExpired ? (
                          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                {tr("Expired", "Хугацаа дууссан")}
                              </span>
                              <p className="font-semibold">
                                {tr(
                                  "Payment deadline has ended",
                                  "Төлбөрийн хугацаа дууссан",
                                )}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                              <div className="rounded-md border border-red-200 bg-white/80 p-2">
                                <p className="text-[11px] uppercase tracking-wide text-red-700">
                                  {tr("Milestone", "Milestone")}
                                </p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {paymentMilestoneLabel(
                                    nextUnpaidMilestone.code,
                                    isMongolianLanguage,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-md border border-red-200 bg-white/80 p-2">
                                <p className="text-[11px] uppercase tracking-wide text-red-700">
                                  {tr("Unpaid amount", "Төлөгдөөгүй дүн")}
                                </p>
                                <p className="mt-1 text-xl font-extrabold tracking-tight text-red-900">
                                  {formatMnt(nextMilestoneAmountToPayMnt)}
                                </p>
                              </div>

                              <div className="rounded-md border border-red-200 bg-white/80 p-2">
                                <p className="text-[11px] uppercase tracking-wide text-red-700">
                                  {tr("Deadline", "Хугацаа")}
                                </p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {nextUnpaidMilestone.due_at
                                    ? new Date(
                                        nextUnpaidMilestone.due_at,
                                      ).toLocaleString()
                                    : "-"}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-red-700">
                                  {tr(
                                    "Payment is closed",
                                    "Төлбөр хийх боломж хаагдсан",
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-md border border-red-300 bg-white px-3 py-2">
                              <p className="text-xs font-semibold text-red-800">
                                {tr(
                                  "If you still need to continue this request, contact admin or manager.",
                                  "Хэрэв энэ хүсэлтийг үргэлжлүүлэх шаардлагатай бол админ эсвэл менежертэй холбогдоно уу.",
                                )}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-lg border p-3 text-sm space-y-2 ${nextMilestoneUrgency.containerClass}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${nextMilestoneUrgency.badgeClass}`}
                              >
                                {nextMilestoneUrgency.badgeText}
                              </span>
                              <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                                {tr(
                                  "Pay before deadline",
                                  "Хугацаанаас өмнө төлөх",
                                )}
                              </span>
                              <p className="font-semibold text-slate-900">
                                {tr(
                                  "Next payment milestone",
                                  "Дараагийн төлбөрийн milestone",
                                )}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                              <div className="rounded-md border border-slate-200 bg-white/80 p-2">
                                <p className="text-[11px] uppercase tracking-wide text-slate-600">
                                  {tr("Milestone", "Milestone")}
                                </p>
                                <p className="mt-1 font-semibold text-slate-900">
                                  {paymentMilestoneLabel(
                                    nextUnpaidMilestone.code,
                                    isMongolianLanguage,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
                                <p className="text-[11px] uppercase tracking-wide text-rose-700">
                                  {tr("Pay Now", "Одоо төлөх дүн")}
                                </p>
                                <p className="mt-1 text-xl font-extrabold tracking-tight text-rose-900">
                                  {formatMnt(nextMilestoneAmountToPayMnt)}
                                </p>
                              </div>

                              <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                                <p className="text-[11px] uppercase tracking-wide text-amber-800">
                                  {tr("Time Left", "Үлдсэн хугацаа")}
                                </p>
                                <p
                                  className={`mt-1 text-base font-bold ${nextMilestoneCountdown.className}`}
                                >
                                  {nextMilestoneCountdown.label}
                                </p>
                                <p className="mt-1 text-xs text-amber-900">
                                  {nextUnpaidMilestone.due_at
                                    ? new Date(
                                        nextUnpaidMilestone.due_at,
                                      ).toLocaleString()
                                    : "-"}
                                </p>
                              </div>
                            </div>

                            <p>
                              <span className="font-medium">
                                {tr(
                                  "Cumulative Target",
                                  "Хуримтлагдсан зорилтот дүн",
                                )}
                                :
                              </span>{" "}
                              {formatMnt(
                                Number(
                                  nextUnpaidMilestone.required_cumulative_mnt ||
                                    0,
                                ),
                              )}
                            </p>
                            <p>
                              <span className="font-medium">
                                {tr("Percent of total cost", "Нийт зардлын хувь")}
                                :
                              </span>{" "}
                              {nextMilestonePercentOfTotal !== null
                                ? `${nextMilestonePercentOfTotal.toFixed(1)}%`
                                : "-"}
                            </p>
                            <div className="rounded border border-indigo-200 bg-white/70 p-2 mt-1 space-y-1">
                              <div className="flex items-center justify-between text-xs text-indigo-900">
                                <span>
                                  {tr(
                                    "Progress to total cost",
                                    "Нийт зардалд хүрэх явц",
                                  )}
                                </span>
                                <span>{paidPercentOfTotal.toFixed(1)}%</span>
                              </div>
                              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-indigo-100">
                                <div
                                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                  style={{ width: `${paidPercentOfTotal}%` }}
                                />
                                {nextMilestonePercentOfTotal !== null &&
                                  nextMilestonePercentOfTotal >
                                    paidPercentOfTotal && (
                                    <span
                                      className="absolute inset-y-0 border-l-2 border-indigo-800"
                                      style={{
                                        left: `calc(${nextMilestonePercentOfTotal}% - 1px)`,
                                      }}
                                    />
                                  )}
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-900">
                                <span>
                                  {tr("Paid", "Төлөгдсөн")}: {" "}
                                  {formatMnt(Math.round(paidTotalMnt))}
                                </span>
                                <span>
                                  {tr("Plan Total", "Төлөвлөгөөний нийт дүн")}: {" "}
                                  {formatMnt(Math.round(totalPaymentPlanMnt))}
                                </span>
                              </div>
                              {nextMilestonePercentOfTotal !== null && (
                                <p className="text-xs text-indigo-700">
                                  {tr(
                                    "Next target marker",
                                    "Дараагийн зорилтот шугам",
                                  )}
                                  : {nextMilestonePercentOfTotal.toFixed(1)}%
                                </p>
                              )}
                            </div>

                            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                              <p className="text-xs font-semibold text-red-800">
                                {tr(
                                  "Important: pay this milestone before the deadline to keep request active.",
                                  "Анхаар: Хүсэлтийг идэвхтэй хадгалахын тулд энэ milestone-ийг хугацаанаас өмнө төлнө үү.",
                                )}
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 space-y-2">
                          <p>
                            {tr(
                              "All milestones are fully paid. No further payment is required.",
                              "Бүх milestone бүрэн төлөгдсөн байна. Нэмэлт төлбөр шаардлагагүй.",
                            )}
                          </p>
                          <div className="rounded border border-green-200 bg-white/70 p-2">
                            <div className="flex items-center justify-between text-xs text-green-900 mb-1">
                              <span>
                                {tr(
                                  "Progress to total cost",
                                  "Нийт зардалд хүрэх явц",
                                )}
                              </span>
                              <span>100.0%</span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-green-100">
                              <div className="h-full w-full rounded-full bg-green-500" />
                            </div>
                          </div>
                        </div>
                      ))}

                    {!allMilestonesPaid && !nextMilestoneExpired && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                        <p className="text-xs text-blue-900">
                          {nextUnpaidMilestone
                            ? tr(
                                "Create QPay invoice for the next unpaid milestone amount.",
                                "Дараагийн төлөгдөөгүй milestone дүнд QPay invoice үүсгэнэ.",
                              )
                            : tr(
                                "If milestones are not loaded, QPay invoice will be resolved on server.",
                                "Milestone мэдээлэл ачаалагдаагүй бол QPay invoice үүсгээд серверээс автоматаар тооцоолно.",
                              )}
                        </p>
                        {nextUnpaidMilestone && (
                          <div className="rounded border border-blue-200 bg-white/80 p-2 text-xs text-blue-900 space-y-1">
                            <p className="font-semibold">
                              {tr("Recommended now", "Одоо хийх зөвлөмж")}
                            </p>
                            <p>
                              {tr("Pay", "Төлөх")}{" "}
                              {formatMnt(nextMilestoneAmountToPayMnt)}
                              {" · "}
                              {tr("Time left", "Үлдсэн хугацаа")}{" "}
                              {nextMilestoneCountdown.label}
                            </p>
                          </div>
                        )}
                        <button
                          className="mono-button w-full sm:w-auto"
                          onClick={submitQPayInvoice}
                          disabled={invoiceSubmitting || isSeatFlowDisabled}
                        >
                          {invoiceSubmitting
                            ? tr("Creating invoice...", "Invoice үүсгэж байна...")
                            : tr("Pay with QPay", "QPay-ээр төлөх")}
                        </button>
                        {qpayInvoice && (
                          <div className="rounded border border-blue-200 bg-white p-3 text-sm space-y-1">
                            {qpayQrImageSrc && (
                              <div className="rounded border border-blue-100 bg-blue-50 p-3 text-center mb-2">
                                <img
                                  src={qpayQrImageSrc}
                                  alt="QPay QR"
                                  className="mx-auto h-40 w-40 object-contain sm:h-48 sm:w-48"
                                />
                                <p className="mt-2 text-xs text-blue-900">
                                  {tr(
                                    "Scan this QR in your bank app or QPay app.",
                                    "Энэ QR-г банкны апп эсвэл QPay апп-аар уншуулж төлнө үү.",
                                  )}
                                </p>
                              </div>
                            )}
                            {!qpayQrImageSrc && qpayInvoice.qrText && (
                              <div className="rounded border border-blue-100 bg-blue-50 p-2 mb-2">
                                <p className="text-xs text-blue-900 break-all">
                                  <span className="font-medium">QR Text:</span>{" "}
                                  {qpayInvoice.qrText}
                                </p>
                              </div>
                            )}
                            <p>
                              <span className="font-medium">
                                {tr("Request", "Хүсэлт")}:
                              </span>{" "}
                              {qpayInvoice.requestNo}
                            </p>
                            <p>
                              <span className="font-medium">
                                {tr("Milestone", "Milestone")}:
                              </span>{" "}
                              {paymentMilestoneLabel(
                                qpayInvoice.milestoneCode,
                                isMongolianLanguage,
                              )}
                            </p>
                            <p>
                              <span className="font-medium">
                                {tr("Amount", "Дүн")}:
                              </span>{" "}
                              {formatMnt(Number(qpayInvoice.amountMnt || 0))}
                            </p>
                            <p>
                              <span className="font-medium">
                                {tr("Due", "Төлөх хугацаа")}:
                              </span>{" "}
                              {qpayInvoice.dueAt
                                ? new Date(qpayInvoice.dueAt).toLocaleString()
                                : "-"}
                            </p>
                            <p>
                              <span className="font-medium">
                                {tr("Invoice ID", "Invoice ID")}:
                              </span>{" "}
                              {qpayInvoice.invoiceId || "-"}
                            </p>
                            <p>
                              <span className="font-medium">
                                {tr("Sender Invoice", "Илгээгчийн invoice")}:
                              </span>{" "}
                              {qpayInvoice.senderInvoiceNo}
                            </p>
                            <div className="pt-2">
                              <button
                                className="mono-button mono-button--ghost"
                                onClick={() => {
                                  void checkQPayInvoicePaymentStatus();
                                }}
                                disabled={qpayStatusChecking || isSeatFlowDisabled}
                              >
                                {qpayStatusChecking
                                  ? tr(
                                      "Checking payment...",
                                      "Төлбөр шалгаж байна...",
                                    )
                                  : tr("Check payment status", "Төлбөр шалгах")}
                              </button>
                              <p className="mt-1 text-xs text-gray-500">
                                {tr(
                                  "Status is auto-checked every 5 seconds.",
                                  "Төлбөрийн статус 5 секунд тутамд автоматаар шалгагдана.",
                                )}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-1">
                              {qpayInvoice.deepLink && (
                                <a
                                  className="text-blue-700 underline"
                                  href={qpayInvoice.deepLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {tr("Open QPay App Link", "QPay апп линк нээх")}
                                </a>
                              )}
                              {qpayInvoice.invoiceUrl && (
                                <a
                                  className="text-blue-700 underline"
                                  href={qpayInvoice.invoiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {tr("Open Invoice URL", "Invoice URL нээх")}
                                </a>
                              )}
                              {qpayShortUrl && (
                                <a
                                  className="text-blue-700 underline"
                                  href={qpayShortUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {tr("Open QPay Web QR", "QPay web QR нээх")}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <details className="rounded-lg border border-gray-200 bg-white">
                      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-gray-800">
                        {tr(
                          "Full milestone schedule",
                          "Milestone-ийн дэлгэрэнгүй хүснэгт",
                        )}
                      </summary>
                      <div className="border-t border-gray-200 px-3 py-3">
                        {!paymentDetails ||
                        paymentDetails.milestones.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            {tr(
                              "No payment milestones found for the selected seat request.",
                              "Сонгосон seat request-д төлбөрийн milestone олдсонгүй.",
                            )}
                          </p>
                        ) : (
                          <div className="mono-table-shell">
                            <div className="mono-table-scroll">
                              <table className="mono-table mono-table--compact mono-table--sticky min-w-[760px]">
                                <thead>
                                  <tr>
                                    <th>{tr("Milestone", "Milestone")}</th>
                                    <th>
                                      {tr(
                                        "Required Amount",
                                        "Шаардлагатай дүн",
                                      )}
                                    </th>
                                    <th>{tr("Due", "Төлөх хугацаа")}</th>
                                    <th>{tr("Status", "Төлөв")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paymentDetails.milestones.map(
                                    (milestone) => {
                                      const dueCountdown = countdownMeta(
                                        milestone.due_at,
                                        nowMs,
                                        isMongolianLanguage,
                                      );
                                      const isNextToPay =
                                        Boolean(nextUnpaidMilestone) &&
                                        milestone.id ===
                                          nextUnpaidMilestone?.id;

                                      return (
                                        <tr
                                          key={milestone.id}
                                          className={
                                            isNextToPay ? "bg-amber-50" : ""
                                          }
                                        >
                                          <td>
                                            {paymentMilestoneLabel(
                                              milestone.code,
                                              isMongolianLanguage,
                                            )}
                                            {isNextToPay && (
                                              <div>
                                                <span className="inline-flex mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                  {tr(
                                                    "Next to pay",
                                                    "Дараа төлөх",
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </td>
                                          <td>
                                            {formatMnt(
                                              Number(
                                                milestone.required_cumulative_mnt ||
                                                  0,
                                              ),
                                            )}
                                          </td>
                                          <td>
                                            {milestone.due_at ? (
                                              <div className="flex flex-col">
                                                <span>
                                                  {new Date(
                                                    milestone.due_at,
                                                  ).toLocaleString()}
                                                </span>
                                                <span
                                                  className={`text-xs ${dueCountdown.className}`}
                                                >
                                                  {dueCountdown.label}
                                                </span>
                                              </div>
                                            ) : (
                                              "-"
                                            )}
                                          </td>
                                          <td>
                                            {paymentStateLabel(
                                              milestone.status,
                                              isMongolianLanguage,
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    },
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </details>

                    <details className="rounded-lg border border-gray-200 bg-white">
                      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-gray-800">
                        {tr("Payment history", "Төлбөрийн түүх")}
                      </summary>
                      <div className="border-t border-gray-200 px-3 py-3">
                        {!paymentDetails ||
                        paymentDetails.payments.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            {tr(
                              "No payment records yet. Pay the next milestone before its deadline.",
                              "Одоогоор төлбөрийн бүртгэл алга. Дараагийн milestone-ийг хугацаанаас нь өмнө төлнө үү.",
                            )}
                          </p>
                        ) : (
                          <div className="mono-table-shell">
                            <div className="mono-table-scroll">
                              <table className="mono-table mono-table--compact mono-table--sticky min-w-[760px]">
                                <thead>
                                  <tr>
                                    <th>{tr("Amount", "Дүн")}</th>
                                    <th>{tr("Method", "Арга")}</th>
                                    <th>{tr("Provider", "Провайдер")}</th>
                                    <th>{tr("Status", "Төлөв")}</th>
                                    <th>{tr("Paid At", "Төлсөн огноо")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paymentDetails.payments.map((payment) => (
                                    <tr key={payment.id}>
                                      <td>
                                        {formatMnt(
                                          Number(payment.amount_mnt || 0),
                                        )}
                                      </td>
                                      <td>{payment.payment_method}</td>
                                      <td>{payment.provider}</td>
                                      <td>
                                        {paymentStateLabel(
                                          payment.status,
                                          isMongolianLanguage,
                                        )}
                                      </td>
                                      <td>
                                        {payment.paid_at
                                          ? new Date(
                                              payment.paid_at,
                                            ).toLocaleString()
                                          : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

          {featureFlags.b2bRoleV2Enabled && historyView !== "payments" && (
            <div className="mono-card p-4 sm:p-5">
              <h3 className="font-semibold mb-3">
                {tr("Binding Request History", "Холбох хүсэлтийн түүх")}
              </h3>
              {recentBindingRequests.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {tr(
                    "No binding requests yet.",
                    "Одоогоор холбох хүсэлт алга.",
                  )}
                </p>
              ) : (
                <div className="mono-table-shell">
                  <div className="mono-table-scroll">
                    <table className="mono-table mono-table--compact mono-table--sticky min-w-[760px]">
                      <thead>
                        <tr>
                          <th>{tr("Merchant", "Merchant")}</th>
                          <th>{tr("Organization", "Байгууллага")}</th>
                          <th>{tr("Role", "Үүрэг")}</th>
                          <th>{tr("Status", "Төлөв")}</th>
                          <th>{tr("Submitted", "Илгээсэн")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBindingRequests.map((row) => (
                          <tr key={row.id}>
                            <td>{row.merchant_code}</td>
                            <td>
                              {row.organization_name ||
                                tr("Unknown", "Тодорхойгүй")}
                            </td>
                            <td>
                              {toRoleLabel(
                                row.requested_role,
                                isMongolianLanguage,
                              )}
                            </td>
                            <td>
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${bindingStatusClass(row.status)}`}
                              >
                                {bindingStatusLabel(
                                  row.status,
                                  isMongolianLanguage,
                                )}
                              </span>
                            </td>
                            <td>{new Date(row.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {workspaceTab === "yourRequests" && (
        <div className="mono-mobile-cta sm:hidden">
          <div className="mono-mobile-cta__inner">
            <button
              type="button"
              className="mono-button w-full"
              onClick={runWorkflowSummaryAction}
            >
              {workflowSummary.ctaLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
