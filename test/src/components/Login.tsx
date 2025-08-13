import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../supabaseClient";
import type { AuthUser } from "../types/type";

function Login() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user as any;
      if (sessionUser) setUserFromSession(sessionUser);
    };

    fetchSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user as any;
      if (sessionUser) setUserFromSession(sessionUser);
      else setUser(null);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const setUserFromSession = (sessionUser: any) => {
    const metadata = sessionUser.user_metadata || {};
    setUser({
      id: sessionUser.id,
      email: sessionUser.email,
      username: metadata.username || "",
      role: metadata.role || "user",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          view="sign_in"
          redirectTo="/user"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow max-w-md w-full">
        <p>
          Logged in as {user.username} ({user.role})
        </p>
        {user.role === "superadmin" && <p>Show superadmin panel</p>}
        {user.role === "admin" && <p>Show admin panel</p>}
        {user.role === "provider" && <p>Show provider panel</p>}
        {user.role === "user" && <p>Show user panel</p>}
      </div>
    </div>
  );
}

export default Login;
