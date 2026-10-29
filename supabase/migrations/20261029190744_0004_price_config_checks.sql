-- 0004 Tarife: Wertebereich und „aktuelle Version".

alter table public.price_config
  add constraint price_config_value_nonneg check (value >= 0);

-- Aktuell = höchste Version, die ab heute (Wiener Datum) gilt. admin legt neue Versionen mit
-- künftigem effective_on an, trägt erst die Zeilen ein und schaltet damit ab dem Datum um.
-- App und Edge Function quote lesen nur diese View (security_invoker: RLS des Aufrufers).
create view public.current_price_version with (security_invoker = true) as
select version, effective_on
from public.price_versions
where effective_on <= (now() at time zone 'Europe/Vienna')::date
order by version desc
limit 1;

grant select on public.current_price_version to anon, authenticated;
