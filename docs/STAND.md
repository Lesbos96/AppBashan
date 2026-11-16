# MoveNow · Stand

Stand 2026-11-16, nach Schritt st1 (Storno-Regeln aus Beks' Antworten, Migration 0065). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 65 Migrationen, lokal = remote bis `20261115233507` (0065), 17 Edge Functions deployt (alle `verify_jwt` aus; die Prüfung des Aufrufers steckt in den Handlern: Token, `apikey` bei `route`, geheimer Kopf bei `photo-cleanup`, `outbox-send`, `photo-publish`). Nächste Migration 0066.
- st1 (Migration 0065): Die Pauschale der Firma beim Storno gibt es erst ab `termin_at` (`private.call_out_eligible`). Nach jedem Storno ohne Pauschale, durch die Firma oder den Kunden, sind `job_contact` und `job_photo_list` sofort gesperrt (`private.partner_data_access`); mit Pauschale gilt das Fenster `partner_access_days`. `my_jobs`, Nachträge und Listing behalten ihr Fenster. App: `contactLocked` gilt für beide Storno-Status. Keine Edge Function geändert, kein Deploy (ENTSCHEIDUNGEN Nr. 180).
- `geld.md` nennt die Anzeigeorte der Gebühr für die Firma (Absage-Maske, Abrechnungs-Datei) und den Pauschalbetrag für den Kunden (Nr. 149, 150).
- Tests: `e2e-desktop` nur für Specs mit Tag `@breit` (Beks, ja, Nr. 178); `rls` bleibt ein Arbeiter (Beks, nein, Nr. 179). Volllauf `e2e` 680 Fälle (679 bestanden, 1 übersprungen: `backend.spec.ts:32` nur mit `E2E_REDPROOF=1`).
- Arbeitssystem: u1 bis u4, s9k-1 und st1 erledigt. Positivzeilen-Register `tests/support/positiv.ts`: eine neue öffentliche Funktion ohne Eintrag macht `check` rot; private Funktionen fallen nicht unter die Pflicht. Jede Änderung an dieser Datei oder an `tests/rls/positiv.test.ts` verlangt den neuen Hash in `scripts/sys/loesch-register.json` (Fable-Abnahme).
- GOLIVE 34 ist gebaut; Kundenmeldungen prüft der Betreiber binnen 3 Werktagen per Admin-Skript (`reported_jobs`), Mail bei neuer Meldung kommt mit dem Mailversand (Nr. 175).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 (Betrieb) erledigt sind.

## Nächster Schritt
Nach Wert:
1. Kleiner R3-Schritt N15 (zwölf `'us'`-Funktionen inkl. `my_report_info`: EXECUTE für `service_role` entziehen, vorher Aufrufer in den Edge Functions prüfen) zusammen mit s9k1-1 (Löschen gegen Meldung sperren).
2. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 (R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.
3. UI-Bündel s9i-7d (Karte „Transporter mieten“ weg, „voraussichtlich“ bei „Du erhältst“, `decline_listing` S9i6-5) und die Texte zum Festangebot ohne Pauschale (GOLIVE 32).

## Wartet auf Beks
- `docs/BEKS.md`: keine offene Frage.
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`); `tmp/proof/session.json` `felder` ansehen.
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar).
- Edge Functions deployen: nur über die `ask`-Regel (OFFEN u1-2); Deploy-Log schreibt die Hauptsession mit Write. Deno: `npm run check:deno`.
- Volllauf `rls` rund 28 Minuten: im Hintergrund, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen. Ein Sitzungsneustart beendet den Lauf (Log ohne `EXIT`-Zeile zählt nicht).
- Neue e2e-Specs brauchen den Tag `@breit` am obersten Describe, wenn sie Layout prüfen; ohne Tag läuft die Spec nur mit 390 Pixel.
- Die Pauschale der Firma gibt es nur ab `termin_at`: rls-Tests mit Pauschale brauchen einen begonnenen Termin (`now() - interval '2 hours'`), sonst `call_out_not_allowed`.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8). Bei Rot dort: Lauf wiederholen.
- E2E-Mocks im Dev-Modus: React ruft Effekte doppelt auf; ein einmaliger Fehlerzustand braucht zwei Mock-Antworten (siehe `tests/e2e/auftrag-aktionen.spec.ts`, „Signal nicht ladbar“).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht: der Guard sperrt sie in jedem Befehl mit `git`.
