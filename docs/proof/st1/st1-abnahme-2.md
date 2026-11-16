Modell: claude-fable-5-2

# Abnahme Schritt st1 (R3), Kontrollrunde: Migration 0065, Pauschale erst ab Termin (Nr. 148), Kontakt und Fotos nach Storno ohne Pauschale gesperrt (Nr. 154), Sätze in geld.md (Nr. 149, 150)

Datum: 2026-11-16
Stand laut Logs: Commit 566cf87 (Branch st1), Arbeitsbaum nicht sauber (Schritt noch nicht committet)
Umfang: Geld, Sicherheit, Schema. Die Optik ist hier nicht geprüft.
Vorgänger: `tmp/proof/st1-abnahme.md` (hoch 1: H1; mittel M1, M2; niedrig N1 bis N4). Diese Fassung ersetzt sie nicht, sie prüft die Behebung und den erweiterten Dateiumfang (elf Dateien statt acht).
Grundlagen: `tmp/proof/st1-abnahme.md`, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`, `docs/ENTSCHEIDUNGEN.md:154-156, 160`, `docs/OFFEN.md:39`, `tmp/proof/st1/runs.jsonl`, `tmp/proof/st1/loesch-lauf.jsonl`, die Logs 015 bis 021.

SHA256: 1b39103d8fbd42eed06f690192dd7b76174e281a09b7f18d4f81e7283fddfa07 supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql
SHA256: d22ba05c2d56a2a067924ccd242876a05983a34c7d6176e0331492514fb55dd4 tests/rls/job-contact-after-cancel.test.ts
SHA256: 0e4bffa0023c7d01195d16f2db8aa043ad7a3a2719d3086ab25f228df6bd695d tests/rls/cancellation-partner-preview.test.ts
SHA256: 0478086e823fe5172932a1c09adb4e889ff7a93ca7380796bd64ae6fc36c1644 tests/rls/cancellation-partner.test.ts
SHA256: e088e6f68746ddb5732d3da70f493fff854df5eac1a3a87a51d24f7db23fbcec tests/rls/flow-live.test.ts
SHA256: e57d744daea434f4fc73286b88cd3475eac6cbf29661c68c0756b0c4b55f1b03 tests/rls/partner-functions-live.test.ts
SHA256: bdab869b3a862c7d88a2fb2895a80dee7ed8aa2927416b41a303f98cc36c0cd0 tests/rls/journal-live.test.ts
SHA256: 05b49e929e702e65f254f3d099f7504cee48616b6aa11c526d7a50b38bbd9f74 src/lib/partnerJobs.ts
SHA256: f0d9a5583de44300c8086df35450baf5cd9edaccea323d45999518f791779741 .claude/rules/geld.md
SHA256: 28688ef1dacbdf37c10e1f2d5159596052450834db815eb7bfcbb25bddc91e27 tests/unit/partner-cancel.test.ts
SHA256: b7487cc64524242c1daaf789cef0ce469e56af5710cf13ac925073597ab42c06 tests/e2e/partner-absage.spec.ts

Ergebnis: abgenommen, unter der Bedingung der Volläufe. H1, M1 und M2 sind behoben. Kein hohes und kein mittleres Finding offen. Neu sind drei niedrige Punkte (N5 bis N7), keiner hält den Schritt auf. Die Abnahme gilt für genau die elf Dateien mit den Hashes oben; die Volläufe check, e2e und rls auf dem committeten Endstand stehen noch aus und sind der eigentliche Nachweis. Ändert sich vor dem Commit eine der Dateien, braucht es eine neue Abnahme.

## Grenzen der Prüfung

- Die Hashes sind aus dem Auftrag abgeschrieben. Ich kann SHA-256 nicht berechnen und habe keinen Zugriff auf `git`. Den Abgleich macht das Gate. Sechs Hashes sind gleich wie in der ersten Abnahme (Migration, job-contact-after-cancel, partnerJobs, geld.md, Unit, E2E), zwei haben sich geändert (cancellation-partner-preview, cancellation-partner), drei sind neu (flow-live, partner-functions-live, journal-live). Das passt zur Angabe, welche Dateien seit Runde 1 geändert wurden; mehr belegt es nicht.
- Kein Diff möglich. „Seit Runde 1 nur das Genannte geändert“ habe ich durch vollständiges Lesen des Endstands ersetzt: die fünf geänderten oder neuen Testdateien, die Migration, job-contact-after-cancel und die Unit-Datei ganz, `partnerJobs.ts` in den Zeilen 240-309, `partner-absage.spec.ts` in den Zeilen 1-95.
- N4 (geld.md): Die Aussage „`git diff` zeigt genau zwei Änderungen“ stammt aus dem Auftrag, ich habe sie nicht selbst gesehen. Geprüft ist der Endstand der Datei (Zeilen 15 und 16 gegen Nr. 148, 149, 150).
- Alle Läufe liefen mit unsauberem Baum und ohne Fingerabdruck der Testdatei (`abdruck: null`). Welche Fassung in den grünen Läufen 15, 16, 17, 20 und 21 lief, ist nicht bewiesen. Gestützt ist es nur für partner-functions-live: die Zeilenangaben der roten Läufe 018 und 019 (123, 129, 135, 147, 164, 180, 188, 197, 204, 214) treffen genau den Endstand, Lauf 021 folgte vier Minuten später.
- Logs habe ich nach Kopf, Testliste, Fehlern und Exit-Code durchsucht; im Wortlaut gelesen sind 018, 020, 021 und der Kopf von 019.
- Die neue Live-Probe J5 hat keinen roten Lauf vor dem Push (die Migration war schon angewendet). Verlangt ist er nur für neue Dateien; dass sie ohne 0065 scheitern würde, folgt aus dem Lesen (Vorschau wäre 6.900, der Aufruf 200) und aus den roten Läufen 002, 003, 005, 006 der Rollback-Proben.
- Die Suche nach weiteren betroffenen Tests lief über `tests/rls`, `tests/unit`, `tests/e2e`, `tests/shots`, `tests/support` und `scripts` mit den im Auftrag genannten Begriffen, dazu nach den Aufrufen von `job_contact` und `job_photo_list`. Treffer habe ich an der Stelle gelesen, nicht jede Datei ganz.
- Nicht erneut nachgeschlagen (unveränderter Hash, Ergebnis aus Runde 1 übernommen): 0060:7-18, 0062:335-343 und 893-940, 0064:153-166, 0030:87-98, `Auftraege.tsx`.

## Findings

### hoch

Keine.

### mittel

Keine.

### niedrig

- N5 `tmp/proof/st1/018-tests_rls_partner-functions-live.test.ts.log:4, 16, 286-287` mit `tmp/proof/st1/runs.jsonl:19-20` und `tmp/proof/st1/loesch-lauf.jsonl:7-10` – Der Auftrag nennt einen roten Lauf „nach einem abgebrochenen Vorlauf“. Die Dateien zeigen etwas anderes: Log 018 ist vollständig (Start 00:06:15, 12 Tests, 10 rot, 132,8 s, EXIT=1), hat aber keine Zeile in `runs.jsonl` (auf Nr. 17 folgt Nr. 19). Lauf 19 begann 00:07:17, also während 018 noch lief. Es gab damit zwei rote Läufe, und sie liefen gleichzeitig gegen Dev. Die Ursache der 401 ist daraus erklärbar und kein Produktfehler: Das Aufräumen jedes Laufs löscht alle Testkonten mit der Marker-Adresse, nicht nur die eigenen (`tests/support/sweep.ts:83-86`); das Aufräumen von 019 (00:07:53) nahm 018 die Konten, das Schlussaufräumen von 018 (00:08:26) nahm sie 019. Die Zeiten passen auf die ersten 401 in beiden Logs, die jeweils ersten zwei Tests waren grün. „Durchgehend 401“ stimmt also nur ab diesem Punkt. Beide Läufe endeten mit einer aktiven Testfirma als Rest, der nächste Lauf hat sie entfernt (`loesch-lauf.jsonl:11-14`, Endzahlen 0). Warum die Zeile für 018 fehlt, lässt sich aus den Dateien nicht ableiten: Das Start-Programm schreibt erst den Schluss des Logs, dann die Zeile (`scripts/sys/run.mjs:85-94`). Verstoß gegen `tests.md` (Läufe gegen Supabase sequenziell), ohne bleibenden Schaden. – Fix: nichts an `runs.jsonl` oder den Logs ändern. Im Bericht beide roten Läufe und die fehlende Zeile so benennen. Nie zwei Live-Dateien gleichzeitig starten; nach einem Abbruch erst prüfen, ob der Lauf noch läuft. Meldet `npm run bericht` oder `npm run fertig` das Log ohne Zeile: anhalten, Beks berichten.
- N6 `tests/rls/partner-functions-live.test.ts:162-171` mit `:90-93` – Die Probe J5 prüft nicht selbst, dass J5 einen abgelehnten Nachtrag hat. Vorschau 0 und 409 kämen auch heraus, wenn der Nachtrag fehlte; dann wäre die Probe aus dem falschen Grund grün. Heute ist das nicht der Fall: Die Vorbereitung ist eine Transaktion, ein gescheitertes `propose_change` oder `decide_change` bricht sie ab, und J4 mit wortgleicher Vorbereitung liefert 6.900. Es fehlt nur der Schutz gegen eine spätere Änderung der Vorbereitung. – Fix: bei der nächsten Berührung der Datei eine Erwartung ergänzen (genau eine Revision mit Quelle Nachtrag und Status abgelehnt für J5). Nicht in diesem Schritt, sonst ändert sich der Hash.
- N7 `tests/rls/cancellation-partner-preview.test.ts:132, 138, 163, 168` und `tests/rls/cancellation-partner.test.ts:86, 96, 158, 168` – Vier ältere Gegenproben sind seit 0065 doppelt gesperrt und beweisen ihre ursprüngliche Regel nicht mehr allein: „anderer Grund“ auf E1 und R4 (Zeit und Grund, bei R4 dazu ein angenommener Nachtrag) und „Basis ohne Nachtrag“ auf R1 (Zeit und fehlender Nachtrag). Für R1 gibt es die saubere Gegenprobe jetzt auf E0 (`cancellation-partner-preview.test.ts:125, 157`). Für einen anderen Grund als NULL gibt es keine: Ab Terminbeginn weist schon die Grundprüfung jeden anderen Grund ab (0059:28), über die öffentlichen Funktionen ist der Fall nicht erreichbar. Die Bedingung in 0065:13 ist damit nur noch zweite Sicherung; ihr Wegfall fiele über die NULL-Probe auf E2 auf (`:149, 177`). Geld ist nicht berührt. – Fix: bei der nächsten Berührung einen Eigentümer-Schritt ergänzen, der die Berechtigung für E2 mit Grund `unavailable` abfragt und `false` erwartet; die Titel der vier Proben können bleiben.

### Stand der Findings aus Runde 1

- H1: behoben (Prüffrage 1).
- M1: behoben (Prüffrage 2).
- M2: behoben. `tests/rls/flow-live.test.ts` ist jetzt mit Hash im Umfang, W4 erwartet `not_assigned` (`:337, 353-356`), Lauf 15 ist grün mit 19 von 19 (`runs.jsonl:17`, `015-…log:13, 28, 40, 49`). Ich habe die Datei diesmal ganz gelesen: Alle Geld-Erwartungen sind genaue Werte (`:24-27`, gegengerechnet in `:94-98, 153-161`), W3 mit begonnenem Termin erwartet die Pauschale und offenen Kontakt (`:316-332`), W2a und W2b erwarten die Sperre (`:276, 296`), der Kunde liest keine Gebühr (`:480-493`). Keine abgeschwächte Erwartung gefunden.
- N1, N2: bleiben Hinweise für den Bericht (kein Code). Zu ergänzen: Auch die Läufe 16 und 17 sind Anpassungen an schon angewendeter Migration, kein Rot-Beweis.
- N3: steht in `docs/OFFEN.md:39` (st1-1), Inhalt und Fix wie in Runde 1 beschrieben. Erledigt als Rest.
- N4: laut Auftrag zeigt der Diff genau die zwei Änderungen (Zeile 15 ersetzt, Zeile 16 neu). Der Endstand passt dazu und zu Nr. 148, 149, 150. Nicht selbst gesehen (Grenzen). Der Diff gehört in den Bericht.

## Prüffragen

### 1. Ist H1 behoben? Stimmen die übrigen Erwartungen zu J4, und misst J5 die Wirkung von Nr. 148 über die Function?

Ja.

partner-functions-live:
- J4 hat den Termin vor 2 Stunden, alle anderen Aufträge in 14 Tagen (`:74-75, 85`). J4 und J5 haben wortgleich Beleg, Nachtrag und Ablehnung (`:86-97`); sie unterscheiden sich nur im Termin.
- Erwartungen zu J4 (`:144-161`) gegen 0062 gelesen: Vorschau 6.900 und Auszahlung nach `splitFee` (Grundlage 0062:766, Function `cancel/partner.ts:62-64`); echter Aufruf 200 mit 6.900; genau eine Zeile `cancellation_fee` mit Gebühr, Netto, USt. und Auszahlung wie `splitFee` (0062:804-807); keine Folgeanfrage (0062:813, nur bei Basis 0); Mail `partner_cancelled_fee` (0062:820-821); der Kunde liest über `my_cancel_info` nur 6.900, ein fremder Kunde bekommt einen Fehler. Der Grund `scope_impossible` bleibt ab Terminbeginn erlaubt (0059:28). Alle Erwartungen stimmen mit begonnenem Termin.
- J5 (`:162-171`): Vorschau 200 mit 0 und 0; Aufruf mit einem echten Beleg und gezeigten 6.900 ergibt 409 `amount_changed`; Status, Journal, Outbox, Audit, Revisionen und Folgeanfragen sind danach gleich wie davor, Status `accepted`. Der Weg geht über die deployte Function: Sie holt die Grundlage, bekommt 0, vergleicht mit dem gezeigten Betrag und bricht vor dem Schreiben ab (`cancel/partner.ts:68-70`). Gemessen ist damit genau die Wirkung der neuen Zeitbedingung (0065:14), denn J4 mit sonst gleicher Lage liefert 6.900. Einschränkung: N6.
- Nicht über die Function gemessen ist die zweite Sperre in der Datenbank (`call_out_not_allowed` aus `partner_cancel_fee`, 0059:40), weil die Function vorher abbricht. Sie ist als Rollback-Probe belegt (`cancellation-partner-preview.test.ts:128, 159-160`; `job-contact-after-cancel.test.ts:95, 134`).
- Lauf 21: 12 von 12, darunter „Geldpfad“ und „Nr. 148“ (`021-…log:13, 20-21, 30, 38`).

journal-live:
- J4 mit Termin vor 2 Stunden und abgelehntem Nachtrag (`:80-81, 98`), J1 und J2 in 14 Tagen. Die Absage mit Belegen und 6.900 steht in der Vorbereitung und erwartet 200 (`:103-104`).
- Übrige Erwartungen: Zeile `cancellation_fee` 6.900 / 828 / 690 / 138 / 6.072 und Summe des Auftrags gleich dieser Zeile (`:170-176`); Datei-Summen 0, 0, 6.900 (`:196`); J1 und J2 Summe 0 (`:158-168`); mindestens 6 Zeilen (`:144`, es sind 9). Der Abrechnungsmonat hängt am Ende des Auftrags und am Buchungszeitpunkt, nicht am Termin (0062:986-990); der Termin in der Vergangenheit bringt also keine neue Monatsgrenzen-Falle.
- Lauf 20: 8 von 8, kein Test übersprungen (`020-…log:13, 20, 28`).

### 2. Ist M1 behoben?

Ja. In `cancellation-partner-preview.test.ts` haben E0, E2, E3, E4, E5, E6, E7 den Termin begonnen (`:80-85`), nur E1 liegt in 5 Tagen. Jede Gegenprobe zur Nachtragsregel ist damit nur noch durch die Nachtragsbedingung (0065:15-17) gesperrt:
- E0 kein Nachtrag: 0 (`:125, 157`).
- E3 angenommen: 0 (`:134, 165`).
- E4 abgelehnt, dann angenommen: 0, echter Aufruf `call_out_not_allowed`, Zustand unverändert (`:135-139, 166-169`). Das ist die Probe für die Reihenfolge nach `n`.
- E6 abgelehnt, dann offen: 0, echter Aufruf `call_out_not_allowed` (`:92, 98-99, 110, 115-116`).
- V4 offen: 0, nach Ablauf 6.900 (`:191-193, 207-209`).
- Positiv: E2 abgelaufen 6.900, E5 angenommen dann abgelehnt 6.900 mit echter Buchung, E7 abgelehnt und zurückgezogen 6.900 (`:109-114, 164`).
- NULL-Proben auf E2, wo Zeit und Nachtrag erfüllt sind: Berechtigung `false`, Pauschale `call_out_not_allowed` (`:149-150, 177-178`). Es sperrt nur der Grund.
- Zeit-Kontrolle E1: Vorschau 0, echter Aufruf `call_out_not_allowed`, Berechtigung `false`; daneben E2 `true` (`:127-131, 158-162`); Grenze V2 und V3 eine Minute vor und nach dem Termin (`:189-190, 205-206`).

In `cancellation-partner.test.ts` hat S2 den Termin begonnen und einen Beleg, aber keinen Nachtrag: `call_out_not_allowed` (`:232, 237, 275`). Die Belegproben auf S1 und S5 (fremde, falsche, doppelte Belege, falscher Betrag) laufen bei erfüllter Berechtigung und treffen damit wirklich die Belegprüfung (`:238-242, 276-280`).

Läufe 16 und 17: je 3 von 3, EXIT=0 (`runs.jsonl:18-19`).

### 3. Werden durch die Terminänderungen Gegenproben aus dem falschen Grund grün?

Nein, soweit ich es prüfen konnte. Die Gefahr bei begonnenem Termin ist die Zeitgrenze der Gründe (`too_late_for_reason`, 0059:28): Sie könnte eine Sperrprobe grün machen, bevor die eigentliche Regel greift. Ich bin jede Sperrprobe auf einem Auftrag mit begonnenem Termin durchgegangen:
- Alle Vorschau-Proben nutzen `scope_impossible` und erwarten den Wert 0, keinen Fehler (`val`, nicht `err`). Ein Abbruch durch die Zeitgrenze fiele als Fehler auf.
- Alle echten Aufrufe erwarten den genauen Code (`call_out_not_allowed`, `receipt_required`, `amount_mismatch`), nicht nur „Fehler“.
- „Grund fehlt“ auf E6 erwartet `reason_required`; die Grundprüfung kommt vor der Zeitgrenze (0059:27 vor 28).
- Die NULL-Pauschale auf E2 ruft die private Funktion direkt, ohne Grundprüfung (`:150`).
- Die Zahl der offenen Aufträge je Firma bleibt in jedem Ansatz bei höchstens 5 (Vorschau: 5 und 5 und 5 und 3; cancellation-partner zweiter Test: 5 für Firma a; Live: J1 bis J5). Kein Test stößt an die Grenze, aber die Live-Datei hat keinen Platz mehr für einen sechsten Auftrag.

Reste: N6 (J5 prüft seine Vorbedingung nicht) und N7 (vier ältere Proben doppelt gesperrt). In den Live-Dateien sind die Proben „ohne Nachtrag keine Pauschale“ auf J1 (`partner-functions-live.test.ts:121-131`) ebenfalls doppelt gesperrt (14 Tage und kein Nachtrag); die Regel ist als Rollback-Probe einzeln belegt (E0), das reicht.

### 4. Erwarten weitere Testdateien eine Pauschale vor dem Termin?

Nein. Gefunden und an der Stelle gelesen:
- `tests/rls/admin-correct.test.ts:118, 162, 203`: Pauschale über den admin-Weg. Der nutzt `call_out_base` direkt (0062:847, 916), nicht die Berechtigung aus 0065. Nicht betroffen.
- `tests/rls/cancellation.test.ts`, `tests/rls/journal.test.ts`: Stornogebühr des Kunden und Journal-Trigger. Nicht betroffen.
- `tests/support/positiv.ts:293-300`: Grund `other`, Basis 0. Nicht betroffen.
- `tests/rls/rls.test.ts:499`: nur Signaturen und Rechte.
- `tests/rls/partner-my-jobs.test.ts`, `report-flow.test.ts`, `settings.test.ts`, `quote*.test.ts`, `fee-schedule.test.ts`, `uploads.test.ts`: nur die Bedingungen im Snapshot oder Rechenvektoren.
- `tests/unit` (cancel-partner-handler, partner-cancel, admin-correct-*, journal-csv, fee-staffel): Fakes, keine Datenbank; der Handler ist unverändert und nimmt die Pauschale aus der Grundlage.
- `tests/e2e` und `tests/shots`: gemockt. Der Mock gibt die Pauschale ohne Zeitbezug (N3, steht in OFFEN).
- `scripts`: kein Treffer.
- Aufrufe der Function `cancel-partner` und von `cancel_by_partner` gibt es außerhalb der geprüften Dateien nur in `positiv.ts` (Basis 0).

Zusätzlich für Nr. 154 gesucht (Kontakt oder Fotos nach einem Storno ohne Pauschale erwartet): `tests/rls/listings.test.ts:375-378`, `job-photos.test.ts:223, 347, 379`, `partner-my-jobs.test.ts:58`, `account-deletion.test.ts:46, 105, 145` enden alle mit `completed` oder laufen noch. `partner-my-jobs.test.ts:117-118` prüft `my_jobs` nach Kundenstorno; `my_jobs` ist von 0065 nicht berührt. Kein weiterer Kandidat für einen roten rls-Volllauf gefunden.

### Weitere Prüfung

- Geld: Die Tests rechnen die Pauschale mit `splitFee` oder mit festen Werten, die gegen `splitFee` geprüft werden (`flow-live.test.ts:94-98`). Kein Test erwartet eine Buchung, deren Betrag vom gezeigten abweicht. Keine neue Sicht des Kunden auf die Gebühr.
- Sicherheit: 401 in den Läufen 018 und 019 heißt verweigert, nicht offen. Kein Secret in den geprüften Dateien, kein neuer Seed, keine Policy.
- Schema: unverändert gegenüber Runde 1 (gleicher Hash der Migration, erneut gelesen: 0065:10-18, 21-31, 46, 81).
- geld.md: Zeile 15 nennt Absage-Maske und Journal-CSV als Anzeigeorte nur für die Firma (Nr. 149), Zeile 16 die einzige Journalzahl für Kunden und den Satz zum Terminbeginn (Nr. 150, Nr. 148). Kein Widerspruch zu Zeile 13 und 19.

Hinweise ohne Finding:
- Der admin-Weg (`admin_correct`, Aktion `cancel_partner`) kennt die Zeitbedingung aus Nr. 148 nicht (0062:916). Nr. 148 spricht von der Firma; ob eine Pauschale durch admin vor dem Termin möglich und gewollt ist, habe ich nicht geprüft (vor dem Termin ohne Meldung verweigert admin-correct ohnehin, `admin-correct.test.ts:151-153`). Bei Bedarf als Frage an Beks.
- `tests/rls/flow-live.test.ts:303` nennt im Titel noch 5.865 als Auszahlung; erwartet und geprüft werden 6.072 (`:25, 316`). `tests/e2e/partner-absage.spec.ts:11` und der Mock rechnen mit 15 %. Beides alt, nur Anzeige und Beschriftung.

## Stichproben (selbst nachgeschlagen)

- `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:10-18` – Zeitbedingung Zeile 14, Nachtragsbedingung 15-17. In Ordnung.
- `…0065…sql:21-31, 46, 81` – Zugriff, Entzug, zwei Aufrufstellen. In Ordnung.
- `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:26-28` – Reihenfolge Meldung, Grund, Zeitgrenze. In Ordnung.
- `…0059…sql:39-47` – Berechtigung vor Belegen. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:761-769` – Grundlage, Pauschale nur bei Berechtigung. In Ordnung.
- `…0062…sql:789-824` – Storno der Firma: Abgleich, Gebührenzeile, Folgeanfrage nur bei Basis 0, Mailart. In Ordnung.
- `…0062…sql:847, 916` – admin-Weg nutzt `call_out_base` direkt. Siehe Hinweis.
- `…0062…sql:976-994` – Abrechnungsmonat unabhängig vom Termin. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:48-55, 62-73, 84-90` – Eingabeprüfung, Vorschau, Abgleich vor dem Schreiben, 409. In Ordnung.
- `tests/rls/partner-functions-live.test.ts:74-75, 84-97` – Termine und Vorbereitung J4, J5. In Ordnung.
- `tests/rls/partner-functions-live.test.ts:144-161` – Erwartungen J4. In Ordnung.
- `tests/rls/partner-functions-live.test.ts:162-171` – Probe J5. In Ordnung, siehe N6.
- `tests/rls/partner-functions-live.test.ts:121-143` – J1, J2 vor dem Termin. In Ordnung.
- `tests/rls/journal-live.test.ts:80-81, 97-104` – J4 begonnen, Absage in der Vorbereitung. In Ordnung.
- `tests/rls/journal-live.test.ts:142-147, 158-176, 186-197` – Summen und Datei. In Ordnung.
- `tests/rls/cancellation-partner-preview.test.ts:28-30, 78-86` – Termine der Fälle. In Ordnung.
- `tests/rls/cancellation-partner-preview.test.ts:87-121` – E5, E6, E7, B1, B2. In Ordnung.
- `tests/rls/cancellation-partner-preview.test.ts:123-180` – E0 bis E4, NULL-Proben, Rechte. In Ordnung, siehe N7.
- `tests/rls/cancellation-partner-preview.test.ts:183-217` – Grenze V2, V3, V4, V5. In Ordnung.
- `tests/rls/cancellation-partner-preview.test.ts:219-254` – `my_cancel_info`, Ergebnistyp eine Zahl, Journal für den Kunden leer, nach Gegenbuchung 0. In Ordnung.
- `tests/rls/cancellation-partner.test.ts:228-308` – S1, S2, S5 begonnen, genaue Codes. In Ordnung.
- `tests/rls/cancellation-partner.test.ts:86, 96, 158, 168` – R1, R4 doppelt gesperrt. Siehe N7.
- `tests/rls/cancellation-partner.test.ts:310-342` – Zeitgrenze der Gründe. In Ordnung.
- `tests/rls/flow-live.test.ts:24-27, 94-98, 126-129` – Konstanten, Gegenrechnung, Termine. In Ordnung.
- `tests/rls/flow-live.test.ts:261-358` – W2a, W2b, W3, W4. In Ordnung.
- `tests/rls/flow-live.test.ts:432-512` – Summen, Rechte, Gebühr unsichtbar, payment_hold. In Ordnung.
- `tests/rls/job-contact-after-cancel.test.ts:89-99, 131-161, 164-198` – Kontrolle E1, Sperren, Kundenstorno. In Ordnung.
- `tests/unit/partner-cancel.test.ts:84-94` – `contactLocked`, sieben Fälle. In Ordnung.
- `src/lib/partnerJobs.ts:247, 269-270, 304-306` – Betrag aus `my_jobs`, Sperre nur bei Storno und Betrag 0. In Ordnung.
- `tests/e2e/partner-absage.spec.ts:54-60, 62-91` – Kundenstorno ohne Pauschale; Pauschalen-Fall mit Standardauftrag. In Ordnung, N3 in OFFEN.
- `tests/e2e/jobs-helpers.ts:324-339` – Mock ohne Zeitbezug. Bekannt (N3).
- `tests/rls/admin-correct.test.ts:118, 151-153, 162-166` – admin-Weg. Nicht betroffen.
- `tests/rls/account-deletion.test.ts:46, 105, 145` – Kontakt nach Abschluss, nicht nach Storno. Nicht betroffen.
- `tests/rls/listings.test.ts:359-394` – Fenster nach `completed`. Nicht betroffen.
- `tests/rls/job-photos.test.ts:223, 346-347, 378-379` – Enden mit `completed`. Nicht betroffen.
- `tests/support/positiv.ts:92-103, 293-300` – Registerzeilen ohne Pauschale. Nicht betroffen.
- `tests/support/sweep.ts:54, 83-86` – Aufräumen löscht alle Testkonten, nicht nur die des Laufs. Siehe N5.
- `tests/support/db.ts:30-46`, `tests/support/totp.ts:25-51` – Konten je Lauf, Löschen nur der eigenen. In Ordnung.
- `scripts/sys/run.mjs:52-64, 85-94` – Lognummer, Schluss des Logs vor der Zeile in `runs.jsonl`. Siehe N5.
- `tmp/proof/st1/runs.jsonl:17-22` – Läufe 15, 16, 17, 20, 21 mit Exit 0; 19 mit Exit 1; Nr. 18 fehlt. Siehe N5.
- `tmp/proof/st1/015-…log:13-40, 49` – 19 von 19, EXIT=0. In Ordnung.
- `tmp/proof/st1/016-…log:13-20, 29`, `017-…log:13-20, 28` – je 3 von 3, EXIT=0. In Ordnung.
- `tmp/proof/st1/018-…log:1-30, 278-287` – vollständiger roter Lauf ohne Zeile in `runs.jsonl`. Siehe N5.
- `tmp/proof/st1/019-…log:1-30` – 10 rot, alle 401 nach zwei grünen Tests. Siehe N5.
- `tmp/proof/st1/020-…log:13-28` – 8 von 8, EXIT=0. In Ordnung.
- `tmp/proof/st1/021-…log:13-38` – 12 von 12, EXIT=0. In Ordnung.
- `tmp/proof/st1/loesch-lauf.jsonl:4-14` – Aufräumen je Lauf; 18 und 19 verschränkt mit Rest 1, danach 0. Siehe N5.
- `docs/OFFEN.md:39` – st1-1 mit N3. In Ordnung.
- `docs/ENTSCHEIDUNGEN.md:154-156, 160` – Nr. 148, 149, 150, 154 im Wortlaut. In Ordnung.
- `.claude/rules/geld.md:13, 15, 16, 19` – Endstand der Sätze. In Ordnung, Diff nicht selbst gesehen.

Offene Findings hoch: 0
