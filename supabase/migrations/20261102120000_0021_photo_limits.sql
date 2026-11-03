-- 0021 Fotos vor dem Absenden, Nachzug (S9a-4b): kein Default mehr für storage_path, Mengengrenze für Staging-Uploads je Nutzer,
-- objects.name in den Policies qualifiziert (A-N7, A-N10, A-N8 aus der Abnahme S9a-4a).

-- 1. storage_path hat keinen Standardwert mehr. Ein Insert ohne Pfad lehnt der Trigger ab (photo_insert_forbidden, P0001); NOT NULL (23502)
-- ist die zweite Schicht. Der Trigger prüft den Pfad jetzt auch auf NULL (ein NULL-Vergleich ließe die Zeile sonst bis zu NOT NULL durch).
alter table public.request_photos alter column storage_path drop default;

create or replace function private.guard_photo_insert() returns trigger
language plpgsql set search_path = ''
as $$
declare
  rq public.service_requests;
begin
  if current_setting('app.mv_photo_request', true) is distinct from new.request_id::text then
    raise exception 'photo_insert_forbidden';
  end if;
  select * into rq from public.service_requests s where s.id = new.request_id;
  if not found or new.storage_path is null or not starts_with(new.storage_path, rq.customer_id::text || '/' || rq.client_ref::text || '/') then
    raise exception 'photo_insert_forbidden';
  end if;
  if (select count(*) from public.request_photos p where p.request_id = new.request_id) >= 8 then
    raise exception 'too_many_photos';
  end if;
  return new;
end
$$;

-- 2. Mengengrenze: höchstens 40 eigene, noch nicht übernommene Dateien im Bucket (fünf Anfragen à 8 Fotos). Übernommene Dateien (Zeile in
-- request_photos) zählen nicht, sonst wäre ein Konto nach 40 gesendeten Fotos dauerhaft gesperrt; Staging-Reste verschwinden mit photo_cleanup
-- nach photo_staging_hours (plus Karenz), eigene Staging-Dateien kann der Kunde jederzeit löschen. Die Grenze ist weich: parallele Uploads sehen
-- denselben Stand und können sie überschreiten; neue Konten haben je ein eigenes Kontingent. Sie schützt vor Kosten, nicht vor Datenzugriff.
-- Eine Policy auf storage.objects darf storage.objects nicht selbst per Unterabfrage lesen (42P17, wie 0003): Zählung über SECURITY DEFINER,
-- die uid kommt aus auth.uid(), nie aus einem Parameter.
create function private.staging_photo_count() returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name like (select auth.uid())::text || '/%'
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
$$;

revoke all on function private.staging_photo_count() from public, anon;
grant execute on function private.staging_photo_count() to authenticated;

alter policy request_photos_objects_insert on storage.objects
with check (
  bucket_id = 'request-photos'
  and objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.service_requests r
    where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(objects.name))[2]
  )
  and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)
  and (select private.staging_photo_count()) < 40
);

-- 3. Delete-Policy: unverändert bis auf die qualifizierten Spalten (A-N8).
alter policy request_photos_objects_delete on storage.objects
using (
  bucket_id = 'request-photos'
  and objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.service_requests r
    where r.customer_id = (select auth.uid()) and r.client_ref::text = (storage.foldername(objects.name))[2]
  )
  and not exists (select 1 from public.request_photos p where p.storage_path = objects.name)
);
