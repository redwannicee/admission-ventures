import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import { useAuth } from "@/app/AuthProvider";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, PageHeader, ProgressBar, statusTone, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { myProgress } from "@/features/enrollments/api";
import { thumbnailUrl } from "@/features/courses/api";
import { myOrders } from "@/features/orders/api";
import { startPayment, goToGateway } from "@/features/payments/api";
import { firstIssue, newPasswordSchema, profileSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/utils/messages";
import { formatBDT, formatDate } from "@/utils/format";
import type { Announcement } from "@/types/db";
import { useT } from "@/i18n";

export function DashboardPage() {
  const { t } = useT();
  const { profile } = useAuth();
  const courses = useAsync(myProgress, []);
  const news = useAsync(async () => must(await supabase.from("announcements").select("id, course_id, title, body, published_at, created_at").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(3)) as Announcement[], []);
  return (
    <>
      <PageHeader title={profile?.full_name ? t("Hello, {name}", { name: profile.full_name.split(" ")[0] }) : t("Hello")} sub={t("Pick up where you left off.")} />
      {news.data && news.data.length > 0 && (
        <section className="mb-8 space-y-2" aria-label={t("Announcements")}>
          {news.data.map((a) => <div key={a.id} className="card flex gap-3 border-amber/60 bg-amber-soft p-4"><Megaphone className="h-5 w-5 shrink-0 text-amber-deep" aria-hidden /><div><p className="font-semibold">{a.title}</p><p className="text-sm text-ink-soft">{a.body}</p></div></div>)}
        </section>
      )}
      <h2 className="mb-3 text-xl">{t("My courses")}</h2>
      <AsyncView state={courses} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("You are not enrolled in any course yet")} hint={t("Browse the catalogue to get started.")} action={<Link to="/courses" className="btn-primary btn-sm">{t("Browse courses")}</Link>} />}>
        {(d) => <div className="grid gap-4 sm:grid-cols-2">{d.map((c) => {
          const pct = c.total_lessons ? (Number(c.completed_lessons) / Number(c.total_lessons)) * 100 : 0;
          const img = thumbnailUrl(c.thumbnail_path);
          return (
            <Link key={c.course_id} to={`/learn/${c.slug}`} className="card flex flex-col gap-3 overflow-hidden p-0 transition hover:-translate-y-0.5">
              {img && <img src={img} alt="" loading="lazy" className="aspect-[16/7] w-full object-cover" />}
              <div className="space-y-2 p-4">
                <h3 className="text-lg">{c.title}</h3>
                <ProgressBar value={pct} label={t("{title} progress", { title: c.title })} />
                <p className="text-xs text-ink-mute">{t("{a} of {b} lessons complete", { a: c.completed_lessons, b: c.total_lessons })}{c.expires_at ? ` · ${t("access until {d}", { d: formatDate(c.expires_at) })}` : ""}</p>
              </div>
            </Link>);
        })}</div>}
      </AsyncView>
    </>
  );
}

export function OrdersPage() {
  const { t } = useT();
  const state = useAsync(myOrders, []);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  async function pay(id: string) {
    if (busy) return;
    setBusy(id);
    try { const r = await startPayment(id); goToGateway(r.gateway_url); } catch (e) { toast("error", errorMessage(e)); setBusy(null); }
  }
  return (
    <>
      <PageHeader title={t("Orders & payments")} />
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No orders yet")} hint={t("Your purchases will appear here.")} />}>
        {(d) => <div className="space-y-3">{d.map((o) => {
          const payable = o.status === "pending" && (!o.expires_at || new Date(o.expires_at) > new Date()) && o.total_amount > 0;
          return (
            <article key={o.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-mono text-sm">{o.order_reference}</p><p className="text-xs text-ink-mute">{formatDate(o.created_at, true)}</p></div>
                <div className="flex items-center gap-3"><Badge tone={statusTone(o.status) as "green"}>{t(o.status)}</Badge><span className="font-semibold">{formatBDT(o.total_amount)}</span></div>
              </div>
              <ul className="mt-2 text-sm text-ink-soft">{o.order_items?.map((i) => <li key={i.id}>{i.item_title_snapshot}</li>)}</ul>
              {payable && <Button className="btn-accent btn-sm mt-3" loading={busy === o.id} onClick={() => pay(o.id)}>{t("Pay now")}</Button>}
            </article>);
        })}</div>}
      </AsyncView>
    </>
  );
}

export function ProfilePage() {
  const { t } = useT();
  const { profile, session, refreshProfile } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false); const [pwErr, setPwErr] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !profile) return;
    const f = new FormData(e.currentTarget);
    const p = profileSchema.safeParse({ full_name: f.get("full_name"), phone: f.get("phone") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    const { error } = await supabase.from("profiles").update({ full_name: p.data.full_name, phone: p.data.phone }).eq("id", profile.id);
    setBusy(false);
    if (error) return setErr(/duplicate|unique/i.test(error.message) ? t("That mobile number is already used by another account.") : errorMessage(new Error(error.message)));
    await refreshProfile(); toast("success", t("Profile updated"));
  }
  async function changePw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pwBusy) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const p = newPasswordSchema.safeParse({ password: f.get("password"), confirm: f.get("confirm") });
    if (!p.success) return setPwErr(firstIssue(p.error));
    setPwBusy(true); setPwErr("");
    const { error } = await supabase.auth.updateUser({ password: p.data.password });
    setPwBusy(false);
    if (error) return setPwErr(t("Could not change the password. Please log in again and retry."));
    form.reset(); toast("success", t("Password changed"));
  }
  if (!profile) return null;
  return (
    <>
      <PageHeader title={t("Profile")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="card space-y-4 p-5" noValidate>
          <h2 className="text-lg">{t("Your details")}</h2>
          {err && <Alert>{err}</Alert>}
          <TextInput label={t("Email")} value={session?.user.email ?? ""} readOnly disabled />
          <TextInput label={t("Full name")} name="full_name" defaultValue={profile.full_name ?? ""} required />
          <TextInput label={t("Mobile number")} name="phone" type="tel" defaultValue={profile.phone ?? ""} placeholder="01712345678" required />
          <Button loading={busy}>{t("Save changes")}</Button>
        </form>
        <form onSubmit={changePw} className="card space-y-4 p-5" noValidate>
          <h2 className="text-lg">{t("Change password")}</h2>
          {pwErr && <Alert>{pwErr}</Alert>}
          <TextInput label={t("New password")} name="password" type="password" autoComplete="new-password" required />
          <TextInput label={t("Confirm new password")} name="confirm" type="password" autoComplete="new-password" required />
          <Button loading={pwBusy}>{t("Update password")}</Button>
        </form>
      </div>
    </>
  );
}
