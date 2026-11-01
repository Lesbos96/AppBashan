-- 0018 Revisionen, Kontakte, quote_save_* ohne fee_splits (S9a-2, docs/S9a_PLAN.md Abschnitt 5, docs/S9_KONZEPT.md 5.4, 10.1).
-- Der Preis liegt in price_revisions (nur anfügen, unveränderlich auch gegen service_role). Eine Anfrage ohne Revision gibt es nicht:
-- der Zeiger service_requests.current_revision wird in derselben Transaktion gesetzt (verzögerter Constraint-Trigger).
-- Fehler: SQLSTATE P0001, Meldung = Code (revision_immutable, invalid_revision, status_mismatch, version_unpublished,
-- invalid_revision_pointer, field_immutable, revision_missing, too_late, setting_missing, preferred_date_required).
-- Die Tabelle fee_splits bleibt bis S9b bestehen; hier schreibt niemand mehr hinein.

-- 1. Revisionen -------------------------------------------------------------------------------

create table public.price_revisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  n int not null check (n >= 1),
  source text not null check (source in ('submit', 'partner_offer', 'change_order')),
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  price_version int not null references public.price_versions (version),
  content_hash text not null,
  total_cents int,
  low_cents int,
  high_cents int,
  created_at timestamptz not null default now(),
  constraint price_revisions_request_n unique (request_id, n),
  constraint price_revisions_id_request unique (id, request_id),
  -- Festpreis: total > 0 und total = low = high. Spanne: total NULL, 0 < low < high. Angebot ohne Spanne: alle drei NULL.
  constraint price_revisions_amounts check (
    coalesce(total_cents > 0 and low_cents = total_cents and high_cents = total_cents, false)
    or coalesce(total_cents is null and low_cents > 0 and high_cents > low_cents, false)
    or (total_cents is null and low_cents is null and high_cents is null)
  )
);

-- Nur die erste Revision beim Absenden (n = 1, submit). Spätere Quellen ergänzen ihre Stufen (S9c, S9f, S9h).
-- Der Status der Anfrage folgt aus dem Preis: total gesetzt = requested, sonst awaiting_offer. Der Inhalts-Hash der Preisversion
-- wird hier gesetzt, nie vom Aufrufer; unveröffentlichte Versionen sind nicht zulässig.
create function private.guard_revision_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare
  rq public.service_requests;
  h text;
begin
  if new.n <> 1 or new.source <> 'submit' then
    raise exception 'invalid_revision';
  end if;
  -- Snapshot und Betragsspalten müssen übereinstimmen: ein Abbildungsfehler zeigt dem Kunden sonst einen Betrag, den die Revision nicht hält.
  if new.snapshot ->> 'kind' = 'offer' then
    if new.total_cents is not null or new.low_cents is not null or new.high_cents is not null then
      raise exception 'invalid_revision';
    end if;
  elsif new.snapshot ->> 'kind' = 'price' then
    if (new.snapshot ->> 'lowCents')::int is distinct from new.low_cents
       or (new.snapshot ->> 'highCents')::int is distinct from new.high_cents
       or (new.snapshot ? 'totalCents') <> (new.total_cents is not null)
       or (new.total_cents is not null and (new.snapshot ->> 'totalCents')::int <> new.total_cents) then
      raise exception 'invalid_revision';
    end if;
  else
    raise exception 'invalid_revision';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or rq.current_revision is not null then
    raise exception 'invalid_revision';
  end if;
  if rq.status is distinct from (case when new.total_cents is not null then 'requested' else 'awaiting_offer' end)::public.request_status then
    raise exception 'status_mismatch';
  end if;
  select v.content_hash into h from public.price_versions v where v.version = new.price_version and v.published;
  if h is null then
    raise exception 'version_unpublished';
  end if;
  new.content_hash := h;
  return new;
end
$$;

revoke all on function private.guard_revision_insert() from public;

create trigger guard_revision_insert before insert on public.price_revisions
for each row execute function private.guard_revision_insert();

-- Update nie, DELETE nur als Kaskade der Anfrage, TRUNCATE nie (auch nicht für service_role, postgres).
create trigger revision_immutable before update or delete on public.price_revisions
for each row execute function private.immutable_row('revision_immutable');
create trigger revision_immutable_truncate before truncate on public.price_revisions
for each statement execute function private.immutable_row('revision_immutable');

alter table public.price_revisions enable row level security;
revoke all on public.price_revisions from anon, authenticated;
grant select on public.price_revisions to authenticated;
revoke update, delete, truncate on public.price_revisions from service_role;

create policy price_revisions_select on public.price_revisions for select to authenticated
using (exists (
  select 1 from public.service_requests r
  where r.id = request_id and r.customer_id = (select auth.uid())
));

-- 2. service_requests: Zeiger, Frist, Termin, Bezirk; Preisspalten entfallen ----------------------

alter table public.service_requests drop constraint estimate_xor_quote;
alter table public.service_requests
  drop column inputs,
  drop column price_snapshot,
  drop column price_version,
  drop column estimate_cents,
  drop column needs_quote;

-- Die Tabelle ist nach 0017 leer: NOT NULL ist unkritisch. district folgt mit S9a-3 (geo_districts).
alter table public.service_requests
  alter column client_ref set not null,
  add column current_revision uuid,
  add column accept_deadline timestamptz not null,
  add column termin_at timestamptz not null,
  add column district smallint check (district between 1 and 23),
  add constraint service_requests_current_revision
    foreign key (current_revision, id) references public.price_revisions (id, request_id);

-- service_role darf an der Anfrage nur noch den Zeiger setzen (Spaltenrecht): Strecke, Termin, Kunde und Adressen ändern sich nicht
-- mehr nach dem Anlegen. Löschen und Leeren sperrt der Trigger auch für den Eigentümer; nur die Kaskade (Kontolöschung über
-- auth.users → profiles) erreicht die Zeile in Tiefe > 1. Migrationen, die Daten verwerfen, schalten den Trigger kurz ab.
revoke update on public.service_requests from service_role;
grant update (current_revision) on public.service_requests to service_role;
revoke delete, truncate on public.service_requests from service_role;
revoke delete on public.profiles from service_role;

create trigger request_delete_guard before delete on public.service_requests
for each row execute function private.immutable_row('request_immutable');
create trigger request_delete_guard_truncate before truncate on public.service_requests
for each statement execute function private.immutable_row('request_immutable');

-- Gebührenzeilen schreibt niemand mehr (Journal ab S9b); die Tabelle bleibt bis dahin lesbar.
revoke insert, update, delete, truncate on public.fee_splits from service_role;

-- Fristwerte: ein Fehleintrag darf keine Frist hinter dem Termin erzeugen.
alter table public.platform_settings
  add constraint platform_settings_accept check (
    (key not in ('accept_min_hours', 'accept_max_hours') or value > 0)
    and (key <> 'accept_lead_share_percent' or (value > 0 and value <= 100))
  );

-- Zeiger: erstes Setzen einmalig auf die Revision n = 1 derselben Anfrage; danach unveränderlich (Nachträge und Angebote
-- ergänzen ihre Fälle in S9c und S9f). Der Trigger läuft vor der Fremdschlüsselprüfung.
create function private.guard_request_pointer() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.current_revision is not distinct from old.current_revision then
    return new;
  end if;
  if old.current_revision is not null or new.current_revision is null
     or not exists (
       select 1 from public.price_revisions v
       where v.id = new.current_revision and v.request_id = new.id and v.n = 1 and v.source = 'submit'
     ) then
    raise exception 'invalid_revision_pointer';
  end if;
  return new;
end
$$;

revoke all on function private.guard_request_pointer() from public;

create trigger guard_request_pointer before update on public.service_requests
for each row execute function private.guard_request_pointer();

-- Frist, Termin und Bezirk nach dem Anlegen unveränderlich.
create function private.guard_request_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.termin_at is distinct from old.termin_at
     or new.accept_deadline is distinct from old.accept_deadline
     or new.district is distinct from old.district then
    raise exception 'field_immutable';
  end if;
  return new;
end
$$;

revoke all on function private.guard_request_fields() from public;

create trigger guard_request_fields before update on public.service_requests
for each row execute function private.guard_request_fields();

-- Jede Anfrage hat bei Commit eine Revision (verzögert, damit Anlegen, Revision und Zeiger in einer Transaktion Platz haben).
create function private.require_revision() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.service_requests s where s.id = new.id and s.current_revision is null) then
    raise exception 'revision_missing';
  end if;
  return null;
end
$$;

revoke all on function private.require_revision() from public;

create constraint trigger require_revision after insert on public.service_requests
deferrable initially deferred
for each row execute function private.require_revision();

-- 3. Kontakte (Schreiben ab S9a-3 durch quote, Lesen durch Partner erst nach Annahme, S9c) ---------

create table public.request_contacts (
  request_id uuid primary key references public.service_requests (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 1 and 40),
  email text not null check (char_length(email) between 3 and 200),
  stairs_door text check (char_length(stairs_door) <= 60),
  created_at timestamptz not null default now()
);

alter table public.request_contacts enable row level security;
revoke all on public.request_contacts from anon, authenticated;
grant select on public.request_contacts to authenticated;
revoke update, delete, truncate on public.request_contacts from service_role;

-- Kunde liest die eigenen; admin hat kein freies Lesen (nur admin-contact mit Audit, S9c).
create policy request_contacts_select on public.request_contacts for select to authenticated
using (exists (
  select 1 from public.service_requests r
  where r.id = request_id and r.customer_id = (select auth.uid())
));

-- 4. quote_save_request / quote_save_booking ohne fee_splits ---------------------------------------
-- Anfrage mit Revision 1 und Zeiger in einer Transaktion. Es gibt keinen Bearbeiten-Zweig: nach dem Absenden stornieren und neu senden.
-- Status folgt aus dem Preis (total gesetzt: requested, sonst awaiting_offer). termin_at (Wiener Ortszeit: Datum plus Beginn des
-- Zeitfensters, ohne Fenster 00:00) und accept_deadline (Konzept 10.1) rechnet die Datenbank aus den Einstellungen; fehlt einer
-- der Werte: setting_missing. Termin näher als accept_min_hours: too_late. Beides vor dem Schreiben.
-- Gleiche client_ref: die vorhandene Anfrage wird zurückgegeben, nichts ändert sich (created = false).

create function public.quote_save_request(
  p_customer uuid, p_client_ref uuid, p_service public.service_type,
  p_inputs jsonb, p_snapshot jsonb, p_price_version int,
  p_total int, p_low int, p_high int,
  p_from_address text, p_from_postcode text, p_from_lon double precision, p_from_lat double precision,
  p_to_address text, p_to_postcode text, p_to_lon double precision, p_to_lat double precision,
  p_route jsonb, p_region public.region, p_preferred_date date, p_time_window text,
  p_description text, p_volume numeric
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
  if p_preferred_date is null then
    raise exception 'preferred_date_required';
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
    from_address, from_postcode, from_point, to_address, to_postcode, to_point, route, region,
    preferred_date, time_window, description, volume_m3, termin_at, accept_deadline
  ) values (
    p_customer, p_client_ref, p_service, (case when p_total is not null then 'requested' else 'awaiting_offer' end)::public.request_status,
    p_from_address, p_from_postcode, from_pt, p_to_address, p_to_postcode, to_pt, p_route, p_region,
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

  return query select r.id, r.status, r.status = 'awaiting_offer', true;
end;
$$;

-- Mietanfrage (Phase 2 mit Vermieter-Annahme): nur noch Anlegen, ohne Gebührenzeile.
create function public.quote_save_booking(
  p_customer uuid, p_client_ref uuid, p_offer uuid, p_pickup timestamptz, p_return timestamptz,
  p_km int, p_cover boolean, p_extra_driver boolean, p_one_way boolean,
  p_snapshot jsonb, p_price_version int, p_total int, p_deposit int
) returns table (id uuid, status public.request_status, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.rental_bookings;
begin
  insert into public.rental_bookings as s (
    customer_id, client_ref, offer_id, pickup_at, return_at, km, cover, extra_driver, one_way,
    price_snapshot, price_version, total_cents, deposit_cents
  ) values (
    p_customer, p_client_ref, p_offer, p_pickup, p_return, p_km, p_cover, p_extra_driver, p_one_way,
    p_snapshot, p_price_version, p_total, p_deposit
  )
  on conflict (customer_id, client_ref) do nothing
  returning s.* into b;
  if b.id is null then
    select s.* into b from public.rental_bookings s where s.customer_id = p_customer and s.client_ref = p_client_ref;
    return query select b.id, b.status, false;
    return;
  end if;
  return query select b.id, b.status, true;
end;
$$;

-- Supabase vergibt Execute per Default an anon und authenticated: ausdrücklich nur service_role.
revoke execute on function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, text, double precision, double precision, text, text, double precision, double precision,
  jsonb, public.region, date, text, text, numeric
) from public, anon, authenticated;
grant execute on function public.quote_save_request(
  uuid, uuid, public.service_type, jsonb, jsonb, int, int, int, int,
  text, text, double precision, double precision, text, text, double precision, double precision,
  jsonb, public.region, date, text, text, numeric
) to service_role;

revoke execute on function public.quote_save_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, int, boolean, boolean, boolean, jsonb, int, int, int
) from public, anon, authenticated;
grant execute on function public.quote_save_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, int, boolean, boolean, boolean, jsonb, int, int, int
) to service_role;
