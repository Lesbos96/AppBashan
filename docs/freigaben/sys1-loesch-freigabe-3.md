Modell: claude-fable-5-2
SHA256: a22e6a1ffc76a4cf07c16b60028f95fa623a51ba20dbf05c269ab14b72f0f14d tests/support/race-copy.ts
Urteil: frei

# Lösch-Freigabe 3, Schritt sys1

Datum: 2026-11-16
Vorgängerbericht: `tmp/proof/sys1/loesch-freigabe-2.md` (gesperrt, hoch 1: H1 Backticks im SQL-Kommentar; niedrig N1, N4 bis N8).
Geprüft (vollständig gelesen): `tests/support/race-copy.ts` (72 Zeilen) und seine Nutzung in `tests/rls/storno-wettlauf.test.ts` (84 Zeilen).
Zur Einordnung gelesen: Vorgängerbericht, `.claude/rules/daten.md`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs:33-66`, `scripts/sys/loesch-register.json`, `scripts/sys/lib.mjs`, `scripts/sys/fingerabdruck.mjs`, `tests/support/owner.ts`, `supabase/migrations/20261114100000_0062_fee_schedule.sql:700-829`, `supabase/migrations/20261115104122_0064_report_flow.sql:172-203`, `supabase/migrations/20261116140000_0069_replay_rest.sql:36-110`, Suche über alle Migrationen nach den drei Funktionen und nach der Sperrklausel, `tmp/proof/sys1/010-check.log` (ganz, 24 Zeilen), `tmp/proof/sys1/011-check.log` (Kopf und Suche nach Fehlern), `tmp/proof/sys1/runs.jsonl` (Suche nach check und Wettlauftest).

Hinweise zum Nachweis:
- Die Hash-Zeile oben ist unverändert aus dem Auftrag übernommen und von mir nicht nachgerechnet (kein Shell-Werkzeug). Das Gate rechnet sie gegen die Datei nach; weicht die Datei ab, gilt diese Freigabe nicht.
- Ich konnte nichts ausführen. Die Aussagen zur Syntax stützen sich auf meine Lektüre und Zeichensuche, die Aussagen zum Verhalten auf Dev auf die Migrationsdateien (Stand bis 0070 vorausgesetzt).
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

## Ergebnis in einem Satz

H1 aus Runde 2 ist behoben (kein Backtick mehr im Template-Literal), N6 und N8 sind behoben, die Datei ist syntaktisch gültig, löscht und ändert nur das eigene Schema und prüft die Freigabe zuerst: frei.

## Findings hoch

Keine.

## Findings mittel

Keine.

## Findings niedrig

N1 (aus Runde 1, offen). `tests/support/race-copy.ts:67-69` – Rechte werden entzogen, aber nicht gegengeprüft. Fix: am Ende des DO-Blocks `has_schema_privilege` (USAGE) und `has_function_privilege` (EXECUTE) für `anon`, `authenticated`, `service_role` abfragen und bei einem Treffer werfen. Ändert den Hash, braucht dann eine neue Runde; für die Freigabe nicht nötig.

N4 (aus Runde 1, offen). `tests/unit/sys-gate-loesch.test.ts:153-160` – Die Stellung der Freigabeprüfung ist nur für `sweep.ts` per Unit-Test festgehalten (Suche nach dem Dateinamen der Kopie im Test: 0 Treffer). Fix: gleichartigen Test für `race-copy.ts` ergänzen. Ändert den Hash der geprüften Datei nicht.

N5 (aus Runde 1, festgehalten). `tests/support/race-copy.ts:23`, `:38` – Schema anlegen und entfernen löst auf Dev die DDL-Ereignisse der Plattform aus. Ohne Wirkung auf Daten.

N7 (aus Runde 2, festgehalten). `tests/support/race-copy.ts:17` – `perform pg_sleep(2)` setzt FOUND auf wahr; die Prüfung auf nicht gefunden direkt nach der Leseanweisung (`0064_report_flow.sql:189`) ist in der Kopie von `change_gate` wirkungslos. Für den Test ohne Belang (die Anfrage existiert; die Zuordnungsprüfung `0064:192-194` wirft sonst dieselbe Meldung). Kein Fix nötig.

N9 (neu, betrifft den Nachweis, nicht die Datei). `tmp/proof/sys1/runs.jsonl:13` – Der grüne check (Lauf 11, EXIT=0, 2009 Tests) lief auf Commit 239127b mit unsauberem Arbeitsbaum, also vor dem Commit 26b98d6. Der Fingerabdruck liest den Index (`scripts/sys/fingerabdruck.mjs:23`), nicht den Arbeitsbaum, und `dateiSha` ist leer: der Lauf belegt deshalb nicht, dass genau der Stand mit dem Hash oben geprüft wurde. Lauf 10 (EXIT=2) scheiterte an `tests/unit/sys-bericht-lib.test.ts`, nicht an der hier geprüften Datei (`010-check.log:18-19`); Lint und der erste Teil der Typprüfung waren dort schon durch, was zur behobenen Syntax passt. Meine Freigabe stützt sich auf die eigene Lektüre, nicht auf Lauf 11. Fix: keiner an der Datei; der Volllauf `check` auf dem committeten Endstand ist für `fertig` ohnehin Pflicht.

## Stand der Funde aus Runde 2

| Fund | Stand | Beleg |
|---|---|---|
| H1 Backticks im SQL-Kommentar | behoben | `race-copy.ts:58` ohne Backtick. Zeichensuche über die Datei: Backticks nur in den TS-Kommentaren `:1`, `:4`, `:6`, `:19`, `:27` und als Grenzen des Literals in `:31` und `:70`. |
| N1 Gegenprüfung der Rechte | offen (niedrig) | siehe oben |
| N4 Unit-Test | offen (niedrig) | siehe oben |
| N5 DDL-Ereignisse | festgehalten | – |
| N6 LIKE mit Unterstrich | behoben | `race-copy.ts:59`: Vergleich der ersten 36 Zeichen mit dem festen Kopf über Ungleichheit, kein Muster mehr. Ungleichheit statt des vorgeschlagenen Vergleichs mit NULL-Behandlung ist hier gleichwertig: `neu` ist nur dann NULL, wenn `orig` NULL ist, und dann wirft `execute neu` in `:62` (NULL als Befehlstext), der Block rollt zurück. |
| N7 FOUND nach PERFORM | festgehalten | – |
| N8 Log ohne Zeile | behoben | `race-copy.ts:22`: Ersatzwert 0 innerhalb von `Number(…)`, das Log trägt nie NaN. |

## Antworten auf die Prüffragen

**Syntax des Template-Literals?** Gültig. Das Literal beginnt in `:31` und endet in `:70`; dazwischen steht kein Backtick und kein Backslash (Zeichensuche: 0 Treffer für Backslash in der ganzen Datei). Einsetzungen gibt es nur in `:48`, `:53`, `:55`, jeweils die beiden Konstanten aus `:16-17`; beide enthalten weder Hochkomma noch Dollarzeichen, die SQL-Zeichenketten bleiben also geschlossen. Die Dollar-Begrenzer des DO-Blocks (`:31`, `:70`) sind keine Einsetzung, weil auf das Dollarzeichen keine geschweifte Klammer folgt. Die SQL-Kommentare `:49`, `:54`, `:58`, `:67` enthalten weder Hochkomma noch Dollarzeichen. `:22` ist als TypeScript in Ordnung (optionale Verkettung, Ersatzwert, `Number`).

**SQL im DO-Block?** Von Hand durchgegangen: Deklarationen `:32-36`; Schleife über eine Werteliste mit drei Spalten `:40-46`; Platzhalter und Argumente der Ausnahmen passen (`:51` zwei und zwei, `:56` einer und einer, `:60` einer und einer, `:65` keiner); Bedingung `:59` aus drei mit ODER verbundenen Vergleichen; `:68-69` baut je Funktion einen Entzug und führt die Kette ohne Parameter aus (mehrere Befehle in einem dynamischen Befehlstext sind ohne USING zulässig, unverändert seit Runde 1).

**Länge 36 des Präfix?** Stimmt. Gezählt: CREATE 6, Leerzeichen 1, OR 2, Leerzeichen 1, REPLACE 7, Leerzeichen 1, FUNCTION 8, Leerzeichen 1, Schemaname 8, Punkt 1 = 36. `pg_get_functiondef` beginnt mit genau diesem großgeschriebenen Kopf und dem schemaqualifizierten Namen ohne Anführungszeichen (Namen sind klein und ohne Sonderzeichen); nach der Ersetzung in `:53` beginnt `neu` im Zielschema. Bleibt eine Ersetzung aus, schlägt mindestens eine der drei Bedingungen in `:59` an, der Block rollt samt Schema zurück, die echte Funktion wird nicht überschrieben.

**Signaturen?** Unverändert richtig: `:42` = `0064:176`, `:43` = `0062:703-706` (10 Typen), `:44` = `0062:775-778` (13 Typen). Suche über alle Migrationen: jüngste Definitionen `0062:703`, `0062:775`, `0064:176`; 0065 bis 0070 definieren keine der drei neu (die Treffer der Sperrklausel in `0069:55`, `:81` gehören zu `start_job` und `complete_job`).

**Zählung der Sperrklausel?** Erwartung 1 / 1 / 0 passt zum Stand: `0064:188` (change_gate), `0062:719` (cancel_by_customer; die ungesperrte Leseanweisung `0062:717` trifft das Muster nicht), keine in `0062:775-827` (cancel_by_partner, Aufruf von change_gate in `:789`). cancel_by_customer ruft change_gate nicht auf (`0062:703-748`); die dritte Ersetzung ist dort wirkungslos und die Rückübersetzung bleibt eindeutig.

**loeschFreigabe zuerst?** Ja: `:21` vor der lesenden Zählung `:22` und dem Entfernen `:23`; `:29` vor `entferneKopien()` `:30` und dem DO-Block `:31`. Guard ist die erste Import-Anweisung (`:7`). Die Prüfung verlangt den Lauf des Start-Programms, den Registereintrag und eine Freigabe für Pfad und Hash aus dem Commit (`gate-loesch-lib.mjs:37-44`); Registereintrag `loesch-register.json:4` ohne gebundene Dateien.

**Löscht oder ändert die Datei etwas außerhalb des eigenen Schemas?** Nein. Verändernde Anweisungen: Schema entfernen (`:23`), Schema anlegen (`:38`), Rechte entziehen (`:39`, `:68-69`), `execute neu` (`:62`, mit erzwungenem Zielschema und Zählung genau drei in `:64-66`). Der Schemaname kommt im Repository nur in dieser Datei, im Test und im Register vor (Suche: 3 Dateien).

**Rechte?** Unverändert: Entzug an Schema und Funktionen im selben DO-Block wie die Anlage, die Kopien sind nie mit offenen Rechten sichtbar. Default-Privilegien des Projekts betreffen nur `public`. Gegenprüfung fehlt (N1).

## Nutzung im Test

- `tests/rls/storno-wettlauf.test.ts:26`: Normallauf entfernt nur Reste, Negativkontrolle legt an; `:27-33` entfernt immer, auch wenn das Entfernen wirft, laufen die Testreste durch den Aufräumweg.
- `:54-58`: Ziele aus der Konstante `KOPIE` oder Literale der echten Funktionen; 10 bzw. 13 Argumente.
- Weiterhin nicht von mir belegt: dass ohne Sperre beide Aufrufe gelingen. Das zeigt erst der rote Lauf mit zwei Erfolgen als Ist-Wert im Log (`:73`); in `runs.jsonl` steht bisher kein Lauf des Wettlauftests. Reihenfolge laut Regel: roter Lauf vor dem ersten grünen.
- Die Freigabe wirkt erst nach der Übernahme in den Commit (`.claude/rules/daten.md:18`).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tests/support/race-copy.ts:7` | Guard ist die erste Import-Anweisung: in Ordnung |
| `tests/support/race-copy.ts:21`, `:29` | Freigabeprüfung jeweils erste Anweisung: in Ordnung |
| `tests/support/race-copy.ts:22-24` | Zählung vor dem Entfernen, Ersatzwert 0, echte Zahl im Log: in Ordnung |
| `tests/support/race-copy.ts:23` | einzige Löschanweisung, nur das eigene Schema: in Ordnung |
| `tests/support/race-copy.ts:31`, `:70` | einzige Backticks außerhalb der TS-Kommentare, Literal geschlossen: in Ordnung |
| `tests/support/race-copy.ts:48`, `:53`, `:55` | einzige Einsetzungen, nur die zwei Konstanten: in Ordnung |
| `tests/support/race-copy.ts:42-44` | drei Signaturen stimmen mit `0064:176`, `0062:703-706`, `0062:775-778` |
| `tests/support/race-copy.ts:48-52` | exakte Zählung 1 / 1 / 0, sonst Abbruch: in Ordnung |
| `tests/support/race-copy.ts:53-57` | Ersetzung und Rückübersetzung symmetrisch: in Ordnung |
| `tests/support/race-copy.ts:58` | Kommentar ohne Auszeichnung: H1 behoben |
| `tests/support/race-copy.ts:59-62` | Präfix 36 Zeichen, fester Vergleich, vor `execute`: in Ordnung |
| `tests/support/race-copy.ts:64-66` | genau drei Funktionen, sonst Abbruch: in Ordnung |
| `tests/support/race-copy.ts:39`, `:68-69` | Entzug an Schema und Funktionen im selben Block: in Ordnung (N1) |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:702-748` | cancel_by_customer: 10 Parameter, Sperrklausel einmal (`:719`), kein Aufruf von change_gate |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:774-827` | cancel_by_partner: 13 Parameter, Aufruf von change_gate einmal (`:789`), keine eigene Sperrklausel |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:761` | Aufruf von change_gate in cancel_by_partner_basis, nicht in einer der kopierten Funktionen |
| `supabase/migrations/20261115104122_0064_report_flow.sql:176-199` | jüngste Fassung von change_gate, Sperrklausel einmal (`:188`) |
| `supabase/migrations/20261116140000_0069_replay_rest.sql:43-109` | Sperrklausel in `start_job` und `complete_job`, keine Neudefinition der drei Funktionen |
| `tests/rls/storno-wettlauf.test.ts:26-33` | Anlage nur in der Negativkontrolle, Entfernen immer, try/finally: in Ordnung |
| `tests/rls/storno-wettlauf.test.ts:57-58` | 10 bzw. 13 Argumente: passend |
| `scripts/sys/gate-loesch-lib.mjs:37-44` | Laufbindung, Register, Freigabe aus dem Commit: in Ordnung |
| `scripts/sys/gate-db-lib.mjs:39-66` | Format der Freigabe und Prüfung: dieser Bericht hält es ein |
| `scripts/sys/loesch-register.json:4` | Eintrag ohne gebundene Dateien: in Ordnung |
| `tests/support/owner.ts:20-37` | Fehler der Datenbank werden geworfen, ein Abbruch im DO-Block erreicht den Test |
| `tmp/proof/sys1/010-check.log:18-19`, `:23` | EXIT=2 wegen `tests/unit/sys-bericht-lib.test.ts`, kein Fehler in der geprüften Datei |
| `tmp/proof/sys1/011-check.log:1-3`, `:369` | Commit 239127b, Arbeitsbaum nicht sauber, EXIT=0; Suche nach Fehlern: 0 Treffer |
| `tmp/proof/sys1/runs.jsonl:12-13` | Lauf 10 exit 2, Lauf 11 exit 0, gleicher Fingerabdruck (Index), `dateiSha` leer: N9 |
| `scripts/sys/fingerabdruck.mjs:23` | Fingerabdruck aus dem Index der verfolgten Dateien: N9 |
| `tmp/proof/sys1/runs.jsonl` (Suche nach dem Wettlauftest) | kein Lauf |

Offene Findings hoch: 0
