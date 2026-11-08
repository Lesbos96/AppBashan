# AUTOPILOT · Phase 1 durchbauen

Beauftragung: Beks, 2026-11-07 („Phase 1 fertig bauen“, keine Rückfragen). Reihenfolge: S9b-1 bis S9b-4, S9c bis S9h, S9i. Je Schritt: Branch, Kurzplan `tmp/proof/<schritt>-plan.md`, Tests rot zuerst, Migration einzeln per `npm run db:push`, grün, `advisor-report` einmal, PROGRESS und ROADMAP, Commit, ff-Merge, Push. Harte Grenzen siehe Auftragstext (nur Dev-Ref `vcpbbzdyltvffvzjrzdi`, keine Supabase-Connector-Werkzeuge, kein SQL außerhalb von Migrationen außer Lesen und Test-Fixtures).

## Stand
- Start 2026-11-07: `main` = `r1` = `origin/main` (b157086), R1 war gemergt und gepusht, kein Redproof-Rest (`redproof.lock` und `redproof-offen-*` fehlen), Dev-Migrationen lokal = remote bis 0022.
- Vorab-Lauf 2026-11-07 (vor S9b-2): `npm run test:rls` komplett, EXIT=0, 188 Tests in 9 Dateien (`tmp/proof/test-rls-voll-20261107.log`, `.json`).
- Erledigt: S9b-1 (Migration 0023; test:rls 187 Exit 0, check 637 Exit 0, Abnahme hoch 0).
- Erledigt: S9b-2 (Migrationen 0024 `partner_admin`, 0025 `partner_documents_read_own`, 0026 `document_slot_taken`; check 637 Exit 0; `partner-admin.test.ts` 10 Tests, Einzellauf Exit 0; Volllauf auf dem Endstand 194 von 198 mit 4 Transportfehlern (`Transport error` gegen die Management-API, kein Assertion-Fehler), die anderen 9 Dateien grün; Abnahme hoch 0, mittel 2, S2-M1 in 0026 behoben, S2-M2 offen).
- Erledigt: S9b-3 (Migration 0027 `partner_fee_read`; `otpauth` 9.6.0 als devDependency; TOTP ist auf Dev aktiv, die echten TOTP-Tests laufen; check 637 Exit 0; test:rls komplett 203 Tests in 12 Dateien Exit 0, 0 übersprungen; Abnahme hoch 0, mittel 2 behoben).
- Nächster Schritt: S9b-4 (Journal `commission_entries`, `fee_splits` entfällt, Migration **0028**; Plan Abschnitt 7, OPEN_ISSUES R2-M1, R2-M2, R2-N4, S1-N3, A4c-N3; die Tests zu `fee_splits` in `rls.test.ts`/`quote.test.ts`/`status.test.ts` ersetzen), danach S9c bis S9i.

## Entscheidungen zur Durchsicht
1. R1-E1/R1-E2 (Volllauf der Redproof-Skripte auf Dev) und R1-A5 entfallen laut Auftrag („Rot-Beweise mit Lockerung auf Dev entfallen“). Der Rot-Beweis `s9a3`/`s9a4` gilt weiter als nicht auf dem gehärteten Gerüst erbracht. Folge für S9b: kein `scripts/redproof-s9b.mjs`; die Rot-Beweise der Pläne S9b-1 bis S9b-4 (4.5, 5.3, 6.4, 7.4) und R2-N5/N6 entfallen, Wirkung der Sperren belegen die Tests (erlaubt und verweigert mit Fehlercode).
2. Entwurfsänderungen der S9b-0-Abnahme übernommen (sicherere Variante): `vat_rule` bis Phase 2 nur `standard_20`; keine Dauer-Fixture im Journal; Statusfunktionen schon in S9b-1.
3. `terms_version` (Partnerbedingungen): nur Formatprüfung `^[0-9A-Za-z._-]{1,40}$`; die Liste gültiger Versionen steht aus (Beks). Festlegung Beks 2026-11-07: Auf Dev gilt bis zur Rechtsklärung der Platzhalter `partner-2026-11-entwurf` (passt in die Formatprüfung); keine Liste in der DB, kein anderer Wert in App, Seeds und Fixtures außer in den bestehenden Format-Tests.
4. S9b-1: Tests laufen als Rollback-Proben mit Nutzern als `auth.users`-Zeilen in der Transaktion; nur der Wettlauf-Test von `register_partner` committet eine Firma und löscht sie über den Eigentümer-Marker.
5. S9b-2: `assert_not_member` gilt in allen vier Admin-Funktionen (R2-N1); Spalten-Grant auf `partner_documents` enthält zusätzlich `partner_id`; Constraints `partner_categories_no_rental` und `partner_vat_rules_phase1` an den Tabellen (S1-N1); `partner_document_slot` prüft den Firmenstatus (R2-N3); `uid`/`stripe_account_id` lassen sich nicht leeren (`null` = unverändert).
6. S9b-2, Migration 0025 (Abweichung vom Plan): Die Firma liest ihre eigenen Dateien im Bucket `partner-documents` (aal2, Status pending/active/payment_hold), weil der Upload per INSERT … RETURNING die Select-Policy braucht (Test zeigte 42501 ohne sie). Ob die Storage-API RETURNING nutzt, ist nur per SQL-Nachbildung belegt; Nachweis mit echten aal2-Token und die Alternative (signierte Upload-URL über eine Edge Function) stehen als S2-M2 in OPEN_ISSUES (Ziel S9i/S10).
7. S9b-2, Migration 0026: Eine entfernte Dokument-ID lässt sich nicht wiederverwenden, solange die Datei im Bucket liegt (`slot_taken`, Berater M1).
8. Die Tests laufen als Rollback-Proben über die Management-API (`supabase db query --linked`); bei `Transport error` im Volllauf: die betroffene Datei einmal einzeln wiederholen und beide Läufe vermerken (wie bei archdoku, PROGRESS 2026-11-06). Kein Assertion-Fehler in den Wiederholungen.
10. S9b-3: TOTP ist auf Dev aktiv (Beks hat es aktiviert, die echten Token-Tests liefen grün). Die Tests überspringen nur bei „TOTP abgeschaltet“ (`mfa_totp_*_not_enabled`), jeder andere Auth-Fehler bricht ab. `rental_provider` verliert den Satz-Lesezugriff; `select *` auf `platform_settings` ist für `authenticated` (auch admin) verweigert, `note` nur über `service_role`/Funktion.
9. Doku-Rest aus der Konzept-Bereinigung (Plan 4.6, Punkt 6) nur soweit klein: `S9_KONZEPT.md:338` angepasst; die übrigen Stellen (`:276`, `:281`, `:382`–`:386`, `:422`, `:649`) bleiben Doku-Runde ohne Wirkung auf Code (in OPEN_ISSUES geführt).

## Aufgaben für Beks
- TOTP auf Dev ist aktiv (S9b-3 bestätigt). Offen: `supabase/config.toml` `enroll_enabled`/`verify_enabled` auf `true` setzen (nur die Datei, kein `config push`), damit die Datei den Dashboard-Stand abbildet.
- Rechtsklärung der Partnerbedingungen; danach den Platzhalter `partner-2026-11-entwurf` (`terms_version`) durch die echte Version ersetzen.
- Offen aus ROADMAP S5 und S10: ORS-Plan, `ALLOWED_ORIGINS`, SMTP-Anbieter, Captcha/Rate-Limit für die offene Partner-Registrierung, Rechtsklärung vor dem Buchungsbutton (S9i-Schalter bleibt AUS).

## WEITER MIT
S9b-4 (Branch `s9b-4` von `main`; Migration 0028). Hinweise: Journal-Tests laufen als Rollback-Proben (Hilfen `tests/support/partner.ts`, `owner.ts`); `commission_book` ohne jeden Grant; Berater-Abnahme „Geld“ nach dem Bau. Echte TOTP-Hilfe: `tests/support/totp.ts`. Volläufe von `test:rls` dauern 5 bis 9 Minuten, immer über `test-runner` im Hintergrund.
