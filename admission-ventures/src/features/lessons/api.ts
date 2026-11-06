import { supabase } from "@/lib/supabase/client";
import { callFunction, must } from "@/lib/supabase/functions";
import type { LessonAdmin, LessonProgress } from "@/types/db";

export interface ProtectedLesson { id: string; title: string; description: string | null; duration_seconds: number | null; is_free_preview: boolean; course_id: string; module_id: string; video_embed_url: string | null; material_url: string | null; }
export const getProtectedLesson = (lessonId: string) => callFunction<ProtectedLesson>("get-protected-lesson", { lesson_id: lessonId });

export async function listProgress(lessonIds: string[]): Promise<Record<string, LessonProgress>> {
  if (!lessonIds.length) return {};
  const rows = must(await supabase.from("lesson_progress").select("lesson_id, completed, last_position_seconds").in("lesson_id", lessonIds)) as LessonProgress[];
  return Object.fromEntries(rows.map((r) => [r.lesson_id, r]));
}
export const saveProgress = async (lessonId: string, completed: boolean, position: number) =>
  must(await supabase.rpc("save_lesson_progress", { p_lesson: lessonId, p_completed: completed, p_position: position }));

// Admin
export const adminGetLesson = async (id: string): Promise<LessonAdmin> => must(await supabase.rpc("admin_get_lesson", { p_lesson: id })) as LessonAdmin;
export async function uploadMaterial(courseId: string, file: File): Promise<string> {
  if (file.type !== "application/pdf") throw new Error("invalid_file_type");
  if (file.size > 50 * 1024 * 1024) throw new Error("file_too_large");
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${courseId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("course-materials").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}
