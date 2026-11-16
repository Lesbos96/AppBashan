Modell: claude-fable-5-2
Vorgaenger: tmp/proof/n15-abnahme-1.md

# Abnahme Schritt n15, Runde 2

- Datum: 2026-11-16
- Stufe: R3
- Geprüfter Stand: HEAD 1de88b5 (Angabe aus dem Auftrag; Lauf 023 nennt denselben Commit, Arbeitsbaum sauber)
- Umfang: nur die Änderung seit Runde 1. Die Messdatei `tests/rls/auth-token-codes.test.ts` ist aus dem Schritt genommen (ENTSCHEIDUNGEN Nr. 184, Frage 2). Geprüft: Herausnahme und Verweise, `tests/unit/auth-token.test.ts`, `docs/OFFEN.md` (n15-3), `docs/ENTSCHEIDUNGEN.md` (Nr. 184), Gate unverändert, Restrisiko ohne Live-Smoke.
- Vollständig gelesen: `tmp/proof/n15-abnahme-1.md`, `supabase/functions/_shared/auth.ts`, `tests/unit/auth-token.test.ts`, `tmp/n15-auth-token-codes.test.ts`, `tmp/proof/n15/runs.jsonl`, `tmp/proof/n15/deploy-log.md`, `docs/BEKS.md`, `docs/proof/n15/bericht.json`, `scripts/sys/abnahme-lib.mjs`, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`
- In Auszügen gelesen: `docs/OFFEN.md:76-91, 141`, `docs/ENTSCHEIDUNGEN.md:186-191`, `docs/STAND.md:1-20`, `scripts/sys/fertig.mjs:14-18, 55-99, 182-191`, `scripts/sys/gate-db-lib.mjs:39-51`, `vite.config.ts` (Testprojekte), `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:1-70`, `tests/rls/delete-account-live.test.ts:28-53`; Logs 001, 002, 015, 017, 019, 020, 022, 023 nur an Kopf, Fehlerzeilen, Dateinamen und EXIT

Alle übrigen Aussagen der Runde 1 (Migration 0066, `positiv.ts`, `loesch-register.json`, `account-deletion-concurrency`, `execute-entzug`, Prüffragen a bis d, Kurzurteil Geld, Sicherheit, Schema) gelten unverändert und werden hier nicht wiederholt: Die sechs Hashes unten sind dieselben wie in Runde 1 (`tmp/proof/n15-abnahme-1.md:18-23`, Zeichen für Zeichen verglichen).

Grenzen dieser Prüfung
- Kein Werkzeug zum Hashen und keines für `git diff` oder `git log`. Die Hashes sind aus dem Auftrag abgeschrieben, nicht selbst gebildet; den Abgleich mit dem Endstand macht das Gate.
- „Kein Gate geändert“ und „nur Zeile 4 geändert“ kann ich nicht Byte für Byte belegen, nur mittelbar (siehe Prüfpunkte 2 und 3).
- Die Entscheidung Nr. 184 ist als Entscheidung von Beks eingetragen. Den Prompt von Beks sehe ich nicht; ich prüfe, ob der Eintrag zur Lage passt, nicht, ob Beks es so gesagt hat. Die Abnahme steht unter dieser Voraussetzung. Runde 1 (M1) hatte das Verschieben der Datei ohne Entscheidung von Beks ausgeschlossen.
- Ob nach dem Deploy aus `deploy-log.md` eine der 13 Functions erneut deployt wurde, kann ich nicht messen. Der Auftrag und die Unterlagen nennen keinen weiteren Deploy.
- Die Suche (ripgrep) übergeht ignorierte Pfade wie `tmp/`; die Aussage „nirgends referenziert“ gilt für `supabase`, `src`, `tests`, `scripts`, `package.json`, `.claude`, `.githooks`.

SHA256: 73d55cc01f2556368e64cb769192e88f199f1f035a8c364ecf900374683c267f supabase/functions/_shared/auth.ts
SHA256: dbe297df307bc6c897b4c2f49fc3d98b779aa5d3b9acf01586bd9ff6811d4139 tests/support/positiv.ts
SHA256: 4e77192e528be1df99946b0c89d07f6c9e6aba5ca1b1aa0e9731a46142d75f6f scripts/sys/loesch-register.json
SHA256: c2b7ab7237d0b4e8ce25e0b9fd12b9b54151b6c8540fb156d9b30cce8ce709f0 supabase/migrations/20261116022741_0066_execute_entzug.sql
SHA256: de7860f62b7ca9356c894bddba4bdeb408bd72f5fefd44f6cc263cc3220f51fa tests/rls/execute-entzug.test.ts
SHA256: 098b3c8099299cbce6812bcde0272a571eafccc99186ca9e1d8354356f79e910 tests/rls/account-deletion-concurrency.test.ts

Ohne Hash gelesen (nicht Teil der Mindestmenge, `scripts/sys/fertig.mjs:16`): `tests/unit/auth-token.test.ts`. Eine Zeile für die herausgenommene Datei ist nicht nötig: `tests/rls/` gehört nicht zur Mindestmenge, und die Datei war nie auf `main` (`fertig.mjs:186`).

## Ergebnis in Kürze

Kein hoher Fund, kein mittlerer. M1 der Runde 1 ist durch die Herausnahme der Datei erledigt; die Gate-Regel für neue rls-Tests steht unverändert an derselben Stelle. Am Produktcode hat sich nichts geändert (`auth.ts` mit gleichem Hash, keine Function, keine Migration). Der Unit-Test trägt die Zuordnung in `rejectToken` weiter. Vier niedrige Funde, alle Doku oder Folgearbeit für n15-3; keiner verlangt eine Änderung an einer Datei mit Hash-Zeile.

Hinweis ohne Fund: Der letzte Volllauf `rls` (Lauf 022) lief auf c61dd3f und enthielt die herausgenommene Datei. Für 1de88b5 steht in `runs.jsonl` bisher nur `check` (Lauf 023). Ob `rls` und `e2e` neu laufen müssen, entscheidet das Gate am Fingerabdruck.

## Findings

### hoch
Keine. Runde 1 hatte keinen hohen Fund; es wird nichts übernommen.

### mittel
Keine. M1 der Runde 1 (kein roter Lauf für die Messdatei) entfällt: Die Datei ist nicht mehr unter `tests/rls/`, die Regel `scripts/sys/fertig.mjs:75-78` trifft sie nicht mehr. Für die zwei verbleibenden neuen rls-Dateien liegt je ein roter Lauf vor dem ersten grünen (`runs.jsonl:3` vor `:12`, `:5` vor `:14`).

### niedrig
- **N1** `docs/OFFEN.md:84`, `tests/rls/delete-account-live.test.ts:39` – Restrisiko ohne Live-Smoke: Kein Volllauf prüft mehr, dass ein gefälschtes Token an den deployten Functions 401 ergibt, und das Token eines gelöschten Kontos prüft nur noch `delete-account` (dort mit Antworttext). Die anderen zwölf Functions sind für abgelehnte Tokens bis n15-3 live ungeprüft. Der Stand ist belegt (Läufe 017 und 022, `deploy-log.md:9`), und eine Abweichung endet geschlossen (500 statt 401, nie Zugriff). Auslöser wäre ein neuer Deploy einer der 13 Functions mit neuerer auth-js-Fassung (Runde 1, N2) oder eine Änderung an `auth.ts` (hash-gebunden, braucht Abnahme). – Fix: in OFFEN n15-3 ergänzen, dass n15-3 vor dem nächsten Schritt läuft, der eine der 13 Functions deployt, spätestens vor dem Produktivprojekt. Kein Hash betroffen.
- **N2** `docs/OFFEN.md:84` – Der Rot-Beweis „je Code der Liste entfernen, der Test muss rot werden“ ist so nicht erfüllbar. Gegen Dev erzeugbar ist nur `bad_jwt` (gefälscht); `session_expired`, `user_not_found`, `user_banned` sind nicht messbar (Runde 1, N4), ihr Entfernen lässt nur den Unit-Test rot werden. Das gelöschte Konto hängt am Typzweig (`auth.ts:22`), nicht an der Liste. Der Live-Smoke-Teil ruft die deployten Functions und wird durch eine lokale Mutation nie rot. – Fix: Text in n15-3 richtigstellen: Mutation 1 entfernt `bad_jwt`, Mutation 2 den Typzweig; rot wird jeweils das Urteil über die echte Dev-Antwort (Ist-Wert: Störung statt Ablehnung). Für den Live-Smoke festhalten, dass er Messung bleibt. Eine mutierte `auth.ts` wird nie deployt, und am Ende des Schritts muss ihr Hash wieder der abgenommene sein.
- **N3** `docs/OFFEN.md:84`, `tests/unit/auth-token.test.ts:4`, `supabase/functions/_shared/auth.ts:6` – n15-3 sagt, beide Kommentare nennen den Pfad schon. Das stimmt nur für `auth.ts:6`; der Unit-Test nennt den OFFEN-Punkt, der mit n15-3 verschwindet. Der Verweis in `auth.ts:6` zeigt bis dahin auf eine Datei, die es nicht gibt. Das ist hingenommen und in Ordnung: Die Korrektur änderte den Hash einer Datei der Mindestmenge (neue Runde, neuer Deploy) für eine Kommentarzeile, und n15-3 legt die Datei an diesen Pfad. – Fix: Satz in n15-3 berichtigen; n15-3 schließt erst, wenn die Datei am Pfad liegt und `auth-token.test.ts:4` wieder auf sie zeigt. Legt n15-3 sie woanders ab, `auth.ts:6` mitziehen (dann mit Abnahme und Deploy).
- **N4** `tmp/n15-auth-token-codes.test.ts:36-39`, `docs/OFFEN.md:84`, `docs/ENTSCHEIDUNGEN.md:190` – „Falscher Schlüssel: 401 ohne Code“ ist durch die Messdatei nicht belegt. Geprüft wird dort nur Status 401 und dass `rejectToken` wirft, also dass der Code keiner der vier ist. Das berichtigt auch meine Formulierung in Runde 1 (Frage a, „gemessen: 401 ohne Code“); am Urteil ändert es nichts, weil die Zuordnung nur davon abhängt, dass keiner der vier Codes kommt. Dazu: Die Vorlage für n15-3 und die Läufe 009 und 017 liegen nur unversioniert unter `tmp/`; in einem anderen Worktree oder nach einem Aufräumen fehlen sie. Die Messwerte stehen aber in `docs/OFFEN.md:84` und `auth.ts:1-7`, und Lauf 022 liegt unter `docs/proof/n15/`. – Fix: in n15-3 Name, Status und Code beim falschen Schlüssel exakt erwarten; in OFFEN n15-3 Lauf 022 als Beleg nennen.

Stand der niedrigen Funde aus Runde 1: N1 bis N4, N6, N7, N9 stehen in `docs/OFFEN.md:83` (n15-1), N5 ist dort auf n15-3 umgestellt, N8 ist erledigt (in `docs/OFFEN.md` kein Punkt s9k1 mehr, u3-4 ohne N15 und N21, `:141`).

## Prüfpunkte aus dem Auftrag

### (1) Datei heraus, keine Referenz als Test

- Unter `tests/rls/` liegt keine Datei, deren Name mit `auth-token` beginnt (Dateisuche, kein Treffer).
- Suche nach dem Dateinamen über das Repo: Treffer nur in `supabase/functions/_shared/auth.ts:6` (Kommentar) und in Doku und Nachweisen (`docs/STAND.md:7, 15`, `docs/OFFEN.md:84`, `docs/ENTSCHEIDUNGEN.md:190-191`, `docs/proof/n15/`). Kein Treffer in `src`, `tests`, `scripts`, `package.json`, `.claude`, `.githooks`. Kein Import, keine Liste, keine Ausnahme mit diesem Namen.
- Die Kopie `tmp/n15-auth-token-codes.test.ts` kann nicht versehentlich laufen: Die Testprojekte nehmen nur `tests/unit/**` und `tests/rls/**` auf (`vite.config.ts:23, 28`), und ihre Importpfade lösen von `tmp/` aus nicht auf.
- `runs.jsonl:9, 19` (Läufe 009, 017) nennen die Datei weiter als Ziel. Das ist richtig so; Nachweise werden nicht geändert.

### (2) `tests/unit/auth-token.test.ts` und Rot vor Grün

- Seit dem Stand, den Runde 1 gelesen hat, gibt es zwei Änderungen, nicht eine. Zeile 4 (Kommentar, Verweis auf OFFEN n15-3) und Zeile 62: ein Typ-Cast am Argument. Der Cast stammt aus dem Commit nach Runde 1 (c61dd3f laut Auftrag „Typfehler im Unit-Test behoben“); Lauf 019 zeigt den Typfehler genau an dieser Stelle (`019-check.log:18`, Zeile 62, Spalte 84, Feld `message`). Ein Cast wirkt nur im Typsystem, zur Laufzeit ist der Test derselbe.
- Mittelbarer Beleg für „sonst unverändert“: Alle Zeilenangaben der Runde 1 treffen am Endstand denselben Inhalt (`:22-39` sechs Ablehnungen und acht Störungen, `:55` Felder des Fehlers, `:58-69` kein Token, keine Originalmeldung, kein `cause`, `:92-124` 13 Handler). Die Datei hat weiter 18 Tests (3 + 2 + 13), wie in den Läufen 001, 002 und 015.
- Rot vor Grün trägt weiter: Lauf 001 (2283504, sauber, 3 von 18 rot, EXIT 1), Lauf 002 (d53a9f1, sauber, 12 von 18 rot, EXIT 1), Lauf 015 (815513d, sauber, 18 grün, EXIT 0). Am Endstand grün im `check`: Lauf 020 (c61dd3f) und Lauf 023 (1de88b5, sauber, 1922 bestanden, EXIT 0, `023-check.log:125` mit 18 Tests). `auth.ts` hat denselben Hash wie in Runde 1.
- Der Unit-Test hängt nicht an der herausgenommenen Datei: Er importiert nur `auth.ts`, die Handler und die zwei `db.ts` (`:5-16`).

### (3) OFFEN n15-3, ENTSCHEIDUNGEN Nr. 184, Gate

- `docs/OFFEN.md:84` (n15-3) stimmt in der Lage: Datei unter `tmp/` vorhanden; gefälscht 403 `bad_jwt` (`tmp/n15-auth-token-codes.test.ts:33`), gelöschtes Konto Fehlertyp „Sitzung fehlt“ mit 400 ohne Code (`:44`), 13 Functions mal zwei Tokens, 26 Aufrufe mit 401 (`:48-58`), Läufe 009 und 017 vorhanden. Ungenau sind drei Stellen: N2, N3, N4.
- `docs/ENTSCHEIDUNGEN.md:191` (Nr. 184), Teil 2: stimmt. Die Folge „Runde 2 nötig“ ist richtig hergeleitet: Eine Datei aus der Hash-Liste der Abnahme, die fehlt, meldet das Gate als geändert (`fertig.mjs:184`).
- Nr. 184, Teil 1 (s9k1-2, Kontakt der Firma bleibt bei offener Kundenmeldung lesbar): Produktentscheidung, keine Codeänderung in n15. Stichprobe: Jeder Aufruf wird protokolliert und verlangt aal2 und eine aktive Firma mit Zugriff (`0065:42-48`); die Sperre nach einem Storno ohne Pauschale steckt in `private.partner_data_access` (`0065:21-29`). Keine Rechte-Ausweitung: Die Firma hat die Kontaktdaten seit der Annahme. Nicht nachgeprüft: dass die Entscheidung „nicht stattgefunden“ den Storno-Grund setzt (steht in Nr. 180) und dass die Firma für Start, Abschluss, Nachtrag und Absage gesperrt ist (Abnahme s9k-1). `docs/OFFEN.md` und `docs/BEKS.md` führen s9k1-2 und die zwei Fragen nicht mehr (`docs/BEKS.md:11, 13`); `docs/STAND.md:20` passt dazu.
- Gate: ohne Diff nur mittelbar belegt.
  - Die Regel für neue rls-Tests steht an derselben Stelle mit demselben Inhalt wie in Runde 1 (`fertig.mjs:75-78`), ohne Ausnahme. Die Mindestmenge (`fertig.mjs:16`) umfasst weiter `scripts/sys/*.mjs`, das Lösch-Register, Hooks, Agents, Settings, `.githooks/` und `package.json`.
  - Suche nach dem Dateinamen und nach dem Schrittnamen in `scripts`, `.claude`, `.githooks`, `package.json`: kein Treffer, also keine Ausnahme nach Namen.
  - `docs/proof/n15/bericht.json:23-31` (Stand c61dd3f) zählt unter `scripts` eine geänderte Datei (das Lösch-Register, Hash wie Runde 1) und unter „andere“ eine (nach meiner Zuordnung `tests/support/positiv.ts`). Für eine geänderte Gate-Datei ist darin kein Platz.
  - Selbstschutz: Hätte 1de88b5 eine Datei der Mindestmenge geändert, meldete `fertig` sie als „geändert, aber nicht von der Abnahme genannt“, weil diese Runde sie nicht nennt (`fertig.mjs:185`).
  - `check` zählt am Endstand dieselben 1922 Tests wie vor der Herausnahme (Läufe 020 und 023); es ist kein Gate-Test weggefallen.
  - `runs.jsonl` ist nur gewachsen: Zeilen 1 bis 20 wie in Runde 1 gelesen, danach die Läufe 019 bis 023.

### (4) Live-Smoke nicht mehr im Volllauf

Bewertung: niedrig, hingenommen bis n15-3 (N1).
- Belegter Stand: Lauf 017 (815513d, Arbeitsbaum nicht sauber) und Lauf 022 (Volllauf auf c61dd3f, sauber, `022-rls.log:258`, EXIT 0) nach dem Deploy der 13 Functions (`deploy-log.md:3-9`). Lauf 022 ist der Lauf auf committetem Stand, der in Runde 1 noch ausstand. `auth.ts` ist seither unverändert.
- Was im Volllauf bleibt: Token eines gelöschten Kontos ergibt an der deployten `delete-account` 401 mit Antworttext (`tests/rls/delete-account-live.test.ts:39`); das ist genau der Typzweig aus N2 der Runde 1. Aufrufe ohne Token ergeben 401 an acht Functions (`flow-live.test.ts:172, 197, 340, 370`, `partner-functions-live.test.ts:111, 179, 213`, `delete-account-live.test.ts:51`); diese Wege rufen Auth nicht auf und sagen über `rejectToken` nichts.
- Was fehlt: gefälschtes Token live an allen 13, gelöschtes Konto live an zwölf. Die Zuordnung selbst bleibt durch den Unit-Test in jedem `check` gedeckt; live ungedeckt ist nur, ob Auth und auth-js weiter dieselben Antworten liefern.
- Folge einer unbemerkten Abweichung: 500 statt 401, die App meldet nicht ab. Kein Zugriff, keine Daten, kein Geldweg.

### Geld, Sicherheit, Schema

Seit Runde 1 keine Änderung an Code, Migration, Rechten oder Register (Hashes gleich). Geld ist nicht berührt. Die Herausnahme einer Testdatei erweitert keine Rechte und lockert keine Sperre. Urteil der Runde 1 gilt.

## Stichproben (selbst nachgeschlagen)

- Dateisuche `tests/rls/auth-token*` – kein Treffer. In Ordnung.
- Dateisuche `tmp/n15*` – `tmp/n15-auth-token-codes.test.ts` vorhanden. Passt zu Nr. 184.
- Suche nach dem Dateinamen der Messdatei, ganzes Repo – Code nur `supabase/functions/_shared/auth.ts:6`. In Ordnung (N3).
- Dieselbe Suche und die Suche nach dem Schrittnamen in `.claude`, `.githooks`, `scripts`, `package.json` – kein Treffer. In Ordnung.
- `vite.config.ts:23, 28` – Testprojekte nur `tests/unit/**` und `tests/rls/**`. In Ordnung.
- `supabase/functions/_shared/auth.ts:8, 21-25` – Liste, Typzweig, Statusbedingung, Wurf wie in Runde 1. In Ordnung.
- `tests/unit/auth-token.test.ts:4` – Verweis auf OFFEN n15-3, kein Pfad. Grundlage für N3.
- `tests/unit/auth-token.test.ts:22-39, 55, 58-69, 92-124` – Inhalt an den Stellen der Runde 1. In Ordnung.
- `tests/unit/auth-token.test.ts:62` – Typ-Cast am Argument. Laufzeit unverändert.
- `tmp/proof/n15/019-check.log:1, 18, 22` – d9f4d6c, Typfehler in Zeile 62, EXIT 2. Erklärt den Cast.
- `tmp/proof/n15/001-…log:1-2, 76`, `002-…log:1-2, 230`, `015-…log:1-2, 22` – sauber, EXIT 1, 1, 0. In Ordnung.
- `tmp/proof/n15/020-check.log:1-2, 99, 373` – c61dd3f, sauber, 18 Tests der Datei, EXIT 0. In Ordnung.
- `tmp/proof/n15/023-check.log:1-2, 125, 349-350, 358` – 1de88b5, sauber, 18 Tests der Datei, 66 Dateien, 1922 Tests, EXIT 0. In Ordnung.
- `tmp/proof/n15/runs.jsonl:25` – Lauf 023, `check`, Exit 0, sauber, neuer Fingerabdruck. In Ordnung.
- `tmp/proof/n15/runs.jsonl:3, 12` und `:5, 14` – rot vor grün für `execute-entzug` (003, 010) und `account-deletion-concurrency` (005, 012). In Ordnung.
- `tmp/proof/n15/runs.jsonl:24` – Lauf 022, `rls` auf c61dd3f, 378 Tests; kein `rls`-Lauf auf 1de88b5. Hinweis oben.
- `tmp/proof/n15/022-rls.log:258, 482, 491` – Messdatei im Volllauf grün, 45 Dateien, EXIT 0. In Ordnung.
- `tmp/proof/n15/017-…log:1-2, 13-15, 27` – 815513d, nicht sauber, ein Test bestanden, EXIT 0. In Ordnung.
- `tmp/n15-auth-token-codes.test.ts:33, 44` – Erwartungen für gefälscht und gelöscht exakt. In Ordnung.
- `tmp/n15-auth-token-codes.test.ts:36-39` – falscher Schlüssel: nur Status und Wurf. Grundlage für N4.
- `tmp/n15-auth-token-codes.test.ts:48-58` – 13 Functions, zwei Tokens, 401. In Ordnung.
- `tmp/proof/n15/deploy-log.md:3-9` – ein Deploy, 13 Functions, JWT-Prüfung am Gateway aus, Smoke 26 Aufrufe. In Ordnung.
- `tests/rls/delete-account-live.test.ts:39, 51` – gelöschtes Konto 401 mit Antworttext; ohne Token 401. Grundlage für N1.
- `tests/rls/flow-live.test.ts:172, 197, 340, 370`, `tests/rls/partner-functions-live.test.ts:111, 179, 213` – 401 ohne Token. In Ordnung.
- `scripts/sys/fertig.mjs:16` – Mindestmenge der Abnahme; `tests/rls/` und `tests/unit/` gehören nicht dazu. In Ordnung.
- `scripts/sys/fertig.mjs:75-78` – Regel roter Lauf vor grünem, keine Ausnahme. In Ordnung.
- `scripts/sys/fertig.mjs:184-186, 189` – fehlende Datei aus der Hash-Liste gilt als geändert; ungenannte Datei der Mindestmenge blockiert; neue rls-Tests aus dem Diff. In Ordnung.
- `scripts/sys/abnahme-lib.mjs:20-24`, `scripts/sys/gate-db-lib.mjs:39-51` – Format dieser Datei (eine Vorgänger-Zeile, Hash-Zeilen, eine Schlusszeile). Eingehalten.
- `docs/proof/n15/bericht.json:4-7, 19, 23-31` – Gate blockiert nur wegen M1, Stand c61dd3f, Zählung der geänderten Dateien. Passt.
- `docs/OFFEN.md:83` – n15-1 mit N1 bis N4, N6, N7, N9 der Runde 1. In Ordnung.
- `docs/OFFEN.md:84` – n15-3. Lage richtig, drei Ungenauigkeiten (N2, N3, N4).
- `docs/OFFEN.md:141`, Suche nach s9k1 in `docs/OFFEN.md` – N8 der Runde 1 erledigt.
- `docs/ENTSCHEIDUNGEN.md:190, 191` – Nr. 183 und 184. Passt zur Lage (N4 zum Wortlaut „ohne Code“).
- `docs/BEKS.md:11, 13` – keine offene Frage. In Ordnung.
- `docs/STAND.md:6-7, 15, 20` – Herausnahme genannt, nächster Schritt n15-3. In Ordnung.
- `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:21-29, 42-48` – Sperre nach Storno ohne Pauschale, Protokollzeile vor der Ausgabe. Passt zu Nr. 184, Teil 1.
- `tmp/proof/n15-abnahme-1.md:18-23` – sechs Hashes gleich denen des Auftrags. In Ordnung.

Offene Findings hoch: 0
