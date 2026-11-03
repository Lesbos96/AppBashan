-- 0022 Kein Selbst-Upgrade zur Vermieter-Rolle in Phase 1 (S9a-4c, Berater H-1; S9_KONZEPT 3: „ohne Selbst-Hochstufung“),
-- Staging-Zählung über einen Indexbereich (Berater N-8, EXPLAIN in tmp/proof/s9a4c-explain.log).

-- 1. become_rental_provider entfällt: jedes Konto konnte sich damit zum rental_provider machen und über platform_settings_select
--    den Gebührensatz lesen. Die Vermieter-Rolle setzt nur noch der Datenbank-Eigentümer (admin_grant_role, mit Journal).
--    Phase 2 / S9b führt Vermieter als Partner der Kategorie rental ein.
drop function public.become_rental_provider();

-- 2. Zählung der eigenen, nicht übernommenen Staging-Dateien: Bereich [uid/, uid0) in C-Kollation statt Pattern-Vergleich
--    ('0' folgt auf '/'); der Präfix ist erst zur Laufzeit bekannt, der Pattern-Vergleich lief als Seq Scan, der Bereich nutzt den Index
--    (bucket_id, name). create or replace behält Eigentümer und Rechte (nur authenticated).
create or replace function private.staging_photo_count() returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name >= ((select auth.uid())::text || '/') collate "C"
    and o.name < ((select auth.uid())::text || '0') collate "C"
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
$$;
