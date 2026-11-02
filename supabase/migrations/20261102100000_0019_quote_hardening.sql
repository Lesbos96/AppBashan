-- 0019 quote-Härtung (S9a-3, docs/S9a_PLAN.md Abschnitt 6, docs/S9_KONZEPT.md 5.4, 5.5): Haltefenster, Adressprüfung, Bezirk, Kontakte, Journal.
-- Fehler: SQLSTATE P0001, Meldung = Code (district_required, contact_required, setting_missing, too_late, preferred_date_required).

-- 1. N-10: rental_bookings für service_role nur noch Insert/Select. Eigene Schicht neben dem Statustrigger; der Trigger-Beweis läuft als Eigentümer.
revoke update, delete, truncate on public.rental_bookings from service_role;

-- 2. Alte Dev-Zeilen aus S9a-2-Läufen verwerfen (Bezirk wird Pflicht). Der Löschschutz ist nur innerhalb dieser Transaktion aus.
alter table public.service_requests disable trigger request_delete_guard;
delete from public.service_requests where district is null;
alter table public.service_requests enable trigger request_delete_guard;

-- 3. PLZ-Spalten entfallen (R11-5), der Bezirk wird Pflicht.
alter table public.service_requests
  drop column from_postcode,
  drop column to_postcode,
  alter column district set not null;

-- 4. Geocode-Cache (nur service_role): Schlüssel = HMAC, Wert = Kandidaten. Stündliche Bereinigung.
create table public.geocode_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);
create index geocode_cache_expires_idx on public.geocode_cache (expires_at);
alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon, authenticated;
select cron.schedule('geocode-cleanup', '23 * * * *', $$delete from public.geocode_cache where expires_at < now()$$);

-- 5. Haltefenster: Zustand einer Version. Ersetzungszeitpunkt = früheste Geltung eines Nachfolgers (der spätere Wert aus Mitternacht
-- Wien an effective_on und published_at, Konzept 5.4). started: die Version hat schon gegolten (künftige Versionen sind nie haltbar).
-- Keine Zeile: Version unbekannt oder unveröffentlicht.
alter table public.platform_settings
  add constraint platform_settings_hold check (key <> 'price_hold_minutes' or (value = trunc(value) and value between 0 and 120));

create function public.price_version_hold(p_version int)
returns table (started boolean, is_current boolean, replaced_at timestamptz, hold_minutes numeric)
language sql stable security invoker set search_path = ''
as $$
  select
    greatest((v.effective_on::timestamp at time zone 'Europe/Vienna'), v.published_at) <= now(),
    p_version = (select c.version from public.current_price_version c),
    (select min(greatest((w.effective_on::timestamp at time zone 'Europe/Vienna'), w.published_at))
       from public.price_versions w where w.published and w.version > p_version),
    (select s.value from public.platform_settings s
      where s.key = 'price_hold_minutes' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
      order by s.effective_from desc, s.version desc limit 1)
  from public.price_versions v
  where v.version = p_version and v.published;
$$;

-- 6. Bezirksgrenzen (Quelle: Stadt Wien OGD "Bezirksgrenzen", CC BY 4.0; Import: npm run geo:districts) und Land/Bezirk am geprüften Punkt.
-- Der Bezirk folgt nur aus dem Polygon (Beks, 02.11.2026), die PLZ spielt keine Rolle. Auf einer gemeinsamen Grenze gilt der kleinere Bezirk.
-- Fehlt eine Grenze: keine Zeile (die Function bricht fail closed ab).
create table public.geo_districts (
  district smallint primary key check (district between 1 and 23),
  name text not null,
  geom extensions.geometry(multipolygon, 4326) not null,
  source text not null,
  imported_at timestamptz not null default now(),
  constraint geo_districts_geom_valid check (extensions.ST_IsValid(geom))
);
create index geo_districts_geom_idx on public.geo_districts using gist (geom);
create trigger geo_districts_make_valid before insert or update of geom on public.geo_districts
for each row execute function private.geo_boundaries_make_valid();
alter table public.geo_districts enable row level security;
revoke all on public.geo_districts from anon, authenticated;

create function public.quote_district(p_lon double precision, p_lat double precision)
returns table (in_vienna boolean, in_austria boolean, district smallint)
language sql stable security invoker set search_path = ''
as $$
  select
    extensions.ST_Covers(vi.geom, pt.p),
    extensions.ST_Covers(au.geom, pt.p),
    (select d.district from public.geo_districts d where extensions.ST_Covers(d.geom, pt.p) order by d.district limit 1)
  from (select extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon, p_lat), 4326) as p) pt,
       (select geom from public.geo_boundaries where slug = 'vienna') vi,
       (select geom from public.geo_boundaries where slug = 'austria') au;
$$;

-- 7. Kontaktformat zusätzlich zur Länge (Name, Telefon, E-Mail; Stiege/Tür optional).
alter table public.request_contacts
  add constraint request_contacts_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and phone ~ '^[0-9+()/ .-]{5,40}$' and phone ~ '([0-9][^0-9]*){5}');

-- 8. quote_save_request neu: ohne PLZ, mit Bezirk und Kontakten, price_confirmed im Journal in derselben Transaktion.
drop function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, text, double precision, double precision, text, text, double precision, double precision,
  jsonb, public.region, date, text, text, numeric
);

create function public.quote_save_request(
  p_customer uuid, p_client_ref uuid, p_service public.service_type,
  p_inputs jsonb, p_snapshot jsonb, p_price_version int,
  p_total int, p_low int, p_high int,
  p_from_address text, p_from_lon double precision, p_from_lat double precision,
  p_to_address text, p_to_lon double precision, p_to_lat double precision,
  p_route jsonb, p_region public.region, p_district smallint,
  p_preferred_date date, p_time_window text, p_description text, p_volume numeric,
  p_contact jsonb, p_confirmed jsonb
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

  -- Beleg, was der Kunde bestätigt hat (gezeigter Betrag bzw. Art, Version, Bedingungen).
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_customer, 'customer', 'price_confirmed', 'service_request', r.id::text, p_confirmed || jsonb_build_object(
    'priceVersion', p_price_version,
    'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev)
  ));

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$$;

-- Supabase vergibt Execute per Default an anon und authenticated: ausdrücklich nur service_role.
revoke execute on function public.price_version_hold(int) from public, anon, authenticated;
revoke execute on function public.quote_district(double precision, double precision) from public, anon, authenticated;
revoke execute on function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, double precision, double precision, text, double precision, double precision,
  jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.price_version_hold(int) to service_role;
grant execute on function public.quote_district(double precision, double precision) to service_role;
grant execute on function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, double precision, double precision, text, double precision, double precision,
  jsonb, public.region, smallint, date, text, text, numeric, jsonb, jsonb
) to service_role;
