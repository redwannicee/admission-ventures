-- =============================================================================
-- Admission Ventures 0007: admin tools and reporting
-- Source: spec FR-10, FR-11, FR-15, section 2.1 "Reporting".
-- Every function re-checks is_admin() itself, because SECURITY DEFINER bypasses RLS.
-- =============================================================================

create or replace function public.admin_get_question_key(p_question uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object('id', q.id, 'correct_answer', q.correct_answer)
            from public.questions q where q.id = p_question);
end $$;

-- Single write path for questions: validated by the trigger, audited, key never returned.
create or replace function public.admin_save_question(p_id uuid, p_payload jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;

  if p_id is null then
    insert into public.questions (category_id, prompt, options, correct_answer, explanation, difficulty, status, created_by)
    values (nullif(p_payload ->> 'category_id', '')::uuid, p_payload ->> 'prompt', p_payload -> 'options',
            p_payload -> 'correct_answer', nullif(p_payload ->> 'explanation', ''),
            coalesce(p_payload ->> 'difficulty', 'medium'), coalesce(p_payload ->> 'status', 'draft'),
            (select auth.uid()))
    returning id into v_id;
  else
    update public.questions set
      category_id    = case when p_payload ? 'category_id' then nullif(p_payload ->> 'category_id', '')::uuid else category_id end,
      prompt         = coalesce(p_payload ->> 'prompt', prompt),
      options        = coalesce(p_payload -> 'options', options),
      correct_answer = coalesce(p_payload -> 'correct_answer', correct_answer),
      explanation    = case when p_payload ? 'explanation' then nullif(p_payload ->> 'explanation', '') else explanation end,
      difficulty     = coalesce(p_payload ->> 'difficulty', difficulty),
      status         = coalesce(p_payload ->> 'status', status)
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'question_not_found'; end if;
  end if;
  return v_id;
end $$;

-- Paginated, filtered student list including the sign-in email (which lives in auth.users).
create or replace function public.admin_list_students(p_search text, p_limit int, p_offset int)
returns table (id uuid, full_name text, email text, phone text, role text, created_at timestamptz,
               active_enrollments bigint, total_count bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name, u.email::text, p.phone, p.role, p.created_at,
         (select count(*) from public.enrollments e where e.student_id = p.id and e.status = 'active'),
         count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
   where p_search is null or btrim(p_search) = ''
      or p.full_name ilike '%' || btrim(p_search) || '%'
      or u.email ilike '%' || btrim(p_search) || '%'
      or p.phone like '%' || btrim(p_search) || '%'
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------------------------------------------------------------------------
-- Reports (spec 2.1: enrollment, revenue, attempts, progress summaries)
-- ---------------------------------------------------------------------------
create or replace function public.admin_report_overview() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students',           (select count(*) from public.profiles where role = 'student'),
    'active_enrollments', (select count(*) from public.enrollments where status = 'active'),
    'pending_orders',     (select count(*) from public.orders where status = 'pending'),
    'paid_orders',        (select count(*) from public.orders where status = 'paid'),
    'revenue_total',      (select coalesce(sum(total_amount), 0) from public.orders where status = 'paid'),
    'revenue_30d',        (select coalesce(sum(total_amount), 0) from public.orders where status = 'paid' and paid_at > now() - interval '30 days'),
    'attempts_total',     (select count(*) from public.quiz_attempts where status in ('submitted', 'expired')),
    'attempts_30d',       (select count(*) from public.quiz_attempts where status in ('submitted', 'expired') and started_at > now() - interval '30 days'),
    'rejected_payment_events', (select count(*) from public.payment_events where processing_status in ('rejected', 'failed'))
  );
end $$;

create or replace function public.admin_report_revenue(p_days int default 30)
returns table (day date, orders bigint, revenue bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select d::date,
         count(o.id),
         coalesce(sum(o.total_amount), 0)::bigint
    from generate_series((now() at time zone 'utc')::date - (least(greatest(p_days, 1), 365) - 1),
                         (now() at time zone 'utc')::date, interval '1 day') d
    left join public.orders o
           on o.status = 'paid' and (o.paid_at at time zone 'utc')::date = d::date
   group by d order by d;
end $$;

create or replace function public.admin_report_courses()
returns table (course_id uuid, title text, published boolean, active_enrollments bigint,
               revenue bigint, total_lessons bigint, avg_completion_pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select c.id, c.title, c.published,
         ae.n,
         coalesce((select sum(oi.line_total) from public.order_items oi
                    join public.orders o on o.id = oi.order_id
                   where oi.course_id = c.id and o.status = 'paid'), 0)::bigint,
         tl.n,
         case when tl.n = 0 or ae.n = 0 then 0
              else round(100.0 * cl.n / (tl.n * ae.n), 1) end
    from public.courses c
    cross join lateral (select count(*) n from public.enrollments e
                         where e.course_id = c.id and e.status = 'active') ae
    cross join lateral (select count(*) n from public.lessons l
                          join public.course_modules m on m.id = l.module_id
                         where m.course_id = c.id and l.published and m.published) tl
    cross join lateral (select count(*) n from public.lesson_progress p
                          join public.lessons l on l.id = p.lesson_id
                          join public.course_modules m on m.id = l.module_id
                          join public.enrollments e on e.student_id = p.student_id
                                                   and e.course_id = m.course_id and e.status = 'active'
                         where m.course_id = c.id and p.completed and l.published and m.published) cl
   where c.archived_at is null
   order by c.created_at desc;
end $$;

create or replace function public.admin_report_quizzes()
returns table (quiz_id uuid, title text, attempts bigint, avg_score numeric, avg_pct numeric, pass_rate_pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select z.id, z.title, count(a.id),
         round(avg(a.score), 2),
         round(avg(case when a.total_marks > 0 then 100.0 * a.score / a.total_marks end), 1),
         round(100.0 * count(*) filter (where a.score >= z.pass_marks) / nullif(count(a.id), 0), 1)
    from public.quizzes z
    left join public.quiz_attempts a on a.quiz_id = z.id and a.status in ('submitted', 'expired')
   group by z.id, z.title
   order by count(a.id) desc, z.title;
end $$;

grant execute on function public.admin_get_question_key(uuid)             to authenticated;
grant execute on function public.admin_save_question(uuid, jsonb)         to authenticated;
grant execute on function public.admin_list_students(text, int, int)     to authenticated;
grant execute on function public.admin_report_overview()                  to authenticated;
grant execute on function public.admin_report_revenue(int)                to authenticated;
grant execute on function public.admin_report_courses()                   to authenticated;
grant execute on function public.admin_report_quizzes()                   to authenticated;
