import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { Alert, Button, PageLoader, TextInput } from "@/components/ui";

type Mode = { kind: "loading" } | { kind: "enroll"; factorId: string; qr: string; secret: string } | { kind: "challenge"; factorId: string };

/** Admins must hold an MFA (aal2) session. This page enrols an authenticator app or verifies the code. */
export default function MfaPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const next = sp.get("next") && sp.get("next")!.startsWith("/") && !sp.get("next")!.startsWith("//") ? sp.get("next")! : "/admin";

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const verified = f?.totp?.find((x) => x.status === "verified");
      if (verified) return setMode({ kind: "challenge", factorId: verified.id });
      // Remove half-finished enrolments so a fresh QR can be created.
      for (const x of f?.totp ?? []) await supabase.auth.mfa.unenroll({ factorId: x.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}` });
      if (error || !data || data.type !== "totp") return setErr("Could not start two-step verification setup.");
      setMode({ kind: "enroll", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })().catch(() => setErr("Could not load two-step verification."));
  }, []);

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || mode.kind === "loading") return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return setErr("Enter the 6-digit code from your authenticator app.");
    setBusy(true); setErr("");
    const ch = await supabase.auth.mfa.challenge({ factorId: mode.factorId });
    if (ch.error) { setBusy(false); return setErr("Could not start verification. Try again."); }
    const v = await supabase.auth.mfa.verify({ factorId: mode.factorId, challengeId: ch.data.id, code });
    setBusy(false);
    if (v.error) return setErr("That code is not correct or has expired.");
    await supabase.auth.refreshSession();
    nav(next, { replace: true });
  }

  if (mode.kind === "loading" && !err) return <PageLoader />;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Two-step verification</h1>
      <p className="mt-1 text-sm text-ink-mute">Administrator accounts must verify with an authenticator app.</p>
      <div className="card mt-6 space-y-4 p-5">
        {err && <Alert>{err}</Alert>}
        {mode.kind === "enroll" && (
          <>
            <p className="text-sm">Scan this QR code with Google Authenticator, Microsoft Authenticator or a similar app, then enter the 6-digit code.</p>
            <img src={mode.qr} alt="QR code for your authenticator app" className="mx-auto h-44 w-44" />
            <p className="break-all rounded bg-brand-50 p-2 text-center font-mono text-xs">{mode.secret}</p>
          </>
        )}
        {mode.kind !== "loading" && (
          <form onSubmit={verify} className="space-y-4" noValidate>
            <TextInput label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
            <Button loading={busy} className="btn-primary w-full">Verify</Button>
          </form>
        )}
      </div>
    </div>
  );
}
