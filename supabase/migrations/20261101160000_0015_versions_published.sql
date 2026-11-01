-- 0015 Preisversionen unveränderlich (S9a-1, docs/S9a_PLAN.md Abschnitt 4, docs/S9_KONZEPT.md 5.1).
-- Veröffentlichte Versionen und ihre Zeilen ändert niemand mehr, auch nicht admin oder service_role (Trigger, nicht nur RLS).
-- Veröffentlichen und Anlegen laufen nur über Funktionen, die service_role oder der Eigentümer aufruft; sie prüfen die Rolle von p_actor.
-- Marker (transaktionslokal, Namensraum app.mv_*): setzt nur eine SECURITY-DEFINER-Funktion; PostgREST kann ihn nicht setzen.
-- Fehler der Trigger und Funktionen: SQLSTATE P0001, Meldung = Code (version_published, field_immutable, append_only, not_found);
-- fehlende Rechte der Funktionen: 42501.

-- Admin nur mit zweitem Faktor (aal2) ------------------------------------------

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select private.my_role()) = 'admin' and (select auth.jwt() ->> 'aal') = 'aal2', false) $$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- Journal der Admin-Aktionen: nur anfügen -----------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null check (actor_role in ('customer', 'partner', 'admin', 'system', 'owner')),
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'
);

create function private.append_only() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'append_only';
end
$$;

revoke all on function private.append_only() from public;

create trigger append_only before update or delete on public.audit_log
for each row execute function private.append_only();
create trigger append_only_truncate before truncate on public.audit_log
for each statement execute function private.append_only();

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
revoke update, delete, truncate on public.audit_log from service_role;
grant select on public.audit_log to authenticated;

create policy audit_log_select on public.audit_log for select to authenticated
using ((select private.is_admin()));

-- Prüfung der Rolle von p_actor (kein aal: aal2 verlangen die admin-Edge-Functions und die Policies) ---

create function private.assert_admin(p_actor uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end
$$;

revoke all on function private.assert_admin(uuid) from public;

-- Preisversionen -----------------------------------------------------------------

alter table public.price_versions
  add column published boolean not null default false,
  add column published_at timestamptz,
  add column content_hash text,
  add constraint price_versions_published_complete
    check (published = (published_at is not null and content_hash is not null));

-- Kanonischer Inhalts-Hash an einer Stelle: sha256 über den jsonb-Text von Version, Datum und Zeilen nach key sortiert
-- (key, value, unit, label, sources, researched_at). JSON ist eindeutig getrennt und unabhängig von DateStyle.
create function private.price_version_hash(v int) returns text
language sql stable security definer set search_path = ''
as $$
  select encode(sha256(convert_to((
    select jsonb_build_object(
      'version', p.version,
      'effective_on', p.effective_on,
      'rows', coalesce((
        select jsonb_agg(jsonb_build_array(c.key, c.value, c.unit, c.label, c.sources, c.researched_at) order by c.key collate "C")
        from public.price_config c where c.version = p.version), '[]'::jsonb))
    from public.price_versions p where p.version = v)::text, 'UTF8')), 'hex')
$$;

revoke all on function private.price_version_hash(int) from public;

create function private.guard_price_version() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.published or new.published_at is not null or new.content_hash is not null then
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
$$;

revoke all on function private.guard_price_version() from public;

create trigger guard_price_version before insert or update or delete on public.price_versions
for each row execute function private.guard_price_version();
create trigger guard_price_version_truncate before truncate on public.price_versions
for each statement execute function private.append_only();

-- price_config: keine Änderung, wenn OLD oder NEW zu einer veröffentlichten Version gehört (auch Verschieben einer Zeile).
-- SECURITY DEFINER wegen FOR SHARE; die Sperre wartet auf eine laufende Veröffentlichung.
create function private.guard_price_config() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v int;
  pub boolean;
begin
  foreach v in array array[
    case when tg_op <> 'INSERT' then old.version end,
    case when tg_op <> 'DELETE' then new.version end
  ] loop
    if v is not null then
      select p.published into pub from public.price_versions p where p.version = v for share;
      if pub then raise exception 'version_published'; end if;
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function private.guard_price_config() from public;

create trigger guard_price_config before insert or update or delete on public.price_config
for each row execute function private.guard_price_config();
create trigger guard_price_config_truncate before truncate on public.price_config
for each statement execute function private.append_only();

-- Veröffentlichen: einzige Stelle, die den Marker setzt -------------------------------

create function private.do_publish(p_version int, p_actor uuid, p_actor_role text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  pv public.price_versions;
begin
  select * into pv from public.price_versions where version = p_version for update;
  if not found then raise exception 'not_found'; end if;
  if pv.published then raise exception 'version_published'; end if;
  if not exists (select 1 from public.price_config where version = p_version) then raise exception 'not_found'; end if;
  perform set_config('app.mv_publish', p_version::text, true);
  update public.price_versions set published = true where version = p_version returning * into pv;
  perform set_config('app.mv_publish', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, p_actor_role, 'publish_version', 'price_version', p_version::text, jsonb_build_object('content_hash', pv.content_hash));
  return pv.content_hash;
end
$$;

revoke all on function private.do_publish(int, uuid, text) from public;

create function public.publish_version(p_actor uuid, p_version int) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  return private.do_publish(p_version, p_actor, 'admin');
end
$$;

-- Seed-Weg (R11-2): ohne p_actor, idempotent, nur Eigentümer. Fehlt die Version, passiert nichts.
create function private.publish_seed_version(p_version int) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.price_versions where version = p_version and not published) then
    perform private.do_publish(p_version, null, 'system');
  end if;
end
$$;

revoke all on function private.publish_seed_version(int) from public;

create function public.admin_create_price_version(p_actor uuid, p_version int, p_effective_on date, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  insert into public.price_versions (version, effective_on, note) values (p_version, p_effective_on, p_note);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'create_price_version', 'price_version', p_version::text, jsonb_build_object('effective_on', p_effective_on));
end
$$;

create function public.admin_set_price_config(
  p_actor uuid, p_version int, p_key text, p_value numeric, p_unit text, p_label text,
  p_sources jsonb default '[]', p_researched_at date default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  insert into public.price_config (version, key, value, unit, label, sources, researched_at)
  values (p_version, p_key, p_value, p_unit, p_label, p_sources, p_researched_at)
  on conflict (version, key) do update set
    value = excluded.value, unit = excluded.unit, label = excluded.label,
    sources = excluded.sources, researched_at = excluded.researched_at;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_price_config', 'price_config', p_version::text || '/' || p_key, jsonb_build_object('value', p_value, 'unit', p_unit));
end
$$;

-- quote prüft vor dem Rechnen, ob die Version noch ihrem gespeicherten Hash entspricht.
create function public.verify_price_version(p_version int) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  pv public.price_versions;
begin
  select * into pv from public.price_versions where version = p_version;
  if not found or not pv.published then raise exception 'not_found'; end if;
  if pv.content_hash is distinct from private.price_version_hash(p_version) then raise exception 'version_hash_mismatch'; end if;
end
$$;

revoke all on function
  public.publish_version(uuid, int),
  public.admin_create_price_version(uuid, int, date, text),
  public.admin_set_price_config(uuid, int, text, numeric, text, text, jsonb, date),
  public.verify_price_version(int)
from public, anon, authenticated;
grant execute on function
  public.publish_version(uuid, int),
  public.admin_create_price_version(uuid, int, date, text),
  public.admin_set_price_config(uuid, int, text, numeric, text, text, jsonb, date),
  public.verify_price_version(int)
to service_role;

-- Rechte und Policies: Schreiben nur über die Funktionen, Lesen nur Veröffentlichtes (admin mit aal2: alles) ---

drop policy price_versions_insert on public.price_versions;
drop policy price_versions_update on public.price_versions;
drop policy price_versions_delete on public.price_versions;
drop policy price_config_insert on public.price_config;
drop policy price_config_update on public.price_config;
drop policy price_config_delete on public.price_config;
revoke insert, update, delete on public.price_versions, public.price_config from authenticated;
revoke truncate on public.price_versions, public.price_config, public.platform_settings from service_role;

drop policy price_versions_select on public.price_versions;
drop policy price_config_select on public.price_config;

create policy price_versions_select on public.price_versions for select to anon, authenticated
using (published);
create policy price_versions_select_admin on public.price_versions for select to authenticated
using ((select private.is_admin()));
create policy price_config_select on public.price_config for select to anon, authenticated
using (exists (select 1 from public.price_versions v where v.version = price_config.version and v.published));
create policy price_config_select_admin on public.price_config for select to authenticated
using ((select private.is_admin()));

create or replace view public.current_price_version with (security_invoker = true) as
select version, effective_on
from public.price_versions
where published and effective_on <= (now() at time zone 'Europe/Vienna')::date
order by version desc
limit 1;

-- Bestehende Version 1 (Dev, Produktion): veröffentlichen, falls vorhanden. Auf leeren Tabellen passiert nichts.
select private.publish_seed_version(1);
