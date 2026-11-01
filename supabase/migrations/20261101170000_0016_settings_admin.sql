-- 0016 Einstellungen mit Gültigkeitsdatum, Gebührensatz-Vorlauf, Admin-Funktionen, aal2-Admin (S9a-1, docs/S9a_PLAN.md Abschnitt 4,
-- docs/S9_KONZEPT.md 5.1, 5.10). Die Werte aus 5.10 stehen nur in den Seeds, nicht hier.
-- Fehler der Trigger und Funktionen: SQLSTATE P0001, Meldung = Code (fee_rate_notice, fee_rate_immutable, field_immutable,
-- setting_missing, not_found); fehlende Rechte: 42501.

-- Bestand prüfen: sind Zeilen da, müssen beide Gebührenschlüssel da sein und es darf keine Reste geben (OPEN_ISSUES, quote.test).
do $$
begin
  if exists (select 1 from public.platform_settings) then
    if (select count(*) from public.platform_settings where key = 'fee_rate') <> 1
       or (select count(*) from public.platform_settings where key = 'fee_vat_rate') <> 1 then
      raise exception 'fee_rate und fee_vat_rate müssen je genau einmal vorhanden sein';
    end if;
    if exists (select 1 from public.platform_settings where key like 'fee\_%' and key not in ('fee_rate', 'fee_vat_rate', 'fee_notice_days')) then
      raise exception 'Reste von Testläufen in platform_settings (fee_%%): erst aufräumen';
    end if;
  end if;
end
$$;

-- platform_settings ------------------------------------------------------------

alter table public.platform_settings add column effective_from date;
update public.platform_settings set effective_from = date '2026-10-28' where effective_from is null;
alter table public.platform_settings
  alter column effective_from set not null,
  add constraint platform_settings_window_start
    check (key !~ '^window_start_' or (value = trunc(value) and value >= 0 and value < 1440)),
  add constraint platform_settings_rates check (key not in ('fee_rate', 'fee_vat_rate') or (value >= 0 and value < 1 and scale(value) <= 4)),
  add constraint platform_settings_notice check (key <> 'fee_notice_days' or (value = trunc(value) and value >= 15));

-- Gebührenschlüssel: ab Anlage unveränderlich, DELETE nur für künftige Zeilen, neue Zeilen mit Vorlauf nach dem heute geltenden
-- fee_notice_days. Die erste Zeile eines Schlüssels (Seed) ist frei. Das Datum kommt von der Datenbank, nicht vom Client.
create function private.guard_platform_setting() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
  notice numeric;
begin
  -- OLD und NEW prüfen: sonst ließe sich ein Gebührenschlüssel umbenennen
  if not ((tg_op <> 'INSERT' and old.key in ('fee_rate', 'fee_vat_rate', 'fee_notice_days'))
       or (tg_op <> 'DELETE' and new.key in ('fee_rate', 'fee_vat_rate', 'fee_notice_days'))) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' then raise exception 'fee_rate_immutable'; end if;
  if tg_op = 'DELETE' then
    if old.effective_from <= today then raise exception 'fee_rate_immutable'; end if;
    return old;
  end if;
  if not exists (select 1 from public.platform_settings s where s.key = new.key) then return new; end if;
  select s.value into notice from public.platform_settings s
  where s.key = 'fee_notice_days' and s.effective_from <= today
  order by s.effective_from desc, s.version desc limit 1;
  if notice is null then raise exception 'setting_missing'; end if;
  if new.effective_from < today + notice::int then raise exception 'fee_rate_notice'; end if;
  return new;
end
$$;

revoke all on function private.guard_platform_setting() from public;

create trigger guard_platform_setting before insert or update or delete on public.platform_settings
for each row execute function private.guard_platform_setting();
create trigger guard_platform_setting_truncate before truncate on public.platform_settings
for each statement execute function private.append_only();

-- Je Schlüssel die Zeile mit dem größten effective_from ≤ heute (Wiener Datum), bei Gleichstand die höchste Version.
create or replace view public.current_fee_rates with (security_invoker = true) as
select
  (select s.value from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_rate,
  (select s.value from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_vat_rate,
  (select s.effective_from from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_rate_from,
  (select s.effective_from from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_vat_rate_from;

-- Stornostufen und Anfahrtspauschale für Kunden, ohne fee_*. termsHash: sha256 über die fünf Werte (Konzept 5.4).
create function public.booking_terms() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  keys text[] := array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before', 'call_out_fee_cents'];
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
$$;

revoke all on function public.booking_terms() from public;
grant execute on function public.booking_terms() to anon, authenticated, service_role;

-- Neue Zeile (Version = höchste + 1) oder, bei p_value null, Löschen künftiger Zeilen zu diesem Datum.
create function public.admin_set_setting(p_actor uuid, p_key text, p_value numeric, p_effective_from date, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
begin
  perform private.assert_admin(p_actor);
  if p_value is null then
    delete from public.platform_settings where key = p_key and effective_from = p_effective_from and effective_from > today;
    if not found then raise exception 'not_found'; end if;
  else
    insert into public.platform_settings (key, version, value, note, effective_from)
    values (p_key, coalesce((select max(s.version) from public.platform_settings s where s.key = p_key), 0) + 1, p_value, p_note, p_effective_from);
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_setting', 'platform_settings', p_key,
    jsonb_build_object('value', p_value, 'effective_from', p_effective_from));
end
$$;

-- Rollen: Änderung von profiles.role nur mit Marker für genau diesen Nutzer und diese Rolle ---------------

create function private.guard_profile_role() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then raise exception 'field_immutable'; end if;
  if (tg_op = 'INSERT' and new.role <> 'customer') or (tg_op = 'UPDATE' and new.role is distinct from old.role) then
    if current_setting('app.mv_role_grant', true) is distinct from new.id::text || ':' || new.role::text then
      raise exception 'field_immutable';
    end if;
  end if;
  return new;
end
$$;

revoke all on function private.guard_profile_role() from public;

create trigger guard_role before insert or update on public.profiles
for each row execute function private.guard_profile_role();

-- Vermieter-Rolle (bis S9b): setzt den Marker für customer → rental_provider des eigenen Kontos.
create or replace function public.become_rental_provider() returns public.user_role
language plpgsql security definer set search_path = ''
as $$
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
$$;

-- Einziger Weg zu admin und partner: nur der Datenbank-Eigentümer (SQL-Konsole), nicht service_role.
create function public.admin_grant_role(p_user uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('app.mv_role_grant', p_user::text || ':' || p_role::text, true);
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'not_found'; end if;
  perform set_config('app.mv_role_grant', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (null, 'owner', 'grant_role', 'profile', p_user::text, jsonb_build_object('role', p_role));
end
$$;

revoke all on function public.admin_set_setting(uuid, text, numeric, date, text), public.admin_grant_role(uuid, public.user_role)
from public, anon, authenticated, service_role;
grant execute on function public.admin_set_setting(uuid, text, numeric, date, text) to service_role;

-- RLS: admin nur mit aal2; Schreib-Policies und -Grants auf platform_settings entfallen -----------------

alter policy profiles_select on public.profiles
using (id = (select auth.uid()) or (select private.is_admin()));

alter policy platform_settings_select on public.platform_settings
using ((select private.my_role()) = 'rental_provider' or (select private.is_admin()));

alter policy service_requests_select on public.service_requests
using (customer_id = (select auth.uid()) or (select private.is_admin()));

alter policy request_photos_select on public.request_photos
using (
  exists (select 1 from public.service_requests r where r.id = request_photos.request_id and r.customer_id = (select auth.uid()))
  or (select private.is_admin())
);

alter policy rental_offers_select on public.rental_offers
using (status = 'approved' or provider_id = (select auth.uid()) or (select private.is_admin()));

alter policy rental_bookings_select on public.rental_bookings
using (customer_id = (select auth.uid()) or (select private.is_admin()));

alter policy fee_splits_select on public.fee_splits
using (payee_id = (select auth.uid()) or (select private.is_admin()));

alter policy request_photos_objects_select on storage.objects
using (
  bucket_id = 'request-photos'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
);

drop policy platform_settings_insert on public.platform_settings;
drop policy platform_settings_update on public.platform_settings;
drop policy platform_settings_delete on public.platform_settings;
revoke insert, update, delete on public.platform_settings from authenticated;
