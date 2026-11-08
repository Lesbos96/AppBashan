-- S9d-3: Befunde der Abnahme (tmp/proof/s9d-abnahme.md).
-- M1: admin_photo und job_photo_list liefern nur Dateien, die im Bucket noch liegen (das Aufräumen löscht Dateien, die Zeilen bleiben).
-- M2: Ein Ausfall der Pipeline (attempts_exhausted) löst keine Kundenmail aus; die Mail bleibt für Fehler des Fotos selbst.
-- N2: Ein fehlerhafter Auftrag hält den Claim nicht an. N4: photo_claim gehört nur dem Cron (Eigentümer), service_role verliert EXECUTE.

-- M2 ----------------------------------------------------------------------------------------------------------------------------
create or replace function private.photo_settle(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
begin
  select * into r from public.service_requests s where s.id = p_request;
  if not found or private.photos_pending(p_request) then return; end if;
  -- Mail nur bei einem Fehler des Fotos (kein JPEG, zu groß, …), nicht wenn die Pipeline selbst ausfiel (attempts_exhausted)
  if r.status in ('requested', 'awaiting_offer')
     and exists (select 1 from public.job_photos j where j.request_id = p_request and j.kind = 'request' and j.status = 'failed'
                 and j.error_code is distinct from 'attempts_exhausted') then
    perform private.outbox_put('photo_failed', 'customer', r.customer_id, p_request, 'photo_failed:' || p_request);
  end if;
  perform public.distribute_request(p_request);
end
$$;

-- N2, N4 ------------------------------------------------------------------------------------------------------------------------
create or replace function public.photo_claim(p_limit int) returns table (job_photo_id uuid, attempt int)
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  ph record;
  jp public.job_photos;
  n int := 0;
  cap int := greatest(1, least(p_limit, 50));
begin
  for r in
    select s.id from public.service_requests s
    where s.status in ('requested', 'awaiting_offer') and s.accept_deadline > now() and private.photo_work(s.id)
    order by s.created_at, s.id for update of s skip locked
  loop
    exit when n >= cap;
    for ph in select rp.id from public.request_photos rp where rp.request_id = r.id order by rp.created_at, rp.id loop
      select * into jp from public.job_photos j where j.source_photo_id = ph.id for update;
      if not found then
        insert into public.job_photos (request_id, kind, source_photo_id, status, attempts, lease_until)
        values (r.id, 'request', ph.id, 'pending', 1, now() + interval '3 minutes') returning * into jp;
      elsif jp.status = 'pending' and jp.lease_until <= now() then
        if jp.attempts >= 3 then
          update public.job_photos set status = 'failed', error_code = 'attempts_exhausted', lease_until = null, decided_at = now() where id = jp.id;
          continue;
        end if;
        update public.job_photos set attempts = jp.attempts + 1, lease_until = now() + interval '3 minutes' where id = jp.id returning * into jp;
      else
        continue;
      end if;
      job_photo_id := jp.id;
      attempt := jp.attempts;
      n := n + 1;
      return next;
    end loop;
    begin
      perform private.photo_settle(r.id);
    exception when others then
      raise warning 'photo_settle_failed % %', r.id, sqlstate;
    end;
  end loop;
end
$$;

revoke execute on function public.photo_claim(int) from service_role;

-- M1 ----------------------------------------------------------------------------------------------------------------------------
create or replace function public.job_photo_list(p_actor uuid, p_aal text, p_listing uuid default null, p_request uuid default null)
returns table (id uuid, kind text, storage_path text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  pid uuid;
  pst public.partner_status;
begin
  if p_actor is null or (p_listing is null) = (p_request is null) then raise exception 'bad_request'; end if;
  if p_listing is not null then
    if p_aal is distinct from 'aal2' then raise exception 'mfa_required'; end if;
    select * into l from public.job_listings x where x.id = p_listing;
    select m.partner_id into pid from public.partner_members m where m.user_id = p_actor;
    if l.id is null or pid is distinct from l.partner_id then raise exception 'not_found'; end if;
    select p.status into pst from public.partners p where p.id = pid;
    select * into r from public.service_requests s where s.id = l.request_id;
    if r.customer_id = p_actor then raise exception 'not_found'; end if;
    if l.status = 'open' and l.accept_deadline > now() and pst = 'active' and private.in_scope(l.partner_id, l.service, l.district) then
      return query select j.id, j.kind, j.storage_path from public.job_photos j
        where j.request_id = l.request_id and j.kind = 'request' and j.status = 'ready'
          and exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path)
        order by j.created_at, j.id;
    elsif l.status = 'accepted' and pst in ('active', 'payment_hold') and private.assignment_access(l.request_id, l.partner_id) then
      return query select j.id, j.kind, j.storage_path from public.job_photos j
        where j.request_id = l.request_id and j.status = 'ready'
          and exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path)
        order by j.created_at, j.id;
    else
      raise exception 'not_found';
    end if;
  else
    select * into r from public.service_requests s where s.id = p_request and s.customer_id = p_actor;
    if not found then raise exception 'not_found'; end if;
    return query select j.id, j.kind, j.storage_path from public.job_photos j
      where j.request_id = p_request and j.kind = 'receipt' and j.status = 'ready'
        and exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path)
      order by j.created_at, j.id;
  end if;
end
$$;

create or replace function public.admin_photo(p_actor uuid, p_request uuid, p_reason text) returns table (bucket_id text, storage_path text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reason_required'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'admin_photo_read', 'service_request', p_request::text, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return query
    select 'request-photos'::text, rp.storage_path from public.request_photos rp
      where rp.request_id = p_request
        and exists (select 1 from storage.objects o where o.bucket_id = 'request-photos' and o.name = rp.storage_path)
    union all
    select 'job-photos'::text, j.storage_path from public.job_photos j
      where j.request_id = p_request and j.status = 'ready'
        and exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path);
end
$$;
