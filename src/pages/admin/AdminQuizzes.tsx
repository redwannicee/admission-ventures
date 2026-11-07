import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { adminListCourses } from "@/features/courses/api";
import { adminListQuizzes, adminQuizQuestions } from "@/features/examinations/api";
import { listQuestions } from "@/features/question-bank/api";
import { errorMessage } from "@/utils/messages";
import { formatDuration, formatScore, fromLocalInput, toLocalInput } from "@/utils/format";
import type { Quiz, ReviewPolicy } from "@/types/db";
import { useT } from "@/i18n";

function QuizForm({ quiz, onClose, onSaved }: { quiz: Quiz | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const courses = useAsync(adminListCourses, []);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    const minutes = Number(f.get("minutes"));
    if (title.length < 2) return setErr(t("Enter an exam title."));
    if (!(minutes >= 1 && minutes <= 600)) return setErr(t("Duration must be between 1 and 600 minutes."));
    const opens = fromLocalInput(String(f.get("opens_at") ?? "")), closes = fromLocalInput(String(f.get("closes_at") ?? ""));
    if (opens && closes && closes <= opens) return setErr(t("The closing time must be after the opening time."));
    const row = {
      title, description: String(f.get("description") ?? "").trim() || null, course_id: String(f.get("course_id") ?? "") || null,
      duration_seconds: Math.round(minutes * 60), pass_marks: Number(f.get("pass_marks")) || 0, negative_mark: Number(f.get("negative_mark")) || 0,
      max_attempts: Math.max(1, Number(f.get("max_attempts")) || 1), opens_at: opens, closes_at: closes,
      review_policy: String(f.get("review_policy")) as ReviewPolicy, published: f.get("published") === "on",
    };
    setBusy(true); setErr("");
    try {
      if (quiz) must(await supabase.from("quizzes").update(row).eq("id", quiz.id));
      else must(await supabase.from("quizzes").insert({ ...row, total_marks: 0, pass_marks: 0, published: false }));
      toast("success", quiz ? t("Exam saved") : t("Exam created. Add questions, then publish.")); onSaved(); onClose();
    } catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  return (
    <Modal title={quiz ? t("Edit exam") : t("New exam")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <TextInput label={t("Title")} name="title" defaultValue={quiz?.title ?? ""} required />
        <TextArea label={t("Description")} name="description" defaultValue={quiz?.description ?? ""} rows={2} />
        <Select label={t("Course (empty = open to every signed-in student)")} name="course_id" defaultValue={quiz?.course_id ?? ""}><option value="">{t("Open exam")}</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t("Duration (minutes)")} name="minutes" type="number" min={1} defaultValue={quiz ? quiz.duration_seconds / 60 : 30} required />
          <TextInput label={t("Max attempts")} name="max_attempts" type="number" min={1} defaultValue={quiz?.max_attempts ?? 1} />
          {quiz && <TextInput label={t("Pass marks")} name="pass_marks" type="number" min={0} step="0.25" defaultValue={quiz.pass_marks} hint={t("Total marks: {m}", { m: formatScore(quiz.total_marks) })} />}
          <TextInput label={t("Default negative mark")} name="negative_mark" type="number" min={0} step="0.05" defaultValue={quiz?.negative_mark ?? 0} hint={t("Applied when adding questions.")} />
          <TextInput label={t("Opens at")} name="opens_at" type="datetime-local" defaultValue={toLocalInput(quiz?.opens_at ?? null)} />
          <TextInput label={t("Closes at")} name="closes_at" type="datetime-local" defaultValue={toLocalInput(quiz?.closes_at ?? null)} />
        </div>
        <Select label={t("Answer review")} name="review_policy" defaultValue={quiz?.review_policy ?? "after_submit"}><option value="after_submit">{t("Show right after submitting")}</option><option value="after_close">{t("Show after the exam closes")}</option><option value="never">{t("Never show answers")}</option></Select>
        {quiz && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={quiz.published} className="h-4 w-4" />{t("Published (needs at least one question)")}</label>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t("Cancel")}</button><Button loading={busy}>{t("Save")}</Button></div>
      </form>
    </Modal>
  );
}

function QuestionsModal({ quiz, onClose, onChanged }: { quiz: Quiz; onClose: () => void; onChanged: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const attached = useAsync(() => adminQuizQuestions(quiz.id), [quiz.id]);
  const [search, setSearch] = useState("");
  const pool = useAsync(() => listQuestions({ search, categoryId: "", status: "published", page: 0, size: 20 }), [search]);
  const [busy, setBusy] = useState<string | null>(null);
  const ids = new Set(attached.data?.map((a) => a.question_id));
  async function add(questionId: string) {
    if (busy) return; setBusy(questionId);
    try {
      must(await supabase.from("quiz_questions").insert({ quiz_id: quiz.id, question_id: questionId, marks: 1, negative_marks: quiz.negative_mark, position: (attached.data?.length ?? 0) + 1 }));
      attached.reload(); onChanged();
    } catch (e) { toast("error", errorMessage(e)); } finally { setBusy(null); }
  }
  async function remove(rowId: string) {
    if (busy) return; setBusy(rowId);
    try { must(await supabase.from("quiz_questions").delete().eq("id", rowId)); attached.reload(); onChanged(); } catch (e) { toast("error", errorMessage(e)); } finally { setBusy(null); }
  }
  async function patch(rowId: string, field: "marks" | "negative_marks", v: number) {
    try { must(await supabase.from("quiz_questions").update({ [field]: v }).eq("id", rowId)); attached.reload(); onChanged(); } catch (e) { toast("error", errorMessage(e)); attached.reload(); }
  }
  return (
    <Modal title={t("Questions: {title}", { title: quiz.title })} onClose={onClose}>
      <h3 className="mb-2 text-sm font-semibold">{t("In this exam")}</h3>
      <AsyncView state={attached} isEmpty={(d) => d.length === 0} empty={<p className="text-sm text-ink-mute">{t("No questions yet.")}</p>}>
        {(d) => <ul className="space-y-2">{d.map((r, i) => (
          <li key={r.id} className="rounded-lg border border-line p-2 text-sm">
            <p className="line-clamp-2">{i + 1}. {r.questions?.prompt}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label>{t("Marks")} <input className="input ml-1 inline-block min-h-[32px] w-20 py-0.5" type="number" min={0.25} step={0.25} defaultValue={r.marks} onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== r.marks) void patch(r.id, "marks", v); }} /></label>
              <label>{t("Negative")} <input className="input ml-1 inline-block min-h-[32px] w-20 py-0.5" type="number" min={0} step={0.05} defaultValue={r.negative_marks} onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== r.negative_marks) void patch(r.id, "negative_marks", v); }} /></label>
              <button className="btn-ghost btn-sm" disabled={busy === r.id} onClick={() => remove(r.id)}>{t("Remove")}</button>
            </div>
          </li>))}</ul>}
      </AsyncView>
      <h3 className="mb-2 mt-5 text-sm font-semibold">{t("Add from the question bank (published only)")}</h3>
      <input className="input mb-2" type="search" aria-label={t("Search the question bank")} placeholder={t("Search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      <AsyncView state={pool} isEmpty={(d) => d.rows.length === 0} empty={<p className="text-sm text-ink-mute">{t("No published questions match.")}</p>}>
        {(d) => <ul className="space-y-1">{d.rows.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 text-sm"><span className="line-clamp-1">{r.prompt}</span>{ids.has(r.id) ? <Badge tone="green">{t("added")}</Badge> : <button className="btn-ghost btn-sm" disabled={busy === r.id} onClick={() => add(r.id)}>{t("Add")}</button>}</li>)}</ul>}
      </AsyncView>
    </Modal>
  );
}

export default function AdminQuizzes() {
  const { t } = useT();
  const state = useAsync(adminListQuizzes, []);
  const [edit, setEdit] = useState<Quiz | "new" | null>(null);
  const [qs, setQs] = useState<Quiz | null>(null);
  return (
    <>
      <PageHeader title={t("Exams")} actions={<button className="btn-primary btn-sm" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />{t("New exam")}</button>} />
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t("No exams yet")} hint={t("Create an exam, add questions from the bank, then publish it.")} />}>
        {(d) => <div className="table-wrap"><table className="table"><thead><tr><th>{t("Exam")}</th><th>{t("Duration")}</th><th>{t("Marks / pass")}</th><th>{t("Attempts")}</th><th>{t("Status")}</th><th className="text-right"> </th></tr></thead><tbody>
          {d.map((q) => <tr key={q.id}><td className="font-medium">{q.title}</td><td>{formatDuration(q.duration_seconds)}</td><td>{formatScore(q.total_marks)} / {formatScore(q.pass_marks)}</td><td>{q.max_attempts}</td><td><Badge tone={q.published ? "green" : "amber"}>{q.published ? t("published") : t("draft")}</Badge></td>
            <td><div className="flex justify-end gap-1.5"><button className="btn-ghost btn-sm" onClick={() => setQs(q)}>{t("Questions")}</button><button className="btn-ghost btn-sm" onClick={() => setEdit(q)}>{t("Edit")}</button></div></td></tr>)}
        </tbody></table></div>}
      </AsyncView>
      {edit && <QuizForm quiz={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={state.reload} />}
      {qs && <QuestionsModal quiz={qs} onClose={() => setQs(null)} onChanged={state.reload} />}
    </>
  );
}
