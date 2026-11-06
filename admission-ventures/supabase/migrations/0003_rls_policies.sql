-- =============================================================================
-- Admission Ventures 0003: privileges, Row Level Security, Storage policies
-- Source: spec section 8. Deny by default: every table has RLS enabled and only the
-- privileges listed below are granted to the API roles.
--
-- Protected data and how it is reached:
--   questions.correct_answer      column not granted; admins use admin_get_question_key()
--   lessons.video_*/material_path column not granted; students use get-protected-lesson,
--                                 admins use admin_get_lesson()
--   quiz_answers.is_correct/awarded_marks not granted; students use my_quiz_result()
--   profiles.role                 not updatable; changed only by admin_set_role()
--   enrollments/orders/payments/scores  no INSERT/UPDATE/DELETE for API roles at all
-- =============================================================================

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant  all on all tables    in schema public to service_role;

-- Enable RLS on every table exposed through the API.
alter table public.profiles            enable row level security;
alter table public.courses             enable row level security;
alter table public.course_modules      enable row level security;
alter table public.lessons             enable row level security;
alter table public.enrollments         enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_events      enable row level security;
alter table public.question_categories enable row level security;
alter table public.questions           enable row level security;
alter table public.quizzes             enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.quiz_answers        enable row level security;
alter table public.certificates        enable row level security;
alter table public.announcements       enable row level security;
alter table public.audit_logs          enable row level security;

-- Helper functions referenced by policies must be callable by the roles evaluating them.
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.is_super_admin()      to authenticated;
grant execute on function public.admin_mfa_required()  to authenticated;
grant execute on function public.my_role()             to authenticated;
grant execute on function public.i_am_enrolled(uuid)   to authenticated;
grant execute on function public.normalize_bd_phone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: own row only; admins read all; a student may change name/phone/avatar only.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

create policy student_select_own_profile on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy admin_select_profiles on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy student_update_own_profile on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- courses: published catalog is public. Writes only through admin-manage-course
-- (service role), so no write privilege exists for API roles.
-- ---------------------------------------------------------------------------
grant select on public.courses to anon, authenticated;

create policy public_select_published_courses on public.courses
  for select to anon, authenticated using (published and archived_at is null);
create policy student_select_enrolled_courses on public.courses
  for select to authenticated using ((select public.i_am_enrolled(id)));
create policy admin_select_courses on public.courses
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- course_modules and lessons
-- ---------------------------------------------------------------------------
grant select on public.course_modules to anon, authenticated;
grant insert, update, delete on public.course_modules to authenticated;

create policy public_select_published_modules on public.course_modules
  for select to anon, authenticated
  using (published and exists (
    select 1 from public.courses c
     where c.id = course_modules.course_id and c.published and c.archived_at is null));
create policy student_select_enrolled_modules on public.course_modules
  for select to authenticated
  using (published and (select public.i_am_enrolled(course_id)));
create policy admin_select_modules on public.course_modules
  for select to authenticated using ((select public.is_admin()));
create policy admin_insert_modules on public.course_modules
  for insert to authenticated with check ((select public.is_admin()));
create policy admin_update_modules on public.course_modules
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete_modules on public.course_modules
  for delete to authenticated using ((select public.is_admin()));

-- Column-level grant: protected video/material references are not selectable.
grant select (id, module_id, title, description, duration_seconds, position, is_free_preview, published)
  on public.lessons to anon, authenticated;
grant insert, update, delete on public.lessons to authenticated;

create policy public_select_published_lessons on public.lessons
  for select to anon, authenticated
  using (published and exists (
    select 1 from public.course_modules m join public.courses c on c.id = m.course_id
     where m.id = lessons.module_id and m.published and c.published and c.archived_at is null));
create policy student_select_enrolled_lessons on public.lessons
  for select to authenticated
  using (published and exists (
    select 1 from public.course_modules m
     where m.id = lessons.module_id and m.published and (select public.i_am_enrolled(m.course_id))));
create policy admin_select_lessons on public.lessons
  for select to authenticated using ((select public.is_admin()));
create policy admin_insert_lessons on public.lessons
  for insert to authenticated with check ((select public.is_admin()));
create policy admin_update_lessons on public.lessons
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete_lessons on public.lessons
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- enrollments, progress: read-only for students (spec 8). Writes are server-side.
-- ---------------------------------------------------------------------------
grant select on public.enrollments, public.lesson_progress to authenticated;

create policy student_select_own_enrollments on public.enrollments
  for select to authenticated using (student_id = (select auth.uid()));
create policy admin_select_enrollments on public.enrollments
  for select to authenticated using ((select public.is_admin()));

create policy student_select_own_progress on public.lesson_progress
  for select to authenticated using (student_id = (select auth.uid()));
create policy admin_select_progress on public.lesson_progress
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- orders, items, payments, payment events
-- ---------------------------------------------------------------------------
grant select on public.orders, public.order_items, public.payments, public.payment_events to authenticated;

create policy student_select_own_orders on public.orders
  for select to authenticated using (student_id = (select auth.uid()));
create policy admin_select_orders on public.orders
  for select to authenticated using ((select public.is_admin()));

create policy student_select_own_order_items on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                  where o.id = order_items.order_id and o.student_id = (select auth.uid())));
create policy admin_select_order_items on public.order_items
  for select to authenticated using ((select public.is_admin()));

create policy student_select_own_payments on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o
                  where o.id = payments.order_id and o.student_id = (select auth.uid())));
create policy admin_select_payments on public.payments
  for select to authenticated using ((select public.is_admin()));

create policy admin_select_payment_events on public.payment_events
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- question bank (admin only). The answer key column is never granted.
-- Question writes go through admin_save_question() so they are validated and audited.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.question_categories to authenticated;
create policy admin_all_categories on public.question_categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select (id, category_id, question_type, prompt, options, explanation, difficulty, status, created_by, created_at)
  on public.questions to authenticated;
create policy admin_select_questions on public.questions
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- quizzes and attempts
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.quizzes to authenticated;
create policy student_select_visible_quizzes on public.quizzes
  for select to authenticated
  using (published and (course_id is null or (select public.i_am_enrolled(course_id))));
create policy admin_select_quizzes on public.quizzes
  for select to authenticated using ((select public.is_admin()));
create policy admin_insert_quizzes on public.quizzes
  for insert to authenticated with check ((select public.is_admin()));
create policy admin_update_quizzes on public.quizzes
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete_quizzes on public.quizzes
  for delete to authenticated using ((select public.is_admin()));

grant select, insert, update, delete on public.quiz_questions to authenticated;
create policy admin_all_quiz_questions on public.quiz_questions
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.quiz_attempts to authenticated;
create policy student_select_own_attempts on public.quiz_attempts
  for select to authenticated using (student_id = (select auth.uid()));
create policy admin_select_attempts on public.quiz_attempts
  for select to authenticated using ((select public.is_admin()));

-- Correctness and marks are withheld until the review policy allows them (my_quiz_result()).
grant select (id, attempt_id, question_id, selected_answer, answered_at) on public.quiz_answers to authenticated;
create policy student_select_own_answers on public.quiz_answers
  for select to authenticated
  using (exists (select 1 from public.quiz_attempts a
                  where a.id = quiz_answers.attempt_id and a.student_id = (select auth.uid())));
create policy admin_select_answers on public.quiz_answers
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- certificates, announcements, audit logs
-- ---------------------------------------------------------------------------
grant select on public.certificates to authenticated;
create policy student_select_own_certificates on public.certificates
  for select to authenticated using (student_id = (select auth.uid()));
create policy admin_select_certificates on public.certificates
  for select to authenticated using ((select public.is_admin()));

grant select, insert, update, delete on public.announcements to authenticated;
create policy student_select_announcements on public.announcements
  for select to authenticated
  using (published_at is not null and published_at <= now()
         and (course_id is null or (select public.i_am_enrolled(course_id))));
create policy admin_select_announcements on public.announcements
  for select to authenticated using ((select public.is_admin()));
create policy admin_insert_announcements on public.announcements
  for insert to authenticated with check ((select public.is_admin()));
create policy admin_update_announcements on public.announcements
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete_announcements on public.announcements
  for delete to authenticated using ((select public.is_admin()));

grant select on public.audit_logs to authenticated;
create policy admin_select_audit_logs on public.audit_logs
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage (spec 9.2): course materials are private. Students never read objects
-- directly; get-protected-lesson hands out short-lived signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-materials', 'course-materials', false, 52428800,
        array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-thumbnails', 'course-thumbnails', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy admin_manage_materials on storage.objects
  for all to authenticated
  using (bucket_id = 'course-materials' and (select public.is_admin()))
  with check (bucket_id = 'course-materials' and (select public.is_admin()));

create policy public_read_thumbnails on storage.objects
  for select to anon, authenticated using (bucket_id = 'course-thumbnails');
create policy admin_manage_thumbnails on storage.objects
  for all to authenticated
  using (bucket_id = 'course-thumbnails' and (select public.is_admin()))
  with check (bucket_id = 'course-thumbnails' and (select public.is_admin()));
