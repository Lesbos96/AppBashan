-- 0017 Statusmaschine (S9a-2, docs/S9a_PLAN.md Abschnitt 5, docs/S9_KONZEPT.md 4.1, 4.4, 4.5).
-- Der Status von service_requests ändert sich nur über Funktionen. Zwei getrennte Sperren im Trigger, ohne Ausnahme für
-- Rolle, admin, service_role oder postgres: (1) das Paar „von → nach“ muss gültig sein, (2) ein transaktionslokaler Marker
-- (app.mv_transition = '<id der Anfrage>:<Zielstatus>') muss gesetzt sein, den nur die SECURITY-DEFINER-Übergangsfunktionen setzen.
-- Der Marker bindet an die Zeile: eine zweite Anfrage in derselben Transaktion geht nicht mit durch.
-- Grenze: der Datenbank-Eigentümer kann den Marker setzen oder Trigger abschalten (wie bei den Preisen, 0015).
-- Fehler der Trigger und Funktionen: SQLSTATE P0001, Meldung = Code (invalid_transition, not_found, append_only).
-- Die bisherigen Dev-Daten (Anfragen, Mietanfragen, Fotos, Gebührenzeilen) werden verworfen (Konzept 4.1, keine Kompatibilitätsschicht).
-- Storage-Dateien von request-photos räumt vorher scripts/storage-reset.mjs über die Storage-API.

-- 1. Dev-Daten verwerfen -------------------------------------------------------------

delete from public.fee_splits;
delete from public.request_photos;
delete from public.rental_bookings;
delete from public.service_requests;

-- 2. Abhängige Objekte entfernen (Enum-Tausch) ------------------------------------------

drop policy service_requests_update on public.service_requests;
drop policy request_photos_insert on public.request_photos;
drop policy request_photos_delete on public.request_photos;
drop policy request_photos_objects_insert on storage.objects;
drop policy request_photos_objects_delete on storage.objects;
drop policy rental_bookings_update on public.rental_bookings;

-- quote_save_* haben das Enum im Rückgabetyp; sie entstehen in 0018 neu (ohne fee_splits).
drop function public.quote_save_request(
  uuid, uuid, uuid, public.service_type, public.request_status, jsonb, jsonb, int, int, boolean,
  text, text, double precision, double precision, text, text, double precision, double precision,
  jsonb, public.region, date, text, text, numeric, numeric, numeric, int, int, int, int
);
drop function public.quote_save_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, int, boolean, boolean, boolean,
  jsonb, int, int, int, uuid, numeric, numeric, int, int, int, int
);

-- Checks und Defaults vor dem Typtausch entfernen
alter table public.service_requests drop constraint inspection_needs_quote;
alter table public.rental_bookings drop constraint rental_bookings_status_check;
alter table public.service_requests alter column status drop default;
alter table public.rental_bookings alter column status drop default;

-- 3. Enum tauschen ----------------------------------------------------------------------

alter type public.request_status rename to request_status_old;

create type public.request_status as enum (
  'requested', 'awaiting_offer', 'offered', 'accepted', 'in_progress', 'completed',
  'withdrawn', 'expired', 'declined', 'unmatched', 'cancelled_by_customer', 'cancelled_by_partner'
);

alter table public.service_requests alter column status type public.request_status using status::text::public.request_status;
alter table public.rental_bookings alter column status type public.request_status using status::text::public.request_status;
alter table public.service_requests alter column status set default 'requested';
alter table public.rental_bookings alter column status set default 'requested';

drop type public.request_status_old;

-- Miete (Phase 2): nur angefragt oder zurückgezogen (Konzept 4.6, Abschnitt 13)
alter table public.rental_bookings
  add constraint rental_bookings_status_known check (status in ('requested', 'withdrawn'));

-- 4. Foto-Policies mit den neuen Status, ohne admin-Klausel -------------------------------

create policy request_photos_insert on public.request_photos for insert to authenticated
with check (
  exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'awaiting_offer')
  )
  and starts_with(storage_path, (select auth.uid())::text || '/' || request_id::text || '/')
);

create policy request_photos_delete on public.request_photos for delete to authenticated
using (
  exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'awaiting_offer')
  )
);

create policy request_photos_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.request_photos p
    join public.service_requests r on r.id = p.request_id
    where p.storage_path = name
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'awaiting_offer')
  )
);

create policy request_photos_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'request-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.service_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'awaiting_offer')
  )
);

-- 5. Miete: Kunde darf nur requested → withdrawn, auch service_role nicht mehr --------------

create policy rental_bookings_update on public.rental_bookings for update to authenticated
using (customer_id = (select auth.uid()) and status = 'requested')
with check (customer_id = (select auth.uid()) and status = 'withdrawn');

create function private.guard_rental_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (old.status = 'requested' and new.status = 'withdrawn') then
    raise exception 'invalid_transition';
  end if;
  return new;
end
$$;

revoke all on function private.guard_rental_status() from public;

create trigger guard_rental_status before update on public.rental_bookings
for each row execute function private.guard_rental_status();

-- 6. Unveränderlich außer per Kaskade -------------------------------------------------------
-- Für status_events (hier) und price_revisions (0018). tg_argv[0] ist die Fehlermeldung. DELETE ist nur erlaubt, wenn es die
-- Kaskade einer Anfrage ist (der Fremdschlüssel löst es in einem Trigger aus: Tiefe > 1); ein DELETE-Statement hat Tiefe 1.

create function private.immutable_row() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception '%', tg_argv[0];
end
$$;

revoke all on function private.immutable_row() from public;

-- 7. status_events: nur anfügen, Schreiben nur der Trigger ------------------------------------

create table public.status_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  from_status public.request_status not null,
  to_status public.request_status not null,
  actor_id uuid,
  actor_role text not null check (actor_role in ('customer', 'partner', 'admin', 'system', 'sql'))
);

create index status_events_request_idx on public.status_events (request_id, at);

create trigger append_only before update or delete on public.status_events
for each row execute function private.immutable_row('append_only');
create trigger append_only_truncate before truncate on public.status_events
for each statement execute function private.immutable_row('append_only');

alter table public.status_events enable row level security;
revoke all on public.status_events from anon, authenticated, service_role;
grant select on public.status_events to authenticated;

create policy status_events_select on public.status_events for select to authenticated
using ((select private.is_admin()));

-- Akteur aus den transaktionslokalen Einstellungen der Übergangsfunktionen; leer heißt direktes SQL.
-- SECURITY DEFINER: der Trigger schreibt als Eigentümer, kein Konto braucht ein Schreibrecht auf status_events.
create function private.log_request_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.status_events (request_id, from_status, to_status, actor_id, actor_role)
  values (
    new.id, old.status, new.status,
    nullif(current_setting('app.mv_actor', true), '')::uuid,
    coalesce(nullif(current_setting('app.mv_actor_role', true), ''), 'sql')
  );
  return null;
end
$$;

revoke all on function private.log_request_status() from public;

create trigger log_request_status after update on public.service_requests
for each row when (old.status is distinct from new.status)
execute function private.log_request_status();

-- 8. Statusprüfung auf service_requests -------------------------------------------------------

create function private.guard_request_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status not in ('requested', 'awaiting_offer') then
    raise exception 'invalid_transition';
  end if;
  return new;
end
$$;

revoke all on function private.guard_request_insert() from public;

create trigger guard_request_insert before insert on public.service_requests
for each row execute function private.guard_request_insert();

-- Nur bei Statusänderung. Zwei getrennte Prüfungen: Paar, dann Marker (beide ohne Rollen-Ausnahme).
-- Gültige Paare dieser Stufe: Zurückziehen (T2). Jede weitere Stufe ergänzt ihre Paare in ihrer Migration.
create function private.guard_request_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if not (old.status in ('requested', 'awaiting_offer', 'offered') and new.status = 'withdrawn') then
    raise exception 'invalid_transition';
  end if;
  if current_setting('app.mv_transition', true) is distinct from new.id::text || ':' || new.status::text then
    raise exception 'invalid_transition';
  end if;
  return new;
end
$$;

revoke all on function private.guard_request_status() from public;

create trigger guard_request_status before update on public.service_requests
for each row execute function private.guard_request_status();

-- Kein UPDATE-Grant mehr für authenticated (auch nicht spaltenweise, auch nicht für admin). service_role verliert UPDATE in 0018
-- bis auf die Spalte current_revision; der Status bleibt unabhängig davon durch den Trigger gesperrt.
revoke update on public.service_requests from authenticated;

-- 9. Zurückziehen (T2): einzige Übergangsfunktion dieser Stufe -----------------------------------
-- Art B (Konzept 4.5): SECURITY DEFINER, Akteur aus auth.uid(), Compare-and-Set auf den Status.
-- Fehler: not_found (fremd oder unbekannt), invalid_transition (nicht mehr zurückziehbar).

create function public.withdraw(p_request uuid) returns public.request_status
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  st public.request_status;
begin
  if uid is null then
    raise exception 'not_found';
  end if;
  perform set_config('app.mv_transition', p_request::text || ':withdrawn', true);
  perform set_config('app.mv_actor', uid::text, true);
  perform set_config('app.mv_actor_role', 'customer', true);
  update public.service_requests s set status = 'withdrawn'
  where s.id = p_request and s.customer_id = uid and s.status in ('requested', 'awaiting_offer', 'offered')
  returning s.status into st;
  perform set_config('app.mv_transition', '', true);
  perform set_config('app.mv_actor', '', true);
  perform set_config('app.mv_actor_role', '', true);
  if st is null then
    if exists (select 1 from public.service_requests s where s.id = p_request and s.customer_id = uid) then
      raise exception 'invalid_transition';
    end if;
    raise exception 'not_found';
  end if;
  return st;
end
$$;

revoke execute on function public.withdraw(uuid) from public, anon;
grant execute on function public.withdraw(uuid) to authenticated;
