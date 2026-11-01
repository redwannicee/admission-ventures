-- =============================================================================
-- Admission Ventures — 0002: Row Level Security + Storage
-- Principle: deny by default. Students reach sensitive data (answers, coupons,
-- purchases) only through SECURITY DEFINER functions in 0003.
-- `(select auth.uid())` is wrapped so Postgres evaluates it once per query.
-- =============================================================================

alter table public.users              enable row level security;
alter table public.courses            enable row level security;
alter table public.coupons            enable row level security;
alter table public.enrollments        enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.exams              enable row level security;
alter table public.questions          enable row level security;
alter table public.exam_attempts      enable row level security;
alter table public.exam_results       enable row level security;
alter table public.course_materials   enable row level security;
alter table public.mentors            enable row level security;
alter table public.testimonials       enable row level security;

-- Enrollment checks used by policies and functions.
create or replace function public.is_enrolled(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments
     where user_id = (select auth.uid()) and course_id = p_course_id and status = 'active'
  )
$$;

-- Staff can preview everything; students need an active enrollment.
create or replace function public.has_course_access(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.is_enrolled(p_course_id)
$$;

-- ---------- users ------------------------------------------------------------
-- Phone numbers are personal data: only the owner and super admins can read them.
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or public.is_super_admin());
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy users_update_admin on public.users for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- courses (public catalogue) ---------------------------------------
create policy courses_select on public.courses for select to anon, authenticated
  using (is_active or public.is_staff());
create policy courses_write on public.courses for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- coupons (admin only; students use validate_coupon) ---------------
create policy coupons_admin on public.coupons for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- enrollments / redemptions ----------------------------------------
create policy enrollments_select on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());
create policy enrollments_admin_write on public.enrollments for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy redemptions_admin on public.coupon_redemptions for select to authenticated
  using (public.is_super_admin());

-- ---------- exams ------------------------------------------------------------
create policy exams_select on public.exams for select to anon, authenticated
  using (is_published or public.is_staff());
create policy exams_write on public.exams for all to authenticated
  using (public.is_mentor_or_above()) with check (public.is_mentor_or_above());

-- ---------- questions (answers must never reach students) --------------------
create policy questions_staff on public.questions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------- attempts / results ----------------------------------------------
create policy attempts_select on public.exam_attempts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
create policy results_select on public.exam_results for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- ---------- materials, mentors, testimonials ---------------------------------
create policy materials_select on public.course_materials for select to authenticated
  using (public.has_course_access(course_id));
create policy materials_write on public.course_materials for all to authenticated
  using (public.is_mentor_or_above()) with check (public.is_mentor_or_above());

create policy mentors_select on public.mentors for select to anon, authenticated
  using (is_published or public.is_super_admin());
create policy mentors_write on public.mentors for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy testimonials_select on public.testimonials for select to anon, authenticated
  using (is_published or public.is_super_admin());
create policy testimonials_write on public.testimonials for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- Storage: private PDF bucket --------------------------------------
-- Convention: object path = '<course_id>/<filename>.pdf'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy materials_read on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        then public.is_staff() or public.is_enrolled(((storage.foldername(name))[1])::uuid)
      else public.is_staff()
    end
  );
create policy materials_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.is_mentor_or_above());
create policy materials_update on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.is_mentor_or_above());
create policy materials_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.is_mentor_or_above());
