-- 0064 s9k-1: Meldung „nicht stattgefunden“ als ein Zustandsablauf (OFFEN S9i3-1, S9i6b-3; Planprüfung H1, M1 bis M3).
-- Z2 = gemeldet, Status accepted/in_progress (Prüfung bei admin); Z4 = abgeschlossen und gemeldet. In Z2 sperrt der Server die Firma
-- (Start, Abschluss, Nachtrag, Absage) und den Nachtrag-Annahme des Kunden; Löschen des Kontos wartet auf die Entscheidung.

-- M3: der Sperrgrund der Meldung an einer Stelle (Reihenfolge wie 20261109150000_0043_s9g_abnahme.sql:43-49); null = Meldung möglich,
-- 'reported' = schon gemeldet (report_not_done kehrt dann still zurück, der Zeitpunkt bleibt).
create function private.report_gate(r public.service_requests) returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if r.status not in ('accepted', 'in_progress', 'completed') then return 'invalid_transition'; end if;
  if r.not_done_reported_at is not null then return 'reported'; end if;
  if exists (select 1 from public.status_events e where e.request_id = r.id and e.to_status = 'completed' and e.actor_role = 'customer') then
    return 'invalid_transition';
  end if;
  if r.termin_at is null or now() < r.termin_at then return 'too_early'; end if;
  if now() >= r.termin_at + make_interval(hours => 24 * private.setting_num('completion_days')::int) then return 'report_window_closed'; end if;
  return null;
end
$$;

revoke all on function private.report_gate(public.service_requests) from public;

-- report_not_done: unverändert im Verhalten und in den Fehlercodes, nur der Sperrgrund kommt aus report_gate.
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
  why := private.report_gate(r);
  if why = 'reported' then return; end if; -- einmal; der Zeitpunkt bleibt
  if why is not null then raise exception '%', why; end if;
  update public.service_requests set not_done_reported_at = now() where id = p_request;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'customer', 'report_not_done', 'service_request', p_request::text, '{}');
end
$$;

-- S9i3-1: Serversignal für die Frage des Kunden (Meldung möglich, Frist). Nur die eigene Anfrage; sonst not_found.
create function public.my_report_info(p_request uuid) returns table (can_report boolean, report_until timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
  ok boolean;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid;
  if not found then raise exception 'not_found'; end if;
  ok := private.report_gate(r) is null;
  return query select ok, case when ok then r.termin_at + make_interval(hours => 24 * private.setting_num('completion_days')::int) end;
end
$$;

revoke all on function public.my_report_info(uuid) from public, anon;
grant execute on function public.my_report_info(uuid) to authenticated;

-- S9i6b-3: bei offener Meldung weder Start noch Abschluss durch die Firma (Rumpf wie 0032_job_flow.sql:4 und 0043_s9g_abnahme.sql:4,
-- je eine Zeile mehr, vor der Statusprüfung).
create or replace function public.start_job(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found or not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
    raise exception 'not_assigned';
  end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if r.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  if now() < r.termin_at then raise exception 'too_early'; end if;
  perform private.set_request_status(p_request, 'in_progress', uid, 'partner');
end
$$;

create or replace function public.complete_job(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  r public.service_requests;
  who text;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if r.customer_id = uid then
    if r.status not in ('accepted', 'in_progress') or now() < r.termin_at or r.not_done_reported_at is not null then raise exception 'invalid_transition'; end if;
    who := 'customer';
  else
    if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
    pid := private.my_job_partner_id();
    if pid is null or not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
      raise exception 'not_found';
    end if;
    if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
    if r.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
    who := 'partner';
  end if;
  perform private.set_request_status(p_request, 'completed', uid, who);
  update public.assignments set ended_at = now(), ended_reason = 'completed' where request_id = p_request and ended_at is null;
end
$$;

-- S9i6b-3: my_jobs() zeigt der Firma nur, dass der Kunde gemeldet hat (kein Zeitpunkt, kein Text); can_start ist dann falsch.
-- Rückgabetyp ändert sich: neu anlegen, Rechte wie 0057.
drop function public.my_jobs();
create function public.my_jobs()
returns table (
  assignment_id uuid,
  request_id uuid,
  listing_id uuid,
  status public.request_status,
  termin_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz,
  ended_reason public.assignment_end,
  district smallint,
  to_district smallint,
  service public.service_type,
  preferred_date date,
  time_window text,
  total_cents bigint,
  payout_cents bigint,
  can_start boolean,
  under_review boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  pid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  return query
    select a.id, a.request_id, l.id, r.status, r.termin_at, a.accepted_at, a.ended_at, a.ended_reason,
           r.district, l.to_district, r.service, r.preferred_date, r.time_window,
           j.total, j.payout,
           (a.ended_at is null and r.status = 'accepted' and now() >= r.termin_at and r.not_done_reported_at is null),
           (r.not_done_reported_at is not null and r.not_done_resolved_at is null)
    from public.assignments a
    join public.service_requests r on r.id = a.request_id
    left join public.job_listings l on l.request_id = a.request_id and l.partner_id = a.partner_id
    left join lateral (
      select sum(c.total_cents)::bigint as total, sum(c.payout_cents)::bigint as payout
      from public.commission_entries c
      where c.request_id = a.request_id and c.partner_id = a.partner_id
    ) j on true
    where a.partner_id = pid and private.assignment_access(a.request_id, pid)
    order by (a.ended_at is not null), r.termin_at, a.id;
end
$$;

revoke all on function public.my_jobs() from public, anon;
grant execute on function public.my_jobs() to authenticated;

-- M2: Nachtrag stellen und Absage laufen über change_gate (propose_change(_basis), cancel_by_partner(_basis)); in Z2 gesperrt.
-- Rumpf wie 20261109120000_0040_change_orders.sql:303, eine Zeile mehr.
create or replace function private.change_gate(p_actor uuid, p_aal text, p_request uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  pst public.partner_status;
  r public.service_requests;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  if p_aal is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  select m.partner_id into pid from public.partner_members m where m.user_id = p_actor;
  if pid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  select p.status into pst from public.partners p where p.id = pid for share;
  if pst is null or pst not in ('active', 'payment_hold') then raise exception 'partner_not_active'; end if;
  if not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
    raise exception 'not_found';
  end if;
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_transition'; end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  return pid;
end
$$;

-- M2: der Kunde nimmt einen Nachtrag während der Prüfung nicht an (Ablehnen bleibt möglich).
-- Rumpf wie 20261114100000_0062_fee_schedule.sql:606, eine Zeile mehr (nach dem Ablehnen-Zweig).
create or replace function public.decide_change(
  p_actor uuid, p_revision uuid, p_accept boolean, p_shown_total bigint,
  p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  rev public.price_revisions;
  r public.service_requests;
  bk public.commission_entries;
  pst public.partner_status;
  js record;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  if p_accept is null then raise exception 'invalid_input'; end if;
  select * into rev from public.price_revisions v where v.id = p_revision and v.source = 'change_order';
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = rev.request_id;
  if r.customer_id is distinct from p_actor then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = rev.request_id for update;
  select p.status into pst from public.partners p where p.id = rev.proposed_by for share;
  select * into rev from public.price_revisions v where v.id = p_revision for update;
  if rev.status = 'accepted' and p_accept then return 'accepted'; end if;
  if rev.status = 'declined' and not p_accept then return 'declined'; end if;
  if rev.status = 'expired' or (rev.status = 'proposed' and rev.valid_until <= now()) then raise exception 'change_not_valid'; end if;
  if rev.status <> 'proposed' or r.status not in ('accepted', 'in_progress') then raise exception 'invalid_transition'; end if;

  if not p_accept then
    perform set_config('app.mv_change', rev.id::text || ':declined', true);
    update public.price_revisions set status = 'declined', decided_by = p_actor, decided_at = now() where id = rev.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_declined', 'partner', rev.proposed_by, r.id, 'change_declined:' || rev.id);
    insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
    values (p_actor, 'customer', 'decline_change', 'revision', rev.id::text, jsonb_build_object('request_id', r.id));
    return 'declined';
  end if;

  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if pst is null or pst not in ('active', 'payment_hold') then
    -- wie T5: nicht als Fehler abbrechen, sondern den Nachtrag zurückziehen (Akteur system) und das Ergebnis melden
    perform set_config('app.mv_change', rev.id::text || ':withdrawn', true);
    update public.price_revisions set status = 'withdrawn', decided_at = now() where id = rev.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_withdrawn', 'customer', r.customer_id, r.id, 'change_withdrawn:' || rev.id);
    insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
    values (null, 'system', 'withdraw_change', 'revision', rev.id::text, jsonb_build_object('request_id', r.id, 'reason', 'partner_not_active'));
    return 'partner_not_active';
  end if;
  if p_shown_total is distinct from rev.total_cents then raise exception 'shown_total_mismatch'; end if;
  select * into bk from public.commission_entries e where e.request_id = r.id and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if (p_fee_vat_rate, p_fee_schedule_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;
  if rev.base_revision_id is distinct from r.current_revision then raise exception 'revision_changed'; end if;
  select * into js from private.journal_sums(r.id);
  perform set_config('app.mv_change', rev.id::text || ':accepted', true);
  update public.price_revisions set status = 'accepted', decided_by = p_actor, decided_at = now() where id = rev.id;
  perform set_config('app.mv_change', rev.id::text || ':pointer', true);
  update public.service_requests set current_revision = rev.id where id = r.id;
  perform set_config('app.mv_change', '', true);
  perform private.commission_book(rev.proposed_by, r.id, rev.id, 'change', null, rev.total_cents - js.total, p_fee_vat_rate,
    p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_schedule_version, p_fee_vat_rate_version);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'decide_change', 'revision', rev.id::text,
    jsonb_build_object('request_id', r.id, 'total_cents', rev.total_cents, 'snapshot_hash', encode(sha256(convert_to(rev.snapshot::text, 'utf8')), 'hex')));
  perform private.outbox_put('change_accepted', 'partner', rev.proposed_by, r.id, 'change_accepted:' || rev.id);
  return 'accepted';
end
$$;

-- M1: eine offene Meldung (Z2 oder Z4) hält das Löschen des Kontos an (`under_review`, vor `open_requests`).
-- Rumpf wie 20261110120000_0054_s9h4_abnahme.sql:42, ein Block mehr.
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
