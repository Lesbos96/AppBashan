-- 0054 S9h-4 Abnahme (tmp/proof/S9h-4-abnahme.md): M1, M2, N3.
-- M1: delete_account leert auch angefangene Adress-/Nummernänderungen und Token-Spalten in auth.users und die Auth-Audit-Einträge.
-- M2: ein gelöschtes Konto ändert sein Profil nicht mehr (Trigger) und wird nicht mehr Mitglied einer Firma (Trigger mit for share,
--     schließt auch den Wettlauf mit register_partner gegen delete_account, das das Profil for update hält).
-- N3: Kopien in job-photos bei Status declined werden mit aufgeräumt.

create function private.guard_profile_deleted() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'account_deleted';
  end if;
  return new;
end
$$;

revoke all on function private.guard_profile_deleted() from public;

create trigger guard_profile_deleted before update on public.profiles
for each row execute function private.guard_profile_deleted();

create function private.guard_member_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  gone timestamptz;
begin
  select p.deleted_at into gone from public.profiles p where p.id = new.user_id for share;
  if gone is not null then
    raise exception 'account_deleted';
  end if;
  return new;
end
$$;

revoke all on function private.guard_member_insert() from public;

create trigger guard_member_insert before insert on public.partner_members
for each row execute function private.guard_member_insert();

create or replace function public.delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pr public.profiles;
begin
  if p_user is null then raise exception 'not_found'; end if;
  select * into pr from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if pr.deleted_at is not null then return; end if;
  if pr.role <> 'customer' or exists (select 1 from public.partner_members m where m.user_id = p_user) then
    raise exception 'role_not_allowed';
  end if;
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
  set name = 'Gelöschtes Konto', phone = '00000', email = 'geloescht@deleted.invalid', stairs_door = null
  from public.service_requests r
  where r.id = c.request_id and r.customer_id = p_user;

  update public.profiles set display_name = null, phone = null, deleted_at = now() where id = p_user;

  -- anonyme Zeile statt Löschen (Fremdschlüssel von Journal und Ereignissen); Anmeldung unmöglich
  delete from auth.identities where user_id = p_user;
  delete from auth.mfa_factors where user_id = p_user;
  delete from auth.one_time_tokens where user_id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
  delete from auth.audit_log_entries where payload ->> 'actor_id' = p_user::text or payload -> 'traits' ->> 'user_id' = p_user::text;
  update auth.users
  set email = null, phone = null, encrypted_password = null, raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = '{}'::jsonb,
      email_confirmed_at = null, phone_confirmed_at = null, last_sign_in_at = null,
      email_change = '', phone_change = '', confirmation_token = '', recovery_token = '', email_change_token_new = '',
      email_change_token_current = '', phone_change_token = '', reauthentication_token = '',
      banned_until = now() + interval '100 years', deleted_at = now()
  where id = p_user;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_user, 'customer', 'delete_account', 'profile', p_user::text, '{}');
end
$$;

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
      or s.status in ('withdrawn', 'expired', 'unmatched', 'declined')
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
