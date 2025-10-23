import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Mail } from "lucide-react";
import { toast } from "react-toastify";

export default function ForgotPassword() {
  const [formState, setFormState] = useState({
    email: "",
    loading: false,
    error: "",
    success: false,
  });
  const navigate = useNavigate();

  const timeout = (ms: number) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "", loading: true }));

    try {
      const redirectUrl =
        import.meta.env.VITE_BASE_URL || window.location.origin;
      console.log("Environment:", {
        VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
        windowLocationOrigin: window.location.origin,
        redirectUrl: `${redirectUrl}/reset-password`,
      });

      const response = await Promise.race([
        supabase.auth.resetPasswordForEmail(formState.email, {
          redirectTo: `${redirectUrl}/reset-password`,
        }),
        timeout(10000),
      ]);

      const { data, error } = response as any;
      if (error) {
        setFormState((prev) => ({
          ...prev,
          error: error.message || "Failed to send reset email.",
          loading: false,
        }));
        toast.error(error.message || "Failed to send reset email.", {
          toastId: "forgot-password-toast",
        });
        return;
      }

      if (!data) {
        setFormState((prev) => ({
          ...prev,
          error: "No response from server. Please try again.",
          loading: false,
        }));
        toast.error("No response from server. Please try again.", {
          toastId: "forgot-password-toast",
        });
        return;
      }

      setFormState((prev) => ({ ...prev, success: true, loading: false }));
      toast.success(
        "Password reset email sent! Check your inbox and spam/junk folder.",
        { toastId: "forgot-password-toast" }
      );
    } catch (err: any) {
      setFormState((prev) => ({
        ...prev,
        error: err.message || "An unexpected error occurred.",
        loading: false,
      }));
      toast.error(err.message || "An unexpected error occurred.", {
        toastId: "forgot-password-toast",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {window.innerWidth > 768 && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse will-change-opacity"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-1000 will-change-opacity"></div>
        </div>
      )}

      <div className="relative w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Reset Password
            </h2>
            <p className="text-gray-600 mt-2">
              Enter your email to receive a password reset link
            </p>
          </div>

          {formState.error && (
            <div
              id="email-error"
              role="alert"
              aria-live="assertive"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 animate-shake"
            >
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  role="img"
                  aria-label="Error icon"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{formState.error}</span>
              </div>
            </div>
          )}

          {formState.success ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              <p>
                Check your email for a password reset link (including spam/junk
                folder).
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              autoComplete="off"
            >
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formState.email}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                    required
                    disabled={formState.loading}
                    aria-describedby={
                      formState.error ? "email-error" : undefined
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formState.loading}
                aria-busy={formState.loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                {formState.loading ? (
                  <div className="flex items-center justify-center">
                    <div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"
                      aria-hidden="true"
                    ></div>
                    <span>Sending Reset Email...</span>
                  </div>
                ) : (
                  "Send Reset Email"
                )}
              </button>
            </form>
          )}

          <div className="text-center mt-6">
            <button
              onClick={() => navigate("/login")}
              disabled={formState.loading}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50"
            >
              Back to Login
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Secure password reset powered by advanced encryption</p>
        </div>
      </div>
    </div>
  );
}
