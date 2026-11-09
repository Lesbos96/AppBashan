-- S9e-2: Befunde der Abnahme (tmp/proof/s9e-abnahme.md).
-- M1: admin_set_partner_status prüft die Menge der zu sperrenden Aufträge nach der Firmensperre erneut (sonst Deadlock mit confirm_offer möglich).
-- M2: Partner kennen die Auftrags-ID nicht: send_offer nimmt die Listing-ID, partner_offers.request_id ist für Konten gesperrt.
-- N1: send_offer und confirm_offer setzen alle abgelaufenen Angebote der Anfrage auf expired. N3: Gewinner-Listing muss offen sein.
-- N5: end_reason passt zum Status.

-- M2 ------------------------------------------------------------------------------------------------------------------------------
revoke select on public.partner_offers from authenticated;
grant select (id, partner_id, base_revision_id, amount_cents, status, valid_until, created_at, decided_at, end_reason)
  on public.partner_offers to authenticated;

-- N5 ------------------------------------------------------------------------------------------------------------------------------
alter table public.partner_offers add constraint partner_offers_reason check (
  (status = 'sent' and end_reason is null)
  or (status = 'confirmed' and end_reason = 'confirmed')
  or (status = 'superseded' and end_reason = 'superseded')
  or (status = 'rejected' and end_reason in ('customer_rejected', 'customer_withdrawn'))
  or (status = 'expired' and end_reason = 'expired')
  or (status = 'withdrawn' and end_reason in ('partner_withdrawn', 'partner_not_active', 'partner_status'))
);

-- send_offer: p_listing ist die Listing-ID der eigenen Firma (M2); abgelaufene Angebote der ganzen Anfrage werden erledigt (N1) --------
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
  insert into public.partner_offers (request_id, partner_id, base_revision_id, amount_cents, valid_until)
  values (r.id, pid, rev.id, p_amount, valid) returning id into oid;
  if r.status = 'awaiting_offer' then
    perform private.set_request_status(r.id, 'offered', uid, 'partner');
  end if;
  perform private.outbox_put('offer_new', 'customer', r.customer_id, r.id, 'offer_new:' || oid);
  return oid;
end
$$;

revoke all on function public.send_offer(uuid, int) from public, anon, authenticated, service_role;
grant execute on function public.send_offer(uuid, int) to authenticated;

-- confirm_offer: abgelaufene fremde Angebote → expired (N1), Gewinner-Listing muss offen sein (N3) -------------------------------
create or replace function public.confirm_offer(
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
  perform private.commission_book(o.partner_id, r.id, rev2, 'booking', null, o.amount_cents, p_fee_rate, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'confirm_offer', 'offer', o.id::text,
    jsonb_build_object('request_id', r.id, 'amount_cents', o.amount_cents, 'revision_id', rev2,
      'snapshot_hash', encode(sha256(convert_to(snap::text, 'utf8')), 'hex')));
  perform private.outbox_put('offer_confirmed', 'partner', o.partner_id, r.id, 'offer_confirmed:' || r.id);
  return 'confirmed';
end
$$;

-- admin_set_partner_status: nach der Firmensperre die Menge der Aufträge erneut bestimmen (M1). Kam ein Auftrag hinzu, bricht die Funktion
-- mit `retry` ab (nichts geändert); solange die Firma gesperrt ist, kann send_offer kein Angebot mehr anlegen.
create or replace function public.admin_set_partner_status(p_actor uuid, p_partner uuid, p_status public.partner_status, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  st public.partner_status;
  reqs uuid[];
  reqs2 uuid[];
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
  select array_agg(x.request_id order by x.request_id) into reqs2 from (
    select l.request_id from public.job_listings l where l.partner_id = p_partner and l.status = 'open'
    union
    select f.request_id from public.partner_offers f where f.partner_id = p_partner and f.status = 'sent'
  ) x;
  if exists (select 1 from unnest(coalesce(reqs2, '{}')) n where n <> all (coalesce(reqs, '{}'))) then
    raise exception 'retry';
  end if;
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
    -- Eine Zahlungssperre ist vorübergehend: Listings bleiben offen (sie zählen nicht als lebend und lassen sich nicht annehmen)
    -- und gelten nach der Wiederöffnung wieder; Angebote werden in jedem Fall zurückgezogen.
    if p_status in ('suspended', 'rejected') then
      update public.job_listings set status = 'closed', decided_at = now() where partner_id = p_partner and status = 'open';
    end if;
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
