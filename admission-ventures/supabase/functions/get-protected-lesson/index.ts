// POST { lesson_id } -> embed URL and short-lived signed material URL, only after the access check.
import { handle, json, readJson, unwrap } from "../_shared/http.ts";
import { authenticate } from "../_shared/auth.ts";
import { reqObject, reqUuid } from "../_shared/validation.ts";

interface Lesson { id: string; title: string; description: string | null; video_provider: string | null; video_ref: string | null; material_path: string | null; duration_seconds: number | null; is_free_preview: boolean; course_id: string; module_id: string; }

handle(async (req) => {
  const caller = await authenticate(req);
  const lessonId = reqUuid(reqObject(await readJson(req)), "lesson_id");
  const l = unwrap<Lesson>(await caller.service.rpc("get_lesson_for_student", { p_student: caller.id, p_lesson: lessonId }));

  let embed: string | null = null;
  if (l.video_provider === "youtube" && l.video_ref && /^[A-Za-z0-9_-]{6,20}$/.test(l.video_ref)) {
    embed = `https://www.youtube-nocookie.com/embed/${l.video_ref}?rel=0&modestbranding=1`;
  } else if (l.video_provider === "external" && l.video_ref?.startsWith("https://")) {
    embed = l.video_ref;
  }
  let material: string | null = null;
  if (l.material_path) {
    const { data } = await caller.service.storage.from("course-materials").createSignedUrl(l.material_path, 600);
    material = data?.signedUrl ?? null;
  }
  return json(req, {
    id: l.id, title: l.title, description: l.description, duration_seconds: l.duration_seconds,
    is_free_preview: l.is_free_preview, course_id: l.course_id, module_id: l.module_id,
    video_embed_url: embed, material_url: material, material_expires_in: material ? 600 : null,
  });
});
