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

(je Eintrag: Commit, Test, Ergebnis)
