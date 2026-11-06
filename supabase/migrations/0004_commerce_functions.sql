-- =============================================================================
-- Admission Ventures 0004: orders, payments, enrollment, course administration
-- Source: spec sections 9.1, 10, 12 and FR-07..FR-09, FR-15.
-- Functions in this file are executable by service_role only (called from Edge
-- Functions after the caller is authenticated), except where noted.
-- =============================================================================

create or replace function private.order_json(p_order uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'order_id', o.id, 'order_reference', o.order_reference, 'status', o.status,
    'currency', o.currency, 'subtotal', o.subtotal, 'discount_amount', o.discount_amount,
    'total_amount', o.total_amount, 'expires_at', o.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'course_id', i.course_id, 'title', i.item_title_snapshot,
               'unit_price', i.unit_price, 'quantity', i.quantity, 'line_total', i.line_total)
             order by i.item_title_snapshot)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o where o.id = p_order
$$;

-- Grants (or re-activates) access for every course in a paid order. Idempotent.
create or replace function private.activate_enrollments_for_order(p_order uuid, p_source text default 'purchase')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.enrollments (student_id, course_id, status, source, enrolled_at, expires_at)
  select o.student_id, i.course_id, 'active', p_source, now(), null
    from public.order_items i join public.orders o on o.id = i.order_id
   where o.id = p_order
  on conflict (student_id, course_id) do update
     set status = 'active', source = excluded.source, enrolled_at = now(), expires_at = null
   where public.enrollments.status <> 'active';
end $$;

-- ---------------------------------------------------------------------------
-- create-order: prices come from the database, never from the browser.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p_student uuid, p_course_ids uuid[], p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ids      uuid[];
  v_count    int;
  v_order    public.orders;
  v_subtotal bigint;
  v_currency text;
begin
  if p_student is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 100 then
    raise exception 'invalid_idempotency_key';
  end if;
  select coalesce(array_agg(x order by x), '{}') into v_ids from (select distinct unnest(p_course_ids) x) s;
  v_count := coalesce(array_length(v_ids, 1), 0);
  if v_count < 1 or v_count > 10 then raise exception 'invalid_course_ids'; end if;
  if not exists (select 1 from public.profiles where id = p_student) then
    raise exception 'profile_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext('order:' || p_student::text));

  -- Idempotent replay: the same key returns the same order.
  select * into v_order from public.orders where student_id = p_student and idempotency_key = p_idempotency_key;
  if found then return private.order_json(v_order.id); end if;

  if (select count(*) from public.courses where id = any (v_ids) and published and archived_at is null) <> v_count then
    raise exception 'course_unavailable';
  end if;
  if exists (select 1 from public.enrollments e
              where e.student_id = p_student and e.course_id = any (v_ids) and e.status = 'active'
                and (e.expires_at is null or e.expires_at > now())) then
    raise exception 'already_enrolled';
  end if;
  if (select count(distinct currency) from public.courses where id = any (v_ids)) <> 1 then
    raise exception 'mixed_currency';
  end if;

  select sum(price_amount), min(currency) into v_subtotal, v_currency
    from public.courses where id = any (v_ids);

  insert into public.orders
    (order_reference, student_id, currency, subtotal, discount_amount, total_amount, status, idempotency_key, expires_at)
  values
    ('AV' || to_char(now() at time zone 'utc', 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
     p_student, v_currency, v_subtotal, 0, v_subtotal, 'pending', p_idempotency_key, now() + interval '30 minutes')
  returning * into v_order;

  insert into public.order_items (order_id, course_id, item_title_snapshot, unit_price, quantity, line_total)
  select v_order.id, c.id, c.title, c.price_amount, 1, c.price_amount
    from public.courses c where c.id = any (v_ids);

  -- Free course(s): nothing to pay, so the order completes immediately.
  if v_subtotal = 0 then
    update public.orders set status = 'paid', paid_at = now() where id = v_order.id;
    perform private.activate_enrollments_for_order(v_order.id, 'free');
  end if;

  return private.order_json(v_order.id);
end $$;

-- ---------------------------------------------------------------------------
-- create-payment: one row per gateway attempt.
-- ---------------------------------------------------------------------------
create or replace function public.create_payment_record(p_student uuid, p_order_id uuid, p_gateway text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o       public.orders;
  v_n     int;
  v_tran  text;
  v_pay   public.payments;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.student_id <> p_student then raise exception 'order_not_found'; end if;
  if o.status <> 'pending' then raise exception 'order_not_payable'; end if;
  if o.expires_at is not null and o.expires_at < now() then raise exception 'order_expired'; end if;
  if o.total_amount = 0 then raise exception 'order_is_free'; end if;
  if p_gateway <> 'sslcommerz' then raise exception 'unsupported_gateway'; end if;

  select count(*) + 1 into v_n from public.payments where order_id = o.id;
  if v_n > 5 then raise exception 'too_many_payment_attempts'; end if;
  v_tran := o.order_reference || '-' || v_n;

  insert into public.payments (order_id, gateway, gateway_transaction_id, amount, status)
  values (o.id, p_gateway, v_tran, o.total_amount, 'initiated')
  returning * into v_pay;

  return jsonb_build_object('payment_id', v_pay.id, 'tran_id', v_tran, 'amount', o.total_amount,
                            'currency', o.currency, 'order_reference', o.order_reference);
end $$;

create or replace function public.mark_payment_pending(p_payment_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.payments set status = 'pending' where id = p_payment_id and status = 'initiated'
$$;

create or replace function public.mark_payment_init_failed(p_payment_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.payments set status = 'failed' where id = p_payment_id and status = 'initiated'
$$;

-- ---------------------------------------------------------------------------
-- payment-ipn: the single place where a payment can become "success".
-- The caller (Edge Function) has already verified the gateway signature and the
-- transaction server-to-server and passes only verified values.
-- Idempotent: replays return outcome "duplicate" and change nothing.
-- ---------------------------------------------------------------------------
create or replace function public.process_payment_verification(
  p_gateway        text,
  p_tran_id        text,
  p_event_id       text,
  p_event_type     text,
  p_digest         text,
  p_gateway_status text,     -- success | failed | cancelled | pending
  p_amount         bigint,   -- verified amount in whole BDT
  p_currency       text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pay    public.payments;
  ord    public.orders;
  v_ev   uuid;
  v_open boolean;
begin
  if p_gateway_status not in ('success', 'failed', 'cancelled', 'pending') then
    raise exception 'invalid_gateway_status';
  end if;

  select * into pay from public.payments where gateway = p_gateway and gateway_transaction_id = p_tran_id for update;
  if not found then return jsonb_build_object('outcome', 'unknown_payment'); end if;
  select * into ord from public.orders where id = pay.order_id for update;

  -- De-duplicate by gateway event id, or by (payment, type, digest) when the gateway has none.
  if p_event_id is not null then
    insert into public.payment_events (payment_id, gateway_event_id, event_type, payload_digest)
    values (pay.id, p_event_id, p_event_type, p_digest)
    on conflict (gateway_event_id) where gateway_event_id is not null do nothing
    returning id into v_ev;
  elsif exists (select 1 from public.payment_events
                 where payment_id = pay.id and event_type = p_event_type
                   and payload_digest is not distinct from p_digest) then
    v_ev := null;
  else
    insert into public.payment_events (payment_id, event_type, payload_digest)
    values (pay.id, p_event_type, p_digest) returning id into v_ev;
  end if;

  if v_ev is null then
    return jsonb_build_object('outcome', 'duplicate', 'order_status', ord.status, 'payment_status', pay.status);
  end if;

  if p_gateway_status = 'success' then
    if ord.status = 'paid' then      -- already fulfilled by an earlier, different event
      update public.payment_events set processing_status = 'processed', processed_at = now() where id = v_ev;
      return jsonb_build_object('outcome', 'processed', 'note', 'already_paid', 'order_status', ord.status);
    end if;
    if p_amount is distinct from ord.total_amount or p_amount is distinct from pay.amount
       or upper(coalesce(p_currency, '')) is distinct from ord.currency then
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_ev;
      return jsonb_build_object('outcome', 'rejected', 'reason', 'amount_or_currency_mismatch', 'order_status', ord.status);
    end if;
    if ord.status <> 'pending' or pay.status not in ('initiated', 'pending') then
      -- e.g. the order expired before the money arrived: needs manual reconciliation / refund
      update public.payment_events set processing_status = 'rejected', processed_at = now() where id = v_ev;
      return jsonb_build_object('outcome', 'rejected', 'reason', 'order_not_payable', 'order_status', ord.status);
    end if;

    update public.payments set status = 'success', verified_at = now() where id = pay.id;
    update public.orders set status = 'paid', paid_at = now() where id = ord.id;
    perform private.activate_enrollments_for_order(ord.id, 'purchase');
    update public.payment_events set processing_status = 'processed', processed_at = now() where id = v_ev;
    return jsonb_build_object('outcome', 'processed', 'order_status', 'paid');

  elsif p_gateway_status in ('failed', 'cancelled') then
    if pay.status in ('initiated', 'pending') then
      update public.payments set status = p_gateway_status where id = pay.id;
      select exists (select 1 from public.payments
                      where order_id = ord.id and id <> pay.id and status in ('initiated', 'pending')) into v_open;
      if ord.status = 'pending' and not v_open then
        update public.orders set status = p_gateway_status where id = ord.id;
      end if;
    end if;
    update public.payment_events set processing_status = 'processed', processed_at = now() where id = v_ev;
    select * into ord from public.orders where id = ord.id;
    return jsonb_build_object('outcome', 'processed', 'order_status', ord.status);

  else  -- pending
    if pay.status = 'initiated' then
      update public.payments set status = 'pending' where id = pay.id;
    end if;
    update public.payment_events set processing_status = 'processed', processed_at = now() where id = v_ev;
    return jsonb_build_object('outcome', 'processed', 'order_status', ord.status);
  end if;
end $$;

-- Maintenance (run from a Supabase scheduled job, see docs/operations.md).
create or replace function public.expire_stale_orders() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  -- Orders with a payment attempt in the last hour are left alone so a customer still
  -- sitting on the gateway page is not cut off.
  with stale as (
    select o.id from public.orders o
     where o.status = 'pending' and o.expires_at is not null and o.expires_at < now()
       and not exists (select 1 from public.payments p
                        where p.order_id = o.id
                          and (p.status = 'success'
                               or (p.status in ('initiated', 'pending') and p.created_at > now() - interval '1 hour')))
  ), cancelled as (
    update public.payments p set status = 'cancelled'
     where p.status in ('initiated', 'pending') and p.order_id in (select id from stale)
  )
  update public.orders set status = 'expired' where id in (select id from stale);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.expire_enrollments() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  update public.enrollments set status = 'expired'
   where status = 'active' and expires_at is not null and expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- admin-grant-enrollment (service role; the Edge Function authenticates the admin)
-- ---------------------------------------------------------------------------
create or replace function public.grant_enrollment(
  p_actor uuid, p_student uuid, p_course uuid, p_action text, p_reason text, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.enrollments;
begin
  perform set_config('app.actor_id', p_actor::text, true);
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason_required'; end if;
  if not exists (select 1 from public.profiles where id = p_student) then raise exception 'student_not_found'; end if;
  if not exists (select 1 from public.courses where id = p_course) then raise exception 'course_not_found'; end if;

  if p_action = 'grant' then
    if p_expires_at is not null and p_expires_at <= now() then raise exception 'expiry_must_be_in_future'; end if;
    insert into public.enrollments (student_id, course_id, status, source, enrolled_at, expires_at)
    values (p_student, p_course, 'active', 'manual', now(), p_expires_at)
    on conflict (student_id, course_id) do update
       set status = 'active', source = 'manual', enrolled_at = now(), expires_at = excluded.expires_at
    returning * into e;
    perform private.write_audit(p_actor, 'enrollment.grant', 'enrollments', e.id::text,
      jsonb_build_object('reason', p_reason, 'student_id', p_student, 'course_id', p_course, 'expires_at', p_expires_at));
  elsif p_action = 'revoke' then
    update public.enrollments set status = 'cancelled'
     where student_id = p_student and course_id = p_course and status = 'active'
    returning * into e;
    if not found then raise exception 'no_active_enrollment'; end if;
    perform private.write_audit(p_actor, 'enrollment.revoke', 'enrollments', e.id::text,
      jsonb_build_object('reason', p_reason, 'student_id', p_student, 'course_id', p_course));
  else
    raise exception 'invalid_action';
  end if;
  return to_jsonb(e);
end $$;

-- ---------------------------------------------------------------------------
-- admin-manage-course
-- ---------------------------------------------------------------------------
create or replace function public.admin_manage_course(
  p_actor uuid, p_action text, p_course_id uuid, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.courses;
begin
  perform set_config('app.actor_id', p_actor::text, true);

  if p_action = 'create' then
    insert into public.courses (title, slug, description, thumbnail_path, price_amount, currency, published)
    values (p_payload ->> 'title', p_payload ->> 'slug', p_payload ->> 'description',
            p_payload ->> 'thumbnail_path', coalesce((p_payload ->> 'price_amount')::bigint, 0),
            coalesce(p_payload ->> 'currency', 'BDT'), false)
    returning * into c;

  elsif p_action = 'update' then
    update public.courses set
      title          = coalesce(p_payload ->> 'title', title),
      slug           = coalesce(p_payload ->> 'slug', slug),
      description    = case when p_payload ? 'description' then p_payload ->> 'description' else description end,
      thumbnail_path = case when p_payload ? 'thumbnail_path' then p_payload ->> 'thumbnail_path' else thumbnail_path end,
      price_amount   = coalesce((p_payload ->> 'price_amount')::bigint, price_amount),
      currency       = coalesce(p_payload ->> 'currency', currency)
     where id = p_course_id returning * into c;

  elsif p_action = 'publish' then
    update public.courses set published = true  where id = p_course_id and archived_at is null returning * into c;
  elsif p_action = 'unpublish' then
    update public.courses set published = false where id = p_course_id returning * into c;
  elsif p_action = 'archive' then
    update public.courses set published = false, archived_at = now() where id = p_course_id returning * into c;
  elsif p_action = 'unarchive' then
    update public.courses set archived_at = null where id = p_course_id returning * into c;
  else
    raise exception 'invalid_action';
  end if;

  if c.id is null then raise exception 'course_not_found'; end if;
  return to_jsonb(c);
end $$;

-- ---------------------------------------------------------------------------
-- Callable by signed-in users, but they authorize themselves inside the function.
-- ---------------------------------------------------------------------------

-- Spec 8.2: roles are assigned only through a trusted administrative workflow.
create or replace function public.admin_set_role(p_target uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not (select public.is_super_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('student', 'instructor', 'admin', 'super_admin') then raise exception 'invalid_role'; end if;
  if p_target = (select auth.uid()) then raise exception 'cannot_change_own_role'; end if;
  update public.profiles set role = p_role where id = p_target;
  if not found then raise exception 'user_not_found'; end if;
end $$;

-- Authorized refund workflow (paid -> refunded). Records the state change; the money
-- itself is returned from the gateway merchant panel.
create or replace function public.admin_refund_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders;
begin
  if not (select public.is_super_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason_required'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'paid' then raise exception 'order_not_refundable'; end if;

  update public.orders set status = 'refunded' where id = o.id;
  update public.payments set status = 'refunded' where order_id = o.id and status = 'success';
  update public.enrollments e set status = 'refunded'
   where e.student_id = o.student_id and e.status = 'active' and e.source = 'purchase'
     and e.course_id in (select course_id from public.order_items where order_id = o.id);
  perform private.write_audit((select auth.uid()), 'order.refund', 'orders', o.id::text,
                              jsonb_build_object('reason', p_reason, 'total_amount', o.total_amount));
end $$;

grant execute on function public.admin_set_role(uuid, text)    to authenticated;
grant execute on function public.admin_refund_order(uuid, text) to authenticated;

-- Service-role-only functions.
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_order(uuid, uuid[], text)',
    'public.create_payment_record(uuid, uuid, text)',
    'public.mark_payment_pending(uuid)',
    'public.mark_payment_init_failed(uuid)',
    'public.process_payment_verification(text, text, text, text, text, text, bigint, text)',
    'public.expire_stale_orders()',
    'public.expire_enrollments()',
    'public.grant_enrollment(uuid, uuid, uuid, text, text, timestamptz)',
    'public.admin_manage_course(uuid, text, uuid, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
