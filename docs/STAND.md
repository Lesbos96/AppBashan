# MoveNow · Stand

Stand 2026-11-14, nach Schritt u2b (Fristen und Mängel aus u2). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9p-1 (Provisionsstaffel) gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung).
- Arbeitssystem: u1, u1b, u2 und u2b sind erledigt. u2b: Guard erkennt Befehle hinter PowerShell-Zuweisung, in `if`/`while`/`until` und in Klammern (AM10); N19 bis N25 behoben; `bericht.md` nennt das Modell aus dem Transkript, trennt übernommene Läufe und legt die Abnahme unter `docs/proof/<schritt>/` ab; `rls` bei R3 gilt nur mit grünem Lauf von höchstens 7 Tagen (`zeit` in `gruen.json`).
- Beks hat die 15 Fragen vom 2026-11-14 beantwortet (`docs/ENTSCHEIDUNGEN.md` Nr. 148 bis 162); Folgearbeiten stehen in `docs/OFFEN.md`, gebaut ist davon nichts.
- Datenbank Dev: 62 Migrationen, lokal = remote bis `20261114100000` (0062). Nächste Migration 0063.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
**u3 · Testlücke** (R3, Sonnet 5.5, Effort hoch; `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 d): Positivzeilen-Register `tests/rls/positiv.test.ts` mit Abgleich gegen `database.types.ts`, getypter Mock-Helfer `mockRpc`, Probe `plpgsql_check`. Funde werden eigene R3-Schritte.

Davor oder daneben (Details in `docs/OFFEN.md`, „Fristen aus dem Arbeitssystem“):
- **u2b-3** (Guard, git-Block: M5, M6, M7, N11): kleiner R3-Schritt mit Fable-Abnahme, vor dem Entfall der `ask`-Regeln für `git push` und `git commit`.
- **u1b-6/AM5**: vor der ersten echten Migration (u3 selbst braucht keine).

## Danach
1. Probe: ein R3-Schritt mit dem neuen System (Vorschlag: **s9k-1**, Meldung „nicht stattgefunden“ als ein Zustandsablauf, GOLIVE 34). Zeit und Rückfragen notieren, mit s9i-7c2 vergleichen. Danach dürfen die `ask`-Regeln für commit, merge, push, rm, dotenv entfallen.
2. Beschlossene Folgearbeiten aus den Antworten von Beks: Pauschale erst ab `termin_at` und Kontaktsperre nach jedem Storno ohne Pauschale (Migrationen, R3); zwei Sätze in `geld.md`; Abrechnung für gesperrte Firmen, Miete ausblenden, „voraussichtlich“ streichen (R1/R2 klein, in s9i-7d bündeln); Konto löschen mit Mail-Code (mit dem Mailversand); Partnerbedingungen am Server prüfen (mit den echten Texten).
3. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 (R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile (GOLIVE 13, 18, 26) · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.

## Wartet auf Beks
- `docs/BEKS.md`: 1 Frage (7-Tage-Grenze auch für `check` und `e2e`?).
- Einmal `/advisor off` eingeben und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`, Schritt 2 und 5). In derselben Sitzung `tmp/proof/session.json` ansehen: `felder` zeigt, ob `model` und `transcript_path` ankommen.
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar).
- Edge Functions deployen: noch ohne Gate, nur über die `ask`-Regel (OFFEN u1-2). Deno läuft über `npm run check:deno`.
- Vollauf `rls` 25 bis 30 Minuten (u2b: 1878 s): im Hintergrund starten; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann den Lauf unverändert wiederholen.
