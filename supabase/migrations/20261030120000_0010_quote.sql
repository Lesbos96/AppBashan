-- 0010 quote (S8a): Spalten für die Nicht-Preisfelder und Idempotenz, View für den Gebührensatz,
-- atomare Schreib-Funktionen für die Edge Function `quote`.
-- Anfragen schreibt nur der Server (service_role); die Funktionen sind für anon und authenticated gesperrt.

-- Nicht-Preisfelder getrennt von `inputs`: Freitext ist für Partner vor der Annahme nie sichtbar (ARCHITECTURE.md, Datenschutz).
alter table public.service_requests
  add column description text check (char_length(description) <= 800),
  add column volume_m3 numeric(4, 1) check (volume_m3 between 1 and 100),
  add column client_ref uuid,
  add constraint time_window_known check (time_window in ('morning', 'midday', 'afternoon', 'flexible')),
  add constraint service_requests_client_ref unique (customer_id, client_ref);

-- Idempotenz: Die App erzeugt je Absendeversuch eine client_ref; ein zweiter Aufruf liefert dieselbe Zeile.
alter table public.rental_bookings
  add column client_ref uuid,
  add constraint rental_bookings_client_ref unique (customer_id, client_ref);

-- Gebührensatz: je Schlüssel die höchste Version (anderer Lebenszyklus als die Kundentarife).
-- Fehlt ein Schlüssel, ist der Wert null und `quote` bricht ab. security_invoker: die RLS von platform_settings gilt weiter
-- (Kunden sehen nur null, Vermieter und admin den Satz).
create view public.current_fee_rates with (security_invoker = true) as
select
  (select s.value from public.platform_settings s where s.key = 'fee_rate' order by s.version desc limit 1) as fee_rate,
  (select s.value from public.platform_settings s where s.key = 'fee_vat_rate' order by s.version desc limit 1) as fee_vat_rate;

revoke all on public.current_fee_rates from anon, authenticated;
grant select on public.current_fee_rates to authenticated;

-- Anfrage anlegen (p_request null) oder bearbeiten, samt Gebührenaufteilung, in einer Transaktion.
-- Bearbeiten nur für die eigene Anfrage im Status „requested" und im selben Service.
-- Fehler: P0002 = nicht gefunden (oder fremd), 55000 = nicht bearbeitbar.
create function public.quote_save_request(
  p_customer uuid, p_request uuid, p_client_ref uuid,
  p_service public.service_type, p_status public.request_status,
  p_inputs jsonb, p_snapshot jsonb, p_price_version int, p_estimate int, p_needs_quote boolean,
  p_from_address text, p_from_postcode text, p_from_lon double precision, p_from_lat double precision,
  p_to_address text, p_to_postcode text, p_to_lon double precision, p_to_lat double precision,
  p_route jsonb, p_region public.region, p_preferred_date date, p_time_window text,
  p_description text, p_volume numeric,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee_cents int, p_fee_net int, p_fee_vat int, p_payout int
) returns table (id uuid, status public.request_status, needs_quote boolean, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.service_requests;
  from_pt extensions.geography := case when p_from_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_from_lon, p_from_lat), 4326)::extensions.geography end;
  to_pt extensions.geography := case when p_to_lon is null then null
    else extensions.st_setsrid(extensions.st_makepoint(p_to_lon, p_to_lat), 4326)::extensions.geography end;
begin
  if p_request is null then
    insert into public.service_requests as s (
      customer_id, client_ref, service, status, inputs, price_snapshot, price_version, estimate_cents, needs_quote,
      from_address, from_postcode, from_point, to_address, to_postcode, to_point, route, region,
      preferred_date, time_window, description, volume_m3
    ) values (
      p_customer, p_client_ref, p_service, p_status, p_inputs, p_snapshot, p_price_version, p_estimate, p_needs_quote,
      p_from_address, p_from_postcode, from_pt, p_to_address, p_to_postcode, to_pt, p_route, p_region,
      p_preferred_date, p_time_window, p_description, p_volume
    )
    on conflict (customer_id, client_ref) do nothing
    returning s.* into r;
    if r.id is null then
      -- zweiter Aufruf mit derselben client_ref: vorhandene Anfrage zurückgeben, nichts ändern
      select s.* into r from public.service_requests s where s.customer_id = p_customer and s.client_ref = p_client_ref;
      return query select r.id, r.status, r.needs_quote, false;
      return;
    end if;
  else
    update public.service_requests as s set
      status = p_status, inputs = p_inputs, price_snapshot = p_snapshot, price_version = p_price_version,
      estimate_cents = p_estimate, needs_quote = p_needs_quote,
      from_address = p_from_address, from_postcode = p_from_postcode, from_point = from_pt,
      to_address = p_to_address, to_postcode = p_to_postcode, to_point = to_pt,
      route = p_route, region = p_region, preferred_date = p_preferred_date, time_window = p_time_window,
      description = p_description, volume_m3 = p_volume
    where s.id = p_request and s.customer_id = p_customer and s.status = 'requested' and s.service = p_service
    returning s.* into r;
    if r.id is null then
      if exists (select 1 from public.service_requests s where s.id = p_request and s.customer_id = p_customer) then
        raise exception 'not_editable' using errcode = '55000';
      end if;
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  if p_estimate is null then
    delete from public.fee_splits f where f.service_request_id = r.id;
  else
    insert into public.fee_splits as f (
      service_request_id, payee_id, total_cents, fee_rate, fee_vat_rate, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, price_version
    ) values (
      r.id, null, p_estimate, p_fee_rate, p_fee_vat_rate, p_fee_cents, p_fee_net, p_fee_vat, p_payout, p_price_version
    )
    on conflict (service_request_id) do update set
      total_cents = excluded.total_cents, fee_rate = excluded.fee_rate, fee_vat_rate = excluded.fee_vat_rate,
      fee_cents = excluded.fee_cents, fee_net_cents = excluded.fee_net_cents, fee_vat_cents = excluded.fee_vat_cents,
      payout_cents = excluded.payout_cents, price_version = excluded.price_version;
  end if;

  return query select r.id, r.status, r.needs_quote, true;
end;
$$;

-- Mietanfrage anlegen samt Gebührenaufteilung (Zahlungsempfänger = Vermieter des Angebots, Demo: null).
create function public.quote_save_booking(
  p_customer uuid, p_client_ref uuid, p_offer uuid, p_pickup timestamptz, p_return timestamptz,
  p_km int, p_cover boolean, p_extra_driver boolean, p_one_way boolean,
  p_snapshot jsonb, p_price_version int, p_total int, p_deposit int, p_payee uuid,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee_cents int, p_fee_net int, p_fee_vat int, p_payout int
) returns table (id uuid, status public.request_status, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.rental_bookings;
begin
  insert into public.rental_bookings as s (
    customer_id, client_ref, offer_id, pickup_at, return_at, km, cover, extra_driver, one_way,
    price_snapshot, price_version, total_cents, deposit_cents
  ) values (
    p_customer, p_client_ref, p_offer, p_pickup, p_return, p_km, p_cover, p_extra_driver, p_one_way,
    p_snapshot, p_price_version, p_total, p_deposit
  )
  on conflict (customer_id, client_ref) do nothing
  returning s.* into b;
  if b.id is null then
    select s.* into b from public.rental_bookings s where s.customer_id = p_customer and s.client_ref = p_client_ref;
    return query select b.id, b.status, false;
    return;
  end if;

  insert into public.fee_splits (
    rental_booking_id, payee_id, total_cents, fee_rate, fee_vat_rate, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, price_version
  ) values (
    b.id, p_payee, p_total, p_fee_rate, p_fee_vat_rate, p_fee_cents, p_fee_net, p_fee_vat, p_payout, p_price_version
  );
  return query select b.id, b.status, true;
end;
$$;

-- Supabase vergibt Execute per Default an anon und authenticated: ausdrücklich nur service_role.
revoke execute on function public.quote_save_request(
  uuid, uuid, uuid, public.service_type, public.request_status, jsonb, jsonb, int, int, boolean,
  text, text, double precision, double precision, text, text, double precision, double precision,
  jsonb, public.region, date, text, text, numeric, numeric, numeric, int, int, int, int
) from public, anon, authenticated;
grant execute on function public.quote_save_request(
  uuid, uuid, uuid, public.service_type, public.request_status, jsonb, jsonb, int, int, boolean,
  text, text, double precision, double precision, text, text, double precision, double precision,
  jsonb, public.region, date, text, text, numeric, numeric, numeric, int, int, int, int
) to service_role;

revoke execute on function public.quote_save_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, int, boolean, boolean, boolean,
  jsonb, int, int, int, uuid, numeric, numeric, int, int, int, int
) from public, anon, authenticated;
grant execute on function public.quote_save_booking(
  uuid, uuid, uuid, timestamptz, timestamptz, int, boolean, boolean, boolean,
  jsonb, int, int, int, uuid, numeric, numeric, int, int, int, int
) to service_role;
