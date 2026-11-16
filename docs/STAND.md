# MoveNow · Stand

Stand 2026-11-16, nach Schritt n12b (Migration 0068; davor n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 68 Migrationen, lokal = remote bis `20261116130000` (0068), 17 Edge Functions deployt (alle `verify_jwt` aus; die Prüfung des Aufrufers steckt in den Handlern). Nächste Migration 0069.
- n12b (Branch `n12b`, Nr. 187 bis 190): Wiederholt dieselbe Partei einen erfolgreichen Storno (Kunde: `cancel-customer`, Firma: `cancel-partner`), Nachtrag (`change-propose`) oder ein Angebot (`send_offer`), kommt das erste Ergebnis (200) statt 409. 0068: `cancel_replay` (Audit als Quelle, Betrag, Grund und Belege in SQL verglichen, nur Status nach außen), `propose_change_replay`, Block in `send_offer`, `my_report_info` prüft ein gelöschtes Profil, Unique-Index `commission_one_cancellation_fee` (höchstens eine Gebührenzeile je Anfrage, auch nach Gegenbuchung, Nr. 188). Gemessen: ein zweiter Partner-Storno mit Pauschale scheitert vor jeder Buchung (`not_found`), eine Pauschalenzeile. Auth: `authed` und `handleJobPhoto` lehnen Tokens mit Leerzeichen oder Sonderzeichen mit 401 ab (vorher 500), `AuthServiceError` nennt Status und Code, `must` bildet 40P01 auf `retry` ab, `delete-account` wiederholt einmal. Alle 14 Functions mit `jobs/handlers.ts` oder `db.ts` neu deployt (Stand `tmp/proof/n12b/deploy.log`).
- n12 (Nr. 185, 186): Anfrage (App, `findSentRequest`) und Annahme (`partner_accept_replay`, 0067) liefern nach verlorener Antwort dasselbe Ergebnis; Tabelle aller Aktionen in `tmp/proof/n12-bewertung.md`. Offen aus n12-2: `withdraw_offer`, `withdraw_change`, `withdraw`, `start_job`, `complete_job` (App-RPCs ohne Handler).
- n15: 0066 entzieht `service_role` EXECUTE bei zwölf Funktionen (Register `positiv.ts` nur `'u'`); `rejectToken` (`_shared/auth.ts`): 401 nur bei Code `bad_jwt`, `session_expired`, `session_not_found`, `user_not_found`, `user_banned` oder Typ `AuthSessionMissingError`, sonst 500.
- st1 (0065): Pauschale der Firma erst ab `termin_at`; nach Storno ohne Pauschale sind `job_contact` und `job_photo_list` sofort gesperrt.
- Tests: `e2e-desktop` nur für Specs mit Tag `@breit` (Nr. 178); `rls` bleibt ein Arbeiter (Nr. 179). Jede Abnahme-Runde ist eine neue Datei `tmp/proof/<schritt>-abnahme-<n>.md`; `npm run t` bricht mit Exit 2 ab, solange `tmp/proof/lauf.lock` einem lebenden Prozess gehört.
- Positivzeilen-Register `tests/support/positiv.ts`: eine neue öffentliche Funktion ohne Eintrag macht `check` rot; jede Änderung an dieser Datei oder an `tests/rls/positiv.test.ts` verlangt den neuen Hash in `scripts/sys/loesch-register.json` (Fable-Abnahme). Ein `drop` plus `create` einer `public`-Funktion gibt `service_role` das Recht zurück (OFFEN n15-2).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 (Betrieb) erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 mit Dedupe der Belege (OFFEN n12-1, R3) · Rest von n12-2 (fünf App-RPCs) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme.
2. UI-Bündel s9i-7d (Karte „Transporter mieten“ weg, „voraussichtlich“ bei „Du erhältst“, `decline_listing` S9i6-5) und die Texte zum Festangebot ohne Pauschale (GOLIVE 32).

## Wartet auf Beks
- Keine offene Frage an Beks (n12b beantwortet, Nr. 190).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Kontrollrunde der Abnahme = nächste Nummer, nie dieselbe Datei; nie zwei Läufe gleichzeitig starten. Der Guard sperrt Umleitungen nach `tmp/proof`: Nachweise dorthin schreibt nur Start-Programm, Berater oder die Hauptsession mit Write.
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen, auch Wettlauf-Tests; ein Rot durch geänderte Erwartung oder eine Umbenennung zählt nicht (n12b: der Wettlauf-Test zum Storno liegt deshalb unversioniert unter `tmp/n12b-verschoben/`, neu bauen in OFFEN n12b-2). Den ersten Lauf immer vor dem Push machen.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen (Deadlock-Fall in OFFEN n15-1). Wettlauftests lassen Testdaten auf Dev stehen.
- Edge Functions deployen: `npx supabase functions deploy <namen> --use-api` über die `ask`-Regel; Deploy-Log schreibt die Hauptsession mit Write. Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261116130000` (`migration new` nimmt die Uhrzeit, 0067 hat 12:00:00).
- Volllauf `rls` rund 28 Minuten: im Hintergrund, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin (`now() - interval '2 hours'`); eine Firma nimmt nur wenige Aufträge gleichzeitig an (`partner_job_limit`), weitere über Firma b.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8): Lauf wiederholen.
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht; `git add -A` und `git stash` verweigert der Guard.
