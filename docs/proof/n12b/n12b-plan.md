# Plan n12b (R3) · Kennung n12b-1611-a

Ziel: Wiederholung derselben Partei nach Erfolg liefert das erste Ergebnis (200) statt 409; doppelte Pauschale ausschließen; deployten Stand angleichen.

## Fakten (selbst nachgelesen, Datei:Zeile)
- cancel_by_partner (letzte Fassung 0062:775-827): erst `private.change_gate` (0064:176-199: sperrt Anfrage `for update`, verlangt aktive Zuordnung der Firma, sonst `not_found`; Status accepted/in_progress, sonst `invalid_transition`), dann `set_request_status` (Z. 801), Zuordnung beendet (802), Gegenbuchung, Pauschale `commission_book(... 'cancellation_fee' ...)` nur bei `base > 0` (804-807), Audit `cancel_by_partner` mit `detail.call_out_cents = base` (809-811). Zweiter Aufruf: Zuordnung beendet → `not_found` bevor irgendeine Buchung. Das bestehende Probe-Test-Zeile `R1 Wiederholung` (cancellation-partner.test.ts:111,183) belegt `not_found` nur für base = 0; mit Pauschale ist es nicht gemessen.
- Handler `cancel/partner.ts:42-90`: `deps.basis` (cancel_by_partner_basis → change_gate) wirft beim zweiten Aufruf `not_found`; STATUS 404.
- cancel_by_customer (0062:703-747): Status nicht accepted/in_progress → `invalid_transition` (720); Audit `cancel_by_customer` mit `detail.fee_base_cents` (743-744), Akteur = p_actor. Handler `cancel/handlers.ts:49-76`.
- send_offer (0062:522-578, App ruft per RPC als authenticated, kein Handler): zweiter Aufruf endet an `offer_exists` (563-565), vorher unverändert gültige Prüfungen (Firma, Listing `open`, Anfrage `awaiting_offer`/`offered`, Frist).
- propose_change (0041:5-48, über `change-propose`): zweiter Aufruf endet an `change_open` (Z. 23); `current_revision` ändert sich beim Vorschlag nicht.
- withdraw_offer, withdraw_change (0041:124-148), withdraw (0017:249), start_job/complete_job (0064:67-118): reine Statuswechsel mit `invalid_transition`; App-RPC ohne Handler.
- Fehlercode der Functions = Meldung der Exception (`jobs/db.ts:10-14`); Deadlock hieße dort `deadlock detected`, `error.code` (40P01) geht verloren. `account/db.ts:8-12`.
- `authed` (`jobs/handlers.ts:53-59`) und `handleJobPhoto` (`photo/handlers.ts:132-133`) prüfen die Form des Tokens nicht; `quote` tut es (`quote/handler.ts:34,214`).
- Positivzeilen-Register ist an `database.types.ts` gebunden (`tests/support/positiv.ts`): neue public-Funktion braucht Eintrag, sonst `check` rot.

## Plan
1. Messung (neue Datei `tests/rls/replay.test.ts`, Rollback-Probe): zweimal derselbe `cancel_by_partner` mit Pauschale (S1-Aufbau wie cancellation-partner.test.ts:231-244) nacheinander: erwartet `not_found`, genau eine `cancellation_fee`-Zeile, Summen unverändert. Dasselbe für `cancel_by_customer` mit Stufe > 0. Bei zwei Zeilen: Stopp.
2. Migration 0068:
   a. `public.cancel_replay(p_actor uuid, p_request uuid, p_action text) returns bigint` (stable, security definer, search_path leer, nur service_role): liefert den Betrag des ersten Erfolgs aus dem Audit (`fee_base_cents` bzw. `call_out_cents`), wenn eine Audit-Zeile `action = p_action`, `actor_id = p_actor`, `entity_id = p_request` existiert und die Anfrage jetzt `cancelled_by_customer` bzw. `cancelled_by_partner` ist, sonst null. Nur lesend.
   b. `send_offer` (create or replace, Rechte bleiben): statt `offer_exists` die Id des vorhandenen Angebots derselben Firma, wenn `amount_cents = p_amount`, `base_revision_id = aktuelle Revision`, `status = 'sent'`, `valid_until > now()`; sonst `offer_exists`. Keine neue Zeile, keine Mail.
   c. `propose_change` (create or replace): statt `change_open` die Id des offenen Nachtrags, wenn derselbe Vorschlag (proposed_by = pid, base_revision_id = p_base, total_cents = p_total, inputs gleich, Fotos als Menge gleich, valid_until > now()) vorliegt; sonst `change_open`. Keine neue Zeile, keine Mail.
   d. `my_report_info` (N8): gelöschtes Profil → `not_found` wie `report_not_done`.
3. Handler: `deps.replay` in cancel-customer (bei `invalid_transition`) und cancel-partner (bei `not_found`/`invalid_transition`, nur ohne Vorschau): bei Betrag = gezeigter Betrag 200 mit gleichem Ergebnis `{status, cancelFeeCents|callOutCents}`, sonst der ursprüngliche Fehler.
4. n15-1: N1 `JWT_FORM` in `authed` und `handleJobPhoto` (401 ohne Auth-Aufruf; vorher live messen), N2 `session_not_found` in die Codeliste, N3 Status und Code in `auth_service_error` loggen (nur `[a-z_]{1,40}`), N4 Unit-Zeile, N5 Smoke prüft `unauthorized`, N7 Wiederholung bei 40P01 einmal in `accountDb.remove`, N8 siehe 2d, N9 Diff der Gate-Dateien als Nachweis. N6 (Wartezeit-Beleg im Wettlauftest) bleibt in OFFEN: eigener Testentwurf, kein Fehler.
5. Rest von n12-2 (withdraw_offer, withdraw_change, withdraw, start_job, complete_job) bleibt in OFFEN: je eine SQL-Änderung an App-RPCs, Größe des Schritts.
6. Deploy aller 14 Functions (`accept, admin-contact, admin-correct, cancel-customer, cancel-partner, change-decide, change-propose, delete-account, job-photo, offer-confirm, outbox-send, photo-publish, photo-receipt, admin-photo`), Smoke 401, `flow-live`, `functions list`.

## Frage an den Berater (eine, gebündelt)
Tragen diese Bedingungen sicher? (1) Audit als Quelle des ersten Ergebnisses beim Storno, Akteur = dieselbe Person (nicht jedes Mitglied der Firma); (2) Replay in `send_offer`/`propose_change` mit den genannten Gleichheitsbedingungen, ohne neue Zeile und Mail; (3) Wiederholung bei 40P01 in `accountDb` statt die Sperrreihenfolge in `delete_account` zu ändern; (4) `JWT_FORM` in `authed`. Bitte jede Lücke in Geld oder Rechten nennen.
