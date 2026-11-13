-- s9i-7b2 D: Kontaktsperre nach Storno durch die Firma (OPEN_ISSUES S9i7-10 c, für diese Art von Storno).
-- Nach `cancelled_by_partner` bleibt job_contact nur offen, wenn die Firma eine Pauschale fordern darf: Summe der Zeile `cancellation_fee`
-- und ihrer Gegenbuchungen > 0 (dieselbe Rechnung wie my_cancel_info, 0059). Dann gilt wie bisher das Zugriffsfenster (partner_access_days).
-- Ohne Pauschale ist job_contact sofort gesperrt. Andere Arten der Beendigung (Kunde, Abschluss) bleiben unverändert.
-- private.assignment_access wird nicht angefasst: Fotos, Listings und my_jobs behalten ihr Fenster.

create function private.partner_cancel_fee_due(p_request uuid, p_partner uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(e.total_cents), 0) > 0
  from public.commission_entries e
  where e.request_id = p_request and e.partner_id = p_partner
    and (e.kind = 'cancellation_fee'
         or e.reverses_entry_id in (select f.id from public.commission_entries f
                                    where f.request_id = p_request and f.partner_id = p_partner and f.kind = 'cancellation_fee'))
$$;

revoke all on function private.partner_cancel_fee_due(uuid, uuid) from public, anon, authenticated;

-- Körper wie 0032, dazu die Sperre nach der Prüfung des Zugriffsfensters und vor der Audit-Zeile
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
  if not private.assignment_access(p_request, pid) then raise exception 'not_assigned'; end if;
  if exists (select 1 from public.assignments a
             where a.request_id = p_request and a.partner_id = pid and a.ended_reason = 'cancelled_by_partner')
     and not private.partner_cancel_fee_due(p_request, pid) then
    raise exception 'not_assigned';
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'partner', 'contact_read', 'service_request', p_request::text, jsonb_build_object('partner_id', pid));
  return query
    select c.name, c.phone, c.email, c.stairs_door, r.from_address, r.to_address, r.preferred_date, r.time_window
    from public.request_contacts c join public.service_requests r on r.id = c.request_id
    where c.request_id = p_request;
end
$$;

revoke all on function public.job_contact(uuid) from public, anon;
grant execute on function public.job_contact(uuid) to authenticated;
