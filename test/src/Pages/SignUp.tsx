import { useState } from "react";
import { supabase } from "../supabaseClient";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"user" | "provider">("user"); // users can choose role here

  const handleSignup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, username }, // store role + username in metadata
      },
    });

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      alert(`Account created as ${role}! Check your email to confirm.`);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Sign Up</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="mb-2 w-full p-2 border rounded"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-2 w-full p-2 border rounded"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-2 w-full p-2 border rounded"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "user" | "provider")}
        className="mb-4 w-full p-2 border rounded"
      >
        <option value="user">User</option>
        <option value="provider">Provider</option>
      </select>
      <button
        onClick={handleSignup}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Sign Up
      </button>
    </div>
  );
}

export default Signup;
