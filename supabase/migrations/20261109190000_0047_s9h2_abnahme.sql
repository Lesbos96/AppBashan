-- S9h-2-Abnahme: M1 eigene Mail bei Pauschale (kein „keine Stornokosten“), M2 kein Partner-Storno nach der Meldung „nicht stattgefunden“
-- (under_review, admin entscheidet nach T14), N1 Beleg-IDs im Audit, N3 Weitervermittlung nur, wenn die Annahmefrist vor dem Termin endet,
-- N4 keine widersprüchlichen Mails, wenn die Folgeanfrage sofort unmatched ist.

alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed', 'offer_new', 'offer_confirmed', 'offer_withdrawn',
                  'change_proposed', 'change_accepted', 'change_declined', 'change_expired', 'change_withdrawn', 'completion_ask', 'completion_auto',
                  'request_cancelled', 'partner_cancelled', 'request_reissued', 'partner_cancelled_fee'));

-- N3: Termin muss mindestens accept_min_hours entfernt sein (sonst läge accept_deadline hinter dem Termin)
create or replace function private.reissue_request(p_source uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  cur public.price_revisions;
  nid uuid := gen_random_uuid();
  rid uuid;
  hrs numeric;
  dl timestamptz;
begin
  select * into r from public.service_requests s where s.id = p_source;
  select * into cur from public.price_revisions v where v.id = r.current_revision;
  if r.termin_at - now() < make_interval(hours => private.setting_num('reissue_min_hours')::int) then return null; end if;
  if cur.source = 'partner_offer' or cur.total_cents is null then return null; end if;
  if exists (select 1 from public.service_requests s where s.reissued_from = p_source) then return null; end if;
  hrs := extract(epoch from r.termin_at - now()) / 3600;
  if hrs < private.setting_num('accept_min_hours') then return null; end if;
  dl := now() + make_interval(secs => (3600 * greatest(
    private.setting_num('accept_min_hours'),
    least(private.setting_num('accept_max_hours'), private.setting_num('accept_lead_share_percent') / 100 * hrs)
  ))::double precision);

  perform set_config('app.mv_reissue', nid::text, true);
  insert into public.service_requests (id, customer_id, service, status, from_address, from_point, to_address, to_point, route, region,
                                       preferred_date, time_window, description, volume_m3, client_ref, accept_deadline, termin_at, district,
                                       cancel_fee_waived, reissued_from)
  values (nid, r.customer_id, r.service, 'requested', r.from_address, r.from_point, r.to_address, r.to_point, r.route, r.region,
          r.preferred_date, r.time_window, r.description, r.volume_m3, gen_random_uuid(), dl, r.termin_at, r.district, true, p_source);
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents, copied_from_revision_id)
  values (nid, 1, 'submit', cur.inputs, cur.snapshot, cur.price_version, cur.total_cents, cur.low_cents, cur.high_cents, cur.id)
  returning id into rid;
  update public.service_requests set current_revision = rid where id = nid;
  perform set_config('app.mv_reissue', '', true);

  insert into public.request_contacts (request_id, name, phone, email, stairs_door)
  select nid, c.name, c.phone, c.email, c.stairs_door from public.request_contacts c where c.request_id = p_source;
  perform set_config('app.mv_photo_request', nid::text, true);
  insert into public.request_photos (request_id, storage_path)
  select nid, p.storage_path from public.request_photos p where p.request_id = p_source order by p.created_at, p.id;
  perform set_config('app.mv_photo_request', '', true);

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (null, 'system', 'reissue_request', 'service_request', nid::text, jsonb_build_object('source_request_id', p_source));
  perform public.distribute_request(nid);
  return nid;
end
$$;

-- M2: under_review auch in der Grundlage
create or replace function public.cancel_by_partner_basis(p_actor uuid, p_aal text, p_request uuid)
returns table (request_status text, revision_id uuid, total_cents bigint, call_out_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
begin
  perform private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  return query
    select r.status::text, r.current_revision, (select v.total_cents::bigint from public.price_revisions v where v.id = r.current_revision),
           private.call_out_base(p_request), bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version;
end
$$;

create or replace function public.cancel_by_partner(
  p_actor uuid, p_aal text, p_request uuid, p_reason text, p_photos uuid[], p_fee_base bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  r public.service_requests;
  bk public.commission_entries;
  base bigint := 0;
  nid uuid;
begin
  pid := private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if p_reason is null or p_reason not in ('scope_impossible', 'unavailable', 'other') then raise exception 'reason_required'; end if;
  if p_photos is not null and cardinality(p_photos) > 0 then
    if p_reason <> 'scope_impossible'
       or not exists (select 1 from public.price_revisions v where v.request_id = p_request and v.source = 'change_order' and v.status in ('declined', 'expired')) then
      raise exception 'call_out_not_allowed';
    end if;
    if cardinality(p_photos) > 8
       or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos)
       or (select count(*) from public.job_photos j
           where j.id = any (p_photos) and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = pid and j.request_id = p_request) <> cardinality(p_photos) then
      raise exception 'receipt_required';
    end if;
    base := private.call_out_base(p_request);
  end if;
  if p_fee_base is distinct from base then raise exception 'amount_mismatch'; end if;
  select * into bk from public.commission_entries x where x.request_id = p_request and x.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if (p_fee_rate, p_fee_vat_rate, p_fee_rate_version, p_fee_vat_rate_version)
     is distinct from (bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version) then
    raise exception 'fee_basis_changed';
  end if;

  perform private.set_request_status(p_request, 'cancelled_by_partner', p_actor, 'partner');
  update public.assignments set ended_at = now(), ended_reason = 'cancelled_by_partner', cancel_reason = p_reason where request_id = p_request and ended_at is null;
  perform private.cancel_reverse_all(pid, p_request);
  if base > 0 then
    perform private.commission_book(pid, p_request, r.current_revision, 'cancellation_fee', null, base, p_fee_rate, p_fee_vat_rate,
      p_fee, p_fee_net, p_fee_vat, p_payout, p_fee_rate_version, p_fee_vat_rate_version);
  end if;

  -- N1: die Belege der Pauschale bleiben im Audit (Streit nach 10.3)
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'partner', 'cancel_by_partner', 'service_request', p_request::text,
          jsonb_build_object('reason', p_reason, 'call_out_cents', base, 'photos', to_jsonb(coalesce(p_photos, array[]::uuid[]))));
  if p_reason <> 'scope_impossible' then
    nid := private.reissue_request(p_request);
    -- N4: sofort unmatched: nur die Absage melden (die Mail request_unmatched der Folgeanfrage steht schon in der Outbox)
    if nid is not null and (select s.status from public.service_requests s where s.id = nid) = 'unmatched' then nid := null; end if;
  end if;
  if nid is not null then
    perform private.outbox_put('request_reissued', 'customer', r.customer_id, nid, 'request_reissued:' || p_request);
  elsif base > 0 then
    perform private.outbox_put('partner_cancelled_fee', 'customer', r.customer_id, p_request, 'partner_cancelled:' || p_request);
  else
    perform private.outbox_put('partner_cancelled', 'customer', r.customer_id, p_request, 'partner_cancelled:' || p_request);
  end if;
  return 'cancelled_by_partner';
end
$$;
