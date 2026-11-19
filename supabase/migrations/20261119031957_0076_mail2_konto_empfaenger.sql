-- 0076 mail2: Mail-Pflichtpunkte vor booking_open (GOLIVE 46 bis 48, OFFEN mail1-2 bis mail1-4).
-- 1. Firmen-Mails gehen an die Anmeldeadresse des Inhaber-Kontos (BEKS Frage 1, Beks), nicht an die frei änderbare contact_email. outbox_claim liefert dafür das Konto
--    (`owner_id`: ältester Inhaber, nie `staff`) statt der Adresse; der Versand liest die Adresse über die Auth-API. contact_email bleibt für die Anzeige.
-- 2. Eine Zeile ohne Empfänger (no_recipient: Konto gibt es nicht) ist sofort endgültig `failed`, statt fünf Versuche zu verbrauchen (die Codeliste kennt den Code seit 0036).
-- 3. Ein Kontofehler des Anbieters (401, 402, 403, 429) gibt die Zeile mit dem Code `smtp_account` zurück, ohne den Versuch zu zählen; sie wartet den Abstand ab.
--    Der Versand bricht dann den ganzen Lauf ab (outbox-send): ein Kontofehler löscht nicht mehr alle wartenden Mails nach fünf Läufen.

-- Rückgabetyp ändert sich (partner_email → owner_id): drop und neu anlegen; EXECUTE nur für den einzigen Aufrufer (outbox-send mit service_role).
drop function public.outbox_claim(int);

create function public.outbox_claim(p_limit int)
returns table (id bigint, kind text, recipient_kind text, recipient_id uuid, request_id uuid, owner_id uuid)
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
  select u.id, u.kind, u.recipient_kind, u.recipient_id, u.request_id,
    case when u.recipient_kind = 'partner' then (
      select m.user_id from public.partner_members m
      where m.partner_id = u.recipient_id and m.role = 'owner'
      order by m.created_at, m.user_id limit 1
    ) end
  from u;
end
$$;

grant execute on function public.outbox_claim(int) to service_role;

alter table public.outbox drop constraint outbox_last_error_code;
alter table public.outbox add constraint outbox_last_error_code
  check (last_error is null or last_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient', 'lease_expired', 'expired', 'smtp_account'));

-- Fälligkeit: `pending` ohne claimed_at (neu) oder nach 15 Min. × 4^(Versuche − 1) seit dem letzten Versuch; eine mit smtp_account zurückgegebene Zeile hat claimed_at = jetzt und
-- wartet so mindestens 15 Minuten (auch mit null Versuchen). Das Limit von fünf Versuchen und die Lease (`sending`, 10 Minuten) bleiben wie in 0075.
create or replace function private.outbox_is_due(o public.outbox) returns boolean
language sql stable set search_path = ''
as $$
  select o.attempts < 5
    and ((o.status = 'pending' and (o.claimed_at is null or o.claimed_at < now() - interval '15 minutes' * power(4, greatest(o.attempts - 1, 0))::float8))
         or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes'))
$$;

-- Reihenfolge der Fälle: Erfolg · endgültig (expired, no_recipient) · Kontofehler (zurück, Versuch zählt nicht, auch beim fünften) · fünfter Versuch · sonst pending.
create or replace function public.outbox_mark(p_id bigint, p_ok boolean, p_error text) returns void
language sql security definer set search_path = ''
as $$
  update public.outbox o set
    status = case
      when p_ok then 'sent'
      when p_error in ('expired', 'no_recipient') then 'failed'
      when p_error = 'smtp_account' then 'pending'
      when o.attempts >= 5 then 'failed'
      else 'pending'
    end,
    sent_at = case when p_ok then now() end,
    attempts = case when not p_ok and p_error = 'smtp_account' then greatest(o.attempts - 1, 0) else o.attempts end,
    claimed_at = case
      when p_ok or p_error in ('expired', 'no_recipient') then null
      when p_error = 'smtp_account' then now()
      when o.attempts >= 5 then null
      else o.claimed_at
    end,
    last_error = case
      when p_ok then null
      when p_error in ('smtp_rejected', 'smtp_temp', 'smtp_error', 'unknown_kind', 'no_recipient', 'expired', 'smtp_account') then p_error
      else 'smtp_error'
    end
  where o.id = p_id and o.status = 'sending'
$$;
