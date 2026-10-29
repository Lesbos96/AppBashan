-- Seed: Kunden-Tarife aus dem Prototyp (docs/reference/MoveNow_Prototyp.html, Zeilen 26, 32, 38, 98–104),
-- Gebührensätze und die drei Demo-Mietangebote. Idempotent, läuft per db:push (--include-seed).
-- Geldwerte in Cent. Das Preismodul rechnet value / 100 in Euro, wie der Prototyp.

insert into public.price_versions (version, effective_on, note)
values (1, '2026-10-28', 'Recherche 28.10.2026')
on conflict (version) do update set effective_on = excluded.effective_on, note = excluded.note;

insert into public.price_config (version, key, value, unit, label, sources, researched_at)
values
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
on conflict (version, key) do update set
  value = excluded.value, unit = excluded.unit, label = excluded.label,
  sources = excluded.sources, researched_at = excluded.researched_at;

-- Nicht öffentlich: nur rental_provider und admin lesen.
insert into public.platform_settings (key, version, value, note)
values
  ('fee_rate', 1, 0.15, 'Plattformgebühr inkl. USt., Anteil am Gesamtpreis'),
  ('fee_vat_rate', 1, 0.20, 'USt.-Satz, der in der Plattformgebühr enthalten ist')
on conflict (key, version) do update set value = excluded.value, note = excluded.note;

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
