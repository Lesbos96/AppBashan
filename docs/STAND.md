# MoveNow · Stand

Stand 2026-11-17, nach Schritt rs1 (R2: Festangebot-Texte, „Alle Angebote ablehnen“); davor rj1, dev1, ui1, sys2 (davor sys1, fh1, s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Alle Angebote ablehnen, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 72 Migrationen, lokal = remote bis `20261117111227` (0072), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0073.
- rs1: Bei jedem Festangebot (Anfrage ohne Gesamtpreis, `totalCents === null`) nennt die Oberfläche der Firma „Für diese Leistung gibt es keinen Nachtrag und keine Pauschale bei Absage. Prüfe den Umfang vor deiner Annahme.“ (Anfragekarte, Angebot-Sheet, Bestätigung); die Absage-Maske nennt eine Zeile, wenn die Quelle `partner_offer` ist und die Pauschale 0, und sagt dann keine Weitervermittlung zu (ENTSCHEIDUNGEN Nr. 196, Texte vorläufig, AGB beim Anwalt). Kunde: Knopf „Alle Angebote ablehnen“ mit Bestätigungs-Sheet und Hinweis (`reject_offers`, `jobs.ts`); der Fokus geht nach der Aktion auf den Hinweis; `viennaTime` (jetzt `jobs.ts`) koppelt „um“ und Uhrzeit.
- Eine Montage in Transport oder Umzug ist im Code ein Festpreis mit Pauschale und bekommt den Satz nicht (BEKS Frage 1).
- rls-Laufzeit: rs1 maß 1518 s und 2038 s (rj1 1922 s, dev1 984 s), Reset-Probe 18 Konten, 22 Firmen, 64 Anfragen, also kein Reset (Nr. 195); Ursache offen, OFFEN fh1-6, BEKS Frage 2.
- Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen` mit den Zahlen der Probe, nur auf Anforderung (Nr. 195: über 300 Konten oder 500 Firmen).
- sys2: 0071 nimmt neuen Funktionen von `postgres` den EXECUTE für PUBLIC; jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 (OFFEN n12-1, R3) · Mailversand (GOLIVE 35, 36) · Turnstile · Produktivprojekt (OFFEN sys2-1) · Hosting · Rechtstexte · Abnahme.
2. Kleine Reste: OFFEN rs1-1 (rls-Test zur Invariante „Festangebot ohne Pauschale“, R3), rs1-2, rs1-3 (Wettlauf in `flow-live`, R3), rj1-3 (a), rj1-2 und fh1-2 (Profilprüfung in `reject_offers`, R3).

## Wartet auf Beks
- BEKS Frage 1 (Montage in Transport und Umzug) und Frage 2 (rls-Laufzeit über 1200 s, Ursache offen).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte (auch die Sätze zum Festangebot, GOLIVE 33), Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand; die Lösch-Freigabe einer neuen Hilfsdatei im Register geht über `advisor-report` und `npm run loesch -- uebernehme`.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig starten; ein abgebrochener Lauf lässt seine Kindprozesse und `tmp/proof/lauf.lock` stehen, die Prozesse vorher beenden (die Sperre stört den nächsten Lauf nicht, wenn kein Prozess mehr lebt). Ein Lauf, bei dem sich der Arbeitsbaum ändert (auch Docs), zählt nicht als stabil: während der Pflichtläufe nichts bearbeiten.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen. Wettlauftests und Live-Tests lassen Testdaten auf Dev stehen.
- Edge Functions: `npx supabase functions deploy <namen> --use-api`; Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261117111227`.
- Volllauf `rls` 16 bis 34 Minuten (Dev), im Hintergrund, nie mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen. `shots:all` rund 26 Minuten, `e2e` rund 11 Minuten, `check` unter 2 Minuten. Der Fingerabdruck von `rls` deckt nur Migrationen, Functions, `tests/rls`, `tests/support`, `scripts`: ein reiner UI-Schritt übernimmt `rls` aus `docs/proof/gruen.json`.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an. Geschütztes Leerzeichen im Quelltext nur über `String.fromCharCode(160)` (ein rohes Zeichen löst ESLint `no-irregular-whitespace` aus).
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash` und `node -e` verweigert der Guard.
