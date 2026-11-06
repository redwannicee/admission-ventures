-- =============================================================================
-- Admission Ventures 0006: examination engine
-- Source: spec 9.3, 13 and FR-10..FR-14.
-- Everything that matters is decided here, on the server, with server time:
-- eligibility, attempt limits, deadlines, answer validation, scoring, review policy.
-- =============================================================================

-- What the student may see while taking the quiz: no answer key, no explanations.
create or replace function private.attempt_payload(p_attempt uuid, p_resumed boolean)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'attempt_id', a.id, 'quiz_id', a.quiz_id, 'attempt_number', a.attempt_number,
    'status', a.status, 'started_at', a.started_at, 'deadline_at', a.deadline_at,
    'server_now', now(), 'resumed', p_resumed,
    'title', s.snapshot #>> '{quiz,title}',
    'duration_seconds', (s.snapshot #>> '{quiz,duration_seconds}')::int,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', q ->> 'question_id', 'position', (q ->> 'position')::int,
               'prompt', q ->> 'prompt', 'options', q -> 'options',
               'marks', (q ->> 'marks')::numeric, 'negative_marks', (q ->> 'negative_marks')::numeric)
             order by (q ->> 'position')::int), '[]'::jsonb)
        from jsonb_array_elements(s.snapshot -> 'questions') q),
    'answers', (
      select coalesce(jsonb_object_agg(qa.question_id::text, qa.selected_answer), '{}'::jsonb)
        from public.quiz_answers qa where qa.attempt_id = a.id and qa.selected_answer is not null)
  )
  from public.quiz_attempts a
  join private.attempt_snapshots s on s.attempt_id = a.id
  where a.id = p_attempt
$$;

-- Scores an attempt from the snapshot taken at start, so later edits to questions or
-- marking rules cannot change historical results. Safe to call twice (no-op the second time).
create or replace function private.finalize_attempt(p_attempt uuid, p_status text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a         public.quiz_attempts;
  v_snap    jsonb;
  q         jsonb;
  v_sel     jsonb;
  v_ok      boolean;
  v_award   numeric;
  v_score   numeric := 0;
  v_total   numeric := 0;
begin
  select * into a from public.quiz_attempts where id = p_attempt for update;
  if not found or a.status <> 'in_progress' then return; end if;
  select snapshot into v_snap from private.attempt_snapshots where attempt_id = p_attempt;

  for q in select * from jsonb_array_elements(v_snap -> 'questions') loop
    v_total := v_total + (q ->> 'marks')::numeric;
    select selected_answer into v_sel from public.quiz_answers
     where attempt_id = p_attempt and question_id = (q ->> 'question_id')::uuid;

    if v_sel is null then
      v_ok := false; v_award := 0;                                   -- unanswered
    elsif (v_sel ->> 'key') = (q -> 'correct_answer' ->> 'key') then
      v_ok := true;  v_award := (q ->> 'marks')::numeric;            -- correct
    else
      v_ok := false; v_award := -(q ->> 'negative_marks')::numeric;  -- wrong: negative marking
    end if;

    insert into public.quiz_answers (attempt_id, question_id, selected_answer, is_correct, awarded_marks)
    values (p_attempt, (q ->> 'question_id')::uuid, v_sel, v_ok, v_award)
    on conflict (attempt_id, question_id) do update
       set is_correct = excluded.is_correct, awarded_marks = excluded.awarded_marks;
    v_score := v_score + v_award;
  end loop;

  update public.quiz_attempts
     set status = p_status, submitted_at = least(now(), a.deadline_at),
         score = round(v_score, 2), total_marks = v_total
   where id = p_attempt;
end $$;

-- Result for a finished attempt; the answer review is released only as the policy allows.
create or replace function private.result_json(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  a         public.quiz_attempts;
  z         public.quizzes;
  v_snap    jsonb;
  v_review  boolean;
  v_pass    numeric;
begin
  select * into a from public.quiz_attempts where id = p_attempt;
  if a.status = 'in_progress' then raise exception 'attempt_not_finished'; end if;
  select * into z from public.quizzes where id = a.quiz_id;
  select snapshot into v_snap from private.attempt_snapshots where attempt_id = p_attempt;
  v_pass := coalesce((v_snap #>> '{quiz,pass_marks}')::numeric, 0);

  v_review := a.status in ('submitted', 'expired') and (
                z.review_policy = 'after_submit'
                or (z.review_policy = 'after_close' and z.closes_at is not null and now() >= z.closes_at));

  return jsonb_build_object(
    'attempt_id', a.id, 'quiz_id', a.quiz_id, 'quiz_title', v_snap #>> '{quiz,title}',
    'status', a.status, 'started_at', a.started_at, 'submitted_at', a.submitted_at,
    'score', a.score, 'total_marks', a.total_marks, 'pass_marks', v_pass,
    'passed', coalesce(a.score >= v_pass, false),
    'correct_count',    (select count(*) from public.quiz_answers where attempt_id = a.id and is_correct),
    'wrong_count',      (select count(*) from public.quiz_answers where attempt_id = a.id and is_correct = false and selected_answer is not null),
    'unanswered_count', (select count(*) from public.quiz_answers where attempt_id = a.id and selected_answer is null),
    'review_policy', z.review_policy, 'review_available', v_review,
    'review', case when not v_review then null else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'question_id', q ->> 'question_id', 'position', (q ->> 'position')::int,
               'prompt', q ->> 'prompt', 'options', q -> 'options', 'marks', (q ->> 'marks')::numeric,
               'selected_answer', qa.selected_answer, 'correct_answer', q -> 'correct_answer',
               'explanation', q ->> 'explanation', 'is_correct', qa.is_correct,
               'awarded_marks', qa.awarded_marks)
             order by (q ->> 'position')::int), '[]'::jsonb)
        from jsonb_array_elements(v_snap -> 'questions') q
        left join public.quiz_answers qa
               on qa.attempt_id = a.id and qa.question_id = (q ->> 'question_id')::uuid) end
  );
end $$;

-- ---------------------------------------------------------------------------
-- start-quiz
-- ---------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_student uuid, p_quiz_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  z        public.quizzes;
  a        public.quiz_attempts;
  v_used   int;
  v_next   int;
  v_snap   jsonb;
  v_total  numeric;
begin
  if p_student is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('quiz:' || p_student::text || p_quiz_id::text));

  select * into z from public.quizzes where id = p_quiz_id and published;
  if not found then raise exception 'quiz_not_found'; end if;
  if z.course_id is not null and not private.has_active_enrollment(p_student, z.course_id) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;

  -- Resume an unfinished attempt (the same deadline applies), or close it if time ran out.
  select * into a from public.quiz_attempts
   where quiz_id = p_quiz_id and student_id = p_student and status = 'in_progress'
   order by attempt_number desc limit 1 for update;
  if found then
    if now() <= a.deadline_at then
      return private.attempt_payload(a.id, true);
    end if;
    perform private.finalize_attempt(a.id, 'expired');
  end if;

  if z.opens_at is not null and now() < z.opens_at then raise exception 'quiz_not_open'; end if;
  if z.closes_at is not null and now() > z.closes_at then raise exception 'quiz_closed'; end if;

  select count(*), coalesce(max(attempt_number), 0) + 1 into v_used, v_next
    from public.quiz_attempts where quiz_id = p_quiz_id and student_id = p_student and status <> 'voided';
  if z.max_attempts is not null and v_used >= z.max_attempts then raise exception 'attempt_limit_reached'; end if;

  select jsonb_agg(jsonb_build_object(
           'question_id', qq.question_id, 'position', qq.position, 'marks', qq.marks,
           'negative_marks', qq.negative_marks, 'prompt', qs.prompt, 'options', qs.options,
           'correct_answer', qs.correct_answer, 'explanation', qs.explanation)
         order by qq.position),
         coalesce(sum(qq.marks), 0)
    into v_snap, v_total
    from public.quiz_questions qq
    join public.questions qs on qs.id = qq.question_id and qs.status = 'published'
   where qq.quiz_id = p_quiz_id;
  if v_snap is null then raise exception 'quiz_has_no_questions'; end if;

  insert into public.quiz_attempts (quiz_id, student_id, attempt_number, status, started_at, deadline_at, total_marks)
  values (p_quiz_id, p_student, v_next, 'in_progress', now(), now() + make_interval(secs => z.duration_seconds), v_total)
  returning * into a;

  insert into private.attempt_snapshots (attempt_id, snapshot)
  values (a.id, jsonb_build_object(
    'quiz', jsonb_build_object('title', z.title, 'duration_seconds', z.duration_seconds,
                               'pass_marks', z.pass_marks, 'total_marks', v_total),
    'questions', v_snap));

  return private.attempt_payload(a.id, false);
end $$;

-- ---------------------------------------------------------------------------
-- save-quiz-answer: ownership, state, deadline and option validity are all checked.
-- p_answer = null clears the answer.
-- ---------------------------------------------------------------------------
create or replace function public.save_quiz_answer(p_student uuid, p_attempt uuid, p_question uuid, p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a        public.quiz_attempts;
  v_q      jsonb;
  v_key    text;
begin
  select * into a from public.quiz_attempts where id = p_attempt and student_id = p_student for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed'; end if;
  if now() > a.deadline_at then raise exception 'deadline_passed'; end if;

  select q into v_q
    from private.attempt_snapshots s, jsonb_array_elements(s.snapshot -> 'questions') q
   where s.attempt_id = p_attempt and (q ->> 'question_id')::uuid = p_question;
  if v_q is null then raise exception 'question_not_in_attempt'; end if;

  if p_answer is null or jsonb_typeof(p_answer) = 'null' then
    delete from public.quiz_answers where attempt_id = p_attempt and question_id = p_question;
  else
    if jsonb_typeof(p_answer) <> 'object' then raise exception 'invalid_answer'; end if;
    v_key := p_answer ->> 'key';
    if v_key is null or not exists (
         select 1 from jsonb_array_elements(v_q -> 'options') o where o ->> 'key' = v_key) then
      raise exception 'invalid_answer';
    end if;
    insert into public.quiz_answers (attempt_id, question_id, selected_answer, answered_at)
    values (p_attempt, p_question, jsonb_build_object('key', v_key), now())
    on conflict (attempt_id, question_id) do update
       set selected_answer = excluded.selected_answer, answered_at = now();
  end if;
  return jsonb_build_object('saved', true, 'deadline_at', a.deadline_at, 'server_now', now());
end $$;

-- ---------------------------------------------------------------------------
-- submit-quiz: atomic and idempotent. A second call returns the stored result.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_student uuid, p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.quiz_attempts;
begin
  select * into a from public.quiz_attempts where id = p_attempt and student_id = p_student for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if a.status = 'in_progress' then
    perform private.finalize_attempt(p_attempt, case when now() > a.deadline_at then 'expired' else 'submitted' end);
  end if;
  return private.result_json(p_attempt);
end $$;

-- Sweeper for abandoned attempts (scheduled job).
create or replace function public.finalize_expired_attempts() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_n int := 0;
begin
  for v_id in select id from public.quiz_attempts
               where status = 'in_progress' and deadline_at < now() order by deadline_at limit 500 loop
    perform private.finalize_attempt(v_id, 'expired');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Student-facing reads (callable by signed-in users; they authorize inside)
-- ---------------------------------------------------------------------------
create or replace function public.my_quiz_result(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.quiz_attempts;
begin
  select * into a from public.quiz_attempts where id = p_attempt and student_id = (select auth.uid());
  if not found then raise exception 'attempt_not_found'; end if;
  if a.status = 'in_progress' and now() > a.deadline_at then
    perform private.finalize_attempt(a.id, 'expired');
  end if;
  return private.result_json(p_attempt);
end $$;

create or replace function public.student_list_quizzes()
returns table (quiz_id uuid, title text, description text, course_id uuid, course_title text,
               duration_seconds int, total_marks numeric, pass_marks numeric, max_attempts int,
               opens_at timestamptz, closes_at timestamptz, question_count bigint, attempts_used bigint,
               best_score numeric, in_progress_attempt_id uuid, last_finished_attempt_id uuid,
               availability text)
language sql stable security definer set search_path = public, pg_temp as $$
  select z.id, z.title, z.description, z.course_id, c.title, z.duration_seconds, z.total_marks,
         z.pass_marks, z.max_attempts, z.opens_at, z.closes_at,
         (select count(*) from public.quiz_questions qq join public.questions qs on qs.id = qq.question_id
           where qq.quiz_id = z.id and qs.status = 'published'),
         (select count(*) from public.quiz_attempts a where a.quiz_id = z.id and a.student_id = (select auth.uid()) and a.status <> 'voided'),
         (select max(a.score) from public.quiz_attempts a where a.quiz_id = z.id and a.student_id = (select auth.uid()) and a.status in ('submitted','expired')),
         (select a.id from public.quiz_attempts a where a.quiz_id = z.id and a.student_id = (select auth.uid()) and a.status = 'in_progress' and a.deadline_at > now() limit 1),
         (select a.id from public.quiz_attempts a where a.quiz_id = z.id and a.student_id = (select auth.uid()) and a.status in ('submitted','expired') order by a.started_at desc limit 1),
         case
           when z.opens_at is not null and now() < z.opens_at then 'not_open_yet'
           when z.closes_at is not null and now() > z.closes_at then 'closed'
           when z.max_attempts is not null and
                (select count(*) from public.quiz_attempts a where a.quiz_id = z.id and a.student_id = (select auth.uid()) and a.status <> 'voided') >= z.max_attempts
                then 'attempts_exhausted'
           else 'open' end
    from public.quizzes z
    left join public.courses c on c.id = z.course_id
   where z.published
     and (z.course_id is null or private.has_active_enrollment((select auth.uid()), z.course_id))
   order by z.opens_at nulls last, z.title
$$;

grant execute on function public.my_quiz_result(uuid)     to authenticated;
grant execute on function public.student_list_quizzes()   to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.start_quiz_attempt(uuid, uuid)',
    'public.save_quiz_answer(uuid, uuid, uuid, jsonb)',
    'public.submit_quiz_attempt(uuid, uuid)',
    'public.finalize_expired_attempts()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
