import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { hash } from "bcryptjs";
import { checkEmailExists } from "../api/admin";
import {
  Eye,
  EyeOff,
  Mail,
  User,
  Lock,
  Building2,
  Phone,
  AlertCircle,
  Clock,
  CheckCircle,
} from "lucide-react";
import illustriation from "../assets/illustriation.jpg";
import Logo from "../assets/last logo.png";
import ThemeToggle from "../components/ThemeToggle";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isCompany, setIsCompany] = useState(false); // ← NEW: checkbox
  const [companyName, setCompanyName] = useState(""); // ← NEW: optional
  const [companyPhone, setCompanyPhone] = useState(""); // ← NEW: optional
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "pending"
  >("idle");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

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
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setStatus("error");
      setMessage("Username can only contain letters, numbers, and underscores");
      return;
    }
    if (username.length < 3 || username.length > 20) {
      setStatus("error");
      setMessage("Username must be 3–20 characters");
      return;
    }

    // ---- COMPANY VALIDATION (only if checkbox checked) ----
    if (isCompany) {
      if (!companyName.trim()) {
        setStatus("error");
        setMessage("Company name is required when registering as a company");
        return;
      }
      if (!companyPhone.trim()) {
        setStatus("error");
        setMessage("Company phone is required");
        return;
      }
    }

    let hasPending = false;
    try {
      const { data, error } = await supabase
        .from("pending_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (error && !error.message.includes("PGRST116")) {
        console.error("Error checking pending:", error);
        setStatus("error");
        setMessage("Error checking account status. Please try again.");
        return;
      }
      hasPending = !!data;
    } catch (error) {
      console.error("Unexpected error:", error);
      hasPending = false;
    }

    if (hasPending) {
      setStatus("pending");
      setMessage(
        "You already have a pending account request. Please wait for admin approval."
      );
      return;
    }

    try {
      let userExists = false;
      try {
        userExists = await checkEmailExists(email);
      } catch {
        const { data: existingUser, error: existingUserError } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (!existingUserError && existingUser) {
          userExists = true;
        }
      }

      if (userExists) {
        setStatus("error");
        setMessage(
          "An account with this email already exists. Please log in instead."
        );
        return;
      }

      const { data: usernameCheck } = await supabase
        .from("pending_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (usernameCheck) {
        setStatus("error");
        setMessage("This username is already taken.");
        return;
      }

      const passwordHash = await hash(password, 12);
      const { error } = await supabase.from("pending_users").insert({
        email,
        username,
        password_hash: passwordHash,
        role_requested: "user", // or whatever you use
        company_name: isCompany ? companyName : null,
        company_phone: isCompany ? companyPhone : null,
        is_company: isCompany,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Signup error:", error);
        throw new Error("Failed to create account request");
      }

      setStatus("success");
      setMessage("Account request sent! An admin will review it shortly.");
      setEmail("");
      setUsername("");
      setPassword("");
      setCompanyName("");
      setCompanyPhone("");
      setIsCompany(false);
      setTimeout(() => navigate("/login"), 3000);
    } catch (error: any) {
      console.error("Signup failed:", error);
      setStatus("error");
      setMessage(error.message || "Something went wrong");
    }
  };

  // Pending & Success Pages (unchanged)
  if (status === "pending") {
    return (
      <div className="mono-shell flex items-center justify-center px-4 py-12">
        <div className="mono-card p-8 max-w-md w-full text-center mono-rise">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <Clock className="w-7 h-7 text-gray-700" />
          </div>
          <h2 className="mono-title text-2xl mb-2">Request Pending</h2>
          <p className="mono-subtitle mb-6">{message}</p>
          <button
            onClick={() => navigate("/login")}
            className="mono-button w-full"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mono-shell flex items-center justify-center px-4 py-12">
        <div className="mono-card p-8 max-w-md w-full text-center mono-rise">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <CheckCircle className="w-7 h-7 text-gray-700" />
          </div>
          <h2 className="mono-title text-2xl mb-2">Request Sent!</h2>
          <p className="mono-subtitle mb-6">{message}</p>
          <button
            onClick={() => navigate("/login")}
            className="mono-button w-full"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // MAIN FORM + GLASS EFFECT
  return (
    <div className="mono-shell">
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="mono-card w-full max-w-5xl overflow-hidden mono-rise">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            {/* LEFT — FORM */}
            <div className="p-8 lg:p-12 flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl border border-gray-200 bg-gray-100 p-2">
                <img
                  src={Logo}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <ThemeToggle className="px-2.5 py-2 text-xs" showLabel={false} />
            </div>
              <div>
                <p className="mono-kicker">Get started</p>
                <h1 className="mono-title text-3xl sm:text-4xl">
                  Create Account
                </h1>
                <p className="mono-subtitle mt-2">
                  Fill in your details to request access.
                </p>
              </div>

              {status === "error" && (
                <div className="mono-panel px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      disabled={status === "loading"}
                      className="mono-input pl-10 pr-4 text-sm"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      required
                      disabled={status === "loading"}
                      className="mono-input pl-10 pr-4 text-sm"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      disabled={status === "loading"}
                      className="mono-input pl-10 pr-12 text-sm"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="company"
                    checked={isCompany}
                    onChange={(e) => setIsCompany(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300"
                  />
                  <label
                    htmlFor="company"
                    className="text-sm text-gray-700 cursor-pointer select-none"
                  >
                    Register as a Company
                  </label>
                </div>

                {isCompany && (
                  <div className="space-y-4 mt-2 animate-in slide-in-from-top-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Company Name
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Acme Corp"
                          className="mono-input pl-10 pr-4 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Company Phone
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="tel"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="+1 (555) 000-1234"
                          className="mono-input pl-10 pr-4 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="mono-button w-full text-sm mt-4"
                >
                  {status === "loading" ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <div className="text-sm">
                <button
                  onClick={() => navigate("/login")}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  disabled={status === "loading"}
                >
                  Already have an account? <span className="font-medium">Sign in</span>
                </button>
              </div>
            </div>

            {/* RIGHT — IMAGE */}
            <div className="hidden lg:block p-6">
              <div className="mono-panel h-full p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <p className="mono-kicker">Team access</p>
                  <h2 className="mono-title text-2xl">Request your seat.</h2>
                  <p className="mono-subtitle text-sm">
                    We review each signup to keep operations smooth and secure.
                  </p>
                </div>
                <img
                  src={illustriation}
                  alt="Lets Travel Together!"
                  className="w-full rounded-2xl shadow-sm object-cover grayscale"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
