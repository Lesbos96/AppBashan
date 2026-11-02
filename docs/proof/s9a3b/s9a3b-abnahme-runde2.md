# S9a-3b · Abnahme Runde 2 (Berater, Geld/Sicherheit/Schema)

- Datum: 2026-11-02
- Umfang: endgültiger Stand nach den Commits `2ad0aee` und `c6d1887`. Das Arbeitsverzeichnis ist laut Auftrag sauber. Grundlage ist Runde 1 in `docs/proof/s9a3b/s9a3b-abnahme.md`.
- Gelesen:
  - `scripts/redproof-s9a3.mjs` 1–40 und 295–384
  - `docs/OPEN_ISSUES.md` vollständig
  - `docs/PROGRESS.md` 195–214
  - `CLAUDE.md:68` (per Grep)
  - in `docs/proof/s9a3b/`: alle Logs (Kopf, Ende und Fehlerzeilen) und `s9a3b-rotbeweis-redeploy.md`
  - zum Abgleich `tmp/proof/s9a3b-*.log` (Zeilen mit Exit-Code, Ergebnis und Fehlern)
- Nicht erneut geprüft: `Zusammenfassung.tsx`, `quote.ts`, `draft.ts` und die Tests. Laut Auftrag hat sich daran seit Runde 1 nichts geändert.
- Grenze dieser Prüfung: Ich habe nur Lese- und Suchwerkzeuge, also weder `git diff` noch einen Hash-Vergleich. Ob das Skript nur im Kommentar geändert wurde, belege ich deshalb über Zeilenlagen und Inhalt, nicht über einen Byte-Vergleich. Dasselbe gilt dafür, dass die Logs in `docs/proof/` dieselben Bytes haben wie die in `tmp/proof/`.
- Hinweis: In der Tool-Liste dieses Beraters stand wieder ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt.

## Findings

### Hoch

Keine.

### Mittel

Es gibt keine neuen mittleren Findings. Zwei bekannte bleiben offen und sind in `docs/OPEN_ISSUES.md:105` eingetragen:
- **A-M1:** Für die Kartensperre fehlt der Rot-Beweis.
- **M-1 aus dem Plan:** Der Hinweis zum Spannenvergleich in `Gesendet.tsx` ist noch offen.

Beide sind keine Sicherheitslücke:
- Zur Kartensperre läuft der grüne Test, und der Code ist geprüft (Runde 1, Frage 1).
- Der Spannenhinweis ist eine reine Anzeige auf der Bestätigungsseite.

### Niedrig

**A2-N1 · `docs/OPEN_ISSUES.md:105`: Den Funden A-M1, A-N1, A-N4 und M-1 fehlt der Teilschritt.**
- Problem: Die übrigen offenen Punkte nennen einen Teilschritt oder eine Frist, z. B. `:113` mit „(S9a-4)“ und `:116` mit „offen für S9a-4“. Die vier neuen Einträge stehen dagegen nur als „offen“ da. Nur `PROGRESS.md:213` legt indirekt S9a-4 nahe. Dazu kommt ein Namenskonflikt: „M-1“ in `:105` (Spannenhinweis aus dem Plan) heißt genauso wie „M-1“ in `:113`, die Live-Probe aus der Abnahme von S9a-3.
- Fix: Bei allen vier Einträgen „(S9a-4)“ ergänzen. Das M-1 aus dem Plan eindeutig benennen, z. B. „Plan-M-1 (S9a-3b)“.

**A2-N2 · `docs/OPEN_ISSUES.md:105` gegen `:57`, `:62`, `:63`, `:69`: Gleiche Kennungen für verschiedene Funde.**
- Problem: `:105` meldet „R2-M1, R2-N1, R2-N2 erledigt“ und „R2-N8 … erledigt“, ohne die Quelle zu nennen. Dieselben Kennungen stehen auch in der Tabelle zur Runde 2 des S9a-Plans (`:57`, `:62`, `:63`, `:69`), dort aber für andere Funde. So meint `:62` die Grants auf `platform_settings`. Gemeint sind in `:105` die Funde aus Runde 2 der Abnahme von S9a-3 (`:115`, `:116`). Dort sind sie jetzt richtig als erledigt markiert, damit ist N-2 aus Runde 1 gelöst.
- Fix: In `:105` „(Abnahme S9a-3, Runde 2)“ hinter die Kennungen setzen.

**A2-N3 · `docs/OPEN_ISSUES.md:105` (Ende): Eine Testlücke aus N-5 fehlt.**
- Problem: In der Liste der fehlenden Tests fehlt die Kartensperre im Zustand `price_changed` (N-5 aus Runde 1). Die Liste nennt nur drei Fälle: Preis-409 und Bedingungen-409 hintereinander, eine angenommene Spanne bzw. ein angenommenes Angebot, und Neuladen nach der Annahme.
- Fix: Den Fall „Kartensperre bei `price_changed` (ohne Einwilligung, nach Kontowechsel)“ ergänzen. Das lässt sich mit A-M1 bündeln.

**A2-N4 · `docs/PROGRESS.md:211`: Die Zählung der Rot-Läufe stimmt nicht.**
- Problem: Dort steht, 6 von 9 neuen 409-Tests seien rot. Das passt nicht zu den Logs:
  - Der Lauf `s9a3b-e2e-rot.log` umfasste 9 Tests (`:2`). Zwei davon sind alt, nämlich `:264` und `:283` (`:4-5`).
  - Neu sind 8 Tests (97 − 89, wie in derselben Zeile).
  - Echt rot gegen den alten Code waren 7 dieser 8:
    - aus `rot.log` die Tests `:320`, `:342` und drei Fälle von `:359`
    - `:302` aus `rot-preis.log`
    - `:352` aus `rot-karte.log`, dort allerdings an der Leiste
  - Das „rot“ von `:302` in `rot.log` war der Abbruch durch das Zeitlimit (`rot.log:9-11`).
  - Grün blieb nur der Regressionstest „Preis ohne Snapshot“.
- Fix: Den Satz in PROGRESS korrigieren. PROGRESS ist keine Nachweisdatei und darf per Edit geändert werden.

**A2-N5 · `docs/proof/s9a3b/s9a3b-rotbeweis-redeploy.md:1`, `:51`: Der Bericht ist missverständlich.**
- Problem: Die Überschrift lautet „S9a-3 Rot-Beweis“. Die Ergebniszeile meldet „SQL 0 Sperren und 0 Schichten … Werkzeuge 0 bewiesen von 5“. Der Grund ist der Lauf mit `--only` (`redproof-s9a3.mjs:332`, Teil 3 nur ohne `--only`), nicht ein Fehlschlag. Wer die Datei allein liest, hält das für einen gescheiterten Beweis. Das Log `s9a3b-redproof-redeploy.log:19-20` ist eindeutig: bestanden, Exit 0.
- Fix: Die Nachweisdatei bleibt, wie sie ist. In `docs/PROGRESS.md` einen Satz ergänzen: Teilaufruf mit `--only` auf die fünf Einträge zum Redeploy, SQL und Werkzeuge nicht gelaufen. So verlangt es `CLAUDE.md:68`.

**A2-N6 · `tmp/proof/s9a3b-check-final.log` fehlt in `docs/proof/s9a3b/`.**
- Problem: Der Check auf dem Endstand (`:42-43`, `:48`: 13 Dateien und 365 Tests bestanden, `EXIT=0`) liegt nur im Arbeitsordner. `docs/proof` enthält nur den Check von vor der Abnahme. Das Ergebnis ist dasselbe, als Beleg für den committeten Stand fehlt er aber.
- Fix: Die Datei byte-genau per `cp` nach `docs/proof/s9a3b/` kopieren, vorher `scan:proof`. Oder in PROGRESS vermerken, warum sie fehlt.

**Hinweis, kein Finding:** Mein Kontext enthielt eine ältere Fassung von `CLAUDE.md:68`, nach der Hinweise in eine README im Nachweisordner gehören. Die Datei auf der Platte sagt das Gegenteil: Hinweise gehören in PROGRESS, keine README. OPEN_ISSUES `:105` und PROGRESS `:212` folgen der Fassung auf der Platte, sind also stimmig. Damit ist N-6 aus Runde 1 erledigt. Sollte der Hauptsession dieselbe alte Fassung vorliegen, gilt die Datei.

## Beantwortung der Prüffragen

**(1) Ist die Skript-Änderung nur ein Kommentar?** Soweit ohne `git diff` prüfbar: ja.
- `redproof-s9a3.mjs:4` nennt jetzt `supabase/functions`. Damit stimmt der Kommentar mit der Prüfung in `:30` überein, und N-3 aus Runde 1 ist erledigt.
- `:27-28` nennen weiter `handler.ts`. Das ist richtig, denn nur diese Datei wird gelockert und wiederhergestellt (`:29`, `:300-304`).
- Alle Zeilen, die ich in Runde 1 zitiert habe, stehen unverändert an derselben Stelle und mit demselben Inhalt:
  - die Prüfung mit Exit 2 (`:30-33`)
  - die Wiederherstellung (`:309-324`)
  - das Löschen des Testnutzers im `finally` (`:371-375`)
  - die Prüfung, ob das Redeploy bestanden ist (`:325`)
- Ich sehe in den gelesenen Bereichen keine Code-Änderung. Für die Zeilen 41–294 schließe ich eine Änderung mit gleicher Zeilenzahl nur über die unveränderten Zeilenlagen aus, nicht über einen Byte-Vergleich.
- Das Log zum Redeploy (`:1-2`, `:21-22`) entstand vor der Kommentaränderung. Es bleibt gültig, weil `handler.ts` (md5 `ae71b0da…`) und `supabase/functions` davon nicht betroffen sind.

**(2) Sind die Funde aus Runde 1 korrekt und widerspruchsfrei in OPEN_ISSUES eingetragen?**

| Fund Runde 1 | Stand | Teilschritt |
|---|---|---|
| M-1 Rot-Beweis Kartensperre | als A-M1 in `:105`, mittel, Fix richtig wiedergegeben | fehlt (A2-N1) |
| N-1 `Confirmed.shown` | als A-N1 in `:105`, Fix richtig | fehlt (A2-N1) |
| N-2 Widerspruch erledigt/offen | erledigt: `:115` und `:116` markieren R2-M1, R2-N1, R2-N2 und R2-N8 als „erledigt in S9a-3b“; offen bleiben R2-N3, R2-N4 und R2-N5 | – |
| N-3 Kopfkommentar | erledigt (`redproof-s9a3.mjs:4`) | – |
| N-4 Exit 2 ohne Beleg | als A-N4 in `:105`, zusammen mit M-3 (`:113`) | nur indirekt über M-3 (S9a-4), A2-N1 |
| N-5 Testlücken | in `:105` eingetragen, ohne die Kartensperre bei `price_changed` | A2-N3 |
| N-6 README-Regel | `:105` und `PROGRESS.md:212`: gilt ab S9a-3b, Alt-Dateien bleiben; stimmt mit `CLAUDE.md:68` überein | – |

Widersprüche gibt es nur bei den Kennungen (A2-N2), in der Sache nicht. `PROGRESS.md:213` nennt dieselben vier offenen Punkte wie OPEN_ISSUES `:105`.

**(3) Enthält `docs/proof/s9a3b/` alle Nachweise mit `EXIT=`?** Ja, alle sieben verlangten Logs sind vorhanden und enden mit einem Exit-Code. Ergebnis und Zeilenlage stimmen jeweils mit der Datei in `tmp/proof/` überein.

| Log | Exit-Zeile | Ergebnis |
|---|---|---|
| `s9a3b-check.log` | `:48` `EXIT=0` | 13 Dateien und 365 Tests bestanden (`:42-43`) |
| `s9a3b-e2e.log` | `:112` `EXIT=0` | 97 bestanden (`:111`) |
| `s9a3b-e2e-rot.log` | `:347` `EXIT=1` | 6 rot, 3 bestanden (`:339`, `:346`) |
| `s9a3b-e2e-rot-preis.log` | `:45` `EXIT=1` | 1 rot, Erwartung „sichtbar“ (`:7`, `:10`) |
| `s9a3b-e2e-rot-karte.log` | `:47` `EXIT=1` | 1 rot an der Leiste `:359`, „Received: enabled“ (`:11`, `:23`) |
| `s9a3b-redproof-redeploy.log` | `:20` `EXIT=0` | 5 von 5 OK, md5 vorher und nachher gleich, `PRECHECK_DIRTY=0` und `POSTCHECK_DIRTY=0` |
| `s9a3b-shots-run.log` | `:23` `EXIT=0` | 18 bestanden (`:22`) |

Dazu liegen dort der Plan, die Abnahme aus Runde 1, der Bericht zu den Shots und der Bericht zum Redeploy (A2-N5). Der Check auf dem Endstand fehlt (A2-N6).

**(4) Gibt es neue hohe Findings?** Nein. Seit Runde 1 haben sich nur ein Kommentar, die Doku und die Logs geändert. Geld-, Sicherheits- und Schemalogik sind nicht berührt. Der deployte Stand der Function `quote` entspricht weiterhin dem Git-Stand (Runde 1, Frage 6; das Log zum Redeploy gilt unverändert).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/redproof-s9a3.mjs:4` | Kommentar nennt `supabase/functions` (N-3 erledigt) |
| `scripts/redproof-s9a3.mjs:27-33` | Kommentar und Prüfung mit Exit 2 unverändert, Lage wie in Runde 1 |
| `scripts/redproof-s9a3.mjs:309-325` | Wiederherstellung aus `original`, `finally` mit Deploy und Test, Prüfung `good` unverändert |
| `scripts/redproof-s9a3.mjs:332` | Teil 3 nur ohne `--only` (erklärt `rotbeweis-redeploy.md:51`) |
| `scripts/redproof-s9a3.mjs:371-375` | `finally` löscht den Testnutzer, unverändert |
| `docs/OPEN_ISSUES.md:105` | A-M1, A-N1, A-N4 und M-1 eingetragen, ohne Teilschritt (A2-N1); Kennungen ohne Quelle (A2-N2) |
| `docs/OPEN_ISSUES.md:115-116` | R2-M1, R2-N1, R2-N2 und R2-N8 als „erledigt in S9a-3b“ markiert (N-2 erledigt) |
| `docs/OPEN_ISSUES.md:57`, `:62` | gleiche Kennungen R2-M1 und R2-N1 mit anderer Bedeutung (A2-N2) |
| `docs/OPEN_ISSUES.md:113` | M-3 mit Frist S9a-4, Bezug für A-N4 |
| `docs/PROGRESS.md:211` | „6 von 9 neuen“ passt nicht zu den Logs (A2-N4) |
| `docs/PROGRESS.md:212-213` | README-Regel und Liste der offenen Punkte stimmen mit OPEN_ISSUES überein |
| `CLAUDE.md:68` | Hinweise in PROGRESS, keine README im Nachweisordner |
| `docs/proof/s9a3b/s9a3b-e2e-rot.log:2`, `:4-5`, `:9-11` | 9 Tests, darunter 2 alte; `:302` dort ein Abbruch durch Zeitlimit |
| `docs/proof/s9a3b/s9a3b-e2e-rot.log:339-347` | 6 rot, 3 bestanden, `EXIT=1` |
| `docs/proof/s9a3b/s9a3b-e2e-rot-karte.log:11`, `:23`, `:47` | rot an der Leiste, nicht an der Karte (A-M1 bleibt), `EXIT=1` |
| `docs/proof/s9a3b/s9a3b-redproof-redeploy.log:1-2`, `:18-22` | md5 `ae71b0da…` vorher und nachher, Arbeitsbaum sauber, `EXIT=0` |
| `docs/proof/s9a3b/s9a3b-rotbeweis-redeploy.md:51` | Ergebniszeile wirkt wegen `--only` wie ein Fehlschlag (A2-N5) |
| `docs/proof/s9a3b/s9a3b-shots-run.log:22-23` | 18 bestanden, `EXIT=0` |
| `tmp/proof/s9a3b-check-final.log:42-43`, `:48` | Check auf dem Endstand grün, `EXIT=0`, nicht in `docs/proof` (A2-N6) |
| `tmp/proof/s9a3b-e2e-rot.log:347`, `tmp/proof/s9a3b-e2e.log:111-112` | gleiche Zeilenlage und gleiches Ergebnis wie die Kopien in `docs/proof` |

Offene Findings hoch: 0
