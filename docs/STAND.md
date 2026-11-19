# MoveNow · Stand

Stand 2026-11-19, ts1 läuft (Zwischenstand, Branch `ts1`); davor mail2 (R3: Mail-Pflichtpunkte vor `booking_open`, Migration 0076), mail1, ui2, web1, bl1 (0073), rs1, rj1, dev1, ui1, sys2. Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## ts1 läuft: weiter nach Beks' Dashboard-Prüfung
- Gebaut und committet: Server (`_shared/turnstile.ts`, `route/handler.ts`, `route/index.ts`: Captcha nach der Eingabeprüfung, vor dem Zähler; 403 `captcha_failed`, 503 `captcha_unavailable`), Client (`lib/turnstile.ts`, `CaptchaHost` in der Shell, `auth.ts`, `route.ts`), Testhelfer (Dummy-Token in `tests/support/db.ts` mit neuem Pin, `rls.test.ts`, `route.test.ts`, vier Skripte), Unit- und e2e-Tests grün (`captcha.spec.ts`), Screens `anmelden-captcha` und `umzug-captcha` bei 390 und 1280 (Reviewer: keine hohen oder mittleren Funde, `tmp/proof/ts1-review.md`). Plan und Auflagen: `tmp/proof/ts1-plan.md`.
- Dev: `route` v17 und `quote` v104 deployt (Secret `TURNSTILE_SECRET_KEY` steht). `tests/rls/captcha-live.test.ts`: Teil `route` grün, Teil Auth **rot**: Dev verlangt bei Passwort-Anmeldung und `signInWithOtp` noch kein Token (Lauf 017; Messprobe: `invalid_credentials` statt `captcha_failed`). Das Dashboard-Captcha ist dort nicht scharf: `docs/BEKS.md` (ein Mini-Schritt).
- Danach: `/schritt ts1 Fortsetzung`: `captcha-live` grün (dieselbe Datei), Status und Code von Auth bei fehlendem Token messen, Lösch-Freigabe der vier Skripte (`tmp/proof/ts1/loesch-freigabe-1.md`) mit `npm run loesch -- uebernehme` übernehmen und committen, Abnahme (`advisor-report`, `tmp/proof/ts1-abnahme-1.md`), Volläufe nacheinander (`check`, `e2e`, `rls`; nach dem Deploy auch `quote` im vollen `rls`, Auflage 9), `bericht`, `fertig`.
- Doku fertig: GOLIVE 13, 18, 26 (angepasst), 49 bis 52 (neu), OFFEN ts1-1 und mail2-1 (h), (i), ENTSCHEIDUNGEN 215 und 216, `.claude/rules/daten.md` nennt den Site Key. Nach dem Merge sind andere Branches bei rls/Live rot, bis sie auf `ts1` rebasen.

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Alle Angebote ablehnen, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung, „Unterwegs“). Datenbank Dev: 76 Migrationen, lokal = remote bis `20261119031957` (0076), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0077.
- Mail (mail1, mail2; ENTSCHEIDUNGEN 207 bis 214): `outbox-send` verschickt über die Brevo-HTTP-API einfache deutsche Textmails mit Link in die App, mindestens einmal; Wiederholungs-Abstand 15 Min. × 4^(n−1), nach fünf Versuchen `failed`. Firmen-Mails gehen an die Anmeldeadresse des ältesten Inhaber-Kontos. Die 48-Stunden-Grenze (Nr. 215) ist nicht gebaut (OFFEN mail2-1 i). Betreiber-Sicht: `npm run outbox` (nur Dev).
- Dev-Betrieb: Cron `outbox-dispatch` scharf, Secrets `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_BETREIBER`, `APP_URL`, `OUTBOX_SECRET`, `DEV_MAIL_GUARD=1` stehen (der Schalter gehört nie in Produktion). Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen`, nur auf Anforderung (Nr. 195). Jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`). Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung, GOLIVE 34 und die Rest-Punkte von GOLIVE 46 bis 48 erledigt sind.

## Nächster Schritt
1. ts1 abschließen (siehe oben). Danach: GOLIVE 46 und 48 (mit Beks) · Produktivprojekt (OFFEN sys2-1) · Hosting · Rechtstexte · Rate-Limit `photo-receipt` (S9d-4).
2. Kleine Reste: OFFEN ts1-1, mail2-1, mail1-1, mail1-5, ui2-2 bis ui2-5, bl1-1 bis bl1-3, rj1-3, fh1-2.

## Wartet auf Beks
- Dashboard Dev: Auth-Captcha prüfen (BEKS „Zuerst“); BEKS Frage 1 (genügt GOLIVE 18 für die Partner-Registrierung?). Prüfen, ob die Probe-Mail im Postfach von `MAIL_BETREIBER` ankam.
- Rechtstexte (GOLIVE 33, 51), Brevo-Produktivkonto und Domain (GOLIVE 42 bis 45), ORS-Vertrag, Hosting, Turnstile-Konto (GOLIVE 49), Produktivprojekt; einmal `/advisor off` (`docs/BEKS_EINRICHTUNG.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei. Ein registriertes Skript braucht bei jeder Änderung eine Lösch-Freigabe über `advisor-report` und `npm run loesch -- uebernehme`. Jede Änderung von `scripts/sys/loesch-register.json`, `tests/support/**` oder `docs/freigaben/**` gehört in die Abnahme (Kontrollrunde). Gepinnte Dateien (`tests/support/db.ts`, `positiv.ts`): Pin nachführen.
- Nachweise nach `tmp/proof/` schreibt nur das Start-Programm oder Write. Nie zwei Läufe gleichzeitig; ein abgebrochener Lauf lässt Kindprozesse und `tmp/proof/lauf.lock` stehen. Während der Pflichtläufe nichts bearbeiten (auch keine Docs).
- Edge Functions: `npx dotenv -e .env.local -- npx supabase functions deploy <namen> --use-api`; alle Functions deployen, die geänderte Dateien laden (`route/handler.ts` laden `route` und `quote`). Smoke: 401 ohne Token, `functions list`; Deno: `npm run check:deno`.
- Volllauf `rls` 16 bis 26 Minuten, im Hintergrund; die Supabase-CLI und die Verwaltungs-API scheitern gelegentlich, dann unverändert wiederholen. `e2e` rund 12 Minuten, `check` unter 2 Minuten, `shots:all` rund 28 Minuten.
- Neue e2e-Specs brauchen `@breit`, wenn sie Layout prüfen. Test-Konten für Live-Tests über die Auth-API anlegen (`tests/support/db.ts`, sendet das Dummy-Token). Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ (OFFEN S9h4-8, mail1-6).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash`, `node -e`, `sed` und Doku per Shell-Umleitung verweigert der Guard.
