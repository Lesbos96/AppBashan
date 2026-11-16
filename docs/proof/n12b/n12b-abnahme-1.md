Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme Schritt n12b, Runde 1

- Datum: 2026-11-16
- Stufe: R3 (Migration 0068, 14 Edge Functions, Positivzeilen-Register, Lösch-Register)
- Umfang: Wiederholung nach Erfolg für Storno (Kunde, Firma) und Nachtrag über die Handler, Tokenform in `authed` und `handleJobPhoto`, Abbildung von 40P01 in `must`, Wiederholung in `accountDb.remove`, Meldung von `AuthServiceError`, Typen der zwei neuen Funktionen, zwei Registereinträge, neuer Hash von `tests/support/positiv.ts` im Lösch-Register
- Vollständig gelesen: die zwölf Pflichtdateien außer der Typdatei (`account/db.ts`, `auth.ts`, `cancel/db.ts`, `cancel/handlers.ts`, `cancel/partner.ts`, `change/db.ts`, `change/handlers.ts`, `jobs/db.ts`, `jobs/handlers.ts`, `photo/handlers.ts`, `tests/support/positiv.ts`, `scripts/sys/loesch-register.json`), dazu `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql`, `tmp/n12b-gate-diff.diff`, `tmp/n12b-funktionsdiff.diff`, `tmp/proof/n12b-plan.md`, `tmp/proof/n12b/db-freigabe-1.md`, `tmp/proof/n12b/runs.jsonl`, `tmp/proof/n12b/deploy.log`, `supabase/functions/_shared/account/handlers.ts`, `supabase/functions/_shared/photo/db.ts`, `supabase/functions/cancel-partner/index.ts`, `tests/unit/cancel-handler.test.ts`, `cancel-partner-handler.test.ts`, `delete-account-handler.test.ts`, `db-must.test.ts`, `auth-token.test.ts`, `tests/rls/replay.test.ts`, `storno-wettlauf.test.ts`, `auth-token-codes.test.ts`, `docs/STAND.md`, `.claude/rules/geld.md`, `daten.md`, `tests.md`, `scripts/scan-proof.mjs`
- In Auszügen gelesen: `supabase/functions/_shared/database.types.ts` (1675-1714, 2000-2049, dazu die Einträge `partner_accept_replay`, `send_offer`, `my_report_info`), `0062` (655-834), `0064` (170-204), `0041` (1-52), `0058` (50-71), `0065` (55-94), `0035` (300-327), `_shared/admin/correct.ts` (44-96), `_shared/quote/db.ts` (1-45), `_shared/quote/handler.ts` (208-219, 249-264), `tests/unit/change-handlers.test.ts` (1-110), `tests/rls/change-orders.test.ts` (36-140), `flow-live.test.ts` (336-365), `partner-functions-live.test.ts` (96-155), `scripts/sys/fertig.mjs` (66-81), `docs/OFFEN.md` (80-87), `docs/ENTSCHEIDUNGEN.md` (194-196); Logs 012 bis 020 und 024 bis 031 nur an FAIL, AssertionError, Commit-Kopf und EXIT

Grenzen dieser Prüfung
- Kein Werkzeug zum Hashen und keines für `git`. Die dreizehn Hashes unten sind aus dem Auftrag abgeschrieben. Ob ein Hash nicht stimmt, kann ich nicht melden; den Abgleich mit dem Endstand macht das Gate. Einziger mittelbarer Abgleich: `scripts/sys/loesch-register.json:30` trägt für `positiv.ts` denselben Wert wie der Auftrag.
- Ich habe nichts ausgeführt. Aussagen zum Verhalten der Datenbank stammen aus den Migrationen und den Läufen in `tmp/proof/n12b/`.
- Meine Planprüfung liegt mir nicht als Datei vor (unter `tmp/proof/` gibt es nur den Plan). Geprüft habe ich gegen den Plan und gegen die im Auftrag genannten Abweichungen (a) bis (e).
- `tmp/n12b-gate-diff.diff` enthält die Typdatei nicht. „Nur die zwei neuen Funktionen“ ist dort nur mittelbar belegt (Prüffrage 9).
- Welcher Quelltext deployt ist, sehe ich nicht. Belegt ist: `deploy.log` nennt Commit d1021e7, die Läufe 029 bis 031 liefen auf d1021e7 mit sauberem Arbeitsbaum gegen die deployten Functions.
- Aussagen zur Zeichenmenge eines Tokens (kompakte JWS-Form: drei Base64url-Teile ohne Füllzeichen, durch Punkte getrennt) und dazu, dass die Laufzeit Leerraum am Rand eines Header-Werts entfernt, stammen aus meinem Wissen über die Standards, nicht aus einer Messung in diesem Schritt. Gestützt werden sie durch die Live-Läufe 029 bis 031 mit echten Tokens.
- Nicht gelesen: `private.partner_cancel_fee`, `private.receipt_gate`, `private.reissue_request`, der Rumpf von `delete_account` (nur die Sperrzeilen 0066:17, 23), der Rest von `quote/handler.ts`, die Index-Dateien der übrigen Functions.
- Testdateien, Doku und die Migration gehören nicht zur Pflichtmenge. Ich habe sie mitgelesen, aber nicht abgenommen. Für die Migration gilt die DB-Freigabe 1.

SHA256: c92178de5f7d930ad6184f5837716cb5a99fb3cb0035528738d9a20a074bffbf supabase/functions/_shared/account/db.ts
SHA256: a7cb49bc735a417c2ae5a7477e3493debdebf942d316d86b7e7e2c39e15709c9 supabase/functions/_shared/auth.ts
SHA256: 45bf1c59a4239ffc31606e98adbea98c6d3b711b2b078c0cd1184927c32ce6d4 supabase/functions/_shared/cancel/db.ts
SHA256: 1ca822c1ae4085bc36594a215d721836932bd15d20ac472ff715b933f738c460 supabase/functions/_shared/cancel/handlers.ts
SHA256: 149e2bfcd566949486848bb691b7990ae9e236038ce080b4dd91f78b5901d1b3 supabase/functions/_shared/cancel/partner.ts
SHA256: cd2cce961e5424253ea9a4aaae8055f9d452e08969596c171534da2c13303247 supabase/functions/_shared/change/db.ts
SHA256: d23b4f7065c174b0d6105d0777d235b62818fd9f2d0c8fbbf19ecdd9d4fd0e65 supabase/functions/_shared/change/handlers.ts
SHA256: 9fa8606254eee00e30e2a20760ed3e1d20a9b933827b2b2e2e5a185bfa2b348f supabase/functions/_shared/database.types.ts
SHA256: ae1bf9be1b39aaee59fe6cfca92af46fc12c2249fd41ba1f528cc76ed0fd6d69 supabase/functions/_shared/jobs/db.ts
SHA256: 0ad8acec5c6f967d3cd153896b2ebdb7cee41f5170a2b1f7cbcd2ab67ce08696 supabase/functions/_shared/jobs/handlers.ts
SHA256: 8392b25e7d1c45dcf29b336edca69a268e61eaa951c90df0cd3f087c07b345d3 supabase/functions/_shared/photo/handlers.ts
SHA256: 679625f51b9885c50d1a80efc34683968d889ac81b6039a8c061c2efa96b6d18 tests/support/positiv.ts
SHA256: 2696619624c0e17584a81334b47d63fa96964bbde607d22cb297977b19b1c34e scripts/sys/loesch-register.json

Gelöschte Dateien der Pflichtmenge: keine (laut Auftrag).

## Ergebnis in Kürze

Kein hoher Fund. Die drei Nachfragen der Handler sind lesende Aufrufe; eine zweite Buchung, eine zweite Mail oder ein zweiter Nachtrag kann über sie nicht entstehen. Die Antwort 200 bekommt beim Storno nur die Person, die den Erfolg selbst hatte, und nur mit dem Betrag, den Audit und Journal tragen; beim Nachtrag nur ein Mitglied der Firma, die ihn gestellt hat. Der Akteur kommt an allen neuen Stellen aus dem geprüften Token. Es wird nirgends neu gerechnet, `splitFee` bleibt die einzige Rechenstelle, Kunden bekommen weiter keine Gebühr und keinen Satz. Ein echtes Token wird von der neuen Formprüfung nicht abgelehnt.

Drei mittlere Funde:
- M1 betrifft den Nachweis und eine Regel von Beks: Der Wettlauftest lief zuerst grün, wurde danach umbenannt, und der rote Lauf entstand durch eine geänderte Erwartung. Das Gate ist damit nur dem Dateinamen nach erfüllt. Das kann ich nicht freigeben; das kann nur Beks.
- M2 ist ein Rückschritt im Code: Eine Störung des Auth-Dienstes steht in den drei Foto-Functions seit diesem Schritt nur noch als `internal` im Log.
- M3: Der Auftrag nennt die Läufe 012 bis 016 als Rot-Beweise. Lauf 014 ist grün, für `change-handlers` gibt es keinen Mutationslauf.

Wer M2 im Code behebt, ändert `photo/handlers.ts` und braucht Runde 2 sowie einen neuen Deploy von `photo-receipt`, `job-photo` und `admin-photo`. M1, M3 und alle niedrigen Funde außer N1 berühren keinen Hash der Pflichtmenge.

## Findings

### hoch
Keine.

### mittel
- **M1** `tmp/proof/n12b/runs.jsonl:28-30`, `scripts/sys/fertig.mjs:75-79`, `tmp/proof/n12b/027-tests_rls_storno-wettlauf.test.ts.log:20`, `docs/STAND.md:26`, `.claude/rules/tests.md` (Rot-Beweis, Gates) – Die neue Datei lief unter dem Namen `replay-concurrency.test.ts` zuerst grün (Lauf 26, Exit 0, nach dem Push). Das Gate verlangt je neuer Datei unter `tests/rls/` einen roten Lauf vor dem ersten grünen und sucht die Läufe über den Dateinamen. Die Datei wurde in `storno-wettlauf.test.ts` umbenannt; unter dem neuen Namen gibt es Lauf 27 (rot) und Lauf 28 (grün), das Gate sieht den alten Namen nicht mehr. Lauf 27 ist rot, weil eine Erwartung auf einen anderen Wert gestellt wurde (Ist-Wert `cancelled_by_partner`, erwartet der Null-Marker): geändert wurde die Prüfung, nicht die Sperre. Nach `tests.md` zählt ein Rot-Beweis nur, wenn er die Wirkung der gelockerten Sperre misst; das tut Lauf 27 nicht. Der Lauf zeigt, dass diese eine Zeile nicht leer läuft, mehr nicht. Nichts ist verborgen: Lauf 26 steht weiter in `runs.jsonl`, `STAND.md:26` nennt den Vorgang, die Gate-Datei ist unverändert. In der Wirkung ist es trotzdem ein Weg um die Regel herum, und für diesen Fall steht in CLAUDE.md „anhalten, berichten“. In `docs/BEKS.md` steht dazu nichts (Suche ohne Treffer). In der Sache halte ich die geprüfte Eigenschaft für belegt, aber auf anderem Weg: durch die Sperre der Anfrage vor jeder Buchung (0062:719-720, 0064:188-195), durch die grünen Läufe 26 und 28 und durch den Live-Lauf 031 (`partner-functions-live.test.ts:132-146`: zwei gleichzeitige Aufrufe, eine Wirkung). Ein Rot-Beweis im Sinn von `tests.md` war für diese Datei nach dem Push nicht mehr erzeugbar (die Sperren stehen in der Datenbank). – Fix: (a) vor `npm run fertig` den Vorgang in `docs/BEKS.md` wörtlich eintragen (zuerst grün unter altem Namen, umbenannt, Lauf 27 ist eine geänderte Erwartung, das Gate ist nur über den neuen Namen erfüllt) und im Bericht an Beks an sichtbarer Stelle nennen, nicht nur als Hinweis für Sessions; ob der Nachweis zählt, entscheidet Beks vor dem Merge. (b) In der Bewertung Lauf 27 nicht als Rot-Beweis führen. (c) Künftig bei „zuerst grün“ anhalten und berichten, nicht umbenennen. Kein Hash der Pflichtmenge betroffen.
- **M2** `supabase/functions/_shared/photo/handlers.ts:18` gegen `supabase/functions/_shared/auth.ts:23` – `fail` schreibt die Meldung eines Fehlers nur dann als `code` ins Log, wenn sie ein einzelner kurzer Bezeichner aus Kleinbuchstaben und Unterstrich ist, sonst `internal`. Bis n12b war die Meldung von `AuthServiceError` genau der feste Text `auth_service_error` und kam so ins Log. Seit n12b hängt die Meldung Status und Code mit Leerzeichen und Gleichheitszeichen an; sie passt nicht mehr, und `photo-receipt`, `job-photo` und `admin-photo` loggen bei einer Störung des Auth-Dienstes nur noch `internal`. Das Ziel von N3 (Status und Code im Log) ist damit für neun Functions erreicht (sie loggen `message`, z. B. `cancel/handlers.ts:87`), für diese drei ist es schlechter als vorher: ein Ausfall von Auth ist dort von jedem anderen Fehler nicht mehr zu unterscheiden. Kein Test hält den Logeintrag fest (`tests/unit/auth-token.test.ts:141-157` prüft nur Status 500 und „kein Token im Log“), deshalb blieb `check` grün. Antwort und Rechte sind nicht betroffen (weiter 500, nie 401). Hergeleitet durch Lesen, nicht gemessen. – Fix: in `fail` vor der Formprüfung den Fall `AuthServiceError` eigens behandeln und `code: 'auth_service_error'` zusammen mit `authStatus` und dem schon geprüften `authCode` als eigene Felder loggen; eine Unit-Zeile je Foto-Handler, die den Logeintrag verlangt. Ändert `photo/handlers.ts`: Runde 2 und Deploy der drei Functions. Meine Entscheidung: nicht blockierend. Wird es nicht in diesem Schritt behoben, dann als eigener Punkt in `docs/OFFEN.md` mit diesem Fix, und Nr. 189 sowie der Bericht dürfen nicht sagen, alle Functions nennten Status und Code.
- **M3** `tmp/proof/n12b/runs.jsonl:6-16`, `tmp/proof/n12b/014-tests_unit_delete-account-handler.test.ts.log:22`, `tmp/proof/n12b/012-tests_unit_cancel-handler.test.ts.log:19-20` – Der Auftrag führt die Läufe 012 bis 016 als Rot-Beweise per Mutation. Tatsächlich: Lauf 014 (`delete-account-handler`) endet mit Exit 0, elf Tests grün; die Wiederholung in `accountDb.remove` ist also nicht rot belegt. Für `change-handlers` gibt es nur den grünen Lauf 008, keinen Mutationslauf. Lauf 012 zeigt genau einen roten Test (die Nachfrage wird auch bei anderen Fehlern gestellt); dass die Wiederholung beim Kunden 200 ergibt, ist dort nicht rot gezeigt. Aussagekräftig sind 013 (fünf Tests, 404 statt 200 und umgekehrt), 015 (zwölf Handler, Auth wird dreimal statt nie aufgerufen) und 016 (40P01 wird nicht zu `retry`). Die Reihenfolge ist grün vor rot (006 bis 011, dann 012 bis 016); einen eigenen grünen Lauf danach gibt es nicht, grün sind die Dateien wieder im `check` (Lauf 024). Das Gate verlangt für Unit-Dateien keinen roten Lauf. Nach Lesart sind die Erwartungen scharf: gegen den alten Stand ergäbe `delete-account-handler.test.ts:30-39` einen Aufruf statt zwei und den Text der Datenbank statt `retry`. – Fix: in der Bewertung je Lauf die Mutation und das echte Ergebnis nennen, 014 als „kein Rot-Beweis“. Wer den Beleg will: je ein Mutationslauf für `accountDb.remove` (Zweig für 40P01 entfernen) und für die Nachfrage in `handleProposeChange`, danach zurückstellen (Hash bleibt). Kein Hash der Pflichtmenge betroffen.

### niedrig
- **N1** `supabase/functions/_shared/auth.ts:11-12`, `supabase/functions/_shared/quote/handler.ts:34, 214`, `docs/ENTSCHEIDUNGEN.md:196` – Abweichung (a): Statt der dreiteiligen Form aus dem Plan gilt in `authed` nur die Zeichenmenge. Für die Sicherheit ist das gleich: über das Token entscheidet allein Auth, die Formprüfung spart nur einen Aufruf und verhindert den gemessenen 500 bei Leerzeichen. Ein Wert wie ein einzelnes Wort geht weiter an Auth und kommt als abgelehnt zurück (401). Es gibt jetzt zwei Formen im Code, und der Grund für die schwächere liegt in den Fake-Tokens der Unit-Tests, nicht im Produkt. – Fix: in einem späteren Schritt eine Konstante in `auth.ts` mit der dreiteiligen Form für alle, die Fakes der Unit-Tests auf dreiteilige Werte stellen (mechanisch). Ändert `auth.ts` und `jobs/handlers.ts`, deshalb nicht jetzt.
- **N2** `tmp/proof/n12b/deploy.log:4`, `supabase/functions/_shared/quote/db.ts:5, 30` – `quote` wurde nicht neu deployt mit der Begründung, es lade `jobs/handlers.ts` und `jobs/db.ts` nicht. Das stimmt, aber `quote` lädt `auth.ts`, und die ist in diesem Schritt geändert (Codeliste, Meldung). Der deployte Stand von `quote` weicht damit in einer Datei dieses Schritts vom Repo ab. Wirkung heute keine: `quote` loggt bei einer Störung den Namen des Fehlers, nicht die Meldung (`quote/handler.ts:261-262`), und den neuen Code liefert die gebündelte auth-js-Version laut Kommentar nicht. – Fix: in der Bewertung festhalten (das Deploy-Log wird nicht mehr geändert) oder `quote` mitdeployen; in `docs/STAND.md` steht „alle 14 mit `jobs/handlers.ts` oder `db.ts`“, das ist richtig, sagt aber nichts zu `auth.ts`.
- **N3** `supabase/functions/_shared/jobs/db.ts:10-13`, `supabase/functions/_shared/photo/db.ts:40-48, 55-56`, `supabase/functions/_shared/jobs/db.ts:124-125`, `supabase/functions/_shared/change/db.ts:17-18` – Zwei Nebenwirkungen der Abbildung von 40P01. Erstens: Ein Deadlock erzeugt keinen Logeintrag der Function mehr (vorher 500 mit Logzeile, jetzt 409 `retry` ohne Log); sichtbar bleibt er nur im Log der Datenbank. Zweitens: Die Abbildung gilt nur für Aufrufe über `must`. `photo_receipt_check`, `photo_publish_mark`, `outbox_mark`, `verify_price_version` und die drei Nachfragen werfen den Text der Datenbank und enden bei 40P01 weiter mit 500. Für die lesenden Nachfragen ist das ohne Belang. – Fix: bei der nächsten Änderung an `jobs/db.ts` die Abbildung in eine kleine Hilfsfunktion legen, die auch die Aufrufe ohne `must` benutzen, und im Handler bei `retry` aus 40P01 eine Logzeile ohne Einzelheiten schreiben. Nach OFFEN.
- **N4** `docs/OFFEN.md:82, 84` gegen `tmp/proof/n12b/db-freigabe-1.md:31-32`, `supabase/functions/_shared/change/handlers.ts:112-116, 133-134`, `supabase/migrations/20261112110000_0058_my_job_changes.sql:65` – Die Funde N1 (kein Index auf dem Audit, zwei Durchläufe je Nachfrage; erreichbar bei jedem `not_found` von `cancel-partner`) und N2 (Vergleich der Eingaben als Teilmenge) der DB-Freigabe stehen nicht in OFFEN (Suche nach den Funktionsnamen und nach dem Stichwort ohne Treffer). Zu N2 kommt aus dem Handler hinzu: Im üblichen Wiederholungsfall meldet schon die Grundlage `change_open`, also bevor der Handler die Schlüssel von `changes` gegen die gebuchten Eingaben prüft und bevor er rechnet. Die Nachfrage bekommt dann die rohen `changes`. Mit leerem `changes`, gleichem Betrag und gleichen Belegen kommt 200 mit der Id des offenen Nachtrags. Es ist die eigene Firma mit aal2 und laufender Zuordnung, die Id und den Betrag liest sie ohnehin über `my_job_changes`; nichts wird geschrieben. – Fix: beide Punkte in OFFEN eintragen; bei Gelegenheit im Handler ein leeres `changes` vor der Nachfrage abweisen.
- **N5** `supabase/functions/_shared/database.types.ts:1701, 2037`, `supabase/functions/_shared/cancel/db.ts:14, 56`, `supabase/functions/_shared/change/db.ts:13` – Die erzeugten Typen nennen als Rückgabe eine Zeichenkette, geliefert wird in allen Ablehnungsfällen null (wie bei `partner_accept_replay`, OFFEN n12-4). Die Deps-Typen schreiben null aus (`cancel/handlers.ts:25`, `cancel/partner.ts:25`, `change/handlers.ts:47`), die Handler prüfen es (`cancel/handlers.ts:80`, `partner.ts:95`, `change/handlers.ts:135`). – Fix: keiner nötig; den Satz in OFFEN n12-4 um die zwei Funktionen ergänzen.
- **N6** `tests/rls/partner-functions-live.test.ts:132-146, 147-153`, `tests/rls/flow-live.test.ts:350-355` – Live ist die Wiederholung nur mit Betrag 0 belegt (Firma: J2, Kunde: W4). Die Wiederholung mit Pauschale bzw. Stornogebühr ist über die SQL-Funktion (`tests/rls/replay.test.ts:93, 107, 152, 157`) und die Unit-Tests belegt, nicht über die deployte Function; für `change-propose` fand ich in den beiden Live-Dateien keinen Wiederholungsfall. Der Weg vom Handler zur Datenbank (Reihenfolge und Namen der Parameter) ist für beide Storno-Functions durch die Betrag-0-Fälle live gedeckt, für `change-propose` nur durch die Typbindung in `change/db.ts:11`. – Fix: je eine Live-Zeile (Wiederholung nach dem Storno mit Pauschale in J4; Wiederholung von `change-propose`).
- **N7** `tests/unit/cancel-partner-handler.test.ts:47-88`, `tests/unit/change-handlers.test.ts:70-103`, `tests/unit/cancel-handler.test.ts:72-77` – „Fehler der Nachfrage ergibt 500 ohne Einzelheiten“ ist nur beim Kunden getestet. Bei Firma und Nachtrag ist es derselbe Aufbau und nach Lesart gleich (`partner.ts:98-103`, `change/handlers.ts:144-148`). – Fix: je eine Zeile.
- **N8** `tests/rls/change-orders.test.ts:37, 99, 136` – Die Probe „Replay authenticated“ enthält im Aufruf eine Unterabfrage auf `job_photos`. Hat die Rolle dort kein Leserecht, endet die Probe schon an der Tabelle (derselbe Punkt wie M1 der Abnahme n12; die Rechte der Tabelle habe ich hier nicht nachgeschlagen). Die Rechte beider neuen Funktionen sind trotzdem gemessen: `tests/rls/replay.test.ts:133-134, 172-173` ruft `cancel_replay` nur mit festen Werten auf, und der Katalogtest lief nach dem Push grün (Lauf 025) und verlangt für beide Einträge genau „s“ (`positiv.ts:232, 236`). – Fix: die Probe mit festen Ids stellen.
- **N9** `tests/rls/auth-token-codes.test.ts:62` gegen `supabase/functions/_shared/quote/handler.ts:212-215` – Der Kommentar sagt, bei `quote` bedeute ein unbrauchbares Token „anonym“. Nach dem Handler ergibt ein Wert ohne Tokenform dort 401 wie überall. Die Auslassung von `quote` in der Schleife schadet nicht, der Kommentar ist falsch. – Fix: Kommentar berichtigen oder `quote` in die Schleife aufnehmen.
- **N10** `tmp/proof/n12b/runs.jsonl:22-33` – Auf dem Endstand d1021e7 mit sauberem Arbeitsbaum liefen nur die drei Live-Dateien (029 bis 031). `check` (024), `replay` (020), `change-orders` (021), `offers` (022), `journal` (023), `positiv` (025) und der Wettlauftest (028) liefen auf 8950fae mit nicht sauberem Arbeitsbaum; danach kam der Commit mit den Typen und der Umbenennung. – Fix: die Volläufe auf dem committeten Endstand (Ablauf Punkt 9) abwarten; sie sind der Beleg für den Endstand, nicht die Einzelläufe.

## Prüffragen

### 1. Doppelwirkung über die Handler-Wege

Keine.
- Storno des Kunden: Nach dem eigenen Storno meldet schon die Grundlage `invalid_transition` (0062:690, nach der Eigentümerprüfung in 689), der Handler ruft `cancel_by_customer` gar nicht mehr auf und fragt lesend nach (`cancel/handlers.ts:78-79`). Im Wettlauf wartet der zweite Aufruf auf die Sperre der Anfrage (0062:719), liest danach den neuen Status und scheitert vor Statuswechsel, Gegenbuchung, Gebührenzeile, Audit und Mail (0062:720 vor 735-745).
- Storno der Firma: Nach der eigenen Absage ist die Zuordnung beendet, das Tor meldet `not_found` (0064:192-194) in Grundlage und Storno (0062:761, 789), also vor 801-824. Live mit zwei gleichzeitigen und einem späteren Aufruf: dreimal 200, eine Gegenbuchung, eine Audit-Zeile, eine Weitervermittlung (`partner-functions-live.test.ts:134-145`, Lauf 031).
- Nachtrag: `change_open` kommt aus der Grundlage (0058:65) oder aus dem Anlegen (0041:23), jeweils vor dem Einfügen (0041:38-45). Die Nachfrage ist eine `stable` SQL-Abfrage (0068:60-77).
- Die Nachfrage selbst schreibt nichts: `cancel_replay` ist `stable` und enthält keine Schreibanweisung (0068:12-55).
- Zusätzlich hält der Index eine zweite Gebührenzeile je Anfrage hart auf (0068:10; rot vor dem Push in Lauf 019 mit Ist-Wert „ok“, grün danach in 020 und 023).
- Erfolgsantwort und Wiederholung sind gleich gebaut: `{status, cancelFeeCents}` (`cancel/handlers.ts:62, 81`), `{status, callOutCents}` (`partner.ts:76, 96`), `{revisionId, totalCents}` (`change/handlers.ts:126, 136`). Der Statustext der Nachfrage ist derselbe, den die Storno-Funktionen zurückgeben (0062:746, 825 gegen 0068:39, 53).
- Ein Fehler der Nachfrage wird nie zu 200: `DbError` mit dem Text der Datenbank, nicht in `STATUS`, also 500 `internal` (`cancel/db.ts:13, 55`, `change/db.ts:12`).

### 2. Offenlegung

Nichts Neues für Dritte.
- Kunde: Die Nachfrage erreicht nur der Eigentümer (Fremde enden an `not_found`, 0062:689; live `flow-live.test.ts:355`). Trifft sie, bekommt er den Status und den Betrag zurück, den er selbst gesendet hat. Der Betrag ist seine Stornogebühr, nicht die Plattformgebühr; verglichen wird in SQL gegen `total_cents`, nie gegen `fee_cents` (0068:31-34, 38).
- Firma: Treffer nur für die Person aus dem Audit, die heute Mitglied der absagenden Firma ist (0068:27, 43-46). Ein zweites Mitglied derselben Firma, eine andere Firma und der Kunde bekommen null (`replay.test.ts:99-101, 154-156`). Für alle außer der Person des Erfolgs bleibt es bei 404, gleich ob die Anfrage existiert.
- Eine gesperrte Firma erreicht die Nachfrage nicht: `partner_not_active` kommt im Tor vor der Zuordnungsprüfung (0064:190-191).
- Nachtrag: Treffer nur für ein Mitglied der Firma, die den Nachtrag gestellt hat; zurück kommt die Id des eigenen Nachtrags und der selbst gesendete Betrag (N4).
- Nach `negate_fee` trifft die Nachfrage nicht mehr (`replay.test.ts:127-128, 170`): es gibt keine 200-Antwort mit einem Betrag, den das Journal nicht mehr trägt.
- Die Vorschau fragt nie nach: beim Kunden durch die Bedingung in `cancel/handlers.ts:78`, bei der Firma durch die Rückkehr in `partner.ts:64-67` vor `run`, beim Nachtrag durch `change/handlers.ts:133`.
- Neu ist nur ein Zeitunterschied bei `not_found` von `cancel-partner` (ein Leseaufruf mehr). Er verrät höchstens, ob zu einer geratenen Id eine Absage im Audit steht. Vernachlässigbar.

### 3. Akteur nur aus dem Token

Ja. In allen drei Nachfragen ist der erste Parameter `a.user.id` aus `authed` (`cancel/handlers.ts:79`, `partner.ts:94`, `change/handlers.ts:134`) und geht als `p_actor` an die Datenbank (`cancel/db.ts:12, 54`, `change/db.ts:11`). Die Aktion ist im Code fest (`cancel_by_partner` bzw. `cancel_by_customer`), nicht aus dem Body. Aus dem Body kommen nur geprüfte Werte: Anfrage-Id, Grund aus einer festen Menge, Belege als Liste gültiger Ids, Betrag als sichere ganze Zahl ab 0 (`cancel/handlers.ts:44-48`, `partner.ts:50-61`, `change/handlers.ts:100-107`). Fremde Felder im Body ergeben 400. Die Unit-Tests halten die Argumente fest (`cancel-handler.test.ts:48`, `cancel-partner-handler.test.ts:57, 65`, `change-handlers.test.ts:79`). aal2 verlangt `authed` bei Firma und Nachtrag wie bisher (`partner.ts:44`, `change/handlers.ts:94`); der Kunde braucht keines.

### 4. `authed` und `TOKEN_FORM`

- Kann ein echtes Token fälschlich abgelehnt werden: Nein. Ein Token in kompakter Form besteht aus Buchstaben, Ziffern, Bindestrich, Unterstrich und Punkten; die Prüfung lässt genau Buchstaben, Ziffern, Unterstrich, Punkt und Bindestrich zu, mindestens ein Zeichen, über die ganze Länge (`auth.ts:12`). Füllzeichen kommen in dieser Form nicht vor. Vor der Prüfung wird das Schema samt folgendem Leerraum entfernt, Groß- und Kleinschreibung gleichgültig (`jobs/handlers.ts:55`); Leerraum am Rand des Header-Werts entfernt die Laufzeit. Die Prüfung ist ohne Unicode-Schalter geschrieben, die Wortklasse meint also nur ASCII. Live: echte Tokens von Kunde, Firma und admin gehen in den Läufen 030 und 031 durch alle Functions.
- Leerer Wert: wie bisher 401 ohne Aufruf (`jobs/handlers.ts:56-57`).
- Was die Prüfung ablehnt, war vorher ein 500 (Leerzeichen, live gemessen laut Auftrag; jetzt 401 in Lauf 029, `auth-token-codes.test.ts:63-71`). Ein 401 meldet die App ab; die App selbst sendet aber nie einen Wert außerhalb der Zeichenmenge (Sitzungs-Token oder der öffentliche Schlüssel).
- Rechte: unverändert. Nach der Formprüfung entscheidet weiter Auth; aal kommt weiter aus der geprüften Nutzlast (`jobs/db.ts:18-28`, in diesem Schritt nicht geändert).
- `AuthServiceError`: Die Meldung enthält nur den festen Text, den Status als ganze Zahl und den Code, wenn er ein kurzer Bezeichner ist, sonst Striche (`auth.ts:23`). Kein Token, keine Originalmeldung (`auth-token.test.ts:69-73, 75-86`). Nebenwirkung in den Foto-Handlern: M2.
- `session_not_found` in der Codeliste (`auth.ts:9`): gilt nur bei Status 400, 401 oder 403 (`auth.ts:30`); eine Erweiterung der Ablehnung, keine der Rechte.
- Abweichung vom Plan: N1.

### 5. Abbildung von 40P01 in `must`

Richtig, mit N3.
- Die Aussage „nichts ist geschrieben“ stimmt: Jeder RPC läuft als eine Transaktion; das Opfer eines Deadlocks wird ganz zurückgerollt.
- Alle Aufrufer von `must` (Suche über `supabase/functions`): `admin/db.ts`, `photo/db.ts` (vier Stellen), `jobs/db.ts` (sieben), `cancel/db.ts` (vier), `change/db.ts` (fünf). `quote/db.ts:14-17` hat ein eigenes `must` und ist nicht betroffen.
- `retry` steht in `STATUS` als 409 (`jobs/handlers.ts:37`). In jedem Handler landet der Code dort: `handleAccept` (kein `already_taken`, also keine Nachfrage, `jobs/handlers.ts:125`), `handleConfirmOffer` (`:186-187`), `handleAdminContact`, `handleAdminCorrect` (`admin/correct.ts:90-92`), die Storno-Handler (kein Code der Nachfrage, `cancel/handlers.ts:78`, `partner.ts:93`), `handleProposeChange` und `handleDecideChange` (`CHANGE_STATUS` enthält `STATUS`), die Foto-Handler über `fail` (`photo/handlers.ts:14-15`).
- Für Kunden ist die Antwort neutral (`{"error":"retry"}`), kein Betrag, kein Satz.
- `retry` aus 40P01 löst in den Handlern keine eigene Wiederholung aus (die Schleifen wiederholen nur bei den Satzcodes); die App entscheidet. Das ist richtig so: ein zweiter Versuch im Handler könnte denselben Zyklus treffen.
- `handleOutbox`: `claim` steht außerhalb des Fangblocks (`jobs/handlers.ts:294`); ein Fehler dort brach den Lauf schon vorher ab, nur der Text des Fehlers ist jetzt ein anderer.
- `photo_receipt_add` nach dem Upload: die Datei liegt dann ohne Zeile im Speicher, wie bei jedem anderen Fehler an dieser Stelle zuvor.
- Unit: `db-must.test.ts:8-17`, rot in Lauf 016.

### 6. Wiederholung in `accountDb.remove`

Richtig.
- Höchstens zwei Aufrufe: Versuch 0 mit 40P01 läuft weiter, Versuch 1 mit 40P01 wirft `retry`; jeder andere Fehler wirft sofort den Text der Datenbank; Erfolg kehrt zurück (`account/db.ts:11-16`). Eine Endlosschleife ist nicht möglich.
- Die Wiederholung ist sicher, weil der erste Aufruf als Opfer ganz zurückgerollt ist; `delete_account` läuft dann von vorn mit allen Prüfungen. `p_user` bleibt die Id aus dem Token (`account/handlers.ts:23`).
- Antwort nach zwei Deadlocks: 409 `retry` (`account/handlers.ts:26-28`), nichts gelöscht.
- Unit: `delete-account-handler.test.ts:30-44` (zwei Aufrufe, dann Erfolg; zwei Aufrufe, dann `retry`; anderer Fehler ohne zweiten Aufruf). Grün belegt, nicht rot (M3). Live nicht erzeugt (steht in OFFEN n15-1).

### 7. Umbau von `handleJobPhoto` auf `authed(…, false)`

Verhaltensgleich bis auf die Formprüfung.
- Vorher: Token lesen, `getUser`, bei null 401. Jetzt dasselbe über `authed` mit `needAal2 = false` (`photo/handlers.ts:133-135`, Diff `tmp/n12b-gate-diff.diff:359-365`). Der 401-Rumpf ist derselbe.
- Kein aal2 im Handler, wie vorher und wie nötig: Kunden rufen die Function für die Belege der eigenen Anfrage auf. aal und Nutzer gehen an die Datenbank (`photo/handlers.ts:142`); dort verlangt der Listing-Zweig aal2, der Anfrage-Zweig den Eigentümer (0065:69, 90-91). Unit: aal1 mit Listing ergibt 403 `mfa_required` aus der Datenbank (`tests/unit/photo-handlers.test.ts:201-206`).
- Keine Rechte-Ausweitung, keine Verengung.

### 8. Fake-Typen in den Unit-Tests

In Ordnung, mit zwei Anmerkungen.
- Die Fakes der drei Handler-Tests sind als `CancelDeps`, `PartnerDeps` und `ProposeDeps` typisiert (`cancel-handler.test.ts:13-35`, `cancel-partner-handler.test.ts:14-43`, `change-handlers.test.ts:39-65`). `replay` nimmt dort beliebige Argumente und zeichnet sie auf; das ist dem Deps-Typ zuweisbar, und die Tests vergleichen die aufgezeichneten Argumente genau. Eine geänderte Signatur fiele damit im Test auf, nicht im Typ.
- `accountDb` und `getUser` werden mit einem auf `Db` umgedeuteten Objekt getestet (`delete-account-handler.test.ts:12, 26`, `auth-token.test.ts:20`). Das prüft die Logik, nicht die Form der echten Antwort; dass die Datenbank-Schicht den Code 40P01 im Feld `code` liefert, ist damit nur angenommen (so ist es dokumentiert, live nicht erzeugt).
- Die Handler-Tabelle in `auth-token.test.ts:109-139` deutet Handler und Deps auf den leeren Typ um und übergibt nur drei Felder. Für den 401-Weg genügt das: griffe ein Handler vor der Token-Prüfung auf ein anderes Feld zu, wäre die Antwort 500 und der Test rot.
- Die Fakes vergleichen nichts: ob Betrag, Grund und Belege passen, entscheidet allein SQL, und das prüfen `replay.test.ts` und `change-orders.test.ts`.

### 9. Typdatei, Register, Lösch-Register

- Typdatei: `cancel_replay` (`database.types.ts:1692-1702`) hat die sechs Argumente der Signatur aus 0068:12, `propose_change_replay` (`:2029-2038`) die fünf aus 0068:60. Die Nachbarn sind in Form und Reihenfolge unauffällig. Mittelbarer Beleg, dass davor nichts verschoben wurde: `partner_accept_replay` stand in der Abnahme n12 an 1912 und steht jetzt an 1923, elf Zeilen tiefer; elf Zeilen ist die Länge des neuen Eintrags davor. `send_offer` (`:2154-2157`) und `my_report_info` (`:1863-1869`) haben die unveränderten Signaturen. Gegen den Vorstand verglichen habe ich die Datei nicht.
- Register (`positiv.ts:230-238`): beide Einträge Welt `auftrag`, `service_role`, genau „s“; die Typbindung erzwingt wegen `p_actor` den Akteur (`positiv.ts:35`). `NIE_AUSNAHME` nennt beide (`:170`). Der Aufruf von `cancel_replay` trifft keine Positivzeile (c2 ist an dieser Stelle noch nicht storniert, Ergebnis null); das sagt der Kommentar in `:230` selbst, die Treffer belegt `replay.test.ts`. Der Aufruf von `propose_change_replay` nennt den im Setup gestellten Vorschlag auf j5 (`positiv.ts:119, 148`) und sollte treffen. Katalog und Welt liefen grün (Lauf 025).
- Sonst nichts geändert: laut Diff zwei Stellen (`tmp/n12b-gate-diff.diff:369-398`), eine Zeile in `NIE_AUSNAHME` und neun neue Zeilen.
- Lösch-Register: laut Diff nur der Hash in Zeile 30 (`tmp/n12b-gate-diff.diff:1-13`), Wert wie im Auftrag. 13 Skripte und 16 Ausnahmen wie in n12. Der Grundtext bleibt wahr: die neuen Registertexte sind lesende Funktionsaufrufe. Nicht abgeschwächt.

### 10. Abweichungen (a) bis (e)

- (a) Tokenform: tragbar, N1.
- (b) 40P01: richtig, Prüffragen 5 und 6, N3.
- (c) Eigene Lesefunktion statt Änderung an `propose_change`: strenger als der Plan (die schreibende Funktion bleibt unberührt). Der Handler fragt nur bei `change_open` und nie in der Vorschau (`change/handlers.ts:133`). N4.
- (d) `cancel_replay` vergleicht in SQL und gibt nur den Status zurück: strenger als der Plan. Die Handler fragen nur bei `invalid_transition` (Kunde) bzw. `not_found` (Firma). Der Kommentar in `partner.ts:92`, `invalid_transition` könne nach der eigenen Absage nicht kommen, stimmt mit dem Tor überein (Zuordnungsprüfung vor Statusprüfung, 0064:192-195).
- (e) Index: Entscheidung aus der DB-Freigabe (M1), umgesetzt. `journal.test.ts` zeigt vor dem Push den Ist-Wert „ok“ (Lauf 019) und danach grün (023); der Schritt in `replay.test.ts` steht hinter `negate_fee` (`:127-131, 171`); die Regel steht als Nr. 188 in `docs/ENTSCHEIDUNGEN.md:195` und in `docs/STAND.md:20`.
- `send_offer` und `my_report_info`: `tmp/n12b-funktionsdiff.diff` zeigt je genau den einen Block bzw. die eine Zeile (N5 der DB-Freigabe erledigt).

### 11. Läufe (Exit-Zeilen)

- Rot vor dem Push: `replay` 001, 002 (f83f15b) und 017 (97d5af3, Funktion fehlt), `offers` 018 (`offer_exists` statt „ok“: echter Vorher-Wert für die Wiederholung in `send_offer`), `journal` 019 („ok“ statt Indexfehler: echter Vorher-Wert für den Index), `change-orders` 003 (Funktion fehlt).
- Push: Marken in `runs.jsonl:20-21` mit demselben Hash wie in der DB-Freigabe.
- Grün nach dem Push: 020 bis 023, `check` 024 (1955 Tests), `positiv` 025, Wettlauf 026 und 028 (M1).
- Unit: M3.
- Live auf d1021e7, sauber: 029, 030 (19 Tests), 031 (12 Tests), alle Exit 0.
- Endstand: N10.

### 12. Deploy

- Reihenfolge Push, Typen, Deploy ist eingehalten (N3 der DB-Freigabe): `deploy.log:5`, sonst wären die Wiederholungszeilen in 030 und 031 rot.
- 14 Functions mit neuer Version (`deploy.log:3`); `quote`: N2.

### Geld, Sicherheit, Schema (Kurzurteil)

- Geld: keine neue Rechnung, keine neue Rundung. Die Nachfragen vergleichen ganze Cent exakt (`bigint`); die Antwort trägt den Betrag des Aufrufers, den SQL gegen Audit und Journalsumme geprüft hat. `splitFee` und die Übergabe der Teile an die Datenbank sind unverändert (`cancel/handlers.ts:59`, `partner.ts:33, 75`). Kunden bekommen über keinen neuen Weg eine Gebühr, einen Satz oder eine Journalzeile; `retry` ist neutral.
- Sicherheit: fester Akteur aus dem Token an allen neuen Stellen; die neuen SQL-Funktionen nur für `service_role`, aufgerufen nur aus den Functions mit dem Secret Key; kein Secret im Code, die Meldung von `AuthServiceError` enthält nur Status und geprüften Code. Missbrauch durch Partner: höchstens die eigene Absage oder den eigenen Nachtrag erneut bestätigt bekommen. Missbrauch durch Kunden: höchstens das eigene Storno. Offen als Rückschritt im Log: M2.
- Schema und Nebenläufigkeit: nicht Teil der Pflichtmenge; Urteil der DB-Freigabe (frei) bestätigt, soweit ich die Stellen hier erneut gelesen habe. M1 und M2 der Freigabe sind umgesetzt, N1 und N2 der Freigabe fehlen in OFFEN (N4).

## Stichproben (selbst nachgeschlagen)

- `supabase/functions/_shared/account/db.ts:8-17` – Schleife mit höchstens zwei Aufrufen, `retry` nach dem zweiten 40P01. In Ordnung.
- `supabase/functions/_shared/auth.ts:9` – Codeliste mit `session_not_found`. In Ordnung.
- `supabase/functions/_shared/auth.ts:11-12` – Zeichenmenge der Tokenform, verankert an Anfang und Ende. In Ordnung (N1).
- `supabase/functions/_shared/auth.ts:18-26` – Meldung mit Status und geprüftem Code. In Ordnung, Wirkung auf `fail`: M2.
- `supabase/functions/_shared/auth.ts:28-32` – Ablehnung nur bei Typ „Sitzung fehlt“ oder Code mit Status 400, 401, 403. In Ordnung.
- `supabase/functions/_shared/cancel/db.ts:11-15` – Firma: sechs benannte Parameter, Aktion fest, null wird durchgereicht. In Ordnung.
- `supabase/functions/_shared/cancel/db.ts:52-57` – Kunde: Aktion fest, leerer Grund, leere Belege. In Ordnung.
- `supabase/functions/_shared/cancel/handlers.ts:39-50` – kein aal2, Eingabeprüfung, Vorschau ohne Betrag. In Ordnung.
- `supabase/functions/_shared/cancel/handlers.ts:51-73` – `run`: Schleife wie vorher, `cancel_fee_changed` als Antwort, nicht als Fehler. In Ordnung.
- `supabase/functions/_shared/cancel/handlers.ts:74-82` – Nachfrage nur bei `invalid_transition` und nie in der Vorschau; null lässt den Fehler stehen. In Ordnung.
- `supabase/functions/_shared/cancel/handlers.ts:83-89` – unbekannter Code: 500 mit festem Rumpf, Log gekürzt. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:44-63` – aal2, Belege und gezeigter Betrag gehören zusammen. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:64-67` – Vorschau kehrt vor `run` zurück. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:69-87` – `run` wie vorher, `amount_changed` als Fehler. In Ordnung.
- `supabase/functions/_shared/cancel/partner.ts:88-97` – Nachfrage nur bei `not_found`. In Ordnung.
- `supabase/functions/_shared/change/db.ts:10-14` – fünf benannte Parameter. In Ordnung (N5).
- `supabase/functions/_shared/change/handlers.ts:94-110` – aal2, Eingabeprüfung, Routenschlüssel gesperrt. In Ordnung.
- `supabase/functions/_shared/change/handlers.ts:111-127` – `run`: Schlüsselprüfung und Rechnung erst nach der Grundlage. Grundlage für N4.
- `supabase/functions/_shared/change/handlers.ts:128-137` – Nachfrage nur bei `change_open`, nie in der Vorschau. In Ordnung.
- `supabase/functions/_shared/change/handlers.ts:138-149` – Eingabe- und Tariffehler laufen an der Nachfrage vorbei. In Ordnung.
- `supabase/functions/_shared/database.types.ts:1692-1702` – `cancel_replay`, sechs Argumente. In Ordnung (N5).
- `supabase/functions/_shared/database.types.ts:2029-2038` – `propose_change_replay`, fünf Argumente. In Ordnung (N5).
- `supabase/functions/_shared/database.types.ts:1923-1931` – `partner_accept_replay` elf Zeilen tiefer als in der Abnahme n12. In Ordnung.
- `supabase/functions/_shared/jobs/db.ts:10-15` – `must`: 40P01 zu `retry`, sonst die Meldung, null zu `no_data`. In Ordnung (N3).
- `supabase/functions/_shared/jobs/db.ts:18-28` – `getUser` unverändert, aal aus der Nutzlast. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:4, 54-60` – Import ohne Zyklus, Formprüfung vor dem Aufruf, 401 bei null, aal2 als Vorgabe. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:37` – `retry` 409. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:121-129` – Annahme: `retry` löst keine Nachfrage aus. In Ordnung.
- `supabase/functions/_shared/photo/handlers.ts:12-20` – `fail`: nur einzelne Bezeichner als Code im Log. Grundlage für M2.
- `supabase/functions/_shared/photo/handlers.ts:131-142` – `authed` ohne aal2, Nutzer und aal an die Datenbank. In Ordnung.
- `supabase/functions/_shared/photo/db.ts:40-48, 55-56` – zwei Aufrufe ohne `must`. Grundlage für N3.
- `supabase/functions/_shared/account/handlers.ts:19-30` – kein aal2, Bestätigung Pflicht, `retry` über `STATUS`. In Ordnung.
- `supabase/functions/_shared/admin/correct.ts:89-95` – `retry` über `STATUS`. In Ordnung.
- `supabase/functions/_shared/quote/db.ts:5, 14-17, 28-31` – lädt `auth.ts`, eigenes `must`. Grundlage für N2.
- `supabase/functions/_shared/quote/handler.ts:34, 212-215, 261-262` – dreiteilige Form, 401 ohne Nutzer, Log mit Fehlername. Grundlage für N1, N2, N9.
- `supabase/functions/cancel-partner/index.ts:14-17` – Client mit Secret Key, `cancelPartnerDb(db)` ausgebreitet, `replay` kommt damit an. In Ordnung.
- Suche nach Aufrufen von `must` in `supabase/functions` – 26 Treffer in fünf Modulen, `quote` mit eigenem `must`. Grundlage für Prüffrage 5.
- Suche nach Importen von `auth.ts` – `jobs/db.ts:6`, `jobs/handlers.ts:4`, `quote/db.ts:5`. Grundlage für N2.
- Suche nach der Meldung und dem Namen von `AuthServiceError` in Functions und Tests – kein Test verlangt einen Logeintrag der Foto-Handler. Grundlage für M2.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:10` – Teilindex. In Ordnung.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:22-53` – Reihenfolge der Prüfungen, Vergleich gegen Audit und Journalsumme, nur Statustext. In Ordnung.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:57-58, 79-80` – Rechte nur `service_role`. In Ordnung.
- `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:64-76` – Nachtrag: Mitglied der Firma, offen, gültig, Betrag, Teilmenge der Eingaben, Belege als Menge. In Ordnung (N4).
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:688-692` – Grundlage Kunde: `not_found` vor `invalid_transition`. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:716-746` – Storno Kunde: Sperre, Statustor, eine Zeile, Audit mit Betrag, Statustext. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:761, 789` – Grundlage und Absage der Firma beginnen mit dem Tor. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:801-825` – Absage: eine Zeile, Audit mit Grund, Betrag, Belegen, Statustext. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:184-197` – Tor: aal2, Mitglied, Anfrage mit Sperre, Firmenstatus, Zuordnung, Status. In Ordnung.
- `supabase/migrations/20261112110000_0058_my_job_changes.sql:61-65` – Grundlage des Nachtrags meldet `change_open`. Grundlage für N4.
- `supabase/migrations/20261109130000_0041_s9f_abnahme.sql:17-23, 38-45` – `change_open` vor dem Einfügen. In Ordnung.
- `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:67-69, 90-91` – Fotos: aal2 nur im Listing-Zweig, Anfrage-Zweig über den Eigentümer. In Ordnung.
- `tmp/n12b-gate-diff.diff:14-34, 314-329, 330-350, 351-368` – `account/db.ts`, `must`, `authed`, `handleJobPhoto`: nur die beschriebenen Änderungen. In Ordnung.
- `tmp/n12b-gate-diff.diff:100-169, 170-232, 252-313` – Schleifen in `run` verschoben, sonst gleich; je ein Nachfrage-Block. In Ordnung.
- `tmp/n12b-gate-diff.diff:1-13, 369-398` – Lösch-Register eine Zeile, Register zwei Stellen. In Ordnung.
- `tmp/n12b-gate-diff.diff` gesamt – kein Abschnitt für die Typdatei. Grundlage für die Grenze oben.
- `tmp/n12b-funktionsdiff.diff:12-22, 35-42` – `send_offer` ein Block, `my_report_info` eine Zeile. In Ordnung.
- `tests/support/positiv.ts:35, 170, 230-238` – Akteurbindung, `NIE_AUSNAHME`, zwei Einträge. In Ordnung.
- `tests/support/positiv.ts:119, 148` – Vorschlag auf j5 im Setup. In Ordnung.
- `scripts/sys/loesch-register.json:3-15, 18-33` – 13 Skripte, 16 Ausnahmen. In Ordnung.
- `scripts/sys/loesch-register.json:30` – Hash wie im Auftrag. In Ordnung.
- `scripts/sys/fertig.mjs:75-79` – Regel „rot vor dem ersten grünen“ je neuer Datei, Suche über den Dateinamen. Grundlage für M1.
- `tmp/proof/n12b/runs.jsonl:6-16` – Unit: sechs grüne Läufe, dann fünf Mutationsläufe, davon 014 mit Exit 0. Grundlage für M3.
- `tmp/proof/n12b/runs.jsonl:20-21` – Push-Marken, Hash wie `tmp/proof/n12b/db-freigabe-1.md:8`. In Ordnung.
- `tmp/proof/n12b/runs.jsonl:28-30` – Lauf 26 grün unter altem Namen, 27 rot und 28 grün unter neuem. Grundlage für M1.
- `tmp/proof/n12b/runs.jsonl:31-33` – d1021e7, sauber, Exit 0. In Ordnung.
- `tmp/proof/n12b/012-tests_unit_cancel-handler.test.ts.log:19-20, 47` – ein roter Test, Nachfrage bei fremdem Fehler. Grundlage für M3.
- `tmp/proof/n12b/013-tests_unit_cancel-partner-handler.test.ts.log:23-24, 80-81, 127` – fünf rote Tests, 404 statt 200. In Ordnung.
- `tmp/proof/n12b/014-tests_unit_delete-account-handler.test.ts.log:22` – `EXIT=0`. Grundlage für M3.
- `tmp/proof/n12b/015-tests_unit_auth-token.test.ts.log:30-42, 69` – zwölf Handler rot, Auth dreimal aufgerufen. In Ordnung.
- `tmp/proof/n12b/016-tests_unit_db-must.test.ts.log:19-20, 51` – 40P01 nicht zu `retry`. In Ordnung.
- `tmp/proof/n12b/017-tests_rls_replay.test.ts.log:1-2, 20, 46` – 97d5af3, Funktion fehlt, `EXIT=1`. In Ordnung.
- `tmp/proof/n12b/018-tests_rls_offers.test.ts.log:36, 62` – `offer_exists` statt „ok“. In Ordnung.
- `tmp/proof/n12b/019-tests_rls_journal.test.ts.log:25, 53` – „ok“ statt Indexfehler. In Ordnung.
- `tmp/proof/n12b/024-check.log:349-350, 358` – 67 Dateien, 1955 Tests, `EXIT=0`. In Ordnung (N10).
- `tmp/proof/n12b/025-tests_rls_positiv.test.ts.log:1-2, 31` – 8950fae, nicht sauber, `EXIT=0`. In Ordnung.
- `tmp/proof/n12b/026-tests_rls_replay-concurrency.test.ts.log:1-2, 26` – 8950fae, `EXIT=0`. Grundlage für M1.
- `tmp/proof/n12b/027-tests_rls_storno-wettlauf.test.ts.log:19-20, 45` – Ist-Wert Statustext, erwartet der Null-Marker. Grundlage für M1.
- `tmp/proof/n12b/029-tests_rls_auth-token-codes.test.ts.log:1-2, 26`, `030-…:1-2, 49`, `031-…:1-2, 38` – d1021e7, sauber, `EXIT=0`. In Ordnung.
- `tmp/proof/n12b/deploy.log:1-5` – Commit, 14 Versionen, drei nicht deployte Functions mit Begründung. Grundlage für N2.
- `tests/unit/cancel-handler.test.ts:39-78` – fünf Fälle der Wiederholung, Argumente aus dem Token. In Ordnung.
- `tests/unit/cancel-partner-handler.test.ts:47-88` – fünf Fälle, ohne „Fehler der Nachfrage“. In Ordnung (N7).
- `tests/unit/change-handlers.test.ts:70-103` – vier Fälle. In Ordnung (N7).
- `tests/unit/delete-account-handler.test.ts:9-45` – fünf Fälle für `accountDb.remove`. In Ordnung (M3).
- `tests/unit/db-must.test.ts:8-17` – 40P01, andere Codes, Daten, null. In Ordnung.
- `tests/unit/auth-token.test.ts:60-74` – Meldung mit Status und Code, kein Freitext. In Ordnung.
- `tests/unit/auth-token.test.ts:109-139` – zwölf Handler, drei Werte ohne Tokenform, Auth nie aufgerufen. In Ordnung.
- `tests/unit/auth-token.test.ts:141-157` – Störung: 500, kein Token im Log; kein Vergleich des Logeintrags. Grundlage für M2.
- `tests/unit/photo-handlers.test.ts:201-206` – ohne Token 401, aal1 mit Listing 403 aus der Datenbank. In Ordnung.
- `tests/rls/replay.test.ts:80-91, 140-150` – Messung: zweiter Aufruf `not_found` bzw. `invalid_transition`, je eine Gebührenzeile. In Ordnung.
- `tests/rls/replay.test.ts:93-112, 152-158` – Treffer und Ablehnungen der Nachfrage. In Ordnung.
- `tests/rls/replay.test.ts:127-137, 169-174` – nach `negate_fee` kein Treffer, Index hält die neue Zeile auf, Rechte mit festen Werten, ausgetretenes Mitglied. In Ordnung.
- `tests/rls/storno-wettlauf.test.ts:62-70, 74-81, 91-105` – sechs gleichzeitige Aufrufe über SQL, je ein Erfolg, eine Gebührenzeile, Nachfrage nur für den Gewinner. Gelesen, nicht abgenommen (M1).
- `tests/rls/change-orders.test.ts:89-100, 113-114, 133-138` – elf Proben der Nachtrags-Nachfrage. In Ordnung (N8).
- `tests/rls/flow-live.test.ts:350-355` – Kunde live: Wiederholung gleich, anderer Betrag 409, Firma 404. In Ordnung (N6).
- `tests/rls/partner-functions-live.test.ts:132-146` – Firma live: drei Aufrufe 200, eine Wirkung, anderer Grund und fremde Firma 404. In Ordnung (N6).
- `tests/rls/auth-token-codes.test.ts:49-71` – gefälscht und gelöscht 401 mit Text, Leerzeichen 401 für zwölf Functions. In Ordnung (N9).
- `docs/ENTSCHEIDUNGEN.md:194-196` – Nr. 187 bis 189. In Ordnung (M2 zu Nr. 189).
- `docs/STAND.md:20, 26` – Regeländerung Nr. 188 zur Kenntnis; Hinweis auf die Umbenennung. Grundlage für M1.
- `docs/OFFEN.md:82, 84` – n15-1 und n12-2 nachgeführt; kein Eintrag zu N1 und N2 der DB-Freigabe. Grundlage für N4.
- Suche in `docs/BEKS.md` nach dem Schritt, der Umbenennung und dem Wettlauftest – kein Treffer. Grundlage für M1.

Offene Findings hoch: 0
