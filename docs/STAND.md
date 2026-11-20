# MoveNow · Stand

Stand 2026-11-20, nach Schritt rl3 (R3: Grenzen für `register_partner` und Dokument-Uploads, ohne Zählergrenze); davor rl2 (`job-photo`), rl1 (`photo-receipt`), ts1 (Turnstile an `route` und an der Anmeldung, Dev mit Cloudflare-Testschlüsseln), mail2 (R3: Mail-Pflichtpunkte vor `booking_open`, Migration 0076), mail1, ui2, web1, bl1 (0073), rs1, rj1, dev1, ui1, sys2. Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Grenzen Registrierung und Dokumente (rl3, ENTSCHEIDUNGEN 219, Plan und Auflagen `tmp/proof/rl3-plan.md`)
- `register_partner` und die Dokument-Uploads laufen direkt über PostgREST und Storage, ohne Function. Je Konto hart begrenzt: 1 Firma, 23 Bezirke, 5 Dokumente à 10 MiB (50 MiB), Fehlaufrufe schreiben nichts. Keine Zählergrenze, keine Migration, kein Function-Deploy (nichts geändert). Neu: `tests/rls/partner-limits.test.ts` (Rot per `MV_RL3_OHNE_GRENZEN`), signierte Upload-URL in `partner-documents.test.ts`. Die Aufrufrate je Konto ist nicht begrenzt (OFFEN rl3-1, GOLIVE 53).
- GOLIVE 26 ist durch Strukturgrenzen erledigt, gilt für `booking_open` aber als offen, bis Beks BEKS Frage 1 bestätigt.

## Rate-Limit job-photo und Belege (rl2/rl1, ENTSCHEIDUNGEN 218, 217, Pläne `tmp/proof/rl2-plan.md`, `rl1-plan.md`)
- `job-photo` zählt mit `take_rate_tokens` einmal je Aufruf nach der Token-Prüfung, vor Body und Abfrage (keine Migration): Konto je Minute 60 (`JOB_PHOTO_LIMITS`, Eimer `jobphoto:min`, getrennt von `receipt:min`). Jeder Aufruf mit gültigem Token zählt (auch 400 und fremde ID). 429 `rate_limited` ohne Wirkung, Zähler fällt aus 503 `limiter_unavailable`, beide mit CORS-Kopf. Kein Tages- und kein Auftragszähler (Begründung Nr. 218). Die Function braucht `RATE_LIMIT_SECRET` (GOLIVE 9). Client: `rate_limited` in beiden `CODES`, keine Wiederholung; `Nachtrag.tsx` und `Anfragen.tsx` zeigen weiter ihren festen Hinweis.
- Dev: `job-photo` v18, `photo-receipt` v18, `photo-publish` v16, `admin-photo` v18 deployt, 401-Smoke bestanden. Live belegt: letzter Block in `tests/rls/flow-live.test.ts` (Kunde: 60 Aufrufe 200, dann 429 ohne URL; Firma a 200). Offen: OFFEN rl2-1, rl1-2.

- `photo-receipt` (rl1): Konto je Minute 20, Anfrage je Tag 24, Konto je Tag 300 (`RECEIPT_LIMITS`, `photo/handlers.ts`), gleiche Fehlerarten, live belegt im vorletzten Block von `flow-live.test.ts`. Offen: OFFEN rl1-2.

## Turnstile (ts1, ENTSCHEIDUNGEN 216, Plan und Auflagen `tmp/proof/ts1-plan.md`)
- Die Function `route` verlangt im Body `captcha` und prüft es bei Cloudflare (nach der Eingabeprüfung, vor dem Zähler): fehlend oder abgelehnt 403 `captcha_failed`, Cloudflare nicht erreichbar 503 `captcha_unavailable`. Die Anmeldung (`signInWithOtp`) trägt `captchaToken` über die eingebaute Captcha-Funktion von Supabase; `verifyOtp` und Sitzungserneuerung brauchen keins. Ein globales Widget (`CaptchaHost` in der Shell, `src/lib/turnstile.ts`) holt je Aufruf ein frisches Token; die Karte „Kurze Sicherheitsprüfung“ erscheint nur, wenn Cloudflare eine Eingabe verlangt.
- Dev: `route` v17, `quote` v104 deployt; Secret `TURNSTILE_SECRET_KEY`, Auth-Captcha an (Cloudflare-Testschlüssel „Always passes“; `.env.local` hat `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Gemessen: Passwort-Anmeldung und Mail-Anforderung ohne Token 400 `captcha_failed`; das Testsecret nimmt jedes Token an, „abgelehntes Token → 403“ beweisen nur die Unit-Tests. Echtes Cloudflare-Skript im Browser gegen Dev: Code anfordern und Adresssuche gehen im unsichtbaren Weg.
- Offen: OFFEN ts1-1 (Garbage-Tokens, Probe mit erzwungener Eingabe, `golive-check` mit Dummy-Proben, weitere Auth-Einstiege). Produktion: GOLIVE 13, 18, 49 bis 52 (echte Schlüssel, nie die Testwerte; Dummy-Token muss dort scheitern). Andere Branches sind bei rls und Live-Skripten rot, bis sie auf `ts1` rebasen (Dev verlangt Captcha-Token bei Passwort- und Mail-Anmeldung).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Alle Angebote ablehnen, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung, „Unterwegs“). Datenbank Dev: 76 Migrationen, lokal = remote bis `20261119031957` (0076), 17 Edge Functions deployt (alle `verify_jwt` aus). Nächste Migration 0077.
- Mail (mail1, mail2; ENTSCHEIDUNGEN 207 bis 214): `outbox-send` verschickt über die Brevo-HTTP-API einfache deutsche Textmails mit Link in die App, mindestens einmal; Wiederholungs-Abstand 15 Min. × 4^(n−1), nach fünf Versuchen `failed`. Firmen-Mails gehen an die Anmeldeadresse des ältesten Inhaber-Kontos. Die 48-Stunden-Grenze (Nr. 215) ist nicht gebaut (OFFEN mail2-1 i). Betreiber-Sicht: `npm run outbox` (nur Dev).
- Dev-Betrieb: Cron `outbox-dispatch` scharf, Secrets `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_BETREIBER`, `APP_URL`, `OUTBOX_SECRET`, `DEV_MAIL_GUARD=1` stehen (der Schalter gehört nie in Produktion). Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen`, nur auf Anforderung (Nr. 195). Jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`). Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung, GOLIVE 34 und die Rest-Punkte von GOLIVE 46 bis 48 erledigt sind.

## Nächster Schritt
1. GOLIVE 26 (BEKS Frage 1) und 46, 48 (mit Beks) · Produktivprojekt (OFFEN sys2-1) · Hosting · Rechtstexte.
2. Kleine Reste: OFFEN ts1-1, mail2-1, mail1-1, mail1-5, ui2-2 bis ui2-5, bl1-1 bis bl1-3, rj1-3, fh1-2, rl1-2, rl2-1, rl3-1.

## Wartet auf Beks
- BEKS Frage 1 (rl3): GOLIVE 26 ohne Zählergrenze als erledigt bestätigen. Prüfen, ob die Probe-Mail im Postfach von `MAIL_BETREIBER` ankam.
- Rechtstexte (GOLIVE 33, 51), Brevo-Produktivkonto und Domain (GOLIVE 42 bis 45), ORS-Vertrag, Hosting, Turnstile-Konto (GOLIVE 49), Produktivprojekt; einmal `/advisor off` (`docs/BEKS_EINRICHTUNG.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei. Ein registriertes Skript braucht bei jeder Änderung eine Lösch-Freigabe über `advisor-report` und `npm run loesch -- uebernehme`. Jede Änderung von `scripts/sys/loesch-register.json`, `tests/support/**` oder `docs/freigaben/**` gehört in die Abnahme (Kontrollrunde). Gepinnte Dateien (`tests/support/db.ts`, `positiv.ts`): Pin nachführen.
- Nachweise nach `tmp/proof/` schreibt nur das Start-Programm oder Write. Nie zwei Läufe gleichzeitig; ein abgebrochener Lauf lässt Kindprozesse und `tmp/proof/lauf.lock` stehen. Während der Pflichtläufe nichts bearbeiten (auch keine Docs).
- Edge Functions: `npx dotenv -e .env.local -- npx supabase functions deploy <namen> --use-api`; alle Functions deployen, die geänderte Dateien laden (`route/handler.ts` laden `route` und `quote`). Smoke: 401 ohne Token, `functions list`; Deno: `npm run check:deno`.
- Volllauf `rls` 16 bis 26 Minuten, im Hintergrund; die Supabase-CLI und die Verwaltungs-API scheitern gelegentlich, dann unverändert wiederholen (rl2: drei von vier `rls`-Läufen scheiterten an `Transport error`, bis zu 2283 s, und drei von vier `e2e`-Läufen an je einem anderen Test, zweimal `ERR_NO_BUFFER_SPACE`; Netz des Rechners). `e2e` rund 12 Minuten, `check` unter 2 Minuten, `shots:all` rund 28 Minuten.
- Neue e2e-Specs brauchen `@breit`, wenn sie Layout prüfen. Test-Konten für Live-Tests über die Auth-API anlegen (`tests/support/db.ts`, sendet das Dummy-Token). Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ (OFFEN S9h4-8, mail1-6).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash`, `node -e`, `sed` und Doku per Shell-Umleitung verweigert der Guard.
