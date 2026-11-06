import { type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { useAsync } from "@/hooks/useAsync";
import { PageLoader } from "@/components/ui";
import { useAuth } from "./AuthProvider";

/** UX guard only. Real protection is Row Level Security and the Edge Functions; this just routes people sensibly. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children ?? <Outlet />}</>;
}

export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { session, profile, loading, isAdminRole } = useAuth();
  const loc = useLocation();
  // Ask the database whether this session is allowed admin powers (role + MFA level).
  // The answer is tagged with the inputs it was computed for, so a stale answer from before the
  // profile loaded can never be used to redirect (that would bounce real admins to the MFA page).
  const key = `${session?.access_token ?? ""}:${profile?.role ?? ""}`;
  const gate = useAsync(async () => {
    if (!session || !isAdminRole) return { key, ok: false };
    const { data } = await supabase.rpc("is_admin");
    return { key, ok: data === true };
  }, [key]);

  if (loading || (session && !profile) || gate.loading || gate.data?.key !== key) return <PageLoader />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!isAdminRole) return <Navigate to="/dashboard" replace />;
  if (!gate.data.ok) return <Navigate to={`/auth/mfa?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children ?? <Outlet />}</>;
}
