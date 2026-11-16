Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme sys1, Runde 1 (R3)

Datum: 2026-11-16
Umfang: Stand auf Branch `sys1` (HEAD laut Auftrag 1e69d96). Vollständig gelesen: die acht Pflichtdateien unten. Zur Einordnung gelesen: `tmp/proof/sys1-plan.md`, `.claude/rules/geld.md`, `daten.md`, `tests.md`, `scripts/sys/lib.mjs`, `abnahme-lib.mjs`, `gate-loesch-lib.mjs`, `gate-db-lib.mjs:28-72`, `tests/unit/sys-fertig.test.ts`, `sys-guard-nachweise.test.ts`, `sys-bericht-lib.test.ts`, `tests/rls/storno-wettlauf.test.ts`, `supabase/migrations/20261116150000_0070_default_privileges.sql`, `tmp/proof/sys1/runs.jsonl`, `tmp/proof/sys1/loesch-lauf.jsonl`, die Logs 008, 009, 012, 013 (Kopf, Ist-Werte, Fehler, Exit), `.claude/settings.json` (Listen deny und ask), `.gitignore`.

SHA256: 9cd2ae829e86f0df730c1ac1451516372783feadc74314dd6087ca0b4dccbbbe .claude/hooks/guard.mjs
SHA256: a7c84314ffadce4b3487c5fbc820459daf518d10e40a71426aebfd3055a6567b docs/freigaben/sys1-loesch-freigabe-3.md
SHA256: abfbc3ed6f4fdf674afdf3ee8819fda8f22b0ddaa0cc7bdcf214f69257549f7d scripts/sys/bericht-lib.mjs
SHA256: e0f8afa7b058a8a330f5fe35583cf9da288a02baf62c10a957e5fb06de909994 scripts/sys/bericht.mjs
SHA256: fe98bbd51738e2cbbe50addf140529d1c782a8c04b18ef6dbea25900f71dd573 scripts/sys/fertig.mjs
SHA256: 3036f5b7a6f9db462dde91f23d175ceb31a7ae12407293197adc17396c57c2ec scripts/sys/loesch-register.json
SHA256: 36d092faf54960febe5bf8dc06c05e8e77d4403d231fe66550757939a798886d scripts/sys/run.mjs
SHA256: a22e6a1ffc76a4cf07c16b60028f95fa623a51ba20dbf05c269ab14b72f0f14d tests/support/race-copy.ts

## Grenzen dieser Prüfung (vorab lesen)

- Kein Shell-Werkzeug. Die acht Hashes sind aus dem Auftrag abgeschrieben, nicht nachgerechnet; das Gate vergleicht sie mit dem Endstand.
- `git diff origin/main...HEAD` konnte ich nicht ausführen. Geprüft ist der heutige Stand jeder Datei gegen Plan und Regeln. Den Vorzustand kenne ich nur aus den Fakten im Plan (`sys1-plan.md:7-11`, mit Zeilennummern). Die Aussage „keine Lockerung bestehender Prüfungen“ stützt sich deshalb auf: vollständige Lektüre des heutigen Stands, den Abgleich der Zeilennummern aus dem Plan (siehe Stichproben) und die weiter vorhandenen alten Testfälle. Ein Zeile-für-Zeile-Vergleich mit `origin/main` ist das nicht.
- Eine Planentscheidung von mir zu sys1 liegt nicht als Datei vor (unter `tmp/proof/` gibt es zu sys1 nur `sys1-plan.md`). Maßstab waren der Plan und die sechs Prüffragen des Auftrags.
- Nichts ausgeführt. Aussagen zu Läufen stammen aus `runs.jsonl` und den Logs.
- Der Git-Status zu Beginn zeigte `docs/OFFEN.md` als geändert und nicht committet. `fertig` verlangt einen sauberen Arbeitsbaum.
- In `runs.jsonl` steht noch kein gültiger Volllauf auf dem Endstand (Lauf 11 `check` lief mit unsauberem Baum auf 239127b; `e2e` und `rls` fehlen, `rls` muss nach dem Push von 19:14 liegen). Diese Abnahme ersetzt die Volläufe nicht.

## Findings

### Hoch
Keine.

### Mittel

- M1 · `scripts/sys/fertig.mjs:79-81`, `scripts/sys/run.mjs:127`, `:147` – Der Rot-Beweis ist jetzt an den Inhalt der Testdatei gebunden, aber nicht an das, was sonst ein Rot erzeugen kann. Drei Wege bleiben, mit byte-gleicher Testdatei ein Rot ohne Aussage zu bekommen: (a) Zusatzargumente: der rote Lauf muss keine leere Argumentliste haben, `npm run t -- tests/rls/x.test.ts tests/rls/y.test.ts` zählt als Rot für x, wenn nur y scheitert; ebenso ein Zeitlimit oder eine fremde Konfiguration als Argument. (b) Umgebung: `run.mjs:127` reicht die ganze Umgebung durch, Kopf des Logs und `runs.jsonl` nennen sie nicht. Lauf 12 und Lauf 13 haben denselben Befehl (`runs.jsonl:14-15`); dass Lauf 12 gegen die Kopie ohne Sperre lief, steht nur in der Zeile, die der Test selbst schreibt (`012-…log:14`). (c) Importe: `dateiSha` deckt nur die Testdatei, nicht `tests/support/**`. Liegt die Erwartung in einer Hilfsdatei, ist „Rot durch geänderte Erwartung“ weiter möglich. Keiner der drei Wege ist neu (die alte Prüfung hatte sie auch), und für diesen Schritt habe ich beide roten Läufe selbst geprüft (Prüffrage 1). – Fix (eigener Systemschritt, Eintrag in OFFEN): in `fertig.mjs:81` für den roten Lauf zusätzlich `(r.args ?? []).length === 0` verlangen; in `run.mjs` die Schalter mit Präfix `MV_` (außer `MV_LAUF`) mit Namen und Wert in den Kopf des Logs und in `runs.jsonl` schreiben; in `.claude/rules/tests.md` die Grenze (c) als Aufgabe der Abnahme nennen.
- M2 · `.claude/hooks/guard.mjs:380-384` – Die neue Sperre trifft Wörter, die unter `tmp/proof` liegen oder nach `cd` wie ein Nachweis heißen. Nicht getroffen werden übliche Schreibweisen, die den Ordner von außen oder ohne Pfadwort erfassen: `rm -rf tmp`, `mv tmp x`, `ri tmp -Recurse`, `rd /s /q tmp` (Elternordner); `cd tmp` und danach `rm -rf proof`; `cd tmp/proof` und danach `rm -rf sys1` oder `rm *.md`; `Get-ChildItem tmp\proof | Remove-Item` (das Lösch-Segment hat kein Pfadwort); dazu Schreibweisen wie `tmp//proof`, `tmp/./proof` oder eine geschweifte Klammer direkt vor `tmp` (der Vergleich in `:382` verlangt Wortanfang oder Schrägstrich vor `tmp`). `Bash(rm:*)` und `PowerShell(Remove-Item:*)` stehen auf ask (`.claude/settings.json:79`, `:91`), die Kurzformen `ri`, `rd`, `del`, `mv`, `mi` nicht; `sed`, `git clean`, `git stash` sind dort verboten (`:39`, `:42`, `:48`). Gegenüber dem Plan (nur Abnahme- und Freigabe-Dateien) geht die Sperre weiter; das hier ist der Rest. – Fix (eigener Systemschritt, OFFEN): jedes Wort gegen die Wurzel auflösen (`resolve`, wie `entscheideDatei` in `:391`) und verweigern, wenn es `tmp/proof`, etwas darunter oder ein Elternordner davon im Projekt ist; ein Wort mit Platzhalter verweigern, wenn sein fester Anfang ein Präfix von `tmp/proof` ist oder der Befehl hinter `cd` nach `tmp` oder `tmp/proof` steht; ein Lösch-Segment mit Eingabe aus einer Pipe verweigern, wenn der Befehl `tmp/proof` nennt. Testfälle dazu in `tests/unit/sys-guard-nachweise.test.ts` (rot zuerst).

### Niedrig

- N1 · `scripts/sys/fertig.mjs:79-80` gegen `sys1-plan.md:7`, `:18` – Zwei Stellen sind anders als vorher, nicht nur strenger. (i) Der erste grüne Lauf zählt nach Inhalt, nicht mehr nach Pfad; ein grüner Lauf unter dem Endpfad wird für Rot-vor-Grün nicht mehr eigens verlangt. Ohne Wirkung: Der Volllauf `rls` auf dem Endstand bleibt Pflicht (`:48-56`), und ein Grün unter einer anderen Schreibweise des Pfads zählt jetzt als erstes Grün mit (schließt den Umweg über einen Alias-Pfad). (ii) Ein früheres Grün mit anderem Inhalt gilt nicht mehr als erstes Grün. Die Folge Grün (alte Fassung), Änderung, Rot, Grün war früher blockiert und geht jetzt durch; der Plan (`:18`) hatte „dateiSha des ersten grünen Laufs“ geschrieben. Ich werte das nicht als Lockerung: Dasselbe war früher über eine Umbenennung erreichbar, und das verlangte Rot muss jetzt mit der Endfassung entstehen, also durch etwas außerhalb der Datei. – Fix: keiner am Code; im Bericht des Schritts als bewusste Fassung nennen.
- N2 · `scripts/sys/run.mjs:119`, `:147` – Der Hash wird vor dem Start und beim Schreiben der Zeile genommen. Wird die Datei während des Laufs geändert und vor dem Ende zurückgestellt, sieht das keine der beiden Messungen. Außerdem steht `dateiSha` nur in `runs.jsonl`, nicht im Log; die Prüfung des Logs (`fertig.mjs:123-130`) bindet es nicht. Beides ist nicht schwächer als der Rest von `runs.jsonl` (auch `logSha` steht nur dort) und braucht Vorsatz. – Fix: keiner jetzt; bei M1 den Hash zusätzlich in den Kopf des Logs schreiben und in `leseGepruefteRuns` vergleichen.
- N3 · `scripts/sys/bericht.mjs:70-76`, `scripts/sys/fertig.mjs:99-100` – `bericht.json.abnahme` nennt jetzt Quelle und SHA-256, das Gate vergleicht sie aber nicht mit der höchsten Runde unter `tmp/proof`. Entsteht nach `npm run bericht` eine weitere Runde ohne Code-Änderung, besteht `fertig` mit einem Bericht, der die vorige Runde nennt, und die neue Runde fehlt unter `docs/proof`. Schaden gering (eine Runde mit hohem Fund blockiert über `:70`). – Fix (mit M1/M2): in `pruefeFertig` `bericht.abnahme.sha256` mit dem Hash der gewerteten Runde vergleichen, sonst „npm run bericht neu ausführen“.
- N4 · `scripts/sys/bericht-lib.mjs:6` – `kopie.replace` wirft, wenn es eine Abnahme gibt, aber keinen Eintrag in der Zuordnung. Nach heutigem Stand nicht erreichbar: Jeder Name, den `abnahme-lib.mjs:13-15` als Runde annimmt, erfüllt auch den Filter in `bericht.mjs:53`. Ein Wurf wäre fail closed (kein `bericht.json`). – Fix: keiner.
- N5 · `scripts/sys/fertig.mjs:266` – Die Ausgabe von `git push` wird nicht mehr gezeigt. Bei einem Fehler wirft `execFileSync` mit dem Fehlertext von git (samt Gründen des pre-push-Hooks); danach steht der Arbeitsordner wie bisher auf `main` mit lokalem Merge. – Fix: keiner; der Zustand nach einem gescheiterten Push gehört in `docs/BEKS_EINRICHTUNG.md`, falls er dort fehlt.
- N6 · `tests/support/race-copy.ts:67-69` – Übernommen aus der Lösch-Freigabe 3 (dort N1, N4): Die Rechte werden entzogen, aber nicht gegengeprüft, und die Stellung der Freigabeprüfung ist für diese Datei nicht per Unit-Test festgehalten. – Fix: bei der nächsten Änderung der Datei (neuer Hash, neue Freigabe).
- N7 · `.claude/hooks/guard.mjs:380-383` – Fehlalarme, bewusst: `mv x tmp/proof/notiz.md` (Verschieben hinein), `rm 123-datei.txt` oder `rm abnahme-notiz.md` in irgendeinem Ordner. Laut Auftrag annehmbar. – Fix: keiner.

## Prüffragen

**(1) Gate `fertig.mjs`, Rot-vor-Grün.** Der Stand hält, was der Auftrag nennt: nur Läufe des eigenen Schritts (`:79`, `r.schritt === c.schritt`; `sammle` liefert `schritt` in `:181`, im pre-push-Zweig kommt er aus dem Bericht, `:240-242`), nur mit gültigem Log, nur mit gesetztem `dateiSha`, und der muss dem Hash der Datei im Endstand gleichen (`:79`, Endhash aus `:204`). Fehlt die Datei, ist der Endhash leer und der Fall blockiert (`:79`, `:81`); ein fehlendes Feld zählt nie (kein Vergleich zweier leerer Werte). Rot zählt nur unter dem Endpfad und vor dem ersten Grün gleicher Fassung (`:81`). Neue Dateien ohne Umbenennungserkennung (`:158-162`, Test `sys-fertig.test.ts:264-284` mit echtem Wegwerf-Repository). Lockerung: keine mit Wirkung; die zwei Stellen, an denen sich die Fassung verschiebt, stehen in N1. Weg mit geänderter Testdatei: Ich finde keinen. Rot und Grün müssen beide den Endhash tragen, also dieselben Bytes wie der Endstand; übrig ist nur das Zurückstellen während eines Laufs (N2). Wege mit unveränderter Testdatei gibt es (Argumente, Umgebung, Hilfsdateien, Zustand der Datenbank, Absturz): M1. Diese Lücke schließt weiter die Abnahme. Für diesen Schritt geprüft: Lauf 8 (rot, vor dem Push) misst den Ist-Wert „anon darf ausführen“ (`008-…log:26`, `:42`), Lauf 9 (grün, nach dem Push) trägt denselben `dateiSha` (`runs.jsonl:8`, `:11`). Lauf 12 (rot) zeigt gegen die Kopie ohne Sperre je zwei Erfolge und zwei Audit-Einträge (`012-…log:14`, `:23`), Lauf 13 (grün) gegen die echten Funktionen je einen (`013-…log:14`), gleicher `dateiSha`, beide ohne Zusatzargumente (`runs.jsonl:14-15`). Beide roten Läufe messen die Wirkung der Sperre und zählen.

**(2) `run.mjs`, dateiSha.** Ja. Nur für Ziele unter `tests/rls/` mit Endung `.test.ts` (`:111`), Hash vor dem Start des Kindprozesses (`:119`), noch einmal beim Schreiben der Zeile; nur bei Gleichheit steht er in `runs.jsonl`, sonst `null` (`:147`). Nicht lesbare Datei ergibt `null` (`:112-118`). Andere Ziele bekommen `null` (belegt: `runs.jsonl:12-13`).

**(3) `guard.mjs`.** Neu sind die Liste der Lösch- und Verschiebebefehle (`:10`) und der Block `:378-385`. Er steht am Ende der Schleife über die Segmente, hinter allen bisherigen Verweigerungen; davor gibt es keinen Ausstieg, der etwas erlaubt, und der Block selbst verweigert nur. Ausnahme `lauf.lock`: nur Wörter, die auf genau diesen Dateinamen enden, fallen aus der Prüfung (`:381`); ein zweites Wort im selben Befehl wird weiter geprüft, eine Klammer-Aufzählung mit `lauf.lock` wird verweigert. Verschachtelte Shells laufen über die bestehende Rekursion (`:333-340`; Testfälle `sys-guard-nachweise.test.ts:40-42`). Bestehende Muster: Die Zeilen aus dem Plan liegen heute genau eine Zeile tiefer (eine eingefügte Zeile `:10`), der Block für Umleiten, Kopieren und Schreiben (`:371-377`) entspricht der Beschreibung im Plan; eine Lockerung sehe ich nicht, mit der Grenze oben (kein Diff). Reste: M2. Fehlalarme: N7.

**(4) `bericht.mjs`, `bericht-lib.mjs`.** Ja. Die Kopie kommt aus dem Rückgabewert von `kopiere` (`bericht.mjs:52-56`, `:74`), nicht mehr aus dem Namen; der Fall mit Kurz-Hash im Namen ist getestet (`sys-bericht-lib.test.ts:14-18`). SHA-256 ist der der Quelle unter `tmp/proof` (`:75`), `bericht.json` nennt Kopie, Quelle, Hash, Runde, Findings und Modell (`bericht-lib.mjs:8`), die Zeile im Bericht nennt Quelle, Hash, Kopie und Runde (`:9`). Das Gate wertet diese Angaben nicht (N3).

**(5) Meldungen in `fertig.mjs`.** Ja. Die Gate-Zeile nennt den Wert als Fingerabdruck mit dem Zusatz „kein Commit“ (`:165`, Aufruf `:261`). Die Merge-Zeile (`:166`) erscheint erst nach dem Push, der bei Fehler wirft (`:266`), und nach dem Vergleich von `origin/main` mit `HEAD` (`:267-270`, bei Abweichung Exit 1 ohne Erfolgsmeldung), mit dem kurzen Commit (`:271`). Test `sys-fertig.test.ts:286-292`.

**(6) `race-copy.ts`, Register, Freigabe.** Rechte: Schema und Kopien entstehen in einem DO-Block, also einer Transaktion; darin werden dem Schema alle Rechte für PUBLIC und die drei API-Rollen entzogen (`:39`) und den drei Funktionen ebenso (`:67-69`). Das zweite ist nötig, weil der allgemeine PUBLIC-Default nach 0070 bleibt (`0070:5-7`). Die Kopien sind zu keinem Zeitpunkt mit offenen Rechten sichtbar; kein Kunde und kein Partner erreicht sie. Nur Schema `race_ctl`: Verändernde Anweisungen sind Schema entfernen (`:23`), Schema anlegen (`:38`), Rechte entziehen und `execute neu` mit erzwungenem Zielschema vor der Ausführung (`:59-62`) und der Zählung auf genau drei Funktionen (`:64-66`). Die Funktionen nehmen keine Parameter, das SQL enthält nur zwei feste Konstanten (`:16-17`). Der Name des Schemas kommt in keiner Migration vor. Signaturen stimmen mit `0062:1046`, `:1050` und `0064:176`. Die Freigabeprüfung ist jeweils die erste Anweisung (`:21`, `:29`), der Dev-Guard der erste Import (`:7`). Register: Eintrag ohne gebundene Dateien (`loesch-register.json:4`); `owner.ts` bleibt mit festem Hash ausgenommen (`:29`). Freigabe: `docs/freigaben/sys1-loesch-freigabe-3.md` nennt Modell, genau den Hash der Datei aus dem Auftrag und „frei“, hohe Funde 0 (`:1-3`, `:112`); die Quelle unter `tmp/proof/sys1/` hat dieselben Kopfzeilen und dieselbe Zeilenzahl. Wirkung belegt: `loesch-lauf.jsonl:1-4` (Lauf 12: angelegt und wieder entfernt, mit dem Hash der Freigabe), `:6`, `:8` (Lauf 13: nichts vorhanden). Auf Dev steht das Schema nach den Läufen nicht mehr.

## Geld

Keine Pflichtdatei rechnet oder zeigt Beträge. Der Wettlauftest bucht ohne Gebühr (vier Nullen, `storno-wettlauf.test.ts:56`) und nimmt die Aufteilung der Annahme aus `splitFee` mit den Stufen des Servers (`:39-40`), in Integer-Cent. Kein Weg, auf dem ein Kunde Gebühr oder Journal läse, kommt hinzu.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/sys/fertig.mjs:79` | Filter: eigener Schritt, Log gültig, `dateiSha` gesetzt und gleich Endhash: in Ordnung |
| `scripts/sys/fertig.mjs:80-81` | erstes Grün nach Inhalt, Rot nur unter Endpfad und davor: in Ordnung (N1, M1) |
| `scripts/sys/fertig.mjs:158-162` | Neuanlagen ohne Umbenennungserkennung, nur Testdateien: in Ordnung |
| `scripts/sys/fertig.mjs:204` | Endhash aus der Datei, leer bei fehlender Datei: blockiert dann |
| `scripts/sys/fertig.mjs:240-242` | pre-push reicht den Schritt aus dem Bericht durch: Filter greift auch auf `main` |
| `scripts/sys/fertig.mjs:261`, `:165` | Fingerabdruck als Fingerabdruck beschriftet |
| `scripts/sys/fertig.mjs:266-271` | Push wirft bei Fehler, Vergleich mit `origin/main`, erst dann Meldung |
| `scripts/sys/lib.mjs:50` | jeder Lauf trägt den Ordnernamen als Schritt: Grundlage des Filters |
| `scripts/sys/run.mjs:10` | Ziel mit Schrägstrichen gespeichert: Pfadvergleich im Gate passt |
| `scripts/sys/run.mjs:111-119`, `:147` | Hash vor und nach dem Lauf, sonst `null`: in Ordnung |
| `scripts/sys/run.mjs:127` | Umgebung wird durchgereicht, nicht protokolliert: M1 |
| `.claude/hooks/guard.mjs:10` | Liste mit rm, del, erase, ri, rd, rmdir, remove-item, rni, unlink, mv, move, mi, move-item, ren, rename-item, git rm, git mv |
| `.claude/hooks/guard.mjs:13`, `:352`, `:371-377` | je eine Zeile unter den Angaben im Plan (`:12`, `:351`, `:370-376`): passt zu genau einer eingefügten Zeile davor |
| `.claude/hooks/guard.mjs:381` | Ausnahme nur für den Dateinamen `lauf.lock`: in Ordnung |
| `.claude/hooks/guard.mjs:382` | `rm -rf tmp` und `cd tmp` mit `rm -rf proof` von Hand durchgegangen: nicht getroffen (M2) |
| `tests/unit/sys-guard-nachweise.test.ts:13-42`, `:49-58` | 29 verweigerte, 9 erlaubte Fälle; kein Fall für Elternordner oder Pipe (M2) |
| `scripts/sys/bericht.mjs:52-56`, `:70-76` | Zuordnung Name zu Zielpfad, Hash der Quelle: in Ordnung |
| `scripts/sys/bericht-lib.mjs:3-10` | Felder und Zeile wie geplant: in Ordnung (N4) |
| `scripts/sys/abnahme-lib.mjs:13-15`, `:26-28` | höchste Runde, Name erfüllt den Filter von `bericht.mjs:53` |
| `tests/support/race-copy.ts:21-23`, `:29-31` | Freigabe zuerst, dann Zählen, Entfernen, Anlegen: in Ordnung |
| `tests/support/race-copy.ts:39`, `:67-69` | Rechte am Schema und an den Funktionen im selben Block entzogen: in Ordnung (N6) |
| `tests/support/race-copy.ts:42-44` | Signaturen gleich `0064:176`, `0062:1046`, `0062:1050` |
| `tests/support/race-copy.ts:59-62` | Zielschema vor `execute` erzwungen: in Ordnung |
| `supabase/migrations/…0062_fee_schedule.sql:719`, `…0064_report_flow.sql:188` | Sperrklausel im Wortlaut der Konstante vorhanden |
| `scripts/sys/loesch-register.json:4`, `:29` | Eintrag ohne gebundene Dateien; `owner.ts` ausgenommen mit Hash |
| `scripts/sys/gate-loesch-lib.mjs:37-44` | Laufbindung, Register, Freigabe aus dem Commit: in Ordnung |
| `docs/freigaben/sys1-loesch-freigabe-3.md:1-3`, `:112` | Modell, Hash a22e6a1f…, frei, hohe Funde 0 |
| `tmp/proof/sys1/loesch-lauf.jsonl:1-4`, `:6`, `:8` | angelegt 1, entfernt 1 in Lauf 12; Lauf 13 ohne Schema |
| `tmp/proof/sys1/runs.jsonl:8`, `:11` | Lauf 8 exit 1, Lauf 9 exit 0, gleicher `dateiSha`, Push dazwischen (`:9-10`) |
| `tmp/proof/sys1/runs.jsonl:14-15` | Lauf 12 exit 1, Lauf 13 exit 0, gleicher `dateiSha`, gleicher Commit, Baum sauber, keine Argumente |
| `tmp/proof/sys1/008-…log:14`, `009-…log:14` | Katalogauszug vor und nach dem Push: 259 Zeilen, gleicher Hash |
| `tmp/proof/sys1/008-…log:26`, `:42`, `:74` | Ist-Wert im roten Lauf, EXIT=1 |
| `tmp/proof/sys1/012-…log:14`, `:23`, `:51` | Ist-Werte 2/2/2/2 gegen die Kopie, EXIT=1 |
| `tmp/proof/sys1/013-…log:14`, `:29` | Ist-Werte 1/1/1/1 gegen die echten Funktionen, EXIT=0 |
| `.claude/settings.json:39`, `:42`, `:48`, `:79`, `:91` | sed, git stash, git clean verboten; rm und Remove-Item auf ask |
| `.gitignore:14` | `tmp/` ist ignoriert: Nachweise liegen nur lokal, Löschen wäre endgültig (Gewicht von M2) |
| `.claude/rules/tests.md` (Absatz Rot-Beweis) | deckt sich mit `fertig.mjs:75-82` |

Offene Findings hoch: 0
