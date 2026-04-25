import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveBindingRequest,
  approveSeatAccessRequest,
  listBindingRequests,
  listMonitoringSeatRequests,
  listSeatAccessRequests,
  rejectBindingRequest,
  rejectSeatAccessRequest,
} from "../api/b2b";
import type {
  B2BBindingRequestRow,
  B2BBindingRequestStatus,
  B2BMonitoringRow,
  B2BSeatAccessRequestRow,
  B2BSeatAccessRequestStatus,
} from "../api/b2b";
import { featureFlags } from "../config/featureFlags";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

type MonitoringFilters = {
  destination: string;
  status: string;
  organizationId: string;
  paymentState: string;
};

const INITIAL_FILTERS: MonitoringFilters = {
  destination: "",
  status: "",
  organizationId: "",
  paymentState: "",
};

const DEFAULT_DECLINE_MESSAGE =
  "Sorry your request has been declined, try again after a while.";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function isAlreadyReviewedSeatAccessError(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    message.includes("only pending seat access requests can be approved") ||
    message.includes("only pending seat access requests can be rejected")
  );
}

function statusChipClass(status: string) {
  if (status.includes("rejected") || status.includes("cancelled")) {
    return "bg-red-100 text-red-700";
  }
  if (status.includes("approved") || status.includes("confirmed") || status === "completed") {
    return "bg-green-100 text-green-700";
  }
  return "bg-amber-100 text-amber-700";
}

function paymentChipClass(status: string | null) {
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-blue-100 text-blue-700";
  if (status === "overdue") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function statusLabel(status: string, useMongolian = false) {
  if (!useMongolian) {
    return status;
  }

  const normalized = String(status || "").toLowerCase();
  if (normalized === "agent") return "Агент";
  if (normalized === "subcontractor") return "Туслан гүйцэтгэгч";
  if (normalized === "provider") return "Провайдер";
  if (normalized === "manager") return "Менежер";
  if (normalized === "admin" || normalized === "superadmin") return "Админ";
  if (normalized.includes("approved")) return "Батлагдсан";
  if (normalized.includes("rejected") || normalized.includes("cancelled")) {
    return "Татгалзсан";
  }
  if (normalized.includes("consumed")) return "Ашиглагдсан";
  if (normalized.includes("expired")) return "Хугацаа дууссан";
  if (normalized.includes("pending")) return "Хүлээгдэж байна";
  return status;
}

function paymentStateLabel(status: string | null, useMongolian = false) {
  const normalized = String(status || "unpaid").toLowerCase();
  if (!useMongolian) {
    return normalized;
  }

  if (normalized === "paid") return "төлөгдсөн";
  if (normalized === "partial") return "хэсэгчлэн төлсөн";
  if (normalized === "overdue") return "хугацаа хэтэрсэн";
  return "төлөгдөөгүй";
}

function requesterDisplayName(params: {
  requesterUsername?: string | null;
  requesterFirstName?: string | null;
  requesterLastName?: string | null;
  requesterEmail?: string | null;
  unknownLabel: string;
}) {
  const username = String(params.requesterUsername || "").trim();
  if (username) {
    return username;
  }

  const fullName = `${params.requesterFirstName || ""} ${params.requesterLastName || ""}`.trim();
  if (fullName) {
    return fullName;
  }

  const email = String(params.requesterEmail || "").trim();
  if (email.includes("@")) {
    return email.split("@")[0] || email;
  }

  if (email) {
    return email;
  }

  return params.unknownLabel;
}

function formatCountdown(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h:${String(minutes).padStart(2, "0")}m:${String(seconds).padStart(2, "0")}s`;
}

function deadlineMeta(deadlineAt: string | null, nowMs: number, useMongolian = false) {
  if (!deadlineAt) {
    return { label: "-", className: "text-gray-500", exact: null as string | null };
  }

  const time = new Date(deadlineAt).getTime();
  if (Number.isNaN(time)) {
    return { label: deadlineAt, className: "text-gray-700", exact: null as string | null };
  }

  const diff = time - nowMs;
  if (diff <= 0) {
    return {
      label: useMongolian ? "Хугацаа дууссан" : "Expired",
      className: "text-red-700 font-semibold",
      exact: new Date(deadlineAt).toLocaleString(),
    };
  }

  const countdown = useMongolian
    ? `${formatCountdown(diff)} үлдсэн`
    : `${formatCountdown(diff)} left`;
  if (diff <= 10 * 60 * 1000) {
    return {
      label: countdown,
      className: "text-red-700 font-semibold",
      exact: new Date(deadlineAt).toLocaleString(),
    };
  }

  if (diff <= 60 * 60 * 1000) {
    return {
      label: countdown,
      className: "text-amber-700 font-semibold",
      exact: new Date(deadlineAt).toLocaleString(),
    };
  }

  return {
    label: countdown,
    className: "text-gray-700",
    exact: new Date(deadlineAt).toLocaleString(),
  };
}

export default function B2BMonitoringPage() {
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

  const [rows, setRows] = useState<B2BMonitoringRow[]>([]);
  const [bindingRows, setBindingRows] = useState<B2BBindingRequestRow[]>([]);
  const [accessRows, setAccessRows] = useState<B2BSeatAccessRequestRow[]>([]);
  const [filters, setFilters] = useState<MonitoringFilters>(INITIAL_FILTERS);
  const [bindingStatusFilter, setBindingStatusFilter] = useState<B2BBindingRequestStatus | "">("pending");
  const [accessStatusFilter, setAccessStatusFilter] = useState<B2BSeatAccessRequestStatus | "">("pending");
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [loadingBinding, setLoadingBinding] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [accessActionLoadingId, setAccessActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [bindingErrorMessage, setBindingErrorMessage] = useState("");
  const [accessErrorMessage, setAccessErrorMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [accessRejectDialog, setAccessRejectDialog] = useState<{
    row: B2BSeatAccessRequestRow;
    reason: string;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const loadMonitoring = useCallback(async (activeFilters: MonitoringFilters) => {
    setLoadingMonitoring(true);
    setErrorMessage("");
    try {
      const params = Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value));
      const response = await listMonitoringSeatRequests(params as Record<string, string>);
      setRows(response.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        tr("Failed to load monitoring rows", "Monitoring мөрүүд ачаалж чадсангүй"),
      );
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingMonitoring(false);
    }
  }, [tr]);

  const loadBindingRequests = useCallback(async (statusFilter: B2BBindingRequestStatus | "") => {
    setLoadingBinding(true);
    setBindingErrorMessage("");
    try {
      const response = await listBindingRequests(statusFilter ? { status: statusFilter } : {});
      setBindingRows(response.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        tr("Failed to load binding requests", "Холбох хүсэлтүүдийг ачаалж чадсангүй"),
      );
      setBindingErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingBinding(false);
    }
  }, [tr]);

  const loadSeatAccessRequests = useCallback(async (statusFilter: B2BSeatAccessRequestStatus | "") => {
    setLoadingAccess(true);
    setAccessErrorMessage("");
    try {
      const response = await listSeatAccessRequests(statusFilter ? { status: statusFilter } : {});
      setAccessRows(response.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        tr(
          "Failed to load seat access requests",
          "Seat access хүсэлтүүдийг ачаалж чадсангүй",
        ),
      );
      setAccessErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingAccess(false);
    }
  }, [tr]);

  useEffect(() => {
    void loadMonitoring(INITIAL_FILTERS);
    if (featureFlags.b2bRoleV2Enabled) {
      void loadBindingRequests("pending");
    }
    if (featureFlags.b2bSeatRequestFlowEnabled) {
      void loadSeatAccessRequests("pending");
    }
  }, [loadMonitoring, loadBindingRequests, loadSeatAccessRequests]);

  const applyFilters = () => {
    void loadMonitoring(filters);
    if (featureFlags.b2bRoleV2Enabled) {
      void loadBindingRequests(bindingStatusFilter);
    }
    if (featureFlags.b2bSeatRequestFlowEnabled) {
      void loadSeatAccessRequests(accessStatusFilter);
    }
  };

  const handleBindingDecision = async (
    row: B2BBindingRequestRow,
    decision: "approve" | "reject",
  ) => {
    if (actionLoadingId) return;

    setActionLoadingId(row.id);
    try {
      if (decision === "approve") {
        await approveBindingRequest(row.id);
        toast.success(tr("Binding request approved", "Холбох хүсэлт батлагдлаа"));
      } else {
        await rejectBindingRequest(row.id);
        toast.success(tr("Binding request rejected", "Холбох хүсэлт татгалзагдлаа"));
      }
      await loadBindingRequests(bindingStatusFilter);
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(
          error,
          tr(
            `Failed to ${decision} binding request`,
            `Холбох хүсэлтийг ${decision === "approve" ? "батлах" : "татгалзах"} үед алдаа гарлаа`,
          ),
        ),
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSeatAccessDecision = async (
    row: B2BSeatAccessRequestRow,
    decision: "approve" | "reject",
    reason?: string,
  ) => {
    if (accessActionLoadingId) return;

    setAccessActionLoadingId(row.id);
    try {
      if (decision === "approve") {
        await approveSeatAccessRequest(row.id);
        toast.success(
          tr("Seat access request approved", "Seat access хүсэлт батлагдлаа"),
        );
      } else {
        await rejectSeatAccessRequest(row.id, reason);
        toast.success(
          tr(
            "Seat access request rejected",
            "Seat access хүсэлт татгалзагдлаа",
          ),
        );
      }
      await loadSeatAccessRequests(accessStatusFilter);
    } catch (error: unknown) {
      if (isAlreadyReviewedSeatAccessError(error)) {
        await loadSeatAccessRequests(accessStatusFilter);
        toast.info(
          tr(
            "This request was already reviewed. The list has been refreshed.",
            "Энэ хүсэлтийг аль хэдийн хянасан байна. Жагсаалтыг шинэчиллээ.",
          ),
        );
        return;
      }

      toast.error(
        getErrorMessage(
          error,
          tr(
            `Failed to ${decision} seat access request`,
            `Seat access хүсэлтийг ${decision === "approve" ? "батлах" : "татгалзах"} үед алдаа гарлаа`,
          ),
        ),
      );
    } finally {
      setAccessActionLoadingId(null);
    }
  };

  const handleSeatAccessRejectClick = (row: B2BSeatAccessRequestRow) => {
    setAccessRejectDialog({
      row,
      reason: tr(
        DEFAULT_DECLINE_MESSAGE,
        "Уучлаарай, таны хүсэлт татгалзагдлаа. Дараа дахин оролдоно уу.",
      ),
    });
  };

  const submitSeatAccessReject = () => {
    if (!accessRejectDialog) {
      return;
    }

    const reason =
      accessRejectDialog.reason.trim() ||
      tr(
        DEFAULT_DECLINE_MESSAGE,
        "Уучлаарай, таны хүсэлт татгалзагдлаа. Дараа дахин оролдоно уу.",
      );

    const targetRow = accessRejectDialog.row;
    setAccessRejectDialog(null);
    void handleSeatAccessDecision(targetRow, "reject", reason);
  };

  const pendingAccessTotal = useMemo(
    () => accessRows.filter((row) => row.status === "pending").length,
    [accessRows],
  );
  const pendingBindingTotal = useMemo(
    () => bindingRows.filter((row) => row.status === "pending").length,
    [bindingRows],
  );
  const overdueDeadlineTotal = useMemo(
    () =>
      rows.filter((row) => {
        const dueMs = new Date(row.next_deadline_at || "").getTime();
        return Number.isFinite(dueMs) && dueMs <= nowMs;
      }).length,
    [rows, nowMs],
  );
  const unpaidSeatRequestTotal = useMemo(
    () =>
      rows.filter(
        (row) => String(row.current_payment_state || "unpaid").toLowerCase() !== "paid",
      ).length,
    [rows],
  );

  return (
    <div className="mono-container px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="mono-card p-4 sm:p-5">
        <h2 className="mono-title text-xl">
          {tr("B2B Monitoring", "B2B хяналт")}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {tr(
            "Admin/Manager oversight for seat requests, deadlines, payment status, and organization binding approvals.",
            "Админ/Менежерийн seat request, хугацаа, төлбөрийн төлөв болон байгууллага холбох баталгаажуулалтын хяналт.",
          )}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="mono-panel p-3">
            <p className="text-xs text-gray-500">
              {tr("Pending Seat Access", "Хүлээгдэж буй seat access")}
            </p>
            <p className="mono-title text-lg mt-1">{pendingAccessTotal}</p>
          </div>
          <div className="mono-panel p-3">
            <p className="text-xs text-gray-500">
              {tr("Pending Bindings", "Хүлээгдэж буй холболтууд")}
            </p>
            <p className="mono-title text-lg mt-1">{pendingBindingTotal}</p>
          </div>
          <div className="mono-panel p-3">
            <p className="text-xs text-gray-500">
              {tr("Unpaid Seat Requests", "Төлөгдөөгүй seat request")}
            </p>
            <p className="mono-title text-lg mt-1">{unpaidSeatRequestTotal}</p>
          </div>
          <div className="mono-panel p-3">
            <p className="text-xs text-gray-500">
              {tr("Overdue Deadlines", "Хэтэрсэн хугацаа")}
            </p>
            <p className="mono-title text-lg mt-1">{overdueDeadlineTotal}</p>
          </div>
        </div>
        {errorMessage && <p className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      </div>

      <div className="mono-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
          <input
            className="mono-input"
            placeholder={tr("Destination", "Чиглэл")}
            value={filters.destination}
            onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
          />
          <input
            className="mono-input"
            placeholder={tr("Status", "Төлөв")}
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          />
          <input
            className="mono-input"
            placeholder={tr("Organization ID", "Байгууллагын ID")}
            value={filters.organizationId}
            onChange={(e) => setFilters((prev) => ({ ...prev, organizationId: e.target.value }))}
          />
          <input
            className="mono-input"
            placeholder={tr("Payment State", "Төлбөрийн төлөв")}
            value={filters.paymentState}
            onChange={(e) => setFilters((prev) => ({ ...prev, paymentState: e.target.value }))}
          />
          {featureFlags.b2bRoleV2Enabled ? (
            <select
              className="mono-input"
              value={bindingStatusFilter}
              onChange={(e) =>
                setBindingStatusFilter(e.target.value as B2BBindingRequestStatus | "")
              }
            >
              <option value="pending">{tr("Pending bindings", "Хүлээгдэж буй холболтууд")}</option>
              <option value="approved">{tr("Approved bindings", "Батлагдсан холболтууд")}</option>
              <option value="rejected">{tr("Rejected bindings", "Татгалзсан холболтууд")}</option>
              <option value="">{tr("All bindings", "Бүх холболтууд")}</option>
            </select>
          ) : (
            <div className="mono-input flex items-center text-xs text-gray-500">
              {tr(
                "Binding workflow disabled",
                "Холбох workflow идэвхгүй байна",
              )} {" "}
              (`B2B_ROLE_V2_ENABLED=false`)
            </div>
          )}
          {featureFlags.b2bSeatRequestFlowEnabled ? (
            <select
              className="mono-input"
              value={accessStatusFilter}
              onChange={(e) =>
                setAccessStatusFilter(e.target.value as B2BSeatAccessRequestStatus | "")
              }
            >
              <option value="pending">{tr("Pending access", "Хүлээгдэж буй access")}</option>
              <option value="approved">{tr("Approved access", "Батлагдсан access")}</option>
              <option value="rejected">{tr("Rejected access", "Татгалзсан access")}</option>
              <option value="consumed">{tr("Consumed access", "Ашиглагдсан access")}</option>
              <option value="expired">{tr("Expired access", "Хугацаа дууссан access")}</option>
              <option value="">{tr("All access requests", "Бүх access хүсэлт")}</option>
            </select>
          ) : (
            <div className="mono-input flex items-center text-xs text-gray-500">
              {tr(
                "Seat access workflow disabled",
                "Seat access workflow идэвхгүй байна",
              )} {" "}
              (`B2B_SEAT_REQUEST_FLOW_ENABLED=false`)
            </div>
          )}
          <button
            className="mono-button w-full sm:col-span-2 md:col-span-3 xl:col-span-1"
            onClick={applyFilters}
            disabled={loadingMonitoring || loadingBinding || loadingAccess}
          >
            {loadingMonitoring || loadingBinding || loadingAccess
              ? tr("Loading...", "Ачаалж байна...")
              : tr("Apply Filters", "Шүүлтүүр хэрэгжүүлэх")}
          </button>
        </div>
      </div>

      {featureFlags.b2bSeatRequestFlowEnabled && (
        <div className="mono-card p-4 sm:p-5">
          <h3 className="font-semibold mb-3">
            {tr(
              "Seat Access Requests (One-Time Approval)",
              "Seat access хүсэлтүүд (Нэг удаагийн баталгаа)",
            )}
          </h3>
          {accessErrorMessage && <p className="text-sm text-red-600 mb-2">{accessErrorMessage}</p>}
          {loadingAccess ? (
            <p className="text-sm text-gray-500">
              {tr("Loading seat access requests...", "Seat access хүсэлтүүдийг ачаалж байна...")}
            </p>
          ) : accessRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              {tr(
                "No seat access requests match the selected status.",
                "Сонгосон төлөвт тохирох seat access хүсэлт алга.",
              )}
            </div>
          ) : (
            <div className="mono-table-shell">
              <div className="mono-table-scroll">
                <table className="mono-table mono-table--compact mono-table--sticky min-w-[980px]">
                  <thead>
                    <tr>
                      <th>{tr("Requester", "Хүсэлт гаргагч")}</th>
                      <th>{tr("Organization", "Байгууллага")}</th>
                      <th>{tr("Role", "Үүрэг")}</th>
                      <th>{tr("Destination", "Чиглэл")}</th>
                      <th>{tr("Planned Seats", "Төлөвлөсөн суудал")}</th>
                      <th>{tr("Date Window", "Огнооны хүрээ")}</th>
                      <th>{tr("Status", "Төлөв")}</th>
                      <th>{tr("Submitted", "Илгээсэн")}</th>
                      <th>{tr("Action", "Үйлдэл")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessRows.map((row) => (
                      <tr key={row.id} className="align-top">
                    <td>
                      <div className="font-medium">
                        {requesterDisplayName({
                          requesterUsername: row.requester_username,
                          requesterFirstName: row.requester_first_name,
                          requesterLastName: row.requester_last_name,
                          requesterEmail: row.requester_email,
                          unknownLabel: tr("Unknown user", "Тодорхойгүй хэрэглэгч"),
                        })}
                      </div>
                      <div className="text-xs text-gray-500 break-all">{row.requester_email || "-"}</div>
                    </td>
                    <td>{row.organization_name || tr("Unknown", "Тодорхойгүй")}</td>
                    <td>{statusLabel(row.requester_role, isMongolianLanguage)}</td>
                    <td>{row.destination}</td>
                    <td>{row.planned_seats}</td>
                    <td>
                      {row.from_date} - {row.to_date}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}
                      >
                        {statusLabel(row.status, isMongolianLanguage)}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      {row.status !== "pending" ? (
                        <span className="text-xs text-gray-500">
                          {row.reviewed_at
                            ? tr(
                                `Reviewed ${new Date(row.reviewed_at).toLocaleString()}`,
                                `Хянасан: ${new Date(row.reviewed_at).toLocaleString()}`,
                              )
                            : tr("Reviewed", "Хянасан")}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={accessActionLoadingId === row.id}
                            onClick={() => void handleSeatAccessDecision(row, "approve")}
                          >
                            {tr("Approve", "Батлах")}
                          </button>
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={accessActionLoadingId === row.id}
                            onClick={() => handleSeatAccessRejectClick(row)}
                          >
                            {tr("Reject", "Татгалзах")}
                          </button>
                        </div>
                      )}
                    </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mono-card p-4 sm:p-5">
        <h3 className="font-semibold mb-3">
          {tr("Seat Request Monitoring", "Seat request хяналтын хүснэгт")}
        </h3>
        {loadingMonitoring ? (
          <p className="text-sm text-gray-500">
            {tr("Loading seat request rows...", "Seat request мөрүүдийг ачаалж байна...")}
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            {tr(
              "No seat request rows match the current filters.",
              "Одоогийн шүүлтүүрт тохирох seat request мөр алга.",
            )}
          </div>
        ) : (
          <div className="mono-table-shell">
            <div className="mono-table-scroll">
              <table className="mono-table mono-table--compact mono-table--sticky min-w-[980px]">
                <thead>
                  <tr>
                    <th>{tr("Requester", "Хүсэлт гаргагч")}</th>
                    <th>{tr("Organization", "Байгууллага")}</th>
                    <th>{tr("Role", "Үүрэг")}</th>
                    <th>{tr("Seats", "Суудал")}</th>
                    <th>{tr("Destination", "Чиглэл")}</th>
                    <th>{tr("Request Date", "Хүсэлтийн огноо")}</th>
                    <th>{tr("Payment", "Төлбөр")}</th>
                    <th>{tr("Status", "Төлөв")}</th>
                    <th>{tr("Deadline", "Сүүлчийн хугацаа")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const deadline = deadlineMeta(
                      row.next_deadline_at,
                      nowMs,
                      isMongolianLanguage,
                    );
                    return (
                      <tr key={row.id} className="align-top">
                    <td>
                      <div className="font-medium">
                        {requesterDisplayName({
                          requesterUsername: row.requester_username,
                          requesterFirstName: row.first_name,
                          requesterLastName: row.last_name,
                          requesterEmail: row.email,
                          unknownLabel: tr("Unknown user", "Тодорхойгүй хэрэглэгч"),
                        })}
                      </div>
                      <div className="text-xs text-gray-500 break-all">{row.email || "-"}</div>
                    </td>
                    <td>{row.organization_name}</td>
                    <td>{statusLabel(row.requester_role, isMongolianLanguage)}</td>
                    <td>{row.requested_seats}</td>
                    <td>{row.destination}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${paymentChipClass(
                          row.current_payment_state,
                        )}`}
                      >
                        {paymentStateLabel(
                          row.current_payment_state,
                          isMongolianLanguage,
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}
                      >
                        {statusLabel(row.status, isMongolianLanguage)}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className={deadline.className}>{deadline.label}</span>
                        {deadline.exact && (
                          <span className="text-xs text-gray-500">
                            {tr("Due At", "Төлөх хугацаа")}: {deadline.exact}
                          </span>
                        )}
                      </div>
                    </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {featureFlags.b2bRoleV2Enabled && (
        <div className="mono-card p-4 sm:p-5">
          <h3 className="font-semibold mb-3">
            {tr("Employee Binding Requests", "Ажилтны холбох хүсэлтүүд")}
          </h3>
          {bindingErrorMessage && <p className="text-sm text-red-600 mb-2">{bindingErrorMessage}</p>}
          {loadingBinding ? (
            <p className="text-sm text-gray-500">
              {tr("Loading binding requests...", "Холбох хүсэлтүүдийг ачаалж байна...")}
            </p>
          ) : bindingRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              {tr(
                "No binding requests match the selected status.",
                "Сонгосон төлөвт тохирох холбох хүсэлт алга.",
              )}
            </div>
          ) : (
            <div className="mono-table-shell">
              <div className="mono-table-scroll">
                <table className="mono-table mono-table--compact mono-table--sticky min-w-[860px]">
                  <thead>
                    <tr>
                      <th>{tr("Requester", "Хүсэлт гаргагч")}</th>
                      <th>{tr("Merchant", "Merchant")}</th>
                      <th>{tr("Organization", "Байгууллага")}</th>
                      <th>{tr("Requested Role", "Хүссэн үүрэг")}</th>
                      <th>{tr("Status", "Төлөв")}</th>
                      <th>{tr("Submitted", "Илгээсэн")}</th>
                      <th>{tr("Action", "Үйлдэл")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bindingRows.map((row) => (
                      <tr key={row.id} className="align-top">
                    <td>
                      <div className="font-medium">
                        {requesterDisplayName({
                          requesterUsername: row.requester_username,
                          requesterFirstName: row.requester_first_name,
                          requesterLastName: row.requester_last_name,
                          requesterEmail: row.requester_email,
                          unknownLabel: tr("Unknown user", "Тодорхойгүй хэрэглэгч"),
                        })}
                      </div>
                      <div className="text-xs text-gray-500 break-all">{row.requester_email || "-"}</div>
                    </td>
                    <td>{row.merchant_code}</td>
                    <td>{row.organization_name || tr("Unknown", "Тодорхойгүй")}</td>
                    <td>{statusLabel(row.requested_role, isMongolianLanguage)}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}
                      >
                        {statusLabel(row.status, isMongolianLanguage)}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      {row.status !== "pending" ? (
                        <span className="text-xs text-gray-500">
                          {row.reviewed_at
                            ? tr(
                                `Reviewed ${new Date(row.reviewed_at).toLocaleString()}`,
                                `Хянасан: ${new Date(row.reviewed_at).toLocaleString()}`,
                              )
                            : tr("Reviewed", "Хянасан")}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={actionLoadingId === row.id}
                            onClick={() => void handleBindingDecision(row, "approve")}
                          >
                            {tr("Approve", "Батлах")}
                          </button>
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={actionLoadingId === row.id}
                            onClick={() => void handleBindingDecision(row, "reject")}
                          >
                            {tr("Reject", "Татгалзах")}
                          </button>
                        </div>
                      )}
                    </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {accessRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:px-4">
          <div className="mono-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="mono-title text-base">
                {tr("Reject seat access request", "Seat access хүсэлт татгалзах")}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {tr(
                  "Provide the decline message that will be shown to requester.",
                  "Хүсэлт гаргагчид харагдах татгалзсан тайлбарыг оруулна уу.",
                )}
              </p>
            </div>

            <textarea
              className="mono-input"
              rows={4}
              value={accessRejectDialog.reason}
              onChange={(event) =>
                setAccessRejectDialog((prev) =>
                  prev
                    ? {
                        ...prev,
                        reason: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder={tr(
                "Enter rejection reason",
                "Татгалзсан шалтгаанаа оруулна уу",
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="mono-button mono-button--ghost w-full sm:w-auto"
                onClick={() => setAccessRejectDialog(null)}
              >
                {tr("Cancel", "Цуцлах")}
              </button>
              <button
                type="button"
                className="mono-button w-full sm:w-auto"
                onClick={submitSeatAccessReject}
                disabled={accessActionLoadingId === accessRejectDialog.row.id}
              >
                {accessActionLoadingId === accessRejectDialog.row.id
                  ? tr("Rejecting...", "Татгалзаж байна...")
                  : tr("Reject Request", "Хүсэлт татгалзах")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
