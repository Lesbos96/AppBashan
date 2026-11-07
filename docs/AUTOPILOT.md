# AUTOPILOT · Phase 1 durchbauen

Beauftragung: Beks, 2026-11-07 („Phase 1 fertig bauen“, keine Rückfragen). Reihenfolge: S9b-1 bis S9b-4, S9c bis S9h, S9i. Je Schritt: Branch, Kurzplan `tmp/proof/<schritt>-plan.md`, Tests rot zuerst, Migration einzeln per `npm run db:push`, grün, `advisor-report` einmal, PROGRESS und ROADMAP, Commit, ff-Merge, Push. Harte Grenzen siehe Auftragstext (nur Dev-Ref `vcpbbzdyltvffvzjrzdi`, keine Supabase-Connector-Werkzeuge, kein SQL außerhalb von Migrationen außer Lesen und Test-Fixtures).

## Stand
- Start 2026-11-07: `main` = `r1` = `origin/main` (b157086), R1 war gemergt und gepusht, kein Redproof-Rest (`redproof.lock` und `redproof-offen-*` fehlen), Dev-Migrationen lokal = remote bis 0022.
- Vorab-Lauf 2026-11-07 (vor S9b-2): `npm run test:rls` komplett, EXIT=0, 188 Tests in 9 Dateien (`tmp/proof/test-rls-voll-20261107.log`, `.json`).
- Erledigt: S9b-1 (Migration 0023; test:rls 187 Exit 0, check 637 Exit 0, Abnahme hoch 0).
- Erledigt: S9b-2 (Migrationen 0024 `partner_admin`, 0025 `partner_documents_read_own`, 0026 `document_slot_taken`; check 637 Exit 0; `partner-admin.test.ts` 10 Tests, Einzellauf Exit 0; Volllauf auf dem Endstand 194 von 198 mit 4 Transportfehlern (`Transport error` gegen die Management-API, kein Assertion-Fehler), die anderen 9 Dateien grün; Abnahme hoch 0, mittel 2, S2-M1 in 0026 behoben, S2-M2 offen).
- Nächster Schritt: S9b-3 (Satz lesen N-10, Spalten-Grant, `rental_provider` ohne Leserecht, echte TOTP-Tests mit `otpauth`, Migration **0027**), danach S9b-4 (Journal, Migration **0028**), S9c bis S9i. Die Migrationsnummern im Plan (0025, 0026) sind durch S9b-2 belegt (R2-N8: nächste freie Nummer).

## Entscheidungen zur Durchsicht
1. R1-E1/R1-E2 (Volllauf der Redproof-Skripte auf Dev) und R1-A5 entfallen laut Auftrag („Rot-Beweise mit Lockerung auf Dev entfallen“). Der Rot-Beweis `s9a3`/`s9a4` gilt weiter als nicht auf dem gehärteten Gerüst erbracht. Folge für S9b: kein `scripts/redproof-s9b.mjs`; die Rot-Beweise der Pläne S9b-1 bis S9b-4 (4.5, 5.3, 6.4, 7.4) und R2-N5/N6 entfallen, Wirkung der Sperren belegen die Tests (erlaubt und verweigert mit Fehlercode).
2. Entwurfsänderungen der S9b-0-Abnahme übernommen (sicherere Variante): `vat_rule` bis Phase 2 nur `standard_20`; keine Dauer-Fixture im Journal; Statusfunktionen schon in S9b-1.
3. `terms_version` (Partnerbedingungen): nur Formatprüfung `^[0-9A-Za-z._-]{1,40}$`; die Liste gültiger Versionen steht aus (Beks). Festlegung Beks 2026-11-07: Auf Dev gilt bis zur Rechtsklärung der Platzhalter `partner-2026-11-entwurf` (passt in die Formatprüfung); keine Liste in der DB, kein anderer Wert in App, Seeds und Fixtures außer in den bestehenden Format-Tests.
4. S9b-1: Tests laufen als Rollback-Proben mit Nutzern als `auth.users`-Zeilen in der Transaktion; nur der Wettlauf-Test von `register_partner` committet eine Firma und löscht sie über den Eigentümer-Marker.
5. S9b-2: `assert_not_member` gilt in allen vier Admin-Funktionen (R2-N1); Spalten-Grant auf `partner_documents` enthält zusätzlich `partner_id`; Constraints `partner_categories_no_rental` und `partner_vat_rules_phase1` an den Tabellen (S1-N1); `partner_document_slot` prüft den Firmenstatus (R2-N3); `uid`/`stripe_account_id` lassen sich nicht leeren (`null` = unverändert).
6. S9b-2, Migration 0025 (Abweichung vom Plan): Die Firma liest ihre eigenen Dateien im Bucket `partner-documents` (aal2, Status pending/active/payment_hold), weil der Upload per INSERT … RETURNING die Select-Policy braucht (Test zeigte 42501 ohne sie). Ob die Storage-API RETURNING nutzt, ist nur per SQL-Nachbildung belegt; Nachweis mit echten aal2-Token und die Alternative (signierte Upload-URL über eine Edge Function) stehen als S2-M2 in OPEN_ISSUES (Ziel S9i/S10).
7. S9b-2, Migration 0026: Eine entfernte Dokument-ID lässt sich nicht wiederverwenden, solange die Datei im Bucket liegt (`slot_taken`, Berater M1).
8. Die Tests laufen als Rollback-Proben über die Management-API (`supabase db query --linked`); bei `Transport error` im Volllauf: die betroffene Datei einmal einzeln wiederholen und beide Läufe vermerken (wie bei archdoku, PROGRESS 2026-11-06). Kein Assertion-Fehler in den Wiederholungen.
9. Doku-Rest aus der Konzept-Bereinigung (Plan 4.6, Punkt 6) nur soweit klein: `S9_KONZEPT.md:338` angepasst; die übrigen Stellen (`:276`, `:281`, `:382`–`:386`, `:422`, `:649`) bleiben Doku-Runde ohne Wirkung auf Code (in OPEN_ISSUES geführt).

## Aufgaben für Beks
- TOTP im Dev-Dashboard aktivieren (Auth → MFA) und in `supabase/config.toml` `enroll_enabled`/`verify_enabled` auf `true`; ohne das laufen die echten TOTP-Tests (S9b-3) nicht und werden begründet übersprungen.
- Rechtsklärung der Partnerbedingungen; danach den Platzhalter `partner-2026-11-entwurf` (`terms_version`) durch die echte Version ersetzen.
- Offen aus ROADMAP S5 und S10: ORS-Plan, `ALLOWED_ORIGINS`, SMTP-Anbieter, Captcha/Rate-Limit für die offene Partner-Registrierung, Rechtsklärung vor dem Buchungsbutton (S9i-Schalter bleibt AUS).

## WEITER MIT
S9b-3 (Branch `s9b-3` von `main`; Migration 0027). Hinweise: `otpauth` als `devDependency` (Name vorher mit `npm view otpauth` prüfen); ob TOTP auf Dev aktiv ist, zeigt ein `mfa.enroll`-Versuch, sonst die echten TOTP-Tests begründet überspringen (Entscheidung eintragen). Zeitaufwand der Volläufe von `test:rls`: etwa 8 bis 9 Minuten, immer über `test-runner` im Hintergrund.
