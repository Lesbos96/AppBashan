# MoveNow · Fortschritt

Je Session 3–5 Zeilen: Datum, Session, was fertig ist, offene Punkte, Entscheidungen.
Wird eine Session wegen der Kontextgröße unterbrochen, steht hier „Weiter bei:" mit der genauen Stelle. Die nächste Session setzt dort fort.

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
