import { useState } from "react";
import { supabase } from "../supabaseClient";
import type { User, Role } from "../types/type";

interface AuthProps {
  onLogin: (user: User) => void;
}

function toRole(value: any): Role {
  const v = String(value ?? "user") as Role;
  if (v === "user" || v === "provider" || v === "admin" || v === "superadmin") return v;
  return "user";
}

export default function Auth({ onLogin }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setError("Check your email to confirm your account, then log in.");
          return;
        }
      }

      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      const authUser = loginData.user;
      if (!authUser) throw new Error("No user after login.");
      const authUserId = authUser.id;

      let { data: row, error: selectErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (!row) {
        const { data: inserted, error: insertErr } = await supabase
          .from("users")
          .insert({
            id: authUserId,
            email,
            first_name: firstName || null,
            last_name: lastName || null,
            role: "user",
            access: "active",
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        row = inserted;
      }

      const userObj: User = {
        userId: String(row.id),
        id: String(row.id),
        first_name: String(row.first_name ?? ""),
        last_name: String(row.last_name ?? ""),
        username: String(row.username ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        password: String(row.password ?? ""),
        blacklist: Boolean(row.blacklist ?? false),
        membership_points: Number(row.membership_points ?? 0),
        role: toRole(row.role),
        access: String(row.access ?? "active"),
        company: String(row.company ?? ""),
        birth_date: String(row.birth_date ?? ""),
        id_card_number: String(row.id_card_number ?? ""),
        passport_number: String(row.passport_number ?? ""),
        passport_expire: String(row.passport_expire ?? ""),
        allergy: String(row.allergy ?? ""),
        emergency_phone: String(row.emergency_phone ?? ""),
        membership_rank: String(row.membership_rank ?? ""),
        registered_by: String(row.registered_by ?? ""),
        createdBy: String(row.createdBy ?? ""),
        travel_history: Array.isArray(row.travel_history) ? row.travel_history : [],
        createdAt: new Date(row.createdAt ?? Date.now()),
        updatedAt: new Date(row.updatedAt ?? Date.now()),
      };

      onLogin(userObj);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">
            {isSignup ? "Create an Account" : "Welcome Back"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isSignup ? "Join us today" : "Sign in to continue"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {isSignup && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleAuth}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition ${
              loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isSignup ? "Creating Account..." : "Signing In..."}
              </span>
            ) : isSignup ? "Sign Up" : "Sign In"}
          </button>
        </div>

        <div className="text-center text-sm text-gray-600">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
          >
            {isSignup ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}