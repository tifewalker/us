import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // getSession() only reads local storage. If the account was deleted
      // server-side (e.g. a DB wipe), that stored session still looks valid
      // but every write fails (FK violations → 409). Ask the server, and sign
      // out only when it says the user is gone — not on network errors.
      if (data.session) {
        const { error } = await supabase.auth.getUser();
        if (error && (error.status === 401 || error.status === 403)) {
          console.log("[useAuth] stored session is stale, signing out:", error.message);
          await supabase.auth.signOut({ scope: "local" });
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
