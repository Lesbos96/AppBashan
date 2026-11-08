-- 0029 Journal schärfen (S9b-4, Abnahme s9b-4-abnahme.md: M1, M2, M3, N1). 0028 bleibt unverändert, dies ist die Korrektur.
-- M1: cancellation_fee nur, wenn alle booking-/change-Zeilen des Auftrags gegengebucht sind, höchstens eine lebende je Auftrag, Betrag > 0 (Konzept 9.4).
-- M2: booking und cancellation_fee: Gebühr und Netto liegen höchstens 0,5 Cent neben dem exakten Wert (Rundungsgrenze, keine zweite Rechnung).
-- M3: Satzparameter sind Pflicht, außer bei cancellation/correction (dort negiert die Funktion nur): sonst rate_mismatch.
-- N1: change ist wie booking nicht negativ (alle Beträge >= 0, Gesamtbetrag > 0).

alter table public.commission_entries drop constraint non_negative_kinds;
alter table public.commission_entries add constraint non_negative_kinds check (
  kind not in ('booking', 'change', 'cancellation_fee')
  or (total_cents >= 0 and fee_cents >= 0 and fee_net_cents >= 0 and fee_vat_cents >= 0 and payout_cents >= 0)
);
alter table public.commission_entries add constraint change_positive check (kind <> 'change' or total_cents > 0);

create or replace function private.guard_commission_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
  rq public.service_requests;
  rev public.price_revisions;
  orig public.commission_entries;
  bk public.commission_entries;
  fr numeric; frv int; vr numeric; vrv int;
  prior bigint;
begin
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found then raise exception 'amount_mismatch'; end if;
  select * into rev from public.price_revisions v where v.id = new.revision_id and v.request_id = new.request_id;
  if not found or new.price_version is distinct from rev.price_version then raise exception 'amount_mismatch'; end if;

  if new.kind in ('cancellation', 'correction') then
    -- ohne Verweis meldet der CHECK reverses_shape den Fehler
    if new.reverses_entry_id is null then return new; end if;
    select * into orig from public.commission_entries e where e.id = new.reverses_entry_id;
    if not found or orig.kind not in ('booking', 'change', 'cancellation_fee') or orig.request_id <> new.request_id
       or orig.revision_id <> new.revision_id then
      raise exception 'amount_mismatch';
    end if;
    if orig.partner_id <> new.partner_id then raise exception 'partner_mismatch'; end if;
    if new.fee_rate <> orig.fee_rate or new.fee_vat_rate <> orig.fee_vat_rate or new.fee_rate_version <> orig.fee_rate_version
       or new.fee_vat_rate_version <> orig.fee_vat_rate_version or new.vat_rule <> orig.vat_rule
       or new.payment_flow <> orig.payment_flow then
      raise exception 'rate_mismatch';
    end if;
    if new.total_cents <> -orig.total_cents or new.fee_cents <> -orig.fee_cents or new.fee_net_cents <> -orig.fee_net_cents
       or new.fee_vat_cents <> -orig.fee_vat_cents or new.payout_cents <> -orig.payout_cents then
      raise exception 'amount_mismatch';
    end if;
    return new;
  end if;

  if new.kind = 'booking' then
    if rev.total_cents is null or new.total_cents <> rev.total_cents or rq.current_revision is distinct from new.revision_id then
      raise exception 'amount_mismatch';
    end if;
    -- geltender Satz: genau der Ausdruck von current_fee_rates (größtes effective_from <= heute Wien, bei Gleichstand höchste Version)
    select s.value, s.version into fr, frv from public.platform_settings s
    where s.key = 'fee_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
    select s.value, s.version into vr, vrv from public.platform_settings s
    where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
    if fr is distinct from new.fee_rate or frv is distinct from new.fee_rate_version
       or vr is distinct from new.fee_vat_rate or vrv is distinct from new.fee_vat_rate_version then
      raise exception 'rate_mismatch';
    end if;
    -- Rundungsgrenze: Gebühr und Netto höchstens 0,5 Cent neben dem exakten Wert (splitFee rundet half-up)
    if abs(new.fee_cents - new.total_cents * new.fee_rate) > 0.5 or abs(new.fee_net_cents - new.fee_cents / (1 + new.fee_vat_rate)) > 0.5 then
      raise exception 'amount_mismatch';
    end if;
    return new;
  end if;

  -- change, cancellation_fee: an die booking-Zeile des Auftrags gebunden (Satz bleibt eingefroren, Konzept 9.3)
  select * into bk from public.commission_entries e where e.request_id = new.request_id and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if bk.partner_id <> new.partner_id then raise exception 'partner_mismatch'; end if;
  if new.fee_rate <> bk.fee_rate or new.fee_vat_rate <> bk.fee_vat_rate or new.fee_rate_version <> bk.fee_rate_version
     or new.fee_vat_rate_version <> bk.fee_vat_rate_version or new.vat_rule <> bk.vat_rule or new.payment_flow <> bk.payment_flow then
    raise exception 'rate_mismatch';
  end if;
  if rq.current_revision is distinct from new.revision_id or rev.total_cents is null then raise exception 'amount_mismatch'; end if;
  if new.kind = 'change' then
    -- nur erhöhend: Betrag = Gesamtpreis der Änderungs-Revision minus alles bisher Gebuchte (booking und change, abzüglich Gegenbuchungen)
    if exists (select 1 from public.commission_entries e where e.reverses_entry_id = bk.id) then raise exception 'booking_missing'; end if;
    if rev.source <> 'change_order' then raise exception 'amount_mismatch'; end if;
    select coalesce(sum(e.total_cents), 0) into prior from public.commission_entries e
    where e.request_id = new.request_id
      and (e.kind in ('booking', 'change')
           or (e.reverses_entry_id is not null
               and exists (select 1 from public.commission_entries o where o.id = e.reverses_entry_id and o.kind in ('booking', 'change'))));
    if new.total_cents <= 0 or new.total_cents <> rev.total_cents - prior then raise exception 'amount_mismatch'; end if;
  else
    -- cancellation_fee: erst nach den Gegenbuchungen aller booking-/change-Zeilen, höchstens eine lebende, Betrag > 0 (Konzept 9.4)
    if new.total_cents <= 0 or new.total_cents > rev.total_cents then raise exception 'amount_mismatch'; end if;
    if exists (
      select 1 from public.commission_entries e
      where e.request_id = new.request_id and e.kind in ('booking', 'change', 'cancellation_fee')
        and not exists (select 1 from public.commission_entries r where r.reverses_entry_id = e.id)
    ) then
      raise exception 'amount_mismatch';
    end if;
    if abs(new.fee_cents - new.total_cents * new.fee_rate) > 0.5 or abs(new.fee_net_cents - new.fee_cents / (1 + new.fee_vat_rate)) > 0.5 then
      raise exception 'amount_mismatch';
    end if;
  end if;
  return new;
end
$$;

create or replace function private.commission_book(
  p_partner uuid, p_request uuid, p_revision uuid, p_kind public.commission_kind, p_reverses uuid,
  p_total bigint, p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
  bk public.commission_entries;
  rule public.partner_vat_rule;
  fr numeric := p_fee_rate;
  vr numeric := p_fee_vat_rate;
  frv int := p_fee_rate_version;
  vrv int := p_fee_vat_rate_version;
  new_id uuid;
begin
  select p.status into st from public.partners p where p.id = p_partner for share;
  if st is null or st in ('pending', 'rejected') or (p_kind = 'booking' and st <> 'active') then
    raise exception 'partner_not_active';
  end if;
  if p_kind = 'booking' then
    select v.rule into rule from public.partner_vat_rules v
    where v.partner_id = p_partner and v.valid_from <= (now() at time zone 'Europe/Vienna')::date
    order by v.valid_from desc limit 1;
    if rule is null then raise exception 'vat_rule_missing'; end if;
  else
    perform 1 from public.service_requests r where r.id = p_request for update;
    select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
    if not found then raise exception 'booking_missing'; end if;
    rule := bk.vat_rule;
    -- Gegenbuchungen negieren nur: fehlende Sätze kommen aus der booking-Zeile. Alle anderen Arten bringen ihren Satz mit,
    -- der Trigger vergleicht ihn mit der booking-Zeile (Konzept 4.5: die Beträge hängen vom Satz ab).
    if p_kind in ('cancellation', 'correction') then
      fr := coalesce(fr, bk.fee_rate);
      vr := coalesce(vr, bk.fee_vat_rate);
      frv := coalesce(frv, bk.fee_rate_version);
      vrv := coalesce(vrv, bk.fee_vat_rate_version);
    end if;
  end if;
  if fr is null or vr is null or frv is null or vrv is null then raise exception 'rate_mismatch'; end if;
  insert into public.commission_entries (
    partner_id, request_id, revision_id, kind, reverses_entry_id, total_cents, fee_cents, fee_net_cents, fee_vat_cents, payout_cents,
    fee_rate, fee_vat_rate, vat_rule, price_version, fee_rate_version, fee_vat_rate_version
  ) values (
    p_partner, p_request, p_revision, p_kind, p_reverses, p_total, p_fee, p_fee_net, p_fee_vat, p_payout,
    fr, vr, rule, (select v.price_version from public.price_revisions v where v.id = p_revision and v.request_id = p_request), frv, vrv
  ) returning id into new_id;
  return new_id;
end
$$;
