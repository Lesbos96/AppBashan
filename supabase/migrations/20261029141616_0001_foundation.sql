-- 0001 Fundament: Rollen, Anfragen, Fotos, Miete, Tarife, Gebühren, Geo, Storage.
-- Begründungen und RLS-Matrix: docs/ARCHITECTURE.md
--
-- Grundsatz für Rechte: Supabase vergibt per Default alle Rechte an anon und authenticated.
-- Jede Tabelle widerruft das zuerst und vergibt dann nur, was gebraucht wird, teils spaltengenau.
-- Schreibrechte für Status, Preise und Gebühren hat nur der Server (service_role) bzw. admin.

create extension if not exists postgis with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- Helfer liegen in einem Schema, das die Data API nicht ausliefert.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Enums ---------------------------------------------------------------------

create type public.user_role as enum ('customer', 'rental_provider', 'admin', 'partner');
create type public.service_type as enum ('transport', 'move', 'clearance', 'assembly');
create type public.request_status as enum (
  'requested', 'inspection_requested', 'confirmed', 'in_progress', 'completed', 'withdrawn', 'expired'
);
create type public.region as enum ('vienna', 'austria', 'international');
create type public.offer_status as enum ('pending', 'approved', 'archived');

-- Profile und Rollen -------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  display_name text check (char_length(display_name) <= 100),
  phone text check (char_length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.my_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

revoke all on function private.my_role() from public;
grant execute on function private.my_role() to authenticated;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Einziger Weg zur Vermieter-Rolle (Profil → „Für Vermieter"). Nie admin, nie partner.
create function public.become_rental_provider() returns public.user_role
language sql security definer set search_path = ''
as $$
  update public.profiles set role = 'rental_provider'
  where id = (select auth.uid()) and role = 'customer';
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.become_rental_provider() from public, anon;
grant execute on function public.become_rental_provider() to authenticated;

-- Tarife (öffentlich, nur Kunden-Tarife) --------------------------------------

create table public.price_versions (
  version int primary key check (version > 0),
  effective_on date not null,
  note text,
  created_at timestamptz not null default now()
);

-- Geldwerte in Cent (unit beginnt mit „cent"), sonstige Größen in ihrer Einheit.
create table public.price_config (
  version int not null references public.price_versions (version),
  key text not null check (key ~ '^[a-z0-9_.]+$'),
  value numeric not null,
  unit text not null,
  label text not null,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  researched_at date,
  primary key (version, key)
);

-- Gebührensatz und USt.-Satz der Gebühr: nicht öffentlich.
create table public.platform_settings (
  key text not null check (key ~ '^[a-z0-9_.]+$'),
  version int not null check (version > 0),
  value numeric not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (key, version)
);

-- Anfragen -----------------------------------------------------------------

-- Anlegen und Bearbeiten nur über die Edge Function quote (service_role), die den Preis neu rechnet.
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  service public.service_type not null,
  status public.request_status not null default 'requested',
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  price_snapshot jsonb not null check (jsonb_typeof(price_snapshot) = 'object'),
  price_version int not null references public.price_versions (version),
  estimate_cents int check (estimate_cents >= 0),
  needs_quote boolean not null default false,
  from_address text,
  from_postcode text check (char_length(from_postcode) <= 12),
  from_point extensions.geography(point, 4326),
  to_address text,
  to_postcode text check (char_length(to_postcode) <= 12),
  to_point extensions.geography(point, 4326),
  route jsonb check (jsonb_typeof(route) = 'object'),
  region public.region,
  preferred_date date,
  time_window text check (char_length(time_window) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_xor_quote check (needs_quote = (estimate_cents is null)),
  constraint inspection_needs_quote check (status <> 'inspection_requested' or needs_quote)
);

create index service_requests_customer_idx on public.service_requests (customer_id, created_at desc);

create table public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index request_photos_request_idx on public.request_photos (request_id);

-- Miete --------------------------------------------------------------------

create table public.rental_offers (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  provider_name text not null check (char_length(provider_name) between 1 and 120),
  name text not null check (char_length(name) between 1 and 120),
  station text not null check (char_length(station) between 1 and 200),
  size_m3 numeric(4, 1) not null check (size_m3 > 0),
  daily_cents int not null check (daily_cents >= 0),
  km_per_day int not null check (km_per_day >= 0),
  extra_km_cents int not null check (extra_km_cents >= 0),
  cover_daily_cents int not null check (cover_daily_cents >= 0),
  excess_cents int not null check (excess_cents >= 0),
  cover_excess_cents int not null check (cover_excess_cents >= 0),
  driver_daily_cents int not null check (driver_daily_cents >= 0),
  booking_fee_cents int not null default 0 check (booking_fee_cents >= 0),
  one_way_cents int not null check (one_way_cents >= 0),
  deposit_cents int not null check (deposit_cents >= 0),
  status public.offer_status not null default 'pending',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_or_demo check (provider_id is not null or is_demo)
);

create index rental_offers_provider_idx on public.rental_offers (provider_id);

-- Mietanfragen: Anlegen nur über den Server (Preis aus dem Angebot neu gerechnet).
create table public.rental_bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.rental_offers (id),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  status public.request_status not null default 'requested' check (status <> 'inspection_requested'),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  km int not null check (km >= 0),
  cover boolean not null default false,
  extra_driver boolean not null default false,
  one_way boolean not null default false,
  price_snapshot jsonb not null check (jsonb_typeof(price_snapshot) = 'object'),
  price_version int not null references public.price_versions (version),
  total_cents int not null check (total_cents >= 0),
  deposit_cents int not null check (deposit_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_after_pickup check (return_at > pickup_at)
);

create index rental_bookings_customer_idx on public.rental_bookings (customer_id, created_at desc);
create index rental_bookings_offer_idx on public.rental_bookings (offer_id);

-- Gebührenaufteilung (nie für Kunden) --------------------------------------

create table public.fee_splits (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid unique references public.service_requests (id) on delete cascade,
  rental_booking_id uuid unique references public.rental_bookings (id) on delete cascade,
  payee_id uuid references public.profiles (id) on delete set null,
  total_cents int not null check (total_cents >= 0),
  fee_rate numeric(5, 4) not null check (fee_rate between 0 and 1),
  fee_vat_rate numeric(5, 4) not null check (fee_vat_rate between 0 and 1),
  fee_cents int not null,
  fee_net_cents int not null,
  fee_vat_cents int not null,
  payout_cents int not null,
  price_version int not null references public.price_versions (version),
  created_at timestamptz not null default now(),
  constraint one_subject check (num_nonnulls(service_request_id, rental_booking_id) = 1),
  constraint fee_parts check (fee_cents = fee_net_cents + fee_vat_cents),
  constraint payout_rest check (payout_cents = total_cents - fee_cents)
);

create index fee_splits_payee_idx on public.fee_splits (payee_id);

-- Geo ----------------------------------------------------------------------

create table public.geo_boundaries (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  geom extensions.geometry(multipolygon, 4326) not null,
  source text not null,
  imported_at timestamptz not null default now()
);

create index geo_boundaries_geom_idx on public.geo_boundaries using gist (geom);

-- updated_at ---------------------------------------------------------------

create trigger set_updated_at before update on public.profiles
for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.service_requests
for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.rental_offers
for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.rental_bookings
for each row execute function extensions.moddatetime(updated_at);

-- Rechte und RLS -----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.price_versions enable row level security;
alter table public.price_config enable row level security;
alter table public.platform_settings enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_photos enable row level security;
alter table public.rental_offers enable row level security;
alter table public.rental_bookings enable row level security;
alter table public.fee_splits enable row level security;
alter table public.geo_boundaries enable row level security;

revoke all on
  public.profiles, public.price_versions, public.price_config, public.platform_settings,
  public.service_requests, public.request_photos, public.rental_offers, public.rental_bookings,
  public.fee_splits, public.geo_boundaries
from anon, authenticated;

-- profiles: eigene Zeile lesen, nur Name und Telefon ändern. Rolle nie per API.
grant select on public.profiles to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.my_role()) = 'admin');

create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- price_versions, price_config: alle lesen, nur admin schreibt.
grant select on public.price_versions, public.price_config to anon, authenticated;
grant insert, update, delete on public.price_versions, public.price_config to authenticated;

create policy price_versions_select on public.price_versions for select to anon, authenticated using (true);
create policy price_versions_insert on public.price_versions for insert to authenticated
with check ((select private.my_role()) = 'admin');
create policy price_versions_update on public.price_versions for update to authenticated
using ((select private.my_role()) = 'admin') with check ((select private.my_role()) = 'admin');
create policy price_versions_delete on public.price_versions for delete to authenticated
using ((select private.my_role()) = 'admin');

create policy price_config_select on public.price_config for select to anon, authenticated using (true);
create policy price_config_insert on public.price_config for insert to authenticated
with check ((select private.my_role()) = 'admin');
create policy price_config_update on public.price_config for update to authenticated
using ((select private.my_role()) = 'admin') with check ((select private.my_role()) = 'admin');
create policy price_config_delete on public.price_config for delete to authenticated
using ((select private.my_role()) = 'admin');

-- platform_settings: lesen nur Vermieter und admin (später partner), schreiben nur admin.
grant select, insert, update, delete on public.platform_settings to authenticated;

create policy platform_settings_select on public.platform_settings for select to authenticated
using ((select private.my_role()) in ('rental_provider', 'admin'));
create policy platform_settings_insert on public.platform_settings for insert to authenticated
with check ((select private.my_role()) = 'admin');
create policy platform_settings_update on public.platform_settings for update to authenticated
using ((select private.my_role()) = 'admin') with check ((select private.my_role()) = 'admin');
create policy platform_settings_delete on public.platform_settings for delete to authenticated
using ((select private.my_role()) = 'admin');

-- service_requests: Eigentum statt Rolle. Kunde ändert nur status, und nur auf „withdrawn".
grant select on public.service_requests to authenticated;
grant update (status) on public.service_requests to authenticated;

create policy service_requests_select on public.service_requests for select to authenticated
using (customer_id = (select auth.uid()) or (select private.my_role()) = 'admin');

create policy service_requests_update on public.service_requests for update to authenticated
using (
  (customer_id = (select auth.uid()) and status in ('requested', 'inspection_requested'))
  or (select private.my_role()) = 'admin'
)
with check (
  (customer_id = (select auth.uid()) and status = 'withdrawn')
  or (select private.my_role()) = 'admin'
);

-- request_photos: eigene Anfrage, solange sie offen ist; höchstens 8 je Anfrage.
grant select, delete on public.request_photos to authenticated;
grant insert (request_id, storage_path) on public.request_photos to authenticated;

create policy request_photos_select on public.request_photos for select to authenticated
using (
  exists (
    select 1 from public.service_requests r
    where r.id = request_id and r.customer_id = (select auth.uid())
  )
  or (select private.my_role()) = 'admin'
);

create policy request_photos_insert on public.request_photos for insert to authenticated
with check (
  exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
  and starts_with(storage_path, (select auth.uid())::text || '/' || request_id::text || '/')
  and (select count(*) from public.request_photos p where p.request_id = request_photos.request_id) < 8
);

create policy request_photos_delete on public.request_photos for delete to authenticated
using (
  exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
);

-- rental_offers: alle sehen freigegebene; Vermieter legen eigene an und ändern sie.
-- status, is_demo und provider_id sind nicht freigegeben: Freigabe setzt admin im Dashboard.
grant select on public.rental_offers to anon, authenticated;
grant insert (
  provider_name, name, station, size_m3, daily_cents, km_per_day, extra_km_cents, cover_daily_cents,
  excess_cents, cover_excess_cents, driver_daily_cents, booking_fee_cents, one_way_cents, deposit_cents
) on public.rental_offers to authenticated;
grant update (
  provider_name, name, station, size_m3, daily_cents, km_per_day, extra_km_cents, cover_daily_cents,
  excess_cents, cover_excess_cents, driver_daily_cents, booking_fee_cents, one_way_cents, deposit_cents
) on public.rental_offers to authenticated;

create policy rental_offers_select_anon on public.rental_offers for select to anon
using (status = 'approved');

create policy rental_offers_select on public.rental_offers for select to authenticated
using (
  status = 'approved'
  or provider_id = (select auth.uid())
  or (select private.my_role()) = 'admin'
);

create policy rental_offers_insert on public.rental_offers for insert to authenticated
with check (provider_id = (select auth.uid()) and (select private.my_role()) = 'rental_provider');

create policy rental_offers_update on public.rental_offers for update to authenticated
using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));

-- rental_bookings: wie service_requests.
grant select on public.rental_bookings to authenticated;
grant update (status) on public.rental_bookings to authenticated;

create policy rental_bookings_select on public.rental_bookings for select to authenticated
using (customer_id = (select auth.uid()) or (select private.my_role()) = 'admin');

create policy rental_bookings_update on public.rental_bookings for update to authenticated
using (
  (customer_id = (select auth.uid()) and status = 'requested')
  or (select private.my_role()) = 'admin'
)
with check (
  (customer_id = (select auth.uid()) and status = 'withdrawn')
  or (select private.my_role()) = 'admin'
);

-- fee_splits: nur Zahlungsempfänger (Vermieter, später Partner) und admin lesen. Schreiben nur der Server.
grant select on public.fee_splits to authenticated;

create policy fee_splits_select on public.fee_splits for select to authenticated
using (payee_id = (select auth.uid()) or (select private.my_role()) = 'admin');

-- geo_boundaries: keine Rechte für anon/authenticated, nur die Edge Function route (service_role).

-- Storage: privater Bucket, Pfad {user_id}/{request_id}/{datei} ---------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create policy request_photos_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'request-photos'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.my_role()) = 'admin')
);

create policy request_photos_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.service_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
);

create policy request_photos_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
