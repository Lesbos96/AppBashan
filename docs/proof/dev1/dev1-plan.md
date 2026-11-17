# dev1 · Plan und Frage an advisor (R3)

Ziel (Beks): Testreste auf Dev entfernen (rls-Wanduhr, OFFEN fh1-6), Nachwachsen verhindern. Nicht Teil: Schema, Migrationen, Functions, App-Code.

## Fakten (Zählungen nur gelesen, `db query --linked`, 2026-11-17)
- F1 Nutzer 425: 405 `pt-…@movenow.test` (264 per SQL angelegt, `created_at` leer, `tests/support/partner.ts:15`; 141 per Admin-API, `tests/support/db.ts:31-35`), 2 `live-up-*@movenow.test` (`scripts/live-uploads.mjs:33`), 18 anonymisiert (`email` null, `auth.users.deleted_at` gesetzt, `profiles.deleted_at` gesetzt: `supabase/migrations/20261110100000_0052_account_deletion.sql:66,75-77`, Test `tests/rls/delete-account-live.test.ts`). Alle 425 haben ein Profil, Rolle `customer`, kein Partner-Mitglied. Es gibt auf Dev keine anderen Konten.
- F2 Anfragen 1471: 1135 mit `commission_entries`, 336 ohne (deren Kunden haben alle auch Journal-Anfragen). Nur 2 Nutzer (live-up-a/b, ohne Anfrage) sind ohne Umgehung löschbar.
- F3 Firmen 644, alle `suspended`, alle gebunden (Journal), ohne Mitglieder: 390 mit Marker (`tests/support/marker.ts:9`), 254 mit Kontaktadresse `firma@movenow.test` (angelegt 2026-11-08 bis 11-12, vor dem Marker, im Code nicht mehr auffindbar; Name `Testfirma GmbH`).
- F4 Sperren: `private.append_only` wirft immer (`0015_versions_published.sql:30-43`; `commission_entries` `0028_commission_journal.sql:47-50`, `audit_log` 0015:40-43). `private.immutable_row` erlaubt Löschen nur bei `pg_trigger_depth() > 1`, also nur als Kaskade (`0017_status_machine.sql:138-149`; `price_revisions` `0018_revisions_contacts.sql:83-86`, `service_requests` 0018:127-130, `status_events` 0017:165-168, dazu `assignments`, `job_photos`, `partner_offers`). `commission_entries` verweist mit RESTRICT auf `service_requests`, `partners`, `price_revisions`. Jede Kaskade vom Kunden scheitert also, sobald ein Journal hängt.
- F5 `tests/support/sweep.ts:83-89` versucht in jedem Aufruf alle `pt-%`-Nutzer erneut zu löschen und verschluckt den Fehler (Kaskade bis zum Journal, dann Rollback). 22 Testdateien rufen `sweepTestResidue` (rund 52 Stellen). Firmen bleiben gebunden (`sweep.ts:21-24,66-82`) und werden nur gesperrt.
- F6 Ursache des Anwachsens: Live-Tests (`flow-live`, `journal-live`, `partner-functions-live`) schließen Aufträge ab, damit entsteht Journal und Kunde, Firma und Anfrage sind danach nicht mehr löschbar. Das ist die Folge des Append-only-Entwurfs, kein Fehler der Aufräumroutine.
- F7 Die Tabellen sind klein (größte: `audit_log` 16,7 k, `outbox` 8,2 k Zeilen; gesamt unter 40 MB; `storage.objects` 0 Zeilen, `route_cache` 0). Die Zeilenzahl erklärt 2126 s Wanduhr allein kaum; Verdacht: Last der fehlschlagenden Kaskaden in `sweep` (rund 405 je Aufruf, mehrfach je Lauf). Ich messe: Basis-Volllauf `rls` läuft vor jeder Änderung, danach Volllauf nach dem Löschen, je Datei verglichen.
- F8 Bleibt immer: `fee_schedules`, `fee_schedule_tiers`, `price_versions`, `price_config`, `platform_settings`, `rental_offers`, `geo_*`, Audit-Zeilen dieser Konfigurationen, Positivzeilen (`tests/support/positiv.ts` läuft nur in Rollback-Proben, committet nichts).

## Plan
1. Neues Registerskript `scripts/dev-testdaten-zuruecksetzen.mjs` (Gate `npm run loesch`, Dev-Guard zuerst), Modi `probe` (alles, am Ende `rollback`, meldet `LOESCH-ZAHL`) und `loeschen`.
   - Testmenge Nutzer: `email like 'pt-%@movenow.test'` oder `like 'live-%@movenow.test'` oder (`email is null` und `auth.users.deleted_at` nicht null und Profil `deleted_at` nicht null). Testfirmen: Marker-Regex (`FIRM_MAIL_RE`) oder `contact_email = 'firma@movenow.test'`.
   - Phase A, eine Transaktion: `set local session_replication_role = replica`, dann nur `delete from commission_entries where request_id in (Anfragen der Testmenge)` (und, je Antwort auf Frage 2, `audit_log`), dann `set local session_replication_role = origin`. Kein `alter table`, keine Triggeränderung, nichts bleibt über die Transaktion hinaus.
   - Phase B, normale Trigger: `delete from auth.users` der Testmenge (Kaskade: Profil, Anfragen, Zuordnungen, Angebote, Listings, Fotos, Status, Revisionen, Outbox).
   - Phase C: Testfirmen, die jetzt ungebunden sind, wie `sweep.ts:69-76` löschen (je Firma `set_config('app.mv_partner_delete', …)`); gebundene bleiben.
   - Abbruch ohne Löschen: Journalzeile mit einer Anfrage, deren Kunde nicht in der Testmenge liegt; mehr als 1000 Nutzer oder Firmen; Rolle der Testmenge nicht `customer`; Mitglied einer Nicht-Testfirma.
   - Vorher Export der Zeilen (Sicherung) nach `tmp/dev1-sicherung/` (nicht committet), Zählung je Tabelle vorher und nachher.
2. Register-Eintrag (`scripts/sys/loesch-register.json`), Freigabe durch `advisor-report`, `npm run loesch -- uebernehme`, Commit; erst `probe`, dann `loeschen`.
3. Nachwachsen: Befund (F6) in `docs/OFFEN.md` und `docs/STAND.md`; Vorgabe, vor jedem `rls`-Volllauf das Skript mit `loeschen` zu starten (die Freigabe gilt für den SHA-256, wiederholbar). `sweep.ts` bleibt unverändert, es ruft das Skript nie auf (kein Journal-Löschen im Testlauf).

## Fragen an advisor (eine gebündelte)
1. Ist das Löschen von `commission_entries` (Test-Anfragen der Testmenge) auf Dev per `set local session_replication_role = replica` in einer Transaktion vertretbar, oder hältst du es für eine Aufweichung der Append-only-Sperre, die Beks vorher entscheiden muss? Alternative: nichts am Journal ändern, dann sind nur 2 Nutzer löschbar und der Schritt wirkungslos.
2. `audit_log` der gelöschten Entitäten (Typen `service_request`, `revision`, `offer`, `commission_entries`, `partner`, `profile`, Kennung in der Testmenge) mit löschen oder behalten? Meine Empfehlung: behalten (größte Tabelle, aber 16,7 k Zeilen, kein Fremdschlüssel, Audit unveränderlich).
3. Gehören die 254 Firmen mit `firma@movenow.test` (Herkunft nicht belegt, nur Datum, Name, `.test`-Domain, alle `suspended`, alle im Journal an Testanfragen) zur Testmenge?
4. Reichen die Abbruchbedingungen und die Testmenge der Nutzer (alle 425)? Weitere Schranken?
5. Nachwachsen: genügt Befund plus vorgeschriebener Reset vor dem Volllauf, oder soll ein Teil in die Tests (nein, meine Empfehlung)?
