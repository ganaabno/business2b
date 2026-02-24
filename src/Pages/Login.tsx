import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import Logo from "../assets/last logo.png";
import illustriation from "../assets/illustriation.jpg";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const { login } = useAuth();
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
        setError("Invalid email or password");
        return;
      }
      const homePath =
        user.role === "admin" || user.role === "superadmin"
          ? "/admin"
          : user.role === "provider"
          ? "/provider"
          : user.role === "manager"
          ? "/manager"
          : "/user";
      navigate(homePath, { replace: true });
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mono-shell">
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="mono-card w-full max-w-5xl overflow-hidden mono-rise">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            {/* LEFT: Login Form */}
            <div className="p-8 sm:p-12 flex flex-col justify-center gap-6">
              <div className="space-y-3">
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
                  <p className="mono-kicker">Welcome back</p>
                  <h1 className="mono-title text-3xl sm:text-4xl">
                    Sign in to Gtrip
                  </h1>
                  <p className="mono-subtitle mt-2">
                    Continue managing trips with a clean, focused workspace.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mono-panel px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      disabled={isLoading}
                      className="mono-input pl-10 pr-4 text-sm"
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mono-button w-full text-sm"
                >
                  {isLoading ? (
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
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              <div className="space-y-4 text-sm">
                <button
                  onClick={() => navigate("/forgot-password")}
                  disabled={isLoading}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Forgot password?
                </button>

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="h-px flex-1 bg-gray-200"></span>
                  New here?
                  <span className="h-px flex-1 bg-gray-200"></span>
                </div>

                <button
                  onClick={() => navigate("/signup")}
                  disabled={isLoading}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Create an account
                </button>
              </div>
            </div>

            {/* RIGHT: Image */}
            <div className="hidden lg:block p-6">
              <div className="mono-panel h-full p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <p className="mono-kicker">Workspace</p>
                  <h2 className="mono-title text-2xl">Plan, book, repeat.</h2>
                  <p className="mono-subtitle text-sm">
                    Keep every itinerary, passenger, and booking in one place.
                  </p>
                </div>
                <div className="pt-4">
                  <img
                    src={illustriation}
                    alt="Lets Travel Together!"
                    loading="lazy"
                    decoding="async"
                    className="w-full rounded-2xl shadow-sm object-cover grayscale"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
