# S9a-3 · Nachweise

Alle Dateien sind byte-genau aus `tmp/proof/` kopiert und danach nicht verändert. Hinweise, die in einer Nachweisdatei nicht stehen können, stehen hier.

## Dateien
| Datei | Inhalt |
|---|---|
| `s9a3-abnahme.md` | Abnahme des Beraters (`advisor-report`), Runde 2, letzte Zeile „Offene Findings hoch: N“ |
| `s9a3-plan.md` | Plan-Abnahme vor dem Bau (3 hoch, in 0019 und Code eingearbeitet) |
| `s9a3-rotbeweis.md` | Finaler Rot-Beweis, Log `s9a3-rot-final.log` (Exit 0, 31 von 31) |
| `s9a3-0d.md`, `s9a3-0d-db.txt` | Punkt 0d: Abgleich mit dem S9a-3-Auftrag, lesende DB-Belege (mit Abfragetext und Exit 0) |
| `s9a3-shots.md` | Shot-Tabelle Runde 1 (Reviewer 390/430/1280 über alle betroffenen Screens) |
| `s9a3-shots-runde2.md` | Shot-Tabelle Runde 2 nach der Preiskarte (Zusammenfassung, kein „hoch“) |
| `s9a3-check.log`, `s9a3-rls.log`, `s9a3-e2e.log` | Tests mit `EXIT=` in der letzten Zeile |
| `s9a3-shots-run2.log` … `s9a3-shots-run5.log` | Shot-Läufe, siehe unten |
| `s9a3-migration-list.log`, `s9a3-verify.log` | Migration 0019 lokal = remote; Seed-Abgleich 28 von 28 |

## Hinweise
- **Tests (final):** `npm run check` Exit 0, 365 Unit-Tests (vorher 361; +4 für `buildBody` ohne Preis, `shownLabel`, `termsText`). `npm run test:rls` Exit 0, 168 Tests in 8 Dateien (Edge Function und Migration seit diesem Lauf unverändert). `npm run test:e2e` Exit 0, 89 Tests (vorher 87; +2: Preis und Bedingungen vor dem Senden, ohne gemerkten Preis kein Aufruf). Wegfallende oder geänderte Tests: drei E2E-Erwartungen „kein Preis vor dem Senden“ (`anfrage.spec.ts`) wurden auf die neue Vorgabe der Abnahme H-1 umgestellt; der Nutzerlimit-Test in `tests/rls/quote.test.ts` wartet jetzt vor dem Start, wenn die UTC-Sekunde > 45 ist (feste Minutenfenster; einmal rot, danach 168/168).
- **Rot-Beweis, Bezeichnung (Abnahme N-1):** „rental_bookings: DELETE für service_role“ steht im Bericht als Schicht, ist aber eine Sperre (hinter dem Revoke liegt kein Löschschutz). Richtig sind SQL 10 Sperren und 11 Schichten (Bericht: 9 und 12). Der Bericht bleibt unverändert.
- **Rot-Beweis, Teil „Redeploy“ (Abnahme M-1):** Es ist eine Quelltext-Mutation des Handlers im Prozess (die Tests rufen den Handler aus dem Quelltext auf, nicht die deployte Function). R2-N13 und N-15 stehen deshalb in `docs/OPEN_ISSUES.md` auf „teilweise“ (S9a-4).
- **Shot-Läufe:** `run2` 102 bestanden, 6 fehlgeschlagen (`zusammenfassung-umzug`: gespeicherter Umzug-Termin in der Shot-Spec ohne `point`/`consent`, danach behoben); `run3` 12 bestanden; `run4`/`run5` nur Filter „zusammenfassung“, 390/430/1280 je Light/Dark, je 66 bestanden (`run5` nach der Preiskarte). Zwei frühere Läufe mit der alten Shot-Spec (64 bestanden/112 fehlgeschlagen und 168/8) sind überholt und nicht beigelegt. Es gab kein zweites `shots:all`.
- **Reviewer ohne Write:** Der `reviewer` hat kein Write. Seine Antworten sind unverändert in die Shot-Tabellen übernommen (Spalte Befund im Wortlaut; Datei, Breite, Modus ergänzt die Hauptsession), vermerkt in `docs/PROGRESS.md`. Maße (Überlauf, Safe Area) sind nicht per `boundingBox()` gemessen (Abnahme N-10, `docs/OPEN_ISSUES.md`).
- **`docs/PROGRESS.md`:** Am Dateiende steht eine Zeile mit einem einzelnen geschützten Leerzeichen (U+00A0), aus dem Entfernen des überholten Abschnitts „Übergabe der Hauptsession“; mit Edit nicht greifbar, Skripte für Markdown sind verboten. Inhaltlich ohne Bedeutung.
- **Verfahren:** `scripts/redproof-s9a3.mjs` patcht für den Teil „Redeploy“ kurz `supabase/functions/_shared/quote/handler.ts` (`git checkout` stellt die Datei danach wieder her, `git diff --quiet` belegt es). Die Shot-Spec und die ungenutzten Variablen im Skript wurden nur mit Edit/Write geändert, kein Patch-Skript. Es wurde kein Test- oder Serverprozess beendet; beendet wurde kein Hintergrund-Task außer ausgelaufenen Monitoren (Zeitlimit).
- **Abnahme, Dateinamen:** `s9a3-abnahme.md` ist die Datei der Runde 2 (Quelle `tmp/proof/s9a3-abnahme-runde2.md`, letzte Zeile „Offene Findings hoch: 0“), die Runde 1 (2 hoch: H-1 Preis nicht gezeigt, H-2 Bedingungen nicht gezeigt; beide behoben) liegt nur als `tmp/proof/s9a3-abnahme.md` vor und ist hier **nicht** beigelegt: `npm run scan:proof` meldete einen Fehlalarm („Verbindungs-URL mit Passwort“), weil der Bericht im Fließtext das Suchmuster für Verbindungs-URLs (Schema „postgres“, Auslassungspunkte statt Benutzer und Passwort) zitiert (kein Zugang, geprüft per `grep`). Nachweise und das Scan-Skript durften nach der Abnahme nicht mehr verändert werden. Runde 2 verweist mit `tmp/proof/…`-Pfaden und Zeilennummern auf die damaligen Dateien; die Findings H-1 und H-2 sind dort und in `docs/PROGRESS.md` zusammengefasst.
- **Nach der Abnahme Runde 2 geändert (nur Doku und Belege, kein Code):** `s9a3-0d.md` (R2-N7: „DELETE“ als Sperre, Log-Liste, M-2-Hinweise), `docs/OPEN_ISSUES.md` (R2-M1, R2-N1 bis R2-N8, Verweis bei A1-N9, zwei überholte Reviewer-Funde), diese README. Der Rot-Beweis, die Berichte der Berater und die Shot-Tabellen blieben unverändert.
- **R2-M1 (mittel, offen für S9a-4):** Nach einem angenommenen 409 mit Folgefehler zeigt die Zusammenfassung wieder die alten Werte, gesendet werden die neuen. Der Berater empfahl die Korrektur vor dem Commit, sie hätte aber eine Code-Änderung nach der Abnahme und damit eine dritte Runde bedeutet (Vorgabe: höchstens 2 Runden). Siehe `docs/OPEN_ISSUES.md`, Abschnitt „S9a-3 · Abnahme“.
- **RLS-Lauf nach der Abnahme (R2-N6):** `s9a3-rls.log` ist der Lauf nach der Abnahme Runde 2; er enthält die Wartelogik im Nutzerlimit-Test (der Lauf vom 15:36 Uhr, auf den sich der Bericht bezieht, lief ohne sie und ist als `tmp/proof/s9a3-rls-15h36.log` nur lokal gesichert).
- **Kein zweites `shots:all`:** Auf Anweisung nur die betroffenen Screens (Filter „zusammenfassung“, 390/430/1280); 768 px und die übrigen Screens wurden nach der Preiskarte nicht neu aufgenommen (R2-N8).
- **Offenes** (alle mittel/niedrig, mit Teilschritt): `docs/OPEN_ISSUES.md`, Abschnitte „S9a-3 · Abnahme“ und „S9a-3 · Shots“.
