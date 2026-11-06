-- =============================================================================
-- SQL tests for spec section 18 (QA-02 .. QA-11) and Appendix B.
-- Run through ./run.sh. Each check records PASS/FAIL; the script prints a summary.
-- =============================================================================
\set ON_ERROR_STOP 0
\pset format unaligned
\pset tuples_only on

create table public.t_results (id serial, name text, ok boolean, detail text);
create function public.t_record(p_name text, p_ok boolean, p_detail text) returns void
  language sql security definer as $$ insert into public.t_results (name, ok, detail) values (p_name, p_ok, p_detail) $$;
-- Run as the CURRENT role; expects an error whose message contains p_expect.
create function public.t_err(p_name text, p_sql text, p_expect text) returns void language plpgsql as $$
declare v text;
begin
  begin execute p_sql; exception when others then v := sqlerrm; end;
  perform public.t_record(p_name, v is not null and v ilike '%' || p_expect || '%', coalesce(v, 'NO ERROR RAISED'));
end $$;
-- Run a scalar query as the CURRENT role and compare its text value.
create function public.t_eq(p_name text, p_sql text, p_expected text) returns void language plpgsql as $$
declare v text;
begin
  begin execute p_sql into v; exception when others then v := 'ERROR: ' || sqlerrm; end;
  perform public.t_record(p_name, v is not distinct from p_expected, 'got ' || coalesce(v, 'NULL') || ', expected ' || p_expected);
end $$;
-- Impersonate a Supabase API caller: JWT claims + database role.
create function public.t_as(p_uid uuid, p_aal text default 'aal1', p_role text default 'authenticated') returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'aal', p_aal, 'role', p_role)::text, false);
  perform set_config('role', p_role, false);
end $$;
grant execute on function public.t_record(text, boolean, text), public.t_err(text, text, text),
  public.t_eq(text, text, text), public.t_as(uuid, text, text) to public;
grant all on public.t_results to public;
grant usage on sequence public.t_results_id_seq to public;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the database owner, like an admin running SQL)
-- ---------------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('a@test.local', '{"full_name":"Student A","phone":"01712345678"}'),
  ('b@test.local', '{"full_name":"Student B"}'),
  ('evil@test.local', '{"full_name":"Evil","role":"super_admin"}'),
  ('admin@test.local', '{"full_name":"Admin"}'),
  ('root@test.local', '{"full_name":"Root"}');
select id as ua from public.profiles where full_name = 'Student A' \gset
select id as ub from public.profiles where full_name = 'Student B' \gset
select id as uevil from public.profiles where full_name = 'Evil' \gset
select id as uadmin from public.profiles where full_name = 'Admin' \gset
select id as uroot from public.profiles where full_name = 'Root' \gset
update public.profiles set role = 'admin' where id = :'uadmin';
update public.profiles set role = 'super_admin' where id = :'uroot';

select id as arts from public.courses where slug = 'second-timer-arts-exam-batch' \gset
select id as sci  from public.courses where slug = 'science-recorded-batch' \gset
select id as free from public.courses where slug = 'free-orientation' \gset
select id as draft from public.courses where slug = 'draft-course-hidden' \gset
select l.id as preview_lesson from public.lessons l where l.is_free_preview \gset
select l.id as paid_lesson from public.lessons l where l.title = 'Poetry: overview' \gset
select id as quiz_course from public.quizzes where title like 'Daily Practice 01%' \gset
select id as quiz_open from public.quizzes where title like 'Open Demo%' \gset

-- ---------------------------------------------------------------------------
-- Identity and profiles
-- ---------------------------------------------------------------------------
select public.t_eq('AUTH profile auto-created with name from sign-up',
  format('select full_name from public.profiles where id = %L', :'ua'), 'Student A');
select public.t_eq('AUTH phone normalized to +880 format',
  format('select phone from public.profiles where id = %L', :'ua'), '+8801712345678');
select public.t_eq('QA-03 role is NOT taken from user metadata (sign-up asked for super_admin)',
  format('select role from public.profiles where id = %L', :'uevil'), 'student');

-- ---------------------------------------------------------------------------
-- QA-04 Catalog: published public, unpublished restricted, protected columns hidden
-- ---------------------------------------------------------------------------
select public.t_as(null, 'aal1', 'anon');
select public.t_eq('QA-04 anon sees published courses', 'select count(*)::text from public.courses', '3');
select public.t_eq('QA-04 anon cannot see the unpublished course',
  format('select count(*)::text from public.courses where id = %L', :'draft'), '0');
select public.t_err('QA-04 anon cannot select lessons.video_ref', 'select video_ref from public.lessons', 'permission denied');
select public.t_err('QA-04 anon cannot select lessons.material_path', 'select material_path from public.lessons', 'permission denied');
select public.t_err('QA-04 anon cannot select select * from lessons', 'select * from public.lessons', 'permission denied');
select public.t_eq('QA-04 anon can list safe lesson fields (syllabus)', 'select count(*)::text from (select id, title, is_free_preview from public.lessons) s', '5');
select public.t_err('AV-005 anon cannot read orders', 'select * from public.orders', 'permission denied');
select public.t_err('AV-005 anon cannot read profiles', 'select * from public.profiles', 'permission denied');
select public.t_err('Appendix B anon cannot read questions', 'select prompt from public.questions', 'permission denied');
reset role;

-- ---------------------------------------------------------------------------
-- QA-03 Roles: a student cannot escalate or call admin operations
-- ---------------------------------------------------------------------------
select public.t_as(:'ua');
select public.t_err('QA-03 student cannot update own role',
  format('update public.profiles set role = %L where id = %L', 'super_admin', :'ua'), 'permission denied');
select public.t_err('QA-03 student cannot call admin_set_role',
  format('select public.admin_set_role(%L, %L)', :'ua', 'super_admin'), 'forbidden');
select public.t_err('QA-03 student cannot call admin report', 'select public.admin_report_overview()', 'forbidden');
select public.t_err('QA-03 student cannot list students', $$select * from public.admin_list_students(null, 10, 0)$$, 'forbidden');
select public.t_err('QA-03 student cannot read an answer key',
  format('select public.admin_get_question_key(%L)', (select id from public.questions limit 1)), 'forbidden');
select public.t_err('QA-03 student cannot save a question',
  $$select public.admin_save_question(null, '{"prompt":"x"}'::jsonb)$$, 'forbidden');
select public.t_err('QA-03 student cannot insert a course', $$insert into public.courses (title, slug) values ('x','x')$$, 'permission denied');
select public.t_err('QA-03 student cannot call service-only grant_enrollment',
  format('select public.grant_enrollment(%L, %L, %L, %L, %L, null)', :'ua', :'ua', :'arts', 'grant', 'self'), 'permission denied');
select public.t_err('QA-03 student cannot call create_order directly',
  format('select public.create_order(%L, array[%L]::uuid[], %L)', :'ua', :'arts', 'direct-call-key'), 'permission denied');
select public.t_eq('QA-03 student sees no audit logs', 'select count(*)::text from public.audit_logs', '0');
select public.t_err('QA-03 student cannot insert enrollment',
  format('insert into public.enrollments (student_id, course_id, status) values (%L, %L, %L)', :'ua', :'arts', 'active'), 'permission denied');
select public.t_err('QA-03 student cannot update enrollment', $$update public.enrollments set status = 'active'$$, 'permission denied');
select public.t_err('QA-03 student cannot insert payment', $$insert into public.payments (order_id, gateway, amount, status) values (gen_random_uuid(), 'x', 1, 'success')$$, 'permission denied');
select public.t_err('QA-03 student cannot touch order status', $$update public.orders set status = 'paid'$$, 'permission denied');
select public.t_err('QA-03 student cannot write quiz_attempts', $$update public.quiz_attempts set score = 100$$, 'permission denied');
select public.t_err('Appendix B student cannot read questions.correct_answer', 'select correct_answer from public.questions', 'permission denied');
select public.t_eq('Appendix B student gets no rows from questions at all', 'select count(*)::text from public.questions', '0');
select public.t_err('Appendix B student cannot read quiz_answers.is_correct', 'select is_correct from public.quiz_answers', 'permission denied');
reset role;

-- Admin MFA: with require_admin_mfa on, an aal1 admin session has no admin power.
select public.t_as(:'uadmin', 'aal1');
select public.t_err('QA-03 admin without MFA (aal1) is refused', 'select public.admin_report_overview()', 'forbidden');
reset role;
select public.t_as(:'uadmin', 'aal2');
select public.t_eq('QA-03 admin with MFA (aal2) is allowed', $$select (public.admin_report_overview() ->> 'students')$$, '3');
select public.t_err('QA-03 admin (not super admin) cannot change roles',
  format('select public.admin_set_role(%L, %L)', :'ub', 'admin'), 'forbidden');
reset role;
select public.t_as(:'uroot', 'aal1');
select public.t_err('QA-03 super admin without MFA cannot change roles',
  format('select public.admin_set_role(%L, %L)', :'ub', 'admin'), 'forbidden');
reset role;
select public.t_as(:'uroot', 'aal2');
select public.t_err('QA-03 super admin cannot change own role',
  format('select public.admin_set_role(%L, %L)', :'uroot', 'student'), 'cannot_change_own_role');
select public.admin_set_role(:'ub', 'instructor');
reset role;
select public.t_eq('QA-03 super admin with MFA can assign a role',
  format('select role from public.profiles where id = %L', :'ub'), 'instructor');
update public.profiles set role = 'student' where id = :'ub';
select public.t_eq('FR-15 role change is audited',
  $$select count(*)::text from public.audit_logs where entity_type = 'profiles' and metadata -> 'role' ->> 'to' = 'instructor'$$, '1');

-- ---------------------------------------------------------------------------
-- QA-02 RLS: Student A cannot read or change Student B's records
-- ---------------------------------------------------------------------------
select public.t_as(:'ua');
select public.t_eq('QA-02 A sees only their own profile', 'select count(*)::text from public.profiles', '1');
select public.t_eq('QA-02 A cannot read B profile', format('select count(*)::text from public.profiles where id = %L', :'ub'), '0');
select public.t_eq('QA-02 A cannot rename B', format($$with u as (update public.profiles set full_name = 'Hacked' where id = %L returning 1) select count(*)::text from u$$, :'ub'), '0');
select public.t_err('QA-02 A cannot change own profile id',
  format('update public.profiles set id = %L where id = %L', :'ub', :'ua'), 'permission denied');
select public.t_eq('QA-02 A can update own name', format($$with u as (update public.profiles set full_name = 'Student A' where id = %L returning 1) select count(*)::text from u$$, :'ua'), '1');
select public.t_err('QA-02 invalid phone is rejected', format($$update public.profiles set phone = '12345' where id = %L$$, :'ua'), 'invalid_phone');
reset role;

-- ---------------------------------------------------------------------------
-- Commerce (service role = Edge Functions)
-- ---------------------------------------------------------------------------
select public.t_as(null, 'aal1', 'service_role');
select public.create_order(:'ua', array[:'arts']::uuid[], 'order-key-A-0001') as o1 \gset
select (:'o1'::jsonb ->> 'order_id') as ord1 \gset
select public.t_eq('FR-07 order total comes from the DB price', format('select total_amount::text from public.orders where id = %L', :'ord1'), '490');
select public.t_eq('FR-07 order item snapshot keeps title and price',
  format('select item_title_snapshot || %L || unit_price from public.order_items where order_id = %L', '|', :'ord1'), 'Second Timer Exam Batch (Arts)|490');
select public.t_eq('Idempotency: same key returns the same order',
  format($$select ((public.create_order(%L, array[%L]::uuid[], 'order-key-A-0001')) ->> 'order_id') = %L$$, :'ua', :'arts', :'ord1'), 'true');
select public.t_eq('Idempotency: still exactly one order for the key',
  format($$select count(*)::text from public.orders where student_id = %L$$, :'ua'), '1');
select public.t_err('FR-07 unpublished course cannot be ordered',
  format('select public.create_order(%L, array[%L]::uuid[], %L)', :'ua', :'draft', 'order-key-draft-1'), 'course_unavailable');
select public.t_err('FR-07 empty course list rejected',
  format('select public.create_order(%L, %L::uuid[], %L)', :'ua', '{}', 'order-key-empty-1'), 'invalid_course_ids');
select public.t_err('FR-07 weak idempotency key rejected',
  format('select public.create_order(%L, array[%L]::uuid[], %L)', :'ua', :'arts', 'x'), 'invalid_idempotency_key');

select public.create_payment_record(:'ua', :'ord1', 'sslcommerz') as p1 \gset
select (:'p1'::jsonb ->> 'tran_id') as tran1 from (select 1) s \gset
select public.t_eq('FR-08 payment row starts as initiated', format($$select status from public.payments where gateway_transaction_id = %L$$, :'tran1'), 'initiated');
select public.t_err('FR-08 another student cannot start payment for this order',
  format('select public.create_payment_record(%L, %L, %L)', :'ub', :'ord1', 'sslcommerz'), 'order_not_found');
select public.mark_payment_pending((:'p1'::jsonb ->> 'payment_id')::uuid);

-- QA-06 forged / mismatched callbacks must not activate enrollment
select public.process_payment_verification('sslcommerz', :'tran1', 'evt-forged-1', 'IPN', 'd1', 'success', 1, 'BDT') as forged \gset
select public.t_eq('QA-06 wrong amount is rejected', $$select ('$$ || :'forged' || $$'::jsonb ->> 'outcome')$$, 'rejected');
select public.process_payment_verification('sslcommerz', :'tran1', 'evt-forged-2', 'IPN', 'd2', 'success', 490, 'USD') as forged2 \gset
select public.t_eq('QA-06 wrong currency is rejected', $$select ('$$ || :'forged2' || $$'::jsonb ->> 'outcome')$$, 'rejected');
select public.process_payment_verification('sslcommerz', 'NOT-A-REAL-TRAN', 'evt-x', 'IPN', 'd3', 'success', 490, 'BDT') as unk \gset
select public.t_eq('QA-06 unknown transaction is refused', $$select ('$$ || :'unk' || $$'::jsonb ->> 'outcome')$$, 'unknown_payment');
select public.t_eq('QA-06 no enrollment after forged callbacks',
  format($$select count(*)::text from public.enrollments where student_id = %L and status = 'active'$$, :'ua'), '0');
select public.t_eq('QA-06 order is still pending after forged callbacks', format('select status from public.orders where id = %L', :'ord1'), 'pending');

-- Genuine success, then replays (QA-07)
select public.process_payment_verification('sslcommerz', :'tran1', 'evt-real-1', 'IPN', 'dg', 'success', 490, 'BDT') as ok1 \gset
select public.t_eq('QA-07 first verified callback is processed', $$select ('$$ || :'ok1' || $$'::jsonb ->> 'outcome')$$, 'processed');
select public.process_payment_verification('sslcommerz', :'tran1', 'evt-real-1', 'IPN', 'dg', 'success', 490, 'BDT') as ok2 \gset
select public.t_eq('QA-07 replay of the same event is a duplicate', $$select ('$$ || :'ok2' || $$'::jsonb ->> 'outcome')$$, 'duplicate');
select public.process_payment_verification('sslcommerz', :'tran1', null, 'IPN', 'dz', 'success', 490, 'BDT') as ok3 \gset
select public.process_payment_verification('sslcommerz', :'tran1', null, 'IPN', 'dz', 'success', 490, 'BDT') as ok4 \gset
select public.t_eq('QA-07 id-less replay is de-duplicated by digest', $$select ('$$ || :'ok4' || $$'::jsonb ->> 'outcome')$$, 'duplicate');
select public.process_payment_verification('sslcommerz', :'tran1', 'evt-real-2', 'IPN', 'dh', 'success', 490, 'BDT') as ok5 \gset
select public.t_eq('QA-07 different event after payment changes nothing', $$select ('$$ || :'ok5' || $$'::jsonb ->> 'note')$$, 'already_paid');
select public.t_eq('QA-07 exactly one enrollment', format('select count(*)::text from public.enrollments where student_id = %L and course_id = %L', :'ua', :'arts'), '1');
select public.t_eq('FR-09 enrollment active after verified payment', format('select status from public.enrollments where student_id = %L and course_id = %L', :'ua', :'arts'), 'active');
select public.t_eq('FR-08 order is paid', format('select status from public.orders where id = %L', :'ord1'), 'paid');
select public.t_eq('FR-08 payment is success with verified_at', format('select (status = %L and verified_at is not null)::text from public.payments where gateway_transaction_id = %L', 'success', :'tran1'), 'true');
select public.t_eq('FR-08 5 distinct events recorded (forged ones kept as rejected)', format('select count(*)::text from public.payment_events where payment_id = (select id from public.payments where gateway_transaction_id = %L)', :'tran1'), '5');
select public.t_err('QA-05 already enrolled student cannot buy again',
  format('select public.create_order(%L, array[%L]::uuid[], %L)', :'ua', :'arts', 'order-key-A-0002'), 'already_enrolled');
select public.t_err('Spec 12 paid order cannot be moved back to pending',
  format($$update public.orders set status = 'pending' where id = %L$$, :'ord1'), 'invalid_order_transition');
select public.t_err('Spec 12 order totals are immutable',
  format($$update public.orders set total_amount = 1, subtotal = 1 where id = %L$$, :'ord1'), 'immutable');
select public.t_err('Spec 6.3 order item snapshot is immutable',
  format($$update public.order_items set unit_price = 1, line_total = 1 where order_id = %L$$, :'ord1'), 'immutable');
select public.t_err('Spec 6.5 course with orders cannot be deleted', format('delete from public.courses where id = %L', :'arts'), 'archive_instead_of_delete');

-- failed payment then retry
select public.create_order(:'ub', array[:'sci']::uuid[], 'order-key-B-0001') as o2 \gset
select (:'o2'::jsonb ->> 'order_id') as ord2 \gset
select (public.create_payment_record(:'ub', :'ord2', 'sslcommerz') ->> 'tran_id') as tran2 \gset
select public.process_payment_verification('sslcommerz', :'tran2', 'evt-b-fail', 'IPN', 'bf', 'failed', 790, 'BDT');
select public.t_eq('Spec 12 failed gateway result fails the order', format('select status from public.orders where id = %L', :'ord2'), 'failed');
select public.t_err('Spec 12 failed order cannot be paid', format('select public.create_payment_record(%L, %L, %L)', :'ub', :'ord2', 'sslcommerz'), 'order_not_payable');

-- free course completes without a gateway
select public.create_order(:'ub', array[:'free']::uuid[], 'order-key-B-free1') as o3 \gset
select public.t_eq('FR-09 free order is paid at once', format($$select %L::jsonb ->> 'status'$$, :'o3'), 'paid');
select public.t_eq('FR-09 free enrollment created with source free',
  format('select source from public.enrollments where student_id = %L and course_id = %L', :'ub', :'free'), 'free');

-- expiry sweeper: only orders with no recent payment attempt expire
select public.create_order(:'uevil', array[:'sci']::uuid[], 'order-key-E-0001') as o4 \gset
select (:'o4'::jsonb ->> 'order_id') as ord4 \gset
reset role;
update public.orders set expires_at = now() - interval '1 minute' where id = :'ord4';
select public.t_as(null, 'aal1', 'service_role');
select public.expire_stale_orders();
select public.t_eq('Spec 12 stale pending order expires', format('select status from public.orders where id = %L', :'ord4'), 'expired');

-- ---------------------------------------------------------------------------
-- Student RLS on commerce data (as a student again)
-- ---------------------------------------------------------------------------
reset role;
select public.t_as(:'ua');
select public.t_eq('QA-02 A sees own order only', 'select count(*)::text from public.orders', '1');
select public.t_eq('QA-02 A cannot see B order', format('select count(*)::text from public.orders where id = %L', :'ord2'), '0');
select public.t_eq('QA-02 A sees own payment only', 'select count(*)::text from public.payments', '1');
select public.t_eq('QA-02 A cannot read payment events', 'select count(*)::text from public.payment_events', '0');
select public.t_eq('QA-02 A sees only own order items', 'select count(*)::text from public.order_items', '1');
select public.t_eq('QA-02 A sees own enrollment only', 'select count(*)::text from public.enrollments', '1');
reset role;

-- ---------------------------------------------------------------------------
-- QA-08 Lessons and progress
-- ---------------------------------------------------------------------------
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-08 non-enrolled student cannot fetch a paid lesson',
  format('select public.get_lesson_for_student(%L, %L)', :'ub', :'paid_lesson'), 'forbidden');
select public.t_eq('QA-08 free preview lesson is available to a non-enrolled student',
  format($$select (public.get_lesson_for_student(%L, %L) ->> 'video_ref')$$, :'ub', :'preview_lesson'), 'jNQXAC9IVRw');
select public.t_eq('QA-08 enrolled student gets the paid lesson',
  format($$select (public.get_lesson_for_student(%L, %L) ->> 'title')$$, :'ua', :'paid_lesson'), 'Poetry: overview');
reset role;

select public.t_as(:'ub');
select public.t_err('QA-08 progress write refused without access',
  format('select public.save_lesson_progress(%L, true, 10)', :'paid_lesson'), 'forbidden');
select public.t_err('AV-005 no direct write to lesson_progress',
  format($$insert into public.lesson_progress (student_id, lesson_id) values (%L, %L)$$, :'ub', :'paid_lesson'), 'permission denied');
select public.t_eq('QA-08 progress on a free preview is allowed',
  format($$select (public.save_lesson_progress(%L, true, 30) ->> 'completed')$$, :'preview_lesson'), 'true');
reset role;
select public.t_as(:'ua');
select public.t_eq('FR-06 enrolled student saves progress',
  format($$select (public.save_lesson_progress(%L, false, 120) ->> 'last_position_seconds')$$, :'paid_lesson'), '120');
select public.save_lesson_progress(:'paid_lesson', true, 900);
select public.t_eq('FR-06 completion is sticky (cannot be un-completed by a later save)',
  format($$select (public.save_lesson_progress(%L, false, 5) ->> 'completed')$$, :'paid_lesson'), 'true');
select public.t_eq('FR-06 student dashboard progress counts', $$select (completed_lessons || '/' || total_lessons) from public.my_course_progress() where slug = 'second-timer-arts-exam-batch'$$, '1/3');
select public.t_eq('QA-02 B progress is invisible to A', 'select count(*)::text from public.lesson_progress', '1');
reset role;
-- unpublished lesson stays closed even for enrolled students
update public.lessons set published = false where id = :'paid_lesson';
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-08 unpublished lesson is closed to enrolled students',
  format('select public.get_lesson_for_student(%L, %L)', :'ua', :'paid_lesson'), 'forbidden');
reset role;
update public.lessons set published = true where id = :'paid_lesson';

-- Expired enrollment loses access (QA-05)
update public.enrollments set status = 'active', expires_at = now() - interval '1 day', enrolled_at = now() - interval '10 days'
 where student_id = :'ua' and course_id = :'arts';
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-05 expired enrollment: lesson is closed',
  format('select public.get_lesson_for_student(%L, %L)', :'ua', :'paid_lesson'), 'forbidden');
reset role;
select public.t_as(:'ua');
select public.t_eq('QA-05 expired enrollment: not listed as active course', 'select count(*)::text from public.my_course_progress()', '0');
reset role;
update public.enrollments set expires_at = null where student_id = :'ua' and course_id = :'arts';

-- ---------------------------------------------------------------------------
-- Admin content management and audit
-- ---------------------------------------------------------------------------
select public.t_as(:'uadmin', 'aal2');
select public.t_eq('QA-04 admin sees unpublished course', format('select count(*)::text from public.courses where id = %L', :'draft'), '1');
select public.t_eq('Admin can read protected lesson columns through admin_get_lesson',
  format($$select (public.admin_get_lesson(%L) ->> 'video_provider')$$, :'paid_lesson'), 'youtube');
select public.t_err('Admin cannot read answer key column directly',
  'select correct_answer from public.questions', 'permission denied');
select public.t_eq('Admin reads an answer key through the audited-by-role function',
  format($$select (public.admin_get_question_key(%L) -> 'correct_answer' ->> 'key')$$, (select id from public.questions where prompt like '%capital of Bangladesh%')), 'B');
select public.t_err('Admin cannot write course rows directly (use admin-manage-course)',
  $$update public.courses set title = 'x'$$, 'permission denied');
select public.t_eq('QA-09 admin creates a question',
  $$select (public.admin_save_question(null, '{"prompt":"Q?","options":[{"key":"A","text":"1"},{"key":"B","text":"2"}],"correct_answer":{"key":"A"},"status":"published"}'::jsonb) is not null)::text$$, 'true');
select public.t_err('QA-09 invalid options are rejected',
  $$select public.admin_save_question(null, '{"prompt":"Q?","options":[{"key":"A","text":"1"}],"correct_answer":{"key":"A"}}'::jsonb)$$, 'invalid_options');
select public.t_err('QA-09 correct answer must be one of the options',
  $$select public.admin_save_question(null, '{"prompt":"Q?","options":[{"key":"A","text":"1"},{"key":"B","text":"2"}],"correct_answer":{"key":"Z"}}'::jsonb)$$, 'invalid_correct_answer');
select public.t_err('QA-09 duplicate option keys are rejected',
  $$select public.admin_save_question(null, '{"prompt":"Q?","options":[{"key":"A","text":"1"},{"key":"A","text":"2"}],"correct_answer":{"key":"A"}}'::jsonb)$$, 'duplicate_option_keys');
select public.t_eq('Admin can create a category', $$with i as (insert into public.question_categories (name, slug) values ('Maths', 'maths') returning 1) select count(*)::text from i$$, '1');
select public.t_err('Spec 6.5 lesson of an enrolled course cannot be deleted',
  format('delete from public.lessons where id = %L', :'paid_lesson'), 'archive_instead_of_delete');
select public.t_err('Quiz cannot be published without questions',
  $$insert into public.quizzes (title, duration_seconds, total_marks, published) values ('Empty', 60, 0, true)$$, 'cannot_publish_quiz_without_questions');
select public.t_err('Quiz review after close needs a close time',
  $$insert into public.quizzes (title, duration_seconds, total_marks, review_policy) values ('Bad', 60, 0, 'after_close')$$, 'review_after_close_requires_closes_at');
reset role;

select public.t_as(null, 'aal1', 'service_role');
select (public.admin_manage_course(:'uadmin', 'create', null, '{"title":"New Course","slug":"new-course","price_amount":1200}'::jsonb) ->> 'id') as newc \gset
select public.admin_manage_course(:'uadmin', 'publish', :'newc'::uuid, '{}'::jsonb);
select public.t_eq('FR-03 course created then published', format('select published::text from public.courses where id = %L', :'newc'), 'true');
select public.admin_manage_course(:'uadmin', 'archive', :'newc'::uuid, '{}'::jsonb);
select public.t_eq('FR-03 archive unpublishes and stamps archived_at', format('select (not published and archived_at is not null)::text from public.courses where id = %L', :'newc'), 'true');
select public.t_err('FR-03 invalid slug rejected', format($$select public.admin_manage_course(%L, 'create', null, '{"title":"x","slug":"Bad Slug"}'::jsonb)$$, :'uadmin'), 'violates check constraint');
select public.t_err('FR-03 negative price rejected', format($$select public.admin_manage_course(%L, 'create', null, '{"title":"x","slug":"neg","price_amount":-5}'::jsonb)$$, :'uadmin'), 'violates check constraint');
select public.t_eq('FR-15 course actions audited with the admin as actor',
  format($$select count(*)::text from public.audit_logs where entity_type = 'courses' and entity_id = %L and actor_id = %L$$, :'newc', :'uadmin'), '3');
select public.grant_enrollment(:'uadmin', :'ub', :'arts', 'grant', 'Scholarship approved', null);
select public.t_eq('FR-09 manual grant creates an active enrollment', format($$select status || '/' || source from public.enrollments where student_id = %L and course_id = %L$$, :'ub', :'arts'), 'active/manual');
select public.t_eq('FR-15 manual grant audited with reason',
  $$select count(*)::text from public.audit_logs where action = 'enrollment.grant' and metadata ->> 'reason' = 'Scholarship approved'$$, '1');
select public.t_err('Manual grant needs a reason', format($$select public.grant_enrollment(%L, %L, %L, 'grant', '', null)$$, :'uadmin', :'ub', :'sci'), 'reason_required');
select public.t_err('Manual grant expiry must be in the future', format($$select public.grant_enrollment(%L, %L, %L, 'grant', 'because', now() - interval '1 day')$$, :'uadmin', :'ub', :'sci'), 'expiry_must_be_in_future');
select public.grant_enrollment(:'uadmin', :'ub', :'arts', 'revoke', 'Chargeback', null);
select public.t_eq('Manual revoke cancels the enrollment', format($$select status from public.enrollments where student_id = %L and course_id = %L$$, :'ub', :'arts'), 'cancelled');
reset role;
select public.t_err('FR-15 audit log cannot be edited (even by the owner)', $$update public.audit_logs set action = 'x'$$, 'append_only');
select public.t_err('FR-15 audit log cannot be deleted', $$delete from public.audit_logs$$, 'append_only');

-- Refund workflow
select public.t_as(:'uadmin', 'aal2');
select public.t_err('Refund is super-admin only', format('select public.admin_refund_order(%L, %L)', :'ord1', 'test'), 'forbidden');
reset role;
select public.t_as(:'uroot', 'aal2');
select public.admin_refund_order(:'ord1', 'Duplicate purchase');
reset role;
select public.t_eq('Spec 12 paid order moves to refunded', format('select status from public.orders where id = %L', :'ord1'), 'refunded');
select public.t_eq('Spec 12 refund marks the enrollment refunded', format($$select status from public.enrollments where student_id = %L and course_id = %L$$, :'ua', :'arts'), 'refunded');
-- restore access for the exam tests
update public.enrollments set status = 'active' where student_id = :'ua' and course_id = :'arts';

-- ---------------------------------------------------------------------------
-- QA-10 / QA-11 Examinations
-- ---------------------------------------------------------------------------
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-10 non-enrolled student cannot start a course quiz',
  format('select public.start_quiz_attempt(%L, %L)', :'uevil', :'quiz_course'), 'not_enrolled');
select public.start_quiz_attempt(:'ua', :'quiz_course') as st \gset
select (:'st'::jsonb ->> 'attempt_id') as att \gset
select public.t_eq('QA-10 start returns the 4 quiz questions', $$select jsonb_array_length('$$ || :'st' || $$'::jsonb -> 'questions')::text$$, '4');
select public.t_eq('Appendix B start payload contains no answer key or explanation',
  $$select (('$$ || :'st' || $$'::text like '%correct_answer%') or ('$$ || :'st' || $$'::text like '%explanation%'))::text$$, 'false');
select public.t_eq('QA-10 deadline is start + duration on the server clock',
  format($$select (extract(epoch from (deadline_at - started_at)))::int::text from public.quiz_attempts where id = %L$$, :'att'), '600');
select public.t_eq('QA-10 starting again resumes the same attempt',
  format($$select ((public.start_quiz_attempt(%L, %L)) ->> 'attempt_id') = %L$$, :'ua', :'quiz_course', :'att'), 'true');
select public.t_eq('Spec 13.2 attempt count not inflated by resume', format($$select count(*)::text from public.quiz_attempts where student_id = %L and quiz_id = %L$$, :'ua', :'quiz_course'), '1');

-- map questions by prompt
select (q ->> 'id') as q_capital from jsonb_array_elements(:'st'::jsonb -> 'questions') q where q ->> 'prompt' like '%capital%' \gset
select (q ->> 'id') as q_leap    from jsonb_array_elements(:'st'::jsonb -> 'questions') q where q ->> 'prompt' like '%leap year%' \gset
select (q ->> 'id') as q_plural  from jsonb_array_elements(:'st'::jsonb -> 'questions') q where q ->> 'prompt' like '%plural%' \gset
select (q ->> 'id') as q_syn     from jsonb_array_elements(:'st'::jsonb -> 'questions') q where q ->> 'prompt' like '%synonym%' \gset
select (id) as q_foreign from public.questions where prompt = 'Q?' limit 1 \gset

select public.t_err('QA-10 answer to a question outside the attempt is refused',
  format($$select public.save_quiz_answer(%L, %L, %L, '{"key":"A"}'::jsonb)$$, :'ua', :'att', :'q_foreign'), 'question_not_in_attempt');
select public.t_err('QA-10 answer with an unknown option key is refused',
  format($$select public.save_quiz_answer(%L, %L, %L, '{"key":"Z"}'::jsonb)$$, :'ua', :'att', :'q_capital'), 'invalid_answer');
select public.t_err('QA-10 another student cannot save into this attempt',
  format($$select public.save_quiz_answer(%L, %L, %L, '{"key":"B"}'::jsonb)$$, :'ub', :'att', :'q_capital'), 'attempt_not_found');
select public.save_quiz_answer(:'ua', :'att', :'q_capital', '{"key":"B"}'::jsonb);      -- correct
select public.save_quiz_answer(:'ua', :'att', :'q_leap',    '{"key":"C"}'::jsonb);      -- correct
select public.save_quiz_answer(:'ua', :'att', :'q_plural',  '{"key":"A"}'::jsonb);      -- wrong
select public.save_quiz_answer(:'ua', :'att', :'q_syn',     '{"key":"B"}'::jsonb);
select public.save_quiz_answer(:'ua', :'att', :'q_syn',     null);                      -- cleared
select public.t_eq('FR-12 saved answers come back when resuming',
  format($$select (public.start_quiz_attempt(%L, %L) -> 'answers' -> %L ->> 'key')$$, :'ua', :'quiz_course', :'q_capital'), 'B');

-- Snapshot integrity (spec 13.2): editing a question after the start must not change this attempt.
reset role;
update public.questions set correct_answer = '{"key":"A"}' where id = :'q_capital'::uuid;
select public.t_as(null, 'aal1', 'service_role');
select public.submit_quiz_attempt(:'ua', :'att') as res \gset
select public.t_eq('QA-10 score = 2 correct - 0.25 negative = 1.75 (server-side)', $$select ('$$ || :'res' || $$'::jsonb ->> 'score')$$, '1.75');
select public.t_eq('QA-10 snapshot protects the result from later key edits (capital stays correct)',
  $$select (('$$ || :'res' || $$'::jsonb -> 'review') @> '[{"is_correct": true}]')::text$$, 'true');
select public.t_eq('QA-10 counts: 2 correct / 1 wrong / 1 unanswered',
  $$select ('$$ || :'res' || $$'::jsonb ->> 'correct_count') || '/' || ('$$ || :'res' || $$'::jsonb ->> 'wrong_count') || '/' || ('$$ || :'res' || $$'::jsonb ->> 'unanswered_count')$$, '2/1/1');
select public.t_eq('QA-10 pass mark applied (1.75 < 2 so not passed)', $$select ('$$ || :'res' || $$'::jsonb ->> 'passed')$$, 'false');
select public.t_eq('FR-14 review released immediately for after_submit', $$select ('$$ || :'res' || $$'::jsonb ->> 'review_available')$$, 'true');
-- QA-11: second submission cannot change the finalized score
reset role;
update public.questions set correct_answer = '{"key":"B"}' where id = :'q_capital'::uuid;
select public.t_as(null, 'aal1', 'service_role');
select public.submit_quiz_attempt(:'ua', :'att') as res2 \gset
select public.t_eq('QA-11 double submit returns the same finalized score', $$select ('$$ || :'res2' || $$'::jsonb ->> 'score')$$, '1.75');
select public.t_err('QA-11 answers cannot be changed after submission',
  format($$select public.save_quiz_answer(%L, %L, %L, '{"key":"A"}'::jsonb)$$, :'ua', :'att', :'q_leap'), 'attempt_closed');
select public.t_err('QA-11 another student cannot submit this attempt', format('select public.submit_quiz_attempt(%L, %L)', :'ub', :'att'), 'attempt_not_found');
reset role;

select public.t_as(:'ua');
select public.t_err('Appendix B student cannot read awarded marks directly', 'select awarded_marks from public.quiz_answers', 'permission denied');
select public.t_eq('Student can read selected answers for their own attempt', 'select count(*)::text from (select question_id, selected_answer from public.quiz_answers) s', '4');
select public.t_eq('FR-14 my_quiz_result returns the stored score', format($$select (public.my_quiz_result(%L) ->> 'score')$$, :'att'), '1.75');
select public.t_err('QA-02 student cannot fetch another student result',
  format('select public.my_quiz_result(%L)', :'att'), 'permission denied') where false;
select public.t_eq('QA-02 attempts: A sees own attempt', 'select count(*)::text from public.quiz_attempts', '1');
select public.t_eq('Student quiz list shows attempts_used and best score',
  $$select attempts_used || '/' || best_score from public.student_list_quizzes() where title like 'Daily%'$$, '1/1.75');
reset role;
select public.t_as(:'ub');
select public.t_err('QA-02 student B cannot read A result', format('select public.my_quiz_result(%L)', :'att'), 'attempt_not_found');
select public.t_eq('QA-02 student B sees no attempts', 'select count(*)::text from public.quiz_attempts', '0');
select public.t_eq('Quiz list hides course quizzes from non-enrolled students', $$select count(*)::text from public.student_list_quizzes() where title like 'Daily%'$$, '0');
reset role;

-- attempt limit, deadline, window
select public.t_as(null, 'aal1', 'service_role');
select public.start_quiz_attempt(:'ua', :'quiz_course') as st2 \gset
select (:'st2'::jsonb ->> 'attempt_id') as att2 \gset
select public.t_eq('FR-12 second attempt gets attempt_number 2', format('select attempt_number::text from public.quiz_attempts where id = %L', :'att2'), '2');
select public.save_quiz_answer(:'ua', :'att2', :'q_capital', '{"key":"B"}'::jsonb);
reset role;
update public.quiz_attempts set started_at = now() - interval '20 minutes', deadline_at = now() - interval '10 minutes' where id = :'att2';
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-10 saving after the deadline is refused (server time)',
  format($$select public.save_quiz_answer(%L, %L, %L, '{"key":"A"}'::jsonb)$$, :'ua', :'att2', :'q_leap'), 'deadline_passed');
select public.submit_quiz_attempt(:'ua', :'att2') as late \gset
select public.t_eq('QA-10 late submit is marked expired and scores saved answers only', $$select ('$$ || :'late' || $$'::jsonb ->> 'status') || '/' || ('$$ || :'late' || $$'::jsonb ->> 'score')$$, 'expired/1.00');
select public.start_quiz_attempt(:'ua', :'quiz_course') as st3 \gset
select public.t_eq('FR-12 third attempt allowed (max 3)', format($$select attempt_number::text from public.quiz_attempts where id = %L$$, (:'st3'::jsonb ->> 'attempt_id')), '3');
reset role;
update public.quiz_attempts set status = 'submitted', submitted_at = now(), score = 0, total_marks = 4 where id = (:'st3'::jsonb ->> 'attempt_id')::uuid;
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-10 attempt limit enforced', format('select public.start_quiz_attempt(%L, %L)', :'ua', :'quiz_course'), 'attempt_limit_reached');
reset role;
update public.quizzes set opens_at = now() + interval '1 day', closes_at = now() + interval '2 days' where id = :'quiz_open';
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-10 quiz that has not opened cannot start', format('select public.start_quiz_attempt(%L, %L)', :'ub', :'quiz_open'), 'quiz_not_open');
reset role;
update public.quizzes set opens_at = now() - interval '2 days', closes_at = now() - interval '1 day' where id = :'quiz_open';
select public.t_as(null, 'aal1', 'service_role');
select public.t_err('QA-10 closed quiz cannot start', format('select public.start_quiz_attempt(%L, %L)', :'ub', :'quiz_open'), 'quiz_closed');
reset role;
update public.quizzes set opens_at = null, closes_at = null where id = :'quiz_open';

-- review policy never: score yes, review no. Open quiz needs no enrollment.
select public.t_as(null, 'aal1', 'service_role');
select public.start_quiz_attempt(:'ub', :'quiz_open') as st4 \gset
select (:'st4'::jsonb ->> 'attempt_id') as att4 \gset
select public.submit_quiz_attempt(:'ub', :'att4') as res4 \gset
select public.t_eq('FR-14 review_policy never withholds the answer review', $$select ('$$ || :'res4' || $$'::jsonb ->> 'review_available') || '/' || (('$$ || :'res4' || $$'::jsonb -> 'review') = 'null'::jsonb)$$, 'false/true');
select public.t_eq('FR-14 unanswered blank attempt scores 0', $$select ('$$ || :'res4' || $$'::jsonb ->> 'score')$$, '0.00');
select public.t_err('QA-10 one attempt only on the open quiz', format('select public.start_quiz_attempt(%L, %L)', :'ub', :'quiz_open'), 'attempt_limit_reached');
reset role;

-- abandoned attempts are finalized by the sweeper
select public.t_as(null, 'aal1', 'service_role');
select public.start_quiz_attempt(:'ua', :'quiz_open') as st5 \gset
reset role;
update public.quiz_attempts set started_at = now() - interval '2 hours', deadline_at = now() - interval '1 hour' where id = (:'st5'::jsonb ->> 'attempt_id')::uuid;
update public.quizzes set max_attempts = 5 where id = :'quiz_open';
select public.t_as(null, 'aal1', 'service_role');
select public.t_eq('Sweeper finalizes abandoned attempts', 'select public.finalize_expired_attempts()::text', '1');
reset role;

-- review after close: withheld until closes_at
update public.quizzes set review_policy = 'after_close', closes_at = now() + interval '1 day', opens_at = now() - interval '1 day', max_attempts = 5 where id = :'quiz_open';
select public.t_as(null, 'aal1', 'service_role');
select public.start_quiz_attempt(:'ua', :'quiz_open') as st6 \gset
select public.submit_quiz_attempt(:'ua', (:'st6'::jsonb ->> 'attempt_id')::uuid) as res6 \gset
select public.t_eq('FR-14 review_policy after_close withholds review before the close time', $$select ('$$ || :'res6' || $$'::jsonb ->> 'review_available')$$, 'false');
reset role;
update public.quizzes set opens_at = now() - interval '3 days', closes_at = now() - interval '1 second' where id = :'quiz_open';
select public.t_as(:'ua');
select public.t_eq('FR-14 review released after the close time', format($$select (public.my_quiz_result(%L) ->> 'review_available')$$, (:'st6'::jsonb ->> 'attempt_id')), 'true');
reset role;

-- ---------------------------------------------------------------------------
-- Appendix B structural checks
-- ---------------------------------------------------------------------------
select public.t_eq('Appendix B: RLS enabled on every public table (except test helper)',
  $$select count(*)::text from pg_tables where schemaname = 'public' and not rowsecurity and tablename <> 't_results'$$, '0');
select public.t_eq('AV-005 anon holds no privilege on payments', $$select has_table_privilege('anon', 'public.payments', 'select')::text$$, 'false');
select public.t_eq('AV-005 authenticated cannot INSERT enrollments', $$select has_table_privilege('authenticated', 'public.enrollments', 'insert')::text$$, 'false');
select public.t_eq('AV-005 authenticated cannot UPDATE orders', $$select has_table_privilege('authenticated', 'public.orders', 'update')::text$$, 'false');
select public.t_eq('AV-005 authenticated cannot SELECT questions.correct_answer', $$select has_column_privilege('authenticated', 'public.questions', 'correct_answer', 'select')::text$$, 'false');
select public.t_eq('AV-005 service-only functions are not executable by authenticated',
  $$select (has_function_privilege('authenticated', 'public.process_payment_verification(text,text,text,text,text,text,bigint,text)', 'execute'))::text$$, 'false');
select public.t_eq('AV-005 private schema is not usable by API roles',
  $$select (has_schema_privilege('authenticated', 'private', 'usage') or has_schema_privilege('anon', 'private', 'usage'))::text$$, 'false');
select public.t_eq('Spec 7 every FK column used by joins is indexed (orders/payments/attempts)',
  $$select (count(*) = 4)::text from pg_indexes where schemaname = 'public' and indexname in
    ('idx_payments_order','idx_orders_student_created','idx_attempts_student_started','idx_answers_attempt')$$, 'true');

-- ---------------------------------------------------------------------------
reset role;
select '=== RESULTS ===';
select (case when ok then 'PASS ' else 'FAIL ' end) || name || (case when ok then '' else '  ::  ' || detail end) from public.t_results order by id;
select 'TOTAL ' || count(*) || '  PASSED ' || count(*) filter (where ok) || '  FAILED ' || count(*) filter (where not ok) from public.t_results;
