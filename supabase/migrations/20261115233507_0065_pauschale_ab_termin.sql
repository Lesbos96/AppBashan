-- st1: Storno-Regeln aus der Beks-Runde 1 (ENTSCHEIDUNGEN Nr. 148 und 154).
-- 1. Nr. 148: Die Pauschale der Firma beim Storno gibt es erst ab Beginn des Termins (private.call_out_eligible, 0059:7).
--    Vor `termin_at` (oder ohne Termin) ist die Grundlage 0, die Firma sagt ohne Pauschale ab. Sonst unverändert: Grund `scope_impossible`
--    und letzter nicht zurückgezogener Nachtrag abgelehnt oder abgelaufen.
-- 2. Nr. 154: Nach jedem Storno ohne Pauschale (Firma oder Kunde, Summe der Zeile `cancellation_fee` samt Gegenbuchungen <= 0,
--    private.partner_cancel_fee_due, 0060:7) verliert die Firma Kontakt (job_contact) und Fotos (job_photo_list) sofort. Mit Pauschale gilt
--    weiter das Fenster partner_access_days. private.assignment_access bleibt unverändert: Listing, my_jobs und Nachträge behalten ihr Fenster.

-- 1. Pauschale erst ab Termin
create or replace function private.call_out_eligible(p_request uuid, p_reason text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_reason is not distinct from 'scope_impossible'
    and coalesce((select s.termin_at <= now() from public.service_requests s where s.id = p_request), false)
    and coalesce((select v.status in ('declined', 'expired') from public.price_revisions v
                  where v.request_id = p_request and v.source = 'change_order' and v.status <> 'withdrawn'
                  order by v.n desc limit 1), false)
$$;

-- 2. Zugriff der Firma auf Kontakt und Fotos: Zugriffsfenster und keine Sperre nach einem Storno ohne Pauschale
create function private.partner_data_access(p_request uuid, p_partner uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.assignment_access(p_request, p_partner)
    and not (exists (select 1 from public.assignments a
                     where a.request_id = p_request and a.partner_id = p_partner
                       and a.ended_reason in ('cancelled_by_customer', 'cancelled_by_partner'))
             and not private.partner_cancel_fee_due(p_request, p_partner))
$$;

revoke all on function private.partner_data_access(uuid, uuid) from public, anon, authenticated;

-- job_contact: Körper wie 0060:21, die Sperre nach Storno steckt jetzt in private.partner_data_access
create or replace function public.job_contact(p_request uuid)
returns table (name text, phone text, email text, stairs_door text, from_address text, to_address text, preferred_date date, time_window text)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  if not private.partner_data_access(p_request, pid) then raise exception 'not_assigned'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'partner', 'contact_read', 'service_request', p_request::text, jsonb_build_object('partner_id', pid));
  return query
    select c.name, c.phone, c.email, c.stairs_door, r.from_address, r.to_address, r.preferred_date, r.time_window
    from public.request_contacts c join public.service_requests r on r.id = c.request_id
    where c.request_id = p_request;
end
$$;

-- job_photo_list: Körper wie 0037:73, geändert nur der Zweig `accepted` (partner_data_access statt assignment_access)
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
    elsif l.status = 'accepted' and pst in ('active', 'payment_hold') and private.partner_data_access(l.request_id, l.partner_id) then
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
