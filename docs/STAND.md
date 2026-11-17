# MoveNow · Stand

Stand 2026-11-17, nach Schritt web1 (R2: Start als Web-App, festes Ankunftsfenster); davor bl1 (R3: Belege-Migration 0073, rj1-2, rs1-1, rs1-3); rs1, rj1, dev1, ui1, sys2 (davor sys1, fh1, s9i-7d, n12b mit 0068, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Alle Angebote ablehnen, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung). Datenbank Dev: 73 Migrationen, lokal = remote bis `20261117190247` (0073), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0074.
- web1 (Nr. 200 bis 204): Start als Web-App; Store-Apps (Capacitor) spätestens 3 Monate nach dem Start, Fahrer-App mit Live-Tracking danach (OFFEN web1-2). Kunde (Bestätigung, Auftragsdetail) und Firma (Auftragskarte) sehen „Ankunft zwischen 9:00 und 9:30 Uhr“ (`src/lib/arrival.ts`: `termin_at` bis +30 Minuten, Wien). Status „unterwegs“ mit Mail an den Kunden kommt mit dem Mailversand (OFFEN web1-1).
- bl1 (0073, ENTSCHEIDUNGEN Nr. 199): `photo_receipt_add` idempotent über `sha256` (Wiederholung nach verlorener Antwort liefert dieselbe Id), Limit 8 erst in `add`; ein Beleg eines angenommenen Nachtrags ist verbraucht (`propose_change` braucht mindestens einen neuen, `my_job_changes.receipt_ids` liefert nur neue); `my_job_changes` nur für aktive Zuordnungen; `reject_offers` behandelt ein gelöschtes Konto als `not_found`. Deployt: `photo-receipt`, `job-photo`, `photo-publish`, `admin-photo` (nur Kommentar in `_shared/photo/handlers.ts`). Neue rls-Tests: Festangebot ohne Pauschale (rs1-1), `flow-live` stellt `completion_ask` selbst her (rs1-3, Wettlauf behoben), Dedupe live.
- BEKS 1 und 2 aus rs1 sind beantwortet (Nr. 197: Montage bleibt ohne den Satz; Nr. 198: rls-Grenze 1200 s bleibt, kein Mess-Schritt, solange rls unter 1500 s liegt). bl1 maß 1581 s (OFFEN fh1-6).
- Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen` mit den Zahlen der Probe, nur auf Anforderung (Nr. 195: über 300 Konten oder 500 Firmen).
- sys2: 0071 nimmt neuen Funktionen von `postgres` den EXECUTE für PUBLIC; jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`).
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
1. Nach Wert: Mailversand (GOLIVE 35, 36; mit „unterwegs“, OFFEN web1-1) · Turnstile · Produktivprojekt (OFFEN sys2-1) · Hosting · Rechtstexte · Abnahme · Rate-Limit `photo-receipt` (S9d-4, Pflicht vor dem Öffnen der Buchung).
2. Kleine Reste: OFFEN bl1-1 (Absage und verbrauchte Belege, Meldung bei erneut hochgeladenem Bild), bl1-2 und bl1-3 (Testlücken), rs1-2, rj1-3 (a), fh1-2 (Profilprüfung in `withdraw` und `complete_job`).

## Wartet auf Beks
- BEKS Frage 1 (Ankunftsfenster schon in der Bestätigung nach dem Senden, vor der Annahme).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`).
- Rechtstexte (auch die Sätze zum Festangebot, GOLIVE 33), Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand; Änderungen an bestehenden Dateien brauchen keinen. Die Lösch-Freigabe einer neuen Hilfsdatei im Register geht über `advisor-report` und `npm run loesch -- uebernehme`.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig starten; ein abgebrochener Lauf lässt seine Kindprozesse und `tmp/proof/lauf.lock` stehen, die Prozesse vorher beenden. Ein Lauf, bei dem sich der Arbeitsbaum ändert (auch Docs), zählt nicht als stabil: während der Pflichtläufe nichts bearbeiten.
- Verweise in Code und alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge: Auftrag, dann Firma; `delete_account` sperrt Profil, dann Anfragen und verweigert Konten mit offener Anfrage (`open_requests`). Wettlauftests und Live-Tests lassen Testdaten auf Dev stehen.
- Edge Functions: `npx dotenv -e .env.local -- npx supabase functions deploy <namen> --use-api` (Deploy-Namen aller Functions, die geänderte Dateien laden: `_shared/photo/*` laden vier); Smoke: 401 ohne Token, `functions list`; Deno: `npm run check:deno`. Migrationsname braucht einen Zeitstempel nach `20261117190247`.
- Volllauf `rls` 16 bis 34 Minuten (Bl1: 26), im Hintergrund, nie mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen. `shots:all` rund 26 Minuten, `e2e` rund 13 Minuten, `check` unter 2 Minuten. Der Fingerabdruck von `rls` deckt nur Migrationen, Functions, `tests/rls`, `tests/support`, `scripts`: ein reiner UI-Schritt übernimmt `rls` aus `docs/proof/gruen.json`.
- Neue e2e-Specs brauchen den Tag `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an. Belege in rls-Proben brauchen einen Hex-Hash (`repeat('a', 64)`); ein zweiter Nachtrag braucht seit 0073 einen neuen Beleg. Geschütztes Leerzeichen im Quelltext nur über `String.fromCharCode(160)`.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash` und `node -e` verweigert der Guard.
