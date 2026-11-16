# Bewertung n12 · Kennung n12-1611-a

Modell der Hauptsession: Sonnet 5.5 (`claude-sonnet-5-5`). Feld `effort` (aus den Sitzungsdaten, `get_session self`): `high`. Feld `perTurnEffort`: im Transkript dieser Session nicht abrufbar (die Sitzungsdaten liefern nur `effort`; die Turn-Marker der Nachrichten zeigten durchgehend 10); nicht erfunden.

## N-12: Tabelle, wirkt eine Wiederholung nach verlorener Antwort doppelt?

„Gelesen“ = von der Hauptsession im Quelltext nachgelesen. „Explore“ = Befund des Explore-Agents, nicht einzeln nachgelesen. Fundstellen: neueste Fassung der Funktion.

| Aktion | Weg (App → Function → SQL) | Zweiter gleicher Aufruf heute (vor n12) | Schutz | Nach n12 |
|---|---|---|---|---|
| Anfrage anlegen (gleicher Inhalt) | `src/lib/quote.ts:152` → `quote` → `quote_save_request` (0020:150-266) · gelesen | vorhandene Zeile, `created=false`, keine neue Revision (0020:188-192, 246-252) | `unique (customer_id, client_ref)`, `refFor` behält die Ref bei gleichem Inhalt | unverändert, idempotent |
| Anfrage anlegen (Fotosatz oder Eingaben geändert) | `Zusammenfassung.tsx:241-291`, `refBody` (`quote.ts:58`) · gelesen | **doppelt:** neue Ref = zweite verbindliche Anfrage, die erste behält das entfernte Foto und ist für Partner sichtbar | keiner | App merkt alle Refs, liest vor Upload und Senden die eigenen aktiven Anfragen (`findSentRequest`), bei Treffer Hinweis statt Senden, bei Lesefehler kein Senden (E2E `fotos.spec.ts`, Rot-Beweis per Mutation). Restfenster: OFFEN n12-3 |
| Annahme durch Partner | `partnerJobs.ts:195` → `accept` (`jobs/handlers.ts:85`) → `partner_accept_basis` / `partner_accept` (0062:349-429) · gelesen | keine Zweitbuchung (`already_taken` 409; Journal `commission_one_booking`, `assignments_active_one`), aber die Antwort (assignmentId) ging verloren und die Firma sah „vergeben“ | Status, unique-Indizes | Wiederholung derselben Firma mit gleicher Revision und Auszahlung: 200 mit derselben assignmentId (0067 `partner_accept_replay`); `rls` `accept-replay.test.ts`, live `flow-live.test.ts` |
| Festangebot bestätigen | `offer-confirm` → `confirm_offer` (0062:452-518) · Explore | idempotent: Status `confirmed` → 200 | Statusprüfung | unverändert |
| Nachtrag entscheiden | `change-decide` → `decide_change` (0064:203-274; `handlers.ts:186`) · Explore | idempotent: gleicher Status → 200; Journal `commission_change_once` | Statusprüfung, unique | unverändert |
| Meldung „nicht stattgefunden“ | RPC `report_not_done` (0066:72-91) · Explore | idempotent: `private.report_gate` liefert `reported` → return, Zeitstempel bleibt | Statusprüfung | unverändert |
| Konto löschen | `delete-account` → `delete_account` (0066:10-67) · Explore | idempotent in der DB (`deleted_at` gesetzt → return); die Sitzung ist danach ungültig (401 vor der DB) | Statusprüfung | unverändert |
| Storno Kunde | `cancel-customer` → `cancel_by_customer` (0062:680-748) · Explore | keine Zweitbuchung (409 `invalid_transition`, Gegenbuchung nur im Erststorno), aber 409 trotz Erfolg | Status | OFFEN n12-2 |
| Storno Partner | `cancel-partner` → `cancel_by_partner` (0062:752-827) · Explore, vom Berater gelesen | nicht gemessen; erwartet 409, keine zweite `cancellation_fee`-Zeile (`set_request_status` vor den Buchungen) | `change_gate`, Status | OFFEN n12-2 (messen, bei zwei Zeilen anhalten) |
| Angebot abgeben | RPC `send_offer` (0062:522-578) · Explore | Fehler `offer_exists`, keine Zweitzeile | `unique partner_offers_one_sent` (0038:31) | OFFEN n12-2 (409 trotz Erfolg) |
| Angebot / Nachtrag zurückziehen | `withdraw_offer` (0038:571-590), `withdraw_change` (0041:124-148) · Explore | Fehler `invalid_transition` | Status | OFFEN n12-2 |
| Nachtrag vorschlagen | `change-propose` → `propose_change` (0041:5-48) · Explore | Fehler `change_open`, keine Zweitzeile | `price_revisions_one_open_change` (0040:27) | OFFEN n12-2 |
| Anfrage zurückziehen, Start, Abschluss | `withdraw` (0017:249-273), `start_job`, `complete_job` (0064:67-118) · Explore | Fehler `invalid_transition` | Status | OFFEN n12-2 |
| Beleg hochladen | `photo-receipt` → `photo_receipt_add` (0035:311-323), Pfad = neue UUID (`photo/db.ts:13`) · Explore | **doppelt:** zweite Datei und zweite Zeile in `job_photos` | nur `receipt_limit` (kein Geld) | OFFEN n12-1 (Dedupe über `(request_id, sha256)` mit der Belege-Migration S9i7-12) |
| Admin-Kontakt, Admin-Foto | `admin_contact`, `admin_photo` · Explore | Lesen mit Audit-Zeile je Aufruf | – | kein Zustandswechsel, nicht Teil von N-12 |

## Lösung (Planprüfung Fable, `advisor`)
Kein Schlüssel-Speicher. Anfrage und Annahme haben schon einen natürlichen Schlüssel (`clientRef`; Listing mit Firma, Revision und Auszahlung). Eine Antwort-Tabelle brächte Ablauf, Bereinigung und Akteursbindung als neue Angriffsfläche ohne Mehrwert; ein stabiler Entwurfsschlüssel scheitert am Foto-Staging (Pfad `{uid}/{clientRef}/…` ist nach dem Speichern gesperrt). Die Anfrage bleibt in der App (GOLIVE 23, A1), die Annahme bekam eine lesende Funktion. Abweichung vom Auftrag „Schlüssel je Aktion erzeugen und mitsenden“: kein neuer Schlüssel, `clientRef` und das Tripel (Listing, Revision, Auszahlung) sind der Schlüssel; der E2E-Fall „Antwort verloren, erneut senden“ läuft je Aktion.

## n15-3 (Live-Test zurück im Volllauf)
`tests/rls/auth-token-codes.test.ts` (aus `tmp/n15-auth-token-codes.test.ts`, dazu der Code `undefined` beim falschen Schlüssel ausdrücklich geprüft). Rot-Beweis per Mutation von `auth.ts` (danach zurückgesetzt, `auth.ts` ist gegenüber main unverändert): Lauf 001 ohne `bad_jwt` (gefälscht → wirft statt `null`), Lauf 002 ohne Typzweig `AuthSessionMissingError` (gelöschtes Konto), Lauf 003 grün. `session_expired`, `user_not_found`, `user_banned` sind nicht erzeugbar, dort gilt nur die Unit-Tabelle. Live-Smoke 13 Functions × 2 wieder im Volllauf.

## Rot-Belege und Läufe (`tmp/proof/n12/`)
- Annahme-Probe `accept-replay`: Lauf 004 und 009 rot (Funktion fehlt, 42883; „Annahme“ und „Zuordnung beenden“ ok), nach dem Push Lauf 010 grün; Lauf 019 grün nach dem Fund M1 der Abnahme.
- Handler: Lauf 005 grün, Lauf 006 rot. Mutation: in `handleAccept` `if (!assignmentId) throw e` → `if (assignmentId) throw e` (drei Fehlschläge: 409 statt 200 bei Treffer, 200 statt 409 bei null). Nicht rot gezeigt: „Nachfrage nur bei `already_taken`“ und „Fehler der Nachfrage → 500“ (grün im Unit-Test, Lauf 018).
- App: `fotos.spec.ts` Lauf 008 rot (Fehler im Test, kein App-Befund: `quoteCalls` zu früh gelesen), Lauf 014 grün, Lauf 015 rot mit abgeschalteter `findSentRequest` (zwei neue Fälle rot), Lauf 013 `partner-anfragen.spec.ts` grün.
- Volläufe auf dem Endstand 4c3c0a7: `check` Lauf 020 (1923 Tests), `e2e` Lauf 021 (688 Tests, 11,2 min), `rls` Lauf 022 rot (ein Transportfehler der Management-API in `booking-open.test.ts`, kein Befund, 1396 s), Lauf 023 grün (46 Dateien, 379 Tests).
- rls-Wanduhr gegen 1200 s: Lauf 023 1179,7 s (unter 1200); der unverändert wiederholte Lauf 022 brauchte 1396,3 s bis zum Fehler (über 1200 s).
- Live-Aufruf `accept`: `flow-live.test.ts` Lauf 011 (19 Tests): Wiederholung liefert dieselbe Antwort, andere Auszahlung 409, Journal eine Zeile.

## Abweichungen und Korrekturen
- Deploy: Das Deploy-Log nennt drei nicht neu deployte Functions (`offer-confirm`, `admin-contact`, `outbox-send`). Richtig (Abnahme N2): alle Functions, die `_shared/jobs/handlers.ts` und `db.ts` laden (auch cancel, change, account, admin, photo), enthalten die geänderten Dateien; geändert sind nur `AcceptDeps`, `handleAccept` und `acceptDb`, die allein `accept` benutzt. Deployt ist nur `accept` (Version 7). Hashes seit dem Deploy unverändert: `handlers.ts` 2ef0aada…, `db.ts` f5c0443f… (identisch mit der Abnahme).
- Abnahme Runde 1: hoch 0; M1 (Rechteprobe misst die Tabelle) behoben (feste Zufalls-IDs, Meldung `permission denied for function partner_accept_replay` für `authenticated` und `anon`, Lauf 019 grün); N5 behoben (Basis-Aufrufe gezählt, `amount_mismatch`). Die Pflichtmenge blieb unverändert, keine Runde 2 nötig. N4 (Typ von `replay` mit null), N7 (assignmentId gegen die Zeile) in OFFEN n12-4.
- Gate-Datei: `tests/support/positiv.ts` (Eintrag `partner_accept_replay`) und neuer Hash in `scripts/sys/loesch-register.json` (Lauf 016 rot, 017 grün).
- Keine neuen Entscheidungen von Beks. Eine fachliche Frage (Hinweistext) steht in `docs/BEKS.md` Frage 1 mit Empfehlung.
- Kein Diff der Gate-Dateien als Nachweis abgelegt (Abnahme N9, wie in n15).

## Zusatzaufrufe
Planprüfung 1, DB-Freigabe 1, Abnahme Runde 1. Kein Zusatzaufruf über das Regelmaß.
