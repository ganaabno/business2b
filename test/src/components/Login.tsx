import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";

interface LoginProps {
  onLogin: (username: string, password: string) => boolean;
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLogin(username.trim(), password.trim())) {
      navigate("/user");
    }
  };

  return (
    <div className="login-container" style={{ maxWidth: "400px", margin: "100px auto" }}>
      <div className="card p-4">
        <h2 className="text-center mb-4">Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              type="text"
              className="form-control"
              id="username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              className="form-control"
              id="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            Login
          </button>
        </form>
        <button
          className="btn btn-link w-100 mt-2"
          onClick={() => navigate("/change-password")}
        >
          Change Password
        </button>
      </div>
    </div>
  );
}

export default Login;