// src/components/RoleChanger.tsx - FIXED VERSION
import { useState, useEffect } from "react";
import { supabaseAdmin } from "../utils/adminClient"; // Use admin client to bypass RLS
import type { User } from "../types/type";
import { Trash2, AlertTriangle, Loader2, UserCheck, Mail } from "lucide-react";

interface RoleChangerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const roles = ["user", "provider", "admin", "superadmin", "manager"];

function RoleChanger({ users, setUsers, currentUser }: RoleChangerProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // 🔥 NEW: Fetch users with admin client to bypass RLS
  const fetchUsers = async () => {
    console.log('🔍 Fetching users with ADMIN CLIENT (bypasses RLS)...');
    try {
      // Use supabaseAdmin and correct column name 'createdat'
      const { data: adminUsers, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .order('createdat', { ascending: false }); // FIXED: Use 'createdat' instead of 'created_at'

      if (error) {
        console.error('❌ Admin client error fetching users:', error);
        alert(`Failed to fetch users: ${error.message}`);
        return;
      }

      if (adminUsers) {
        setUsers(adminUsers);
        console.log('✅ Fetched', adminUsers.length, 'users successfully');
      } else {
        console.warn('⚠️ No users returned from Supabase');
        setUsers([]);
      }
    } catch (err: any) {
      console.error('💥 Unexpected error fetching users:', err);
      alert(`Unexpected error fetching users: ${err.message || "Unknown error"}`);
      setUsers([]);
    }
  };

  // 🔥 Run fetch on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // 🔥 Debug logging for users and current user
  useEffect(() => {
    console.log("💥 NUCLEAR DEBUG - RoleChanger RENDER START");
    console.log("📊 Users array:", users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      username: u.username,
    })));
    console.log("👤 Current user:", {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    });
    console.log("💥 NUCLEAR DEBUG - RoleChanger RENDER END");
  }, [users, currentUser]);

  const handleChangeRole = async (userId: string, newRole: string) => {
    setLoading((prev) => ({ ...prev, [userId]: true }));

    try {
      console.log(`🚀 Updating role for user ${userId} to ${newRole}`);
      const { data, error } = await supabaseAdmin
        .from("users")
        .update({ role: newRole, updatedat: new Date().toISOString() }) // Ensure updatedat is set
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        console.error("❌ Supabase admin error updating role:", error);
        alert(`Failed to update role: ${error.message}`);
        return;
      }

      if (data) {
        console.log("✅ Role updated successfully:", data);
        // Refresh users to ensure consistency
        await fetchUsers();
      } else {
        console.warn("⚠️ No data returned from role update");
        alert("Role updated, but no user data returned.");
      }
    } catch (err: any) {
      console.error("❌ Unexpected error updating role:", err);
      alert(`Unexpected error: ${err.message || "Unknown error"}`);
    } finally {
      setLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (showDeleteConfirm === userId) {
      setDeleting((prev) => ({ ...prev, [userId]: true }));
      setShowDeleteConfirm(null);

      try {
        // Delete from users table
        const { error: tableError } = await supabaseAdmin
          .from("users")
          .delete()
          .eq("id", userId);

        if (tableError) {
          console.error("❌ Error deleting user from table:", tableError);
          alert(`Error deleting user: ${tableError.message}`);
          return;
        }

        // Delete from auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
          console.error("❌ Error deleting user from auth:", authError);
          alert(`Error deleting user auth: ${authError.message}`);
          return;
        }

        console.log(`✅ User ${userId} deleted successfully`);
        // Refresh users list
        await fetchUsers();
      } catch (err: any) {
        console.error("❌ Unexpected error deleting user:", err);
        alert(`Unexpected error deleting user: ${err.message || "Unknown error"}`);
      } finally {
        setDeleting((prev) => ({ ...prev, [userId]: false }));
      }
    } else {
      setShowDeleteConfirm(userId);
      setTimeout(() => setShowDeleteConfirm(null), 5000);
    }
  };

  // Filter out invalid users and ensure current user is included
  const displayUsers = users.filter(user => user && user.id && user.email);
  const currentUserExists = displayUsers.find(u => u.id === currentUser.id);
  if (!currentUserExists && currentUser.id && currentUser.email) {
    displayUsers.push({
      ...currentUser,
      username: currentUser.username || 'You',
    });
  }

  console.log("💣 FINAL DISPLAY USERS:", displayUsers.map(u => ({ id: u.id, email: u.email, role: u.role })));

  const getDisplayName = (user: User) => {
    if (user.username) return user.username;
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    return user.email ? user.email.split('@')[0] : 'Unknown User';
  };

  const confirmDeleteMessage = (user: User) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-red-800 mb-1">Delete User Account</h4>
          <p className="text-red-700 text-sm mb-2">
            Are you sure you want to permanently delete <strong>{user.email}</strong>?
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
        <h3 className="text-lg font-semibold text-gray-900">Manage User Roles & Accounts</h3>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Users
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
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
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <UserCheck className="w-8 h-8 text-gray-400" />
                      <p className="text-sm">No users available</p>
                      <p className="text-xs text-gray-400">Try refreshing or check your database connection.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayUsers.map((user, index) => {
                  const isCurrentUser = user.id === currentUser.id;
                  const displayName = getDisplayName(user);

                  console.log(`💥 RENDERING USER ${index + 1}:`, {
                    id: user.id,
                    email: user.email,
                    displayName,
                    role: user.role,
                    isCurrentUser,
                  });

                  return (
                    <tr
                      key={`${user.id}-${index}`}
                      className={`transition-colors ${isCurrentUser
                          ? "bg-slate-50 border-l-4 border-slate-400"
                          : index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <div className={`text-sm font-medium ${isCurrentUser ? 'text-yellow-800' : 'text-gray-900'
                              }`}>
                              {user.email || 'No email'}
                            </div>
                            {isCurrentUser && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800 ml-2">
                                👤 YOU
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
                              <span className="ml-2 text-xs text-gray-400 italic">(email)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'admin' || user.role === 'superadmin'
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'provider'
                              ? 'bg-blue-100 text-blue-800'
                              : user.role === 'manager'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                          {user.role || 'user'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={user.role || 'user'}
                          disabled={loading[user.id] || isCurrentUser}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          className={`w-full max-w-[100px] px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${loading[user.id] || isCurrentUser
                              ? 'bg-gray-100 cursor-not-allowed border-gray-300'
                              : 'border-gray-300 hover:border-gray-400'
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
                            disabled={deleting[user.id] || isCurrentUser}
                            className={`p-2 rounded transition-colors flex items-center justify-center ${isCurrentUser
                                ? "opacity-50 cursor-not-allowed text-gray-400"
                                : deleting[user.id]
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-800 hover:bg-red-50"
                              }`}
                            title={isCurrentUser ? "Cannot delete yourself" : "Delete user"}
                          >
                            <Trash2 className={`h-4 w-4 ${deleting[user.id] ? "animate-pulse" : ""}`} />
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
            {confirmDeleteMessage(users.find(u => u.id === showDeleteConfirm)!)}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleChanger;