-- 0012 storage_path hat einen Standardwert, damit der Client es nicht senden muss; der Trigger aus 0011 überschreibt ihn immer.
alter table public.request_photos alter column storage_path set default '';
