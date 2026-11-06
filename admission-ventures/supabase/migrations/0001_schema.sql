-- =============================================================================
-- Admission Ventures 0001: schema, constraints, indexes
-- Source: Specification v1.0, sections 6, 7 and Appendix A.
-- Additions beyond Appendix A are marked "ADDED" with the reason.
-- =============================================================================
create extension if not exists pgcrypto;

-- ADDED: private schema for data that must never be reachable through the API
-- (answer snapshots, settings). No grants are given to anon/authenticated.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ADDED: spec section 8 says "grant only required SQL privileges". Supabase grants
-- everything by default, so default privileges are removed for objects created from now on.
-- Explicit grants live in 0003_rls_policies.sql.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Identity and catalog
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  avatar_path text,
  role        text not null default 'student'
              check (role in ('student','instructor','admin','super_admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.courses (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text not null unique,
  description    text,
  thumbnail_path text,
  price_amount   bigint not null default 0 check (price_amount >= 0),
  currency       char(3) not null default 'BDT',
  published      boolean not null default false,
  archived_at    timestamptz,   -- ADDED: FR-03 "archive"; spec 6.5 prefers archive over delete
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  description text,
  position    integer not null default 0 check (position >= 0),
  published   boolean not null default false,
  unique (course_id, position)
);

create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.course_modules(id) on delete cascade,
  title            text not null,
  description      text,
  video_provider   text,
  video_ref        text,
  material_path    text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  position         integer not null default 0 check (position >= 0),
  is_free_preview  boolean not null default false,
  published        boolean not null default false,
  unique (module_id, position)
);

create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete restrict,
  course_id   uuid not null references public.courses(id) on delete restrict,
  status      text not null default 'pending'
              check (status in ('pending','active','expired','cancelled','refunded')),
  source      text not null default 'purchase',
  enrolled_at timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (student_id, course_id),
  check (expires_at is null or enrolled_at is null or expires_at > enrolled_at)
);

create table public.lesson_progress (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references public.profiles(id) on delete cascade,
  lesson_id             uuid not null references public.lessons(id) on delete cascade,
  completed             boolean not null default false,
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed_at          timestamptz,
  updated_at            timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- Commerce
-- ---------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  student_id      uuid not null references public.profiles(id) on delete restrict,
  currency        char(3) not null default 'BDT',
  subtotal        bigint not null check (subtotal >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  total_amount    bigint not null check (total_amount >= 0),
  status          text not null default 'pending'
                  check (status in ('pending','paid','failed','cancelled','expired','refunded')),
  idempotency_key text,         -- ADDED: spec section 10 "idempotency keys for order creation"
  expires_at      timestamptz,  -- ADDED: pending orders expire (section 12 lists "expired")
  paid_at         timestamptz,  -- ADDED: reporting
  created_at      timestamptz not null default now(),
  check (discount_amount <= subtotal),
  check (total_amount = subtotal - discount_amount)
);
create unique index uq_orders_student_idempotency
  on public.orders (student_id, idempotency_key) where idempotency_key is not null;

create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete restrict,
  course_id           uuid not null references public.courses(id) on delete restrict,
  item_title_snapshot text not null,
  unit_price          bigint not null check (unit_price >= 0),
  quantity            integer not null default 1 check (quantity > 0),
  line_total          bigint not null check (line_total = unit_price * quantity),
  unique (order_id, course_id)
);

create table public.payments (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders(id) on delete restrict,
  gateway                text not null,
  gateway_transaction_id text,
  amount                 bigint not null check (amount >= 0),
  status                 text not null check (status in
                           ('initiated','pending','success','failed','cancelled','refunded')),
  verified_at            timestamptz,
  created_at             timestamptz not null default now()
);
create unique index uq_payment_gateway_transaction
  on public.payments (gateway, gateway_transaction_id) where gateway_transaction_id is not null;

create table public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references public.payments(id) on delete restrict,
  gateway_event_id  text,
  event_type        text not null,
  payload_digest    text,
  processing_status text not null default 'received'
                    check (processing_status in ('received','processed','rejected','failed')),
  received_at       timestamptz not null default now(),
  processed_at      timestamptz
);
create unique index uq_payment_event_gateway_id
  on public.payment_events (gateway_event_id) where gateway_event_id is not null;

-- ---------------------------------------------------------------------------
-- Question bank and examinations
-- ---------------------------------------------------------------------------
create table public.question_categories (
  id        uuid primary key default gen_random_uuid(),
  parent_id uuid references public.question_categories(id) on delete restrict,
  name      text not null,
  slug      text not null unique,
  active    boolean not null default true
);

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.question_categories(id) on delete set null,
  question_type text not null default 'single_choice' check (question_type in ('single_choice')),
  prompt        text not null,
  options       jsonb not null,
  correct_answer jsonb not null,   -- never selectable by API roles, see 0003
  explanation   text,
  difficulty    text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.quizzes (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid references public.courses(id) on delete restrict,
  title            text not null,
  description      text,
  duration_seconds integer not null check (duration_seconds > 0),
  total_marks      numeric(10,2) not null check (total_marks >= 0),
  pass_marks       numeric(10,2) not null default 0
                   check (pass_marks >= 0 and pass_marks <= total_marks),
  negative_mark    numeric(10,2) not null default 0 check (negative_mark >= 0),
  max_attempts     integer check (max_attempts is null or max_attempts > 0),
  opens_at         timestamptz,
  closes_at        timestamptz,
  published        boolean not null default false,
  review_policy    text not null default 'after_submit'
                   check (review_policy in ('after_submit','after_close','never')),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  question_id    uuid not null references public.questions(id) on delete restrict,
  marks          numeric(10,2) not null check (marks > 0),
  negative_marks numeric(10,2) not null default 0 check (negative_marks >= 0),
  position       integer not null check (position >= 0),
  unique (quiz_id, question_id),
  unique (quiz_id, position)
);

create table public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete restrict,
  student_id     uuid not null references public.profiles(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  status         text not null default 'in_progress'
                 check (status in ('in_progress','submitted','expired','voided')),
  started_at     timestamptz not null default now(),
  deadline_at    timestamptz not null,
  submitted_at   timestamptz,
  score          numeric(10,2),
  total_marks    numeric(10,2),
  unique (student_id, quiz_id, attempt_number),
  check (deadline_at >= started_at),
  check (submitted_at is null or submitted_at >= started_at)
);

create table public.quiz_answers (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id) on delete restrict,
  selected_answer jsonb,
  is_correct      boolean,
  awarded_marks   numeric(10,2),
  answered_at     timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ADDED (spec 8.2 / 13.2): the quiz rules, questions, marks and answer key as they were
-- when the attempt started. Kept in the private schema because it contains the answer key.
create table private.attempt_snapshots (
  attempt_id uuid primary key references public.quiz_attempts(id) on delete cascade,
  snapshot   jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Later-phase and operations tables (listed in spec 6.2 and 6.3)
-- ---------------------------------------------------------------------------
create table public.certificates (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles(id) on delete restrict,
  course_id          uuid not null references public.courses(id) on delete restrict,
  certificate_number text not null unique,
  issued_at          timestamptz not null default now(),
  revoked_at         timestamptz,
  unique (student_id, course_id)
);

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid references public.courses(id) on delete restrict,  -- null = platform-wide
  title        text not null,
  body         text not null,
  published_at timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ADDED: operator-tunable switches (for example whether admins must use MFA)
create table private.app_settings (
  key   text primary key,
  value text not null
);
insert into private.app_settings (key, value) values ('require_admin_mfa', 'true');

-- ---------------------------------------------------------------------------
-- Indexes (spec 7.2 plus indexes for foreign keys used by joins and RLS predicates)
-- ---------------------------------------------------------------------------
create unique index uq_profiles_phone on public.profiles (phone) where phone is not null;

create index idx_enrollments_student_status on public.enrollments (student_id, status);
create index idx_enrollments_course          on public.enrollments (course_id);
create index idx_modules_course_position     on public.course_modules (course_id, position);
create index idx_lessons_module_position     on public.lessons (module_id, position);
create index idx_progress_lesson             on public.lesson_progress (lesson_id);
create index idx_orders_student_created      on public.orders (student_id, created_at desc);
create index idx_orders_status_expiry        on public.orders (status, expires_at);
create index idx_order_items_order           on public.order_items (order_id);
create index idx_order_items_course          on public.order_items (course_id);
create index idx_payments_order              on public.payments (order_id);
create index idx_payment_events_payment      on public.payment_events (payment_id);
create index idx_questions_category          on public.questions (category_id);
create index idx_questions_status            on public.questions (status);
create index idx_quizzes_course              on public.quizzes (course_id);
create index idx_quiz_questions_question     on public.quiz_questions (question_id);
create index idx_attempts_student_started    on public.quiz_attempts (student_id, started_at desc);
create index idx_attempts_quiz_status        on public.quiz_attempts (quiz_id, status);
create index idx_answers_attempt             on public.quiz_answers (attempt_id);
create index idx_answers_question            on public.quiz_answers (question_id);
create index idx_certificates_course         on public.certificates (course_id);
create index idx_announcements_course        on public.announcements (course_id);
create index idx_audit_created               on public.audit_logs (created_at desc);
create index idx_audit_entity                on public.audit_logs (entity_type, entity_id);
