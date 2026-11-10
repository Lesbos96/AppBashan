-- s9i-1: Buchungsschalter. `booking_open` (0 oder 1) in platform_settings; ohne Zeile ist die Buchung zu (fail closed).
-- Es entscheidet die Zeile mit der höchsten Version: offen nur bei Wert 1 und effective_from ≤ Wiener Datum. Eine künftig
-- datierte 1 kann ein späteres Schließen nicht überstimmen. Umschalten: admin_set_setting (nur service_role, Eintrag im audit_log).

alter table public.platform_settings
  add constraint platform_settings_booking check (key <> 'booking_open' or value in (0, 1));

-- security definer: Kunden und anon lesen platform_settings nicht; die Funktion gibt nur true/false aus.
create function public.booking_open() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.value = 1 and s.effective_from <= (now() at time zone 'Europe/Vienna')::date
       from public.platform_settings s where s.key = 'booking_open' order by s.version desc limit 1),
    false)
$$;

revoke all on function public.booking_open() from public;
grant execute on function public.booking_open() to anon, authenticated, service_role;
