export type Role = "student" | "instructor" | "admin" | "super_admin";
export interface Profile { id: string; full_name: string | null; phone: string | null; avatar_path: string | null; role: Role; created_at: string; }
export interface Course { id: string; title: string; slug: string; description: string | null; thumbnail_path: string | null; price_amount: number; currency: string; published: boolean; archived_at: string | null; created_at: string; updated_at: string; }
export interface CourseModule { id: string; course_id: string; title: string; description: string | null; position: number; published: boolean; }
export interface LessonSummary { id: string; module_id: string; title: string; description: string | null; duration_seconds: number | null; position: number; is_free_preview: boolean; published: boolean; }
export interface LessonAdmin extends LessonSummary { video_provider: string | null; video_ref: string | null; material_path: string | null; }
export interface LessonProgress { lesson_id: string; completed: boolean; last_position_seconds: number; }
export interface Enrollment { id: string; student_id: string; course_id: string; status: string; source: string; enrolled_at: string; expires_at: string | null; }
export interface OrderItem { id: string; course_id: string; item_title_snapshot: string; unit_price: number; quantity: number; line_total: number; }
export interface Payment { id: string; order_id: string; gateway: string; gateway_transaction_id: string | null; amount: number; status: string; verified_at: string | null; created_at: string; }
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "expired" | "refunded";
export interface Order { id: string; order_reference: string; student_id: string; currency: string; total_amount: number; status: OrderStatus; expires_at: string | null; paid_at: string | null; created_at: string; order_items?: OrderItem[]; payments?: Payment[]; profiles?: { full_name: string | null } | null; }
export interface QuestionOption { key: string; text: string; }
export interface Question { id: string; category_id: string | null; question_type: string; prompt: string; options: QuestionOption[]; explanation: string | null; difficulty: string; status: string; created_at: string; }
export interface Category { id: string; parent_id: string | null; name: string; slug: string; active: boolean; }
export type ReviewPolicy = "after_submit" | "after_close" | "never";
export interface Quiz { id: string; course_id: string | null; title: string; description: string | null; duration_seconds: number; total_marks: number; pass_marks: number; negative_mark: number; max_attempts: number; opens_at: string | null; closes_at: string | null; published: boolean; review_policy: ReviewPolicy; }
export interface QuizQuestionRow { id: string; quiz_id: string; question_id: string; marks: number; negative_marks: number; position: number; questions?: { prompt: string } | null; }
export interface Announcement { id: string; course_id: string | null; title: string; body: string; published_at: string | null; created_at: string; }
export interface AuditLog { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string; profiles?: { full_name: string | null } | null; }

export interface CourseProgress { course_id: string; slug: string; title: string; thumbnail_path: string | null; total_lessons: number; completed_lessons: number; expires_at: string | null; }
export interface StudentQuiz { quiz_id: string; title: string; description: string | null; course_id: string | null; course_title: string | null; duration_seconds: number; total_marks: number; pass_marks: number; max_attempts: number; opens_at: string | null; closes_at: string | null; question_count: number; attempts_used: number; best_score: number | null; in_progress_attempt_id: string | null; last_finished_attempt_id: string | null; availability: string; }
export interface AttemptQuestion { id: string; position: number; prompt: string; options: QuestionOption[]; marks: number; negative_marks: number; }
export interface AttemptPayload { attempt_id: string; quiz_id: string; attempt_number: number; status: string; started_at: string; deadline_at: string; server_now: string; resumed: boolean; title: string; duration_seconds: number; questions: AttemptQuestion[]; answers: Record<string, { key: string }>; }
export interface ReviewItem { question_id: string; position: number; prompt: string; options: QuestionOption[]; marks: number; selected_answer: { key: string } | null; correct_answer: { key: string }; explanation: string | null; is_correct: boolean | null; awarded_marks: number | null; }
export interface QuizResult { attempt_id: string; quiz_id: string; quiz_title: string; status: string; submitted_at: string | null; score: number; total_marks: number; pass_marks: number; passed: boolean; correct_count: number; wrong_count: number; unanswered_count: number; review_policy: ReviewPolicy; review_available: boolean; review: ReviewItem[] | null; }
export interface AdminStudent { id: string; full_name: string | null; email: string | null; phone: string | null; role: Role; created_at: string; active_enrollments: number; total_count: number; }
export interface Overview { students: number; active_enrollments: number; pending_orders: number; paid_orders: number; revenue_total: number; revenue_30d: number; attempts_total: number; attempts_30d: number; rejected_payment_events: number; }
export interface RevenueDay { day: string; orders: number; revenue: number; }
export interface CourseReport { course_id: string; title: string; published: boolean; active_enrollments: number; revenue: number; total_lessons: number; avg_completion_pct: number | null; }
export interface QuizReport { quiz_id: string; title: string; attempts: number; avg_score: number | null; avg_pct: number | null; pass_rate_pct: number | null; }
