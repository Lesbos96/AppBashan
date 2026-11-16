-- 0066 n15: (1) EXECUTE für service_role entziehen bei den zwölf Funktionen mit auth.uid()-Logik (OFFEN N15, s9k1-3). service_role bekam sie über die
-- Default-Privilegien; ein Aufruf ohne auth.uid() bricht ohnehin ab, der Entzug macht die Rechte einheitlich (nur authenticated). Aufrufer als service_role
-- gibt es nicht (Edge Functions, Skripte, Cron und SQL-Funktionen geprüft); Eigentümer-Pfade (Cron, SECURITY-DEFINER-Rümpfe) sind nicht betroffen.
-- (2) s9k1-1: Konto löschen gegen Meldung „nicht stattgefunden“.

-- delete_account: Rumpf wie 0064 (20261115104122_0064_report_flow.sql:278), ein Block mehr. Die Anfragen des Kunden werden vor den Prüfungen gesperrt
-- (Reihenfolge Profil, dann Anfragen): eine Meldung, die gerade committet, ist danach sichtbar (under_review), eine wartende Meldung sieht das gelöschte Profil.
-- Deadlock: reissue_request sperrt die Anfrage und fügt eine Folgeanfrage ein (Insert-Trigger: Profil for share), gegen diese Reihenfolge ein Zyklus;
-- das Ergebnis wäre 40P01 für eine Seite, nichts wird halb gelöscht (fail closed).
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
  perform 1 from public.service_requests r where r.customer_id = p_user order by r.id for update;
  if exists (
    select 1 from public.service_requests r
    where r.customer_id = p_user and r.not_done_reported_at is not null and r.not_done_resolved_at is null
  ) then
    raise exception 'under_review';
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

-- report_not_done: Rumpf wie 0064 (:25), ein Block mehr. Nach der Sperre der Anfrage (Reihenfolge: Anfrage, dann Profil lesen ohne Sperre) gilt ein
-- gelöschtes Konto als nicht gefunden: Melden mit noch gültigem Token nach der Löschung (PostgREST kennt gelöschte Sitzungen nicht) setzt nichts mehr.
-- Eigene Anweisung vor report_gate, sonst käme „reported“ still zurück.
create or replace function public.report_not_done(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
  why text;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.deleted_at is not null) then raise exception 'not_found'; end if;
  why := private.report_gate(r);
  if why = 'reported' then return; end if; -- einmal; der Zeitpunkt bleibt
  if why is not null then raise exception '%', why; end if;
  update public.service_requests set not_done_reported_at = now() where id = p_request;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'customer', 'report_not_done', 'service_request', p_request::text, '{}');
end
$$;

-- N15, s9k1-3: nur authenticated (und der Eigentümer)
revoke execute on function
  public.decline_listing(uuid), public.withdraw(uuid), public.my_jobs(), public.my_report_info(uuid), public.my_job_partner(uuid), public.job_contact(uuid),
  public.start_job(uuid), public.report_not_done(uuid), public.complete_job(uuid), public.my_job_changes(), public.my_cancel_info(uuid), public.my_commissions(date)
from service_role;
