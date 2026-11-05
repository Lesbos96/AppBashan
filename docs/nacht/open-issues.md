# Nacht 05.11.2026 · Aufgabe „OPEN_ISSUES abarbeiten“ (nur `src/`, Tests, Doku)

Branch `nacht-open-issues` (von `main` 1630668), Draft-PR gegen `main`. Gemeinsamer Start (Dokumente, Umgebungsvariablen, Modell, Kontext): `docs/nacht/audit.md` auf Branch `nacht-audit`.

## Entscheidungen

| Nr. | Entscheidung | Begründung |
|---|---|---|
| O1 | Nur Einträge, die ohne Migration, Edge Function, Datenbank, Rechte/RLS und ohne S9b-Bezug lösbar sind. | Auftrag. |
| O2 | Einträge mit Gestaltungs- oder Produktfrage (welcher Text, welches Bedienkonzept, wann ein Hinweis „nötig“ ist) setze ich nicht um, sondern stelle sie als Frage. | Auftrag: „Bei Unsicherheit … nicht ändern“. |
| O3 | Je Eintrag ein Commit mit Code und Test; der Eintrag in `docs/OPEN_ISSUES.md` bekommt „erledigt in <hash> (Nacht 05.11., ungeprüft)“ in einem eigenen Doku-Commit direkt danach. | Der Hash steht erst nach dem Commit fest. |
| O4 | Die neuen Funde des Audits (`docs/AUDIT_NACHT.md` auf `nacht-audit`, z. B. Einwilligung im Termin, Abmelden mit Fotos) gehören nicht zu dieser Aufgabe, weil sie keine `OPEN_ISSUES`-Einträge sind. | Auftrag nennt nur Einträge aus `OPEN_ISSUES.md`. |

## Phase 1 · Passende Einträge (erst mittel, dann niedrig)

Zeilen beziehen sich auf `docs/OPEN_ISSUES.md` im Stand `main` 1630668.

### Mittel

| # | Zeile | Eintrag | Entscheidung |
|---|---|---|---|
| 1 | `:105`, `:132` | Plan-M-1: Hinweis „Vorher angezeigt“ in `Gesendet.tsx` vergleicht den Mittelwert (`shownKey`) mit „X bis Y“ und erscheint bei jeder Entrümpelungs-Spanne zu Unrecht | umsetzen: `Sent` trägt den vollen `Shown`, Vergleich über dieselbe Anzeige (`shownLabel`), `shownKey`/`readShown` entfallen |
| 2 | `:100`, `:103` | Tab „Miete“ in der Tab-Bar (Phase 1: Start · Aufträge · Profil) | umsetzen (Regel in `CLAUDE.md` eindeutig); Startkarte und Profilzeile bleiben (Frage im Audit, M-6) |
| 3 | `:107` (5) | Shot-Mock `gesendet-umzug` zeigt „Wartet auf Angebot“ mit Festpreis | umsetzen (nur Test-Fixture) |
| 4 | `:107` (1) | Hinweis „Die Abholung muss in Wien liegen …“ steht immer | **überspringen, Frage:** wann ist er „nötig“? Die App kennt den Abholbezirk nicht (prüft nur `quote`) |
| 5 | `:107` (2) | 409-Karten mit zwei Sendeknöpfen; Sheet statt Karte | **überspringen:** Bedienkonzept, Designentscheidung |
| 6 | `:107` (4) | Hinweis „Vorher angezeigt“ auch bei „Preis nach Prüfung“ | **überspringen, Frage:** widerspricht dem Code-Kommentar in `Gesendet.tsx:19` („auch zu ‚Angebot nötig‘ … nie still“) |
| 7 | `:107` (3), `:106`, `:137`, `:186` (1) | Disabled-Knöpfe, „Wird gesendet …“, „Erneut senden in 59 s“ unter AA | zurückgestellt: Token-Änderung mit Kontrastmessung, Shots und Reviewer; nur wenn am Ende Zeit bleibt |
| 8 | `:107` (6), `:195`, `:206` | Leisten bei 1280 px breiter als die Spalte | **überspringen:** laut `:213` für die Aktionsleiste behoben, für die Tab-Bar nur per Messung zu klären |
| 9 | `:104` | Umzug-Zusammenfassung gegen Referenz 11 (A/B-Marker, Abschnitt Zusatzleistungen, Texte) | **überspringen:** Abgleich mit Referenz-Screens und SVG-Übernahme, eigene UI-Session |
| 10 | `:186` (2) | `anmelden-link-abgelaufen`: Anleitung „Tippe auf Anmelden …“ neben dem Fehler | prüfen und umsetzen, wenn der Text nur im Fehlerzustand ersetzt werden muss |
| 11 | `:195` | Umzug-Icon `package` statt Kartons | **veraltet:** `Auftraege.tsx:15` und `Gesendet.tsx:10` nutzen `boxes` |

### Niedrig

| # | Zeile | Eintrag | Entscheidung |
|---|---|---|---|
| 12 | `:105`, `:132` | A-N1: `Confirmed.shown` in `quote.ts` streichen | umsetzen |
| 13 | `:224` | A4c-N1: „Anderes Konto“ während des Sendens bedienbar | umsetzen |
| 14 | `:225` | A4c-N2: Staging-Pfad erst nach Erfolg gemerkt | umsetzen |
| 15 | `:162` | Länge von `description`/`label` und Größe von `geometry` beim Laden aus dem sessionStorage nicht begrenzt | umsetzen |
| 16 | `:194` | F5: `restoreDraft` übernimmt Entwurfsschlüssel aller Services | umsetzen |
| 17 | `:104`, `:108`, `:213` | „4,8 km · innerhalb Wiens“ bricht bei 390/430 px um | umsetzen (Zahl und Einheit zusammenhalten) |
| 18 | `:105`, `:114`, `:132` | N-2: Preisversion nach angenommenem 409 nur im State | umsetzen, falls ohne Umbau der Zusammenfassung möglich |
| 19 | `:186` (3) | `anmelden-zu-viele`: Knopf bleibt aktiv | prüfen |
| 20 | `:227` | A4c-N4: zwei E2E-Fälle in `fotos.spec.ts` | optional am Ende |
| 21 | `:143`, `:148`, `:162` | Farben im Code als Tokens | **überspringen:** „bei Gelegenheit“, Optik-Änderung mit Shots |
| 22 | `:151`, `:153`, `:27`, `:189`, `:164`, `:168` | „bei Bedarf“ bzw. „wenn sich das zeigt“ | **überspringen:** laut Eintrag bewusst offen |
| 23 | `:116` R2-N5 | Preis fehlt erst beim Senden → Termin statt Preis-Schritt | **überspringen:** laut Eintrag praktisch nicht erreichbar |

### Übersprungen wegen Datenbank, Rechten, S9b, Betrieb oder Recht

`:6`–`:10`, `:14`–`:37` (Betrieb, ORS, SMTP, Seeds, Function-Auflagen), `:39`–`:95` (Konzept-, Plan- und Abnahme-Findings S9a/S9b zu Migrationen, Rot-Beweisen, Rollen), `:98`–`:99`, `:113`–`:126`, `:128`–`:140` (soweit DB, Rot-Beweis, Redproof, Live-Probe), `:179`–`:185` (Dashboard, Captcha, Capacitor), `:202`–`:222` (Fotos/Aufräumen in der DB, Rechte), `:233`–`:251` (S9b), `:254` (Rechtsfrage). Begründung: Auftrag O1.

## Verlauf

| # | Eintrag | Code-Commit | Doku-Commit | Test (Phase 3) | Ergebnis |
|---|---|---|---|---|---|
| 1 | Plan-M-1 „Vorher angezeigt“ bei Spannen | fc30353 | 15e7d15 | `tests/unit/gesendet.test.ts` (6, Server-Rendering der Bestätigung) | **Rot vorher gemessen:** derselbe Fall auf dem alten Code (alte Schnittstelle `rememberShown(path, totalCents, shown)`, `shownCents: readShown`) zeigte den Hinweis bei gleicher Spanne, `tmp/proof/nacht-oi-1-rot.log` EXIT=1; danach grün. `Sent.shown` ersetzt `shownCents`; `shownKey`/`readShown` entfallen; `rememberShown(path, shown)`. Angepasst: `draft.test.ts`, Shot-Fixture `gesendet-preis-aktualisiert`. Hinweis bei Angebot nach Preis-Vorschau bleibt (siehe Frage 2). |
| 2 | Tab „Miete“ | 96f51ea, 13282fa | 17c77bc, 7fa3bc2 | E2E `shell.spec.ts:34` (drei Tabs, per `boundingBox()` gleich breit, letzter Tab am rechten Rand) | E2E-Lauf b: Tab-Test grün (vor 13282fa). Reviewer-Runde 390 (`tmp/proof/nacht-oi-shots-runde-a.md`) fand „hoch“: `TabBar` hatte fest `grid-cols-4`, rechts blieb ein Viertel leer → 13282fa (`repeat(n, 1fr)`). Danach: E2E mit `boundingBox()`-Messung grün, Shots 390/430/1280 hell/dunkel neu, Reviewer-Runde b ohne Findings (`tmp/proof/nacht-oi-shots-runde-b.md`). |
| 3 | Shot-Mock `gesendet-umzug` | ee47792 | 17c77bc | Shot-Test prüft „Angefragt“ | Shots 390/430/1280 hell/dunkel EXIT=0 (`nacht-oi-shots-b.log`, `-c.log`); Reviewer: Status-Chip „Angefragt“ korrekt. |
| 16 | F5 `restoreDraft` nur für den eigenen Service | b077005 | 7fa3bc2 | `draft.test.ts`: zwei neue Fälle; der 20.000-Zeichen-Test trägt jetzt einen Pfad, damit er weiter die Grenze prüft | Rot auf altem Code abgeleitet (alter Code ließ die Schlüssel aller Services zu), nicht gemessen. |
| 12 | A-N1 `Confirmed.shown` | c891a92 | def3f2d | `draft.test.ts`: ein `shown` im Bestätigten wird ignoriert | `buildBody` liest nur `readShownFull`. |
| 14 | A4c-N2 Staging „versucht“ | 2464690 | 014a7d7 | `uploads.test.ts`: zwei Fälle mit verlorener Antwort | Auf altem Code hätte der Ref-Wechsel nur `[P1]` entfernt (abgeleitet). |
| 13 | A4c-N1 „Anderes Konto“ beim Senden | ed2fb72 | 014a7d7 | E2E `anfrage.spec.ts` „Während des Sendens ist ‚Anderes Konto‘ gesperrt“ | **E2E hier nicht lauffähig** (braucht Tarife vom Dev-Projekt, siehe unten). Code: `if (busy.current) return` und `disabled={sending}`. |
| 15 | Grenzen beim Laden (`:162`) | 4b6f80f | e200abc | `tests/unit/flow-limits.test.ts` (Grenzwert und +1) | Beschreibung ≤ 500, Label ≤ 200 (wie `parse.ts`), Routenlinie ≤ 50.000 Punkte (eigene Wahl: großzügig über Wien–Graz mit rund 2.100 Punkten). |
| 17 | „4,8 km · innerhalb Wiens“ | b301fa0 | f9220a5 | `tests/unit/route-text.test.ts` | Ein Helfer `routeText` statt zweier gleicher Ausdrücke (Termin, Zusammenfassung). Shot steht aus (Screens brauchen Tarife). |
| 10 | `anmelden-link-abgelaufen` | – | – | – | **veraltet:** `Anmelden.tsx:168` blendet die Anleitung im Fehlerzustand schon aus. |
| 19 | `anmelden-zu-viele`: Knopf aktiv | – | – | – | **übersprungen, Frage 4** (wie lange sperren?). |
| 18 | N-2 Preisversion nach 409 | – | – | – | **übersprungen:** braucht einen gespeicherten Versionsstand neben `shown` und eine Regel für das Neuladen in der Zusammenfassung; laut Eintrag „nur UX“, Umbau größer als der Nutzen in einer unbeaufsichtigten Nacht. |

### Prüfläufe und Umgebung

- `npm run check` (Stand ee47792): EXIT=0, 374 Unit-Tests (`tmp/proof/nacht-oi-check-a.log`). Weitere Einzelläufe je Eintrag in `tmp/proof/nacht-oi-*.log`, alle EXIT=0.
- **E2E in dieser Umgebung nur eingeschränkt:** (1) Die Projekt-Version von Playwright erwartet einen Headless-Build, der hier fehlt; gelaufen wird mit einer temporären Konfiguration `tmp/pw-night.config.ts` (nicht im Repo), die nur den Browserpfad auf das vorinstallierte Chromium setzt. (2) Die E2E laden Tarife vom echten Dev-Projekt (`anonymousPrices` leitet weiter); ohne Schlüssel läuft die App mit einer Dummy-URL, alle preisabhängigen Tests laufen in Timeouts. Lauf b (Stand ee47792): 29 grün, 73 rot; die roten Tests hängen alle am Laden der Tarife oder an Konsolenfehlern dieses Ladens. Der Vergleichslauf auf `main` mit derselben Umgebung steht unten.
- **Vergleichslauf `main`** (gleiche Umgebung, `tmp/proof/nacht-main-e2e.log` in der Arbeitskopie von `main`): 29 grün, 73 rot, EXIT=1 – dieselben 73 Titel wie auf dem Branch (Lauf b). Die roten E2E liegen also an der Umgebung (Tarife), nicht an den Änderungen.
- **Abschlusslauf (Stand 093bc2c + 20087f6):** `npm run check` EXIT=0, 385 Unit-Tests (`nacht-oi-check-final.log`); Shots `start`, `miete`, `gesendet-umzug`, `gesendet-preis-aktualisiert` bei 390/430/1280 hell/dunkel EXIT=0, 24/24 (`nacht-oi-shots-final.log`); E2E EXIT=1, 29 grün / 74 rot (`nacht-oi-e2e-final.log`) = die 73 von `main` plus der neue A4c-N1-Test, der am selben Tarif-Schritt hängt (`dienste-helpers.ts:25`, wartet auf die Küchen-Auswahl). „Tab-Bar erreicht alle Tabs“ mit Messung grün. Kein Test, der auf `main` grün ist, ist hier rot.
- Nachdurchgang: Reviewer-Abnahme des Diffs (`tmp/proof/nacht-oi-review.md`): kein hoch/mittel; ein niedriger Punkt behoben (20087f6: der `discardStaging`-Test war auch auf altem Code grün). Bewusst belassen: ein Rest `movenow.shown.<path>` aus Sitzungen vor dem Update bleibt bis zum Tab-Ende (wird nicht mehr gelesen); der `busy`-Guard in `otherAccount` ist nur über den gesperrten Knopf getestet.
- Shots nur für Screens ohne Tarife möglich: `start`, `miete`, `gesendet-umzug`, `gesendet-preis-aktualisiert` bei 390/430/1280 hell/dunkel, EXIT=0; `gesendet-preis` braucht Tarife (rot).

## Fragen an Beks

1. Die E2E brauchen das echte Dev-Projekt für die Tarife. Sollen sie die Tarife künftig mocken (wie `quote`), damit sie ohne Schlüssel laufen?
2. `:107` (4): Soll der Hinweis „Vorher angezeigt“ auch erscheinen, wenn der Server ein Angebot statt des gezeigten Preises liefert? Der Code sagt bewusst „nie still“, der Reviewer wollte ihn nur bei neuem Richtpreis.
3. `:107` (1): Wann ist der Hinweis „Die Abholung muss in Wien liegen …“ nötig? Die App kennt den Abholbezirk nicht.
4. `:186` (3): Soll „Code senden“ nach „Zu viele Versuche“ für eine feste Zeit gesperrt werden, und wie lange?
5. Zusammenführen mit `nacht-testabdeckung`: Dort prüfen `draft-extra.test.ts` und `screens.test.ts` noch `Sent.shownCents` (hier durch `Sent.shown` ersetzt) und `flow.ts` ändert sich auf beiden Branches (dort `whole()`, hier Längengrenzen). Reihenfolge-Vorschlag: zuerst `nacht-testabdeckung`, dann diesen Branch und die beiden Testdateien auf `shown` umstellen.
