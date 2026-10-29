-- 0007 Grenzen werden beim Schreiben repariert (ST_MakeValid) und müssen gültig sein.
-- Eine ungültige Geometrie würde ST_Difference/ST_Covers in route_geo_facts verfälschen.

create function private.geo_boundaries_make_valid() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.geom := extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_MakeValid(new.geom), 3));
  return new;
end;
$$;

create trigger geo_boundaries_make_valid
before insert or update of geom on public.geo_boundaries
for each row execute function private.geo_boundaries_make_valid();

alter table public.geo_boundaries
  add constraint geo_boundaries_geom_valid check (extensions.ST_IsValid(geom));
