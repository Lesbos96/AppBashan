# MoveNow · Stand

Stand 2026-11-20, nach Schritt legal1 (R2: Rechtsseiten in der Web-App, Entwürfe); davor rl3, rl2, rl1, ts1, mail2, mail1, ui2, web1, bl1 (0073), rs1, rj1, dev1, ui1, sys2. Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Rechtsseiten (legal1, ENTSCHEIDUNGEN 221, Belege `docs/legal/datenschutz-belege.md`)
- Vier Seiten, je Text eine Quelle unter `src/assets/legal/` (`impressum.md`, `agb.md`, `partnerbedingungen.md`, `datenschutz.md`); Anzeige `src/components/Legal.tsx`, Seiten `src/screens/Recht.tsx` (Kunden) und `RechtPartner.tsx` (eigener Chunk), Routen `/recht/impressum|agb|datenschutz|partnerbedingungen`. Der Anwalt-Wortlaut ersetzt nur die Datei. Kopf jeder Seite „Entwurf – noch nicht rechtlich geprüft“, Lücken als `[ANWALT: …]`.
- Fußzeile (Impressum · AGB · Datenschutz) auf Start, Willkommen, Anmelden und den Rechtsseiten; Profil „Info“ mit denselben drei; Zusammenfassung verlinkt AGB und Datenschutz; die Partner-Registrierung öffnet die Partnerbedingungen in neuem Tab. Die Partnerbedingungen nennen die Provision: nur mit Sitzung, nie in der Kunden-Fußzeile (BEKS Frage 1).
- Datenschutz-Empfänger aus dem Ist-Stand: Supabase (Dev eu-west-1, Produktionsregion offen), Brevo, Cloudflare Turnstile, HeiGIT. Zustimmungslogik, Migrationen, Functions unberührt (OFFEN legal1-1: `TERMS_VERSION` ist nicht an die Textdatei gebunden).
- GOLIVE 26 gilt ohne Zählergrenze als erledigt (ENTSCHEIDUNGEN 220); OFFEN rl3-1 bleibt zur Beobachtung nach dem Start.

## Grenzen, Rate-Limits, Turnstile (rl3, rl2, rl1, ts1; ENTSCHEIDUNGEN 216 bis 219)
- `register_partner` und Dokument-Uploads je Konto hart begrenzt (1 Firma, 23 Bezirke, 5 Dokumente à 10 MiB), keine Zählergrenze; Aufrufrate je Konto nicht begrenzt (OFFEN rl3-1, GOLIVE 53).
- `job-photo` Konto je Minute 60, `photo-receipt` Konto je Minute 20, Anfrage je Tag 24, Konto je Tag 300 (`take_rate_tokens`); 429 `rate_limited`, 503 `limiter_unavailable`. Offen: OFFEN rl2-1, rl1-2. Die Functions brauchen `RATE_LIMIT_SECRET` (GOLIVE 9).
- Turnstile: `route` verlangt `captcha` (403 `captcha_failed`, 503 `captcha_unavailable`), die Anmeldung trägt `captchaToken`; Dev mit Cloudflare-Testschlüsseln. Offen: OFFEN ts1-1; Produktion GOLIVE 13, 18, 49 bis 52. Andere Branches sind bei rls und Live-Skripten rot, bis sie auf `ts1` rebasen.

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung, „Unterwegs“). Datenbank Dev: 76 Migrationen, lokal = remote bis 0076, 17 Edge Functions deployt. Nächste Migration 0077.
- Mail (mail1, mail2; ENTSCHEIDUNGEN 207 bis 215): `outbox-send` über die Brevo-HTTP-API, einfache Textmails mit Link, mindestens einmal, Wiederholung nach 15 Min. × 4^(n−1), nach fünf Versuchen `failed`. Betreiber-Sicht: `npm run outbox` (nur Dev). Dev-Secrets stehen (`DEV_MAIL_GUARD=1` gehört nie in Produktion).
- Dev-Reset (dev1): `npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe`, dann `loeschen`, nur auf Anforderung (Nr. 195). Jede neue Funktion braucht ein `grant execute` nur für ihren Aufrufer (`daten.md`). `booking_open`: in Produktion aus, bis Rechtsklärung, GOLIVE 34 und 46 bis 48 erledigt sind.

## Nächster Schritt
1. Mit Beks: BEKS Fragen 1 und 2, GOLIVE 46, 48, Produktivprojekt (OFFEN sys2-1), Hosting, Anwaltswortlaut der Rechtstexte (GOLIVE 19).
2. Kleine Reste: OFFEN legal1-1 bis legal1-4, ts1-1, mail2-1, mail1-1, mail1-5, ui2-2 bis ui2-5, bl1-1 bis bl1-3, rj1-3, fh1-2, rl1-2, rl2-1, rl3-1.

## Wartet auf Beks
- BEKS Fragen 1 und 2 (legal1). Brevo-Produktivkonto und Domain (GOLIVE 42 bis 45), ORS-Vertrag, Turnstile-Konto (GOLIVE 49), Anwalt für die Rechtstexte; einmal `/advisor off` (`docs/BEKS_EINRICHTUNG.md`).

## Hinweise, die jede Session braucht
- Neue Dateien unter `tests/rls/` brauchen einen roten Lauf vor dem ersten grünen mit derselben Datei. Registrierte Skripte brauchen bei jeder Änderung eine Lösch-Freigabe. Gepinnte Dateien (`tests/support/db.ts`, `positiv.ts`): Pin nachführen. Nachweise nach `tmp/proof/` schreibt nur das Start-Programm oder Write; nie zwei Läufe gleichzeitig; während der Pflichtläufe nichts bearbeiten.
- Edge Functions: `npx dotenv -e .env.local -- npx supabase functions deploy <namen> --use-api`; Smoke: 401 ohne Token. Laufzeiten: `rls` 16 bis 26 Min., `e2e` rund 12, `check` unter 2, `shots:all` rund 28 (gezielt: `npm run t -- shots:all -g " (name|name)$"`, der Titel enthält Projekt und Datei, kein `^`).
- Neue e2e-Specs brauchen `@breit`, wenn sie Layout prüfen. Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ (OFFEN S9h4-8, mail1-6). Commit-Texte nennen `GIT_CONFIG_COUNT=` nicht; `git add -A`, `git stash`, `node -e`, `sed` und Doku per Shell-Umleitung verweigert der Guard.
