Modell: claude-fable-5-2

# DB-Freigabe fh1, Runde 1

Datum: 2026-11-16
Antrag: tmp/proof/fh1/db-antrag-1.json (eine Migration)
Umfang: `supabase/migrations/20261116140000_0069_replay_rest.sql` vollständig (164 Zeilen), verglichen mit den jeweils letzten Fassungen der fünf Funktionen; dazu Statustor, Akteur-Quellen, Rechte und die Testdatei `tests/rls/replay-rest.test.ts` als Beleg.

SHA256: f3110adde7fa947f18cc9ef417d1af47617fbe2929f07751a53527e31ba76d67 supabase/migrations/20261116140000_0069_replay_rest.sql

Urteil: frei

Zum Hash: aus dem Antrag abgeschrieben, nicht selbst berechnet (in diesem Lauf stand kein Shell-Werkzeug zur Verfügung, also kein sha256sum). Das Gate vergleicht ihn beim Push mit der Datei. Die Vergleichsdateien (0017, 0032, 0038, 0040, 0041, 0043, 0049, 0064, 0066, 0068) habe ich gelesen, aber nicht gehasht; sie tragen deshalb keine Hash-Zeile.

Zum Rumpfvergleich: Zeile für Zeile aus den gelesenen Dateien, nicht per Diff-Werkzeug. Abweichungen in Leerzeichen kann ich so nicht ausschließen, inhaltliche schon.

## Findings

### Hoch
Keine.

### Mittel
Keine.

### Niedrig
- `supabase/migrations/20261116140000_0069_replay_rest.sql:29-34` und `:83-87` – Ein gelöschtes Kundenkonto mit noch gültigem Token bekommt bei der Wiederholung von `withdraw` bzw. `complete_job` (Kundenzweig) jetzt Erfolg statt `invalid_transition`. Keine Schreibwirkung, zurück kommt nur der eigene, schon bekannte Status bzw. nichts. 0066 und 0068 behandeln das gelöschte Profil nur dort als nicht gefunden, wo geschrieben oder gelesen wird. – Kein Fix für diese Freigabe nötig; wer die Linie einheitlich will, nimmt es in `docs/OFFEN.md` auf.
- `supabase/migrations/20261116140000_0069_replay_rest.sql:151-152` – Die Audit-Suche (Aktion, Entität, Entitäts-Id, Akteur) hat keinen passenden Index (`0015_versions_published.sql:19-28` legt keinen an). Sie läuft nur im Wiederholungsfall, dann unter den Zeilensperren von Anfrage und Revision. Gleiches Muster wie `cancel_replay` in `0068:24-26`. – Kein Fix jetzt; wenn `audit_log` wächst, ein Index auf (entity, entity_id).
- `supabase/migrations/20261116140000_0069_replay_rest.sql:4-5` (Kommentar) – „hinter der Prüfung von aal2 und Firma“ stimmt für die drei Firmenwege; bei `withdraw` und im Kundenzweig von `complete_job` ist es die Prüfung `customer_id = uid` ohne aal2, wie in der bisherigen Fassung. – Kein Fix (eine Änderung der Datei würde den Hash ändern); nur zur Einordnung.
- Bestand, nicht von dieser Migration: `complete_job` antwortet einem fremden Konto ohne aal2 mit `mfa_required`, bei unbekannter Id mit `not_found` (`0064_report_flow.sql:100-106`, unverändert in `0069:81-91`; der Test hält es in `replay-rest.test.ts:155` fest). Damit lässt sich prüfen, ob eine Anfrage-Id existiert. Ids sind UUIDs. – Für `docs/OFFEN.md`, nicht für diese Freigabe.

## Prüffragen

### (1) Rümpfe identisch bis auf den Replay-Block, keine spätere Ersetzung
Ja. Suche über alle Migrationen nach Definitionen der fünf Funktionen:
- `withdraw`: einzige Definition `0017_status_machine.sql:249`. Neu nur `0069:30-34`.
- `start_job`: `0032:4`, zuletzt `0064:67`. Neu nur `0069:59-63`.
- `complete_job`: `0032:27`, `0043:4`, zuletzt `0064:90`. Neu nur `0069:84-87` (Kunde) und `0069:93-98` (Firma).
- `withdraw_offer`: einzige Definition `0038:571` (0039 und 0062 ersetzen sie nicht). Neu nur `0069:126-127`.
- `withdraw_change`: `0040:488`, zuletzt `0041:124`. Neu nur `0069:150-154`.

Signatur, Rückgabetyp, Sprache, `security definer` und `search_path = ''` sind je gleich; kein `alter function` auf eine der fünf in irgendeiner Migration, also setzt `create or replace` kein Attribut zurück. Alle neuen Bezüge sind schema-qualifiziert.

### (2) Kein 200 für Fremde oder ohne aal2, keine Doppelwirkung
Ja.
- `withdraw`: Replay nur innerhalb von `customer_id = uid` (`0069:29`), Status `withdrawn` und Statusereignis mit `actor_id = uid`, Rolle Kunde. Fremde und Firmen bekommen weiter `not_found`. aal2 gab es hier nie (Kundenweg).
- `start_job`: Replay nach `uid`, aal2, Firma (aktiv oder Zahlungssperre) und aktiver Zuordnung dieser Firma (`0069:51-58`); verlangt das Ereignis `in_progress` mit `actor_id = uid`, Rolle Firma. Ein anderes Mitglied bekommt weiter `invalid_transition`, eine fremde Firma `not_assigned`, aal1 `mfa_required`. Das Replay liegt bewusst vor `under_review`: Es meldet nur den schon erreichten Zustand, der erste Start nach einer Meldung bleibt gesperrt (`0069:64`).
- `complete_job` Kunde: nur bei `customer_id = uid` und eigenem Ereignis `completed` als Kunde. Hat die Firma oder das System abgeschlossen, bleibt `invalid_transition`.
- `complete_job` Firma: nach aal2 (`0069:91`); verlangt Firma nicht leer, Status `completed`, eigenes Ereignis als Firma und eine Zuordnung dieser Firma mit Ende `completed`. Anderes Mitglied, fremde Firma und gesperrte Firma bekommen weiter `not_found`. Nach einer Korrektur durch den Admin (Storno aus `completed`) ist der Status nicht mehr `completed`, also kein Replay.
- `withdraw_offer`: nach aal2 und `partner_id = pid` (`0069:120-123`; leere Firma ergibt `not_found`). Partei ist die Firma, jedes aal2-Mitglied; das ist dieselbe Berechtigung wie beim ersten Rückzug und entspricht `send_offer` in 0068. `partner_withdrawn` setzt nur diese Funktion (`0038:587`); die Enden `partner_status` und `partner_not_active` (`0039:115`, `0039:207`, `0062:480`) bleiben `invalid_transition`.
- `withdraw_change`: nach aal2, Firma und `proposed_by = pid` (`0069:144-147`); verlangt die Audit-Zeile mit `actor_id = uid`. Die System-Zeilen derselben Aktion tragen `actor_id` leer (`0041:96`, `0062:651`, `0064:249`) und treffen nie.

Die Beweise sind nicht fälschbar: `status_events` und `audit_log` sind nur anfügbar und werden nur von Trigger bzw. Definer-Funktionen geschrieben (`0017:165-197`, `0015:40-48`).

Der Zustand tritt je Anfrage höchstens einmal ein: Das Statustor (letzte Fassung `0049:16-41`) kennt keinen Weg aus `withdrawn`, keinen zurück nach `accepted` und aus `completed` nur in ein Storno. Das Ereignis des Akteurs gehört also zum aktuellen Zustand.

Keine Doppelwirkung: Jeder Replay-Block endet mit `return` vor `set_request_status`, vor dem Update der Zuordnung, vor `settle_offers`, vor `outbox_put` und vor dem Audit-Insert. Er enthält nur lesende Abfragen. Das Journal `commission_entries` berührt keine der fünf Funktionen, weder vorher noch jetzt. Geldregeln sind nicht betroffen: keine Beträge, keine Gebühr, Rückgabetypen unverändert.

### (3) Rechte
Ja. Die Migration enthält ausschließlich fünf `create or replace function`; kein `drop`, `grant`, `revoke` oder `alter`. Eigentümer und ACL bleiben. Stand der ACL:
- `withdraw`: `0017:278-279` (nur authenticated), service_role entzogen in `0066:94-97`.
- `start_job`, `complete_job`: `0032:112-113`, service_role entzogen in `0066:94-97`.
- `withdraw_offer`: `0038:738-744` (alles entzogen einschließlich service_role, dann nur authenticated).
- `withdraw_change`: `0040:564-574` (ebenso).

Keine Edge Function ruft eine der fünf Funktionen auf (Aufrufer nur in der App: `src/lib/jobs.ts:179`, `:201`, `src/lib/partnerJobs.ts:205`, `:294`, `src/lib/partnerChange.ts:203`). Aus dieser Migration folgt kein Neu-Deploy.

### (4) Sperrreihenfolge
Unverändert. Die Replay-Blöcke nehmen keine neue Sperre.
- `withdraw`: Update der Anfrage, danach nur Lesen.
- `start_job`, `complete_job`: Anfrage `for update` (`0069:55`, `:81`), dann Status und Zuordnung.
- `withdraw_offer`: Anfrage `for update`, dann Angebot `for update` (`0069:124-125`).
- `withdraw_change`: Anfrage `for update`, dann Revision `for update` (`0069:148-149`).

Nebenläufigkeit: Zwei gleichzeitige Aufrufe derselben Partei warten an der Zeilensperre der Anfrage; der zweite liest danach den neuen Stand und landet im Replay statt im Fehler. Bei `withdraw` findet das wartende Update keine Zeile mehr, die folgenden Abfragen sehen Status und Ereignis des ersten Aufrufs.

## Stichproben
- `0017_status_machine.sql:249-276` gegen `0069:9-41` – gleich bis auf `:30-34`.
- `0064_report_flow.sql:67-88` gegen `0069:43-69` – gleich bis auf `:59-63`.
- `0064_report_flow.sql:90-118` gegen `0069:71-109` – gleich bis auf `:84-87` und `:93-98`.
- `0038_partner_offers.sql:571-590` gegen `0069:111-132` – gleich bis auf `:126-127`.
- `0041_s9f_abnahme.sql:124-148` gegen `0069:134-163` – gleich bis auf `:150-154`.
- `0049_admin_correct.sql:16-41` – letzte Fassung des Statustors; die Aussage im Kopf von 0069 („je Anfrage nur einmal“) stimmt.
- `0017_status_machine.sql:153-161`, `:179-197` – `status_events` mit `actor_id`, `actor_role`; geschrieben nur vom Trigger aus den transaktionslokalen Einstellungen.
- `0031_distribute_accept.sql:5-17` – `set_request_status` setzt Akteur und Rolle, die das Ereignis trägt.
- `0023_partners.sql:81-102` – `my_member_partner_id` und `my_job_partner_id` verlangen aal2.
- `0015_versions_published.sql:19-48` – `audit_log` nur anfügbar, `entity_id` ist Text (passt zu `rev.id::text`).
- `0039_s9e_abnahme.sql:19` – Check erlaubt bei `withdrawn` genau die drei Endgründe; `partner_withdrawn` nur aus `withdraw_offer`.
- `0042_completion.sql:65`, `0043_s9g_abnahme.sql:78`, `0049_admin_correct.sql:117` – Abschluss durch System bzw. Admin trägt nie Rolle Firma oder Kunde, löst also kein Replay aus.
- `0066_execute_entzug.sql:94-97` – service_role ohne EXECUTE auf `withdraw`, `start_job`, `complete_job`.
- `tests/rls/replay-rest.test.ts:68-111`, `:172-201` – deckt je Funktion ab: erste Wirkung, Wiederholung, Zähler (Ereignis, Audit, Outbox, Zuordnung), fremde Partei, anderes Mitglied, aal1, anderer Weg zum Zustand.
- `tmp/proof/fh1/005-`, `006-`, `007-tests_rls_replay-rest.test.ts.log` – vor dem Push rot mit `EXIT=1`; Ist-Wert `invalid_transition` statt Erfolg bei der Wiederholung (misst die Wirkung, nicht nur einen Fehlschlag). Ein grüner Lauf kann erst nach dem Push entstehen und ist nicht Teil dieser Freigabe.

Offene Findings hoch: 0
