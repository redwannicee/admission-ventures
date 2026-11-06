import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, TextArea, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { getCourseById, getSyllabus } from "@/features/courses/api";
import { adminGetLesson, uploadMaterial } from "@/features/lessons/api";
import { errorMessage } from "@/utils/messages";
import { formatDuration, parseYouTubeId } from "@/utils/format";
import type { CourseModule, LessonSummary } from "@/types/db";

function ModuleForm({ courseId, mod, nextPos, onClose, onSaved }: { courseId: string; mod: CourseModule | null; nextPos: number; onClose: () => void; onSaved: () => void }) {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (title.length < 2) return setErr("Enter a module title.");
    const row = { title, description: String(f.get("description") ?? "").trim() || null, position: Number(f.get("position")) || nextPos, published: f.get("published") === "on" };
    setBusy(true); setErr("");
    try {
      if (mod) must(await supabase.from("course_modules").update(row).eq("id", mod.id));
      else must(await supabase.from("course_modules").insert({ ...row, course_id: courseId }));
      onSaved(); onClose();
    } catch (er) { setErr(errorMessage(er)); } finally { setBusy(false); }
  }
  return (
    <Modal title={mod ? "Edit module" : "New module"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <TextInput label="Title" name="title" defaultValue={mod?.title ?? ""} required />
        <TextArea label="Description" name="description" defaultValue={mod?.description ?? ""} rows={2} />
        <TextInput label="Position" name="position" type="number" min={1} defaultValue={mod?.position ?? nextPos} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={mod?.published ?? false} className="h-4 w-4" />Published (visible to students)</label>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

function LessonForm({ courseId, moduleId, lesson, nextPos, onClose, onSaved }: { courseId: string; moduleId: string; lesson: LessonSummary | null; nextPos: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const prot = useAsync(async () => (lesson ? await adminGetLesson(lesson.id) : null), [lesson?.id]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (title.length < 2) return setErr("Enter a lesson title.");
    const rawVideo = String(f.get("video") ?? "").trim();
    let provider: string | null = null, ref: string | null = null;
    if (rawVideo) {
      const id = parseYouTubeId(rawVideo);
      if (!id) return setErr("Enter a valid YouTube link or 11-character video ID (use an Unlisted video).");
      provider = "youtube"; ref = id;
    }
    setBusy(true); setErr("");
    try {
      const file = f.get("material") as File | null;
      let material = prot.data?.material_path ?? null;
      if (file && file.size > 0) material = await uploadMaterial(courseId, file);
      if (f.get("remove_material") === "on") material = null;
      const mins = Number(f.get("minutes"));
      const row = {
        title, description: String(f.get("description") ?? "").trim() || null, video_provider: provider, video_ref: ref, material_path: material,
        duration_seconds: Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60) : null, position: Number(f.get("position")) || nextPos,
        is_free_preview: f.get("preview") === "on", published: f.get("published") === "on",
      };
      if (lesson) must(await supabase.from("lessons").update(row).eq("id", lesson.id));
      else must(await supabase.from("lessons").insert({ ...row, module_id: moduleId }));
      toast("success", "Lesson saved"); onSaved(); onClose();
    } catch (er) { setErr(er instanceof Error && /invalid_file_type|file_too_large/.test(er.message) ? "Material must be a PDF under 50 MB." : errorMessage(er)); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={lesson ? "Edit lesson" : "New lesson"} onClose={onClose}>
      {prot.loading ? <p className="text-sm text-ink-mute">Loading…</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert>{err}</Alert>}
          <TextInput label="Title" name="title" defaultValue={lesson?.title ?? ""} required />
          <TextArea label="Description" name="description" defaultValue={lesson?.description ?? ""} rows={2} />
          <TextInput label="YouTube link or video ID" name="video" defaultValue={prot.data?.video_ref ?? ""} hint="Upload as Unlisted on YouTube. The link is never shown to people without access." />
          <TextInput label="Material (PDF, optional)" name="material" type="file" accept="application/pdf" hint={prot.data?.material_path ? "A file is attached. Choosing a new one replaces it." : undefined} />
          {prot.data?.material_path && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove_material" className="h-4 w-4" />Remove the current material</label>}
          <div className="grid grid-cols-2 gap-3"><TextInput label="Duration (minutes)" name="minutes" type="number" min={0} step="0.5" defaultValue={lesson?.duration_seconds ? lesson.duration_seconds / 60 : ""} /><TextInput label="Position" name="position" type="number" min={1} defaultValue={lesson?.position ?? nextPos} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="preview" defaultChecked={lesson?.is_free_preview ?? false} className="h-4 w-4" />Free preview (anyone signed in can watch)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={lesson?.published ?? false} className="h-4 w-4" />Published</label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy}>Save</Button></div>
        </form>)}
    </Modal>
  );
}

export default function AdminCourseContent() {
  const { courseId = "" } = useParams();
  const toast = useToast();
  const state = useAsync(async () => ({ course: await getCourseById(courseId), syl: await getSyllabus(courseId) }), [courseId]);
  const [modEdit, setModEdit] = useState<CourseModule | "new" | null>(null);
  const [lessonEdit, setLessonEdit] = useState<{ moduleId: string; lesson: LessonSummary | null } | null>(null);
  async function del(table: "course_modules" | "lessons", id: string, label: string) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try { must(await supabase.from(table).delete().eq("id", id)); toast("success", "Deleted"); state.reload(); } catch (e) { toast("error", errorMessage(e)); }
  }
  return (
    <AsyncView state={state} isEmpty={(d) => !d.course} empty={<EmptyState title="Course not found" />}>
      {(d) => {
        if (!d.course) return null;
        const { syl } = d;
        return (
          <>
            <p className="mb-2 text-sm"><Link className="text-brand-700 underline" to="/admin/courses">← Courses</Link></p>
            <PageHeader title={d.course.title} sub="Modules and lessons" actions={<button className="btn-primary btn-sm" onClick={() => setModEdit("new")}><Plus className="h-4 w-4" />Module</button>} />
            {syl.modules.length === 0 ? <EmptyState title="No modules yet" hint="Create a module, then add lessons to it." /> : (
              <div className="space-y-4">{syl.modules.map((m) => {
                const ls = syl.lessons.filter((l) => l.module_id === m.id);
                return (
                  <section key={m.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg">{m.position}. {m.title} <Badge tone={m.published ? "green" : "amber"}>{m.published ? "published" : "draft"}</Badge></h2>
                      <div className="flex gap-1.5"><button className="btn-ghost btn-sm" onClick={() => setLessonEdit({ moduleId: m.id, lesson: null })}>Add lesson</button><button className="btn-ghost btn-sm" onClick={() => setModEdit(m)}>Edit</button><button className="btn-ghost btn-sm" onClick={() => del("course_modules", m.id, `module “${m.title}”`)}>Delete</button></div>
                    </div>
                    {ls.length === 0 ? <p className="mt-2 text-sm text-ink-mute">No lessons.</p> : <ul className="mt-2 divide-y divide-line">{ls.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span>{l.position}. {l.title} <span className="text-xs text-ink-mute">{formatDuration(l.duration_seconds)}</span> {l.is_free_preview && <Badge tone="green">preview</Badge>} {!l.published && <Badge tone="amber">draft</Badge>}</span>
                        <span className="flex gap-1.5"><button className="btn-ghost btn-sm" onClick={() => setLessonEdit({ moduleId: m.id, lesson: l })}>Edit</button><button className="btn-ghost btn-sm" onClick={() => del("lessons", l.id, `lesson “${l.title}”`)}>Delete</button></span>
                      </li>))}</ul>}
                  </section>);
              })}</div>)}
            {modEdit && <ModuleForm courseId={courseId} mod={modEdit === "new" ? null : modEdit} nextPos={syl.modules.length + 1} onClose={() => setModEdit(null)} onSaved={state.reload} />}
            {lessonEdit && <LessonForm courseId={courseId} moduleId={lessonEdit.moduleId} lesson={lessonEdit.lesson} nextPos={syl.lessons.filter((l) => l.module_id === lessonEdit.moduleId).length + 1} onClose={() => setLessonEdit(null)} onSaved={state.reload} />}
          </>);
      }}
    </AsyncView>
  );
}
