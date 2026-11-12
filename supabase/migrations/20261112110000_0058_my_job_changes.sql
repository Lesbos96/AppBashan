-- s9i-7a: my_job_changes() liefert der eigenen Firma je zugeordnetem Auftrag die Preisgrundlage (Quelle, Preis-Eingaben und Gesamtpreis der gültigen Revision),
-- den letzten eigenen Nachtrag (Zustand, Betrag, Frist) und die IDs ihrer bereiten Belegfotos. price_revisions kann die Firma nicht lesen (nur der Kunde, 0018).
-- Gleiche Prüfungen wie my_jobs (0057): aal2, Firma active oder payment_hold (my_job_partner_id), Zugriffsfenster (assignment_access).
-- Keine Spalte mit Name, Adresse, Kontakt, Snapshot, Fotopfad oder Gebühr. `inputs` sind nur Preis-Eingaben (Entscheidung 30), die die Firma über job_listings schon liest.

create function public.my_job_changes()
returns table (
  request_id uuid,
  service public.service_type,
  source text,
  inputs jsonb,
  total_cents bigint,
  change_id uuid,
  change_status text,
  change_total_cents bigint,
  change_valid_until timestamptz,
  change_decided_at timestamptz,
  receipt_ids uuid[]
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
    select a.request_id, r.service, cur.source, cur.inputs, cur.total_cents::bigint,
           ch.id, ch.status::text, ch.total_cents::bigint, ch.valid_until, ch.decided_at,
           coalesce((select array_agg(j.id order by j.created_at, j.id) from public.job_photos j
                     where j.request_id = a.request_id and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = a.partner_id), '{}'::uuid[])
    from public.assignments a
    join public.service_requests r on r.id = a.request_id
    join public.price_revisions cur on cur.id = r.current_revision
    left join lateral (
      select v.id, v.status, v.total_cents, v.valid_until, v.decided_at
      from public.price_revisions v
      where v.request_id = a.request_id and v.source = 'change_order' and v.proposed_by = a.partner_id
      order by v.n desc
      limit 1
    ) ch on true
    where a.partner_id = pid and private.assignment_access(a.request_id, pid)
    order by a.request_id;
end
$$;

revoke all on function public.my_job_changes() from public, anon;
grant execute on function public.my_job_changes() to authenticated;

-- Berater N1: Festangebot, Spanne und offener Nachtrag scheitern schon in der Grundlage (Vorschau), nicht erst beim Anlegen.
-- Reihenfolge wie propose_change (0041): Quelle, Festpreis, offener Nachtrag. Signatur, Rechte und Rückgabe unverändert.
create or replace function public.propose_change_basis(p_actor uuid, p_aal text, p_request uuid)
returns table (revision_id uuid, source text, inputs jsonb, price_version int, total_cents bigint, low_cents bigint, high_cents bigint, service text, route jsonb)
language plpgsql security definer set search_path = ''
as $$
declare
  cur public.price_revisions;
begin
  perform private.change_gate(p_actor, p_aal, p_request);
  select v.* into cur from public.service_requests s join public.price_revisions v on v.id = s.current_revision where s.id = p_request;
  if cur.source = 'partner_offer' then raise exception 'change_not_allowed'; end if;
  if cur.total_cents is null or cur.low_cents is distinct from cur.high_cents then raise exception 'not_fixed_price'; end if;
  if exists (select 1 from public.price_revisions v where v.request_id = p_request and v.status = 'proposed') then raise exception 'change_open'; end if;
  return query
    select v.id, v.source, v.inputs, v.price_version, v.total_cents::bigint, v.low_cents::bigint, v.high_cents::bigint, s.service::text, s.route
    from public.service_requests s join public.price_revisions v on v.id = s.current_revision
    where s.id = p_request;
end
$$;
