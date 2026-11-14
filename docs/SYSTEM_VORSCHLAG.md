# Neues Arbeitssystem für MoveNow · Vorschlag

Kennung: **sys1-1411-a** · Stand 2026-11-14 · Modell `claude-fable-5-2` · nur Analyse und Vorschlag, nichts davon ist gebaut.
Grundlage: `CLAUDE.md`, `docs/AUTOPILOT.md`, `docs/PROGRESS.md`, `docs/OPEN_ISSUES.md`, `docs/GOLIVE.md`, `.claude/settings.json`, `.claude/agents/`, `package.json`, `vite.config.ts`, `playwright.config.ts`, `C:\Users\gesch\.claude\hooks\trim-output.js`, `git log`, offizielle Doku (Abschnitt 8). Was ich nicht prüfen konnte, steht als „unbelegt“ da.

---

## 1 · Kurzfassung für Beks

1. Heute stehen die Regeln als Text in Prompts und Dateien, und eine zweite KI liest nach, ob sie eingehalten wurden. Genau dort, wo eine Regel nur Text war, wurde sie verletzt.
2. Neu: Die wichtigen Regeln werden zu kleinen Programmen im Projekt. Sie brechen ab, wenn etwas fehlt. Niemand muss mehr daran denken.
3. Drei Schranken: Tests laufen nur über ein Start-Programm, das jedes Protokoll selbst schreibt. Datenbank-Änderungen gehen nur durch, wenn Fable genau diese Datei freigegeben hat. Zusammenführen geht nur mit grünem Endstand.
4. Der Bericht entsteht automatisch. Claude im Chat prüft ihn in zwei Minuten statt in mehreren Runden.
5. Nicht jede Arbeit braucht den vollen Ablauf. Geld, Rechte, Datenbank und Personendaten behalten ihn. Oberfläche, Texte und Doku bekommen einen leichten.
6. Die langen Testläufe laufen nur noch, wenn sich etwas geändert hat, das sie betrifft. Eine reine Oberflächen-Arbeit wartet nicht mehr 14 Minuten auf Datenbank-Tests.
7. Deine Prompts schrumpfen von 250 bis 300 Zeilen auf etwa 10. Die festen Regeln stehen im Projekt.
8. Die über 120 Entscheidungen werden einmal sortiert. Übrig bleibt für dich eine Seite mit etwa 10 bis 15 Ja/Nein-Fragen in einfacher Sprache.
9. Weniger Klicks: Auto-Modus als Standard, das eingebaute advisor-Tool wird abgeschaltet, der Hook, der Befehle umbaut, fällt für dieses Projekt weg.
10. Umstellung: etwa zwei Arbeitstage (drei Sessions), danach der erste echte Schritt als Probe.
11. Danach rechne ich mit 14 bis 18 Sessions bis „technisch startklar“, bei zwei bis drei Sessions am Tag also rund zwei bis drei Wochen.
12. Den Starttermin bestimmt aber nicht der Code, sondern deine offenen Punkte: Rechtstexte, Mail-Anbieter, Routing-Vertrag, Hosting, Captcha-Konto. Die brauchen Vorlauf und sollten heute starten.
13. Für s9p-1 (Provisionsstaffel) fehlt im Projekt die Vorgabe: Stufen, Grenzen, ab wann. Ohne die kann die Session nicht beginnen.

---

## 2 · Ehrliche Kritik am heutigen System

### 2.1 Was bleibt, weil es nachweislich wirkt
- **Fable-Abnahme bei Geld und Rechten.** Sie fand echte hohe Funde: S9c H1, S9h-1, S9h-3, S9h-4, s9i-5b, s9i-6a (`docs/AUTOPILOT.md:12`, `:17`, `:19`, `:20`, `:27`, `:28`).
- **Der Live-Durchgangstest** `tests/rls/flow-live.test.ts`. Er fand in einer Session, was Mocks wochenlang verdeckten: `partner_accept_basis` wirft 42804, `accept` liefert 500 (`docs/AUTOPILOT.md:226`, Fix 0061).
- **Dev-Schutz** (`scripts/dev-guard.mjs`), RLS-Tests als Rollback-Proben, „Merge nur mit grünem Endstand“, Rot-Beweis mit Ist-Wert, Geldregeln aus `CLAUDE.md`.
- **Nachweis über Exit-Code und Datei** statt Zusammenfassung.

### 2.2 Was Verschwendung ist
| Heute | Beleg | Warum es wegfällt |
|---|---|---|
| Prompts mit 250 bis 300 Zeilen, die Regeln wiederholen | Auftrag, Punkt 2 | Wiederholter Text wird nicht besser befolgt. Die Doku nennt CLAUDE.md „context, not enforced configuration“ und rät unter 200 Zeilen je Datei (memory). |
| Bericht mit 15 bis 18 Punkten von Hand, dann Nachforderungen | Auftrag, Punkt 1 und 2 | Hash, Sauber-Angabe, Befehl, EXIT, Testzahlen, Dauer, Migrationsliste kann ein Skript fehlerfrei liefern. |
| Drei Volläufe in jeder Session | s9i-2 bis s9i-6a: „keine Migration“ und trotzdem rls komplett mit 622 bis 1200 s (`docs/AUTOPILOT.md:22` bis `:28`) | Ein rls-Lauf prüft die Datenbank. Hat sich an ihr nichts geändert, beweist er nichts Neues. |
| `WEITER MIT` als ein Absatz mit der ganzen Vorgeschichte | `docs/AUTOPILOT.md:258`, eine Zeile mit mehreren tausend Wörtern | Jede Session liest und pflegt Stände von vor zwei Wochen. |
| 123 nummerierte Entscheidungen in einer Liste | Nr. 23 „`ownerSql` schreibt ab 12.000 Zeichen in eine Datei“ steht gleichrangig neben Nr. 104, die eine Beks-Entscheidung vom 01.11. ändert | Die wenigen Punkte, die du wirklich entscheiden musst, gehen unter. |
| `OPEN_ISSUES.md` mit 611 Zeilen samt Erledigtem | Abschnitte ab S9a | Offenes ist nicht mehr auffindbar. |
| Nachweisordner mit ungültigen Dateien und Hinweisen dazu | `docs/proof/s9i-7c2/`: 44 Dateien; `PROGRESS.md:9` erklärt, welches Log den falschen Parser hat und welches keine EXIT-Zeile | Entsteht, weil Logs von Hand gebaut werden. `docs/proof` hat 20 MB. |
| `test-runner` (Haiku) als Bote für Exit-Codes | `CLAUDE.md`, „Diese Befehle laufen nie im Hauptkontext“ | Ein Bote ist eine Fehlerquelle mehr. Wenn das Start-Programm nur 30 Zeilen zurückgibt, braucht es ihn nicht. |
| Selbstauskunft zu Modell, Effort, Tool-Liste | s9i-5a lief als Haiku (`docs/AUTOPILOT.md:246`); Effort einmal „10“, einmal aus Datei (`:205`, `:216`) | Das Modell weiß es nicht verlässlich. Der Hook `SessionStart` bekommt das Modell vom Programm (hooks). |
| Der Hook `trim-output.js` | Abschnitt 2.3 | Arbeitet gegen die EXIT-Regel und erzeugt Klicks. |
| Claude im Chat als Regelpolizei | Er sieht nur Berichte | Prüfen, ob ein Log einen Hash hat, ist Maschinenarbeit. Sein Wert liegt im Planen und im Übersetzen für dich. |

### 2.3 Warum die Regeln trotz klarem Text brachen
Alle sechs Verstöße aus dem Auftrag haben dieselbe Form: Die Regel verlangt, dass das Modell sich im richtigen Moment erinnert.

| Verstoß | Beleg | Mechanische Sperre im neuen System |
|---|---|---|
| Fable sah das endgültige SQL vor `db:push` nicht (0059, 0061) | `docs/AUTOPILOT.md:228`, Regel 101 in `:206` | `gate-db`: Freigabe ist an den SHA-256 der Datei gebunden (a2) |
| Logs überschrieben | `docs/AUTOPILOT.md:162` (`tmp/shots` überschrieben), Regel 101 (3) | `run.mjs` öffnet jede Logdatei mit „nur neu anlegen“ (a1) |
| Falsches EXIT (echo statt Testbefehl) | Auftrag; Ursache siehe unten | `run.mjs` schreibt den Exit-Code des Kindprozesses selbst (a1) |
| Wrapper nur beschrieben | Auftrag | Der Befehl steht wörtlich im Log-Kopf, vom Skript geschrieben (a1) |
| e2e nach dem Code geschrieben | `docs/AUTOPILOT.md:215` | Bei R3 verlangt das Merge-Gate einen roten Lauf vor dem ersten grünen (a4). Bei R1 entfällt die Regel (b). |
| Testdaten per SQL über den Namen gelöscht | Auftrag, Regel 101 (2) | Hook sperrt schreibendes SQL außerhalb versionierter Skripte (a5) |

**Der Hook `trim-output.js` ist Mitverursacher**, nicht nur lästig (aus dem Quelltext gelesen, nicht ausgeführt):
- Zeile 30 baut Bash-Befehle um zu `{ <Befehl> ; } 2>&1 | node … --filter; exit ${PIPESTATUS[0]}`. Schreibt die Session nach `CLAUDE.md` `npm run check; echo EXIT=$?`, dann ist der Status der Klammer der von `echo`, also 0. Der Hook macht aus der vorgeschriebenen EXIT-Zeile strukturell ein falsches EXIT.
- Zeile 5 prüft per Muster, ob irgendwo im Befehl `vitest`, `tsc` oder `npx playwright` vorkommt, nicht ob der Befehl damit beginnt. In dieser Session hat er deshalb zwei reine Lese-Befehle (ein `ls`, ein `grep`) auf wenige Zeilen gekürzt, weil ein Dateiname das Wort enthielt.
- Die Doku sagt: Berechtigungsregeln werden gegen den vom Hook zurückgegebenen Befehl geprüft, und jede Teilanweisung einer Kette muss für sich erlaubt sein (hooks, permissions). Die umgebaute PowerShell-Kette enthält `Out-String`, `node …` und `exit`. Das erklärt die ständigen Rückfragen.

---

## 3 · Das neue System

Leitsatz: **Was ein Skript prüfen kann, prüft ein Skript und bricht ab. Text bleibt nur, wo Urteil nötig ist.**
Zweiter Leitsatz: **Ein Lauf, der nicht über das Start-Programm lief, zählt nicht.** Man muss das Umgehen nicht perfekt verhindern, wenn das Umgangene wertlos ist.

### a) Erzwingen statt bitten

Alle Skripte liegen in `scripts/sys/`, die Hook-Datei in `.claude/hooks/`. Der Ordner `.claude/` ist laut Doku ein geschützter Pfad: Schreiben dorthin fragt auch im Auto-Modus nach (permission-modes, „Protected paths“). Der Schrittname ist immer der Branchname.

**a1 · Test-Start-Programm `scripts/sys/run.mjs`**
- Aufruf: `npm run t -- <ziel> [-- <argumente>]`, Ziele `check`, `e2e`, `rls`, `shots`, `build`, oder eine Testdatei.
- Schreibt `tmp/proof/<schritt>/<nnn>-<ziel>.log`: Kopf mit Commit-Hash, „Arbeitsbaum sauber: ja/nein“, Befehl im Wortlaut, Startzeit; dann die ganze Ausgabe; am Ende `EXIT=<Code des Kindprozesses>` und Dauer.
- Die Datei wird mit dem Modus „nur neu anlegen“ geöffnet, die Nummer zählt hoch. Überschreiben ist technisch nicht möglich.
- Hängt eine Zeile an `tmp/proof/<schritt>/runs.jsonl`: Ziel, Befehl, Hash, sauber, EXIT, Dauer, Testzahlen (aus dem JSON-Report), SHA-256 des Logs, Fingerabdruck (siehe c).
- Gibt an Claude nur die letzten 30 Zeilen plus Fehlerzeilen zurück und endet mit dem echten Exit-Code. Das ersetzt den Kürz-Hook und den `test-runner`.
- Nicht versehentlich umgehbar: (1) der Hook a5 sperrt direkte Aufrufe von `vitest`, `playwright test`, `npm run check`, `npm run test:*`; (2) Bericht und Merge-Gate lesen nur `runs.jsonl`.

**a2 · Datenbank-Gate `scripts/sys/gate-db.mjs`**
- `npm run db:antrag`: ermittelt die Migrationen, die noch nicht auf Dev sind, rechnet je Datei SHA-256 und schreibt `tmp/proof/<schritt>/db-antrag-<n>.json`.
- Die Session gibt `advisor-report` nur diesen Antrag. Fable liest die genannten SQL-Dateien ganz und schreibt `db-freigabe-<n>.md`. Kopf: `Modell:`, je Datei `SHA256: <aus dem Antrag abgeschrieben>`, `Urteil: frei` oder `gesperrt`, `Offene Findings hoch: N`.
- `npm run db:push` wird zu `node scripts/sys/gate-db.mjs push && <bisheriger Befehl> && npm run db:types`. Das Gate rechnet die Hashes neu und verlangt je Datei eine Freigabe mit gleichem Hash und `Urteil: frei`. Ein geändertes Zeichen nach der Freigabe sperrt den Push. Danach muss `git diff --exit-code` auf der Typdatei sauber oder committet sein.
- Der Hook a5 lässt Freigabe-Dateien nur schreiben, wenn der Aufruf aus dem Subagent `advisor-report` kommt. Laut Doku tragen Hook-Eingaben in Subagents `agent_type` (hooks).
- Sperren: direkte `supabase db push`, `supabase migration repair` und die Supabase-Connector-Werkzeuge kommen in `deny` (Regel `mcp__<server>` trifft alle Werkzeuge eines Servers, permissions).
- Grenze: Das Gate beweist, dass freigegebene und gepushte Bytes gleich sind. Wie gründlich Fable las, beweist es nicht.
- Dasselbe Gate gilt für Lösch- und Aufräum-Skripte (`tests/support/sweep.ts`, alles mit `delete`).

**a3 · Bericht `scripts/sys/bericht.mjs`**
- Aufruf `npm run bericht`. Schreibt `docs/proof/<schritt>/bericht.json` und `bericht.md` (Format in Abschnitt 5).
- Inhalt nur aus Maschinenquellen: `git`, `runs.jsonl`, Anträge und Freigaben, `session.json` (a6), `supabase migration list`, Stufe (b).
- Kopiert die im Bericht genannten Nachweise byte-genau nach `docs/proof/<schritt>/` (nur neu anlegen) und lässt vorher `scan:proof` laufen. Ungültige Versuche bleiben in `tmp/` und werden im Bericht nur gezählt.

**a4 · Merge-Gate `scripts/sys/fertig.mjs`**
- Aufruf `npm run fertig`. Prüft und führt dann `git merge --ff-only` und `git push` aus:
  1. Arbeitsbaum sauber, Branch von `main`.
  2. Für jede Suite, die die Stufe verlangt: ein Lauf mit `EXIT=0`, sauberem Baum und passendem Fingerabdruck (c).
  3. Alle Commits nach dem geprüften Code-Stand ändern nur `docs/`.
  4. Bei R3: zu jeder neuen Migration eine Freigabe mit passendem Hash; eine Abnahme-Datei mit `Offene Findings hoch: 0`; je neuer Testdatei unter `tests/rls/` ein Lauf mit `EXIT≠0`, der zeitlich vor dem ersten grünen liegt.
  5. `bericht.json` vorhanden und aktuell, `docs/STAND.md` höchstens 40 Zeilen.
- Zweite Sperre: Git-Hook `pre-push` in `.githooks/` (aktiv über `git config core.hooksPath .githooks`, gesetzt durch `npm run prepare`). Er ruft `fertig.mjs --nur-pruefen` für Pushes auf `main`.
- `--no-verify` und `core.hooksPath` umsetzen sperrt der Hook a5.

**a5 · Wächter-Hook `.claude/hooks/guard.mjs`**
- Eintrag in `.claude/settings.json` unter `hooks.PreToolUse`, Matcher `Bash|PowerShell|Write|Edit`, Aufruf in Exec-Form (`"command": "node"`, `"args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"]`), dazu `"onFailure": "block"`.
- Er verweigert nur (`permissionDecision: "deny"`), er erlaubt nie und baut nie Befehle um. Laut Doku blockt ein Deny-Hook immer, während ein Allow-Hook Deny- und Ask-Regeln nicht übersteuert (hooks).
- Verweigert: Testbefehle am Start-Programm vorbei; `supabase db push`/`deploy` direkt; `supabase db query` mit `insert|update|delete|truncate|drop|alter` außerhalb `tests/` und `scripts/`; Umleitungen nach `tmp/proof/` und `docs/proof/`; Schreiben auf vorhandene Dateien in `docs/proof/`; Freigabe-Dateien außerhalb von `advisor-report`; `--no-verify`; `python -` (Memory-Regel).
- Grenze laut Doku: Regeln und Muster treffen die übliche Schreibweise, sie sind „not a security boundary“ (permissions). Gegen Versehen reicht das. Gegen Absicht schützt die zweite Ebene (a1, a4).

**a6 · Sitzungsprotokoll `.claude/hooks/session.mjs`**
- `SessionStart`: schreibt Modell (Feld `model` der Hook-Eingabe, laut Doku optional), Quelle, Zeit nach `tmp/proof/session.json` und meldet es als Zusatzkontext. `SubagentStart`/`SubagentStop`: hängt `agent_type` und Zeit an `agents.jsonl`.
- `UserPromptSubmit`: Beginnt der Prompt mit `/schritt` und passt das protokollierte Modell nicht zur Vorgabe, wird der Prompt geblockt (`decision: "block"`, laut Doku möglich). Der Haiku-Unfall wird so zu einem Fehler vor dem ersten Schritt.
- Unbelegt: ob der Effort in einer Hook-Eingabe steht. Darum wird er nicht abgefragt, sondern gesetzt (h).

**a7 · Feste Berechtigungen statt Bitten** (`.claude/settings.json`)
- `deny` neu: `Agent(general-purpose)`, `Agent(claude)` (laut Doku für eingebaute und eigene Subagents wirksam, sub-agents); der Supabase-Connector; `Edit(./docs/proof/**)`.
- `ask` nur noch für das, was du wirklich sehen willst: `npm run db:push`, `npm run fn:deploy`, `npm run prod:*`, Änderungen an `scripts/sys/**`, `.githooks/**` und `package.json`.
- `ask` entfällt für `git commit`, `git merge`, `git push`, `rm`, `npx dotenv`: Die Gates a4 und a5 tun die Arbeit. `npx dotenv` direkt wird verweigert; `.env`-Werte gehen nur noch über npm-Skripte.

### b) Risikostufen

Die Stufe rechnet `scripts/sys/stufe.mjs` aus den geänderten Pfaden gegen `main`. Sie wird nicht selbst eingeschätzt. Unbekannte Pfade zählen als R3. Hochstufen darf jeder, herabstufen nur du im Prompt (steht dann im Bericht).

| Stufe | Auslöser (Pfade) | Beispiele |
|---|---|---|
| **R0 Doku** | nur `docs/**`, `*.md` | Texte, Pläne, GOLIVE pflegen |
| **R1 Oberfläche** | `src/screens/**`, `src/components/**`, Styles, `tests/e2e/**`, `tests/shots/**` | s9i-7d Kleinteile, Rechtstexte einbauen |
| **R2 App-Logik und Betrieb** | `src/lib/**`, Build, Hosting, `scripts/**` ohne `sys`, Edge Function ohne Geld- und Rechteänderung | N-12, Mail-Einrichtung, Hosting |
| **R3 Vertrauen** | `supabase/migrations/**`, `supabase/functions/**` mit Geld/Rechten/Auth, `_shared/pricing|commission`, `src/lib/money*`, `tests/rls/**`, `tests/support/**`, `scripts/sys/**`, `.claude/**`, Löschen, Personendaten | s9p-1, s9k-1, Belege-Migration, Turnstile |

| Pflicht | R0 | R1 | R2 | R3 |
|---|---|---|---|---|
| Fable-Planprüfung | – | – | – | ja, eine gebündelte Frage |
| Tests zuerst rot | – | – | für neue Logik | ja, per Gate |
| DB-Gate mit Hash | – | – | – | ja |
| `check` | – | ja | ja | ja |
| e2e | – | gezielt, am Ende voll | gezielt, am Ende voll | gezielt; voll nur bei geändertem Fingerabdruck |
| rls voll | – | – | nur bei geändertem Fingerabdruck | ja |
| Live-Test der berührten Funktion | – | – | ja | ja, plus `flow-live` |
| Bildsicht | – | geänderte Screens, 390 und 1280, hell und dunkel; 430 nur in der Schlussrunde | nur bei UI-Änderung | nur bei UI-Änderung |
| Abnahme | – | `reviewer` (Sonnet) | `reviewer` | `advisor-report` (Fable), nur Geld- und Sicherheitsdateien |
| Faktenliste mit Datei:Zeile | – | – | – | ja, im Plan |
| Bericht | maschinell | maschinell + 5 Zeilen | maschinell + 5 Zeilen | maschinell + 5 Zeilen |

Was in R1 genau entfällt: Fable (beide Aufrufe), rls, Rot-Pflicht, Faktenliste, Ausgangslage-Prüfung von Hand (macht `npm run start-schritt`), Migrationslisten, Dauertabellen.

### c) Session-Größe und Takt

**Größe.** Ein Schritt ist ein Ergebnis, das allein auf `main` Sinn ergibt.
- R3: ein Thema, das heißt eine fachliche Änderung mit ihren Migrationen, Functions, Tests und der zugehörigen Oberfläche. Nicht mehr „Server in 7b1, Oberfläche in 7b2“, wenn beides zusammen in den Kontext passt.
- R1: bündeln. Acht kleine UI-Funde sind eine Session, nicht acht.
- Die Grenze bei etwa 150.000 Tokens bleibt. Sie wird seltener erreicht, weil Logs nicht mehr in den Kontext laufen.

**Wann ein Volllauf.** Regel „Merge nur mit grünem Endstand“ bleibt wörtlich. Neu ist die Definition von „grün“:

> Eine Suite ist grün, wenn es einen Lauf mit EXIT=0 gibt, dessen **Fingerabdruck** dem Endstand entspricht.

Der Fingerabdruck ist ein Hash über die Dateien, von denen das Ergebnis der Suite abhängt:
- `check`: alles. Läuft immer (rund 2 Minuten).
- `rls`: `supabase/migrations/**`, `supabase/functions/**`, `supabase/seed.sql`, `tests/rls/**`, `tests/support/**`, `vite.config.ts`, `package-lock.json`.
- `e2e`: `src/**`, `public/**`, `index.html`, `tests/e2e/**`, `playwright.config.ts`, `supabase/functions/_shared/**` (wegen `@pricing`, `@commission`), `package-lock.json`.

Die letzten grünen Fingerabdrücke stehen in `docs/proof/gruen.json` auf `main`. Ändert eine Session nichts an den rls-Dateien, gilt der vorhandene grüne Lauf und das Gate schreibt „rls: übernommen von `<hash>`“. Das ist keine Aufweichung: Derselbe Eingang ergibt denselben Test. Grenze: Der gemeinsame Dev-Stand kann abdriften. Darum läuft rls voll bei jedem R3-Schritt, mindestens einmal je Woche und vor dem Start.

**Innerhalb der Session** nur gezielte Läufe (`npm run t -- tests/rls/x.test.ts`, betroffene Specs). Ein Volllauf je Suite, einmal, am Ende, auf dem Endstand.

**Laufzeiten senken** (erst messen, dann ändern; die Dauertabellen je Datei gibt es schon):
1. **e2e, vermutlich größter Hebel:** `npm run test:e2e` startet die Projekte `e2e` und `e2e-desktop` (`package.json:53`). Laufen alle Specs doppelt, dann die Desktop-Variante auf Specs mit Layout-Bezug beschränken (Tag `@breit`). Erwartung: 17 Minuten werden etwa 9 bis 10. Ob wirklich alles doppelt läuft, ist zu prüfen.
2. **e2e-Worker:** `workers: 2` (`playwright.config.ts:15`) stammt aus der Zeit des Dev-Servers mit `ERR_NO_BUFFER_SPACE`. Seit e2e gegen einen Build läuft, 3 und 4 messen.
3. **rls:** `fileParallelism: false` (`vite.config.ts:30`) wegen Auth-Limits. Die Dateien in zwei Projekte teilen: `rls-tx` (reine Rollback-Proben, keine Auth-Nutzer) mit zwei Arbeitern, `rls-live` (Auth, Wettläufe, Live) weiter nacheinander. Erwartung: 14 Minuten werden 8 bis 9. Risiko: Transportfehler der Management-API nehmen zu; dann zurück auf einen Arbeiter.
4. **Gezielte e2e-Auswahl:** eine kleine Tabelle `tests/e2e/ziele.json` (Quellordner → Specs). `npm run t -- e2e:ziel` liest die geänderten Dateien und startet nur die zugehörigen Specs.

**Empfehlung plus Alternative.** Empfehlung: die vier Punkte oben, lokal. Alternative für später: GitHub Actions führt `check` und e2e bei jedem Push aus, das Merge-Gate fragt das Ergebnis ab. Vorteil: Der Exit-Code kommt von einer Maschine außerhalb der Session, und Linux kennt den Windows-Fehler `ERR_NO_BUFFER_SPACE` nicht. Kosten: eine Session, ein angemeldetes `gh`, Minutenkontingent. Der große Wurf, rls gegen eine lokale Supabase-Instanz in Docker (keine Reste, keine Limits, parallel), lohnt erst nach dem Start.

### d) Tests: die Lücke Mocks ↔ echte Datenbank

Der Fehler 0061 war möglich, weil `partner_accept_basis` nie mit erlaubtem Akteur aufgerufen wurde und eine Zeile liefern musste. Vier Sperren, nach Wirkung je Aufwand geordnet:

1. **Positivzeilen-Register (Pflicht, erzwungen).** `tests/rls/positiv.test.ts` enthält je öffentlicher SQL-Funktion einen Aufruf mit erlaubtem Akteur als Rollback-Probe und prüft mindestens eine gelieferte Zeile samt Spaltentypen. Ein Unit-Test vergleicht die Schlüssel des Registers mit `Database['public']['Functions']` aus `database.types.ts`. Neue Funktion ohne Eintrag: `check` ist rot. Ausnahmen stehen mit Grund in einer Liste im Test.
2. **Typen aus der Datenbank bis in die Mocks.** `db:types` läuft im DB-Gate automatisch (a2). Edge Functions und App nutzen den Client mit `Database`-Typ. Neu: Die e2e-Mocks bekommen einen Helfer `mockRpc<'my_jobs'>(…)`, dessen Rückgabe an `Functions['my_jobs']['Returns']` gebunden ist. Weicht ein Mock von der Datenbank ab, scheitert der Typecheck.
3. **`flow-live` als Pflichtlauf** in jedem R3-Schritt und vor dem Start, plus je Edge Function mindestens ein Live-Aufruf. Offen ist nur `admin-correct` (`docs/AUTOPILOT.md:227`, S9i7c2-2).
4. **Statische Prüfung aller PL/pgSQL-Funktionen** mit der Erweiterung `plpgsql_check` in einem rls-Test (null Fehler). Unbelegt: ob die Erweiterung im Dev-Projekt verfügbar ist und ob sie den Fall 42804 erkennt. In Umstellung u3 zuerst prüfen; wenn nicht, entfällt Punkt 4 ersatzlos.

Nicht empfohlen: e2e gegen Dev statt Mocks. Zu langsam, zu viele Reste, Auth-Limits.

### e) Doku

**Diese Dateien braucht es:**
| Datei | Zweck | Grenze |
|---|---|---|
| `CLAUDE.md` | Produkt in 5 Zeilen, Quellen und Rangfolge, Stack, Befehle, Verweis auf Regeln | höchstens 60 Zeilen |
| `.claude/rules/geld.md`, `daten.md`, `karten.md`, `ui.md`, `tests.md` | die „Festen Regeln“ aus `CLAUDE.md`, je mit `paths:`; sie laden laut Doku nur, wenn Claude an passenden Dateien arbeitet (memory) | je höchstens 40 Zeilen |
| `.claude/skills/schritt/SKILL.md` | der Ablauf je Stufe; ersetzt `SESSION_PROMPTS.md` und den Regelteil der Prompts | höchstens 80 Zeilen |
| `docs/STAND.md` | wo wir stehen, nächster Schritt, was er voraussetzt; ersetzt `WEITER MIT` und den Kopf von `PROGRESS.md` | höchstens 40 Zeilen, wird je Session neu geschrieben, vom Gate geprüft |
| `docs/BEKS.md` | deine offenen Ja/Nein-Fragen | eine Seite |
| `docs/ENTSCHEIDUNGEN.md` | Register: Nr., Datum, Thema, Entscheidung, Status | wird nur bei Bedarf gelesen |
| `docs/OFFEN.md` | nur Offenes, in zwei Gruppen: „Pflicht vor dem Start“, „nach dem Start“ | Erledigtes wird gelöscht, die Historie steht in Git |
| `docs/GOLIVE.md`, `docs/ROADMAP.md` | bleiben | – |
| `docs/S9_KONZEPT.md`, `docs/ARCHITECTURE.md`, `docs/PRICING.md`, `docs/DESIGN_BRIEF.md` | Nachschlagewerke, nur abschnittsweise über `Explore` | – |

**Ins Archiv** (`docs/archiv/`, nichts liest es mehr): `PROGRESS.md` (ersetzt durch `git log` und die Berichte), `AUTOPILOT.md` (Entscheidungen wandern ins Register, Pläne sind umgesetzt), `S9a_PLAN.md`, `S9b_PLAN.md`, `AUDIT_NACHT.md`, `SESSION_PROMPTS.md`.

**Die 123 Entscheidungen** werden einmal sortiert (Umstellung u2):
- **A · Technische Folge** (geschätzt über 100, etwa Nr. 4, 8, 23, 33, 102): ins Register, Status „technisch“. Du musst sie nicht lesen.
- **B · Deine Entscheidung** (geschätzt 10 bis 15: was Kunden, Firmen, Geld oder Recht anders macht, etwa Nr. 3, 104, 106, 119, 122, S9h4-2, GOLIVE 32): als Frage nach `docs/BEKS.md`. Je Frage: ein Satz in einfacher Sprache, Empfehlung, was bei „Nein“ passiert, Aufwand. Du antwortest im Chat mit „1 ja, 2 nein, 3 ja“.
- **C · Aufgabe vor dem Start**: nach `GOLIVE.md`.

Regel für die Zukunft: Eine Session trägt B-Fragen nur in `BEKS.md` ein, der Bericht nennt sie ganz oben. Ändert ein Schritt eine frühere Entscheidung von dir (wie Nr. 104 und Nr. 119), braucht er dein wörtliches Ja im Prompt, sonst hält er an.

### f) Agents

| Agent | Modell | Tools | Aufgabe | Wann |
|---|---|---|---|---|
| Hauptsession | Sonnet 5.5 | alle | baut | immer; Effort hoch bei R3, sonst mittel |
| `advisor` | Fable 5.2 | Read, Grep, Glob | Planprüfung, eine gebündelte Frage | nur R3 |
| `advisor-report` | Fable 5.2 | Read, Grep, Glob, Write | DB-Freigabe (a2) und Abnahme der Geld- und Sicherheitsdateien | nur R3 |
| `reviewer` | Sonnet 5.5 | Read, Grep, Glob, Bash, Write | Abnahme R1/R2, Bildsicht | R1, R2, UI-Teil von R3 |
| `mech-editor` | Haiku 5.5 | Read, Grep, Glob, Edit, Write | mechanische Massenänderung | selten |
| `Explore` | Haiku 5.5 | Read, Grep, Glob | Suche über mehr als zwei Dateien | bei Bedarf |
| `test-runner` | – | – | **entfällt** (a1 ersetzt ihn) | – |

- Die Modelle stehen fest im Frontmatter (`model: claude-fable-5-2`; volle IDs sind laut Doku erlaubt, sub-agents). `general-purpose` und `claude` sind per `deny` gesperrt (a7).
- `maxTurns` im Frontmatter der Berater begrenzt Ausreißer.

**Fable gar nicht:** R0, R1, R2, Faktensuche, Bildsicht, Kontrollrunden ohne hohen Fund, Hauptsession.

**Fable unter 50 % des Wochenlimits.** Deinen heutigen Verbrauch kann ich nicht messen; er steht in `/usage`. Hebel:
1. Höchstens drei Aufrufe je R3-Schritt: Plan, DB-Freigabe, Abnahme. Eine Kontrollrunde nur nach „hoch ≥ 1“.
2. Fable bekommt Dateilisten, nie den ganzen Diff und nie den Verlauf. Die DB-Freigabe ist eine einzelne SQL-Datei.
3. Das eingebaute advisor-Tool ist aus (h). Es schickt laut Doku bei jedem Aufruf die ganze Unterhaltung ungecacht an das Beratermodell (advisor).
4. Bis zum Start sind es etwa 8 R3-Schritte, also rund 24 Fable-Aufrufe in drei Wochen.
5. Notbremse: Steht `/usage` zur Wochenmitte über 40 %, geht die Planprüfung an Opus 5.5 (Aufruf mit `model: opus`). DB-Freigabe und Abnahme bleiben bei Fable.

**Claude im Chat** bleibt für drei Dinge: den nächsten Schritt mit dir planen, den 10-Zeilen-Prompt schreiben, den Bericht bewerten. Die Regelprüfung gibt er an die Gates ab.

### g) Prompts und Berichte

Der Prompt enthält nur noch, was sich je Schritt ändert. Der Ablauf steht im Skill `/schritt`; laut Doku erscheinen Projekt-Skills in der Desktop-App nach Eingabe von `/` (desktop). Vorlage und Berichtsformat: Abschnitt 5.

Prüfung des Berichts durch Claude im Chat in zwei Minuten:
1. Zeile „Gate“ steht auf `bestanden`. Wenn nicht: zurück, ohne weiterzulesen.
2. Stufe und geänderte Bereiche passen zum Auftrag.
3. „Abweichungen vom Auftrag“ und „Neue Fragen an Beks“ lesen. Das ist der einzige Teil, der Urteil braucht.
4. Nächster Schritt plausibel.

### h) Umgebung

| Thema | Vorschlag | Beleg in der Doku |
|---|---|---|
| **Auto-Modus** | Als Standard setzen: `"permissions": {"defaultMode": "auto"}` in `~/.claude/settings.json`. In der Projektdatei wirkt der Wert nicht. In der Desktop-App zusätzlich im Modus-Wähler unter dem Eingabefeld sichtbar. | permission-modes: „This value doesn't take effect from `.claude/settings.json`“; desktop |
| Grenzen des Auto-Modus | Er ist keine Sicherheitsgarantie („does not guarantee safety“). Deny-Regeln gelten in jedem Modus, Ask-Regeln fragen weiter. Allow-Regeln für `npm run …` werden im Auto-Modus fallen gelassen, der Klassifizierer entscheidet. Er blockt von sich aus „Production deploys and migrations“ und Force-Push. Nach 3 Blocks in Folge fragt Claude Code wieder. | permission-modes |
| Offene Frage | Ob der Klassifizierer `npm run db:push` gegen Dev als fremde Infrastruktur blockt, zeigt erst der Versuch. Wenn ja: Dev-Projekt in `autoMode.environment` eintragen. | permission-modes, auto-mode-config |
| **Berechtigungsregeln** | Liste aus a7. Wichtig: Jede Teilanweisung einer Kette muss erlaubt sein, in Bash wie in PowerShell. Darum npm-Skripte statt Ketten. | permissions, „Compound commands“ |
| **`trim-output.js`** | Für MoveNow abschalten. Einfachster Weg: am Anfang des Hook-Zweigs eine Zeile, die bei `cwd` mit `MoveNow` sofort endet. `run.mjs` kürzt an der Quelle. Alternative: Hook ganz entfernen und `bashOutputMaxChars` senken. | hooks (Regeln gelten für den umgebauten Befehl); env-vars |
| **advisor-Tool** | `"env": {"CLAUDE_CODE_DISABLE_ADVISOR_TOOL": "1"}` in `~/.claude/settings.json`, zusätzlich einmal `/advisor off`. Probe: `/advisor` eintippen; laut Doku ist der Befehl dann nicht mehr verfügbar. Subagents erben sonst den eingestellten Berater. Stand heute: In dieser Session stand das Tool in meiner Liste, die Variable ist also nicht gesetzt. | advisor, env-vars |
| Variablen in der Desktop-App | Der `env`-Schlüssel in `~/.claude/settings.json` gilt für lokale Sessions. Ein Wert, den die App schon selbst setzt, gewinnt. | desktop, env-vars |
| **Modell und Effort** | Modell im Wähler der App, Vorgabe `"model"` in `.claude/settings.json`. Der Hook a6 protokolliert und blockt bei falschem Modell. Effort: `effortLevel` in den Settings, im Wähler unter „Effort“ je Session; Tastenkürzel Strg+Umschalt+E. | desktop, model-config, hooks |
| **Start einer Session** | Neue Session, Ordner MoveNow, `/schritt <name>` plus die Zeilen der Vorlage. Kein Lesen von Startdateien von Hand. | desktop, skills |
| Zwei Sessions zugleich | Möglich mit „Worktree“ in der App. Erlaubt nur: eine R3 und daneben eine R0/R1 ohne Datenbank. Die zweite braucht vor dem Merge einen Rebase und `check`. Nicht als Standard, erst nach dem Probe-Schritt. | desktop, worktrees |

### i) Weg zum Start

Annahme: Start heißt Web-App (PWA). App Store und Capacitor (GOLIVE 20) kommen danach.

**Sofort und parallel, bei dir (kritischer Pfad):**
- Vorgabe für die Provisionsstaffel schriftlich. `CLAUDE.md` kennt nur 15 % fest; in den Dokumenten steht das Wort „Staffel“ nur als Name des Schritts.
- Rechtstexte: AGB, Datenschutz, Impressum, Partnerbedingungen, Pauschale (GOLIVE 19, 30, 32, 33).
- Mail-Anbieter mit Absender-Domain (GOLIVE 14), Routing-Vertrag ORS (11), Hosting (21), Turnstile-Konto (13, 18, 26), Produktivprojekt anlegen (1 bis 4).
- Antworten auf `docs/BEKS.md`, sobald die Seite steht.

**Reihenfolge der Sessions:**
| # | Schritt | Stufe | Sessions | Hängt an |
|---|---|---|---|---|
| 0 | Umstellung u1 bis u3 (Abschnitt 6) | – | 3 | – |
| 1 | **s9p-1** Provisionsstaffel (Migration ab 0062, Cast aus 0061 übernehmen) | R3 | 1–2 | Vorgabe von dir |
| 2 | **s9k-1** Meldung „nicht stattgefunden“ als ein Zustandsablauf (S9i3-1, S9i6b-3, dazu S9i4-1, S9i4-3) | R3 | 1–2 | – |
| 3 | **N-12** Doppelanfrage nach verlorener Antwort (GOLIVE 23, Blocker) | R2 | 1 | – |
| 4 | Belege-Migration S9i7-12 und Kontaktsperre S9i7-10 (c) | R3 | 1 | dein Ja zu Nr. 122 |
| 5 | **s9i-7d** Kleinteile und übrige UI-Funde, gebündelt | R1 | 1 | – |
| 6 | **Mailversand:** Einrichtungsskript, Live-Test, Texte | R2 | 1 | Mail-Anbieter |
| 7 | Härtung: Turnstile (route, Anmeldung, Partner-Registrierung), Limits, Advisor-Warnungen | R3 | 2 | Turnstile-Konto |
| 8 | **Produktivprojekt:** Skripte `prod:*`, Migrationen, Seed, Grenzen, Secrets, Auth-Werte (GOLIVE 5 bis 18, 24 bis 31) | R3 | 1–2 | Projekt, Schlüssel, du am Dashboard |
| 9 | **Hosting:** Build, Domain, CORS, `golive-check` | R2 | 1 | Hosting-Entscheidung |
| 10 | Rechtstexte und Partnerbedingungen einbauen | R1 | 1 | Texte |
| 11 | Abnahme: Preis-Stichproben, `shots:all`, Lighthouse, Probebetrieb mit geschlossenem Schalter, dann `booking_open` | R3 | 1–2 | alles davor |

Die Firmen-Anonymisierung S9h4-1 empfehle ich nicht vor dem Start: bei wenigen Partnern von Hand, Bau danach. Alternative: als Schritt 4b mit ein bis zwei Sessions.

**Dauer, ehrlich:**
- Heute: etwa ein kleiner Schritt je Session (Auftrag, Punkt 2); am 12. und 13.11. je 28 Commits, viele davon Zwischenstände (`git log`). Mit dem alten System schätze ich 14 bis 18 Schritte auf vier bis sechs Wochen.
- Neu: eine R3-Session etwa zwei bis drei Stunden (davon rund 30 Minuten Läufe), eine R1-Session eine bis anderthalb. Zwei bis drei Sessions je Tag sind machbar.
- Ergebnis: Umstellung 2 Tage, danach 14 bis 18 Sessions in 7 bis 10 Arbeitstagen. **Technisch startklar in zwei bis drei Wochen**, wenn deine Punkte rechtzeitig da sind. Diese Zahl ist eine Schätzung; der Probe-Schritt (s9p-1) zeigt, ob sie hält.

### j) Umstellung

Grundsatz: Nichts Altes wird entfernt, bevor das Neue einmal grün gelaufen ist. `main` ist sauber, s9i-7c2 ist gemergt, kein Schritt ist halb fertig. Die Zweige `nacht-*` bleiben unberührt. Rückweg jederzeit: `git revert` der Umstellungs-Commits und die zwei Zeilen in `~/.claude/settings.json` zurück.

| Schritt | Wer | Inhalt | Fertig, wenn |
|---|---|---|---|
| **u0** | Beks, 15 Minuten | `~/.claude/settings.json`: `env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, `defaultMode: auto`; `/advisor off`; eine Zeile in `trim-output.js`; `/usage` notieren | `/advisor` ist nicht mehr verfügbar; Modus-Wähler zeigt Auto |
| **u1** | Session | `scripts/sys/*`, `.claude/hooks/*`, `.githooks/pre-push`, npm-Skripte, `settings.json` (a1 bis a7). Jedes Gate mit Selbsttest: Es muss nachweislich sperren (Hash geändert, EXIT gefälscht, Log vorhanden). Die alten npm-Skripte bleiben. | `check` grün; je Gate ein Rot-Beweis mit Ist-Wert; Fable-Abnahme von `gate-db` und `guard` |
| **u2** | Session | Doku-Umbau nach e: `CLAUDE.md` kurz, Regeln, Skill, `STAND.md`, Register, `BEKS.md`, `OFFEN.md`, Archiv. `test-runner` löschen. | Gate akzeptiert `STAND.md`; `BEKS.md` hat höchstens 15 Fragen |
| **u3** | Session | Testlücke nach d: Positivzeilen-Register, getypte Mocks, Probe `plpgsql_check`. Funde werden eigene R3-Schritte. | `check` rot bei Funktion ohne Registereintrag (Rot-Beweis), danach grün |
| **u4** | Session, optional | Laufzeiten nach c: Desktop-Tag, Worker, rls-Teilung, je mit Messung vorher und nachher | Tabelle vorher/nachher; drei Läufe in Folge grün |
| **Probe** | Session | s9p-1 mit dem neuen System. Zeit und Zahl der Rückfragen notieren. | Vergleich mit s9i-7c2 |

u4 kann nach der Probe laufen. u1 ändert Einstellungen und Hooks; das erlaubst du im Prompt von u1 ausdrücklich.

---

## 4 · Dateien und Skripte als Entwurf

| Pfad | Zweck | Aufruf |
|---|---|---|
| `scripts/sys/run.mjs` | Test-Start-Programm, Log, `runs.jsonl` | `npm run t -- <ziel>` |
| `scripts/sys/fingerabdruck.mjs` | Hash je Suite über Glob-Listen | von `run`, `fertig` |
| `scripts/sys/stufe.mjs` | Risikostufe aus Pfaden | von `bericht`, `fertig`, `start-schritt` |
| `scripts/sys/gate-db.mjs` | Antrag, Prüfung der Freigabe | `npm run db:antrag`, `npm run db:push` |
| `scripts/sys/bericht.mjs` | `bericht.json`, `bericht.md`, Nachweise kopieren | `npm run bericht` |
| `scripts/sys/fertig.mjs` | Merge-Gate, ff-Merge, Push | `npm run fertig` |
| `scripts/sys/start-schritt.mjs` | Ausgangslage prüfen, Branch anlegen, `STAND.md` und Stufe ausgeben | `npm run start-schritt -- <name>` |
| `.claude/hooks/guard.mjs` | Wächter (nur verweigern) | Hook `PreToolUse` |
| `.claude/hooks/session.mjs` | Modell und Agents protokollieren, falsches Modell blocken | Hooks `SessionStart`, `SubagentStart`, `SubagentStop`, `UserPromptSubmit` |
| `.githooks/pre-push` | zweite Sperre vor `main` | Git |
| `.claude/skills/schritt/SKILL.md` | Ablauf je Stufe | `/schritt <name>` |
| `.claude/rules/*.md` | feste Regeln, pfadgebunden | lädt Claude Code |
| `tests/unit/sys-*.test.ts` | Selbsttests der Gates | in `check` |

**`run.mjs` (Pseudocode)**
```js
const ZIELE = { check: 'npm run check:roh', e2e: 'npm run e2e:roh', rls: 'npm run rls:roh', /* … */ };
const schritt = git('branch --show-current');
const hash = git('rev-parse --short HEAD');
const sauber = git('status --porcelain') === '';
const befehl = ZIELE[ziel] ?? dateiBefehl(ziel);          // unbekanntes Ziel: Abbruch mit 2
const nr = naechsteNummer(`tmp/proof/${schritt}`);        // 001, 002, …
const log = open(`tmp/proof/${schritt}/${nr}-${ziel}.log`, 'wx');   // wx = nur neu anlegen
log.write(`Commit: ${hash}\nArbeitsbaum sauber: ${sauber ? 'ja' : 'nein'}\nBefehl: ${befehl}\nStart: ${jetzt()}\n---\n`);
const kind = spawn(befehl, { shell: true });               // Ausgabe nur ins Log
const code = await ende(kind);
log.write(`---\nDauer: ${sek} s\nEXIT=${code}\n`);
append(`tmp/proof/${schritt}/runs.jsonl`, { nr, ziel, befehl, hash, sauber, exit: code, sek,
  tests: ausReport(ziel), logSha: sha256(log), abdruck: fingerabdruck(ziel) });
print(fehlerzeilen(log, 20), letzteZeilen(log, 30), `Log: ${log.path}`, `EXIT=${code}`);
process.exit(code);
// ponytail: kein Parallelstart, keine Wiederholung. Wiederholen entscheidet die Session, jeder Versuch bleibt als Datei.
```

**`gate-db.mjs` (Pseudocode)**
```js
import './../dev-guard.mjs';                                // bricht ab, wenn Ref ≠ Dev
const offen = lokaleMigrationen().filter(m => !remote.has(m.version));
if (modus === 'antrag') schreibe(`db-antrag-${n}.json`, offen.map(m => ({ datei: m.pfad, sha256: sha256(m.pfad) })));
if (modus === 'push') for (const m of offen) {
  const f = freigaben().find(f => f.sha256.includes(sha256(m.pfad)));
  if (!f) fail(`Keine Freigabe für ${m.pfad} (${sha256(m.pfad)})`);
  if (f.urteil !== 'frei' || f.hoch !== 0) fail(`Freigabe ${f.datei}: ${f.urteil}, hoch ${f.hoch}`);
}
```

**`guard.mjs` (Pseudocode)**
```js
const e = JSON.parse(stdin);  const cmd = e.tool_input?.command ?? '';  const pfad = e.tool_input?.file_path ?? '';
const nein = g => out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: g } });
if (/\b(vitest|playwright test)\b|npm run (check|test:\w+)\b/.test(cmd) && !/scripts\/sys\/run\.mjs|npm run t\b/.test(cmd)) nein('Tests nur über npm run t');
if (/supabase\s+(db push|functions deploy|migration repair)/.test(cmd)) nein('Nur über npm run db:push bzw. fn:deploy');
if (/supabase\s+db query/.test(cmd) && /\b(insert|update|delete|truncate|drop|alter)\b/i.test(cmd)) nein('Schreibendes SQL nur über versionierte Skripte');
if (/--no-verify|core\.hooksPath/.test(cmd)) nein('Git-Hooks bleiben an');
if (/>\s*\S*(tmp|docs)[\\/]proof/.test(cmd)) nein('Nachweise schreibt nur run.mjs');
if (/db-freigabe-/.test(pfad) && e.agent_type !== 'advisor-report') nein('Freigaben schreibt nur advisor-report');
if (/docs[\\/]proof[\\/]/.test(pfad) && exists(pfad)) nein('Nachweise sind unveränderlich');
// sonst: nichts ausgeben, Exit 0 = normaler Berechtigungsweg
```

**`fertig.mjs` (Pseudocode)**
```js
const stufe = stufeAus(git('diff --name-only main...HEAD'));
const pflicht = { R0: [], R1: ['check', 'e2e'], R2: ['check', 'e2e', 'rls'], R3: ['check', 'e2e', 'rls'] }[stufe];
for (const s of pflicht) {
  const ok = runs.find(r => r.ziel === s && r.exit === 0 && r.sauber && r.abdruck === fingerabdruck(s))
          ?? gruenAufMain[s]?.abdruck === fingerabdruck(s);
  if (!ok) fail(`${s}: kein grüner Lauf für den Endstand`);
}
if (stufe === 'R3') pruefeFreigaben(), pruefeAbnahme(), pruefeRotVorGruen();
if (zeilen('docs/STAND.md') > 40) fail('STAND.md zu lang');
if (!nurPruefen) { git('checkout main'); git(`merge --ff-only ${branch}`); git('push'); }
```

**`.claude/settings.json` (Ausschnitt, Feldnamen in u1 gegen die Hook-Seite prüfen)**
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash|PowerShell|Write|Edit", "hooks": [
      { "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"], "onFailure": "block" }
    ]}],
    "SessionStart": [{ "hooks": [
      { "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session.mjs"] }
    ]}]
  },
  "permissions": {
    "deny": ["Agent(general-purpose)", "Agent(claude)", "mcp__d7859db5-7e7e-4e6b-a9d5-ae276b32608a", "Edit(./docs/proof/**)"],
    "ask": ["Bash(npm run db:push*)", "Bash(npm run fn:deploy*)", "Bash(npm run prod:*)", "Edit(./scripts/sys/**)", "Edit(./.githooks/**)", "Edit(./package.json)"]
  }
}
```
Die bestehenden `deny`-Einträge für `.env`, `sed`, `node -e`, `git reset` und Verwandte bleiben. Jede Regel braucht ihr PowerShell-Gegenstück.

**`.claude/rules/geld.md` (Kopf)**
```markdown
---
paths:
  - "supabase/**"
  - "src/lib/money*"
  - "tests/rls/**"
---
Beträge als Integer-Cent. … (die acht Geldregeln aus CLAUDE.md, unverändert)
```

---

## 5 · Standard-Prompt und Berichtsformat

**Prompt (Vorlage)**
```
/schritt s9p-1
Ziel: Provisionsstaffel nach der Vorgabe unten statt festem Satz.
Umfang: Migration ab 0062, Journal, flow-live-Konstanten. Nicht Teil: Oberfläche, Rechnung.
Vorgabe von Beks (wörtlich): …
Entscheidungen von Beks: Nr. 122 ja.
Besonderheiten: Cast ::bigint aus 0061 übernehmen.
```
Sechs bis zehn Zeilen. Kein Modell-Check, keine Regeln, keine Berichtspunkte: Das erledigen Hook, Skill und Skripte.

**Skill `/schritt` (Kern)**
```
1. npm run start-schritt -- <name>      (bricht ab, wenn main nicht sauber oder Modell falsch)
2. Stufe lesen. Bei R3: Fakten mit Datei:Zeile, Plan, eine Frage an advisor.
3. Tests schreiben. Bei R3 zuerst rot (npm run t -- <datei>).
4. Bauen, höchstens 5 Runden. Nur gezielte Läufe.
5. Migration: npm run db:antrag → advisor-report → npm run db:push.
6. UI: npm run t -- shots, reviewer.
7. Abnahme nach Stufe.
8. Endstand committen. npm run t -- check | e2e | rls nach Stufe.
9. docs/STAND.md neu, BEKS.md und OFFEN.md ergänzen. npm run bericht. npm run fertig.
10. Antwort im Chat: bericht.md, sonst nichts.
```

**Bericht `docs/proof/<schritt>/bericht.md`**
```
Schritt s9p-1 · Stufe R3 (aus Pfaden) · Gate: bestanden
Modell: claude-sonnet-5-5 (Hook) · Berater: advisor 1×, advisor-report 2×
Code-Stand: a1b2c3d (sauber) · main vorher: 364aeb7 · Commits: 6
Geändert: migrations 1 · functions 2 · src 3 · tests/rls 2 · tests/unit 1 · docs 4

Läufe auf dem Endstand
  check  EXIT=0  1251 Tests   118 s  → 014-check.log
  e2e    übernommen von 364aeb7 (Fingerabdruck gleich)
  rls    EXIT=0   362 Tests   801 s  → 015-rls.log
  Rot vor Grün: tests/rls/staffel.test.ts  007 EXIT=1 → 011 EXIT=0
  Versuche gesamt: 15, davon rot 4 (bleiben in tmp/)

Datenbank
  0062_fee_tiers.sql  SHA256 9f2c…  Freigabe db-freigabe-2.md: frei, hoch 0
  migration list: 62 lokal = 62 remote · db:types ohne Diff

Abnahme: s9p-1-abnahme.md · Offene Findings hoch: 0 · mittel 2 (1 behoben, 1 in OFFEN.md)

Bewertung (von der Session, höchstens 5 Zeilen)
  Gebaut: …
  Abweichungen vom Auftrag: keine | …
  Neue Fragen an Beks: keine | BEKS.md Nr. …
  Offen: …
  Nächster Schritt: …
```
Alles über „Bewertung“ erzeugt das Skript. `bericht.json` enthält dasselbe maschinenlesbar.

---

## 6 · Umstellungsplan mit Modell und Effort

| Schritt | Modell | Effort | Stufe (alt geprüft) | Dauer | Fable |
|---|---|---|---|---|---|
| u0 Einstellungen | Beks | – | – | 15 min | – |
| u1 Gates und Hooks | Sonnet 5.5 | hoch | wie R3, weil die Gates künftig Geld und Rechte schützen | 1 Session | Abnahme `gate-db.mjs`, `guard.mjs`, `fertig.mjs` (1 Aufruf) |
| u2 Doku-Umbau | Sonnet 5.5, `mech-editor` für das Verschieben | mittel | R0 | 1 Session | `advisor` prüft nur die B-Liste für `BEKS.md` (1 Aufruf) |
| u3 Testlücke | Sonnet 5.5 | hoch | R3 | 1 Session | Planprüfung (1 Aufruf); Abnahme nur bei Funden |
| u4 Laufzeiten (optional) | Sonnet 5.5 | mittel | R2 | 1 Session | – |
| Probe s9p-1 | Sonnet 5.5 | hoch | R3, neues System | 1–2 Sessions | 3 Aufrufe |

Reihenfolge fest: u0 → u1 → u2 → u3 → Probe. u1 läuft noch nach den alten Regeln mit einem kurzen Prompt, der auf dieses Dokument verweist. Ab u2 gilt `/schritt`.

---

## 7 · Risiken und wie sie abgefangen werden

| Risiko | Abfangen |
|---|---|
| Ein Gate hat einen Fehler und meldet fälschlich grün | Selbsttests in `check` mit Rot-Beweis je Sperre (u1); Fable-Abnahme der drei Gate-Dateien |
| Ein Gate blockiert zu Unrecht und die Arbeit steht | Du kannst jeden Befehl selbst im Terminal ausführen. Einen Schalter zum Abschalten gibt es bewusst nicht. |
| Die Session schwächt ein Gate ab | `scripts/sys/**`, `.githooks/**`, `package.json` stehen auf `ask`; `.claude/` ist geschützter Pfad; jede Änderung dort erzwingt R3 und steht im Bericht in der ersten Zeile |
| Umgehung über eine andere Schreibweise des Befehls | Laut Doku sind Regeln keine Sicherheitsgrenze. Darum zählt nur, was in `runs.jsonl` steht, und `pre-push` prüft unabhängig. |
| Fingerabdruck-Regel übersieht eine Abhängigkeit | Listen bewusst weit; Zweifelsfall = Volllauf; rls voll bei jedem R3, wöchentlich und vor dem Start |
| Auto-Modus lässt etwas Gefährliches durch | Harte Sperren sind `deny`, Hook und `dev-guard`, nicht der Klassifizierer. Produktion nur über `prod:*` mit `ask`. |
| Auto-Modus blockt Routine (Dev-Push) | In u1 testen; `autoMode.environment`; sonst für diese Befehle `ask` und ein Klick |
| Freigabe wird erteilt, ohne dass Fable gründlich las | Mechanisch nicht beweisbar. Abgefedert durch die Abnahme am Ende und `flow-live`. |
| Größere Schritte sprengen den Kontext | Logs laufen nicht mehr in den Kontext; die 150.000er-Regel bleibt; R3 bleibt bei einem Thema |
| Weniger Text führt zu weniger Sorgfalt bei Geld | Die Geldregeln bleiben wörtlich, nur an anderer Stelle (`rules/geld.md`); R3 behält den vollen Ablauf |
| Die Stufe wird falsch berechnet | Unbekannte Pfade sind R3; Herabstufen nur mit deinem Wort; Tabelle wird in u1 getestet |
| Angaben der Doku stimmen für deine Version nicht | u0 und u1 prüfen jede Einstellung einmal praktisch (Probe je Zeile in h); Versionsnummer in den Bericht |
| Die Umstellung kostet mehr als sie bringt | Nach der Probe s9p-1 Zeit und Rückfragen mit s9i-7c2 vergleichen. Bringt es nichts: u2 zurücknehmen, die Gates aus u1 bleiben nützlich. |
| Schätzung „zwei bis drei Wochen“ hält nicht | Sie hängt an deinen Punkten und an u3: Findet das Positivzeilen-Register weitere Fehler wie 0061, kommen R3-Schritte dazu. Besser jetzt als nach dem Start. |

---

## 8 · Quellen

Abgerufen am 2026-11-14. Lange Seiten wurden in Teilen gelesen; wo ein Teil fehlte, steht im Text „unbelegt“.

| Kürzel im Text | URL | Wofür |
|---|---|---|
| permission-modes | https://code.claude.com/docs/en/permission-modes | Auto-Modus, `defaultMode`, Klassifizierer, geschützte Pfade |
| auto-mode-config | https://code.claude.com/docs/en/auto-mode-config | `autoMode.environment` (nur verlinkt, nicht gelesen) |
| permissions | https://code.claude.com/docs/en/permissions | Regelsyntax, Ketten, PowerShell, MCP- und `Agent(...)`-Regeln, Grenzen von Bash-Regeln |
| hooks | https://code.claude.com/docs/en/hooks | Ereignisse, `permissionDecision`, `updatedInput`, `agent_type`, `SessionStart`, `UserPromptSubmit`, `Stop`, Windows |
| sub-agents | https://code.claude.com/docs/en/sub-agents | Frontmatter, Modellwahl, `maxTurns`, Sperren eingebauter Agents |
| advisor | https://code.claude.com/docs/en/advisor | eingebautes advisor-Tool, `/advisor off`, Vererbung an Subagents, Kosten |
| env-vars | https://code.claude.com/docs/en/env-vars | `CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, `CLAUDE_CODE_EFFORT_LEVEL`, `env` in den Settings |
| desktop | https://code.claude.com/docs/en/desktop | Modus-Wähler, Modell und Effort, Variablen, Skills über `/`, Worktree |
| memory | https://code.claude.com/docs/en/memory | CLAUDE.md als Kontext, unter 200 Zeilen, `.claude/rules/` mit `paths:` |
| model-config, skills, worktrees | https://code.claude.com/docs/en/model-config · https://code.claude.com/docs/en/skills · https://code.claude.com/docs/en/worktrees | nur als Verweis, nicht gelesen |
| Index | https://code.claude.com/docs/llms.txt | Seitenliste |

Nicht aus der Doku, sondern aus dem Repo abgeleitet und nicht ausgeführt: das EXIT-Verhalten von `trim-output.js` (2.3), die Doppelausführung von e2e (c), die Zahl der B-Entscheidungen (e), alle Zeitschätzungen (c, i).
