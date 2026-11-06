import { supabase } from "@/lib/supabase/client";
import { callFunction, must } from "@/lib/supabase/functions";
import type { AttemptPayload, Quiz, QuizQuestionRow, QuizResult, StudentQuiz } from "@/types/db";

export const listMyQuizzes = async (): Promise<StudentQuiz[]> => must(await supabase.rpc("student_list_quizzes")) as StudentQuiz[];
export const startQuiz = (quizId: string) => callFunction<AttemptPayload>("start-quiz", { quiz_id: quizId });
export const saveAnswer = (attemptId: string, questionId: string, key: string | null) =>
  callFunction("save-quiz-answer", { attempt_id: attemptId, question_id: questionId, answer: key === null ? null : { key } });
export const submitQuiz = (attemptId: string) => callFunction<QuizResult>("submit-quiz", { attempt_id: attemptId });
export const getMyResult = async (attemptId: string): Promise<QuizResult> => must(await supabase.rpc("my_quiz_result", { p_attempt: attemptId })) as QuizResult;

// Admin
export const adminListQuizzes = async (): Promise<Quiz[]> =>
  must(await supabase.from("quizzes").select("*").order("title")) as Quiz[];
export const adminQuizQuestions = async (quizId: string): Promise<QuizQuestionRow[]> =>
  must(await supabase.from("quiz_questions").select("id, quiz_id, question_id, marks, negative_marks, position, questions(prompt)").eq("quiz_id", quizId).order("position")) as unknown as QuizQuestionRow[];
