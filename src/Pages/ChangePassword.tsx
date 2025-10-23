import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";

const ROLE_PATHS: Record<string, string> = {
  admin: "/admin",
  superadmin: "/admin",
  provider: "/provider",
  manager: "/manager",
  user: "/user",
};

interface ChangePasswordProps {
  onChangePassword: (newPassword: string) => Promise<boolean>;
}

export default function ChangePassword({
  onChangePassword,
}: ChangePasswordProps) {
  const { currentUser } = useAuth();
  const [formState, setFormState] = useState({
    newPassword: "",
    confirmPassword: "",
    showNewPassword: false,
    showConfirmPassword: false,
    error: "",
    loading: false,
  });
  const navigate = useNavigate();

  const timeout = (ms: number) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, error: "" }));

    if (formState.newPassword.length < 6) {
      setFormState((prev) => ({
        ...prev,
        error: "Password must be at least 6 characters.",
      }));
      toast.error("Password must be at least 6 characters.", {
        toastId: "change-password-toast",
      });
      return;
    }

    if (formState.newPassword.trim() !== formState.confirmPassword.trim()) {
      setFormState((prev) => ({
        ...prev,
        error: "Passwords do not match.",
      }));
      toast.error("Passwords do not match.", {
        toastId: "change-password-toast",
      });
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));
    try {
      const success = await Promise.race([
        onChangePassword(formState.newPassword.trim()),
        timeout(10000),
      ]);

      if (success) {
        setFormState((prev) => ({
          ...prev,
          newPassword: "",
          confirmPassword: "",
          loading: false,
        }));
        toast.success("Password changed successfully!", {
          toastId: "change-password-toast",
        });
        const homePath =
          currentUser?.role && ROLE_PATHS[currentUser.role]
            ? ROLE_PATHS[currentUser.role]
            : "/user";
        navigate(homePath, { replace: true });
      } else {
        setFormState((prev) => ({
          ...prev,
          error: "Failed to change password.",
          loading: false,
        }));
        toast.error("Failed to change password.", {
          toastId: "change-password-toast",
        });
      }
    } catch (err: any) {
      const errorMessage =
        err.message || "An error occurred while changing the password.";
      setFormState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
      toast.error(errorMessage, { toastId: "change-password-toast" });
      if (process.env.NODE_ENV !== "production") {
        console.error("ChangePassword error:", err);
      }
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
              Change Password
            </h2>
            <p className="text-gray-600 mt-2">Update your account password</p>
          </div>

          {formState.error && (
            <div
              id="change-password-error"
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
                  <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
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
                    formState.error ? "change-password-error" : undefined
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
                  <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
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
                    formState.error ? "change-password-error" : undefined
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
                  <span>Changing Password...</span>
                </div>
              ) : (
                "Change Password"
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => navigate(-1)}
              disabled={formState.loading}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Secure password update powered by advanced encryption</p>
        </div>
      </div>
    </div>
  );
}
