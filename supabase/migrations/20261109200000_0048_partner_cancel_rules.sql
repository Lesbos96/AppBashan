-- S9h-3 (Entscheidungen Beks zu S9h2-2 und S9h2-3, 2026-11-09):
-- S9h2-2: `scope_impossible` ohne Belegfotos löst trotzdem die Weitervermittlung (T16) aus: für den Kunden kostenlos, keine Pauschale für die Firma,
--         der Storno zählt im Qualitätszähler (`ended_reason` bleibt `cancelled_by_partner`). Mit Pauschale (Belege) bleibt es ohne Folgeanfrage.
-- S9h2-3: Ab `termin_at` ist der Storno der Firma nur noch mit einem Grund möglich, der erst vor Ort entsteht (`scope_impossible`); die Gründe
--         `unavailable` und `other` scheitern mit `too_late_for_reason`. Es gibt keinen Grund „Kunde nicht angetroffen“ (er wäre ein neuer Wert in
--         assignments_cancel_reason); die Meldung des Kunden „nicht stattgefunden“ und T14 (0049) decken den Fall ab.
-- Prüfreihenfolge: under_review, Grund gültig, Zeitgrenze, Belege, Betrag, Satz.

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
  base bigint := 0;
  nid uuid;
begin
  pid := private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if p_reason is null or p_reason not in ('scope_impossible', 'unavailable', 'other') then raise exception 'reason_required'; end if;
  if r.termin_at is not null and now() >= r.termin_at and p_reason <> 'scope_impossible' then raise exception 'too_late_for_reason'; end if;
  if p_photos is not null and cardinality(p_photos) > 0 then
    if p_reason <> 'scope_impossible'
       or not exists (select 1 from public.price_revisions v where v.request_id = p_request and v.source = 'change_order' and v.status in ('declined', 'expired')) then
      raise exception 'call_out_not_allowed';
    end if;
    if cardinality(p_photos) > 8
       or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos)
       or (select count(*) from public.job_photos j
           where j.id = any (p_photos) and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = pid and j.request_id = p_request) <> cardinality(p_photos) then
      raise exception 'receipt_required';
    end if;
    base := private.call_out_base(p_request);
  end if;
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
