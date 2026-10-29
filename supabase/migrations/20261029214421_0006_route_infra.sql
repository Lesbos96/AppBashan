-- 0006 Routing-Infrastruktur (S5): Cache, Rate-Limit und Geo-Fakten für die Edge Function `route`.
-- Alles nur für service_role: RLS an, keine Policies, Rechte von anon/authenticated widerrufen.
-- Die Grenzgeometrien selbst kommen nicht aus Migrationen, sondern aus `npm run geo:import`.

-- Routen-Cache: Rohantwort des Anbieters (Distanzen, Dauer, Geometrie), keine Adresstexte. TTL setzt die Function.
create table public.route_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);
create index route_cache_expires_idx on public.route_cache (expires_at);

-- Zähler je Bucket (gehashte IP bzw. global) und Zeitfenster.
create table public.route_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
create index route_rate_limits_window_idx on public.route_rate_limits (window_start);

alter table public.route_cache enable row level security;
alter table public.route_rate_limits enable row level security;
revoke all on public.route_cache, public.route_rate_limits from anon, authenticated;

-- Prüft mehrere Zähler in einem Aufruf. checks: [{bucket, max, window_seconds}].
-- Jeder Aufruf zählt (auch abgelehnte); false, sobald ein Zähler sein Maximum überschreitet.
create function public.take_rate_tokens(checks jsonb) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c jsonb;
  win timestamptz;
  n integer;
  allowed boolean := true;
begin
  for c in select * from jsonb_array_elements(checks) loop
    win := to_timestamp(floor(extract(epoch from now()) / (c->>'window_seconds')::int) * (c->>'window_seconds')::int);
    insert into public.route_rate_limits as r (bucket, window_start, hits)
    values (c->>'bucket', win, 1)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning r.hits into n;
    if n > (c->>'max')::int then
      allowed := false;
    end if;
  end loop;
  return allowed;
end;
$$;

-- Fakten zu einer Route aus den Grenzen: km außerhalb Wiens (volle Geometrie, LineString als GeoJSON)
-- und ob Abholung bzw. Ziel in Österreich liegen. Fehlt eine Grenze, bricht die Funktion ab:
-- nie stillschweigend „Wien" (billiger).
create function public.route_geo_facts(
  line_geojson text,
  from_lat double precision, from_lon double precision,
  to_lat double precision, to_lon double precision
) returns table (outside_km double precision, from_in_austria boolean, to_in_austria boolean)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  vienna extensions.geometry;
  austria extensions.geometry;
  line extensions.geometry;
begin
  select geom into vienna from public.geo_boundaries where slug = 'vienna';
  select geom into austria from public.geo_boundaries where slug = 'austria';
  if vienna is null or austria is null then
    raise exception 'Grenze fehlt (vienna/austria): npm run geo:import' using errcode = 'P0002';
  end if;
  line := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(line_geojson), 4326);
  return query select
    extensions.ST_Length(extensions.ST_Difference(line, vienna)::extensions.geography) / 1000.0,
    extensions.ST_Covers(austria, extensions.ST_SetSRID(extensions.ST_MakePoint(from_lon, from_lat), 4326)),
    extensions.ST_Covers(austria, extensions.ST_SetSRID(extensions.ST_MakePoint(to_lon, to_lat), 4326));
end;
$$;

revoke all on function public.take_rate_tokens(jsonb) from public, anon, authenticated;
revoke all on function public.route_geo_facts(text, double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.take_rate_tokens(jsonb) to service_role;
grant execute on function public.route_geo_facts(text, double precision, double precision, double precision, double precision)
  to service_role;

-- Täglich abgelaufene Cache-Zeilen und alte Zähler löschen.
create extension if not exists pg_cron;
select cron.schedule(
  'route-cleanup',
  '17 3 * * *',
  $$delete from public.route_cache where expires_at < now();
    delete from public.route_rate_limits where window_start < now() - interval '2 days'$$
);
