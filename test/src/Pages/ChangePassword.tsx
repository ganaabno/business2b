import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface ChangePasswordProps {
  onChangePassword: (newPassword: string) => Promise<boolean>;
}

export default function ChangePassword({ onChangePassword }: ChangePasswordProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const success = await onChangePassword(newPassword.trim());
    setLoading(false);

    if (success) {
      alert("Password changed successfully!");
      navigate("/user");
    } else {
      setError("Failed to change password.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <div className="card p-4">
        <h2 className="text-center mb-4">Change Password</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="mb-3">
            <label htmlFor="newPassword" className="form-label">New Password</label>
            <input
              id="newPassword"
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? "Changing..." : "Change Password"}
          </button>
        </form>
        <button className="btn btn-link w-100 mt-3" onClick={() => navigate("/user")} disabled={loading}>
          Back
        </button>
      </div>
    </div>
  );
}
