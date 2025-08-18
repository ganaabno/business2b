// AdminInterface.tsx (only the role-changing part)
import { useState } from "react";
import { supabase } from "../supabaseClient";
import type { User } from "../types/type";

interface RoleChangerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const roles = ["user", "provider", "admin", "superadmin", "manager"];

function RoleChanger({ users, setUsers, currentUser }: RoleChangerProps) {
  const [loading, setLoading] = useState(false);

  const handleChangeRole = async (userId: string, newRole: string) => {
    setLoading(true);
    try {
      // Update role in Supabase profiles table
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) {
        alert("Failed to update role: " + error.message);
        setLoading(false);
        return;
      }

      // Update local state for instant UI update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole as "user" | "provider" | "admin" | "superadmin" | "manager" } : u
        )
      );} catch (err) {
      console.error(err);
      alert("Unexpected error updating role.");
    }
    setLoading(false);
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Change User Roles</h3>
      <table className="table table-striped table-bordered">
        <thead>
          <tr>
            <th>Email</th>
            <th>Current Role</th>
            <th>Change Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <select
                  value={user.role}
                  disabled={loading || user.id === currentUser.id} // optional: prevent changing your own role
                  onChange={(e) => handleChangeRole(user.id, e.target.value)}
                  className="form-select"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RoleChanger;
