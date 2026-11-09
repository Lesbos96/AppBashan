-- 0053 delete_account: Korrekturen zu 0052 (Test gegen Dev).
-- 1. Platzhalter des Kontakts müssen die Prüfung request_contacts_format erfüllen (E-Mail mit Punkt in der Domain, Telefon mit 5 Ziffern).
-- 2. Eine Partner-Firma hat in profiles weiter die Rolle customer (Mitgliedschaft in partner_members): Mitglieder sind gesperrt (role_not_allowed).
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
  update auth.users
  set email = null, phone = null, encrypted_password = null, raw_user_meta_data = '{}'::jsonb, raw_app_meta_data = '{}'::jsonb,
      email_confirmed_at = null, phone_confirmed_at = null, last_sign_in_at = null,
      banned_until = now() + interval '100 years', deleted_at = now()
  where id = p_user;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_user, 'customer', 'delete_account', 'profile', p_user::text, '{}');
end
$$;
