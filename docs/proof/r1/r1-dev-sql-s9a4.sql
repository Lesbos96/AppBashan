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

-- Fixture
begin; alter table public.request_photos disable trigger guard_photo_insert; insert into public.request_photos (request_id, storage_path) values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000ff/ebc659f2-fa2b-438d-9e94-a0fb3f60f818.jpg'), ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000ff/53a04622-74e9-4d1f-9319-3214db6e6f43.jpg'); alter table public.request_photos enable trigger guard_photo_insert; commit; select 1 as x

-- Fixture
begin; alter table public.request_photos disable trigger guard_photo_insert; insert into public.request_photos (request_id, storage_path) values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000004/00000000-0000-0000-0000-0000000000ff/09910d2e-2e94-474f-843d-4dbc03d15535.jpg'); alter table public.request_photos enable trigger guard_photo_insert; commit; select 1 as x

-- cron photo-cleanup pausiert
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; select cron.alter_job((select jobid from cron.job where jobname = 'photo-cleanup'), active := false); <SNAPSHOT_SQL>; rollback;
-- 2. kein Totmann (Cron-Pause)
-- 3. Lockerung (committet):
begin; select cron.alter_job((select jobid from cron.job where jobname = 'photo-cleanup'), active := false); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; select cron.alter_job((select jobid from cron.job where jobname = 'photo-cleanup'), active := true); commit; select 1 as x

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
      null;
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
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '8941e3a5-e7f8-4e39-9473-f97c75b6138c', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', p_photo_ids => '{daed8986-3112-4d66-b045-91aed859af0d}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where client_ref = '8941e3a5-e7f8-4e39-9473-f97c75b6138c') || '/' || (select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = '8941e3a5-e7f8-4e39-9473-f97c75b6138c'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

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
      null;
    end if;
    if false then
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
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '8941e3a5-e7f8-4e39-9473-f97c75b6138c', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', p_photo_ids => '{daed8986-3112-4d66-b045-91aed859af0d}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where client_ref = '8941e3a5-e7f8-4e39-9473-f97c75b6138c') || '/' || (select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = '8941e3a5-e7f8-4e39-9473-f97c75b6138c'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- photo_missing und NULL-Zeitstempel nicht mehr geprüft: Foto-ID aus fremdem Ordner wird übernommen
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
      null;
    end if;
    if false then
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
      null;
    end if;
    if false then
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
    if pcreated is null then
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
; update storage.objects set created_at = now() - interval '25 hours' where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000001/6ae58549-2618-454e-be47-8b70fb9ebaa9/8c54f896-d397-4db5-8d2e-ec4a1dabd2da.jpg'; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '6ae58549-2618-454e-be47-8b70fb9ebaa9', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', p_photo_ids => '{8c54f896-d397-4db5-8d2e-ec4a1dabd2da}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where client_ref = '6ae58549-2618-454e-be47-8b70fb9ebaa9') || '/' || (select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = '6ae58549-2618-454e-be47-8b70fb9ebaa9'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- photo_expired: Ablaufprüfung entfernt (abgelaufenes Foto wird übernommen)
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
    if pcreated is null then
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
    if pcreated is null then
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
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 80 then
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
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => 'd7ff352c-be00-4df8-8426-882dea034815', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', p_photo_ids => '{e679c9a6-5054-48ff-bba1-e78cbc8da973,7c78b170-9d55-415f-b668-b25dd41f3b77,1e00b725-dbf0-4b5d-bd80-bf2520d40d0e,67b310ac-933a-4f20-ae44-3bb9d8b06e7e,71accc90-3948-4183-bb89-d4697d750a83,311f4ee1-fd07-412c-b520-be7f27646b98,9f4de627-5de7-4bc1-b409-dc8a5321566b,42522a92-ab7b-42f5-9fbc-992f6bb3f6c4,c43414ce-668a-4269-bbd7-5c1602f0b1d9}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where client_ref = 'd7ff352c-be00-4df8-8426-882dea034815') || '/' || (select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = 'd7ff352c-be00-4df8-8426-882dea034815'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 80 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => 'd7ff352c-be00-4df8-8426-882dea034815', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', p_photo_ids => '{e679c9a6-5054-48ff-bba1-e78cbc8da973,7c78b170-9d55-415f-b668-b25dd41f3b77,1e00b725-dbf0-4b5d-bd80-bf2520d40d0e,67b310ac-933a-4f20-ae44-3bb9d8b06e7e,71accc90-3948-4183-bb89-d4697d750a83,311f4ee1-fd07-412c-b520-be7f27646b98,9f4de627-5de7-4bc1-b409-dc8a5321566b,42522a92-ab7b-42f5-9fbc-992f6bb3f6c4,c43414ce-668a-4269-bbd7-5c1602f0b1d9}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where client_ref = 'd7ff352c-be00-4df8-8426-882dea034815') || '/' || (select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = 'd7ff352c-be00-4df8-8426-882dea034815'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

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
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 80 then
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
;
CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 80 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => 'd7ff352c-be00-4df8-8426-882dea034815', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}', p_photo_ids => '{e679c9a6-5054-48ff-bba1-e78cbc8da973,7c78b170-9d55-415f-b668-b25dd41f3b77,1e00b725-dbf0-4b5d-bd80-bf2520d40d0e,67b310ac-933a-4f20-ae44-3bb9d8b06e7e,71accc90-3948-4183-bb89-d4697d750a83,311f4ee1-fd07-412c-b520-be7f27646b98,9f4de627-5de7-4bc1-b409-dc8a5321566b,42522a92-ab7b-42f5-9fbc-992f6bb3f6c4,c43414ce-668a-4269-bbd7-5c1602f0b1d9}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where client_ref = 'd7ff352c-be00-4df8-8426-882dea034815') || '/' || (select count(*) from public.request_photos p join public.service_requests r on r.id = p.request_id where r.client_ref = 'd7ff352c-be00-4df8-8426-882dea034815'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- too_many_photos: Funktion und Trigger gelockert → 9 Fotos
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
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 80 then
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
;
CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 80 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
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
;
CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
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
  if (select count(distinct x) from unnest(coalesce(p_photo_ids, '{}')) x) > 80 then
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
;
CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 80 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
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
;
CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    return interval '24 hours';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; alter table public.platform_settings disable trigger user; delete from public.platform_settings where key = 'photo_staging_hours'; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.photo_staging_interval(); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.platform_settings where key = 'photo_staging_hours'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    return interval '24 hours';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; alter table public.platform_settings disable trigger user; delete from public.platform_settings where key = 'photo_staging_hours'; create temp table res (v text); do $p$ begin begin set local role service_role;  perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '2482535c-8157-4ff0-84bc-10ee7c003fa7', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- photo_staging_hours fehlt: Absenden speichert trotzdem
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    return interval '24 hours';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    raise exception 'setting_missing';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    return interval '24 hours';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    raise exception 'setting_missing';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.photo_staging_interval()
 RETURNS interval
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v numeric;
begin
  select st.value into v from public.platform_settings st
  where st.key = 'photo_staging_hours' and st.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by st.effective_from desc, st.version desc limit 1;
  if v is null or v <= 0 then
    return interval '24 hours';
  end if;
  return make_interval(secs => (v * 3600)::double precision);
end
$function$
; alter table public.platform_settings disable trigger user; delete from public.platform_settings where key = 'photo_staging_hours'; create temp table res (v text); do $p$ begin begin set local role service_role;  perform * from public.photo_orphans(); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.platform_settings where key = 'photo_staging_hours'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter table public.request_photos disable trigger guard_photo_insert; ; create temp table res (v text); do $p$ begin begin set local role service_role;  insert into public.request_photos (request_id, storage_path) values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001/1cf8ba3d-e1c7-4aec-82a0-11e745e6f68b/5583bb57-4971-4e49-90e7-0b6e4dc579ab.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- guard_photo_insert ausgeschaltet (Einfügen am Funktionspfad vorbei)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter table public.request_photos disable trigger guard_photo_insert; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter table public.request_photos enable trigger guard_photo_insert; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter table public.request_photos disable trigger guard_photo_insert; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter table public.request_photos enable trigger guard_photo_insert; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if false then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; ; create temp table res (v text); do $p$ begin begin set local role service_role;  insert into public.request_photos (request_id, storage_path) values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001/1cf8ba3d-e1c7-4aec-82a0-11e745e6f68b/e672b019-3f8c-47a8-bebd-8babd29dc5de.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or false and not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; ; create temp table res (v text); do $p$ begin begin   perform set_config('app.mv_photo_request', '00000000-0000-0000-0000-0000000000ff', true); insert into public.request_photos (request_id, storage_path) values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000002/8941e3a5-e7f8-4e39-9473-f97c75b6138c/1b79ed19-4126-4d51-a6c7-c0223dc18232.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant insert on public.request_photos to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); insert into public.request_photos (request_id, storage_path) values ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000001/1cf8ba3d-e1c7-4aec-82a0-11e745e6f68b/5d2d7015-cfec-4dd3-9d02-02e824bc8ae4.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter table public.request_photos disable trigger photo_immutable; ; create temp table res (v text); do $p$ begin begin   update public.request_photos set request_id = '00000000-0000-0000-0000-0000000000ff' where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select request_id from public.request_photos where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg') = '00000000-0000-0000-0000-0000000000ff')::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- photo_immutable ausgeschaltet: UPDATE (Umhängen auf andere Anfrage)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter table public.request_photos disable trigger photo_immutable; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter table public.request_photos enable trigger photo_immutable; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter table public.request_photos disable trigger photo_immutable; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter table public.request_photos enable trigger photo_immutable; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter table public.request_photos disable trigger photo_immutable; ; create temp table res (v text); do $p$ begin begin   delete from public.request_photos where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter table public.request_photos disable trigger photo_immutable_truncate; ; create temp table res (v text); do $p$ begin begin   truncate public.request_photos; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) > 0 from public.request_photos))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant update on public.request_photos to service_role; ; create temp table res (v text); do $p$ begin begin set local role service_role;  update public.request_photos set request_id = '00000000-0000-0000-0000-0000000000ff' where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select request_id from public.request_photos where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant delete on public.request_photos to service_role; ; create temp table res (v text); do $p$ begin begin set local role service_role;  delete from public.request_photos where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant truncate on public.request_photos to service_role; ; create temp table res (v text); do $p$ begin begin set local role service_role;  truncate public.request_photos; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) > 0 from public.request_photos))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant update on public.request_photos to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); update public.request_photos set request_id = '00000000-0000-0000-0000-0000000000ff' where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select request_id from public.request_photos where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant delete on public.request_photos to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); delete from public.request_photos where storage_path = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg'; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter policy request_photos_select on public.request_photos using (true); ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true); perform set_config('app.probe_val', (select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff')::text, true); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((current_setting('app.probe_val'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- request_photos_select: jeder liest (fremde Fotos)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_select on public.request_photos using (true); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_select on public.request_photos using ((EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.id = request_photos.request_id) AND (r.customer_id = ( SELECT auth.uid() AS uid)))))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_select on public.request_photos using (true); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_select on public.request_photos using ((EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.id = request_photos.request_id) AND (r.customer_id = ( SELECT auth.uid() AS uid)))))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter policy request_photos_select on public.request_photos using (exists (select 1 from public.service_requests r where r.id = request_photos.request_id and r.customer_id = (select auth.uid())) or (select private.is_admin())); select public.admin_grant_role('00000000-0000-0000-0000-000000000002', 'admin'); create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true); perform set_config('app.probe_val', (select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff')::text, true); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((current_setting('app.probe_val'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))); select public.admin_grant_role('00000000-0000-0000-0000-000000000002', 'admin'); create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true); perform set_config('app.probe_val', (select count(*) from storage.objects where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg')::text, true); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((current_setting('app.probe_val'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos'); ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true); perform set_config('app.probe_val', (select count(*) from storage.objects where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg')::text, true); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((current_setting('app.probe_val'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- request_photos_objects_select: Ordner-Bedingung entfernt (fremde Datei lesen)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos'); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_select on storage.objects using (((bucket_id = 'request-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos'); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_select on storage.objects using (((bucket_id = 'request-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); insert into storage.objects (bucket_id, name) values ('request-photos', '00000000-0000-0000-0000-000000000002/c28df8d2-9c33-40ae-a182-cda4dfdc633e/04b0a5d1-2029-4f59-8c2c-1563d0d074d7.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from storage.objects where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000002/c28df8d2-9c33-40ae-a182-cda4dfdc633e/04b0a5d1-2029-4f59-8c2c-1563d0d074d7.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Storage-INSERT: Fremdordner-Bedingung entfernt (Datei in Ordner eines anderen)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); insert into storage.objects (bucket_id, name) values ('request-photos', '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/781bdb11-cfd9-47ce-b43c-11ae7f0f6e06.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from storage.objects where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/781bdb11-cfd9-47ce-b43c-11ae7f0f6e06.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Storage-INSERT: Bedingung „keine Anfrage zu client_ref“ entfernt (Hinzufügen nach dem Absenden)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); insert into storage.objects (bucket_id, name) values ('request-photos', '00000000-0000-0000-0000-000000000001/c28df8d2-9c33-40ae-a182-cda4dfdc633e/foto.jpg'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from storage.objects where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000001/c28df8d2-9c33-40ae-a182-cda4dfdc633e/foto.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Storage-INSERT: Pfadform nicht mehr geprüft
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name) and (select private.staging_photo_count()) < 40); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-DELETE: Fremdordner-Bedingung entfernt, dazu SELECT-Sicht geöffnet (fremdes Staging-Foto löschen)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name));
alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos'); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name))))));
alter policy request_photos_objects_select on storage.objects using (((bucket_id = 'request-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name));
alter policy request_photos_objects_select on storage.objects using (bucket_id = 'request-photos'); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name))))));
alter policy request_photos_objects_select on storage.objects using (((bucket_id = 'request-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-DELETE: Bedingung „keine Anfrage zu client_ref“ entfernt (Löschen nach dem Absenden)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-DELETE: Zeilen-Bedingung entfernt (Schicht: client_ref-Bedingung; schützt Alt-Objekte nur über die Zeile)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2])); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2])); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-DELETE: client_ref-Bedingung entfernt (Schicht: Zeilen-Bedingung)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage: UPDATE-Policy für Eigentümer vorhanden (Ersetzen/Verschieben nach dem Absenden)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; create policy redproof_update on storage.objects for update to authenticated using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; drop policy if exists redproof_update on storage.objects; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; create policy redproof_update on storage.objects for update to authenticated using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; drop policy if exists redproof_update on storage.objects; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-DELETE: Zeilen-Bedingung entfernt (Alt-Pfad, A-M2: hier hält allein die Zeile)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2])); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_delete on storage.objects using (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2])); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_delete on storage.objects using (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-INSERT: Zeilen-Bedingung entfernt (Alt-Pfad, A-M2: Name einer übernommenen Datei)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and (select private.staging_photo_count()) < 40); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and (select private.staging_photo_count()) < 40); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Storage-INSERT: Mengengrenze (40) entfernt (41. Datei eines Kontos)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)); <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter policy request_photos_objects_insert on storage.objects with check (bucket_id = 'request-photos' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' and (storage.foldername(name))[1] = (select auth.uid())::text and not exists (select 1 from public.service_requests r where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]) and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)); commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter policy request_photos_objects_insert on storage.objects with check (((bucket_id = 'request-photos'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM service_requests r
  WHERE ((r.customer_id = ( SELECT auth.uid() AS uid)) AND ((r.client_ref)::text = (storage.foldername(objects.name))[2]))))) AND (NOT (EXISTS ( SELECT 1
   FROM request_photos p
  WHERE (p.storage_path = objects.name)))) AND (( SELECT private.staging_photo_count() AS staging_photo_count) < 40))); commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- staging_photo_count: übernommene Dateien zählen mit (Aussperr-Schutz: 40 Dateien, davon eine übernommen)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION private.staging_photo_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name >= ((select auth.uid())::text || '/') collate "C"
    and o.name < ((select auth.uid())::text || '0') collate "C"
    
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION private.staging_photo_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name >= ((select auth.uid())::text || '/') collate "C"
    and o.name < ((select auth.uid())::text || '0') collate "C"
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION private.staging_photo_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name >= ((select auth.uid())::text || '/') collate "C"
    and o.name < ((select auth.uid())::text || '0') collate "C"
    
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION private.staging_photo_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name >= ((select auth.uid())::text || '/') collate "C"
    and o.name < ((select auth.uid())::text || '0') collate "C"
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; ; create temp table res (v text); do $p$ begin begin   perform set_config('app.mv_photo_request', '00000000-0000-0000-0000-0000000000ff', true); insert into public.request_photos (request_id) values ('00000000-0000-0000-0000-0000000000ff'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- guard_photo_insert: NULL-Pfad nicht mehr abgefangen (Schicht: NOT NULL der Spalte, Marker gesetzt)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION private.guard_photo_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; alter table public.request_photos alter column storage_path set default ''; alter table public.request_photos disable trigger guard_photo_insert; create temp table res (v text); do $p$ begin begin   insert into public.request_photos (request_id) values ('00000000-0000-0000-0000-0000000000ff'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.request_photos where request_id = '00000000-0000-0000-0000-0000000000ff'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- storage_path: Default '' wiederhergestellt (Schicht: NOT NULL; der Trigger ist im Probe-Ablauf aus, Rollback)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; alter table public.request_photos alter column storage_path set default ''; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; alter table public.request_photos alter column storage_path drop default; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; alter table public.request_photos alter column storage_path set default ''; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; alter table public.request_photos alter column storage_path drop default; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    
  limit 1000;
end
$function$
; update storage.objects set created_at = now() - interval '30 hours' where bucket_id = 'request-photos' and name in ('00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg', '00000000-0000-0000-0000-000000000001/6ae58549-2618-454e-be47-8b70fb9ebaa9/8c54f896-d397-4db5-8d2e-ec4a1dabd2da.jpg'); create temp table res (v text); do $p$ begin begin set local role service_role;  perform 1; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.photo_orphans() where name = '00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg') || '/' || (select count(*) from public.photo_orphans() where name = '00000000-0000-0000-0000-000000000001/6ae58549-2618-454e-be47-8b70fb9ebaa9/8c54f896-d397-4db5-8d2e-ec4a1dabd2da.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- photo_orphans: übernommene Dateien nicht mehr ausgenommen
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    
  limit 1000;
end
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    
  limit 1000;
end
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() + interval '1 day' + public.photo_staging_interval();
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; update storage.objects set created_at = now() - interval '30 hours' where bucket_id = 'request-photos' and name in ('00000000-0000-0000-0000-000000000001/cf58c3be-35c3-41a2-9df1-22f391e5454f/5258402f-852e-44b5-af35-fc67e50fba89.jpg', '00000000-0000-0000-0000-000000000001/6ae58549-2618-454e-be47-8b70fb9ebaa9/8c54f896-d397-4db5-8d2e-ec4a1dabd2da.jpg'); create temp table res (v text); do $p$ begin begin set local role service_role;  perform 1; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.photo_orphans() where name = '00000000-0000-0000-0000-000000000001/304aaaaa-87f6-42f2-a2f0-d19a1b3ca258/3c015b0e-d66d-459e-95ed-e5bfbd6e9b13.jpg') || '/' || (select count(*) from public.photo_orphans() where name = '00000000-0000-0000-0000-000000000001/6ae58549-2618-454e-be47-8b70fb9ebaa9/8c54f896-d397-4db5-8d2e-ec4a1dabd2da.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- photo_orphans: Ablauf nicht mehr beachtet (frisches Staging-Foto wird gelistet)
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() + interval '1 day' + public.photo_staging_interval();
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() + interval '1 day' + public.photo_staging_interval();
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval() - interval '1 hour';
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'

-- Probe
begin; CREATE OR REPLACE FUNCTION public.photo_orphans()
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cutoff timestamptz := now() - public.photo_staging_interval();
begin
  return query
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and coalesce(o.created_at, '-infinity'::timestamptz) < cutoff
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000;
end
$function$
; update storage.objects set created_at = now() - interval '24 hours 30 minutes' where bucket_id = 'request-photos' and name = '00000000-0000-0000-0000-000000000001/304aaaaa-87f6-42f2-a2f0-d19a1b3ca258/3c015b0e-d66d-459e-95ed-e5bfbd6e9b13.jpg'; create temp table res (v text); do $p$ begin begin set local role service_role;  perform 1; reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.photo_orphans() where name = '00000000-0000-0000-0000-000000000001/304aaaaa-87f6-42f2-a2f0-d19a1b3ca258/3c015b0e-d66d-459e-95ed-e5bfbd6e9b13.jpg'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant execute on function public.photo_orphans() to authenticated; ; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform * from public.photo_orphans(); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce((1)::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) to authenticated; create policy redproof_ps on public.platform_settings for select to authenticated using (true); grant insert on public.service_requests, public.price_revisions, public.request_contacts, public.audit_log to authenticated; grant update (current_revision) on public.service_requests to authenticated; create policy redproof_sr_i on public.service_requests for insert to authenticated with check (true); create policy redproof_sr_u on public.service_requests for update to authenticated using (true) with check (true); create policy redproof_pr_i on public.price_revisions for insert to authenticated with check (true); create policy redproof_rc_i on public.request_contacts for insert to authenticated with check (true); create policy redproof_al_i on public.audit_log for insert to authenticated with check (true); grant execute on function public.photo_staging_interval() to authenticated; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '86537dab-edff-4e84-949b-9f4672b7884f', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- Probe
begin; grant execute on function public.photo_staging_interval() to authenticated; create policy redproof_ps on public.platform_settings for select to authenticated using (true); grant insert on public.service_requests, public.price_revisions, public.request_contacts, public.audit_log to authenticated; grant update (current_revision) on public.service_requests to authenticated; create policy redproof_sr_i on public.service_requests for insert to authenticated with check (true); create policy redproof_sr_u on public.service_requests for update to authenticated using (true) with check (true); create policy redproof_pr_i on public.price_revisions for insert to authenticated with check (true); create policy redproof_rc_i on public.request_contacts for insert to authenticated with check (true); create policy redproof_al_i on public.audit_log for insert to authenticated with check (true); grant execute on function public.quote_save_request(uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int, text, double precision, double precision, text, double precision, double precision, jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]) to authenticated; create temp table res (v text); do $p$ begin begin set local role authenticated; perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true); perform public.quote_save_request(p_customer => '00000000-0000-0000-0000-000000000001', p_client_ref => '539119c8-be6b-443c-a946-3368119cba9b', p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'); reset role; insert into res values ('ok'); exception when others then reset role; insert into res values (sqlstate || ': ' || sqlerrm); end; insert into res select coalesce(((select count(*) from public.service_requests where customer_id = '00000000-0000-0000-0000-000000000001'))::text, '<null>'); end $p$; select string_agg(v, ' | ') as v from res; rollback;

-- become_rental_provider entfernt (0022): Kunde stuft sich selbst hoch und liest den Gebührensatz
-- 1. Probe-Transaktion (nichts committet; Snapshot siehe oben), daraus die erwarteten Schlüssel:
begin; create function public.become_rental_provider() returns public.user_role
language plpgsql security definer set search_path = ''
as $f$
declare
  uid uuid := (select auth.uid());
  r public.user_role;
begin
  perform set_config('app.mv_role_grant', uid::text || ':rental_provider', true);
  update public.profiles set role = 'rental_provider' where id = uid and role = 'customer';
  perform set_config('app.mv_role_grant', '', true);
  select role into r from public.profiles where id = uid;
  return r;
end
$f$;
revoke all on function public.become_rental_provider() from public, anon;
grant execute on function public.become_rental_provider() to authenticated;
notify pgrst, 'reload schema'; <SNAPSHOT_SQL>; rollback;
-- 2. Totmann (+30 min; Zeitplan und Zeitstempel liest die DB, Tag zufällig; Restore ohne begin/commit):
select cron.schedule('redproof-restore-<nr>-<tag>', '<MI HH DD MM *>', $<tag>$set local search_path = "$user", public, extensions; do $g$ begin if now() > '<Zeitstempel>'::timestamptz + interval '1 hour' then raise exception 'veraltet'; end if; end $g$; drop function if exists public.become_rental_provider(); notify pgrst, 'reload schema'; select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'$<tag>$)
-- 3. Lockerung (committet):
begin; create function public.become_rental_provider() returns public.user_role
language plpgsql security definer set search_path = ''
as $f$
declare
  uid uuid := (select auth.uid());
  r public.user_role;
begin
  perform set_config('app.mv_role_grant', uid::text || ':rental_provider', true);
  update public.profiles set role = 'rental_provider' where id = uid and role = 'customer';
  perform set_config('app.mv_role_grant', '', true);
  select role into r from public.profiles where id = uid;
  return r;
end
$f$;
revoke all on function public.become_rental_provider() from public, anon;
grant execute on function public.become_rental_provider() to authenticated;
notify pgrst, 'reload schema'; commit; select 1 as x
-- 4. Restore nach dem Fenster (bis zu 3 Versuche, dazwischen Snapshot-Vergleich):
begin; drop function if exists public.become_rental_provider(); notify pgrst, 'reload schema'; commit; select 1 as x
-- 5. Totmann entfernen:
select cron.unschedule(jobid) from cron.job where jobname = 'redproof-restore-<nr>-<tag>'
