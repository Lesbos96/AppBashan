-- S9h-2: Storno durch den Partner (Konzept 4.4 T13, 8.6, 9.4, 10.2, 10.3), Weitervermittlung (T16), Qualitätszähler (10.2),
-- Kundenstorno nur bis Terminbeginn (S9h1-1, Entscheidung Beks 2026-11-09).
-- Art A: Die Edge Function cancel-partner rechnet die Aufteilung der Pauschale mit splitFee und dem Satz der Buchungszeile; die Funktionen
-- prüfen Akteur (aal2, Mitglied, Firma, aktive Zuordnung), Grund, Beleg und Satz. Sperrreihenfolge: Auftrag (for update), dann Firma (for share), dann Journal.
-- Fehler: SQLSTATE P0001, Meldung = Code (not_found, mfa_required, partner_not_active, invalid_transition, reason_required, call_out_not_allowed,
-- receipt_required, amount_mismatch, fee_basis_changed, booking_missing, terms_missing, under_review, too_late_use_report_not_done).

-- 1. Spalten und Constraints ------------------------------------------------------------------------------------------------------------
-- reissued_from: die Folgeanfrage (T16) verweist auf die Quelle; höchstens eine Folgeanfrage je Quelle.
alter table public.service_requests add column reissued_from uuid references public.service_requests (id);
create unique index service_requests_reissued_once on public.service_requests (reissued_from) where reissued_from is not null;

-- Kopierte Revision der Folgeanfrage: immer Quelle submit, n = 1 (die Kette des Nachtrags bleibt an der Quell-Anfrage).
alter table public.price_revisions add column copied_from_revision_id uuid references public.price_revisions (id);
alter table public.price_revisions
  add constraint price_revisions_copy check (copied_from_revision_id is null or (source = 'submit' and n = 1));

-- Grund des Partner-Storno; der Qualitätszähler zählt ended_reason = cancelled_by_partner.
alter table public.assignments add column cancel_reason text;
alter table public.assignments
  add constraint assignments_cancel_reason check (
    (cancel_reason is not null) = coalesce(ended_reason = 'cancelled_by_partner', false)
    and (cancel_reason is null or cancel_reason in ('scope_impossible', 'unavailable', 'other'))
  );

-- Die Folgeanfrage verweist auf dieselben Dateien im Bucket request-photos; die Pipeline erzeugt eigene Kopien (job_photos).
alter table public.request_photos drop constraint request_photos_storage_path_key;
alter table public.request_photos add constraint request_photos_request_path unique (request_id, storage_path);

alter table public.platform_settings
  add constraint platform_settings_s9h check (
    (key <> 'reissue_min_hours' or (value = trunc(value) and value between 1 and 720))
    and (key <> 'partner_cancel_review_count' or (value = trunc(value) and value between 1 and 100))
    and (key <> 'partner_cancel_review_days' or (value = trunc(value) and value between 1 and 365))
  );

-- 2. Statuspaar T13, Mail-Arten ----------------------------------------------------------------------------------------------------------
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

alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed', 'offer_new', 'offer_confirmed', 'offer_withdrawn',
                  'change_proposed', 'change_accepted', 'change_declined', 'change_expired', 'change_withdrawn', 'completion_ask', 'completion_auto',
                  'request_cancelled', 'partner_cancelled', 'request_reissued'));

-- 3. Wächter für die Folgeanfrage (Marker app.mv_reissue = ID der neuen Anfrage, gesetzt nur von private.reissue_request) ----------------
create or replace function private.guard_request_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status not in ('requested', 'awaiting_offer') then
    raise exception 'invalid_transition';
  end if;
  -- reissued_from und cancel_fee_waived = true setzt nur die Weitervermittlung (T16)
  if (new.reissued_from is not null or new.cancel_fee_waived) and current_setting('app.mv_reissue', true) is distinct from new.id::text then
    raise exception 'invalid_transition';
  end if;
  return new;
end
$$;

create or replace function private.guard_photo_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null then
    raise exception 'photo_insert_forbidden';
  end if;
  -- eigener Pfad des Kunden, oder (nur Folgeanfrage T16) eine Datei der Quell-Anfrage
  if not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/')
     and not (rq.reissued_from is not null
              and exists (select 1 from public.request_photos p where p.request_id = rq.reissued_from and p.storage_path = new.storage_path)) then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$$;

-- Revision einfügen: wie 0040, dazu der Kopierzweig der Folgeanfrage (nur mit Marker, Quelle cancelled_by_partner, gleicher Inhalt).
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
    if new.copied_from_revision_id is not null then
      -- T16: Kopie der gültigen Revision der Quell-Anfrage (Betrag, Eingaben, Snapshot, Version identisch), nur nach einem Partner-Storno,
      -- nie von einem Festangebot
      if current_setting('app.mv_reissue', true) is distinct from new.request_id::text or rq.reissued_from is null
         or new.total_cents is null or new.total_cents <= 0
         or not exists (
           select 1 from public.price_revisions o join public.service_requests os on os.id = o.request_id
           where o.id = new.copied_from_revision_id and o.request_id = rq.reissued_from and os.current_revision = o.id
             and os.status = 'cancelled_by_partner' and o.source <> 'partner_offer'
             and (o.inputs, o.snapshot, o.price_version, o.total_cents, o.low_cents, o.high_cents, o.content_hash)
                 is not distinct from (new.inputs, new.snapshot, new.price_version, new.total_cents, new.low_cents, new.high_cents, h)
         ) then
        raise exception 'invalid_revision';
      end if;
    elsif rq.reissued_from is not null then
      raise exception 'invalid_revision';
    end if;
    return new;
  end if;
  if new.copied_from_revision_id is not null then
    raise exception 'invalid_revision';
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

-- 4. Ausschluss: Firmen, die diesen Auftrag (oder eine Quelle der Kette) per Partner-Storno beendet haben, bekommen kein Listing ------------
create function private.reissue_excluded(p_request uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  with recursive chain(id) as (
    select s.reissued_from from public.service_requests s where s.id = p_request and s.reissued_from is not null
    union
    select s.reissued_from from public.service_requests s join chain c on s.id = c.id where s.reissued_from is not null
  )
  select a.partner_id from public.assignments a join chain c on a.request_id = c.id where a.ended_reason = 'cancelled_by_partner'
$$;

revoke all on function private.reissue_excluded(uuid) from public;

create or replace function public.distribute_request(p_request uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  rev public.price_revisions;
  tod smallint;
  n int;
begin
  select * into r from public.service_requests where id = p_request for update;
  if not found or r.status not in ('requested', 'awaiting_offer') then return 0; end if;
  if private.photos_pending(p_request) then return 0; end if;
  if exists (select 1 from public.job_listings l where l.request_id = p_request) then return 0; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.id is null then raise exception 'revision_missing'; end if;
  if r.to_point is not null then
    select d.district into tod from public.geo_districts d where extensions.ST_Covers(d.geom, r.to_point::extensions.geometry) order by d.district limit 1;
  end if;
  with ins as (
    insert into public.job_listings (request_id, partner_id, revision_id, district, to_district, service, inputs, volume_m3, preferred_date, time_window, total_cents, low_cents, high_cents, accept_deadline)
    select r.id, p.id, rev.id, r.district, tod, r.service, rev.inputs, r.volume_m3, r.preferred_date, r.time_window, rev.total_cents, rev.low_cents, rev.high_cents, r.accept_deadline
    from public.partners p
    where p.status = 'active'
      and exists (select 1 from public.partner_categories c where c.partner_id = p.id and c.service::text = r.service::text)
      and exists (select 1 from public.partner_regions g where g.partner_id = p.id and g.district = r.district)
      and not exists (select 1 from public.partner_members m where m.partner_id = p.id and m.user_id = r.customer_id)
      and p.id not in (select private.reissue_excluded(p_request))
    returning id, partner_id
  )
  insert into public.outbox (kind, recipient_kind, recipient_id, request_id, dedupe_key)
  select 'listing_new', 'partner', ins.partner_id, p_request, 'listing_new:' || ins.id from ins;
  get diagnostics n = row_count;
  if n = 0 then
    perform private.set_request_status(p_request, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, p_request, 'request_unmatched:' || p_request);
  end if;
  return n;
end
$$;

-- 5. Gemeinsame Gegenbuchung: jede noch nicht gegengebuchte booking-/change-Zeile als exakte Negation (nie über splitFee) -----------------
create function private.cancel_reverse_all(p_partner uuid, p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e record;
begin
  for e in
    select x.* from public.commission_entries x
    where x.request_id = p_request and x.kind in ('booking', 'change')
      and not exists (select 1 from public.commission_entries c where c.reverses_entry_id = x.id)
    order by x.created_at, x.id
  loop
    perform private.commission_book(p_partner, p_request, e.revision_id, 'cancellation', e.id, -e.total_cents, null, null,
      -e.fee_cents, -e.fee_net_cents, -e.fee_vat_cents, -e.payout_cents, null, null);
  end loop;
end
$$;

revoke all on function private.cancel_reverse_all(uuid, uuid) from public;

-- 6. Kundenstorno nur bis Terminbeginn (S9h1-1): danach nutzt der Kunde „nicht stattgefunden“ (report_not_done) ---------------------------
create or replace function public.cancel_by_customer_basis(p_actor uuid, p_request uuid)
returns table (request_status text, revision_id uuid, total_cents bigint, fee_base_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
begin
  select * into r from public.service_requests s where s.id = p_request;
  if p_actor is null or not found or r.customer_id is distinct from p_actor then raise exception 'not_found'; end if;
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_transition'; end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if now() >= r.termin_at then raise exception 'too_late_use_report_not_done'; end if;
  select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  return query
    select r.status::text, r.current_revision, (select v.total_cents::bigint from public.price_revisions v where v.id = r.current_revision),
           private.cancel_fee_base(p_request), bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version;
end
$$;

create or replace function public.cancel_by_customer(
  p_actor uuid, p_request uuid, p_fee_base bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
  pid uuid;
  base bigint;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request;
  if not found or r.customer_id is distinct from p_actor then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_transition'; end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if now() >= r.termin_at then raise exception 'too_late_use_report_not_done'; end if;
  select a.partner_id into pid from public.assignments a where a.request_id = p_request and a.ended_at is null;
  if pid is null then raise exception 'not_found'; end if;
  perform 1 from public.partners p where p.id = pid for share;
  base := private.cancel_fee_base(p_request);
  if p_fee_base is distinct from base then raise exception 'amount_mismatch'; end if;
  select * into bk from public.commission_entries x where x.request_id = p_request and x.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;

  perform private.set_request_status(p_request, 'cancelled_by_customer', p_actor, 'customer');
  update public.assignments set ended_at = now(), ended_reason = 'cancelled_by_customer' where request_id = p_request and ended_at is null;
  perform private.cancel_reverse_all(pid, p_request);
  if base > 0 then
    perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, base, p_fee_rate, p_fee_vat_rate,
      p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'cancel_by_customer', 'service_request', p_request::text, jsonb_build_object('fee_base_cents', base));
  perform private.outbox_put('request_cancelled', 'partner', pid, p_request, 'request_cancelled:' || p_request);
  return 'cancelled_by_customer';
end
$$;

-- 7. Pauschale (Konzept 10.3): call_out_fee_cents aus dem Snapshot der gültigen Revision, höchstens der Gesamtpreis -----------------------
create function private.call_out_base(p_request uuid) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  rev public.price_revisions;
  c numeric;
begin
  select v.* into rev from public.price_revisions v join public.service_requests s on s.current_revision = v.id where s.id = p_request;
  if rev.total_cents is null or jsonb_typeof(rev.snapshot -> 'terms' -> 'call_out_fee_cents') is distinct from 'number' then
    raise exception 'terms_missing';
  end if;
  c := (rev.snapshot -> 'terms' ->> 'call_out_fee_cents')::numeric;
  if c <> trunc(c) or c < 0 then raise exception 'terms_missing'; end if;
  return least(c::bigint, rev.total_cents::bigint);
end
$$;

revoke all on function private.call_out_base(uuid) from public;

-- 8. T16: Weitervermittlung (nur aus cancel_by_partner, die Quelle ist schon cancelled_by_partner, die Zuordnung beendet) -----------------
-- Bedingungen: Termin mindestens reissue_min_hours entfernt, gültige Revision kein Festangebot, noch keine Folgeanfrage. Die Folgeanfrage
-- kopiert Eingaben, Revision (Betrag, Hash, Version, Stornostufen, Termin unverändert), Kontakt und Fotos; accept_deadline nach 10.1;
-- cancel_fee_waived = true. Die Verteilung läuft sofort (wartet bei Fotos auf die Pipeline); der stornierende Partner ist ausgeschlossen.
create function private.reissue_request(p_source uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  cur public.price_revisions;
  nid uuid := gen_random_uuid();
  rid uuid;
  hrs numeric;
  dl timestamptz;
begin
  select * into r from public.service_requests s where s.id = p_source;
  select * into cur from public.price_revisions v where v.id = r.current_revision;
  if r.termin_at - now() < make_interval(hours => private.setting_num('reissue_min_hours')::int) then return null; end if;
  if cur.source = 'partner_offer' or cur.total_cents is null then return null; end if;
  if exists (select 1 from public.service_requests s where s.reissued_from = p_source) then return null; end if;
  hrs := extract(epoch from r.termin_at - now()) / 3600;
  dl := now() + make_interval(secs => (3600 * greatest(
    private.setting_num('accept_min_hours'),
    least(private.setting_num('accept_max_hours'), private.setting_num('accept_lead_share_percent') / 100 * hrs)
  ))::double precision);

  perform set_config('app.mv_reissue', nid::text, true);
  insert into public.service_requests (id, customer_id, service, status, from_address, from_point, to_address, to_point, route, region,
                                       preferred_date, time_window, description, volume_m3, client_ref, accept_deadline, termin_at, district,
                                       cancel_fee_waived, reissued_from)
  values (nid, r.customer_id, r.service, 'requested', r.from_address, r.from_point, r.to_address, r.to_point, r.route, r.region,
          r.preferred_date, r.time_window, r.description, r.volume_m3, gen_random_uuid(), dl, r.termin_at, r.district, true, p_source);
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents, copied_from_revision_id)
  values (nid, 1, 'submit', cur.inputs, cur.snapshot, cur.price_version, cur.total_cents, cur.low_cents, cur.high_cents, cur.id)
  returning id into rid;
  update public.service_requests set current_revision = rid where id = nid;
  perform set_config('app.mv_reissue', '', true);

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  select nid, c.name, c.phone, c.email, c.stairs_door from public.request_contacts c where c.request_id = p_source;
  perform set_config('app.mv_photo_request', nid::text, true);
  insert into public.request_photos (request_id, storage_path)
  select nid, p.storage_path from public.request_photos p where p.request_id = p_source order by p.created_at, p.id;
  perform set_config('app.mv_photo_request', '', true);

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (null, 'system', 'reissue_request', 'service_request', nid::text, jsonb_build_object('source_request_id', p_source));
  perform public.distribute_request(nid);
  return nid;
end
$$;

revoke all on function private.reissue_request(uuid) from public;

-- 9. T13: Storno durch den Partner --------------------------------------------------------------------------------------------------------
create function public.cancel_by_partner_basis(p_actor uuid, p_aal text, p_request uuid)
returns table (request_status text, revision_id uuid, total_cents bigint, call_out_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
begin
  perform private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  return query
    select r.status::text, r.current_revision, (select v.total_cents::bigint from public.price_revisions v where v.id = r.current_revision),
           private.call_out_base(p_request), bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version;
end
$$;

-- p_photos: Belegfotos der Pauschale (leer oder null = kostenlos). Mit Belegen nur bei scope_impossible nach abgelehntem oder abgelaufenem
-- Nachtrag (10.3); p_fee_base muss der Pauschale entsprechen. Bei scope_impossible entsteht keine Folgeanfrage (T16 Bedingung 3).
create function public.cancel_by_partner(
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
  if p_reason is null or p_reason not in ('scope_impossible', 'unavailable', 'other') then raise exception 'reason_required'; end if;
  if p_photos is not null and cardinality(p_photos) > 0 then
    if p_reason <> 'scope_impossible'
       or not exists (select 1 from public.price_revisions v where v.request_id = p_request and v.source = 'change_order' and v.status in ('declined', 'expired')) then
      raise exception 'call_out_not_allowed';
    end if;
    -- Belege: 1 bis 8 verschiedene Fotos der Art receipt, bereit, von dieser Firma, zu diesem Auftrag
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
  values (p_actor, 'partner', 'cancel_by_partner', 'service_request', p_request::text, jsonb_build_object('reason', p_reason, 'call_out_cents', base));
  if p_reason <> 'scope_impossible' then
    nid := private.reissue_request(p_request);
  end if;
  if nid is not null then
    perform private.outbox_put('request_reissued', 'customer', r.customer_id, nid, 'request_reissued:' || p_request);
  else
    perform private.outbox_put('partner_cancelled', 'customer', r.customer_id, p_request, 'partner_cancelled:' || p_request);
  end if;
  return 'cancelled_by_partner';
end
$$;

-- 10. Qualitätszähler (Konzept 10.2): nur admin; Partner-Stornos im Zeitraum, Prüfung ab der Schwelle; ohne Benachrichtigung -------------
create function public.partner_quality()
returns table (partner_id uuid, cancels bigint, last_cancel_at timestamptz, needs_review boolean)
language sql stable security definer set search_path = ''
as $$
  select a.partner_id, count(*), max(a.ended_at), count(*) >= private.setting_num('partner_cancel_review_count')
  from public.assignments a
  where (select private.is_admin()) and a.ended_reason = 'cancelled_by_partner'
    and a.ended_at > now() - make_interval(days => private.setting_num('partner_cancel_review_days')::int)
  group by a.partner_id
$$;

-- 11. Rechte --------------------------------------------------------------------------------------------------------------------------------
revoke all on function public.cancel_by_partner_basis(uuid, text, uuid),
  public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.partner_quality()
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_partner_basis(uuid, text, uuid),
  public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int)
  to service_role;
grant execute on function public.partner_quality() to authenticated;
