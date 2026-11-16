# MoveNow · Stand

Stand 2026-11-16, nach Schritt fh1 (Härtung Functions und Wiederholungen, 0069; davor s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 69 Migrationen, lokal = remote bis `20261116140000` (0069), 17 Edge Functions deployt (alle `verify_jwt` aus; die Prüfung des Aufrufers steckt in den Handlern). Nächste Migration 0070.
- fh1 (R3, Branch `fh1`): `outbox-send` und `photo-publish` prüfen den Aufrufer vor der Konfiguration (u5-1): ohne Secret in der Umgebung oder ohne gültigen Header 401, nie 503; `outbox-send` antwortet erst mit richtigem Secret und ohne Versand mit 503 `mail_not_configured` (`send` ist dann `null`, `claim` läuft nicht). Die drei Foto-Functions loggen `AuthServiceError` mit festem Text (n12b-1 M2). 0069: `withdraw`, `withdraw_offer`, `withdraw_change`, `start_job`, `complete_job` antworten bei Wiederholung derselben Partei 200 ohne Doppelwirkung (Beweis: Statusereignis bzw. Audit mit Akteur, bei `withdraw_offer` die Firma). 14 Functions neu deployt (`tmp/proof/fh1/deploy.log`), Live-Smoke 401 grün. Mock-Staffel ohne eigenen Test: OFFEN fh1-1.
- s9i-7d (R1): E2E-Mocks rechnen die Staffel v2; „Du erhältst“ ohne „voraussichtlich“; `/miete` entfernt; gesperrte Firmen sehen Statuskarte und Abrechnung.
- n12b/n12: Anfrage, Annahme, Storno (Kunde und Firma), Nachtrag, Angebot liefern bei Wiederholung dasselbe Ergebnis (0067, 0068); Unique-Index `commission_one_cancellation_fee`; Tabelle aller Aktionen in `tmp/proof/n12-bewertung.md`.
- n15: 0066 entzieht `service_role` EXECUTE bei zwölf Funktionen (Register `positiv.ts` nur `'u'`); `rejectToken` (`_shared/auth.ts`): 401 nur bei Code `bad_jwt`, `session_expired`, `session_not_found`, `user_not_found`, `user_banned` oder Typ `AuthSessionMissingError`, sonst 500.
- st1 (0065): Pauschale der Firma erst ab `termin_at`; nach Storno ohne Pauschale sind `job_contact` und `job_photo_list` sofort gesperrt.
- Tests: `e2e-desktop` nur für Specs mit Tag `@breit` (Nr. 178); `rls` bleibt ein Arbeiter (Nr. 179). Jede Abnahme-Runde ist eine neue Datei `tmp/proof/<schritt>-abnahme-<n>.md`; `npm run t` bricht mit Exit 2 ab, solange `tmp/proof/lauf.lock` einem lebenden Prozess gehört.
- Positivzeilen-Register `tests/support/positiv.ts`: eine neue öffentliche Funktion ohne Eintrag macht `check` rot; Änderungen an dieser Datei oder an `tests/rls/positiv.test.ts` verlangen den neuen Hash in `scripts/sys/loesch-register.json`. `create or replace` behält die Rechte, ein `drop` plus `create` gibt `service_role` EXECUTE zurück (OFFEN n15-2).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 (Betrieb) erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 mit Dedupe der Belege (OFFEN n12-1, R3) · Mailversand (GOLIVE 35, 36; dort auch die 503-Probe, OFFEN fh1-3) · Härtung mit Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme.
2. `decline_listing` (S9i6-5) mit Replay-Block (OFFEN n12-2) und die Texte zum Festangebot ohne Pauschale (GOLIVE 32).

## Wartet auf Beks
- Keine offene Frage an Beks.
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Kontrollrunde der Abnahme = nächste Nummer, nie dieselbe Datei; nie zwei Läufe gleichzeitig starten. Der Guard sperrt Umleitungen nach `tmp/proof`: Nachweise dorthin schreibt nur Start-Programm, Berater oder die Hauptsession mit Write.
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen; ein Rot durch geänderte Erwartung oder eine Umbenennung zählt nicht. Den ersten Lauf immer vor dem Push machen. Rls-Proben: Partner lesen `job_listings` und Nachtrags-Revisionen nicht direkt, die IDs vorher im Setup als Einstellung ablegen (`replay-rest.test.ts`).
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen (Deadlock-Fall in OFFEN n15-1). Wettlauftests lassen Testdaten auf Dev stehen.
- Edge Functions deployen: `npx supabase functions deploy <namen> --use-api` über die `ask`-Regel; Deploy-Menge per Importgraph (`jobs/handlers.ts` und `photo/handlers.ts` laden 14 Functions, nicht `quote`, `route`, `photo-cleanup`); Deploy-Log schreibt die Hauptsession mit Write. Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261116140000` (`migration new` nimmt die Uhrzeit, danach von Hand umbenennen).
- Volllauf `rls` rund 28 Minuten: im Hintergrund, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin (`now() - interval '2 hours'`); eine Firma nimmt höchstens 5 offene Aufträge an (`partner_open_jobs_max`), weitere über Firma b.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8): Lauf wiederholen.
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht; `git add -A` und `git stash` verweigert der Guard.
