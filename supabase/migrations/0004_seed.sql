-- =============================================================================
-- Admission Ventures — 0004: sample data (development only)
-- The science price below is a PLACEHOLDER; set the real price in the admin panel.
-- =============================================================================

insert into public.courses
  (slug, title_en, title_bn, description_en, description_bn, category, price, compare_at_price, features, sort_order)
values
  ('second-timer-exam-batch-arts',
   'Second Timer Exam Batch (Arts)', 'সেকেন্ড টাইমার এক্সাম ব্যাচ (আর্টস)',
   'Daily, weekly and monthly exams with paper finals for Arts admission.',
   'আর্টস ভর্তি প্রস্তুতির জন্য ডেইলি, উইকলি, মান্থলি পরীক্ষা ও পেপার ফাইনাল।',
   'arts', 490, 790,
   '[{"en":"Daily exams","bn":"ডেইলি পরীক্ষা"},{"en":"Weekly exams","bn":"উইকলি পরীক্ষা"},{"en":"Monthly exams","bn":"মান্থলি পরীক্ষা"},{"en":"Paper finals","bn":"পেপার ফাইনাল"}]'::jsonb,
   1),
  ('second-timer-science-recorded-batch',
   'Science Recorded Batch', 'সায়েন্স রেকর্ডেড ব্যাচ',
   'Recorded lectures and exams for Science admission.',
   'সায়েন্স ভর্তি প্রস্তুতির জন্য রেকর্ডেড ক্লাস ও পরীক্ষা।',
   'science', 790, null,
   '[{"en":"Recorded lectures","bn":"রেকর্ডেড ক্লাস"},{"en":"Subject finals","bn":"সাবজেক্ট ফাইনাল"}]'::jsonb,
   2)
on conflict (slug) do nothing;

insert into public.coupons (code, description, discount_type, discount_value, max_uses, per_user_limit, expiry_date)
values
  ('WELCOME10', '10% off for new students', 'percent', 10, 1000, 1, now() + interval '90 days'),
  ('FLAT50',    'Flat ৳50 off',             'flat',    50, 500,  1, now() + interval '30 days')
on conflict (code) do nothing;
