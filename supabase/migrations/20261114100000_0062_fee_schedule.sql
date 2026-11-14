-- 0062 Provisionsstaffel (s9p-1, Kennung p1-1411-a): progressive Staffel je Version statt eines flachen Satzes.
-- Version 1 = bisherige 15 % flach (Bestand), Version 2 = 12/10/7 (0 bis 500 EUR / 500,01 bis 1.000 EUR / darüber), gültig ab dem Einspielen.
-- Basis = Preis, den der Kunde zahlt (brutto, Cent). Provision = Summe der Stufenanteile, EINMAL kaufmännisch auf ganze Cent gerundet
-- (Ganzzahlen, half-up wie splitFee). Ein Angebot speichert die Version bei der Abgabe, der Auftrag erbt sie (Journalzeile booking),
-- Nachträge, Stornogebühren und Pauschale nutzen die Version der booking-Zeile. Bereits geschriebene Journalzeilen bleiben unverändert
-- (Version 1 per Spaltenvorgabe). Die Sätze stehen nicht mehr in platform_settings; der Schlüssel fee_rate dort ist ohne Wirkung (OPEN_ISSUES).
-- Jede neu definierte Funktion geht von der neuesten Definition aus (Textdiff in tmp/proof/s9p-1-funktionsdiff.log).

-- 1. Staffel-Tabellen. Nur Migrationen schreiben; Zeilen sind unveränderlich (neue Version statt Änderung).
create table public.fee_schedules (
  version int primary key check (version > 0),
  valid_from date not null,
  label text not null check (length(label) between 1 and 40)
);
create table public.fee_schedule_tiers (
  version int not null references public.fee_schedules (version) on delete restrict,
  tier int not null check (tier > 0),
  up_to_cents bigint check (up_to_cents > 0),
  rate_bp int not null check (rate_bp between 0 and 9999),
  primary key (version, tier)
);
create unique index fee_schedule_one_open_tier on public.fee_schedule_tiers (version) where up_to_cents is null;

create trigger append_only before update or delete on public.fee_schedules for each row execute function private.append_only();
create trigger append_only_truncate before truncate on public.fee_schedules for each statement execute function private.append_only();
create trigger append_only before update or delete on public.fee_schedule_tiers for each row execute function private.append_only();
create trigger append_only_truncate before truncate on public.fee_schedule_tiers for each statement execute function private.append_only();

alter table public.fee_schedules enable row level security;
alter table public.fee_schedule_tiers enable row level security;
revoke all on public.fee_schedules, public.fee_schedule_tiers from anon, authenticated, service_role;
grant select on public.fee_schedules, public.fee_schedule_tiers to authenticated, service_role;
-- kein Schreibrecht für irgendeine API-Rolle (auch nicht service_role): neue Staffeln kommen nur per geprüfter Migration (Fable H1)

-- Lesen: Mitglieder einer Partnerfirma (jeder Status, P2B-Transparenz) und admin, wie 0027. Kunden ohne Firma lesen nichts.
create policy fee_schedules_select on public.fee_schedules for select to authenticated
using ((select private.is_admin()) or (select private.my_member_partner_id()) is not null);
create policy fee_schedule_tiers_select on public.fee_schedule_tiers for select to authenticated
using ((select private.is_admin()) or (select private.my_member_partner_id()) is not null);

insert into public.fee_schedules (version, valid_from, label) values
  (1, date '2026-10-28', 'v1 15 %'),
  (2, (now() at time zone 'Europe/Vienna')::date, 'v2 12/10/7');
insert into public.fee_schedule_tiers (version, tier, up_to_cents, rate_bp) values
  (1, 1, null, 1500),
  (2, 1, 50000, 1200),
  (2, 2, 100000, 1000),
  (2, 3, null, 700);

-- Provision in Cent: Summe (Anteil der Stufe × Satz in Basispunkten), einmal half-up auf ganze Cent (wie splitFee). Fehlt die Version: setting_missing.
create function private.fee_cents(p_version int, p_base bigint) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  t record;
  prev bigint := 0;
  part bigint;
  s bigint := 0;
  open_seen boolean := false;
begin
  if p_base is null or p_base < 0 then raise exception 'amount_mismatch'; end if;
  -- fail closed bei kaputter Stufenmenge: Grenzen steigend, genau eine offene Stufe und zwar die letzte
  for t in select x.up_to_cents, x.rate_bp from public.fee_schedule_tiers x where x.version = p_version order by x.tier loop
    if open_seen then raise exception 'setting_missing'; end if;
    if t.up_to_cents is null then
      part := p_base - prev;
      open_seen := true;
    else
      if t.up_to_cents <= prev then raise exception 'setting_missing'; end if;
      part := least(p_base, t.up_to_cents) - prev;
      prev := t.up_to_cents;
    end if;
    if part > 0 then s := s + part * t.rate_bp; end if;
  end loop;
  if not open_seen then raise exception 'setting_missing'; end if;
  return (2 * s + 10000) / 20000;
end
$$;

-- Stufen einer Version für die Edge Functions: [{"upToCents": 50000, "bp": 1200}, ..., {"upToCents": null, "bp": 700}]
create function private.fee_tiers(p_version int) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object('upToCents', t.up_to_cents, 'bp', t.rate_bp) order by t.tier)
  from public.fee_schedule_tiers t where t.version = p_version
$$;

-- Geltende Version: größtes valid_from <= heute (Wien), bei Gleichstand die höchste Version
create function private.current_fee_schedule() returns int
language sql stable security definer set search_path = ''
as $$
  select s.version from public.fee_schedules s
  where s.valid_from <= (now() at time zone 'Europe/Vienna')::date order by s.valid_from desc, s.version desc limit 1
$$;

drop function private.current_fee();
create function private.current_fee() returns table (fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
  v int := private.current_fee_schedule();
  vr record;
begin
  select s.value, s.version into vr from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
  if v is null or vr.value is null then raise exception 'setting_missing'; end if;
  return query select private.fee_tiers(v), vr.value, v, vr.version;
end
$$;

revoke all on function private.fee_cents(int, bigint), private.fee_tiers(int), private.current_fee_schedule(), private.current_fee() from public, anon, authenticated, service_role;

-- Vorschau „Du erhältst“ für Firmenkonten: der Server rechnet, der Client nie (jeder Firmenstatus, wie das Lesen des Satzes in 0027)
create function public.payout_preview(p_total bigint) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  if (select private.my_member_partner_id()) is null then raise exception 'not_found'; end if;
  if p_total is null or p_total < 0 then raise exception 'invalid_input'; end if;
  return p_total - private.fee_cents(private.current_fee_schedule(), p_total);
end
$$;
revoke all on function public.payout_preview(bigint) from public, anon, authenticated, service_role;
grant execute on function public.payout_preview(bigint) to authenticated;

-- Die View mit dem flachen Satz entfällt (der Client rechnet nichts mehr)
drop view public.current_fee_rates;

-- 2. Spalten: Angebot und Journal tragen die Version. Bestand = Version 1 (Spaltenvorgabe, keine Zeile wird geändert); danach ohne Vorgabe.
alter table public.partner_offers add column fee_schedule_version int not null default 1 references public.fee_schedules (version);
alter table public.partner_offers alter column fee_schedule_version drop default;
alter table public.commission_entries add column fee_schedule_version int not null default 1 references public.fee_schedules (version);
alter table public.commission_entries alter column fee_schedule_version drop default;
-- Verlustfrei nur, wenn jede Bestandszeile 15 % trägt (Fable M1); sonst Abbruch ohne Änderung
do $$
declare n bigint;
begin
  select count(*) into n from public.commission_entries where fee_rate <> 0.15;
  if n > 0 then raise exception 'fee_rate_not_flat: % Journalzeilen mit anderem Satz als 0,15', n; end if;
end
$$;
alter table public.commission_entries drop column fee_rate, drop column fee_rate_version;

-- Angebots-Guard: die Version ist geldrelevant und nach dem Senden unveränderlich (Fable M3); Rumpf wie 0038:36-47
create or replace function private.guard_partner_offer() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'sent' or new.status = 'sent'
     or (new.id, new.request_id, new.partner_id, new.base_revision_id, new.amount_cents, new.valid_until, new.created_at, new.fee_schedule_version)
        is distinct from (old.id, old.request_id, old.partner_id, old.base_revision_id, old.amount_cents, old.valid_until, old.created_at, old.fee_schedule_version) then
    raise exception 'offer_immutable';
  end if;
  return new;
end
$$;

-- Partnerkonten lesen den alten Satz nicht mehr (Fable N3): nur noch die USt.-Rate; die Zeile fee_rate bleibt als Historie (unveränderlich, 0016)
alter policy platform_settings_select on public.platform_settings
using (
  (select private.is_admin())
  or (key = 'fee_vat_rate' and (select private.my_member_partner_id()) is not null)
);

-- 3. Einzige Schreibstelle des Journals: ohne Satz, mit Version. Sperrreihenfolge wie 0030 (Auftrag, Firma, Journalzeile).
drop function private.commission_book(uuid, uuid, uuid, public.commission_kind, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function private.commission_book(
  p_partner uuid, p_request uuid, p_revision uuid, p_kind public.commission_kind, p_reverses uuid,
  p_total bigint, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
  bk public.commission_entries;
  rule public.partner_vat_rule;
  vr numeric := p_fee_vat_rate;
  fsv int := p_fee_schedule_version;
  vrv int := p_fee_vat_rate_version;
  new_id uuid;
begin
  perform 1 from public.service_requests r where r.id = p_request for update;
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
    select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
    if not found then raise exception 'booking_missing'; end if;
    rule := bk.vat_rule;
    if p_kind in ('cancellation', 'correction') then
      vr := coalesce(vr, bk.fee_vat_rate);
      fsv := coalesce(fsv, bk.fee_schedule_version);
      vrv := coalesce(vrv, bk.fee_vat_rate_version);
    end if;
  end if;
  if vr is null or fsv is null or vrv is null then raise exception 'rate_mismatch'; end if;
  insert into public.commission_entries (
    partner_id, request_id, revision_id, kind, reverses_entry_id, total_cents, fee_cents, fee_net_cents, fee_vat_cents, payout_cents,
    fee_vat_rate, vat_rule, price_version, fee_schedule_version, fee_vat_rate_version
  ) values (
    p_partner, p_request, p_revision, p_kind, p_reverses, p_total, p_fee, p_fee_net, p_fee_vat, p_payout,
    vr, rule, (select v.price_version from public.price_revisions v where v.id = p_revision and v.request_id = p_request), fsv, vrv
  ) returning id into new_id;
  return new_id;
end
$$;
revoke all on function private.commission_book(uuid, uuid, uuid, public.commission_kind, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int)
  from public, anon, authenticated, service_role;

-- 4. Einfügeprüfung: Version statt Satz; die Gebühr muss exakt der Staffel der Version entsprechen (vorher: 0,5 Cent Toleranz am flachen Satz)
create or replace function private.guard_commission_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Vienna')::date;
  rq public.service_requests;
  rev public.price_revisions;
  orig public.commission_entries;
  bk public.commission_entries;
  vr numeric; vrv int;
  ev int;
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
    if new.fee_vat_rate <> orig.fee_vat_rate or new.fee_schedule_version <> orig.fee_schedule_version
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
    -- USt.-Satz: genau der geltende (größtes effective_from <= heute Wien, bei Gleichstand höchste Version).
    select s.value, s.version into vr, vrv from public.platform_settings s
    where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
    if vr is distinct from new.fee_vat_rate or vrv is distinct from new.fee_vat_rate_version then
      raise exception 'rate_mismatch';
    end if;
    -- zulässige Version selbst bestimmen (Fable M2): Version des bestätigten Angebots, sonst die geltende
    if rev.source = 'partner_offer' then
      select o.fee_schedule_version into ev from public.partner_offers o
      where o.id = (rev.snapshot ->> 'offerId')::uuid and o.request_id = new.request_id and o.partner_id = new.partner_id and o.status = 'confirmed';
    else
      ev := private.current_fee_schedule();
    end if;
    if ev is distinct from new.fee_schedule_version then raise exception 'rate_mismatch'; end if;
    if new.fee_cents <> private.fee_cents(new.fee_schedule_version, new.total_cents)
       or abs(new.fee_net_cents - new.fee_cents / (1 + new.fee_vat_rate)) > 0.5 then
      raise exception 'amount_mismatch';
    end if;
    return new;
  end if;

  -- change, cancellation_fee: an die booking-Zeile des Auftrags gebunden (Version bleibt eingefroren, Konzept 9.3)
  select * into bk from public.commission_entries e where e.request_id = new.request_id and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if bk.partner_id <> new.partner_id then raise exception 'partner_mismatch'; end if;
  if new.fee_vat_rate <> bk.fee_vat_rate or new.fee_schedule_version <> bk.fee_schedule_version
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
    -- Komponenten: kumulierte Gebühr = Staffel(neuer Gesamtpreis), Netto (0,5 Cent) und Auszahlung
    if js.fee + new.fee_cents <> private.fee_cents(new.fee_schedule_version, rev.total_cents)
       or abs((js.net + new.fee_net_cents) - (js.fee + new.fee_cents) / (1 + new.fee_vat_rate)) > 0.5
       or js.payout + new.payout_cents <> rev.total_cents - (js.fee + new.fee_cents) then
      raise exception 'amount_mismatch';
    end if;
  else
    -- cancellation_fee: erst nach den Gegenbuchungen aller booking-/change-Zeilen, höchstens eine lebende, Betrag > 0 (Konzept 9.4);
    -- Gebühr = Staffel auf die Basis der Stornogebühr bzw. Pauschale allein
    if new.total_cents <= 0 or new.total_cents > rev.total_cents then raise exception 'amount_mismatch'; end if;
    if exists (
      select 1 from public.commission_entries e
      where e.request_id = new.request_id and e.kind in ('booking', 'change', 'cancellation_fee')
        and not exists (select 1 from public.commission_entries r where r.reverses_entry_id = e.id)
    ) then
      raise exception 'amount_mismatch';
    end if;
    if new.fee_cents <> private.fee_cents(new.fee_schedule_version, new.total_cents)
       or abs(new.fee_net_cents - new.fee_cents / (1 + new.fee_vat_rate)) > 0.5 then
      raise exception 'amount_mismatch';
    end if;
  end if;
  return new;
end
$$;

-- 5. Übergangsfunktionen: neueste Definition, Satz durch Version ersetzt

-- cancel_reverse_all: Rumpf wie 20261109180000_0046_cancel_by_partner.sql:272, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function private.cancel_reverse_all(uuid, uuid);
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
    perform private.commission_book(p_partner, p_request, e.revision_id, 'cancellation', e.id, -e.total_cents, null,
      -e.fee_cents, -e.fee_net_cents, -e.fee_vat_cents, -e.payout_cents, null, null);
  end loop;
end
$$;

-- partner_accept_basis: Rumpf wie 20261113110000_0061_accept_basis_cast.sql:4, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.partner_accept_basis(uuid, uuid);
create function public.partner_accept_basis(p_actor uuid, p_listing uuid)
returns table (revision_id uuid, total_cents bigint, fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int)
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
  return query select rev.id, rev.total_cents::bigint, f.fee_tiers, f.fee_vat_rate, f.fee_schedule_version, f.fee_vat_rate_version;
end
$$;

-- partner_accept: Rumpf wie 20261109100000_0038_partner_offers.sql:386, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.partner_accept(uuid, uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function public.partner_accept(
  p_actor uuid, p_listing uuid, p_revision uuid, p_shown_payout bigint,
  p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
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
  f record;
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
  select * into f from private.current_fee();
  if (f.fee_vat_rate, f.fee_schedule_version, f.fee_vat_rate_version)
     is distinct from (p_fee_vat_rate, p_fee_schedule_version, p_fee_vat_rate_version) then
    raise exception 'rate_mismatch';
  end if;
  perform private.check_partner_job_limit(pid);
  insert into public.assignments (request_id, partner_id) values (r.id, pid) returning id into aid;
  update public.job_listings set status = 'accepted', decided_at = now() where id = p_listing;
  perform private.set_request_status(r.id, 'accepted', p_actor, 'partner');
  perform private.commission_book(pid, r.id, p_revision, 'booking', null, rev.total_cents, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_schedule_version, p_fee_vat_rate_version);
  perform private.outbox_put('request_accepted', 'customer', r.customer_id, r.id, 'request_accepted:' || r.id);
  return aid;
end
$$;

-- confirm_offer_basis: Rumpf wie 20261109100000_0038_partner_offers.sql:624, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.confirm_offer_basis(uuid, uuid);
create function public.confirm_offer_basis(p_actor uuid, p_offer uuid)
returns table (amount_cents bigint, fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int)
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
  return query select o.amount_cents::bigint, private.fee_tiers(o.fee_schedule_version), f.fee_vat_rate, o.fee_schedule_version, f.fee_vat_rate_version;
end
$$;

-- confirm_offer: Rumpf wie 20261109110000_0039_s9e_abnahme.sql:87, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.confirm_offer(uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function public.confirm_offer(
  p_actor uuid, p_offer uuid, p_shown_amount bigint,
  p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
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
  if (f.fee_vat_rate, o.fee_schedule_version, f.fee_vat_rate_version)
     is distinct from (p_fee_vat_rate, p_fee_schedule_version, p_fee_vat_rate_version) then
    raise exception 'rate_mismatch';
  end if;
  perform private.check_partner_job_limit(o.partner_id);
  select * into rev1 from public.price_revisions v where v.id = r.current_revision;
  snap := rev1.snapshot || jsonb_build_object(
    'kind', 'price', 'totalCents', o.amount_cents, 'lowCents', o.amount_cents, 'highCents', o.amount_cents,
    'lines', jsonb_build_array(jsonb_build_object('key', 'partner_offer', 'cents', o.amount_cents)), 'offerId', o.id);
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values (r.id, rev1.n + 1, 'partner_offer', rev1.inputs, snap, rev1.price_version, o.amount_cents, o.amount_cents, o.amount_cents)
  returning id into rev2;
  perform set_config('app.mv_transition', r.id::text || ':accepted', true);
  update public.service_requests set current_revision = rev2 where id = r.id;
  perform set_config('app.mv_transition', '', true);
  update public.partner_offers set status = 'expired', end_reason = 'expired', decided_at = now()
  where request_id = r.id and status = 'sent' and id <> o.id and valid_until <= now();
  update public.partner_offers set status = 'superseded', end_reason = 'superseded', decided_at = now() where request_id = r.id and status = 'sent' and id <> o.id;
  update public.partner_offers set status = 'confirmed', end_reason = 'confirmed', decided_at = now() where id = o.id;
  update public.job_listings set status = 'accepted', decided_at = now() where request_id = r.id and partner_id = o.partner_id and status = 'open';
  if not found then raise exception 'invalid_transition'; end if;
  insert into public.assignments (request_id, partner_id) values (r.id, o.partner_id);
  perform private.set_request_status(r.id, 'accepted', p_actor, 'customer');
  perform private.commission_book(o.partner_id, r.id, rev2, 'booking', null, o.amount_cents, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_schedule_version, p_fee_vat_rate_version);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'confirm_offer', 'offer', o.id::text,
    jsonb_build_object('request_id', r.id, 'amount_cents', o.amount_cents, 'revision_id', rev2,
      'snapshot_hash', encode(sha256(convert_to(snap::text, 'utf8')), 'hex')));
  perform private.outbox_put('offer_confirmed', 'partner', o.partner_id, r.id, 'offer_confirmed:' || r.id);
  return 'confirmed';
end
$$;

-- send_offer: Rumpf wie 20261109110000_0039_s9e_abnahme.sql:25, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.send_offer(uuid, int);
create function public.send_offer(p_listing uuid, p_amount int) returns uuid
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
  select * into l from public.job_listings x where x.id = p_listing and x.partner_id = pid;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = l.request_id for update;
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
  where o.request_id = r.id and o.status = 'sent' and o.valid_until <= now();
  if exists (select 1 from public.partner_offers o where o.request_id = r.id and o.partner_id = pid and o.status = 'sent') then
    raise exception 'offer_exists';
  end if;
  select count(*) into n_open from public.partner_offers o where o.request_id = r.id and o.status = 'sent' and o.valid_until > now();
  if n_open >= private.setting_num('offers_open_max') then raise exception 'offer_limit'; end if;
  valid := least(now() + make_interval(hours => private.setting_num('offer_valid_hours')::int), r.termin_at);
  if valid <= now() then raise exception 'expired'; end if;
  insert into public.partner_offers (request_id, partner_id, base_revision_id, amount_cents, valid_until, fee_schedule_version)
  values (r.id, pid, rev.id, p_amount, valid, private.current_fee_schedule()) returning id into oid;
  if r.status = 'awaiting_offer' then
    perform private.set_request_status(r.id, 'offered', uid, 'partner');
  end if;
  perform private.outbox_put('offer_new', 'customer', r.customer_id, r.id, 'offer_new:' || oid);
  return oid;
end
$$;

-- decide_change_basis: Rumpf wie 20261109120000_0040_change_orders.sql:393, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.decide_change_basis(uuid, uuid);
create function public.decide_change_basis(p_actor uuid, p_revision uuid)
returns table (status text, total_cents bigint, fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int,
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
  return query select rev.status, rev.total_cents::bigint, private.fee_tiers(bk.fee_schedule_version), bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version,
                      js.total, js.fee, js.net, js.vat, js.payout;
end
$$;

-- decide_change: Rumpf wie 20261109130000_0041_s9f_abnahme.sql:51, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.decide_change(uuid, uuid, boolean, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function public.decide_change(
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

-- cancel_by_customer_basis: Rumpf wie 20261109180000_0046_cancel_by_partner.sql:293, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.cancel_by_customer_basis(uuid, uuid);
create function public.cancel_by_customer_basis(p_actor uuid, p_request uuid)
returns table (request_status text, revision_id uuid, total_cents bigint, fee_base_cents bigint, fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int)
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
           private.cancel_fee_base(p_request), private.fee_tiers(bk.fee_schedule_version), bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version;
end
$$;

-- cancel_by_customer: Rumpf wie 20261109180000_0046_cancel_by_partner.sql:314, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.cancel_by_customer(uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function public.cancel_by_customer(
  p_actor uuid, p_request uuid, p_fee_base bigint,
  p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
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
  if (p_fee_vat_rate, p_fee_schedule_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;

  perform private.set_request_status(p_request, 'cancelled_by_customer', p_actor, 'customer');
  update public.assignments set ended_at = now(), ended_reason = 'cancelled_by_customer' where request_id = p_request and ended_at is null;
  perform private.cancel_reverse_all(pid, p_request);
  if base > 0 then
    perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, base, p_fee_vat_rate,
      p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_schedule_version, p_fee_vat_rate_version);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'cancel_by_customer', 'service_request', p_request::text, jsonb_build_object('fee_base_cents', base));
  perform private.outbox_put('request_cancelled', 'partner', pid, p_request, 'request_cancelled:' || p_request);
  return 'cancelled_by_customer';
end
$$;

-- cancel_by_partner_basis: Rumpf wie 20261112120000_0059_partner_cancel_preview.sql:56, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.cancel_by_partner_basis(uuid, text, uuid, text);
create function public.cancel_by_partner_basis(p_actor uuid, p_aal text, p_request uuid, p_reason text)
returns table (request_status text, revision_id uuid, total_cents bigint, call_out_cents bigint, fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int)
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
           c, private.fee_tiers(bk.fee_schedule_version), bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version;
end
$$;

-- cancel_by_partner: Rumpf wie 20261112120000_0059_partner_cancel_preview.sql:81, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function public.cancel_by_partner(
  p_actor uuid, p_aal text, p_request uuid, p_reason text, p_photos uuid[], p_fee_base bigint,
  p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
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
  if (p_fee_vat_rate, p_fee_schedule_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;

  perform private.set_request_status(p_request, 'cancelled_by_partner', p_actor, 'partner');
  update public.assignments set ended_at = now(), ended_reason = 'cancelled_by_partner', cancel_reason = p_reason where request_id = p_request and ended_at is null;
  perform private.cancel_reverse_all(pid, p_request);
  if base > 0 then
    perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, base, p_fee_vat_rate,
      p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_schedule_version, p_fee_vat_rate_version);
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

-- admin_correct_basis: Rumpf wie 20261109210000_0049_admin_correct.sql:62, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.admin_correct_basis(uuid, text, uuid);
create function public.admin_correct_basis(p_actor uuid, p_aal text, p_request uuid)
returns table (request_status text, revision_id uuid, total_cents bigint, customer_fee_base_cents bigint, call_out_cents bigint, fee_tiers jsonb, fee_vat_rate numeric, fee_schedule_version int, fee_vat_rate_version int)
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
           private.cancel_fee_base(p_request), private.call_out_base(p_request), private.fee_tiers(bk.fee_schedule_version), bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version;
end
$$;

-- admin_correct: Rumpf wie 20261109220000_0050_s9h3_abnahme.sql:24, geändert nur die Satz-/Versionsstellen (Diff: tmp/proof/s9p-1-funktionsdiff.log)
drop function public.admin_correct(uuid, text, uuid, text, text, text, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int);
create function public.admin_correct(
  p_actor uuid, p_aal text, p_request uuid, p_action text, p_reason text, p_cancel_reason text, p_fee_base bigint,
  p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_schedule_version int, p_fee_vat_rate_version int
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
    perform private.commission_book(pid, p_request, fl.revision_id, 'correction', fl.id, -fl.total_cents, null,
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
      if (p_fee_vat_rate, p_fee_schedule_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_vat_rate, bk.fee_schedule_version, bk.fee_vat_rate_version) then
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
      perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, p_fee_base, p_fee_vat_rate,
        p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_schedule_version, p_fee_vat_rate_version);
    end if;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'admin_correct', 'service_request', p_request::text,
          jsonb_build_object('action', p_action, 'reason', left(btrim(p_reason), 300), 'from_status', r.status, 'fee_base_cents', coalesce(p_fee_base, 0), 'cancel_reason', p_cancel_reason));
  return (select s.status::text from public.service_requests s where s.id = p_request);
end
$$;

-- 6. Journal lesen: Spalte „Staffel“ (Bezeichnung der Version) statt des Satzes. Typ und die drei Funktionen neu (der Typ ändert sich).
drop function public.export_commissions(uuid, date);
drop function public.my_commissions(date);
drop function private.commission_rows(uuid, date);
drop type public.commission_row;

create type public.commission_row as (
  entry_id uuid,
  request_id uuid,
  partner_id uuid,
  partner_name text,
  kind public.commission_kind,
  reverses_entry_id uuid,
  created_at timestamptz,
  total_cents bigint,
  fee_schedule text,
  fee_net_cents bigint,
  fee_vat_cents bigint,
  fee_cents bigint,
  payout_cents bigint,
  vat_rule public.partner_vat_rule,
  request_status public.request_status,
  ended_at timestamptz,
  billing_month date
);

create function private.commission_rows(p_partner uuid, p_month date) returns setof public.commission_row
language sql stable security definer set search_path = ''
as $$
  select c.id, c.request_id, c.partner_id, p.name, c.kind, c.reverses_entry_id, c.created_at,
         c.total_cents, fs.label, c.fee_net_cents, c.fee_vat_cents, c.fee_cents, c.payout_cents,
         c.vat_rule, r.status, d.ended_at, b.m
  from public.commission_entries c
  join public.fee_schedules fs on fs.version = c.fee_schedule_version
  join public.service_requests r on r.id = c.request_id
  join public.partners p on p.id = c.partner_id
  join lateral (
    select min(e.at) as ended_at from public.status_events e
    where e.request_id = c.request_id and e.to_status in ('completed', 'cancelled_by_customer', 'cancelled_by_partner')
  ) d on d.ended_at is not null
  cross join lateral (select date_trunc('month', greatest(d.ended_at, c.created_at) at time zone 'Europe/Vienna')::date as m) b
  where (p_partner is null or c.partner_id = p_partner)
    and (p_month is null or b.m = date_trunc('month', p_month::timestamp)::date)
  order by c.created_at, c.id
$$;

create function public.export_commissions(p_actor uuid, p_month date) returns setof public.commission_row
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  if p_month is null then raise exception 'month_required'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'export_commissions', 'commission_entries', null, jsonb_build_object('month', to_char(p_month, 'YYYY-MM')));
  return query select * from private.commission_rows(null, p_month);
end
$$;

create function public.my_commissions(p_month date default null) returns setof public.commission_row
language plpgsql stable security definer set search_path = ''
as $$
declare
  pid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_member_partner_id();
  if pid is null then raise exception 'not_found'; end if;
  return query select * from private.commission_rows(pid, p_month);
end
$$;

revoke all on function private.commission_rows(uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.my_commissions(date) from public, anon;
grant execute on function public.my_commissions(date) to authenticated;
revoke all on function public.export_commissions(uuid, date) from public, anon, authenticated;
grant execute on function public.export_commissions(uuid, date) to service_role;

-- 7. Rechte (wie bisher: Basis- und Ausführungsfunktionen nur service_role, send_offer authenticated)
revoke all on function private.cancel_reverse_all(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.partner_accept_basis(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.partner_accept_basis(uuid, uuid) to service_role;
revoke all on function public.partner_accept(uuid, uuid, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int) from public, anon, authenticated, service_role;
grant execute on function public.partner_accept(uuid, uuid, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int) to service_role;
revoke all on function public.confirm_offer_basis(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.confirm_offer_basis(uuid, uuid) to service_role;
revoke all on function public.confirm_offer(uuid, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int) from public, anon, authenticated, service_role;
grant execute on function public.confirm_offer(uuid, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int) to service_role;
revoke all on function public.send_offer(uuid, int) from public, anon, authenticated, service_role;
grant execute on function public.send_offer(uuid, int) to authenticated;
revoke all on function public.decide_change_basis(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.decide_change_basis(uuid, uuid) to service_role;
revoke all on function public.decide_change(uuid, uuid, boolean, bigint, numeric, bigint, bigint, bigint, bigint, int, int) from public, anon, authenticated, service_role;
grant execute on function public.decide_change(uuid, uuid, boolean, bigint, numeric, bigint, bigint, bigint, bigint, int, int) to service_role;
revoke all on function public.cancel_by_customer_basis(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_customer_basis(uuid, uuid) to service_role;
revoke all on function public.cancel_by_customer(uuid, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int) from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_customer(uuid, uuid, bigint, numeric, bigint, bigint, bigint, bigint, int, int) to service_role;
revoke all on function public.cancel_by_partner_basis(uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_partner_basis(uuid, text, uuid, text) to service_role;
revoke all on function public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, bigint, bigint, bigint, bigint, int, int) from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_partner(uuid, text, uuid, text, uuid[], bigint, numeric, bigint, bigint, bigint, bigint, int, int) to service_role;
revoke all on function public.admin_correct_basis(uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_correct_basis(uuid, text, uuid) to service_role;
revoke all on function public.admin_correct(uuid, text, uuid, text, text, text, bigint, numeric, bigint, bigint, bigint, bigint, int, int) from public, anon, authenticated, service_role;
grant execute on function public.admin_correct(uuid, text, uuid, text, text, text, bigint, numeric, bigint, bigint, bigint, bigint, int, int) to service_role;
