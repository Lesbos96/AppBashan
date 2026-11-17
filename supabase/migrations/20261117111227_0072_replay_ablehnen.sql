-- 0072 rj1 (OFFEN n12-2 + S9i6-5, Muster 0068/0069): Wiederholung derselben Partei nach Erfolg liefert das erste Ergebnis statt 409 bei decline_listing
-- (Firma) und reject_offers (Kunde). Rümpfe wörtlich wie die letzte Fassung (beide 0038:434 und :592), je ein Block mehr. Keine neue Funktion:
-- `create or replace` lässt die Rechte unverändert (kein neues EXECUTE). Ein Replay schreibt nichts (kein Status, keine Outbox-Zeile, kein Ereignis,
-- kein decided_at) und liegt hinter den Eigentums- und Rechteprüfungen (aal2, aktive Firma, eigenes Listing bzw. eigene Anfrage) und hinter dem Sperren
-- von Anfrage und Listing: ein gleichzeitiger zweiter Aufruf wartet auf die Sperre und liest danach den neuen Stand (Read Committed, zweite Lesung).
-- decline_listing: `declined` am Listing setzt nur decline_listing (alle anderen Wege setzen `closed` oder `accepted`); das Listing trägt keinen Akteur,
-- die Firma ist die Partei (wie withdraw_offer in 0069). reject_offers: `declined` an der Anfrage setzt nur reject_offers (Statuspaar offered>declined);
-- Beweis der Partei ist das Statusereignis mit dem Kunden als Akteur (wie withdraw in 0069), nicht der Status allein.

-- Ablehnen: ein Partner mit gesendetem Angebot zieht es zuerst zurück (offer_exists); T8 zählt nur lebende Listings (S9c-12 K6).
create or replace function public.decline_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
  l public.job_listings;
  r public.service_requests;
begin
  if uid is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  select * into l from public.job_listings x where x.id = p_listing and x.partner_id = pid;
  if not found then raise exception 'not_found'; end if;
  select * into r from public.service_requests s where s.id = l.request_id for update;
  select * into l from public.job_listings x where x.id = p_listing for update;
  -- rj1: die Firma hat das Listing schon abgelehnt (verlorene Antwort): derselbe Erfolg, keine Wirkung (weder Status noch Outbox noch Ereignis)
  if l.status = 'declined' then return; end if;
  if l.status <> 'open' then raise exception 'invalid_transition'; end if;
  if exists (select 1 from public.partner_offers o where o.request_id = r.id and o.partner_id = pid and o.status = 'sent') then
    raise exception 'offer_exists';
  end if;
  update public.job_listings set status = 'declined', decided_at = now() where id = p_listing;
  if r.status in ('requested', 'awaiting_offer') and r.accept_deadline > now() and not private.request_has_live_listing(r.id) then
    perform private.set_request_status(r.id, 'unmatched', null, 'system');
    perform private.outbox_put('request_unmatched', 'customer', r.customer_id, r.id, 'request_unmatched:' || r.id);
  end if;
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
