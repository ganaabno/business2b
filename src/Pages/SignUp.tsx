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
  type RequestedRole = "provider" | "agent" | "subcontractor";
  type AgentContractVersion = {
    id: string;
    version_no: number;
    title: string;
    body_markdown: string;
    file_url: string | null;
  };

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("subcontractor");
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

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedEmail || !normalizedUsername || !password || !normalizedPhone) {
      setStatus("error");
      setMessage("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setStatus("error");
      setMessage("Password must be at least 6 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
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
    if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
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
        .eq("email", normalizedEmail)
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
        userExists = await checkEmailExists(normalizedEmail);
      } catch {
        const { data: existingUser, error: existingUserError } = await supabase
          .from("users")
          .select("id")
          .eq("email", normalizedEmail)
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
        .eq("username", normalizedUsername)
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
        email: normalizedEmail,
        username: normalizedUsername,
        phone: normalizedPhone,
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

      const upsertPendingRequest = async (nextPayload: Record<string, unknown>) => {
        return existingPendingRequest
          ? await supabase
              .from("pending_users")
              .update({
                ...nextPayload,
                status: "pending",
                approved_by: null,
                approved_at: null,
                notes: null,
              })
              .eq("id", existingPendingRequest.id)
          : await supabase.from("pending_users").insert(nextPayload);
      };

      let writePayload: Record<string, unknown> = payload;
      let { error } = await upsertPendingRequest(writePayload);

      const isRoleConstraintError =
        String((error as { message?: string })?.message || "").includes(
          "pending_users_role_requested_check",
        ) || String((error as { code?: string })?.code || "") === "23514";

      if (error && isRoleConstraintError) {
        writePayload = {
          ...writePayload,
          role_requested: "user",
        };
        const retryResult = await upsertPendingRequest(writePayload);
        error = retryResult.error;
      }

      const errorMessageLower = String(
        (error as { message?: string })?.message || "",
      ).toLowerCase();
      const errorCode = String((error as { code?: string })?.code || "");
      const isPhoneColumnMissing =
        (errorCode === "PGRST204" || errorCode === "42703") &&
        errorMessageLower.includes("phone");

      if (error && isPhoneColumnMissing) {
        const payloadWithoutPhone = { ...writePayload };
        delete payloadWithoutPhone.phone;
        const retryResult = await upsertPendingRequest(payloadWithoutPhone);
        error = retryResult.error;
        writePayload = payloadWithoutPhone;
      }

      if (error) {
        if (isRoleConstraintError) {
          throw new Error(
            "Signup role settings are outdated on database. Please ask admin to run latest migration and try again.",
          );
        }

        if (
          String((error as { code?: string })?.code || "") === "23505" ||
          String((error as { message?: string })?.message || "").includes(
            "pending_users_email_key",
          )
        ) {
          const duplicateUpdate = await supabase
            .from("pending_users")
            .update({
              ...writePayload,
              status: "pending",
              approved_by: null,
              approved_at: null,
              notes: null,
            })
            .eq("email", normalizedEmail);

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
      setPhone("");
      setPassword("");
      setRequestedRole("subcontractor");
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

  // Pending state
  if (status === "pending") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ background: 'var(--mono-bg)' }}
      >
        <div
          className="p-8 max-w-md w-full text-center rounded-2xl mono-rise"
          style={{
            background: 'var(--mono-surface)',
            border: '1px solid var(--mono-border)',
            boxShadow: 'var(--mono-shadow-md)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--mono-warning-bg)', border: '1px solid var(--mono-border)' }}
          >
            <Clock className="w-7 h-7" style={{ color: 'var(--mono-warning-text)' }} />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--mono-text)' }}
          >
            Request Pending
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--mono-text-muted)' }}>{message}</p>
          <button onClick={() => navigate("/login")} className="mono-button w-full justify-center">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ background: 'var(--mono-bg)' }}
      >
        <div
          className="p-8 max-w-md w-full text-center rounded-2xl mono-rise"
          style={{
            background: 'var(--mono-surface)',
            border: '1px solid var(--mono-border)',
            boxShadow: 'var(--mono-shadow-md)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--mono-success-bg)', border: '1px solid var(--mono-border)' }}
          >
            <CheckCircle className="w-7 h-7" style={{ color: 'var(--mono-success-text)' }} />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--mono-text)' }}
          >
            Request Sent!
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--mono-text-muted)' }}>{message}</p>
          <button onClick={() => navigate("/login")} className="mono-button w-full justify-center">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--mono-bg)' }}
    >
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle className="px-2.5 py-2 text-xs" showLabel={false} />
      </div>

      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl mono-rise"
        style={{
          background: 'var(--mono-surface)',
          border: '1px solid var(--mono-border)',
          boxShadow: 'var(--mono-shadow-lg)',
        }}
      >
        <div className="grid lg:grid-cols-2">
          {/* LEFT — FORM */}
          <div className="p-8 lg:p-10 flex flex-col gap-6 overflow-y-auto max-h-screen">
            {/* Logo + Header */}
            <div>
              <div
                className="w-12 h-12 rounded-xl border p-2 mb-6 inline-block"
                style={{
                  background: 'var(--mono-surface-muted)',
                  borderColor: 'var(--mono-border)',
                }}
              >
                <img src={Logo} alt="GTrip Logo" className="w-full h-full object-contain" />
              </div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: 'var(--mono-text-soft)' }}
              >
                Get started
              </p>
              <h1
                className="text-3xl font-bold leading-tight"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--mono-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Create Account
              </h1>
              <p className="mt-1.5 text-sm" style={{ color: 'var(--mono-text-muted)' }}>
                Fill in your details to request access to GTrip.
              </p>
            </div>

            {/* Error Alert */}
            {status === "error" && (
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--mono-danger-bg)',
                  border: '1px solid var(--mono-border)',
                  color: 'var(--mono-danger-text)',
                }}
                role="alert"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--mono-text)' }}
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--mono-text-soft)' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    disabled={status === "loading"}
                    className="mono-input pl-10 pr-4 text-sm"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--mono-text)' }}
                >
                  Username
                  <span
                    className="ml-1.5 text-xs font-normal"
                    style={{ color: 'var(--mono-text-soft)' }}
                  >
                    (3–20 chars, letters/numbers/underscores)
                  </span>
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--mono-text-soft)' }}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_username"
                    required
                    disabled={status === "loading"}
                    className="mono-input pl-10 pr-4 text-sm"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--mono-text)' }}
                >
                  Phone Number
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--mono-text-soft)' }}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+976 9900 0000"
                    required
                    disabled={status === "loading"}
                    className="mono-input pl-10 pr-4 text-sm"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--mono-text)' }}
                >
                  Password
                  <span
                    className="ml-1.5 text-xs font-normal"
                    style={{ color: 'var(--mono-text-soft)' }}
                  >
                    (minimum 6 characters)
                  </span>
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--mono-text-soft)' }}
                  />
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
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--mono-text-soft)' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Account Type */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--mono-text)' }}
                >
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
                  className="mono-select text-sm"
                  disabled={status === "loading"}
                >
                  <option value="subcontractor">Subcontractor — Book seats for clients</option>
                  <option value="provider">Provider — Manage assigned tours</option>
                  <option value="agent">Agent — Resell and manage bookings</option>
                </select>
              </div>

              {/* Agent Contract section */}
              {requestedRole === "agent" && (
                <div
                  className="p-4 rounded-xl space-y-3"
                  style={{
                    background: 'var(--mono-surface-muted)',
                    border: '1px solid var(--mono-border)',
                  }}
                >
                  {contractLoading ? (
                    <p className="text-sm" style={{ color: 'var(--mono-text-muted)' }}>
                      Loading active contract...
                    </p>
                  ) : !activeContract ? (
                    <p className="text-sm" style={{ color: 'var(--mono-danger-text)' }}>
                      No active contract available. Please contact a manager.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: 'var(--mono-text)' }}
                          >
                            Agent Contract Required
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-muted)' }}>
                            {activeContract.title} (v{activeContract.version_no})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setContractModalError("");
                            setIsContractModalOpen(true);
                          }}
                          className="mono-button mono-button--ghost mono-button--sm shrink-0"
                          disabled={status === "loading" || contractLoading}
                        >
                          Review & Sign
                        </button>
                      </div>
                      <div>
                        {contractConcluded ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{
                              background: 'var(--mono-success-bg)',
                              color: 'var(--mono-success-text)',
                              border: '1px solid var(--mono-border)',
                            }}
                          >
                            <CheckCircle className="w-3 h-3" /> Contract signed
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{
                              background: 'var(--mono-warning-bg)',
                              color: 'var(--mono-warning-text)',
                              border: '1px solid var(--mono-border)',
                            }}
                          >
                            <AlertCircle className="w-3 h-3" /> Contract not signed yet
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Company checkbox */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                style={{
                  border: `1px solid ${isCompany ? 'var(--mono-accent)' : 'var(--mono-border)'}`,
                  background: isCompany ? 'var(--mono-accent-soft)' : 'transparent',
                }}
                onClick={() => setIsCompany(!isCompany)}
              >
                <input
                  type="checkbox"
                  id="company"
                  checked={isCompany}
                  onChange={(e) => setIsCompany(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 shrink-0"
                />
                <div>
                  <label
                    htmlFor="company"
                    className="text-sm font-medium cursor-pointer select-none"
                    style={{ color: 'var(--mono-text)' }}
                  >
                    Register as a Company
                  </label>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-soft)' }}>
                    Add company name and contact details
                  </p>
                </div>
              </div>

              {/* Company fields */}
              {isCompany && (
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--mono-text)' }}
                    >
                      Company Name
                    </label>
                    <div className="relative">
                      <Building2
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--mono-text-soft)' }}
                      />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Corporation"
                        className="mono-input pl-10 pr-4 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--mono-text)' }}
                    >
                      Company Phone
                    </label>
                    <div className="relative">
                      <Phone
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--mono-text-soft)' }}
                      />
                      <input
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="+976 1234 5678"
                        className="mono-input pl-10 pr-4 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="mono-button w-full justify-center gap-2"
                style={{ marginTop: '0.5rem' }}
              >
                {status === "loading" ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
                    Submitting request...
                  </>
                ) : (
                  "Request Access"
                )}
              </button>
            </form>

            {/* Agent contract modal */}
            {requestedRole === "agent" && isContractModalOpen && activeContract && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                <div
                  className="w-full max-w-3xl rounded-2xl overflow-hidden"
                  style={{
                    background: 'var(--mono-surface)',
                    border: '1px solid var(--mono-border)',
                    boxShadow: 'var(--mono-shadow-lg)',
                  }}
                >
                  <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--mono-border)' }}
                  >
                    <div>
                      <h3
                        className="text-lg font-bold"
                        style={{ color: 'var(--mono-text)', fontFamily: 'var(--font-display)' }}
                      >
                        Agent Contract
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-muted)' }}>
                        {activeContract.title} (v{activeContract.version_no})
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

                  <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
                    {contractModalError && (
                      <div
                        className="rounded-xl px-3 py-2 text-xs"
                        style={{
                          background: 'var(--mono-danger-bg)',
                          color: 'var(--mono-danger-text)',
                          border: '1px solid var(--mono-border)',
                        }}
                      >
                        {contractModalError}
                      </div>
                    )}

                    <div
                      className="rounded-xl p-3 text-xs leading-5 whitespace-pre-wrap max-h-48 overflow-auto"
                      style={{
                        background: 'var(--mono-surface-muted)',
                        border: '1px solid var(--mono-border)',
                        color: 'var(--mono-text)',
                      }}
                    >
                      {activeContract.body_markdown}
                    </div>

                    {activeContract.file_url && (
                      <a
                        href={activeContract.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline"
                        style={{ color: 'var(--mono-accent)' }}
                      >
                        Open uploaded contract file
                      </a>
                    )}

                    <div className="space-y-2">
                      <label
                        className="flex items-center gap-2 text-sm cursor-pointer"
                        style={{ color: 'var(--mono-text)' }}
                      >
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
                      <label
                        className="flex items-center gap-2 text-sm cursor-pointer"
                        style={{ color: 'var(--mono-text)' }}
                      >
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
                      {[
                        { label: 'Овог нэр', value: contractSignedName, setter: setContractSignedName, placeholder: 'Овог нэр' },
                        { label: 'Гарын үсэг', value: contractSignerSignature, setter: setContractSignerSignature, placeholder: 'Гарын үсэг' },
                        { label: 'Агент', value: contractAgentName, setter: setContractAgentName, placeholder: 'Агент компанийн нэр' },
                        { label: 'Нөгөө талын овог нэр', value: contractCounterpartyFullName, setter: setContractCounterpartyFullName, placeholder: 'Нөгөө талын овог нэр' },
                      ].map((field) => (
                        <div key={field.label}>
                          <label
                            className="block text-sm font-medium mb-1.5"
                            style={{ color: 'var(--mono-text)' }}
                          >
                            {field.label}
                          </label>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => {
                              field.setter(e.target.value);
                              setContractConcluded(false);
                              setContractModalError("");
                            }}
                            placeholder={field.placeholder}
                            className="mono-input text-sm"
                            disabled={status === "loading"}
                          />
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label
                          className="block text-sm font-medium mb-1.5"
                          style={{ color: 'var(--mono-text)' }}
                        >
                          Нөгөө талын гарын үсэг
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
                          className="mono-input text-sm"
                          disabled={status === "loading"}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className="px-5 py-4 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--mono-border)' }}
                  >
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
                      Confirm Contract
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sign in link */}
            <div
              className="pt-4 text-sm text-center"
              style={{ borderTop: '1px solid var(--mono-border)' }}
            >
              <span style={{ color: 'var(--mono-text-muted)' }}>Already have an account? </span>
              <button
                onClick={() => navigate("/login")}
                className="font-semibold hover:underline transition-colors"
                style={{ color: 'var(--mono-accent)' }}
                disabled={status === "loading"}
              >
                Sign in
              </button>
            </div>
          </div>

          {/* RIGHT — IMAGE + INFO */}
          <div
            className="hidden lg:flex flex-col justify-between p-8"
            style={{
              background: 'linear-gradient(135deg, var(--mono-accent-soft), var(--mono-surface-muted))',
              borderLeft: '1px solid var(--mono-border)',
            }}
          >
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--mono-text-soft)' }}
              >
                GTrip B2B Platform
              </p>
              <h2
                className="text-2xl font-bold leading-tight mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--mono-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Join the network.
              </h2>
              <p className="text-sm" style={{ color: 'var(--mono-text-muted)' }}>
                Connect with GTrip to manage bookings, seat requests, and travel operations.
              </p>
            </div>

            <div className="space-y-2 my-6">
              {[
                { icon: '🏢', label: 'Role-based access', desc: 'Subcontractor, Provider, or Agent' },
                { icon: '🎟️', label: 'Seat requests', desc: 'Submit and track booking requests' },
                { icon: '🔒', label: 'Secure & audited', desc: 'Admin approval workflow' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'var(--mono-surface)',
                    border: '1px solid var(--mono-border)',
                  }}
                >
                  <span className="text-lg">{f.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--mono-text)' }}>
                      {f.label}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--mono-text-soft)' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <img
                src={illustriation}
                alt="Travel illustration"
                className="w-full rounded-xl object-cover"
                loading="lazy"
                decoding="async"
                style={{
                  maxHeight: '180px',
                  filter: 'saturate(0.9)',
                  border: '1px solid var(--mono-border)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
