import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { Alert, Button, TextInput } from "@/components/ui";
import { firstIssue, loginSchema, newPasswordSchema, registerSchema, resetRequestSchema } from "@/lib/validation/schemas";
import { useAuth } from "@/app/AuthProvider";
import { useEffect } from "react";
import { useT } from "@/i18n";

const Shell = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <div className="mx-auto flex max-w-md flex-col px-4 py-12"><h1 className="text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-ink-mute">{sub}</p>}<div className="card mt-6 p-5">{children}</div></div>
);
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

export function LoginPage() {
  const { t } = useT();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { session, isAdminRole, profile } = useAuth();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (session && profile) nav(safeNext(sp.get("next")) ?? (isAdminRole ? "/admin" : "/dashboard"), { replace: true }); }, [session, profile, isAdminRole, nav, sp]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const p = loginSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword(p.data);
    setBusy(false);
    if (error) setErr(t("Incorrect email or password."));
  }
  return (
    <Shell title={t("Log in")} sub={t("Welcome back.")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <TextInput label={t("Email")} name="email" type="email" autoComplete="email" required />
        <TextInput label={t("Password")} name="password" type="password" autoComplete="current-password" required />
        <Button loading={busy} className="btn-primary w-full">{t("Log in")}</Button>
        <div className="flex justify-between text-sm"><Link className="text-brand-700 underline" to="/forgot-password">{t("Forgot password?")}</Link><Link className="text-brand-700 underline" to="/register">{t("Create account")}</Link></div>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { t } = useT();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const nav = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const p = registerSchema.safeParse({ full_name: f.get("full_name"), email: f.get("email"), phone: f.get("phone"), password: f.get("password") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signUp({ email: p.data.email, password: p.data.password, options: { data: { full_name: p.data.full_name, phone: p.data.phone }, emailRedirectTo: `${window.location.origin}/login` } });
    setBusy(false);
    if (error) return setErr(/registered/i.test(error.message) ? t("An account with this email already exists.") : t("We could not create your account. Please try again."));
    if (data.session) nav("/dashboard", { replace: true }); else setDone(true);
  }
  if (done) return <Shell title={t("Check your email")}><Alert kind="success">{t("We sent a confirmation link. Open it to activate your account, then log in.")}</Alert><Link to="/login" className="btn-primary mt-4 w-full">{t("Go to log in")}</Link></Shell>;
  return (
    <Shell title={t("Create your account")} sub={t("It takes a minute.")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <TextInput label={t("Full name")} name="full_name" autoComplete="name" required />
        <TextInput label={t("Email")} name="email" type="email" autoComplete="email" required />
        <TextInput label={t("Mobile number")} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01712345678" required />
        <TextInput label={t("Password")} name="password" type="password" autoComplete="new-password" hint={t("At least 8 characters with a letter and a number.")} required />
        <Button loading={busy} className="btn-primary w-full">{t("Sign up")}</Button>
        <p className="text-xs text-ink-mute">{t("By signing up you agree to our")} <Link className="underline" to="/terms">{t("Terms")}</Link> {t("and")} <Link className="underline" to="/privacy">{t("Privacy policy")}</Link>.</p>
        <p className="text-sm">{t("Already registered?")} <Link className="text-brand-700 underline" to="/login">{t("Log in")}</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const { t } = useT();
  const [sent, setSent] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const p = resetRequestSchema.safeParse({ email: new FormData(e.currentTarget).get("email") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    await supabase.auth.resetPasswordForEmail(p.data.email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false); setSent(true); // Same message whether or not the account exists.
  }
  return (
    <Shell title={t("Reset password")} sub={t("We will email you a reset link.")}>
      {sent ? <Alert kind="success">{t("If an account exists for that email, a reset link is on its way.")}</Alert> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert>{err}</Alert>}
          <TextInput label={t("Email")} name="email" type="email" autoComplete="email" required />
          <Button loading={busy} className="btn-primary w-full">{t("Send reset link")}</Button>
        </form>)}
      <Link to="/login" className="mt-4 inline-block text-sm text-brand-700 underline">{t("Back to log in")}</Link>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const { t } = useT();
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const p = newPasswordSchema.safeParse({ password: f.get("password"), confirm: f.get("confirm") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password: p.data.password });
    setBusy(false);
    if (error) return setErr(t("We could not update your password. The link may have expired; request a new one."));
    setOk(true); setTimeout(() => nav("/dashboard"), 1500);
  }
  if (!loading && !session) return <Shell title={t("Link expired")}><Alert>{t("This reset link is invalid or has expired.")}</Alert><Link to="/forgot-password" className="btn-primary mt-4 w-full">{t("Request a new link")}</Link></Shell>;
  return (
    <Shell title={t("Choose a new password")}>
      {ok ? <Alert kind="success">{t("Password updated. Redirecting…")}</Alert> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert>{err}</Alert>}
          <TextInput label={t("New password")} name="password" type="password" autoComplete="new-password" required />
          <TextInput label={t("Confirm password")} name="confirm" type="password" autoComplete="new-password" required />
          <Button loading={busy} className="btn-primary w-full">{t("Update password")}</Button>
        </form>)}
    </Shell>
  );
}
