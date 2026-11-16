-- 0069 fh1 (OFFEN n12-2 Rest, Muster 0068): Wiederholung derselben Partei nach Erfolg liefert das erste Ergebnis statt 409 bei den fünf App-RPCs
-- withdraw, start_job, complete_job, withdraw_offer, withdraw_change. Alle Rümpfe wie die jeweils letzte Fassung (withdraw 0017:249, start_job und
-- complete_job 0064:67 und :90, withdraw_offer 0038:571, withdraw_change 0041:124), je ein Block mehr. Keine neue Funktion: `create or replace` lässt die
-- Rechte unverändert (kein neues EXECUTE für service_role). Ein Replay schreibt nichts (keine Outbox-Zeile, kein Audit, kein Statusereignis) und liegt
-- hinter der Prüfung von aal2 und Firma; das Statustor lässt `withdrawn`, `in_progress` und `completed` je Anfrage nur einmal zu (0049), `partner_withdrawn`
-- setzt nur withdraw_offer, die Audit-Zeile `withdraw_change` nur withdraw_change. Beweis der Partei: Statusereignis bzw. Audit mit dem Akteur (Person).
-- Ausnahme withdraw_offer: das Angebot trägt keinen Akteur, die Firma ist die Partei (jedes aal2-Mitglied der Firma, wie send_offer in 0068).

create or replace function public.withdraw(p_request uuid) returns public.request_status
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  st public.request_status;
begin
  if uid is null then
    raise exception 'not_found';
  end if;
  perform set_config('app.mv_transition', p_request::text || ':withdrawn', true);
  perform set_config('app.mv_actor', uid::text, true);
  perform set_config('app.mv_actor_role', 'customer', true);
  update public.service_requests s set status = 'withdrawn'
  where s.id = p_request and s.customer_id = uid and s.status in ('requested', 'awaiting_offer', 'offered')
  returning s.status into st;
  perform set_config('app.mv_transition', '', true);
  perform set_config('app.mv_actor', '', true);
  perform set_config('app.mv_actor_role', '', true);
  if st is null then
    if exists (select 1 from public.service_requests s where s.id = p_request and s.customer_id = uid) then
      -- fh1: dieselbe Person hat die Anfrage schon zurückgezogen (verlorene Antwort): derselbe Status, keine Wirkung
      if exists (select 1 from public.service_requests s where s.id = p_request and s.status = 'withdrawn')
         and exists (select 1 from public.status_events e where e.request_id = p_request and e.to_status = 'withdrawn' and e.actor_id = uid and e.actor_role = 'customer') then
        return 'withdrawn';
      end if;
      raise exception 'invalid_transition';
    end if;
    raise exception 'not_found';
  end if;
  return st;
end
$$;

create or replace function public.start_job(p_request uuid) returns void
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
  -- fh1: dieselbe Person hat den Auftrag schon gestartet (verlorene Antwort); auch wenn der Kunde dazwischen gemeldet hat
  if r.status = 'in_progress'
     and exists (select 1 from public.status_events e where e.request_id = p_request and e.to_status = 'in_progress' and e.actor_id = uid and e.actor_role = 'partner') then
    return;
  end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if r.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  if now() < r.termin_at then raise exception 'too_early'; end if;
  perform private.set_request_status(p_request, 'in_progress', uid, 'partner');
end
$$;

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
    -- fh1: derselbe Kunde hat schon bestätigt (verlorene Antwort)
    if r.status = 'completed' and exists (select 1 from public.status_events e where e.request_id = p_request and e.to_status = 'completed' and e.actor_id = uid and e.actor_role = 'customer') then
      return;
    end if;
    if r.status not in ('accepted', 'in_progress') or now() < r.termin_at or r.not_done_reported_at is not null then raise exception 'invalid_transition'; end if;
    who := 'customer';
  else
    if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
    pid := private.my_job_partner_id();
    -- fh1: dieselbe Person der Firma hat schon abgeschlossen (verlorene Antwort); die Zuordnung ist dann beendet, deshalb vor der Zuordnungsprüfung
    if pid is not null and r.status = 'completed'
       and exists (select 1 from public.status_events e where e.request_id = p_request and e.to_status = 'completed' and e.actor_id = uid and e.actor_role = 'partner')
       and exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_reason = 'completed') then
      return;
    end if;
    if pid is null or not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
      raise exception 'not_found';
    end if;
    if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
    if r.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
    who := 'partner';
  end if;
  perform private.set_request_status(p_request, 'completed', uid, who);
  update public.assignments set ended_at = now(), ended_reason = 'completed' where request_id = p_request and ended_at is null;
end
$$;

create or replace function public.withdraw_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  o public.partner_offers;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_member_partner_id();
  select * into o from public.partner_offers x where x.id = p_offer and x.partner_id = pid;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.service_requests s where s.id = o.request_id for update;
  select * into o from public.partner_offers x where x.id = p_offer for update;
  -- fh1: die Firma hat das Angebot schon zurückgezogen (verlorene Antwort); andere Enden (`partner_status`, `partner_not_active`, abgelaufen) bleiben invalid_transition
  if o.status = 'withdrawn' and o.end_reason = 'partner_withdrawn' then return; end if;
  if o.status <> 'sent' then raise exception 'invalid_transition'; end if;
  update public.partner_offers set status = 'withdrawn', end_reason = 'partner_withdrawn', decided_at = now() where id = p_offer;
  perform private.settle_offers(o.request_id);
end
$$;

create or replace function public.withdraw_change(p_revision uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  rev public.price_revisions;
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_member_partner_id();
  select * into rev from public.price_revisions v where v.id = p_revision and v.source = 'change_order' and v.proposed_by = pid;
  if pid is null or not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = rev.request_id for update;
  select * into rev from public.price_revisions v where v.id = p_revision for update;
  -- fh1: dieselbe Person hat den Nachtrag schon zurückgezogen (verlorene Antwort): der Audit trägt den Akteur; kein zweiter Audit, keine zweite Outbox-Zeile
  if rev.status = 'withdrawn'
     and exists (select 1 from public.audit_log a where a.action = 'withdraw_change' and a.entity = 'revision' and a.entity_id = rev.id::text and a.actor_id = uid) then
    return;
  end if;
  if rev.status <> 'proposed' then raise exception 'invalid_transition'; end if;
  perform set_config('app.mv_change', rev.id::text || ':withdrawn', true);
  update public.price_revisions set status = 'withdrawn', decided_at = now() where id = rev.id;
  perform set_config('app.mv_change', '', true);
  perform private.outbox_put('change_withdrawn', 'customer', r.customer_id, r.id, 'change_withdrawn:' || rev.id);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'partner', 'withdraw_change', 'revision', rev.id::text, jsonb_build_object('request_id', r.id));
end
$$;
