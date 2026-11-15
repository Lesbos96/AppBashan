Modell: claude-fable-5-2

# Abnahme u4 (R3)

Datum: 2026-11-15 · Branch u4 · Commit aedb643 · Berater: advisor-report

Geprüfter Umfang: `scripts/sys/lib.mjs` (`sauber(nachweiseImIndex)`), die Aufrufe in `scripts/sys/run.mjs` und `scripts/sys/fertig.mjs`, `.claude/settings.json` (ask-Liste), dazu `tests/unit/sys-sauber.test.ts`. Zum Abgleich vollständig gelesen: `scripts/sys/bericht.mjs`, `scripts/sys/fingerabdruck.mjs`, `scripts/sys/start-schritt.mjs`, `scripts/sys/gate-db-lib.mjs`, `.githooks/pre-push`, `tmp/proof/u4-plan.md`, `tmp/proof/u4/runs.jsonl`; abschnittsweise `.claude/hooks/guard.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `package.json` (Skripte), `docs/ENTSCHEIDUNGEN.md` (Nr. 173 bis 175).

SHA256: 5d659fa871489e5c32e798526e5b68100f8d838747a52b1cb226454bb5d625e9 scripts/sys/lib.mjs
SHA256: 5be90611feba04ad5c9fbfd2e31e0dac452571890ac248fe0a0317f1edd32f9f scripts/sys/run.mjs
SHA256: fbf50af97f6de3c125e3fe79198464c836b97b6e265de120d97148114c6f58a8 scripts/sys/fertig.mjs
SHA256: 25da119635fa26d4c6df8fcc01add98415e4cccd27e589de9e635ddf5a595287 .claude/settings.json

Die Hashes sind aus dem Auftrag abgeschrieben, nicht selbst gerechnet (kein Shell-Zugriff). Das Gate vergleicht sie mit dem Endstand.

## Grenzen der Prüfung

- Kein Diff gegen main möglich (nur Lesen, kein git). Geprüft ist der aktuelle Inhalt der vier Dateien vollständig und für sich; die Aussage „sonst nichts geändert" ist für `run.mjs`, `fertig.mjs` und `.claude/settings.json` nicht per Diff belegt.
- Für `.claude/settings.json` gibt es ein Indiz, keinen Beweis: Der Plan nennt die alten Zeilen 79, 80, 100, 101. Im aktuellen Stand folgt `Bash(rm:*)` in Zeile 79 direkt auf `Bash(git push:*)` (78), und `PowerShell(npx dotenv:*)` in Zeile 98 direkt auf `PowerShell(git push:*)` (97). Das passt genau zu vier entfernten Zeilen an diesen Stellen (alt 123 Zeilen, jetzt 119).
- Empfehlung an die Hauptsession oder Beks: `git diff main -- .claude/settings.json scripts/sys/run.mjs scripts/sys/fertig.mjs` ansehen. Erwartet: in settings.json genau vier entfernte Zeilen, in run.mjs zwei geänderte Aufrufe (Zeilen 68, 90), in fertig.mjs ein geänderter Aufruf (Zeile 170). Zeigt der Diff mehr, gilt diese Abnahme für die betroffene Datei nicht.
- Nicht geprüft, weil nicht im Auftrag: `playwright.config.ts` (Desktop-Projekt nur mit Tag, drei Arbeiter), die 14 Specs, `CLAUDE.md` (nur Zeile 15 per Suche gesehen), Doku.
- Geld, RLS, Schema: Im geprüften Umfang nicht berührt (keine Migration, keine Edge Function, kein Geldmodul unter den genannten Dateien).

## Findings hoch

Keine.

## Findings mittel

M1. `.claude/settings.json:72-117` (ask-Liste ohne `git commit`) zusammen mit `scripts/sys/gate-loesch-lib.mjs:25-29` – Lösch-Freigaben zählen erst aus dem Commit (HEAD). Der Commit ist damit der Schritt, der eine Freigabe wirksam macht, und er läuft jetzt ohne Nachfrage. Das Schreiben nach `docs/freigaben` sperren weiter die deny-Regel (settings.json:70) und der Guard (`.claude/hooks/guard.mjs:356-364`, `:384`); der Guard nennt aber selbst die Grenze, dass ein node-Skript überall schreiben kann (`guard.mjs:360`). Eine so erzeugte Datei wird nach `git add` und `git commit` ohne jede Nachfrage wirksam; `tests/support/sweep.ts` prüft dieselbe Freigabe im Testlauf (`gate-loesch-lib.mjs:37-44`), und `npm run t` fragt nicht. `npm run loesch` bleibt auf ask (settings.json:108-109). Die Wirkung ist auf Dev begrenzt (dev-guard) und auf Registerskripte mit passendem SHA-256; spätestens die R3-Abnahme muss geänderte Dateien unter `docs/freigaben/` und `tests/support/` nennen (`fertig.mjs:15`, `:71`). Die Nachfrage zeigte nur den Befehl, nicht den Inhalt des Commits; sie war eine schwache zweite Sperre, aber eine. Beks hat das Entfallen beschlossen (`docs/ENTSCHEIDUNGEN.md:181`); die Entscheidung nennt diesen Nebeneffekt nicht. – Fix: kein Eingriff in u4 nötig. Beks zur Kenntnis geben (ein Satz in `docs/BEKS.md` oder `docs/OFFEN.md`). Soll die Sperre zurück, dann nicht über ask, sondern technisch: `sweep.ts` und `gate-loesch.mjs` lassen nur Freigaben gelten, die über `npm run loesch -- uebernehme` in den Commit kamen (eigener Schritt, R3).

## Findings niedrig

N1. `scripts/sys/lib.mjs:25` – Der `M`-Zweig des Musters lässt `bericht.json` und `bericht.md` jedes Schrittordners zu, nicht nur die des laufenden Schritts. `npm run bericht` schreibt nur in den eigenen Ordner (`bericht.mjs:16`, `:98`, `:112-113`); der Kommentar in `lib.mjs:21` („die drei Dateien, die er neu schreibt") ist enger als das Muster. Der Test bestätigt den weiteren Fall sogar als sauber (`tests/unit/sys-sauber.test.ts:46-49`: gestagete Änderung an `docs/proof/u3/bericht.md`, während der Schritt u4 heißt). Kein Nachweisweg: Kein Fingerabdruck liest `docs/` außer den Tokens (`fingerabdruck.mjs:4`, `:7`, `:11-13`); `fertig` und pre-push verlangen den leeren Index (`fertig.mjs:170`, `:223`, `:231`); ein geändertes fremdes `bericht.json` im Push lässt `schrittAusBericht` scheitern (`fertig.mjs:195-203`, genau ein Bericht verlangt). – Fix (späterer Schritt): Muster an `schrittName()` binden oder den Kommentar an das Muster angleichen.

N2. `scripts/sys/lib.mjs:13` mit `:24` – `git()` schneidet die gesamte Ausgabe mit `trim()` zu. Die erste Statuszeile verliert dadurch ein führendes Leerzeichen: eine ungestagete Änderung steht dann als Buchstabe plus ein Leerzeichen da. Mit dem neuen Muster ist das unschädlich, weil beide Zweige genau zwei Leerzeichen nach dem Buchstaben verlangen und git Pfade mit Leerzeichen in Anführungszeichen setzt. Der Abstand zwischen „ungestaget" und „nur im Index" hängt aber an genau einem Zeichen. Stand schon vor u4. – Fix (späterer Schritt): in `sauber()` die Ausgabe ungekürzt lesen (eigener `execFileSync`-Aufruf, nur Zeilenenden entfernen).

N3. `tests/unit/sys-sauber.test.ts:54-65` – Lücken, alle vom Muster richtig behandelt, aber nicht belegt: (a) gestagete Änderung an `<schritt>/bericht.json` als sauber (nur `.md` als `M`, `.json` nur als `A`); (b) die Endverankerung des `M`-Zweigs (`bericht.json.bak`, `gruen.json2`, tiefer liegender Ordner `u3/x/bericht.json`, `docs/proof/bericht.json` direkt); (c) neu gestagete Datei außerhalb von `docs/proof/` (`A` für Code oder für `docs/STAND2.md`), außerhalb ist nur `M` und unverfolgt belegt; (d) ungestagete Änderung an einer Datei unter `docs/proof/`, die nicht in der ersten Statuszeile steht (ungekürzte Form, siehe N2); (e) Nachbarordner mit gleichem Anfang (`docs/proofx/`). – Fix: fünf Zeilen in der `it.each`-Tabelle.

N4. `tmp/proof/u4/runs.jsonl:1-2`, `:6` – Der Rot-Beweis (Lauf 1, vier Tests, einer rot: „expected false to be true") belegt den Fehler vor der Korrektur. Für die Einengung nach der Planprüfung (nur drei Dateien als `M`) gibt es keinen roten Lauf: Lauf 6 ist grün mit zwölf Tests. Das Gate verlangt Rot vor Grün nur für neue Dateien unter `tests/rls/` (`fertig.mjs:73-77`), also kein Verstoß. Der Endstand ist durch Lauf 7 gedeckt (`check`, Commit aedb643, sauber, EXIT 0, 1877 bestanden). – Fix: keiner nötig.

N5. `scripts/sys/run.mjs:70` – Die Kopfzeile zur Sauberkeit im Log bedeutet jetzt „sauber, abgesehen von den Nachweisen von `npm run bericht` im Index". `.claude/rules/tests.md` spricht weiter nur vom sauberen Arbeitsbaum. Kopf und Laufzeile bleiben deckungsgleich (beide aus `saubervor`, `run.mjs:68`, `:70`, `:93`), `logOk` vergleicht genau diese beiden (`fertig.mjs:123`). – Fix: ein Halbsatz in `tests.md` bei nächster Gelegenheit (Gate-Datei, braucht die Nachfrage).

N6. `.claude/settings.json:79`, `:91` – Hinweis außerhalb von u4, Herkunft nicht belegt (kein Diff): Für PowerShell steht nur `Remove-Item` auf ask, nicht die Kurzformen `rm`, `del`, `ri`, `erase`. Ob der Guard sie allgemein abfängt, habe ich nicht geprüft (gesehen nur für `docs/freigaben`, `guard.mjs:362`). – Fix: bei Gelegenheit prüfen, in `docs/OFFEN.md` vermerken.

## Prüffragen

**1a. Gilt die Lockerung nur für run.mjs und bericht.mjs?** Ja. `sauber` hat den Standard `false` (`lib.mjs:23`). Aufrufer im ganzen Repo (Suche über `scripts`, `.claude`, `.githooks`, `tests`): `run.mjs:68` und `:90` mit `true`; `fertig.mjs:170` mit `ohneBericht`; `start-schritt.mjs:13` ohne Argument. `sammle` rufen nur `bericht.mjs:13` (`ohneBericht: true`), `fertig.mjs:223` (pre-push) und `fertig.mjs:231` (merge und `--nur-pruefen`), die beiden letzten ohne das Feld, also streng. Der Weg über `npm run t -- cmd node scripts/sys/fertig.mjs --nur-pruefen` (`run.mjs:19`) landet ebenfalls bei `:231`.

**1b. Öffnet die Lockerung einen Nachweisweg?** Nein.
- Fingerabdruck: Er liest den Index (`git ls-files -s`, `fingerabdruck.mjs:23`). `check` schließt `docs` aus, `rls` und `e2e` zählen feste Pfade auf, aus `docs/` nur `docs/reference/design/tokens.json` (`fingerabdruck.mjs:4`, `:7`, `:11-13`). Die zugelassenen Zeilen betreffen nur `docs/proof/`. Für alle Pfade, an denen ein Fingerabdruck hängt, gilt weiter: Arbeitsbaum gleich Index gleich HEAD.
- Wirkung auf Testergebnisse: Unverfolgte Dateien unter `docs/` zählten schon vorher nicht. Eine neu gestagete Datei unter `docs/proof/` hat im Arbeitsbaum dieselbe Wirkung wie eine unverfolgte. Die drei als `M` zugelassenen Dateien liest keine Suite: Die Unit-Tests zum Gate arbeiten in Temp-Ordnern (`tests/unit/sys-fertig.test.ts:206-212`), der Unit-Lauf nimmt nur `tests/unit/**` (`vite.config.ts:23`), der Secret-Scan gehört nicht zu `check` (`package.json:51`, `:58`).
- `gueltigerLauf` (`fertig.mjs:27-36`): verlangt weiter `sauber`, `stabil`, `logOk` und den Abdruck des Endstands. Alte Läufe werden nicht nachträglich gültig: `sauber` steht fest in der Laufzeile und im Logkopf (s9k-1 Läufe 30 und 31 bleiben ungültig).
- `stabil` (`run.mjs:90`): vorher und nachher mit demselben Argument, kein Vergleich streng gegen locker.
- `leseGepruefteRuns` (`fertig.mjs:110-133`): unverändert gebunden an Log-Hash, Commit, Sauber-Angabe, Befehl, Schlusszeile.
- `npm run bericht` kann jetzt „bestanden" melden, während eigene Nachweise im Index liegen. `fertig` rechnet alles selbst neu mit strengem `sauber`, liest Bericht und `gruen.json` nur aus dem Commit und prüft jeden `gruen.json`-Eintrag gegen origin/main oder einen gültigen Lauf (`fertig.mjs:85-96`, `:158`, `:175-176`). Ein von Hand gestagter Eintrag kommt nicht durch.
- Bricht `npm run bericht` nach einem Scan-Treffer ab, fehlt `bericht.json` im Arbeitsbaum (`bericht.mjs:96-97`); das ist eine Löschung und bleibt unsauber, auch gelockert.

**1c. Ist das Muster zu weit oder zu eng?** Für das Gate weder noch.
- Zu weit: nur im Sinn von N1 (fremder Schrittordner), ohne Wirkung auf einen Nachweis. Der `A`-Zweig ist ein reiner Präfixvergleich auf `docs/proof/` mit Schrägstrich; das ist nötig, weil der Bericht Kopien mit wechselnden Namen anlegt (`bericht.mjs:20-26`, `:40`, `:52-58`). Die Vorgabe der Planprüfung ist erfüllt: `M` nur für `gruen.json` und `bericht.json|md` (am Zeilenende verankert, genau eine Ordnerebene), `A` nur unter `docs/proof/`.
- Zu eng: nein. Schrittnamen sind auf Kleinbuchstaben, Ziffern und Bindestrich begrenzt (`start-schritt.mjs:8`), das deckt die Zeichenklasse. Zweiter Berichtslauf vor dem Commit ergibt wieder `A`, nach dem Commit `M` für genau die drei Dateien. Pfade in Anführungszeichen (Sonderzeichen), Umbenennung, Löschung, Typwechsel und jede zweite Statusspalte fallen heraus (sicher geschlossen).

**1d. Belegt der Test die Grenzfälle?** Ja für die geforderten: zweimal geändert (`:57`), neu und danach geändert (`:58`), gelöscht (`:59`), umbenannt (`:60`), gestagete Änderung an altem Nachweis (`:55`), ungestagete Zeile nicht an erster Stelle (`:64`); dazu Doku außerhalb (`:61`), Code gestagt und unverfolgt (`:62-63`). Jeder Fall wird in beiden Formen geprüft (`:68`), der Gutfall auch streng als unsauber (`:50`). Der Test läuft gegen ein echtes Temp-Repo in einem Kindprozess (`:11-29`), prüft also Verhalten, nicht das Muster als Text. Lücken: N3.

**2. run.mjs und fertig.mjs: nur die Aufrufe geändert?** Die Aufrufe stehen wie beschrieben (`run.mjs:68`, `:90`; `fertig.mjs:170`). Beide Dateien ganz gelesen, nichts Auffälliges: `CMD_ERLAUBT` (`run.mjs:14-20`), `PFLICHT` und `MUSS_ABNAHME` (`fertig.mjs:13-15`), Sieben-Tage-Grenze (`fertig.mjs:17`, `:21-24`), Rot-vor-Grün (`:73-77`), pre-push (`:214-225`) sind in sich stimmig und streng. „Nur" ist nicht per Diff belegt (siehe Grenzen).

**3. settings.json.**
- ask-Liste (`:72-117`): kein Eintrag für `git commit` oder `git merge`, weder Bash noch PowerShell. Vorhanden: `git push` (`:78`, `:97`), `rm` (`:79`), `npx dotenv` (`:80`, `:98`), `dotenv` (`:81`, `:99`), `db:push` und Supabase-Befehle (`:73-77`, `:82-87`, `:92-96`, `:100-105`), PowerShell-Schreibbefehle und `Remove-Item` (`:88-91`), `fertig`, `loesch`, `prod` (`:106-111`), Edit auf `scripts/sys`, `.githooks`, `.claude`, `package.json`, `CLAUDE.md` (`:112-116`).
- deny-Liste (`:20-71`): vollständig nach erwarteten Gruppen: `.env`-Dateien für Read, Edit, Write (`:21-38`), `sed`, `node -e`, `node --eval` (`:39-41`), `git stash`, `add -A`, `add .`, `checkout --`, `reset`, `restore`, `clean` (`:42-48`), `supabase config push` (`:49-50`), `push --force` und `-f` (`:51-52`), dieselben für PowerShell (`:53-65`), die beiden Agent-Sperren (`:66-67`), der Supabase-Connector (`:68`), Edit auf `docs/proof` und `docs/freigaben` (`:69-70`).
- Hooks (`:4-17`), Modell und Effort (`:2-3`) vorhanden und stimmig.
- Verlässt sich ein Gate auf die entfallenen Regeln? Nein, mit der Einschränkung M1. Es gibt nur den pre-push-Hook (`.githooks/pre-push:2`), keinen Commit-Hook. Der Guard sperrt das Abschalten der Hooks unabhängig von ask (`guard.mjs:252`, `:259`, `:240-244`). Ein lokaler Merge nach main ohne Gate erreicht origin nicht: `git push` fragt weiter und der Hook prüft Pushes auf main (`fertig.mjs:214-224`); `fertig` verweigert auf main (`:226-229`), `start-schritt` bemerkt ein abweichendes main (`start-schritt.mjs:12`). Eine Änderung nach der Abnahme per Commit fällt über die SHA-Zeilen auf (`fertig.mjs:180`).
- Deckung mit der Doku: `docs/ENTSCHEIDUNGEN.md:181` (Nr. 174), `CLAUDE.md:15`, `docs/BEKS_EINRICHTUNG.md:71`, Vorschlag a7 (`docs/SYSTEM_VORSCHLAG.md:123`) stimmen mit dem Stand überein. Die Entscheidung selbst kann ich nicht bezeugen; sie ist dokumentiert, und die Änderung an `.claude/**` stand unter der Nachfrage-Regel (`settings.json:114`).

**Gate abgeschwächt?** `sauber`: nein im Sinn der Regel. Die Lockerung betrifft nur Indexzustände an Pfaden außerhalb jedes Fingerabdrucks, behebt einen Fehlalarm (gültige Läufe nach dem Bericht zählten nicht) und lässt Merge-Gate und Schrittstart streng. `settings.json`: zwei Nachfragen weniger, auf dokumentierten Beschluss; Nebeneffekt siehe M1.

## Hinweise ohne Finding

- `fingerabdruck.mjs:12`: Der rls-Fingerabdruck enthält `scripts`. Die Änderungen unter `scripts/sys/` ändern ihn, eine Übernahme aus `gruen.json` scheidet aus; `fertig` verlangt bei R3 einen vollen rls-Lauf auf dem Endstand.
- `tmp/proof/u4/`: Zum Prüfzeitpunkt lag `008-e2e.log` ohne Zeile in `runs.jsonl` vor (Lauf offen). Gültig auf dem Endstand war nur Lauf 7 (`check`).

## Stichproben

- `scripts/sys/lib.mjs:23-27` – Standard streng, zwei Zweige, `M`-Zweig am Zeilenende verankert: in Ordnung
- `scripts/sys/lib.mjs:13` – `trim()` auf der Gesamtausgabe: N2
- `scripts/sys/run.mjs:68`, `:90` – beide Aufrufe gelockert, gleiches Argument: in Ordnung
- `scripts/sys/run.mjs:70`, `:93` – Kopf und Laufzeile aus demselben Wert: in Ordnung
- `scripts/sys/fertig.mjs:152`, `:170` – `ohneBericht` Standard `false`, an `sauber` durchgereicht: in Ordnung
- `scripts/sys/fertig.mjs:223`, `:231` – pre-push und merge ohne `ohneBericht`: streng
- `scripts/sys/fertig.mjs:32` – `gueltigerLauf` verlangt `sauber`, `stabil`, `logOk`, Abdruck: unverändert streng
- `scripts/sys/fertig.mjs:120-125` – `logOk` vergleicht Kopf mit Laufzeile: in Ordnung
- `scripts/sys/fertig.mjs:88-93` – `gruen.json` im Commit gegen origin/main oder gültigen Lauf: in Ordnung
- `scripts/sys/fertig.mjs:195-203` – genau ein geändertes `bericht.json` je Push: deckt N1
- `scripts/sys/bericht.mjs:13` – einziger Aufrufer mit `ohneBericht: true`: in Ordnung
- `scripts/sys/bericht.mjs:96-98`, `:128-130` – Schreiben und Stagen nur des eigenen Ordners und `gruen.json`: in Ordnung
- `scripts/sys/start-schritt.mjs:13` – `sauber()` ohne Argument: streng
- `scripts/sys/fingerabdruck.mjs:4`, `:11-13`, `:23` – `docs` ausgeschlossen, Index als Quelle: in Ordnung
- `tests/unit/sys-sauber.test.ts:41-52` – Gutfall mit Gegenprobe streng: in Ordnung; `:46-49` fremder Schrittordner: N1
- `tests/unit/sys-sauber.test.ts:54-70` – zehn Schlechtfälle, je beide Formen: in Ordnung, Lücken N3
- `tmp/proof/u4/runs.jsonl:1`, `:2`, `:6`, `:7` – rot, grün, grün (12 Tests), `check` grün auf aedb643 und sauber: in Ordnung, N4
- `.claude/settings.json:72-117` – keine Einträge für commit und merge; push, rm, dotenv vorhanden: in Ordnung
- `.claude/settings.json:20-71` – deny-Gruppen vollständig: in Ordnung (nicht per Diff belegt)
- `.claude/hooks/guard.mjs:252`, `:259` – Hooks abschalten gesperrt: in Ordnung
- `.claude/hooks/guard.mjs:356-364`, `:384` – Schreiben nach `docs/freigaben` gesperrt, node als Leser: M1
- `scripts/sys/gate-loesch-lib.mjs:25-29`, `:37-44` – Freigaben aus HEAD, Prüfung im Testlauf: M1
- `.githooks/pre-push:2` – einziger Hook, ruft das Gate: in Ordnung
- `docs/ENTSCHEIDUNGEN.md:181` – Nr. 174 deckt den Stand der ask-Liste: in Ordnung
- `package.json:51`, `:53`, `:58` – `check` ohne Proof-Scan, kanonische Befehle unverändert: in Ordnung

Offene Findings hoch: 0
