-- 0014 Foto-Aufräumen meldet fehlende Einrichtung laut statt still (S8b-3 Nachtrag).
-- Ohne Vault-Secrets blieben Dateien gelöschter Anfragen und Konten unbegrenzt liegen. Der Job schlägt dann fehl
-- (cron.job_run_details: failed); die Zeilen-Bereinigung wird mit zurückgerollt, die Fehlkonfiguration muss auffallen.
create or replace function public.photo_cleanup() returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  secret text;
  url text;
begin
  delete from public.request_photos p
  where p.created_at < now() - interval '48 hours'
    and not exists (select 1 from storage.objects o where o.bucket_id = 'request-photos' and o.name = p.storage_path);

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cleanup_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'cleanup_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then
    raise exception 'photo_cleanup nicht eingerichtet: Vault-Secrets cleanup_secret/cleanup_url fehlen (npm run setup:photo-cleanup)';
  end if;
  perform net.http_post(url := url, headers := jsonb_build_object('x-cleanup-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 60000);
end
$$;
