-- 0005 Die View bekommt wie alle Tabellen zuerst keine Rechte (Entscheidung 2), dann nur select.
revoke all on public.current_price_version from anon, authenticated;
grant select on public.current_price_version to anon, authenticated;
