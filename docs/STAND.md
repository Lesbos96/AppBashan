# MoveNow · Stand

Stand 2026-11-16, nach Schritt sys2 (PUBLIC-Default und Härtung der Schutzskripte; davor sys1, fh1, s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 71 Migrationen, lokal = remote bis `20261116160000` (0071), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0072.
- sys2 (R3, Branch `sys2`): 0071 nimmt neuen Funktionen von `postgres` in jedem Schema den EXECUTE für PUBLIC (Katalogauszug public und private vor und nach dem Push gleich: 259 Zeilen, SHA-256 822ff108…). Eine neue Funktion braucht kein `revoke … from public` mehr, aber ein `grant execute` nur für ihren Aufrufer (`daten.md`); ein künftiges `create extension` als `postgres` legt Funktionen ohne PUBLIC an (OFFEN sys2-2).
- `npm run t` schreibt `Argumente:` und `Schalter:` (`MV_*`, `E2E_*`) in den Log-Kopf und nach `runs.jsonl`; Pflichtläufe und ein grüner Lauf einer neuen rls-Datei zählen nur ohne beides, das Rot ohne Argumente, ein Schalter im Rot steht im Kopf und die Abnahme beurteilt ihn (`tests.md`). Ältere Läufe ohne das Feld zählen nicht mehr.
- Der Guard sperrt Löschen und Verschieben von `tmp/proof` samt Elternordnern (`rm -rf tmp`, `tmp//proof`, Platzhalter, `cd` im selben Befehl); Ziel-Wörter beim Verschieben sind frei. Klammerlisten wie `mv tmp{,2}` und weitere Schreibweisen sind nicht abgedeckt: OFFEN sys1-4.
- 0070: neue Funktionen in `public` bekommen kein EXECUTE automatisch für `anon`, `authenticated`, `service_role`; Wettlauf-Test zum Storno ohne Gebühr (`tests/rls/storno-wettlauf.test.ts`) mit Negativkontrolle `MV_WETTLAUF_OHNE_SPERRE=1` (steht jetzt im Log-Kopf).
- fh1 (0069): Wiederholung bei `withdraw`, `withdraw_offer`, `withdraw_change`, `start_job`, `complete_job` antwortet 200; `outbox-send` und `photo-publish` prüfen den Aufrufer vor der Konfiguration.
- Tests: `e2e-desktop` nur für Specs mit Tag `@breit`; `rls` bleibt ein Arbeiter; Volllauf `rls` 2126 s in sys2 (über der Grenze von 1200 s, OFFEN fh1-6). Jede Abnahme-Runde ist eine neue Datei `tmp/proof/<schritt>-abnahme-<n>.md`.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 (OFFEN n12-1, R3) · Mailversand (GOLIVE 35, 36) · Turnstile · Produktivprojekt (vorher OFFEN sys2-1) · Hosting · Rechtstexte · Abnahme.
2. `decline_listing` mit Replay-Block (OFFEN n12-2); Texte zum Festangebot ohne Pauschale (GOLIVE 32); rls-Wanduhr kürzen (fh1-6).

## Wartet auf Beks
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand; die Lösch-Freigabe einer neuen Hilfsdatei im Register geht über `advisor-report` und `npm run loesch -- uebernehme`. Der Schalter im roten Lauf muss im Log-Kopf stehen.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig starten; der Guard sperrt Umleitungen und Löschen unter `tmp/proof`.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen. Wettlauftests lassen Testdaten auf Dev stehen.
- Edge Functions: `npx supabase functions deploy <namen> --use-api` über die `ask`-Regel; Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261116160000`.
- Volllauf `rls` rund 28 Minuten im Hintergrund, nie mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash` und `node -e` verweigert der Guard.
