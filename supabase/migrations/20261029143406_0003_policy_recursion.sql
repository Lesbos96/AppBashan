-- 0003 Policies ohne Selbstbezug. Eine Policy auf Tabelle X darf X nicht per Unterabfrage lesen
-- (Postgres 42P17, „infinite recursion detected in policy"). Daher:
-- 1. Fotos zählen über eine SECURITY-DEFINER-Funktion.
-- 2. Storage-Upload nur für Pfade, die vorher in request_photos eingetragen wurden.
--    Ablauf in der App: Eintrag anlegen (Limit 8 greift dort), dann Datei hochladen.

create function private.photo_count(request uuid) returns bigint
language sql stable security definer set search_path = ''
as $$ select count(*) from public.request_photos where request_id = request $$;

revoke all on function private.photo_count(uuid) from public;
grant execute on function private.photo_count(uuid) to authenticated;

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
  and private.photo_count(request_id) < 8
);

drop policy request_photos_objects_insert on storage.objects;
create policy request_photos_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.request_photos p
    join public.service_requests r on r.id = p.request_id
    where p.storage_path = name
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
);
