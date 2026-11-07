-- 0023 Partnerkern (S9b-1, docs/S9b_PLAN.md Abschnitt 4, docs/S9_KONZEPT.md 3, 5.2).
-- Firmen, Mitglieder, Kategorien, Bezirke, USt.-Regeln; Statusmaschine nur über Funktionen mit Marker an die Zeile gebunden.
-- Fehler der Trigger und Funktionen: SQLSTATE P0001, Meldung = Code (invalid_transition, field_immutable, append_only, reason_required,
-- scope_incomplete, vat_rule_missing, rental_not_enabled, vat_rule_not_enabled, self_approval, already_member, not_found);
-- fehlende Rechte: 42501 (not_admin, not_authenticated, not_customer, permission denied).
-- Phase 1: Sitz Österreich, Kategorie rental und USt.-Regel außer standard_20 sind bis Phase 2 gesperrt (Funktionen und Journal).
-- profiles.role bleibt customer; Zuständigkeit folgt allein aus partner_members.

create type public.partner_status as enum ('pending', 'active', 'payment_hold', 'suspended', 'rejected');
create type public.partner_service as enum ('transport', 'move', 'clearance', 'assembly', 'rental');
create type public.partner_vat_rule as enum ('standard_20', 'reverse_charge', 'none');
create type public.partner_role as enum ('owner', 'staff');

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  legal_form text not null check (legal_form in ('einzelunternehmen', 'eu', 'gmbh', 'og', 'kg', 'sonstige')),
  country text not null default 'AT' check (country = 'AT'),
  uid text check (uid ~ '^ATU[0-9]{8}$'),
  small_business boolean not null default false,
  address_street text not null check (char_length(address_street) between 2 and 120),
  address_postcode text not null check (address_postcode ~ '^[0-9]{4}$'),
  address_city text not null check (char_length(address_city) between 2 and 80),
  contact_name text not null check (char_length(contact_name) between 2 and 100),
  contact_phone text not null check (char_length(contact_phone) between 5 and 40),
  contact_email text not null check (char_length(contact_email) between 5 and 254 and contact_email like '%_@_%'),
  status public.partner_status not null default 'pending',
  status_reason text check (char_length(status_reason) <= 500),
  status_changed_at timestamptz,
  payout_model text not null default 'direct' check (payout_model in ('direct', 'connect')),
  stripe_account_id text,
  terms_version text not null check (terms_version ~ '^[0-9A-Za-z._-]{1,40}$'),
  terms_accepted_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_uid_or_small_business check (small_business or uid is not null)
);

create table public.partner_members (
  partner_id uuid not null references public.partners (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.partner_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id),
  unique (user_id)
);

create table public.partner_categories (
  partner_id uuid not null references public.partners (id) on delete restrict,
  service public.partner_service not null,
  primary key (partner_id, service)
);

create table public.partner_regions (
  partner_id uuid not null references public.partners (id) on delete restrict,
  district smallint not null check (district between 1 and 23),
  primary key (partner_id, district)
);

create table public.partner_vat_rules (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.partners (id) on delete restrict,
  rule public.partner_vat_rule not null,
  valid_from date not null,
  created_at timestamptz not null default now(),
  unique (partner_id, valid_from)
);

create trigger set_updated_at before update on public.partners
for each row execute function extensions.moddatetime(updated_at);

-- Zuständigkeit: vier getrennte Prüfungen, alle SECURITY DEFINER (Policies lesen sonst mit den Rechten des Aufrufers) ---

-- Mitglied einer Firma, jeder Status, jedes aal (eigene Firmendaten, MFA-Einrichtung)
create function private.partner_of_user() returns uuid
language sql stable security definer set search_path = ''
as $$ select m.partner_id from public.partner_members m where m.user_id = (select auth.uid()) $$;

-- Mitglied, jeder Status, aal2 (Fach-Lesezugriffe, Partner-Schreiben)
create function private.my_member_partner_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.partner_id from public.partner_members m
  where m.user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2'
$$;

-- Mitglied einer aktiven Firma, aal2 („darf annehmen“)
create function private.my_partner_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.partner_id from public.partner_members m join public.partners p on p.id = m.partner_id
  where m.user_id = (select auth.uid()) and p.status = 'active' and (select auth.jwt() ->> 'aal') = 'aal2'
$$;

-- Mitglied einer aktiven oder zahlungsgesperrten Firma, aal2 („darf zugeordnete Aufträge abwickeln“)
create function private.my_job_partner_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.partner_id from public.partner_members m join public.partners p on p.id = m.partner_id
  where m.user_id = (select auth.uid()) and p.status in ('active', 'payment_hold') and (select auth.jwt() ->> 'aal') = 'aal2'
$$;

revoke all on function private.partner_of_user(), private.my_member_partner_id(), private.my_partner_id(), private.my_job_partner_id() from public;
grant execute on function private.partner_of_user(), private.my_member_partner_id(), private.my_partner_id(), private.my_job_partner_id() to authenticated;

-- Statusmaschine ---------------------------------------------------------------------------------------

create function private.partner_transition_ok(p_old public.partner_status, p_new public.partner_status) returns boolean
language sql immutable set search_path = ''
as $$
  select p_old::text || '>' || p_new::text in (
    'pending>active', 'pending>rejected', 'active>payment_hold', 'active>suspended',
    'payment_hold>active', 'payment_hold>suspended', 'suspended>active')
$$;

create function private.guard_partner_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status <> 'pending' then raise exception 'invalid_transition'; end if;
  if new.verified_at is not null or new.status_reason is not null or new.status_changed_at is not null
     or new.stripe_account_id is not null or new.payout_model <> 'direct' then
    raise exception 'field_immutable';
  end if;
  return new;
end
$$;

-- Zwei getrennte Prüfungen: das Paar steht in der Tabelle, und der Marker nennt genau diese Firma und dieses Paar.
create function private.guard_partner_status() returns trigger
language plpgsql set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
begin
  if new.status is not distinct from old.status then
    if new.status_reason is distinct from old.status_reason or new.status_changed_at is distinct from old.status_changed_at
       or new.verified_at is distinct from old.verified_at then
      raise exception 'field_immutable';
    end if;
    return new;
  end if;
  if not private.partner_transition_ok(old.status, new.status) then raise exception 'invalid_transition'; end if;
  if current_setting('app.mv_partner_status', true) is distinct from old.id::text || ':' || old.status::text || '>' || new.status::text then
    raise exception 'invalid_transition';
  end if;
  if not (old.status = 'pending' and new.status = 'active') then
    if new.status_reason is null or char_length(btrim(new.status_reason)) < 10 or new.status_reason is not distinct from old.status_reason then
      raise exception 'reason_required';
    end if;
    if new.verified_at is distinct from old.verified_at then raise exception 'field_immutable'; end if;
  end if;
  if new.status = 'active' then
    if not exists (select 1 from public.partner_categories c where c.partner_id = new.id)
       or not exists (select 1 from public.partner_regions r where r.partner_id = new.id)
       or not exists (select 1 from public.partner_members m where m.partner_id = new.id) then
      raise exception 'scope_incomplete';
    end if;
    if not exists (select 1 from public.partner_vat_rules v where v.partner_id = new.id and v.valid_from <= today) then
      raise exception 'vat_rule_missing';
    end if;
  end if;
  if old.status = 'pending' and new.status = 'active' then new.verified_at := now(); end if;
  new.status_changed_at := now();
  return new;
end
$$;

create function private.guard_partner_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.country is distinct from old.country
     or new.terms_version is distinct from old.terms_version or new.terms_accepted_at is distinct from old.terms_accepted_at then
    raise exception 'field_immutable';
  end if;
  if (new.name, new.legal_form, new.uid, new.small_business, new.address_street, new.address_postcode, new.address_city, new.payout_model, new.stripe_account_id)
     is distinct from
     (old.name, old.legal_form, old.uid, old.small_business, old.address_street, old.address_postcode, old.address_city, old.payout_model, old.stripe_account_id)
     and current_setting('app.mv_partner_master', true) is distinct from old.id::text then
    raise exception 'field_immutable';
  end if;
  return new;
end
$$;

-- Löschen nur mit dem Marker der Firma (nur Eigentümer-SQL in Tests, keine Funktion setzt ihn); TRUNCATE nie.
create function private.guard_partner_delete() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then raise exception 'field_immutable'; end if;
  if current_setting('app.mv_partner_delete', true) is distinct from old.id::text then raise exception 'field_immutable'; end if;
  return old;
end
$$;

create function private.guard_partner_child_delete() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_setting('app.mv_partner_delete', true) is distinct from old.partner_id::text then raise exception 'field_immutable'; end if;
  return old;
end
$$;

revoke all on function private.partner_transition_ok(public.partner_status, public.partner_status), private.guard_partner_insert(),
  private.guard_partner_status(), private.guard_partner_fields(), private.guard_partner_delete(), private.guard_partner_child_delete()
from public;

create trigger guard_partner_insert before insert on public.partners
for each row execute function private.guard_partner_insert();
create trigger guard_partner_status before update on public.partners
for each row execute function private.guard_partner_status();
create trigger guard_partner_fields before update on public.partners
for each row execute function private.guard_partner_fields();
create trigger guard_partner_delete before delete on public.partners
for each row execute function private.guard_partner_delete();
create trigger guard_partner_delete_truncate before truncate on public.partners
for each statement execute function private.guard_partner_delete();

create trigger append_only before update on public.partner_vat_rules
for each row execute function private.append_only();
create trigger append_only_truncate before truncate on public.partner_vat_rules
for each statement execute function private.append_only();
create trigger guard_partner_child_delete before delete on public.partner_vat_rules
for each row execute function private.guard_partner_child_delete();

-- Rechte und RLS --------------------------------------------------------------------------------------

alter table public.partners enable row level security;
alter table public.partner_members enable row level security;
alter table public.partner_categories enable row level security;
alter table public.partner_regions enable row level security;
alter table public.partner_vat_rules enable row level security;

revoke all on public.partners, public.partner_members, public.partner_categories, public.partner_regions, public.partner_vat_rules
from anon, authenticated, service_role;
grant select on public.partners, public.partner_members, public.partner_categories, public.partner_regions, public.partner_vat_rules
to authenticated, service_role;
grant update (contact_name, contact_phone, contact_email) on public.partners to authenticated;

create policy partners_select on public.partners for select to authenticated
using (id = (select private.partner_of_user()) or (select private.is_admin()));

create policy partners_update_contact on public.partners for update to authenticated
using (id = (select private.my_member_partner_id()) and status in ('pending', 'active', 'payment_hold'))
with check (id = (select private.my_member_partner_id()) and status in ('pending', 'active', 'payment_hold'));

create policy partner_members_select on public.partner_members for select to authenticated
using (partner_id = (select private.partner_of_user()) or (select private.is_admin()));
create policy partner_categories_select on public.partner_categories for select to authenticated
using (partner_id = (select private.partner_of_user()) or (select private.is_admin()));
create policy partner_regions_select on public.partner_regions for select to authenticated
using (partner_id = (select private.partner_of_user()) or (select private.is_admin()));
create policy partner_vat_rules_select on public.partner_vat_rules for select to authenticated
using (partner_id = (select private.partner_of_user()) or (select private.is_admin()));

-- Registrierung: der einzige Weg zu einer Firma (Kunde, aal1 genügt; das Konto bleibt ein Kunde) -----------------

create function public.register_partner(
  p_name text, p_legal_form text, p_uid text, p_small_business boolean, p_street text, p_postcode text, p_city text,
  p_contact_name text, p_contact_phone text, p_contact_email text, p_districts smallint[], p_terms_version text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if (select private.my_role()) is distinct from 'customer' then raise exception 'not_customer' using errcode = '42501'; end if;
  if p_districts is null or coalesce(array_length(p_districts, 1), 0) = 0 then raise exception 'scope_incomplete'; end if;
  begin
    insert into public.partners (name, legal_form, uid, small_business, address_street, address_postcode, address_city,
      contact_name, contact_phone, contact_email, terms_version, terms_accepted_at)
    values (p_name, p_legal_form, p_uid, p_small_business, p_street, p_postcode, p_city,
      p_contact_name, p_contact_phone, p_contact_email, p_terms_version, now())
    returning id into pid;
    insert into public.partner_members (partner_id, user_id, role) values (pid, uid, 'owner');
  exception when unique_violation then
    raise exception 'already_member';
  end;
  insert into public.partner_regions (partner_id, district) select pid, d from unnest(p_districts) d;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'customer', 'register_partner', 'partner', pid::text, jsonb_build_object('districts', p_districts));
  return pid;
end
$$;

-- Admin-Funktionen: nur service_role (p_actor stammt nie aus Anfragedaten), Audit in derselben Transaktion ---------

create function private.assert_not_member(p_actor uuid, p_partner uuid) returns void
language plpgsql stable set search_path = ''
as $$
begin
  if exists (select 1 from public.partner_members where partner_id = p_partner and user_id = p_actor) then
    raise exception 'self_approval';
  end if;
end
$$;

revoke all on function private.assert_not_member(uuid, uuid) from public;

create function public.admin_approve_partner(
  p_actor uuid, p_partner uuid, p_services public.partner_service[], p_vat_rule public.partner_vat_rule, p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
  today date := (now() at time zone 'Europe/Vienna')::date;
begin
  perform private.assert_admin(p_actor);
  select status into st from public.partners where id = p_partner for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, p_partner);
  if st <> 'pending' then raise exception 'invalid_transition'; end if;
  if p_services is null or coalesce(array_length(p_services, 1), 0) = 0 then raise exception 'scope_incomplete'; end if;
  if 'rental' = any (p_services) then raise exception 'rental_not_enabled'; end if;
  if p_vat_rule is distinct from 'standard_20' then raise exception 'vat_rule_not_enabled'; end if;
  if not exists (select 1 from public.partner_regions where partner_id = p_partner)
     or not exists (select 1 from public.partner_members where partner_id = p_partner) then
    raise exception 'scope_incomplete';
  end if;
  insert into public.partner_categories (partner_id, service) select distinct p_partner, s from unnest(p_services) s;
  insert into public.partner_vat_rules (partner_id, rule, valid_from) values (p_partner, p_vat_rule, today);
  perform set_config('app.mv_partner_status', p_partner::text || ':pending>active', true);
  update public.partners set status = 'active' where id = p_partner and status = 'pending';
  perform set_config('app.mv_partner_status', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'approve_partner', 'partner', p_partner::text,
    jsonb_build_object('services', p_services, 'vat_rule', p_vat_rule, 'note', p_note));
end
$$;

create function public.admin_set_partner_status(p_actor uuid, p_partner uuid, p_status public.partner_status, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
begin
  perform private.assert_admin(p_actor);
  select status into st from public.partners where id = p_partner for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, p_partner);
  if not private.partner_transition_ok(st, p_status) or (st = 'pending' and p_status = 'active') then
    raise exception 'invalid_transition';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 10 then raise exception 'reason_required'; end if;
  perform set_config('app.mv_partner_status', p_partner::text || ':' || st::text || '>' || p_status::text, true);
  update public.partners set status = p_status, status_reason = btrim(p_reason) where id = p_partner and status = st;
  perform set_config('app.mv_partner_status', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_partner_status', 'partner', p_partner::text,
    jsonb_build_object('from', st, 'to', p_status, 'reason', btrim(p_reason)));
end
$$;

revoke all on function
  public.register_partner(text, text, text, boolean, text, text, text, text, text, text, smallint[], text),
  public.admin_approve_partner(uuid, uuid, public.partner_service[], public.partner_vat_rule, text),
  public.admin_set_partner_status(uuid, uuid, public.partner_status, text)
from public, anon, authenticated, service_role;
grant execute on function public.register_partner(text, text, text, boolean, text, text, text, text, text, text, smallint[], text) to authenticated;
grant execute on function public.admin_approve_partner(uuid, uuid, public.partner_service[], public.partner_vat_rule, text) to service_role;
grant execute on function public.admin_set_partner_status(uuid, uuid, public.partner_status, text) to service_role;
