# MoveNow · Stand

Stand 2026-11-14, nach Schritt u2 (Doku-Umbau). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9p-1 (Provisionsstaffel) gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung).
- Arbeitssystem: u1 und u1b (Gates, Hooks, Lösch-Gate) und u2 (kurze `CLAUDE.md`, `.claude/rules/`, Skill `/schritt`, diese Datei, `OFFEN.md`, `BEKS.md`, `ENTSCHEIDUNGEN.md`, Archiv) sind erledigt. `test-runner` gibt es nicht mehr.
- Datenbank Dev: 62 Migrationen, lokal = remote bis `20261114100000` (0062). Nächste Migration 0063.
- Letzte Volläufe (s9p-1, übernommen über `docs/proof/gruen.json`): check, rls, e2e grün.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
**u3 · Testlücke** (R3, Sonnet 5.5, Effort hoch; `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 d): Positivzeilen-Register `tests/rls/positiv.test.ts` mit Abgleich gegen `database.types.ts`, getypter Mock-Helfer `mockRpc`, Probe `plpgsql_check`. Funde werden eigene R3-Schritte.

Voraussetzungen, in u3 zuerst oder als eigener Schritt davor (Details in `docs/OFFEN.md`, „Fristen aus dem Arbeitssystem“):
- **u1b-6/AM10** (Guard lässt PowerShell-Zuweisung und Bash-Bedingung durch): Frist vor u3.
- **u1-8** (niedrige Funde N19 bis N29 der u1-Kontrollabnahme): Frist vor u3, Stand zuerst klären.
- **u1b-6/AM5**: Frist vor der ersten echten Migration (u3 selbst braucht keine).

## Danach
1. Probe: ein R3-Schritt mit dem neuen System (Vorschlag: **s9k-1**, Meldung „nicht stattgefunden“ als ein Zustandsablauf, GOLIVE 34). Zeit und Rückfragen notieren, mit s9i-7c2 vergleichen. Danach dürfen die `ask`-Regeln für commit, merge, push, rm, dotenv entfallen.
2. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 und Antworten auf `BEKS.md` 1, 6, 7 (R3) · s9i-7d Kleinteile gebündelt (R1) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile (GOLIVE 13, 18, 26) · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge und Abhängigkeiten: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.

## Wartet auf Beks
- `docs/BEKS.md`: 15 Fragen. Frage 2 (Gebühr in der Absage-Maske der Firma) ist als hoher Fund geführt und vor `booking_open` zu beantworten.
- Einmal `/advisor off` eingeben und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`, Schritt 2 und 5).
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar).
- Edge Functions deployen: noch ohne Gate, nur über die `ask`-Regel (OFFEN u1-2). Deno läuft über `npm run check:deno`.
- Vollauf `rls` 8 bis 14 Minuten: im Hintergrund starten.
