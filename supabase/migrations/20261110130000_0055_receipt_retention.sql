-- 0055 Aufbewahrung der Belegfotos der Partner (s9h-4-nach, OPEN_ISSUES S9h4-3, Entscheidung Beks 2026-11-09).
-- Belege (job_photos.kind = 'receipt') fallen receipt_retention_days (365) nach dem Endstatus der Anfrage, auch bei gelöschtem
-- Kundenkonto. photo_retention_days (Originale, 90) bleibt. Die Zeile der Einstellung steht im Seed; fehlt sie, scheitert
-- photo_purge sichtbar mit setting_missing.

alter table public.platform_settings
  add constraint platform_settings_receipt_retention
  check (key <> 'receipt_retention_days' or (value = trunc(value) and value between 1 and 3650));

-- Wie 0054, dazu der letzte Zweig (Belege). Ohne Statusereignis gilt die Frist als nicht abgelaufen.
create or replace function public.photo_purge() returns table (bucket_id text, name text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  days int := private.setting_num('partner_access_days')::int;
  keep int := private.setting_num('photo_retention_days')::int;
  keep_receipt int := private.setting_num('receipt_retention_days')::int;
begin
  return query
  select u.bucket_id, u.name from (
    select o.bucket_id::text as bucket_id, o.name from storage.objects o
    where o.bucket_id = 'job-photos' and coalesce(o.created_at, '-infinity'::timestamptz) < now() - interval '1 hour'
      and not exists (select 1 from public.job_photos j where j.storage_path = o.name)
    union all
    select o.bucket_id::text, o.name from storage.objects o
    join public.job_photos j on j.storage_path = o.name and j.kind = 'request'
    join public.service_requests s on s.id = j.request_id
    join public.profiles pr on pr.id = s.customer_id
    where o.bucket_id = 'job-photos' and (
      pr.deleted_at is not null
      or s.status in ('withdrawn', 'expired', 'unmatched', 'declined')
      or (s.status in ('completed', 'cancelled_by_customer', 'cancelled_by_partner')
          and not exists (select 1 from public.assignments a where a.request_id = s.id
                          and (a.ended_at is null or a.ended_at > now() - make_interval(days => days))))
    )
    union all
    select o.bucket_id::text, o.name from storage.objects o
    where o.bucket_id = 'request-photos'
      and exists (select 1 from public.request_photos rp where rp.storage_path = o.name)
      and not exists (
        select 1 from public.request_photos rp
        join public.service_requests s on s.id = rp.request_id
        join public.profiles pr on pr.id = s.customer_id
        where rp.storage_path = o.name and pr.deleted_at is null and s.status <> 'withdrawn'
          and not (
            s.status in ('expired', 'unmatched', 'declined', 'completed', 'cancelled_by_customer', 'cancelled_by_partner')
            and coalesce((select max(e.at) from public.status_events e where e.request_id = s.id and e.to_status = s.status), 'infinity'::timestamptz)
                < now() - make_interval(days => keep)
          )
      )
    union all
    select o.bucket_id::text, o.name from storage.objects o
    join public.job_photos j on j.storage_path = o.name and j.kind = 'receipt'
    join public.service_requests s on s.id = j.request_id
    where o.bucket_id = 'job-photos'
      and s.status in ('completed', 'withdrawn', 'expired', 'declined', 'unmatched', 'cancelled_by_customer', 'cancelled_by_partner')
      and coalesce((select max(e.at) from public.status_events e where e.request_id = s.id and e.to_status = s.status), 'infinity'::timestamptz)
          < now() - make_interval(days => keep_receipt)
  ) u limit 1000;
end
$$;
