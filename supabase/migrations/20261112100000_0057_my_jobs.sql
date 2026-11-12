-- s9i-6b: my_jobs() liefert der eigenen Firma ihre zugeordneten Aufträge (Status, Termin, Bezirke, Beträge aus dem Journal).
-- Keine Spalte mit Namen, Adresse, Telefon, E-Mail oder Freitext des Kunden: Kontakt und Adresse nur über job_contact (mit Audit-Zeile je Aufruf).
-- Gleiche Prüfungen wie start_job und job_contact: aal2, Firma active oder payment_hold (my_job_partner_id), Zugriffsfenster (assignment_access).

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
  can_start boolean
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
           (a.ended_at is null and r.status = 'accepted' and now() >= r.termin_at)
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

revoke all on function public.my_jobs() from public, anon;
grant execute on function public.my_jobs() to authenticated;
