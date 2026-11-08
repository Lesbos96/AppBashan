-- S9d-1: Fotos für Partner (Konzept 7). Kopien ohne Metadaten im privaten Bucket `job-photos`, Zustand in `job_photos`,
-- Verteilung erst nach den Foto-Endzuständen, Zugriff nur über Funktionen für service_role (Edge Functions job-photo, admin-photo, photo-receipt).
-- Sperrreihenfolge überall: Auftrag (for update) → Firma (for share) → Zeilen darunter (S4-N6).

-- Bucket: privat, nur JPEG, bewusst ohne Storage-Policy (kein Direktzugriff für anon und authenticated; service_role umgeht RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 4194304, array['image/jpeg']);

alter table public.outbox drop constraint outbox_kind_check;
alter table public.outbox add constraint outbox_kind_check
  check (kind in ('listing_new', 'request_accepted', 'request_expired', 'request_unmatched', 'photo_failed'));

-- job_photos: `request` = Kopie eines request_photos-Eintrags (Pipeline), `receipt` = Beleg-Foto des Partners (nur ready).
-- Pfad: zufällige UUID ohne Anfrage- oder Nutzer-ID (die signierte URL zeigt ihn). Endzustände ready/failed sind unveränderlich.
create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  kind text not null check (kind in ('request', 'receipt')),
  source_photo_id uuid unique references public.request_photos (id) on delete cascade,
  uploaded_partner_id uuid references public.partners (id) on delete restrict,
  storage_path text unique check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('pending', 'ready', 'failed')),
  attempts int not null default 0 check (attempts between 0 and 3),
  lease_until timestamptz,
  error_code text check (error_code in ('attempts_exhausted', 'source_missing', 'not_jpeg', 'too_large', 'dimensions', 'unsupported', 'decode_failed', 'encode_failed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint job_photos_kind check (
    (kind = 'request' and source_photo_id is not null and uploaded_partner_id is null)
    or (kind = 'receipt' and source_photo_id is null and uploaded_partner_id is not null and status = 'ready')
  ),
  constraint job_photos_state check (
    (status = 'pending' and lease_until is not null and storage_path is null and sha256 is null and error_code is null and decided_at is null)
    or (status = 'ready' and storage_path is not null and sha256 is not null and error_code is null and decided_at is not null)
    or (status = 'failed' and storage_path is null and sha256 is null and error_code is not null and decided_at is not null)
  )
);

create index job_photos_request_idx on public.job_photos (request_id, kind, status);

create function private.guard_job_photo_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'pending' or new.id <> old.id or new.request_id <> old.request_id or new.kind <> old.kind
    or new.source_photo_id is distinct from old.source_photo_id or new.uploaded_partner_id is distinct from old.uploaded_partner_id then
    raise exception 'append_only';
  end if;
  return new;
end
$$;

revoke all on function private.guard_job_photo_update() from public;

create trigger guard_job_photo_update before update on public.job_photos
for each row execute function private.guard_job_photo_update();
create trigger append_only_delete before delete on public.job_photos
for each row execute function private.immutable_row('append_only');
create trigger append_only_truncate before truncate on public.job_photos
for each statement execute function private.immutable_row('append_only');

-- Kein DML und kein Lesen für Konten; service_role liest (Tests, Edge Functions), schreiben nur die Funktionen.
alter table public.job_photos enable row level security;
revoke all on public.job_photos from anon, authenticated, service_role;
grant select on public.job_photos to service_role;

-- Foto-Endzustand: Jede request_photos-Zeile hat eine job_photos-Zeile mit ready oder failed.
create function private.photos_pending(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.request_photos rp where rp.request_id = p_request
      and not exists (select 1 from public.job_photos j where j.source_photo_id = rp.id and j.status in ('ready', 'failed'))
  )
$$;

-- Arbeit für den Claim: Foto ohne Zeile oder mit abgelaufener Lease.
create function private.photo_work(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.request_photos rp where rp.request_id = p_request
      and not exists (select 1 from public.job_photos j where j.source_photo_id = rp.id and (j.status <> 'pending' or j.lease_until > now()))
  )
$$;

revoke all on function private.photos_pending(uuid), private.photo_work(uuid) from public;

-- Verteilung wartet auf die Foto-Endzustände (Konzept 7.1 Nr. 2); die Annahmefrist läuft weiter.
create or replace function public.distribute_request(p_request uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  rev public.price_revisions;
  n int;
begin
  select * into r from public.service_requests where id = p_request for update;
  if not found or r.status not in ('requested', 'awaiting_offer') then return 0; end if;
  if private.photos_pending(p_request) then return 0; end if;
  if exists (select 1 from public.job_listings l where l.request_id = p_request) then return 0; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.id is null then raise exception 'revision_missing'; end if;
  with ins as (
    insert into public.job_listings (request_id, partner_id, revision_id, district, service, inputs, volume_m3, preferred_date, time_window, total_cents, low_cents, high_cents, accept_deadline)
    select r.id, p.id, rev.id, r.district, r.service, rev.inputs, r.volume_m3, r.preferred_date, r.time_window, rev.total_cents, rev.low_cents, rev.high_cents, r.accept_deadline
    from public.partners p
    where p.status = 'active'
      and exists (select 1 from public.partner_categories c where c.partner_id = p.id and c.service::text = r.service::text)
      and exists (select 1 from public.partner_regions g where g.partner_id = p.id and g.district = r.district)
      and not exists (select 1 from public.partner_members m where m.partner_id = p.id and m.user_id = r.customer_id)
    returning id, partner_id
  )
  insert into public.outbox (kind, recipient_kind, recipient_id, request_id, dedupe_key)
  select 'listing_new', 'partner', ins.partner_id, p_request, 'listing_new:' || ins.id from ins;
  get diagnostics n = row_count;
  if n = 0 then
    perform private.set_request_status(p_request, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, p_request, 'request_unmatched:' || p_request);
  end if;
  return n;
end
$$;

create or replace function public.distribute_pending() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.id from public.service_requests s
    where s.status in ('requested', 'awaiting_offer') and s.current_revision is not null and s.accept_deadline > now()
      and not exists (select 1 from public.job_listings l where l.request_id = s.id)
      and not private.photos_pending(s.id)
  loop
    begin
      n := n + public.distribute_request(r.id);
    exception when others then
      raise warning 'distribute_failed % %', r.id, sqlstate;
    end;
  end loop;
  return n;
end
$$;

-- Abschluss der Fotos einer Anfrage (Aufrufer hält die Auftragssperre): sind alle Fotos im Endzustand, Mail bei failed (einmal je
-- Anfrage, nur solange sie offen ist) und Verteilung.
create function private.photo_settle(p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
begin
  select * into r from public.service_requests s where s.id = p_request;
  if not found or private.photos_pending(p_request) then return; end if;
  if r.status in ('requested', 'awaiting_offer')
     and exists (select 1 from public.job_photos j where j.request_id = p_request and j.kind = 'request' and j.status = 'failed') then
    perform private.outbox_put('photo_failed', 'customer', r.customer_id, p_request, 'photo_failed:' || p_request);
  end if;
  perform public.distribute_request(p_request);
end
$$;

revoke all on function private.photo_settle(uuid) from public;

-- Claim (aus dem Cron-Lauf): zählt den Versuch und setzt die Lease, bevor der Aufruf gesendet wird. Auftrag zuerst, dann die Zeile.
-- Ab dem 4. Anlauf ohne Erfolg: failed (attempts_exhausted). Nur offene Anfragen vor Fristende.
create function public.photo_claim(p_limit int) returns table (job_photo_id uuid, attempt int)
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  ph record;
  jp public.job_photos;
  n int := 0;
  cap int := greatest(1, least(p_limit, 50));
begin
  for r in
    select s.id from public.service_requests s
    where s.status in ('requested', 'awaiting_offer') and s.accept_deadline > now() and private.photo_work(s.id)
    order by s.created_at, s.id for update of s skip locked
  loop
    exit when n >= cap;
    for ph in select rp.id from public.request_photos rp where rp.request_id = r.id order by rp.created_at, rp.id loop
      select * into jp from public.job_photos j where j.source_photo_id = ph.id for update;
      if not found then
        insert into public.job_photos (request_id, kind, source_photo_id, status, attempts, lease_until)
        values (r.id, 'request', ph.id, 'pending', 1, now() + interval '3 minutes') returning * into jp;
      elsif jp.status = 'pending' and jp.lease_until <= now() then
        if jp.attempts >= 3 then
          update public.job_photos set status = 'failed', error_code = 'attempts_exhausted', lease_until = null, decided_at = now() where id = jp.id;
          continue;
        end if;
        update public.job_photos set attempts = jp.attempts + 1, lease_until = now() + interval '3 minutes' where id = jp.id returning * into jp;
      else
        continue;
      end if;
      job_photo_id := jp.id;
      attempt := jp.attempts;
      n := n + 1;
      return next;
    end loop;
    perform private.photo_settle(r.id);
  end loop;
end
$$;

-- Versand je Foto an die Edge Function photo-publish (Vault-Secrets publish_url, publish_secret; Einrichtung: npm run setup:photo-publish).
-- Die Secrets werden vor dem Claim geprüft: Ohne sie zählt kein Versuch, der Lauf scheitert sichtbar (cron.job_run_details).
create function public.photo_publish_dispatch() returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  secret text;
  url text;
  c record;
  n int := 0;
begin
  if not exists (
    select 1 from public.service_requests s
    where s.status in ('requested', 'awaiting_offer') and s.accept_deadline > now() and private.photo_work(s.id)
  ) then return 0; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'publish_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'publish_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then
    raise exception 'photo_publish nicht eingerichtet: Vault-Secrets publish_secret/publish_url fehlen (npm run setup:photo-publish)';
  end if;
  for c in select * from public.photo_claim(20) loop
    perform net.http_post(url := url, headers := jsonb_build_object('x-publish-secret', secret, 'content-type', 'application/json'),
      body := jsonb_build_object('job_photo_id', c.job_photo_id, 'attempt', c.attempt), timeout_milliseconds := 60000);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Quelle des Claims für die Edge Function (nur mit gültigem Versuch und Lease).
create function public.photo_publish_begin(p_job_photo uuid, p_attempt int) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  p text;
begin
  select rp.storage_path into p from public.job_photos j join public.request_photos rp on rp.id = j.source_photo_id
  where j.id = p_job_photo and j.status = 'pending' and j.attempts = p_attempt and j.lease_until > now();
  if p is null then raise exception 'stale_claim'; end if;
  return p;
end
$$;

-- Ergebnis: Auftrag zuerst, dann die Zeile; Versuch und Lease müssen zum aktuellen Claim gehören, sonst ändert sich nichts.
create function public.photo_publish_mark(p_job_photo uuid, p_attempt int, p_ok boolean, p_path text, p_sha text, p_error text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  rid uuid;
  jp public.job_photos;
begin
  select j.request_id into rid from public.job_photos j where j.id = p_job_photo;
  if rid is null then raise exception 'stale_claim'; end if;
  perform 1 from public.service_requests s where s.id = rid for update;
  select * into jp from public.job_photos j where j.id = p_job_photo for update;
  if jp.status <> 'pending' or jp.attempts <> p_attempt or jp.lease_until <= now() then raise exception 'stale_claim'; end if;
  if p_ok then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = p_path) then raise exception 'file_missing'; end if;
    update public.job_photos set status = 'ready', storage_path = p_path, sha256 = p_sha, lease_until = null, decided_at = now() where id = jp.id;
  else
    update public.job_photos set status = 'failed', error_code = p_error, lease_until = null, decided_at = now() where id = jp.id;
  end if;
  perform private.photo_settle(rid);
end
$$;

-- Beleg-Foto des Partners (Konzept 7.1 Nr. 4): aal2, aktive Zuordnung, Firma active/payment_hold, Auftrag accepted/in_progress, höchstens 8.
create function private.receipt_gate(p_actor uuid, p_aal text, p_request uuid) returns uuid
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
  if (select count(*) from public.job_photos j where j.request_id = p_request and j.kind = 'receipt') >= 8 then raise exception 'receipt_limit'; end if;
  return pid;
end
$$;

create function public.photo_receipt_check(p_actor uuid, p_aal text, p_request uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.receipt_gate(p_actor, p_aal, p_request);
end
$$;

create function public.photo_receipt_add(p_actor uuid, p_aal text, p_request uuid, p_path text, p_sha text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid := private.receipt_gate(p_actor, p_aal, p_request);
  jid uuid;
begin
  if not exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = p_path) then raise exception 'file_missing'; end if;
  insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
  values (p_request, 'receipt', pid, 'ready', p_path, p_sha, now()) returning id into jid;
  return jid;
end
$$;

revoke all on function private.receipt_gate(uuid, text, uuid) from public;

-- Lesen für Partner (Listing) und Kunde (Anfrage); Akteur und aal stammen aus dem geprüften Token der Edge Function.
-- Partner: vor der Annahme nur `request`, nach der Annahme `request` und `receipt`; Bedingungen wie job_listings_select (0034), zusätzlich
-- nie der Kunde der Anfrage. Kunde: nur Belege (seine Originale liest er über die eigene Storage-Policy).
create function public.job_photo_list(p_actor uuid, p_aal text, p_listing uuid default null, p_request uuid default null)
returns table (id uuid, kind text, storage_path text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  pid uuid;
  pst public.partner_status;
begin
  if p_actor is null or (p_listing is null) = (p_request is null) then raise exception 'bad_request'; end if;
  if p_listing is not null then
    if p_aal is distinct from 'aal2' then raise exception 'mfa_required'; end if;
    select * into l from public.job_listings x where x.id = p_listing;
    select m.partner_id into pid from public.partner_members m where m.user_id = p_actor;
    if l.id is null or pid is distinct from l.partner_id then raise exception 'not_found'; end if;
    select p.status into pst from public.partners p where p.id = pid;
    select * into r from public.service_requests s where s.id = l.request_id;
    if r.customer_id = p_actor then raise exception 'not_found'; end if;
    if l.status = 'open' and l.accept_deadline > now() and pst = 'active' and private.in_scope(l.partner_id, l.service, l.district) then
      return query select j.id, j.kind, j.storage_path from public.job_photos j
        where j.request_id = l.request_id and j.kind = 'request' and j.status = 'ready' order by j.created_at, j.id;
    elsif l.status = 'accepted' and pst in ('active', 'payment_hold') and private.assignment_access(l.request_id, l.partner_id) then
      return query select j.id, j.kind, j.storage_path from public.job_photos j
        where j.request_id = l.request_id and j.status = 'ready' order by j.created_at, j.id;
    else
      raise exception 'not_found';
    end if;
  else
    select * into r from public.service_requests s where s.id = p_request and s.customer_id = p_actor;
    if not found then raise exception 'not_found'; end if;
    return query select j.id, j.kind, j.storage_path from public.job_photos j
      where j.request_id = p_request and j.kind = 'receipt' and j.status = 'ready' order by j.created_at, j.id;
  end if;
end
$$;

-- admin: Originale und Kopien nur über die Edge Function admin-photo, mit Begründung und Eintrag im audit_log (wie admin_contact).
create function public.admin_photo(p_actor uuid, p_request uuid, p_reason text) returns table (bucket_id text, storage_path text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'reason_required'; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (p_actor, 'admin', 'admin_photo_read', 'service_request', p_request::text, jsonb_build_object('reason', left(btrim(p_reason), 300)));
  return query
    select 'request-photos'::text, rp.storage_path from public.request_photos rp where rp.request_id = p_request
    union all
    select 'job-photos'::text, j.storage_path from public.job_photos j where j.request_id = p_request and j.status = 'ready';
end
$$;

-- Aufräumen beider Buckets (photo-cleanup): (a) Dateien in job-photos ohne Zeile nach 1 h, (b) Kopien (nicht Belege) zurückgezogener,
-- abgelaufener und nicht vermittelter Anfragen sowie 30 Tage nach Zugriffsende, (c) Originale zurückgezogener Anfragen (request_photos
-- bleibt unveränderlich, der Status der Anfrage entscheidet). Verschwindet das Objekt, fällt es aus der Liste.
create function public.photo_purge() returns table (bucket_id text, name text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  days int := private.setting_num('partner_access_days')::int;
begin
  return query
  select u.bucket_id, u.name from (
    select o.bucket_id::text as bucket_id, o.name from storage.objects o
    where o.bucket_id = 'job-photos' and coalesce(o.created_at, '-infinity'::timestamptz) < now() - interval '1 hour'
      and not exists (select 1 from public.job_photos j where j.storage_path = o.name)
    union all
    select o.bucket_id::text, o.name from storage.objects o
    join public.job_photos j on j.storage_path = o.name and j.kind = 'request'
    join public.service_requests s on s.id = j.request_id
    where o.bucket_id = 'job-photos' and (
      s.status in ('withdrawn', 'expired', 'unmatched')
      or (s.status in ('completed', 'cancelled_by_customer', 'cancelled_by_partner')
          and not exists (select 1 from public.assignments a where a.request_id = s.id
                          and (a.ended_at is null or a.ended_at > now() - make_interval(days => days))))
    )
    union all
    select o.bucket_id::text, o.name from storage.objects o
    join public.request_photos rp on rp.storage_path = o.name
    join public.service_requests s on s.id = rp.request_id
    where o.bucket_id = 'request-photos' and s.status = 'withdrawn'
  ) u limit 1000;
end
$$;

revoke all on function
  public.photo_claim(int), public.photo_publish_dispatch(), public.photo_publish_begin(uuid, int),
  public.photo_publish_mark(uuid, int, boolean, text, text, text), public.photo_receipt_check(uuid, text, uuid),
  public.photo_receipt_add(uuid, text, uuid, text, text), public.job_photo_list(uuid, text, uuid, uuid),
  public.admin_photo(uuid, uuid, text), public.photo_purge()
  from public, anon, authenticated, service_role;
grant execute on function
  public.photo_claim(int), public.photo_publish_begin(uuid, int), public.photo_publish_mark(uuid, int, boolean, text, text, text),
  public.photo_receipt_check(uuid, text, uuid), public.photo_receipt_add(uuid, text, uuid, text, text),
  public.job_photo_list(uuid, text, uuid, uuid), public.admin_photo(uuid, uuid, text), public.photo_purge()
  to service_role;

select cron.schedule('photo-publish-dispatch', '* * * * *', 'select public.photo_publish_dispatch()');
