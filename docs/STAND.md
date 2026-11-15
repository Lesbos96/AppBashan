# MoveNow · Stand

Stand 2026-11-16, nach Schritt u4 (Testläufe schneller, Nacharbeiten aus der Probe). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 64 Migrationen, lokal = remote bis `20261115104122` (0064), 13 Edge Functions deployt. Nächste Migration 0065.
- u4: `e2e-desktop` läuft nur noch für Specs mit Tag `@breit` (14 Specs, 302 statt 378 Fälle), `workers` 3: Volllauf 680 s statt 1071 s (679 Tests). `rls` unverändert ein Arbeiter (1681 s): Fable lehnte die Teilung ab (ENTSCHEIDUNGEN Nr. 176, Frage 2 in `docs/BEKS.md`).
- u4: `sauber()` lässt nur für `run.mjs` und `bericht.mjs` die Nachweise von `npm run bericht` im Index zu (`A ` unter `docs/proof/`, `M ` für `gruen.json`, `bericht.json`, `bericht.md`); `fertig` und `start-schritt` bleiben streng. Der Fehler aus s9k-1 (Läufe nach dem ersten `npm run bericht` zählten nicht) ist behoben, Test `tests/unit/sys-sauber.test.ts`.
- u4: Die `ask`-Regeln für `git commit` und `git merge` sind entfallen; `git push`, `rm`, `npx dotenv` bleiben (Nr. 174). Nebenwirkung für Lösch-Freigaben: OFFEN u4-1.
- GOLIVE 34 ist gebaut; Kundenmeldungen prüft der Betreiber binnen 3 Werktagen per Admin-Skript (`reported_jobs`), Mail bei neuer Meldung kommt mit dem Mailversand (Nr. 175).
- Arbeitssystem: u1 bis u4 und s9k-1 erledigt. Positivzeilen-Register `tests/support/positiv.ts`: eine neue Funktion ohne Eintrag macht `check` rot; jede Änderung an dieser Datei oder an `tests/rls/positiv.test.ts` verlangt den neuen Hash in `scripts/sys/loesch-register.json` (Fable-Abnahme).
- Beks hat die 15 Fragen vom 2026-11-14 beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); gebaut ist davon noch nichts (Folgearbeiten in `docs/OFFEN.md`).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 (Betrieb) erledigt sind.

## Nächster Schritt
Beks entscheidet zuerst über `docs/BEKS.md` (Nr. 1: Auswahl der `@breit`-Specs, Nr. 2: `rls` teilen ja oder nein). Danach, nach Wert:
1. Kleiner R3-Schritt N15 (zwölf `'us'`-Funktionen inkl. `my_report_info`: EXECUTE für `service_role` entziehen, vorher Aufrufer in den Edge Functions prüfen) zusammen mit s9k1-1 (Löschen gegen Meldung sperren).
2. Beschlossene Folgearbeiten (Pauschale erst ab `termin_at`, Kontaktsperre nach jedem Storno ohne Pauschale: Migrationen, R3; zwei Sätze in `geld.md`).
3. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 (R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.

## Wartet auf Beks
- `docs/BEKS.md`: 2 Fragen (`@breit`-Auswahl, `rls`-Teilung).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`); `tmp/proof/session.json` `felder` ansehen.
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar).
- Edge Functions deployen: nur über die `ask`-Regel (OFFEN u1-2); Deploy-Log schreibt die Hauptsession mit Write. Deno: `npm run check:deno`.
- Volllauf `rls` rund 28 Minuten: im Hintergrund, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen. Ein Sitzungsneustart beendet den Lauf (Log ohne `EXIT`-Zeile zählt nicht).
- Neue e2e-Specs brauchen den Tag `@breit` am obersten Describe, wenn sie Layout prüfen; ohne Tag läuft die Spec nur mit 390 Pixel.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8). Bei Rot dort: Lauf wiederholen.
- E2E-Mocks im Dev-Modus: React ruft Effekte doppelt auf; ein einmaliger Fehlerzustand braucht zwei Mock-Antworten (siehe `tests/e2e/auftrag-aktionen.spec.ts`, „Signal nicht ladbar“).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht: der Guard sperrt sie in jedem Befehl mit `git`.
