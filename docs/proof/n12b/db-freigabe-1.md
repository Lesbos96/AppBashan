Modell: claude-fable-5-2

# DB-Freigabe 1 für Schritt n12b

Datum: 2026-11-16
Umfang: Antrag `tmp/proof/n12b/db-antrag-1.json` (eine Datei), Migration 0068 vollständig gelesen (161 Zeilen). Geprüft gegen `send_offer` (0062:522-578, Zeile für Zeile), `my_report_info` (0064:46-60) und `report_not_done` (0066:72-91), gegen alle Stellen, die eine Zeile `cancellation_fee` schreiben oder gegenbuchen (0062:703-747, 775-827, 853-948, 329-345), gegen die Einfügeprüfung des Journals (0062:220-323, Trigger 0028:135-136), die Statusmaschine (0049:16-41), `change_gate` (0064:176-199), `propose_change` (0041:5-48), `reissue_request` (0046:385-430), die Tabellen `audit_log` (0015:19-51), `commission_entries` (0028:11-50, 192-193) und die Spalten des Nachtrags (0040:10-27). Aufrufer: `supabase/functions/_shared/cancel/handlers.ts`, `partner.ts`, `db.ts`, `_shared/change/handlers.ts`, `db.ts`, dazu `_shared/jobs/handlers.ts:1-72` und `jobs/db.ts`. Tests: `tests/rls/replay.test.ts` und `replay-concurrency.test.ts` vollständig, `change-orders.test.ts:28-142`, `offers.test.ts:67-141`, `journal.test.ts:160-284`, Register `tests/support/positiv.ts:224-251`. Läufe 001 bis 004 in `tmp/proof/n12b/` und `runs.jsonl`. Regeln: `.claude/rules/daten.md`, `geld.md`, `tests.md`. Plan: `tmp/proof/n12b-plan.md`.

SHA256: dc9c128f7edcdd416f73db695a64eaec93e5552024632549295bd9eb241b31f8 supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql

Urteil: frei

Grenzen der Prüfung
- Der Hash ist aus dem Antrag abgeschrieben (Antrag und Auftrag nennen denselben Wert). Ich kann ihn nicht selbst berechnen; den Abgleich mit der Datei macht das Gate.
- Die Migration ist nicht angewendet, die Dev-Datenbank kann ich nicht abfragen. Rechte, Eindeutigkeit, Altdaten und Verhalten sind aus den Migrationen und Tests hergeleitet. Grüne Läufe der vier Testdateien gibt es noch nicht; sie sind nicht Teil dieser Freigabe.
- `tmp/proof/n12b-plan.md` enthält den Plan und die Frage an mich, nicht meine Antwort. Geprüft habe ich gegen die fünf Punkte des Auftrags. Die Migration weicht vom Plan in zwei Punkten ab, beide in die strengere Richtung: `cancel_replay` vergleicht den Betrag in SQL und liefert nur den Status (Plan 2a: liefert den Betrag), und der Nachtrag bekommt eine eigene Lesefunktion, `propose_change` bleibt unberührt (Plan 2c: `create or replace`). Der Index (Punkt 1) steht im Plan nur als Ziel („doppelte Pauschale ausschließen“), nicht als Schritt.
- Den Vergleich von `send_offer` und `my_report_info` habe ich durch Lesen beider Fassungen gemacht, nicht mit einem Byte-Diff.
- Ob eine spätere Migration `guard_request_status`, `send_offer`, `my_report_info`, `propose_change` oder die Storno-Funktionen neu definiert, habe ich per Suche über alle Migrationen geprüft (letzte Treffer: 0049, 0062, 0064, 0041, 0062), nicht durch Lesen jeder Migration.
- Nicht gelesen: `private.partner_cancel_fee`, `private.call_out_base`, `private.cancel_fee_base`, die Parser des Preismoduls (betrifft N2), die Unit-Tests der Handler, `scripts/redproof-soll.json`, der Hash-Eintrag für `positiv.ts` im Lösch-Register. Die Handler habe ich nur auf den Weg zur neuen Funktion geprüft (Herkunft des Akteurs, Auslöser, Antwort, Fehlerweg), nicht als Ganzes abgenommen.
- Ob die CLI eine Migration in einer Transaktion ausführt, habe ich nicht nachgeschlagen. Für den Fall „Index scheitert“ ist es gleich: der Index ist die erste Anweisung.

## Findings

### hoch
Keine.

### mittel
- M1 `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:10` gegen `tests/rls/journal.test.ts:248, 262` und `supabase/migrations/20261114100000_0062_fee_schedule.sql:306-315` – Der Index ist strenger als die bisherige Journalregel. Bisher gilt „höchstens eine lebende“ Gebührenzeile je Anfrage (Trigger); nach der Gegenbuchung der ersten Zeile ist eine neue erlaubt, und `journal.test.ts` hält genau das fest (Schritt „Gegenbuchung der ersten, dann neue Stornogebühr“, erwartet „ok“). Mit dem Index endet dieser Schritt mit 23505, `journal.test.ts` ist nach dem Push rot. Der Kommentar in 0068:2 nennt nur die Funktionswege; für die stimmt er (Prüffrage 1): keine Funktion bucht nach einer Gegenbuchung eine zweite Zeile. Meine Entscheidung: der Index bleibt. Er ist eine Bedingung im Schema und übersteht jede Neufassung des Triggers (der wurde in 0029, 0040 und 0062 neu geschrieben); der Preis ist, dass „Pauschale negieren und neu buchen“ ohne neue Migration nicht mehr geht. Das ist eine Regeländerung und muss als solche dastehen. – Fix: (a) `journal.test.ts:248, 262` auf die neue Regel umstellen: der Schritt erwartet 23505 mit dem Namen des Index, Schrittname anpassen; den Schritt nicht streichen. (b) Die Regel in `docs/ENTSCHEIDUNGEN.md` festhalten („höchstens eine Gebührenzeile je Anfrage, auch nach Gegenbuchung“; eine spätere Funktion „Pauschale neu buchen“ muss den Index ersetzen). (c) Im Bericht an Beks nennen. Betrifft Test und Doku, nicht den Inhalt der Migration.
- M2 `tests/rls/replay.test.ts:88, 146` gegen `tmp/proof/n12b/002-tests_rls_replay.test.ts.log:20` – Der Schritt „S1 zweite Pauschalenzeile“ kann nie 23505 liefern. Er bucht, solange die erste Pauschale noch lebt; der Trigger läuft vor dem Einfügen (`before insert`, 0028:135-136) und bricht mit `amount_mismatch` ab (0062:309-315), bevor der Index gefragt wird. Lauf 002 zeigt genau das („P0001: amount_mismatch“ an Zeile 146). Folgen: der rote Lauf misst weder den Index noch das Fehlen von `cancel_replay` (die Erwartungen ab Zeile 152 wurden nicht erreicht), und nach dem Push bleibt Zeile 146 rot. – Fix vor `npm run db:push`: den Schritt hinter „S1 negate_fee“ (Zeile 129) setzen; dann lässt der Trigger die Zeile durch und nur der Index hält sie auf. Erwartung 23505 mit dem Namen des Index. Einmal über `npm run t -- tests/rls/replay.test.ts` laufen lassen: erwartet rot, der Schritt meldet „ok“ (Zeile geschrieben); das ist der Ist-Wert, den `tests.md:14` verlangt. Danach pushen. Ist schon gepusht, bleibt als Vorher-Beleg nur das „ok“ von `journal.test.ts:262` aus früheren grünen Läufen; das dann in der Bewertung so benennen.

### niedrig
- N1 `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:24-26` – `audit_log` hat außer dem Primärschlüssel keinen Index (0015:19-28, Suche über alle Migrationen). Die Funktion liest die Tabelle zweimal nach Aktion und Anfrage, bevor sie die billigen Bedingungen prüft (Anfrage über den Primärschlüssel, Status, Kunde bzw. Mitglied). Erreicht wird sie bei jedem `not_found` von `cancel-partner` (`partner.ts:93`, also auch mit einer beliebigen Anfrage-Id eines aal2-Mitglieds) und bei jedem `invalid_transition` von `cancel-customer` (`handlers.ts:78`). Heute klein, wächst mit dem Audit. – Fix: bei der nächsten Änderung die Reihenfolge umdrehen (erst Anfrage, Status, Partei, dann Audit) oder einen Index auf `(entity, entity_id)`. Nach OFFEN, kein Grund, den Push aufzuhalten.
- N2 `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:73` – Der Vergleich der Eingaben ist eine Teilmenge, keine Gleichheit: verglichen werden nur die Schlüssel aus `p_changes`. Ein Aufruf mit weniger geänderten Feldern oder mit `{}` (der Handler lässt ein leeres Objekt zu, `change/handlers.ts:107`), aber gleichem Betrag und denselben Belegen, bekommt die Id des offenen Nachtrags. Es ist die eigene Firma, nichts wird geschrieben, nichts Neues gezeigt; nur die Aussage „genau dieser Vorschlag“ ist dann ungenau. Umgekehrt vergleicht die Funktion die rohen `changes` des Aufrufs (`change/handlers.ts:134`) mit den gespeicherten, vom Parser erzeugten Eingaben (`change/handlers.ts:121, 125`): formt der Parser einen geänderten Wert um, trifft die Wiederholung nie und es bleibt beim 409 (fail closed). `change-orders.test.ts:41, 44` nutzt auf beiden Seiten dasselbe Literal und deckt diesen Weg nicht. – Fix: nicht nötig für den Push. In OFFEN festhalten; bei Gelegenheit einen Test mit echtem Parser-Ergebnis und im Handler ein leeres `changes` bei der Wiederholung abweisen.
- N3 `supabase/functions/_shared/database.types.ts` (Suche: nur `partner_accept_replay`, Zeile 1912) und `supabase/functions/_shared/cancel/db.ts:12, 54`, `change/db.ts:11` – Die Typdatei kennt die zwei neuen Funktionen erst nach `db:types`; bis dahin ist `check` an den drei Aufrufen und im Register rot. Werden die Functions vor dem Push deployt, endet jede Nachfrage mit einem Fehler der Datenbank und der Handler antwortet 500 statt 404 bzw. 409 (bei `cancel-partner` jedes `not_found`). – Fix: Reihenfolge Push, Typen, Deploy im selben Schritt.
- N4 `tmp/proof/n12b/004-tests_rls_offers.test.ts.log:36-44` gegen `tests/rls/offers.test.ts:84-85, 113-114` – Lauf 004 ist aus einem anderen Grund rot als gemeint: der Schritt las damals `partner_offers` als `authenticated` (42501). Die Datei ist seither geändert (zwei Schritte statt einem). Das Gate verlangt für diese Datei keinen roten Lauf (keine neue Datei); als Beleg für die Änderung an `send_offer` taugt 004 nicht. – Fix: zusammen mit M2 vor dem Push einmal laufen lassen (erwartet rot an „a wiederholt“ mit `offer_exists`).
- N5 `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:82-143` – Die Gleichheit des Rumpfs mit 0062:522-578 ist nur durch Lesen belegt. – Fix: zur Abnahme einen Funktionsdiff als Nachweisdatei ablegen (wie bei 0062, dort Zeile 520).
- N6 `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:122-123, 128` – Bei der Wiederholung bleibt das Ablaufen fremder, überfälliger Angebote jetzt stehen (vorher nahm die Exception `offer_exists` es zurück). Das ist dasselbe wie bei jedem erfolgreichen Senden (0062:561-562), keine neue Wirkung. – Fix: keiner.

## Prüffragen

1. Index `commission_one_cancellation_fee`: trägt, mit M1.
   - Kein Funktionsweg schreibt zwei Zeilen. `cancel_by_customer` verlangt unter der Sperre der Anfrage den Status `accepted` oder `in_progress` (0062:719-720), `cancel_by_partner` über `change_gate` die aktive Zuordnung und denselben Status (0064:188-195), `admin_correct` für ein Storno `accepted`, `in_progress` oder `completed` (0062:906). Aus `cancelled_by_customer` und `cancelled_by_partner` führt kein Übergang heraus (0049:23-33). Jede Anfrage wird also höchstens einmal storniert, jedes Storno bucht höchstens eine Zeile (0062:738-741, 804-807, 937-940).
   - `negate_fee` bucht eine `correction`, keine Gebührenzeile (0062:893-901), und danach bleibt der Status storniert.
   - Folgeanfrage: `reissue_request` legt eine neue Anfrage mit neuer Id an (0046:391, 408-412), und nur bei Absage ohne Pauschale (0062:813-814). Ihre Gebührenzeile hätte eine eigene `request_id`.
   - Direkt schreiben kann nur der Eigentümer: `commission_book` hat für keine API-Rolle EXECUTE (0062:216-217), `service_role` hat auf der Tabelle nur SELECT (0028:192-193).
   - Der einzige Weg zu zwei Zeilen ist der, den der Trigger bisher erlaubte: erste Zeile gegenbuchen, dann neu buchen. Den gibt es heute nur im Test (M1).
   - Altdaten: Der Push scheitert genau dann, wenn in der Dev-Datenbank eine Anfrage zwei oder mehr Zeilen der Art `cancellation_fee` hat, gegengebuchte mitgezählt. Prüfabfrage in Worten: Zeilen dieser Art nach `request_id` gruppieren, Gruppen mit mehr als einer Zeile. Entstehen konnte das nur durch einen committeten Eigentümer-Aufruf von `commission_book` nach einer Gegenbuchung. Die Rollback-Proben hinterlassen nichts (`tests/support/owner.ts:113`); die committenden Tests, die ich gelesen habe, buchen höchstens eine Zeile je Anfrage (`journal-live.test.ts:172-173`, `replay-concurrency.test.ts:91-105`). Scheitert der Push, dann mit 23505 an der ersten Anweisung, nichts von 0068 ist angewendet. Das Journal ist nur anfügbar (0028:47-50), ein solcher Rest lässt sich nicht wegräumen: anhalten, berichten; der Index müsste dann aus der Migration (neuer Antrag).
   - Namenskollision: keiner der drei neuen Namen kommt in einer früheren Migration vor.
2. `cancel_replay`: in Ordnung.
   - Quelle: genau eine Audit-Zeile mit der Aktion und der Anfrage (0068:24-26). Null oder mehrere Zeilen ergeben null, der Handler bleibt beim ursprünglichen Fehler. Die Aktionen `cancel_by_customer` und `cancel_by_partner` schreibt nur der jeweilige Erfolg (0062:743-744, 809-811); das Storno durch admin schreibt `admin_correct` (0062:943-945) und ist damit nie eine Wiederholung des Kunden oder der Firma. Das Audit ist nur anfügbar (0015:40-43).
   - Ein Schnappschuss: die Funktion ist `stable`, alle Anweisungen sehen denselben Stand; Audit, Status und Journal können nicht auseinanderlaufen.
   - Betrag: Vergleich in SQL gegen das Audit und gegen die Journalsumme (Gebührenzeile samt Gegenbuchungen, 0068:31-34, 38, 47). Ohne Gebühr ist die Summe 0 und nur der Betrag 0 trifft. Nach `negate_fee` trifft nichts mehr. Fehlt der Schlüssel im Audit, null. Die Werte sind `bigint`, der Vergleich ist exakt; der Handler prüft die Eingabe als sichere ganze Zahl (`cancel/handlers.ts:47`, `partner.ts:55`).
   - Akteur: dieselbe Person wie im Audit (0068:27). Beim Kunden zusätzlich Eigentümer der Anfrage (0068:37). Bei der Firma zusätzlich heute Mitglied der Firma, deren Zuordnung mit `cancelled_by_partner` endete (0068:43-46); ein Konto gehört höchstens einer Firma (0023:46), ein ausgetretenes oder gewechseltes Mitglied bekommt null.
   - Grund und Belege: Grund exakt (0068:48), Belege als sortierte Liste, Reihenfolge gleichgültig (0068:49-52). Alte Audit-Zeilen ohne `photos` zählen als leere Liste.
   - Nach außen: nur der Statustext. Die Handler geben den vom Aufrufer selbst gesendeten Betrag zurück (`cancel/handlers.ts:81`, `partner.ts:96`). Keine Gebühr, keine Journalzeile, kein fremder Betrag. Für jeden außer der Person des Erfolgs ist das Ergebnis immer null, gleich ob die Anfrage existiert; es gibt nichts abzulesen.
   - Rechte: Entzug bei PUBLIC, `anon`, `authenticated`, `service_role`, danach EXECUTE nur `service_role` (0068:57-58), Signatur wie in 0068:12. Register verlangt genau „s“ (`positiv.ts:231-234`), der Test erwartet 42501 für `authenticated` und `anon` (`replay.test.ts:171-172`).
   - `search_path = ''`, alle Tabellen und Typen mit Schema, sonst nur eingebaute Funktionen. `security definer`, keine Schreibanweisung.
   - Akteur aus dem geprüften Token, nie aus dem Body (`cancel/handlers.ts:79`, `partner.ts:94`). aal2 und Firmenstatus prüft die Funktion nicht; bei der Firma stehen `mfa_required` und `partner_not_active` im Tor vor `not_found` (0064:185-194), eine gesperrte Firma bekommt also 403 und keine Nachfrage.
   - Wettlauf: der Verlierer wartet auf die Sperre der Anfrage (0062:719 bzw. 0064:188), scheitert vor jeder Buchung und fragt in einer neuen Anweisung nach; die sieht den Commit.
   - Fehler der Nachfrage: 500 ohne Einzelheiten (`cancel/db.ts:13, 55`, `handlers.ts:87-88`).
3. `propose_change_replay`: Bedingungen reichen, mit N2.
   - Treffer nur für ein Mitglied der Firma, die den Nachtrag gestellt hat (0068:67), offener, gültiger Nachtrag auf der geltenden Revision (0068:69-70), gleicher Betrag (0068:71), Belege als Menge (0068:74-75). Höchstens ein offener Nachtrag je Anfrage (0040:27), `limit 1` ist nur Vorsicht.
   - Auf Firmenebene, nicht auf die Person: wie im Plan (2c) und wie `propose_change` selbst (0041:17, 40).
   - Offenlegung: nur die Id des eigenen Nachtrags. Andere Firma, Kunde, Akteur null: null. Kein Objekt und `null` als `p_changes`: keine Zeile, kein Fehler (0068:72-73).
   - Der Handler fragt nur nach `change_open` (`change/handlers.ts:133`); der Code kommt erst nach dem Tor (aal2, Mitglied, aktive Zuordnung; 0041:17, 23). Die Vorschau fragt nie.
   - Rechte wie bei Punkt 2 (0068:79-80; `positiv.ts:235-238`; `change-orders.test.ts:136-137`).
4. `send_offer`: Rumpf gleich bis auf den Block.
   - Zeile für Zeile verglichen: 0068:83-124 entspricht 0062:522-563 (Kopf nur `create or replace`), 0068:129-143 entspricht 0062:564-578. Neu sind allein 0068:125-128. Deklarationen unverändert.
   - Rechte: `create or replace` mit gleicher Signatur lässt Eigentümer und Rechte stehen (EXECUTE nur `authenticated`, 0062:1038-1039). Kein `drop`, die Falle aus OFFEN n15-2 greift nicht.
   - Wiederholung: Rückgabe vor Zählung, Insert, Statuswechsel und Outbox; keine neue Zeile, keine Mail. Alle Tore davor gelten weiter (aal2, Firma aktiv, Zuständigkeit, Status, Frist, Listing offen, Spanne, USt.-Regel). Treffer nur bei gleichem Betrag auf derselben Revision; sonst `offer_exists` wie bisher. Ein übrig gebliebenes `sent` ist nach 0068:122-123 immer noch gültig. Höchstens ein `sent` je Anfrage und Firma (0038:31).
   - Gleichzeitigkeit: `for update` auf die Anfrage (0068:104) reiht zwei Aufrufe; der zweite sieht danach das Angebot des ersten und bekommt dessen Id.
   - Offenlegung: die Id des eigenen Angebots der eigenen Firma.
5. `my_report_info`: Rumpf gleich 0064:46-60, eine Zeile mehr (0068:157), wortgleich mit `report_not_done` (0066:83). Beide Fehler heißen `not_found`, die Reihenfolge verrät nichts. Rechte bleiben (nur `authenticated` nach 0066:94-97).
6. Regeln.
   - `geld.md`: Die Migration rechnet nicht. Beträge sind `bigint` bzw. `int` in Cent. Kunden bekommen über keinen der Wege eine Gebühr oder Journalzeile.
   - `daten.md`: `security definer` mit festem `search_path` überall; `p_actor` nur über `service_role`; keine Tabelle, keine Policy, keine Daten, kein Seed, kein Secret.
   - `tests.md`: siehe M2 und N4.

## Stichproben (selbst nachgeschlagen)

- `tmp/proof/n12b/db-antrag-1.json:3-4` – eine Datei, Hash wie im Auftrag. In Ordnung.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:10` – Teilindex auf `request_id` für die Art Gebührenzeile. Grundlage für M1.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:12-14, 57-58` – Signatur, `stable security definer`, leerer `search_path`, Rechte. In Ordnung.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:60-62, 79-80` – dasselbe für den Nachtrag. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:522-578` – `send_offer` alt, gegen 0068:83-143 gelesen. Gleich bis auf 0068:125-128.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:1038-1039` – Rechte von `send_offer`. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:46-63` – `my_report_info` alt und Rechte. Gleich bis auf 0068:157.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:83, 94-97` – Prüfung des gelöschten Profils, Entzug für `service_role`. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:719-720, 738-744` – Storno des Kunden: Statustor unter Sperre, eine Zeile, Audit mit `fee_base_cents`. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:801-811` – Absage der Firma: eine Zeile, Audit mit Grund, Betrag, Belegen. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:893-901, 906, 937-945` – `admin_correct`: Gegenbuchung, Statustor, eine Zeile, eigene Audit-Aktion. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:185, 216-217` – `commission_book` sperrt die Anfrage, kein EXECUTE für API-Rollen. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:306-315` – Trigger: höchstens eine lebende Gebührenzeile. Grundlage für M1 und M2.
- `supabase/migrations/20261108110000_0028_commission_journal.sql:135-136` – Trigger läuft vor dem Einfügen. Grundlage für M2.
- `supabase/migrations/20261108110000_0028_commission_journal.sql:42-50, 192-193` – vorhandene Indizes, nur anfügen, `service_role` nur SELECT. In Ordnung.
- `supabase/migrations/20261109210000_0049_admin_correct.sql:23-33` – kein Übergang aus einem Storno-Status. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:184-197` – Reihenfolge im Tor: aal2, Mitglied, Anfrage, Firmenstatus, Zuordnung, Status. In Ordnung.
- `supabase/migrations/20261109180000_0046_cancel_by_partner.sql:391, 408-412` – Folgeanfrage mit neuer Id. In Ordnung.
- `supabase/migrations/20261101160000_0015_versions_published.sql:19-28, 40-43` – Spalten des Audits (`entity_id` als Text), nur anfügen, kein weiterer Index. Grundlage für N1.
- `supabase/migrations/20261109130000_0041_s9f_abnahme.sql:17-40` – `propose_change`: Tor, `change_open`, Eingaben wie übergeben gespeichert, Firma in `proposed_by`. In Ordnung.
- `supabase/migrations/20261109120000_0040_change_orders.sql:10-14, 27` – Spalten des Nachtrags, ein offener je Anfrage. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:31` – ein `sent` je Anfrage und Firma. In Ordnung.
- `supabase/migrations/20261107100000_0023_partners.sql:46` – ein Konto, eine Firma. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:54-60` – `authed`: Tokenform, aal2 als Vorgabe. In Ordnung.
- `supabase/functions/_shared/cancel/handlers.ts:39, 47, 74-82` – Kunde ohne aal2, Betragsprüfung, Nachfrage nur bei `invalid_transition` und nie in der Vorschau, Antwort mit dem eigenen Betrag. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:44, 50-63, 88-97` – aal2, Eingabeprüfung, Nachfrage nur bei `not_found`, Vorschau kehrt vorher zurück. In Ordnung.
- `supabase/functions/_shared/cancel/db.ts:11-15, 52-57` – Parameter in der Reihenfolge der Signatur, null wird durchgereicht. In Ordnung.
- `supabase/functions/_shared/change/handlers.ts:107, 121-136` – leeres `changes` zulässig, gespeichert werden die Parser-Eingaben, Nachfrage nur bei `change_open`. Grundlage für N2.
- `supabase/functions/_shared/change/db.ts:10-14` – Aufruf mit fünf Parametern. In Ordnung.
- `tests/support/owner.ts:92-115` – jeder Schritt im eigenen Block, am Ende Rollback. In Ordnung.
- `tests/rls/replay.test.ts:78-137, 139-173` – Messung und 30 Proben der Funktion; Erwartung in Zeile 146 nicht erreichbar (M2).
- `tests/rls/replay-concurrency.test.ts:62-105` – drei Wettläufe, je ein Erfolg, eine Gebührenzeile, Nachfrage nur für den Gewinner. In Ordnung (gelesen, nicht abgenommen).
- `tests/rls/journal.test.ts:246-248, 259, 262` – zweite Zeile bei lebender erster: `amount_mismatch`; nach Gegenbuchung: „ok“. Grundlage für M1.
- `tests/rls/change-orders.test.ts:89-100, 113-114, 133-138` – elf Proben der Nachtrags-Funktion samt Rechten und Ablauf. In Ordnung.
- `tests/rls/offers.test.ts:82-87, 112-116` – Wiederholung: gleiche Id, eine Zeile, eine Mail; anderer Betrag bleibt `offer_exists`. In Ordnung.
- `tests/support/positiv.ts:231-238` – zwei Registereinträge, `service_role`, genau „s“. In Ordnung.
- `tmp/proof/n12b/001-tests_rls_replay.test.ts.log:20` – Lauf 001 rot am Aufbau (`partner_job_limit`), kein Beleg.
- `tmp/proof/n12b/002-tests_rls_replay.test.ts.log:1-2, 20, 35, 49` – Commit f83f15b, Arbeitsbaum nicht sauber, `amount_mismatch` an Zeile 146, `EXIT=1`. Grundlage für M2.
- `tmp/proof/n12b/003-tests_rls_change-orders.test.ts.log:29, 34` – 42883 am ersten Aufruf: zeigt nur, dass die Funktion fehlt.
- `tmp/proof/n12b/004-tests_rls_offers.test.ts.log:36-44` – 42501 auf `partner_offers`. Grundlage für N4.
- `tmp/proof/n12b/runs.jsonl:1-4` – vier rote rls-Läufe vor dem Push. In Ordnung.
- `docs/OFFEN.md:84` – n12-2 im Wortlaut: messen, bei zwei Zeilen anhalten. Die Messung steht in `replay.test.ts:80-93, 139-150`.
- `scripts/sys/gate-db-lib.mjs:37, 42, 53-61` – Form der Urteilszeile; ein „gesperrt“ bleibt für denselben Hash bestehen.

Offene Findings hoch: 0
