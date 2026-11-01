-- =============================================================================
-- Admission Ventures — 0003: coupon, purchase and exam-engine functions
-- All client-callable functions are SECURITY DEFINER with a pinned search_path.
-- =============================================================================

-- ============================ COUPONS & PURCHASE =============================

-- Internal evaluator shared by validate_coupon and the purchase flow.
-- Never callable from the client.
create or replace function public._evaluate_coupon(p_code text, p_course_id uuid, p_user_id uuid)
returns table (
  valid           boolean,
  reason          text,
  coupon_id       uuid,
  original_price  numeric,
  discount_amount numeric,
  final_price     numeric
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_price     numeric;
  v_code      text := upper(btrim(coalesce(p_code, '')));
  c           public.coupons;
  v_user_uses int := 0;
  v_reason    text;
  v_disc      numeric;
begin
  select price into v_price from public.courses where id = p_course_id and is_active;
  if not found then
    return query select false, 'course_not_found'::text, null::uuid, 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  -- No code: full price is valid.
  if v_code = '' then
    return query select true, null::text, null::uuid, v_price, 0::numeric, v_price;
    return;
  end if;

  select * into c from public.coupons where code = v_code;
  if not found then
    return query select false, 'invalid_code'::text, null::uuid, v_price, 0::numeric, v_price;
    return;
  end if;

  if p_user_id is not null then
    select count(*) into v_user_uses
      from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = p_user_id;
  end if;

  v_reason := case
    when not c.is_active                                              then 'inactive'
    when c.starts_at > now()                                          then 'not_started'
    when c.expiry_date is not null and c.expiry_date <= now()         then 'expired'
    when c.max_uses is not null and c.used_count >= c.max_uses        then 'exhausted'
    when c.course_id is not null and c.course_id <> p_course_id       then 'course_mismatch'
    when v_price < c.min_order_amount                                 then 'min_order'
    when v_user_uses >= c.per_user_limit                              then 'already_used'
    else null
  end;

  if v_reason is not null then
    return query select false, v_reason, c.id, v_price, 0::numeric, v_price;
    return;
  end if;

  if c.discount_type = 'percent' then
    v_disc := round(v_price * c.discount_value / 100, 2);
    if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
  else
    v_disc := c.discount_value;
  end if;
  v_disc := least(v_disc, v_price);

  return query select true, null::text, c.id, v_price, v_disc, greatest(v_price - v_disc, 0);
end $$;

-- Public: preview a coupon on the checkout page. Reason codes map to i18n messages.
create or replace function public.validate_coupon(p_code text, p_course_id uuid)
returns table (
  valid           boolean,
  reason          text,
  coupon_id       uuid,
  original_price  numeric,
  discount_amount numeric,
  final_price     numeric
)
language sql stable security definer set search_path = public as $$
  select * from public._evaluate_coupon(p_code, p_course_id, (select auth.uid()))
$$;

-- !! MOCK PAYMENT — Phase 3 only. !!
-- Activates the enrollment immediately with no real payment. Before going live,
-- DROP this function and replace it with: create_pending_order() (client) +
-- confirm_payment() (service_role only, called from the bKash/SSLCommerz webhook).
create or replace function public.mock_purchase_course(
  p_course_id      uuid,
  p_coupon_code    text default null,
  p_payment_method text default 'mock',
  p_payment_ref    text default null
)
returns public.enrollments
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid  uuid := (select auth.uid());
  v_code text := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
  e      record;
  v_enr  public.enrollments;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.enrollments
              where user_id = v_uid and course_id = p_course_id and status = 'active') then
    raise exception 'already_enrolled' using errcode = '23505';
  end if;

  -- Serialise concurrent redemptions of the same coupon.
  if v_code is not null then
    perform 1 from public.coupons where code = v_code for update;
  end if;

  select * into e from public._evaluate_coupon(v_code, p_course_id, v_uid);
  if e.reason = 'course_not_found' then
    raise exception 'course_not_found';
  end if;
  if not e.valid then
    raise exception '%', 'coupon_' || e.reason;
  end if;

  insert into public.enrollments
    (user_id, course_id, original_price, discount_amount, amount_paid,
     coupon_id, coupon_used, status, payment_method, payment_ref, enrolled_at)
  values
    (v_uid, p_course_id, e.original_price, e.discount_amount, e.final_price,
     e.coupon_id, v_code, 'active', p_payment_method, p_payment_ref, now())
  returning * into v_enr;

  if e.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, enrollment_id, discount_amount)
    values (e.coupon_id, v_uid, v_enr.id, e.discount_amount);
    update public.coupons set used_count = used_count + 1 where id = e.coupon_id;
  end if;

  return v_enr;
end $$;

-- Super admin: manually grant a course (free, tracked in granted_by).
create or replace function public.admin_grant_course(p_user_id uuid, p_course_id uuid)
returns public.enrollments
language plpgsql security definer set search_path = public as $$
declare
  v_enr public.enrollments;
  v_price numeric;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_enr from public.enrollments
   where user_id = p_user_id and course_id = p_course_id and status = 'active';
  if found then return v_enr; end if;

  select price into v_price from public.courses where id = p_course_id;
  if not found then raise exception 'course_not_found'; end if;

  insert into public.enrollments
    (user_id, course_id, original_price, discount_amount, amount_paid,
     status, payment_method, granted_by, enrolled_at)
  values
    (p_user_id, p_course_id, v_price, v_price, 0,
     'active', 'manual', (select auth.uid()), now())
  returning * into v_enr;
  return v_enr;
end $$;

-- ============================== EXAM ENGINE ==================================

-- Grades an attempt from stored (or supplied) answers and writes exam_results.
-- Idempotent. Internal only.
create or replace function public._finalize_attempt(p_attempt_id uuid, p_answers jsonb default null)
returns public.exam_results
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  a        public.exam_attempts;
  x        public.exams;
  r        public.exam_results;
  v_ans    jsonb;
  v_late   boolean;
  v_correct int;
  v_wrong   int;
  v_total   int;
  v_score   numeric;
  v_taken   int;
begin
  select * into a from public.exam_attempts where id = p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;

  if a.status <> 'in_progress' then
    select * into r from public.exam_results where user_id = a.user_id and exam_id = a.exam_id;
    return r;
  end if;

  select * into x from public.exams where id = a.exam_id;

  -- Answers sent after the 30s grace window are ignored; only autosaved ones count.
  v_late := now() > a.expires_at + interval '30 seconds';
  v_ans  := case when p_answers is not null and jsonb_typeof(p_answers) = 'object' and not v_late
                 then p_answers else a.answers end;

  select
    count(*) filter (where s.sel is not null and s.sel = s.correct_index),
    count(*) filter (where s.sel is not null and s.sel <> s.correct_index),
    count(*),
    coalesce(sum(s.marks) filter (where s.sel = s.correct_index), 0)
      - coalesce(sum(s.marks) filter (where s.sel is not null and s.sel <> s.correct_index), 0)
        * x.negative_mark_ratio
  into v_correct, v_wrong, v_total, v_score
  from (
    select q.marks, q.correct_index,
           case
             when (v_ans ->> q.id::text) ~ '^[0-9]{1,3}$'
              and (v_ans ->> q.id::text)::int < jsonb_array_length(q.options)
             then (v_ans ->> q.id::text)::int
           end as sel
      from public.questions q
     where q.exam_id = a.exam_id
  ) s;

  v_taken := least(extract(epoch from (now() - a.started_at))::int, x.duration_minutes * 60);

  insert into public.exam_results
    (user_id, exam_id, score, correct_answers, wrong_answers, unanswered, time_taken_seconds)
  values
    (a.user_id, a.exam_id, round(v_score, 2), v_correct, v_wrong,
     v_total - v_correct - v_wrong, v_taken)
  on conflict (user_id, exam_id) do nothing
  returning * into r;

  update public.exam_attempts
     set status = case when now() > a.expires_at then 'expired'::public.attempt_status
                       else 'submitted'::public.attempt_status end,
         submitted_at = now(),
         answers = coalesce(v_ans, '{}'::jsonb)
   where id = a.id;

  if r.id is null then
    select * into r from public.exam_results where user_id = a.user_id and exam_id = a.exam_id;
  end if;
  return r;
end $$;

-- Start (or resume) an attempt. Returns questions WITHOUT correct answers.
create or replace function public.start_exam(p_exam_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := (select auth.uid());
  x     public.exams;
  a     public.exam_attempts;
  v_questions jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into x from public.exams where id = p_exam_id and is_published;
  if not found then raise exception 'exam_not_found'; end if;
  if not public.is_enrolled(x.course_id) then raise exception 'not_enrolled'; end if;

  select * into a from public.exam_attempts where user_id = v_uid and exam_id = p_exam_id;
  if found then
    if a.status <> 'in_progress' then
      raise exception 'already_attempted';
    elsif a.expires_at <= now() then
      perform public._finalize_attempt(a.id);   -- lazily grade abandoned attempts
      raise exception 'already_attempted';
    end if;
  else
    if now() < x.start_time then raise exception 'exam_not_started'; end if;
    if now() > x.end_time   then raise exception 'exam_closed'; end if;
    insert into public.exam_attempts (user_id, exam_id, started_at, expires_at)
    values (v_uid, p_exam_id, now(), now() + make_interval(mins => x.duration_minutes))
    returning * into a;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'text', q.text, 'image_url', q.image_url,
           'options', q.options, 'marks', q.marks) order by q.position, q.id), '[]'::jsonb)
    into v_questions
    from public.questions q where q.exam_id = p_exam_id;

  return jsonb_build_object(
    'attempt_id', a.id,
    'started_at', a.started_at,
    'expires_at', a.expires_at,
    'server_now', now(),                         -- client uses this to correct clock skew
    'duration_minutes', x.duration_minutes,
    'negative_mark_ratio', x.negative_mark_ratio,
    'answers', a.answers,
    'questions', v_questions
  );
end $$;

-- Autosave progress (called every few seconds / on each answer).
create or replace function public.save_answers(p_attempt_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'invalid_answers';
  end if;
  update public.exam_attempts
     set answers = p_answers
   where id = p_attempt_id
     and user_id = (select auth.uid())
     and status = 'in_progress'
     and now() <= expires_at + interval '30 seconds';
end $$;

-- Final submission. Scoring is always computed on the server.
create or replace function public.submit_exam(p_attempt_id uuid, p_answers jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.exam_results;
begin
  if not exists (select 1 from public.exam_attempts
                  where id = p_attempt_id and user_id = (select auth.uid())) then
    raise exception 'attempt_not_found';
  end if;
  r := public._finalize_attempt(p_attempt_id, p_answers);
  return to_jsonb(r);
end $$;

-- Solutions unlock only after the student has submitted AND the exam window has
-- closed, so early finishers cannot leak answers to others still sitting it.
create or replace function public.get_exam_solutions(p_exam_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := (select auth.uid());
  x     public.exams;
  a     public.exam_attempts;
  v_out jsonb;
begin
  select * into x from public.exams where id = p_exam_id;
  if not found then raise exception 'exam_not_found'; end if;

  select * into a from public.exam_attempts where user_id = v_uid and exam_id = p_exam_id;

  if not public.is_staff() then
    if not found or a.status = 'in_progress' or now() < x.end_time then
      raise exception 'solutions_locked';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'text', q.text, 'image_url', q.image_url, 'options', q.options,
           'correct_index', q.correct_index, 'explanation', q.explanation, 'marks', q.marks,
           'selected_index', case when a.answers ->> q.id::text ~ '^[0-9]{1,3}$'
                                  then (a.answers ->> q.id::text)::int end
         ) order by q.position, q.id), '[]'::jsonb)
    into v_out
    from public.questions q where q.exam_id = p_exam_id;
  return v_out;
end $$;

-- National leaderboard for one exam. Shows names only, never phone numbers.
-- The caller's own row is always included even if outside the top N.
create or replace function public.exam_leaderboard(p_exam_id uuid, p_limit int default 100)
returns table (
  place              bigint,
  display_name       text,
  score              numeric,
  correct_answers    int,
  wrong_answers      int,
  time_taken_seconds int,
  is_me              boolean
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  x     public.exams;
begin
  select * into x from public.exams where id = p_exam_id and (is_published or public.is_staff());
  if not found then raise exception 'exam_not_found'; end if;

  if not public.is_staff()
     and now() < x.end_time
     and not exists (select 1 from public.exam_results where exam_id = p_exam_id and user_id = v_uid) then
    raise exception 'leaderboard_locked';
  end if;

  return query
  select t.place, t.display_name, t.score, t.correct_answers, t.wrong_answers,
         t.time_taken_seconds, t.is_me
  from (
    select rank() over (order by r.score desc, r.time_taken_seconds asc) as place,
           coalesce(nullif(btrim(u.name), ''), 'Student') as display_name,
           r.score, r.correct_answers, r.wrong_answers, r.time_taken_seconds,
           (r.user_id = v_uid) as is_me
      from public.exam_results r
      join public.users u on u.id = r.user_id
     where r.exam_id = p_exam_id
  ) t
  where t.place <= greatest(p_limit, 1) or t.is_me
  order by t.place, t.display_name;
end $$;

-- Sweep abandoned attempts. Schedule with pg_cron or a Cloudflare cron trigger
-- calling this through the service role, e.g. every 5 minutes.
create or replace function public.finalize_expired_attempts()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_n  int := 0;
begin
  for v_id in
    select id from public.exam_attempts
     where status = 'in_progress' and expires_at + interval '30 seconds' < now()
     limit 500
  loop
    perform public._finalize_attempt(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ============================== PRIVILEGES ===================================
-- Supabase grants EXECUTE to anon/authenticated by default, so revoke explicitly.

revoke execute on function public._evaluate_coupon(text, uuid, uuid)  from public, anon, authenticated;
revoke execute on function public._finalize_attempt(uuid, jsonb)      from public, anon, authenticated;
revoke execute on function public.finalize_expired_attempts()         from public, anon, authenticated;
grant  execute on function public.finalize_expired_attempts()         to service_role;

revoke execute on function public.mock_purchase_course(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_grant_course(uuid, uuid)               from public, anon;
revoke execute on function public.start_exam(uuid)                             from public, anon;
revoke execute on function public.save_answers(uuid, jsonb)                    from public, anon;
revoke execute on function public.submit_exam(uuid, jsonb)                     from public, anon;
revoke execute on function public.get_exam_solutions(uuid)                     from public, anon;
revoke execute on function public.exam_leaderboard(uuid, int)                  from public, anon;

grant execute on function public.validate_coupon(text, uuid)                   to anon, authenticated;
grant execute on function public.mock_purchase_course(uuid, text, text, text)  to authenticated;
grant execute on function public.admin_grant_course(uuid, uuid)                to authenticated;
grant execute on function public.start_exam(uuid)                              to authenticated;
grant execute on function public.save_answers(uuid, jsonb)                     to authenticated;
grant execute on function public.submit_exam(uuid, jsonb)                      to authenticated;
grant execute on function public.get_exam_solutions(uuid)                      to authenticated;
grant execute on function public.exam_leaderboard(uuid, int)                   to authenticated;
