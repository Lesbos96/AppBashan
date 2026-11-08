-- S9c-3: Abwicklung zugeordneter Aufträge: start_job (T9), complete_job (T10), job_contact, my_job_partner, admin_contact.
-- Art B (Konzept 4.5): SECURITY DEFINER, Akteur aus auth.uid(), Compare-and-Set auf den Status, aal2 für Partner über die Helfer.

create function public.start_job(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found or not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
    raise exception 'not_assigned';
  end if;
  if r.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  if now() < r.termin_at then raise exception 'too_early'; end if;
  perform private.set_request_status(p_request, 'in_progress', uid, 'partner');
end
$$;

-- T10: Der Kunde bestätigt „durchgeführt“ frühestens ab termin_at, auch aus accepted; der Partner meldet nur aus in_progress.
create function public.complete_job(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  r public.service_requests;
  who text;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if r.customer_id = uid then
    if r.status not in ('accepted', 'in_progress') or now() < r.termin_at then raise exception 'invalid_transition'; end if;
    who := 'customer';
  else
    if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
    pid := private.my_job_partner_id();
    if pid is null or not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
      raise exception 'not_found';
    end if;
    if r.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
    who := 'partner';
  end if;
  perform private.set_request_status(p_request, 'completed', uid, who);
  update public.assignments set ended_at = now(), ended_reason = 'completed' where request_id = p_request and ended_at is null;
end
$$;

-- Kontakt und Adresse für die zugeordnete Firma (aal2, Zugriff bis partner_access_days nach Ende), jeder Zugriff protokolliert.
create function public.job_contact(p_request uuid)
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
  if not private.assignment_access(p_request, pid) then raise exception 'not_assigned'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'partner', 'contact_read', 'service_request', p_request::text, jsonb_build_object('partner_id', pid));
  return query
    select c.name, c.phone, c.email, c.stairs_door, r.from_address, r.to_address, r.preferred_date, r.time_window
    from public.request_contacts c join public.service_requests r on r.id = c.request_id
    where c.request_id = p_request;
end
$$;

-- Firma und Kontakt für den Kunden des Auftrags, solange die Zuordnung besteht oder mit completed endete (Konzept 5.2).
create function public.my_job_partner(p_request uuid)
returns table (name text, contact_name text, contact_phone text, contact_email text)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not exists (select 1 from public.service_requests s where s.id = p_request and s.customer_id = uid) then
    raise exception 'not_assigned';
  end if;
  return query
    select p.name, p.contact_name, p.contact_phone, p.contact_email
    from public.assignments a join public.partners p on p.id = a.partner_id
    where a.request_id = p_request and (a.ended_at is null or a.ended_reason = 'completed');
  if not found then raise exception 'not_assigned'; end if;
end
$$;

-- Support: admin liest den Kontakt nur mit Begründung und Audit (Konzept 7.2). p_actor kommt aus dem geprüften JWT (aal2 prüft die Edge Function).
create function public.admin_contact(p_actor uuid, p_request uuid, p_reason text)
returns table (name text, phone text, email text, stairs_door text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reason_required'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'admin_contact_read', 'service_request', p_request::text, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return query select c.name, c.phone, c.email, c.stairs_door from public.request_contacts c where c.request_id = p_request;
end
$$;

revoke all on function public.start_job(uuid), public.complete_job(uuid), public.job_contact(uuid), public.my_job_partner(uuid) from public, anon;
grant execute on function public.start_job(uuid), public.complete_job(uuid), public.job_contact(uuid), public.my_job_partner(uuid) to authenticated;
revoke all on function public.admin_contact(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_contact(uuid, uuid, text) to service_role;
