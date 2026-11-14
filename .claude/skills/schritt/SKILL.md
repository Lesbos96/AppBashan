---
name: schritt
description: Ablauf eines MoveNow-Arbeitsschritts nach Risikostufe (R0 bis R3). Aufruf `/schritt <name>` plus Ziel, Umfang und Vorgaben von Beks. Nur Beks startet einen Schritt.
disable-model-invocation: true
---
# /schritt <name>

Der Prompt nennt Name, Ziel, Umfang, Vorgaben und Entscheidungen von Beks. Alles andere steht hier. Der Schrittname ist der Branchname. Fehlt der Name oder das Ziel: nachfragen und warten.

## Ablauf
1. `npm run start-schritt -- <name>`. Es prüft die Ausgangslage, legt den Branch an und gibt `docs/STAND.md` aus. Bricht es ab: Meldung an Beks, Stopp. Nichts von Hand reparieren.
2. Stufe schätzen aus den Pfaden, die der Schritt ändern wird (Tabelle unten); maßgeblich ist am Ende `node scripts/sys/stufe.mjs`. Im Zweifel die höhere. Herabstufen gibt es nicht: Das Gate rechnet die Stufe selbst aus den Pfaden.
3. Nur R3: Faktenliste mit `Datei:Zeile` (über `Explore`), Plan, dann **eine** gebündelte Frage an `advisor` (Dateiliste, nie Diff oder Verlauf). Seine Entscheidung gilt; Abweichung nur mit Begründung im Bericht.
4. Tests schreiben. R3 zuerst rot (`npm run t -- <testdatei>`), R2 für neue Logik.
5. Bauen, höchstens 5 Runden je Aufgabe, nur gezielte Läufe. Bleibt ein Fehler nach 2 Runden rot: bei R3 `advisor` fragen. Was nach 5 Runden rot bleibt: nach `docs/OFFEN.md` mit Begründung, einmal berichten.
6. Migration: `npm run db:antrag` → `advisor-report` bekommt nur den Antrag und schreibt `tmp/proof/<name>/db-freigabe-<n>.md` → `npm run db:push`. Betroffene Edge Functions im selben Zug deployen, danach Live-Aufruf.
7. UI geändert: `npm run t -- shots` (390) bzw. `npm run t -- shots:all` (430, 768, 1280), dann `reviewer` (Bildsicht, Regeln in `.claude/rules/ui.md`; sein Bericht heißt `tmp/proof/<name>-review.md`).
8. Abnahme nach Stufe (Tabelle). Bei R3 schreibt `advisor-report` `tmp/proof/<name>-abnahme.md` mit `SHA256`-Zeile je geprüfter Datei und letzter Zeile `Offene Findings hoch: 0`. Hoch ≥ 1: beheben, eine Kontrollrunde. Der Auftrag nennt je Datei die Zeile `SHA256: <hash> <pfad>` aus `sha256sum`. Pflichtmenge laut Gate: jede geänderte Datei unter `supabase/functions/`, `src/lib/money*`, `scripts/sys/*.mjs`, `tests/support/`, `docs/freigaben/`, `.claude/hooks/`, `.claude/agents/`, `.githooks/`, dazu `scripts/sys/loesch-register.json`, `.claude/settings.json` und `package.json`. Eine gelöschte Datei dieser Menge blockiert das Gate, es sei denn, die Abnahme nennt die Löschung mit einer eigenen Zeile `Geloescht: <pfad>`; der Auftrag an `advisor-report` nennt sie wörtlich.
9. Endstand committen. Dann je Pflicht-Suite ein Volllauf: `npm run t -- check`, `e2e`, `rls`. Rot: beheben, neu committen, betroffene Suite neu. Bei unverändertem Fingerabdruck übernimmt das Gate eine Suite aus `docs/proof/gruen.json`; `rls` bei R3 nur, wenn der grüne Lauf (Feld `zeit`) höchstens 7 Tage alt ist und nach dem letzten `db-push` lag, sonst Volllauf.
10. `docs/STAND.md` neu schreiben (höchstens 40 Zeilen: wo wir stehen, nächster Schritt, was er voraussetzt). Neue Fragen an Beks nach `docs/BEKS.md`, Offenes nach `docs/OFFEN.md` (Erledigtes dort löschen), Entscheidungen nach `docs/ENTSCHEIDUNGEN.md`, ROADMAP abhaken. Committen.
11. `npm run bericht` (schreibt `docs/proof/<name>/bericht.md` und `bericht.json`, kopiert die Nachweise; die Dateien dort sind danach unveränderlich), committen, `npm run fertig`. Blockiert das Gate: Grund beheben, nie umgehen. Scheitert `npm run bericht` am Secret-Scan: nichts committen, anhalten, Beks berichten.
12. Antwort im Chat: der Inhalt von `bericht.md`, darunter die Bewertung in höchstens 5 Zeilen (Gebaut · Abweichungen vom Auftrag · Neue Fragen an Beks · Offen · Nächster Schritt), sonst nichts. Stopp. Keine weitere Aufgabe beginnen.

## Stufen (rechnet `scripts/sys/stufe.mjs`, unbekannte Pfade = R3)
| Stufe | Pfade |
|---|---|
| R0 Doku | nur `docs/**`, `*.md` (außer `CLAUDE.md`, `docs/freigaben/**`) |
| R1 Oberfläche | `src/screens/**`, `src/components/**`, `src/assets/**`, `*.css`, `tests/e2e/**`, `tests/shots/**` |
| R2 App-Logik, Betrieb | `src/lib/**`, `src/app/**`, `tests/unit/**`, `scripts/**` ohne `sys`, `public/**`, Build-Konfiguration |
| R3 Vertrauen | `supabase/**`, `src/lib/money*`, `tests/rls/**`, `tests/support/**`, `scripts/sys/**`, `.claude/**`, `.githooks/**`, `CLAUDE.md`, `package.json`, `docs/freigaben/**` |

## Pflichten je Stufe
| Pflicht | R0 | R1 | R2 | R3 |
|---|---|---|---|---|
| Planprüfung `advisor` (Fable) | – | – | – | ja, eine Frage |
| Tests zuerst rot | – | – | neue Logik | ja, per Gate |
| DB-Gate mit Hash | – | – | – | ja |
| `check` | – | ja | ja | ja |
| `e2e` | – | gezielt, am Ende voll | gezielt, am Ende voll | voll bei geändertem Fingerabdruck |
| `rls` voll | – | – | bei geändertem Fingerabdruck | bei geändertem Fingerabdruck; sonst Übernahme nur, wenn der grüne Lauf höchstens 7 Tage alt ist (sonst voll) |
| Live-Aufruf der berührten Function | – | – | ja | ja, plus `tests/rls/flow-live.test.ts` |
| Bildsicht | – | geänderte Screens, 390 und 1280, hell und dunkel; 430 in der Schlussrunde | nur bei UI | nur bei UI |
| Abnahme | – | `reviewer` | `reviewer` | `advisor-report`, nur Geld- und Sicherheitsdateien |
| Bericht | maschinell | + 5 Zeilen | + 5 Zeilen | + 5 Zeilen |

## Agents (nur diese, nie general-purpose)
- `Explore` (Haiku): Suche über mehr als zwei Dateien, große Referenzdateien abschnittsweise.
- `mech-editor` (Haiku): mechanische Massenänderung nach exakter Vorgabe. Nur ein editierender Agent zur selben Zeit.
- `reviewer` (Sonnet): Abnahme R1/R2, Bildsicht.
- `advisor`, `advisor-report` (Fable): nur R3, im Regelfall drei Aufrufe je Schritt (Plan, DB-Freigabe, Abnahme). Zusätzlich nur: eine Kontrollrunde nach „hoch ≥ 1“, eine weitere DB-Freigabe je weiterem Antrag, eine Frage an `advisor`, wenn ein Fehler nach 2 Runden rot bleibt oder eine Geld- oder Sicherheitsentscheidung auftaucht, die der Plan nicht abdeckt. Jeder Zusatzaufruf steht in der Bewertung. Das eingebaute `advisor`-Tool ohne Parameter nie benutzen; steht es in der Tool-Liste, im ersten Satz melden.
- Jede Delegation mit Spec: Ziel, Dateien, Akzeptanzkriterien, Läufe, bei UI die Referenz-Screens. Wenige große statt vieler kleiner.

## Feste Punkte
- Modell der Hauptsession: Sonnet 5.5, Effort hoch bei R3, sonst mittel. Der Hook blockt `/schritt` bei falschem Modell nur, wenn der Sitzungsstart das Modell liefert (Stand u2b: in dieser Umgebung nicht, siehe `docs/OFFEN.md` u1-7); den Effort prüft er nie. Bei R3 im ersten Satz an „Effort hoch“ erinnern und das eigene Modell nennen, wenn es nicht Sonnet 5.5 ist. Der Bericht nennt das Modell aus Hook oder Transkript; läuft die Session auf Beks' Wort mit einem anderen Modell, steht das dort.
- Größe: ein Ergebnis, das allein auf `main` Sinn ergibt. R3 ein Thema mit Migration, Functions, Tests und zugehöriger Oberfläche. R1 bündeln.
- Ab etwa 150.000 Tokens Kontext: Zwischenstand auf dem Schritt-Branch committen (nie auf `main`), `docs/STAND.md` mit „weiter bei …“, Bescheid geben, Stopp. Fortsetzung: Beks startet `/schritt <name>` mit dem Wort „Fortsetzung“; dann entfällt Ablauf-Punkt 1 (der Branch besteht schon), stattdessen prüfen: `git branch --show-current` ist `<name>`, Arbeitsbaum sauber; dann `docs/STAND.md` lesen.
- Ändert der Schritt eine frühere Entscheidung von Beks, braucht er dessen wörtliches Ja im Prompt. Sonst anhalten und in `docs/BEKS.md` fragen.
- Nichts aus „Später“ in `docs/ROADMAP.md` ohne Freigabe.
- Befehlsausgaben nur bei Fehlern im Wortlaut, sonst „bestanden“.
