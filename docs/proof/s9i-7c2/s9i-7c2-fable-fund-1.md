Modell: claude-fable-5-2

**Entscheidung: ja mit Änderungen.** Der Fund ist ein echter Serverfehler, der Fix als Migration 0061 ist richtig und kommt als erster Schritt in s9i-7c2, vor dem Rest und vor s9p-1. Die Dev-Datenbank und die Edge-Logs konnte ich nicht abfragen; alles Folgende stammt aus Migrationen, Code und Tests.

1. **Echter Fehler, nur diese eine Funktion.** `price_revisions.total_cents` ist `int` (0018:19), `partner_accept_basis` deklariert `bigint` und liefert `rev.total_cents` ohne Cast, in allen drei Fassungen (0031:102, 0034:47, 0038:382). Alle anderen plpgsql-Funktionen mit `return query` und `bigint` casten oder liefern echte `bigint`-Werte: `confirm_offer_basis`, `propose_change_basis`, `decide_change_basis`, beide `cancel_*_basis`, `admin_correct_basis`, `my_jobs`, `my_job_changes`, `outbox_claim`. `language sql`-Funktionen sind nicht betroffen, weil sie den Rückgabewert selbst umwandeln.

2. **Warum unbemerkt.** Kein Test ruft `partner_accept_basis` funktional auf. `tests/rls/rls.test.ts:494` prüft nur die Rechte, alle RLS-Tests rufen `partner_accept` direkt per SQL mit selbst gerechnetem Split, `tests/unit/accept.test.ts` nutzt Attrappen, und `tests/e2e/jobs-helpers.ts:252` fängt `/functions/v1/accept` ab. `accept` hatte vor `flow-live` keinen Live-Test.

3. **Schwere: Verfügbarkeit hoch, Geld und Rechte ohne Schaden.** Die Festpreis-Annahme über die Function (App: `src/lib/partnerJobs.ts:209`) kann seit 0031 nie 200 geliefert haben. Der Fehler fällt vor `partner_accept`, also ohne Journalzeile und ohne Statuswechsel, und die Antwort ist das generische `internal`. Die Fehlerwege vor dem `return query` (401, 403, 404, `offer_required`, `expired`) antworten korrekt. `offer-confirm` ist nicht betroffen (Cast vorhanden, Basis direkt getestet in `tests/rls/offers.test.ts:210`).

4. **Reihenfolge.** Der Fix kommt vor dem Rest von s9i-7c2, weil der Durchgangstest sonst nicht grün werden kann. Er kommt auch vor s9p-1, weil die Staffel vermutlich `current_fee` und die Basis anfasst und eine grüne, live getestete Annahme als Ausgangslage braucht. Eine eigene Session lohnt nicht: ein eigener Commit auf `s9i-7c2` vor dem Durchgangstest-Commit reicht.

**Auflagen**

1. Migration 0061 enthält nur `create or replace function public.partner_accept_basis(p_actor uuid, p_listing uuid)`. Der Rumpf ist wortgleich zu 0038:359-384, einzige Änderung `rev.total_cents::bigint`. Kein `drop`, keine neuen Rechte, keine Änderung an Spaltentypen, kein Seed.
2. Rot zuerst: neuer Test in `tests/rls/listings.test.ts` (Block „Annahme“), der die Basis als service_role aufruft. Er erwartet genau eine Zeile mit Revision, Festpreis, Satz und Versionen, dazu `not_found` für eine fremde Firma und `offer_required`.
3. Dieser Test läuft vor `db:push` gegen Dev und muss mit dem Ist-Wert 42804 rot sein, danach grün. Beide Logs mit `EXIT=` gehen nach `docs/proof/s9i-7c2/`.
4. `tmp/reports/flow-live-ist.txt` (Lauf 1614eaf, DIAG-Zeile) wird vor dem nächsten Lauf unverändert nach `docs/proof/s9i-7c2/` kopiert. Der neue Lauf schreibt in eine neue Datei.
5. Die DIAG-Zeile in `tests/rls/flow-live.test.ts:155` wird nach dem Fix entfernt; die Abdeckung liegt dann in `listings.test.ts`.
6. Nach dem Push: `db:types` ohne Diff, `test:rls` komplett (einschließlich Rechte-Test `rls.test.ts:494`), `check` und `flow-live` grün. Im Durchgangstest muss W1 erst 409 `payout_changed` liefern, dann 200 mit einer `booking`-Zeile gleich `BOOKED`, und Firma b 409.
7. Doku: `docs/ARCHITECTURE.md:149` um 0061 ergänzen. Ein OPEN_ISSUES-Eintrag hält fest, dass `accept` seit 0031 mit 500 antwortete und mit 0061 behoben ist. Ein zweiter, offener Eintrag nennt `offer-confirm`, `cancel-customer` und `admin-correct` als Functions ohne Live-Aufruf in `tests/rls` (jetzt nicht bauen). In AUTOPILOT kommt die Entscheidung, dass s9i-7c2 entgegen „Server unverändert“ eine Migration enthält; das gehört auch in den Bericht an Beks.
8. 0061 und der neue Test gehören in die Abnahme vor dem Commit. s9p-1 beginnt mit Migration 0062 und übernimmt den Cast, falls es die Basis ersetzt.

**Risiko, das die Hauptsession testen muss:** Nach 0061 läuft die Kette Function → `partner_accept` zum ersten Mal echt durch. Dahinter können weitere Fehler liegen, etwa `rate_mismatch` durch den Umweg des Satzes über `Number()` oder die Form des `uuid`-Rückgabewerts in `must`. Bleibt `accept` nach zwei Runden rot, geht die Frage mit dem `accept_failed`-Log zurück an Fable, ohne die Prüfungen in `partner_accept` zu lockern.
