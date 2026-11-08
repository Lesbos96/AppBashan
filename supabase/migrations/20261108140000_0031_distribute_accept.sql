-- S9c-2: Verteilung (distribute_request), Annahme (partner_accept, Art A), Ablehnen, Fristablauf (T7), Outbox-Funktionen.
-- Sperrreihenfolge überall: Auftrag (for update) → Firma (for share) → Zeilen darunter (S4-N6).

-- Statuswechsel mit Marker und Akteur (Konzept 4.4); der Paar-Trigger prüft das Paar, status_events schreibt der Trigger.
create function private.set_request_status(p_request uuid, p_to public.request_status, p_actor uuid, p_role text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('app.mv_transition', p_request::text || ':' || p_to::text, true);
  perform set_config('app.mv_actor', coalesce(p_actor::text, ''), true);
  perform set_config('app.mv_actor_role', p_role, true);
  update public.service_requests set status = p_to where id = p_request;
  perform set_config('app.mv_transition', '', true);
  perform set_config('app.mv_actor', '', true);
  perform set_config('app.mv_actor_role', '', true);
end
$$;

create function private.outbox_put(p_kind text, p_recipient_kind text, p_recipient uuid, p_request uuid, p_dedupe text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.outbox (kind, recipient_kind, recipient_id, request_id, dedupe_key)
  values (p_kind, p_recipient_kind, p_recipient, p_request, p_dedupe)
  on conflict (dedupe_key) do nothing
$$;

revoke all on function private.set_request_status(uuid, public.request_status, uuid, text), private.outbox_put(text, text, uuid, uuid, text) from public;

-- Verteilung: je aktiver Firma mit Kategorie und Bezirk der Abholadresse ein Listing; nicht an Firmen, deren Mitglied der Kunde ist.
-- Ohne Empfänger wird der Auftrag unmatched (T8). Idempotent: hat der Auftrag Listings oder ist er nicht mehr offen, geschieht nichts.
create function public.distribute_request(p_request uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  rev public.price_revisions;
  n int;
begin
  select * into r from public.service_requests where id = p_request for update;
  if not found or r.status not in ('requested', 'awaiting_offer') then return 0; end if;
  if exists (select 1 from public.job_listings l where l.request_id = p_request) then return 0; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.id is null then raise exception 'revision_missing'; end if;
  with ins as (
    insert into public.job_listings (request_id, partner_id, revision_id, district, service, inputs, volume_m3, preferred_date, time_window, total_cents, low_cents, high_cents, accept_deadline)
    select r.id, p.id, rev.id, r.district, r.service, rev.inputs, r.volume_m3, r.preferred_date, r.time_window, rev.total_cents, rev.low_cents, rev.high_cents, r.accept_deadline
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

-- Nachlauf für Aufträge, die `quote` nicht verteilen konnte (Cron, jede Minute).
create function public.distribute_pending() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id from public.service_requests s
    where s.status in ('requested', 'awaiting_offer') and s.current_revision is not null and s.accept_deadline > now()
      and not exists (select 1 from public.job_listings l where l.request_id = s.id)
  loop
    n := n + public.distribute_request(r.id);
  end loop;
  return n;
end
$$;

-- Grundlage der Annahme für die Edge Function: Revision, Festpreis, geltender Satz mit Versionen. Nur für das Listing der eigenen Firma.
create function public.partner_accept_basis(p_actor uuid, p_listing uuid)
returns table (revision_id uuid, total_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  rev public.price_revisions;
  today date := (now() at time zone 'Europe/Vienna')::date;
begin
  select * into l from public.job_listings x where x.id = p_listing;
  if not found or not exists (select 1 from public.partner_members m where m.user_id = p_actor and m.partner_id = l.partner_id) then
    raise exception 'not_found';
  end if;
  select * into r from public.service_requests s where s.id = l.request_id;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.total_cents is null then raise exception 'price_not_fixed'; end if;
  return query select
    rev.id, rev.total_cents,
    (select s.value from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1),
    (select s.value from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1),
    (select s.version from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1),
    (select s.version from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1);
end
$$;

-- Annahme (T3), Art A (Konzept 4.5): p_actor ist ausschließlich die user_id aus dem geprüften JWT; aal2 prüft die Edge Function.
-- Eine Transaktion: Compare-and-Set auf den Auftrag, Zuordnung, Listings, Journal (booking), Ereignis, Outbox.
-- Fehler: not_found, partner_not_active, offer_required, expired, already_taken, request_closed, listing_declined, revision_changed,
-- price_not_fixed, payout_changed, partner_job_limit; aus dem Journal rate_mismatch/amount_mismatch (Satz oder Betrag veraltet).
create function public.partner_accept(
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
  open_n bigint;
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
  perform pg_advisory_xact_lock(hashtextextended('partner_jobs:' || pid::text, 0));
  select count(*) into open_n from public.assignments a join public.service_requests s on s.id = a.request_id
  where a.partner_id = pid and a.ended_at is null and s.status in ('accepted', 'in_progress');
  if open_n >= private.setting_num('partner_open_jobs_max') then raise exception 'partner_job_limit'; end if;
  insert into public.assignments (request_id, partner_id) values (r.id, pid) returning id into aid;
  update public.job_listings set status = 'accepted', decided_at = now() where id = p_listing;
  perform private.set_request_status(r.id, 'accepted', p_actor, 'partner');
  perform private.commission_book(pid, r.id, p_revision, 'booking', null, rev.total_cents, p_fee_rate, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  perform private.outbox_put('request_accepted', 'customer', r.customer_id, r.id, 'request_accepted:' || r.id);
  return aid;
end
$$;

-- Ablehnen (Art B): eigenes offenes Listing; war es das letzte offene, wird der Auftrag unmatched (T8, System).
create function public.decline_listing(p_listing uuid) returns void
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
  update public.job_listings set status = 'declined', decided_at = now() where id = p_listing;
  if r.status in ('requested', 'awaiting_offer') and not exists (select 1 from public.job_listings x where x.request_id = r.id and x.status = 'open') then
    perform private.set_request_status(r.id, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, r.id, 'request_unmatched:' || r.id);
  end if;
end
$$;

-- Fristablauf (T7, System): requested und awaiting_offer nach accept_deadline. Der offered-Zweig kommt mit S9e.
create function public.expire_requests() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id, s.customer_id from public.service_requests s
    where s.status in ('requested', 'awaiting_offer') and s.accept_deadline < now()
    order by s.accept_deadline for update skip locked
  loop
    perform private.set_request_status(r.id, 'expired', null, 'system');
    perform private.outbox_put('request_expired', 'customer', r.customer_id, r.id, 'request_expired:' || r.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Outbox: Versand durch die Edge Function outbox-send. Der Empfänger wird dort aufgelöst (Kunde: Nutzerkonto, Partner: Firmen-E-Mail).
create function public.outbox_claim(p_limit int)
returns table (id bigint, kind text, recipient_kind text, recipient_id uuid, request_id uuid, partner_email text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with c as (
    select o.id from public.outbox o where o.status = 'pending' and o.attempts < 5
    order by o.id limit greatest(1, least(p_limit, 50)) for update skip locked
  ), u as (
    update public.outbox o set attempts = o.attempts + 1 from c where o.id = c.id
    returning o.id, o.kind, o.recipient_kind, o.recipient_id, o.request_id
  )
  select u.id, u.kind, u.recipient_kind, u.recipient_id, u.request_id, p.contact_email
  from u left join public.partners p on u.recipient_kind = 'partner' and p.id = u.recipient_id;
end
$$;

create function public.outbox_mark(p_id bigint, p_ok boolean, p_error text) returns void
language sql security definer set search_path = ''
as $$
  update public.outbox o set
    status = case when p_ok then 'sent' when o.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    last_error = case when p_ok then null else left(p_error, 300) end
  where o.id = p_id
$$;

revoke all on function public.distribute_request(uuid), public.distribute_pending(), public.partner_accept_basis(uuid, uuid),
  public.partner_accept(uuid, uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.expire_requests(), public.outbox_claim(int), public.outbox_mark(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.distribute_request(uuid), public.distribute_pending(), public.partner_accept_basis(uuid, uuid),
  public.partner_accept(uuid, uuid, uuid, bigint, numeric, numeric, bigint, bigint, bigint, bigint, int, int),
  public.expire_requests(), public.outbox_claim(int), public.outbox_mark(bigint, boolean, text) to service_role;

revoke all on function public.decline_listing(uuid) from public, anon;
grant execute on function public.decline_listing(uuid) to authenticated;
