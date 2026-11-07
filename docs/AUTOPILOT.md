# AUTOPILOT · Phase 1 durchbauen

Beauftragung: Beks, 2026-11-07 („Phase 1 fertig bauen“, keine Rückfragen). Reihenfolge: S9b-1 bis S9b-4, S9c bis S9h, S9i. Je Schritt: Branch, Kurzplan `tmp/proof/<schritt>-plan.md`, Tests rot zuerst, Migration einzeln per `npm run db:push`, grün, `advisor-report` einmal, PROGRESS und ROADMAP, Commit, ff-Merge, Push. Harte Grenzen siehe Auftragstext (nur Dev-Ref `vcpbbzdyltvffvzjrzdi`, keine Supabase-Connector-Werkzeuge, kein SQL außerhalb von Migrationen außer Lesen und Test-Fixtures).

## Stand
- Start 2026-11-07: `main` = `r1` = `origin/main` (b157086), R1 war gemergt und gepusht, kein Redproof-Rest (`redproof.lock` und `redproof-offen-*` fehlen), Dev-Migrationen lokal = remote bis 0022.
- Erledigt: S9b-1 (Migration 0023; test:rls 187 Exit 0, check 637 Exit 0, Abnahme hoch 0).
- Nächster Schritt: S9b-2 (Plan `tmp/proof/s9b-2-plan.md`, Migration 0024 `partner_admin`), danach S9b-3, S9b-4, S9c bis S9i.

## Entscheidungen zur Durchsicht
1. R1-E1/R1-E2 (Volllauf der Redproof-Skripte auf Dev) und R1-A5 entfallen laut Auftrag („Rot-Beweise mit Lockerung auf Dev entfallen“). Der Rot-Beweis `s9a3`/`s9a4` gilt weiter als nicht auf dem gehärteten Gerüst erbracht. Folge für S9b: kein `scripts/redproof-s9b.mjs`; die Rot-Beweise der Pläne S9b-1 bis S9b-4 (4.5, 5.3, 6.4, 7.4) und R2-N5/N6 entfallen, Wirkung der Sperren belegen die Tests (erlaubt und verweigert mit Fehlercode).
2. Entwurfsänderungen der S9b-0-Abnahme übernommen (sicherere Variante): `vat_rule` bis Phase 2 nur `standard_20`; keine Dauer-Fixture im Journal; Statusfunktionen schon in S9b-1.
3. `terms_version` (Partnerbedingungen): nur Formatprüfung `^[0-9A-Za-z._-]{1,40}$`; die Liste gültiger Versionen steht aus (Beks).
4. S9b-1: Tests laufen als Rollback-Proben mit Nutzern als `auth.users`-Zeilen in der Transaktion; nur der Wettlauf-Test von `register_partner` committet eine Firma und löscht sie über den Eigentümer-Marker.
5. Doku-Rest aus der Konzept-Bereinigung (Plan 4.6, Punkt 6) nur soweit klein: `S9_KONZEPT.md:338` angepasst; die übrigen Stellen (`:276`, `:281`, `:382`–`:386`, `:422`, `:649`) bleiben Doku-Runde ohne Wirkung auf Code (in OPEN_ISSUES geführt).

## Aufgaben für Beks
- TOTP im Dev-Dashboard aktivieren (Auth → MFA) und in `supabase/config.toml` `enroll_enabled`/`verify_enabled` auf `true`; ohne das laufen die echten TOTP-Tests (S9b-3) nicht und werden begründet übersprungen.
- Liste gültiger Partnerbedingungen (`terms_version`) festlegen.
- Offen aus ROADMAP S5 und S10: ORS-Plan, `ALLOWED_ORIGINS`, SMTP-Anbieter, Captcha/Rate-Limit für die offene Partner-Registrierung, Rechtsklärung vor dem Buchungsbutton (S9i-Schalter bleibt AUS).
