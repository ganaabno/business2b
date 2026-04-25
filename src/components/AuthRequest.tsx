// src/components/AuthRequest.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  approvePendingUserAdmin,
  declinePendingUserAdmin,
  getPendingUserAdmin,
  listPendingUsersAdmin,
} from "../api/admin";
import {
  Users,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Bell,
  RefreshCw,
} from "lucide-react";

interface PendingUser {
  id: string;
  email: string;
  username: string;
  password?: string;
  password_hash?: string;
  role_requested: "user" | "manager" | "provider" | "agent" | "subcontractor";
  status: "pending" | "approved" | "declined";
  created_at: string;
  contract_version_id?: string | null;
  contract_accepted_at?: string | null;
  contract_signed_name?: string | null;
  contract_signer_full_name?: string | null;
  contract_signer_signature?: string | null;
  contract_agent_name?: string | null;
  contract_counterparty_full_name?: string | null;
  contract_counterparty_signature?: string | null;
  contract_denied_at?: string | null;
  agent_contract_versions?: {
    id: string;
    version_no: number;
    title: string;
    file_url?: string | null;
  } | null;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

interface AuthRequestProps {
  currentUserId: string;
  onRefresh?: () => void;
  onPendingCountChange?: (count: number) => void;
}

export default function AuthRequest({
  currentUserId,
  onRefresh,
  onPendingCountChange,
}: AuthRequestProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAllRequests = useCallback(async () => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);

        const allData = await listPendingUsersAdmin<PendingUser>();
        setLoadError("");

        setAllUsers(allData);

        const pendingData = allData.filter(
          (user) =>
            String(user.status || "pending")
              .trim()
              .toLowerCase() === "pending",
        );

        setPendingUsers(pendingData);
        onPendingCountChange?.(pendingData.length);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to load auth requests";

        setLoadError(message);
        setAllUsers([]);
        setPendingUsers([]);
        onPendingCountChange?.(0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [onPendingCountChange]);

  useEffect(() => {
    fetchAllRequests();

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  const handleManualRefresh = useCallback(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  const fetchSinglePendingUser = useCallback(
    async (userId: string): Promise<PendingUser | null> => {
      return getPendingUserAdmin<PendingUser>(userId);
    },
    [],
  );

  const handleApprove = useCallback(
    async (userId: string) => {
      setActionLoading((prev) => ({ ...prev, [userId]: true }));
      let pendingUser: PendingUser | null = null;

      try {
        pendingUser = await fetchSinglePendingUser(userId);

        const localUser =
          pendingUsers.find((user) => user.id === userId) ||
          allUsers.find((user) => user.id === userId) ||
          null;

        const reviewUser = pendingUser || localUser;

        if (!pendingUser) {
          if (!reviewUser) {
            throw new Error("Could not fetch pending user");
          }
          pendingUser = reviewUser;
        }

        if (reviewUser && reviewUser.status !== "pending") {
          throw new Error(`User not pending (status: ${reviewUser.status})`);
        }

        if (
          reviewUser &&
          reviewUser.role_requested === "agent" &&
          (!reviewUser.contract_accepted_at ||
            !reviewUser.contract_signer_full_name ||
            !reviewUser.contract_signer_signature ||
            !reviewUser.contract_agent_name ||
            !reviewUser.contract_counterparty_full_name ||
            !reviewUser.contract_counterparty_signature)
        ) {
          throw new Error("Agent request is missing contract signature fields");
        }

        await approvePendingUserAdmin(userId);
        await fetchAllRequests();
        onRefresh?.();

        showNotification(
          `✅ ${(reviewUser || pendingUser).username} approved! They can now log in.`,
          "success",
        );
      } catch (error: any) {
        let message = "Failed to approve user";
        if (error.message) {
          message = error.message;
        }

        showNotification(`Approval failed: ${message}`, "error");
      } finally {
        setActionLoading((prev) => ({ ...prev, [userId]: false }));
        await fetchAllRequests();
      }
    },
    [allUsers, fetchSinglePendingUser, onRefresh, pendingUsers],
  );

  const handleDecline = useCallback(
    async (userId: string) => {
      setActionLoading((prev) => ({ ...prev, [userId]: true }));

      try {
        const pendingUser = await fetchSinglePendingUser(userId);
        if (!pendingUser) {
          throw new Error("User not found for decline");
        }

        await declinePendingUserAdmin(userId, `Declined by ${currentUserId}`);

        await fetchAllRequests();
        onRefresh?.();

        showNotification(
          `❌ ${pendingUser.username}'s request declined`,
          "error",
        );
      } catch (error: any) {
        showNotification(`❌ Failed to decline: ${error.message}`, "error");
      } finally {
        setActionLoading((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [currentUserId, fetchSinglePendingUser, onRefresh],
  );

  const showNotification = (message: string, type: "success" | "error") => {
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ease-in-out max-w-sm ${
      type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
    }`;
    notification.innerHTML = `<div class="font-medium">${message}</div>`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.remove("translate-x-full");
    }, 100);

    setTimeout(() => {
      notification.classList.add("translate-x-full");
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  const getRoleColor = (role: string) => ({
    bg:
      role === "user"
        ? "from-blue-500"
        : role === "manager"
          ? "from-yellow-500"
          : "from-green-500",
    to:
      role === "user"
        ? "to-blue-600"
        : role === "manager"
          ? "to-yellow-600"
          : "to-green-600",
    text:
      role === "user"
        ? "text-blue-100"
        : role === "manager"
          ? "text-yellow-100"
          : "text-green-100",
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "declined":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderDebugButtons = () =>
    process.env.NODE_ENV === "development" ? (
      <div className="p-4 bg-blue-50 border-b border-blue-200">
        <div className="flex space-x-2 text-xs">
          <button
            onClick={handleManualRefresh}
            className="px-2 py-1 bg-green-600 text-white rounded"
          >
            🔄 Manual Refresh
          </button>
        </div>
      </div>
    ) : null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-gray-600">Loading requests...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {renderDebugButtons()}

      {loadError && (
        <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load auth requests: {loadError}
        </div>
      )}

      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl relative">
              <Bell className="w-5 h-5 text-white" />
              {pendingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 block h-3 w-3 rounded-full ring-2 ring-white bg-red-400 animate-pulse"></span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Account Requests
              </h3>
              <p className="text-sm text-gray-500">
                {pendingUsers.length} pending • {allUsers.length} total
              </p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            className="p-1 text-gray-400 hover:text-gray-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {allUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No Requests
            </h4>
            <p className="text-gray-500">No account requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allUsers.map((request) => (
              <div
                key={request.id}
                className="border-b border-gray-100 pb-4 last:border-b-0"
              >
                <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div
                    className={`p-3 rounded-full bg-gradient-to-r ${
                      getRoleColor(request.role_requested).bg
                    } ${getRoleColor(request.role_requested).to}`}
                  >
                    <Users className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-900">
                        {request.username}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          request.status,
                        )}`}
                      >
                        {request.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium capitalize">
                        {request.role_requested}
                      </span>{" "}
                      account - {request.status}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {request.email}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {request.role_requested === "agent" && (
                      <div className="mb-2 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900 space-y-1">
                        <p>
                          Contract:{" "}
                          {request.contract_accepted_at
                            ? "Accepted"
                            : "Missing"}
                        </p>

                        {request.contract_signed_name && (
                          <p>
                            Signer:{" "}
                            {request.contract_signer_full_name ||
                              request.contract_signed_name}
                          </p>
                        )}

                        {request.contract_signer_signature && (
                          <p>
                            Signer Signature:{" "}
                            {request.contract_signer_signature}
                          </p>
                        )}

                        {request.contract_agent_name && (
                          <p>Agent: {request.contract_agent_name}</p>
                        )}

                        {request.contract_counterparty_full_name && (
                          <p>
                            Counterparty:{" "}
                            {request.contract_counterparty_full_name}
                          </p>
                        )}

                        {request.contract_counterparty_signature && (
                          <p>
                            Counterparty Signature:{" "}
                            {request.contract_counterparty_signature}
                          </p>
                        )}

                        {request.agent_contract_versions?.version_no && (
                          <p>
                            Version: v
                            {request.agent_contract_versions.version_no}
                            {request.agent_contract_versions.title
                              ? ` - ${request.agent_contract_versions.title}`
                              : ""}
                          </p>
                        )}

                        {request.agent_contract_versions?.file_url && (
                          <a
                            href={request.agent_contract_versions.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Open contract file
                          </a>
                        )}
                      </div>
                    )}

                    {request.notes && (
                      <p className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded">
                        {request.notes}
                      </p>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={actionLoading[request.id]}
                        className="px-3 py-2 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading[request.id] ? (
                          <>
                            <div className="w-3 h-3 border border-green-500 border-t-transparent rounded-full animate-spin mr-1"></div>
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approve
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDecline(request.id)}
                        disabled={actionLoading[request.id]}
                        className="px-3 py-2 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading[request.id] ? (
                          <>
                            <div className="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin mr-1"></div>
                            Declining...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Decline
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
