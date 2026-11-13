-- s9t-1: lesende Zählung der Testreste auf Dev (nur SELECT)
with p as (
  select p.*,
    not exists (select 1 from public.partner_members m where m.partner_id = p.id) as orphan,
    (exists (select 1 from public.assignments a where a.partner_id = p.id) or exists (select 1 from public.partner_offers o where o.partner_id = p.id)) as bound,
    exists (select 1 from public.commission_entries c where c.partner_id = p.id) as journal,
    exists (select 1 from public.job_photos j where j.uploaded_partner_id = p.id) as photos,
    exists (select 1 from public.price_revisions r where r.proposed_by = p.id) as revs,
    exists (select 1 from public.partner_members m join auth.users x on x.id = m.user_id where m.partner_id = p.id and x.email like 'pt-%@movenow.test') as pt_member
  from public.partners p
)
select 'partners gesamt' as k, count(*) as n from p
union all select 'partners orphan', count(*) from p where orphan
union all select 'partners orphan name=Testfirma GmbH', count(*) from p where orphan and name = 'Testfirma GmbH'
union all select 'partners orphan, andere Namen', count(*) from p where orphan and name <> 'Testfirma GmbH'
union all select 'partners mit pt-Mitglied', count(*) from p where pt_member
union all select 'partners contact_email firma@movenow.test', count(*) from p where contact_email = 'firma@movenow.test'
union all select 'partners contact_email %@movenow.test', count(*) from p where contact_email like '%@movenow.test'
union all select 'partners contact_email NICHT .test', count(*) from p where contact_email not like '%@movenow.test'
union all select 'orphan + email .test', count(*) from p where orphan and contact_email like '%@movenow.test'
union all select 'orphan + email NICHT .test', count(*) from p where orphan and contact_email not like '%@movenow.test'
union all select 'orphan bound (Zuordnung/Angebot)', count(*) from p where orphan and bound
union all select 'orphan journal', count(*) from p where orphan and journal
union all select 'orphan job_photos', count(*) from p where orphan and photos
union all select 'orphan price_revisions.proposed_by', count(*) from p where orphan and revs
union all select 'orphan unbound/ohne Journal/Fotos/Revisionen', count(*) from p where orphan and not bound and not journal and not photos and not revs
union all select 'orphan status ' || status::text, count(*) from p where orphan group by status
union all select 'orphan active/payment_hold', count(*) from p where orphan and status in ('active','payment_hold')
union all select 'nicht orphan, kein pt-Mitglied', count(*) from p where not orphan and not pt_member
union all select 'partner_members gesamt', count(*) from public.partner_members
union all select 'partner_documents', count(*) from public.partner_documents
union all select 'partner_regions', count(*) from public.partner_regions
union all select 'partner_categories', count(*) from public.partner_categories
union all select 'partner_vat_rules', count(*) from public.partner_vat_rules
union all select 'job_listings', count(*) from public.job_listings
union all select 'assignments', count(*) from public.assignments
union all select 'assignments ended_at null', count(*) from public.assignments where ended_at is null
union all select 'partner_offers', count(*) from public.partner_offers
union all select 'commission_entries', count(*) from public.commission_entries
union all select 'job_photos', count(*) from public.job_photos
union all select 'service_requests', count(*) from public.service_requests
union all select 'auth.users gesamt', count(*) from auth.users
union all select 'auth.users pt-%@movenow.test', count(*) from auth.users where email like 'pt-%@movenow.test'
union all select 'auth.users sonstige .test', count(*) from auth.users where email like '%@movenow.test' and email not like 'pt-%'
union all select 'auth.users nicht .test', count(*) from auth.users where email not like '%@movenow.test'
union all select 'storage.objects', count(*) from storage.objects
union all select 'storage.objects partner-documents', count(*) from storage.objects where bucket_id = 'partner-documents'
order by 1;
