-- s9i-7c2 (S9i7c2-1): partner_accept_basis lieferte total_cents als integer, deklariert war bigint (42804, seit 0031): die Edge Function `accept` antwortete immer mit 500.
-- Rumpf wortgleich zu 0038:359-384, einzige Änderung: rev.total_cents::bigint. Keine neuen Rechte (create or replace behält sie), keine Typänderung an Spalten.

create or replace function public.partner_accept_basis(p_actor uuid, p_listing uuid)
returns table (revision_id uuid, total_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  l public.job_listings;
  r public.service_requests;
  rev public.price_revisions;
  f record;
begin
  select * into l from public.job_listings x where x.id = p_listing;
  if not found or not exists (select 1 from public.partner_members m where m.user_id = p_actor and m.partner_id = l.partner_id) then
    raise exception 'not_found';
  end if;
  select * into r from public.service_requests s where s.id = l.request_id;
  if r.status in ('awaiting_offer', 'offered') then raise exception 'offer_required'; end if;
  if l.status = 'declined' then raise exception 'listing_declined'; end if;
  if l.status <> 'open' then raise exception 'already_taken'; end if;
  if r.accept_deadline <= now() then raise exception 'expired'; end if;
  if not private.in_scope(l.partner_id, r.service, r.district) then raise exception 'not_responsible'; end if;
  select * into rev from public.price_revisions v where v.id = r.current_revision;
  if rev.total_cents is null then raise exception 'price_not_fixed'; end if;
  select * into f from private.current_fee();
  return query select rev.id, rev.total_cents::bigint, f.fee_rate, f.fee_vat_rate, f.fee_rate_version, f.fee_vat_rate_version;
end
$$;
