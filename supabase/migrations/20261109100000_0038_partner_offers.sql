-- S9e: Festangebot (Konzept 4.3, 5.7, 8.2). partner_offers, send_offer/withdraw_offer/reject_offers (Art B), confirm_offer (Art A, Edge Function
-- offer-confirm), T4b/T7 (expire_offers, settle_offers), Ziel-Bezirk im Listing (S9c-1), Zuständigkeit aus dem Auftrag (S9c-12),
-- Sperre/Limit-Reihenfolge (S9c-10), admin_set_partner_status schließt Listings und Angebote (S9c-2).
-- Sperrreihenfolge überall: Auftrag (for update) → Firma (for share) → Advisory-Lock des Limits → Journal.

-- 1. Einstellungen: Grenzen, fehlender Wert bricht ab (setting_num) ---------------------------------------------------------------
alter table public.platform_settings
  add constraint platform_settings_s9e check (
    (key <> 'offer_valid_hours' or (value = trunc(value) and value between 1 and 168))
    and (key <> 'offers_open_max' or (value = trunc(value) and value between 1 and 10))
    and (key <> 'offer_max_cents' or (value = trunc(value) and value between 1 and 100000000))
  );

-- 2. Tabelle ---------------------------------------------------------------------------------------------------------------------
create type public.partner_offer_status as enum ('sent', 'confirmed', 'rejected', 'superseded', 'expired', 'withdrawn');

create table public.partner_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete restrict,
  base_revision_id uuid not null references public.price_revisions (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  status public.partner_offer_status not null default 'sent',
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  end_reason text check (end_reason in ('confirmed', 'superseded', 'customer_rejected', 'customer_withdrawn', 'expired', 'partner_withdrawn', 'partner_not_active', 'partner_status')),
  constraint partner_offers_decided check ((status = 'sent') = (decided_at is null))
);

create unique index partner_offers_one_sent on public.partner_offers (request_id, partner_id) where status = 'sent';
create index partner_offers_partner_idx on public.partner_offers (partner_id, status);
create index partner_offers_request_idx on public.partner_offers (request_id, status);

-- Nach dem Senden nur der Übergang aus `sent` (Status, decided_at, end_reason); alles andere unveränderlich, auch für den Eigentümer.
create function private.guard_partner_offer() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'sent' or new.status = 'sent'
     or (new.id, new.request_id, new.partner_id, new.base_revision_id, new.amount_cents, new.valid_until, new.created_at)
        is distinct from (old.id, old.request_id, old.partner_id, old.base_revision_id, old.amount_cents, old.valid_until, old.created_at) then
    raise exception 'offer_immutable';
  end if;
  return new;
end
$$;

revoke all on function private.guard_partner_offer() from public;

create trigger guard_partner_offer before update on public.partner_offers
for each row execute function private.guard_partner_offer();
create trigger offer_delete_guard before delete on public.partner_offers
for each row execute function private.immutable_row('offer_immutable');
create trigger offer_delete_guard_truncate before truncate on public.partner_offers
for each statement execute function private.immutable_row('offer_immutable');

-- Rechte: kein DML für Konten (auch nicht service_role); Lesen: die Firma (aal2) und admin. Der Kunde liest nur über my_request_offers.
alter table public.partner_offers enable row level security;
revoke all on public.partner_offers from anon, authenticated, service_role;
grant select on public.partner_offers to authenticated, service_role;

create policy partner_offers_select on public.partner_offers for select to authenticated
using (partner_id = (select private.my_member_partner_id()) or (select private.is_admin()));

-- Outbox: neue Arten (Mails ohne Gebühr, Texte in handlers.ts)
alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed', 'offer_new', 'offer_confirmed', 'offer_withdrawn'));

-- 3. Statuspaare, Zeiger, Revision --------------------------------------------------------------------------------------------------
-- Neu: T4 awaiting_offer → offered, T4b offered → awaiting_offer, T5 offered → accepted, T6 offered → declined, T7 offered → expired.
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
    or (old.status in ('accepted', 'in_progress') and new.status = 'completed')
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

-- Zeiger: erstes Setzen auf Revision 1; danach nur der Wechsel auf die Angebots-Revision (n + 1) bei offered → accepted mit Marker.
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
  raise exception 'invalid_revision_pointer';
end
$$;

-- Revision: submit (n = 1) wie bisher; partner_offer nur aus einem gültigen Angebot der Anfrage (Betrag, Spanne), Eingaben, Preisversion
-- und Hash übernimmt der Trigger aus der aktuellen Revision (nie vom Aufrufer).
create or replace function private.guard_revision_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare
  rq public.service_requests;
  cur public.price_revisions;
  h text;
  oid text;
begin
  if new.source not in ('submit', 'partner_offer') or (new.source = 'submit' and new.n <> 1) then
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
  -- partner_offer
  select * into cur from public.price_revisions v where v.id = rq.current_revision;
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

-- Verlässt ein Auftrag die offenen Zustände, schließen sich seine gesendeten Angebote (accepted: Rest superseded, declined/withdrawn: rejected).
create function private.close_offers() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.partner_offers o set
    status = (case new.status when 'accepted' then 'superseded' when 'declined' then 'rejected' when 'withdrawn' then 'rejected' else 'expired' end)::public.partner_offer_status,
    end_reason = case new.status when 'accepted' then 'superseded' when 'declined' then 'customer_rejected' when 'withdrawn' then 'customer_withdrawn' else 'expired' end,
    decided_at = now()
  where o.request_id = new.id and o.status = 'sent';
  return null;
end
$$;

revoke all on function private.close_offers() from public;

create trigger close_offers after update of status on public.service_requests
for each row when (old.status is distinct from new.status and new.status not in ('requested', 'awaiting_offer', 'offered'))
execute function private.close_offers();

-- 4. Helfer ------------------------------------------------------------------------------------------------------------------------
-- Zuständigkeit aus dem Auftrag (S9c-12), nicht aus der Listing-Kopie.
create function private.in_scope_request(p_partner uuid, p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select private.in_scope(p_partner, r.service, r.district) from public.service_requests r where r.id = p_request), false)
$$;

revoke all on function private.in_scope_request(uuid, uuid) from public;
grant execute on function private.in_scope_request(uuid, uuid) to authenticated;

drop policy job_listings_select on public.job_listings;
create policy job_listings_select on public.job_listings for select to authenticated
using (
  (status = 'open' and accept_deadline > now() and partner_id = (select private.my_partner_id()) and (select private.in_scope_request(partner_id, request_id)))
  or (status = 'accepted' and partner_id = (select private.my_job_partner_id()) and (select private.assignment_access(request_id, partner_id)))
  or (select private.is_admin())
);

-- „Lebendes“ Listing: offen, Frist läuft, Firma aktiv und zuständig (T8).
create function private.request_has_live_listing(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.job_listings l join public.partners p on p.id = l.partner_id
    where l.request_id = p_request and l.status = 'open' and l.accept_deadline > now() and p.status = 'active'
      and private.in_scope_request(l.partner_id, l.request_id)
  )
$$;

-- Limit offener Aufträge (S9c-10): eine Stelle für partner_accept und confirm_offer. VOLATILE: die Zählung nach dem Lock sieht Commits.
create function private.check_partner_job_limit(p_partner uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  open_n bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('partner_jobs:' || p_partner::text, 0));
  select count(*) into open_n from public.assignments a join public.service_requests s on s.id = a.request_id
  where a.partner_id = p_partner and a.ended_at is null and s.status in ('accepted', 'in_progress');
  if open_n >= private.setting_num('partner_open_jobs_max') then raise exception 'partner_job_limit'; end if;
end
$$;

-- Geltender Gebührensatz mit Versionen (fehlt einer: setting_missing, nie 0).
create function private.current_fee() returns table (fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
  fr record;
  vr record;
begin
  select s.value, s.version into fr from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
  select s.value, s.version into vr from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
  if fr.value is null or vr.value is null then raise exception 'setting_missing'; end if;
  return query select fr.value, vr.value, fr.version, vr.version;
end
$$;

revoke all on function private.request_has_live_listing(uuid), private.check_partner_job_limit(uuid), private.current_fee() from public;

-- T4b/T7/T8 nach einer Änderung an den Angeboten oder Listings. Der Aufrufer hält die Sperre auf den Auftrag.
-- Abgelaufene Angebote → expired. Bleibt kein gültiges Angebot: offered → expired (Frist vorbei) bzw. → awaiting_offer (T4b);
-- danach T8, wenn kein lebendes Listing bleibt (die Anfrage hat Listings, sonst verteilt noch niemand).
create function private.settle_offers(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  st public.request_status;
begin
  select * into r from public.service_requests s where s.id = p_request;
  if not found then return; end if;
  update public.partner_offers o set status = 'expired', end_reason = 'expired', decided_at = now()
  where o.request_id = p_request and o.status = 'sent' and o.valid_until <= now();
  if exists (select 1 from public.partner_offers o where o.request_id = p_request and o.status = 'sent') then return; end if;
  st := r.status;
  if st = 'offered' then
    if r.accept_deadline <= now() then
      perform private.set_request_status(p_request, 'expired', null, 'system');
      perform private.outbox_put('request_expired', 'customer', r.customer_id, p_request, 'request_expired:' || p_request);
      return;
    end if;
    perform private.set_request_status(p_request, 'awaiting_offer', null, 'system');
    st := 'awaiting_offer';
  end if;
  if st in ('requested', 'awaiting_offer') and r.accept_deadline > now()
     and exists (select 1 from public.job_listings l where l.request_id = p_request)
     and not private.request_has_live_listing(p_request) then
    perform private.set_request_status(p_request, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, p_request, 'request_unmatched:' || p_request);
  end if;
end
$$;

revoke all on function private.settle_offers(uuid) from public;

-- 5. Ziel-Bezirk im Listing (S9c-1): aus dem geprüften Zielpunkt und den Bezirksgrenzen, NULL außerhalb Wiens oder ohne Ziel -----------
alter table public.job_listings add column to_district smallint check (to_district between 1 and 23);
grant select (to_district) on public.job_listings to authenticated;

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

-- 6. Annahme (S9c-10, S9c-12 K7): gemeinsame Limit-Prüfung; die Basis prüft Listing, Frist und Zuständigkeit -----------------------------
create or replace function public.partner_accept_basis(p_actor uuid, p_listing uuid)
returns table (revision_id uuid, total_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  rev public.price_revisions;
  f record;
begin
  select * into l from public.job_listings x where x.id = p_listing;
  if not found or not exists (select 1 from public.partner_members m where m.user_id = p_actor and m.partner_id = l.partner_id) then
    raise exception 'not_found';
  end if;
  select * into r from public.service_requests s where s.id = l.request_id;
  if r.status in ('awaiting_offer', 'offered') then raise exception 'offer_required'; end if;
  if l.status = 'declined' then raise exception 'listing_declined'; end if;
  if l.status <> 'open' then raise exception 'already_taken'; end if;
  if r.accept_deadline <= now() then raise exception 'expired'; end if;
  if not private.in_scope(l.partner_id, r.service, r.district) then raise exception 'not_responsible'; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.total_cents is null then raise exception 'price_not_fixed'; end if;
  select * into f from private.current_fee();
  return query select rev.id, rev.total_cents, f.fee_rate, f.fee_vat_rate, f.fee_rate_version, f.fee_vat_rate_version;
end
$$;

create or replace function public.partner_accept(
  p_actor uuid, p_listing uuid, p_revision uuid, p_shown_payout bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  rev public.price_revisions;
  pid uuid;
  pst public.partner_status;
  lst public.listing_status;
  aid uuid;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  select * into l from public.job_listings x where x.id = p_listing;
  if not found then raise exception 'not_found'; end if;
  select m.partner_id into pid from public.partner_members m where m.user_id = p_actor;
  if pid is distinct from l.partner_id then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = l.request_id for update;
  select p.status into pst from public.partners p where p.id = pid for share;
  if pst is distinct from 'active' then raise exception 'partner_not_active'; end if;
  if not private.in_scope(pid, r.service, r.district) then raise exception 'not_responsible'; end if;
  if r.status in ('awaiting_offer', 'offered') then raise exception 'offer_required'; end if;
  if r.status = 'expired' then raise exception 'expired'; end if;
  if r.status in ('accepted', 'in_progress', 'completed', 'cancelled_by_customer', 'cancelled_by_partner') then raise exception 'already_taken'; end if;
  if r.status <> 'requested' then raise exception 'request_closed'; end if;
  if r.accept_deadline <= now() then raise exception 'expired'; end if;
  select x.status into lst from public.job_listings x where x.id = p_listing for update;
  if lst = 'declined' then raise exception 'listing_declined'; end if;
  if lst <> 'open' then raise exception 'already_taken'; end if;
  if r.current_revision is distinct from p_revision then raise exception 'revision_changed'; end if;
  select * into rev from public.price_revisions v where v.id = p_revision and v.request_id = r.id;
  if rev.total_cents is null then raise exception 'price_not_fixed'; end if;
  if p_shown_payout is distinct from p_payout then raise exception 'payout_changed'; end if;
  perform private.check_partner_job_limit(pid);
  insert into public.assignments (request_id, partner_id) values (r.id, pid) returning id into aid;
  update public.job_listings set status = 'accepted', decided_at = now() where id = p_listing;
  perform private.set_request_status(r.id, 'accepted', p_actor, 'partner');
  perform private.commission_book(pid, r.id, p_revision, 'booking', null, rev.total_cents, p_fee_rate, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  perform private.outbox_put('request_accepted', 'customer', r.customer_id, r.id, 'request_accepted:' || r.id);
  return aid;
end
$$;

-- Ablehnen: ein Partner mit gesendetem Angebot zieht es zuerst zurück (offer_exists); T8 zählt nur lebende Listings (S9c-12 K6).
create or replace function public.decline_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  l public.job_listings;
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  select * into l from public.job_listings x where x.id = p_listing and x.partner_id = pid;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = l.request_id for update;
  select * into l from public.job_listings x where x.id = p_listing for update;
  if l.status <> 'open' then raise exception 'invalid_transition'; end if;
  if exists (select 1 from public.partner_offers o where o.request_id = r.id and o.partner_id = pid and o.status = 'sent') then
    raise exception 'offer_exists';
  end if;
  update public.job_listings set status = 'declined', decided_at = now() where id = p_listing;
  if r.status in ('requested', 'awaiting_offer') and r.accept_deadline > now() and not private.request_has_live_listing(r.id) then
    perform private.set_request_status(r.id, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, r.id, 'request_unmatched:' || r.id);
  end if;
end
$$;

-- 7. admin_set_partner_status (S9c-2, S9c-10): erst die betroffenen Aufträge (nach ID), dann die Firma; bei Nicht-active Listings
-- schließen, gesendete Angebote zurückziehen (Outbox an den Kunden), T4b/T7/T8 anwenden. -----------------------------------------------
create or replace function public.admin_set_partner_status(p_actor uuid, p_partner uuid, p_status public.partner_status, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
  reqs uuid[];
  q uuid;
  o record;
begin
  perform private.assert_admin(p_actor);
  if not exists (select 1 from public.partners where id = p_partner) then raise exception 'not_found'; end if;
  select array_agg(x.request_id order by x.request_id) into reqs from (
    select l.request_id from public.job_listings l where l.partner_id = p_partner and l.status = 'open'
    union
    select f.request_id from public.partner_offers f where f.partner_id = p_partner and f.status = 'sent'
  ) x;
  perform 1 from public.service_requests s where s.id = any (coalesce(reqs, '{}')) order by s.id for update;
  select status into st from public.partners where id = p_partner for update;
  if not found then raise exception 'not_found'; end if;
  perform private.assert_not_member(p_actor, p_partner);
  if not private.partner_transition_ok(st, p_status) or (st = 'pending' and p_status = 'active') then
    raise exception 'invalid_transition';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 10 then raise exception 'reason_required'; end if;
  perform set_config('app.mv_partner_status', p_partner::text || ':' || st::text || '>' || p_status::text, true);
  update public.partners set status = p_status, status_reason = btrim(p_reason) where id = p_partner and status = st;
  perform set_config('app.mv_partner_status', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'set_partner_status', 'partner', p_partner::text,
    jsonb_build_object('from', st, 'to', p_status, 'reason', btrim(p_reason)));
  if p_status <> 'active' then
    update public.job_listings set status = 'closed', decided_at = now() where partner_id = p_partner and status = 'open';
    for o in
      select f.id, f.request_id, s.customer_id from public.partner_offers f join public.service_requests s on s.id = f.request_id
      where f.partner_id = p_partner and f.status = 'sent'
    loop
      update public.partner_offers set status = 'withdrawn', end_reason = 'partner_status', decided_at = now() where id = o.id;
      perform private.outbox_put('offer_withdrawn', 'customer', o.customer_id, o.request_id, 'offer_withdrawn:' || o.id);
    end loop;
    foreach q in array coalesce(reqs, '{}') loop
      perform private.settle_offers(q);
    end loop;
  end if;
end
$$;

-- 8. Festangebot senden, zurückziehen, ablehnen, lesen (Art B) -----------------------------------------------------------------------
create function public.send_offer(p_request uuid, p_amount int) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  pst public.partner_status;
  r public.service_requests;
  l public.job_listings;
  rev public.price_revisions;
  n_open bigint;
  valid timestamptz;
  oid uuid;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount_out_of_range'; end if;
  select * into l from public.job_listings x where x.request_id = p_request and x.partner_id = pid;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  select p.status into pst from public.partners p where p.id = pid for share;
  if pst is distinct from 'active' then raise exception 'partner_not_active'; end if;
  if not private.in_scope(pid, r.service, r.district) then raise exception 'not_responsible'; end if;
  if r.status not in ('awaiting_offer', 'offered') then raise exception 'invalid_transition'; end if;
  if r.accept_deadline <= now() then raise exception 'expired'; end if;
  select * into l from public.job_listings x where x.id = l.id for update;
  if l.status = 'declined' then raise exception 'listing_declined'; end if;
  if l.status <> 'open' then raise exception 'invalid_transition'; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.low_cents is not null then
    if p_amount not between rev.low_cents and rev.high_cents then raise exception 'amount_out_of_range'; end if;
  elsif p_amount > private.setting_num('offer_max_cents') then
    raise exception 'amount_out_of_range';
  end if;
  if not exists (select 1 from public.partner_vat_rules v where v.partner_id = pid and v.valid_from <= (now() at time zone 'Europe/Vienna')::date) then
    raise exception 'vat_rule_missing';
  end if;
  update public.partner_offers o set status = 'expired', end_reason = 'expired', decided_at = now()
  where o.request_id = p_request and o.partner_id = pid and o.status = 'sent' and o.valid_until <= now();
  if exists (select 1 from public.partner_offers o where o.request_id = p_request and o.partner_id = pid and o.status = 'sent') then
    raise exception 'offer_exists';
  end if;
  select count(*) into n_open from public.partner_offers o where o.request_id = p_request and o.status = 'sent' and o.valid_until > now();
  if n_open >= private.setting_num('offers_open_max') then raise exception 'offer_limit'; end if;
  valid := least(now() + make_interval(hours => private.setting_num('offer_valid_hours')::int), r.termin_at);
  if valid <= now() then raise exception 'expired'; end if;
  insert into public.partner_offers (request_id, partner_id, base_revision_id, amount_cents, valid_until)
  values (p_request, pid, rev.id, p_amount, valid) returning id into oid;
  if r.status = 'awaiting_offer' then
    perform private.set_request_status(p_request, 'offered', uid, 'partner');
  end if;
  perform private.outbox_put('offer_new', 'customer', r.customer_id, p_request, 'offer_new:' || oid);
  return oid;
end
$$;

create function public.withdraw_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  o public.partner_offers;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_member_partner_id();
  select * into o from public.partner_offers x where x.id = p_offer and x.partner_id = pid;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.service_requests s where s.id = o.request_id for update;
  select * into o from public.partner_offers x where x.id = p_offer for update;
  if o.status <> 'sent' then raise exception 'invalid_transition'; end if;
  update public.partner_offers set status = 'withdrawn', end_reason = 'partner_withdrawn', decided_at = now() where id = p_offer;
  perform private.settle_offers(o.request_id);
end
$$;

create function public.reject_offers(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if r.status <> 'offered' then raise exception 'invalid_transition'; end if;
  update public.partner_offers set status = 'rejected', end_reason = 'customer_rejected', decided_at = now() where request_id = p_request and status = 'sent';
  perform private.set_request_status(p_request, 'declined', uid, 'customer');
end
$$;

-- Der Kunde sieht Betrag, Frist und Firmenname; nie Partner-ID, Kontakt, Gebühr oder Auszahlung.
create function public.my_request_offers(p_request uuid)
returns table (offer_id uuid, amount_cents int, valid_until timestamptz, status public.partner_offer_status, company_name text)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.amount_cents, o.valid_until, o.status, p.name
  from public.partner_offers o
  join public.service_requests r on r.id = o.request_id
  join public.partners p on p.id = o.partner_id
  where o.request_id = p_request and r.customer_id = (select auth.uid())
    and ((o.status = 'sent' and o.valid_until > now()) or o.status = 'confirmed')
  order by o.amount_cents, o.created_at
$$;

-- 9. Bestätigung (Art A): Basis und Ausführung für service_role; p_actor ist der Kunde aus dem geprüften JWT -----------------------------
create function public.confirm_offer_basis(p_actor uuid, p_offer uuid)
returns table (amount_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  o public.partner_offers;
  f record;
begin
  select * into o from public.partner_offers x where x.id = p_offer;
  if not found or not exists (select 1 from public.service_requests s where s.id = o.request_id and s.customer_id = p_actor) then
    raise exception 'not_found';
  end if;
  select * into f from private.current_fee();
  return query select o.amount_cents::bigint, f.fee_rate, f.fee_vat_rate, f.fee_rate_version, f.fee_vat_rate_version;
end
$$;

-- Ergebnis: 'confirmed' (auch bei Wiederholung) oder 'partner_not_active' (Angebot wurde zurückgezogen, Kunde wählt ein anderes).
-- Fehler: not_found, offer_not_valid, invalid_transition, amount_mismatch, rate_mismatch, partner_job_limit, vat_rule_missing.
create function public.confirm_offer(
  p_actor uuid, p_offer uuid, p_shown_amount bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  o public.partner_offers;
  r public.service_requests;
  rev1 public.price_revisions;
  f record;
  pst public.partner_status;
  rev2 uuid;
  snap jsonb;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  select * into o from public.partner_offers x where x.id = p_offer;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = o.request_id;
  if r.customer_id is distinct from p_actor then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = o.request_id for update;
  select * into o from public.partner_offers x where x.id = p_offer for update;
  if o.status = 'confirmed' then return 'confirmed'; end if;
  if o.status <> 'sent' or o.valid_until <= now() then raise exception 'offer_not_valid'; end if;
  if r.status <> 'offered' then raise exception 'invalid_transition'; end if;
  select p.status into pst from public.partners p where p.id = o.partner_id for share;
  if pst is distinct from 'active' or not private.in_scope(o.partner_id, r.service, r.district) then
    update public.partner_offers set status = 'withdrawn', end_reason = 'partner_not_active', decided_at = now() where id = o.id;
    perform private.outbox_put('offer_withdrawn', 'customer', r.customer_id, r.id, 'offer_withdrawn:' || o.id);
    perform private.settle_offers(r.id);
    return 'partner_not_active';
  end if;
  if o.amount_cents is distinct from p_shown_amount then raise exception 'amount_mismatch'; end if;
  select * into f from private.current_fee();
  if (f.fee_rate, f.fee_vat_rate, f.fee_rate_version, f.fee_vat_rate_version)
     is distinct from (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version) then
    raise exception 'rate_mismatch';
  end if;
  perform private.check_partner_job_limit(o.partner_id);
  select * into rev1 from public.price_revisions v where v.id = r.current_revision;
  -- Kopie der Revision 1 (Stornostufen, Bedingungen) mit dem Angebotsbetrag; nie eine Gebühr im Snapshot.
  snap := rev1.snapshot || jsonb_build_object(
    'kind', 'price', 'totalCents', o.amount_cents, 'lowCents', o.amount_cents, 'highCents', o.amount_cents,
    'lines', jsonb_build_array(jsonb_build_object('key', 'partner_offer', 'cents', o.amount_cents)), 'offerId', o.id);
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, rev1.n + 1, 'partner_offer', rev1.inputs, snap, rev1.price_version, o.amount_cents, o.amount_cents, o.amount_cents)
  returning id into rev2;
  perform set_config('app.mv_transition', r.id::text || ':accepted', true);
  update public.service_requests set current_revision = rev2 where id = r.id;
  perform set_config('app.mv_transition', '', true);
  update public.partner_offers set status = 'superseded', end_reason = 'superseded', decided_at = now() where request_id = r.id and status = 'sent' and id <> o.id;
  update public.partner_offers set status = 'confirmed', end_reason = 'confirmed', decided_at = now() where id = o.id;
  update public.job_listings set status = 'accepted', decided_at = now() where request_id = r.id and partner_id = o.partner_id and status = 'open';
  insert into public.assignments (request_id, partner_id) values (r.id, o.partner_id);
  perform private.set_request_status(r.id, 'accepted', p_actor, 'customer');
  perform private.commission_book(o.partner_id, r.id, rev2, 'booking', null, o.amount_cents, p_fee_rate, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'confirm_offer', 'offer', o.id::text,
    jsonb_build_object('request_id', r.id, 'amount_cents', o.amount_cents, 'revision_id', rev2,
      'snapshot_hash', encode(sha256(convert_to(snap::text, 'utf8')), 'hex')));
  perform private.outbox_put('offer_confirmed', 'partner', o.partner_id, r.id, 'offer_confirmed:' || r.id);
  return 'confirmed';
end
$$;

-- 10. Ablauf (T4b, T7): Cron jede Minute ----------------------------------------------------------------------------------------------
create function public.expire_offers() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id from public.service_requests s
    where s.status = 'offered'
      and (exists (select 1 from public.partner_offers o where o.request_id = s.id and o.status = 'sent' and o.valid_until <= now())
           or not exists (select 1 from public.partner_offers o where o.request_id = s.id and o.status = 'sent'))
    order by s.id for update skip locked
  loop
    begin
      perform private.settle_offers(r.id);
      n := n + 1;
    exception when others then
      raise warning 'expire_offers_failed % %', r.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;

select cron.schedule('expire-offers', '* * * * *', 'select public.expire_offers()');

-- 11. Rechte --------------------------------------------------------------------------------------------------------------------------
revoke all on function
  public.send_offer(uuid, int), public.withdraw_offer(uuid), public.reject_offers(uuid), public.my_request_offers(uuid),
  public.confirm_offer_basis(uuid, uuid),
  public.confirm_offer(uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.expire_offers()
from public, anon, authenticated, service_role;
grant execute on function public.send_offer(uuid, int), public.withdraw_offer(uuid), public.reject_offers(uuid), public.my_request_offers(uuid) to authenticated;
grant execute on function
  public.confirm_offer_basis(uuid, uuid),
  public.confirm_offer(uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.expire_offers()
to service_role;
