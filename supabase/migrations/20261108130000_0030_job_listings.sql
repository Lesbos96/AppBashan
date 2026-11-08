-- S9c-1: Verteilung (job_listings), Zuordnung (assignments), Outbox, Statuspaare T3/T7/T8/T9/T10, Listings schließen.
-- Alle Schreibwege laufen über die Funktionen der Migrationen 0031 und 0032; kein Konto hat DML-Rechte auf diese Tabellen.

create type public.listing_status as enum ('open', 'closed', 'declined', 'accepted');
create type public.assignment_end as enum ('completed', 'cancelled_by_customer', 'cancelled_by_partner');

-- Einstellung als Zahl (Wiener Datum, höchste Version); fehlt sie, bricht der Aufrufer ab (nie ein Standardwert).
create function private.setting_num(p_key text) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare v numeric;
begin
  select s.value into v from public.platform_settings s
  where s.key = p_key and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
  order by s.effective_from desc, s.version desc limit 1;
  if v is null then raise exception 'setting_missing'; end if;
  return v;
end
$$;

revoke all on function private.setting_num(text) from public;

alter table public.platform_settings
  add constraint platform_settings_s9c check (
    (key <> 'partner_open_jobs_max' or (value = trunc(value) and value between 1 and 100))
    and (key <> 'partner_access_days' or (value = trunc(value) and value between 0 and 365))
  );

-- job_listings: je Auftrag und Empfänger eine Zeile. Keine Spalten für Adresse, Punkte, Route, Freitext, Kunde, client_ref (Konzept 5.5).
create table public.job_listings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  revision_id uuid not null references public.price_revisions (id) on delete cascade,
  status public.listing_status not null default 'open',
  district smallint not null check (district between 1 and 23),
  service public.service_type not null,
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  volume_m3 numeric,
  preferred_date date,
  time_window text,
  total_cents bigint check (total_cents > 0),
  low_cents bigint,
  high_cents bigint,
  accept_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (request_id, partner_id)
);

create index job_listings_partner_idx on public.job_listings (partner_id, status);

-- assignments: höchstens eine aktive Zuordnung je Auftrag; nur ended_at und ended_reason ändern sich, einmal.
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason public.assignment_end,
  constraint assignments_end check ((ended_at is null) = (ended_reason is null))
);

create unique index assignments_active_one on public.assignments (request_id) where ended_at is null;
create index assignments_partner_idx on public.assignments (partner_id, ended_at);

create function private.guard_assignment_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.ended_at is not null
    or new.id <> old.id or new.request_id <> old.request_id or new.partner_id <> old.partner_id or new.accepted_at <> old.accepted_at then
    raise exception 'append_only';
  end if;
  return new;
end
$$;

create trigger guard_assignment_update before update on public.assignments
for each row execute function private.guard_assignment_update();
create trigger append_only_delete before delete on public.assignments
for each row execute function private.immutable_row('append_only');
create trigger append_only_truncate before truncate on public.assignments
for each statement execute function private.immutable_row('append_only');

-- „Zuordnung besteht“ (Konzept 5.5): aktiv oder höchstens partner_access_days zurück beendet.
create function private.assignment_access(p_request uuid, p_partner uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    where a.request_id = p_request and a.partner_id = p_partner
      and (a.ended_at is null or a.ended_at > now() - make_interval(days => private.setting_num('partner_access_days')::int))
  )
$$;

revoke all on function private.assignment_access(uuid, uuid) from public;
grant execute on function private.assignment_access(uuid, uuid) to authenticated;

-- outbox: Mails in derselben Transaktion wie die Zustandsänderung; Empfänger nur als ID (Kunde: Nutzer, Partner: Firma).
create table public.outbox (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched')),
  recipient_kind text not null check (recipient_kind in ('customer', 'partner')),
  recipient_id uuid not null,
  request_id uuid references public.service_requests (id) on delete cascade,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text check (char_length(last_error) <= 300),
  sent_at timestamptz
);

-- Rechte: kein DML für Konten, auch nicht für service_role (Schreiben nur die Funktionen). service_role liest Listings und Zuordnungen
-- (Tests und Edge Functions prüfen damit Zustände); admin liest alles über Policies, die Spalte request_id der Listings nie ein Partner.
alter table public.job_listings enable row level security;
alter table public.assignments enable row level security;
alter table public.outbox enable row level security;
revoke all on public.job_listings, public.assignments, public.outbox from anon, authenticated, service_role;
grant select (id, partner_id, revision_id, status, district, service, inputs, volume_m3, preferred_date, time_window, total_cents, low_cents, high_cents, accept_deadline, created_at, decided_at)
  on public.job_listings to authenticated;
grant select on public.assignments, public.outbox to authenticated;
grant select on public.job_listings, public.assignments to service_role;

create policy job_listings_select on public.job_listings for select to authenticated
using (
  (status = 'open' and accept_deadline > now() and partner_id = (select private.my_partner_id()))
  or (status = 'accepted' and partner_id = (select private.my_job_partner_id()) and (select private.assignment_access(request_id, partner_id)))
  or (select private.is_admin())
);

create policy assignments_select on public.assignments for select to authenticated
using (
  partner_id = (select private.my_member_partner_id())
  or (select private.is_admin())
  or exists (select 1 from public.service_requests r where r.id = request_id and r.customer_id = (select auth.uid()))
);

create policy outbox_select on public.outbox for select to authenticated using ((select private.is_admin()));

-- Statuspaare dieser Stufe (Konzept 4.4): T2 withdraw, T3 accept, T7 expire, T8 unmatched, T9 start, T10 complete.
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
  ) then
    raise exception 'invalid_transition';
  end if;
  if current_setting('app.mv_transition', true) is distinct from new.id::text || ':' || new.status::text then
    raise exception 'invalid_transition';
  end if;
  return new;
end
$$;

-- Verlässt ein Auftrag die offenen Zustände, schließen sich seine offenen Listings (withdraw, expire, unmatched, accept).
create function private.close_listings() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.job_listings l set status = 'closed', decided_at = now() where l.request_id = new.id and l.status = 'open';
  return null;
end
$$;

revoke all on function private.close_listings(), private.guard_assignment_update() from public;

create trigger close_listings after update of status on public.service_requests
for each row when (old.status is distinct from new.status and new.status not in ('requested', 'awaiting_offer', 'offered'))
execute function private.close_listings();

-- Sperrreihenfolge (S4-N6): überall zuerst der Auftrag (for update), dann die Firma (for share), dann der Journalzeilen-Insert.
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
