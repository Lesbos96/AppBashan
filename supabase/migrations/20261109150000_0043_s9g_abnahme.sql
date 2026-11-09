-- S9g-Abnahme: N1 Meldung und Bestätigung des Kunden schließen sich aus; N2 Fristen in festen Stunden (unabhängig von Sitzungszeitzone und Sommerzeit).

-- N1: Hat der Kunde „nicht stattgefunden“ gemeldet, bestätigt er nicht mehr „durchgeführt“ (admin entscheidet, S9h); die Meldung nach eigener Bestätigung entfällt.
create or replace function public.complete_job(p_request uuid) returns void
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
    if r.status not in ('accepted', 'in_progress') or now() < r.termin_at or r.not_done_reported_at is not null then raise exception 'invalid_transition'; end if;
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

create or replace function public.report_not_done(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if r.status not in ('accepted', 'in_progress', 'completed') then raise exception 'invalid_transition'; end if;
  if r.not_done_reported_at is not null then return; end if; -- einmal; der Zeitpunkt bleibt
  if exists (select 1 from public.status_events e where e.request_id = p_request and e.to_status = 'completed' and e.actor_role = 'customer') then
    raise exception 'invalid_transition';
  end if;
  if r.termin_at is null or now() < r.termin_at then raise exception 'too_early'; end if;
  if now() >= r.termin_at + make_interval(hours => 24 * private.setting_num('completion_days')::int) then raise exception 'report_window_closed'; end if;
  update public.service_requests set not_done_reported_at = now() where id = p_request;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'customer', 'report_not_done', 'service_request', p_request::text, '{}');
end
$$;

create or replace function public.complete_due() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  span interval := make_interval(hours => 24 * private.setting_num('completion_days')::int);
  r record;
  n int := 0;
begin
  insert into public.outbox (kind, recipient_kind, recipient_id, request_id, dedupe_key)
  select 'completion_ask', 'customer', s.customer_id, s.id, 'completion_ask:' || s.id
  from public.service_requests s
  where s.status in ('accepted', 'in_progress', 'completed') and s.not_done_reported_at is null
    and s.termin_at <= now() and now() < s.termin_at + span
    and not exists (select 1 from public.status_events e where e.request_id = s.id and e.to_status = 'completed' and e.actor_role = 'customer')
  on conflict (dedupe_key) do nothing;

  for r in
    select s.id, s.customer_id from public.service_requests s
    where s.status in ('accepted', 'in_progress') and s.not_done_reported_at is null and s.termin_at + span <= now()
    order by s.termin_at for update skip locked
  loop
    begin
      perform private.set_request_status(r.id, 'completed', null, 'system');
      update public.assignments set ended_at = now(), ended_reason = 'completed' where request_id = r.id and ended_at is null;
      perform private.outbox_put('completion_auto', 'customer', r.customer_id, r.id, 'completion_auto:' || r.id);
      n := n + 1;
    exception when others then
      raise warning 'complete_due_failed % %', r.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;
