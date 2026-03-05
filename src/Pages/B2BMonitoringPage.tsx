import { useCallback, useEffect, useState } from "react";
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
import { toast } from "react-hot-toast";

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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

function deadlineMeta(deadlineAt: string | null) {
  if (!deadlineAt) {
    return { label: "-", className: "text-gray-500" };
  }

  const time = new Date(deadlineAt).getTime();
  if (Number.isNaN(time)) {
    return { label: deadlineAt, className: "text-gray-700" };
  }

  const now = Date.now();
  const diff = time - now;
  if (diff < 0) {
    return {
      label: `Overdue (${new Date(deadlineAt).toLocaleString()})`,
      className: "text-red-700 font-semibold",
    };
  }

  if (diff <= 24 * 60 * 60 * 1000) {
    return {
      label: `Due soon (${new Date(deadlineAt).toLocaleString()})`,
      className: "text-amber-700 font-semibold",
    };
  }

  return { label: new Date(deadlineAt).toLocaleString(), className: "text-gray-700" };
}

export default function B2BMonitoringPage() {
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

  const loadMonitoring = useCallback(async (activeFilters: MonitoringFilters) => {
    setLoadingMonitoring(true);
    setErrorMessage("");
    try {
      const params = Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value));
      const response = await listMonitoringSeatRequests(params as Record<string, string>);
      setRows(response.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to load monitoring rows");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingMonitoring(false);
    }
  }, []);

  const loadBindingRequests = useCallback(async (statusFilter: B2BBindingRequestStatus | "") => {
    setLoadingBinding(true);
    setBindingErrorMessage("");
    try {
      const response = await listBindingRequests(statusFilter ? { status: statusFilter } : {});
      setBindingRows(response.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to load binding requests");
      setBindingErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingBinding(false);
    }
  }, []);

  const loadSeatAccessRequests = useCallback(async (statusFilter: B2BSeatAccessRequestStatus | "") => {
    setLoadingAccess(true);
    setAccessErrorMessage("");
    try {
      const response = await listSeatAccessRequests(statusFilter ? { status: statusFilter } : {});
      setAccessRows(response.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to load seat access requests");
      setAccessErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingAccess(false);
    }
  }, []);

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
        toast.success("Binding request approved");
      } else {
        await rejectBindingRequest(row.id);
        toast.success("Binding request rejected");
      }
      await loadBindingRequests(bindingStatusFilter);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, `Failed to ${decision} binding request`));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSeatAccessDecision = async (
    row: B2BSeatAccessRequestRow,
    decision: "approve" | "reject",
  ) => {
    if (accessActionLoadingId) return;

    setAccessActionLoadingId(row.id);
    try {
      if (decision === "approve") {
        await approveSeatAccessRequest(row.id);
        toast.success("Seat access request approved");
      } else {
        await rejectSeatAccessRequest(row.id);
        toast.success("Seat access request rejected");
      }
      await loadSeatAccessRequests(accessStatusFilter);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, `Failed to ${decision} seat access request`));
    } finally {
      setAccessActionLoadingId(null);
    }
  };

  return (
    <div className="mono-container px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="mono-card p-5">
        <h2 className="mono-title text-xl">B2B Monitoring</h2>
        <p className="text-sm text-gray-600 mt-1">
          Admin/Manager oversight for seat requests, deadlines, payment status, and organization binding approvals.
        </p>
        {errorMessage && <p className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      </div>

      <div className="mono-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <input
            className="mono-input"
            placeholder="Destination"
            value={filters.destination}
            onChange={(e) => setFilters((prev) => ({ ...prev, destination: e.target.value }))}
          />
          <input
            className="mono-input"
            placeholder="Status"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          />
          <input
            className="mono-input"
            placeholder="Organization ID"
            value={filters.organizationId}
            onChange={(e) => setFilters((prev) => ({ ...prev, organizationId: e.target.value }))}
          />
          <input
            className="mono-input"
            placeholder="Payment State"
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
              <option value="pending">Pending bindings</option>
              <option value="approved">Approved bindings</option>
              <option value="rejected">Rejected bindings</option>
              <option value="">All bindings</option>
            </select>
          ) : (
            <div className="mono-input flex items-center text-xs text-gray-500">
              Binding workflow disabled (`B2B_ROLE_V2_ENABLED=false`)
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
              <option value="pending">Pending access</option>
              <option value="approved">Approved access</option>
              <option value="rejected">Rejected access</option>
              <option value="consumed">Consumed access</option>
              <option value="expired">Expired access</option>
              <option value="">All access requests</option>
            </select>
          ) : (
            <div className="mono-input flex items-center text-xs text-gray-500">
              Seat access workflow disabled (`B2B_SEAT_REQUEST_FLOW_ENABLED=false`)
            </div>
          )}
          <button
            className="mono-button"
            onClick={applyFilters}
            disabled={loadingMonitoring || loadingBinding || loadingAccess}
          >
            {loadingMonitoring || loadingBinding || loadingAccess ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {featureFlags.b2bSeatRequestFlowEnabled && (
        <div className="mono-card p-5 overflow-x-auto">
          <h3 className="font-semibold mb-3">Seat Access Requests (One Approval)</h3>
          {accessErrorMessage && <p className="text-sm text-red-600 mb-2">{accessErrorMessage}</p>}
          {loadingAccess ? (
            <p className="text-sm text-gray-500">Loading seat access requests...</p>
          ) : accessRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No seat access requests match the selected status.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Requester</th>
                  <th>Organization</th>
                  <th>Role</th>
                  <th>Destination</th>
                  <th>Date Window</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {accessRows.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td>
                      <div className="font-medium">
                        {`${row.requester_first_name || ""} ${row.requester_last_name || ""}`.trim() || "Unknown user"}
                      </div>
                      <div className="text-xs text-gray-500">{row.requester_email || "-"}</div>
                    </td>
                    <td>{row.organization_name || "Unknown"}</td>
                    <td>{row.requester_role}</td>
                    <td>{row.destination}</td>
                    <td>
                      {row.from_date} - {row.to_date}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      {row.status !== "pending" ? (
                        <span className="text-xs text-gray-500">
                          {row.reviewed_at
                            ? `Reviewed ${new Date(row.reviewed_at).toLocaleString()}`
                            : "Reviewed"}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={accessActionLoadingId === row.id}
                            onClick={() => void handleSeatAccessDecision(row, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={accessActionLoadingId === row.id}
                            onClick={() => void handleSeatAccessDecision(row, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="mono-card p-5 overflow-x-auto">
        <h3 className="font-semibold mb-3">Seat Request Monitoring</h3>
        {loadingMonitoring ? (
          <p className="text-sm text-gray-500">Loading seat-request rows...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No seat-request rows match the current filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th>Requester</th>
                <th>Organization</th>
                <th>Role</th>
                <th>Seats</th>
                <th>Destination</th>
                <th>Request Date</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const deadline = deadlineMeta(row.next_deadline_at);
                return (
                  <tr key={row.id} className="border-b align-top">
                    <td>{`${row.first_name || ""} ${row.last_name || ""}`.trim() || row.email}</td>
                    <td>{row.organization_name}</td>
                    <td>{row.requester_role}</td>
                    <td>{row.requested_seats}</td>
                    <td>{row.destination}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${paymentChipClass(
                          row.current_payment_state,
                        )}`}
                      >
                        {row.current_payment_state || "unpaid"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <span className={deadline.className}>{deadline.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {featureFlags.b2bRoleV2Enabled && (
        <div className="mono-card p-5 overflow-x-auto">
          <h3 className="font-semibold mb-3">Employee Binding Requests</h3>
          {bindingErrorMessage && <p className="text-sm text-red-600 mb-2">{bindingErrorMessage}</p>}
          {loadingBinding ? (
            <p className="text-sm text-gray-500">Loading binding requests...</p>
          ) : bindingRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No binding requests match the selected status.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Requester</th>
                  <th>Merchant</th>
                  <th>Organization</th>
                  <th>Requested Role</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bindingRows.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td>
                      <div className="font-medium">
                        {`${row.requester_first_name || ""} ${row.requester_last_name || ""}`.trim() || "Unknown user"}
                      </div>
                      <div className="text-xs text-gray-500">{row.requester_email || "-"}</div>
                    </td>
                    <td>{row.merchant_code}</td>
                    <td>{row.organization_name || "Unknown"}</td>
                    <td>{row.requested_role}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      {row.status !== "pending" ? (
                        <span className="text-xs text-gray-500">
                          {row.reviewed_at
                            ? `Reviewed ${new Date(row.reviewed_at).toLocaleString()}`
                            : "Reviewed"}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={actionLoadingId === row.id}
                            onClick={() => void handleBindingDecision(row, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="mono-button mono-button--ghost"
                            disabled={actionLoadingId === row.id}
                            onClick={() => void handleBindingDecision(row, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
