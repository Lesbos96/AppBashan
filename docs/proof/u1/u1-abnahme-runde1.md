Modell: claude-fable-5-2
SHA256: e8a8b88687166534bc49421c5b160182e4338fd041e31cda55f2cc405ef5073f .claude/hooks/guard.mjs
SHA256: c2bbaa60e25c674821d13005d70f24d74f36f83fe1b273c0af8d58469d3e16f1 .claude/hooks/session.mjs
SHA256: 8a843c484c140d6bcad8bdb5935c6d19971f9e36a8c6aeebf0c7ef7b61b5a8c1 scripts/sys/run.mjs
SHA256: e96107c05338ba981636aa6d3651beecdb1962912542569b735dfe4aaec4ac2b scripts/sys/lib.mjs
SHA256: caa2aefb45edb787a5ea3f2feb10322d83481c319059e57b95d9b112d71c1640 scripts/sys/fingerabdruck.mjs
SHA256: 1244266484ea4fc8e816cd5c29daef3ed7e8d7718551cf936eafbb982195f640 scripts/sys/stufe.mjs
SHA256: b6226579020b2209d69729311f48adee8af91563af0dac2ca5457bf74e7316fe scripts/sys/gate-db-lib.mjs
SHA256: 989276cd56dc21baad7de9563a42989c1d279f7c033a9b04e62643252cf9db34 scripts/sys/gate-db.mjs
SHA256: af5785be45a475e29c6fe50659f4c3c56d5c8edbec3f34a7c97475f5f7d33c95 scripts/sys/fertig.mjs
SHA256: 38555f57d8c0532e731e915f7b3a2d3c4fe075f9d62dbce4b0c391e84149c10f scripts/sys/bericht.mjs
SHA256: 72d715cef4c01610e0975a50a36aa079f35aeaff5dd4d04a34c4fdf3a9b1d47f scripts/sys/start-schritt.mjs
SHA256: 4bd54346d3cd50b6670cf2ee0a4e4e38301ee4656b4ca6978c303abcb4fbed79 .githooks/pre-push
SHA256: d29055f69c5966db6b33a76903db7d32e6df9241638ac4f0ee27b39f9d881921 package.json
SHA256: 88ef95815c26aa91f5f796d688978a8bf8902e158725ad72728afedcff688aad .claude/settings.json

# Abnahme u1 (Kennung u1-1411-a) · Gates und Hooks

Datum: 2026-11-14. Entscheidung: nicht abgenommen, zwei hohe Findings (H1, H2). Beide sind kleine Korrekturen; danach neue Abnahme, weil sich die Hashes ändern.

Umfang: die 14 Dateien oben (für `.claude/settings.json` der Entwurf `tmp/proof/u1-settings-entwurf.json`), `tests/unit/sys-*.test.ts`, `scripts/sys/fixtures/`, `CLAUDE.md` Zeilen 3 bis 8, `.claude/agents/test-runner.md`. Maßstab: `tmp/proof/u1-fable-plan.md`, `tmp/proof/u1-plan.md`, `docs/SYSTEM_VORSCHLAG.md` 3 a, 3 b, 4, 7.

Grenzen dieser Prüfung
- Ich habe nur Read, Grep, Glob, Write. Kein Befehl ausgeführt, kein Hash nachgerechnet, keine Doku im Netz abgerufen. Die SHA-Zeilen sind aus dem Antrag abgeschrieben; ob die gelesenen Bytes dazu passen, belegt erst der Vergleich in `fertig`.
- Während der Prüfung änderte sich der Arbeitsbaum: `docs/BEKS_EINRICHTUNG.md`, `scripts/sys/fixtures/push-main.mjs` und `tmp/proof/u1/018-cmd.log` fehlten beim ersten Lesen und waren später da. Geprüft ist der Stand zum jeweiligen Lesezeitpunkt.
- Das eingebaute advisor-Tool steht weiter in meiner Tool-Liste. Nicht benutzt, keine Subagents gestartet.

## Findings hoch

H1 · `scripts/sys/gate-db-lib.mjs:11-15` – Die Formprüfung greift nur auf der obersten Ebene. Einträge ohne die Schlüssel `local`/`remote` (andere CLI-Version, umbenannte Felder) oder eine leere Liste trotz vorhandener Dateien ergeben „offen = []“. `gate-db.mjs:59-66` meldet dann „frei (0 offene)“ und `package.json:69` pusht alle offenen Migrationen ungeprüft. Auflage 6 verlangte hier Exit 1. Heute passt die Form (Beleg: `.claude/settings.local.json:103,117`), der Fehlerfall ist aber fail-open. – Fix: je Eintrag `typeof local === 'string' && typeof remote === 'string'`, sonst werfen. Gegenprobe: jede Version aus `<dir>/*.sql` muss als `local` in der Liste stehen, sonst werfen. Zwei Tests in `sys-gate-db.test.ts` (fremde Schlüssel; leere Liste bei vorhandener Datei), beide Exit 1.

H2 · `.claude/hooks/guard.mjs:29,41` – Regel 3 (schreibendes SQL) wird je Segment geprüft, und getrennt wird auch innerhalb von Anführungszeichen an `;` und Zeilenumbruch. `db query "select 1; delete from public.x"` zerfällt in ein Segment mit `db query` ohne Schreibwort und eines mit Schreibwort ohne `db query`; beides läuft durch. Dasselbe bei jedem mehrzeiligen SQL, also der üblichen Form. Gesperrt wird nur die einzeilige Einzelanweisung (`sys-guard.test.ts:39-40` testet nur diese). Auflage 8 („im ganzen Befehl“) ist für Regel 3 nicht erfüllt. Im PowerShell-Werkzeug fehlt dafür zusätzlich jede `ask`-Regel (M9). – Fix: Regel 3 vor der Segmentschleife auf den ganzen Befehl anwenden (`db query` irgendwo und Schreibwort irgendwo). Wortliste um `create`, `grant`, `revoke`, `comment`, `call`, `copy` ergänzen; `db query` mit `--file`/`-f` sperren (Inhalt unsichtbar). Tests: Mehrfachanweisung und mehrzeiliges SQL, je Bash und PowerShell.

## Findings mittel

M1 · `scripts/sys/gate-db.mjs:61-65`, `scripts/sys/fertig.mjs:19-22,110` – Die Marke `db-push` entsteht vor dem eigentlichen Push und nur, wenn gepusht wird. Scheitert der Push oder findet er nie statt, zählt ein rls-Lauf gegen das alte Schema; `fertig` verlangt für neue Migrationen keine Marke. – Fix: Marke erst nach Erfolg schreiben (dritter Schritt in `db:push`, der die Liste neu holt und „offen = []“ verlangt). `fertig` verlangt je neuer Migration eine Marke, die ihren Pfad nennt (steht schon im Feld `migrationen`).

M2 · `scripts/sys/fertig.mjs:96,110` – `--diff-filter=A` erfasst nur neue Migrationen. Eine geänderte Altmigration braucht keine Freigabe und ist für `gate-db` nicht offen; der Inhalt käme später ungeprüft aus der Datei nach Produktion. – Fix: `AM` für `supabase/migrations`.

M3 · `scripts/sys/fertig.mjs:44-45,113` – Die Abnahme bindet nur die Dateien, die sie selbst nennt. Eine R3-Datei, die im Antrag fehlt oder nach der Abnahme dazukommt (Edge Function, `tests/support`, `src/lib/money*`), lässt die Abnahme gültig. – Fix: Mindestmenge mechanisch verlangen: jeder geänderte Pfad unter `supabase/functions`, `src/lib/money*`, `scripts/sys/*.mjs`, `.claude/hooks`, `.claude/settings.json`, `.githooks` braucht eine SHA-Zeile; übrige R3-Pfade ohne Zeile listet `bericht.md`.

M4 · `scripts/sys/bericht.mjs:11,57`, `scripts/sys/fertig.mjs:53` – `bericht` rechnet mit `schrittPruefen: false`. Ein R3-Schritt ohne Abnahme, Freigabe oder Rot-Lauf bekommt „Gate: bestanden“ in den dauerhaften Nachweis. `fertig` prüft am Bericht nur `stand`, ein Bericht mit „blockiert“ oder „Abnahme: keine“ wird mitgemergt. – Fix: R3-Prüfungen in `bericht` einschalten (nur die Bericht-Prüfung selbst auslassen); `fertig` verlangt `gate === 'bestanden'`.

M5 · `scripts/sys/bericht.mjs:72,95-98` – Der Secret-Scan läuft nach dem Schreiben von `bericht.json` und `gruen.json`. Bei einem Treffer endet `bericht` zwar mit Fehler, `fertig` findet aber einen aktuellen Bericht und merged; kopierte Logs mit Treffer lägen in `docs/proof`. – Fix: kopieren, scannen, erst bei Exit 0 `bericht.json` und `gruen.json` schreiben; Scan-Ergebnis als Feld, `fertig` verlangt es.

M6 · `scripts/sys/lib.mjs:22`, `scripts/sys/fertig.mjs:99,128` – Unverfolgte Dateien unter `docs/` gelten als sauber, und Bericht sowie Schritt-Ermittlung lesen den Arbeitsbaum. `fertig` und pre-push sind grün, obwohl `bericht.json`, Kopien und `gruen.json` nie committet wurden. – Fix: `bericht.json` aus dem Commit lesen (`git show HEAD:…`), oder `docs/proof/` von der Ausnahme in `sauber()` ausnehmen.

M7 · `scripts/sys/fertig.mjs:122-130` – `schrittAusBericht` nimmt den ersten Ordner mit passendem `stand`. Schritte, die nur `.md` ändern (auch unter `.claude/`, also R3, etwa u2), haben denselben check-Fingerabdruck wie der Vorgänger. pre-push prüft dann gegen Abnahme und Freigaben des Vorgängers: zu milde bei direktem Push auf main, und zu Unrecht blockiert, wenn dessen Dateien in `tmp/proof` fehlen (dann steht lokal ein gemergtes main ohne Push). – Fix: den Bericht nehmen, der im Push-Bereich hinzugefügt oder geändert wurde (genau einer, sonst blockieren). Das löst M6 mit.

M8 · `scripts/sys/fingerabdruck.mjs:4,8,10`, `scripts/sys/stufe.mjs:14` – `src/lib/motion.ts:2` und `src/dev/Fundament.tsx:2` importieren `docs/reference/design/tokens.json`. Eine Änderung dort ändert die App, zählt aber als R0 und ändert keinen Fingerabdruck: Merge ohne einen Lauf. – Fix: Datei in check und e2e aufnehmen, in `stufe.mjs` vor der `docs/`-Regel als R1. Selbsttest, der Importe aus `docs/` in `src/` und `tests/` sucht und gegen die Liste prüft.

M9 · Entwurf `tmp/proof/u1-settings-entwurf.json:39-52,59-75` – PowerShell ist hier die Hauptshell, hat aber kein Gegenstück zu den alten Bash-Regeln: `node -e`, `git reset|stash|restore|clean`, `git add -A`, `git push --force`, `supabase config push` (deny) sowie `supabase db`, `migration repair`, `secrets`, `link`, `dotenv` (ask). Abschnitt 4 verlangt je Regel ein Gegenstück; für die neuen Einträge ist es da. – Fix: alle Bash-Einträge spiegeln.

M10 · Entwurf `:9`, `docs/BEKS_EINRICHTUNG.md:50-51` – Ob `args`, `onFailure` und `${CLAUDE_PROJECT_DIR}` in der Exec-Form wirken, ist nicht belegt (ich kenne die Felder aus meinem Wissensstand nicht; die Datei nennt Version 2.1.295 als Voraussetzung). Kennt die installierte Version sie nicht, ist der Guard still aus, oder die ganze Einstellungsdatei wird verworfen und die `.env`-Sperren fallen weg. Die Live-Probe liegt bei Beks; das ist nach Plan zulässig, Schritt 5 reicht aber nicht. – Fix: Schritt 5 ergänzen um (a) `claude --version` vor dem Einspielen, (b) eine alte Sperre greift noch (`.env.local` lesen wird verweigert), (c) Absturz-Probe: `guard.mjs` kurz umbenennen, ein Bash-Aufruf muss blockiert sein, (d) `agent_type`: `advisor-report` schreibt `tmp/proof/probe-abnahme.md`, derselbe Write aus der Hauptsession wird verweigert.

M11 · `scripts/sys/run.mjs:25` – `cmd` erlaubt jedes Skript aus `scripts/sys/`, auch `fertig.mjs` ohne `--nur-pruefen`. `npm run t -- cmd node scripts/sys/fertig.mjs` merged und pusht ohne Nachfrage: `.claude/settings.local.json:84` erlaubt `npm run *`, die `ask`-Regel aus Auflage 10 trifft nur `npm run fertig`. `fixtures/push-main.mjs` zeigt, dass Git-Aufrufe aus solchen Skripten an Guard und `ask` vorbeigehen. – Fix: feste Liste statt Muster: `fixtures/*.mjs`, `stufe.mjs`, `gate-db.mjs` nur mit `--trocken`, `fertig.mjs` nur mit `--nur-pruefen`.

M12 · `.claude/hooks/guard.mjs:38` – `supabase migration up --linked` wendet Migrationen am Gate vorbei an und ist weder im Guard noch in `ask`. `supabase --debug db push` (Schalter dazwischen) passt ebenfalls nicht auf das Muster. – Fix: `migration (repair|up|down|squash)` aufnehmen, zwischen `supabase` und dem Unterbefehl Schalter zulassen.

M13 · `CLAUDE.md:3-8` – Auflage 10 lautete: `CLAUDE.md` nicht ändern, Befehlsliste nur als Vorschlag an Beks. Der Abschnitt „Arbeitssystem“ steht auf der Platte; in dem beim Start geladenen Stand fehlte er, im Umfang (`tmp/proof/u1-umfang.md`) kommt er nicht vor, der Antrag begründet die Abweichung nicht. Ob Beks ihn beauftragt hat, kann ich nicht prüfen. Dazu: `CLAUDE.md` ist R0 (`stufe.mjs:15`), liegt in keinem Fingerabdruck und unter keiner `ask`-Regel; Regeländerungen laufen an allen Gates vorbei. – Fix: im Abschlussbericht an Beks als Abweichung mit Quelle des Auftrags nennen; ohne Auftrag zurücknehmen und als Vorschlag liefern. `^CLAUDE\.md$` als R3 in `stufe.mjs`, `Edit(./CLAUDE.md)` in `ask`. Inhaltlich: Zeile 7 stimmt erst nach dem Einspielen der Hooks; Zeile 8 widerspricht den alten Zeilen 31 bis 34 und der Regel „Exit-Code per echo ins Log“ (beides sperrt der Guard).

M14 · `scripts/sys/gate-db.mjs:30-36` – Der echte Modus lief nie (`tmp/proof/u1/runs.jsonl` enthält nur Trockenläufe). Ob die Ausgabe von `migration list -o json` aus `node_modules/supabase/dist/supabase.js` reines JSON ist, ist offen; frühere Sessions mussten einen Vorspann vor der Klammer abschneiden (`.claude/settings.local.json:117-118`). Schlägt das Parsen fehl, blockiert `db:push` dauerhaft. – Fix: vor dem Merge einmal `npm run db:antrag` echt (nur lesend) über `npm run t` nicht möglich, daher direkt; Ergebnis als Nachweis. Falls Vorspann: ab der ersten Zeile mit öffnender Klammer parsen.

M15 · `scripts/sys/stufe.mjs:22` – `package.json`, `vite.config.ts`, `playwright.config.ts` sind R2. Dort stehen `db:push` (Gate-Kette), `check`, `test:rls`, `t`, `prepare` und die Testauswahl. Ein Gate lässt sich über die Skriptdefinition abschwächen, ohne Fable-Abnahme; Abschnitt 7 nennt `package.json` in der R3-Zeile. – Fix: `package.json` als R3, oder `fertig` vergleicht die Skripte `t`, `check`, `test:rls`, `test:e2e`, `db:push`, `prepare`, `fertig`, `bericht` mit festen Sollwerten.

## Findings niedrig

N1 · `.claude/hooks/guard.mjs:29` – Trennung ohne Rücksicht auf Anführungszeichen: Commit-Nachricht oder grep-Muster mit `;`, `|` oder Zeilenumbruch vor einem Sperrwort wird verweigert (Regel 2 trifft dann auch Text). – Fix: Zeichenketten vor dem Trennen maskieren.
N2 · `.claude/hooks/guard.mjs:44` – Auch das Lesen `git config core.hooksPath` wird verweigert (Prüfschritt aus `docs/BEKS_EINRICHTUNG.md:48`). – Fix: nur Aufrufe mit Wert, `--unset`, `-c` sperren.
N3 · `.claude/hooks/guard.mjs:6,51` – `New-Item` für einen Ordner unter `tmp/proof` wird verweigert; `&>` und `*>` erkennt die Umleitungsregel nicht. – Fix: Muster anpassen.
N4 · `.claude/hooks/guard.mjs:10,65` – Berater-Dateinamen gelten überall, auch für `scripts/sys/fixtures/db/*/db-freigabe-1.md`. – Fix: auf `tmp/proof/` begrenzen.
N5 · `.claude/hooks/guard.mjs:34` – `npm run --silent check`, `npm.cmd run check`, `timeout N npm run check`, `bash -c`/`powershell -Command` laufen durch. Solche Läufe zählen nicht (zweite Ebene hält). – Fix: optional.
N6 · `scripts/sys/run.mjs:10` – Kein Ziel für `shots:all` und `test:e2e:mobile`, der Guard sperrt beide direkt. Umweg über `npm run t -- shots --project=…`. Die Form `-- <argumente>` aus Abschnitt 3 a1 erzeugt ein doppeltes `--`. – Fix: Ziel `shots:all`; führendes `--` in `extra` entfernen.
N7 · `scripts/sys/run.mjs:9,82` – `ziel` wird mit Backslashes gespeichert; der Rot-vor-Grün-Vergleich in `fertig.mjs:48` findet den Lauf dann nicht. – Fix: normalisiert speichern.
N8 · `scripts/sys/fertig.mjs:116` – 40 Zeilen mit Schlusszeilenumbruch zählen als 41. – Fix: Endumbruch abziehen.
N9 · `scripts/sys/stufe.mjs:22,37` – `public\/` steht in einer `^…$`-Gruppe, Dateien unter `public/` werden R3 (sicher, aber ungewollt). Die CLI rechnet gegen lokales `main` ohne `--no-renames`, anders als `fertig`. – Fix: angleichen.
N10 · `scripts/sys/bericht.mjs:19` – Nach einer zweiten Abnahme-Runde wirft `kopiere`, wenn `bericht` dazwischen lief (Kopie mit anderem Inhalt). Der Hinweis „npm run bericht“ aus `fertig` legt genau das nahe. – Fix: Kopie mit Kurz-Hash im Namen, oder unverfolgte Kopie ersetzen.
N11 · `scripts/sys/bericht.mjs:20`, `.gitignore:27` – Kopierte `*.log` sind ignoriert und brauchen `git add -f`. – Fix: Ausnahme für `docs/proof/**/*.log`.
N12 · `scripts/sys/gate-db.mjs:12-14` – `opt()` liefert bei fehlender Option `rest[0]`; die Vollständigkeitsprüfung im Trockenlauf greift nicht (endet trotzdem mit Exit 1). – Fix: `indexOf === -1` abfangen.
N13 · `scripts/sys/start-schritt.mjs:15` – Jeder `node.exe`-Prozess mit „playwright“ in der Befehlszeile zählt (auch ein MCP-Server). – Fix: auf `playwright test` und `vitest` als Programm einengen.
N14 · `.claude/hooks/session.mjs:19-22,38` – Modell nur vom Sitzungsstart; ein Wechsel danach bleibt unbemerkt, eine von Beks gewollte Opus-Session wird bei `/schritt` geblockt. Ob der Prompt eines Skill-Aufrufs im Wortlaut ankommt, ist erst in u2 prüfbar. – Fix: in u2 klären.
N15 · `.claude/agents/test-runner.md:3` – Beschreibung nennt noch die alten Befehle. – Fix: angleichen.
N16 · `scripts/sys/fertig.mjs:47-51` – Rot-vor-Grün gilt nur für neue Dateien; jeder rote Grund zählt (auch „Datei fehlt“). Mechanisch nicht besser beweisbar. – Fix: im Bericht die Fehlerzeile des roten Laufs zeigen.
N17 · `scripts/sys/lib.mjs:35` – Hashes kommen aus dem Arbeitsbaum. `.gitattributes:1` (`eol=lf`) hält das stabil; eine mit CRLF geschriebene Datei bekäme beim Checkout nach dem Merge einen anderen Hash und pre-push blockierte nach dem lokalen Merge. – Fix: `fertig` prüft die gehashten Dateien mit `git ls-files --eol`.
N18 · `scripts/sys/run.mjs:63-72` – Kein Zeitlimit; bricht das Werkzeug ab, bleiben Kindprozesse und ein Log ohne Schlusszeile. – Fix: bei SIGTERM den Prozessbaum beenden.

## Prüffragen

1 · Auflagen
| Nr. | Stand | Beleg |
|---|---|---|
| 1 | umgesetzt | `run.mjs:25` (Allowlist), `run.mjs:82` (`args`), `fertig.mjs:22` (leere `args`, Kanon), `sys-run.test.ts:40-50`, `sys-fertig.test.ts:61-70`. Rest: M11 |
| 2 | umgesetzt | `fertig.mjs:60-82`, `guard.mjs:9-10,54,64-65`, `sys-guard.test.ts:47-77` |
| 3 | umgesetzt | `fertig.mjs:85-91,109` (nur origin/main), `:95-96` (`--no-renames`), `:157-158` (fetch, Basis origin/main). Rest: N9 |
| 4 | umgesetzt | `fertig.mjs:122-130,148-150`, `:30,159`, `start-schritt.mjs:14`, Probe `tmp/proof/u1/018-cmd.log`. Rest: M7 |
| 5 | umgesetzt | `gate-db-lib.mjs:29-40`, `fertig.mjs:40-46,113`. Rest: M3 |
| 6 | teilweise | Exit ungleich 0 und oberste Form: `gate-db.mjs:25-41`, `gate-db-lib.mjs:12`. Optionen: `gate-db.mjs:13-17`. `PROOF_ROOT`: `lib.mjs:9`. dotenv: `package.json:69`. Marke: `gate-db.mjs:61-65`, `fertig.mjs:19-22`. Nicht umgesetzt: Form der Einträge (H1). Rest: M1 |
| 7 | umgesetzt | `stufe.mjs:7-15`, `sys-stufe.test.ts:19-22`, `fingerabdruck.mjs:9-10` |
| 8 | teilweise | Ausnahme entfernt `guard.mjs:41`, `npm t|tst` `:34`, `.git` `:63`, Regel 2 `:38`, Regel 5 `:51`. Nicht umgesetzt: Regel 3 im ganzen Befehl (H2). Regel 4 nur bei git-Segmenten (`:44`), vertretbar |
| 9 | umgesetzt | `guard.mjs:77-87`, `sys-guard.test.ts:110-125`, Hooks noch nicht eingetragen, Rettungsweg `docs/BEKS_EINRICHTUNG.md:53-57`. Offen: Live-Probe (M10) |
| 10 | teilweise | `test-runner.md:11`, Entwurf `:80-88,91`. Nicht eingehalten: `CLAUDE.md` geändert (M13) |

2 · Umgehungen
- Test-Startprogramm: Schreibvarianten am Guard vorbei (N5) erzeugen nur wertlose Läufe. Fälschlich grün entsteht über Abhängigkeiten außerhalb des Fingerabdrucks: `tokens.json` (M8), Skriptdefinitionen (M15), Stand der Dev-Datenbank (M1) und der ausgerollten Edge Functions (kein Bezug zum rls-Lauf, `docs/OPEN_ISSUES.md` u1-2 nennt nur das fehlende Gate). Übersprungene Tests zählen als grün; die Testzahl steht in `runs.jsonl`, wird aber nicht verglichen.
- Datenbank-Gate: mehrzeiliges oder mehrteiliges SQL (H2), `migration up --linked` (M12), geänderte Altmigration (M2), unerwartete Listenform (H1), Skripte mit Service-Schlüssel über `npm run *` (außerhalb von u1, u1-1). Die Modell-Zeile der Freigabe bleibt Selbstauskunft.
- Merge-Gate: `fertig` über `cmd` ohne Nachfrage (M11), direkter Push mit Vorgänger-Bericht (M7), Abnahme ohne Deckung der geänderten Dateien (M3), Bericht nicht committet (M6). Ein zweiter Klon ohne `npm run prepare` hat keinen Hook.

3 · Fälschlich grün: ja, über M1 bis M8 und M15. Fingerabdruck (Index-Stand, durch `sauber` gleich HEAD), `gruen.json` nur aus origin/main, Kanon-Befehl, Log-Bindung und die rls-Reihenfolge nach der Marke sind für sich richtig. Zu Unrecht blockieren: M7 (Vorgänger-Dateien fehlen), M14 (Listenausgabe nicht parsebar), N8, N10, N17, N13. Nach einem Block im pre-push steht lokal ein gemergtes main; `fertig` läuft dort nicht, `git reset` ist gesperrt. Der Weg zurück gehört in `docs/BEKS_EINRICHTUNG.md`.

4 · `guard.mjs`: Fehlalarme N1 bis N4. Lücken H2, M12, N5; Schreiben per `cp` oder Umleitung nach `.claude/`, `.githooks/`, `scripts/sys/` sperrt er nicht (nur die `ask`-Regel für Edit, danach R3 und Hash-Bindung). Absturz: jede Ausnahme im Skript ergibt Exit 2 mit „Guard-Fehler“ und sperrt Bash, PowerShell, Write und Edit; die Session kann den Guard dann nicht selbst reparieren, der Rettungsweg steht in der Einrichtungsdatei. Startet node gar nicht, hängt alles an `onFailure` (M10).

5 · Entwurf: JSON wohlgeformt. `Agent(Name)`, `mcp__<server>` und `Edit(./pfad/**)` entsprechen der mir bekannten Syntax; `Edit`-Regeln gelten auch für Write. Die Server-Kennung stimmt mit der in meinem Kontext gemeldeten überein; ob sie über Sitzungen stabil bleibt, ist offen. `Agent(claude)` kenne ich als Agent-Typ nicht (schadet nicht). `ask` schlägt `allow` (`npm run fertig`, `db:push` fragen trotz `npm run *`), `deny` schlägt beides; `Edit(./docs/proof/**)` trifft `bericht.mjs` und `cp` nicht. `args` und `onFailure`: von mir nicht belegbar, siehe M10. Lücke: M9. Die Seiten unter code.claude.com habe ich nicht abgerufen.

6 · Fail-closed: `fertig` ja (jede Ausnahme endet mit Exit ungleich 0, fehlende `gruen.json` zählt als leer, unbekannte Stufe als R3, kein passender Bericht blockiert). `gate-db`: Listenfehler, fehlende Datei, Freigabe-Parser, Attrappe-Optionen und `dev-guard` ja; Form der Einträge nein (H1), Marke vor dem Push nein (M1).

## Stichproben

- `guard.mjs:29,41` mit `db query "select 1; delete from public.x"` von Hand durchgerechnet: kein Treffer in beiden Segmenten (H2).
- `gate-db-lib.mjs:15` mit Einträgen `{version}`: Filter leer, kein Wurf (H1).
- `fertig.mjs:22`: `cmd`-Lauf mit `befehl` „npm run check“ erfüllt check nicht (Ziel wird verglichen); gedeckt durch `sys-fertig.test.ts:68-70`.
- `fertig.mjs:60-82`: Log-Pfad aus Schritt, Nummer und Ziel; Hash, drei Kopfzeilen und Schlusszeile werden verglichen.
- `tmp/proof/u1/017-cmd.log:6-12`: `fertig --nur-pruefen` auf fd44b61 blockiert mit sechs Gründen, EXIT=1.
- `tmp/proof/u1/018-cmd.log:6-8`: pre-push läuft unter Git für Windows und blockiert ohne Bericht.
- `tmp/proof/u1/runs.jsonl:9-10`: check rot (Exit 2), dann grün mit 1383 Tests, beide `sauber: false`, zählen also nicht.
- `.git/config:8`: `hooksPath = .githooks` gesetzt.
- `.gitattributes:1`: `* text=auto eol=lf`.
- `vite.config.ts:23`: `tests/unit/**/*.test.ts`, die Selbsttests laufen in `check`.
- `playwright.config.ts:33`: e2e baut selbst; `vite.config.ts` gehört zu Recht in den e2e-Fingerabdruck.
- `src/lib/motion.ts:2`: Import aus `docs/` (M8).
- `.claude/settings.local.json:84`: `Bash(npm run *)` erlaubt (M11).
- `.claude/agents/advisor-report.md:4,6`: Modell Fable, Werkzeuge Read, Grep, Glob, Write.
- `.claude/hooks/guard.mjs:80`, `session.mjs:49`: das BOM-Zeichen steht wirklich im Muster.
- `scripts/sys/fixtures/push-main.mjs:4`: nur `--dry-run`.
- Kein Secret, kein Schlüssel und keine Verbindungsadresse in den geprüften Dateien; Geldlogik ist nicht berührt.

Offene Findings hoch: 2
