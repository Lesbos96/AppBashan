-- s9i-7b: Storno durch die Firma mit Vorschau (Planprüfung des Beraters: docs/proof/s9i-7b/s9i-7b-fable-plan.md).
-- M1: Grundlage und Storno teilen sich dieselben Prüfungen (Meldung, Grund, Zeitgrenze, Berechtigung der Pauschale); die Grundlage kennt jetzt den Grund.
-- M4: Die Pauschale gibt es nur, wenn der letzte nicht zurückgezogene Nachtrag (höchstes n) abgelehnt oder abgelaufen ist; ein offener Nachtrag sperrt.
-- Kunde: my_cancel_info zeigt nur den Betrag der Pauschale (nie die Gebühr). Wirkung von cancel_by_partner sonst unverändert (0048:41-73).

-- 1. Berechtigung der Pauschale (nur private; NULL-sicher: Grund NULL gibt false)
create function private.call_out_eligible(p_request uuid, p_reason text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_reason is not distinct from 'scope_impossible'
    and coalesce((select v.status in ('declined', 'expired') from public.price_revisions v
                  where v.request_id = p_request and v.source = 'change_order' and v.status <> 'withdrawn'
                  order by v.n desc limit 1), false)
$$;

revoke all on function private.call_out_eligible(uuid, text) from public;

-- 2. Meldung „nicht stattgefunden“, Grund, Zeitgrenze (Reihenfolge wie 0048)
create function private.partner_cancel_check(p_request uuid, p_reason text) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.service_requests;
begin
  select * into r from public.service_requests s where s.id = p_request;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if p_reason is null or p_reason not in ('scope_impossible', 'unavailable', 'other') then raise exception 'reason_required'; end if;
  if r.termin_at is not null and now() >= r.termin_at and p_reason <> 'scope_impossible' then raise exception 'too_late_for_reason'; end if;
end
$$;

revoke all on function private.partner_cancel_check(uuid, text) from public;

-- 3. Pauschale des echten Aufrufs: ohne Belege 0; mit Belegen nur bei Berechtigung und gültigen Belegen
create function private.partner_cancel_fee(p_partner uuid, p_request uuid, p_reason text, p_photos uuid[]) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_photos is null or cardinality(p_photos) = 0 then return 0; end if;
  if private.call_out_eligible(p_request, p_reason) is not true then raise exception 'call_out_not_allowed'; end if;
  if cardinality(p_photos) > 8
     or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos)
     or (select count(*) from public.job_photos j
         where j.id = any (p_photos) and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = p_partner and j.request_id = p_request) <> cardinality(p_photos) then
    raise exception 'receipt_required';
  end if;
  return private.call_out_base(p_request);
end
$$;

revoke all on function private.partner_cancel_fee(uuid, uuid, text, uuid[]) from public;

-- 4. Grundlage für die Edge Function (Vorschau und echter Aufruf): mit Grund; call_out_cents nur bei Berechtigung, sonst 0
drop function public.cancel_by_partner_basis(uuid, text, uuid);

create function public.cancel_by_partner_basis(p_actor uuid, p_aal text, p_request uuid, p_reason text)
returns table (request_status text, revision_id uuid, total_cents bigint, call_out_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
  c bigint := 0;
begin
  perform private.change_gate(p_actor, p_aal, p_request);
  perform private.partner_cancel_check(p_request, p_reason);
  select * into r from public.service_requests s where s.id = p_request;
  select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if private.call_out_eligible(p_request, p_reason) is true then c := private.call_out_base(p_request); end if;
  return query
    select r.status::text, r.current_revision, (select v.total_cents::bigint from public.price_revisions v where v.id = r.current_revision),
           c, bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version;
end
$$;

revoke all on function public.cancel_by_partner_basis(uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_partner_basis(uuid, text, uuid, text) to service_role;

-- 5. Storno: Prüfungen über die gemeinsamen Funktionen, sonst Zeile für Zeile wie 0048
create or replace function public.cancel_by_partner(
  p_actor uuid, p_aal text, p_request uuid, p_reason text, p_photos uuid[], p_fee_base bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  r public.service_requests;
  bk public.commission_entries;
  base bigint;
  nid uuid;
begin
  pid := private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  perform private.partner_cancel_check(p_request, p_reason);
  base := private.partner_cancel_fee(pid, p_request, p_reason, p_photos);
  if p_fee_base is distinct from base then raise exception 'amount_mismatch'; end if;
  select * into bk from public.commission_entries x where x.request_id = p_request and x.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;

  perform private.set_request_status(p_request, 'cancelled_by_partner', p_actor, 'partner');
  update public.assignments set ended_at = now(), ended_reason = 'cancelled_by_partner', cancel_reason = p_reason where request_id = p_request and ended_at is null;
  perform private.cancel_reverse_all(pid, p_request);
  if base > 0 then
    perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, base, p_fee_rate, p_fee_vat_rate,
      p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'partner', 'cancel_by_partner', 'service_request', p_request::text,
          jsonb_build_object('reason', p_reason, 'call_out_cents', base, 'photos', to_jsonb(coalesce(p_photos, array[]::uuid[]))));
  -- S9h2-2: nur eine fällige Pauschale (Belege) unterdrückt die Weitervermittlung
  if base = 0 then
    nid := private.reissue_request(p_request);
    -- sofort unmatched: nur die Absage melden (die Mail request_unmatched der Folgeanfrage steht schon in der Outbox)
    if nid is not null and (select s.status from public.service_requests s where s.id = nid) = 'unmatched' then nid := null; end if;
  end if;
  if nid is not null then
    perform private.outbox_put('request_reissued', 'customer', r.customer_id, nid, 'request_reissued:' || p_request);
  elsif base > 0 then
    perform private.outbox_put('partner_cancelled_fee', 'customer', r.customer_id, p_request, 'partner_cancelled:' || p_request);
  else
    perform private.outbox_put('partner_cancelled', 'customer', r.customer_id, p_request, 'partner_cancelled:' || p_request);
  end if;
  return 'cancelled_by_partner';
end
$$;

revoke all on function public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int)
  to service_role;

-- 6. Kunde: die Pauschale der Firmen-Absage in Cent (Summe der Zeile `cancellation_fee` und ihrer Gegenbuchungen, z. B. nach admin-correct negate_fee).
-- Nur der Kunde der Anfrage, nur bei cancelled_by_partner. Keine Gebühr, keine Zeilen des Journals. Die Folgeanfrage liest der Kunde über `reissued_from`.
create function public.my_cancel_info(p_request uuid) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not exists (select 1 from public.service_requests s where s.id = p_request and s.customer_id = uid and s.status = 'cancelled_by_partner') then
    raise exception 'not_found';
  end if;
  return coalesce((select sum(e.total_cents) from public.commission_entries e
                   where e.request_id = p_request
                     and (e.kind = 'cancellation_fee'
                          or e.reverses_entry_id in (select f.id from public.commission_entries f where f.request_id = p_request and f.kind = 'cancellation_fee'))), 0)::bigint;
end
$$;

revoke all on function public.my_cancel_info(uuid) from public, anon;
grant execute on function public.my_cancel_info(uuid) to authenticated;
