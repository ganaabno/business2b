// src/components/Signup.tsx - TYPESCRIPT SAFE VERSION
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { supabase } from "../supabaseClient";
import { supabaseAdmin } from "../utils/adminClient";  // 🔥 ADD THIS IMPORT
import { 
  Eye, 
  EyeOff, 
  Mail, 
  User, 
  Shield, 
  Lock, 
  UserCheck, 
  AlertCircle,
  Clock,
  CheckCircle 
} from "lucide-react";

export default function Signup() {
  const { hasPendingRequest } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleRequested, setRoleRequested] = useState<"user" | "manager" | "provider">("user");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "pending">("idle");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    // Basic validation
    if (!email || !username || !password) {
      setStatus("error");
      setMessage("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setStatus("error");
      setMessage("Password must be at least 6 characters");
      return;
    }

    // 🔥 FIXED: TypeScript-safe pending request check
    let hasPending = false;
    try {
      const { data, error } = await supabase
        .from("pending_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();  // 🔥 Use maybeSingle() instead of single()

      // Handle 406 (no rows) or actual errors
      if (error) {
        if (error.message.includes('406') || error.message.includes('PGRST116')) {
          // 406 = no rows found = no pending request = GOOD!
          console.log('✅ No pending request found - proceeding with signup');
          hasPending = false;
        } else {
          // Real error
          console.error('❌ Error checking pending:', error);
          setStatus("error");
          setMessage("Error checking account status. Please try again.");
          return;
        }
      } else {
        // Data exists = pending request
        hasPending = !!data;
      }
    } catch (error: any) {
      console.error('❌ Unexpected error checking pending:', error);
      // Assume no pending on unexpected error (fail open)
      hasPending = false;
    }

    if (hasPending) {
      setStatus("pending");
      setMessage("You already have a pending account request. Please wait for admin approval.");
      return;
    }

    try {
      // 🔥 FIXED: TypeScript-safe auth user check
      let userExists = false;
      try {
        if (supabaseAdmin) {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
          userExists = users.some((user: any) => user.email === email);
        } else {
          console.log('⚠️ No admin client available - skipping auth check');
        }
      } catch (adminError: any) {
        // 403 = no admin access, or other admin API error
        console.log('⚠️ Admin API error (expected for non-admin):', adminError.message);
        userExists = false;  // Assume doesn't exist (safe for public signup)
      }
      
      if (userExists) {
        setStatus("error");
        setMessage("An account with this email already exists. Please log in instead.");
        return;
      }

      // Create pending request
      const { error } = await supabase.from("pending_users").insert({
        email,
        username,
        password, // Plain password - will be hashed on approval
        role_requested: roleRequested,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Signup error:", error);
        throw new Error("Failed to create account request");
      }

      setStatus("success");
      setMessage("Account request sent! An admin will review it shortly.");
      
      // Clear form
      setEmail("");
      setUsername("");
      setPassword("");
      
      // Redirect to login after 3 seconds
      setTimeout(() => navigate("/login"), 3000);
      
    } catch (error: any) {
      console.error("Signup failed:", error);
      setStatus("error");
      setMessage(error.message || "Something went wrong");
    }
  };

  // Keep your existing render methods (pending, success, form) as-is...
  if (status === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Pending</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <p className="text-sm text-gray-500 mb-6">
            An admin will review your request soon.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Sent!</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <p className="text-sm text-gray-500 mb-6">
            You'll receive an email when your account is approved.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Us</h1>
          <p className="text-gray-600">Create an account request</p>
        </div>

        {status === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                required
                disabled={status === "loading"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                required
                disabled={status === "loading"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                required
                minLength={6}
                disabled={status === "loading"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                disabled={status === "loading"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
            <div className="space-y-2">
              {[
                { value: "user", label: "Customer", desc: "Standard account" },
                { value: "manager", label: "Manager", desc: "Administrative access" },
                { value: "provider", label: "Provider", desc: "Service provider" },
              ].map((role) => (
                <label key={role.value} className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors disabled:opacity-50">
                  <input
                    type="radio"
                    value={role.value}
                    checked={roleRequested === role.value}
                    onChange={() => setRoleRequested(role.value as any)}
                    className="mr-3 text-blue-600"
                    disabled={status === "loading"}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{role.label}</div>
                    <div className="text-sm text-gray-500">{role.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your requested role will be reviewed by an administrator
            </p>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Request...
              </span>
            ) : (
              "Request Account"
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/login")}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
            disabled={status === "loading"}
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
}