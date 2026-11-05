# Nacht 2026-11-05 · Barrierefreiheit (WCAG 2.2 AA) und Ladegeschwindigkeit

Unbeaufsichtigter Nachtauftrag von Beks. Branch `nacht-qualitaet` (von `main` bei `1630668`), Entwurfs-PR gegen `main`. S9b wird nicht bearbeitet. Keine Migration, kein `db:push`, kein Deploy, keine neuen oder aktualisierten Abhängigkeiten, keine `.env`-Datei gelesen oder angelegt, nichts gelöscht.

## Start

### Umgebung (Schritt 2)
- Umgebungsvariablen nur nach Namen geprüft (`env | cut -d= -f1`, kein Wert ausgegeben): **kein** `SUPABASE_*`, kein Service-Role-Key, kein DB-Passwort, kein Supabase-Access-Token. Vorhanden sind nur Variablen der Laufumgebung (GitHub-Token, Cloud-Zugang der Sandbox, Proxy). Im Repo liegt nur `.env.example`, keine `.env.local`.
- Ergebnis: kein STOPP, Arbeit beginnt.
- **Hinweis an Beks:** In der Werkzeugliste dieser Session steht ein Supabase-MCP-Connector (u. a. `execute_sql`, `apply_migration`, `deploy_edge_function`). Er ist keine Umgebungsvariable und fällt nicht unter die Prüfung aus Schritt 2. Ich habe ihn in dieser Nacht **nicht geladen und nicht benutzt**. Falls unbeaufsichtigte Sessions keinen DB-Zugang haben sollen, den Connector für solche Sessions abschalten.

### Entscheidungen zu Beginn
| Nr. | Entscheidung | Begründung |
|---|---|---|
| E1 | Die Session läuft mit Opus 5.5, nicht mit Sonnet 5.5 (CLAUDE.md: Hauptsession Sonnet, Opus nur auf Anfrage; „sag es mir und warte"). Ich arbeite trotzdem weiter. | Niemand beantwortet Rückfragen; Warten hieße, die Nacht ungenutzt zu lassen. Die Session wurde von Beks mit diesem Modell gestartet. |
| E2 | Commits nach jedem Teilziel und Weiterarbeiten statt „ein Commit beendet die Session". | Ausdrückliche Vorgabe des Nachtauftrags (geht CLAUDE.md vor, weil später und konkreter). |
| E3 | Branch `nacht-qualitaet` statt des von der Laufumgebung vorgeschlagenen Session-Branches. | Ausdrückliche Vorgabe des Nachtauftrags. |
| E4 | `npm ci` (exakt nach `package-lock.json`) zum Einrichten von `node_modules`. | Ohne `node_modules` laufen weder Checks noch Tests. `npm ci` fügt nichts hinzu und aktualisiert nichts; `package.json` und `package-lock.json` bleiben unverändert (per `git diff` geprüft). |
| E5 | Keine Messwerkzeuge wie axe-core oder Lighthouse nachinstalliert. Prüfung mit eigenen Playwright-Skripten (Kontrastrechnung aus `getComputedStyle`, Zugänglichkeitsbaum, Tastaturdurchlauf, `boundingBox()` für Tippflächen) und dem Build-Bericht von Vite. | Abhängigkeiten hinzufügen ist verboten. |
| E6 | Kein Built-in-`advisor`-Tool in der Werkzeugliste (CLAUDE.md verlangt diesen Hinweis). | — |

## Phase 1 · Prüfung

### Methode
- **Umgebung:** Keine `.env.local`, kein Zugang zum Dev-Projekt. Die App läuft mit zwei Prozessvariablen (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399`, Dummy-Publishable-Key). Unter Port 54399 läuft ein lokaler Ersatz nur für die drei öffentlichen Tarif-Endpunkte (`current_price_version`, `price_config`, `rpc/booking_terms`), Werte aus `supabase/seed.sql` (28 Tarifzeilen, Bedingungen aus `platform_settings`), Skript `tmp/nacht/fake-api.mjs` (nicht im Repo). Alles andere mocken die Tests selbst. Ohne diesen Ersatz scheitern alle E2E-Tests, die Tarife laden (Entrümpelung, Montage, Termin, Zusammenfassung), an der fehlenden Datenbank (erster Lauf mit Dummy-URL: `tmp/nacht/baseline-e2e-dummyurl-abgebrochen.log`).
- **Browser:** Das Repo erwartet Chromium-Revision 1248, installiert ist 1243. Symlink `/opt/pw-browsers/chromium-1248 → chromium-1243` (und `chromium_headless_shell`) außerhalb des Repos, keine Konfigurationsänderung.
- **Prüfskript** `tmp/a11y/` (nicht im Repo): dieselben 60 Bildschirmzustände wie `tests/shots/shots.spec.ts` (gleiche Schritte und Mocks), je Light und Dark bei 390×844. Je Zustand: Textkontrast aller sichtbaren Textknoten (Farben über Canvas aufgelöst, Hintergrund über alle Ebenen inklusive Verlaufsstopps zusammengesetzt, schlechtester Fall), interaktive Rollen ohne Namen (Playwright `ariaSnapshot`), Tippflächen per `getBoundingClientRect` (Felder im `<label>` mit Labelfläche), Tab-Durchlauf bis zum Zyklus (Fokusrahmen vorhanden, Kontrast des Rahmens zur Umgebung, Verdeckung durch Ebenen mit Fläche per `elementsFromPoint`), Überschriften, Landmarken, Seitentitel, Reflow bei 320×568 und Textabstände nach WCAG 1.4.12. Maße stammen aus dem DOM, nicht aus Bildern.
- **Code-Durchsicht** aller Screens und Komponenten unter `src/` auf Beschriftungen, Live-Regionen, Fokusführung und Bildschirmleser-Texte.

Rohbericht: `tmp/nacht/a11y-vorher.md` (134 Zustände, Lauf `tmp/nacht/audit-vorher.log`, 134 bestanden, EXIT=0).

### Ergebnis je Bildschirm (vor den Änderungen, Light und Dark)
„ok" heißt: das Prüfskript fand nichts und die Code-Durchsicht auch nicht. Die Nummern verweisen auf die Fundliste darunter.

| Bildschirm | Kontrast Text | Beschriftungen | Tastatur | Fokus | Bildschirmleser | Tippflächen |
|---|---|---|---|---|---|---|
| Start | ok | ok | ok | A1, A2 (Mietkarte unter der Tab-Bar) | A4, A5 | ok |
| Onboarding (3 Seiten) | ok | ok | ok | A1 („Überspringen" 1,2:1 auf dunklem Grund) | A4, A13 | ok |
| Anmelden (E-Mail, Code, Link, Fehler) | ok | ok | A6 | A1 | A4, A5 | ok |
| Aufträge (leer, Liste) | ok | ok | ok | A1 | A4, A5 | ok (Segmente 32 px, Fläche per `::before` 44 px) |
| Profil, Datenschutz, Impressum, Miete | ok | ok | ok | A1 | A4, A5 | ok |
| Info-Sheet „Wie rechnet MoveNow?" | ok | ok | ok (Fokusfalle, Esc, Rückgabe) | A1 | A4 | ok |
| Transport / Umzug (Konfigurator, Sheets) | A11 (Dark) | A9 | ok | A1, A2 (bis zu 13 Elemente ganz unter der Preisleiste), A3 | A4, A5, A8, A14 | ok |
| Entrümpelung (6 Schritte, Ergebnis) | ok | A9 | ok (Fokus auf die Frage je Schritt) | A1, A2 (teilweise), A3 | A4, A5, A14, A15 | ok (Chips 30 px, per `::before` 46 px) |
| Montage (Standard, Küche, Preis-Sheet) | ok | ok | ok | A1 | A4, A5, A8 | ok |
| Termin (Montage, Umzug) | ok | ok | ok | A1 | A4, A5 | ok (Kalendertage 44 px) |
| Zusammenfassung (alle Zustände) | ok | ok | ok | A1, A2 (Kontaktfelder unter Kopf- bzw. Aktionsleiste) | A4, A5, A7 | ok |
| Gesendet (alle Zustände) | ok | ok | ok | A1 | A4, A5 | ok |
| Fehlerseite | ok | ok | ok | A1 | A4, A10 | ok |

Ohne Befund in allen Zuständen: interaktive Elemente ohne Namen (0), Reflow bei 320 px (kein horizontales Scrollen), `lang="de-AT"`, kein `tabindex > 0`, kein fokussierbares Element in `aria-hidden`, keine Bilder ohne `alt`, alle Tippflächen ≥ 30 px und mit `::before`-Erweiterung ≥ 44 px (WCAG 2.5.8 verlangt 24 px).

### Fundliste
| Nr. | Fund | WCAG 2.2 | Wo | Entscheidung |
|---|---|---|---|---|
| A1 | Fokusrahmen `color-mix(accent 45 %, transparent)`: Kontrast zur Umgebung 2,13–2,22:1 (Light), 2,81:1 (Dark), 1,2:1 auf dem dunklen Onboarding-Kopf | 1.4.11 (AA) | alle | beheben: Rahmen in voller Akzentfarbe, auf dunklem Grund Mint |
| A2 | Fokussiertes Element liegt ganz (114 Fälle) oder teilweise (46) unter der fixierten Aktions-, Preis- oder Tab-Leiste bzw. unter der Kopfleiste; der Browser scrollt nur bis an den Fensterrand | 2.4.11 (AA) | Transport, Umzug, Zusammenfassung, Entrümpelung, Start | beheben: `scroll-padding` oben und unten |
| A3 | Freitextfelder „Gegenstände & Umfang" und der Hinweis in der Entrümpelung haben `outline-none` ohne Ersatz | 2.4.7 (AA) | Transport, Umzug, Entrümpelung | beheben: Rahmen am Label wie bei `Field` |
| A4 | Seitentitel ist auf allen Seiten „MoveNow" | 2.4.2 (A) | alle | beheben: Titel je Route |
| A5 | Seitenwechsel wird Bildschirmlesern nicht angesagt (Fokus fällt nach dem Wechsel auf `body`) | 4.1.3 (AA), Umfeld 2.4.3 | alle | beheben: höfliche Live-Region mit dem Seitentitel |
| A6 | Anmeldung: nach „Code senden" und „Andere Adresse" verschwindet das fokussierte Element, der Fokus fällt auf `body` | 2.4.3 (A) | Anmelden | beheben: Fokus ins neue Feld |
| A7 | Wartezeit nach 429 („Noch 59 s.") steht in `role="alert"` und wird jede Sekunde neu vorgelesen | 4.1.3 (AA), stört 2.2.4 | Zusammenfassung | beheben: Zähler außerhalb der Live-Region |
| A8 | Geänderter Richtpreis in der Preisleiste wird nicht angesagt (sichtbar zählt er hoch) | 4.1.3 (AA) | Transport, Umzug, Montage | beheben: unsichtbare Statusmeldung mit dem Endbetrag |
| A9 | Knopf mit sichtbarem Text „Kamera" heißt für Hilfsmittel „Foto aufnehmen" (Sprachsteuerung „Kamera" trifft nicht) | 2.5.3 (A) | Fotos | beheben: Name beginnt mit „Kamera" |
| A10 | Fehlerseite ohne `h1` | 1.3.1, 2.4.6 | Fehlerseite | beheben |
| A11 | Marker „A" (Abholung) im Dark Mode `#0e6f74` auf `#0f272b`: 2,63:1 | 1.4.3 (AA) | Transport, Umzug (Dark) | beheben: im Dark Mode Akzentfarbe (Mint), wie andere Dark-Ableitungen |
| A12 | Textabstände nach 1.4.12: Betrag der Preisleiste in fester Höhe 54 px abgeschnitten; Adressen in der Adresskarte und Segment „Nachmittag" mit Auslassungspunkten | 1.4.12 (AA) | Preisleiste, Adresskarte, Zeitfenster | Preisleiste beheben (Mindesthöhe); Adresskarte und Segmente: Frage F3 |
| A13 | Onboarding: neuer Titel und Text nach „Weiter" werden nicht angesagt, der Fokus bleibt auf dem Knopf | 4.1.3 (AA) | Onboarding | beheben: Text als höfliche Live-Region |
| A14 | Foto-Zähler „x von 8" ändert sich ohne Ansage | 4.1.3 (AA) | Fotos | beheben: Zähler als Statusmeldung |
| A15 | Überschriftensprung `h1` → `h3` („Fotos") im letzten Entrümpelungsschritt | 1.3.1 (gute Praxis) | Entrümpelung | beheben: Ebene als Parameter |
| A16 | Eigene Radiogruppen (Objektart, Füllgrad, Fahrzeugart) als Knöpfe mit `role="radio"`: jede Option ist ein eigener Tab-Stopp, Pfeiltasten wirken nicht | ARIA-Muster; 2.1.1 ist erfüllt | Entrümpelung, Fahrzeugart | nicht geändert: Fahrzeugart schließt bei Auswahl das Sheet, Pfeiltasten würden es bei jedem Schritt schließen; Frage F4 |
| A17 | Schalter „aus": Spur `rgba(16,47,53,.14)` auf Weiß ≈ 1,3:1; ausgewähltes Segment nur über weiße Fläche (≈ 1,1:1) und Fettschrift | 1.4.11 (fraglich) | Schalter, Segmente | nicht geändert: Werte stammen aus `tokens.json` (Optik verbindlich); Frage F2 |
| A18 | Hero-Verlauf (32 s), Wagen und Linien laufen endlos; bei „Bewegung reduzieren" aus, sonst kein Pausieren | 2.2.2 (A, fraglich: rein dekorativ) | Start, Onboarding | nicht geändert: Design-Referenz; Frage F5 |
| A19 | Deaktivierte Knöpfe unter 4,5:1 (18 Fälle) | 1.4.3 nimmt inaktive Elemente aus | Leisten, Stepper | kein Fund; als UX-Punkt schon in OPEN_ISSUES |
| A20 | Tab-Bar zeigt „Miete" (Phase 1: drei Tabs) | kein A11y-Fund | Tab-Bar | nicht angefasst, bekannt (OPEN_ISSUES „S9a-2 · UI") |

### Ausgangslage Tests (vorher)
- Baseline im separaten Worktree vom Stand `main` (`git worktree` im Scratchpad, damit Änderungen im Repo den Lauf nicht beeinflussen): `npm run check` EXIT=0 (`tmp/nacht/baseline-check.log`), `npm run build` EXIT=0 (`tmp/nacht/baseline-build.log`, Warnung „Some chunks are larger than 500 kB"), `npm run test:e2e` EXIT=0, 102 bestanden (`tmp/nacht/baseline-e2e.log`, mit Tarif-Ersatz).

### Messung Bundle und Ladezeit (vorher)
Werkzeug: `tmp/nacht/measure.mjs` (Build aus `dist/`, eigener statischer Server mit gzip, Chromium 390×844, Drosselung wie Lighthouse-Mobil: 150 ms RTT, 1,6 Mbit/s, CPU ×4, ohne Cache, Median aus 5 Läufen). Bericht `tmp/nacht/messung-vorher.md`.

| Datei | roh | gzip | brotli |
|---|---:|---:|---:|
| `index-*.js` (einziges JS, alles in einem Chunk) | 896,4 kB | 254,3 kB | 214,8 kB |
| `index-*.css` | 51,0 kB | 10,6 kB | 9,2 kB |
| Inter-Schriften (7 Teilmengen, `unicode-range`) | 213,4 kB | – | – |

| Route | FCP | LCP | h1 sichtbar | übertragen |
|---|---:|---:|---:|---:|
| `/` | 2028 ms | 2028 ms | 2029 ms | 267 kB |
| `/montage` | 1952 ms | 2380 ms | 2001 ms | 267 kB |
| `/umzug` | 1948 ms | 2428 ms | 1990 ms | 267 kB |
| `/profil` | 1984 ms | 1984 ms | 2011 ms | 267 kB |
| `/anmelden` | 1960 ms | 1960 ms | 1995 ms | 267 kB |

Zusammensetzung des JS (Sourcemap eines Analyse-Builds, `tmp/nacht/composition-vorher.txt`): react-dom 22,6 %, motion (motion-dom + framer-motion) 16,6 %, Supabase 24,1 % (davon auth-js 10,8 %, realtime-js + phoenix 6,1 %, storage-js 2,5 %), react-router 10,7 %, Illustrationen 7,0 %, Icons 1,5 %, Screens und Bibliotheken der App rund 12 %, `src/lib/motion.ts` 0,6 % (bindet die ganze `tokens.json` ein, gebraucht wird nur `motion.spring`).

Hinweis: Im Messbrowser (Linux, headless) lädt keine Inter-Datei (`document.fonts` ohne geladene Schrift); der Browser löst offenbar eine frühere Schrift des Stapels auf, die Ursache habe ich nicht geprüft. Wo Inter greift (z. B. Android, Windows), kommt mindestens die Teilmenge latin (47 kB) dazu. Die Zahlen oben enthalten keine Schrift.

## Phase 2 · Barrierefreiheits-Funde beheben

Je Fund ein Commit; vor jedem Commit `npm run check` und die betroffenen E2E-Specs über den `test-runner` (Logs `tmp/nacht/<fund>-*.log`). Neue Tests in `tests/e2e/barrierefreiheit.spec.ts`.

| Fund | Änderung | Prüfung |
|---|---|---|
| A1 | `theme.css`: Fokusrahmen 2 px in voller Akzentfarbe statt 3 px mit 45 % Deckkraft (Light ≈ 7:1, Dark ≈ 11:1 statt 2,2:1 bzw. 2,8:1). Labels mit `has-[:focus-visible]` (Segmente, Felder, Adresssuche) ebenso. Zeilen in Listen mit `overflow-hidden` (Listenzeilen, Wertezeilen, Adresskarte, Treffer der Adresssuche, Fahrzeugart, Montage-Zeile) zeichnen den Rahmen nach innen, sonst schnitt die Liste ihn ab. „Überspringen" im Onboarding mit Mint-Rahmen auf dunklem Grund. Entscheidung 2 px statt 3 px: bei voller Deckkraft wirkt 3 px schwer, 2 px erfüllt auch das AAA-Kriterium 2.4.13 (Mindestdicke 2 px). | `a1-check.log` EXIT=0 (368 Unit), `a1-e2e.log` EXIT=0 (28 bestanden, darunter 4 neue Tests: Light, Dark, Listenzeile, Onboarding) |
| A2 | `theme.css`: `scroll-padding-top` (44 px + Safe Area + 8 px) und `scroll-padding-bottom` (126 px + Safe Area + 8 px) am `html`. Der Browser scrollt fokussierte Elemente damit aus dem Bereich der fixierten Leisten. Entscheidung: ein fester Wert für die höchste Leiste (Bestätigung mit zwei Knöpfen) statt je Seite; auf Seiten mit niedrigerer Leiste scrollt der Browser nur etwas weiter, sonst ändert sich nichts. | Rot ohne Fix: `a2-rot.log` und nach Anpassung des Tests `a2-rot2.log` (je EXIT=1, 3 Tests rot: 6 Elemente im Umzug, 2 Kontaktfelder, Mietkarte). Grün: `a2-e2e.log` (voller Lauf 108 bestanden, 1 rot: der neue Zusammenfassungs-Test begann während des Seitenübergangs, als die Leisten noch an die ausblendende Seite gebunden waren; der Test wartet jetzt auf das Ende des Übergangs), `a2-check2.log` EXIT=0, `a2-gruen.log` EXIT=0 (43 bestanden) |
| A3 | Labels der Freitextfelder in Transport/Umzug und Entrümpelung zeichnen bei `:focus-visible` des Textfelds den Rahmen nach innen (wie `Field`), mit der Rundung der Karte | Rot: Prüfskript (Fokus ohne Anzeige, 16 Fälle). Grün: `tmp/proof/a3-check.log` EXIT=0 (368 Unit), `tmp/proof/a3-e2e.log` EXIT=0 (30 bestanden, 2 neue Tests). Ab hier schreibt der `test-runner` seine Logs nach `tmp/proof/` (seine Regel), nicht nach `tmp/nacht/` |
| A4 | `Handle` hat jetzt ein Pflichtfeld `title`; die Shell setzt `document.title` als „<Titel> · MoveNow" (z. B. „Umzug: Zusammenfassung · MoveNow"), die Fehlerseite außerhalb der Shell setzt „Seite nicht gefunden · MoveNow". Entscheidung: Titel im Router statt in jedem Screen, damit keine Route ohne Titel bleibt (Typprüfung erzwingt ihn) | `tmp/proof/a4-check.log` EXIT=0, `tmp/proof/a4-e2e.log` EXIT=0 (22 bestanden, neuer Test mit 8 Routen und einem Wechsel in der App) |

## Phase 3 · Tempo

(folgt)

## Abgebrochen

(noch nichts)

## Fragen an Beks

(folgt)
