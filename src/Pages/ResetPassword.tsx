import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";

export default function ResetPassword() {
  const [formState, setFormState] = useState({
    newPassword: "",
    confirmPassword: "",
    showNewPassword: false,
    showConfirmPassword: false,
    error: "",
    loading: false,
    success: false,
    sessionReady: false,
  });
  const navigate = useNavigate();

  const timeout = (ms: number) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );

  useEffect(() => {
    const init = async () => {
      try {
        const response = await Promise.race([
          supabase.auth.getSession(),
          timeout(10000),
        ]);

        const {
          data: { session },
          error,
        } = response as any;
        console.log("Session Check:", { session, error });
        if (error) {
          setFormState((prev) => ({
            ...prev,
            error: "An error occurred while checking the session.",
          }));
          toast.error("An error occurred while checking the session.", {
            toastId: "reset-password-toast",
          });
          return;
        }

        if (!session) {
          setFormState((prev) => ({
            ...prev,
            error:
              "Invalid or expired reset link. Please use the link from your email.",
          }));
          toast.error("Invalid or expired reset link.", {
            toastId: "reset-password-toast",
          });
          return;
        }

        setFormState((prev) => ({ ...prev, sessionReady: true }));
      } catch (err: any) {
        console.error("Session Error:", err);
        setFormState((prev) => ({
          ...prev,
          error: err.message || "An unexpected error occurred.",
        }));
        toast.error(err.message || "An unexpected error occurred.", {
          toastId: "reset-password-toast",
        });
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth State Change:", { event, session });
        if (event === "PASSWORD_RECOVERY") {
          setFormState((prev) => ({ ...prev, sessionReady: true }));
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "" }));

    if (!formState.sessionReady) {
      toast.error("Session is not ready. Please try again.", {
        toastId: "reset-password-toast",
      });
      return;
    }

    if (formState.newPassword.length < 6) {
      setFormState((prev) => ({
        ...prev,
        error: "Password must be at least 6 characters.",
      }));
      toast.error("Password must be at least 6 characters.", {
        toastId: "reset-password-toast",
      });
      return;
    }

    if (formState.newPassword.trim() !== formState.confirmPassword.trim()) {
      setFormState((prev) => ({
        ...prev,
        error: "Passwords do not match.",
      }));
      toast.error("Passwords do not match.", {
        toastId: "reset-password-toast",
      });
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await Promise.race([
        supabase.auth.updateUser({
          password: formState.newPassword.trim(),
        }),
        timeout(10000),
      ]);

      const { error } = response as any;
      if (error) {
        setFormState((prev) => ({
          ...prev,
          error: error.message || "Failed to reset password.",
          loading: false,
        }));
        toast.error(error.message || "Failed to reset password.", {
          toastId: "reset-password-toast",
        });
        return;
      }

      await supabase.auth.signOut();
      setFormState((prev) => ({
        ...prev,
        success: true,
        newPassword: "",
        confirmPassword: "",
        loading: false,
      }));
      toast.success("Password reset successfully! Redirecting to login...", {
        toastId: "reset-password-toast",
      });
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      setFormState((prev) => ({
        ...prev,
        error: err.message || "An unexpected error occurred.",
        loading: false,
      }));
      toast.error(err.message || "An unexpected error occurred.", {
        toastId: "reset-password-toast",
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
            <p className="text-gray-600 mt-2">Enter your new password</p>
          </div>

          {formState.error && (
            <div
              id="reset-password-error"
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
              <p>Password reset successfully! Redirecting to login...</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              autoComplete="off"
            >
              <div className="space-y-2">
                <label
                  htmlFor="newPassword"
                  className="text-sm font-medium text-gray-700"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <input
                    id="newPassword"
                    type={formState.showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={formState.newPassword}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                    autoComplete="new-password"
                    required
                    disabled={formState.loading}
                    aria-describedby={
                      formState.error ? "reset-password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        showNewPassword: !prev.showNewPassword,
                      }))
                    }
                    disabled={formState.loading}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    aria-label={
                      formState.showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                  >
                    {formState.showNewPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-gray-700"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <input
                    id="confirmPassword"
                    type={formState.showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={formState.confirmPassword}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                    autoComplete="new-password"
                    required
                    disabled={formState.loading}
                    aria-describedby={
                      formState.error ? "reset-password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        showConfirmPassword: !prev.showConfirmPassword,
                      }))
                    }
                    disabled={formState.loading}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    aria-label={
                      formState.showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {formState.showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={formState.loading || !formState.sessionReady}
                aria-busy={formState.loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                {formState.loading ? (
                  <div className="flex items-center justify-center">
                    <div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"
                      aria-hidden="true"
                    ></div>
                    <span>Resetting Password...</span>
                  </div>
                ) : (
                  "Reset Password"
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
