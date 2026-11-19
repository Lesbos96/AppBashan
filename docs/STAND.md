# MoveNow · Stand

Stand 2026-11-19, nach Schritt mail1 (R3: Mailversand über Brevo, „Unterwegs“ mit Ankunftszeit, Migrationen 0074 und 0075); davor ui2, web1, bl1 (0073), rs1, rj1, dev1, ui1, sys2 (davor sys1, fh1, s9i-7d, n12b, n12, n15, u5, st1). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Alle Angebote ablehnen, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung, „Unterwegs“). Datenbank Dev: 75 Migrationen, lokal = remote bis `20261118074249` (0075), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0076.
- mail1 (ENTSCHEIDUNGEN 207 bis 213): `outbox-send` verschickt über die Brevo-HTTP-API (`_shared/jobs/brevo.ts`), einfache deutsche Textmails mit Link in die App, keine Beträge und Kontaktdaten, mindestens einmal (eine Doppel-Mail ist möglich). Betreiber-Mail an `MAIL_BETREIBER` bei „nicht stattgefunden“ (Nr. 175). Wiederholungs-Abstand 15 Min. × 4^(n−1), nach fünf Versuchen `failed`.
- „Unterwegs“ (0074): `set_en_route(request, 15|30|45|60)`, nur angenommener Auftrag, am Tag des Termins (Wiener Zeit), vor dem Start, einmal je Auftrag, kein neuer Status; Kunde sieht „Die Firma ist unterwegs, Ankunft ca. 8:40 Uhr“ und bekommt eine Mail, die nach der Ankunftszeit verfällt (`expired`, 0075).
- Dev-Betrieb: Der Cron `outbox-dispatch` ist scharf, Secrets `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_BETREIBER`, `APP_URL`, `OUTBOX_SECRET`, `DEV_MAIL_GUARD=1` stehen. Der Schalter schützt nur die Endungen `.test`, `.invalid`, `.example`, `.localhost`; er gehört nie in Produktion. Die Probe-Mail an den Betreiber nahm Brevo am 2026-11-19 an; den Eingang bestätigt nur Beks. 336 Dev-Zeilen ohne Empfänger (Testkonten) laufen nach fünf Versuchen auf `failed` (OFFEN mail1-2).
- Live belegt (`flow-live` W6): „Unterwegs“ und Meldung ergeben je eine Outbox-Zeile, der Cron holt sie, `outbox-send` liest Adresse und Ankunftszeit, Dev-Schutz überspringt: erledigt, ein Versuch, kein Fehlercode.
- BEKS 1 und 2 aus rs1 sind beantwortet (Nr. 197, 198). Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen`, nur auf Anforderung (Nr. 195).
- sys2: jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`). Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 sowie die neuen Mail-Pflichten (GOLIVE 46 bis 48) erledigt sind.

## Nächster Schritt
1. Pflicht vor dem Öffnen der Buchung (Mail): BEKS Frage 1 (Empfängeradresse der Firma), dann GOLIVE 46 bis 48 (`customerEmail` mit Fehlerauswertung, Adresse der Firma, Betrieb der Outbox und Kontofehler bei Brevo). Danach: Turnstile · Produktivprojekt (OFFEN sys2-1) · Hosting · Rechtstexte · Rate-Limit `photo-receipt` (S9d-4).
2. Kleine Reste: OFFEN mail1-1 bis mail1-6, ui2-2 bis ui2-5, bl1-1 bis bl1-3, rj1-3, fh1-2.

## Wartet auf Beks
- BEKS Frage 1 (Mail an Firmen). Prüfen, ob die Probe-Mail im Postfach von `MAIL_BETREIBER` ankam.
- Rechtstexte (GOLIVE 33), Brevo-Produktivkonto und Domain (GOLIVE 42 bis 45), ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`); einmal `/advisor off` (`docs/BEKS_EINRICHTUNG.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei wie im Endstand. Eine Lösch-Freigabe für ein Skript im Register geht über `advisor-report` und `npm run loesch -- uebernehme`; ein Setup-Skript wie `scripts/setup-outbox.mjs` läuft nur mit gültigem Hash.
- Kontrollrunde der Abnahme = nächste Nummer; nie zwei Läufe gleichzeitig; ein abgebrochener Lauf lässt Kindprozesse und `tmp/proof/lauf.lock` stehen. Während der Pflichtläufe nichts bearbeiten (auch keine Docs).
- Edge Functions: `npx dotenv -e .env.local -- npx supabase functions deploy <namen> --use-api`; alle Functions deployen, die geänderte Dateien laden (`_shared/jobs/*` laden `accept`, `admin-contact`, `offer-confirm`, `outbox-send`; `_shared/photo/*` laden vier). Smoke: 401 ohne Token, `functions list`; Deno: `npm run check:deno`.
- Volllauf `rls` 16 bis 26 Minuten (mail1: 1383 s, über der Grenze von 1200 s, OFFEN mail1-6), im Hintergrund; die Supabase-CLI stürzt gelegentlich ab (`ownerSql`), dann unverändert wiederholen. `shots:all` rund 28 Minuten, `e2e` rund 13 Minuten, `check` unter 2 Minuten.
- Neue e2e-Specs brauchen `@breit`, wenn sie Layout prüfen. Rls-Tests mit Pauschale brauchen einen begonnenen Termin; eine Firma nimmt höchstens 5 offene Aufträge an (Positiv-Welt „auftrag“: Firma a 5, Firma b 5, neue Fixtures nehmen Firma c). Belege in rls-Proben brauchen einen Hex-Hash. Geschütztes Leerzeichen im Quelltext nur über `String.fromCharCode(160)`.
- Test-Konten für Live-Tests über die Auth-API anlegen (`tests/support/db.ts`); per SQL angelegte Konten findet `getUserById` nicht (OFFEN mail1-2). Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ (OFFEN S9h4-8, mail1-6).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash`, `node -e` und Doku per Shell-Umleitung verweigert der Guard.
