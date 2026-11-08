-- 0028 Provisionsjournal (S9b-4, docs/S9b_PLAN.md Abschnitt 7, docs/S9_KONZEPT.md 5.8, 9.2–9.6).
-- commission_entries: nur anfügen, auch gegen service_role und Eigentümer-Trigger-Pfade; geschrieben wird nur über
-- private.commission_book (kein Grant an irgendeine Rolle, ab S9c rufen es die Übergangsfunktionen). fee_splits entfällt.
-- Fehler: SQLSTATE P0001, Meldung = Code (partner_not_active, vat_rule_missing, booking_missing, amount_mismatch, rate_mismatch,
-- partner_mismatch, append_only); Prüfregeln als CHECK/Unique melden 23514/23505.
-- Die Gebühr rechnet die Edge Function mit splitFee (@pricing); die Datenbank prüft Identitäten, Sätze, Versionen, Revision und Firma.
-- Für alle Arten außer booking nimmt commission_book Satz, Versionen und vat_rule aus der booking-Zeile des Auftrags (Konzept 9.3).

create type public.commission_kind as enum ('booking', 'change', 'cancellation', 'cancellation_fee', 'correction');

create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  request_id uuid not null references public.service_requests (id) on delete restrict,
  revision_id uuid not null,
  kind public.commission_kind not null,
  reverses_entry_id uuid references public.commission_entries (id) on delete restrict,
  total_cents bigint not null,
  fee_cents bigint not null,
  fee_net_cents bigint not null,
  fee_vat_cents bigint not null,
  payout_cents bigint not null,
  fee_rate numeric(6, 5) not null check (fee_rate between 0 and 1),
  fee_vat_rate numeric(6, 5) not null check (fee_vat_rate between 0 and 1),
  vat_rule public.partner_vat_rule not null,
  payment_flow text not null default 'invoice_transfer' check (payment_flow in ('invoice_transfer', 'connect_fee')),
  price_version int not null references public.price_versions (version),
  fee_rate_version int not null,
  fee_vat_rate_version int not null,
  created_at timestamptz not null default now(),
  foreign key (revision_id, request_id) references public.price_revisions (id, request_id) on delete restrict,
  constraint fee_parts check (fee_net_cents + fee_vat_cents = fee_cents),
  constraint payout_rest check (payout_cents = total_cents - fee_cents),
  constraint reverses_shape check ((kind in ('cancellation', 'correction')) = (reverses_entry_id is not null)),
  constraint non_negative_kinds check (
    kind not in ('booking', 'cancellation_fee')
    or (total_cents >= 0 and fee_cents >= 0 and fee_net_cents >= 0 and fee_vat_cents >= 0 and payout_cents >= 0)
  ),
  constraint vat_rule_phase1 check (vat_rule = 'standard_20')
);

create unique index commission_one_booking on public.commission_entries (request_id) where kind = 'booking';
create unique index commission_one_reversal on public.commission_entries (reverses_entry_id) where reverses_entry_id is not null;
create index commission_entries_partner_idx on public.commission_entries (partner_id, created_at);
create index commission_entries_request_idx on public.commission_entries (request_id);

create trigger append_only before update or delete on public.commission_entries
for each row execute function private.append_only();
create trigger append_only_truncate before truncate on public.commission_entries
for each statement execute function private.append_only();

-- Einfügeprüfung, unabhängig von der Funktion (gilt auch für Eigentümer-SQL) -------------------------------------------
create function private.guard_commission_insert() returns trigger
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
  elsif new.total_cents < 0 or new.total_cents > rev.total_cents then
    raise exception 'amount_mismatch';
  end if;
  return new;
end
$$;

revoke all on function private.guard_commission_insert() from public;

create trigger guard_commission_insert before insert on public.commission_entries
for each row execute function private.guard_commission_insert();

-- Einzige Schreibstelle. Kein Grant: nur Eigentümer-Funktionen (ab S9c die Übergangsfunktionen) rufen sie auf. ----------
-- Sperren: Firma (for share) vor Status und vat_rule, Auftrag (for update) für alle Arten außer booking (R2-M2).
create function private.commission_book(
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
    fr := coalesce(fr, bk.fee_rate);
    vr := coalesce(vr, bk.fee_vat_rate);
    frv := coalesce(frv, bk.fee_rate_version);
    vrv := coalesce(vrv, bk.fee_vat_rate_version);
  end if;
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

revoke all on function private.commission_book(uuid, uuid, uuid, public.commission_kind, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int)
  from public, anon, authenticated, service_role;

-- RLS: eigene Firma (Mitglied, aal2, jeder Status) und admin (aal2). Kein Schreibrecht für irgendeine API-Rolle. ----------
alter table public.commission_entries enable row level security;
revoke all on public.commission_entries from anon, authenticated, service_role;
grant select on public.commission_entries to authenticated, service_role;

create policy commission_entries_select on public.commission_entries for select to authenticated
using (partner_id = (select private.my_member_partner_id()) or (select private.is_admin()));

-- Gebührensatz: Versionen mitliefern (R2-N4); die Spalten hängen hinten an, bestehende bleiben unverändert -------------
create or replace view public.current_fee_rates with (security_invoker = true) as
select
  (select s.value from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_rate,
  (select s.value from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_vat_rate,
  (select s.effective_from from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_rate_from,
  (select s.effective_from from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_vat_rate_from,
  (select s.version from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_rate_version,
  (select s.version from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
    order by s.effective_from desc, s.version desc limit 1) as fee_vat_rate_version;

-- S1-N3: NULL-Eingaben ergeben false statt NULL ---------------------------------------------------------------------------
create or replace function private.partner_transition_ok(p_old public.partner_status, p_new public.partner_status) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_old::text || '>' || p_new::text in (
    'pending>active', 'pending>rejected', 'active>payment_hold', 'active>suspended',
    'payment_hold>active', 'payment_hold>suspended', 'suspended>active'), false)
$$;

-- fee_splits entfällt samt Policy und Index (niemand schreibt seit 0018 hinein; Lesen/Schreiben kennt nur noch das Journal) -
drop table public.fee_splits;
