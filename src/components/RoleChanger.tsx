// src/components/RoleChanger.tsx - FIXED VERSION
import { useState, useEffect } from "react";
import {
  changeUserRoleAdmin,
  deleteUserAdmin,
  listUsersAdmin,
  listPendingUsersAdmin,
} from "../api/admin";
import { supabase } from "../supabaseClient";
import type { User } from "../types/type";
import { Trash2, AlertTriangle, Loader2, UserCheck, Mail } from "lucide-react";

interface RoleChangerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

type PendingUserRow = {
  id: string;
  email: string;
  username?: string | null;
  role_requested?: string | null;
  status?: "pending" | "approved" | "declined";
  created_at?: string | null;
};

const EMPTY_USER: Omit<User, "id" | "email"> = {
  userId: "",
  first_name: "",
  last_name: "",
  username: "",
  role: "user",
  phone: "",
  password: "",
  blacklist: false,
  company: "",
  access: "active",
  status: "approved",
  birth_date: "",
  id_card_number: "",
  travel_history: [],
  passport_number: "",
  passport_expire: "",
  allergy: "",
  emergency_phone: "",
  membership_rank: "",
  membership_points: 0,
  registered_by: "",
  createdBy: "",
  createdAt: "",
  updatedAt: "",
  auth_user_id: "",
};

function toTimestamp(user: Partial<User>) {
  const value =
    user.createdAt ||
    (user as any).created_at ||
    user.updatedAt ||
    (user as any).updated_at ||
    "";
  return String(value || "");
}

function normalizeUserRow(row: any): User | null {
  if (!row || typeof row !== "object") return null;

  const id =
    String(row.id || row.user_id || row.auth_user_id || "").trim() || null;
  if (!id) return null;

  const email =
    String(
      row.email ||
        row.auth_email ||
        row.user_email ||
        row.raw_user_meta_data?.email ||
        "",
    ).trim() || `unknown+${id}@local`;

  return {
    ...EMPTY_USER,
    ...row,
    id,
    userId: id,
    email,
    username:
      typeof row.username === "string" && row.username.trim().length > 0
        ? row.username
        : email.split("@")[0],
    role:
      typeof row.role === "string" && row.role.trim().length > 0
        ? row.role
        : "user",
    status:
      row.status === "pending" || row.status === "declined" || row.status === "approved"
        ? row.status
        : "approved",
    access:
      row.access === "pending" || row.access === "suspended" || row.access === "active"
        ? row.access
        : "active",
    createdAt:
      String(row.createdAt || row.created_at || "") || EMPTY_USER.createdAt,
    updatedAt:
      String(row.updatedAt || row.updated_at || "") || EMPTY_USER.updatedAt,
  };
}

const roles = [
  "user",
  "provider",
  "subcontractor",
  "agent",
  "admin",
  "superadmin",
  "manager",
];

function RoleChanger({ users, setUsers, currentUser }: RoleChangerProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );

  const fetchUsers = async () => {
    const byId = new Map<string, User>();

    try {
      const adminUsers = await listUsersAdmin<User>();
      for (const row of adminUsers || []) {
        const normalized = normalizeUserRow(row);
        if (!normalized) continue;
        byId.set(normalized.id, normalized);
      }
    } catch (err: any) {
      console.warn(
        "Admin function unavailable, using fallback users source",
        err,
      );
    }

    const { data: fallbackUsersPlain, error: fallbackPlain } = await supabase
      .from("users")
      .select("*");

    if (!fallbackPlain) {
      for (const row of fallbackUsersPlain || []) {
        const normalized = normalizeUserRow(row);
        if (!normalized) continue;
        byId.set(normalized.id, normalized);
      }
    }

    try {
      const pendingUsers = await listPendingUsersAdmin<PendingUserRow>();
      const existingEmails = new Set(
        Array.from(byId.values())
          .map((user) => String(user.email || "").trim().toLowerCase())
          .filter(Boolean),
      );

      for (const pending of pendingUsers || []) {
        const pendingEmail = String(pending.email || "").trim();
        if (!pendingEmail) continue;

        const emailKey = pendingEmail.toLowerCase();
        if (existingEmails.has(emailKey)) continue;

        const syntheticId = `pending:${pending.id}`;
        const synthetic: User = {
          ...EMPTY_USER,
          id: syntheticId,
          userId: syntheticId,
          email: pendingEmail,
          username:
            typeof pending.username === "string" && pending.username.trim().length > 0
              ? pending.username
              : pendingEmail.split("@")[0],
          role:
            typeof pending.role_requested === "string" && pending.role_requested.trim().length > 0
              ? pending.role_requested
              : "user",
          status: pending.status === "declined" ? "declined" : "pending",
          access: "pending",
          createdAt: String(pending.created_at || ""),
          updatedAt: String(pending.created_at || ""),
        };

        byId.set(syntheticId, synthetic);
      }
    } catch (pendingError) {
      console.warn("Failed to load pending users for role table", pendingError);
    }

    const mergedUsers = Array.from(byId.values()).sort((a, b) =>
      toTimestamp(b).localeCompare(toTimestamp(a)),
    );

    if (mergedUsers.length === 0 && fallbackPlain) {
      console.error("💥 Unexpected error fetching users:", fallbackPlain);
    }

    setUsers(mergedUsers);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (userId.startsWith("pending:")) {
      alert("Pending request users must be approved first from Account Requests.");
      return;
    }

    setLoading((prev) => ({ ...prev, [userId]: true }));

    try {
      await changeUserRoleAdmin(userId, newRole);
      await fetchUsers();
    } catch (err: any) {
      console.error("❌ Unexpected error updating role:", err);
      alert(`Unexpected error: ${err.message || "Unknown error"}`);
    } finally {
      setLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId.startsWith("pending:")) {
      alert("Pending request users cannot be deleted from this table.");
      return;
    }

    if (showDeleteConfirm === userId) {
      setDeleting((prev) => ({ ...prev, [userId]: true }));
      setShowDeleteConfirm(null);

      try {
        await deleteUserAdmin(userId);
        await fetchUsers();
      } catch (err: any) {
        console.error("❌ Unexpected error deleting user:", err);
        alert(
          `Unexpected error deleting user: ${err.message || "Unknown error"}`,
        );
      } finally {
        setDeleting((prev) => ({ ...prev, [userId]: false }));
      }
    } else {
      setShowDeleteConfirm(userId);
      setTimeout(() => setShowDeleteConfirm(null), 5000);
    }
  };

  // Filter out invalid users and ensure current user is included
  const displayUsers = users.filter((user) => user && user.id);
  const currentUserExists = displayUsers.find((u) => u.id === currentUser.id);
  if (!currentUserExists && currentUser.id && currentUser.email) {
    displayUsers.push({
      ...currentUser,
      username: currentUser.username || "You",
    });
  }

  const getDisplayName = (user: User) => {
    if (user.username) return user.username;
    if (user.first_name && user.last_name)
      return `${user.first_name} ${user.last_name}`;
    return user.email ? user.email.split("@")[0] : "Unknown User";
  };

  const confirmDeleteMessage = (user: User) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-red-800 mb-1">
            Delete User Account
          </h4>
          <p className="text-red-700 text-sm mb-2">
            Are you sure you want to permanently delete{" "}
            <strong>{user.email}</strong>?
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => handleDeleteUser(user.id)}
              disabled={deleting[user.id]}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 flex items-center space-x-1"
            >
              {deleting[user.id] ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3" />
                  <span>Yes, Delete</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Manage User Roles & Accounts
        </h3>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors text-sm"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh Users
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full mono-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                  Display Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Current Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  Change Role
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <UserCheck className="w-8 h-8 text-gray-400" />
                      <p className="text-sm">No users available</p>
                      <p className="text-xs text-gray-400">
                        Try refreshing or check your database connection.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayUsers.map((user, index) => {
                  const isCurrentUser = user.id === currentUser.id;
                  const isPendingRequest =
                    user.id.startsWith("pending:") ||
                    user.status === "pending" ||
                    user.access === "pending";
                  const displayName = getDisplayName(user);

                  return (
                    <tr
                      key={`${user.id}-${index}`}
                        className={`transition-colors ${
                        isCurrentUser
                          ? "bg-slate-50 border-l-4 border-slate-400"
                          : isPendingRequest
                            ? "bg-amber-50"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <div
                              className={`text-sm font-medium ${
                                isCurrentUser
                                  ? "text-yellow-800"
                                  : "text-gray-900"
                              }`}
                            >
                              {user.email || "No email"}
                            </div>
                            {isCurrentUser && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800 ml-2">
                                👤 YOU
                              </span>
                            )}
                            {isPendingRequest && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800 ml-2">
                                PENDING
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="text-sm text-gray-900 font-medium">
                            {displayName}
                            {user.username === null && (
                              <span className="ml-2 text-xs text-gray-400 italic">
                                (email)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            isPendingRequest
                              ? "bg-amber-100 text-amber-800"
                              : user.role === "admin" || user.role === "superadmin"
                              ? "bg-red-100 text-red-800"
                              : user.role === "provider" ||
                                  user.role === "agent"
                                ? "bg-blue-100 text-blue-800"
                                : user.role === "user" ||
                                    user.role === "subcontractor"
                                  ? "bg-gray-100 text-gray-800"
                                  : user.role === "manager"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.role || "user"}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={user.role || "user"}
                          disabled={loading[user.id] || isCurrentUser || isPendingRequest}
                          onChange={(e) =>
                            handleChangeRole(user.id, e.target.value)
                          }
                          className={`w-full max-w-[100px] px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            loading[user.id] || isCurrentUser || isPendingRequest
                              ? "bg-gray-100 cursor-not-allowed border-gray-300"
                              : "border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {loading[user.id] && (
                            <div className="flex items-center space-x-1 text-blue-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">Updating...</span>
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleting[user.id] || isCurrentUser || isPendingRequest}
                            className={`p-2 rounded transition-colors flex items-center justify-center ${
                              isCurrentUser
                                ? "opacity-50 cursor-not-allowed text-gray-400"
                                : isPendingRequest
                                  ? "opacity-50 cursor-not-allowed text-amber-500"
                                : deleting[user.id]
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-800 hover:bg-red-50"
                            }`}
                            title={
                              isCurrentUser
                                ? "Cannot delete yourself"
                                : isPendingRequest
                                  ? "Approve or decline this request in Account Requests"
                                : "Delete user"
                            }
                          >
                            <Trash2
                              className={`h-4 w-4 ${
                                deleting[user.id] ? "animate-pulse" : ""
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            {(() => {
              const selected = users.find((u) => u.id === showDeleteConfirm);
              if (!selected) {
                return (
                  <div className="p-4">
                    <p className="text-sm text-gray-600">
                      User no longer available. Please refresh.
                    </p>
                  </div>
                );
              }

              return confirmDeleteMessage(selected);
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleChanger;
