import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, TextArea, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/utils/messages";
import { formatDate } from "@/utils/format";
import type { Announcement } from "@/types/db";
import { useT } from "@/i18n";

export default function AdminAnnouncements() {
  const { t } = useT();
  const toast = useToast();
  const state = useAsync(async () => must(await supabase.from("announcements").select("id, course_id, title, body, published_at, created_at").order("created_at", { ascending: false }).limit(100)) as Announcement[], []);
  const [open, setOpen] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim(), body = String(f.get("body") ?? "").trim();
    if (title.length < 3 || body.length < 3) return setErr(t("Enter a title and a message."));
    setBusy(true); setErr("");
    try { must(await supabase.from("announcements").insert({ title, body, published_at: f.get("publish") === "on" ? new Date().toISOString() : null })); toast("success", t("Saved")); setOpen(false); state.reload(); }
    catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  async function toggle(a: Announcement) {
    try { must(await supabase.from("announcements").update({ published_at: a.published_at ? null : new Date().toISOString() }).eq("id", a.id)); state.reload(); } catch (e) { toast("error", errorMessage(e)); }
  }
  async function del(a: Announcement) {
    if (!window.confirm(t("Delete “{title}”?", { title: a.title }))) return;
    try { must(await supabase.from("announcements").delete().eq("id", a.id)); state.reload(); } catch (e) { toast("error", errorMessage(e)); }
  }
  return (
    <>
      <PageHeader title={t("Announcements")} actions={<button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t("New")}</button>} />
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No announcements")} />}>
        {(d) => <div className="space-y-3">{d.map((a) => <article key={a.id} className="card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg">{a.title}</h2><Badge tone={a.published_at ? "green" : "amber"}>{a.published_at ? t("live since {d}", { d: formatDate(a.published_at) }) : t("draft")}</Badge></div><p className="mt-1 text-sm text-ink-soft">{a.body}</p><div className="mt-3 flex gap-2"><button className="btn-ghost btn-sm" onClick={() => toggle(a)}>{a.published_at ? t("Unpublish") : t("Publish now")}</button><button className="btn-ghost btn-sm" onClick={() => del(a)}>{t("Delete")}</button></div></article>)}</div>}
      </AsyncView>
      {open && <Modal title={t("New announcement")} onClose={() => setOpen(false)}><form onSubmit={submit} className="space-y-4" noValidate>{err && <Alert>{err}</Alert>}<TextInput label={t("Title")} name="title" required /><TextArea label={t("Message")} name="body" required /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked className="h-4 w-4" />{t("Publish immediately")}</label><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("Cancel")}</button><Button loading={busy}>{t("Save")}</Button></div></form></Modal>}
    </>
  );
}
