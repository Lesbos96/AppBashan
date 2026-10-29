# MoveNow · Roadmap

Eine Session je Abschnitt. Modell Sonnet 5.5 / Effort medium, außer wo anders vermerkt.
Jede Session endet mit grünen Checks, abgehakten Checkboxen, einem Eintrag in `docs/PROGRESS.md`, Commit und Push (falls Remote). Der Commit beendet die Session.
UI-Sessions: Jeder fertige Screen besteht den Prüf-Loop aus `CLAUDE.md` gegen seinen Referenz-Screen in `docs/reference/design/screens/`, in Light und Dark. Vor dem Commit einmal `shots:all` (alle vier Größen), Konsole ohne Fehler, Tastaturbedienung des Hauptflows als E2E-Test.
Preisbeispiele aus `docs/reference/design/README.md` in E2E-Tests: geprüft werden Gesamtpreis und Positionen, die Kunden sehen. Die Gebührenwerte der Beispiele gelten nur für das Modul und die Vermieter-Abrechnung.
Umfang: genau das Briefing in `docs/DESIGN_BRIEF.md`. In dieser Phase keine echten Zahlungen, keine echten Buchungsbestätigungen, keine erfundenen Verfügbarkeiten. Alles darüber hinaus steht unter „Später" und wird nur nach Freigabe gebaut.

---

## S1 · Fundament und Architektur (Opus 5.5 · Effort medium)
- [ ] Agent-Dateien und `.claude/settings.json` validiert, je ein Testlauf von `Explore` und `test-runner`
- [ ] `npm run env:check` bestätigt alle Variablennamen aus `.env.example` in `.env.local`
- [ ] Gerüst: Vite + React + TS strict, React Router, Tailwind, Motion, ESLint, Vitest, Playwright; Pfad-Alias `@pricing` auf `supabase/functions/_shared/pricing/`
- [ ] Skripte: `check`, `build`, `test:e2e`, `shots`, `shots:all`, `db:types`, `db:push`, `env:check`; Secrets nur über dotenv-cli
- [ ] Supabase initialisiert und mit dem Dev-Projekt verlinkt
- [ ] `docs/ARCHITECTURE.md`: Rollen, Datenmodell, Statusfluss, Geldfluss, RLS-Matrix, Datenschutz, Routen- und Screen-Struktur der App, Entscheidungen
- [ ] Migration 0001: PostGIS, Enums, Tabellen aus dem Briefing (`profiles`, `service_requests`, `request_photos`, `rental_offers`, `rental_bookings`, `price_config`) plus `platform_settings`, `fee_splits`, `geo_boundaries`; Indizes, RLS, Policies, privater Bucket `request-photos`
- [ ] `supabase/seed.sql`: `price_config` mit den Kunden-Tarifen aus dem Prototyp (Werte, Quelle, URL, Recherchedatum); Gebührensatz und USt.-Satz der Gebühr nur in `platform_settings`; Mietangebote aus `sampleOffers` als Demo markiert
- [ ] RLS-Tests grün: anon liest nichts Personenbezogenes; Kunde A sieht Anfragen, Fotos und Mietanfragen von B nicht; Vermieter sieht und ändert nur eigene Fahrzeuge; Kunden sehen nur freigegebene Fahrzeuge; Kunden und anon lesen weder `fee_splits` noch `platform_settings`; nur admin ändert `price_config`; niemand macht sich selbst zum admin
- [ ] Leere `docs/OPEN_ISSUES.md` und `docs/PRICING.md` angelegt

**Akzeptanz:** `npm run check` und `npm run build` grün, Migration eingespielt, RLS-Tests grün, ARCHITECTURE.md vorhanden.

## S2 · Preis-Engine
- [ ] Reine TS-Funktionen ohne Abhängigkeiten in `supabase/functions/_shared/pricing/`: Transport/Umzug, Entrümpelung, Montage, Miete, Plattformgebühr, Angebotspflicht mit Gründen
- [ ] Tarife kommen als Parameter aus `price_config`, nicht als Konstanten; der Gebührensatz kommt als Parameter aus `platform_settings` (kein fester 15-%-Wert im App-Code, die Tests übergeben ihn)
- [ ] Feste Testfälle: die fünf Preisbeispiele aus `docs/reference/design/README.md` (gegen den laufenden Prototyp-Code geprüft, centgenau)
- [ ] Golden-Fixtures: Prototyp in Playwright laden, `window.MoveNowDemo.*` mit mindestens 40 Eingaben aufrufen, Ergebnis als JSON speichern
- [ ] Abdeckung: Mindestdauern, 1–8 Personen, mehrere Fahrzeuge, Personen < Fahrzeuge, Spezialgut, Groß-LKW, Einpackservice, Wien / Österreich / international, Entrümpelung mit Mindestpreis und Etagen, Küche vs. Standardmontage, Miete mit angebrochenem Tag, Mehr-km, Einweg, Bereitstellungsgebühr, halbe Cents bei der Gebührenaufteilung
- [ ] Gebührenaufteilung als eigene Funktion; Kunden-Preispositionen enthalten keine Gebührenzeile
- [ ] Prototyp-Fehler „Umzug" (ReferenceError `moveRouteHTML`) nicht übernommen; jede Abweichung vom Briefing in `docs/PRICING.md`
- [ ] `docs/PRICING.md`: welche Werte Stichproben-Richtwerte sind und aus welcher Quelle

**Akzeptanz:** alle Tests grün, keine Preislogik außerhalb des Moduls.

## S3 · Design-System
- [ ] `tokens.json` → CSS-Variablen (Light/Dark) und Tailwind-Theme
- [ ] Icon-Set (Outline und Filled) als SVG-Komponenten mit `currentColor` und Tokens (Extraktion über `mech-editor`)
- [ ] Alle Illustrationen als SVG-Komponenten in den Materialfarben der Palette `illustration`, weiche Kontaktschatten, Dark-Varianten aus `02_Start_Dark.html`
- [ ] Basiskomponenten: Primär-/Sekundärbutton, Karte, Service-Karte, Inset Grouped List, Segmented Control, Stepper, Toggle, Feld, Status-Chip, Bottom Sheet (Griff, Detents, Drag-to-Dismiss), Glas-Tab-Bar, Navigationsleiste mit schrumpfendem Large Title, fixierte Aktionsleiste, Fortschrittsanzeige, Betragszeile ohne Umbruch
- [ ] Komponenten-Galerie unter `/dev/fundament` (nur im Dev-Build), verglichen mit `00_Fundament.png`
- [ ] App-Icon, Favicon, Splash aus `00_Fundament`; PWA-Manifest, theme-color, Safe Areas

**Akzeptanz:** Galerie ohne „hoch"-Findings gegen `00_Fundament.png`, Light und Dark.

## S4 · App-Shell und ruhige Screens
- [ ] App-Shell mit Tab-Bar (Start · Miete · Aufträge · Profil), Seitenübergänge, Desktop-Spalte max. ca. 520 px
- [ ] Start Light/Dark (`01`, `02`), Onboarding 1–3 (`03`, Seiten 2 und 3 im selben Stil), Profil (`16`), „Wie rechnet MoveNow?" als Info-Sheet mit Werten und Quellen aus `price_config`, ohne Plattformgebühr (`17`), Aufträge leer (`15`)
- [ ] Datenschutz, Impressum und AGB als markierte Platzhalter
- [ ] Lade-, Fehler- und Offline-Zustand

**Akzeptanz:** jeder Screen ohne „hoch"-Findings gegen seine Referenz.

## S5 · Routing-Dienst und Wiener Stadtgrenze
- [ ] Wiener Grenze (OSM, ODbL) als Geometrie in `geo_boundaries`, Import-Skript dokumentiert
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

## S8 · Termin, Login, Anfrage, Aufträge
- [ ] Ort & Termin wie `10`, Zeitfenster für Entrümpelung und Montage, Zusammenfassung wie `11`, Bestätigung wie `12`
- [ ] Supabase Auth mit E-Mail-Magic-Link wie in `16` („Mit E-Mail-Link anmelden"), Code in derselben Mail als Ausweichweg, Konto erst beim Absenden, „Mit Apple anmelden" vorbereitet
- [ ] Absenden: Edge Function `quote` rechnet neu und speichert Snapshot mit `price_version`; Status „angefragt" bzw. „Besichtigung angefragt"; Fotos in privaten Bucket
- [ ] Aufträge-Liste wie `13` (Anfragen und Mietanfragen, Aktiv/Erledigt), Detail mit Timeline und Tarifstand wie `14`
- [ ] „Anfrage bearbeiten" und „Anfrage zurückziehen" wie `14`, solange der Status „angefragt" ist. Alle weiteren Status setzt in dieser Phase nur admin (vorerst im Supabase-Dashboard).
- [ ] Integrationstests (sequenziell): manipulierter Client-Preis wird ignoriert; fremde Anfragen und Fotos unsichtbar; Kunde kann keinen Status außer „zurückgezogen" setzen

## S9 · Transportermiete und Vermieterbereich
- [ ] Miete wie `09` (ohne Gebühr, Kaution separat); die Mietanfrage wird als „angefragt" gespeichert, ohne Bestätigung in der App und ohne echte Verfügbarkeit
- [ ] Vermieterbereich wie `18` über Profil → „Für Vermieter": Fahrzeuge und Tarife anlegen und bearbeiten (alle Felder aus `offerFields`), Beispielabrechnung mit Plattformgebühr
- [ ] Wer „Für Vermieter" öffnet und sich anmeldet, wird Vermieter. Vermieter sehen und ändern nur eigene Fahrzeuge (RLS). Neue Fahrzeuge sind für Kunden erst nach Freigabe sichtbar (vorerst im Supabase-Dashboard).
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
