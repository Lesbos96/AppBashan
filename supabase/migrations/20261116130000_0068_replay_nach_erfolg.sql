-- 0068 n12b (OFFEN n12-2, n15-1 N8): Wiederholung derselben Partei nach Erfolg liefert das erste Ergebnis statt 409 (wie partner_accept_replay, 0067).
-- (1) Höchstens eine Pauschale/Stornogebühr je Anfrage (harte Sperre; kein Weg schreibt legitim zwei Zeilen, der zweite Aufruf scheitert schon am Statustor).
-- (2) cancel_replay: Storno von Kunde und Firma. Nur lesend, nur service_role. Quelle des „ersten Ergebnisses“ ist die Audit-Zeile des Erfolgs (append-only);
--     der gezeigte Betrag wird in SQL verglichen (Audit und Journal müssen ihn tragen), nach außen geht nur der Status. Beim Storno der Firma gehören
--     Grund und Belege dazu; die Firma ist heute Mitglied der Firma, deren Zuordnung mit `cancelled_by_partner` endete, und dieselbe Person wie im Audit.
-- (3) propose_change_replay: derselbe offene Nachtrag derselben Firma (Betrag, Eingaben, Belege). propose_change bleibt unverändert.
-- (4) send_offer: derselbe Betrag auf derselben Basis liefert die Id des vorhandenen Angebots statt `offer_exists` (Rumpf wie 0062:522, ein Block mehr).
-- (5) my_report_info: gelöschtes Profil gilt als nicht gefunden (Rumpf wie 0064:46, wie report_not_done in 0066).

create unique index commission_one_cancellation_fee on public.commission_entries (request_id) where kind = 'cancellation_fee';

create function public.cancel_replay(p_actor uuid, p_request uuid, p_action text, p_shown bigint, p_reason text, p_photos uuid[])
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.service_requests;
  a public.audit_log;
  n int;
  paid bigint;
begin
  if p_actor is null or p_request is null or p_action is null or p_shown is null then return null; end if;
  if p_action not in ('cancel_by_customer', 'cancel_by_partner') then return null; end if;
  select count(*) into n from public.audit_log l where l.action = p_action and l.entity = 'service_request' and l.entity_id = p_request::text;
  if n <> 1 then return null; end if;
  select * into a from public.audit_log l where l.action = p_action and l.entity = 'service_request' and l.entity_id = p_request::text;
  if a.actor_id is distinct from p_actor then return null; end if;
  select * into r from public.service_requests s where s.id = p_request;
  if not found then return null; end if;
  -- was die Pauschale/Stornogebühr heute im Journal ausmacht (Rechenweg wie my_cancel_info, 0059): nach negate_fee stimmt es nicht mehr mit dem Audit überein
  paid := coalesce((select sum(e.total_cents) from public.commission_entries e
                    where e.request_id = p_request
                      and (e.kind = 'cancellation_fee'
                           or e.reverses_entry_id in (select f.id from public.commission_entries f where f.request_id = p_request and f.kind = 'cancellation_fee'))), 0)::bigint;

  if p_action = 'cancel_by_customer' then
    if r.status <> 'cancelled_by_customer' or r.customer_id is distinct from p_actor then return null; end if;
    if (a.detail ->> 'fee_base_cents') is null or (a.detail ->> 'fee_base_cents')::bigint <> p_shown or paid <> p_shown then return null; end if;
    return 'cancelled_by_customer';
  end if;

  if r.status <> 'cancelled_by_partner' then return null; end if;
  if not exists (select 1 from public.assignments x join public.partner_members m on m.partner_id = x.partner_id and m.user_id = p_actor
                 where x.request_id = p_request and x.ended_reason = 'cancelled_by_partner') then
    return null;
  end if;
  if (a.detail ->> 'call_out_cents') is null or (a.detail ->> 'call_out_cents')::bigint <> p_shown or paid <> p_shown then return null; end if;
  if (a.detail ->> 'reason') is distinct from p_reason then return null; end if;
  if (select coalesce(array_agg(x order by x), '{}'::text[]) from jsonb_array_elements_text(coalesce(a.detail -> 'photos', '[]'::jsonb)) x)
     is distinct from (select coalesce(array_agg(y::text order by y::text), '{}'::text[]) from unnest(coalesce(p_photos, '{}'::uuid[])) y) then
    return null;
  end if;
  return 'cancelled_by_partner';
end
$$;

revoke all on function public.cancel_replay(uuid, uuid, text, bigint, text, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.cancel_replay(uuid, uuid, text, bigint, text, uuid[]) to service_role;

create function public.propose_change_replay(p_actor uuid, p_request uuid, p_changes jsonb, p_shown_total bigint, p_photos uuid[])
returns uuid
language sql stable security definer set search_path = ''
as $$
  select v.id
  from public.price_revisions v
  join public.service_requests r on r.id = v.request_id
  join public.partner_members m on m.partner_id = v.proposed_by and m.user_id = p_actor
  where p_actor is not null and v.request_id = p_request
    and v.source = 'change_order' and v.status = 'proposed' and v.valid_until > now()
    and v.base_revision_id = r.current_revision
    and v.total_cents = p_shown_total
    and jsonb_typeof(p_changes) = 'object'
    and not exists (select 1 from jsonb_each(case when jsonb_typeof(p_changes) = 'object' then p_changes else '{}'::jsonb end) e where v.inputs -> e.key is distinct from e.value)
    and (select coalesce(array_agg(x::text order by x::text), '{}'::text[]) from unnest(v.photos) x)
        = (select coalesce(array_agg(y::text order by y::text), '{}'::text[]) from unnest(coalesce(p_photos, '{}'::uuid[])) y)
  limit 1
$$;

revoke all on function public.propose_change_replay(uuid, uuid, jsonb, bigint, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.propose_change_replay(uuid, uuid, jsonb, bigint, uuid[]) to service_role;

-- (4) send_offer: Rumpf wie 0062:522-578; geändert nur der Block bei `offer_exists` (Rechte bleiben, create or replace)
create or replace function public.send_offer(p_listing uuid, p_amount int) returns uuid
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
    -- n12b: dieselbe Wiederholung nach verlorener Antwort (gleicher Betrag, gleiche Basis) liefert das vorhandene Angebot, ohne neue Zeile und ohne Mail
    select o.id into oid from public.partner_offers o
    where o.request_id = r.id and o.partner_id = pid and o.status = 'sent' and o.amount_cents = p_amount and o.base_revision_id = rev.id;
    if oid is not null then return oid; end if;
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

-- (5) my_report_info: Rumpf wie 0064:46-60, eine Prüfung mehr (gelöschtes Profil = nicht gefunden, wie report_not_done in 0066)
create or replace function public.my_report_info(p_request uuid) returns table (can_report boolean, report_until timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
  ok boolean;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.deleted_at is not null) then raise exception 'not_found'; end if;
  ok := private.report_gate(r) is null;
  return query select ok, case when ok then r.termin_at + make_interval(hours => 24 * private.setting_num('completion_days')::int) end;
end
$$;
