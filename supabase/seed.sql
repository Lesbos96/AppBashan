-- Seed: Kunden-Tarife aus dem Prototyp (docs/reference/MoveNow_Prototyp.html, Zeilen 26, 32, 38, 98–104),
-- Gebührensätze und die drei Demo-Mietangebote. Idempotent, läuft per db:push (--include-seed).
-- Geldwerte in Cent. Das Preismodul rechnet value / 100 in Euro, wie der Prototyp.

insert into public.price_versions (version, effective_on, note)
select v.version, v.effective_on::date, v.note
from (values (1, '2026-10-28', 'Recherche 28.10.2026')) as v(version, effective_on, note)
where not exists (select 1 from public.price_versions p where p.version = v.version);

insert into public.price_config (version, key, value, unit, label, sources, researched_at)
select v.version, v.key, v.value, v.unit, v.label, v.sources::jsonb, v.researched_at::date
from (values
  (1, 'team_rate.1', 4800, 'cent/h', 'Team 1 Person mit Fahrzeug, je Stunde',
    '[{"label": "Extraumzug · 48 €/h brutto", "url": "https://www.extraumzug.at/preisliste"}]', '2026-10-28'),
  (1, 'team_rate.2', 5575, 'cent/h', 'Team 2 Personen mit LKW, je Stunde · (42 + 50 + 59 + 72) / 4',
    '[{"label": "Schindler · 42 €/h brutto", "url": "https://www.schindlerumzug.heroldwebsites.at/preise"},
      {"label": "Delta · 50 €/h brutto, mindestens 3 h", "url": "https://www.deltaumzug.at/preisliste/"},
      {"label": "Alpine · 59 €/h brutto, mindestens 2 h", "url": "https://www.alpine-transport.at/preise/"},
      {"label": "Wiener Möbelpacker · 72 €/h brutto", "url": "https://www.wienermoebelpacker.at/wp-content/uploads/2026/01/umzug-wien-preise-kosten-preisliste.pdf"}]',
    '2026-10-28'),
  (1, 'team_rate.3', 7080, 'cent/h', 'Team 3 Personen, je Stunde',
    '[{"label": "Umzugsprinz · 70,80 €/h", "url": "https://umzugsprinz.at/preise/"}]', '2026-10-28'),
  (1, 'team_rate.4', 10080, 'cent/h', 'Team 4 Personen, je Stunde',
    '[{"label": "Umzugsprinz · 100,80 €/h", "url": "https://umzugsprinz.at/preise/"}]', '2026-10-28'),
  (1, 'team_rate.extra_person', 2400, 'cent/h', 'Jede weitere Person ab der fünften, je Stunde',
    '[{"label": "Schindler · Zusatzperson 24 €/h", "url": "https://www.schindlerumzug.heroldwebsites.at/preise"}]', '2026-10-28'),
  (1, 'extra_vehicle_rate', 1800, 'cent/h', 'Jedes weitere Fahrzeug, je Stunde',
    '[{"label": "UmzugsPower · 15 € netto = 18 € brutto je Stunde", "url": "https://www.umzugspower.at/preise/"}]', '2026-10-28'),
  (1, 'min_hours.transport', 2, 'h', 'Mindestdauer Möbeltransport',
    '[{"label": "Alpine · mindestens 2 h", "url": "https://www.alpine-transport.at/preise/"}]', '2026-10-28'),
  (1, 'min_hours.move', 3, 'h', 'Mindestdauer Umzug',
    '[{"label": "Delta · mindestens 3 h", "url": "https://www.deltaumzug.at/preisliste/"}]', '2026-10-28'),
  (1, 'outside_km_rate', 108, 'cent/km', 'Kilometer außerhalb Wiens, je Fahrzeug',
    '[{"label": "Ideal · 0,90 €/km netto = 1,08 € brutto", "url": "https://ideal-umzug.at/preise"}]', '2026-10-28'),
  (1, 'box', 360, 'cent/Stück', 'Umzugskarton',
    '[{"label": "UmzugsPower · 3 € netto = 3,60 € brutto", "url": "https://www.umzugspower.at/preise/"}]', '2026-10-28'),
  (1, 'parking_zone', 12000, 'cent/Adresse', 'Halteverbotszone je Adresse',
    '[{"label": "UmzugsPower · 100 € netto = 120 € brutto", "url": "https://www.umzugspower.at/preise/"}]', '2026-10-28'),
  (1, 'piano.vienna_base', 18000, 'cent', 'Klavier innerhalb Wiens, Preisorientierung',
    '[{"label": "Runiton · Piano 180 € inkl. USt.", "url": "https://runiton.at/klaviertransport/"}]', '2026-10-28'),
  (1, 'piano.per_floor', 2400, 'cent/Stockwerk', 'Klavier je zu tragendem Stockwerk, Preisorientierung',
    '[{"label": "Runiton · 24 € je Stockwerk", "url": "https://runiton.at/klaviertransport/"}]', '2026-10-28'),
  (1, 'clearance.rate', 7500, 'cent/m3', 'Entrümpelung je m³ · (60 + 65 + 100) / 3',
    '[{"label": "Vectura · Mengenpakete", "url": "https://vectura-rental.at/pages/entruempelung-wien"},
      {"label": "Kraftpack · 100 €/m³", "url": "https://kraftpack.at/preisliste"}]', '2026-10-28'),
  (1, 'clearance.rate_low', 6000, 'cent/m3', 'Entrümpelung, Spanne unten je m³',
    '[{"label": "Vectura · Mengenpakete", "url": "https://vectura-rental.at/pages/entruempelung-wien"}]', '2026-10-28'),
  (1, 'clearance.rate_high', 10000, 'cent/m3', 'Entrümpelung, Spanne oben je m³',
    '[{"label": "Kraftpack · 100 €/m³", "url": "https://kraftpack.at/preisliste"}]', '2026-10-28'),
  (1, 'clearance.minimum', 18000, 'cent', 'Entrümpelung, Mindestpreis',
    '[{"label": "Ohne Einzelquelle"}]', '2026-10-28'),
  (1, 'clearance.floor_surcharge', 2500, 'cent/Etage', 'Ohne Lift je Etage ab dem 2. Stock',
    '[{"label": "Ohne Einzelquelle"}]', '2026-10-28'),
  (1, 'clearance.volume_factor.light', 0.12, 'm3/m2', 'Fläche zu Volumen, wenig gefüllt (Planannahme)',
    '[{"label": "Planannahme, keine Messung"}]', '2026-10-28'),
  (1, 'clearance.volume_factor.normal', 0.25, 'm3/m2', 'Fläche zu Volumen, normal gefüllt (Planannahme)',
    '[{"label": "Planannahme, keine Messung"}]', '2026-10-28'),
  (1, 'clearance.volume_factor.full', 0.45, 'm3/m2', 'Fläche zu Volumen, voll (Planannahme)',
    '[{"label": "Planannahme, keine Messung"}]', '2026-10-28'),
  (1, 'assembly.rate_per_lfm', 4787, 'cent/lfm', 'Montage Standardmöbel je Laufmeter · (42 + 46,60 + 55) / 3, 1 h je lfm',
    '[{"label": "DasUmzugsteam · Montage 42 €/h", "url": "https://www.dasumzugsteam.at/wp-content/uploads/2026/02/DasUmzugsteam-Preisliste-2026.pdf"},
      {"label": "Kraftpack · Montage 55 €/h", "url": "https://kraftpack.at/preisliste"}]', '2026-10-28'),
  (1, 'assembly.min_lfm', 2, 'lfm', 'Montage Standardmöbel, mindestens',
    '[{"label": "Ohne Einzelquelle"}]', '2026-10-28'),
  (1, 'kitchen.base', 7200, 'cent', 'Küche, Grundbetrag (ohne Anschlüsse)',
    '[{"label": "DasUmzugsteam · Küchen-Laufmeter", "url": "https://www.dasumzugsteam.at/wp-content/uploads/2026/02/DasUmzugsteam-Preisliste-2026.pdf"}]', '2026-10-28'),
  (1, 'kitchen.lower_per_lfm', 14400, 'cent/lfm', 'Küche, Unterschrank je Laufmeter',
    '[{"label": "DasUmzugsteam · Küchen-Laufmeter", "url": "https://www.dasumzugsteam.at/wp-content/uploads/2026/02/DasUmzugsteam-Preisliste-2026.pdf"}]', '2026-10-28'),
  (1, 'kitchen.upper_per_lfm', 4800, 'cent/lfm', 'Küche, Oberschrank je Laufmeter',
    '[{"label": "DasUmzugsteam · Küchen-Laufmeter", "url": "https://www.dasumzugsteam.at/wp-content/uploads/2026/02/DasUmzugsteam-Preisliste-2026.pdf"}]', '2026-10-28'),
  (1, 'kitchen.tall_per_lfm', 20400, 'cent/lfm', 'Küche, Hochschrank je Laufmeter',
    '[{"label": "DasUmzugsteam · Küchen-Laufmeter", "url": "https://www.dasumzugsteam.at/wp-content/uploads/2026/02/DasUmzugsteam-Preisliste-2026.pdf"}]', '2026-10-28'),
  -- Kein Tarif: Quellen zur Transportermiete (Tarife stehen je Fahrzeug in rental_offers), für das Info-Sheet.
  (1, 'rental.reference', 0, 'ref', 'Transportermiete, Tarif des Vermieters',
    '[{"label": "Transportervermietung Wien", "url": "https://transportervermietung-wien.at/preise.html"},
      {"label": "FunCar · Klassenpreise", "url": "https://www.funcar.at/transporter-mieten/"},
      {"label": "MietVan · Schutzpakete", "url": "https://mietvan.at/preisliste-transporter/"},
      {"label": "SIXT · Preisbestandteile als Referenz", "url": "https://www.sixt.at/help-center/sections/preise-gebuhren-und-schutzpakete/"}]', '2026-10-28')
) as v(version, key, value, unit, label, sources, researched_at)
where not exists (select 1 from public.price_config c where c.version = v.version and c.key = v.key);

-- Nicht öffentlich: Partner-Mitglieder (aal2, nur fee_rate und fee_vat_rate) und admin (aal2) lesen; note bleibt intern.
insert into public.platform_settings (key, version, value, note, effective_from)
select v.key, v.version, v.value, v.note, v.effective_from::date
from (values
  ('fee_rate', 1, 0.15, 'Plattformgebühr inkl. USt., Anteil am Gesamtpreis', '2026-10-28'),
  ('fee_vat_rate', 1, 0.20, 'USt.-Satz, der in der Plattformgebühr enthalten ist', '2026-10-28'),
  ('fee_notice_days', 1, 30, 'Vorlauf für Änderungen der Gebührenschlüssel in Tagen', '2026-10-28'),
  ('price_hold_minutes', 1, 30, 'Haltefenster für den alten Preis', '2026-10-28'),
  ('accept_max_hours', 1, 24, 'Annahmefrist, Obergrenze in Stunden', '2026-10-28'),
  ('accept_min_hours', 1, 2, 'Annahmefrist, Untergrenze in Stunden', '2026-10-28'),
  ('accept_lead_share_percent', 1, 50, 'Annahmefrist, Anteil der Vorlaufzeit in Prozent', '2026-10-28'),
  ('offer_valid_hours', 1, 48, 'Gültigkeit eines Festangebots in Stunden', '2026-10-28'),
  ('offers_open_max', 1, 3, 'Offene Festangebote je Anfrage', '2026-10-28'),
  ('change_valid_hours', 1, 2, 'Gültigkeit eines Nachtrags in Stunden', '2026-10-28'),
  ('partner_access_days', 1, 30, 'Zugriff des Partners auf Kontakt und Fotos nach Abschluss in Tagen', '2026-10-28'),
  ('completion_days', 1, 7, 'Antwortfrist des Kunden nach dem Termin in Tagen', '2026-10-28'),
  ('reissue_min_hours', 1, 24, 'Mindestabstand zum Termin für die Neuverteilung in Stunden', '2026-10-28'),
  ('cancel_free_hours', 1, 48, 'Storno des Kunden kostenlos bis so viele Stunden vor dem Termin', '2026-10-28'),
  ('cancel_late_percent', 1, 50, 'Storno danach: Prozent des Gesamtpreises', '2026-10-28'),
  ('cancel_full_percent', 1, 100, 'Storno ab dem Termintag: Prozent des Gesamtpreises', '2026-10-28'),
  ('cancel_full_days_before', 1, 0, 'Kalendertage vor dem Termin, ab denen cancel_full_percent gilt', '2026-10-28'),
  ('call_out_fee_cents', 1, 6900, 'Anfahrtspauschale in Cent (vorläufig)', '2026-10-28'),
  ('offer_max_cents', 1, 800000, 'Obergrenze eines Festangebots ohne Spanne in Cent', '2026-10-28'),
  ('partner_open_jobs_max', 1, 5, 'Offene angenommene Aufträge je Partner', '2026-10-28'),
  ('partner_cancel_review_count', 1, 3, 'Prüfung ab so vielen Partner-Stornos', '2026-10-28'),
  ('partner_cancel_review_days', 1, 30, 'Zeitraum der Partner-Storno-Prüfung in Tagen', '2026-10-28'),
  ('photo_staging_hours', 1, 24, 'Aufräumfrist für Fotos im Staging-Pfad in Stunden', '2026-10-28'),
  ('photo_retention_days', 1, 90, 'Aufbewahrung der Originalfotos nach dem Endstatus der Anfrage in Tagen', '2026-10-28'),
  ('receipt_retention_days', 1, 365, 'Aufbewahrung der Belegfotos der Partner nach dem Endstatus der Anfrage in Tagen', '2026-10-28'),
  ('window_start_morning', 1, 480, 'Beginn Vormittag, Minuten nach Mitternacht (Wiener Zeit)', '2026-10-28'),
  ('window_start_midday', 1, 660, 'Beginn Mittag, Minuten nach Mitternacht (Wiener Zeit)', '2026-10-28'),
  ('window_start_afternoon', 1, 840, 'Beginn Nachmittag, Minuten nach Mitternacht (Wiener Zeit)', '2026-10-28'),
  ('window_start_flexible', 1, 480, 'Beginn Flexibel, Minuten nach Mitternacht (Wiener Zeit)', '2026-10-28')
) as v(key, version, value, note, effective_from)
where not exists (select 1 from public.platform_settings s where s.key = v.key and s.version = v.version);

select private.publish_seed_version(1);

-- Demo-Mietangebote aus sampleOffers (Prototyp Zeile 26). Ohne Vermieter-Konto, als Demo markiert.
insert into public.rental_offers (
  id, provider_id, provider_name, name, station, size_m3, daily_cents, km_per_day, extra_km_cents,
  cover_daily_cents, excess_cents, cover_excess_cents, driver_daily_cents, booking_fee_cents, one_way_cents,
  deposit_cents, status, is_demo
)
values
  ('00000000-0000-4000-8000-000000000001', null, 'Beispielvermieter Wien', 'City Van', 'Wien · Standort West',
    6, 7900, 100, 35, 1900, 150000, 50000, 900, 0, 4900, 30000, 'approved', true),
  ('00000000-0000-4000-8000-000000000002', null, 'Beispielvermieter Wien', 'Cargo Van', 'Wien · Standort Süd',
    12, 9900, 150, 40, 2400, 180000, 50000, 1000, 1000, 5900, 50000, 'approved', true),
  ('00000000-0000-4000-8000-000000000003', null, 'Beispielvermieter Österreich', 'Maxi Van', 'Wien · Standort Nord',
    17, 12900, 200, 45, 2900, 200000, 75000, 1200, 0, 7900, 70000, 'approved', true)
on conflict (id) do update set
  provider_name = excluded.provider_name, name = excluded.name, station = excluded.station,
  size_m3 = excluded.size_m3, daily_cents = excluded.daily_cents, km_per_day = excluded.km_per_day,
  extra_km_cents = excluded.extra_km_cents, cover_daily_cents = excluded.cover_daily_cents,
  excess_cents = excluded.excess_cents, cover_excess_cents = excluded.cover_excess_cents,
  driver_daily_cents = excluded.driver_daily_cents, booking_fee_cents = excluded.booking_fee_cents,
  one_way_cents = excluded.one_way_cents, deposit_cents = excluded.deposit_cents,
  status = excluded.status, is_demo = excluded.is_demo;
