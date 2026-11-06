-- =============================================================================
-- Admission Ventures 0005: lessons, protected access, progress
-- Source: spec 9.2, FR-04..FR-06.
-- =============================================================================

-- Access rule: lesson and module published AND (free preview of a public course
-- OR an active, unexpired enrollment). Enrolled students keep access to a course
-- that is later unpublished or archived.
create or replace function private.can_access_lesson(p_student uuid, p_lesson uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select l.published and m.published and (
             (l.is_free_preview and c.published and c.archived_at is null)
             or private.has_active_enrollment(p_student, c.id))
      from public.lessons l
      join public.course_modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
     where l.id = p_lesson
  ), false)
$$;

-- get-protected-lesson (service role): returns the protected fields only after the check.
create or replace function public.get_lesson_for_student(p_student uuid, p_lesson uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  if p_student is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.can_access_lesson(p_student, p_lesson) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'id', l.id, 'module_id', l.module_id, 'course_id', c.id, 'title', l.title,
           'description', l.description, 'video_provider', l.video_provider, 'video_ref', l.video_ref,
           'material_path', l.material_path, 'duration_seconds', l.duration_seconds,
           'is_free_preview', l.is_free_preview)
    into r
    from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
   where l.id = p_lesson;
  return r;
end $$;

-- Progress writes verify access (spec 8.1). Students have no direct write privilege.
create or replace function public.save_lesson_progress(p_lesson uuid, p_completed boolean, p_position integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  r     public.lesson_progress;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.can_access_lesson(v_uid, p_lesson) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.lesson_progress (student_id, lesson_id, completed, last_position_seconds, completed_at)
  values (v_uid, p_lesson, coalesce(p_completed, false), greatest(coalesce(p_position, 0), 0),
          case when p_completed then now() end)
  on conflict (student_id, lesson_id) do update
     set completed = excluded.completed or public.lesson_progress.completed,
         last_position_seconds = excluded.last_position_seconds,
         completed_at = case when (excluded.completed or public.lesson_progress.completed)
                             then coalesce(public.lesson_progress.completed_at, now()) end
  returning * into r;
  return jsonb_build_object('lesson_id', r.lesson_id, 'completed', r.completed,
                            'last_position_seconds', r.last_position_seconds);
end $$;

-- Student dashboard: active courses with completion counts in one query (no N+1).
create or replace function public.my_course_progress()
returns table (course_id uuid, slug text, title text, thumbnail_path text,
               total_lessons bigint, completed_lessons bigint, expires_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.slug, c.title, c.thumbnail_path,
         (select count(*) from public.lessons l
            join public.course_modules m on m.id = l.module_id
           where m.course_id = c.id and l.published and m.published),
         (select count(*) from public.lesson_progress p
            join public.lessons l on l.id = p.lesson_id
            join public.course_modules m on m.id = l.module_id
           where m.course_id = c.id and p.student_id = (select auth.uid())
             and p.completed and l.published and m.published),
         e.expires_at
    from public.enrollments e
    join public.courses c on c.id = e.course_id
   where e.student_id = (select auth.uid())
     and e.status = 'active' and (e.expires_at is null or e.expires_at > now())
   order by e.enrolled_at desc nulls last
$$;

-- Admin editing needs the protected columns that API roles cannot select.
create or replace function public.admin_get_lesson(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select to_jsonb(l) from public.lessons l where l.id = p_lesson);
end $$;

grant execute on function public.save_lesson_progress(uuid, boolean, integer) to authenticated;
grant execute on function public.my_course_progress()                         to authenticated;
grant execute on function public.admin_get_lesson(uuid)                       to authenticated;

revoke all on function public.get_lesson_for_student(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_lesson_for_student(uuid, uuid) to service_role;
