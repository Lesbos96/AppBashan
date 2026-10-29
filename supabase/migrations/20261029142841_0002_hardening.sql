-- 0002 Härtung nach dem S1-Review: Storage-Regeln wie bei request_photos, Wertebereiche.

-- Upload nur in eigene offene Anfrage, höchstens 8 Dateien je Anfrage-Ordner.
-- Im Unterselect ist „objects.name" die neue Datei, „o.name" die vorhandenen.
drop policy request_photos_objects_insert on storage.objects;
create policy request_photos_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.service_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
  and (
    select count(*) from storage.objects o
    where o.bucket_id = 'request-photos'
      and (storage.foldername(o.name))[2] = (storage.foldername(objects.name))[2]
  ) < 8
);

-- Löschen nur, solange die eigene Anfrage offen ist (wie request_photos_delete).
drop policy request_photos_objects_delete on storage.objects;
create policy request_photos_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'request-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.service_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.customer_id = (select auth.uid())
      and r.status in ('requested', 'inspection_requested')
  )
);

alter table public.platform_settings
  add constraint rate_range check (key not in ('fee_rate', 'fee_vat_rate') or value between 0 and 1);

alter table public.price_config
  add constraint cent_whole check (unit not like 'cent%' or value = trunc(value));

alter table public.fee_splits
  add constraint non_negative check (fee_cents >= 0 and fee_net_cents >= 0 and fee_vat_cents >= 0 and payout_cents >= 0);
