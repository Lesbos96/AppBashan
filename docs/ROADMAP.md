# MoveNow · Roadmap

Eine Session je Abschnitt. Modell Sonnet 5.5 / Effort medium, außer wo anders vermerkt.
Jede Session endet mit grünen Checks, abgehakten Checkboxen, einem Eintrag in `docs/PROGRESS.md`, Commit und Push (falls Remote). Der Commit beendet die Session.
UI-Sessions: Jeder fertige Screen besteht den Prüf-Loop aus `CLAUDE.md` gegen seinen Referenz-Screen in `docs/reference/design/screens/`, in Light und Dark. Vor dem Commit einmal `shots:all` (alle vier Größen), Konsole ohne Fehler, Tastaturbedienung des Hauptflows als E2E-Test.
Preisbeispiele aus `docs/reference/design/README.md` in E2E-Tests: geprüft werden Gesamtpreis und Positionen, die Kunden sehen. Die Gebührenwerte der Beispiele gelten nur für das Modul und die Vermieter-Abrechnung.
Umfang: genau das Briefing in `docs/DESIGN_BRIEF.md`. In dieser Phase keine echten Zahlungen, keine echten Buchungsbestätigungen, keine erfundenen Verfügbarkeiten. Alles darüber hinaus steht unter „Später" und wird nur nach Freigabe gebaut.
Reihenfolge: S2, S3a und S5 hängen nur von S1 ab; S3b nach S3a; S4 nach S3b; S6 nach S2–S5; S7 nach S2–S4; S8a nach S2 und S5; S8b nach S6, S7 und S8a; S9 nach S8b; S10 zuletzt. Schema, Rechte und Routen stehen in `docs/ARCHITECTURE.md`.

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
- [ ] `tokens.json` → CSS-Variablen (Light/Dark) und Tailwind-Theme
- [ ] SVGs über `npm run svg:extract` (byte-genau nach `tmp/svg/`, Fundstellen in `index.tsv`), Dateien per Kopie übernommen und als React-Komponenten eingebunden, ohne Pfade abzutippen (z. B. `vite-plugin-svgr`); Farbumstellung über `mech-editor`
- [ ] Icon-Set (Outline und Filled) als SVG-Komponenten mit `currentColor` und Tokens
- [ ] Alle Illustrationen als SVG-Komponenten in den Materialfarben der Palette `illustration`, weiche Kontaktschatten, Dark-Varianten aus `02_Start_Dark.html`
- [ ] App-Icon, Favicon, Splash aus `00_Fundament`; PWA-Manifest, theme-color, Safe Areas
- [ ] Galerie unter `/dev/fundament` (nur im Dev-Build) mit Farben, Typografie, Icons und Illustrationen

**Akzeptanz:** Galerie ohne „hoch"-Findings gegen `00_Fundament.png` (Farben, Typografie, Icons) und `01`/`02` (Illustrationen), Light und Dark.

## S3b · Basiskomponenten
- [ ] Basiskomponenten: Primär-/Sekundärbutton, Karte, Service-Karte, Inset Grouped List, Segmented Control, Stepper, Toggle, Feld, Status-Chip, Bottom Sheet (Griff, Detents, Drag-to-Dismiss), Glas-Tab-Bar, Navigationsleiste mit schrumpfendem Large Title, fixierte Aktionsleiste, Fortschrittsanzeige, Betragszeile ohne Umbruch
- [ ] In der Galerie `/dev/fundament` ergänzt, verglichen mit `00_Fundament.png`

**Akzeptanz:** Galerie ohne „hoch"-Findings gegen `00_Fundament.png`, Light und Dark.

## S4 · App-Shell und ruhige Screens
- [ ] App-Shell mit Tab-Bar (Start · Miete · Aufträge · Profil), Seitenübergänge, Desktop-Spalte max. ca. 520 px; Routen wie in `docs/ARCHITECTURE.md` (App-Struktur), neue Routen in `tests/shots/shots.spec.ts` eingetragen
- [ ] Start Light/Dark (`01`, `02`), Onboarding 1–3 (`03`, Seiten 2 und 3 im selben Stil), Profil (`16`), „Wie rechnet MoveNow?" als Info-Sheet mit Werten, Labels und `sources` aus `price_config` (aktuelle `price_version`), ohne Plattformgebühr (`17`), Aufträge leer (`15`)
- [ ] Datenschutz, Impressum und AGB als markierte Platzhalter
- [ ] Lade-, Fehler- und Offline-Zustand

**Akzeptanz:** jeder Screen ohne „hoch"-Findings gegen seine Referenz.

## S5 · Routing-Dienst und Wiener Stadtgrenze
- [ ] Wiener Grenze (OSM, ODbL) als Geometrie in `geo_boundaries`, Import-Skript dokumentiert; es schreibt über die service_role, keine Geometrie in Migrationen
- [ ] Edge Function `route`: Geocoding (Kandidaten zur Bestätigung), Route, Gesamt-km, einfache Strecke, km außerhalb Wiens per PostGIS, Fahrzeit, Region, Länder
- [ ] Anbieter-Adapter mit Cache und Rate-Limit; Entscheidungsnotiz in ARCHITECTURE.md, welcher Anbieter in Produktion
- [ ] Tests mit gemocktem Anbieter und festen Fixtures

**Akzeptanz:** Wien→Wien, Wien→Graz, Wien→München liefern die erwartete Region und plausible km-Anteile.

## S6 · Transport- und Umzug-Konfigurator
- [ ] Konfigurator wie `04` mit allen Feldern aus Briefing Abschnitt 4, Fotos (Kamera/Galerie, Vorschau, Entfernen, EXIF entfernt)
- [ ] Adressen über `route` mit Einwilligung und Bestätigung, animierte Routengrafik
- [ ] Fixierte Live-Preiskarte, Preis-Sheet wie `05` (ohne Gebühr, Beträge ohne Umbruch); „Persönliches Angebot" mit Gründen
- [ ] E2E: Umzug-Preisbeispiel aus dem README (689,61 €) erscheint exakt in der UI, ohne Gebührenzeile; Klavier → Angebotspflicht

## S7 · Entrümpelung und Montage
- [ ] Wizard wie `06` (alle 6 Schritte im selben Stil), Ergebnis wie `07` mit Spannen-Grafik, Besichtigungspfad bei Sonderfällen
- [ ] Montage: Küche wie `08`, Standardmöbel im selben Stil
- [ ] E2E: Entrümpelungs- (1.175,00 €, Spanne 950–1.550 €) und Küchen-Preisbeispiel (770,40 €) aus dem README exakt in der UI, ohne Gebühr

## S8a · Anfrage-Backend und Login (Effort high)
Keine Screens. Die App bekommt nur die Module, die S8b anbindet.
- [ ] Edge Function `quote`: prüft `inputs` je Service, rechnet neu und speichert Snapshot mit `price_version`, schreibt `fee_splits` mit dem Satz aus `platform_settings`; Status „angefragt" bzw. „Besichtigung angefragt"; „Anfrage bearbeiten" rechnet neu und ist nur bei „angefragt" erlaubt
- [ ] Foto-Upload in den privaten Bucket (Pfad `{user}/{request}/{datei}`, signierte URLs) als App-Modul
- [ ] Supabase Auth: E-Mail-Magic-Link, Code in derselben Mail als Ausweichweg, Konto erst beim Absenden, „Mit Apple anmelden" vorbereitet; Auth-Modul in der App
- [ ] Integrationstests (sequenziell): manipulierter Client-Preis wird ignoriert; `fee_splits` stimmt centgenau mit der Gebührenfunktion überein und ist für den Kunden unlesbar; Bearbeiten außerhalb von „angefragt" wird abgelehnt. Fremde Anfragen, Fotos und Status sind bereits durch `tests/rls/` abgedeckt und bleiben grün.

**Akzeptanz:** Integrationstests und `tests/rls/` grün; `advisor`-Abnahme von `quote`, Upload- und Auth-Modul.

## S8b · Termin, Anfrage, Aufträge
- [ ] Ort & Termin wie `10`, Zeitfenster für Entrümpelung und Montage, Zusammenfassung wie `11`, Bestätigung wie `12`
- [ ] Anmelden wie in `16` („Mit E-Mail-Link anmelden") und `/anmelden` (Magic-Link-Rückkehr, Code-Eingabe) über das Auth-Modul aus S8a; Absenden über `quote`
- [ ] Aufträge-Liste wie `13` (Anfragen und Mietanfragen, Aktiv/Erledigt), Detail mit Timeline und Tarifstand wie `14`
- [ ] „Anfrage bearbeiten" (über `quote`, rechnet neu) und „Anfrage zurückziehen" (direktes Status-Update) wie `14`, solange der Status „angefragt" ist. Alle weiteren Status setzt in dieser Phase nur admin (vorerst im Supabase-Dashboard).

## S9 · Transportermiete und Vermieterbereich
- [ ] Miete wie `09` (ohne Gebühr, Kaution separat); die Mietanfrage wird über `quote` als „angefragt" gespeichert (Server rechnet aus dem Angebot neu, `fee_splits` mit `payee_id` = Vermieter), ohne Bestätigung in der App und ohne echte Verfügbarkeit
- [ ] Vermieterbereich wie `18` über Profil → „Für Vermieter": Fahrzeuge und Tarife anlegen und bearbeiten (alle Felder aus `offerFields`), Beispielabrechnung mit Plattformgebühr, Satz aus `platform_settings`
- [ ] Wer „Für Vermieter" öffnet und sich anmeldet, wird Vermieter (RPC `become_rental_provider`). Vermieter sehen und ändern nur eigene Fahrzeuge (RLS). Neue Fahrzeuge sind für Kunden erst nach Freigabe sichtbar (vorerst im Supabase-Dashboard).
- [ ] E2E: Cargo-Van-Beispiel (276,00 €, Kaution 500,00 € separat) für Kunden ohne Gebühr; Vermieter-Beispiel (99 € → Gebühr 14,85 €, netto 12,38 €, USt. 2,47 €, an Vermieter 84,15 €) nur in der Vermieter-Abrechnung

## S10 · Abnahme und Politur
- [ ] Abnahme-Checkliste aus `docs/DESIGN_BRIEF.md`, Schritt D, vollständig grün (`shots:all`, Lighthouse, Preis-Stichproben über 10 Szenarien)
- [ ] Politur-Loop aus Schritt E, höchstens 3 globale Runden
- [ ] Supabase Security- und Performance-Advisor ohne Warnungen, Rate-Limits auf allen Edge Functions
- [ ] Übergabe nach Schritt F: README.md (Setup, Start, Tests, Supabase), Screenshots aller Hauptscreens in `docs/screens/`, Liste der offenen Punkte

---

## Später (nicht im Briefing, nur nach Freigabe durch Beks)
- Partner-Portal: Partner registrieren und freigeben, Angebote abgeben, Kunde nimmt an, Auszahlungsübersicht. Erst damit gibt es echte Buchungsbestätigungen. Die Sichtbarkeitsregel aus `CLAUDE.md` (vor Annahme nur PLZ/Bezirk) gilt dann.
- Admin-Oberfläche (Freigaben, Statuspflege, `price_config` und Gebührensatz versioniert bearbeiten) und E-Mail-Benachrichtigungen. Bis dahin: Supabase-Dashboard.
- Vermieter bestätigt Mietanfragen in der App
- Zahlung und Rechnung über Stripe Connect (15 % als Plattformgebühr, Partner als Leistungserbringer; Rechnungs- und USt.-Logik vorher mit Steuerberatung klären)
- Capacitor-Build für iOS und Android
- Bewertungen, Verfügbarkeitskalender, weitere Städte
