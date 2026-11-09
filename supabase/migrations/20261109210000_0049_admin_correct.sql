-- S9h-3: T14 admin_correct (Konzept 4.4 T14, 4.5 Art A, 9.4) und die Liste gemeldeter Aufträge (S9g-5, S9g-6, S9h1-3).
-- Art A: Die Edge Function admin-correct prüft das JWT (aal2) und rechnet die Aufteilung einer Gebührenzeile mit splitFee; hier prüft die Funktion
-- Rolle admin (p_actor aus dem geprüften Token, nie aus dem Body), aal2, Status, Basis und Satz. Nur service_role darf sie aufrufen.
-- Aktionen: complete (Meldung widerlegt: accepted/in_progress -> completed), cancel_customer / cancel_partner (accepted/in_progress/completed ->
-- Storno mit Gegenbuchung aller Zeilen, optional eine Gebührenzeile mit der berechneten Basis), negate_fee (Correction der lebenden Pauschale oder
-- Stornogebühr, kein Statuswechsel), dismiss_report (Meldung bei completed unbegründet, kein Statuswechsel).
-- Fehler: SQLSTATE P0001, Meldung = Code (not_admin 42501, mfa_required, invalid_action, reason_required, not_found, invalid_transition, retry,
-- amount_mismatch, fee_basis_changed, no_fee_line, booking_missing, terms_missing).

-- 1. Spalte: Meldung bearbeitet -----------------------------------------------------------------------------------------------------------
alter table public.service_requests add column not_done_resolved_at timestamptz;
alter table public.service_requests
  add constraint service_requests_not_done_resolved check (not_done_resolved_at is null or not_done_reported_at is not null);

-- 2. Wächter: completed -> cancelled_* (Paar) und die beendete Zuordnung nur mit Marker app.mv_correct = Auftrags-ID ---------------------
create or replace function private.guard_request_status() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if not (
    (old.status in ('requested', 'awaiting_offer', 'offered') and new.status = 'withdrawn')
    or (old.status = 'requested' and new.status = 'accepted')
    or (old.status in ('requested', 'awaiting_offer') and new.status in ('expired', 'unmatched'))
    or (old.status = 'accepted' and new.status = 'in_progress')
    or (old.status in ('accepted', 'in_progress') and new.status in ('completed', 'cancelled_by_customer', 'cancelled_by_partner'))
    or (old.status = 'completed' and new.status in ('cancelled_by_customer', 'cancelled_by_partner')
        and current_setting('app.mv_correct', true) is not distinct from new.id::text)
    or (old.status = 'awaiting_offer' and new.status = 'offered')
    or (old.status = 'offered' and new.status in ('awaiting_offer', 'accepted', 'declined', 'expired'))
  ) then
    raise exception 'invalid_transition';
  end if;
  if current_setting('app.mv_transition', true) is distinct from new.id::text || ':' || new.status::text then
    raise exception 'invalid_transition';
  end if;
  return new;
end
$$;

create or replace function private.guard_assignment_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id <> old.id or new.request_id <> old.request_id or new.partner_id <> old.partner_id or new.accepted_at <> old.accepted_at then
    raise exception 'append_only';
  end if;
  -- beendet: nur T14 darf eine als completed beendete Zuordnung in einen Storno-Grund ändern (Qualitätszähler, 10.2)
  if old.ended_at is not null and not (
    old.ended_reason = 'completed' and new.ended_reason in ('cancelled_by_customer', 'cancelled_by_partner')
    and current_setting('app.mv_correct', true) is not distinct from old.request_id::text
  ) then
    raise exception 'append_only';
  end if;
  return new;
end
$$;

-- 3. Grundlage für die Edge Function: Status, Revision, Basis je Storno (nur bei Gebühr geladen), Satz der Buchung ---------------------------
create function public.admin_correct_basis(p_actor uuid, p_aal text, p_request uuid)
returns table (request_status text, revision_id uuid, total_cents bigint, customer_fee_base_cents bigint, call_out_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
begin
  perform private.assert_admin(p_actor);
  if p_aal is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  select * into r from public.service_requests s where s.id = p_request;
  if not found then raise exception 'not_found'; end if;
  select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  return query
    select r.status::text, r.current_revision, (select v.total_cents::bigint from public.price_revisions v where v.id = r.current_revision),
           private.cancel_fee_base(p_request), private.call_out_base(p_request), bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version;
end
$$;

-- 4. T14 -----------------------------------------------------------------------------------------------------------------------------------
-- Sperrreihenfolge: Auftrag (for update), Firma (for share), Journal. S9g-6: status_events.at ist now() (Transaktionsbeginn); gibt es schon ein
-- jüngeres Ereignis, würde das neue Endereignis min(at) und damit den Abrechnungsmonat verschieben: Ablehnung `retry`.
create function public.admin_correct(
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
    -- Storno: aus accepted, in_progress oder completed; Gegenbuchung aller Zeilen, optional eine Gebührenzeile (höchstens die berechnete Basis)
    if r.status not in ('accepted', 'in_progress', 'completed') then raise exception 'invalid_transition'; end if;
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
      set ended_at = now(), ended_reason = case when p_action = 'cancel_partner' then 'cancelled_by_partner' else 'cancelled_by_customer' end::public.assignment_end,
          cancel_reason = case when p_action = 'cancel_partner' then p_cancel_reason end
      where request_id = p_request and (ended_at is null or ended_reason = 'completed');
    perform set_config('app.mv_correct', '', true);
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

-- 5. Liste gemeldeter Aufträge (nur admin mit aal2): Meldung gesetzt, nicht bearbeitet, kein Storno-Status; keine Kontaktdaten ----------------
create function public.admin_reported_jobs()
returns table (request_id uuid, status text, termin_at timestamptz, not_done_reported_at timestamptz, partner_id uuid, partner_name text, total_cents bigint)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.status::text, r.termin_at, r.not_done_reported_at, a.partner_id, p.name, v.total_cents::bigint
  from public.service_requests r
  left join lateral (select x.partner_id from public.assignments x where x.request_id = r.id order by x.accepted_at desc limit 1) a on true
  left join public.partners p on p.id = a.partner_id
  left join public.price_revisions v on v.id = r.current_revision
  where (select private.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2'
    and r.not_done_reported_at is not null and r.not_done_resolved_at is null
    and r.status in ('accepted', 'in_progress', 'completed')
  order by r.not_done_reported_at, r.id
$$;

-- 6. Rechte --------------------------------------------------------------------------------------------------------------------------------
revoke all on function public.admin_correct_basis(uuid, text, uuid),
  public.admin_correct(uuid, text, uuid, text, text, text, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.admin_reported_jobs()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_correct_basis(uuid, text, uuid),
  public.admin_correct(uuid, text, uuid, text, text, text, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int)
  to service_role;
grant execute on function public.admin_reported_jobs() to authenticated;
