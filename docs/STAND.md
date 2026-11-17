# MoveNow · Stand

Stand 2026-11-17, nach Schritt dev1 (R3: Dev-Testdaten zurückgesetzt, rls-Wanduhr neu gemessen); davor ui1, sys2 (davor sys1, fh1, s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 71 Migrationen, lokal = remote bis `20261116160000` (0071), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0072.
- dev1: `scripts/dev-testdaten-zuruecksetzen.mjs` (Lösch-Gate, Freigabe `docs/freigaben/dev1-loesch-freigabe-2.md`) löscht die Dev-Testdaten: erst `probe` (rollback, meldet Zahlen), dann `loeschen <nutzer> <anfragen> <journal> <firmen> <kopien>` mit den Zahlen der Probe. Es löscht in einer Transaktion die Journalzeilen der Testanfragen unter `session_replication_role = replica` (ein Fenster), dann Konten per Kaskade und ungebundene Testfirmen; die Append-only-Sperren bleiben (Kontrolle `appendOnlyAktiv=2`), Stammdaten und `audit_log` bleiben (ENTSCHEIDUNGEN Nr. 193, 194).
- Gelöscht am 2026-11-17: 427 Konten, 1486 Anfragen, 2059 Journalzeilen, 646 Firmen. Danach Volllauf `rls` 982 s (vorher 2123 s und 1245 s), Grenze 1200 s hält; Zuwachs je Volllauf 9 Konten, 11 Firmen, 32 Anfragen, 46 Journalzeilen (OFFEN fh1-6). Dev ist nach dem Lauf nicht leer.
- Der Reset ist bei Bedarf gedeckt, eine feste Routine nicht: Schwelle oder Pflicht entscheidet Beks (BEKS Frage 2). Kein Reset im Testlauf, `sweep.ts` unverändert. Die Probe bricht ab bei Abdeckungsfirma, Test-Admin, Journal jünger als 15 Minuten oder laufendem Testlauf (OFFEN dev1-1 d).
- sys2: 0071 nimmt neuen Funktionen von `postgres` den EXECUTE für PUBLIC; jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`, OFFEN sys2-2).
- `npm run t` schreibt `Argumente:` und `Schalter:` in den Log-Kopf; Pflichtläufe und ein grüner Lauf einer neuen rls-Datei zählen nur ohne beides (`tests.md`). Der Guard sperrt Löschen und Verschieben von `tmp/proof` samt Elternordnern (OFFEN sys1-4).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 (OFFEN n12-1, R3) · Mailversand (GOLIVE 35, 36) · Turnstile · Produktivprojekt (vorher OFFEN sys2-1) · Hosting · Rechtstexte · Abnahme.
2. `decline_listing` und `reject_offers` mit Replay-Block und Oberfläche als ein R3-Schritt (OFFEN n12-2 + S9i6-5); Texte zum Festangebot ohne Pauschale nach Beks' Antwort auf BEKS Frage 1 (GOLIVE 32); `sweep.ts` auf Konten ohne gebundene Aufträge begrenzen, falls BEKS Frage 2 es will.

## Wartet auf Beks
- BEKS Frage 1 (Texte zum Festangebot ohne Pauschale) und Frage 2 (Nachwachsen der Dev-Testreste, mit Empfehlung).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand; die Lösch-Freigabe einer neuen Hilfsdatei im Register geht über `advisor-report` und `npm run loesch -- uebernehme`.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig starten; ein abgebrochener Lauf lässt seine Kindprozesse und `tmp/proof/lauf.lock` stehen, die Prozesse vorher beenden.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen. Wettlauftests und Live-Tests lassen Testdaten auf Dev stehen.
- Edge Functions: `npx supabase functions deploy <namen> --use-api`; Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261116160000`.
- Volllauf `rls` rund 16 Minuten auf leerem Dev (bis 35 mit Resten), im Hintergrund, nie mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash` und `node -e` verweigert der Guard.
