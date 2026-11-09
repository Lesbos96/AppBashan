-- S9h-1-Abnahme: M1 kein Kundenstorno nach der Meldung „hat nicht stattgefunden“ (admin prüft, T14); N1 Wertebereiche der Stornoschlüssel.
-- (H1 steckt in der Edge Function: gebucht wird nur die gezeigte Gebühr.)

-- N1: Stunden und Tage ganzzahlig und nicht negativ, Prozente ganzzahlig 0 bis 100 (sonst scheitert jede Buchung am Cast oder bucht mehr als den Gesamtpreis)
alter table public.platform_settings
  add constraint platform_settings_cancel check (
    (key not in ('cancel_late_percent', 'cancel_full_percent') or (value = trunc(value) and value between 0 and 100))
    and (key <> 'cancel_free_hours' or (value = trunc(value) and value between 0 and 8760))
    and (key <> 'cancel_full_days_before' or (value = trunc(value) and value between 0 and 365))
  );

-- Stornobasis: Tage als numeric lesen und auf Ganzzahl prüfen (nie ein Cast-Fehler beim Kunden)
create or replace function private.cancel_fee_base(p_request uuid) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.service_requests;
  rev public.price_revisions;
  t jsonb;
  days numeric;
  pct numeric;
begin
  select * into r from public.service_requests s where s.id = p_request;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  t := rev.snapshot -> 'terms';
  if rev.total_cents is null or r.termin_at is null
     or not coalesce(t ?& array['cancel_free_hours', 'cancel_late_percent', 'cancel_full_percent', 'cancel_full_days_before'], false) then
    raise exception 'terms_missing';
  end if;
  days := (t ->> 'cancel_full_days_before')::numeric;
  if days <> trunc(days) or days < 0 then raise exception 'terms_missing'; end if;
  if r.cancel_fee_waived then return 0; end if;
  if (now() at time zone 'Europe/Vienna')::date >= (r.termin_at at time zone 'Europe/Vienna')::date - days::int then
    pct := (t ->> 'cancel_full_percent')::numeric;
  elsif r.termin_at - now() >= (t ->> 'cancel_free_hours')::numeric * interval '1 hour' then
    return 0;
  else
    pct := (t ->> 'cancel_late_percent')::numeric;
  end if;
  return floor(rev.total_cents * pct / 100 + 0.5)::bigint;
end
$$;

-- M1: nach der Meldung des Kunden (not_done_reported_at) bleibt der Auftrag bei admin (under_review)
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
  e record;
  base bigint;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request;
  if not found or r.customer_id is distinct from p_actor then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_transition'; end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
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

  for e in
    select x.* from public.commission_entries x
    where x.request_id = p_request and x.kind in ('booking', 'change')
      and not exists (select 1 from public.commission_entries c where c.reverses_entry_id = x.id)
    order by x.created_at, x.id
  loop
    perform private.commission_book(pid, p_request, e.revision_id, 'cancellation', e.id, -e.total_cents, null, null,
      -e.fee_cents, -e.fee_net_cents, -e.fee_vat_cents, -e.payout_cents, null, null);
  end loop;
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
