-- 0020 Fotos vor dem Absenden (S9a-4a, Konzept 7.1).
-- Der Kunde lädt in den Staging-Pfad {uid}/{client_ref}/{uuid}.jpg, solange es zu client_ref keine Anfrage gibt. Absenden = Fotos fertig:
-- quote_save_request übernimmt die genannten Dateien atomar als request_photos. Danach gibt es kein Hinzufügen, Löschen, Ersetzen oder Umhängen mehr
-- (Policies für den Kunden, Trigger auch für service_role). Nicht übernommene Dateien räumt photo_cleanup nach photo_staging_hours auf.

-- 1. Einstellung: fehlt photo_staging_hours, scheitert jeder Aufruf mit setting_missing (fail closed) -----------------
create function public.photo_staging_interval() returns interval
language plpgsql stable security invoker set search_path = ''
as $$
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
$$;

-- Ganze Stunden von 1 bis 168 (ein Überlauf in make_interval wäre sonst ein 500 internal statt setting_missing).
alter table public.platform_settings
  add constraint platform_settings_staging check (key <> 'photo_staging_hours' or (value = trunc(value) and value between 1 and 168));

revoke all on function public.photo_staging_interval() from public, anon, authenticated;
grant execute on function public.photo_staging_interval() to service_role;

-- 2. request_photos: nur quote_save_request schreibt, danach unveränderlich -----------------------------------------
drop policy request_photos_insert on public.request_photos;
drop policy request_photos_delete on public.request_photos;
drop trigger request_photos_before_insert on public.request_photos;
drop function private.request_photos_before_insert();

revoke all on public.request_photos from anon, authenticated;
grant select on public.request_photos to authenticated;
revoke update, delete, truncate on public.request_photos from service_role;

alter policy request_photos_select on public.request_photos
using (exists (select 1 from public.service_requests r where r.id = request_photos.request_id and r.customer_id = (select auth.uid())));

-- INSERT nur im Aufruf von quote_save_request (Marker app.mv_photo_request = Anfrage-ID), Pfad im Staging-Ordner der Anfrage, höchstens 8 je Anfrage.
create function private.guard_photo_insert() returns trigger
language plpgsql set search_path = ''
as $$
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
$$;

revoke all on function private.guard_photo_insert() from public;

create trigger guard_photo_insert before insert on public.request_photos
for each row execute function private.guard_photo_insert();

-- UPDATE nie (kein Umhängen, kein Ersetzen), DELETE nur als Kaskade der Anfrage, TRUNCATE nie; auch nicht für service_role.
create trigger photo_immutable before update or delete on public.request_photos
for each row execute function private.immutable_row('photo_immutable');
create trigger photo_immutable_truncate before truncate on public.request_photos
for each statement execute function private.immutable_row('photo_immutable');

-- 3. Storage: Kunde schreibt und löscht nur im eigenen Staging-Ordner ohne Anfrage; lesen nur der eigene Ordner (ohne admin) ---
drop policy request_photos_objects_insert on storage.objects;
drop policy request_photos_objects_delete on storage.objects;

create policy request_photos_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-photos'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.service_requests r
    where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]
  )
  and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)
);

create policy request_photos_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'request-photos'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.service_requests r
    where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(name))[2]
  )
  and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)
);

alter policy request_photos_objects_select on storage.objects
using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 4. Aufräumen: Dateien ohne Zeile nach photo_staging_hours (Staging-Reste, Fehl-Uploads, Dateien gelöschter Anfragen) ---------
-- Übernommene Dateien haben eine Zeile und bleiben. Eine Zeile ohne Datei wird nicht mehr gelöscht (request_photos ist unveränderlich).
-- Eine Stunde Karenz über die Übernahmegrenze (quote_save_request nimmt bis photo_staging_hours an): ein Aufräumlauf entfernt nie eine Datei,
-- die eine laufende Übernahme noch annimmt. Der Wert wird zuerst gelesen, damit eine fehlende Einstellung auch bei leerem Bucket scheitert.
create or replace function public.photo_orphans() returns table (name text)
language plpgsql stable security invoker set search_path = ''
as $$
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
$$;

create or replace function public.photo_cleanup() returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  secret text;
  url text;
begin
  -- Fehlt photo_staging_hours, scheitert der Cron-Lauf sichtbar (cron.job_run_details), nicht erst in der Edge Function.
  perform public.photo_staging_interval();
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cleanup_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'cleanup_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then
    raise exception 'photo_cleanup nicht eingerichtet: Vault-Secrets cleanup_secret/cleanup_url fehlen (npm run setup:photo-cleanup)';
  end if;
  perform net.http_post(url := url, headers := jsonb_build_object('x-cleanup-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 60000);
end
$$;

-- 5. quote_save_request übernimmt die Staging-Fotos (neuer Parameter p_photo_ids) --------------------------------------
drop function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, double precision, double precision, text, double precision, double precision,
  jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb
);

create function public.quote_save_request(
  p_customer uuid, p_client_ref uuid, p_service public.service_type,
  p_inputs jsonb, p_snapshot jsonb, p_price_version int,
  p_total int, p_low int, p_high int,
  p_from_address text, p_from_lon double precision, p_from_lat double precision,
  p_to_address text, p_to_lon double precision, p_to_lat double precision,
  p_route jsonb, p_region public.region, p_district smallint,
  p_preferred_date date, p_time_window text, p_description text, p_volume numeric,
  p_contact jsonb, p_confirmed jsonb, p_photo_ids uuid[] default null
) returns table (id uuid, status public.request_status, needs_quote boolean, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke execute on function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, double precision, double precision, text, double precision, double precision,
  jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]
) from public, anon, authenticated;
grant execute on function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, double precision, double precision, text, double precision, double precision,
  jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb, uuid[]
) to service_role;
