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
      // 1) Sign up (optional step if user is creating a new account)
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // options: { data: { first_name: firstName, last_name: lastName } }, // optional metadata
        });
        if (signUpError) throw signUpError;

        // If email confirmations are enabled, there's no session yet
        if (!data.session) {
          setError("Check your email to confirm your account, then log in.");
          return;
        }
      }

      // 2) Login (for both flows)
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      const authUser = loginData.user;
      if (!authUser) throw new Error("No user after login.");
      const authUserId = authUser.id;

      // 3) Fetch the profile from public.users (created by DB trigger). Select all columns you might need.
      // If your table doesn't have all of these columns, selecting "*" is fine; we'll default missing ones below.
      let { data: row, error: selectErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (selectErr) throw selectErr;

      // 4) If missing (e.g., user predates trigger), create a minimal row now (RLS-safe because we're authenticated)
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

      // 5) Build a full User object with safe defaults for fields that might be null/missing
      const userObj: User = {
        // ids
        userId: String(row.id),
        id: String(row.id),

        // required strings (default to empty string if null/undefined)
        first_name: String(row.first_name ?? ""),
        last_name: String(row.last_name ?? ""),
        username: String(row.username ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        password: String(row.password ?? ""), // if you dropped this column, it will be empty string (your UI should never show it)

        // booleans / numbers
        blacklist: Boolean(row.blacklist ?? false),
        membership_points: Number(row.membership_points ?? 0),

        // enums / controlled values
        role: toRole(row.role),
        access: String(row.access ?? "active"),

        // nullable fields normalized to empty string when your interface requires string
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

        // arrays
        travel_history: Array.isArray(row.travel_history) ? row.travel_history : [],

        // timestamps: your table uses camelCase createdAt/updatedAt
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">{isSignup ? "Sign Up" : "Login"}</h1>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {isSignup && (
        <>
          <input
            type="text"
            placeholder="First Name"
            className="mb-2 p-2 border rounded w-64"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Last Name"
            className="mb-2 p-2 border rounded w-64"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </>
      )}

      <input
        type="email"
        placeholder="Email"
        className="mb-2 p-2 border rounded w-64"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="mb-2 p-2 border rounded w-64"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleAuth}
        className="bg-blue-500 text-white p-2 rounded w-64"
        disabled={loading}
      >
        {loading ? (isSignup ? "Signing up..." : "Logging in...") : isSignup ? "Sign Up" : "Login"}
      </button>

      <p
        className="mt-4 text-sm text-gray-700 cursor-pointer"
        onClick={() => setIsSignup(!isSignup)}
      >
        {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
      </p>
    </div>
  );
}