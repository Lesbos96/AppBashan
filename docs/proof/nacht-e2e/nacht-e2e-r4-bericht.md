# Nachtauftrag E2E, Prüflauf Runde 4

Repo: /home/user/movenow, Branch nacht-e2e, Datum 2026-11-05
Vorab: `fuser 5173/tcp` leer (Exit 1), kein Prozess beendet.

| # | Befehl | Exit | Ergebnis | Log |
|---|--------|------|----------|-----|
| 1 | `npm run check` | 0 | bestanden | tmp/proof/nacht-e2e-r4-check.log |
| 2 | `playwright test tests/e2e/wege.spec.ts --project=e2e --repeat-each=3` | 0 | bestanden: 33 (11 Tests × 3), 0 fehlgeschlagen, 0 flaky | tmp/proof/nacht-e2e-r4-wege.log |
| 3 | `npm run test:e2e` (ganze Suite) | 0 | bestanden: 230, übersprungen: 2, fehlgeschlagen: 0, flaky: 0 | tmp/proof/nacht-e2e-r4-e2e.log |

Lauf 3 getrennt nach Projekt (aus tmp/reports/playwright.json, je 116 Ergebnisse):
- e2e: 115 bestanden, 1 übersprungen, 0 fehlgeschlagen
- e2e-desktop: 115 bestanden, 1 übersprungen, 0 fehlgeschlagen

Übersprungen (je Projekt 1): „Rot-Beweis: ungemockter Aufruf lässt den Test scheitern“, tests/e2e/backend.spec.ts:32, Grund laut Annotation „nur mit E2E_REDPROOF=1“. Kein Fehler, bewusstes Skip.

Fehlgeschlagene Tests: keine. Fehler-Screenshots unter tmp/playwright/: nicht angefallen.

Berichtsdateien: tmp/reports/playwright.json (JSON-Reporter, Lauf 2 und 3 überschreiben sich; Stand nach Lauf 3).
