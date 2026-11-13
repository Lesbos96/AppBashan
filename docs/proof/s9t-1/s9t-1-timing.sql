-- s9t-1: Messung, ob die Reste Abfragen verlangsamen (nur SELECT; Zeit in ms im Server)
do $t$
declare t0 timestamptz; n bigint; r text := '';
begin
  t0 := clock_timestamp(); select count(*) into n from public.partners p where not exists (select 1 from public.partner_members m where m.partner_id = p.id);
  r := r || 'partners ohne Mitglied: ' || round(extract(milliseconds from clock_timestamp() - t0)::numeric, 2) || ' ms; ';
  t0 := clock_timestamp(); select count(*) into n from public.assignments a join public.partners p on p.id = a.partner_id where a.ended_at is null;
  r := r || 'assignments offen x partners: ' || round(extract(milliseconds from clock_timestamp() - t0)::numeric, 2) || ' ms; ';
  t0 := clock_timestamp(); select count(*) into n from public.commission_entries c join public.partners p on p.id = c.partner_id;
  r := r || 'journal x partners: ' || round(extract(milliseconds from clock_timestamp() - t0)::numeric, 2) || ' ms; ';
  t0 := clock_timestamp(); select count(*) into n from public.job_listings l join public.partners p on p.id = l.partner_id where l.status = 'open';
  r := r || 'job_listings offen x partners: ' || round(extract(milliseconds from clock_timestamp() - t0)::numeric, 2) || ' ms; ';
  t0 := clock_timestamp(); select count(*) into n from public.partner_offers o join public.partners p on p.id = o.partner_id;
  r := r || 'partner_offers x partners: ' || round(extract(milliseconds from clock_timestamp() - t0)::numeric, 2) || ' ms';
  raise exception 'MESSUNG %', r; -- Abbruch: nichts bleibt zurück
end $t$;
