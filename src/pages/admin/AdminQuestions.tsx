import { type FormEvent, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, Pagination, Select, statusTone, TextArea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { getAnswerKey, listCategories, listQuestions, saveQuestion } from "@/features/question-bank/api";
import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import { firstIssue, questionSchema } from "@/lib/validation/schemas";
import { errorMessage } from "@/utils/messages";
import { slugify } from "@/utils/format";
import type { Category, Question } from "@/types/db";
import { useT } from "@/i18n";

const SIZE = 15;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function QuestionForm({ q, cats, onClose, onSaved }: { q: Question | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const key = useAsync(async () => (q ? await getAnswerKey(q.id) : "A"), [q?.id]);
  const [texts, setTexts] = useState<string[]>(() => (q ? q.options.map((o) => o.text) : ["", "", "", ""]));
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const options = texts.map((x, i) => ({ key: LETTERS[i], text: x }));
    const p = questionSchema.safeParse({ prompt: f.get("prompt"), options, correct: f.get("correct"), explanation: f.get("explanation"), difficulty: f.get("difficulty"), status: f.get("status"), category_id: f.get("category_id") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    try { await saveQuestion(q?.id ?? null, { ...p.data, explanation: p.data.explanation ?? "", category_id: p.data.category_id ?? "" }); toast("success", t("Question saved")); onSaved(); onClose(); }
    catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  return (
    <Modal title={q ? t("Edit question") : t("New question")} onClose={onClose}>
      {key.loading ? <p className="text-sm text-ink-mute">{t("Loading…")}</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert>{err}</Alert>}
          <TextArea label={t("Question")} name="prompt" defaultValue={q?.prompt ?? ""} required />
          <fieldset className="space-y-2"><legend className="label">{t("Options (select the correct one)")}</legend>
            {texts.map((txt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" value={LETTERS[i]} defaultChecked={(key.data ?? "A") === LETTERS[i]} aria-label={t("Option {l} is correct", { l: LETTERS[i] })} className="h-4 w-4" />
                <span className="w-5 text-sm font-semibold">{LETTERS[i]}</span>
                <input className="input" aria-label={t("Option {l} text", { l: LETTERS[i] })} value={txt} onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>))}
            <div className="flex gap-2">
              {texts.length < 6 && <button type="button" className="btn-ghost btn-sm" onClick={() => setTexts([...texts, ""])}>{t("Add option")}</button>}
              {texts.length > 2 && !q && <button type="button" className="btn-ghost btn-sm" onClick={() => setTexts(texts.slice(0, -1))}>{t("Remove last")}</button>}
            </div>
          </fieldset>
          <TextArea label={t("Explanation (shown in the answer review)")} name="explanation" defaultValue={q?.explanation ?? ""} rows={2} />
          <div className="grid grid-cols-3 gap-3">
            <Select label={t("Difficulty")} name="difficulty" defaultValue={q?.difficulty ?? "medium"}><option>{t("easy")}</option><option>{t("medium")}</option><option>{t("hard")}</option></Select>
            <Select label={t("Status")} name="status" defaultValue={q?.status ?? "draft"}><option>{t("draft")}</option><option>{t("published")}</option><option>{t("archived")}</option></Select>
            <Select label={t("Category")} name="category_id" defaultValue={q?.category_id ?? ""}><option value="">{t("None")}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t("Cancel")}</button><Button loading={busy}>{t("Save")}</Button></div>
        </form>)}
    </Modal>
  );
}

export default function AdminQuestions() {
  const { t } = useT();
  const toast = useToast();
  const cats = useAsync(listCategories, []);
  const [search, setSearch] = useState(""); const [term, setTerm] = useState(""); const [cat, setCat] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Question | "new" | null>(null);
  const state = useAsync(() => listQuestions({ search: term, categoryId: cat, status, page, size: SIZE }), [term, cat, status, page]);
  async function addCategory() {
    const name = window.prompt(t("New category name"))?.trim();
    if (!name) return;
    try { must(await supabase.from("question_categories").insert({ name, slug: slugify(name) || `cat-${Date.now()}` })); cats.reload(); toast("success", t("Category added")); } catch (e) { toast("error", errorMessage(e)); }
  }
  return (
    <>
      <PageHeader title={t("Question bank")} actions={<><button className="btn-ghost btn-sm" onClick={addCategory}>{t("Add category")}</button><button className="btn-primary btn-sm" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />{t("New question")}</button></>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <form className="relative" role="search" onSubmit={(e) => { e.preventDefault(); setPage(0); setTerm(search.trim()); }}><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-mute" aria-hidden /><input className="input pl-9" type="search" aria-label={t("Search questions")} placeholder={t("Search question text")} value={search} onChange={(e) => setSearch(e.target.value)} /></form>
        <select className="input" aria-label={t("Category")} value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}><option value="">{t("All categories")}</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input" aria-label={t("Status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">{t("Any status")}</option><option>{t("draft")}</option><option>{t("published")}</option><option>{t("archived")}</option></select>
      </div>
      <AsyncView state={state} isEmpty={(d) => d.rows.length === 0} empty={<EmptyState title={t("No questions found")} action={<button className="btn-primary btn-sm" onClick={() => setEdit("new")}>{t("Add a question")}</button>} />}>
        {(d) => <>
          <div className="table-wrap"><table className="table"><thead><tr><th>{t("Question")}</th><th>{t("Difficulty")}</th><th>{t("Status")}</th><th className="text-right"> </th></tr></thead><tbody>
            {d.rows.map((r) => <tr key={r.id}><td className="max-w-md"><p className="line-clamp-2">{r.prompt}</p></td><td>{r.difficulty}</td><td><Badge tone={statusTone(r.status) as "green"}>{r.status}</Badge></td><td className="text-right"><button className="btn-ghost btn-sm" onClick={() => setEdit(r)}>{t("Edit")}</button></td></tr>)}
          </tbody></table></div>
          <Pagination page={page} pageSize={SIZE} total={d.total} onPage={setPage} />
        </>}
      </AsyncView>
      {edit && <QuestionForm q={edit === "new" ? null : edit} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={state.reload} />}
    </>
  );
}
