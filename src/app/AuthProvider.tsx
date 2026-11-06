import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/db";

interface AuthCtx {
  session: Session | null; profile: Profile | null; loading: boolean;
  isAdminRole: boolean; refreshProfile: () => Promise<void>; signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = (): AuthCtx => { const c = useContext(Ctx); if (!c) throw new Error("AuthProvider missing"); return c; };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string | null) => {
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("id, full_name, phone, avatar_path, role, created_at").eq("id", uid).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id ?? null);
      if (alive) setLoading(false);
    }).catch(() => alive && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Defer: calling supabase inside the callback can deadlock the auth client.
      setTimeout(() => { void loadProfile(s?.user.id ?? null); }, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo<AuthCtx>(() => ({
    session, profile, loading,
    isAdminRole: profile?.role === "admin" || profile?.role === "super_admin",
    refreshProfile: () => loadProfile(session?.user.id ?? null),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null); },
  }), [session, profile, loading, loadProfile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
