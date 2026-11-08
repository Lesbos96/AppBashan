-- S9c-4: Zeitgesteuerte Läufe (pg_cron): Fristablauf (T7), Nachlauf der Verteilung, Versand der Outbox.
-- outbox_dispatch ruft die Edge Function outbox-send über pg_net. Ohne die Vault-Secrets outbox_url und outbox_secret (Einrichtung durch
-- Beks, SMTP-Zugang in den Function-Secrets) sendet nichts; die Zeilen bleiben `pending` und sind in public.outbox sichtbar.

create function public.outbox_dispatch() returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  secret text;
  url text;
begin
  if not exists (select 1 from public.outbox o where o.status = 'pending' and o.attempts < 5) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'outbox_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'outbox_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then return; end if;
  perform net.http_post(url := url, headers := jsonb_build_object('x-outbox-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000);
end
$$;

revoke all on function public.outbox_dispatch() from public, anon, authenticated;
grant execute on function public.outbox_dispatch() to service_role;

select cron.schedule('expire-requests', '* * * * *', 'select public.expire_requests()');
select cron.schedule('distribute-pending', '* * * * *', 'select public.distribute_pending()');
select cron.schedule('outbox-dispatch', '* * * * *', 'select public.outbox_dispatch()');
