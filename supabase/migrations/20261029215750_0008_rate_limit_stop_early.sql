-- 0008 Abgelehnte Aufrufe verbrauchen kein globales Kontingent mehr, und eine leere Grenze ist ungültig.
-- take_rate_tokens bricht beim ersten überschrittenen Zähler ab; die Function übergibt die IP-Zähler vor den globalen.

create or replace function public.take_rate_tokens(checks jsonb) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c jsonb;
  win timestamptz;
  n integer;
begin
  for c in select * from jsonb_array_elements(checks) loop
    win := to_timestamp(floor(extract(epoch from now()) / (c->>'window_seconds')::int) * (c->>'window_seconds')::int);
    insert into public.route_rate_limits as r (bucket, window_start, hits)
    values (c->>'bucket', win, 1)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning r.hits into n;
    if n > (c->>'max')::int then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.geo_boundaries
  add constraint geo_boundaries_geom_not_empty check (not extensions.ST_IsEmpty(geom));
