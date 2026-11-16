Modell: claude-fable-5-2

# DB-Freigabe 1 für Schritt n12

Datum: 2026-11-16
Umfang: Antrag `tmp/proof/n12/db-antrag-1.json` (eine Datei), Migration 0067 vollständig gelesen (23 Zeilen), gegen `partner_accept_basis` und `partner_accept` (0062:349-429), gegen die Tabellen und Indizes der vier gelesenen Relationen (0023, 0028, 0030, 0046), gegen alle Stellen, die eine Zuordnung beenden oder ein Listing auf `accepted` setzen (0038, 0062), gegen die Aufrufer `supabase/functions/_shared/jobs/handlers.ts` und `_shared/jobs/db.ts`, gegen den Registereintrag in `tests/support/positiv.ts`, den Katalogtest in `tests/rls/positiv.test.ts` und den Probetest `tests/rls/accept-replay.test.ts` geprüft. Regeln: `.claude/rules/daten.md`, `.claude/rules/geld.md`, `.claude/rules/tests.md`. Rot-Lauf 004 in `tmp/proof/n12/` vollständig gelesen (45 Zeilen), `runs.jsonl` vollständig.

SHA256: 2787c9d7e5266d9d4a3755e8ed27b8c91e67ce66a6ebcedd79c35f683565119c supabase/migrations/20261116120000_0067_accept_replay.sql

Urteil: frei

Grenzen der Prüfung
- Der Hash ist aus dem Antrag abgeschrieben (Antrag und Auftrag nennen denselben Wert). Ich habe kein Werkzeug, um ihn selbst zu berechnen; den Abgleich mit der Datei macht das Gate.
- Der Auftrag nennt als zweites Urteil „nicht frei“. Das Gate liest genau ein Wort nach `Urteil:` und kennt `frei` und `gesperrt` (`scripts/sys/gate-db-lib.mjs:37, 42, 61`); ich halte mich an das Gate.
- Ein Plan zu n12 liegt unter `tmp/proof/n12/` nicht als Datei vor. Geprüft habe ich gegen die Punkte aus dem Auftrag.
- Die Migration ist noch nicht angewendet. Rechte, Eindeutigkeit und Verhalten habe ich aus den Migrationen hergeleitet, nicht an der Datenbank abgefragt. Einen grünen Lauf von `accept-replay.test.ts` gibt es noch nicht; er ist nicht Teil dieser Freigabe.
- Die Vorgabe-Rechte der Plattform für neue Funktionen in `public` kenne ich nur aus OFFEN n15-2 und aus den Ist-Werten von n15, nicht aus dem Katalog.
- Dass keine spätere Migration einen der vier Eindeutigkeits-Indizes entfernt, habe ich per Suche über alle Migrationen geprüft (kein Entfernen eines Index, kein Entfernen einer Bedingung auf diesen Tabellen außer `non_negative_kinds`, 0029:7), nicht durch Lesen jeder Migration.
- Die Testdateien habe ich an den genannten Stellen gelesen, nicht abgenommen. `tests/unit/accept.test.ts` nur die Zeilen 79-103. Ob `scripts/redproof-soll.json` nach dem Push nachgezogen werden muss (eine neue Funktion), habe ich nicht geprüft.
- `handlers.ts` und `db.ts` habe ich nur auf den Aufruf der neuen Funktion geprüft (Herkunft von `p_actor`, Reihenfolge, Fehlerweg), nicht als Ganzes abgenommen.

## Findings

### hoch
Keine.

### mittel
- M1 `tmp/proof/n12/004-tests_rls_accept-replay.test.ts.log:20` gegen `tests/rls/accept-replay.test.ts:50` – Der rote Lauf passt vermutlich nicht mehr zum heutigen Text der Testdatei. Im Lauf endet der Schritt „Zuordnung beenden“ mit 23514 an `assignments_cancel_reason`. Der heutige Text setzt `ended_reason` auf den Kunden-Storno ohne `cancel_reason`; das erfüllt die Bedingung nach meiner Lesart (0046:21-24), und der Trigger lässt das erste Beenden zu (0050:5-21). Entweder wurde die Datei nach Lauf 004 geändert (der Arbeitsbaum war nicht sauber, Zeile 2 des Logs), oder meine Lesart der Bedingung ist falsch; dann wäre der Test nach dem Push an „nach beendeter Zuordnung“ rot. Nach dem Push lässt sich ein roter Lauf nicht mehr nachholen. – Fix: vor `npm run db:push` die Datei einmal über `npm run t -- tests/rls/accept-replay.test.ts` laufen lassen (erwartet: rot mit 42883 an den Aufrufen, „Annahme“ und „Zuordnung beenden“ jeweils „ok“). Zusätzlich in der Testdatei das Ergebnis von „Zuordnung beenden“ auf „ok“ prüfen, damit ein Fehler dort als das gemeldet wird, was er ist. Betrifft den Nachweis, nicht die Migration.

### niedrig
- N1 `supabase/migrations/20261116120000_0067_accept_replay.sql:14-17` – Ein Listing wird auch über die Bestätigung eines Festangebots `accepted` (0062:506-508, dort entstehen Zuordnung und Buchung derselben Firma). Die Funktion unterscheidet die beiden Wege nicht: Ruft ein Mitglied `accept` für ein solches Listing mit der Revision und der Auszahlung der Buchung auf, bekommt es 200 mit der eigenen assignmentId statt 409. Es wird nichts geschrieben und nichts Fremdes gezeigt (eigene Firma, eigene Zuordnung, eigene Buchung); die Aussage „diese Firma hält den Auftrag mit dieser Buchung“ stimmt. – Fix: keiner nötig. Im Kommentar der Funktion oder in OFFEN festhalten, dass die Antwort auch für angenommene Angebote gilt. Kein Grund, den Push aufzuhalten.
- N2 `supabase/migrations/20261116120000_0067_accept_replay.sql:13-19` – Die Funktion prüft weder den Status der Firma noch Gegenbuchungen. Eine nach der Annahme gesperrte Firma bekommt bei einer Wiederholung ihre assignmentId (die Annahme selbst hätte `partner_not_active` geliefert, 0062:402). Die ID allein öffnet nichts; Auftragsdaten hängen an den eigenen Lesefunktionen. Gegenbuchungen der Buchung entstehen in allen gelesenen Wegen nur zusammen mit dem Ende der Zuordnung (0062:736, 802, 928-936), der Fall „aktive Zuordnung, Buchung gegengebucht“ kommt also nicht vor. – Fix: keiner nötig.
- N3 `tests/rls/positiv.test.ts:38-39, 56` – Der Registerlauf prüft bei Wertfunktionen nur den Typ. `pg_typeof` liefert auch für null `uuid`; der Eintrag `partner_accept_replay` wäre also auch grün, wenn die Funktion im gültigen Zustand null lieferte. Den Positivfall belegt allein `tests/rls/accept-replay.test.ts:41-42, 57-58`. Das gilt für alle Wertfunktionen des Registers und ist kein Fehler dieses Eintrags. – Fix: bei Gelegenheit im Registerlauf für Wertfunktionen zusätzlich „nicht null“ verlangen (eigener Schritt, betrifft alle Einträge); bis dahin `accept-replay.test.ts` nicht entfernen.
- N4 `tmp/proof/n12/004-tests_rls_accept-replay.test.ts.log:20-23` – Der rote Lauf zeigt, dass die Funktion fehlt (42883), nicht die Wirkung der einzelnen Bedingungen. Für eine neue Funktion gibt es keinen anderen Vorher-Zustand; die Null-Fälle (andere Firma, Kunde, andere Revision, andere Auszahlung, beendete Zuordnung) sind damit nur grün belegbar. Der Lauf zeigt immerhin, dass die Fixture trägt („Annahme“ ok, „je eine Zeile“ 1/1/1). – Fix: in der Bewertung so benennen. Kein Grund, den Push aufzuhalten.
- N5 `tests/support/positiv.ts:4, 226-229`, `supabase/functions/_shared/jobs/db.ts:32` – Register und `db.ts` nennen die Funktion schon; bis `db:types` nach dem Push gelaufen ist, kennt die Typdatei sie nicht, `check` ist bis dahin an beiden Stellen rot. Die Function `accept` muss nach dem Push neu deployt werden, sonst wirkt N-12 nicht (ohne Deploy bleibt es beim bisherigen 409, kein Geldweg scheitert). – Fix: Reihenfolge Push, Typen, Deploy im selben Schritt einhalten.

## Prüffragen

1. Erfährt ein Akteur Daten, die er nicht sehen darf: nein.
   - Die Funktion liefert nur dann eine Zeile, wenn der Akteur Mitglied der Firma des Listings ist (0067:13) und Zuordnung und Buchung derselben Firma gehören (0067:14-15, beide an `l.partner_id` gebunden). Für ein fremdes Listing kommt immer null, gleich ob es existiert, offen, geschlossen oder von jemand anderem angenommen ist. Existenz fremder Zuordnungen und Auszahlungen anderer Firmen lassen sich nicht ablesen.
   - Über die Edge Function erreicht ein Fremder die Funktion gar nicht: `partner_accept_basis` endet für Nichtmitglieder vor jeder Statusprüfung mit `not_found` (0062:360-362), `partner_accept` ebenso (0062:398-399). `already_taken` bekommt nur ein Mitglied der Firma des Listings; nur dann fragt der Handler nach (`handlers.ts:124-125`).
   - Für das eigene, von einer anderen Firma weggenommene Listing (`closed`) bleibt es bei 409 wie bisher.
   - Neu ist für Mitglieder nur die Unterscheidung 200 gegen 409 bei passender Revision und Auszahlung der eigenen Buchung. Das Journal der eigenen Firma liest jedes Mitglied mit aal2 ohnehin (0028:195-196, 0023:81-86), der Handler verlangt aal2 (`handlers.ts:92, 57`). Kein neuer Lesezugriff.
   - `p_actor` kommt nur aus dem geprüften Token (`handlers.ts:99, 125`, `db.ts:32`), nie aus dem Body; der Unit-Test hält das fest (`tests/unit/accept.test.ts:87-90`). Akteur null ergibt null (Vergleich mit null, 0067:13).
   - Kunden: kein Weg. EXECUTE nur `service_role`, die Function verlangt aal2 und Mitgliedschaft; die Antwort enthält keine Gebühr und keinen Betrag, nur die ID der Zuordnung.
2. Mehr als eine Zeile oder falscher Treffer: nein, `limit 1` ist nicht nötig.
   - Je Verknüpfung höchstens eine Zeile: Listing über den Primärschlüssel (0030:31), Mitglied über `unique (user_id)` (0023:46), aktive Zuordnung über den Teilindex je Anfrage (0030:64), Buchung über den Teilindex je Anfrage für die Art `booking` (0028:42). Das Ergebnis hat also null oder eine Zeile.
   - Mitglied mehrerer Firmen: durch `unique (user_id)` ausgeschlossen; `partner_accept` verlässt sich auf dieselbe Bedingung (0062:398).
   - Folgeauftrag nach Absage: `reissue_request` legt eine neue Anfrage mit neuen Listings an. Alle Verknüpfungen laufen über `l.request_id` des gefragten Listings; ein Treffer über Anfragen hinweg ist nicht möglich. Das alte Listing bleibt `accepted`, seine Zuordnung ist beendet: null.
   - Nachtrag und Korrektur: Nachträge sind Zeilen der Art `change`, Gegenbuchungen der Art `cancellation` oder `correction`; die Funktion liest nur `booking`, davon gibt es je Anfrage für immer höchstens eine. Nach einem Nachtrag liefert eine Wiederholung mit der ursprünglichen Revision und Auszahlung weiter die assignmentId. Das ist richtig: es ist die Antwort auf die ursprüngliche Annahme. Eine Wiederholung mit den neuen Werten ergibt null (409).
   - Eine zweite Annahme derselben Anfrage ist ausgeschlossen (0062:406-407, dazu der Buchungs-Index); aktive Zuordnung und Buchung stammen also immer aus derselben Annahme.
   - Selbst bei mehreren Zeilen käme kein Fehler: Eine SQL-Funktion mit einfachem Rückgabetyp liefert die erste Zeile der letzten Abfrage, bei keiner Zeile null. Falsch wäre dann nur die Auswahl; da `a.id` durch den Index eindeutig ist, gibt es auch dafür keinen Fall.
   - Wettlauf: Läuft der erste Aufruf noch, sieht die Wiederholung in der Basis das Listing als offen, wartet in `partner_accept` auf die Sperre der Anfrage (0062:400), bekommt danach `already_taken` (0062:406) und fragt in einer neuen Anweisung nach; die sieht den Commit. Bricht der erste Aufruf ab, nimmt die Wiederholung normal an. Die Funktion ist eine einzelne lesende Anweisung mit einem Schnappschuss, ohne Sperren.
3. Rechte: korrekt.
   - 0067:22-23 folgt Wort für Wort dem Muster von `partner_accept_basis` und `partner_accept` (0062:1030-1033): Entzug bei PUBLIC, `anon`, `authenticated`, `service_role`, danach EXECUTE nur für `service_role`. Die Signatur in beiden Anweisungen stimmt mit 0067:7 überein.
   - OFFEN n15-2 (`docs/OFFEN.md:85`): Die Falle betrifft Funktionen, die ihr Recht für `service_role` ungewollt über die Vorgabe bekommen. Hier ist das Recht gewollt und ausdrücklich vergeben; die Vorgabe-Einträge für `anon` und `authenticated` und das PUBLIC-Recht nimmt die Migration ausdrücklich weg. Der Katalogtest verlangt für den Eintrag genau „s“ (`tests/rls/positiv.test.ts:106-110`), der Probetest erwartet 42501 für `authenticated` (`tests/rls/accept-replay.test.ts:52, 63`).
   - `security definer` mit `search_path = ''`, alle Tabellen mit Schema genannt; `stable`, keine Schreibanweisung. Keine Tabelle, keine Spalte, keine Policy, kein Trigger, keine Daten, kein Seed, kein Secret. `partner_accept` und `partner_accept_basis` werden nicht berührt.
4. Registereintrag und Probetest: passen, mit den Hinweisen M1, N3, N4.
   - Register (`tests/support/positiv.ts:226-229`): Welt `auftrag`, `service_role`, EXECUTE „s“, Wert vom Typ `uuid`. `R.j1` nimmt Firma a im Setup mit Revision 1 und `c.s.payoutCents` an (`positiv.ts:107, 147`); der Aufruf nennt dieselbe Firma, Revision und Auszahlung und trifft damit die Positivzeile. Die Einträge davor in derselben Welt ändern `j1` nicht (`partner_accept_basis` und `partner_accept` arbeiten auf `q0`); `start_job` auf `j1` steht dahinter (`positiv.ts:253`) und änderte das Ergebnis auch nicht. Die Funktion steht in der Liste ohne Ausnahme (`positiv.ts:170`), und wegen `p_actor` erzwingt die Typbindung `service_role` (`positiv.ts:35`).
   - Probetest (`tests/rls/accept-replay.test.ts`): deckt jede Bedingung der Funktion einzeln ab. Vor der Annahme null (35), zweimal dieselbe ID (41-42), je eine Zeile in Zuordnungen, Buchungen und Outbox (43, 59), andere Firma mit eigenem und mit fremdem Listing (44-45), Kunde (46), Akteur null (47), andere Revision (48), andere Auszahlung (49), beendete Zuordnung (50-51), kein Recht für `authenticated` (52). Alles in einer Rollback-Probe. Nicht gedeckt: Listing aus bestätigtem Angebot (N1).
   - Roter Lauf: `runs.jsonl:4`, Lauf 004, `EXIT=1`, Commit ecd0353, Arbeitsbaum nicht sauber, erste verletzte Erwartung in Zeile 55 der Testdatei mit 42883. Siehe M1 und N4.
   - Geld (`geld.md`): Die Funktion rechnet nicht. `p_shown_payout` und `payout_cents` sind `bigint` in Cent; der Vergleich ist exakt. Die Function prüft die Eingabe als sichere ganze Zahl größer null (`handlers.ts:96`).

## Stichproben (selbst nachgeschlagen)

- `tmp/proof/n12/db-antrag-1.json:3-4` – eine Datei, Hash wie im Auftrag. In Ordnung.
- `supabase/migrations/20261116120000_0067_accept_replay.sql:7-9` – Signatur, `sql stable security definer`, `search_path = ''`. In Ordnung.
- `supabase/migrations/20261116120000_0067_accept_replay.sql:22-23` – Entzug bei vier Rollen, EXECUTE nur `service_role`. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:359-366` – Basis: `not_found` für Nichtmitglieder vor `already_taken`; `already_taken` vor `expired`. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:395-411` – Annahme: `not_found` vor allen Statusprüfungen, Sperre der Anfrage, `already_taken` nach dem Warten. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:422-425` – eine Zuordnung, Listing `accepted`, eine Buchung mit `p_revision` und `p_payout` je Annahme. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:506-508` – Listing `accepted` auch über das bestätigte Angebot. Grundlage für N1.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:928-936` – Storno durch admin: Zuordnung beendet, danach Gegenbuchung. Grundlage für N2.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:1030-1033` – Rechte-Muster der beiden Nachbarfunktionen. In Ordnung.
- `supabase/migrations/20261107100000_0023_partners.sql:40-47` – `partner_members`: Primärschlüssel und `unique (user_id)`. In Ordnung.
- `supabase/migrations/20261107100000_0023_partners.sql:81-86` – Journal-Lesezugriff: Mitglied, jeder Status, aal2. In Ordnung.
- `supabase/migrations/20261108110000_0028_commission_journal.sql:42` – höchstens eine Buchung je Anfrage. In Ordnung.
- `supabase/migrations/20261108110000_0028_commission_journal.sql:195-196` – Policy des Journals: eigene Firma oder admin. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:31, 48` – Listing: Primärschlüssel, eine Zeile je Anfrage und Firma. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:64` – höchstens eine aktive Zuordnung je Anfrage. In Ordnung.
- `supabase/migrations/20261109180000_0046_cancel_by_partner.sql:19-24` – `assignments_cancel_reason`: `cancel_reason` genau bei Absage der Firma. Grundlage für M1.
- `supabase/migrations/20261109220000_0050_s9h3_abnahme.sql:5-21` – Trigger der Zuordnung: erstes Beenden erlaubt. Grundlage für M1.
- `supabase/functions/_shared/jobs/handlers.ts:92-99` – aal2, Eingabeprüfung, Akteur aus dem Token. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:120-128` – Nachfrage nur bei `already_taken`, null lässt den 409 stehen. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:129-135` – Fehler der Nachfrage: 500 ohne Einzelheiten. In Ordnung.
- `supabase/functions/_shared/jobs/db.ts:31-35` – Aufruf mit den vier Parametern in der Reihenfolge der Signatur, null wird durchgereicht. In Ordnung.
- `tests/unit/accept.test.ts:79-103` – 200 bei Treffer aus Basis und aus Annahme, 409 bei null, keine Nachfrage bei anderen Codes, 500 ohne Einzelheiten. In Ordnung (nur diese Zeilen gelesen).
- `tests/support/positiv.ts:35, 107, 147, 170, 226-229, 253` – Registereintrag, Fixture `j1`, Liste ohne Ausnahme. In Ordnung.
- `tests/rls/positiv.test.ts:38-39, 56` – Wertfunktionen: nur Typ geprüft. Grundlage für N3.
- `tests/rls/positiv.test.ts:91-116` – Katalog gegen Register, genau „s“ verlangt. In Ordnung.
- `tests/support/owner.ts:92-114` – jede Probe im eigenen Block, Ergebnis „ok“, Wert oder Fehlercode; erfolgreiche Schritte bleiben für die folgenden bestehen, am Ende Rollback. In Ordnung.
- `tests/rls/accept-replay.test.ts:34-63` – vierzehn Proben, Erwartungen wie in Prüffrage 4. „Zuordnung beenden“ ohne eigene Erwartung (M1).
- `tmp/proof/n12/004-tests_rls_accept-replay.test.ts.log:1-2, 20-23, 45` – Commit ecd0353, Arbeitsbaum nicht sauber, 42883 an allen Aufrufen, 23514 an „Zuordnung beenden“, `EXIT=1`. Grundlage für M1 und N4.
- `tmp/proof/n12/runs.jsonl:4` – Lauf 004 rot, ein Test fehlgeschlagen. In Ordnung.
- `docs/OFFEN.md:85` – n15-2 im Wortlaut. Trifft diese Migration nicht (Prüffrage 3).
- `scripts/sys/gate-db-lib.mjs:37, 42, 61` – Form der Urteilszeile. In Ordnung.

Offene Findings hoch: 0
