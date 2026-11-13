-- s9t-1: weitere lesende Zählung (nur SELECT)
select 'job_photos ' || kind::text || ' ' || status::text as k, count(*) as n from public.job_photos group by kind, status
union all select 'audit_log Spalten: ' || string_agg(column_name, ',' order by ordinal_position), 0 from information_schema.columns where table_schema = 'public' and table_name = 'audit_log'
union all select 'audit_log gesamt', count(*) from public.audit_log
union all select 'audit_log zu Testfirmen (entity_id)', count(*) from public.audit_log a where a.entity_id in (select id::text from public.partners)
union all select 'audit_log Aktionen zu Testfirmen: ' || a.action, count(*) from public.audit_log a where a.entity_id in (select id::text from public.partners) group by a.action
union all select 'audit actor in auth.users pt-', count(*) from public.audit_log a join auth.users x on x.id = a.actor_id where x.email like 'pt-%@movenow.test' and a.entity_id in (select id::text from public.partners)
union all select 'audit actor nicht mehr in auth.users', count(*) from public.audit_log a where a.entity_id in (select id::text from public.partners) and not exists (select 1 from auth.users x where x.id = a.actor_id)
union all select 'orphan firmen mit pt-Nutzern als Kunde/Fahrer (service_requests.customer_id)', count(distinct r.customer_id) from public.service_requests r join auth.users x on x.id = r.customer_id where x.email like 'pt-%@movenow.test'
union all select 'service_requests von pt-Nutzern', count(*) from public.service_requests r join auth.users x on x.id = r.customer_id where x.email like 'pt-%@movenow.test'
union all select 'service_requests nicht von pt-Nutzern', count(*) from public.service_requests r where not exists (select 1 from auth.users x where x.id = r.customer_id and x.email like 'pt-%@movenow.test')
union all select 'job_listings an Testfirmen', count(*) from public.job_listings where partner_id in (select id from public.partners)
union all select 'job_listings status ' || status::text, count(*) from public.job_listings group by status
union all select 'journal Zeilen an Testfirmen', count(*) from public.commission_entries where partner_id in (select id from public.partners)
union all select 'price_revisions proposed_by gesetzt', count(*) from public.price_revisions where proposed_by is not null
union all select 'price_revisions gesamt', count(*) from public.price_revisions
union all select 'outbox gesamt', count(*) from public.outbox
union all select 'status_events', count(*) from public.status_events
union all select 'pt-Nutzer ohne service_request (löschbar?)', count(*) from auth.users x where x.email like 'pt-%@movenow.test' and not exists (select 1 from public.service_requests r where r.customer_id = x.id)
union all select 'platform_settings', count(*) from public.platform_settings
order by 1;
