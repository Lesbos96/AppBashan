-- 0075 mail1: (1) Verfall von „Unterwegs“-Mails (Fehlercode expired), (2) Abnahme 0074, N1: Eine Definition, wann eine Outbox-Zeile fällig ist: outbox_claim holt nur fällige Zeilen, und der Cron ruft die Function nur auf,
-- wenn eine fällig ist (bisher rief er sie auch auf, solange eine Zeile im Wiederholungs-Abstand von bis zu 16 Stunden oder in der Lease wartete: leere Aufrufe).
-- Fällig: weniger als 5 Versuche und entweder `pending` (neu, ohne claimed_at oder nach 15 Min. × 4^(Versuche − 1) seit dem letzten Versuch)
-- oder `sending` mit abgelaufener Lease (10 Minuten). Hilfsfunktion nur für Funktionen des Eigentümers (outbox_claim, outbox_dispatch): kein Grant.

create function private.outbox_is_due(o public.outbox) returns boolean
language sql stable set search_path = ''
as $$
  select o.attempts < 5
    and ((o.status = 'pending' and (o.attempts = 0 or o.claimed_at is null or o.claimed_at < now() - interval '15 minutes' * power(4, o.attempts - 1)::float8))
         or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes'))
$$;

create or replace function public.outbox_claim(p_limit int)
returns table (id bigint, kind text, recipient_kind text, recipient_id uuid, request_id uuid, partner_email text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.outbox_expire();
  return query
  with c as (
    select o.id from public.outbox o
    where private.outbox_is_due(o)
    order by o.id limit greatest(1, least(p_limit, 50)) for update skip locked
  ), u as (
    update public.outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1 from c where o.id = c.id
    returning o.id, o.kind, o.recipient_kind, o.recipient_id, o.request_id
  )
  select u.id, u.kind, u.recipient_kind, u.recipient_id, u.request_id, p.contact_email
  from u left join public.partners p on u.recipient_kind = 'partner' and p.id = u.recipient_id;
end
$$;

-- Verfall: Eine Mail „Dein Partner ist unterwegs“ ist nach der Ankunftszeit veraltet. outbox-send markiert sie mit dem Code `expired`; die Zeile ist sofort endgültig
-- `failed` (ohne weitere Versuche, ohne claimed_at). Alle anderen Fehlercodes bleiben wie in 0074 (pending bis zum fünften Versuch).
alter table public.outbox drop constraint outbox_last_error_code;
alter table public.outbox add constraint outbox_last_error_code
  check (last_error is null or last_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient', 'lease_expired', 'expired'));

create or replace function public.outbox_mark(p_id bigint, p_ok boolean, p_error text) returns void
language sql security definer set search_path = ''
as $$
  update public.outbox o set
    status = case when p_ok then 'sent' when p_error = 'expired' or o.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    claimed_at = case when p_ok or p_error = 'expired' or o.attempts >= 5 then null else o.claimed_at end,
    last_error = case
      when p_ok then null
      when p_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient', 'expired') then p_error
      else 'smtp_error'
    end
  where o.id = p_id and o.status = 'sending'
$$;

create or replace function public.outbox_dispatch() returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  secret text;
  url text;
begin
  perform private.outbox_expire();
  if not exists (select 1 from public.outbox o where private.outbox_is_due(o)) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'outbox_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'outbox_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then return; end if;
  perform net.http_post(url := url, headers := jsonb_build_object('x-outbox-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000);
end
$$;
