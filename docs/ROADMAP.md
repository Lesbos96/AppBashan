# MoveNow · Roadmap

Eine Session je Abschnitt. Modell Sonnet 5.5 / Effort medium, außer wo anders vermerkt.
Jede Session endet mit grünen Checks, abgehakten Checkboxen, einem Eintrag in `docs/PROGRESS.md`, Commit und Push (falls Remote). Der Commit beendet die Session.
UI-Sessions: Jeder fertige Screen besteht den Prüf-Loop aus `CLAUDE.md` gegen seinen Referenz-Screen in `docs/reference/design/screens/`, in Light und Dark. Vor dem Commit einmal `shots:all` (alle vier Größen), Konsole ohne Fehler, Tastaturbedienung des Hauptflows als E2E-Test.
Preisbeispiele aus `docs/reference/design/README.md` in E2E-Tests: geprüft werden Gesamtpreis und Positionen, die Kunden sehen. Die Gebührenwerte der Beispiele gelten nur für das Modul und die Vermieter-Abrechnung.
Umfang: genau das Briefing in `docs/DESIGN_BRIEF.md`. Phase 1 enthält echte Buchungsbestätigungen (Annahme in der App); echte Zahlungen über MoveNow bleiben ausgeschlossen (der Kunde zahlt den Partner direkt, der Partner MoveNow per Überweisung außerhalb der App). Keine erfundenen Verfügbarkeiten. Alles darüber hinaus steht unter „Später" und wird nur nach Freigabe gebaut.
Reihenfolge: S2, S3a und S5 hängen nur von S1 ab; S3b nach S3a; S4 nach S3b; S6 nach S2–S5; S7 nach S2–S4; S8a nach S2 und S5; S8b nach S6, S7 und S8a; S9a bis S9i nach S8b; S10 zuletzt. Schema, Rechte und Routen stehen in `docs/ARCHITECTURE.md`.

---

## S1 · Fundament und Architektur (Opus 5.5 · Effort medium)
- [x] Agent-Dateien und `.claude/settings.json` validiert, je ein Testlauf von `Explore` und `test-runner`
- [x] `npm run env:check` bestätigt alle Variablennamen aus `.env.example` in `.env.local`
- [x] Gerüst: Vite + React + TS strict, React Router, Tailwind, Motion, ESLint, Vitest, Playwright; Pfad-Alias `@pricing` auf `supabase/functions/_shared/pricing/`
- [x] Skripte: `check`, `build`, `test:e2e`, `shots`, `shots:all`, `db:types`, `db:push`, `env:check`; Secrets nur über dotenv-cli
- [x] Supabase initialisiert und mit dem Dev-Projekt verlinkt
- [x] `docs/ARCHITECTURE.md`: Rollen, Datenmodell, Statusfluss, Geldfluss, RLS-Matrix, Datenschutz, Routen- und Screen-Struktur der App, Entscheidungen
- [x] Migration 0001: PostGIS, Enums, Tabellen aus dem Briefing (`profiles`, `service_requests`, `request_photos`, `rental_offers`, `rental_bookings`, `price_config`) plus `platform_settings`, `fee_splits`, `geo_boundaries`; Indizes, RLS, Policies, privater Bucket `request-photos`
- [x] `supabase/seed.sql`: `price_config` mit den Kunden-Tarifen aus dem Prototyp (Werte, Quelle, URL, Recherchedatum); Gebührensatz und USt.-Satz der Gebühr nur in `platform_settings`; Mietangebote aus `sampleOffers` als Demo markiert
- [x] RLS-Tests grün: anon liest nichts Personenbezogenes; Kunde A sieht Anfragen, Fotos und Mietanfragen von B nicht; Vermieter sieht und ändert nur eigene Fahrzeuge; Kunden sehen nur freigegebene Fahrzeuge; Kunden und anon lesen weder `fee_splits` noch `platform_settings`; nur admin ändert `price_config`; niemand macht sich selbst zum admin
- [x] Leere `docs/OPEN_ISSUES.md` und `docs/PRICING.md` angelegt

**Akzeptanz:** `npm run check` und `npm run build` grün, Migration eingespielt, RLS-Tests grün, ARCHITECTURE.md vorhanden.

## S2 · Preis-Engine
- [x] Reine TS-Funktionen ohne Abhängigkeiten in `supabase/functions/_shared/pricing/`: Transport/Umzug, Entrümpelung, Montage, Miete, Plattformgebühr, Angebotspflicht mit Gründen
- [x] Tarife kommen als Parameter aus `price_config`, nicht als Konstanten (Schlüssel wie in `supabase/seed.sql`, Geldwerte in Cent, das Modul rechnet `value / 100` in Euro wie der Prototyp); der Gebührensatz kommt als Parameter aus `platform_settings` (kein fester 15-%-Wert im App-Code, die Tests übergeben ihn)
- [x] Importe im Modul mit `.ts`-Endung (läuft in Vite und Deno); Eingabetypen je Service exportiert, als Grundlage für die `inputs`-Prüfung in `quote` (S8a)
- [x] Feste Testfälle: die fünf Preisbeispiele aus `docs/reference/design/README.md` (gegen den laufenden Prototyp-Code geprüft, centgenau)
- [x] Golden-Fixtures: Prototyp in Playwright laden, `window.MoveNowDemo.*` mit mindestens 40 Eingaben aufrufen, Ergebnis als JSON speichern
- [x] Abdeckung: Mindestdauern, 1–8 Personen, mehrere Fahrzeuge, Personen < Fahrzeuge, Spezialgut, Groß-LKW, Einpackservice, Wien / Österreich / international, Entrümpelung mit Mindestpreis und Etagen, Küche vs. Standardmontage, Miete mit angebrochenem Tag, Mehr-km, Einweg, Bereitstellungsgebühr, halbe Cents bei der Gebührenaufteilung
- [x] Gebührenaufteilung als eigene Funktion; Kunden-Preispositionen enthalten keine Gebührenzeile
- [x] Prototyp-Fehler „Umzug" (ReferenceError `moveRouteHTML`) nicht übernommen; jede Abweichung vom Briefing in `docs/PRICING.md`
- [x] `docs/PRICING.md`: welche Werte Stichproben-Richtwerte sind und aus welcher Quelle

**Akzeptanz:** alle Tests grün, keine Preislogik außerhalb des Moduls; Umzug-Beispiel centgenau inklusive Aufteilung (689,61 € → Gebühr 103,44, netto 86,20, USt. 17,24, Partner 586,17).

## S3a · Tokens, Icons, Illustrationen
- [x] `tokens.json` → CSS-Variablen (Light/Dark) und Tailwind-Theme
- [x] SVGs über `npm run svg:extract` (byte-genau nach `tmp/svg/`, Fundstellen in `index.tsv`), Dateien per Kopie übernommen und als React-Komponenten eingebunden, ohne Pfade abzutippen (z. B. `vite-plugin-svgr`); Farbumstellung über `mech-editor`
- [x] Icon-Set (Outline und Filled) als SVG-Komponenten mit `currentColor` und Tokens
- [x] Alle Illustrationen als SVG-Komponenten in den Materialfarben der Palette `illustration`, weiche Kontaktschatten, Dark-Varianten aus `02_Start_Dark.html`
- [x] App-Icon, Favicon, Splash aus `00_Fundament`; PWA-Manifest, theme-color, Safe Areas (Splash: Android erzeugt ihn aus Icon, Name und `background_color`; iOS-Splash-Bilder kommen mit Capacitor in S10)
- [x] Galerie unter `/dev/fundament` (nur im Dev-Build) mit Farben, Typografie, Icons und Illustrationen

**Akzeptanz:** Galerie ohne „hoch"-Findings gegen `00_Fundament.png` (Farben, Typografie, Icons) und `01`/`02` (Illustrationen), Light und Dark.

## S3b · Basiskomponenten
- [x] Zu Beginn: Gradienten (Primär-Button, Mietkarte, App-Icon), Layout-Maße (Touch-Ziel 44, Button 54, Spalte 520) und Motion-Werte aus `tokens.json` als CSS-Variablen ergänzen
- [x] Basiskomponenten: Primär-/Sekundärbutton, Karte, Service-Karte, Inset Grouped List, Segmented Control, Stepper, Toggle, Feld, Status-Chip, Bottom Sheet (Griff, Detents, Drag-to-Dismiss), Glas-Tab-Bar, Navigationsleiste mit schrumpfendem Large Title, fixierte Aktionsleiste, Fortschrittsanzeige, Betragszeile ohne Umbruch
- [x] In der Galerie `/dev/fundament` ergänzt, verglichen mit `00_Fundament.png`

**Akzeptanz:** Galerie ohne „hoch"-Findings gegen `00_Fundament.png`, Light und Dark.

## S4 · App-Shell und ruhige Screens
- [x] App-Shell mit Tab-Bar (Start · Miete · Aufträge · Profil), Seitenübergänge, Desktop-Spalte max. ca. 520 px; Routen wie in `docs/ARCHITECTURE.md` (App-Struktur), neue Routen in `tests/shots/shots.spec.ts` eingetragen
- [x] Hero-Mesh (`041`/`052`, Korn und Verlauf) und Onboarding-Hintergründe (`059`/`060`) aus `tmp/svg/` mitnehmen; sie gehören nicht zu den S3a-Illustrationen
- [x] Start Light/Dark (`01`, `02`), Onboarding 1–3 (`03`, Seiten 2 und 3 im selben Stil), Profil (`16`), „Wie rechnet MoveNow?" als Info-Sheet mit Werten, Labels und `sources` aus `price_config` (aktuelle `price_version`), ohne Plattformgebühr (`17`), Aufträge leer (`15`)
- [x] Datenschutz, Impressum und AGB als markierte Platzhalter
- [x] Lade-, Fehler- und Offline-Zustand

**Akzeptanz:** jeder Screen ohne „hoch"-Findings gegen seine Referenz. Dazu eine Migration mit dem DB-Check `price_config.value >= 0` und ein Seed-Test `clearance.rate_low ≤ clearance.rate ≤ clearance.rate_high` (ersetzt das `it.todo` in `tests/unit/pricing.test.ts`).

## S5 · Routing-Dienst und Wiener Stadtgrenze
- [x] Wiener Grenze (OSM, ODbL) als Geometrie in `geo_boundaries`, Import-Skript dokumentiert; es schreibt über die service_role, keine Geometrie in Migrationen
- [x] Edge Function `route`: Geocoding (Kandidaten zur Bestätigung), Route, Gesamt-km, einfache Strecke, km außerhalb Wiens per PostGIS, Fahrzeit, Region (international über das Österreich-Polygon) — Code und Tests fertig; Deploy und Live-Test gegen ORS offen (OPEN_ISSUES)
- [x] Anbieter-Adapter mit Cache und Rate-Limit; Entscheidungsnotiz in ARCHITECTURE.md, welcher Anbieter in Produktion
- [x] Tests mit gemocktem Anbieter und festen Fixtures

- [x] **Erledigt (2026-10-30):** Secrets im Dev-Projekt gesetzt (SECRET_KEY, ORS_API_KEY, RATE_LIMIT_SECRET, PUBLISHABLE_KEY, ALLOWED_ORIGINS), route und quote deployt, Live-Test Wien→Graz (196,1 km, 186,5 km außerhalb), R1 und R3 belegt. Einzelheiten: OPEN_ISSUES "S5b/S5c"
- [ ] **OFFEN (2026-10-30), vor dem Livegang:** ORS-Plan und Nutzungsbedingungen für kommerzielle Nutzung klären. Der Standard-Plan hat 2.000 Directions-Anfragen pro Tag und 40 pro Minute; daraus das Tageslimit pro IP konkret festlegen (`LIMITS` in `handler.ts`)
- [ ] **OFFEN (2026-10-30), vor dem Livegang:** `ALLOWED_ORIGINS` auf die echten Domains umstellen
- [ ] **PFLICHT (2026-10-31), vor dem ersten Test auf einem Handy und vor dem Livegang:** eigener SMTP-Anbieter einrichten, danach die Mail-Vorlagen aus `supabase/templates/` einspielen (Supabase sperrt sie ohne Custom SMTP), im Produktivprojekt `Site URL` und Redirect-URLs ohne `http://localhost`-Einträge setzen (`capacitor://localhost/anmelden` bleibt). Im Dev-Projekt erledigt (2026-10-31): `otp_expiry` 900 s, `Site URL` `http://localhost:5173`, Redirect-URLs `http://localhost:5173/anmelden`, `http://localhost:4173/anmelden`, `capacitor://localhost/anmelden`. Bis dahin ist die Anmeldung nur per Test gegen die Datenbank und lokal mit dem Standard-Link belegt. Einzelheiten: OPEN_ISSUES "S8a · PFLICHT"

**Akzeptanz:** Wien→Wien, Wien→Graz, Wien→München liefern die erwartete Region und plausible km-Anteile.

## S6 · Transport- und Umzug-Konfigurator
- [x] Konfigurator wie `04` mit allen Feldern aus Briefing Abschnitt 4, Fotos (Kamera/Galerie, Vorschau, Entfernen, EXIF entfernt)
- [x] Adressen über `route` mit Einwilligung und Bestätigung, animierte Routengrafik
- [x] Fixierte Live-Preiskarte, Preis-Sheet wie `05` (ohne Gebühr, Beträge ohne Umbruch); „Persönliches Angebot" mit Gründen
- [x] E2E: Umzug-Preisbeispiel aus dem README (689,61 €) erscheint exakt in der UI, ohne Gebührenzeile; Klavier → Angebotspflicht

## S7 · Entrümpelung und Montage
- [x] Wizard wie `06` (alle 6 Schritte im selben Stil), Ergebnis wie `07` mit Spannen-Grafik, Besichtigungspfad bei Sonderfällen
- [x] Montage: Küche wie `08`, Standardmöbel im selben Stil
- [x] E2E: Entrümpelungs- (1.175,00 €, Spanne 950–1.550 €) und Küchen-Preisbeispiel (770,40 €) aus dem README exakt in der UI, ohne Gebühr

## S8a · Anfrage-Backend und Login (Effort high)
Keine Screens. Die App bekommt nur die Module, die S8b anbindet.
- [x] Edge Function `quote` (deployt und live getestet am 2026-10-30, siehe OPEN_ISSUES, Abschnitt S8a): prüft `inputs` je Service, rechnet neu und speichert Snapshot mit `price_version`, schreibt `fee_splits` mit dem Satz aus `platform_settings`; Status „angefragt" bzw. „Besichtigung angefragt"; „Anfrage bearbeiten" rechnet neu und ist nur bei „angefragt" erlaubt
- [x] Foto-Upload in den privaten Bucket (Pfad `{user}/{request}/{datei}`, signierte URLs) als App-Modul
- [x] Supabase Auth: E-Mail-Magic-Link, Code in derselben Mail als Ausweichweg, Konto erst beim Absenden, „Mit Apple anmelden" vorbereitet; Auth-Modul in der App
- [x] Integrationstests (sequenziell): manipulierter Client-Preis wird ignoriert; `fee_splits` stimmt centgenau mit der Gebührenfunktion überein und ist für den Kunden unlesbar; Bearbeiten außerhalb von „angefragt" wird abgelehnt. Fremde Anfragen, Fotos und Status sind bereits durch `tests/rls/` abgedeckt und bleiben grün.

**Akzeptanz (erfüllt; Live-Test von `route` und `quote` am 2026-10-30 bestanden, offen bleibt nur der echte Mailversand, siehe OPEN_ISSUES):** Integrationstests und `tests/rls/` grün; `advisor`-Abnahme von `quote`, Upload- und Auth-Modul. `quote` speichert neben den Snapshot-Feldern nur Felder, die `parse*Input` geprüft hat (Test ersetzt das `it.todo` in `tests/unit/pricing.test.ts`). `quote` liest die Tarifversion über die View `current_price_version`, bricht bei fehlenden Schlüsseln ab und übernimmt die `rental.reference`-Zeile (`unit` `ref`) nicht in den Snapshot (Test).

## S8b · Termin, Anfrage, Aufträge
- [x] Ort & Termin wie `10`, Zeitfenster für Entrümpelung und Montage, Zusammenfassung wie `11`, Bestätigung wie `12` (S8b-2; Abweichungen in OPEN_ISSUES)
- [x] (Anmeldung und `/anmelden` S8b-1, Absenden über `quote` S8b-2, 2026-10-31) Anmelden wie in `16` („Mit E-Mail-Link anmelden") und `/anmelden` (Magic-Link-Rückkehr, Code-Eingabe) über das Auth-Modul aus S8a; Absenden über `quote`
- [x] (S8b-3, 2026-11-01) Foto-Uploads zu Anfragen: Server-Pfad und atomares Limit, nur JPEG im Bucket, Aufräum-Job, Upload-Zustände auf der Bestätigung
- [ ] Aufträge-Liste wie `13` (Anfragen und Mietanfragen, Aktiv/Erledigt), Detail mit Timeline und Tarifstand wie `14`
- [ ] „Anfrage zurückziehen" wie `14` läuft über die Funktion `withdraw` (S9a). „Anfrage bearbeiten" entfällt.

## S9a bis S9i · Partner, verbindliche Buchung, Provisions-Journal
Schritte, Umfang, Migrationen und Tests: `docs/S9_KONZEPT.md`, Abschnitt 13. Jeder Schritt ist eine Session.
- [x] S9a-1 Preisversionen und Sätze unveränderlich (2026-11-01)
- [x] S9a-2 Statusmaschine, Revisionen, Kontakte (2026-11-02)
- [x] S9a-3 `quote`-Härtung: Haltefenster und Preisabgleich, Adressprüfung, Bezirk aus Bezirksgrenzen, Bedingungen und Kontakt im Snapshot, `rental_bookings` gesperrt (2026-11-02, `docs/proof/s9a3/`)
- [x] S9a-4 Fotos-Staging (`docs/S9a_PLAN.md`): 4a Backend (0020), 4b App und Nachzug (0021, 2026-11-03, `docs/proof/s9a4a/`, `docs/proof/s9a4b/`). S9a fertig; offene Nachzug-Punkte stehen in `docs/OPEN_ISSUES.md` („S9a-4b · Offen“)

- [x] S9b-1 Partnerkern: Firmen, Statusmaschine, Registrierung, Helfer, RLS (Migration 0023, 2026-11-07)
- [x] S9b-2 Scope, USt.-Regel, Stammdaten, Dokumente (Migrationen 0024 bis 0026, 2026-11-07)
- [x] S9b-3 Gebührensatz lesen (N-10), echte TOTP-Tests (Migration 0027, 2026-11-08)
- [x] S9b-4 Journal `commission_entries`, `fee_splits` entfällt (Migrationen 0028, 0029, 2026-11-08)
- [x] S9c Verteilung und Annahme: `job_listings`, `assignments`, `outbox`, `distribute_request`, `partner_accept` (Edge Function `accept`), `decline_listing`, Fristablauf per Cron, `start_job`, `complete_job`, `job_contact`, `my_job_partner`, `admin_contact` (Migrationen 0030 bis 0034, 2026-11-08; Mailversand gebaut, nicht eingerichtet: OPEN_ISSUES S9c-3)
- [x] S9d Fotos für Partner: Bucket `job-photos`, `job_photos`, Pipeline `photo-publish` (Neu-Kodierung ohne Metadaten), Verteilung erst nach den Foto-Endzuständen, `job-photo`, `photo-receipt`, `admin-photo`, Aufräumen beider Buckets, Outbox-Härtung (Migrationen 0035 bis 0037, 2026-11-08; Einrichtung der Pipeline durch Beks: `npm run setup:photo-publish`)

- [x] S9f Nachtrag: `price_revisions` mit Status, Frist, Belegfotos (Spalten, Update-Guard mit Marker, Zeiger auf angenommene Nachträge), `propose_change`, `decide_change`, `withdraw_change`, `expire_changes`/`close_changes`, Journalzeile `change` mit Komponentenprüfung und Unique-Index, Edge Functions `change-propose` und `change-decide`, `pricing/change.ts` (Migrationen 0040, 0041, 2026-11-09)
- [x] S9e Festangebot: `partner_offers`, `send_offer`, `withdraw_offer`, `reject_offers`, `my_request_offers`, `confirm_offer` (Edge Function `offer-confirm`), T4b/T7 (`expire_offers`), `admin_set_partner_status` schließt Listings und Angebote, `to_district` im Listing, gemeinsame Limit-Prüfung (Migrationen 0038, 0039, 2026-11-09; schließt S9c-1, S9c-2, S9c-10, S9c-12)

## S10 · Abnahme und Politur
- [ ] Abnahme-Checkliste aus `docs/DESIGN_BRIEF.md`, Schritt D, vollständig grün (`shots:all`, Lighthouse, Preis-Stichproben über 10 Szenarien)
- [ ] Politur-Loop aus Schritt E, höchstens 3 globale Runden
- [ ] Supabase Security- und Performance-Advisor ohne Warnungen, Rate-Limits auf allen Edge Functions
- [ ] **Pflicht vor Livegang (Routing):** bezahltes ORS-Kontingent mit Auftragsverarbeitungsvertrag (oder Ausweichanbieter) und eine Bot-Bremse vor `route` (z. B. Turnstile/Captcha-Token); das IP-Limit (10/min, 80 bzw. 160/Tag) trifft Mobilfunk-CGNAT hart, weil viele Kunden eine IP teilen, und schützt allein nicht gegen verteilte Bots, das globale Tageslimit ist die letzte Grenze
- [ ] Übergabe nach Schritt F: README.md (Setup, Start, Tests, Supabase), Screenshots aller Hauptscreens in `docs/screens/`, Liste der offenen Punkte

---

## Später (nicht im Briefing, nur nach Freigabe durch Beks)
Partner-Portal und E-Mail-Benachrichtigungen sind Phase 1 (S9a ff.). Phase 2:
- Admin-Oberfläche (Freigaben, Statuspflege, `price_config` und Gebührensatz versioniert bearbeiten)
- Transportermiete und Vermieterbereich (Miete als Partner-Kategorie, `docs/S9_KONZEPT.md`, 5.3), Vermieter bestätigt Mietanfragen in der App
- Automatische Sammelrechnung, SEPA, Zahlungsdienstleister (z. B. Stripe Connect; Rechnungs- und USt.-Logik vorher mit Steuerberatung klären), Push, pgAudit, Radius-Gebiete, Mehrfach-Mitglieder in der Oberfläche
- Capacitor-Build für iOS und Android
- Bewertungen, Verfügbarkeitskalender, weitere Städte
