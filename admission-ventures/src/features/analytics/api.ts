import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import type { AuditLog, CourseReport, Overview, QuizReport, RevenueDay } from "@/types/db";

export const getOverview = async (): Promise<Overview> => must(await supabase.rpc("admin_report_overview")) as Overview;
export const getRevenue = async (days: number): Promise<RevenueDay[]> => must(await supabase.rpc("admin_report_revenue", { p_days: days })) as RevenueDay[];
export const getCourseReport = async (): Promise<CourseReport[]> => must(await supabase.rpc("admin_report_courses")) as CourseReport[];
export const getQuizReport = async (): Promise<QuizReport[]> => must(await supabase.rpc("admin_report_quizzes")) as QuizReport[];

export async function listAudit(entity: string, page: number, size: number): Promise<{ rows: AuditLog[]; total: number }> {
  let q = supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, metadata, created_at, profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false }).range(page * size, page * size + size - 1);
  if (entity) q = q.eq("entity_type", entity);
  const r = await q;
  if (r.error) must(r);
  return { rows: (r.data ?? []) as unknown as AuditLog[], total: r.count ?? 0 };
}
