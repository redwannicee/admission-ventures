import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useCountdown } from "@/hooks/useCountdown";
import { Alert, AsyncView, Badge, Button, EmptyState, ErrorState, Modal, PageHeader, PageLoader } from "@/components/ui";
import { ExamTimer } from "@/features/examinations/ExamTimer";
import { getMyResult, listMyQuizzes, saveAnswer, startQuiz, submitQuiz } from "@/features/examinations/api";
import { errorMessage } from "@/utils/messages";
import { formatDate, formatDuration, formatScore } from "@/utils/format";
import type { AttemptPayload } from "@/types/db";

export function QuizListPage() {
  const state = useAsync(listMyQuizzes, []);
  return (
    <>
      <PageHeader title="Exams" sub="Timed exams are scored on the server." />
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No exams available" hint="Exams for your courses will appear here." />}>
        {(d) => <div className="grid gap-4 md:grid-cols-2">{d.map((q) => {
          const left = q.max_attempts - q.attempts_used;
          const canStart = q.availability === "open" && (left > 0 || !!q.in_progress_attempt_id);
          return (
            <article key={q.quiz_id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="text-lg">{q.title}</h2><Badge tone={q.availability === "open" ? "green" : "gray"}>{q.availability.replace("_", " ")}</Badge></div>
              {q.course_title && <p className="text-xs text-ink-mute">{q.course_title}</p>}
              <p className="text-sm text-ink-soft">{q.question_count} questions · {formatDuration(q.duration_seconds)} · {formatScore(q.total_marks)} marks · pass {formatScore(q.pass_marks)}</p>
              <p className="text-xs text-ink-mute">Attempts {q.attempts_used}/{q.max_attempts}{q.best_score !== null ? ` · best ${formatScore(q.best_score)}` : ""}{q.closes_at ? ` · closes ${formatDate(q.closes_at, true)}` : ""}</p>
              <div className="mt-auto flex flex-wrap gap-2">
                {canStart && <Link to={`/exams/${q.quiz_id}/take`} className="btn-primary btn-sm">{q.in_progress_attempt_id ? "Resume exam" : "Start exam"}</Link>}
                {q.last_finished_attempt_id && <Link to={`/exams/result/${q.last_finished_attempt_id}`} className="btn-ghost btn-sm">Last result</Link>}
              </div>
            </article>);
        })}</div>}
      </AsyncView>
    </>
  );
}

export function QuizTakePage() {
  const { quizId = "" } = useParams();
  const nav = useNavigate();
  const state = useAsync(() => startQuiz(quizId), [quizId]);
  if (state.loading && !state.data) return <PageLoader />;
  if (state.error) return <div className="space-y-4"><ErrorState error={state.error} onRetry={state.reload} /><Link className="btn-ghost btn-sm" to="/exams">Back to exams</Link></div>;
  if (!state.data) return null;
  return <Attempt key={state.data.attempt_id} initial={state.data} onFinished={(id) => nav(`/exams/result/${id}`, { replace: true })} />;
}

type SaveState = "idle" | "saving" | "saved" | "error";
function Attempt({ initial, onFinished }: { initial: AttemptPayload; onFinished: (attemptId: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial.answers).map(([k, v]) => [k, v.key])));
  const [idx, setIdx] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const submitted = useRef(false);
  const serverNow = useRef(initial.server_now); // fixed: offset is computed once from the server clock
  const left = useCountdown(initial.deadline_at, serverNow.current);
  const q = initial.questions[idx];
  const answered = Object.keys(answers).length;

  const finish = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true; setSubmitting(true); setErr("");
    try { await submitQuiz(initial.attempt_id); onFinished(initial.attempt_id); }
    catch (e) {
      // If the server already closed the attempt (deadline), the result is still available.
      if (e instanceof Error && /attempt_closed/.test(e.message)) return onFinished(initial.attempt_id);
      submitted.current = false; setSubmitting(false); setErr(errorMessage(e));
    }
  }, [initial.attempt_id, onFinished]);

  // Auto-submit when time is up; the server enforces the same deadline regardless.
  useEffect(() => { if (left === 0) void finish(); }, [left, finish]);

  async function choose(key: string) {
    if (submitting || !q) return;
    const prev = answers[q.id];
    const clearing = prev === key; // tapping the chosen option again clears it
    setAnswers((a) => { const n = { ...a }; if (clearing) delete n[q.id]; else n[q.id] = key; return n; });
    setSave("saving");
    try { await saveAnswer(initial.attempt_id, q.id, clearing ? null : key); setSave("saved"); }
    catch (e) {
      setSave("error"); setErr(errorMessage(e));
      setAnswers((a) => { const n = { ...a }; if (prev) n[q.id] = prev; else delete n[q.id]; return n; });
      if (e instanceof Error && /deadline_passed|attempt_closed/.test(e.message)) void finish();
    }
  }

  if (!q) return <Alert>This exam has no questions.</Alert>;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0"><p className="truncate font-display text-lg">{initial.title}</p><p className="text-xs text-ink-mute">{answered}/{initial.questions.length} answered · <span aria-live="polite">{save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Not saved" : ""}</span></p></div>
        <ExamTimer secondsLeft={left} />
      </div>
      {left > 0 && left <= 300 && <div className="mb-4"><Alert kind="info">{left <= 60 ? "Less than a minute left. Your exam will be submitted automatically." : "Five minutes or less remaining."}</Alert></div>}
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <section className="card p-5" aria-labelledby="qtext">
        <p className="mb-1 text-xs text-ink-mute">Question {idx + 1} of {initial.questions.length} · {formatScore(q.marks)} mark{q.marks === 1 ? "" : "s"}{q.negative_marks > 0 ? ` · −${formatScore(q.negative_marks)} for a wrong answer` : ""}</p>
        <h2 id="qtext" className="mb-4 whitespace-pre-line font-sans text-lg font-medium leading-snug">{q.prompt}</h2>
        <div role="radiogroup" aria-labelledby="qtext" className="space-y-2">
          {q.options.map((o) => {
            const on = answers[q.id] === o.key;
            return (
              <button key={o.key} role="radio" aria-checked={on} disabled={submitting} onClick={() => choose(o.key)}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line bg-white hover:bg-brand-50"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${on ? "border-brand-700 bg-brand-700 text-white" : "border-line"}`}>{o.key}</span>{o.text}
              </button>);
          })}
        </div>
        <p className="mt-3 text-xs text-ink-mute">Tap a chosen option again to clear your answer.</p>
      </section>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button className="btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
        {idx < initial.questions.length - 1 ? <button className="btn-primary" onClick={() => setIdx(idx + 1)}>Next</button> : <button className="btn-accent" onClick={() => setConfirm(true)}>Finish exam</button>}
      </div>
      <nav className="mt-6" aria-label="Question navigator"><ul className="flex flex-wrap gap-2">{initial.questions.map((x, i) => (
        <li key={x.id}><button onClick={() => setIdx(i)} aria-label={`Question ${i + 1}${answers[x.id] ? ", answered" : ""}`} aria-current={i === idx}
          className={`h-9 w-9 rounded-lg border text-xs font-semibold ${i === idx ? "ring-2 ring-brand-600" : ""} ${answers[x.id] ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white"}`}>{i + 1}</button></li>))}</ul></nav>
      <div className="mt-6 text-center"><button className="btn-ghost btn-sm" onClick={() => setConfirm(true)}>Submit now</button></div>
      {confirm && (
        <Modal title="Submit your exam?" onClose={() => !submitting && setConfirm(false)}>
          <p className="text-sm text-ink-soft">You answered {answered} of {initial.questions.length} questions{answered < initial.questions.length ? `; ${initial.questions.length - answered} will count as unanswered` : ""}. You cannot change answers after submitting.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" disabled={submitting} onClick={() => setConfirm(false)}>Keep working</button><Button loading={submitting} className="btn-primary" onClick={finish}>Submit exam</Button></div>
        </Modal>)}
    </div>
  );
}

export function QuizResultPage() {
  const { attemptId = "" } = useParams();
  const state = useAsync(() => getMyResult(attemptId), [attemptId]);
  return (
    <AsyncView state={state}>
      {(r) => (
        <div className="mx-auto max-w-2xl">
          <PageHeader title={r.quiz_title} sub={r.status === "expired" ? "Time ran out; saved answers were scored." : undefined} />
          <div className="card grid grid-cols-2 gap-4 p-5 text-center sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-4"><p className="font-display text-5xl text-brand-800">{formatScore(r.score)}<span className="text-xl text-ink-mute"> / {formatScore(r.total_marks)}</span></p><div className="mt-2"><Badge tone={r.passed ? "green" : "red"}>{r.passed ? "Passed" : "Not passed"}</Badge> <span className="text-xs text-ink-mute">pass mark {formatScore(r.pass_marks)}</span></div></div>
            <Stat label="Correct" v={r.correct_count} /><Stat label="Wrong" v={r.wrong_count} /><Stat label="Unanswered" v={r.unanswered_count} />
          </div>
          {!r.review_available && <div className="mt-4"><Alert kind="info">{r.review_policy === "after_close" ? "The answer review will be released after the exam closes." : "Answer review is not available for this exam."}</Alert></div>}
          {r.review && <section className="mt-6 space-y-3" aria-label="Answer review">{r.review.map((it, i) => (
            <article key={it.question_id} className="card p-4">
              <p className="text-xs text-ink-mute">Question {i + 1} · {it.awarded_marks === null ? "0" : formatScore(it.awarded_marks)} / {formatScore(it.marks)}</p>
              <p className="mb-3 mt-1 whitespace-pre-line font-medium">{it.prompt}</p>
              <ul className="space-y-1.5">{it.options.map((o) => {
                const right = o.key === it.correct_answer.key, mine = o.key === it.selected_answer?.key;
                return <li key={o.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${right ? "border-brand-600 bg-brand-50" : mine ? "border-red-300 bg-red-50" : "border-line"}`}>
                  {right ? <Check className="h-4 w-4 text-brand-700" aria-label="Correct answer" /> : mine ? <X className="h-4 w-4 text-red-700" aria-label="Your answer" /> : <span className="w-4" />}<b>{o.key}.</b> {o.text}{mine && <span className="ml-auto text-xs text-ink-mute">your answer</span>}</li>;
              })}</ul>
              {!it.selected_answer && <p className="mt-2 text-xs text-ink-mute">Not answered</p>}
              {it.explanation && <p className="mt-3 rounded-lg bg-amber-soft p-3 text-sm text-ink-soft">{it.explanation}</p>}
            </article>))}</section>}
          <div className="mt-6"><Link to="/exams" className="btn-primary">Back to exams</Link></div>
        </div>)}
    </AsyncView>
  );
}
const Stat = ({ label, v }: { label: string; v: number }) => <div><p className="text-2xl font-semibold">{v}</p><p className="text-xs text-ink-mute">{label}</p></div>;
