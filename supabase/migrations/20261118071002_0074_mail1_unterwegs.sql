-- 0074 mail1: Mailversand über Brevo, Mail an den Betreiber (ENTSCHEIDUNGEN Nr. 175) und „Unterwegs“ (OFFEN web1-1, Nr. 203).
-- 1. Unterwegs: ein Ereignis mit Ankunftszeit je Auftrag, kein neuer Status. Die Spalte setzt nur set_en_route (der Kunde liest die eigene Zeile,
--    UPDATE hat kein Konto).
-- 2. Outbox: neue Arten en_route und report_new, Empfänger `operator` (Betreiber, ohne Empfänger-ID), Wiederholung mit wachsendem Abstand.

alter table public.service_requests add column en_route_eta timestamptz;

-- set_en_route: Muster start_job (0069). Der Server rechnet die Ankunftszeit (Minuten nur 15, 30, 45, 60). Wiederholung derselben Firma liefert die
-- gespeicherte Zeit ohne zweite Wirkung (auch nach dem Start); eine fremde Firma kommt an der Zuordnung nicht vorbei.
create function public.set_en_route(p_request uuid, p_minutes int) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  r public.service_requests;
  v_eta timestamptz;
begin
  if p_minutes is null or p_minutes not in (15, 30, 45, 60) then raise exception 'invalid_minutes'; end if;
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found or not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
    raise exception 'not_assigned';
  end if;
  if r.en_route_eta is not null then return r.en_route_eta; end if;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if r.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  if (r.termin_at at time zone 'Europe/Vienna')::date <> (now() at time zone 'Europe/Vienna')::date then raise exception 'wrong_day'; end if;
  v_eta := now() + make_interval(mins => p_minutes);
  update public.service_requests set en_route_eta = v_eta where id = p_request;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'partner', 'set_en_route', 'service_request', p_request::text, jsonb_build_object('minutes', p_minutes));
  perform private.outbox_put('en_route', 'customer', r.customer_id, p_request, 'en_route:' || p_request::text);
  return v_eta;
end
$$;

grant execute on function public.set_en_route(uuid, int) to authenticated;

-- my_jobs: neue letzte Spalten en_route_eta und can_en_route (der Server rechnet den Wiener Termintag, die App nicht). Rückgabetyp ändert sich:
-- neu anlegen, Rechte wie 0064 (service_role ohne, 0066).
drop function public.my_jobs();
create function public.my_jobs()
returns table (
  assignment_id uuid,
  request_id uuid,
  listing_id uuid,
  status public.request_status,
  termin_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz,
  ended_reason public.assignment_end,
  district smallint,
  to_district smallint,
  service public.service_type,
  preferred_date date,
  time_window text,
  total_cents bigint,
  payout_cents bigint,
  can_start boolean,
  under_review boolean,
  en_route_eta timestamptz,
  can_en_route boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  pid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  return query
    select a.id, a.request_id, l.id, r.status, r.termin_at, a.accepted_at, a.ended_at, a.ended_reason,
           r.district, l.to_district, r.service, r.preferred_date, r.time_window,
           j.total, j.payout,
           (a.ended_at is null and r.status = 'accepted' and now() >= r.termin_at and r.not_done_reported_at is null),
           (r.not_done_reported_at is not null and r.not_done_resolved_at is null),
           r.en_route_eta,
           (a.ended_at is null and r.status = 'accepted' and r.not_done_reported_at is null and r.en_route_eta is null
            and (r.termin_at at time zone 'Europe/Vienna')::date = (now() at time zone 'Europe/Vienna')::date)
    from public.assignments a
    join public.service_requests r on r.id = a.request_id
    left join public.job_listings l on l.request_id = a.request_id and l.partner_id = a.partner_id
    left join lateral (
      select sum(c.total_cents)::bigint as total, sum(c.payout_cents)::bigint as payout
      from public.commission_entries c
      where c.request_id = a.request_id and c.partner_id = a.partner_id
    ) j on true
    where a.partner_id = pid and private.assignment_access(a.request_id, pid)
    order by (a.ended_at is not null), r.termin_at, a.id;
end
$$;

grant execute on function public.my_jobs() to authenticated;

-- Outbox: Betreiber als Empfänger (recipient_id leer, genau dann), neue Arten.
alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed', 'offer_new', 'offer_confirmed', 'offer_withdrawn',
                  'change_proposed', 'change_accepted', 'change_declined', 'change_expired', 'change_withdrawn', 'completion_ask', 'completion_auto',
                  'request_cancelled', 'partner_cancelled', 'request_reissued', 'partner_cancelled_fee', 'en_route', 'report_new'));
alter table public.outbox drop constraint outbox_recipient_kind_check;
alter table public.outbox add constraint outbox_recipient_kind_check check (recipient_kind in ('customer', 'partner', 'operator'));
alter table public.outbox alter column recipient_id drop not null;
alter table public.outbox add constraint outbox_recipient_id_check check ((recipient_kind = 'operator') = (recipient_id is null));

-- Meldung „nicht stattgefunden“: Rumpf wie 0066, dazu die Mail an den Betreiber (Nr. 175). Rechte bleiben (create or replace).
create or replace function public.report_not_done(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
  why text;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.deleted_at is not null) then raise exception 'not_found'; end if;
  why := private.report_gate(r);
  if why = 'reported' then return; end if; -- einmal; der Zeitpunkt bleibt
  if why is not null then raise exception '%', why; end if;
  update public.service_requests set not_done_reported_at = now() where id = p_request;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'customer', 'report_not_done', 'service_request', p_request::text, '{}');
  perform private.outbox_put('report_new', 'operator', null, p_request, 'report_new:' || p_request::text);
end
$$;

-- Outbox-Wiederholung: Ein Fehlversuch behält `claimed_at`; eine `pending`-Zeile mit Versuchen wird erst nach 15 Minuten × 4^(Versuche − 1)
-- (15 Min., 1 Std., 4 Std., 16 Std.) erneut geholt. Eine kurze Störung des Anbieters verbraucht so nicht alle fünf Versuche.
create or replace function public.outbox_claim(p_limit int)
returns table (id bigint, kind text, recipient_kind text, recipient_id uuid, request_id uuid, partner_email text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.outbox_expire();
  return query
  with c as (
    select o.id from public.outbox o
    where o.attempts < 5
      and ((o.status = 'pending' and (o.attempts = 0 or o.claimed_at is null or o.claimed_at < now() - interval '15 minutes' * power(4, o.attempts - 1)::float8))
           or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes'))
    order by o.id limit greatest(1, least(p_limit, 50)) for update skip locked
  ), u as (
    update public.outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1 from c where o.id = c.id
    returning o.id, o.kind, o.recipient_kind, o.recipient_id, o.request_id
  )
  select u.id, u.kind, u.recipient_kind, u.recipient_id, u.request_id, p.contact_email
  from u left join public.partners p on u.recipient_kind = 'partner' and p.id = u.recipient_id;
end
$$;

create or replace function public.outbox_mark(p_id bigint, p_ok boolean, p_error text) returns void
language sql security definer set search_path = ''
as $$
  update public.outbox o set
    status = case when p_ok then 'sent' when o.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    claimed_at = case when p_ok or o.attempts >= 5 then null else o.claimed_at end,
    last_error = case
      when p_ok then null
      when p_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient') then p_error
      else 'smtp_error'
    end
  where o.id = p_id and o.status = 'sending'
$$;
