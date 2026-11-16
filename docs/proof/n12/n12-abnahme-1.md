Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme Schritt n12, Runde 1

- Datum: 2026-11-16
- Stufe: R3 (Migration 0067, Edge Function `accept`, Positivzeilen-Register, Lösch-Register)
- Umfang: Wiederholung der Annahme nach verlorener Antwort (N-12): `handleAccept` mit Nachfrage über `deps.replay`, `acceptDb.replay`, neu erzeugte Typdatei, Registereintrag `partner_accept_replay`, neuer Hash von `tests/support/positiv.ts` im Lösch-Register
- Vollständig gelesen: `supabase/functions/_shared/jobs/handlers.ts`, `supabase/functions/_shared/jobs/db.ts`, `tests/support/positiv.ts`, `scripts/sys/loesch-register.json`, dazu `supabase/migrations/20261116120000_0067_accept_replay.sql`, `supabase/functions/accept/index.ts`, `tests/rls/accept-replay.test.ts`, `tests/unit/accept.test.ts`, `tests/rls/positiv.test.ts`, `tmp/proof/n12/db-freigabe-1.md`, `tmp/proof/n12/deploy-log.md`, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`, `.claude/skills/schritt/SKILL.md`, `tmp/proof/n15-abnahme-1.md`
- In Auszügen gelesen: `supabase/functions/_shared/database.types.ts` (Zeilen 1885-1930), `supabase/migrations/20261114100000_0062_fee_schedule.sql` (340-434), `tests/rls/flow-live.test.ts` (1-199), `tests/support/owner.ts` (80-115), `tests/unit/sys-gate-loesch.test.ts` (112-137), `src/lib/partnerJobs.ts` (186-215), `docs/OFFEN.md` (83-86), `tmp/proof/n12/runs.jsonl` (nur die Lauf-Zeilen mit Exit-Code und die beiden Push-Marken), Logs 004, 005, 006, 009, 010, 011, 016, 017 nur an FAIL, AssertionError und EXIT

Grenzen dieser Prüfung
- Kein Werkzeug für `git diff` und keines zum Hashen. Die fünf Hashes unten sind aus dem Auftrag abgeschrieben; den Abgleich mit dem Endstand macht das Gate.
- „Nur die neue Funktion“ (Typdatei) und „sonst nichts geändert“ (`handlers.ts`, `db.ts`, `positiv.ts`, Register) habe ich am Endstand und an den Zeilenangaben der Abnahme n15 geprüft (gleichmäßige Verschiebung, siehe Prüffrage 4 und 5), nicht Byte für Byte gegen `main`.
- Ich habe nichts ausgeführt. Aussagen zum Verhalten der Datenbank stammen aus den Migrationen und aus den Läufen 009 bis 011; die Reihenfolge der Rechteprüfungen in M1 ist hergeleitet, nicht gemessen.
- Welcher Quelltext als Version 7 von `accept` deployt ist, kann ich nicht sehen (N2). Belegt ist das Verhalten der deployten Function in Lauf 011.
- App-Dateien, E2E-Tests und `tests/rls/auth-token-codes.test.ts` gehören nicht zur Pflichtmenge und sind hier nicht abgenommen.

SHA256: 6627caa5edd0d8ee8f34fa4fd30b5df569bb86601ff580dd287666f7d3917779 supabase/functions/_shared/database.types.ts
SHA256: f5c0443fc99f385c45c50b977dec8bce5f76890314bd275e34e05e963e8b8437 supabase/functions/_shared/jobs/db.ts
SHA256: 2ef0aada21ce258523d91d4f8e8cd576150aa803ba4694aefad59651148c172a supabase/functions/_shared/jobs/handlers.ts
SHA256: 527aa6d479fb0cb08d0b297b4a7b06035b72dcfd2a8e332c9c4081a7fec1537f tests/support/positiv.ts
SHA256: cbc218d90ce43cb732072c90df80088dee0b185e611ff5a8c9cc1e711a8dc4ab scripts/sys/loesch-register.json

Gelöschte Dateien der Pflichtmenge: keine (laut Auftrag).

## Ergebnis in Kürze

Kein hoher Fund. Die Wiederholung schreibt nichts: Die Nachfrage ist eine einzelne lesende Abfrage, eine zweite Zuordnung oder Buchung kann über sie nicht entstehen. Die Antwort 200 bekommt nur ein Mitglied der Firma, die das Listing selbst hält, und nur mit der Revision und der Auszahlung der eigenen Buchung; alle anderen bleiben bei 404 oder 409 wie zuvor. `p_actor` kommt an beiden Stellen aus dem geprüften Token. Die Gebühr rechnet weiter allein `splitFee`; die Wiederholung rechnet nicht und gibt keinen Betrag zurück.

Ein mittlerer Fund betrifft den Nachweis, nicht den Code: Die Rechte der neuen Funktion sind zum Zeitpunkt dieser Abnahme nur gelesen, nicht gemessen (M1). Die Probe „ohne Recht“ im neuen rls-Test misst nach meiner Herleitung die Tabelle, nicht die Funktion, und der Katalogtest ist seit dem Push nicht gelaufen.

Wer einen Fund in einer der fünf Dateien mit Hash-Zeile behebt, braucht danach Runde 2 (bei `handlers.ts` oder `db.ts` zusätzlich einen neuen Deploy von `accept`). Die Testdateien unter `tests/rls/` und `tests/unit/` und ein Eintrag in `docs/OFFEN.md` ändern keinen dieser Hashes.

## Findings

### hoch
Keine.

### mittel
- **M1** `tests/rls/accept-replay.test.ts:25, 52, 64`, `supabase/migrations/20261108130000_0030_job_listings.sql:120-122`, `tmp/proof/n12/runs.jsonl` – Die Probe „ohne Recht (authenticated)“ belegt das fehlende EXECUTE nicht. Ihr Aufruf enthält die Unterabfrage auf `job_listings` mit Filter auf `request_id`; diese Spalte darf `authenticated` nicht lesen (Spaltenrechte in 0030:121-122, dazu nur `to_district` in 0038:317). Die Abfrage endet deshalb schon an der Tabelle mit 42501, gleich ob die Rolle die Funktion ausführen darf (hergeleitet: die Rechte der Tabellen werden vor denen der Funktion geprüft; das grüne Log 010 zeigt die Meldung nicht). Die Erwartung in Zeile 64 nimmt jedes 42501 an. Der zweite Beleg, der Katalogtest (`tests/rls/positiv.test.ts:91-116`, verlangt für den Eintrag genau „s“), ist in n12 seit dem Push nicht gelaufen (kein Lauf dieser Datei in `runs.jsonl`). Damit sind die Rechte der neuen Funktion derzeit nur gelesen (0067:22-23, dort richtig: Entzug bei vier Rollen, EXECUTE nur für `service_role`). Folge bei einem Fehler wäre ein direkter RPC-Aufruf mit frei gewähltem Akteur; das Ergebnis wäre weiter nur „ID oder nichts“ für jemanden, der Listing, Revision und Auszahlung schon kennt. – Fix: die Probe so stellen, dass als `authenticated` keine Tabelle gelesen wird (IDs vorher als Eigentümer in Einstellungen ablegen, wie `keep` und `LS` in `tests/support/positiv.ts:112-113`, oder feste Zufalls-IDs übergeben) und in der Erwartung den Namen der Funktion in der Meldung verlangen. Der rls-Volllauf muss `positiv.test.ts` grün zeigen (Katalog und Welt `auftrag`). Beides berührt keinen Hash der Pflichtmenge. Wird der Volllauf am Register rot und `positiv.ts` muss geändert werden: Runde 2.

### niedrig
- **N1** `tests/support/positiv.ts:226-229`, `tests/rls/positiv.test.ts:38-39, 56` – Der Registereintrag ist nach Lesart richtig und über die Typbindung im `check` belegt (Lauf 017), als Probe gegen die Datenbank aber noch nicht gelaufen (siehe M1). Der Registerlauf prüft bei Wertfunktionen nur den Typ; ein Ergebnis null wäre ebenfalls grün (DB-Freigabe N3, steht in OFFEN n12-4). Den Positivfall belegt allein `tests/rls/accept-replay.test.ts:41-42, 57-58`. – Fix: Volllauf abwarten; den Test nicht entfernen.
- **N2** `tmp/proof/n12/deploy-log.md:4-5`, `supabase/functions/_shared/admin/correct.ts:6`, `supabase/functions/_shared/account/handlers.ts:4`, `supabase/functions/_shared/cancel/handlers.ts:6`, `supabase/functions/_shared/change/handlers.ts:22`, `supabase/functions/_shared/photo/handlers.ts:6` – Das Deploy-Log nennt drei nicht neu deployte Functions. Tatsächlich laden alle Functions, die `_shared/admin`, `account`, `cancel`, `change` oder `photo` benutzen, ebenfalls `jobs/handlers.ts` und `jobs/db.ts` (für `authed`, `STATUS`, `getUser`, `must`). Der Schluss bleibt richtig: Geändert sind nur `AcceptDeps`, `handleAccept` und `acceptDb`, die allein `accept` benutzt; die Typdatei wird beim Bündeln entfernt. Das Log nennt außerdem keinen Stand der deployten Quellen; die Läufe 010 bis 017 liefen mit nicht sauberem Arbeitsbaum auf 1377638, danach kam noch ein Commit. – Fix: in der Bewertung die Liste berichtigen und festhalten, dass `handlers.ts` und `db.ts` seit dem Deploy unverändert sind; sind sie es nicht, `accept` vor dem Volllauf neu deployen. Künftig den Hash der deployten Dateien ins Deploy-Log schreiben.
- **N3** `supabase/functions/_shared/jobs/handlers.ts:120-128`, `supabase/migrations/20261116120000_0067_accept_replay.sql:13-19` – Die Antwort 200 bekommt jedes Mitglied der Firma, nicht nur das Konto, das angenommen hat, und ohne zeitliche Grenze; ebenso eine inzwischen gesperrte Firma (die Basis prüft den Firmenstatus nicht, 0062:359-368) und ein Mitglied bei einem Listing, das über ein bestätigtes Angebot angenommen wurde (DB-Freigabe N1, N2). Es wird nichts geschrieben; gezeigt wird nur die ID der eigenen Zuordnung, die jedes Mitglied über `my_jobs` ohnehin liest. – Fix: keiner nötig. In OFFEN n12-4 den Satz zu N2 der Freigabe und „jedes Mitglied“ ergänzen.
- **N4** `supabase/functions/_shared/jobs/db.ts:31-35`, `supabase/functions/_shared/database.types.ts:1919` – Die erzeugte Typdatei nennt als Rückgabe eine Zeichenkette; tatsächlich liefert die Funktion in allen Ablehnungsfällen null. `db.ts` reicht den Wert durch, der Handler prüft ihn (`handlers.ts:126`), der Live-Test belegt den Weg (409 bei anderer Auszahlung, `flow-live.test.ts:186`). Ein späterer zweiter Aufrufer hätte vom Typ her keinen Hinweis auf null. – Fix: bei der nächsten Änderung an `db.ts` den Rückgabetyp von `replay` ausdrücklich mit null schreiben. Jetzt nicht (ändert den Hash).
- **N5** `tests/unit/accept.test.ts:105-112`, `supabase/functions/_shared/jobs/handlers.ts:100-119` – Der Test zum veralteten Satz prüft nur `rate_mismatch` und zählt die Aufrufe der Basis nicht. Dass der zweite Versuch die Basis neu lädt und dass `amount_mismatch` denselben Weg nimmt, ist damit nur gelesen. Für die Frage „verhaltensgleich“ heißt das: nach Lesart ja, durch Tests nur für Status und Code belegt. – Fix: Aufrufe der Basis zählen (erwartet zwei), eine Zeile für `amount_mismatch`.
- **N6** `tmp/proof/n12/runs.jsonl:5-6`, `tmp/proof/n12/006-tests_unit_accept.test.ts.log:22, 45, 70` – Der erste Lauf des Unit-Tests ist grün (005), der rote kommt danach (006, drei Fehlschläge). Die Ist-Werte passen zu einer umgedrehten Null-Prüfung nach der Nachfrage (200 ohne Fehlercode statt 409 bei null, 409 statt 200 bei Treffer); welche Mutation es war, steht nirgends. Ein eigener grüner Lauf nach 006 fehlt, grün ist die Datei erst wieder im `check` (Lauf 017, `017-check.log:76`, zwölf Tests). Das Gate verlangt die Reihenfolge nur für neue Dateien unter `tests/rls/`. Nicht rot gezeigt: „Nachfrage nur bei `already_taken`“ und „Fehler der Nachfrage ergibt 500“. – Fix: die Mutation in der Bewertung benennen.
- **N7** `tests/rls/flow-live.test.ts:179-188` – Der Vergleich der ganzen Antwort ist richtig gewählt (Status und Rumpf gleich der ersten Antwort). Nicht geprüft wird, dass die erste Antwort eine ID enthält und dass sie die der Zuordnung in der Datenbank ist; nach der Wiederholung wird nur die Länge des Journals geprüft, nicht die Zahl der Zuordnungen und der Kundenmail. Beides ist durch die Bauart gedeckt (die Nachfrage liest nur; je Anfrage höchstens eine aktive Zuordnung und eine Buchung per Index, DB-Freigabe Prüffrage 2). – Fix: eine Zeile, die `assignmentId` mit der Zeile in `assignments` vergleicht.
- **N8** `tests/rls/accept-replay.test.ts:44-51`, `tmp/proof/n12/009-tests_rls_accept-replay.test.ts.log:20-23` – Bestätigt aus der DB-Freigabe (N4): Der rote Lauf zeigt, dass die Funktion fehlt (42883), nicht die Wirkung der einzelnen Bedingungen; die sieben Null-Fälle sind nur grün belegt. Ohne Fall: zweites Mitglied derselben Firma, Listing aus bestätigtem Angebot, Wiederholung nach einem angenommenen Nachtrag. Steht in OFFEN n12-4. – Fix: keiner in diesem Schritt.
- **N9** `tmp/proof/n12/` – Wie in n15 (N9) liegt kein Diff der Gate-Dateien als Nachweis vor. „Nur die neue Funktion“ in der Typdatei kann ich nur mittelbar belegen (Prüffrage 5). – Fix: künftig den Diff der Pflichtdateien vor der Abnahme unter `tmp/proof/<schritt>/` ablegen.
- **N10** `docs/OFFEN.md:83-86` – Die Punkte n12-1 bis n12-4 stehen im Arbeitsbaum; laut Stand beim Start dieser Prüfung war die Datei noch nicht committet. – Fix: vor `fertig` committen (Ablauf Punkt 10).

## Prüffragen

### 1. Zweite Buchung, zweite Zuordnung, Information für Dritte

Nein, in allen drei Punkten.
- Kein Schreiben: Die Nachfrage ruft nur `partner_accept_replay` (`db.ts:32`), eine `stable` SQL-Funktion mit einer einzigen lesenden Abfrage (0067:9-20). `partner_accept` wird im Wiederholungsfall nicht erreicht, wenn schon die Basis `already_taken` meldet (0062:366), oder bricht selbst vor dem ersten Schreiben ab (0062:406, 411; die Einfügungen stehen in 422-426).
- Gleichzeitiger Doppelklick derselben Firma: Der zweite Aufruf wartet in `partner_accept` auf die Sperre der Anfrage (0062:400), liest danach den neuen Status, bekommt `already_taken` und fragt in einer neuen Anweisung nach; die sieht den Commit des ersten. Bricht der erste ab, nimmt der zweite normal an. Mehr als eine Zuordnung oder Buchung je Anfrage schließen zusätzlich die Indizes aus (DB-Freigabe Prüffrage 2).
- Dritte: Ein Konto ohne Mitgliedschaft in der Firma des Listings erreicht die Nachfrage nicht; Basis und Annahme enden vor jeder Statusprüfung mit `not_found` (0062:360-362, 398-399), der Handler fragt nur bei `already_taken` nach (`handlers.ts:124`). Selbst ein direkter Aufruf lieferte für Fremde null (Mitgliedschaft, Zuordnung und Buchung sind an die Firma des Listings gebunden, 0067:13-15).
- Die unterlegene Firma: Ihr Listing ist nicht `accepted`, die aktive Zuordnung gehört einer anderen Firma; Ergebnis null, es bleibt bei 409 (live: `flow-live.test.ts:187`).
- Inhalt der Antwort: nur `assignmentId`. Keine Gebühr, kein Betrag, kein Kontakt. Kunden erreichen den Weg nicht (aal2 und Mitgliedschaft nötig, `handlers.ts:92`).
- Neu für Mitglieder ist nur die Unterscheidung 200 gegen 409 bei passender Revision und Auszahlung der eigenen Buchung; das Journal der eigenen Firma lesen sie mit aal2 ohnehin (N3).

### 2. Bleibt `p_actor` aus dem Token

Ja. `userId` ist `a.user.id` aus `authed` (`handlers.ts:92, 99`), also die ID, die Supabase Auth zum Token liefert (`db.ts:17-23`). Dieselbe Variable geht an Basis, Annahme und Nachfrage (`handlers.ts:102, 107, 125`) und wird in `db.ts:32, 37, 51` als `p_actor` gesetzt. Aus dem Rumpf der Anfrage werden nur `listingId`, `revisionId` und `shownPayoutCents` gelesen (`handlers.ts:95`), alle drei geprüft (`handlers.ts:96`). Der Unit-Test hält fest, dass ein mitgeschicktes `partnerId` nicht ankommt und die Nachfrage genau die ID aus dem Token bekommt (`tests/unit/accept.test.ts:87-90`).

### 3. Fehlerbehandlung in `handleAccept`

Richtig.
- Nachfrage nur bei `already_taken`: Jeder andere Fehler, auch jeder Nicht-`DbError`, wird unverändert weitergeworfen (`handlers.ts:124`) und landet im äußeren Zweig mit der bisherigen Abbildung (`handlers.ts:129-134`). `offer_required`, `listing_declined`, `expired`, `revision_changed`, `payout_changed`, `partner_not_active`, `partner_job_limit` und `fee_rate_changed` lösen keine Nachfrage aus.
- Nachfrage liefert null: der ursprüngliche Fehler wird geworfen, Antwort 409 `already_taken` wie vor n12 (`handlers.ts:126`).
- Fehler der Nachfrage: `db.ts:33` wirft einen `DbError` mit der Meldung der Datenbank-Schicht, ein Netzfehler einen gewöhnlichen Fehler. Beide laufen in den äußeren Zweig; die Meldung steht nicht in `STATUS`, also 500 mit dem festen Rumpf `internal` und einer Logzeile mit höchstens 200 Zeichen der Meldung (`handlers.ts:133-134`). Die Meldung einer fehlgeschlagenen Leseabfrage enthält weder Token noch Schlüssel. Kein Fehler der Nachfrage kann zu 200 werden.
- `already_taken` aus der Basis überspringt die Vergleiche von Revision und Auszahlung im Handler (`handlers.ts:103-105`); die Funktion vergleicht beide selbst mit der Buchung (0067:18-19). Eine Wiederholung mit anderer Auszahlung bleibt 409 (live belegt, `flow-live.test.ts:186`).
- Reihenfolge der Prüfungen davor unverändert: Methode, Token, aal2, Eingabe (`handlers.ts:89-98`).

### 4. Umstellung der Schleife in `run`

Nach Lesart verhaltensgleich.
- Zwei Versuche; je Versuch Basis neu laden, Revision vergleichen, `splitFee`, Auszahlung vergleichen, Annahme (`handlers.ts:101-107`). Bei `rate_mismatch` oder `amount_mismatch` im ersten Versuch ein zweiter Durchlauf mit frischer Basis, im zweiten `fee_rate_changed` (`handlers.ts:110-114`); alles andere wird weitergeworfen (`handlers.ts:115`). Das `return await` in Zeile 107 hält den Fehler der Annahme im inneren Zweig.
- Der Aufbau ist derselbe wie in `handleConfirmOffer` (`handlers.ts:163-180`), nur dass die Erfolgsantwort jetzt außerhalb der Hilfsfunktion gebildet wird (`handlers.ts:121`).
- Einziger Unterschied zum Zustand vor n12 ist gewollt: Fehler aus der Basis und aus der Annahme laufen durch denselben neuen Zweig, damit `already_taken` aus beiden Quellen nachfragt.
- Mittelbarer Beleg, dass außerhalb von `AcceptDeps` und `handleAccept` nichts verschoben wurde: `authed` steht wie in der Abnahme n15 an den Zeilen 53-59; die dort genannten Logzeilen 120, 174 und 203 stehen jetzt an 133, 187 und 216, also gleichmäßig 13 Zeilen tiefer (zwei Zeilen im Typ, elf im Handler).
- Durch Tests belegt: Erfolg, 409 bei Abweichung ohne Aufruf der Annahme, einmaliges Wiederholen bei `rate_mismatch`, danach 409 (`tests/unit/accept.test.ts:33-40, 59-66, 105-112`; Lauf 017). Lücke: N5.
- Geld: `splitFee` bleibt die einzige Rechenstelle (`handlers.ts:104`), die Beträge gehen unverändert als ganze Cent an `partner_accept` (`db.ts:50-62`). Rundung nicht berührt.

### 5. Registereintrag und Hash

Passt.
- Eintrag (`tests/support/positiv.ts:226-229`): Welt `auftrag`, Akteur `service_role`, EXECUTE „s“, Wert vom Typ `uuid`. `R.j1` wird im Setup von Firma a mit Revision 1 und der Auszahlung aus `c.s` angenommen (`positiv.ts:106-109, 147`); der Aufruf nennt dieselbe Firma, Revision und Auszahlung und trifft damit die Positivzeile. Die Einträge davor in derselben Welt arbeiten auf `q0` (`positiv.ts:217-225`), `start_job` auf `j1` steht dahinter (`positiv.ts:253`) und beendet die Zuordnung nicht.
- `NIE_AUSNAHME` nennt die Funktion (`positiv.ts:170`); die Typbindung erzwingt wegen `p_actor` den Akteur `service_role` (`positiv.ts:35`) und die Vollständigkeit gegen die Typdatei (`positiv.ts:191`). `check` ist damit grün (Lauf 017).
- Sonst nichts geändert, mittelbar: Die in der Abnahme n15 genannten Zeilen der zwölf Einträge mit „u“ liegen oberhalb des neuen Eintrags unverändert (210, 211) und unterhalb genau vier Zeilen tiefer (231, 239, 244, 249, 253, 254, 260, 268, 307, 326; `delete_account` 341 statt 337). Vier Zeilen ist die Länge des neuen Eintrags.
- Typdatei: Der Eintrag `partner_accept_replay` (`database.types.ts:1912-1920`) hat die vier Argumente der Signatur aus 0067:7; die beiden Nachbarn sind unverändert in Form und Reihenfolge (`:1885-1911`). Dass sonst nichts anders ist, folgt aus der Migration (nur eine neue Funktion) und der Erzeugung aus der Datenbank; gegen `main` verglichen habe ich nicht (N9).
- Lösch-Register (`scripts/sys/loesch-register.json:30`): Der Hash von `tests/support/positiv.ts` ist der aus dem Auftrag. Lauf 016 zeigt die Kette: `check` rot, weil die Datei den neuen Hash hatte und das Register noch den Wert aus der Abnahme n15; Lauf 017 nach dem Nachführen grün. Der Grundtext ist der aus n15 und bleibt wahr: Der neue Registertext ist ein lesender Funktionsaufruf, ausgeführt wird die Datei weiter nur in Rollback-Proben über `tests/rls/positiv.test.ts`, dessen Hash (`:31`) der aus der Abnahme u3-1 ist. Einzige weitere Importstelle ist der Unit-Test `tests/unit/positiv-register.test.ts:5`.
- Rest des Registers: 13 Skripte (`:3-15`) und 16 Ausnahmen (`:18-33`) wie in n15; der Hash von `partner.ts` (`:29`) ist der aus u1b. Keine Zeile dazugekommen oder weggefallen. Nicht abgeschwächt.

### 6. Aussagekraft der Tests

- `tests/rls/accept-replay.test.ts`: ja, mit der Ausnahme M1. Die Vergleiche sind streng: Eine Probe mit Fragezeichen besteht nur bei wahr, null gilt als falsch (`tests/support/owner.ts:105`); die Wiederholung muss also zweimal genau die ID aus der Annahme liefern (`:41-42, 57-58`). Wertproben geben null als eigenes Zeichen zurück (`owner.ts:107`); jede der sieben Ablehnungen muss genau null sein (`:61-63`) und deckt je eine Bedingung der Funktion: Status des Listings, Mitgliedschaft (Firma und Kunde), Akteur null, Revision, Auszahlung, beendete Zuordnung. „Zuordnung beenden“ hat jetzt eine eigene Erwartung (`:60`), der Punkt M1 der DB-Freigabe ist damit erledigt: Lauf 009 zeigt „Annahme“ und „Zuordnung beenden“ mit „ok“ und alle Aufrufe der Funktion mit 42883. „Je eine Zeile“ (`:59`) ist auch im roten Lauf erfüllt und sagt für sich wenig; die Aussage trägt die Bauart (nur lesend). Lücken: M1, N8.
- `tests/rls/flow-live.test.ts`: ja. Die Wiederholung muss dieselbe Antwort liefern wie der erste Aufruf (Status 200 und derselbe Rumpf, `:185`), eine andere Auszahlung 409 `already_taken` (`:186`), die andere Firma mit ihrem eigenen Listing 409 (`:187`), das Journal bleibt bei einer Zeile (`:188`). Das sind Ist-Werte der deployten Function mit echten Tokens. Vor n12 hätte Zeile 185 409 ergeben; ein eigener roter Lauf dieser Zeile liegt nicht vor (die Function war beim ersten Lauf schon deployt). Lücke: N7.
- `tests/unit/accept.test.ts`: Treffer aus Basis und aus Annahme ergeben 200, null ergibt 409, andere Codes fragen nicht nach, Fehler der Nachfrage ergibt 500 ohne Einzelheiten (`:79-103`). Rot in Lauf 006 mit Ist-Werten, grün im `check` (N6).

### 7. Läufe (nur Exit-Zeilen)

- 001, 002 rot und 003 grün: `tests/rls/auth-token-codes.test.ts` (Rot-Beweis per Mutation laut Auftrag; nicht Teil der Pflichtmenge, hier nicht bewertet).
- 004 rot (Exit 1) und 009 rot (Exit 1): `accept-replay` vor dem Push, beide auf ecd0353, Arbeitsbaum nicht sauber. Push-Marken in den Zeilen 10 und 11 mit demselben Hash wie in der DB-Freigabe.
- 010 grün (Exit 0): `accept-replay` nach dem Push, auf 1377638. Roter Lauf vor dem ersten grünen: erfüllt.
- 011 grün (Exit 0): `flow-live`, 19 Tests, auf 1377638.
- 005 grün, 006 rot: Unit `accept` (N6). 016 rot (Register-Hash), 017 grün: `check` mit 1923 Tests.
- Alle Läufe mit nicht sauberem Arbeitsbaum; die Volläufe auf dem committeten Endstand stehen noch aus (Ablauf Punkt 9).

### 8. Nicht deployte Functions

Vertretbar. Für alle Functions außer `accept` ist das Verhalten unverändert, weil die geänderten Teile nur von `accept/index.ts:5-6, 17` benutzt werden; `accept` übernimmt `replay` über die Ausbreitung von `acceptDb(db)` ohne eigene Änderung. Die Liste im Deploy-Log ist unvollständig (N2). Die Reihenfolge Push, Typen, Deploy ist eingehalten, sonst wäre Zeile 185 des Live-Tests in Lauf 011 rot.

### 9. Aufgeschobenes

`docs/OFFEN.md:83-86` nennt n12-1 bis n12-4 wie im Auftrag. Kein Geldweg ist darunter offen gemessen außer der Absage der Firma (n12-2: zweite Pauschalen-Zeile bei Wiederholung nicht gemessen, dort als „bei zwei Zeilen anhalten“ vermerkt). Das ist richtig eingeordnet und gehört nicht zur Pflichtmenge dieses Schritts.

### Geld, Sicherheit, Schema (Kurzurteil)

- Geld: keine neue Rechnung, keine neue Rundung. Der Vergleich der Auszahlung ist exakt in ganzen Cent (`bigint`, 0067:19); die Eingabe ist als sichere ganze Zahl größer null geprüft (`handlers.ts:96`). Die Gebühr bleibt für Kunden unsichtbar: Der Weg verlangt aal2 und Mitgliedschaft, die Antwort enthält keinen Betrag.
- Sicherheit: fester Akteur aus dem Token; keine Rechte-Ausweitung (die Funktion ist nur für `service_role` gedacht und wird nur von der Function mit dem Secret Key aufgerufen, `accept/index.ts:14`); kein Secret im Code oder im Log. Missbrauch durch Partner: höchstens die eigene Zuordnungs-ID erneut lesen. Missbrauch durch Kunden: kein Weg.
- Schema und Nebenläufigkeit: keine Tabelle, keine Spalte, kein Trigger, keine Policy geändert; die Funktion sperrt nichts. Urteil der DB-Freigabe (frei, kein hoher Fund) bestätigt, soweit ich die Stellen selbst nachgeschlagen habe.

## Stichproben (selbst nachgeschlagen)

- `supabase/functions/_shared/jobs/handlers.ts:53-59` – `authed`: leeres Token ohne Aufruf, null ergibt 401, aal2 verlangt. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:76-84` – `AcceptDeps` mit `replay`, Rückgabe mit null. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:92-99` – Token, Eingabeprüfung, Akteur aus dem Token. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:100-119` – `run`: zwei Versuche, Basis je Versuch neu, Wiederholen nur bei den zwei Codes. In Ordnung (N5).
- `supabase/functions/_shared/jobs/handlers.ts:120-128` – Nachfrage nur bei `already_taken`, null lässt den 409 stehen. In Ordnung (N3).
- `supabase/functions/_shared/jobs/handlers.ts:129-135` – unbekannter Code: 500 mit festem Rumpf, Log gekürzt. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:163-180` – `handleConfirmOffer` unverändert im Aufbau, Vergleich für die Schleife. In Ordnung.
- `supabase/functions/_shared/jobs/db.ts:17-27` – `getUser` an derselben Stelle wie in n15. In Ordnung.
- `supabase/functions/_shared/jobs/db.ts:29-35` – `replay`: vier Parameter, Fehler als `DbError`, null wird durchgereicht. In Ordnung (N4).
- `supabase/functions/_shared/jobs/db.ts:36-64` – Basis und Annahme: Akteur und Beträge wie bisher. In Ordnung.
- `supabase/functions/accept/index.ts:14-17` – Client mit Secret Key, `acceptDb(db)` ausgebreitet. In Ordnung.
- `supabase/functions/_shared/database.types.ts:1885-1920` – drei Annahme-Funktionen, neue mit vier Argumenten. In Ordnung (N4, N9).
- Suche nach `AcceptDeps`, `acceptDb`, `partner_accept_replay` und Aufrufen von `replay` in `src`, `supabase`, `tests`, `scripts` – Aufrufer nur `accept`, Tests und Register; in `src` nur ein Kommentar (`src/lib/partnerJobs.ts:193`). In Ordnung.
- Suche nach Importen von `jobs/handlers.ts` und `jobs/db.ts` in `supabase/functions` – vier Functions direkt, fünf geteilte Module mittelbar. Grundlage für N2.
- `supabase/migrations/20261116120000_0067_accept_replay.sql:7-23` – Signatur, `stable`, leerer Suchpfad, Verknüpfungen an die Firma des Listings, Rechte. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:359-368` – Basis: `not_found` für Nichtmitglieder zuerst, `already_taken` bei nicht offenem Listing, kein Firmenstatus. In Ordnung (N3).
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:395-411` – Annahme: Mitgliedschaft, Sperre der Anfrage, `already_taken` vor jedem Schreiben. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:422-427` – eine Zuordnung, eine Buchung, eine Kundenmail je Annahme. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:120-124` – `authenticated` liest `request_id` nicht, `service_role` liest die Tabelle. Grundlage für M1.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:317` – einziges späteres Spaltenrecht auf `job_listings` für `authenticated`. Grundlage für M1.
- `tests/rls/accept-replay.test.ts:25-27, 34-53` – vierzehn Proben, Unterabfragen im Aufruf. In Ordnung, Zeile 52 siehe M1.
- `tests/rls/accept-replay.test.ts:54-64` – Erwartungen je Probe, „Zuordnung beenden“ mit eigener Erwartung. In Ordnung, Zeile 64 siehe M1.
- `tests/support/owner.ts:103-110` – Fragezeichen-Probe besteht nur bei wahr; null als eigenes Zeichen. In Ordnung.
- `tmp/proof/n12/009-tests_rls_accept-replay.test.ts.log:1-2, 20, 23, 45` – ecd0353, nicht sauber, 42883 an den Aufrufen, „Annahme“ und „Zuordnung beenden“ ok, „je eine Zeile“ 1/1/1, `EXIT=1`. In Ordnung.
- `tmp/proof/n12/004-tests_rls_accept-replay.test.ts.log:23, 45` – 42883, `EXIT=1`. In Ordnung.
- `tmp/proof/n12/010-tests_rls_accept-replay.test.ts.log:1-2, 26` – 1377638, nicht sauber, `EXIT=0`; die Meldung der Probe „ohne Recht“ steht nicht im Log. Grundlage für M1.
- `tmp/proof/n12/011-tests_rls_flow-live.test.ts.log:1-2, 49` – 1377638, nicht sauber, `EXIT=0`. In Ordnung.
- `tests/rls/flow-live.test.ts:41-46` – `fn` liefert Status und Rumpf. In Ordnung.
- `tests/rls/flow-live.test.ts:57-65` – `snap`: Status, Journal, Listings, Outbox; keine Zuordnungen. Grundlage für N7.
- `tests/rls/flow-live.test.ts:172-188` – Rechte vor der Annahme, Annahme, Wiederholung gleich, andere Auszahlung 409, andere Firma 409, Journal eine Zeile. In Ordnung (N7).
- `tests/unit/accept.test.ts:14-29` – Fake mit `replay` null als Vorgabe. In Ordnung.
- `tests/unit/accept.test.ts:79-91` – Treffer aus Basis und aus Annahme, Akteur aus dem Token. In Ordnung.
- `tests/unit/accept.test.ts:93-103` – null bleibt 409, anderer Code fragt nicht nach, Fehler ergibt 500 ohne Einzelheiten. In Ordnung.
- `tests/unit/accept.test.ts:105-112` – Wiederholen bei veraltetem Satz. In Ordnung (N5).
- `tmp/proof/n12/006-tests_unit_accept.test.ts.log:22, 45, 70, 101` – drei Ist-Werte, `EXIT=1`. Grundlage für N6.
- `tmp/proof/n12/005-tests_unit_accept.test.ts.log:22` – `EXIT=0` vor dem roten Lauf. Grundlage für N6.
- `tmp/proof/n12/016-check.log:406-407, 432` – Register-Hash von `positiv.ts` veraltet (alter Wert aus n15, neuer Wert wie im Auftrag), `EXIT=1`. In Ordnung.
- `tmp/proof/n12/017-check.log:76, 104, 153, 362` – `accept.test.ts` zwölf Tests, `positiv-register.test.ts`, `sys-gate-loesch.test.ts` grün, `EXIT=0`. In Ordnung.
- `tmp/proof/n12/runs.jsonl:4, 9, 12` – rot, rot, grün für `accept-replay`. In Ordnung.
- `tmp/proof/n12/runs.jsonl:10-11` – Startmarke und Push-Marke mit demselben Hash wie `tmp/proof/n12/db-freigabe-1.md:8`. In Ordnung.
- `tmp/proof/n12/runs.jsonl` gesamt (Lauf-Zeilen) – kein Lauf von `tests/rls/positiv.test.ts`. Grundlage für M1 und N1.
- `tmp/proof/n12/db-freigabe-1.md:10, 28, 31-35` – frei; M1 dort durch Lauf 009 und Zeile 60 des Tests erledigt; N1 bis N4 in OFFEN n12-4, N5 durch die Reihenfolge erledigt. In Ordnung.
- `tmp/proof/n12/deploy-log.md:4-6` – Version 7, drei genannte Functions, Live-Aufruf Lauf 011. Grundlage für N2.
- `tests/support/positiv.ts:35` – `p_actor` erzwingt `service_role`. In Ordnung.
- `tests/support/positiv.ts:106-109, 147` – `j1` von Firma a mit `c.s.payoutCents` angenommen. In Ordnung.
- `tests/support/positiv.ts:169-175` – `NIE_AUSNAHME` mit der neuen Funktion. In Ordnung.
- `tests/support/positiv.ts:226-229` – neuer Eintrag. In Ordnung (N1).
- `tests/support/positiv.ts:210, 211, 231, 239, 244, 249, 253, 254, 260, 268, 307, 326, 341` – Zeilenlage gegen die Abnahme n15: oberhalb gleich, unterhalb vier Zeilen tiefer. In Ordnung.
- `tests/rls/positiv.test.ts:38-39, 56` – Wertfunktionen: nur Typ. Grundlage für N1.
- `tests/rls/positiv.test.ts:91-116` – Katalog gegen Register, genau „s“. In Ordnung, Lauf steht aus (M1).
- `scripts/sys/loesch-register.json:3-15` – 13 Skripte. In Ordnung.
- `scripts/sys/loesch-register.json:18-33` – 16 Ausnahmen, je Grund und Hash. In Ordnung.
- `scripts/sys/loesch-register.json:30` – Hash wie im Auftrag, Grundtext wie in n15. In Ordnung.
- `scripts/sys/loesch-register.json:29, 31` gegen `docs/proof/u1b/u1b-abnahme.md:15` und `docs/proof/u3-1/u3-1-abnahme.md:16` – Hashes von `partner.ts` und `positiv.test.ts` unverändert. In Ordnung.
- `tests/unit/sys-gate-loesch.test.ts:129-134` – Hash je Ausnahme im `check`. In Ordnung.
- Suche nach Importen von `tests/support/positiv.ts` – nur `tests/rls/positiv.test.ts:9` und `tests/unit/positiv-register.test.ts:5`. In Ordnung.
- `src/lib/partnerJobs.ts:190-197` – `acceptListing` ohne Notbehelf, ein Aufruf. Nur zur Einordnung gelesen, nicht abgenommen.
- `docs/OFFEN.md:83-86` – n12-1 bis n12-4. Grundlage für N10.

Offene Findings hoch: 0
