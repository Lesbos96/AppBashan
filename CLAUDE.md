# MoveNow

Vermittlungsplattform, Start Wien: Möbeltransport, Umzug, Entrümpelung, Montage/Demontage, Transportermiete. Kunden bekommen einen Richtpreis und senden eine unverbindliche Anfrage; der Partner bestätigt Termin und Preis (in dieser Phase außerhalb der App). MoveNow behält 15 % des Gesamtpreises (inkl. 20 % USt.) als Plattformgebühr ein. Keine Zusatzgebühr für Kunden, und Kunden sehen die Gebühr nirgends.

Umfang dieser Phase: genau das Briefing in `docs/DESIGN_BRIEF.md`. Was unter „Später" in `docs/ROADMAP.md` steht (z. B. Partner-Portal, Admin-Oberfläche, Zahlung), baust du nur nach meiner Freigabe.

## Quellen und Rangfolge
- **Optik:** `docs/reference/design/` (Screens, HTML-Quelltext, `tokens.json`, `README.md`). Verbindlich.
- **Design-Sprache, Inhalt, Ablauf:** `docs/DESIGN_BRIEF.md`. Der Kopf der Datei sagt, welche Abschnitte gelten.
- **Preise:** Code im Prototyp `docs/reference/MoveNow_Prototyp.html`. Optik und Seitenstruktur des Prototyps sind nicht maßgeblich.
- **Plan:** `docs/ROADMAP.md` · Architektur: `docs/ARCHITECTURE.md` · Stand: `docs/PROGRESS.md` · Offenes: `docs/OPEN_ISSUES.md`
- Bei Widerspruch gilt diese Datei. Danach: für die Optik die Design-Referenz, für Inhalt und Ablauf DESIGN_BRIEF, für Preise der Prototyp-Code (Abweichungen in `docs/PRICING.md` melden).
- Große Referenzdateien nie komplett in den Hauptkontext laden. `Explore` liefert die nötigen Stellen.

## Stack
- Vite + React + TypeScript strict, React Router mit Seitenübergängen im iOS-Stil
- Tailwind CSS mit Theme aus `tokens.json` (als CSS-Variablen, Light und Dark), Motion für Federanimationen
- Mobile-first PWA, später per Capacitor in den App Store. Nichts bauen, was nativ nicht funktioniert.
- Supabase (EU-Region): Postgres + PostGIS, Auth (E-Mail-Magic-Link wie im Design, dieselbe Mail enthält zusätzlich einen Code als Ausweichweg), Storage, Edge Functions. Die App ist eine reine Client-App, alle Geschäftslogik mit Vertrauensbedarf läuft in Supabase.
- Vitest (Unit, Integration), Playwright (E2E, Screenshots). Die App wird als statischer Build ausgeliefert; den Hosting-Anbieter lege ich vor dem Launch fest.

## Befehle
- `npm run dev`, `npm run build`
- `npm run check`: Lint, Typecheck, Unit-Tests
- `npm run test:e2e`: Playwright
- `npm run shots`: Full-Page-Screenshots 390×844 mit Faktor 2 (gleiche Breite wie die Referenz), Light und Dark, nach `tmp/shots/`
- `npm run shots:all`: zusätzlich 430×932, 768×1024, 1280×800, je Light und Dark
- `npm run db:types`, `npm run db:push`: Supabase-Typen bzw. Migrationen (laufen über dotenv-cli)
- `npm run env:check`: meldet nur, welche Variablennamen gesetzt sind
- Neue Migration: `npx supabase migration new <name>`

## Sessions und Modelle
- Eine Session = ein Abschnitt aus `docs/ROADMAP.md`. Am Ende: Checks grün, ROADMAP abhaken, 3–5 Zeilen in `docs/PROGRESS.md`, Commit, Push (falls ein Remote gesetzt ist), Bericht, Stopp.
- Ein Commit beendet die Session. Danach keine weitere Aufgabe beginnen; die nächste Session starte ich.
- Ab etwa 150.000 Tokens Kontext: Zwischenstand committen, in PROGRESS.md festhalten, wo es weitergeht, Bescheid geben, Stopp. Ich setze die Session in einer neuen Session fort.
- Hauptsession: Sonnet 5.5, Effort medium (beides in `.claude/settings.json`). Opus 5.5 nur auf meine ausdrückliche Anfrage (Architektur, harte Fehlersuche). Höhere Effort-Stufen nur bei harten Problemen.
- Zu Beginn prüfen, ob du mit dem vorgesehenen Modell läufst (S1: Opus 5.5, sonst Sonnet 5.5). Wenn nicht: sag es mir und warte.
- Mechanische Arbeit gibst du an Haiku 5.5 (`mech-editor`), Prüfläufe und Screenshots an Haiku 5.5 (`test-runner`), Reviews an Sonnet 5.5 (`reviewer`). Der Hauptkontext bleibt klein.
- Subagents aus `.claude/agents/`, immer die benannten, nie general-purpose:
  - `Explore` (Haiku): Suche, liefert Pfade und Zeilen
  - `test-runner` (Haiku): `check`, `test:e2e`, `shots`, `shots:all`, `build`. Diese Befehle laufen nie im Hauptkontext.
  - `mech-editor` (Haiku): mechanische Arbeit nach exakter Vorgabe (SVG aus der Referenz extrahieren, Texte, Umbenennungen, Formatierung, Fixtures, Doku)
  - `reviewer` (Sonnet): prüft Diff und Screenshots gegen Spec, diese Regeln und die Referenz-Screens
  - `advisor` (Opus): der Kopf. Entscheidet Architektur-, Geld- und Sicherheitsfragen, schreibt keinen Code
- Den `advisor` fragst du vor jeder Entscheidung zu Datenmodell, Migrationen, RLS und Rollen, Preis- und Gebührenlogik, Edge Functions mit Vertrauensbedarf und Auth, außerdem, wenn ein Fehler nach 2 Runden rot bleibt. Gib ihm eine kurze Frage mit den betroffenen Dateien, nicht die ganze Session. Seine Entscheidung gilt; weichst du ab, sag mir warum. Für UI, Texte und Routinearbeit fragst du ihn nicht.
- Jede Delegation hat eine schriftliche Spec: Ziel, Dateien, Akzeptanzkriterien, auszuführende Tests, passende Referenz-Screens.
- Wenige große Delegationen statt vieler kleiner. Nur ein editierender Agent zur selben Zeit.

## Arbeits-Loop
bauen → `test-runner` → bei UI `shots` + `reviewer` (Vergleich mit `docs/reference/design/screens/`) → fixen. Wiederholen, bis alles grün ist, höchstens 5 Runden je Screen bzw. Aufgabe. Was danach rot bleibt: in `docs/OPEN_ISSUES.md` mit Begründung, dann weiter oder Blocker einmal berichten.
- In jeder Runde: `shots` (390 px, Light und Dark). Vor dem Commit einer UI-Session einmal `shots:all`; der `reviewer` prüft die übrigen Größen auf Überlauf, Abschneiden und Safe Areas.
- Jede UI-Session: Konsole ohne Fehler, Tastaturbedienung des Hauptflows als E2E-Test.
- Nachweis sind Exit-Codes und Report-Dateien in `tmp/`, nie eine Zusammenfassung allein.

## Ausgaben
- Befehlsausgaben nur bei Fehlern im Wortlaut zeigen, sonst nur „bestanden".
- Logs nie komplett lesen, nur nach Fehlern greppen.
- Dateien per Edit ändern statt komplett neu ausgeben.

## Feste Regeln

### Geld
- Beträge als Integer-Cent in DB und API. Rechnen wie der Prototyp, erst am Ende auf Cent runden (wie `cents()` dort).
- Den gespeicherten Preis berechnet der Server (Edge Function `quote`) aus `price_config`. Die App nutzt dasselbe Modul (`@pricing`) nur für die Vorschau. Gespeichert wird ein Snapshot mit `price_version`.
- Plattformgebühr wie `platform()` im Prototyp: fee = round(total × 0,15); netto = round(fee / 1,2); USt. = fee − netto; Partner = total − fee.
- Kunden können die Gebühr weder sehen noch per API lesen. Die Gebührenaufteilung liegt in einer eigenen Tabelle (`fee_splits`), der Gebührensatz in einer eigenen Einstellungstabelle, nicht in der öffentlich lesbaren `price_config`. Die Aufteilung lesen nur der betroffene Vermieter und admin, den Satz nur Vermieter und admin (später auch Partner). Beides per RLS-Test abgesichert.
- Die Gebührenfunktion bekommt den Satz als Parameter. Im App-Code steht kein fester 15-%-Wert. Kundenpreise brauchen den Satz nicht, weil die Gebühr im Gesamtpreis enthalten ist.
- Angezeigt wird die Gebühr nur in der Vermieter-Abrechnung und später auf der Rechnung (und in der Auszahlungsübersicht des Partner-Portals, sobald es freigegeben ist). Die `feeHTML`-Hinweise des Prototyps werden nicht übernommen.
- Kaution und Kraftstoff sind nie Teil der Berechnungsbasis.
- Keine erfundenen Preise, Partner, Bewertungen oder Verfügbarkeiten. Beispieldaten aus der Design-Referenz kommen nicht in die App.

### Daten und Sicherheit
- RLS auf jeder Tabelle. Kein `using (true)` auf personenbezogenen Daten. Views mit `security_invoker = true`. SECURITY-DEFINER-Funktionen mit festem `search_path`.
- Neue Supabase-Schlüssel (publishable / secret). Der Secret-Key nur in Edge Functions, nie in der App, nie in Logs. In der App nur Variablen mit `NEXT_PUBLIC_`-Präfix (Vite `envPrefix`), und davon nur URL und Publishable Key.
- `.env*` (außer `.env.example`) nie lesen, ausgeben oder committen, auch nicht über Skripte, `node -e` oder andere Umwege. Werte gehen nur über dotenv-cli an Befehle. Ein blockierter Tool-Aufruf ist endgültig.
- Kunden setzen nur die Status „angefragt" (beim Absenden) und „zurückgezogen". Alle anderen Status setzt in dieser Phase nur admin.
- Für später (Partner-Portal): Partner sehen vor Annahme ihres Angebots nur PLZ/Bezirk, Umfang und Fotos. Keine Hausnummer, kein Name, keine Kontaktdaten.
- Fotos: privater Bucket, signierte URLs, höchstens 8 Bilder à 10 MB, EXIF-Daten (Standort) vor dem Upload entfernen.
- Seed-Daten nur in `supabase/seed.sql`, nie in Migrationen.
- Integrationstests gegen Supabase laufen sequenziell und gepaced (Auth-Rate-Limits).
- Keine Google Fonts oder andere Drittanbieter-Fonts vom CDN (DSGVO). Inter als Fallback, falls nötig, selbst hosten.

### Karten
- Geocoding und Routing nur über die Edge Function `route` (Adapter, Anbieter austauschbar, Ergebnisse gecacht, Rate-Limit). Keine direkten Aufrufe öffentlicher OSM-Demo-Dienste aus der App.
- Wiener Stadtgrenze als PostGIS-Geometrie in der DB. Kilometer außerhalb Wiens per Geometrie-Schnitt.
- Einwilligung vor der Adressübermittlung und Bestätigung der gefundenen Adresse wie im Prototyp. Keine geschätzten Kilometer ohne berechnete Route.
- OpenStreetMap-Attribution sichtbar.

### UI
- Deutsch (de-AT), per Du, kurz und ruhig. Beträge `de-AT` EUR mit `tabular-nums`, formatiert über `Intl.NumberFormat`.
- Beträge brechen nie um: Zahl und € bleiben in einer Zeile (`white-space: nowrap`), lange Beschreibungen umbrechen stattdessen. Die Referenz zeigt solche Umbrüche in 05 („354,00 €") und 14 („689,61 €"); diesen Fehler nicht übernehmen.
- Kein Gerätemockup, keine Intro-Spalte, keine „Prototyp"/„Konzeptdemo"-Texte.
- Tab-Bar: Start · Miete · Aufträge · Profil. In Buchungsflows ausgeblendet, dort die fixierte Aktionsleiste.
- Icons und Illustrationen aus der Referenz als SVG-Komponenten, Pfade unverändert. Icons über `currentColor` und Tokens. Illustrationen in den natürlichen Materialfarben der Palette `illustration` aus `tokens.json`, Teal nur als Marken-Akzent, Dark-Varianten aus `02_Start_Dark.html`. Keine Emojis, keine Rasterbilder, wo Vektor reicht.
- Kein Hinweis auf „15 %", „Plattformgebühr", „Provision" oder „MoveNow-Gebühr" in Kunden-Screens.
- Für Zustände ohne Referenz-Screen: im selben Stil ergänzen, `frontend-design`-Skill nutzen, falls installiert.
- Touch-Ziele ≥ 44 px, Fokus sichtbar, jedes Feld mit Label, Kontrast AA, `prefers-reduced-motion` (dann nur Fades).
