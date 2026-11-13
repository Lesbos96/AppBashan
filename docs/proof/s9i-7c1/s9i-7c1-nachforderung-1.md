# Nachforderungen 1 zum Bericht s9i-7c1 (Kennung 7c1-1311-a)

Nur gelesen und berichtet; geändert wurden Doku und Nachweise (Bilder von Punkt 3, PROGRESS, OPEN_ISSUES). Stand der Code-Dateien: Endstand 6ccef66, unverändert.

## 1. EXIT-Erfassung

Alle Logs liegen in `docs/proof/s9i-7c1/`. Die Wrapper stammen aus dem Transcript (Hauptsession bzw. Subagent-Transkripte `subagents/agent-*.jsonl`).

| Log | Zeile EXIT= | Wrapper (wörtlich, gekürzt auf den Kern) | richtig? |
|---|---|---|---|
| `rot-1.log` | 65 | `{ …; npx vitest run … 2>&1 \| tail -60; echo EXIT=${PIPESTATUS[0]}; } > tmp/proof/s9i-7c1-rot-1.log 2>&1` | ja (PIPESTATUS[0] = Exit von vitest, nicht von tail) |
| `rot-2.log` | 368 | `{ …; npx playwright test tests/e2e/partner-journal.spec.ts --project=e2e; echo "EXIT=$?"; } > …rot-2.log 2>&1` | ja (`$?` direkt nach playwright) |
| `rot-3.log` | 32 | `{ …; npx dotenv -e .env.local -- npx vitest run --project rls tests/rls/journal-live.test.ts; echo "EXIT=$?"; } > …rot-3.log 2>&1` | ja |
| `check-1.log` | 108 | `{ echo "Commit: …"; echo "Arbeitsbaum sauber: ja"; echo "Start: $(date -Iseconds)"; npm run check; echo "Ende: $(date -Iseconds)"; echo "EXIT=$?"; } > "$L" 2>&1` | **nein**: `$?` ist der Exit des `echo "Ende: …"`, also immer 0 |
| `check-2.log` | 108 | `… npm run check >> "$LOG" 2>&1; ec=$?; echo "Ende: …" >> "$LOG"; echo "EXIT=$ec" >> "$LOG"` | ja |
| `e2e-1.log` | 1520 | `… npm run test:e2e; RC=$?; echo "Ende: …"; echo "EXIT=$RC"` | ja (EXIT=1, bestätigt durch die roten Tests im Log) |
| `e2e-2.log` | 756 | `… npm run test:e2e >> "$LOG" 2>&1; ec=$?; … echo "EXIT=$ec" >> "$LOG"` | ja |
| `rls-1.log` | 435 | `… npm run test:rls; RC=$?; echo "Ende: …"; echo "EXIT=$RC"` | ja |
| `rls-2.log` | 434 | `… npm run test:rls >> "$LOG" 2>&1; ec=$?; … echo "EXIT=$ec" >> "$LOG"` | ja |

Ausführende: `rot-1` ich im Hauptkontext; alle anderen `test-runner` (Haiku). Den Fehler bei `check-1` hat der `test-runner` aus meiner Spec „letzte Zeile EXIT=<code>“ gemacht; ab dem Auftrag für `check-2` stand in der Spec „Exit-Code SOFORT in eine Variable sichern (nicht den Exit von echo)“.

**Echtes Ergebnis von `check-1` (Commit 630c7b6): grün, abgeleitet, nicht gemessen.** `npm run check` ist `lint && typecheck && check:deno && vitest`. Das Log zeigt alle vier Stufen (Zeilen 9 bis 18 und folgende); `grep -i "error|FAIL|×|failed"` findet nichts; Zeile 101/102: `Test Files 52 passed (52)`, `Tests 1196 passed (1196)`. Weil vitest in der `&&`-Kette nur nach erfolgreichem lint, typecheck und check:deno läuft, war der echte Exit 0. Ein Messwert fehlt; `check-2.log` (6a29ff9) hat dieselben Zahlen (52 Dateien, 1196 Tests) mit gemessenem EXIT=0.

**Gleicher Fehler in einem anderen Log:** keiner. Geprüft wurden alle 21 Logs mit `EXIT=` (`grep EXIT= *.log`) gegen die Wrapper der Subagenten: `gruen-1,3,4,5,6,7,8`, `shots-b-1`, `shots-d-1,2,3` und `scan-proof` haben `$?` unmittelbar nach dem Befehl bzw. eine Variable. Einzige Fehlerquelle ist ein `echo` zwischen Befehl und `echo "EXIT=$?"`, und das gab es nur bei `check-1`.

## 2. Berater

| Zweck | Subagent-Typ | Modell (aus dem Transkript) | Tools | Beleg |
|---|---|---|---|---|
| Planprüfung | `advisor` | `claude-fable-5-2` (17 Nachrichten) | Read 16, Grep 10 | `subagents/agent-a9752c1069ffa774d.jsonl`, Beschreibung „Fable Planprüfung Journal-CSV“, 08:04:40Z; Antwort von mir nach `s9i-7c1-fable-plan.md` geschrieben (der Typ hat kein Write), erste Zeile „Modell: claude-fable-5-2“ |
| Abnahme | `advisor-report` | `claude-fable-5-2` (66 Nachrichten) | Read 66, Grep 36, Glob 10, Write 2 | `subagents/agent-a1d51fc1351fe1c2e.jsonl`, „Fable Abnahme s9i-7c1“, 08:31:17Z; beide Write-Aufrufe nur auf `tmp/proof/s9i-7c1-abnahme.md`, Datei beginnt mit „Modell: claude-fable-5-2“ |

Das eingebaute `advisor`-Tool (ohne Parameter) kam in keinem der beiden Transkripte vor (Tool-Zähler oben) und wurde in meinem Auftrag ausdrücklich verboten. Weitere Fable-Aufrufe gab es nicht. Alle Bildsicht-Pakete liefen als `reviewer` (Sonnet 5.5, `claude-sonnet-5-5`), alle Läufe als `test-runner`.

## 3. Bildsicht der Abrechnungs-Karte (D)

Es gab sie, in drei Runden. Beleg: Reviewer `agent-adce685390fee6ec3` (Runde 1), `agent-a9a5cc20faae1f99f` (Runde 2), `agent-a65f3096623d685b1` (Runde 3), je 12 verschiedene PNG-Dateien mit Read geöffnet (Transkript-Zählung), Reviews `bild-d/review-1.md`, `review-2.md`, `review-3.md`, Liste `bild-d/liste.txt`. Umfang je Runde 12 Bilder (Paket ≤ 12): Breiten 320 (Shot `partner-320-abrechnung*`), 390 und 1280 px, hell und dunkel, je Zustand „Karte“ und „Karte mit Fehlermeldung“. Runde 3 am Endstand (Shots `shots-d-3.log`, Commit 6a29ff9, 12 passed, EXIT=0); Ergebnis: keine hohen oder mittleren Funde, drei niedrige (S9i7c1-6).

Was fehlte: Die PNG-Dateien lagen nur in `tmp/proof/s9i-7c1/bild-d/`, nicht in `docs/proof/`. Nachgeholt: 12 PNG byte-genau per `cp` nach `docs/proof/s9i-7c1/bild-d/` (cmp ohne Abweichung), 3,5 MB.

Nicht abgedeckt (ehrlich): kein Bild vom Ladezustand „Wird erstellt …“, vom leeren Monat und von der Tastaturfokus-Ansicht; Format-Hinweis ohne Lauf in einem Browser ohne natives Monatsfeld (S9i7c1-6). Neue Funde, die `src` ändern: keine neue Sichtung, daher keine neuen Funde.

## 4. Widerspruch „suspended“

Die Rechte-Tabelle sagte „pending, rejected, suspended: leer, kein Fehler“. Das ist verkürzt und leicht falsch lesbar: **„leer“ heißt, diese Testfirmen haben keine Journalzeilen, nicht dass der Server sie sperrt.** Die Ablauftabelle selbst (`s9i-7c1-ablauf.md:22`) schreibt „kein Fehler, leer (keine Zeilen vorhanden)“; im Bericht fehlte der Klammersatz.

Was der Server tut (Quelltext, `supabase/migrations/20261109140000_0042_completion.sql:133-145`): `my_commissions` prüft Anmeldung (`:139`), `aal = aal2` (`:140`) und `private.my_member_partner_id()` (`:141-142`). Diese Funktion (`20261107100000_0023_partners.sql:81-86`) prüft nur Mitgliedschaft und aal2, **nicht den Firmenstatus** (im Gegensatz zu `my_partner_id`, `:89-93`, mit `status = 'active'`). Damit gilt:

| Aufrufer | Ergebnis laut Quelltext | Test / Ist-Wert |
|---|---|---|
| Firma pending | eigene Zeilen, kein Fehler; praktisch leer, weil eine nicht aktive Firma nie Journalzeilen erzeugt (`partner_not_active`, `tests/rls/journal.test.ts:147,205,268`) | `journal-live.test.ts:131-142`, `journal-live-ist-2.txt:4`: `fehler=keiner zeilen=0` (gemessen) |
| Firma rejected | wie pending | `journal-live-ist-2.txt:5`: `fehler=keiner zeilen=0` |
| Firma suspended | eigene Zeilen, kein Fehler; Zeilen möglich (frühere Annahmen) | `journal-live-ist-2.txt:6`: `zeilen=0`, **weil die Testfirma nie Zeilen hatte**; für `my_commissions` mit Zeilen **nicht getestet**. Nur die Tabellen-RLS ist mit Zeilen getestet (`tests/rls/journal.test.ts:376-397`, „Mitglied A suspended aal2“ = 2 Zeilen) |
| Firma payment_hold | eigene Zeilen, kein Fehler | **für `my_commissions` nicht getestet**; Tabellen-RLS getestet (`journal.test.ts:360,386`: 1 Zeile) |
| Kunde (kein Partner-Konto) aal2 | `not_found` (`0042:142`) | `tests/rls/completion.test.ts:227,251` (Rollback-Probe `Kunde ohne Firma`) |
| Kunde aal1 | `mfa_required` (`0042:140`) | live: `journal-live-ist-2.txt:2` `kunde=mfa_required` (Kunde war aal1) |

Also kein Widerspruch zwischen Tabelle und S9i7c1-3 („Server erlaubt“), sondern eine ungenaue Tabelle: Der Server lässt `suspended` und `payment_hold` herein (Quelltext); die UI-Karte schließt `suspended` aus (`ACCESS` in `src/screens/Partner.tsx`). Lücke: der Server-Pfad `my_commissions` für `suspended`/`payment_hold` mit echten Zeilen hat keinen Test (OPEN_ISSUES S9i7c1-8).

## 5. Geldablauf

Quelle `journal-live.test.ts:16-19,102-106`, Datei `journal-live-2.csv` (Lauf 09:51Z, Commit 6a29ff9). Buchungsbetrag je Auftrag 68961 ct.

| Auftrag | Ablauf | Zeilen in der Datei | Summe „Betrag Kunde“ |
|---|---|---|---|
| J1 (`8a9243ee…`) | Annahme, Storno durch Firma ohne Pauschale | Buchung 689,61; Storno-Gegenbuchung −689,61 | 0 |
| J2 (`cfe69901…`) | Annahme, **angenommener Nachtrag auf 80000 ct** (+11039), dann Storno ohne Pauschale | Buchung 689,61; Nachtrag 110,39; Gegenbuchung −689,61; Gegenbuchung −110,39 | 0 |
| J4 (`490faa70…`) | Annahme, **abgelehnter Nachtrag**, Storno mit Pauschale (Beleg) | Buchung 689,61; Gegenbuchung −689,61; Stornopauschale 69,00 | 6900 |

Ehrlich: **Nachtrag ohne Storno ist nicht getestet** und kann in `my_commissions` auch nicht auftreten, solange der Auftrag keinen Endstatus hat (0042:109-112, Aufträge ohne Endstatus fehlen). **Der Normalfall „Auftrag abgeschlossen, Summe 68961 ct“ ist im Live-Test der Datei nicht enthalten:** alle drei Aufträge enden mit Storno (der Endstatus `completed` braucht `complete_due()` nach dem Termin). Die 689,61 stehen nur als Buchungszeile. Auf Datenbankebene ist der abgeschlossene Auftrag mit 68961 ct geprüft (`tests/rls/completion.test.ts:236`, `booking|68961|…|completed|standard_20|2026-10-01`, Rollback-Probe über `export_commissions`), nicht in der CSV-Datei. Im Unit-Test stehen 6900 ct (`journal-csv.test.ts:10-24`) und Cent-Grenzfälle; 68961 ct kommt in `commission-csv.test.ts` vor (Admin).

## 6. export_commissions

`supabase/migrations/20261109140000_0042_completion.sql:120-130`: SQL-Funktion `public.export_commissions(p_actor uuid, p_month date)` für Beks. Sie prüft `private.assert_admin(p_actor)` (`:124`), verlangt einen Monat (`month_required`, `:125`), schreibt einen Audit-Eintrag (`:126-127`) und liefert `private.commission_rows(null, p_month)` (alle Firmen). Aufrufen darf nur `service_role` (`:151-152`, `revoke … from public, anon, authenticated`; `completion.test.ts:242-244`: `42501` für Nutzer-JWT, anon und fehlenden admin). Das Skript `scripts/export-commissions.mjs` ruft sie mit dem Secret-Key auf und macht daraus mit `commissionsCsv` die Admin-CSV.

Abgeglichen wurde im Live-Test (`journal-live.test.ts:180-186`): die Zeilen von `my_commissions` (Firma a, aal2, App-Aufruf) gegen die Zeilen von `export_commissions(adm, Monat)` (service_role), gefiltert auf die drei Test-Aufträge `OURS` (J1, J2, J4). Verglichen wird je Zeile `entry_id|kind|reverses_entry_id|total_cents|fee_cents|fee_net_cents|fee_vat_cents|payout_cents`, beide Listen sortiert. **Nicht** abgeglichen wurde die erzeugte CSV-Datei gegen den Admin-Export; im Bericht stand „gleicht die Datei ab“, das war zu weit gefasst. Außerdem ist der Abgleich nicht unabhängig: beide Funktionen lesen über dieselbe `private.commission_rows` (`0042:100-117`). Er belegt daher die Filter (nur eigene Firma, Monat, aal2), nicht die Rechenwerte.

## 7. CSV-Tests (alle `tests/unit/journal-csv.test.ts`, Admin-Fälle im Block `commissionsCsv (Admin)`)

| Anforderung | Testname | Zeile |
|---|---|---|
| BOM | `ohne Zeilen nur BOM und Kopfzeile, CRLF` | 31-33 |
| CRLF | dieser und `jede Zeile endet mit CRLF, jede Journalzeile ergibt genau eine CSV-Zeile (nichts zusammengefasst)` | 31-43 |
| Quoting `;` `"` Zeilenumbruch (CR, LF) | **nur Admin:** `Semikolon, Anführungszeichen, CR und LF: Anführungszeichen, " verdoppelt` (`a;b`, `say "hi"`, `a\nb`, `a\rb`) und `Formel mit Anführungszeichen wird erst entschärft, dann gequotet` | 181-200 |
| Quoting im Journal | kein Freitext im Pfad; Eingaben mit `;`, Zeilenumbruch, Formel werden abgelehnt: `Auftrag, Journal-ID und Bezug: %s ist bad_row` (`a;b`, `=SUMME(A1)`, `  =1+1`, `a\nb`, leer, null, zu kurz) | 150-164 |
| Zeichen am Feldanfang | Tab: `Textfeld '\tx' wird zu '\tx' entschärft`; `=`, `+`, `-`, `@`, Leerzeichen davor (`'  =1+1'`, `' -2'`) | 187-197 |
| **CR am Feldanfang** | **kein Test.** Die Regex `/^\s*[=+\-@\t\r]/` (csv.ts:67) deckt `\r` ab, und `\s` fängt ein führendes `\r` ohnehin; `\r` mitten im Feld ist getestet, ein Feld, das mit `\r` beginnt, nicht (z. B. `\r=1+1`). Lücke, OPEN_ISSUES S9i7c1-8 |
| negative Beträge | `Gegenbuchung mit Vorzeichen und Bezug …; Storno ohne Pauschale ergibt Summe 0`; `%i ct → %s` (−1035 → `-10,35`, −5 → `-0,05`); `Minus ist ASCII 0x2D, jede Betragsspalte passt auf ^-?\d+,\d{2}$`; `Beträge werden nie entschärft: negative Beträge bleiben ohne Apostroph` | 45-56, 71-86, 168-172 |
| Zeitumstellung März | `Sommerzeit-Beginn (letzter Sonntag im März, 2026-03-29, 01:00 UTC)` | 132-137 |
| Zeitumstellung Oktober | `Winterzeit-Beginn (letzter Sonntag im Oktober, 2026-10-25, 01:00 UTC)` | 138-143 |

## 8. Admin-Export: Änderungen (Abweichung, jetzt in PROGRESS)

Das Admin-Skript `scripts/export-commissions.mjs` blieb unverändert, aber die gemeinsame Datei `supabase/functions/_shared/commission/csv.ts` änderte das Verhalten von `commissionsCsv` (Diff `711ffe6..6ccef66`):

| Änderung | vorher | jetzt (Folge für den Admin-Export) |
|---|---|---|
| `euro()` | `Number(cents)`, Gleitkomma, `''` ergab 0 | nur sichere Ganzzahl oder Ziffernkette (BigInt), sonst `bad_row` |
| `rate()` | `String(fee_rate).replace('.', ',')` | nur 0 bis 1 mit höchstens fünf Stellen, sonst `bad_row` |
| `when()` | `new Date(iso)` ohne Prüfung | nur ISO-Zeichenkette, sonst `bad_row` |
| `text()` | `^[=+\-@\t\r]` | `^\s*[=+\-@\t\r]` (auch nach führenden Leerzeichen) |

Folge: Das Skript bricht bei einer unplausiblen Zeile mit uncaught `Error: bad_row` ab, **bevor** die Datei geschrieben wird (`export-commissions.mjs:28`, kein try/catch); vorher hätte es eine Datei erzeugt. Entscheidung 112 nannte nur den Formelschutz („Admin-Export erbt es“), nicht `euro`/`rate`/`when`.

Geänderte Dateien: `supabase/functions/_shared/commission/csv.ts`; Tests: `tests/unit/journal-csv.test.ts` (Block `commissionsCsv (Admin)`, 4 Tests, 10 Fälle) neu; `tests/unit/commission-csv.test.ts` (bestehende Admin-Tests) unverändert und weiter grün (1196 Tests, `check-2.log`). Kein Test für das Skript selbst bei `bad_row`.

## 9. Entscheidungen 109 bis 115 (`docs/AUTOPILOT.md:216-222`)

| Nr. | Inhalt |
|---|---|
| 109 | Modell Sonnet 5.5, Effort 10, eingebautes advisor-Tool nicht benutzt; Teilung 7c1 (Sperre, Bildsicht, Fakten, Journal-CSV) und 7c2 (Durchgangstest) |
| 110 | Berater-Sperre: laut Doku kein Name für eine deny-Regel, nichts eingetragen, `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` unerprobt, Beks entscheidet |
| 111 | Architektur: keine Migration, keine Function; App liest `my_commissions` und erzeugt die Datei im Browser; Zeitraum = Abrechnungsmonat; zwölf Spalten ohne Kundendaten |
| 112 | CSV-Regeln: Beträge über BigInt, Satz/UUID/Zeit geprüft, Betragsausnahme Variante A, Formelschutz auch nach Leerzeichen, neue Fehlerart `period`, nie eine halbe Datei |
| 113 | UI: Karte „Abrechnung“ nur für `active`/`payment_hold`, `suspended` offen (S9i7c1-3), keine Gebühr im Text, Download nur Web (S9i7c1-2) |
| 114 | Gebühr-Anzeigeorte: Absage-Maske und Journal-CSV zeigen sie, CLAUDE.md unverändert, Beks entscheidet (S9i7c1-5); `CLAUDE_ALL` kommt nicht vor |
| 115 | Live-Test: Server unverändert, daher sofort grün; Nachweis über Ist-Werte statt gelockerter Sperre; hinterlässt drei Aufträge und fünf Firmen auf Dev |

Korrektur zu 112: ergänzt um die Auswirkung auf den Admin-Export (Punkt 8).
