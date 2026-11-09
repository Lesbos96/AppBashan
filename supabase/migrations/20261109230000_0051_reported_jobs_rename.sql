-- S9h-3: Die Liste gemeldeter Aufträge heißt reported_jobs() statt admin_reported_jobs(). Namen mit admin_ sind in diesem Projekt Funktionen nur für
-- service_role (rls.test.ts); die Liste läuft für ein admin-JWT mit aal2 (wie partner_quality). Inhalt und Rechte unverändert.
drop function public.admin_reported_jobs();

create function public.reported_jobs()
returns table (request_id uuid, status text, termin_at timestamptz, not_done_reported_at timestamptz, partner_id uuid, partner_name text, total_cents bigint)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.status::text, r.termin_at, r.not_done_reported_at, a.partner_id, p.name, v.total_cents::bigint
  from public.service_requests r
  left join lateral (select x.partner_id from public.assignments x where x.request_id = r.id order by x.accepted_at desc limit 1) a on true
  left join public.partners p on p.id = a.partner_id
  left join public.price_revisions v on v.id = r.current_revision
  where (select private.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2'
    and r.not_done_reported_at is not null and r.not_done_resolved_at is null
    and r.status in ('accepted', 'in_progress', 'completed')
  order by r.not_done_reported_at, r.id
$$;

revoke all on function public.reported_jobs() from public, anon, authenticated, service_role;
grant execute on function public.reported_jobs() to authenticated;
