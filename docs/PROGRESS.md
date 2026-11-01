# MoveNow · Fortschritt

Je Session 3–5 Zeilen: Datum, Session, was fertig ist, offene Punkte, Entscheidungen.
Wird eine Session wegen der Kontextgröße unterbrochen, steht hier „Weiter bei:" mit der genauen Stelle. Die nächste Session setzt dort fort.

## 2026-10-31 · S8b-2 · Anfragen senden und Aufträge (abgeschlossen, Rest von S8b offen)
- Termin (`/:service/termin`), Zusammenfassung mit „Anfrage als x@y senden“ und „Anderes Konto“, Bestätigung, Aufträge-Liste (nur eigene Anfragen, Filter `customer_id`, feste Spalten). `clientRef` je Inhalt, Entwurf wandert über die Anmeldung (15 min, localStorage), keine automatischen Wiederholungen. Code: `src/lib/{draft,quote}.ts`, `src/screens/anfrage/`.
- Server: Mietzeit nur als Wiener Ortszeit, ISO mit Z/Offset gibt 400 (`pickupAt:`/`returnAt:`); neu `formatEuroRounded`. `quote` im Dev-Projekt deployt. Berater: Plan `tmp/proof/s8b2-berater-plan.md`.
- Grün: check (312 Unit), E2E, shots/shots:all, build mit dist-Scan (inkl. `fee_splits`/`platform_settings`), `test:rls` (88), `scripts/live-quote-app.mjs` (23/23, Testnutzer gelöscht). Offen: Uploads (S8b-3), Detail/Bearbeiten/Zurückziehen, Miete in der App (S9); siehe OPEN_ISSUES „S8b-2“.

## 2026-11-01 · S8b-2 · Abschluss und Nachbesserung
- Flake `dienste.spec.ts:73` behoben: `Shell.tsx` gibt jedem Seitenwechsel eine neue Instanz (AnimatePresence belebte sonst die ausblendende Seite samt Zustand). 30/30 grün einzeln (vorher 23/30), `tmp/proof/s8b2-flake-73.log`
- Live-Skript: clientRef-Fall (zweite Anfrage mit neuen Werten) und Vorschau = Server auf den Cent für Montage, Entrümpelung, Umzug (mit Strecke) und Miete (`tmp/proof/s8b2-live.log`, alle bestanden, Testnutzer gelöscht). App: Hinweis „Der Preis wurde aktualisiert.“ auf der Bestätigung (E2E mit abweichender Antwort)
- Grün: check, build + dist-Scan, E2E 72/72, `test:rls` 88/88, Shots 390 (`tmp/proof/s8b2-shots.md`, Reviewer: 1 mittel Kontrast behoben)

## 2026-10-30 · S8a · Live-Test, Deploy, ORS-Umstellung · abgeschlossen
- Secrets im Dev-Projekt gesetzt (SECRET_KEY, ORS_API_KEY, RATE_LIMIT_SECRET, PUBLISHABLE_KEY, ALLOWED_ORIGINS; nur über dotenv-cli), `route` und `quote` deployt. ORS-Basis-URL von `api.openrouteservice.org` (abgekündigt) auf `api.heigit.org` umgestellt (Konstante `ORS_URLS`: Directions `/openrouteservice`, Geocoding `/pelias/v1`); zwei Anpassungen aus dem Live-Test: Accept `application/geo+json` (sonst 406) und `instructions: true` (sonst keine Abschnitte je Leg)
- Live: Wien→Graz 196,1 km, davon 186,5 km außerhalb Wiens, 2,4 h; München international; R1 belegt (12 Aufrufe: ab dem 11. 429, `cf-connecting-ip` wird vom Gateway mit 403 abgelehnt); R3 253 ms; Browser (CORS, `functions.invoke`) und `quote` (Token, CORS, Preis 1.060,95 €, Idempotenz, 409, Miete, Nutzerlimit) geprüft. Zahlen und Befehle: OPEN_ISSUES „S5b/S5c" und „S8a"
- Offen: echter Mailversand (Dashboard-Vorlagen, SMTP), ORS-Vertrag und Tageslimit, `ALLOWED_ORIGINS` für die echten Domains

## 2026-10-30 · S8a · Anfrage-Backend und Login · vorläufig abgeschlossen (Live-Test fehlt)
- Edge Function `quote` (`_shared/quote/`, Migration 0010 mit atomaren RPCs `quote_save_request`/`quote_save_booking`, View `current_fee_rates`, Spalten `description`, `volume_m3`, `client_ref`): Server rechnet Strecke, Preis, Gebühr und Status; Client liefert nur die Kundenwahl. Idempotent über `clientRef`, Bearbeiten nur im Status „angefragt", Miete in Wiener Ortszeit (ISO/UTC wird umgerechnet). App-Module `src/lib/{auth,uploads}.ts`, Mail-Vorlagen mit Code und Link, `route` und `quote` lesen `SECRET_KEY`
- Tests: Unit 199+ (je Pflichtkriterium ein Test), `test:rls` 88+ gegen Dev (Handler im Prozess, echte DB, fester Routenanbieter); Verweigerungstests bei gelockerten Rechten rot belegt (`tmp/reports/s8a-red-proof.md`). Keine UI, keine Screenshots
- **Vorläufig:** `quote` nicht deployt, `route`/`quote` nie live getestet (Secrets fehlen, kein echter Routenanbieter, kein echter Mailversand): OPEN_ISSUES „S8a" und „S5b". Entscheidungen (advisor): `SECRET_KEY` ohne Fallback, Gebührensatz je Schlüssel aus der höchsten Version, Routenfehler → Angebot `route_missing`, Zeitfenster als Enum. Abweichung: ISO-Zeitpunkte bei Mietzeiten auf Wunsch von Beks

## 2026-10-30 · S6 · Transport- und Umzug-Konfigurator · abgeschlossen
- `/transport` und `/umzug` (Konfigurator wie 04, Preis-Sheet wie 05, Persönliches Angebot mit Gründen, Foto-Aufbereitung ohne EXIF, Adress-Sheet mit Einwilligung und Bestätigung, animierte Routengrafik); Weiter führt zu einem Platzhalter `/:service/termin` (S8b). Code: `src/lib/{route,routeResult,photos,flow,preview}.ts`, `src/screens/Konfigurator.tsx`, `src/screens/konfigurator/`
- Preise nur über `computeTransport` aus `@pricing` (vorher `parseTransportInput`), ohne Strecke ein Angebot (`route_missing`, Anzeige „Strecke fehlt“), nie ein Preis ohne Strecke. Einwilligung standardmäßig aus; ohne sie kein Request an `route`. `route` ist in allen Tests gemockt (feste Beispielantwort, keine echten Kilometer), nicht live getestet (S5b)
- Tests: 12 neue E2E (689,61 € ohne Gebührenzeile, Klavier, Tastatur, Einwilligung, 429/500, EXIF, 8 Fotos, kaputter Zustand), Unit für Vorschau, Fotos, Routenantwort; `shots:all` ohne Konsolenfehler
- Entscheidungen (advisor, Plan und Abnahme): `functions.invoke`, gespeicherter Zustand wird streng geprüft, Fehlerzustand statt Absturz. Offen und bewusst: Weiter bleibt bei Routenfehler aktiv (Angebot); Einzelheiten in OPEN_ISSUES „S6“

## 2026-10-29 · S5 · Routing-Dienst und Wiener Stadtgrenze · abgeschlossen (Deploy offen)
- Migrationen 0006–0008: `route_cache`, `route_rate_limits`, RPC `route_geo_facts` (km außerhalb Wiens per PostGIS, Punkt in Österreich, fehlende Grenze = Fehler) und `take_rate_tokens` (nur service_role, bricht beim ersten überschrittenen Zähler ab), pg_cron-Aufräumjob; Grenzen Wien und Österreich importiert (`npm run geo:import`, 415 und ca. 83.900 km², gültig)
- Edge Function `route` (Logik in `_shared/route/`): Geocode-Kandidaten, Routenfakten (Region, outsideKm, driveHours, Strecken), ORS hinter Adapter, Cache nur Rohantwort (24 h, HMAC-Schlüssel), Rate-Limit je IP und global. Tests: 27 Unit, Integration mit PostGIS-Fixtures (Wien→Wien, Graz, München, Salzburg→Innsbruck), Zugriff verweigert/erlaubt, parallele Zähler
- Entscheidungen (advisor): ORS nur mit AVV und geklärtem Kontingent; Länder serverseitig über das Österreich-Polygon; Geocoding ungecacht; kein Depot. Abweichung: Die Function liest `SUPABASE_SERVICE_ROLE_KEY` (Plattformvariable), Prüfung beim Deploy
- Offen: Function-Secrets und Deploy ins Dev-Projekt (vom Auto-Modus blockiert), Live-Test gegen ORS, IP-Ermittlung prüfen; Auflagen für `quote` (S8a). Alles in OPEN_ISSUES.md

## 2026-10-29 · S4 · App-Shell und ruhige Screens · abgeschlossen
- Migration 0004 (`price_config.value >= 0`, View `current_price_version`: höchste Version mit `effective_on` ≤ heute, Wiener Datum) und 0005 (Rechte der View); echte Tests statt `it.todo` (DB-Check, Seed-Spanne, Version 9999 mit `effective_on` 2999 gilt nie als aktuell); Seed-Labels ohne „Prototyp", Zeile `rental.reference` für die Quellen der Transportermiete
- App-Shell (`src/app/`): Tab-Bar, Seitenübergänge im iOS-Stil, Spalte 520 px, Offline-Hinweis; Screens Start, Onboarding (3 Seiten, einmalig), Aufträge leer, Profil, Info-Sheet „Wie rechnet MoveNow?" (Werte, Labels, Quellen aus `price_config`, Fehlerzustand statt Ersatzwerte), Datenschutz und Impressum & AGB als markierte Platzhalter, Fehlerseite; Flows (Transport, Umzug, Entrümpelung, Montage, Miete, Vermieter) zeigen bis S6–S9 „noch nicht verfügbar"
- Entscheidungen (advisor): aktuelle Version nur über die View; Info-Sheet unter `/profil/preise` (Profil-Tab bleibt aktiv). Abweichungen von `16` in OPEN_ISSUES. `Sheet` hat jetzt sichtbaren Titel und Schließen-Knopf, `NavBar` rechnet die Safe Area ein
- Abnahme: advisor (Schema, RLS, Tests; Auflagen umgesetzt, Migration 0005), reviewer über alle vier Größen (Route im Onboarding war unterbrochen, Größen im Info-Sheet, Dark-Hero; behoben). Offen für S5/S8a: `quote` bricht bei fehlenden Tarifschlüsseln ab und ignoriert `unit` `ref`
- Reviewer-Runde 1: Mesh wurde wegen ungültigem `background-image` nicht gemalt, `tabular-nums` im Body spreizte Bindestriche, Onboarding-Karte lag unter dem Hero; alles behoben

## 2026-10-29 · S3b · Basiskomponenten · abgeschlossen
- `src/theme.css`: Gradienten (Primär-Button, Mietkarte, Hero-Mesh, App-Icon; Dark für Button und Mietkarte), Layout- und Motion-Werte als CSS-Variablen; `MotionConfig reducedMotion="user"` in `main.tsx`
- `src/components/`: `Button`, `Controls` (Segmented als native Radiogruppe, Stepper, Toggle, Status-Chip), `Surfaces` (Karte, Service-Karte, Inset Grouped List mit Zeile und Feld, Betragszeile ohne Umbruch über `formatEuro`), `Bars` (Glas-Tab-Bar, Navigationsleiste mit schrumpfendem Large Title, Aktionsleiste, Fortschritt), `Sheet` (nativer `<dialog>`, Detents, Drag am Griff, Esc und Tippen außerhalb schließen)
- Galerie `/dev/fundament` um Komponenten ergänzt; E2E `tests/e2e/komponenten.spec.ts` (Tastatur: Segmented, Stepper, Schalter, Sheet)
- Abweichung von der Aufgabe: Die Tab-Bar der Referenz ist 83 px hoch (Eintrag 49 px plus Home-Indicator-Bereich), die Aktionsleiste enthält nur den Button. Dark-Varianten von Primär-Button und Segment-Thumb nach dem Dark-Muster abgeleitet, keine Referenz.

## 2026-10-29 · S3a · Tokens, Icons, Illustrationen · abgeschlossen
- `src/theme.css`: Tokens aus `tokens.json` als CSS-Variablen (Light, Dark per `prefers-color-scheme`) plus Tailwind-Theme; Dark-Werte, die tokens.json nicht nennt, nach dem Dark-Muster abgeleitet. Inter variabel selbst gehostet (`@fontsource-variable/inter`)
- 45 Icons (`src/assets/icons`) und 24 Illustrationen samt Dark-Varianten (`src/assets/illustrations`) byte-genau aus `tmp/svg/` kopiert, per `vite-plugin-svgr` als Komponenten `Icon` / `Illustration`; geändert nur Wurzel-Farben (`currentColor`, Aussparung `--icon-cutout`) und absolute Positionierung
- App-Icon, Favicon, PNGs, `manifest.webmanifest`, theme-color, Safe-Area-Utilities; Galerie `/dev/fundament` nur im Dev-Build, in `shots` aufgenommen
- `formatEuro` (`src/lib/money.ts`): reine Ganzzahl-Rechnung ohne Intl (Node, Deno, Browser identisch), Tausenderpunkt, Dezimalkomma, geschütztes Leerzeichen und € (wie die Referenz); wirft bei Nicht-Cent; Test auch unter Deno. Splash: erst mit Capacitor (S10)

## 2026-10-29 · S2b · Härtung Preis-Modul · abgeschlossen
- Deno 2.9 (npm-Dev-Dependency `deno`): `check:deno` (deno check + 60 Golden-Fälle unter Deno) ist Teil von `npm run check`; Golden-Test in `tests/unit/golden.ts` für Vitest und Deno geteilt
- Property-Tests (fast-check, 1000 Läufe je Invariante), Sommerzeit-Tests beider Umstellungen, Grenzen in `limits.ts`; Preisergebnisse unverändert. Mutationsprobe: Fehler in Rundung und Gebühr werden erkannt
- Abnahmekriterien als `it.todo` und in ROADMAP: S8a (`quote` speichert nur geprüfte Felder), S4 (DB-Check `value >= 0`, Seed-Test Spanne)
- Zeitzone: nicht nötig, Miettage zählen nach Wanduhrzeit ohne Zeitzone

## 2026-10-29 · S2 · Preis-Engine · abgeschlossen
- Modul `supabase/functions/_shared/pricing/` (Transport/Umzug, Entrümpelung, Montage, Miete, `splitFee`, `parse*Input`), 81 Unit-Tests grün: 5 README-Beispiele centgenau, 60 Golden-Fälle aus dem Prototyp (`npm run fixtures:pricing`)
- Entscheidungen (advisor): Gebühr in Ganzzahl half-up statt Float; Zeilen per Largest-Remainder; Serverfakten (`RouteFacts`, `RentalOffer`) getrennt von der Kundenwahl. Abweichungen in `docs/PRICING.md`
- Für S8a: `parse*Input` verwirft unbekannte Schlüssel; `quote` speichert nur geprüfte Felder. `splitFee` bleibt in `@pricing` (Vermieter-Abrechnung S9 braucht sie)
- Offen: DB-Check `price_config.value >= 0` und Seed-Test `rate_low ≤ rate ≤ rate_high` (S3a/OPEN_ISSUES)

## 2026-10-29 · S1 · Fundament und Architektur · abgeschlossen
- Gerüst (Vite 8, React 19, Router 8, Tailwind 4, Motion, Vitest 5, Playwright, ESLint 10, TypeScript 6.0), Skripte, `@pricing`-Alias, Supabase verlinkt, Migrationen 0001–0003 und Seed eingespielt, `docs/ARCHITECTURE.md`
- Anfragen und Mietanfragen schreibt nur die Edge Function `quote` (S8a); Kunden haben nur `update(status)` → withdrawn. Rechte über Spalten-Grants plus RLS. Fotos: erst Eintrag in `request_photos`, dann Upload (Policies ohne Selbstbezug, 42P17).
- App-Variablen mit Präfix `NEXT_PUBLIC_` (Vite `envPrefix`, Entscheidung Beks), passend zur vorhandenen `.env.local`. Repo: github.com/bekhanidrisov74-hub/movenow (privat).
- Offen: Löschfristen und Freigabe geänderter Angebote (Entscheidung); Quellen ohne Einzelnachweis (OPEN_ISSUES.md)

## 2026-10-30 · S5b · Code fertig, Live-Test offen
- Migration 0009 `route_cleanup()` + stündlicher Job (Cache ≤ 25 h); RLS-Test prüft 42501 exakt (Beweis mit gelockerten Grants rot, zurückgenommen); Body-Limit per Stream; IP-Tageslimit 80/160; Konsolen-Erfassung belegt; check, test:rls (55) und E2E (14) grün
- `route` deployt, Secrets fehlen (Auto-Modus verweigert, Beks setzt sie), Live-Test Wien→Graz, R1, R3 offen: OPEN_ISSUES „S5b"

## 2026-10-30 · S5c · verschoben
- Kein Code geändert. Secrets fehlen im Dev-Projekt, `.env.local` hat keinen `ORS_API_KEY`; Deploy und Live-Test (Wien→Graz, R1, R3, Fehlerfälle) auf später verschoben
- Offen, jeweils mit Datum in ROADMAP (S5) und OPEN_ISSUES (S5b/S5c): Live-Test vor Abnahme von S8a, ORS-Plan und Tageslimit pro IP, `ALLOWED_ORIGINS` vor Livegang

## 2026-10-30 · S7 · abgeschlossen
- Vorab: Umzug-E2E „Mehr Kartons“ 50 von 50 Läufen grün (Ursache früherer Fehlschläge vermutlich Timeout unter Last, nicht bewiesen; Timeout 60 s, Trace/Screenshot bei Fehlschlag). Preis-Sheet: Link bei 390 px ohne Scrollen, obere Leiste dichter (`glass-strong`)
- Entrümpelungs-Wizard (6 Schritte) mit Ergebnis (Spannen-Grafik, Besichtigungspfad) und Service Montage (Standardmöbel, Küche) über `@pricing`; `useStored` für alle Flows; Preis-Sheet für alle Services nutzbar
- E2E: Entrümpelung 1.175,00 € (950–1.550 €), Küche 770,40 €, Mindestpreis, Besichtigung, kaputter Zustand; check, E2E (33) und `shots:all` (240) grün, Reviewer ohne „hoch“. Keine Migration, kein `test:rls` nötig
- Offen: Beschreibung/Fotos für `quote` (S8a), Termin-Seiten bis S8b „Folgt“: OPEN_ISSUES „S7“

## 2026-10-31 · S8b-1 · Anmeldung (abgeschlossen, Rest von S8b offen)
- `/anmelden` (E-Mail → Code 6–10 Ziffern, Link mit `token_hash` erst nach Tipp, Fehlertexte, Countdown 60 s), geschützte Route `/auftraege` per Loader mit Rücksprung (`safeNext`, 15 min im localStorage), Profil mit E-Mail und Abmelden, `SessionProvider`. Keine Angebots-Anbindung, keine Uploads (S8b-2, S8b-3)
- Berater-Auflagen eingearbeitet: Link bei bestehender Sitzung nur nach Tipp (Login-CSRF), Token sofort aus der URL, `no-referrer`, `config.toml`: `max_frequency` 60 s, `otp_length` 8
- check (214 Unit), E2E (49), `shots:all` (312), build, `test:rls` (88) und `scripts/live-auth.mjs` (Code- und Link-Weg, Nutzer gelöscht) grün; dist-Scan ohne Schlüssel
- Offen: Dashboard-Werte (Dev, Prod) und SMTP, siehe OPEN_ISSUES „S8b-1“

<!-- Beispiel:
## 2026-10-30 · S1 · abgeschlossen
- Gerüst, Migration 0001, RLS-Tests (12/12) grün
- Offen: Partner-Gebietsmodell (PLZ-Liste vs. Bezirke) – Entscheidung Beks

## 2026-11-02 · S6 · unterbrochen
- Konfigurator und Routengrafik fertig, Preis-Sheet offen
- Weiter bei: Preis-Sheet wie 05, danach E2E Umzug-Beispiel
-->

## 2026-10-31 · S8b-1 · Nachbesserung
- `safeNext` per Parsing (Steuerzeichen sofort verworfen, Origin-Vergleich, `//` und `/anmelden` nach Auflösung); Berater-Prüfung: `tmp/proof/s8b1-berater.md` (kein hoch/mittel); `scripts/scan-dist.mjs` im `build` (Rot-Beweis: Fake-Wert Exit 1, danach Exit 0); Shots 430/768: `tmp/proof/s8b1-shots.md`; Captcha und Login-CSRF in OPEN_ISSUES
- check (Exit 0, 255 Unit), build (Exit 0, dist-Scan 0), E2E 49/49

## 2026-11-01 · S8b-3 · Foto-Uploads
- Migration 0011/0012: Pfad ({uid}/{anfrage}/{id}.jpg) und Limit 8 per Trigger (atomar), Bucket nur image/jpeg, `photo_orphans`/`photo_cleanup`, Job stündlich; Edge Function `photo-cleanup` (Code fertig, Einrichtung wartet auf `npm run setup:photo-cleanup`, siehe OPEN_ISSUES)
- App: Warteschlange nach dem Senden (idempotent, Retry, offline/zu groß/Limit/Entfernen), Verkleinern auf 2000 px, HEIC-Meldung; Karte „Fotos“ auf der Bestätigung
- check 334 Unit, E2E 82, RLS 102, Live-Skript ohne Fehler (Aufräum-Function übersprungen: Einrichtung offen, `npm run setup:photo-cleanup`), Rot-Beweis bestanden
- Nachweise in `tmp/proof/`: Berater-Plan und -Abnahme, Review, Shot-Tabelle, `live-uploads.log`, `s8b3-redproof.log`

## 2026-11-01 · S8b-3 Nachtrag · Foto-Löschung
- Migration 0014 (Dev): `photo_cleanup()` scheitert bei fehlenden/leeren Vault-Secrets, Timeout 60 s. Berater: `tmp/proof/s8b3-0014-berater.md` (F1, F2 mittel behoben)
- Live-Skript belegt 0 Dateien nach Anfrage- und Konto-Löschung samt Negativkontrolle; test:rls 102, check 339, Cron succeeded und HTTP 200 (`tmp/proof/s8b3-cron.log`)

## 2026-11-01 · S8b-Abschluss
- Findings A (Migration 0013, Test „Wiederholen beim achten Foto“) und B (`deletePhoto` prüft den Fehler, Unit-Test) waren schon umgesetzt, hier nachgewiesen; keine neue Migration. RLS-Tests zu `photo_cleanup` melden fehlenden Vault klar („Vault-Secrets fehlen – npm run setup:photo-cleanup ausführen“)
- UI: Aktionsleiste ab 520 px auf Kartenbreite, Einwilligungs-Links ohne Zeilenabstand-Effekt, Dark-Variante der Karton-Grafik, Spinner und Entfernen-Badge kontrastreicher; Shot-Tabelle `tmp/proof/s8b-abschluss-shots.md`
- E2E-Flake (zwei `main` im Seitenübergang) im Zusammenfassungs-Test behoben. check 339 Unit, build/dist-Scan 0, E2E 82, RLS 102

## 2026-11-01 · S8b-Abschluss Nachtrag
- Test „kein Preis“ wartet auf genau ein `main` und prüft es (Rot-Beweis: Preis im Zielseiten-`main` macht ihn rot; 20 von 20 grün). CLAUDE.md: Shots beurteilt nur der `reviewer` (Bildsicht belegt), je Tabellenzeile eine Bildbeobachtung; Doku nur mit Write/Edit. check 341 Unit, E2E 82

## 2026-11-01 · S9-Konzept (nur Dokument)
- `docs/S9_KONZEPT.md`: Konzept für verbindliche Buchung, Partner, Nachträge und Provisionsabrechnung (E1–E5), 14 Abschnitte; kein Code, keine Migration, kein DB-Zugriff. Nichts davon ist von Beks freigegeben: Regeländerungen (1.3), Vorschläge (10), Fragen (14: 23 Punkte) und rechtliche Fragen (11) sind offen
- Berater (Opus): Plan `tmp/proof/s9-konzept-berater-plan.md`; Abnahme Runde 1 (5 hoch), Runde 2 (2 hoch), Runde 3 (0 hoch, mittlere Findings danach eingearbeitet, keine vierte Runde) in `tmp/proof/s9-konzept-abnahme-runde1.md`, `-runde2.md`, `s9-konzept-abnahme.md`; Belegstichproben des Beraters stimmen

## 2026-11-01 · S9-Konzept Überarbeitung (nur Dokument)
- `docs/S9_KONZEPT.md` nach den Entscheidungen von Beks vom 01.11.2026 neu geschnitten: Phase 1 (MVP) und Phase 2, Einstellwerte in `platform_settings` (5.10), Abschnitt 10 als Entscheidungen, Abschnitt 13 mit neun Schritten S9a bis S9i, Abschnitt 14 mit 14.1 (entschieden) und 14.2 (offen: Fragen 2, 24 bis 30). Regeländerungen (1.3) sind nur ein Vorschlag, Beks gibt sie separat frei. Kein Code, keine Migration, kein DB-Zugriff
- Berater (Opus, schrieb seine Dateien selbst; der Agent `advisor` hat kein Write, deshalb ein Opus-Subagent mit Write-Recht): Runde 4 (5 hoch), Runde 5 (2 hoch), Runde 6 (0 hoch), Runde 7 (0 hoch, 1 mittel, 4 niedrig) in `tmp/proof/s9-konzept-abnahme-runde4.md` bis `-runde7.md`. Nach Runde 7 wurde das Konzept nicht mehr geändert; die offenen Punkte aus Runde 7 stehen als Auflagen für die Planfreigaben in OPEN_ISSUES „S9-Konzept“
- Weiter bei: Beks beantwortet 14.2 und gibt 1.3 frei, dann Plan-Freigabe S9a

## 2026-11-01 · Freigaben von Beks eingearbeitet, Agent advisor-report, Bildsicht-Test (nur Dokumente)
- Regeländerungen aus S9_KONZEPT 1.3 in CLAUDE.md, ARCHITECTURE, ROADMAP, OPEN_ISSUES angewendet; Entscheidungen 24–30 und R7-1 in 14.2 und den betroffenen Abschnitten eingetragen. Offen: `window_start_*` (die App kennt vier Zeitfenster ohne Uhrzeiten) und `offer_max_cents`, beide nennt Beks. Neuer Agent `.claude/agents/advisor-report.md`; CLAUDE.md um Agent und Maß-Regel ergänzt.
- Bildsicht-Test bestanden: `tmp/proof/bildsicht-test.md` (Wort MSNSDQ vom reviewer richtig gelesen).
- Berater (Opus): Runde 8 (1 hoch, 8 mittel, 10 niedrig) `tmp/proof/s9-konzept-abnahme-runde8.md`, nach Einarbeitung Runde 9 (0 hoch) `tmp/proof/s9-konzept-abnahme-runde9.md`. Danach keine Änderung an S9_KONZEPT.md.
- Nicht eingearbeitet, braucht Freigabe von Beks: CLAUDE.md-Leserechte (R8-9) und Tab-Bar ohne Miete (R8-16).
- Weiter bei: Beks nennt `window_start_*` und `offer_max_cents`, dann Plan-Freigabe S9a

## 2026-11-01 · S9-Konzept: Findings R9-1 bis R9-13 und R10-1 bis R10-13 eingearbeitet (nur Dokumente)
- Runde 9 → Einarbeitung → Runde 10 (`tmp/proof/s9-konzept-abnahme-runde10.md`, 0 hoch, 3 mittel, 10 niedrig) → Einarbeitung → Runde 11 (`tmp/proof/s9-konzept-abnahme-runde11.md`, 0 hoch). Nach Runde 11 keine Änderung an S9_KONZEPT.md (Rundengrenze).
- Offen aus Runde 11 (2 mittel, 5 niedrig, R11-1 bis R11-7): in `docs/OPEN_ISSUES.md` (Zeile 10) gelistet, vor der Plan-Freigabe S9a/S9b einzuarbeiten.
- Neu in 14.3: offene Punkte für Beks (`window_start_*`, `offer_max_cents`, `route_missing` buchbar, Bezirk nur aus Polygon). CLAUDE.md-Änderungen R8-9/R8-16 weiter ohne Freigabe.
- Weiter bei: Beks nennt die Werte aus 14.3 und entscheidet über R8-9/R8-16; R11-1 bis R11-7 einarbeiten, dann Plan-Freigabe S9a
