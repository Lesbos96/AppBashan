# MoveNow · Stand

Stand 2026-11-16, nach Schritt sys1 (Schutzsystem und Rechte-Grundlage; davor fh1, s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 70 Migrationen, lokal = remote bis `20261116150000` (0070), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0071.
- sys1 (R3, Branch `sys1`): Rot-Beweis einer neuen rls-Datei nur mit demselben Hash im roten und im grünen Lauf wie im Endstand (`dateiSha` in `runs.jsonl`, nur Läufe des eigenen Schritts, Umbenennung = neue Datei); Guard sperrt Löschen und Verschieben unter `tmp/proof` (außer `lauf.lock`); `bericht` nennt Pfad und SHA-256 der höchsten Abnahme-Runde; `fertig` meldet „main gemergt und gepusht: <sha>“ und beschriftet den Fingerabdruck als Fingerabdruck.
- 0070: neue Funktionen in `public` bekommen kein EXECUTE mehr automatisch für `anon`, `authenticated`, `service_role` (Katalogauszug vor und nach dem Push gleich: 259 Zeilen, SHA-256 822ff108…). Der PUBLIC-Default bleibt: jede neue Funktion braucht `revoke all … from public, anon, authenticated` und ein GRANT nur für ihren Aufrufer (`daten.md`); Frage 1 in `docs/BEKS.md`, OFFEN sys1-1.
- Wettlauf-Test zum Storno ohne Gebühr (`tests/rls/storno-wettlauf.test.ts`): Negativkontrolle gegen eine Kopie der Funktionen ohne Sperre in `race_ctl` (`tests/support/race-copy.ts`, Lösch-Freigabe im Register): mit `MV_WETTLAUF_OHNE_SPERRE=1` je zwei Erfolge, normal je einer.
- fh1 (0069): Wiederholung bei `withdraw`, `withdraw_offer`, `withdraw_change`, `start_job`, `complete_job` antwortet 200; `outbox-send` und `photo-publish` prüfen den Aufrufer vor der Konfiguration. `start_job` hat den Fall „ungültiger Ausgangsstand“ schon (`replay-rest.test.ts:129`, anderes Mitglied bei `in_progress`); sonst ist keiner erreichbar (OFFEN fh1-7 erledigt).
- Tests: `e2e-desktop` nur für Specs mit Tag `@breit`; `rls` bleibt ein Arbeiter; Volllauf `rls` 1666 s (über der Grenze von 1200 s, OFFEN fh1-6). Jede Abnahme-Runde ist eine neue Datei `tmp/proof/<schritt>-abnahme-<n>.md`.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 (OFFEN n12-1, R3) · Mailversand (GOLIVE 35, 36) · Härtung der Schutzskripte (OFFEN sys1-3, sys1-4, R3) · Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme.
2. `decline_listing` mit Replay-Block (OFFEN n12-2); Texte zum Festangebot ohne Pauschale (GOLIVE 32); rls-Wanduhr kürzen (fh1-6).

## Wartet auf Beks
- Frage 1 in `docs/BEKS.md`: globaler PUBLIC-Default für neue Funktionen (Empfehlung ja, eigener Schritt).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand; die Lösch-Freigabe einer neuen Hilfsdatei im Register geht über `advisor-report` und `npm run loesch -- uebernehme`. Umgebungsschalter wie `MV_WETTLAUF_OHNE_SPERRE` stehen nicht im Log-Kopf (OFFEN sys1-3): der Ist-Wert muss im roten Log stehen.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig starten; der Guard sperrt Umleitungen und Löschen unter `tmp/proof`.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen. Wettlauftests lassen Testdaten auf Dev stehen.
- Edge Functions: `npx supabase functions deploy <namen> --use-api` über die `ask`-Regel; Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261116150000`.
- Volllauf `rls` rund 28 Minuten im Hintergrund, nie mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash` und `node -e` verweigert der Guard.
