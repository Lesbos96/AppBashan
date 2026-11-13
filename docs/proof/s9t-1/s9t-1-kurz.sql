select 'altfirmen firma@movenow.test' as k, count(*) as n from public.partners where contact_email = 'firma@movenow.test'
union all select 'altfirmen aktiv/payment_hold', count(*) from public.partners where contact_email = 'firma@movenow.test' and status in ('active','payment_hold')
union all select 'marker-firmen (pt-firma-hex)', count(*) from public.partners where contact_email ~ '^pt-firma-[0-9a-f]{8}@movenow[.]test$'
union all select 'marker-firmen aktiv/payment_hold', count(*) from public.partners where contact_email ~ '^pt-firma-[0-9a-f]{8}@movenow[.]test$' and status in ('active','payment_hold')
union all select 'ungebunden gesamt (kein assignment/offer/journal)', count(*) from public.partners p where not exists (select 1 from public.assignments a where a.partner_id = p.id) and not exists (select 1 from public.partner_offers o where o.partner_id = p.id) and not exists (select 1 from public.commission_entries c where c.partner_id = p.id)
union all select 'Waechter-Firmen', count(*) from public.partners where name = 'Sweeptest-Wächter GmbH'
union all select 'echt-Konten', count(*) from auth.users where email like 'echt-%@example.org'
union all select 'Firmen in Bezirk 21 aktiv', count(*) from public.partners p where p.status = 'active' and exists (select 1 from public.partner_regions r where r.partner_id = p.id and r.district = 21)
union all select 'partners gesamt', count(*) from public.partners
union all select 'auth.users pt-', count(*) from auth.users where email like 'pt-%@movenow.test'
order by 1;
