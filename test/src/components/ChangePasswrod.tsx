import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

interface ChangePasswordProps {
  onChangePassword: (username: string, newPassword: string) => boolean;
}

function ChangePassword({ onChangePassword }: ChangePasswordProps) {
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onChangePassword(username.trim(), newPassword.trim())) {
      navigate("/login");
    }
  };

  return (
    <div className="login-container" style={{ maxWidth: "400px", margin: "100px auto" }}>
      <div className="card p-4">
        <h2 className="text-center mb-4">Change Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="changeUsername" className="form-label">
              Username
            </label>
            <input
              type="text"
              className="form-control"
              id="changeUsername"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="newPassword" className="form-label">
              New Password
            </label>
            <input
              type="password"
              className="form-control"
              id="newPassword"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            Change Password
          </button>
          <button
            type="button"
            className="btn btn-link w-100 mt-2"
            onClick={() => navigate("/login")}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;