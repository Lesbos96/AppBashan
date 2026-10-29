# MoveNow · Architektur

Stand S1 (2026-10-29). Verbindlich für S2–S10. Schema: `supabase/migrations/` (0001 Fundament, 0002 Härtung), Typen: `supabase/functions/_shared/database.types.ts` (`npm run db:types`).

## Rollen
`profiles.role` (Enum `user_role`): **customer** (Standard, per Trigger beim Anlegen des Auth-Nutzers), **rental_provider** (nur über RPC `become_rental_provider()` aus Profil → „Für Vermieter"; wandelt nur `customer` um), **admin** (nur per SQL im Supabase-Dashboard), **partner** (nur im Enum, Portal ist „Später"). Rechte auf eigene Daten hängen am Eigentum (`customer_id = auth.uid()`), nicht an der Rolle: Wer Vermieter wird, behält seine Anfragen.

## Datenmodell
Alle Beträge Integer-Cent. Enums: `service_type` (transport, move, clearance, assembly), `request_status` (s. u.), `region` (vienna, austria, international), `offer_status` (pending, approved, archived).

| Tabelle | Schlüssel und Kernfelder |
|---|---|
| `profiles` | `id` = `auth.users.id`, `role`, `display_name`, `phone` |
| `price_versions` | `version` PK, `effective_on` (= „Tarifstand" in 14) |
| `price_config` | PK (`version`, `key`), `value` numeric, `unit` (Geld als `cent…`), `label`, `sources` jsonb `[{label, url}]`, `researched_at`. Nur Kunden-Tarife; Zeilen mit `unit` `ref` sind Quellenverweise ohne Tarif (Info-Sheet), `@pricing` und `quote` ignorieren sie |
| `platform_settings` | PK (`key`, `version`), `value`: `fee_rate` 0,15, `fee_vat_rate` 0,20 |
| `service_requests` | `customer_id`, `service`, `status`, `inputs` jsonb, `price_snapshot` jsonb (nur Kunden-Positionen, bei Angebotspflicht die Gründe), `price_version` FK, `estimate_cents` (null ⇔ `needs_quote`), Adressen, PLZ, `geography`-Punkte, `route` jsonb, `region`, `preferred_date`, `time_window` |
| `request_photos` | `request_id` FK, `storage_path` unique (`{user}/{request}/{datei}`) |
| `rental_offers` | `provider_id` (null nur bei `is_demo`), `provider_name`, alle `offerFields` als `*_cents`/km/m³, `status`, `is_demo` |
| `rental_bookings` | `offer_id`, `customer_id`, `status`, `pickup_at`, `return_at`, `km`, `cover`, `extra_driver`, `one_way`, `price_snapshot` (inkl. Kopie der Angebotswerte), `price_version`, `total_cents`, `deposit_cents` |
| `fee_splits` | genau eins von `service_request_id`/`rental_booking_id`, `payee_id`, `total_cents`, `fee_rate`, `fee_vat_rate`, `fee_cents`, `fee_net_cents`, `fee_vat_cents`, `payout_cents`, `price_version`; Checks für Summen |
| `geo_boundaries` | `slug` PK, `geom` MultiPolygon 4326, `source` (ODbL) |

Abgleich Briefing Abschnitt 6: alle sechs Tabellen vorhanden, `price_config` versioniert über `price_versions`; ergänzt um `platform_settings`, `fee_splits`, `geo_boundaries`.
**Später (nur geplant):** `partners` (`id` = profiles.id, Firma, UID, Gebiet als PLZ-Liste, `stripe_account_id`, Status) und `quotes` (`request_id`, `partner_id`, `price_cents`, `valid_until`, Status offered/accepted/declined/expired). Dann bekommt `fee_splits` eine `quote_id`, `payee_id` zeigt auf den Partner, Kauf/Rechnung hängen an `quotes`. Kein Umbau bestehender Tabellen nötig.

## Statusfluss (Screens 13, 14)
`requested` bzw. `inspection_requested` (Besichtigung, nur mit `needs_quote`) → `confirmed` (Termin und Preis bestätigt) → `in_progress` (Auftrags-/Miettag) → `completed`; daneben `withdrawn` und `expired`. Mietanfragen nutzen dasselbe Enum ohne `inspection_requested`. Kunden setzen `requested` (über `quote` beim Absenden) und `withdrawn` (nur aus `requested`/`inspection_requested`). Alle anderen Status setzt admin, vorerst im Dashboard.

## Geldfluss
1. App: Vorschau mit `@pricing` und den öffentlichen `price_config`-Werten. Keine Gebühr, kein Satz im Client.
2. Absenden und „Anfrage bearbeiten": nur über die Edge Function `quote` (service_role). Sie prüft `inputs` je Service gegen das Schema des Preismoduls, lädt die aktuelle `price_version`, rechnet neu, speichert Anfrage bzw. Mietanfrage mit Snapshot und schreibt `fee_splits` mit dem Satz aus `platform_settings`. Kunden haben kein INSERT auf `service_requests`/`rental_bookings`; ein Client-Preis wird nie übernommen.
3. Aufteilung wie `platform()` im Prototyp: fee = cents(total × rate), netto = cents(fee / (1 + vat)), USt. = fee − netto, payout = total − fee; erst am Ende in Integer-Cent.
4. `payee_id`: bei Mietanfragen der Vermieter des Angebots (Demo: null), bei Anfragen null bis zur Partnerzuordnung. Vermieter sehen die Aufteilung in ihrer Abrechnung (18); die Beispielabrechnung rechnet mit `fee_rate` aus `platform_settings`.
5. Später: Partnerangebot (`quotes`) ersetzt den Richtpreis, Zahlung über Stripe Connect mit der Gebühr als Application Fee.

## RLS-Matrix
S/I/U/D = select/insert/update/delete. „Eigene" = Eigentum per `auth.uid()`. Spalten in Klammern = Spalten-Grant. service_role (Edge Functions) umgeht RLS.

| Tabelle | anon | Kunde (jeder Nutzer) | rental_provider zusätzlich | admin |
|---|---|---|---|---|
| profiles | – | S eigene; U (display_name, phone) eigene | – | S alle |
| price_versions, price_config | S | S | – | S I U D |
| current_price_version (View, `security_invoker`) | S | S | – | S |
| platform_settings | – | – | S | S I U D |
| service_requests | – | S eigene; U (status) nur → withdrawn | – | S, U (status) |
| request_photos + Storage | – | S eigene; I bei offener eigener Anfrage, eigener Pfad, ≤ 8; Upload nur in vorher eingetragene Pfade; D bei offener Anfrage | – | S |
| rental_offers | S approved | S approved | S eigene; I/U eigene ohne status, is_demo, provider_id (neu = pending) | S alle |
| rental_bookings | – | S eigene; U (status) nur requested → withdrawn | – | S, U (status) |
| fee_splits | – | – | S mit payee_id = ich | S |
| geo_boundaries, route_cache, route_rate_limits | – | – | – | – |
| RPC `route_geo_facts`, `take_rate_tokens` | – | – | – | – |

Die drei Tabellen und beide Funktionen (Migration 0006) nutzt nur die Edge Function `route` über service_role; Tests in `tests/rls/route.test.ts`.

Abgesichert in `tests/rls/rls.test.ts` (`npm run test:rls`, gegen das Dev-Projekt, Nutzer je Lauf neu und danach gelöscht).

## Datenschutz
- Fotos: privater Bucket `request-photos`, JPEG/PNG/WebP, ≤ 10 MB, ≤ 8 je Anfrage. EXIF wird vor dem Upload entfernt (Neu-Encodierung im Client). Anzeige nur über signierte URLs mit kurzer Laufzeit (10 min).
- Löschfristen (Vorschlag, Entscheidung offen): Fotos 90 Tage nach `completed`/`withdrawn`/`expired`; zurückgezogene und abgelaufene Anfragen 12 Monate; abgeschlossene Aufträge 3 Jahre, ab Rechnungen 7 Jahre (BAO § 132) und dann Anonymisieren statt Löschen. Konto löschen: kaskadiert auf Profil, Anfragen, Mietanfragen, Fotos. Routen-Cache ohne Klartextadressen, 24 Stunden (Schlüssel = HMAC über die Koordinaten, Wert = Rohantwort des Anbieters; ein täglicher pg_cron-Job `route-cleanup` räumt ab). Die Cache-Zeilen enthalten Routenkoordinaten (adressgenau, ohne Nutzerbezug, nur service_role). Geocoding wird nicht gecacht, Logs der Function enthalten weder Adressen noch Koordinaten noch IPs.
- Später für Partner: vor Annahme nur PLZ/Bezirk, Service, Umfang aus `inputs` ohne Freitext, Fotos, Wunschtermin. Kein Name, keine Hausnummer, keine Kontaktdaten. Umsetzung über eine RPC mit fester Spaltenliste, nach Annahme volle Adresse und Kontakt.

## App-Struktur
Tab-Bar: Start · Miete · Aufträge · Profil. Flow-Zustand je Service im `sessionStorage`, bis `quote` ihn speichert. Sheets (05, 17) sind Overlays; 17 ist zusätzlich als Route verlinkbar.

| Route | Screen | Tab-Bar |
|---|---|---|
| `/` | 01, 02 Start | ja |
| `/willkommen` | 03 Onboarding (3 Seiten, nur beim ersten Start) | nein |
| `/transport`, `/umzug` | 04 Konfigurator, 05 Preis-Sheet | nein |
| `/entruempelung`, `/entruempelung/ergebnis` | 06 Wizard (6 Schritte), 07 Ergebnis | nein |
| `/montage` | 08 Küche und Standardmöbel | nein |
| `/:service/termin`, `/:service/zusammenfassung`, `/:service/gesendet` | 10, 11, 12 | nein |
| `/miete`, `/miete/gesendet` | 09, 12 | ja / nein |
| `/auftraege`, `/auftraege/:art/:id` | 13 bzw. 15 leer, 14 Detail | ja |
| `/profil`, `/profil/preise`, `/profil/vermieter` | 16, 17 Info-Sheet (liegt über dem Profil), 18 Vermieter | ja / ja / nein |
| `/anmelden` | Magic-Link-Rückkehr und Code-Eingabe (S8b) | nein |
| `/profil/datenschutz`, `/profil/impressum` | markierte Platzhalter (Impressum und AGB zusammen) | ja |
| `/dev/fundament` | Komponenten-Galerie, nur Dev-Build (S3a) | nein |

## Routing (S5)
Edge Function `route` (`supabase/functions/route`, Logik in `_shared/route/`), anonym aufrufbar (`verify_jwt = false`, Konto erst beim Absenden), Header `apikey` muss der Publishable Key sein (nur Missbrauchsfilter). Zwei Modi per POST:
- `geocode` `{q}` → bis zu 5 Kandidaten `{label, lat, lon, postcode, country}`; `country` dient nur der Anzeige.
- `route` `{from:{lat,lon}, to:{lat,lon}, returnTrip?}` → `{region, outsideKm, driveHours, distanceKm (einfache Strecke), totalKm, geometry (≤ 500 Punkte)}`. Die Fakten kommen nur aus Koordinaten und eigenen Daten: Anbieter liefert Legs, Dauer und Linie; km außerhalb Wiens (`ST_Difference`, geodätisch) und „Punkt in Österreich" berechnet `route_geo_facts` aus `geo_boundaries` (`vienna`, `austria`, OSM, ODbL, Import mit `npm run geo:import`). Region: Abholung oder Ziel nicht in Österreich → `international`; sonst `outsideKm > 0,05` → `austria`; sonst `vienna`. Eine Route über das Deutsche Eck bleibt `austria`, die deutschen km zählen in `outsideKm`. Fehlt eine Grenze, bricht die Function ab (nie stillschweigend „Wien").
- `quote` (S8a) ruft `computeRouteFacts` serverseitig mit den Koordinaten auf und übernimmt nie Fakten vom Client. Es gibt kein Depot; Rückfahrt ist ein Flag.
- Limits: je IP (HMAC) geocode 30/min und 300/Tag, route 20/min und 200/Tag; global je Modus 35/min, Tag 800 (geocode) bzw. 1600 (route), unter dem Kontingent des ORS-Plans. Ein Limiter-Ausfall lehnt ab (503). CORS nur für `ALLOWED_ORIGINS`.
- Function-Secrets: `ORS_API_KEY`, `RATE_LIMIT_SECRET`, `PUBLISHABLE_KEY`, `ALLOWED_ORIGINS`.

**Anbieter (Entscheidung advisor):** openrouteservice (HeiGIT, Deutschland) hinter dem Interface `RouteProvider`. In Produktion erst, wenn (1) ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO besteht (Adresstexte gehen an den Anbieter) und (2) kommerzielle Nutzung samt Kontingent schriftlich geklärt ist. Ausweichanbieter: Geoapify (DE). Weder Client-Header noch IP gehen an den Anbieter; Timeout 8 s, bei Fehler 502 ohne Schätzwert.

## Entscheidungen
1. Anfragen und Mietanfragen schreibt nur `quote`: Preis und Gebühr sind nicht fälschbar. Die DB prüft `inputs` nur auf „Objekt", das Schema prüft der einzige Schreiber.
2. Spalten-Grants plus RLS statt Trigger: deklarativ, und was nicht gegrantet ist, schreibt per API niemand. Supabase-Default-Grants werden je Tabelle zuerst widerrufen.
3. Rolle in `profiles`, gelesen über `private.my_role()` (SECURITY DEFINER, fester `search_path`, Schema nicht exponiert): wirkt sofort, ohne Token-Refresh.
4. `price_versions` als eigene Tabelle: Fremdschlüssel für Snapshots und das Datum für „Tarifstand".
5. `sources` jsonb statt `source_label`/`source_url`: gemittelte Tarife haben bis zu vier Quellen (Info-Sheet 17).
6. Geldwerte in `price_config` in Cent: `value / 100` ergibt dieselben Doubles wie die Literale im Prototyp, die Ergebnisse bleiben centgenau.
7. `fee_splits` mit `payee_id` und gespeicherten Sätzen: Leserecht ohne Joins, Abrechnung reproduzierbar bei späteren Satzänderungen, Partner ohne Umbau.
8. Ein Status-Enum für beide Anfragearten: gleiche Chips und Timeline.
9. Demo-Angebote ohne `provider_id` (Check `provider_or_demo`): keine erfundenen Vermieter-Konten.
10. `provider_name` am Angebot: `offerFields` führt den Firmennamen je Fahrzeug, Demo-Angebote brauchen ihn ohne Profil.
11. `one_way` boolean statt `return_station`: der Prototyp kennt nur „gleiche" oder „andere Station".
12. Vermieter sehen in dieser Phase keine Mietanfragen (Bestätigung in der App ist „Später"); `fee_splits` lesen sie über `payee_id`.
13. PostGIS im Schema `extensions`: `spatial_ref_sys` liegt außerhalb der Data API.
14. RLS-Tests gegen das Dev-Projekt statt lokalem Docker: dasselbe Schema wie die App, keine weitere Infrastruktur.
15. TypeScript 6.0 statt 7: typescript-eslint unterstützt 7 noch nicht.
16. Tarifversionen gelten als unveränderlich: admin ändert Tarife über eine neue `price_version`, nicht in bestehenden Versionen (Konvention bis zur Admin-Oberfläche). „Aktuell" ist die höchste Version mit `effective_on` ≤ heute (Wiener Datum), gelesen über die View `current_price_version` (`security_invoker`, Migration 0004); App und `quote` lesen die gültige Version nur über sie. Neue Versionen mit künftigem `effective_on` anlegen, erst die Zeilen eintragen, dann gilt sie ab dem Datum. `price_config.value >= 0` ist ein DB-Check.
17. Wer über „Für Vermieter" Vermieter wird, liest den Gebührensatz; er steht ohnehin in seiner Abrechnung (18).
18. Freigegebene Angebote ändert der Vermieter ohne erneute Freigabe („Gespeicherte Werte erscheinen direkt im Mietrechner", 18). Offen zur Entscheidung, siehe OPEN_ISSUES.
19. anon sieht `provider_id` freigegebener Angebote; die UUID führt zu keinem lesbaren Profil.
20. Policies lesen nie die eigene Tabelle (Postgres 42P17): Zählen über `private.photo_count()`, Fotos in der App erst in `request_photos` eintragen, dann hochladen.
21. App-Variablen mit Präfix `NEXT_PUBLIC_` (Vite `envPrefix`): passt zur vorhandenen `.env.local`. Nur dieses Präfix landet im Bundle, nie `SUPABASE_*`.
