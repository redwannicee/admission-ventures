import { supabase } from "@/lib/supabase/client";
import { callFunction, must } from "@/lib/supabase/functions";
import type { AdminStudent, CourseProgress, Role } from "@/types/db";

export const myProgress = async (): Promise<CourseProgress[]> => must(await supabase.rpc("my_course_progress")) as CourseProgress[];
export const amEnrolled = async (courseId: string): Promise<boolean> => (must(await supabase.rpc("i_am_enrolled", { p_course: courseId })) as boolean) === true;

export const adminListStudents = async (search: string, page: number, size: number): Promise<AdminStudent[]> =>
  must(await supabase.rpc("admin_list_students", { p_search: search || null, p_limit: size, p_offset: page * size })) as AdminStudent[];
export const grantEnrollment = (studentId: string, courseId: string, action: "grant" | "revoke", reason: string, expiresAt: string | null) =>
  callFunction("admin-grant-enrollment", { student_id: studentId, course_id: courseId, action, reason, expires_at: expiresAt });
export const setRole = async (target: string, role: Role) => must(await supabase.rpc("admin_set_role", { p_target: target, p_role: role }));
