-- 0011 Foto-Uploads (S8b-3): Pfad und Limit serverseitig, nur JPEG im Bucket, Aufräumen verwaister Dateien.

-- Pfad und Limit setzt der Server. Der Client liefert nur id und request_id; Dateiname und Ordner kann er nicht wählen.
-- Das Limit zählt unter einem Lock je Anfrage (eigene Anweisung, damit READ COMMITTED danach frisch zählt).
create function private.request_photos_before_insert() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.request_id::text, 0));
  if (select count(*) from public.request_photos where request_id = new.request_id) >= 8 then
    raise exception 'Höchstens 8 Fotos je Anfrage' using errcode = 'check_violation';
  end if;
  new.storage_path := (select auth.uid())::text || '/' || new.request_id::text || '/' || new.id::text || '.jpg';
  return new;
end
$$;

create trigger request_photos_before_insert before insert on public.request_photos
for each row execute function private.request_photos_before_insert();

revoke insert on public.request_photos from authenticated;
grant insert (id, request_id) on public.request_photos to authenticated;

drop policy request_photos_insert on public.request_photos;
create policy request_photos_insert on public.request_photos for insert to authenticated
with check (
  exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
  and starts_with(storage_path, (select auth.uid())::text || '/' || request_id::text || '/')
);

drop function private.photo_count(uuid);

-- Der Client kodiert immer zu JPEG; PNG und WebP sind nur als Eingabe erlaubt.
update storage.buckets set allowed_mime_types = array['image/jpeg'] where id = 'request-photos';

-- Aufräumen. Objekte ohne Zeile (Fehl-Uploads, gelöschte Anfragen und Konten) entfernt die Edge Function `photo-cleanup`
-- über die Storage-API (ein DELETE auf storage.objects ließe die Datei liegen). Sie liest die Namen hier.
create function public.photo_orphans() returns table (name text)
language sql stable security invoker set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.created_at < now() - interval '1 hour'
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
  limit 1000
$$;

revoke all on function public.photo_orphans() from public, anon, authenticated;
grant execute on function public.photo_orphans() to service_role;

-- Stündlich: Zeilen ohne Datei nach 48 h löschen, dann die Edge Function anstoßen. Secret und URL stehen im Vault
-- (Einmal-Befehl, nicht in einer Migration); fehlen sie, läuft nur der SQL-Teil.
create extension if not exists pg_net;

create function public.photo_cleanup() returns void
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
  if secret is not null and url is not null then
    perform net.http_post(url := url, headers := jsonb_build_object('x-cleanup-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb);
  end if;
end
$$;

revoke all on function public.photo_cleanup() from public, anon, authenticated;
grant execute on function public.photo_cleanup() to service_role;

select cron.schedule('photo-cleanup', '23 * * * *', 'select public.photo_cleanup()');
