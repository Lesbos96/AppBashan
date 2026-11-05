# Nachtauftrag E2E, Prüflauf Runde 7 (Abschluss)

Repo: /home/user/movenow, Branch nacht-e2e. Vorab: `fuser 5173/tcp` leer (Exit 1, kein Prozess). Alle Playwright-Läufe mit PW_CHROMIUM_PATH=/opt/pw-browsers/chromium. Strikt nacheinander.

## 1. npm run check
- Log: /home/user/movenow/tmp/proof/nacht-e2e-r7-check.log
- Exit-Code: 0
- Unit-Tests: 368 bestanden, 0 fehlgeschlagen, 0 übersprungen (13 Testdateien)
- Deno-Checks (golden-deno, money-deno) laut Log grün

## 2. Playwright wege.spec.ts, --project=e2e --project=e2e-desktop, --repeat-each=5
- Log: /home/user/movenow/tmp/proof/nacht-e2e-r7-wege.log
- Exit-Code: 0
- Gesamt: 120 bestanden, 0 fehlgeschlagen, 0 übersprungen, 0 flaky
- e2e: 60 bestanden (12 Tests x 5 Wiederholungen)
- e2e-desktop: 60 bestanden (12 Tests x 5 Wiederholungen)

## 3. npm run test:e2e (vollständig)
- Log: /home/user/movenow/tmp/proof/nacht-e2e-r7-e2e.log
- Exit-Code: 0 (Laufzeit 11.2 min)
- Gesamt: 232 bestanden, 0 fehlgeschlagen, 2 übersprungen, 0 flaky
- e2e: 116 bestanden, 0 fehlgeschlagen, 1 übersprungen
- e2e-desktop: 116 bestanden, 0 fehlgeschlagen, 1 übersprungen
- Übersprungen (je Projekt 1): `tests/e2e/backend.spec.ts:32` „Rot-Beweis: ungemockter Aufruf lässt den Test scheitern“. Grund: `test.skip(!process.env.E2E_REDPROOF)` (Zeile 33), Test läuft nur mit E2E_REDPROOF=1. Erwartet, kein Fehler.

## Fehlgeschlagene Tests
Keine.
