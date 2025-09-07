// src/Pages/Signup.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [roleRequested, setRoleRequested] = useState<"user" | "manager" | "provider">("user");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("pending");
    setMessage("");

    try {
      // Check if user already exists
      const { data: existing } = await supabase
        .from("pending_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        setStatus("error");
        setMessage("Your request is already pending. Please wait for approval.");
        return;
      }

      // Insert request into pending_users
      const { error } = await supabase.from("pending_users").insert({
        email,
        username,
        role_requested: roleRequested,
        status: "pending",
        created_at: new Date(),
      });

      if (error) throw error;

      setStatus("success");
      setMessage("Your request is pending approval. Please wait for admin approval.");
      setEmail("");
      setUsername("");
      setRoleRequested("user");
      setTimeout(() => navigate("/login"), 2000); // Redirect to login after 2 seconds
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "An error occurred during signup.");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-xl font-bold mb-4">Request Pending</h1>
        <p className="text-gray-700 text-center">{message}</p>
        <p className="text-gray-500 text-sm mt-2">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <form onSubmit={handleSignup} className="bg-white p-6 rounded shadow-md w-80 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-center">Sign Up (Request Access)</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <select
          value={roleRequested}
          onChange={(e) => setRoleRequested(e.target.value as "user" | "manager" | "provider")}
          className="p-2 border rounded"
        >
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="provider">Provider</option>
        </select>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Submit Request
        </button>
        {status === "error" && <p className="text-red-600 text-sm">{message}</p>}
      </form>
    </div>
  );
}