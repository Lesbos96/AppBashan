begin;
create temp table res (v text);
create temp table ctx (uid uuid);
insert into ctx values (gen_random_uuid());
insert into auth.users (id, email, aud, role, instance_id) select uid, 'purgeprobe-' || replace(uid::text, '-', '') || '@movenow.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000' from ctx;
alter table public.request_contacts drop constraint request_contacts_format;
do $p$
declare uid uuid := (select ctx.uid from ctx);
begin
  begin
    set local role service_role;
    perform public.quote_save_request(p_customer => uid, p_client_ref => gen_random_uuid(), p_service => 'move', p_inputs => '{}', p_snapshot => '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}', p_price_version => '1', p_total => '68961', p_low => '68961', p_high => '68961', p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => '1', p_preferred_date => '2026-11-21', p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kein-mail","stairsDoor":null}', p_confirmed => '{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
    reset role;
    insert into res values ('angelegt');
  exception when others then
    reset role;
    insert into res values ('Anlage fehlgeschlagen ' || sqlstate || ': ' || sqlerrm);
  end;
end $p$;
insert into res select 'verletzende Zeilen vorher: ' || count(*) from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.customer_id = (select uid from ctx) and not (((c.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (c.phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (c.phone ~ '([0-9][^0-9]*){5}'::text)));
delete from public.request_contacts where request_id in (select r.id from public.service_requests r join auth.users u on u.id = r.customer_id where u.email like '%@movenow.test') and not (((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (phone ~ '([0-9][^0-9]*){5}'::text)));
alter table public.request_contacts drop constraint if exists request_contacts_format;
alter table public.request_contacts add constraint request_contacts_format CHECK (((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (phone ~ '^[0-9+()/ .-]{5,40}$'::text) AND (phone ~ '([0-9][^0-9]*){5}'::text)));
insert into res select 'Zeilen des Testkontos nachher: ' || count(*) from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.customer_id = (select uid from ctx);
insert into res select 'Constraint vorhanden: ' || count(*) from pg_constraint where conname = 'request_contacts_format' and conrelid = 'public.request_contacts'::regclass;
select string_agg(v, ' | ') as v from res;
rollback;
