import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Circle, Download, Lock } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, PageHeader, PageLoader, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { getCourseBySlug, getSyllabus } from "@/features/courses/api";
import { amEnrolled } from "@/features/enrollments/api";
import { getProtectedLesson, listProgress, saveProgress } from "@/features/lessons/api";
import { errorMessage } from "@/utils/messages";
import { formatDuration } from "@/utils/format";

export function CoursePlayerHome() {
  const { slug = "" } = useParams();
  const state = useAsync(async () => {
    const course = await getCourseBySlug(slug);
    if (!course) return null;
    const [syl, enrolled] = await Promise.all([getSyllabus(course.id), amEnrolled(course.id)]);
    const progress = await listProgress(syl.lessons.map((l) => l.id));
    return { course, syl, enrolled, progress };
  }, [slug]);
  return (
    <AsyncView state={state} isEmpty={(d) => d === null} empty={<EmptyState title="Course not found" action={<Link className="btn-primary btn-sm" to="/dashboard">Back to dashboard</Link>} />}>
      {(d) => {
        if (!d) return null;
        const { course, syl, enrolled, progress } = d;
        const done = syl.lessons.filter((l) => progress[l.id]?.completed).length;
        return (
          <>
            <PageHeader title={course.title} sub={enrolled ? `${done} of ${syl.lessons.length} lessons complete` : undefined} />
            {!enrolled && <div className="mb-4"><Alert kind="info">You are not enrolled in this course. Only free preview lessons are available. <Link className="font-semibold underline" to={`/courses/${course.slug}`}>View course</Link></Alert></div>}
            {enrolled && <div className="mb-6 max-w-md"><ProgressBar value={syl.lessons.length ? (done / syl.lessons.length) * 100 : 0} label="Course progress" /></div>}
            {syl.modules.length === 0 ? <EmptyState title="No lessons yet" hint="Content will appear here when it is published." /> : (
              <div className="space-y-4">{syl.modules.map((m) => (
                <section key={m.id} className="card p-4">
                  <h2 className="text-lg">{m.title}</h2>
                  <ul className="mt-2 divide-y divide-line">{syl.lessons.filter((l) => l.module_id === m.id).map((l) => {
                    const open = enrolled || l.is_free_preview;
                    const row = (<><span className="flex items-center gap-2">{progress[l.id]?.completed ? <CheckCircle2 className="h-5 w-5 text-brand-600" aria-label="Completed" /> : open ? <Circle className="h-5 w-5 text-ink-mute" aria-hidden /> : <Lock className="h-5 w-5 text-ink-mute" aria-label="Locked" />}{l.title}</span><span className="flex items-center gap-2 text-xs text-ink-mute">{l.is_free_preview && <Badge tone="green">Preview</Badge>}{formatDuration(l.duration_seconds)}</span></>);
                    return <li key={l.id}>{open ? <Link className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm hover:text-brand-700" to={`/learn/${course.slug}/lessons/${l.id}`}>{row}</Link> : <div className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm text-ink-mute">{row}</div>}</li>;
                  })}</ul>
                </section>))}</div>)}
          </>
        );
      }}
    </AsyncView>
  );
}

export function LessonPage() {
  const { slug = "", lessonId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [doneLocal, setDoneLocal] = useState<boolean | null>(null);
  const started = useRef(false);

  const state = useAsync(async () => {
    const course = await getCourseBySlug(slug);
    if (!course) return null;
    const syl = await getSyllabus(course.id);
    const lesson = await getProtectedLesson(lessonId); // access is decided on the server
    const progress = await listProgress(syl.lessons.map((l) => l.id));
    return { course, syl, lesson, progress };
  }, [slug, lessonId]);

  useEffect(() => { setDoneLocal(null); started.current = false; }, [lessonId]);
  // Record that the lesson was opened (position 0) once, without un-completing a finished lesson.
  useEffect(() => {
    if (state.data && !started.current) { started.current = true; void saveProgress(lessonId, false, 0).catch(() => undefined); }
  }, [state.data, lessonId]);

  if (state.loading && !state.data) return <PageLoader />;
  if (state.error) {
    const msg = errorMessage(state.error);
    return <div className="space-y-4"><Alert>{msg}</Alert><Link className="btn-ghost btn-sm" to={`/learn/${slug}`}>Back to course</Link></div>;
  }
  if (!state.data) return <EmptyState title="Lesson not found" />;
  const { course, syl, lesson, progress } = state.data;
  const order = syl.modules.flatMap((m) => syl.lessons.filter((l) => l.module_id === m.id));
  const idx = order.findIndex((l) => l.id === lessonId);
  const next = idx >= 0 ? order[idx + 1] : undefined;
  const completed = doneLocal ?? progress[lessonId]?.completed ?? false;

  async function toggle() {
    if (saving) return;
    setSaving(true);
    try { await saveProgress(lessonId, !completed, 0); setDoneLocal(!completed); if (!completed) toast("success", "Lesson marked complete"); }
    catch (e) { toast("error", errorMessage(e)); } finally { setSaving(false); }
  }
  return (
    <>
      <p className="mb-2 text-sm"><Link className="text-brand-700 underline" to={`/learn/${course.slug}`}>← {course.title}</Link></p>
      <h1 className="text-2xl sm:text-3xl">{lesson.title}</h1>
      <div className="mt-4 overflow-hidden rounded-2xl bg-ink shadow-card">
        {lesson.video_embed_url
          ? <iframe title={lesson.title} src={lesson.video_embed_url} className="aspect-video w-full" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          : <div className="flex aspect-video items-center justify-center text-sm text-white/70">No video for this lesson.</div>}
      </div>
      {lesson.description && <p className="mt-4 whitespace-pre-line text-ink-soft">{lesson.description}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button loading={saving} className={completed ? "btn-ghost" : "btn-primary"} onClick={toggle}>{completed ? <><CheckCircle2 className="h-4 w-4 text-brand-600" />Completed (undo)</> : "Mark as complete"}</Button>
        {lesson.material_url && <a className="btn-ghost" href={lesson.material_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" />Download material (PDF)</a>}
        {next && <button className="btn-accent" onClick={() => nav(`/learn/${course.slug}/lessons/${next.id}`)}>Next lesson</button>}
      </div>
    </>
  );
}
