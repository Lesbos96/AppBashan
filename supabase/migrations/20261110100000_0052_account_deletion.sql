-- 0052 Konto löschen mit Anonymisierung (S9h-4, S4-N8, S1-N2, S9d-6, S9h2-1; docs/S9_KONZEPT.md Frage 24, 6.4).
-- Das Konto bleibt als anonyme Zeile (auth.users, profiles): Journal (commission_entries, ON DELETE RESTRICT), status_events,
-- price_revisions und Zuordnungen verweisen darauf und bleiben unverändert. Personendaten werden überschrieben oder gelöscht.
-- Fehler: SQLSTATE P0001, Meldung = Code (not_found, role_not_allowed, open_requests, account_deleted, setting_missing).

-- 1. Marker am Profil und Aufbewahrung der Originalfotos ----------------------------------------------------------------
alter table public.profiles add column deleted_at timestamptz;

alter table public.platform_settings
  add constraint platform_settings_s9h4 check (key <> 'photo_retention_days' or (value = trunc(value) and value between 1 and 3650));

-- 2. Wächter: ein gelöschtes Konto legt keine Anfrage mehr an (ein JWT bleibt bis zu einer Stunde gültig) -----------------
-- SECURITY DEFINER wegen `for share`: wartet auf delete_account (for update) und sieht danach deleted_at.
create or replace function private.guard_request_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  gone timestamptz;
begin
  if new.status not in ('requested', 'awaiting_offer') then
    raise exception 'invalid_transition';
  end if;
  -- reissued_from und cancel_fee_waived = true setzt nur die Weitervermittlung (T16)
  if (new.reissued_from is not null or new.cancel_fee_waived) and current_setting('app.mv_reissue', true) is distinct from new.id::text then
    raise exception 'invalid_transition';
  end if;
  select p.deleted_at into gone from public.profiles p where p.id = new.customer_id for share;
  if gone is not null then
    raise exception 'account_deleted';
  end if;
  return new;
end
$$;

-- 3. delete_account: nur service_role (Edge Function delete-account); p_user stammt aus dem geprüften JWT -------------------
-- Gesperrt: Rolle nicht customer (admin, Partner: Firmendaten ordnet admin), Anfrage in offenem Status (alles außer den Endstatus).
-- Zweiter Aufruf: No-op. Dateien in den Buckets entfernt photo_purge (photo-cleanup) anhand von deleted_at.
create function public.delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pr public.profiles;
begin
  if p_user is null then raise exception 'not_found'; end if;
  select * into pr from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if pr.deleted_at is not null then return; end if;
  if pr.role <> 'customer' then raise exception 'role_not_allowed'; end if;
  if exists (
    select 1 from public.service_requests r
    where r.customer_id = p_user
      and r.status not in ('completed', 'withdrawn', 'expired', 'declined', 'unmatched', 'cancelled_by_customer', 'cancelled_by_partner')
  ) then
    raise exception 'open_requests';
  end if;

  update public.service_requests
  set from_address = null, to_address = null, from_point = null, to_point = null, route = null, description = null
  where customer_id = p_user;

  update public.request_contacts c
  set name = 'Gelöschtes Konto', phone = '-', email = 'geloescht@invalid', stairs_door = null
  from public.service_requests r
  where r.id = c.request_id and r.customer_id = p_user;

  update public.profiles set display_name = null, phone = null, deleted_at = now() where id = p_user;

  -- anonyme Zeile statt Löschen (Fremdschlüssel von Journal und Ereignissen); Anmeldung unmöglich
  delete from auth.identities where user_id = p_user;
  delete from auth.mfa_factors where user_id = p_user;
  delete from auth.one_time_tokens where user_id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
  update auth.users
  set email = null, phone = null, encrypted_password = null, raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = '{}'::jsonb,
      email_confirmed_at = null, phone_confirmed_at = null, last_sign_in_at = null,
      banned_until = now() + interval '100 years', deleted_at = now()
  where id = p_user;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_user, 'customer', 'delete_account', 'profile', p_user::text, '{}');
end
$$;

revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;

-- 4. photo_purge: Konto (Originale und Kopien), Kette (S9h2-1), Aufbewahrung (S9d-6) -------------------------------------
-- (a) Dateien in job-photos ohne Zeile nach 1 h (unverändert).
-- (b) Kopien (nicht Belege): zurückgezogene, abgelaufene und nicht vermittelte Anfragen, 30 Tage nach Zugriffsende; neu: sofort bei gelöschtem Konto.
-- (c) Originale in request-photos: nur wenn JEDE Anfrage mit demselben Pfad löschbar ist (zurückgezogen, Konto gelöscht oder Endstatus
--     länger als photo_retention_days her). Ohne Statusereignis gilt die Aufbewahrung als nicht abgelaufen. Fehlt photo_retention_days,
--     scheitert der Job sichtbar (setting_missing, wie partner_access_days).
create or replace function public.photo_purge() returns table (bucket_id text, name text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  days int := private.setting_num('partner_access_days')::int;
  keep int := private.setting_num('photo_retention_days')::int;
begin
  return query
  select u.bucket_id, u.name from (
    select o.bucket_id::text as bucket_id, o.name from storage.objects o
    where o.bucket_id = 'job-photos' and coalesce(o.created_at, '-infinity'::timestamptz) < now() - interval '1 hour'
      and not exists (select 1 from public.job_photos j where j.storage_path = o.name)
    union all
    select o.bucket_id::text, o.name from storage.objects o
    join public.job_photos j on j.storage_path = o.name and j.kind = 'request'
    join public.service_requests s on s.id = j.request_id
    join public.profiles pr on pr.id = s.customer_id
    where o.bucket_id = 'job-photos' and (
      pr.deleted_at is not null
      or s.status in ('withdrawn', 'expired', 'unmatched')
      or (s.status in ('completed', 'cancelled_by_customer', 'cancelled_by_partner')
          and not exists (select 1 from public.assignments a where a.request_id = s.id
                          and (a.ended_at is null or a.ended_at > now() - make_interval(days => days))))
    )
    union all
    select o.bucket_id::text, o.name from storage.objects o
    where o.bucket_id = 'request-photos'
      and exists (select 1 from public.request_photos rp where rp.storage_path = o.name)
      and not exists (
        select 1 from public.request_photos rp
        join public.service_requests s on s.id = rp.request_id
        join public.profiles pr on pr.id = s.customer_id
        where rp.storage_path = o.name and pr.deleted_at is null and s.status <> 'withdrawn'
          and not (
            s.status in ('expired', 'unmatched', 'declined', 'completed', 'cancelled_by_customer', 'cancelled_by_partner')
            and coalesce((select max(e.at) from public.status_events e where e.request_id = s.id and e.to_status = s.status), 'infinity'::timestamptz)
                < now() - make_interval(days => keep)
          )
      )
  ) u limit 1000;
end
$$;
