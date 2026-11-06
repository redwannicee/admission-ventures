import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/supabase/functions";
import type { Category, Question, QuestionOption } from "@/types/db";

export const listCategories = async (): Promise<Category[]> =>
  must(await supabase.from("question_categories").select("id, parent_id, name, slug, active").order("name")) as Category[];

export async function listQuestions(opts: { search: string; categoryId: string; status: string; page: number; size: number }): Promise<{ rows: Question[]; total: number }> {
  let q = supabase.from("questions").select("id, category_id, question_type, prompt, options, explanation, difficulty, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(opts.page * opts.size, opts.page * opts.size + opts.size - 1);
  if (opts.search) q = q.ilike("prompt", `%${opts.search.replace(/[%_]/g, "")}%`);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.status) q = q.eq("status", opts.status);
  const r = await q;
  if (r.error) must(r);
  return { rows: (r.data ?? []) as Question[], total: r.count ?? 0 };
}
export const getAnswerKey = async (id: string): Promise<string> => {
  const r = must(await supabase.rpc("admin_get_question_key", { p_question: id })) as { correct_answer: { key: string } };
  return r.correct_answer.key;
};
export interface QuestionInput { prompt: string; options: QuestionOption[]; correct: string; explanation: string; difficulty: string; status: string; category_id: string; }
export const saveQuestion = async (id: string | null, v: QuestionInput): Promise<string> =>
  must(await supabase.rpc("admin_save_question", { p_id: id, p_payload: {
    prompt: v.prompt, options: v.options, correct_answer: { key: v.correct }, explanation: v.explanation,
    difficulty: v.difficulty, status: v.status, category_id: v.category_id || "",
  } })) as string;
