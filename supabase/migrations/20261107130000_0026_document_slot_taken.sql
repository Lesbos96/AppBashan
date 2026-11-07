-- 0026 Dokumente: eine entfernte Dokument-ID lässt sich nicht wiederverwenden, solange die Datei noch im Bucket liegt (Abnahme S9b-2, M1).
-- admin_remove_partner_document löscht nur die Zeile; die Datei entfernt der Eigentümer über die Storage-API. Legt die Firma danach eine Zeile
-- mit derselben, selbst gewählten id an, wäre der Pfad {partner_id}/{id} wieder ein gültiger Slot und die entfernte Datei gälte erneut
-- als Upload der Firma. Der Trigger lehnt das ab (slot_taken); Rechte der Funktion bleiben unverändert (create or replace).
create or replace function private.guard_document_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := private.my_member_partner_id();
  st public.partner_status;
  p text;
begin
  if pid is null then raise exception 'not_partner_member' using errcode = '42501'; end if;
  select status into st from public.partners where id = pid;
  if st not in ('pending', 'active', 'payment_hold') then raise exception 'partner_not_active'; end if;
  perform pg_advisory_xact_lock(hashtextextended('partner_documents:' || pid::text, 0));
  if (select count(*) from public.partner_documents where partner_id = pid) >= 5 then raise exception 'limit_reached'; end if;
  p := pid::text || '/' || new.id::text;
  if exists (select 1 from storage.objects o where o.bucket_id = 'partner-documents' and o.name = p) then raise exception 'slot_taken'; end if;
  new.partner_id := pid;
  new.storage_path := p;
  return new;
end
$$;
