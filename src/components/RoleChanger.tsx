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
    console.log("Attempting to update role for user:", userId, "to", newRole);
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);
      console.log("Supabase response:", { data, error });

      if (error) {
        alert("Failed to update role: " + error.message);
        setLoading(false);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole as "user" | "provider" | "admin" | "superadmin" | "manager" } : u
        )
      );
    } catch (err) {
      console.error("Unexpected error:", err);
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
                  disabled={loading || user.id === currentUser.id}
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