-- S9g: Abschluss und Export (Konzept 4.4 T15, 5.8, 8.5b, 9.5).
-- report_not_done (Art B, Kunde), complete_due (System: Frage nach dem Termin und T15), Abrechnungsmonat des Journals
-- (export_commissions für admin über service_role, my_commissions für die eigene Firma mit aal2).
-- Fehler: SQLSTATE P0001, Meldung = Code (not_found, invalid_transition, too_early, report_window_closed, month_required, mfa_required).

-- 1. Spalte, Einstellungsgrenze, Index ----------------------------------------------------------------------------------------------
alter table public.service_requests add column not_done_reported_at timestamptz;
create index service_requests_termin_idx on public.service_requests (termin_at);

alter table public.platform_settings
  add constraint platform_settings_s9g check (key <> 'completion_days' or (value = trunc(value) and value between 1 and 60));

-- 2. Mail-Arten (Texte ohne Gebühr in handlers.ts) ----------------------------------------------------------------------------------
alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed', 'offer_new', 'offer_confirmed', 'offer_withdrawn',
                  'change_proposed', 'change_accepted', 'change_declined', 'change_expired', 'change_withdrawn', 'completion_ask', 'completion_auto'));

-- 3. „Hat der Auftrag nicht stattgefunden?“ (8.5b). Setzt nur den Zeitstempel, kein Statuswechsel; admin prüft (T14, S9h). -------------
create function public.report_not_done(p_request uuid) returns void
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
  if r.termin_at is null or now() < r.termin_at then raise exception 'too_early'; end if;
  if now() >= r.termin_at + make_interval(days => private.setting_num('completion_days')::int) then raise exception 'report_window_closed'; end if;
  update public.service_requests set not_done_reported_at = now() where id = p_request;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'customer', 'report_not_done', 'service_request', p_request::text, '{}');
end
$$;

-- 4. System (alle 5 Minuten): Frage an den Kunden (Mail; die Liste zeigt sie über Status und Termin) und T15 ---------------------------
-- Frage: Fenster läuft (Termin bis Termin + completion_days), keine Meldung, der Kunde hat nicht selbst bestätigt; einmal je Auftrag (dedupe_key).
-- T15: accepted/in_progress, Termin + completion_days vorbei, keine Meldung → completed (Akteur system), Zuordnung endet completed.
create function public.complete_due() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  days int := private.setting_num('completion_days')::int;
  r record;
  n int := 0;
begin
  insert into public.outbox (kind, recipient_kind, recipient_id, request_id, dedupe_key)
  select 'completion_ask', 'customer', s.customer_id, s.id, 'completion_ask:' || s.id
  from public.service_requests s
  where s.status in ('accepted', 'in_progress', 'completed') and s.not_done_reported_at is null
    and s.termin_at <= now() and now() < s.termin_at + make_interval(days => days)
    and not exists (select 1 from public.status_events e where e.request_id = s.id and e.to_status = 'completed' and e.actor_role = 'customer')
  on conflict (dedupe_key) do nothing;

  for r in
    select s.id, s.customer_id from public.service_requests s
    where s.status in ('accepted', 'in_progress') and s.not_done_reported_at is null and s.termin_at + make_interval(days => days) <= now()
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

-- 5. Abrechnungsmonat (5.8): Monat (Europe/Vienna) von max(erster Endstatus aus status_events, created_at der Zeile). Aufträge ohne Endstatus
-- erscheinen noch nicht; spätere Wechsel (T14) verschieben nur ihre eigenen Gegenbuchungen. Keine Kundendaten. ---------------------------
create type public.commission_row as (
  entry_id uuid,
  request_id uuid,
  partner_id uuid,
  partner_name text,
  kind public.commission_kind,
  reverses_entry_id uuid,
  created_at timestamptz,
  total_cents bigint,
  fee_rate numeric,
  fee_net_cents bigint,
  fee_vat_cents bigint,
  fee_cents bigint,
  payout_cents bigint,
  vat_rule public.partner_vat_rule,
  request_status public.request_status,
  ended_at timestamptz,
  billing_month date
);

-- eine Stelle für beide Aufrufer; p_partner null = alle Firmen, p_month null = alle Monate
create function private.commission_rows(p_partner uuid, p_month date) returns setof public.commission_row
language sql stable security definer set search_path = ''
as $$
  select c.id, c.request_id, c.partner_id, p.name, c.kind, c.reverses_entry_id, c.created_at,
         c.total_cents, c.fee_rate, c.fee_net_cents, c.fee_vat_cents, c.fee_cents, c.payout_cents,
         c.vat_rule, r.status, d.ended_at, b.m
  from public.commission_entries c
  join public.service_requests r on r.id = c.request_id
  join public.partners p on p.id = c.partner_id
  join lateral (
    select min(e.at) as ended_at from public.status_events e
    where e.request_id = c.request_id and e.to_status in ('completed', 'cancelled_by_customer', 'cancelled_by_partner')
  ) d on d.ended_at is not null
  cross join lateral (select date_trunc('month', greatest(d.ended_at, c.created_at) at time zone 'Europe/Vienna')::date as m) b
  where (p_partner is null or c.partner_id = p_partner)
    and (p_month is null or b.m = date_trunc('month', p_month::timestamp)::date)
  order by c.created_at, c.id
$$;

-- Export für Beks: nur service_role (admin-ID aus dem Aufruferskript), Monat Pflicht (ein beliebiger Tag des Monats), Audit-Eintrag
create function public.export_commissions(p_actor uuid, p_month date) returns setof public.commission_row
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  if p_month is null then raise exception 'month_required'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'export_commissions', 'commission_entries', null, jsonb_build_object('month', to_char(p_month, 'YYYY-MM')));
  return query select * from private.commission_rows(null, p_month);
end
$$;

-- Liste für die eigene Firma (jeder Firmenstatus, aal2): Partner lesen status_events nicht, den Monat rechnet die Datenbank
create function public.my_commissions(p_month date default null) returns setof public.commission_row
language plpgsql stable security definer set search_path = ''
as $$
declare
  pid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_member_partner_id();
  if pid is null then raise exception 'not_found'; end if;
  return query select * from private.commission_rows(pid, p_month);
end
$$;

-- 6. Rechte und Zeitplan ------------------------------------------------------------------------------------------------------------
revoke all on function private.commission_rows(uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.report_not_done(uuid), public.my_commissions(date) from public, anon;
grant execute on function public.report_not_done(uuid), public.my_commissions(date) to authenticated;
revoke all on function public.complete_due(), public.export_commissions(uuid, date) from public, anon, authenticated;
grant execute on function public.complete_due(), public.export_commissions(uuid, date) to service_role;

select cron.schedule('complete-due', '*/5 * * * *', 'select public.complete_due()');
