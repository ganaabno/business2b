import { useEffect, useState } from "react";
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
  type RequestedRole = "user" | "agent";
  type AgentContractVersion = {
    id: string;
    version_no: number;
    title: string;
    body_markdown: string;
    file_url: string | null;
  };

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("user");
  const [isCompany, setIsCompany] = useState(false); // ← NEW: checkbox
  const [companyName, setCompanyName] = useState(""); // ← NEW: optional
  const [companyPhone, setCompanyPhone] = useState(""); // ← NEW: optional
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "pending"
  >("idle");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeContract, setActiveContract] =
    useState<AgentContractVersion | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractAgree, setContractAgree] = useState(false);
  const [contractDenied, setContractDenied] = useState(false);
  const [contractSignedName, setContractSignedName] = useState("");
  const [contractSignerSignature, setContractSignerSignature] = useState("");
  const [contractAgentName, setContractAgentName] = useState("");
  const [contractCounterpartyFullName, setContractCounterpartyFullName] =
    useState("");
  const [contractCounterpartySignature, setContractCounterpartySignature] =
    useState("");
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractConcluded, setContractConcluded] = useState(false);
  const [contractModalError, setContractModalError] = useState("");
  const navigate = useNavigate();

  const validateAgentContractFields = () => {
    if (contractDenied || !contractAgree) {
      return "You denied the standard or contract so we can't let u sign in.";
    }
    if (!activeContract?.id) {
      return "No active agent contract found. Please contact a manager.";
    }
    if (!contractSignedName.trim()) {
      return "Please enter signer full name (Овог нэр).";
    }
    if (!contractSignerSignature.trim()) {
      return "Please enter signer signature (Гарын үсэг).";
    }
    if (!contractAgentName.trim()) {
      return "Please enter agent name (Агент).";
    }
    if (!contractCounterpartyFullName.trim()) {
      return "Please enter counterparty full name (Овог нэр).";
    }
    if (!contractCounterpartySignature.trim()) {
      return "Please enter counterparty signature (Гарын үсэг).";
    }
    return null;
  };

  const handleSaveContractDetails = () => {
    const validationError = validateAgentContractFields();
    if (validationError) {
      setContractModalError(validationError);
      return;
    }
    setContractConcluded(true);
    setContractModalError("");
    setStatus("idle");
    setMessage("");
    setIsContractModalOpen(false);
  };

  useEffect(() => {
    const loadActiveContract = async () => {
      if (requestedRole !== "agent") return;
      setContractLoading(true);
      try {
        const { data, error } = await supabase
          .from("agent_contract_versions")
          .select("id, version_no, title, body_markdown, file_url")
          .eq("is_active", true)
          .eq("status", "published")
          .order("version_no", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setActiveContract((data as AgentContractVersion | null) ?? null);
      } catch (error) {
        setActiveContract(null);
      } finally {
        setContractLoading(false);
      }
    };

    loadActiveContract();
  }, [requestedRole]);

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

    if (requestedRole === "agent") {
      if (!contractConcluded) {
        setStatus("error");
        setMessage("Please conclude the contract first by clicking 'Geree Baiguulah'.");
        return;
      }
      const validationError = validateAgentContractFields();
      if (validationError) {
        setStatus("error");
        setMessage(validationError);
        return;
      }
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

    let existingPendingRequest: { id: string; status: string } | null = null;
    try {
      const { data, error } = await supabase
        .from("pending_users")
        .select("id, status")
        .eq("email", email)
        .maybeSingle();

      if (error && !error.message.includes("PGRST116")) {
        console.error("Error checking pending:", error);
        setStatus("error");
        setMessage("Error checking account status. Please try again.");
        return;
      }
      existingPendingRequest =
        (data as { id: string; status: string } | null) || null;
    } catch (error) {
      console.error("Unexpected error:", error);
      existingPendingRequest = null;
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
          "An account with this email already exists. Please log in instead.",
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

      if (existingPendingRequest?.status === "pending") {
        setStatus("pending");
        setMessage(
          "You already have a pending account request. Please wait for admin approval.",
        );
        return;
      }

      if (existingPendingRequest?.status === "approved") {
        setStatus("error");
        setMessage(
          "This email already has an approved request. Please login instead.",
        );
        return;
      }

      const passwordHash = await hash(password, 12);
      const payload = {
        email,
        username,
        password_hash: passwordHash,
        status: "pending",
        role_requested: requestedRole,
        company_name: isCompany ? companyName : null,
        company_phone: isCompany ? companyPhone : null,
        is_company: isCompany,
        contract_version_id:
          requestedRole === "agent" ? (activeContract?.id ?? null) : null,
        contract_accepted_at:
          requestedRole === "agent" ? new Date().toISOString() : null,
        contract_signed_name:
          requestedRole === "agent" ? contractSignedName.trim() : null,
        contract_signer_full_name:
          requestedRole === "agent" ? contractSignedName.trim() : null,
        contract_signer_signature:
          requestedRole === "agent" ? contractSignerSignature.trim() : null,
        contract_agent_name:
          requestedRole === "agent" ? contractAgentName.trim() : null,
        contract_counterparty_full_name:
          requestedRole === "agent"
            ? contractCounterpartyFullName.trim()
            : null,
        contract_counterparty_signature:
          requestedRole === "agent"
            ? contractCounterpartySignature.trim()
            : null,
        contract_denied_at:
          requestedRole === "agent" && contractDenied
            ? new Date().toISOString()
            : null,
        created_at: new Date().toISOString(),
      };

      const { error } = existingPendingRequest
        ? await supabase
            .from("pending_users")
            .update({
              ...payload,
              status: "pending",
              approved_by: null,
              approved_at: null,
              notes: null,
            })
            .eq("id", existingPendingRequest.id)
        : await supabase.from("pending_users").insert(payload);

      if (error) {
        if (
          String((error as { code?: string })?.code || "") === "23505" ||
          String((error as { message?: string })?.message || "").includes(
            "pending_users_email_key",
          )
        ) {
          const duplicateUpdate = await supabase
            .from("pending_users")
            .update({
              ...payload,
              status: "pending",
              approved_by: null,
              approved_at: null,
              notes: null,
            })
            .eq("email", email);

          if (!duplicateUpdate.error) {
            setStatus("success");
            setMessage("Account request sent! An admin will review it shortly.");
            setTimeout(() => navigate("/login"), 3000);
            return;
          }

          setStatus("pending");
          setMessage(
            "A request with this email already exists. Please wait for admin review.",
          );
          return;
        }
        console.error("Signup error:", error);
        throw new Error("Failed to create account request");
      }

      setStatus("success");
      setMessage("Account request sent! An admin will review it shortly.");
      setEmail("");
      setUsername("");
      setPassword("");
      setRequestedRole("user");
      setCompanyName("");
      setCompanyPhone("");
      setIsCompany(false);
      setContractAgree(false);
      setContractDenied(false);
      setContractSignedName("");
      setContractSignerSignature("");
      setContractAgentName("");
      setContractCounterpartyFullName("");
      setContractCounterpartySignature("");
      setContractConcluded(false);
      setContractModalError("");
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
                <ThemeToggle
                  className="px-2.5 py-2 text-xs"
                  showLabel={false}
                />
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
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Account Type
                  </label>
                  <select
                    value={requestedRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as RequestedRole;
                      setRequestedRole(nextRole);
                      if (nextRole !== "agent") {
                        setIsContractModalOpen(false);
                        setContractAgree(false);
                        setContractDenied(false);
                        setContractSignedName("");
                        setContractSignerSignature("");
                        setContractAgentName("");
                        setContractCounterpartyFullName("");
                        setContractCounterpartySignature("");
                        setContractConcluded(false);
                        setContractModalError("");
                      }
                    }}
                    className="mono-input"
                    disabled={status === "loading"}
                  >
                    <option value="user">Sign in as a User</option>
                    <option value="agent">Sign in as a Agent</option>
                  </select>
                </div>

                {requestedRole === "agent" && (
                  <div className="mono-panel p-4 rounded-xl space-y-3">
                    {contractLoading ? (
                      <p className="text-sm text-gray-600">
                        Loading active contract...
                      </p>
                    ) : !activeContract ? (
                      <p className="text-sm text-red-600">
                        No active contract is available right now. Please
                        contact manager.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Agent Contract
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {activeContract.title} (v
                              {activeContract.version_no})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setContractModalError("");
                              setIsContractModalOpen(true);
                            }}
                            className="mono-button mono-button--ghost mono-button--sm"
                            disabled={status === "loading" || contractLoading}
                          >
                            Geree Baiguulah
                          </button>
                        </div>

                        <div className="text-xs">
                          {contractConcluded ? (
                            <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2 py-1 text-green-700">
                              Contract details completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                              Contract not concluded yet
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

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

              {requestedRole === "agent" &&
                isContractModalOpen &&
                activeContract && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
                      <div className="border-b border-gray-200 px-5 py-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Geree Baiguulah
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {activeContract.title} (v{activeContract.version_no}
                            )
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setContractModalError("");
                            setIsContractModalOpen(false);
                          }}
                          className="mono-button mono-button--ghost mono-button--sm"
                        >
                          Close
                        </button>
                      </div>

                      <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-4">
                        {contractModalError && (
                          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                            {contractModalError}
                          </div>
                        )}

                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5 whitespace-pre-wrap max-h-64 overflow-auto">
                          {activeContract.body_markdown}
                        </div>

                        {activeContract.file_url && (
                          <a
                            href={activeContract.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-700 underline"
                          >
                            Open uploaded contract file
                          </a>
                        )}

                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={contractAgree}
                              onChange={(e) => {
                                setContractAgree(e.target.checked);
                                if (e.target.checked) setContractDenied(false);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              disabled={status === "loading"}
                            />
                            I agree to this agent contract.
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={contractDenied}
                              onChange={(e) => {
                                setContractDenied(e.target.checked);
                                if (e.target.checked) setContractAgree(false);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              disabled={status === "loading"}
                            />
                            I do not agree.
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Овог нэр
                            </label>
                            <input
                              type="text"
                              value={contractSignedName}
                              onChange={(e) => {
                                setContractSignedName(e.target.value);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              placeholder="Овог нэр"
                              className="mono-input"
                              disabled={status === "loading"}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Гарын үсэг
                            </label>
                            <input
                              type="text"
                              value={contractSignerSignature}
                              onChange={(e) => {
                                setContractSignerSignature(e.target.value);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              placeholder="Гарын үсэг"
                              className="mono-input"
                              disabled={status === "loading"}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Агент
                            </label>
                            <input
                              type="text"
                              value={contractAgentName}
                              onChange={(e) => {
                                setContractAgentName(e.target.value);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              placeholder="Агент компанийн нэр"
                              className="mono-input"
                              disabled={status === "loading"}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Овог нэр
                            </label>
                            <input
                              type="text"
                              value={contractCounterpartyFullName}
                              onChange={(e) => {
                                setContractCounterpartyFullName(e.target.value);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              placeholder="Нөгөө талын овог нэр"
                              className="mono-input"
                              disabled={status === "loading"}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-2">
                              Гарын үсэг
                            </label>
                            <input
                              type="text"
                              value={contractCounterpartySignature}
                              onChange={(e) => {
                                setContractCounterpartySignature(e.target.value);
                                setContractConcluded(false);
                                setContractModalError("");
                              }}
                              placeholder="Нөгөө талын гарын үсэг"
                              className="mono-input"
                              disabled={status === "loading"}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 px-5 py-4 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setContractModalError("");
                            setIsContractModalOpen(false);
                          }}
                          className="mono-button mono-button--ghost mono-button--sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveContractDetails}
                          className="mono-button mono-button--sm"
                        >
                          Save Contract Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              <div className="text-sm">
                <button
                  onClick={() => navigate("/login")}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  disabled={status === "loading"}
                >
                  Already have an account?{" "}
                  <span className="font-medium">Sign in</span>
                </button>
              </div>
            </div>

            {/* RIGHT — IMAGE */}
            <div className="hidden lg:block">
              <div className="h-full flex justify-between">
                <img
                  src={illustriation}
                  alt="Lets Travel Together!"
                  className="w-full rounded-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
