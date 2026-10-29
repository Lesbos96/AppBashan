-- 0009 Löschung der Routing-Daten (S5b): Cache-Zeilen enthalten Routenkoordinaten, Zähler gehashte IPs.
-- Stündlicher Job statt täglich: Cache (TTL 24 h) verschwindet spätestens nach 25 h, Zähler nach 2 Tagen.
create function public.route_cleanup() returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.route_cache where expires_at < now();
  delete from public.route_rate_limits where window_start < now() - interval '2 days';
$$;

revoke all on function public.route_cleanup() from public, anon, authenticated;
grant execute on function public.route_cleanup() to service_role;

-- Gleicher Jobname ersetzt den täglichen Job aus 0006.
select cron.schedule('route-cleanup', '17 * * * *', 'select public.route_cleanup()');
