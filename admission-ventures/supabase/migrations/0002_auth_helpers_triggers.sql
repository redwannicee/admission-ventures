-- =============================================================================
-- Admission Ventures 0002: identity helpers, integrity triggers, audit trail
-- Source: spec sections 4, 7.1, 8.2, 12, 13 and FR-15.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger trg_courses_updated_at before update on public.courses
  for each row execute function private.set_updated_at();
create trigger trg_progress_updated_at before update on public.lesson_progress
  for each row execute function private.set_updated_at();

-- Bangladeshi mobile numbers are stored as +8801XXXXXXXXX so the unique index is meaningful.
create or replace function public.normalize_bd_phone(p_phone text) returns text
language plpgsql immutable as $$
declare d text;
begin
  if p_phone is null or btrim(p_phone) = '' then return null; end if;
  d := regexp_replace(p_phone, '[\s\-()]', '', 'g');
  if left(d, 1) = '+' then d := substr(d, 2); end if;
  if left(d, 3) = '880' then d := substr(d, 4);
  elsif left(d, 1) = '0' then d := substr(d, 2);
  end if;
  if d !~ '^1[3-9][0-9]{8}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  return '+880' || d;
end $$;

create or replace function private.normalize_profile_phone() returns trigger
language plpgsql as $$
begin
  new.phone := public.normalize_bd_phone(new.phone);
  return new;
end $$;

create trigger trg_profiles_phone before insert or update of phone on public.profiles
  for each row execute function private.normalize_profile_phone();

-- ---------------------------------------------------------------------------
-- Profile creation on sign-up. The role is NEVER read from user metadata (spec 8.2).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name  text;
  v_phone text;
begin
  v_name := left(coalesce(
              nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
              nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
              'Student'), 120);
  begin
    v_phone := public.normalize_bd_phone(new.raw_user_meta_data ->> 'phone');
  exception when others then
    v_phone := null;   -- a bad optional phone must never block registration
  end;

  begin
    insert into public.profiles (id, full_name, phone, role)
    values (new.id, v_name, v_phone, 'student')
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, full_name, role)
    values (new.id, v_name, 'student')
    on conflict (id) do nothing;
  end;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helpers. They read the role from public.profiles, never from the
-- browser or user_metadata. Admin MFA uses the aal claim of the verified JWT.
-- ---------------------------------------------------------------------------
create or replace function private.setting(p_key text) returns text
language sql stable security definer set search_path = private, pg_temp as $$
  select value from private.app_settings where key = p_key
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select p.role in ('admin', 'super_admin')
       and (
            (p.role = 'admin' and coalesce(private.setting('require_admin_mfa'), 'true') <> 'true')
            or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       )
      from public.profiles p
     where p.id = (select auth.uid())
  ), false)
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select p.role = 'super_admin' and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      from public.profiles p
     where p.id = (select auth.uid())
  ), false)
$$;

-- Tells the UI whether the signed-in staff member must complete an MFA challenge.
create or replace function public.admin_mfa_required() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select p.role = 'super_admin'
        or (p.role in ('admin') and coalesce(private.setting('require_admin_mfa'), 'true') = 'true')
      from public.profiles p
     where p.id = (select auth.uid())
  ), false)
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = (select auth.uid())
$$;

-- Canonical access rule (spec section 2.4): an active, unexpired enrollment.
create or replace function private.has_active_enrollment(p_student uuid, p_course uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.enrollments e
     where e.student_id = p_student
       and e.course_id = p_course
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
  )
$$;

-- Used by RLS policies, so the signed-in user is read from auth.uid().
create or replace function public.i_am_enrolled(p_course uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select private.has_active_enrollment((select auth.uid()), p_course)
$$;

-- ---------------------------------------------------------------------------
-- Status machines (spec section 12): the database refuses illegal transitions.
-- ---------------------------------------------------------------------------
create or replace function private.guard_order() returns trigger
language plpgsql as $$
begin
  if new.student_id is distinct from old.student_id
     or new.currency is distinct from old.currency
     or new.subtotal is distinct from old.subtotal
     or new.discount_amount is distinct from old.discount_amount
     or new.total_amount is distinct from old.total_amount
     or new.order_reference is distinct from old.order_reference then
    raise exception 'order_financial_fields_are_immutable' using errcode = '23514';
  end if;
  if new.status = old.status then return new; end if;
  if (old.status = 'pending' and new.status in ('paid', 'failed', 'cancelled', 'expired'))
     or (old.status = 'paid' and new.status = 'refunded') then
    return new;
  end if;
  raise exception 'invalid_order_transition: % -> %', old.status, new.status using errcode = '23514';
end $$;

create trigger trg_orders_guard before update on public.orders
  for each row execute function private.guard_order();

create or replace function private.guard_payment() returns trigger
language plpgsql as $$
begin
  if new.order_id is distinct from old.order_id or new.amount is distinct from old.amount
     or new.gateway is distinct from old.gateway then
    raise exception 'payment_fields_are_immutable' using errcode = '23514';
  end if;
  if new.status = old.status then return new; end if;
  if (old.status = 'initiated' and new.status in ('pending', 'success', 'failed', 'cancelled'))
     or (old.status = 'pending' and new.status in ('success', 'failed', 'cancelled'))
     or (old.status = 'success' and new.status = 'refunded') then
    return new;
  end if;
  raise exception 'invalid_payment_transition: % -> %', old.status, new.status using errcode = '23514';
end $$;

create trigger trg_payments_guard before update on public.payments
  for each row execute function private.guard_payment();

-- Purchase snapshots are immutable (spec 6.3).
create or replace function private.block_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is immutable', tg_table_name using errcode = '23514';
end $$;

create trigger trg_order_items_immutable before update or delete on public.order_items
  for each row execute function private.block_change();

-- ---------------------------------------------------------------------------
-- Question and quiz integrity (spec 13.1: "strict server-side validation")
-- ---------------------------------------------------------------------------
create or replace function private.validate_question() returns trigger
language plpgsql as $$
declare
  v_keys text[];
begin
  if jsonb_typeof(new.options) is distinct from 'array'
     or jsonb_array_length(new.options) < 2 or jsonb_array_length(new.options) > 10 then
    raise exception 'invalid_options' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.options) o
     where jsonb_typeof(o) <> 'object'
        or coalesce(btrim(o ->> 'key'), '') = ''
        or length(o ->> 'key') > 10
        or coalesce(btrim(o ->> 'text'), '') = ''
  ) then
    raise exception 'invalid_options' using errcode = '22023';
  end if;
  select array_agg(o ->> 'key') into v_keys from jsonb_array_elements(new.options) o;
  if (select count(distinct k) from unnest(v_keys) k) <> array_length(v_keys, 1) then
    raise exception 'duplicate_option_keys' using errcode = '22023';
  end if;
  if jsonb_typeof(new.correct_answer) is distinct from 'object'
     or not ((new.correct_answer ->> 'key') = any (v_keys)) then
    raise exception 'invalid_correct_answer' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger trg_questions_validate before insert or update on public.questions
  for each row execute function private.validate_question();

create or replace function private.validate_quiz() returns trigger
language plpgsql as $$
begin
  if new.review_policy = 'after_close' and new.closes_at is null then
    raise exception 'review_after_close_requires_closes_at' using errcode = '23514';
  end if;
  if new.published and (tg_op = 'INSERT' or not old.published)
     and not exists (select 1 from public.quiz_questions where quiz_id = new.id) then
    raise exception 'cannot_publish_quiz_without_questions' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger trg_quizzes_validate before insert or update on public.quizzes
  for each row execute function private.validate_quiz();

-- total_marks always equals the sum of assigned question marks.
create or replace function private.sync_quiz_total() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_quiz uuid := coalesce(new.quiz_id, old.quiz_id);
        v_total numeric;
begin
  select coalesce(sum(marks), 0) into v_total from public.quiz_questions where quiz_id = v_quiz;
  update public.quizzes
     set total_marks = v_total, pass_marks = least(pass_marks, v_total)
   where id = v_quiz;
  return null;
end $$;

create trigger trg_quiz_questions_total after insert or update or delete on public.quiz_questions
  for each row execute function private.sync_quiz_total();

-- Spec 6.5: content with enrollment history is archived, not deleted.
create or replace function private.block_delete_with_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_course uuid;
begin
  if tg_table_name = 'course_modules' then
    v_course := old.course_id;
  else
    select m.course_id into v_course from public.course_modules m where m.id = old.module_id;
  end if;
  if v_course is not null and exists (select 1 from public.enrollments where course_id = v_course) then
    raise exception 'archive_instead_of_delete' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger trg_modules_block_delete before delete on public.course_modules
  for each row execute function private.block_delete_with_history();
create trigger trg_lessons_block_delete before delete on public.lessons
  for each row execute function private.block_delete_with_history();

-- ---------------------------------------------------------------------------
-- Audit trail (FR-15). Append-only. Never stores passwords, tokens, card data or answer keys:
-- only the names of changed columns plus before/after of an explicit allow-list.
-- ---------------------------------------------------------------------------
create or replace function private.write_audit(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end $$;

create or replace function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor   uuid := coalesce((select auth.uid()), nullif(current_setting('app.actor_id', true), '')::uuid);
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_meta    jsonb := '{}'::jsonb;
  v_id      text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_id := v_old ->> 'id';
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id := v_new ->> 'id';
    v_meta := jsonb_build_object('actor_kind', case when v_actor is null then 'system' else 'user' end);
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id := v_new ->> 'id';
    select array_agg(k.k order by k.k) into v_changed
      from jsonb_object_keys(v_new) as k(k)
     where (v_new -> k.k) is distinct from (v_old -> k.k) and k.k <> 'updated_at';
    if v_changed is null then return null; end if;
    select coalesce(jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k)), '{}'::jsonb)
      into v_meta
      from unnest(v_changed) as k
     where k in ('status','role','published','price_amount','archived_at','expires_at','review_policy');
    v_meta := v_meta || jsonb_build_object(
      'changed_columns', to_jsonb(v_changed),
      'actor_kind', case when v_actor is null then 'system' else 'user' end);
  end if;

  perform private.write_audit(v_actor, lower(tg_op), tg_table_name, v_id, v_meta);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['courses','course_modules','lessons','enrollments','orders','payments',
                           'question_categories','questions','quizzes','quiz_questions','announcements']
  loop
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
         for each row execute function private.audit_row_change()', t);
  end loop;
end $$;

-- Role changes are the most sensitive profile update.
create trigger trg_audit_profiles_role after update of role on public.profiles
  for each row execute function private.audit_row_change();

create or replace function private.audit_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs_are_append_only' using errcode = '42501';
end $$;

create trigger trg_audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.audit_append_only();
