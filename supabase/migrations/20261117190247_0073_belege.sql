-- 0073 bl1 (OFFEN S9i7-12 mit S9i7-1, S9i7-2, S9i7-3, n12-1, rj1-2): Belege und reject_offers. Nur `create or replace` bestehender Funktionen: keine neue Funktion, kein grant, kein revoke
-- (Rechte bleiben wie in 0035, 0041, 0058, 0072; Attribute `security definer set search_path = ''` und `stable` stehen in jeder Fassung wörtlich wieder da).
-- 1. photo_receipt_add idempotent (n12-1, S9i7-2): Wiederholung nach verlorener Antwort (gleiche Firma, gleiche Anfrage, gleicher sha256) liefert die Id der ältesten Zeile und schreibt nichts.
--    Reihenfolge: Tor (Rechte, Sperre der Anfrage) → Dedupe → Limit 8 → Datei vorhanden → Insert. Das Limit steht deshalb nicht mehr im Tor: sonst scheiterte die Wiederholung der
--    achten Datei an receipt_limit. photo_receipt_check (Vorprüfung vor dem Lesen des Bodys) kennt keinen Hash und meldet das Limit nicht mehr; add prüft es unter Sperre.
--    Die Datei der Wiederholung hat keine Zeile; photo-cleanup entfernt sie nach 1 h (0035:383). Kein Unique-Index: Belege schreibt nur diese Funktion, die Sperre der Anfrage serialisiert.
-- 2. my_job_changes (S9i7-3, S9i7-1): nur aktive Zuordnung (`a.ended_at is null`); receipt_ids ohne verbrauchte Belege. Verbraucht = die Id steht in `photos` einer Revision derselben Anfrage
--    mit source = 'change_order' und status = 'accepted'. Abgelehnte, abgelaufene und zurückgezogene Nachträge verbrauchen nichts.
-- 3. propose_change (S9i7-1): zusätzlich zur bisherigen Prüfung (0041:26-31, unverändert) muss mindestens ein gesendeter Beleg unverbraucht sein, sonst receipt_required.
-- 4. reject_offers (rj1-2): ein gelöschtes Konto (profiles.deleted_at) gilt als nicht gefunden, nach der Sperre der Anfrage und vor dem Replay-Zweig, ohne Sperre des Profils (Muster 0066:83).

create or replace function private.receipt_gate(p_actor uuid, p_aal text, p_request uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  pst public.partner_status;
  r public.service_requests;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  if p_aal is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  select m.partner_id into pid from public.partner_members m where m.user_id = p_actor;
  if pid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  select p.status into pst from public.partners p where p.id = pid for share;
  if pst not in ('active', 'payment_hold') then raise exception 'partner_not_active'; end if;
  if not exists (select 1 from public.assignments a where a.request_id = p_request and a.partner_id = pid and a.ended_at is null) then
    raise exception 'not_found';
  end if;
  if r.status not in ('accepted', 'in_progress') then raise exception 'request_closed'; end if;
  return pid;
end
$$;

create or replace function public.photo_receipt_add(p_actor uuid, p_aal text, p_request uuid, p_path text, p_sha text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := private.receipt_gate(p_actor, p_aal, p_request);
  jid uuid;
begin
  select j.id into jid from public.job_photos j
  where j.request_id = p_request and j.kind = 'receipt' and j.uploaded_partner_id = pid and j.sha256 = p_sha
  order by j.created_at, j.id limit 1;
  if jid is not null then return jid; end if;
  if (select count(*) from public.job_photos j where j.request_id = p_request and j.kind = 'receipt') >= 8 then raise exception 'receipt_limit'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = p_path) then raise exception 'file_missing'; end if;
  insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
  values (p_request, 'receipt', pid, 'ready', p_path, p_sha, now()) returning id into jid;
  return jid;
end
$$;

create or replace function public.my_job_changes()
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
                     where j.request_id = a.request_id and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = a.partner_id
                       and not exists (select 1 from public.price_revisions u
                                       where u.request_id = a.request_id and u.source = 'change_order' and u.status = 'accepted' and j.id = any (u.photos))), '{}'::uuid[])
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
    where a.partner_id = pid and a.ended_at is null and private.assignment_access(a.request_id, pid)
    order by a.request_id;
end
$$;

create or replace function public.propose_change(p_actor uuid, p_aal text, p_request uuid, p_base uuid, p_inputs jsonb, p_total bigint, p_photos uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  r public.service_requests;
  cur public.price_revisions;
  hrs numeric;
  snap jsonb;
  rid uuid;
begin
  pid := private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  select * into cur from public.price_revisions v where v.id = r.current_revision;
  if p_base is distinct from cur.id then raise exception 'revision_changed'; end if;
  if cur.source = 'partner_offer' then raise exception 'change_not_allowed'; end if;
  if cur.total_cents is null or cur.low_cents is distinct from cur.high_cents then raise exception 'not_fixed_price'; end if;
  if exists (select 1 from public.price_revisions v where v.request_id = r.id and v.status = 'proposed') then raise exception 'change_open'; end if;
  if p_total is null or p_total <= cur.total_cents then raise exception 'change_not_increasing'; end if;
  if p_inputs is null or jsonb_typeof(p_inputs) is distinct from 'object' then raise exception 'invalid_input'; end if;
  if p_photos is null or cardinality(p_photos) not between 1 and 8
     or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos)
     or (select count(*) from public.job_photos j
         where j.id = any (p_photos) and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = pid and j.request_id = r.id) <> cardinality(p_photos) then
    raise exception 'receipt_required';
  end if;
  -- bl1 (S9i7-1): mindestens ein Beleg gehört zu keinem angenommenen Nachtrag dieser Anfrage
  if not exists (select 1 from unnest(p_photos) x
                 where not exists (select 1 from public.price_revisions u
                                   where u.request_id = r.id and u.source = 'change_order' and u.status = 'accepted' and x = any (u.photos))) then
    raise exception 'receipt_required';
  end if;
  hrs := private.setting_num('change_valid_hours');
  snap := jsonb_build_object(
    'kind', 'price', 'totalCents', p_total, 'lowCents', p_total, 'highCents', p_total,
    'lines', jsonb_build_array(jsonb_build_object('key', 'booked', 'cents', cur.total_cents), jsonb_build_object('key', 'change_order', 'cents', p_total - cur.total_cents)),
    'terms', cur.snapshot -> 'terms', 'changeOf', cur.id);
  perform set_config('app.mv_change', r.id::text || ':propose', true);
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents, status, valid_until, base_revision_id, proposed_by, photos)
  values (r.id, (select max(v.n) + 1 from public.price_revisions v where v.request_id = r.id), 'change_order', p_inputs, snap, cur.price_version,
          p_total, p_total, p_total, 'proposed', now() + hrs * interval '1 hour', cur.id, pid, p_photos)
  returning id into rid;
  perform set_config('app.mv_change', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'partner', 'propose_change', 'revision', rid::text, jsonb_build_object('request_id', r.id, 'total_cents', p_total, 'base_revision_id', cur.id));
  perform private.outbox_put('change_proposed', 'customer', r.customer_id, r.id, 'change_proposed:' || rid);
  return rid;
end
$$;

create or replace function public.reject_offers(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request and s.customer_id = uid;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  -- bl1 (rj1-2): ein gelöschtes Konto mit noch gültigem Token gilt als nicht gefunden (wie 0066:83), vor dem Replay-Zweig
  if exists (select 1 from public.profiles p where p.id = uid and p.deleted_at is not null) then raise exception 'not_found'; end if;
  -- rj1: derselbe Kunde hat schon abgelehnt (verlorene Antwort): derselbe Status, keine Wirkung; ein `declined` ohne Ereignis dieser Person bleibt invalid_transition
  if r.status = 'declined'
     and exists (select 1 from public.status_events e where e.request_id = p_request and e.to_status = 'declined' and e.actor_id = uid and e.actor_role = 'customer') then
    return;
  end if;
  if r.status <> 'offered' then raise exception 'invalid_transition'; end if;
  update public.partner_offers set status = 'rejected', end_reason = 'customer_rejected', decided_at = now() where request_id = p_request and status = 'sent';
  perform private.set_request_status(p_request, 'declined', uid, 'customer');
end
$$;
