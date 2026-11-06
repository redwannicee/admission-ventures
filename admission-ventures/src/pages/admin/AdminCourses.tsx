import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Alert, AsyncView, Badge, Button, EmptyState, Modal, PageHeader, TextArea, TextInput } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { adminCourseAction, adminListCourses, type CourseAction, uploadThumbnail } from "@/features/courses/api";
import { courseSchema, firstIssue } from "@/lib/validation/schemas";
import { errorMessage } from "@/utils/messages";
import { formatBDT, slugify } from "@/utils/format";
import type { Course } from "@/types/db";

function CourseForm({ course, onClose, onSaved }: { course: Course | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(course?.title ?? ""); const [slug, setSlug] = useState(course?.slug ?? "");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const p = courseSchema.safeParse({ title, slug, description: f.get("description"), price_amount: f.get("price_amount") });
    if (!p.success) return setErr(firstIssue(p.error));
    setBusy(true); setErr("");
    try {
      const payload: Record<string, unknown> = { title: p.data.title, slug: p.data.slug, description: p.data.description ?? "", price_amount: p.data.price_amount };
      const file = (f.get("thumb") as File | null);
      if (course) {
        if (file && file.size > 0) payload.thumbnail_path = await uploadThumbnail(course.id, file);
        await adminCourseAction("update", course.id, payload);
      } else {
        const created = await adminCourseAction("create", null, payload);
        if (file && file.size > 0) await adminCourseAction("update", created.id, { thumbnail_path: await uploadThumbnail(created.id, file) });
      }
      toast("success", "Course saved"); onSaved(); onClose();
    } catch (er) { setErr(er instanceof Error && /invalid_image_type|image_too_large/.test(er.message) ? "Thumbnail must be a JPG, PNG or WebP under 2 MB." : errorMessage(er)); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={course ? "Edit course" : "New course"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <TextInput label="Title" value={title} onChange={(e) => { setTitle(e.target.value); if (!course) setSlug(slugify(e.target.value)); }} required />
        <TextInput label="URL slug" value={slug} onChange={(e) => setSlug(e.target.value)} hint="Lowercase letters, numbers, hyphens." required />
        <TextArea label="Description" name="description" defaultValue={course?.description ?? ""} />
        <TextInput label="Price (BDT, whole taka; 0 = free)" name="price_amount" type="number" min={0} step={1} defaultValue={course?.price_amount ?? 0} required />
        <TextInput label="Thumbnail (JPG/PNG/WebP, max 2 MB)" name="thumb" type="file" accept="image/jpeg,image/png,image/webp" />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminCourses() {
  const state = useAsync(adminListCourses, []);
  const toast = useToast();
  const [edit, setEdit] = useState<Course | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function act(c: Course, a: CourseAction) {
    if (busy) return;
    setBusy(c.id + a);
    try { await adminCourseAction(a, c.id); toast("success", "Done"); state.reload(); } catch (e) { toast("error", errorMessage(e)); } finally { setBusy(null); }
  }
  return (
    <>
      <PageHeader title="Courses" actions={<button className="btn-primary btn-sm" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New course</button>} />
      <AsyncView state={state} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No courses yet" action={<button className="btn-primary btn-sm" onClick={() => setEdit("new")}>Create the first course</button>} />}>
        {(d) => <div className="table-wrap"><table className="table"><thead><tr><th>Title</th><th>Price</th><th>Status</th><th className="text-right">Actions</th></tr></thead><tbody>
          {d.map((c) => <tr key={c.id}>
            <td><p className="font-medium">{c.title}</p><p className="font-mono text-xs text-ink-mute">/{c.slug}</p></td>
            <td>{formatBDT(c.price_amount)}</td>
            <td>{c.archived_at ? <Badge>archived</Badge> : <Badge tone={c.published ? "green" : "amber"}>{c.published ? "published" : "draft"}</Badge>}</td>
            <td><div className="flex flex-wrap justify-end gap-1.5">
              <Link className="btn-ghost btn-sm" to={`/admin/courses/${c.id}/content`}>Content</Link>
              <button className="btn-ghost btn-sm" onClick={() => setEdit(c)}>Edit</button>
              {c.archived_at ? <Button className="btn-ghost btn-sm" loading={busy === c.id + "unarchive"} onClick={() => act(c, "unarchive")}>Restore</Button> : <>
                <Button className="btn-ghost btn-sm" loading={busy === c.id + (c.published ? "unpublish" : "publish")} onClick={() => act(c, c.published ? "unpublish" : "publish")}>{c.published ? "Unpublish" : "Publish"}</Button>
                <Button className="btn-ghost btn-sm" loading={busy === c.id + "archive"} onClick={() => { if (window.confirm(`Archive “${c.title}”? It will be hidden from the catalogue.`)) void act(c, "archive"); }}>Archive</Button></>}
            </div></td></tr>)}
        </tbody></table></div>}
      </AsyncView>
      {edit && <CourseForm course={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={state.reload} />}
    </>
  );
}
