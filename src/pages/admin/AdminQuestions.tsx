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

const SIZE = 15;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function QuestionForm({ q, cats, onClose, onSaved }: { q: Question | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const key = useAsync(async () => (q ? await getAnswerKey(q.id) : "A"), [q?.id]);
  const [texts, setTexts] = useState<string[]>(() => (q ? q.options.map((o) => o.text) : ["", "", "", ""]));
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const options = texts.map((t, i) => ({ key: LETTERS[i], text: t }));
    const p = questionSchema.safeParse({ prompt: f.get("prompt"), options, correct: f.get("correct"), explanation: f.get("explanation"), difficulty: f.get("difficulty"), status: f.get("status"), category_id: f.get("category_id") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    try { await saveQuestion(q?.id ?? null, { ...p.data, explanation: p.data.explanation ?? "", category_id: p.data.category_id ?? "" }); toast("success", "Question saved"); onSaved(); onClose(); }
    catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  return (
    <Modal title={q ? "Edit question" : "New question"} onClose={onClose}>
      {key.loading ? <p className="text-sm text-ink-mute">Loading…</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert>{err}</Alert>}
          <TextArea label="Question" name="prompt" defaultValue={q?.prompt ?? ""} required />
          <fieldset className="space-y-2"><legend className="label">Options (select the correct one)</legend>
            {texts.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" value={LETTERS[i]} defaultChecked={(key.data ?? "A") === LETTERS[i]} aria-label={`Option ${LETTERS[i]} is correct`} className="h-4 w-4" />
                <span className="w-5 text-sm font-semibold">{LETTERS[i]}</span>
                <input className="input" aria-label={`Option ${LETTERS[i]} text`} value={t} onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>))}
            <div className="flex gap-2">
              {texts.length < 6 && <button type="button" className="btn-ghost btn-sm" onClick={() => setTexts([...texts, ""])}>Add option</button>}
              {texts.length > 2 && !q && <button type="button" className="btn-ghost btn-sm" onClick={() => setTexts(texts.slice(0, -1))}>Remove last</button>}
            </div>
          </fieldset>
          <TextArea label="Explanation (shown in the answer review)" name="explanation" defaultValue={q?.explanation ?? ""} rows={2} />
          <div className="grid grid-cols-3 gap-3">
            <Select label="Difficulty" name="difficulty" defaultValue={q?.difficulty ?? "medium"}><option>easy</option><option>medium</option><option>hard</option></Select>
            <Select label="Status" name="status" defaultValue={q?.status ?? "draft"}><option>draft</option><option>published</option><option>archived</option></Select>
            <Select label="Category" name="category_id" defaultValue={q?.category_id ?? ""}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy}>Save</Button></div>
        </form>)}
    </Modal>
  );
}

export default function AdminQuestions() {
  const toast = useToast();
  const cats = useAsync(listCategories, []);
  const [search, setSearch] = useState(""); const [term, setTerm] = useState(""); const [cat, setCat] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Question | "new" | null>(null);
  const state = useAsync(() => listQuestions({ search: term, categoryId: cat, status, page, size: SIZE }), [term, cat, status, page]);
  async function addCategory() {
    const name = window.prompt("New category name")?.trim();
    if (!name) return;
    try { must(await supabase.from("question_categories").insert({ name, slug: slugify(name) || `cat-${Date.now()}` })); cats.reload(); toast("success", "Category added"); } catch (e) { toast("error", errorMessage(e)); }
  }
  return (
    <>
      <PageHeader title="Question bank" actions={<><button className="btn-ghost btn-sm" onClick={addCategory}>Add category</button><button className="btn-primary btn-sm" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New question</button></>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <form className="relative" role="search" onSubmit={(e) => { e.preventDefault(); setPage(0); setTerm(search.trim()); }}><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-mute" aria-hidden /><input className="input pl-9" type="search" aria-label="Search questions" placeholder="Search question text" value={search} onChange={(e) => setSearch(e.target.value)} /></form>
        <select className="input" aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">Any status</option><option>draft</option><option>published</option><option>archived</option></select>
      </div>
      <AsyncView state={state} isEmpty={(d) => d.rows.length === 0} empty={<EmptyState title="No questions found" action={<button className="btn-primary btn-sm" onClick={() => setEdit("new")}>Add a question</button>} />}>
        {(d) => <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Question</th><th>Difficulty</th><th>Status</th><th className="text-right"> </th></tr></thead><tbody>
            {d.rows.map((r) => <tr key={r.id}><td className="max-w-md"><p className="line-clamp-2">{r.prompt}</p></td><td>{r.difficulty}</td><td><Badge tone={statusTone(r.status) as "green"}>{r.status}</Badge></td><td className="text-right"><button className="btn-ghost btn-sm" onClick={() => setEdit(r)}>Edit</button></td></tr>)}
          </tbody></table></div>
          <Pagination page={page} pageSize={SIZE} total={d.total} onPage={setPage} />
        </>}
      </AsyncView>
      {edit && <QuestionForm q={edit === "new" ? null : edit} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={state.reload} />}
    </>
  );
}
