# MoveNow · Stand

Stand 2026-11-17, nach Schritt rj1 (R3: Ablehnen ohne Doppelwirkung); davor dev1, ui1, sys2 (davor sys1, fh1, s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 72 Migrationen, lokal = remote bis `20261117111227` (0072), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0073.
- rj1: Migration 0072 gibt `decline_listing` (Firma) und `reject_offers` (Kunde) einen Replay-Block (Muster 0068/0069): Wiederholung derselben Partei nach Erfolg liefert `ok` ohne zweite Wirkung (Status, Ereignisse, Outbox, `decided_at`). Beweis der Partei: beim Listing der Status `declined` (nur `decline_listing` setzt ihn, die Firma ist die Partei), bei der Anfrage das Statusereignis mit dem Kunden als Akteur. Test `tests/rls/replay-ablehnen.test.ts`, Rot-Lauf 001.
- Oberfläche: Knopf „Ablehnen“ in der Anfragekarte der Firma (`Anfragen.tsx`, nur ohne eigenes offenes Angebot), Bestätigungs-Sheet mit der Folge, Hinweis danach; sagt der Server `offer_exists`, steht „Zieh es zuerst zurück“ (`offer_open`, eigener Text). Kein Edge-Function-Aufruf der beiden Funktionen, kein Deploy nötig.
- Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen` mit den Zahlen der Probe. Beschluss Beks (ENTSCHEIDUNGEN Nr. 195): Reset bei Bedarf, wenn die Probe über 300 Testkonten oder 500 Testfirmen zeigt oder `rls` über 1200 s läuft; kein Reset im Testlauf, `sweep.ts` unverändert, keine feste Pflicht.
- sys2: 0071 nimmt neuen Funktionen von `postgres` den EXECUTE für PUBLIC; jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`).
- `npm run t` schreibt `Argumente:` und `Schalter:` in den Log-Kopf; Pflichtläufe und ein grüner Lauf einer neuen rls-Datei zählen nur ohne beides (`tests.md`). Der Guard sperrt Löschen und Verschieben von `tmp/proof` samt Elternordnern.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
1. Nach Wert: Belege-Migration S9i7-12 (OFFEN n12-1, R3) · Kunden-Oberfläche „Alle Angebote ablehnen“ (OFFEN rj1-1, R1) · Mailversand (GOLIVE 35, 36) · Turnstile · Produktivprojekt (vorher OFFEN sys2-1) · Hosting · Rechtstexte · Abnahme.
2. Texte zum Festangebot ohne Pauschale nach Beks' Antwort auf BEKS Frage 1 (GOLIVE 32); `sweep.ts` auf Konten ohne gebundene Aufträge begrenzen, falls Beks es will.

## Wartet auf Beks
- BEKS Frage 1 (Texte zum Festangebot ohne Pauschale, mit Empfehlung).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand; die Lösch-Freigabe einer neuen Hilfsdatei im Register geht über `advisor-report` und `npm run loesch -- uebernehme`.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig starten; ein abgebrochener Lauf lässt seine Kindprozesse und `tmp/proof/lauf.lock` stehen, die Prozesse vorher beenden.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen. Wettlauftests und Live-Tests lassen Testdaten auf Dev stehen.
- Edge Functions: `npx supabase functions deploy <namen> --use-api`; Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261117111227`.
- Volllauf `rls` rund 16 Minuten auf leerem Dev (bis 35 mit Resten), im Hintergrund, nie mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen. `shots:all` rund 40 Minuten.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an. Rls-Tests ohne Annahme: Zählerstände vor und nach einer Wiederholung vergleichen und `decided_at` zurückdatieren (die Probe läuft in einer Transaktion, `now()` ist konstant).
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash` und `node -e` verweigert der Guard.
