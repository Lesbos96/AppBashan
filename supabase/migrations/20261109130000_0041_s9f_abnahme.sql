-- S9f, Abnahme (tmp/proof/s9f-abnahme.md): M2 expire_changes bucht nur bei getroffener Zeile; N1 p_accept NULL; N4 decided_by beim Rückzug leer;
-- N5 Audit-Einträge für System-Rückzug, Rückzug, Ablauf und Auftragsende; N6 Snapshot des Nachtrags aus fester Schlüsselliste.

-- N6: kein Übernehmen alter Positionsangaben der Basis (der Kunde sähe veraltete Umfangsangaben neben dem neuen Betrag)
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

-- N1 (p_accept NULL), N5 (Audit beim System-Rückzug)
create or replace function public.decide_change(
  p_actor uuid, p_revision uuid, p_accept boolean, p_shown_total bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  rev public.price_revisions;
  r public.service_requests;
  bk public.commission_entries;
  pst public.partner_status;
  js record;
begin
  if p_actor is null then raise exception 'not_found'; end if;
  if p_accept is null then raise exception 'invalid_input'; end if;
  select * into rev from public.price_revisions v where v.id = p_revision and v.source = 'change_order';
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = rev.request_id;
  if r.customer_id is distinct from p_actor then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = rev.request_id for update;
  select p.status into pst from public.partners p where p.id = rev.proposed_by for share;
  select * into rev from public.price_revisions v where v.id = p_revision for update;
  if rev.status = 'accepted' and p_accept then return 'accepted'; end if;
  if rev.status = 'declined' and not p_accept then return 'declined'; end if;
  if rev.status = 'expired' or (rev.status = 'proposed' and rev.valid_until <= now()) then raise exception 'change_not_valid'; end if;
  if rev.status <> 'proposed' or r.status not in ('accepted', 'in_progress') then raise exception 'invalid_transition'; end if;

  if not p_accept then
    perform set_config('app.mv_change', rev.id::text || ':declined', true);
    update public.price_revisions set status = 'declined', decided_by = p_actor, decided_at = now() where id = rev.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_declined', 'partner', rev.proposed_by, r.id, 'change_declined:' || rev.id);
    insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
    values (p_actor, 'customer', 'decline_change', 'revision', rev.id::text, jsonb_build_object('request_id', r.id));
    return 'declined';
  end if;

  if pst is null or pst not in ('active', 'payment_hold') then
    -- wie T5: nicht als Fehler abbrechen, sondern den Nachtrag zurückziehen (Akteur system) und das Ergebnis melden
    perform set_config('app.mv_change', rev.id::text || ':withdrawn', true);
    update public.price_revisions set status = 'withdrawn', decided_at = now() where id = rev.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_withdrawn', 'customer', r.customer_id, r.id, 'change_withdrawn:' || rev.id);
    insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
    values (null, 'system', 'withdraw_change', 'revision', rev.id::text, jsonb_build_object('request_id', r.id, 'reason', 'partner_not_active'));
    return 'partner_not_active';
  end if;
  if p_shown_total is distinct from rev.total_cents then raise exception 'shown_total_mismatch'; end if;
  select * into bk from public.commission_entries e where e.request_id = r.id and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;
  if rev.base_revision_id is distinct from r.current_revision then raise exception 'revision_changed'; end if;
  select * into js from private.journal_sums(r.id);
  perform set_config('app.mv_change', rev.id::text || ':accepted', true);
  update public.price_revisions set status = 'accepted', decided_by = p_actor, decided_at = now() where id = rev.id;
  perform set_config('app.mv_change', rev.id::text || ':pointer', true);
  update public.service_requests set current_revision = rev.id where id = r.id;
  perform set_config('app.mv_change', '', true);
  perform private.commission_book(rev.proposed_by, r.id, rev.id, 'change', null, rev.total_cents - js.total, p_fee_rate, p_fee_vat_rate,
    p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'customer', 'decide_change', 'revision', rev.id::text,
    jsonb_build_object('request_id', r.id, 'total_cents', rev.total_cents, 'snapshot_hash', encode(sha256(convert_to(rev.snapshot::text, 'utf8')), 'hex')));
  perform private.outbox_put('change_accepted', 'partner', rev.proposed_by, r.id, 'change_accepted:' || rev.id);
  return 'accepted';
end
$$;

-- N4 (decided_by bleibt leer: der Kunde liest alle Spalten seiner Revisionen), N5 (Audit mit dem Akteur)
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
  if rev.status <> 'proposed' then raise exception 'invalid_transition'; end if;
  perform set_config('app.mv_change', rev.id::text || ':withdrawn', true);
  update public.price_revisions set status = 'withdrawn', decided_at = now() where id = rev.id;
  perform set_config('app.mv_change', '', true);
  perform private.outbox_put('change_withdrawn', 'customer', r.customer_id, r.id, 'change_withdrawn:' || rev.id);
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (uid, 'partner', 'withdraw_change', 'revision', rev.id::text, jsonb_build_object('request_id', r.id));
end
$$;

-- M2: Outbox und Zähler nur, wenn dieser Lauf den Nachtrag wirklich beendet hat (ein paralleles decide_change kann ihm zuvorgekommen sein)
create or replace function public.expire_changes() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  n int := 0;
  cnt int;
begin
  for v in
    select p.id, p.proposed_by, p.request_id from public.price_revisions p join public.service_requests s on s.id = p.request_id
    where p.status = 'proposed' and p.valid_until <= now()
    order by s.id for update of s skip locked
  loop
    begin
      perform set_config('app.mv_change', v.id::text || ':expired', true);
      update public.price_revisions set status = 'expired', decided_at = now() where id = v.id and status = 'proposed';
      get diagnostics cnt = row_count; -- FOUND würde vom folgenden PERFORM überschrieben
      perform set_config('app.mv_change', '', true);
      if cnt = 0 then continue; end if;
      perform private.outbox_put('change_expired', 'partner', v.proposed_by, v.request_id, 'change_expired:' || v.id);
      insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
      values (null, 'system', 'expire_change', 'revision', v.id::text, jsonb_build_object('request_id', v.request_id));
      n := n + 1;
    exception when others then
      raise warning 'expire_changes_failed % %', v.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;

-- N5: Audit auch beim Auftragsende
create or replace function private.close_changes() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
begin
  for v in select p.id, p.proposed_by from public.price_revisions p where p.request_id = new.id and p.status = 'proposed' loop
    perform set_config('app.mv_change', v.id::text || ':expired', true);
    update public.price_revisions set status = 'expired', decided_at = now() where id = v.id;
    perform set_config('app.mv_change', '', true);
    perform private.outbox_put('change_expired', 'partner', v.proposed_by, new.id, 'change_expired:' || v.id);
    insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
    values (null, 'system', 'expire_change', 'revision', v.id::text, jsonb_build_object('request_id', new.id, 'reason', 'request_ended'));
  end loop;
  return null;
end
$$;
