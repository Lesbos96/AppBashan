-- S9h-3-Abnahme: M1 ended_at einer als completed beendeten Zuordnung bleibt bei T14 (kein neues Zugriffsfenster der Firma auf die Kundendaten,
-- Konzept 5.5), M2 ein admin-Storno nur nach der Meldung „nicht stattgefunden“ oder ab Terminbeginn (sonst blieben Kunde und Firma ohne Mail und
-- ohne Weitervermittlung), N1 ein Storno erledigt die Meldung. (H1 und M3 stecken in der Edge Function.)

create or replace function private.guard_assignment_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id <> old.id or new.request_id <> old.request_id or new.partner_id <> old.partner_id or new.accepted_at <> old.accepted_at then
    raise exception 'append_only';
  end if;
  -- beendet: nur T14 darf eine als completed beendete Zuordnung in einen Storno-Grund ändern; ended_at bleibt (Zugriffsfenster, Zähler)
  if old.ended_at is not null and not (
    old.ended_reason = 'completed' and new.ended_reason in ('cancelled_by_customer', 'cancelled_by_partner')
    and new.ended_at is not distinct from old.ended_at
    and current_setting('app.mv_correct', true) is not distinct from old.request_id::text
  ) then
    raise exception 'append_only';
  end if;
  return new;
end
$$;

create or replace function public.admin_correct(
  p_actor uuid, p_aal text, p_request uuid, p_action text, p_reason text, p_cancel_reason text, p_fee_base bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
  fl public.commission_entries;
  pid uuid;
  target public.request_status;
  computed bigint;
begin
  perform private.assert_admin(p_actor);
  if p_aal is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  if p_action is null or p_action not in ('complete', 'cancel_customer', 'cancel_partner', 'negate_fee', 'dismiss_report') then raise exception 'invalid_action'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reason_required'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  select a.partner_id into pid from public.assignments a where a.request_id = p_request order by a.accepted_at desc limit 1;
  if pid is null then raise exception 'not_found'; end if;
  perform 1 from public.partners p where p.id = pid for share;
  if exists (select 1 from public.status_events e where e.request_id = p_request and e.at > now()) then raise exception 'retry'; end if;
  -- eine Gebühr gibt es nur bei einem Storno
  if p_action not in ('cancel_customer', 'cancel_partner') and p_fee_base is distinct from 0 then raise exception 'amount_mismatch'; end if;

  if p_action = 'complete' then
    if r.status not in ('accepted', 'in_progress') or r.not_done_reported_at is null or r.not_done_resolved_at is not null then
      raise exception 'invalid_transition';
    end if;
    perform private.set_request_status(p_request, 'completed', p_actor, 'admin');
    update public.assignments set ended_at = now(), ended_reason = 'completed' where request_id = p_request and ended_at is null;
    update public.service_requests set not_done_resolved_at = now() where id = p_request;

  elsif p_action = 'dismiss_report' then
    if r.status <> 'completed' or r.not_done_reported_at is null or r.not_done_resolved_at is not null then raise exception 'invalid_transition'; end if;
    update public.service_requests set not_done_resolved_at = now() where id = p_request;

  elsif p_action = 'negate_fee' then
    if r.status not in ('cancelled_by_customer', 'cancelled_by_partner') then raise exception 'invalid_transition'; end if;
    select * into fl from public.commission_entries e
    where e.request_id = p_request and e.kind = 'cancellation_fee'
      and not exists (select 1 from public.commission_entries c where c.reverses_entry_id = e.id)
    order by e.created_at desc, e.id limit 1;
    if not found then raise exception 'no_fee_line'; end if;
    perform private.commission_book(pid, p_request, fl.revision_id, 'correction', fl.id, -fl.total_cents, null, null,
      -fl.fee_cents, -fl.fee_net_cents, -fl.fee_vat_cents, -fl.payout_cents, null, null);

  else
    -- Storno: aus accepted, in_progress oder completed; Gegenbuchung aller Zeilen, optional eine Gebührenzeile (genau die berechnete Basis).
    -- Nur nach der Meldung „nicht stattgefunden“ oder ab Terminbeginn (M2): davor wären Mail und Weitervermittlung nötig.
    if r.status not in ('accepted', 'in_progress', 'completed') then raise exception 'invalid_transition'; end if;
    if r.not_done_reported_at is null and not coalesce(now() >= r.termin_at, false) then raise exception 'invalid_transition'; end if;
    if p_action = 'cancel_partner' then
      if p_cancel_reason is null or p_cancel_reason not in ('scope_impossible', 'unavailable', 'other') then raise exception 'reason_required'; end if;
      target := 'cancelled_by_partner';
    else
      if p_cancel_reason is not null then raise exception 'invalid_action'; end if;
      target := 'cancelled_by_customer';
    end if;
    if p_fee_base is distinct from 0 then
      computed := case when p_action = 'cancel_customer' then private.cancel_fee_base(p_request) else private.call_out_base(p_request) end;
      if p_fee_base is distinct from computed or p_fee_base < 0 then raise exception 'amount_mismatch'; end if;
      select * into bk from public.commission_entries x where x.request_id = p_request and x.kind = 'booking';
      if not found then raise exception 'booking_missing'; end if;
      if (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version)
         is distinct from (bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version) then
        raise exception 'fee_basis_changed';
      end if;
    end if;

    perform set_config('app.mv_correct', p_request::text, true);
    perform private.set_request_status(p_request, target, p_actor, 'admin');
    update public.assignments
      set ended_at = coalesce(ended_at, now()),
          ended_reason = case when p_action = 'cancel_partner' then 'cancelled_by_partner' else 'cancelled_by_customer' end::public.assignment_end,
          cancel_reason = case when p_action = 'cancel_partner' then p_cancel_reason end
      where request_id = p_request and (ended_at is null or ended_reason = 'completed');
    perform set_config('app.mv_correct', '', true);
    update public.service_requests set not_done_resolved_at = now()
      where id = p_request and not_done_reported_at is not null and not_done_resolved_at is null;
    perform private.cancel_reverse_all(pid, p_request);
    if p_fee_base > 0 then
      perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, p_fee_base, p_fee_rate, p_fee_vat_rate,
        p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
    end if;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'admin_correct', 'service_request', p_request::text,
          jsonb_build_object('action', p_action, 'reason', left(btrim(p_reason), 300), 'from_status', r.status, 'fee_base_cents', coalesce(p_fee_base, 0), 'cancel_reason', p_cancel_reason));
  return (select s.status::text from public.service_requests s where s.id = p_request);
end
$$;
