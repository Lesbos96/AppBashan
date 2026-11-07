-- Snapshot (SNAPSHOT_SQL): nur ein Select, nach jeder Lockerung und jedem Restore
select k, n, md5(v) as h, e from (
  select 'table' as k, ns.nspname || '.' || c.relname as n, concat_ws(' ', c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relowner::regrole::text, c.relacl::text, c.reloptions::text) as v, null::text as e
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')
  union all
  select 'viewdef', ns.nspname || '.' || c.relname, pg_get_viewdef(c.oid), null
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('v', 'm')
  union all
  select 'column', ns.nspname || '.' || c.relname || '.' || a.attname, concat_ws(' ', format_type(a.atttypid, a.atttypmod), a.attnotnull, coalesce(pg_get_expr(d.adbin, d.adrelid), '<kein Default>'), a.attacl::text), null
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace ns on ns.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where ns.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
  union all
  select 'policy', p.schemaname || '.' || p.tablename || '.' || p.policyname, concat_ws(' ', p.permissive, p.cmd, p.roles::text, p.qual, p.with_check), null
    from pg_policies p where p.schemaname = 'public' or (p.schemaname = 'storage' and p.tablename = 'objects')
  union all
  select 'constraint', ns.nspname || '.' || c.relname || '.' || k.conname, concat_ws(' ', pg_get_constraintdef(k.oid), k.convalidated), null
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public'
  union all
  select 'trigger', ns.nspname || '.' || c.relname || '.' || t.tgname, concat_ws(' ', t.tgenabled, pg_get_triggerdef(t.oid)), t.tgenabled::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace ns on ns.oid = c.relnamespace
    where not t.tgisinternal and (ns.nspname = 'public' or (ns.nspname = 'auth' and c.relname = 'users') or (ns.nspname = 'storage' and c.relname = 'objects'))
  union all
  select 'function', p.pronamespace::regnamespace::text || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    concat_ws(' ', md5(pg_get_functiondef(p.oid)), md5(p.prosrc), p.proacl::text, p.proowner::regrole::text, p.prosecdef, p.proconfig::text), null
    from pg_proc p where p.pronamespace::regnamespace::text in ('public', 'private') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  union all
  select 'schema', nspname, concat_ws(' ', nspowner::regrole::text, nspacl::text), null from pg_namespace where nspname in ('public', 'private', 'storage')
  union all
  select 'defacl', defaclrole::regrole::text || '.' || coalesce(defaclnamespace::regnamespace::text, '') || '.' || defaclobjtype::text, defaclacl::text, null from pg_default_acl
  union all
  select 'bucket', id, concat_ws(' ', public, file_size_limit, allowed_mime_types::text), null from storage.buckets
  union all
  select 'role', rolname, concat_ws(' ', rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole, rolcreatedb), null from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
  union all
  select 'member', r.rolname || '>' || m.rolname, am.admin_option::text, null from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
    where r.rolname in ('anon', 'authenticated', 'service_role') or m.rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
  union all
  select 'evtrigger', evtname, concat_ws(' ', evtevent, evtenabled, evtfoid::regproc::text), null from pg_event_trigger
  union all
  select 'extension', e.extname, concat_ws(' ', e.extversion, e.extnamespace::regnamespace::text), null from pg_extension e
  union all
  select 'setting', key, count(*)::text, null from public.platform_settings group by key
  union all
  select 'cron', jobname, concat_ws(' ', schedule, active, command), active::text from cron.job where jobname is not null
) s order by 1, 2

-- Probe
begin; grant update on public.rental_bookings to service_role; insert into public.rental_bookings (id, offer_id, customer_id, pickup_at, return_at, km, price_snapshot, price_version, total_cents, deposit_cents)
    select '19bf847a-fbd1-4d79-a774-24a6ccd80c6c', (select id from public.rental_offers limit 1), '00000000-0000-0000-0000-000000000001', now() + interval '20 days', now() + interval '21 days', 10, '{}', 1, 100, 0; create temp table res (v text); do $p$ begin begin set local role service_role;  update public.rental_bookings set status = 'withdrawn' where id = '19bf847a-fbd1-4d79-a774-24a6ccd80c6c'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select status from public.rental_bookings where id = '19bf847a-fbd1-4d79-a774-24a6ccd80c6c'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- rental_bookings: UPDATE für service_role (Schicht: guard_rental_status)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; grant update on public.rental_bookings to service_role; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; revoke update on public.rental_bookings from service_role; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; grant update on public.rental_bookings to service_role; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; revoke update on public.rental_bookings from service_role; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; grant update on public.rental_bookings to service_role; insert into public.rental_bookings (id, offer_id, customer_id, pickup_at, return_at, km, price_snapshot, price_version, total_cents, deposit_cents)
    select '19bf847a-fbd1-4d79-a774-24a6ccd80c6c', (select id from public.rental_offers limit 1), '00000000-0000-0000-0000-000000000001', now() + interval '20 days', now() + interval '21 days', 10, '{}', 1, 100, 0; create temp table res (v text); do $p$ begin begin set local role service_role;  update public.rental_bookings set status = 'completed' where id = '19bf847a-fbd1-4d79-a774-24a6ccd80c6c'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select status from public.rental_bookings where id = '19bf847a-fbd1-4d79-a774-24a6ccd80c6c'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant delete on public.rental_bookings to service_role; insert into public.rental_bookings (id, offer_id, customer_id, pickup_at, return_at, km, price_snapshot, price_version, total_cents, deposit_cents)
    select '19bf847a-fbd1-4d79-a774-24a6ccd80c6c', (select id from public.rental_offers limit 1), '00000000-0000-0000-0000-000000000001', now() + interval '20 days', now() + interval '21 days', 10, '{}', 1, 100, 0; create temp table res (v text); do $p$ begin begin set local role service_role;  delete from public.rental_bookings where id = '19bf847a-fbd1-4d79-a774-24a6ccd80c6c'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.rental_bookings where id = '19bf847a-fbd1-4d79-a774-24a6ccd80c6c'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- rental_bookings: DELETE für service_role (Schicht: Löschschutz)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; grant delete on public.rental_bookings to service_role; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; revoke delete on public.rental_bookings from service_role; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; grant delete on public.rental_bookings to service_role; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; revoke delete on public.rental_bookings from service_role; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if false and not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '817f99ad-eabf-4707-bccf-84b473f99352', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":1,"lowCents":1,"highCents":1,"lines":[]}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- terms_missing: Bedingungen im Snapshot nicht mehr verlangt (Schicht: invalid_revision)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if false and not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if false and not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if false and p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => 'e89adba7-fe1e-4dcd-af65-a9263d201dbe', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => null, p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- district_required: Bezirk nicht mehr verlangt (Schicht: NOT NULL der Spalte)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if false and p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if false and p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    null;
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '7124dc2c-ed25-45d3-9c35-c4b06a32e8d9', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => null, p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- contact_required: Kontakt nicht mehr verlangt (Schicht: NOT NULL der Spalten)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    null;
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    null;
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    null;
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '413d1fae-2f63-4be2-8af9-29df444fa621', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => null); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001') || '/' || (select count(*) from public.audit_log where entity_id in (select id::text from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001') and action = 'price_confirmed'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- confirmed_required: Bestätigung nicht mehr verlangt (Schicht: NOT NULL audit_log.detail)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    null;
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    null;
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if false and hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '0cf240de-055d-48ed-82c1-f9a239958a5e', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-07', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- too_late: Mindestvorlauf nicht mehr geprüft (N-6, Test läuft gelockert)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if false and hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if false and hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_save_request(p_customer uuid, p_client_ref uuid, p_service service_type, p_inputs jsonb, p_snapshot jsonb, p_price_version integer, p_total integer, p_low integer, p_high integer, p_from_address text, p_from_lon double precision, p_from_lat double precision, p_to_address text, p_to_lon double precision, p_to_lat double precision, p_route jsonb, p_region region, p_district smallint, p_preferred_date date, p_time_window text, p_description text, p_volume numeric, p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, status request_status, needs_quote boolean, created boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  r public.service_requests;
  rev uuid;
  today date := (now() at time zone 'Europe/Vienna')::date;
  keys text[] := array['accept_max_hours', 'accept_min_hours', 'accept_lead_share_percent'];
  k text;
  v numeric;
  s jsonb := '{}';
  termin timestamptz;
  hours numeric;
  deadline timestamptz;
  staging interval;
  pid uuid;
  pname text;
  pcreated timestamptz;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_client_ref is null then
    raise exception 'client_ref_required';
  end if;
  -- Wiederholung derselben client_ref: die vorhandene Anfrage, auch wenn der Termin inzwischen zu nah ist.
  select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
  if r.id is not null then
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;
  if p_district is null then
    raise exception 'district_required';
  end if;
  if p_contact is null or coalesce(p_contact ->> 'name', '') = '' or coalesce(p_contact ->> 'phone', '') = '' or coalesce(p_contact ->> 'email', '') = '' then
    raise exception 'contact_required';
  end if;
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
  end if;
  if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then
    raise exception 'confirmed_required';
  end if;
  -- Die dem Kunden gezeigten Bedingungen gehören in die Revision (Konzept 5.4); ohne sie entsteht keine Anfrage.
  if not coalesce(p_snapshot -> 'terms' ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents', 'termsHash'], false) then
    raise exception 'terms_missing';
  end if;
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 8 then
    raise exception 'too_many_photos';
  end if;
  staging := public.photo_staging_interval();
  if p_time_window is not null then
    keys := keys || ('window_start_' || p_time_window);
  end if;
  foreach k in array keys loop
    select st.value into v from public.platform_settings st
    where st.key = k and st.effective_from <= today
    order by st.effective_from desc, st.version desc limit 1;
    if v is null then
      raise exception 'setting_missing';
    end if;
    s := s || jsonb_build_object(k, v);
  end loop;

  termin := ((p_preferred_date::timestamp + make_interval(mins => coalesce((s ->> ('window_start_' || p_time_window))::numeric::int, 0)))
    at time zone 'Europe/Vienna');
  hours := extract(epoch from termin - now()) / 3600;
  if hours < (s ->> 'accept_min_hours')::numeric then
    raise exception 'too_late';
  end if;
  deadline := now() + make_interval(secs => (3600 * greatest(
    (s ->> 'accept_min_hours')::numeric,
    least((s ->> 'accept_max_hours')::numeric, (s ->> 'accept_lead_share_percent')::numeric / 100 * hours)
  ))::double precision);

  insert into public.service_requests as q (
    customer_id, client_ref, service, status,
    from_address, from_point, to_address, to_point, route, region, district,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, from_pt, p_to_address, to_pt, p_route, p_region, p_district,
    p_preferred_date, p_time_window, p_description, p_volume, termin, deadline
  )
  on conflict (customer_id, client_ref) do nothing
  returning q.* into r;
  if r.id is null then
    select q.* into r from public.service_requests q where q.customer_id = p_customer and q.client_ref = p_client_ref;
    return query select r.id, r.status, r.status = 'awaiting_offer', false;
    return;
  end if;

  insert into public.price_revisions as pr (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, 1, 'submit', p_inputs, p_snapshot, p_price_version, p_total, p_low, p_high)
  returning pr.id into rev;
  update public.service_requests q set current_revision = rev where q.id = r.id;

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  values (r.id, p_contact ->> 'name', p_contact ->> 'phone', p_contact ->> 'email', nullif(p_contact ->> 'stairsDoor', ''));

  -- Fotos: nur Dateien im eigenen Staging-Ordner dieser client_ref, nicht abgelaufen. Eine fremde oder fehlende ID, ein abgelaufenes Foto
  -- oder jeder andere Fehler rollt die ganze Anfrage zurück.
  perform set_config('app.mv_photo_request', r.id::text, true);
  for pid in select distinct x from unnest(coalesce(p_photo_ids, '{}')) x loop
    pname := p_customer::text || '/' || p_client_ref::text || '/' || pid::text || '.jpg';
    select o.created_at into pcreated from storage.objects o where o.bucket_id = 'request-photos' and o.name = pname;
    if not found then
      raise exception 'photo_missing';
    end if;
    if pcreated is null or pcreated < now() - staging then
      raise exception 'photo_expired';
    end if;
    insert into public.request_photos (request_id, storage_path) values (r.id, pname);
  end loop;
  perform set_config('app.mv_photo_request', '', true);

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter table public.request_contacts drop constraint request_contacts_format; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '3ca5d1af-a016-48aa-bcc9-e2bc13804d97', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kein-mail","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- request_contacts_format: Kontaktformat-Constraint entfernt
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter table public.request_contacts drop constraint request_contacts_format; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; delete from public.request_contacts where request_id in (select r.id from public.service_requests r join auth.users u on u.id = r.customer_id where u.email like '%@movenow.test') and not (((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (phone ~ '([0-9][^0-9]*){5}'::text)));
alter table public.request_contacts drop constraint if exists request_contacts_format;
alter table public.request_contacts add constraint request_contacts_format CHECK (((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (phone ~ '([0-9][^0-9]*){5}'::text))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter table public.request_contacts drop constraint request_contacts_format; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; delete from public.request_contacts where request_id in (select r.id from public.service_requests r join auth.users u on u.id = r.customer_id where u.email like '%@movenow.test') and not (((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (phone ~ '([0-9][^0-9]*){5}'::text)));
alter table public.request_contacts drop constraint if exists request_contacts_format;
alter table public.request_contacts add constraint request_contacts_format CHECK (((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (phone ~ '([0-9][^0-9]*){5}'::text))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    true,
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform 1; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select in_vienna from public.quote_district(15.4395, 47.0707)))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- quote_district: Prüfung „liegt in Wien“ ausgeschaltet (Grazer Punkt)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    true,
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    true,
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select 99::smallint)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform 1; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select district from public.quote_district(16.3731, 48.2086)))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- quote_district: Bezirk aus falschem Polygon (immer 99)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select 99::smallint)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select 99::smallint)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.quote_district(p_lon double precision, p_lat double precision)
 RETURNS TABLE(in_vienna boolean, in_austria boolean, district smallint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; grant select on public.geo_districts to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform 1 from public.geo_districts; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.geo_districts))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- geo_districts: SELECT für authenticated (Schicht: RLS ohne Policy)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; grant select on public.geo_districts to authenticated; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; revoke select on public.geo_districts from authenticated; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; grant select on public.geo_districts to authenticated; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; revoke select on public.geo_districts from authenticated; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; grant select on public.geocode_cache to authenticated; insert into public.geocode_cache (key, value, expires_at) values ('redproof:845e5118-6da7-4d86-a176-610a28b64173', '[]', now() + interval '1 hour'); create policy redproof_gc on public.geocode_cache for select to authenticated using (true); select set_config('app.probe_val', '0', true); create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform set_config('app.probe_val', (select count(*) from public.geocode_cache where key = 'redproof:845e5118-6da7-4d86-a176-610a28b64173')::text, true); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((current_setting('app.probe_val', true))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- geocode_cache: SELECT für authenticated (isoliert: Lese-Policy nur in der Probe)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; grant select on public.geocode_cache to authenticated; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; revoke select on public.geocode_cache from authenticated; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; grant select on public.geocode_cache to authenticated; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; revoke select on public.geocode_cache from authenticated; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; grant execute on function public.quote_district(double precision, double precision) to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform * from public.quote_district(16.3731, 48.2086); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select district from public.quote_district(16.3731, 48.2086)))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- quote_district: EXECUTE für authenticated (Schicht: kein Recht auf geo_boundaries)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; grant execute on function public.quote_district(double precision, double precision) to authenticated; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; revoke execute on function public.quote_district(double precision, double precision) from authenticated; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; grant execute on function public.quote_district(double precision, double precision) to authenticated; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; revoke execute on function public.quote_district(double precision, double precision) from authenticated; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) to authenticated; create policy redproof_ps on public.platform_settings for select to authenticated using (true); grant insert on public.service_requests, public.price_revisions, public.request_contacts, public.audit_log to authenticated; grant update (current_revision) on public.service_requests to authenticated; create policy redproof_sr_i on public.service_requests for insert to authenticated with check (true); create policy redproof_sr_u on public.service_requests for update to authenticated using (true) with check (true); create policy redproof_pr_i on public.price_revisions for insert to authenticated with check (true); create policy redproof_rc_i on public.request_contacts for insert to authenticated with check (true); create policy redproof_al_i on public.audit_log for insert to authenticated with check (true); grant execute on function public.photo_staging_interval() to authenticated; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => 'b55fd805-3aec-442e-8e89-b088a65455fd', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- quote_save_request: EXECUTE für authenticated (isoliert: innere Schichten und photo_staging_interval nur in der Probe offen)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) to authenticated; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; revoke execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) from authenticated; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) to authenticated; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; revoke execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) from authenticated; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; grant execute on function public.photo_staging_interval() to authenticated; create policy redproof_ps on public.platform_settings for select to authenticated using (true); grant insert on public.service_requests, public.price_revisions, public.request_contacts, public.audit_log to authenticated; grant update (current_revision) on public.service_requests to authenticated; create policy redproof_sr_i on public.service_requests for insert to authenticated with check (true); create policy redproof_sr_u on public.service_requests for update to authenticated using (true) with check (true); create policy redproof_pr_i on public.price_revisions for insert to authenticated with check (true); create policy redproof_rc_i on public.request_contacts for insert to authenticated with check (true); create policy redproof_al_i on public.audit_log for insert to authenticated with check (true); grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) to authenticated; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => 'fbbe4e76-d78f-4816-a86b-4ff435aec464', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant execute on function public.publish_version(uuid, int) to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform public.publish_version('00000000-0000-0000-0000-000000000001', 9990); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.price_versions where version = 9990))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; CREATE OR REPLACE FUNCTION private.assert_admin(p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_actor is null or not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    null;
  end if;
end
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.admin_set_setting('00000000-0000-0000-0000-000000000001', 'cancel_free_hours', 24, current_date + 60); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.platform_settings where key = 'cancel_free_hours' and effective_from > current_date))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; CREATE OR REPLACE FUNCTION private.guard_price_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    if false then
      raise exception 'field_immutable';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.published then raise exception 'version_published'; end if;
    return old;
  end if;
  if old.published then raise exception 'version_published'; end if;
  if new.version <> old.version then raise exception 'field_immutable'; end if;
  if new.published is distinct from old.published
     or new.published_at is distinct from old.published_at
     or new.content_hash is distinct from old.content_hash then
    -- nur die Veröffentlichung mit Marker für genau diese Version, ohne gleichzeitige Inhaltsänderung
    if current_setting('app.mv_publish', true) is distinct from old.version::text
       or new.published is not true
       or new.effective_on <> old.effective_on
       or new.note is distinct from old.note then
      raise exception 'field_immutable';
    end if;
    new.published_at := now();
    new.content_hash := private.price_version_hash(old.version);
  end if;
  return new;
end
$function$
; ; create temp table res (v text); do $p$ begin begin   insert into public.price_versions (version, effective_on, note, published, published_at, content_hash) values (9990, current_date + 400, 'redproof', true, now(), repeat('a', 64)); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.price_versions where version = 9990))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant truncate on public.platform_settings to service_role; ; create temp table res (v text); do $p$ begin begin set local role service_role;  truncate public.platform_settings; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.platform_settings))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; CREATE OR REPLACE FUNCTION public.booking_terms()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  keys text[] := array['fee_rate', 'cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents'];
  k text;
  v numeric;
  r jsonb := '{}';
  txt text := '';
begin
  foreach k in array keys loop
    select s.value into v from public.platform_settings s
    where s.key = k and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1;
    if v is null then raise exception 'setting_missing'; end if;
    r := r || jsonb_build_object(k, v);
    txt := txt || k || '=' || v::text || E'\n';
  end loop;
  return r || jsonb_build_object('termsHash', encode(sha256(convert_to(txt, 'UTF8')), 'hex'));
end
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform 1; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((public.booking_terms())::text like '%fee_rate%')::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter table public.service_requests disable trigger request_delete_guard; ; create temp table res (v text); do $p$ begin begin   delete from public.service_requests where id = '00000000-0000-0000-0000-000000000001'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- quote: Abholung außerhalb Wiens nicht mehr geprüft (Schicht: Bezirk aus Polygon) (Deploy aus Commit b9b22b8893dfa07bb519e85ab2249e157ca0e1eb)


-- quote: gezeigter Betrag nicht mehr abgeglichen (Kundenpreis ohne Zustimmung) (Deploy aus Commit b9b22b8893dfa07bb519e85ab2249e157ca0e1eb)


-- quote: Haltefenster nicht mehr geprüft (abgelaufene Version zählt) (Deploy aus Commit b9b22b8893dfa07bb519e85ab2249e157ca0e1eb)


-- quote: Bedingungen-Hash nicht mehr abgeglichen (Deploy aus Commit b9b22b8893dfa07bb519e85ab2249e157ca0e1eb)


-- quote: Client-Punkt bindet nicht mehr an den Kandidaten (Schicht: Bezirk/Wien-Prüfung) (Deploy aus Commit b9b22b8893dfa07bb519e85ab2249e157ca0e1eb)

