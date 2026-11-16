-- n12 (N-12): Wiederholung der Annahme nach verlorener Antwort.
-- partner_accept wirft bei einem zweiten Aufruf `already_taken`; die Antwort (assignmentId) des ersten ist dann verloren.
-- partner_accept_replay liefert sie der Firma, die das Listing selbst angenommen hat, und sonst null. Nur lesend; partner_accept und
-- partner_accept_basis bleiben unverändert. Aufrufer: Edge Function `accept` (service_role), p_actor nur aus dem geprüften JWT.
-- Alle Bedingungen zusammen: Akteur ist Mitglied der Firma des Listings, Listing `accepted`, aktive Zuordnung dieser Firma, Buchung
-- (booking) mit derselben Revision und derselben Auszahlung wie in der Wiederholung. Jede Abweichung ergibt null (die Function antwortet 409).
create function public.partner_accept_replay(p_actor uuid, p_listing uuid, p_revision uuid, p_shown_payout bigint)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select a.id
  from public.job_listings l
  join public.partner_members m on m.partner_id = l.partner_id and m.user_id = p_actor
  join public.assignments a on a.request_id = l.request_id and a.partner_id = l.partner_id and a.ended_at is null
  join public.commission_entries c on c.request_id = l.request_id and c.partner_id = l.partner_id and c.kind = 'booking'
  where l.id = p_listing
    and l.status = 'accepted'
    and c.revision_id = p_revision
    and c.payout_cents = p_shown_payout
$$;

revoke all on function public.partner_accept_replay(uuid, uuid, uuid, bigint) from public, anon, authenticated, service_role;
grant execute on function public.partner_accept_replay(uuid, uuid, uuid, bigint) to service_role;
