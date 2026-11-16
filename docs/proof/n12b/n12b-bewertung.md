# Bewertung n12b · Kennung n12b-1611-a

Modell der Hauptsession: Sonnet 5.5 (`claude-sonnet-5-5`). Feld `effort` (`get_session self`): `high`. Ein Feld `perTurnEffort` ist im Transkript nicht abrufbar; nicht erfunden.

## 1. Messung: doppeltes Storno der Firma mit Pauschale
`tests/rls/replay.test.ts`, Rollback-Probe, Aufbau wie `cancellation-partner.test.ts` (S1: Termin vorbei, Nachtrag abgelehnt, Beleg). Ergebnis (Lauf 002, vor jeder Änderung an der Datenbank): zweiter gleicher `cancel_by_partner` und zweite Grundlage enden mit `not_found` (Zuordnung beendet, das Tor `change_gate` greift vor jeder Buchung), danach genau eine `cancellation_fee`-Zeile, drei Zeilen insgesamt, Gebührensumme gleich einer Pauschale, eine Audit-Zeile. Dasselbe beim Kunden (`invalid_transition`, eine Gebührenzeile). Parallel (`storno-wettlauf.test.ts`, Läufe 27/28, live Lauf 31): genau ein Erfolg, eine Gebührenzeile, eine Audit-Zeile, eine Mail. Es entstehen keine zwei Zeilen: kein Anhalten nötig. Zusätzlich sperrt 0068 eine zweite Pauschale hart (Unique-Index, siehe 4).

## 2. Umfang
Erledigt (n12-2): `cancel-customer`, `cancel-partner`, `change-propose`, `send_offer` antworten bei Wiederholung derselben Partei mit dem ersten Ergebnis (200). Migration 0068: `cancel_replay`, `propose_change_replay`, Block in `send_offer`, Prüfung in `my_report_info` (n15-1 N8), Index. Nicht gemacht (zu groß für einen Schritt, laut Auftrag nach OFFEN n12-2): `withdraw_offer`, `withdraw_change`, `withdraw`, `start_job`, `complete_job` (App-RPCs ohne Handler).
n15-1: erledigt N1 (Tokenform `TOKEN_FORM`, vorher live gemessen: `Bearer a b` ergab 500, Lauf 5; jetzt 401, Lauf 29/38), N2 (`session_not_found`), N3 (Status und Code in der Meldung von `AuthServiceError`; die drei Foto-Functions loggen sie nicht, OFFEN n12b-1 M2), N4 (Unit-Zeilen), N5 (Smoke prüft `unauthorized`), N7 (40P01: `must` zu `retry`, `accountDb.remove` wiederholt einmal; nur Unit-belegt), N8 (0068). Offen mit Begründung: N6 (Testentwurf, kein Fehler), N7 Rest, N9 (Diff der Gate-Dateien liegt unter `tmp/`, der Guard sperrt Umleitungen nach `tmp/proof`).
n12-5: alle 14 Functions deployt (`tmp/proof/n12b/deploy.log`: Versionen, `functions list`), Smoke 401 (Lauf 29, 38), `flow-live` (Lauf 30, 19 Tests), `partner-functions-live` (Lauf 31, 39). `quote` nicht deployt (lädt `jobs/*` nicht; es lädt `auth.ts`, Wirkung keine, OFFEN n12b-1 N2).

## 3. Abweichungen vom Auftrag und von der Planprüfung
- Tokenform: nur `TOKEN_FORM = /^[\w.-]+$/` statt der dreiteiligen `JWT_FORM` (Fable-Plan Punkt 4), weil die volle Form die Fake-Tokens `ok`/`t` in rund zwölf Unit-Testdateien verworfen hätte; `quote` unverändert, nicht deployt (statt 15 Functions 14). Entscheidung Nr. 189.
- `propose_change` unverändert, eigene Lesefunktion (Fable-Plan 2c, strenger als mein Plan); `cancel_replay` vergleicht Betrag, Grund, Belege in SQL und gibt nur den Status zurück (strenger als mein Plan).
- Unique-Index `commission_one_cancellation_fee` ist eine Regeländerung (Nr. 188): nach „Pauschale negieren“ ist keine neue Gebührenzeile mehr möglich (`journal.test.ts` auf 23505 umgestellt). Das steht in `docs/BEKS.md` Frage 2 und im Bericht.
- Keine Entscheidung von Beks geändert; zwei Fragen in `docs/BEKS.md` (Frage 1 Rot-Beweis, Frage 2 Index).

## 4. Rot-Belege (ehrlich)
- Ist-Wert-Belege vor dem Push: `offers` Lauf 18 (`offer_exists` statt `ok`: die Wiederholung in `send_offer` fehlt), `journal` Lauf 19 (`ok`: die zweite Gebührenzeile nach der Gegenbuchung wurde geschrieben, Index fehlt), `replay` Lauf 17 und `change-orders` Lauf 3 (Funktion fehlt, 42883; zeigt nur das Fehlen), `auth-token-codes` Lauf 5 (500 statt 401 bei Leerzeichen: Messung N1). Lauf 1 war ein Aufbaufehler (`partner_job_limit`), Lauf 2 rot an einer falsch platzierten Index-Erwartung (Befund M2 der DB-Freigabe, danach hinter `negate_fee` gesetzt), kein Beleg für den Index.
- Unit (Mutationen, danach zurückgesetzt, Hashes der Abnahme unverändert): Lauf 12 (Kunde, Nachfrage in der Vorschau: 1 Test rot), 13 (Firma, falscher Fehlercode: 5 rot), 15 (`TOKEN_FORM` entfernt: 12 rot), 16 (`must` ohne 40P01: 1 rot), 32 (`accountDb.remove` ohne 40P01: 2 rot), 33 (Nachtrag-Nachfrage ohne `change_open`-Bedingung: 1 rot). Lauf 14 (`delete-account-handler`) war grün und ist kein Rot-Beweis; die Wirkung von `accountDb.remove` belegt erst Lauf 32.
- `storno-wettlauf.test.ts`: kein Rot-Beweis im Sinn von `tests.md`. Die Datei lief zuerst grün unter `replay-concurrency.test.ts` (Lauf 26), ich habe sie umbenannt und Lauf 27 durch eine geänderte Erwartung rot gemacht (Ist-Wert `cancelled_by_partner`, erwartet der Null-Marker). Das Gate ist damit nur über den neuen Namen erfüllt. Ob das zählt, entscheidet Beks (`docs/BEKS.md` Frage 1); `npm run fertig` ist deshalb nicht gelaufen. Die Eigenschaft ist auf anderem Weg belegt (Sperre der Anfrage vor jeder Buchung, grüne Läufe 26 und 28, Live Lauf 31).

## 5. Läufe auf dem Endstand 5e4a74b (sauber)
`check` Lauf 40 (1957 Tests), `e2e` Lauf 41 (688 Tests, 11,4 min), `rls` Lauf 42 rot (zwei Fehler in `job-photos.test.ts`: Transportfehler der Management-API, `HttpClientError` beim POST an `/database/query`, kein Befund; 1738 s), unverändert wiederholt Lauf 43 grün (48 Dateien, 381 Tests).
rls-Wanduhr gegen 1200 s: Lauf 43 1065,2 s (unter 1200); der Lauf 42 brauchte 1738,2 s (über 1200, mit dem Transportfehler).

## 6. Fable und Zusatzaufrufe
Planprüfung 1 (Ja mit Änderungen), DB-Freigabe 1 (`tmp/proof/n12b/db-freigabe-1.md`, frei, M1 und M2 umgesetzt), Abnahme Runde 1 (`tmp/proof/n12b-abnahme-1.md`, hoch 0; M1 siehe 4, M2 nach OFFEN n12b-1, M3 in dieser Bewertung berichtigt). Kein Zusatzaufruf; keine Runde 2 (keine Pflichtdatei nach der Abnahme geändert, Hashes geprüft).

## 7. migration list
Lokal = remote bis `20261116130000`. SHA-256 der neuen Migration: `dc9c128f7edcdd416f73db695a64eaec93e5552024632549295bd9eb241b31f8` (`supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql`, wie im Antrag `tmp/proof/n12b/db-antrag-1.json`).
