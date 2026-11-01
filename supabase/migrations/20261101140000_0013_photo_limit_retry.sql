-- 0013 Wiederholen beim achten Foto: Ein Foto, dessen Zeile schon da ist, zählt nicht gegen das Limit; den Konflikt meldet dann der Primärschlüssel (23505).
create or replace function private.request_photos_before_insert() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.request_id::text, 0));
  if (select count(*) from public.request_photos where request_id = new.request_id and id <> new.id) >= 8 then
    raise exception 'Höchstens 8 Fotos je Anfrage' using errcode = 'check_violation';
  end if;
  new.storage_path := (select auth.uid())::text || '/' || new.request_id::text || '/' || new.id::text || '.jpg';
  return new;
end
$$;
