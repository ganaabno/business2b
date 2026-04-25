import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight } from "lucide-react";
import Logo from "../assets/last logo.png";
import illustriation from "../assets/illustriation.jpg";
import ThemeToggle from "../components/ThemeToggle";
import { featureFlags } from "../config/featureFlags";

export default function Login() {
  const { login, hasPendingRequest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const user = await login(email, password);
      if (!user) {
        const pending = await hasPendingRequest(email);
        setError(
          pending
            ? "Your account request is pending admin approval."
            : "Invalid email or password",
        );
        return;
      }
      const homePath =
        user.role === "admin" || user.role === "superadmin"
          ? "/admin"
          : user.role === "manager"
          ? "/manager"
          : user.role === "provider"
          ? "/provider"
          : user.role === "agent"
          ? "/agent"
          : user.role === "subcontractor"
          ? featureFlags.b2bSeatRequestFlowEnabled
            ? "/subcontractor"
            : "/user"
          : "/user";
      navigate(homePath, { replace: true });
    } catch (err: any) {
      const rawMessage = String(err?.message || "").toLowerCase();
      if (rawMessage.includes("invalid login credentials")) {
        const pending = await hasPendingRequest(email);
        setError(
          pending
            ? "Your account request is pending admin approval."
            : "Invalid email or password",
        );
      } else {
        setError(err.message || "An error occurred during login");
      }
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--mono-bg)' }}
    >
      {/* Theme Toggle — top right */}
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
        <div className="grid lg:grid-cols-2 min-h-[580px]">
          {/* LEFT: Login Form */}
          <div className="p-8 sm:p-10 flex flex-col justify-center">
            {/* Logo */}
            <div className="mb-8">
              <div
                className="w-12 h-12 rounded-xl border p-2 mb-6 inline-block"
                style={{
                  background: 'var(--mono-surface-muted)',
                  borderColor: 'var(--mono-border)',
                }}
              >
                <img
                  src={Logo}
                  alt="GTrip Logo"
                  className="w-full h-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: 'var(--mono-text-soft)' }}
              >
                Welcome back
              </p>
              <h1
                className="text-3xl sm:text-4xl font-bold leading-tight"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--mono-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Sign in to GTrip
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--mono-text-muted)' }}>
                Continue managing trips with a clean, focused workspace.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6 text-sm"
                style={{
                  background: 'var(--mono-danger-bg)',
                  border: '1px solid var(--mono-border)',
                  color: 'var(--mono-danger-text)',
                }}
                role="alert"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--mono-text)' }}
                  htmlFor="login-email"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--mono-text-soft)' }}
                  />
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    disabled={isLoading}
                    className="mono-input pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="block text-sm font-medium"
                    style={{ color: 'var(--mono-text)' }}
                    htmlFor="login-password"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    disabled={isLoading}
                    className="text-xs font-medium transition-colors hover:underline"
                    style={{ color: 'var(--mono-accent)' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--mono-text-soft)' }}
                  />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="mono-input pl-10 pr-12 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--mono-text-soft)' }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.color = 'var(--mono-text)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.color = 'var(--mono-text-soft)')
                    }
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="mono-button w-full justify-center gap-2 mt-2"
                style={{ marginTop: '0.75rem' }}
              >
                {isLoading ? (
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
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Sign up link */}
            <div
              className="mt-6 pt-5 text-sm text-center"
              style={{ borderTop: '1px solid var(--mono-border)' }}
            >
              <span style={{ color: 'var(--mono-text-muted)' }}>Don't have an account? </span>
              <button
                onClick={() => navigate("/signup")}
                disabled={isLoading}
                className="font-semibold hover:underline transition-colors"
                style={{ color: 'var(--mono-accent)' }}
              >
                Create account
              </button>
            </div>
          </div>

          {/* RIGHT: Illustration panel */}
          <div
            className="hidden lg:flex flex-col justify-between p-8 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--mono-accent-soft), var(--mono-surface-muted))',
              borderLeft: '1px solid var(--mono-border)',
            }}
          >
            {/* Text content */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--mono-text-soft)' }}
              >
                Workspace
              </p>
              <h2
                className="text-2xl font-bold leading-tight mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--mono-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Plan, book, repeat.
              </h2>
              <p className="text-sm" style={{ color: 'var(--mono-text-muted)' }}>
                Keep every itinerary, passenger, and booking in one place.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-2 my-6">
              {[
                { icon: '✈️', label: 'Tour management', desc: 'Manage tours & itineraries' },
                { icon: '👥', label: 'Passenger tracking', desc: 'Manage all passengers' },
                { icon: '📊', label: 'Analytics', desc: 'Revenue & booking metrics' },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: 'var(--mono-surface)',
                    border: '1px solid var(--mono-border)',
                  }}
                >
                  <span className="text-lg">{feature.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--mono-text)' }}>
                      {feature.label}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--mono-text-soft)' }}>
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Image */}
            <div>
              <img
                src={illustriation}
                alt="Travel illustration"
                loading="lazy"
                decoding="async"
                className="w-full rounded-xl object-cover"
                style={{
                  maxHeight: '200px',
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
