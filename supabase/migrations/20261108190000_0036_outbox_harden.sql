-- S9d-2: Outbox härten (OPEN_ISSUES S9c-11 K1, K4; K2 sind Tests, K3 ist der Handler von outbox-send).
-- K4: `last_error` trägt nur feste Codes (keine SMTP-Meldungen mit Empfängeradressen), outbox_mark wirkt nur auf `sending`.
-- K1: Das Aufräumen abgelaufener Zeilen läuft im Cron-Lauf selbst, nicht erst beim nächsten Claim.

-- Feste Codes: die Ausgabe von safeCode() in outbox-send plus `lease_expired` (Aufräumen). Bestehende Freitexte werden auf `smtp_error` gesetzt.
update public.outbox set last_error = 'smtp_error'
where last_error is not null and last_error not in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient', 'lease_expired');

alter table public.outbox add constraint outbox_last_error_code
  check (last_error is null or last_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient', 'lease_expired'));

-- Eine Zeile, die nach dem fünften Versuch länger als die Lease `sending` blieb (Function abgestürzt), ist endgültig `failed`.
create function private.outbox_expire() returns void
language sql set search_path = ''
as $$
  update public.outbox o set status = 'failed', claimed_at = null, last_error = 'lease_expired'
  where o.status = 'sending' and o.attempts >= 5 and o.claimed_at < now() - interval '10 minutes'
$$;

revoke all on function private.outbox_expire() from public;

create or replace function public.outbox_claim(p_limit int)
returns table (id bigint, kind text, recipient_kind text, recipient_id uuid, request_id uuid, partner_email text)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.outbox_expire();
  return query
  with c as (
    select o.id from public.outbox o
    where o.attempts < 5 and (o.status = 'pending' or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes'))
    order by o.id limit greatest(1, least(p_limit, 50)) for update skip locked
  ), u as (
    update public.outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1 from c where o.id = c.id
    returning o.id, o.kind, o.recipient_kind, o.recipient_id, o.request_id
  )
  select u.id, u.kind, u.recipient_kind, u.recipient_id, u.request_id, p.contact_email
  from u left join public.partners p on u.recipient_kind = 'partner' and p.id = u.recipient_id;
end
$$;

-- Unbekannter Fehlertext wird zu `smtp_error`; ein Ergebnis für eine Zeile, die nicht (mehr) `sending` ist, ändert nichts.
create or replace function public.outbox_mark(p_id bigint, p_ok boolean, p_error text) returns void
language sql security definer set search_path = ''
as $$
  update public.outbox o set
    status = case when p_ok then 'sent' when o.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    claimed_at = null,
    last_error = case
      when p_ok then null
      when p_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient') then p_error
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
  if not exists (select 1 from public.outbox o where o.status in ('pending', 'sending') and o.attempts < 5) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'outbox_secret';
  select decrypted_secret into url from vault.decrypted_secrets where name = 'outbox_url';
  if coalesce(secret, '') = '' or coalesce(url, '') = '' then return; end if;
  perform net.http_post(url := url, headers := jsonb_build_object('x-outbox-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 30000);
end
$$;
