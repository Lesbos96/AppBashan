Modell: claude-fable-5-2

# DB-Freigabe 1, Schritt mail1 (R3)

Datum: 2026-11-18
Antrag: `tmp/proof/mail1/db-antrag-1.json` (eine Migration)
Geprüft: die Migration vollständig (173 Zeilen), gegen `.claude/rules/daten.md`, `.claude/rules/geld.md`, die Auflagen des Plans aus dem Auftrag und die Bezugsmigrationen 0017, 0018, 0023, 0030, 0031, 0036, 0047, 0064, 0066, 0069, 0070, 0071. Dazu gelesen: `tests/rls/en-route.test.ts`, `supabase/functions/_shared/jobs/handlers.ts:283-329`, ENTSCHEIDUNGEN Nr. 175 und 203, OFFEN web1-1 und S9c-3.

SHA256: 470fb62520bfc0049ae90f0e2f413f6775d2b8391fcd3c4310c46723f3192ade supabase/migrations/20261118071002_0074_mail1_unterwegs.sql

Der Hash ist aus dem Antrag abgeschrieben und stimmt mit dem Hash im Auftrag überein. Selbst nachgerechnet habe ich ihn nicht (kein Werkzeug dafür); das Gate vergleicht ihn beim Push mit der Datei.

Urteil: frei

Nicht ausgeführt: Ich habe die Migration nur gelesen, nicht gegen eine Datenbank laufen lassen. Aussagen zu Dev-Daten (842 wartende Zeilen) stützen sich auf die Angabe im Auftrag und auf die bisherigen Constraints, nicht auf eine eigene Abfrage.

## Findings

### Hoch
Keine.

### Mittel
Keine.

### Niedrig
- N1 · `supabase/migrations/20261108190000_0036_outbox_harden.sql:66` (unverändert, nicht Teil von 0074) – `outbox_dispatch` ruft die Function weiter bei jedem Cron-Lauf auf, solange eine wartende Zeile mit weniger als fünf Versuchen existiert, auch wenn sie noch im Wiederholungs-Abstand liegt (bis 16 Std.). Der Aufruf holt dann nichts; kein Fehlverhalten, nur leere HTTP-Aufrufe. – Fix (später, eigene Migration): dieselbe Bedingung wie in `outbox_claim` (0074:147-148) in die Vorprüfung nehmen. Nach OFFEN.
- N2 · `0074:28` – Die Wiederholung von `set_en_route` ist an die Firma gebunden, nicht an die Person (anders als `start_job`, 0069:60-63). Vertretbar: der Zweig schreibt nichts und liefert nur die Zeit, die jedes aal2-Mitglied der zugeordneten Firma über `my_jobs` ohnehin sieht; er liegt hinter aal2, Firma und Zuordnung. – Kein Fix; der Kommentar 0074:8-9 nennt es bereits.
- N3 · `0074:28-33` – Die Ankunftszeit ist einmalig und nicht korrigierbar (Vertipper der Firma bleibt stehen); erlaubt ist sie ab 00:00 Wiener Zeit des Termintags bis Mitternacht, auch nach `termin_at`. Je Auftrag höchstens eine Mail an den Kunden (Dedupe-Schlüssel, Audit mit Person), Missbrauch dadurch begrenzt. Nr. 203 regelt weder Korrektur noch Uhrzeit. – Kein Fix in dieser Migration; als Punkt nach OFFEN, falls Beks eine Korrektur will.
- N4 · `supabase/functions/_shared/jobs/handlers.ts:288` gegen `0074:168` – Der Handler kennt den Code `setting_missing`, `outbox_mark` bildet ihn auf den allgemeinen Fehlercode ab (die Liste und der Check `outbox_last_error_code`, 0036:9-10, kennen ihn nicht). Kein Verstoß, nur weniger Diagnose. – Fix optional: Code im Handler streichen oder später Check und Liste gemeinsam erweitern.
- N5 · Betrieb, nicht Migration – Die 842 wartenden Altzeilen werden abgearbeitet, sobald der Versand auf Dev eingerichtet ist. Empfänger mit reservierter Endung überspringt der Handler und markiert sie als gesendet (`handlers.ts:319-326`); Zeilen an echte Adressen gingen als veraltete Mails hinaus. – Vor dem Setzen der Vault- und Function-Secrets prüfen, ob echte Adressen darunter sind; Aufräumen nur über das Lösch-Gate.

## Prüffragen aus dem Auftrag

1. Auflagen des Plans
   - `p_minutes` null oder ungültig als erste Prüfung, Fehler `invalid_minutes`: erfüllt (0074:19, vor Konto, aal2 und Firma).
   - `my_jobs` mit `can_en_route`: erfüllt (0074:65-66, 83-85). Bedingung deckungsgleich mit `set_en_route` (Zuordnung offen, Status `accepted`, keine Meldung, Zeit leer, Wiener Termintag).
   - Empfänger `operator` mit leerem `recipient_id`: erfüllt (0074:107-110), genau-dann-Check.
   - Abstand 15 Min. × 4^(Versuche − 1) in `outbox_claim`: erfüllt (0074:147). `power(4, int)` löst auf die float8-Fassung auf, der Cast bindet vor der Multiplikation, `interval * float8` existiert. Versuche 1 bis 4 ergeben 15 Min., 1 Std., 4 Std., 16 Std.; Versuch 0 und Altzeilen ohne `claimed_at` sofort. Wartende Zeilen blockieren die Reihenfolge nicht (Filter vor `limit`).
   - `outbox_mark` behält `claimed_at` bei Fehlschlag: erfüllt (0074:165); bei Erfolg und beim fünften Fehlversuch wird es geleert.
   - `report_not_done` legt `report_new` an: erfüllt (0074:131); Rumpf sonst zeilengleich mit 0066:72-91. Eine zweite Meldung kehrt vor dem Einfügen zurück (0074:126), dazu der Dedupe-Schlüssel je Anfrage.
   - `set_en_route` nur `grant execute to authenticated`: erfüllt (0074:41), kein weiteres Grant.

2. Rechte
   - `set_en_route` und das neu angelegte `my_jobs` bekommen nach 0070:7 und 0071:7 kein automatisches EXECUTE; ausdrücklich nur `authenticated` (0074:41, 0074:99). PUBLIC, anon und service_role bleiben ohne. Der Entzug für service_role aus 0066:94-97 muss nach `drop` plus `create` nicht wiederholt werden.
   - `report_not_done`, `outbox_claim`, `outbox_mark`: `create or replace`, Rechte bleiben (authenticated nach 0042:149-150 ohne service_role nach 0066:94-97; Outbox-Funktionen nur service_role nach 0031:242-247).
   - Keine Rechte-Ausweitung an Tabellen: kein neues Grant, keine neue Policy.

3. `search_path`: alle fünf Funktionen SECURITY DEFINER mit `set search_path = ''`, alle Objekte schemaqualifiziert (0074:11, 68, 114, 139, 160).

4. Constraintnamen
   - `outbox_kind_check` existiert unter diesem Namen (zuletzt 0047:5-9 neu angelegt, danach keine Änderung in 0048 bis 0073).
   - `outbox_recipient_kind_check` ist der automatische Name des Spalten-Checks aus 0030:105; dasselbe Namensmuster ist für `kind` (0035:9) und `status` (0034:180) durch erfolgreiche Drops belegt.
   - `outbox_recipient_id_check` ist neu, kein Namenskonflikt (`recipient_id` hatte nur NOT NULL, 0030:106).
   - Die Liste der Arten in 0074:104-106 ist die aus 0047:7-9 plus `en_route` und `report_new`, nichts entfernt.

5. Rückgabetypen bei `create or replace`: `report_not_done` void (wie 0066:72), `outbox_claim` dieselbe Tabelle mit sechs Spalten in gleicher Reihenfolge und gleichen Typen (wie 0036:23), `outbox_mark` void (wie 0036:43). `my_jobs` ändert den Typ und wird deshalb richtig per `drop` plus `create` ersetzt; abhängige Views oder Funktionen gibt es in den Migrationen nicht.

6. Bestehende Dev-Daten
   - Neue Spalte: nullable, kein Default, kein Rewrite.
   - Die drei Checks prüfen Altzeilen: alte Arten und Empfängerarten sind Teilmengen der neuen Listen; `recipient_id` war bis zu diesem Moment NOT NULL und `recipient_kind` nie `operator`, der genau-dann-Check ergibt für jede Altzeile wahr (nie null, weil `recipient_kind` NOT NULL ist).
   - Keine Anweisung, die außerhalb einer Transaktion laufen muss; scheitert eine, bleibt nichts halb angewendet. Kein Seed, kein Datenupdate.
   - Wartende Altzeilen mit Versuchen und leerem `claimed_at` werden sofort wieder geholt (0074:147), also kein Stau durch die neue Bedingung.

7. Kundensicht der neuen Spalte
   - SELECT auf `service_requests` ist tabellenweit für `authenticated` (0001:302), die Policy lässt nur die eigene Zeile und admin zu (0016:191-192). Der Kunde liest `en_route_eta` der eigenen Anfrage, sonst niemand; anon hat kein Grant. Die Firma liest die Tabelle nicht direkt, sondern über `my_jobs`.
   - Schreiben: kein UPDATE-Grant für `authenticated` (0017:243), service_role nur `current_revision` (0018:122-123), kein INSERT-Grant für Konten. Die Spalte setzt nur `set_en_route`.
   - Trigger beim Update: `guard_request_status` (Status unverändert, kehrt zurück), `guard_request_fields` (0018:168-179, Termin, Frist, Bezirk unverändert), `guard_request_pointer` (unverändert); die Status-Trigger feuern nur bei Statusänderung. Kein Trigger sperrt das Update.

8. Geld: keine Betragslogik in der Migration. `my_jobs` liefert `total_cents` und `payout_cents` unverändert nur der eigenen Firma mit aal2 (0074:73-76, 94), keine Gebührenspalte. Die Outbox-Zeilen tragen nur Art, Empfänger und Anfrage-ID, keinen Betrag. Der Audit-Eintrag enthält nur die Minuten. Kein Gebühren- oder Betragsleck.

9. Akteur und Nebenläufigkeit
   - Akteur von `set_en_route`: aal2-Mitglied einer aktiven oder zahlungsgesperrten Firma mit offener Zuordnung (0074:20-27), Muster `start_job`. Fremde Firma und unbekannte Anfrage liefern denselben Fehler (kein Existenz-Orakel). Kein neuer Status, also kein Statusübergang ohne Funktion.
   - Sperre der Anfragezeile vor allen Prüfungen (0074:24): gleichzeitige Aufrufe, Meldung des Kunden und Absage der Firma laufen nacheinander; der zweite Aufruf sieht die gespeicherte Zeit.
   - `termin_at` ist NOT NULL (0018:114), der Tagesvergleich 0074:31 kann nicht durch null durchfallen.

10. Folgepflichten im selben Schritt (nicht Teil dieser Freigabe, Prüfung in der Abnahme): Edge Function `outbox-send` nach dem Push neu deployen (`daten.md`, Datenbank-Weg), `db:types` läuft mit dem Push; Register `tests/support/positiv.ts` für `set_en_route`; Rot- und Grün-Lauf von `tests/rls/en-route.test.ts`.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0074:19` | Minutenprüfung ist die erste Anweisung im Rumpf, null eingeschlossen |
| `0074:41`, `0074:99` | je genau ein Grant, nur `authenticated` |
| `0070:7`, `0071:7` | Default-Rechte für neue Funktionen von postgres entzogen (Rollen und PUBLIC) |
| `0069:43-69` | `start_job`: Reihenfolge Konto, aal2, Firma, Sperre, Zuordnung stimmt mit 0074:20-27 überein |
| `0064:122-172` | `my_jobs`: Rumpf in 0074:46-97 identisch, zwei Spalten am Ende ergänzt |
| `0066:72-91` | `report_not_done`: Rumpf identisch, eine Zeile mehr (0074:131) |
| `0066:94-97` | service_role ohne EXECUTE auf `report_not_done`; bleibt durch `create or replace` |
| `0036:22-56` | `outbox_claim`/`outbox_mark`: Signatur und Rückgabe gleich, Änderung nur in der Bedingung und bei `claimed_at` |
| `0031:19-25` | `outbox_put` reicht den Empfänger ungeprüft durch, null ist möglich; Dedupe über `on conflict do nothing` |
| `0031:242-247` | Outbox-Funktionen nur für service_role |
| `0030:101-113`, `0030:119-123`, `0030:140` | Outbox: RLS an, kein DML für Konten, Lesen nur admin |
| `0034:179-181` | `claimed_at` und Status `sending` vorhanden |
| `0047:5-9` | letzte Fassung von `outbox_kind_check`, Liste verglichen |
| `0001:302`, `0016:191-192` | Kunde liest nur die eigene Anfragezeile |
| `0017:243`, `0018:122-123` | kein UPDATE auf die neue Spalte für Konten oder service_role |
| `0018:114` | `termin_at` NOT NULL |
| `0018:168-179` | `guard_request_fields` sperrt das Update der neuen Spalte nicht |
| `0023:97-102` | `my_job_partner_id`: aal2, Firma `active` oder `payment_hold` |
| `0015:19-28` | `audit_log`: Rolle `partner` erlaubt, `action` frei |
| `handlers.ts:314-326` | Handler kennt den Empfänger `operator` und leere Empfänger-ID |
| `tests/rls/en-route.test.ts:55`, `:96` | Test misst die Rechte aller vier Rollen an der neuen Funktion |
| `tests/rls/en-route.test.ts:142-143`, `:149-150` | Test misst den genau-dann-Check in beide Richtungen |

Offene Findings hoch: 0
