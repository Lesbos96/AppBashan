-- S9f: Nachtrag (Konzept 4.2, 4.4 N1-N3, 5.4, 5.6, 8.7, 9.3).
-- Ein Nachtrag ist eine Zeile in price_revisions (source = change_order) mit Status proposed → accepted/declined/expired/withdrawn.
-- Schreibwege: propose_change (N1), decide_change (N2), withdraw_change und expire_changes/close_changes (N3). Der Betrag kommt aus der
-- Edge Function (Preismodul mit gebuchter Version, Art A); die Datenbank prüft Quelle, Festpreis, erhöhend, Belege, Marker, Journal.

-- 1. Spalten, Checks, Index ---------------------------------------------------------------------------------------------------------
alter table public.price_revisions
  add column status text,
  add column valid_until timestamptz,
  add column base_revision_id uuid,
  add column proposed_by uuid references public.partners (id),
  add column decided_by uuid,
  add column decided_at timestamptz,
  add column photos uuid[];

alter table public.price_revisions
  add constraint price_revisions_base foreign key (base_revision_id, request_id) references public.price_revisions (id, request_id),
  add constraint price_revisions_change_cols check (
    (source = 'change_order') = (status is not null and valid_until is not null and base_revision_id is not null and proposed_by is not null and photos is not null)
    and (source = 'change_order' or (status is null and valid_until is null and base_revision_id is null and proposed_by is null and decided_by is null and decided_at is null and photos is null))
    and (status is null or status in ('proposed', 'accepted', 'declined', 'expired', 'withdrawn'))
    and ((status = 'proposed') = (decided_at is null) or status is null)
    and (photos is null or cardinality(photos) between 1 and 8)
  );

-- höchstens ein offener Nachtrag je Auftrag; höchstens eine Journalzeile `change` je Nachtrag
create unique index price_revisions_one_open_change on public.price_revisions (request_id) where status = 'proposed';
create unique index commission_change_once on public.commission_entries (revision_id) where kind = 'change';

-- Outbox: neue Arten (Mails ohne Gebühr, Texte in handlers.ts)
alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed', 'offer_new', 'offer_confirmed', 'offer_withdrawn',
                  'change_proposed', 'change_accepted', 'change_declined', 'change_expired', 'change_withdrawn'));

-- 2. Revision: Einfügen nur über propose_change (Marker), Ändern nur der Entscheidungsspalten über die Funktionen ---------------------
create or replace function private.guard_revision_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare
  rq public.service_requests;
  cur public.price_revisions;
  h text;
  oid text;
begin
  if new.source not in ('submit', 'partner_offer', 'change_order') or (new.source = 'submit' and new.n <> 1) then
    raise exception 'invalid_revision';
  end if;
  -- Snapshot und Betragsspalten müssen übereinstimmen: ein Abbildungsfehler zeigt dem Kunden sonst einen Betrag, den die Revision nicht hält.
  if new.snapshot ->> 'kind' = 'offer' then
    if new.source = 'partner_offer' or new.total_cents is not null or new.low_cents is not null or new.high_cents is not null then
      raise exception 'invalid_revision';
    end if;
  elsif new.snapshot ->> 'kind' = 'price' then
    if (new.snapshot ->> 'lowCents')::int is distinct from new.low_cents
       or (new.snapshot ->> 'highCents')::int is distinct from new.high_cents
       or (new.snapshot ? 'totalCents') <> (new.total_cents is not null)
       or (new.total_cents is not null and (new.snapshot ->> 'totalCents')::int <> new.total_cents) then
      raise exception 'invalid_revision';
    end if;
  else
    raise exception 'invalid_revision';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found then
    raise exception 'invalid_revision';
  end if;
  if new.source = 'submit' then
    if rq.current_revision is not null then
      raise exception 'invalid_revision';
    end if;
    if rq.status is distinct from (case when new.total_cents is not null then 'requested' else 'awaiting_offer' end)::public.request_status then
      raise exception 'status_mismatch';
    end if;
    select v.content_hash into h from public.price_versions v where v.version = new.price_version and v.published;
    if h is null then
      raise exception 'version_unpublished';
    end if;
    new.content_hash := h;
    return new;
  end if;
  select * into cur from public.price_revisions v where v.id = rq.current_revision;
  if new.source = 'change_order' then
    -- Nachtrag: nur aus propose_change (Marker), nur erhöhend auf einem Festpreis, nie auf einem Festangebot; Version, Hash und Bedingungen
    -- übernimmt der Trigger aus der Basis, der Snapshot trägt nie eine Gebühr.
    if current_setting('app.mv_change', true) is distinct from new.request_id::text || ':propose'
       or rq.status not in ('accepted', 'in_progress') or not found
       or new.status is distinct from 'proposed' or new.valid_until is null or new.valid_until <= now()
       or new.proposed_by is null or new.base_revision_id is distinct from rq.current_revision
       or cur.source not in ('submit', 'change_order') or cur.total_cents is null or cur.low_cents is distinct from cur.high_cents
       or new.n is distinct from (select max(v.n) + 1 from public.price_revisions v where v.request_id = new.request_id)
       or new.total_cents is null or new.total_cents <= cur.total_cents or new.low_cents <> new.total_cents or new.high_cents <> new.total_cents
       or new.snapshot -> 'terms' is distinct from cur.snapshot -> 'terms'
       or exists (select 1 from jsonb_object_keys(new.snapshot) k where k ~* 'fee|commission|payout')
       or jsonb_typeof(new.inputs) is distinct from 'object'
       or not exists (select 1 from public.assignments a where a.request_id = new.request_id and a.partner_id = new.proposed_by and a.ended_at is null) then
      raise exception 'invalid_revision';
    end if;
    new.price_version := cur.price_version;
    new.content_hash := cur.content_hash;
    return new;
  end if;
  -- partner_offer
  oid := new.snapshot ->> 'offerId';
  if rq.status <> 'offered' or not found or cur.n <> 1 or cur.source <> 'submit' or new.n <> cur.n + 1
     or oid is null or oid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or new.total_cents is null or new.low_cents <> new.total_cents or new.high_cents <> new.total_cents
     or (cur.low_cents is not null and new.total_cents not between cur.low_cents and cur.high_cents)
     or not exists (
       select 1 from public.partner_offers o
       where o.id = oid::uuid and o.request_id = new.request_id and o.status = 'sent' and o.valid_until > now() and o.amount_cents = new.total_cents
     ) then
    raise exception 'invalid_revision';
  end if;
  new.inputs := cur.inputs;
  new.price_version := cur.price_version;
  new.content_hash := cur.content_hash;
  return new;
end
$$;

-- Ändern: nur proposed → accepted/declined/expired/withdrawn, nur status, decided_by, decided_at, nur mit Marker der Funktionen.
-- Löschen (nur als Kaskade der Anfrage) und TRUNCATE bleiben gesperrt.
create function private.guard_revision_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.source <> 'change_order' or old.status is distinct from 'proposed'
     or new.status is null or new.status not in ('accepted', 'declined', 'expired', 'withdrawn') or new.decided_at is null
     or current_setting('app.mv_change', true) is distinct from old.id::text || ':' || new.status
     or (to_jsonb(new) - array['status', 'decided_by', 'decided_at']) is distinct from (to_jsonb(old) - array['status', 'decided_by', 'decided_at']) then
    raise exception 'revision_immutable';
  end if;
  return new;
end
$$;

revoke all on function private.guard_revision_update() from public;

drop trigger revision_immutable on public.price_revisions;
create trigger revision_immutable before delete on public.price_revisions
for each row execute function private.immutable_row('revision_immutable');
create trigger revision_guard_update before update on public.price_revisions
for each row execute function private.guard_revision_update();

-- 3. Zeiger: zusätzlich der Wechsel auf einen angenommenen Nachtrag (n größer, Basis = bisherige Revision, Marker) -------------------------
create or replace function private.guard_request_pointer() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.current_revision is not distinct from old.current_revision then
    return new;
  end if;
  if new.current_revision is null then
    raise exception 'invalid_revision_pointer';
  end if;
  if old.current_revision is null then
    if not exists (
      select 1 from public.price_revisions v
      where v.id = new.current_revision and v.request_id = new.id and v.n = 1 and v.source = 'submit'
    ) then
      raise exception 'invalid_revision_pointer';
    end if;
    return new;
  end if;
  if old.status = 'offered'
     and current_setting('app.mv_transition', true) is not distinct from new.id::text || ':accepted'
     and exists (
       select 1 from public.price_revisions v join public.price_revisions o on o.id = old.current_revision
       where v.id = new.current_revision and v.request_id = new.id and v.source = 'partner_offer' and v.n = o.n + 1
     ) then
    return new;
  end if;
  -- Nachtrag: abgelehnte Nachträge belegen ein n, deshalb gilt n > bisheriges n; die Kette sichert base_revision_id.
  if old.status in ('accepted', 'in_progress') and new.status = old.status
     and current_setting('app.mv_change', true) is not distinct from new.current_revision::text || ':pointer'
     and exists (
       select 1 from public.price_revisions v join public.price_revisions o on o.id = old.current_revision
       where v.id = new.current_revision and v.request_id = new.id and v.source = 'change_order' and v.status = 'accepted'
         and v.base_revision_id = o.id and v.n > o.n
     ) then
    return new;
  end if;
  raise exception 'invalid_revision_pointer';
end
$$;

-- 4. Journal: Summen und Komponentenprüfung für `change` -------------------------------------------------------------------------------
-- Summe aller lebenden booking-/change-Zeilen eines Auftrags (mit ihren Gegenbuchungen), je Betragsspalte.
create function private.journal_sums(p_request uuid) returns table (total bigint, fee bigint, net bigint, vat bigint, payout bigint)
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(e.total_cents), 0)::bigint, coalesce(sum(e.fee_cents), 0)::bigint, coalesce(sum(e.fee_net_cents), 0)::bigint,
         coalesce(sum(e.fee_vat_cents), 0)::bigint, coalesce(sum(e.payout_cents), 0)::bigint
  from public.commission_entries e
  where e.request_id = p_request
    and (e.kind in ('booking', 'change')
         or (e.reverses_entry_id is not null
             and exists (select 1 from public.commission_entries o where o.id = e.reverses_entry_id and o.kind in ('booking', 'change'))))
$$;

revoke all on function private.journal_sums(uuid) from public;

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
  js record;
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
    select * into js from private.journal_sums(new.request_id);
    if new.total_cents <= 0 or new.total_cents <> rev.total_cents - js.total then raise exception 'amount_mismatch'; end if;
    -- Komponenten: kumulierte Gebühr, Netto und Auszahlung entsprechen splitFee(neuer Gesamtpreis) (Rundungsgrenze 0,5 Cent)
    if abs((js.fee + new.fee_cents) - rev.total_cents * new.fee_rate) > 0.5
       or abs((js.net + new.fee_net_cents) - (js.fee + new.fee_cents) / (1 + new.fee_vat_rate)) > 0.5
       or js.payout + new.payout_cents <> rev.total_cents - (js.fee + new.fee_cents) then
      raise exception 'amount_mismatch';
    end if;
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

-- 5. Zugang des Partners (Art A: nur service_role; Akteur und aal stammen aus dem geprüften Token der Edge Function) ---------------------
-- Sperrreihenfolge: Auftrag (for update), dann Firma (for share).
create function private.change_gate(p_actor uuid, p_aal text, p_request uuid) returns uuid
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
  return pid;
end
$$;

revoke all on function private.change_gate(uuid, text, uuid) from public;

-- Grundlage für die Edge Function: gültige Revision mit Eingaben und gespeicherter Route (nur wer vorschlagen darf).
create function public.propose_change_basis(p_actor uuid, p_aal text, p_request uuid)
returns table (revision_id uuid, source text, inputs jsonb, price_version int, total_cents bigint, low_cents bigint, high_cents bigint, service text, route jsonb)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.change_gate(p_actor, p_aal, p_request);
  return query
    select v.id, v.source, v.inputs, v.price_version, v.total_cents::bigint, v.low_cents::bigint, v.high_cents::bigint, s.service::text, s.route
    from public.service_requests s join public.price_revisions v on v.id = s.current_revision
    where s.id = p_request;
end
$$;

-- N1: Nachtrag vorschlagen. p_total ist der neue Gesamtpreis aus dem Preismodul (gebuchter Preis + Modul(neu) − Modul(alt)); die Datenbank
-- prüft nur, was sie prüfen kann: Quelle, Festpreis, erhöhend, Belege, offener Nachtrag. Fehler: siehe Gate und die Codes unten.
create function public.propose_change(p_actor uuid, p_aal text, p_request uuid, p_base uuid, p_inputs jsonb, p_total bigint, p_photos uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  r public.service_requests;
  cur public.price_revisions;
  hrs numeric;
  snap jsonb;
  rid uuid;
begin
  pid := private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  select * into cur from public.price_revisions v where v.id = r.current_revision;
  if p_base is distinct from cur.id then raise exception 'revision_changed'; end if;
  if cur.source = 'partner_offer' then raise exception 'change_not_allowed'; end if;
  if cur.total_cents is null or cur.low_cents is distinct from cur.high_cents then raise exception 'not_fixed_price'; end if;
  if exists (select 1 from public.price_revisions v where v.request_id = r.id and v.status = 'proposed') then raise exception 'change_open'; end if;
  if p_total is null or p_total <= cur.total_cents then raise exception 'change_not_increasing'; end if;
  if p_inputs is null or jsonb_typeof(p_inputs) is distinct from 'object' then raise exception 'invalid_input'; end if;
  -- Belege: 1 bis 8 verschiedene Fotos der Art receipt, bereit, von dieser Firma, zu diesem Auftrag
  if p_photos is null or cardinality(p_photos) not between 1 and 8
     or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos)
     or (select count(*) from public.job_photos j
         where j.id = any (p_photos) and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = pid and j.request_id = r.id) <> cardinality(p_photos) then
    raise exception 'receipt_required';
  end if;
  hrs := private.setting_num('change_valid_hours');
  snap := cur.snapshot || jsonb_build_object(
    'kind', 'price', 'totalCents', p_total, 'lowCents', p_total, 'highCents', p_total,
    'lines', jsonb_build_array(jsonb_build_object('key', 'booked', 'cents', cur.total_cents), jsonb_build_object('key', 'change_order', 'cents', p_total - cur.total_cents)),
    'changeOf', cur.id);
  perform set_config('app.mv_change', r.id::text || ':propose', true);
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents, status, valid_until, base_revision_id, proposed_by, photos)
  values (r.id, (select max(v.n) + 1 from public.price_revisions v where v.request_id = r.id), 'change_order', p_inputs, snap, cur.price_version,
          p_total, p_total, p_total, 'proposed', now() + hrs * interval '1 hour', cur.id, pid, p_photos)
  returning id into rid;
  perform set_config('app.mv_change', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'partner', 'propose_change', 'revision', rid::text, jsonb_build_object('request_id', r.id, 'total_cents', p_total, 'base_revision_id', cur.id));
  perform private.outbox_put('change_proposed', 'customer', r.customer_id, r.id, 'change_proposed:' || rid);
  return rid;
end
$$;

-- 6. Entscheidung des Kunden (Art A) --------------------------------------------------------------------------------------------------
-- Grundlage: Betrag, Satz der Buchungszeile und Summen des Journals; nur für den Kunden des Auftrags.
create function public.decide_change_basis(p_actor uuid, p_revision uuid)
returns table (status text, total_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int,
               prior_total bigint, prior_fee bigint, prior_net bigint, prior_vat bigint, prior_payout bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  rev public.price_revisions;
  bk public.commission_entries;
  js record;
begin
  select * into rev from public.price_revisions v where v.id = p_revision and v.source = 'change_order';
  if not found or not exists (select 1 from public.service_requests s where s.id = rev.request_id and s.customer_id = p_actor) then
    raise exception 'not_found';
  end if;
  select * into bk from public.commission_entries e where e.request_id = rev.request_id and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  select * into js from private.journal_sums(rev.request_id);
  return query select rev.status, rev.total_cents::bigint, bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version,
                      js.total, js.fee, js.net, js.vat, js.payout;
end
$$;

-- N2: Ergebnis 'accepted' oder 'declined' (auch bei Wiederholung derselben Entscheidung) oder 'partner_not_active' (der Nachtrag ist dann
-- zurückgezogen, nichts gebucht). Fehler: not_found, change_not_valid, invalid_transition, shown_total_mismatch, fee_basis_changed,
-- revision_changed, amount_mismatch, rate_mismatch. Sperrreihenfolge: Auftrag, Firma, Revision.
create function public.decide_change(
  p_actor uuid, p_revision uuid, p_accept boolean, p_shown_total bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
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

  if pst is null or pst not in ('active', 'payment_hold') then
    -- wie T5: nicht committen als Fehler, sondern den Nachtrag zurückziehen (Akteur system) und das Ergebnis melden
    perform set_config('app.mv_change', rev.id::text || ':withdrawn', true);
    update public.price_revisions set status = 'withdrawn', decided_at = now() where id = rev.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_withdrawn', 'customer', r.customer_id, r.id, 'change_withdrawn:' || rev.id);
    return 'partner_not_active';
  end if;
  if p_shown_total is distinct from rev.total_cents then raise exception 'shown_total_mismatch'; end if;
  select * into bk from public.commission_entries e where e.request_id = r.id and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;
  if rev.base_revision_id is distinct from r.current_revision then raise exception 'revision_changed'; end if;
  select * into js from private.journal_sums(r.id);
  perform set_config('app.mv_change', rev.id::text || ':accepted', true);
  update public.price_revisions set status = 'accepted', decided_by = p_actor, decided_at = now() where id = rev.id;
  perform set_config('app.mv_change', rev.id::text || ':pointer', true);
  update public.service_requests set current_revision = rev.id where id = r.id;
  perform set_config('app.mv_change', '', true);
  perform private.commission_book(rev.proposed_by, r.id, rev.id, 'change', null, rev.total_cents - js.total, p_fee_rate, p_fee_vat_rate,
    p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'decide_change', 'revision', rev.id::text,
    jsonb_build_object('request_id', r.id, 'total_cents', rev.total_cents, 'snapshot_hash', encode(sha256(convert_to(rev.snapshot::text, 'utf8')), 'hex')));
  perform private.outbox_put('change_accepted', 'partner', rev.proposed_by, r.id, 'change_accepted:' || rev.id);
  return 'accepted';
end
$$;

-- 7. N3: Rückzug (Partner), Ablauf (Cron), Auftragsende --------------------------------------------------------------------------------
create function public.withdraw_change(p_revision uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  rev public.price_revisions;
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_member_partner_id();
  select * into rev from public.price_revisions v where v.id = p_revision and v.source = 'change_order' and v.proposed_by = pid;
  if pid is null or not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = rev.request_id for update;
  select * into rev from public.price_revisions v where v.id = p_revision for update;
  if rev.status <> 'proposed' then raise exception 'invalid_transition'; end if;
  perform set_config('app.mv_change', rev.id::text || ':withdrawn', true);
  update public.price_revisions set status = 'withdrawn', decided_by = uid, decided_at = now() where id = rev.id;
  perform set_config('app.mv_change', '', true);
  perform private.outbox_put('change_withdrawn', 'customer', r.customer_id, r.id, 'change_withdrawn:' || rev.id);
end
$$;

create function public.expire_changes() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  n int := 0;
begin
  for v in
    select p.id, p.proposed_by, p.request_id from public.price_revisions p join public.service_requests s on s.id = p.request_id
    where p.status = 'proposed' and p.valid_until <= now()
    order by s.id for update of s skip locked
  loop
    begin
      perform set_config('app.mv_change', v.id::text || ':expired', true);
      update public.price_revisions set status = 'expired', decided_at = now() where id = v.id and status = 'proposed';
      perform set_config('app.mv_change', '', true);
      perform private.outbox_put('change_expired', 'partner', v.proposed_by, v.request_id, 'change_expired:' || v.id);
      n := n + 1;
    exception when others then
      raise warning 'expire_changes_failed % %', v.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;

-- Verlässt ein Auftrag accepted/in_progress, endet ein offener Nachtrag (der Aufrufer hält die Sperre auf den Auftrag).
create function private.close_changes() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
begin
  for v in select p.id, p.proposed_by from public.price_revisions p where p.request_id = new.id and p.status = 'proposed' loop
    perform set_config('app.mv_change', v.id::text || ':expired', true);
    update public.price_revisions set status = 'expired', decided_at = now() where id = v.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_expired', 'partner', v.proposed_by, new.id, 'change_expired:' || v.id);
  end loop;
  return null;
end
$$;

revoke all on function private.close_changes() from public;

create trigger close_changes after update of status on public.service_requests
for each row when (old.status in ('accepted', 'in_progress') and new.status not in ('accepted', 'in_progress'))
execute function private.close_changes();

select cron.schedule('expire-changes', '* * * * *', 'select public.expire_changes()');

-- 8. Rechte -----------------------------------------------------------------------------------------------------------------------------
revoke all on function public.propose_change_basis(uuid, text, uuid), public.propose_change(uuid, text, uuid, uuid, jsonb, bigint, uuid[]),
  public.decide_change_basis(uuid, uuid),
  public.decide_change(uuid, uuid, boolean, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.withdraw_change(uuid), public.expire_changes()
  from public, anon, authenticated, service_role;
grant execute on function public.propose_change_basis(uuid, text, uuid), public.propose_change(uuid, text, uuid, uuid, jsonb, bigint, uuid[]),
  public.decide_change_basis(uuid, uuid),
  public.decide_change(uuid, uuid, boolean, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.expire_changes()
  to service_role;
grant execute on function public.withdraw_change(uuid) to authenticated;
