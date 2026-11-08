-- S9c-5: Behebung der Abnahme (tmp/proof/s9c-abnahme.md): H1 Zuständigkeit bei der Annahme und beim Lesen offener Listings,
-- M1/N5 Outbox mit Lease, N2/N3 Basis der Annahme, N6 Ablehnen nach Fristende, N7 Cron-Läufe je Auftrag abgesichert.

-- H1: Kategorie und Bezirk gelten zum Zeitpunkt der Annahme und des Lesens, nicht nur bei der Verteilung.
create function private.in_scope(p_partner uuid, p_service public.service_type, p_district smallint) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.partner_categories c where c.partner_id = p_partner and c.service::text = p_service::text)
     and exists (select 1 from public.partner_regions g where g.partner_id = p_partner and g.district = p_district)
$$;

revoke all on function private.in_scope(uuid, public.service_type, smallint) from public;
grant execute on function private.in_scope(uuid, public.service_type, smallint) to authenticated;

drop policy job_listings_select on public.job_listings;
create policy job_listings_select on public.job_listings for select to authenticated
using (
  (status = 'open' and accept_deadline > now() and partner_id = (select private.my_partner_id()) and (select private.in_scope(partner_id, service, district)))
  or (status = 'accepted' and partner_id = (select private.my_job_partner_id()) and (select private.assignment_access(request_id, partner_id)))
  or (select private.is_admin())
);

-- N2, N3: fehlender Satz bricht ab (nie 0), Aufträge ohne Festpreis melden offer_required.
create or replace function public.partner_accept_basis(p_actor uuid, p_listing uuid)
returns table (revision_id uuid, total_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  rev public.price_revisions;
  today date := (now() at time zone 'Europe/Vienna')::date;
  fr record;
  vr record;
begin
  select * into l from public.job_listings x where x.id = p_listing;
  if not found or not exists (select 1 from public.partner_members m where m.user_id = p_actor and m.partner_id = l.partner_id) then
    raise exception 'not_found';
  end if;
  select * into r from public.service_requests s where s.id = l.request_id;
  if r.status in ('awaiting_offer', 'offered') then raise exception 'offer_required'; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.total_cents is null then raise exception 'price_not_fixed'; end if;
  select s.value, s.version into fr from public.platform_settings s where s.key = 'fee_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
  select s.value, s.version into vr from public.platform_settings s where s.key = 'fee_vat_rate' and s.effective_from <= today order by s.effective_from desc, s.version desc limit 1;
  if fr.value is null or vr.value is null then raise exception 'setting_missing'; end if;
  return query select rev.id, rev.total_cents, fr.value, vr.value, fr.version, vr.version;
end
$$;

-- Annahme: wie 0031, zusätzlich Zuständigkeit unter der Firmensperre (H1).
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

-- N6: Nach Fristende lehnt der Partner nur ab; der Auftrag läuft über T7 ab (Cron), nicht über T8.
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
  update public.job_listings set status = 'declined', decided_at = now() where id = p_listing;
  if r.status in ('requested', 'awaiting_offer') and r.accept_deadline > now()
     and not exists (select 1 from public.job_listings x where x.request_id = r.id and x.status = 'open') then
    perform private.set_request_status(r.id, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, r.id, 'request_unmatched:' || r.id);
  end if;
end
$$;

-- N7: Ein fehlerhafter Auftrag blockiert die Läufe der anderen nicht (Code und Auftrags-ID im Log, kein Personenbezug).
create or replace function public.distribute_pending() returns integer
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
    begin
      n := n + public.distribute_request(r.id);
    exception when others then
      raise warning 'distribute_failed % %', r.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;

create or replace function public.expire_requests() returns integer
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
    begin
      perform private.set_request_status(r.id, 'expired', null, 'system');
      perform private.outbox_put('request_expired', 'customer', r.customer_id, r.id, 'request_expired:' || r.id);
      n := n + 1;
    exception when others then
      raise warning 'expire_failed % %', r.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;

-- M1, N5: Outbox mit Lease. Eine geholte Zeile ist `sending`; erneut holbar erst nach 10 Minuten; nach 5 Versuchen `failed`.
alter table public.outbox add column claimed_at timestamptz;
alter table public.outbox drop constraint outbox_status_check;
alter table public.outbox add constraint outbox_status_check check (status in ('pending', 'sending', 'sent', 'failed'));

create or replace function public.outbox_claim(p_limit int)
returns table (id bigint, kind text, recipient_kind text, recipient_id uuid, request_id uuid, partner_email text)
language plpgsql security definer set search_path = ''
as $$
begin
  update public.outbox o set status = 'failed' where o.status = 'sending' and o.claimed_at < now() - interval '10 minutes' and o.attempts >= 5;
  return query
  with c as (
    select o.id from public.outbox o
    where o.attempts < 5 and (o.status = 'pending' or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes'))
    order by o.id limit greatest(1, least(p_limit, 50)) for update skip locked
  ), u as (
    update public.outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1 from c where o.id = c.id
    returning o.id, o.kind, o.recipient_kind, o.recipient_id, o.request_id
  )
  select u.id, u.kind, u.recipient_kind, u.recipient_id, u.request_id, p.contact_email
  from u left join public.partners p on u.recipient_kind = 'partner' and p.id = u.recipient_id;
end
$$;

create or replace function public.outbox_mark(p_id bigint, p_ok boolean, p_error text) returns void
language sql security definer set search_path = ''
as $$
  update public.outbox o set
    status = case when p_ok then 'sent' when o.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    claimed_at = null,
    last_error = case when p_ok then null else left(p_error, 60) end
  where o.id = p_id
$$;

create or replace function public.outbox_dispatch() returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  secret text;
  url text;
begin
  if not exists (select 1 from public.outbox o where o.status in ('pending', 'sending') and o.attempts < 5) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'outbox_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'outbox_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then return; end if;
  perform net.http_post(url := url, headers := jsonb_build_object('x-outbox-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000);
end
$$;
