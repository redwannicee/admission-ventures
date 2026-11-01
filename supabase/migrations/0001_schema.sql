-- =============================================================================
-- Admission Ventures — 0001: schema
-- Run order: 0001 → 0002 (RLS) → 0003 (functions) → 0004 (seed, optional)
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
create type public.user_role         as enum ('student', 'data_entry', 'mentor', 'super_admin');
create type public.discount_type     as enum ('percent', 'flat');
create type public.enrollment_status as enum ('pending', 'active', 'cancelled', 'refunded');
create type public.exam_type         as enum ('daily', 'weekly', 'subject_final', 'paper_final');
create type public.attempt_status    as enum ('in_progress', 'submitted', 'expired');

-- ---------- Generic helpers --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- users ------------------------------------------------------------
-- id mirrors auth.users.id so RLS can use auth.uid(). phone_number is the login
-- identity (unique, E.164, Bangladesh mobile only).
create table public.users (
  id               uuid primary key references auth.users (id) on delete cascade,
  phone_number     text not null unique check (phone_number ~ '^\+8801[3-9][0-9]{8}$'),
  name             text,
  role             public.user_role not null default 'student',
  preferred_locale text not null default 'bn' check (preferred_locale in ('en', 'bn')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- Create the profile row automatically when a phone user signs up via OTP.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is null or new.phone = '' then
    return new;
  end if;
  insert into public.users (id, phone_number)
  values (new.id, case when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Role helpers (used by RLS and functions) -------------------------
create or replace function public.auth_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = (select auth.uid())
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'super_admin', false)
$$;

create or replace function public.is_mentor_or_above()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('mentor', 'super_admin'), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() <> 'student', false)
$$;

-- Students may edit their own name/locale but never role or phone.
create or replace function public.guard_user_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for service role / SQL editor, which may change anything.
  if (select auth.uid()) is not null and not public.is_super_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.phone_number is distinct from old.phone_number then
      raise exception 'forbidden_field_update' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger users_guard before update on public.users
  for each row execute function public.guard_user_update();

-- ---------- courses ----------------------------------------------------------
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en         text not null,
  title_bn         text not null,
  description_en   text,
  description_bn   text,
  category         text,                       -- e.g. arts | science | commerce
  price            numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= price),
  thumbnail_url    text,
  features         jsonb not null default '[]'::jsonb,  -- [{ "en": "...", "bn": "..." }]
  syllabus         jsonb not null default '[]'::jsonb,  -- [{ "title_en", "title_bn", "items": [...] }]
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index courses_active_sort_idx on public.courses (is_active, sort_order);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------- coupons ----------------------------------------------------------
-- Codes are stored upper-case; lookups upper-case the input (no citext needed).
create table public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  description      text,
  discount_type    public.discount_type not null,
  discount_value   numeric(10,2) not null check (discount_value > 0),
  max_discount     numeric(10,2) check (max_discount is null or max_discount > 0), -- cap for percent coupons
  min_order_amount numeric(10,2) not null default 0 check (min_order_amount >= 0),
  max_uses         int check (max_uses is null or max_uses > 0),
  per_user_limit   int not null default 1 check (per_user_limit > 0),
  used_count       int not null default 0 check (used_count >= 0),
  starts_at        timestamptz not null default now(),
  expiry_date      timestamptz,
  course_id        uuid references public.courses (id) on delete cascade, -- null = any course
  is_active        boolean not null default true,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (expiry_date is null or expiry_date > starts_at)
);

-- ---------- enrollments ------------------------------------------------------
create table public.enrollments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete restrict,
  original_price  numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  amount_paid     numeric(10,2) not null default 0,
  coupon_id       uuid references public.coupons (id) on delete set null,
  coupon_used     text,                         -- code snapshot, survives coupon deletion
  status          public.enrollment_status not null default 'pending',
  payment_method  text,                         -- mock | bkash | sslcommerz | manual
  payment_ref     text,
  granted_by      uuid references public.users (id) on delete set null,
  enrolled_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- A student can hold only one active enrollment per course.
create unique index enrollments_one_active_per_course
  on public.enrollments (user_id, course_id) where status = 'active';
create index enrollments_user_idx   on public.enrollments (user_id, status);
create index enrollments_course_idx on public.enrollments (course_id, status);
create trigger enrollments_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

create table public.coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  enrollment_id   uuid references public.enrollments (id) on delete set null,
  discount_amount numeric(10,2) not null,
  created_at      timestamptz not null default now()
);
create index coupon_redemptions_coupon_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- ---------- exams ------------------------------------------------------------
create table public.exams (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses (id) on delete cascade,
  title_en            text not null,
  title_bn            text not null,
  type                public.exam_type not null,
  subject             text,
  instructions_en     text,
  instructions_bn     text,
  start_time          timestamptz not null,
  end_time            timestamptz not null,
  duration_minutes    int not null check (duration_minutes > 0),
  total_marks         numeric(7,2) not null default 0,   -- maintained by trigger from questions
  negative_mark_ratio numeric(4,3) not null default 0.25 check (negative_mark_ratio between 0 and 1),
  is_published        boolean not null default false,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_time > start_time)
);
create index exams_course_idx on public.exams (course_id, is_published, start_time);
create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

-- ---------- questions --------------------------------------------------------
-- `text` and `explanation` hold rich text (HTML/Markdown) with LaTeX for KaTeX rendering.
-- Students never read this table directly: correct_index is only exposed through
-- functions in 0003 (after submission and exam close).
create table public.questions (
  id            bigint generated always as identity primary key,
  exam_id       uuid not null references public.exams (id) on delete cascade,
  position      int not null default 0,
  text          text not null,
  image_url     text,
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_index int not null check (correct_index >= 0 and correct_index < jsonb_array_length(options)),
  explanation   text,
  marks         numeric(5,2) not null default 1 check (marks > 0),
  created_at    timestamptz not null default now()
);
create index questions_exam_idx on public.questions (exam_id, position, id);

create or replace function public.sync_exam_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exam uuid := coalesce(new.exam_id, old.exam_id);
begin
  update public.exams
     set total_marks = (select coalesce(sum(marks), 0) from public.questions where exam_id = v_exam)
   where id = v_exam;
  return null;
end $$;

create trigger questions_sync_total
  after insert or update or delete on public.questions
  for each row execute function public.sync_exam_total();

-- ---------- exam_attempts (server-side timer integrity) ----------------------
create table public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  exam_id      uuid not null references public.exams (id) on delete cascade,
  started_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  submitted_at timestamptz,
  answers      jsonb not null default '{}'::jsonb,   -- { "<question_id>": <option_index> }
  status       public.attempt_status not null default 'in_progress',
  unique (user_id, exam_id)                           -- one ranked attempt per exam
);
create index exam_attempts_expiry_idx on public.exam_attempts (status, expires_at);

-- ---------- exam_results -----------------------------------------------------
create table public.exam_results (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  exam_id            uuid not null references public.exams (id) on delete cascade,
  score              numeric(8,2) not null,
  correct_answers    int not null default 0,
  wrong_answers      int not null default 0,
  unanswered         int not null default 0,
  time_taken_seconds int not null default 0,
  submitted_at       timestamptz not null default now(),
  unique (user_id, exam_id)
);
create index exam_results_leaderboard_idx
  on public.exam_results (exam_id, score desc, time_taken_seconds asc);
create index exam_results_user_idx on public.exam_results (user_id, submitted_at desc);

-- ---------- course_materials (PDFs in Supabase Storage) ----------------------
create table public.course_materials (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title_en     text not null,
  title_bn     text not null,
  storage_path text not null,                    -- '<course_id>/<file>.pdf' in bucket 'materials'
  size_bytes   bigint,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index course_materials_course_idx on public.course_materials (course_id, sort_order);

-- ---------- landing page content ---------------------------------------------
create table public.mentors (
  id            uuid primary key default gen_random_uuid(),
  name_en       text not null,
  name_bn       text not null,
  institution   text not null,                   -- DU | BUET | RU | Medical ...
  bio_en        text,
  bio_bn        text,
  photo_url     text,
  sort_order    int not null default 0,
  is_published  boolean not null default true
);

create table public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  student_name  text not null,
  achievement_en text,                           -- e.g. "Hall of Fame, DU 'Ka' unit"
  achievement_bn text,
  quote_en      text,
  quote_bn      text,
  photo_url     text,
  sort_order    int not null default 0,
  is_published  boolean not null default true
);
