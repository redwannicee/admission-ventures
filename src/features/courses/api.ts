import { supabase } from "@/lib/supabase/client";
import { callFunction, must } from "@/lib/supabase/functions";
import type { Course, CourseModule, LessonSummary } from "@/types/db";

const COURSE_COLS = "id, title, slug, description, thumbnail_path, price_amount, currency, published, archived_at, created_at, updated_at";

export const thumbnailUrl = (path: string | null): string | null =>
  path ? supabase.storage.from("course-thumbnails").getPublicUrl(path).data.publicUrl : null;

export async function listPublishedCourses(): Promise<Course[]> {
  return must(await supabase.from("courses").select(COURSE_COLS).eq("published", true).order("created_at", { ascending: false })) as Course[];
}
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  return must(await supabase.from("courses").select(COURSE_COLS).eq("slug", slug).maybeSingle()) as Course | null;
}
export async function getCourseById(id: string): Promise<Course | null> {
  return must(await supabase.from("courses").select(COURSE_COLS).eq("id", id).maybeSingle()) as Course | null;
}
export interface Syllabus { modules: CourseModule[]; lessons: LessonSummary[]; }
const LESSON_COLS = "id, module_id, title, description, duration_seconds, position, is_free_preview, published";
export async function getSyllabus(courseId: string): Promise<Syllabus> {
  const modules = must(await supabase.from("course_modules").select("id, course_id, title, description, position, published").eq("course_id", courseId).order("position")) as CourseModule[];
  if (!modules.length) return { modules, lessons: [] };
  const lessons = must(await supabase.from("lessons").select(LESSON_COLS).in("module_id", modules.map((m) => m.id)).order("position")) as LessonSummary[];
  return { modules, lessons };
}

// Admin
export const adminListCourses = async (): Promise<Course[]> =>
  must(await supabase.from("courses").select(COURSE_COLS).order("created_at", { ascending: false })) as Course[];
export type CourseAction = "create" | "update" | "publish" | "unpublish" | "archive" | "unarchive";
export const adminCourseAction = (action: CourseAction, courseId: string | null, payload: Record<string, unknown> = {}) =>
  callFunction<Course>("admin-manage-course", { action, course_id: courseId, payload });

export async function uploadThumbnail(courseId: string, file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("invalid_image_type");
  if (file.size > 2 * 1024 * 1024) throw new Error("image_too_large");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${courseId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("course-thumbnails").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
