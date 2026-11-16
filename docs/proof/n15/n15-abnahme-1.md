Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme Schritt n15, Runde 1

- Datum: 2026-11-16
- Stufe: R3 (Migration 0066, Edge Functions, Lösch-Register)
- Umfang: `rejectToken` und `AuthServiceError`, Positivzeilen-Register (zwölf Einträge), Lösch-Register (Eintrag `tests/support/positiv.ts`), Migration 0066 samt den drei neuen rls-Tests
- Vollständig gelesen: die sieben Dateien unten, dazu `tests/unit/auth-token.test.ts`, `tests/rls/positiv.test.ts`, `supabase/functions/_shared/account/handlers.ts`, `tmp/proof/n15/db-freigabe-1.md`, `tmp/proof/n15/runs.jsonl`, `tmp/proof/n15/deploy-log.md`, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`
- In Auszügen gelesen: `_shared/jobs/db.ts`, `_shared/jobs/handlers.ts`, `_shared/quote/db.ts`, `_shared/quote/handler.ts`, `_shared/photo/handlers.ts`, `tests/support/owner.ts`, `tests/rls/report-flow.test.ts`, `scripts/sys/fertig.mjs`, `supabase/config.toml`, `docs/OFFEN.md`, frühere Abnahmen (u3, u3b, u3-1, s9k-1, u1b); Logs 001 bis 018 nur an FAIL, AssertionError und EXIT

Grenzen dieser Prüfung
- Kein Werkzeug für `git diff` und keines zum Hashen. Die Hashes unten sind aus dem Auftrag abgeschrieben; den Abgleich mit dem Endstand macht das Gate.
- „Nur diese Zeilen geändert“ (Fragen b und c) habe ich am Endstand, an den Zeilenangaben früherer Abnahmen und an den Läufen 006 und 016 geprüft, nicht Byte für Byte gegen `main`.
- Das Verhalten von Supabase Auth habe ich nicht selbst gemessen. Gemessen ist, was Lauf 017 belegt (gefälscht, gelöschtes Konto, falscher Schlüssel). Aussagen zu „abgelaufen“ und zu N1 sind aus dem Verhalten des Auth-Dienstes hergeleitet.
- Die Migration habe ich gelesen und gegen die DB-Freigabe gehalten, die Vorfassungen in 0064 nicht erneut Zeile für Zeile verglichen (das steht in der Freigabe, Prüffragen 1 und 2).

SHA256: 73d55cc01f2556368e64cb769192e88f199f1f035a8c364ecf900374683c267f supabase/functions/_shared/auth.ts
SHA256: dbe297df307bc6c897b4c2f49fc3d98b779aa5d3b9acf01586bd9ff6811d4139 tests/support/positiv.ts
SHA256: 4e77192e528be1df99946b0c89d07f6c9e6aba5ca1b1aa0e9731a46142d75f6f scripts/sys/loesch-register.json
SHA256: c2b7ab7237d0b4e8ce25e0b9fd12b9b54151b6c8540fb156d9b30cce8ce709f0 supabase/migrations/20261116022741_0066_execute_entzug.sql
SHA256: de7860f62b7ca9356c894bddba4bdeb408bd72f5fefd44f6cc263cc3220f51fa tests/rls/execute-entzug.test.ts
SHA256: 098b3c8099299cbce6812bcde0272a571eafccc99186ca9e1d8354356f79e910 tests/rls/account-deletion-concurrency.test.ts
SHA256: 0670cdca2f17952b59c716b1f8553593778324e65b9768acc72b9f416b9d2e11 tests/rls/auth-token-codes.test.ts

Ohne Hash gelesen (nicht Teil der Hash-Liste): `tests/unit/auth-token.test.ts`.

## Ergebnis in Kürze

Kein hoher Fund. `rejectToken` trennt Ablehnung und Störung richtig, der geworfene Fehler trägt weder Token noch Nutzer-ID noch die Originalmeldung, und alle 13 Handler antworten bei einer Störung mit 500. Das Lösch-Register ist am Endstand nicht abgeschwächt, das Positivzeilen-Register stimmt mit dem Katalog überein (Lauf 016). Geld ist nicht berührt.

Ein mittlerer Fund betrifft das Verfahren, nicht den Code: `npm run fertig` wird am fehlenden roten Lauf von `tests/rls/auth-token-codes.test.ts` anhalten (M1). Diese Abnahme ersetzt den roten Lauf nicht.

Wer einen niedrigen Fund in einer Datei mit Hash-Zeile behebt, braucht danach Runde 2 (und bei `auth.ts` einen neuen Deploy). Ein Eintrag in `docs/OFFEN.md` ändert keinen Hash.

## Findings

### hoch
Keine.

### mittel
- **M1** `tmp/proof/n15/runs.jsonl:9`, `scripts/sys/fertig.mjs:75-78` – `tests/rls/auth-token-codes.test.ts` ist eine neue Datei unter `tests/rls/`, ihr erster Lauf (009) ist grün. Das Gate verlangt bei R3 einen roten Lauf vor dem ersten grünen und kennt keine Ausnahme; `fertig` meldet deshalb „kein roter Lauf vor dem ersten grünen“. In der Sache ist die Lücke klein: Die Zuordnung in `rejectToken` ist rot belegt (Lauf 002 auf sauberem d53a9f1, zwölf Fehlschläge mit Ist-Werten: Gateway-401 ohne Code ergab `null` statt Störung, neun Handler schrieben das Token ins Log; Lauf 015 grün). Die rls-Datei misst fremdes Verhalten (Antworten von Auth) und ruft die deployten Functions auf; eine eigene Sperre, die man für einen roten Lauf lockern könnte, steckt nur in `auth.ts`, und das Zurücksetzen hat das Werkzeug-Gate abgelehnt. Nie rot gesehen wurde damit nur der Live-Smoke (abgelehntes Token ergibt 401 an den 13 deployten Functions). – Fix: nicht umgehen (kein Umbenennen oder Verschieben der Datei, kein Eingriff in `runs.jsonl`, keine Änderung am Gate). Blockiert `fertig`: anhalten, in `docs/BEKS.md` eintragen, Beks entscheidet über den Rettungsweg (`docs/BEKS_EINRICHTUNG.md`). Die Entscheidung liegt nicht bei der Hauptsession und nicht bei mir.

### niedrig
- **N1** `supabase/functions/_shared/jobs/handlers.ts:54-55`, `supabase/functions/_shared/photo/handlers.ts:132-133`, `supabase/functions/_shared/auth.ts:8, 23-24` – Zwölf Handler reichen jeden nicht leeren Wert aus dem Authorization-Header an Auth weiter. Enthält der Token-Teil ein Leerzeichen, erkennt Auth darin kein Token und antwortet nach meiner Herleitung mit 401 und dem Code `no_authorization` (nicht gemessen). Der Code steht nicht in der Liste, also Störung: 500 und eine Logzeile `*_failed`. Vor n15 war das 401. Die App schickt so etwas nie; betroffen ist nur ein absichtlich falscher Aufruf. Folge: Jeder ohne Konto kann 500er und Fehlerzeilen in zwölf Functions erzeugen (Rauschen in der Überwachung), keine Daten, keine Zustandsänderung. `quote` ist nicht betroffen (Formprüfung vor dem Aufruf, `quote/handler.ts:34, 214`). – Fix: dieselbe Formprüfung in `authed` und `handleJobPhoto` (401 ohne Aufruf an Auth, spart auch den Aufruf bei Müll-Tokens), eine Testzeile dazu; vorher an Dev messen. Nach OFFEN, eigener kleiner Schritt.
- **N2** `supabase/functions/_shared/auth.ts:8, 22`, `supabase/functions/accept/index.ts:3` – „Sitzung fehlt“ wird nur am Fehlertyp erkannt, den auth-js aus `session_not_found` bildet; der rohe Code steht nicht in der Liste. Die Functions laden supabase-js mit offener Hauptversion, die Tests nehmen die Version aus dem Repo. Ändert auth-js die Umsetzung, wird ein gelöschtes oder abgemeldetes Konto nach dem nächsten Deploy zu 500 (fail closed, kein Abmelden). Der Live-Smoke in Lauf 017 belegt den heutigen Stand und fängt eine Änderung beim nächsten Volllauf. – Fix: bei der nächsten Änderung an `auth.ts` den rohen Code in die Liste aufnehmen.
- **N3** `supabase/functions/_shared/auth.ts:13-14` – `authStatus` und `authCode` liest niemand (Suche über `supabase`, `src`, `tests`, `scripts`: nur `auth.ts` und `tests/unit/auth-token.test.ts:55`). Die Handler loggen bei einer Störung nur den festen Text. Ob der Schlüssel der Function rotiert wurde (401 ohne Code), Auth 5xx liefert oder ein Limit greift (429), steht damit nicht mehr im Log; vor n15 stand dort die Originalmeldung. – Fix: Status und Code mitloggen, den Code nur, wenn er ein kurzer Bezeichner aus Kleinbuchstaben und Unterstrich ist (er kommt aus der Antwort des Gegenübers). Nach OFFEN; die Änderung braucht einen Deploy.
- **N4** `tests/unit/auth-token.test.ts:30-39`, `supabase/functions/_shared/auth.ts:6-7, 23` – Keine Zeile prüft einen Ablehnungs-Code mit einem Status außerhalb von 400, 401, 403 (etwa 500 mit `bad_jwt`); fällt die Statusbedingung weg, bleibt alles grün. Dazu sind „abgelaufen“ und drei der vier Codes nicht gemessen (steht so im Kommentar). Für „abgelaufen“ halte ich die Annahme für tragfähig: Auth prüft Ablauf und Signatur im selben Schritt und meldet beides gleich. – Fix: eine Zeile in `FAULTS`; „abgelaufen“ einmal von Hand messen (Token nach Ablauf der Gültigkeit erneut senden) und das Ergebnis im Kommentar festhalten.
- **N5** `tests/rls/auth-token-codes.test.ts:56` – Der Live-Smoke prüft nur den Status. Ein 401 der Plattform (falls die JWT-Prüfung am Gateway je eingeschaltet wird) bestünde, ohne dass der Handler läuft. Heute ist sie für alle Functions aus (`supabase/config.toml:418-467`, `tmp/proof/n15/deploy-log.md:7`), der Smoke misst also den Handler. – Fix: zusätzlich den Antworttext `unauthorized` verlangen.
- **N6** `tests/rls/account-deletion-concurrency.test.ts:17, 40-55` – Grün belegt nicht, dass die zweite Sitzung gewartet hat: Startet sie mehr als vier Sekunden zu spät, laufen beide nacheinander und das Ergebnis ist dasselbe. Dass die festen Wartezeiten auf Dev eine echte Überlappung ergeben, zeigt der rote Lauf 005 (die Löschung lief neben der nicht committeten Meldung durch). – Fix (optional): je Sitzung Beginn und Ende mit `clock_timestamp()` zurückgeben und prüfen, dass B erst nach dem Commit von A endet.
- **N7** `supabase/migrations/20261116022741_0066_execute_entzug.sql:8-9, 23` – Bestätigt aus der DB-Freigabe (N1): neuer Deadlock-Zyklus Absage der Firma ohne Pauschale gegen Konto löschen, 40P01 für eine Seite, nichts halb geschrieben, kein Test. Der Kommentar nennt die sperrende Stelle ungenau. – Fix: nach OFFEN, zusammen mit N2 und N3 der Freigabe.
- **N8** `docs/OFFEN.md:83, 85-87, 143` – Am geprüften Stand stehen s9k1-1, s9k1-3, s9k1-4, s9k1-5 sowie N15 und N21 aus u3-4 noch als offen; die neuen Punkte (N1 bis N7 hier, N1 bis N3 der DB-Freigabe) fehlen. – Fix: vor `fertig` nachziehen.
- **N9** `tmp/proof/n15/` – Kein Diff als Nachweisdatei. „Sonst nichts geändert“ an `loesch-register.json` und `positiv.ts` kann ich deshalb nur mittelbar belegen (siehe b und c). Derselbe Punkt stand schon in der Abnahme u3 (M5). – Fix: künftig den Diff der Gate-Dateien vor der Abnahme als Datei unter `tmp/proof/<schritt>/` ablegen.

## Prüffragen

### (a) `auth.ts`

**Abgelehntes Token zu 500 statt 401?** Für die Fälle, die die App erzeugt: nein.
- Gefälscht: 403 `bad_jwt`, gemessen, ergibt `null` (`auth.ts:23`), live 401 an allen 13 Functions.
- Gelöschtes Konto und abgemeldete Sitzung: Fehlertyp „Sitzung fehlt“, Status 400 ohne Code, gemessen, ergibt `null` (`auth.ts:22`), live 401 an allen 13.
- Abgelaufen: nicht gemessen; nach meiner Herleitung derselbe Weg wie gefälscht (N4).
- Leeres Token: der Aufruf an Auth entfällt (`jobs/handlers.ts:55`, `photo/handlers.ts:133`, `quote/handler.ts:214`), 401.
- Token ohne lesbare Nutzlast nach bestandener Prüfung: `null` (`jobs/db.ts:21-26`).
- Ausnahme: absichtlich verformter Header (N1) und ein Wechsel der auth-js-Umsetzung (N2). Beides endet geschlossen (500), nie mit Zugriff.

**Störung zu 401?** Nein.
- 401 oder 403 ohne Code (Gateway, falscher oder rotierter Schlüssel der Function): Störung. Gemessen mit einem unsinnigen Schlüssel (401 ohne Code), nicht mit einem echten, widerrufenen Schlüssel; beide Antworten kommen vom Gateway, nicht von Auth, und tragen keinen der vier Codes.
- 5xx, 429, Netzfehler (Status 0), unbekannter Fehler: Störung (`auth.ts:24`; Unit-Zeilen `auth-token.test.ts:30-39`).
- Der Zweig „Sitzung fehlt“ hat keine Statusbedingung. auth-js bildet diesen Typ bei übergebenem Token nur aus der Antwort `session_not_found`; ohne Token rufen die Handler `getUser` nicht auf. Kein Weg von einer Störung dorthin.
- Wechsel des Signierschlüssels für Nutzer-Tokens: alle alten Tokens sind dann wirklich ungültig, 401 ist richtig.

**Leak im Log?** Nein.
- Meldung: fester Text (`auth.ts:16`). Kein `cause`. Aufzählbare Felder: `authStatus`, `authCode`, `name`. Keines kann Token oder Nutzer-ID enthalten, solange das Gegenüber im Feld `code` keinen fremden Text liefert; geloggt wird das Feld nirgends (N3).
- Neun Handler loggen die ersten 200 Zeichen von `message`, also den festen Text (`jobs/handlers.ts:120, 174, 203`, `account/handlers.ts:29`, `cancel/handlers.ts:74`, `cancel/partner.ts:88`, `change/handlers.ts:133, 209`, `admin/correct.ts:93`). Die drei Foto-Handler loggen nur Texte in Form eines festen Codes (`photo/handlers.ts:18`); der feste Text passt auf dieses Muster. `quote` loggt nur den Namen der Fehlerklasse (`quote/handler.ts:261-262`).
- Wirft `getUser` selbst (kein Auth-Fehler), läuft der Fehler an `rejectToken` vorbei in dieselben Zweige. auth-js verpackt Netz- und Lesefehler aber in eigene Fehlerklassen; ein solcher Wurf ist nicht zu erwarten und enthielte kein Token.
- Rechte: `rejectToken` erweitert nichts. `null` führt in jedem Handler zu 401, ein Wurf zu 500; in beiden Fällen läuft danach nichts.

### (b) `scripts/sys/loesch-register.json`

Am Endstand nicht abgeschwächt.
- Eintrag `tests/support/positiv.ts` (`:30`): weiter unter `ausgenommen`, mit Grund und Hash. Der Hash ist der aus dem Auftrag; der Wert aus s9k-1 steht nicht mehr drin.
- Der neue Grund sagt, was N21 der Abnahme u3 verlangte: Die Proben ändern und löschen innerhalb der Transaktion auch fremde Zeilen, committet wird nichts. Das ist wahr: Ausgeführt wird der Text nur in `tests/rls/positiv.test.ts:80` über `probes` (Rollback, `tests/support/owner.ts:113`); diese Datei ist weiter mit Hash gebunden (`:31`), ihr Hash ist der aus der Abnahme u3-1. Einziger weiterer Importeur ist der Unit-Test.
- Rest des Registers: 13 Skripte und 16 Ausnahmen, wie nach u3b (u3 zählte 13 und 15, u3b ergänzte `positiv.test.ts`). Die Einträge stehen an denselben Zeilen wie in u3b und s9k-1 (`:30`, `:31`). Der Hash von `partner.ts` ist der aus u1b. Alle 16 Gründe gelesen, keiner erlaubt mehr als der Dateiname erwarten lässt.
- Nicht belegbar ohne Diff: dass kein anderer Grundtext umformuliert wurde (N9). Die Hashes aller Ausnahmen vergleicht `tests/unit/sys-gate-loesch.test.ts:130-132` im `check` mit den Dateien; ein `check`-Lauf auf dem Endstand steht in `runs.jsonl` noch aus.

### (c) `tests/support/positiv.ts`

Am Endstand stimmig.
- `Exec` (`:31`) kennt die Kombination aus authenticated und service_role nicht mehr; die Zeichenfolge kommt in `tests/` nirgends mehr vor.
- Die zwölf Einträge stehen auf `'u'`: `:210, 211, 227, 235, 240, 245, 249, 250, 256, 264, 303, 322`. Die Namen sind die zwölf aus dem Auftrag und aus dem Revoke (`0066:94-97`).
- Dass genau diese zwölf und keine weiteren betroffen sind, belegt der Katalogtest: Lauf 006 (Register schon geändert, Datenbank noch nicht) meldet genau diese zwölf Namen, Lauf 016 nach dem Push ist grün (alle vier Welten und der Katalog). Der Katalogtest vergleicht jede Funktion in `public` mit dem Register (`positiv.test.ts:91-116`); ein falscher Wert bei einem anderen Eintrag wäre rot.
- Proben: Die Zeilen von `my_jobs` und `my_report_info` liegen an denselben Stellen wie in der Abnahme s9k-1 (`:226-238`); oberhalb ist also keine Zeile dazugekommen oder weggefallen. Akteur, Aufruf, Spalten und Gegenkonten der zwölf Einträge gelesen: jeder ruft als authenticated mit dem passenden Konto, sieben mit Gegenkonto. Byte-Gleichheit der übrigen Zeilen ist nicht belegt (N9); Lauf 016 zeigt, dass jede Probe weiter eine Zeile, einen Wert oder einen fehlerfreien Aufruf liefert.

### (d) Tests prüfen Verhalten

- `tests/unit/auth-token.test.ts`: ja. Rot 001 (drei Fehlschläge) und 002 (zwölf), grün 015. Geprüft werden Rückgabe und Wurf je Fehlerbild, die Felder des Fehlers, das Fehlen von Token und Originalmeldung in Meldung, erster Stack-Zeile und JSON, und je Handler Status 500 samt Logzeile ohne Token. Bei den drei Foto-Handlern und `quote` war die Logprüfung schon vor der Änderung grün (sie loggten die Meldung nie); rot war dort nichts zu zeigen. Lücke: N4.
- `tests/rls/execute-entzug.test.ts`: ja. Rot 003 mit Ist-Wert (service_role erreicht den Rumpf, Geschäftsfehler statt 42501), grün 010. Der Lauf bricht bei der ersten der zwölf ab; alle zwölf zeigt rot Lauf 006. Die Eigentümer-Zeilen sind eine Gegenprobe gegen einen Tippfehler im Aufruf, kein Rechtebeleg; dass authenticated weiter darf, belegt Lauf 016.
- `tests/rls/account-deletion-concurrency.test.ts`: ja, mit der Einschränkung N6. Rot 005, grün 012. Geprüft werden Fehlercode und Endzustand in der Datenbank für beide Wettläufe.
- `tests/rls/auth-token-codes.test.ts`: Messung und Live-Smoke, erster Lauf grün (M1). Die Erwartungen sind Ist-Werte (Fehlertyp, Status, Code) und das Urteil von `rejectToken` darüber; 26 Aufrufe gegen die deployten Functions mit 401. Lauf 017 grün, Arbeitsbaum dabei nicht sauber; der Lauf auf dem committeten Endstand kommt mit dem Volllauf.
- Geänderte Bestandstests: `report-flow` rot 004, grün 011; `partner-my-jobs` und `partner-my-job-changes` rot 007 und 008 (Ist-Wert: Geschäftsfehler statt 42501), grün 013 und 014.

### Bekannte Grenzen aus dem Auftrag

- (i) Kein roter Lauf für `auth-token-codes.test.ts`: als M1 bewertet. In der Sache gedeckt durch den roten Unit-Lauf, im Verfahren nicht; das Gate hält an, Beks entscheidet.
- (ii) Lauf 005 bricht vor dem zweiten Wettlauf ab: bestätigt, niedrig, kein Fix nötig. Vor 0066 hätte die Meldung im zweiten Wettlauf ebenfalls gewartet (die Löschung hält die Zeile über ihr UPDATE der Anfragen, `0066:38-40`, gleich in 0064) und danach die Meldung gesetzt, weil die Prüfung auf das gelöschte Profil fehlte. Das ist derselbe Mangel, den Lauf 004 ohne Gleichzeitigkeit rot zeigt.
- (iii) Deadlock-Zyklus: bestätigt als N7, niedrig, nach OFFEN. Kein Geldweg wird halb gebucht; die Absage mit Pauschale ist nicht betroffen (DB-Freigabe, Stichprobe zu 0062:813-814).

### Geld, Sicherheit, Schema (Kurzurteil zur Migration)

- Geld: keine Betragsrechnung, kein Journalzugriff, keine neue Lesemöglichkeit. `my_cancel_info` und `my_commissions` verlieren ein Recht (service_role) und gewinnen keines; für Kunden bleibt die Gebühr unlesbar wie zuvor.
- Sicherheit: Der Entzug nimmt nur Rechte weg. Beide neu gefassten Funktionen sind `security definer` mit leerem `search_path`, alle Objekte mit Schema genannt (`0066:10-11, 72-73`). `report_not_done` nimmt den Akteur aus `auth.uid()` (`:76`), `delete_account` bekommt die Nutzer-ID von der Edge Function aus dem geprüften Token (`account/handlers.ts:19-23`). Ein Kunde kann eine Firma über die neue Sperre nicht dauerhaft blockieren (DB-Freigabe N2).
- Schema und Nebenläufigkeit: Reihenfolge Profil, dann Anfragen in `delete_account` (`:17, 23`); Anfrage, dann Profil ohne Sperre in `report_not_done` (`:81, 83`). Zwischen diesen beiden gibt es keinen Zyklus. Der Zyklus mit der Weitervermittlung ist N7.
- Aufrufer: Kein Aufruf der zwölf Funktionen über den Secret-Key-Client in `supabase/functions` oder `scripts`; die App ruft sie mit dem Nutzer-Token (`src/lib/jobs.ts:179-201`, `src/lib/cancel.ts:83`, `src/lib/partnerJobs.ts:251`, `src/lib/partnerChange.ts:62`, `src/lib/partnerJournal.ts:29`).

## Stichproben (selbst nachgeschlagen)

- `supabase/functions/_shared/auth.ts:8, 21-25` – vier Codes, Statusbedingung, Typzweig, Wurf. In Ordnung.
- `supabase/functions/_shared/auth.ts:11-19` – fester Text, kein `cause`, zwei Felder. In Ordnung (N3).
- `supabase/functions/_shared/jobs/db.ts:17-27` – einziger Weg von `getUser` zu `rejectToken`; aal aus der geprüften Nutzlast. In Ordnung.
- `supabase/functions/_shared/quote/db.ts:28-31` – `getUserId` über `rejectToken`. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:53-59` – `authed`: leeres Token ohne Aufruf, `null` ergibt 401. In Ordnung (N1).
- `supabase/functions/_shared/jobs/handlers.ts:116-122` – allgemeiner Zweig: 500, Log der gekürzten Meldung. In Ordnung.
- `supabase/functions/_shared/account/handlers.ts:18-31` – Nutzer-ID nur aus dem Token; Störung 500. In Ordnung.
- `supabase/functions/_shared/photo/handlers.ts:12-20` – Log nur mit Text in Code-Form. In Ordnung.
- `supabase/functions/_shared/photo/handlers.ts:131-134` – `job-photo` ohne `authed`, gleiche Logik. In Ordnung (N1).
- `supabase/functions/_shared/quote/handler.ts:212-215, 251-262` – Formprüfung vor Auth; Störung als 500 mit Klassenname im Log. In Ordnung.
- Suche `rejectToken|AuthServiceError` in `supabase/functions` – zwei Aufrufer (`jobs/db.ts:19`, `quote/db.ts:30`), sonst keiner. In Ordnung.
- Suche `authStatus|authCode` – nur `auth.ts:13-14` und `tests/unit/auth-token.test.ts:55`. Grundlage für N3.
- `supabase/config.toml:418-467` – JWT-Prüfung am Gateway für alle 17 Functions aus. Der Live-Smoke misst die Handler.
- `supabase/functions/accept/index.ts:3, 14` – supabase-js mit offener Hauptversion, Client ohne gespeicherte Sitzung. Grundlage für N2.
- `tests/unit/auth-token.test.ts:22-39` – sechs Ablehnungen, acht Störungen. In Ordnung (N4).
- `tests/unit/auth-token.test.ts:58-69` – Prüfung auf Token und Originalmeldung, kein `cause`. In Ordnung.
- `tests/unit/auth-token.test.ts:92-124` – 13 Handler, Fehler als echter Error mit Token in der Meldung. In Ordnung.
- `tmp/proof/n15/002-…auth-token.test.ts.log:32-33, 56-57, 77-78, 230` – Ist-Werte rot (Gateway-401 nicht als Störung erkannt, `null` statt Wurf, Token in der Logzeile), `EXIT=1`. In Ordnung.
- `tmp/proof/n15/001-…log:76`, `015-…log:22` – `EXIT=1` und `EXIT=0`. In Ordnung.
- `tests/rls/auth-token-codes.test.ts:30-45` – Messwerte als Erwartung. In Ordnung.
- `tests/rls/auth-token-codes.test.ts:47-58` – 13 Functions, zwei Tokens, 401. In Ordnung (N5).
- `tmp/proof/n15/017-…log:15, 27` – ein Test bestanden, `EXIT=0`. In Ordnung.
- `tmp/proof/n15/runs.jsonl:9, 19` – Läufe 009 und 017 grün, beide mit nicht sauberem Arbeitsbaum; kein roter Lauf davor. Grundlage für M1.
- `scripts/sys/fertig.mjs:75-78` – Regel für neue rls-Tests, keine Ausnahme. Grundlage für M1.
- `tests/rls/execute-entzug.test.ts:8-22` – zwölf Aufrufe, je service_role (42501) und Eigentümer (kein 42501). In Ordnung.
- `tmp/proof/n15/003-…log:20, 48` – Ist-Wert Geschäftsfehler statt 42501, `EXIT=1`. In Ordnung.
- `tmp/proof/n15/006-…log:25-44, 66` – genau zwölf Abweichungen im Katalog, `EXIT=1`. In Ordnung.
- `tmp/proof/n15/016-…log:32` – `EXIT=0`. In Ordnung.
- `tests/rls/positiv.test.ts:91-116` – Katalog gegen Register in beide Richtungen, Rechte exakt. In Ordnung.
- `tests/rls/account-deletion-concurrency.test.ts:40-55` – vier Sitzungen, Fehlercode und Endzustand je Wettlauf. In Ordnung (N6).
- `tmp/proof/n15/005-…log:20, 43` – Ist-Wert: Löschung liefert ein Ergebnis statt `under_review`, `EXIT=1`. In Ordnung.
- `tmp/proof/n15/004-…log:23, 52` – Ist-Wert: Melden nach Löschung gelingt, `EXIT=1`. In Ordnung.
- `tests/rls/report-flow.test.ts:152-166` – Melden nach Löschung mit Gegenprobe ohne Löschung. In Ordnung.
- `tests/rls/partner-my-jobs.test.ts:102, 121` – Erwartung 42501 für service_role. In Ordnung.
- `tmp/proof/n15/007-…log:25`, `008-…log:25` – Ist-Wert Geschäftsfehler statt 42501. In Ordnung.
- `tmp/proof/n15/010` bis `014`, `018` – je `EXIT=0`. In Ordnung.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:16-36` – Reihenfolge der Prüfungen, Sperre vor `under_review`. In Ordnung.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:80-86` – Prüfung auf gelöschtes Profil nach der Sperre und vor `report_gate`. In Ordnung.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:94-97` – zwölf Signaturen, nur service_role. In Ordnung.
- `tmp/proof/n15/db-freigabe-1.md:8, 10` – Hash wie im Auftrag, frei. In Ordnung.
- `tmp/proof/n15/runs.jsonl:10-11` – Startmarke und Push-Marke mit demselben Hash. In Ordnung.
- Suche nach RPC-Aufrufen der zwölf Namen in `supabase/functions`, `scripts`, `src` – nur `src/lib` (Nutzer-Token). In Ordnung.
- `scripts/sys/loesch-register.json:3-15` – 13 Skripte. In Ordnung.
- `scripts/sys/loesch-register.json:18-33` – 16 Ausnahmen, je Grund und Hash. In Ordnung.
- `scripts/sys/loesch-register.json:30` – Hash wie im Auftrag, Grund nach N21 berichtigt. In Ordnung.
- `scripts/sys/loesch-register.json:29, 31` gegen `docs/proof/u1b/u1b-abnahme.md:15` und `docs/proof/u3-1/u3-1-abnahme.md:16` – Hashes von `partner.ts` und `positiv.test.ts` unverändert. In Ordnung.
- `docs/proof/u3/u3-abnahme.md:42, 83` – Wortlaut von N21 und Zählung 13 Skripte, 15 Ausnahmen. Passt zum Endstand.
- `tests/unit/sys-gate-loesch.test.ts:121-132` – Vollständigkeit und Hash je Ausnahme im `check`. In Ordnung.
- `tests/support/positiv.ts:31` – `Exec` ohne die Doppelrolle. In Ordnung.
- `tests/support/positiv.ts:210, 211, 227, 235, 240, 245, 249, 250, 256, 264, 303, 322` – zwölfmal `'u'`. In Ordnung.
- `tests/support/positiv.ts:337` – `delete_account` weiter nur service_role. In Ordnung.
- `docs/proof/s9k-1/s9k-1-abnahme.md:40, 68, 116` gegen `tests/support/positiv.ts:226-238` – Zeilenlage unverändert. In Ordnung.
- `docs/OFFEN.md:83, 85-87, 143` – erledigte Punkte noch offen geführt. Grundlage für N8.

Offene Findings hoch: 0
