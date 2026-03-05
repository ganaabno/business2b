import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import {
  createBindingRequest,
  createDepositIntent,
  createSeatAccessRequest,
  getProfileOverview,
  getSeatRequestPayments,
  listSeatAccessRequests,
  listSeatRequests,
  searchB2BTours,
  simulateSeatRequestPayment,
  selectTourFromSeatAccessRequest,
} from "../api/b2b";
import type {
  B2BBindingRequestRow,
  B2BDepositIntent,
  B2BProfileOverview,
  B2BSeatAccessRequestRow,
  B2BSeatRequestPayments,
  B2BSeatRequestRow,
  B2BTourSearchRow,
} from "../api/b2b";
import { featureFlags } from "../config/featureFlags";
import type { User } from "../types/type";
import { toast } from "react-hot-toast";

type Props = {
  currentUser: User;
  workspaceRole?: WorkspaceRole;
  adminTestModeActive?: boolean;
};
type BindingRole = "subcontractor" | "agent";
type WorkspaceRole = "subcontractor" | "agent";

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
  if (status.includes("approved") || status.includes("confirmed") || status === "completed") {
    return "bg-green-100 text-green-700";
  }
  return "bg-amber-100 text-amber-700";
}

function toRoleLabel(role: BindingRole) {
  return role === "agent" ? "Agent" : "SubContractor";
}

function formatMnt(value: number) {
  return `${Math.round(value).toLocaleString()} MNT`;
}

function countdownLabel(dueAt: string | null, nowMs: number) {
  if (!dueAt) return "-";
  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) return dueAt;
  const diff = dueTime - nowMs;
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default function B2BSeatRequestsPage({
  currentUser,
  workspaceRole,
  adminTestModeActive = false,
}: Props) {
  const [requests, setRequests] = useState<B2BSeatRequestRow[]>([]);
  const [accessRequests, setAccessRequests] = useState<B2BSeatAccessRequestRow[]>([]);
  const [profile, setProfile] = useState<B2BProfileOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [selectionSubmitting, setSelectionSubmitting] = useState(false);
  const [bindingSubmitting, setBindingSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [testPaymentSubmitting, setTestPaymentSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tours, setTours] = useState<B2BTourSearchRow[]>([]);
  const [tourPage, setTourPage] = useState(1);
  const [selectedAccessRequestId, setSelectedAccessRequestId] = useState("");
  const [selectedSeatRequestId, setSelectedSeatRequestId] = useState("");
  const [selectedTour, setSelectedTour] = useState<B2BTourSearchRow | null>(null);
  const [requestedSeats, setRequestedSeats] = useState(1);
  const [nowMs, setNowMs] = useState(Date.now());
  const [paymentDetails, setPaymentDetails] = useState<B2BSeatRequestPayments | null>(null);
  const [depositIntent, setDepositIntent] = useState<B2BDepositIntent | null>(null);
  const [tourFilters, setTourFilters] = useState({
    minSeats: "",
    minPrice: "",
    maxPrice: "",
  });
  const [accessForm, setAccessForm] = useState({
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
    destination: "",
    note: "",
  });
  const [debouncedTourFilters] = useDebounce(tourFilters, 350);
  const cacheRef = useRef<Record<string, B2BTourSearchRow[]>>({});

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

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setBindingForm((prev) => ({ ...prev, requestedRole: defaultBindingRole }));
  }, [defaultBindingRole]);

  const roleLabel = useMemo(() => toRoleLabel(defaultBindingRole), [defaultBindingRole]);

  const selectedAccessRequest = useMemo(() => {
    return (
      accessRequests.find((row) => row.id === selectedAccessRequestId && row.status === "approved") ||
      accessRequests.find((row) => row.status === "approved") ||
      null
    );
  }, [accessRequests, selectedAccessRequestId]);

  const approvedAccessCount = useMemo(
    () => accessRequests.filter((row) => row.status === "approved").length,
    [accessRequests],
  );
  const hasApprovedAccess = approvedAccessCount > 0;

  const pagedTours = useMemo(() => {
    const start = (tourPage - 1) * 10;
    return tours.slice(start, start + 10);
  }, [tours, tourPage]);

  const totalTourPages = Math.max(1, Math.ceil(tours.length / 10));
  const recentBindingRequests = profile?.bindingRequests || [];

  const activeAgentPoints = useMemo(() => {
    return Number(currentUser.membership_points || 0);
  }, [currentUser.membership_points]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [reqRes, profileRes, accessRes] = await Promise.all([
        listSeatRequests(),
        featureFlags.b2bRoleV2Enabled
          ? getProfileOverview()
          : Promise.resolve({ data: null }),
        listSeatAccessRequests(),
      ]);

      setRequests(reqRes.data || []);
      setProfile(profileRes.data || null);
      setAccessRequests(accessRes.data || []);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to load B2B seat workflow data");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPaymentDetails = useCallback(async (seatRequestId: string) => {
    if (!seatRequestId) return;
    setPaymentLoading(true);
    try {
      const [paymentsResponse, depositResponse] = await Promise.all([
        getSeatRequestPayments(seatRequestId),
        createDepositIntent(seatRequestId).catch(() => null),
      ]);

      setPaymentDetails(paymentsResponse.data || { milestones: [], payments: [] });
      setDepositIntent(depositResponse?.data || null);
    } catch (error: unknown) {
      setPaymentDetails(null);
      setDepositIntent(null);
      toast.error(getErrorMessage(error, "Failed to load payment milestones"));
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!selectedAccessRequest) {
      setTours([]);
      setTourPage(1);
      return;
    }

    const key = JSON.stringify({
      accessRequestId: selectedAccessRequest.id,
      from: selectedAccessRequest.from_date,
      to: selectedAccessRequest.to_date,
      destination: selectedAccessRequest.destination,
      ...debouncedTourFilters,
    });

    if (cacheRef.current[key]) {
      setTours(cacheRef.current[key]);
      setTourPage(1);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    searchB2BTours(
      Object.fromEntries(
        Object.entries({
          from: selectedAccessRequest.from_date,
          to: selectedAccessRequest.to_date,
          destination: selectedAccessRequest.destination,
          minSeats: debouncedTourFilters.minSeats,
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
        setTourPage(1);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTours([]);
          toast.error(getErrorMessage(error, "Failed to search tours"));
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
  }, [debouncedTourFilters, selectedAccessRequest]);

  useEffect(() => {
    if (selectedAccessRequest && selectedAccessRequestId !== selectedAccessRequest.id) {
      setSelectedAccessRequestId(selectedAccessRequest.id);
    }
  }, [selectedAccessRequest, selectedAccessRequestId]);

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
      return;
    }
    void loadPaymentDetails(selectedSeatRequestId);
  }, [selectedSeatRequestId, loadPaymentDetails]);

  const submitAccessRequest = async () => {
    if (accessSubmitting) return;
    if (!accessForm.destination.trim()) {
      toast.error("Destination is required");
      return;
    }
    if (new Date(accessForm.fromDate).getTime() > new Date(accessForm.toDate).getTime()) {
      toast.error("From date must be before or equal to To date");
      return;
    }

    setAccessSubmitting(true);
    try {
      await createSeatAccessRequest({
        fromDate: accessForm.fromDate,
        toDate: accessForm.toDate,
        destination: accessForm.destination.trim(),
        note: accessForm.note.trim() || undefined,
      });
      toast.success("Request sent to manager/admin for approval");
      setAccessForm((prev) => ({ ...prev, note: "" }));
      await loadBase();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to submit seat access request"));
    } finally {
      setAccessSubmitting(false);
    }
  };

  const submitBinding = async () => {
    if (bindingSubmitting) return;

    const merchantCode = bindingForm.merchantCode.trim().toUpperCase();
    if (!merchantCode) {
      toast.error("Merchant code is required");
      return;
    }

    setBindingSubmitting(true);
    try {
      await createBindingRequest({
        merchantCode,
        requestedRole: bindingForm.requestedRole,
        note: bindingForm.note.trim() || undefined,
      });
      toast.success("Binding request submitted");
      setBindingForm((prev) => ({ ...prev, merchantCode: "", note: "" }));
      await loadBase();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to submit binding request"));
    } finally {
      setBindingSubmitting(false);
    }
  };

  const submitTourSelection = async () => {
    if (selectionSubmitting) return;
    if (!selectedAccessRequest) {
      toast.error("Choose an approved request first");
      return;
    }
    if (!selectedTour) {
      toast.error("Choose a tour first");
      return;
    }

    const requested = Number(requestedSeats || 0);
    const available = Number(selectedTour.available_seats || 0);
    if (!Number.isInteger(requested) || requested <= 0) {
      toast.error("Requested seats must be a positive integer");
      return;
    }
    if (requested > available) {
      toast.error("DOnt have enough seats");
      return;
    }

    setSelectionSubmitting(true);
    try {
      const response = await selectTourFromSeatAccessRequest(selectedAccessRequest.id, {
        tourId: selectedTour.id,
        travelDate: selectedTour.departure_date,
        requestedSeats: requested,
      });

      toast.success(`Seat request ${response.data.request_no} confirmed. 6h deposit timer started.`);
      setSelectedTour(null);
      setRequestedSeats(1);
      await loadBase();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create seat request from approved access"));
    } finally {
      setSelectionSubmitting(false);
    }
  };

  const submitTestPayment = async () => {
    if (!adminTestModeActive || !selectedSeatRequestId || testPaymentSubmitting) {
      return;
    }

    setTestPaymentSubmitting(true);
    try {
      const amount = Number(depositIntent?.requiredAmountMnt || 0);
      await simulateSeatRequestPayment(selectedSeatRequestId, {
        amountMnt: amount > 0 ? amount : undefined,
        paymentMethod: "AdminTestMode",
      });
      toast.success("Test payment recorded. Milestones refreshed.");
      await Promise.all([loadBase(), loadPaymentDetails(selectedSeatRequestId)]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to record test payment"));
    } finally {
      setTestPaymentSubmitting(false);
    }
  };

  return (
    <div className="mono-container px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="mono-card p-5">
        <h2 className="mono-title text-xl">{roleLabel} Workspace</h2>
        <p className="text-sm text-gray-600 mt-1">
          One-approval flow: request access window, manager/admin approves, then choose tour + seats and
          the 6h deposit timer starts instantly.
        </p>
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            hasApprovedAccess
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {hasApprovedAccess
            ? `Access approved for ${approvedAccessCount} request${approvedAccessCount > 1 ? "s" : ""}. You can now search and select tours inside approved windows.`
            : "You can only view and select tours after manager/admin approves your requested date range and destination."}
        </div>
        {defaultBindingRole === "agent" && (
          <p className="text-sm text-gray-700 mt-1">
            Agent points: +10,000 per confirmed seat request passenger. Current points: {activeAgentPoints}
          </p>
        )}
        {errorMessage && <p className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="mono-card p-5 space-y-4">
            <h3 className="font-semibold">1) Seat Access Request (Date + Destination)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="mono-input"
                type="date"
                value={accessForm.fromDate}
                onChange={(e) => setAccessForm((prev) => ({ ...prev, fromDate: e.target.value }))}
              />
              <input
                className="mono-input"
                type="date"
                value={accessForm.toDate}
                onChange={(e) => setAccessForm((prev) => ({ ...prev, toDate: e.target.value }))}
              />
              <input
                className="mono-input md:col-span-2"
                placeholder="Destination (e.g. Beijing)"
                value={accessForm.destination}
                onChange={(e) => setAccessForm((prev) => ({ ...prev, destination: e.target.value }))}
              />
              <textarea
                className="mono-input md:col-span-2"
                placeholder="Optional message to manager/admin"
                rows={3}
                value={accessForm.note}
                onChange={(e) => setAccessForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>
            <button className="mono-button" onClick={submitAccessRequest} disabled={accessSubmitting}>
              {accessSubmitting ? "Submitting..." : "Send Approval Request"}
            </button>
          </div>

          <div className="mono-card p-5 space-y-4">
            <h3 className="font-semibold">2) Select Approved Request + Search Tours</h3>
            {accessRequests.filter((row) => row.status === "approved").length === 0 ? (
              <p className="text-sm text-gray-500">
                No approved access requests yet. Ask manager/admin to approve one request first.
              </p>
            ) : (
              <>
                <select
                  className="mono-input"
                  value={selectedAccessRequestId}
                  onChange={(e) => setSelectedAccessRequestId(e.target.value)}
                >
                  {accessRequests
                    .filter((row) => row.status === "approved")
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.destination} | {row.from_date} - {row.to_date}
                      </option>
                    ))}
                </select>

                {selectedAccessRequest && (
                  <div className="rounded-lg border border-gray-200 p-3 text-sm bg-gray-50">
                    <p>
                      <span className="font-medium">Approved Window:</span> {selectedAccessRequest.from_date} -{" "}
                      {selectedAccessRequest.to_date}
                    </p>
                    <p>
                      <span className="font-medium">Approved Destination:</span> {selectedAccessRequest.destination}
                    </p>
                    <p>
                      <span className="font-medium">Expires:</span>{" "}
                      {selectedAccessRequest.expires_at
                        ? new Date(selectedAccessRequest.expires_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    className="mono-input"
                    placeholder="Min seats"
                    value={tourFilters.minSeats}
                    onChange={(e) =>
                      setTourFilters((prev) => ({ ...prev, minSeats: e.target.value }))
                    }
                  />
                  <input
                    className="mono-input"
                    placeholder="Min price"
                    value={tourFilters.minPrice}
                    onChange={(e) =>
                      setTourFilters((prev) => ({ ...prev, minPrice: e.target.value }))
                    }
                  />
                  <input
                    className="mono-input"
                    placeholder="Max price"
                    value={tourFilters.maxPrice}
                    onChange={(e) =>
                      setTourFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
                    }
                  />
                </div>

                <div className="overflow-x-auto">
                  {searchLoading && <p className="text-sm text-gray-500 mb-2">Searching tours...</p>}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th>Tour</th>
                        <th>Date</th>
                        <th>Base Price</th>
                        <th>Available</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTours.map((tour) => (
                        <tr key={`${tour.id}-${tour.departure_date}`} className="border-b">
                          <td>{tour.title || tour.destination}</td>
                          <td>{tour.departure_date}</td>
                          <td>{formatMnt(Number(tour.base_price || 0))}</td>
                          <td>{Number(tour.available_seats || 0)}</td>
                          <td>
                            <button
                              className="mono-button mono-button--ghost"
                              onClick={() => {
                                setSelectedTour(tour);
                                setRequestedSeats(1);
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>
                    Page {tourPage} / {totalTourPages}
                  </span>
                  <div className="space-x-2">
                    <button
                      className="mono-button mono-button--ghost"
                      disabled={tourPage <= 1}
                      onClick={() => setTourPage((prev) => prev - 1)}
                    >
                      Prev
                    </button>
                    <button
                      className="mono-button mono-button--ghost"
                      disabled={tourPage >= totalTourPages}
                      onClick={() => setTourPage((prev) => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h4 className="font-semibold">3) Confirm Seats (starts 6h timer immediately)</h4>
                  {!selectedTour ? (
                    <p className="text-sm text-gray-500">Select one tour row above first.</p>
                  ) : (
                    <>
                      <p className="text-sm">
                        <span className="font-medium">Tour:</span> {selectedTour.title} ({selectedTour.departure_date})
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Available Seats:</span>{" "}
                        {Number(selectedTour.available_seats || 0)}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Unit Price:</span>{" "}
                        {formatMnt(Number(selectedTour.base_price || 0))}
                      </p>
                      <div className="max-w-xs">
                        <input
                          className="mono-input"
                          type="number"
                          min={1}
                          value={requestedSeats}
                          onChange={(e) => setRequestedSeats(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <button
                        className="mono-button"
                        onClick={submitTourSelection}
                        disabled={selectionSubmitting}
                      >
                        {selectionSubmitting ? "Submitting..." : "Confirm Seat Request"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="mono-card p-5">
            <h3 className="font-semibold mb-3">Organization Profile</h3>
            <p className="text-sm">
              <span className="font-medium">Organization:</span> {profile?.organization?.name || "Not bound"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Merchant code:</span> {profile?.organization?.merchant_code || "N/A"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Reg. No:</span> {profile?.organization?.registration_number || "N/A"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Active requests:</span> {profile?.activeRequests?.length || 0}
            </p>
            <p className="text-sm">
              <span className="font-medium">Payment records:</span> {profile?.paymentHistory?.length || 0}
            </p>
            <p className="text-sm">
              <span className="font-medium">Seat history:</span> {profile?.seatPurchaseHistory?.length || 0}
            </p>
          </div>

          {featureFlags.b2bRoleV2Enabled ? (
            <div className="mono-card p-5 space-y-3">
              <h3 className="font-semibold">Employee Binding Request</h3>
              <input
                className="mono-input"
                placeholder="Merchant code (e.g. MRC-ABC123)"
                value={bindingForm.merchantCode}
                onChange={(e) =>
                  setBindingForm((prev) => ({ ...prev, merchantCode: e.target.value }))
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
                <option value="subcontractor">SubContractor</option>
                <option value="agent">Agent</option>
              </select>
              <textarea
                className="mono-input"
                placeholder="Optional note to reviewer"
                rows={3}
                value={bindingForm.note}
                onChange={(e) =>
                  setBindingForm((prev) => ({ ...prev, note: e.target.value }))
                }
              />
              <button className="mono-button" onClick={submitBinding} disabled={bindingSubmitting}>
                {bindingSubmitting ? "Submitting..." : "Submit Binding Request"}
              </button>
            </div>
          ) : (
            <div className="mono-card p-5 text-sm text-gray-500">
              Organization binding workflow is disabled (`B2B_ROLE_V2_ENABLED=false`).
            </div>
          )}
        </div>
      </div>

      <div className="mono-card p-5">
        <h3 className="font-semibold mb-3">Seat Access Request History</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : accessRequests.length === 0 ? (
          <p className="text-sm text-gray-500">No access requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Destination</th>
                  <th>Date Window</th>
                  <th>Status</th>
                  <th>Decision</th>
                  <th>Seat Request</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.map((row) => (
                  <tr className="border-b" key={row.id}>
                    <td>{row.destination}</td>
                    <td>
                      {row.from_date} - {row.to_date}
                    </td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${accessStatusClass(row.status)}`}
                      >
                        {row.status}
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
        )}
      </div>

      <div className="mono-card p-5">
        <h3 className="font-semibold mb-3">Seat Request History (6h timer + staged payments)</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">No seat requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Request</th>
                  <th>Destination</th>
                  <th>Travel Date</th>
                  <th>Seats</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Deposit Timer</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr className="border-b" key={request.id}>
                    <td>{request.request_no}</td>
                    <td>{request.destination}</td>
                    <td>{request.travel_date}</td>
                    <td>{request.requested_seats}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${requestStatusClass(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td>{request.payment_state || "unpaid"}</td>
                    <td>{countdownLabel(request.deposit_due_at, nowMs)}</td>
                    <td>{new Date(request.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="mono-button mono-button--ghost"
                        onClick={() => setSelectedSeatRequestId(request.id)}
                      >
                        View Payment Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSeatRequestId && (
        <div className="mono-card p-5 space-y-4">
          <h3 className="font-semibold">Payment Milestones</h3>
          {paymentLoading ? (
            <p className="text-sm text-gray-500">Loading payment milestones...</p>
          ) : (
            <>
              {depositIntent && (
                <div className="rounded-lg border border-gray-200 p-3 text-sm bg-gray-50">
                  <p>
                    <span className="font-medium">Deposit Due:</span>{" "}
                    {formatMnt(Number(depositIntent.requiredAmountMnt || 0))}
                  </p>
                  <p>
                    <span className="font-medium">Due At:</span>{" "}
                    {depositIntent.dueAt ? new Date(depositIntent.dueAt).toLocaleString() : "-"}
                  </p>
                </div>
              )}

              {adminTestModeActive && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs text-amber-900">
                    Admin Test Mode is active. This records a synthetic payment without calling a live provider.
                  </p>
                  <button
                    className="mono-button"
                    onClick={submitTestPayment}
                    disabled={testPaymentSubmitting}
                  >
                    {testPaymentSubmitting ? "Recording..." : "Mark Deposit Paid (Test Mode)"}
                  </button>
                </div>
              )}

              {!paymentDetails || paymentDetails.milestones.length === 0 ? (
                <p className="text-sm text-gray-500">No milestones found for selected seat request.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th>Milestone</th>
                        <th>Required Amount</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentDetails.milestones.map((milestone) => (
                        <tr key={milestone.id} className="border-b">
                          <td>{milestone.code}</td>
                          <td>{formatMnt(Number(milestone.required_cumulative_mnt || 0))}</td>
                          <td>{milestone.due_at ? new Date(milestone.due_at).toLocaleString() : "-"}</td>
                          <td>{milestone.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 className="font-semibold">Payment History</h4>
              {!paymentDetails || paymentDetails.payments.length === 0 ? (
                <p className="text-sm text-gray-500">No payment records yet. Pay deposit before timer expires.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Provider</th>
                        <th>Status</th>
                        <th>Paid At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentDetails.payments.map((payment) => (
                        <tr key={payment.id} className="border-b">
                          <td>{formatMnt(Number(payment.amount_mnt || 0))}</td>
                          <td>{payment.payment_method}</td>
                          <td>{payment.provider}</td>
                          <td>{payment.status}</td>
                          <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {featureFlags.b2bRoleV2Enabled && (
        <div className="mono-card p-5">
          <h3 className="font-semibold mb-3">Binding Request History</h3>
          {recentBindingRequests.length === 0 ? (
            <p className="text-sm text-gray-500">No binding requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th>Merchant</th>
                    <th>Organization</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBindingRequests.map((row) => (
                    <tr className="border-b" key={row.id}>
                      <td>{row.merchant_code}</td>
                      <td>{row.organization_name || "Unknown"}</td>
                      <td>{toRoleLabel(row.requested_role)}</td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${bindingStatusClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
