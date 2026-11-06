-- =============================================================================
-- Synthetic seed data for LOCAL and STAGING only (spec section 16: "Synthetic seed
-- data only"). Contains no users: create test accounts through Supabase Auth, then
-- promote one with:  update public.profiles set role = 'super_admin' where id = '<uuid>';
-- Never run this against production.
-- =============================================================================

insert into public.courses (slug, title, description, price_amount, published) values
  ('second-timer-arts-exam-batch', 'Second Timer Exam Batch (Arts)',
   'Full-syllabus exams, daily, weekly and monthly exams, question-bank exams, paper and subject finals, a final model test, and 200+ extra topic-based tests.', 490, true),
  ('science-recorded-batch', 'Second Timer Course (Science)',
   'Full-syllabus recorded Science classes, daily, weekly and monthly exams, exercise exams, question-bank exams, paper and subject finals, and a final model test.', 510, true),
  ('free-orientation', 'Free Orientation',
   'SAMPLE: a free course that shows the zero-price enrollment path.', 0, true),
  ('draft-course-hidden', 'Draft Course (unpublished)',
   'SAMPLE: must be invisible to the public catalog.', 990, false)
on conflict (slug) do nothing;

-- Modules and lessons (video ids are placeholders for local UI testing)
with c as (select id, slug from public.courses),
m as (
  insert into public.course_modules (course_id, title, description, position, published)
  select c.id, v.title, v.descr, v.pos, true
    from c join (values
      ('second-timer-arts-exam-batch', 'Orientation', 'How the batch works', 0),
      ('second-timer-arts-exam-batch', 'Bangla Literature', 'Core topics', 1),
      ('science-recorded-batch', 'Physics Basics', 'Mechanics', 0),
      ('free-orientation', 'Welcome', 'Start here', 0)
    ) as v(slug, title, descr, pos) on v.slug = c.slug
  on conflict do nothing
  returning id, course_id, position
)
insert into public.lessons (module_id, title, description, video_provider, video_ref, duration_seconds, position, is_free_preview, published)
select m.id, v.title, v.descr, 'youtube', 'jNQXAC9IVRw', v.dur, v.pos, v.preview, true
  from m
  join public.courses c on c.id = m.course_id
  join (values
    ('second-timer-arts-exam-batch', 0, 'Welcome and how to study', 'Free preview lesson', 300, 0, true),
    ('second-timer-arts-exam-batch', 1, 'Poetry: overview', 'Enrolled students only', 900, 0, false),
    ('second-timer-arts-exam-batch', 1, 'Poetry: practice set', 'Enrolled students only', 1200, 1, false),
    ('science-recorded-batch', 0, 'Vectors', 'Enrolled students only', 1500, 0, false),
    ('free-orientation', 0, 'Welcome to Admission Ventures', 'Open to everyone enrolled', 240, 0, false)
  ) as v(slug, mpos, title, descr, dur, pos, preview) on v.slug = c.slug and v.mpos = m.position
on conflict do nothing;

-- Question bank
insert into public.question_categories (name, slug) values
  ('General Knowledge', 'general-knowledge'), ('English', 'english')
on conflict (slug) do nothing;

insert into public.questions (category_id, prompt, options, correct_answer, explanation, difficulty, status)
select (select id from public.question_categories where slug = v.cat), v.prompt, v.options::jsonb,
       v.answer::jsonb, v.expl, v.diff, 'published'
  from (values
    ('general-knowledge', 'SAMPLE: Which city is the capital of Bangladesh?',
     '[{"key":"A","text":"Chattogram"},{"key":"B","text":"Dhaka"},{"key":"C","text":"Khulna"},{"key":"D","text":"Sylhet"}]',
     '{"key":"B"}', 'Dhaka is the capital.', 'easy'),
    ('general-knowledge', 'SAMPLE: How many days are there in a leap year?',
     '[{"key":"A","text":"365"},{"key":"B","text":"364"},{"key":"C","text":"366"},{"key":"D","text":"360"}]',
     '{"key":"C"}', 'A leap year has 366 days.', 'easy'),
    ('english', 'SAMPLE: Choose the correct plural of "child".',
     '[{"key":"A","text":"childs"},{"key":"B","text":"children"},{"key":"C","text":"childes"},{"key":"D","text":"childrens"}]',
     '{"key":"B"}', '"Children" is the irregular plural.', 'easy'),
    ('english', 'SAMPLE: Pick the synonym of "rapid".',
     '[{"key":"A","text":"slow"},{"key":"B","text":"quick"},{"key":"C","text":"late"},{"key":"D","text":"weak"}]',
     '{"key":"B"}', '"Quick" means rapid.', 'medium')
  ) as v(cat, prompt, options, answer, expl, diff)
 where not exists (select 1 from public.questions q where q.prompt = v.prompt);

-- Quizzes: one tied to the Arts course (needs enrollment), one open demo with no review.
insert into public.quizzes (course_id, title, description, duration_seconds, total_marks, pass_marks,
                            negative_mark, max_attempts, published, review_policy)
select c.id, 'Daily Practice 01 (sample)', 'SAMPLE quiz for enrolled students', 600, 0, 0, 0.25, 3, false, 'after_submit'
  from public.courses c where c.slug = 'second-timer-arts-exam-batch'
   and not exists (select 1 from public.quizzes where title = 'Daily Practice 01 (sample)');
insert into public.quizzes (course_id, title, description, duration_seconds, total_marks, pass_marks,
                            negative_mark, max_attempts, published, review_policy)
select null, 'Open Demo Quiz (sample)', 'SAMPLE quiz, no enrollment needed, answers hidden', 300, 0, 0, 0, 1, false, 'never'
 where not exists (select 1 from public.quizzes where title = 'Open Demo Quiz (sample)');

insert into public.quiz_questions (quiz_id, question_id, marks, negative_marks, position)
select z.id, q.id, 1, case when z.title like 'Daily%' then 0.25 else 0 end, row_number() over (order by q.created_at, q.prompt) - 1
  from public.quizzes z cross join public.questions q
 where z.title in ('Daily Practice 01 (sample)', 'Open Demo Quiz (sample)')
on conflict do nothing;

update public.quizzes set pass_marks = 2, published = true where title = 'Daily Practice 01 (sample)';
update public.quizzes set pass_marks = 1, published = true where title = 'Open Demo Quiz (sample)';

insert into public.announcements (title, body, published_at)
select 'Welcome to Admission Ventures', 'SAMPLE platform-wide announcement.', now()
 where not exists (select 1 from public.announcements where title = 'Welcome to Admission Ventures');
