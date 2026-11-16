# MoveNow · Stand

Stand 2026-11-16, nach Schritt n12 (Migration 0067; davor n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 67 Migrationen, lokal = remote bis `20261116120000` (0067), 17 Edge Functions deployt (alle `verify_jwt` aus; die Prüfung des Aufrufers steckt in den Handlern). Nächste Migration 0068.
- n12 (Branch `n12`, Nr. 185): Doppelte Aktionen nach verlorener Antwort. Anfrage: `refFor` merkt alle Refs seit dem letzten Erfolg, die Zusammenfassung liest vor Upload und Senden die eigenen aktiven Anfragen zu den früheren Refs (`findSentRequest`) und zeigt bei Treffer einen Hinweis mit Link statt zu senden, bei Lesefehler sendet sie nicht (GOLIVE 23 erledigt). Annahme: 0067 `partner_accept_replay` (nur `service_role`), `handleAccept` liefert bei `already_taken` der Firma mit eigener Zuordnung, Revision und Auszahlung dieselbe `assignmentId` (200); der App-Notbehelf in `acceptListing` ist weg; `accept` deployt. Alle anderen Aktionen: Tabelle in `tmp/proof/n12-bewertung.md`, Rest in OFFEN n12-1 bis n12-5 (n12-5: nur `accept` neu deployt, 13 Functions mit denselben `_shared`-Dateien auf altem Stand). Hinweistext der Zusammenfassung von Beks bestätigt (Nr. 186). `tests/rls/auth-token-codes.test.ts` ist wieder im Volllauf (n15-3, Rot-Beweis per Mutation von `bad_jwt` und Typzweig).
- n15: 0066 entzieht `service_role` EXECUTE bei zwölf Funktionen (`decline_listing`, `withdraw`, `my_jobs`, `my_report_info`, `my_job_partner`, `job_contact`, `start_job`, `report_not_done`, `complete_job`, `my_job_changes`, `my_cancel_info`, `my_commissions`; Register `positiv.ts` nur noch `'u'`), `delete_account` sperrt zuerst die Anfragen des Kunden, `report_not_done` wirft `not_found` bei gelöschtem Profil. `rejectToken` (`_shared/auth.ts`): 401 nur bei Code `bad_jwt`, `session_expired`, `user_not_found`, `user_banned` oder Typ `AuthSessionMissingError`; sonst `AuthServiceError` (fester Text, 500, kein Token im Log). 13 Functions deployt, Live-Smoke 401 (Nr. 183).
- st1 (0065): Pauschale der Firma erst ab `termin_at`; nach Storno ohne Pauschale sind `job_contact` und `job_photo_list` sofort gesperrt (`private.partner_data_access`).
- Tests: `e2e-desktop` nur für Specs mit Tag `@breit` (Nr. 178); `rls` bleibt ein Arbeiter (Nr. 179). Jede Abnahme-Runde ist eine neue Datei `tmp/proof/<schritt>-abnahme-<n>.md`; `npm run t` bricht mit Exit 2 ab, solange `tmp/proof/lauf.lock` einem lebenden Prozess gehört.
- Positivzeilen-Register `tests/support/positiv.ts`: eine neue öffentliche Funktion ohne Eintrag macht `check` rot, das Recht je Funktion (`'u'`, `'s'`, …) ist im Katalogtest exakt; jede Änderung an dieser Datei oder an `tests/rls/positiv.test.ts` verlangt den neuen Hash in `scripts/sys/loesch-register.json` (Fable-Abnahme). Ein späteres `drop` plus `create` einer `public`-Funktion gibt `service_role` das Recht zurück (OFFEN n15-2), der Katalogtest fängt es.
- Review vom 2026-11-08 ist abgeglichen und nach `docs/archiv/` verschoben; neue Punkte stehen als `VV-*` in `docs/OFFEN.md` (Aufbau, vor dem Start: VV-1.3 Mietpfad, VV-2.1 Baseline, VV-2.6c Auth-Werte, VV-6.1 CI).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 (Betrieb) erledigt sind.

## Nächster Schritt
1. Kleiner R3-Schritt für OFFEN n15-1, n12-2 (409 trotz Erfolg bei Storno, Angebot, Nachtrag; `cancel-partner` dabei auf eine zweite Pauschalenzeile messen) und n12-5 (alle 14 Functions mit `jobs/handlers.ts` oder `db.ts` deployen, Smoke 401, `functions list`). n12 ist gemergt (`main` = `0e6b661`).
2. Nach Wert: Belege-Migration S9i7-12 mit Dedupe der Belege (OFFEN n12-1, R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Kleiner R3-Schritt für OFFEN n15-1 (`authed` mit Formprüfung, Logzeile mit Status und Code, Deadlock-Fall).
3. UI-Bündel s9i-7d (Karte „Transporter mieten“ weg, „voraussichtlich“ bei „Du erhältst“, `decline_listing` S9i6-5) und die Texte zum Festangebot ohne Pauschale (GOLIVE 32).

## Wartet auf Beks
- `docs/BEKS.md`: keine offene Frage.
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Kontrollrunde der Abnahme = nächste Nummer, nie dieselbe Datei; nie zwei Läufe gleichzeitig starten.
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen: die Fixes erst nach dem ersten Lauf der neuen Datei schreiben (n15 scheiterte daran; `git stash` und das Zurücksetzen einer Datei verweigert die Berechtigungsprüfung).
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen (Deadlock-Fall in OFFEN n15-1). Wettlauftests lassen Testdaten auf Dev stehen.
- Edge Functions deployen: `npx supabase functions deploy <namen> --use-api` über die `ask`-Regel; Deploy-Log schreibt die Hauptsession mit Write. Deno: `npm run check:deno`.
- Volllauf `rls` rund 28 Minuten: im Hintergrund, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin (`now() - interval '2 hours'`).
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8): Lauf wiederholen.
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht; `git add -A` und `git stash` verweigert der Guard.
