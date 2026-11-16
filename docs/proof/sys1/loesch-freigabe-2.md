Modell: claude-fable-5-2
SHA256: dceb483ce324eea5f439e33af32c8f6561c76b5eeb2b8e4dad7697f9ca8c0c36 tests/support/race-copy.ts
Urteil: gesperrt

# Lösch-Freigabe 2, Schritt sys1

Datum: 2026-11-16
Vorgängerbericht: `tmp/proof/sys1/loesch-freigabe-1.md` (gesperrt, hoch 1: H1 veraltete Signaturen; M1 Namensprüfung).
Geprüft (vollständig gelesen): `tests/support/race-copy.ts` (72 Zeilen) und seine Nutzung in `tests/rls/storno-wettlauf.test.ts` (84 Zeilen).
Zur Einordnung gelesen: Vorgängerbericht, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs:34-66`, `scripts/sys/loesch-register.json`, `tests/support/owner.ts`, `tests/unit/sys-gate-loesch.test.ts:120-169`, `.claude/rules/daten.md`, `supabase/migrations/20261114100000_0062_fee_schedule.sql:690-830`, `supabase/migrations/20261115104122_0064_report_flow.sql:170-205`, Suche über alle Migrationen nach den drei Funktionen, `tsconfig.node.json:7`.

Hinweise zum Nachweis:
- Die Hash-Zeile oben ist unverändert aus dem Auftrag übernommen und von mir nicht nachgerechnet (kein Shell-Werkzeug). Das Gate rechnet sie gegen die Datei nach.
- Ich konnte nichts ausführen. Aussagen über das Verhalten auf Dev stützen sich auf die Migrationsdateien (Stand bis 0070 vorausgesetzt).
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

## Ergebnis in einem Satz

Die Funde der Runde 1 (H1 Signaturen, M1 Namensprüfung, N2 Log, N3 try/finally) sind inhaltlich richtig behoben, aber der neue Kommentar zur Namensprüfung steht mit zwei Backticks mitten im Template-Literal des DO-Blocks und beendet es vorzeitig: die Datei ist kein gültiges TypeScript mehr, der Fix ändert den Hash, darum gesperrt.

## Findings hoch

H1 (neu). `tests/support/race-copy.ts:58` – Der SQL-Kommentar setzt das Wort execute in Backticks. Die Zeile liegt innerhalb des Template-Literals, das in `:31` mit einem Backtick beginnt und in `:70` enden soll. Gezählt (Suche nach dem Zeichen in der Datei): außerhalb von Kommentaren gibt es genau vier Backticks, `:31`, zweimal `:58`, `:70`; keiner ist mit Backslash maskiert (Suche nach Backslash plus Backtick: 0 Treffer). Damit endet das Literal in `:58` vor dem Wort execute, danach folgt ein bloßer Bezeichner und ein zweites Literal: Syntaxfehler (zwei Ausdrücke ohne Operator im Argument von `ownerSql`). Folgen: Das Modul lässt sich nicht laden, `tests/rls/storno-wettlauf.test.ts:14` scheitert schon beim Import; weder der Normallauf noch die Negativkontrolle können laufen, und ein Rot-Beweis, der am Import scheitert, misst nicht die Wirkung der fehlenden Sperre (`.claude/rules/tests.md`). Geschlossen im Fehlerfall (es wird nichts gelöscht oder angelegt), aber die Datei erfüllt ihren Zweck nicht, und eine Freigabe für einen Hash, der nie laufen kann, wäre wertlos. Bisher unbemerkt, weil weder der Wettlauftest noch ein Lauf mit Typprüfung seit der Änderung in `tmp/proof/sys1/runs.jsonl` steht (Suche: 0 Treffer für den Wettlauftest); die Unit-Tests des Lösch-Gates lesen die Datei nur als Text (`tests/unit/sys-gate-loesch.test.ts:146-149`).
Fix: in `:58` die beiden Backticks entfernen (das Wort ohne Auszeichnung schreiben). Ändert den Hash; Runde 3 nötig. Vor dem Auftrag für Runde 3 `npm run t -- check` laufen lassen: `tsconfig.node.json:7` schließt `tests` ein, die Typprüfung fängt genau diesen Fehler.

## Findings mittel

Keine.

## Findings niedrig

N1 (aus Runde 1, offen). `tests/support/race-copy.ts:67-69` – Rechte werden entzogen, aber nicht gegengeprüft. Fix: am Ende des DO-Blocks `has_schema_privilege` (USAGE) und `has_function_privilege` (EXECUTE) für `anon`, `authenticated`, `service_role` abfragen und bei einem Treffer werfen.

N4 (aus Runde 1, offen). `tests/unit/sys-gate-loesch.test.ts:153-160` – Die Stellung der Freigabeprüfung ist nur für `sweep.ts` per Unit-Test festgehalten. Fix: gleichartigen Test für `race-copy.ts` ergänzen; wenn er die Datei zusätzlich durch den TypeScript-Transpiler schickt, hätte er H1 gefangen.

N5 (aus Runde 1, festgehalten). `tests/support/race-copy.ts:23`, `:38` – Schema anlegen und entfernen löst auf Dev die DDL-Ereignisse der Plattform aus. Ohne Wirkung auf Daten.

N6 (neu). `tests/support/race-copy.ts:59` – Das Muster der LIKE-Prüfung enthält im Schemanamen einen Unterstrich; der ist in LIKE ein Platzhalter für ein beliebiges Zeichen. Die Prüfung ließe also auch ein Schema durch, das an dieser einen Stelle ein anderes Zeichen trägt. Mit `public` und `private` nicht erreichbar, und die Zählung in `:64` fängt den Fall zusätzlich. Fix: `left(neu, 36) is distinct from 'CREATE OR REPLACE FUNCTION race_ctl.'` statt LIKE.

N7 (neu). `tests/support/race-copy.ts:17` – Die Ersetzung hängt `perform pg_sleep(2)` hinter die Leseanweisung. PERFORM setzt FOUND auf wahr; in der Kopie von `change_gate` ist die folgende Prüfung auf nicht gefunden (`0064_report_flow.sql:189`) damit wirkungslos. Für den Test ohne Belang (die Anfrage existiert; fehlt sie, wirft die Zuordnungsprüfung in `0064:192-194` dieselbe Meldung). Die Aussage im Kopf der Datei, die Kopie weiche nur in Namen und Sperrklausel ab, stimmt textlich, nicht ganz im Verhalten. Kein Fix nötig; ein Halbsatz im Kopfkommentar genügt.

N8 (neu). `tests/support/race-copy.ts:22` – Liefert die Abfrage wider Erwarten keine Zeile, loggt `schemaEntfernt` den Wert null (NaN). Ohne Wirkung auf das Löschen. Fix optional: `?? 0` bzw. bei NaN werfen.

## Stand der Funde aus Runde 1

| Fund | Stand | Beleg |
|---|---|---|
| H1 Signaturen | behoben | `race-copy.ts:43` = 10 Typen (uuid, uuid, bigint, numeric, 4× bigint, 2× integer), deckungsgleich mit `0062:703-706`; `race-copy.ts:44` = 13 Typen (uuid, text, uuid, text, uuid[], bigint, numeric, 4× bigint, 2× integer), deckungsgleich mit `0062:775-778`. Nach 0062 legt keine Migration die beiden Funktionen neu an (Suche über alle Migrationen: jüngste Definition `0062:703`, `0062:775`; `0068:23`, `:36` nennen nur die Aktionsnamen). `change_gate(uuid,text,uuid)` in `:42` passt zur jüngsten Fassung `0064:176`. |
| M1 Namensprüfung | behoben (N6) | `race-copy.ts:59-61` vor `execute neu` in `:62`: Kopf muss im Zielschema beginnen, der alte Kopf und der Aufruf von `private.change_gate(` dürfen nicht mehr vorkommen, sonst Abbruch. `:64-66`: genau drei Funktionen im Schema, sonst Abbruch. |
| N1 Gegenprüfung der Rechte | offen (niedrig) | siehe oben |
| N2 Log mit echter Zahl | behoben (N8) | `race-copy.ts:22-24`: Zählung in `pg_namespace` nach der Freigabeprüfung und vor dem Entfernen |
| N3 try/finally | behoben | `tests/rls/storno-wettlauf.test.ts:27-33` |
| N4 Unit-Test | offen (niedrig) | siehe oben |
| N5 DDL-Ereignisse | festgehalten | – |

## Antworten auf die Prüffragen

**Signaturen (10 bzw. 13 Parameter)?** Stimmen, siehe Tabelle. Der Test ruft mit denselben Zahlen (`storno-wettlauf.test.ts:57`: 10 Argumente, `:58`: 13 Argumente).

**Namensprüfung?** Inhaltlich richtig und an der richtigen Stelle: nach der Rückübersetzung, vor `execute neu`. `pg_get_functiondef` beginnt deterministisch mit dem großgeschriebenen Kopf samt schemaqualifiziertem Namen; nach der Ersetzung beginnt `neu` im Zielschema. Bleibt eine Ersetzung aus (Spalte 2 passt nicht zu Spalte 1), schlägt mindestens eine der drei Bedingungen in `:59` an und der DO-Block rollt samt Schema zurück; die echte Funktion wird nicht überschrieben. Einschränkung N6. Die Ausführung dieser Prüfung ist derzeit durch H1 verhindert (ihr Kommentar bricht die Datei).

**Zählung genau drei Funktionen?** Ja, `:64-66`, über `pg_proc` mit dem Namensraum des Schemas, nach der Schleife und vor dem Entzug der Rechte.

**Rückübersetzung?** Unverändert richtig (`:53`, `:55-57`): drei Ersetzungen hin, dieselben drei zurück, Vergleich mit dem Original, Abbruch bei Abweichung. Zählung der Sperrklausel `:48-52`: erwartet 1 in `change_gate` (`0064:188`) und `cancel_by_customer` (`0062:719`; die ungesperrte Leseanweisung `0062:717` trifft das Muster nicht), 0 in `cancel_by_partner` (`0062:789-826` gelesen, `:790` ohne Sperre). Der Ersatztext kommt in keinem Original vor, die Rückübersetzung ist eindeutig.

**Rechte?** Schema: Entzug für PUBLIC und die drei API-Rollen direkt nach dem Anlegen (`:39`). Funktionen: Entzug für PUBLIC und die drei API-Rollen für jede Funktion des Schemas (`:68-69`), im selben DO-Block wie die Anlage, also nie mit offenen Rechten sichtbar. Default-Privilegien des Projekts betreffen nur `public` (`0070:7`). Die Kopien behalten `security definer` und den leeren `search_path` aus der Definition des Originals. Gegenprüfung fehlt (N1).

**loeschFreigabe zuerst?** Ja: `entferneKopien` `:21` (die neue Zählabfrage `:22` ist lesend und steht danach), `legeKopienAn` `:29`, dann `entferneKopien()` mit erneuter Prüfung, erst dann der DO-Block. Guard ist die erste Import-Anweisung (`:7`). Importe unverändert drei (Guard, Gate-Bibliothek, `owner.ts`), alle in der Liste der unkritischen Dateien (`tests/unit/sys-gate-loesch.test.ts:145`). Registereintrag `scripts/sys/loesch-register.json:4` ohne gebundene Dateien passt.

**Löscht oder ändert die Datei etwas außerhalb des Schemas?** Nein. Verändernde Anweisungen: Schema entfernen (`:23`), Schema anlegen (`:38`), Rechte entziehen (`:39`, `:68-69`), `execute neu` (`:62`, jetzt mit erzwungenem Zielschema). Der Name des Schemas kommt im Repository nur in dieser Datei, im Test und im Register vor.

## Nutzung im Test

- `tests/rls/storno-wettlauf.test.ts:26`: Normallauf entfernt nur Reste, Negativkontrolle legt an; `:27-33` entfernt immer und räumt auch bei einem Fehler des Entfernens die Testreste ab.
- `:54-58`: Ziele aus der Konstante `KOPIE` oder Literale der echten Funktionen; Argumentzahl passend.
- Weiterhin nicht von mir belegt: dass ohne Sperre beide Aufrufe gelingen (bei der Firma hängt das an der zweiten Weitervermittlung in `0062:814`). Das zeigt erst der rote Lauf; er muss zwei Erfolge als Ist-Wert im Log tragen, sonst zählt er nicht.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tests/support/race-copy.ts:7` | Guard ist die erste Import-Anweisung: in Ordnung |
| `tests/support/race-copy.ts:21`, `:29` | Freigabeprüfung jeweils erste Anweisung: in Ordnung |
| `tests/support/race-copy.ts:22-24` | Zählung vor dem Entfernen, echte Zahl im Log: in Ordnung (N8) |
| `tests/support/race-copy.ts:23` | einzige Löschanweisung, nur das eigene Schema: in Ordnung |
| `tests/support/race-copy.ts:31`, `:58`, `:70` | vier unmaskierte Backticks außerhalb der TS-Kommentare, Literal endet in `:58`: H1 |
| `tests/support/race-copy.ts:42-44` | drei Signaturen stimmen mit `0064:176`, `0062:703-706`, `0062:775-778` |
| `tests/support/race-copy.ts:48-52` | exakte Zählung 1 / 1 / 0, sonst Abbruch: in Ordnung |
| `tests/support/race-copy.ts:53-57` | Ersetzung und Rückübersetzung symmetrisch: in Ordnung |
| `tests/support/race-copy.ts:59-62` | Namensprüfung vor `execute`: inhaltlich in Ordnung (N6) |
| `tests/support/race-copy.ts:64-66` | genau drei Funktionen, sonst Abbruch: in Ordnung |
| `tests/support/race-copy.ts:39`, `:68-69` | Entzug an Schema und Funktionen im selben Block: in Ordnung (N1) |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:702-706` | alte Überladung gelöscht, neue mit 10 Parametern |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:774-778` | alte Überladung gelöscht, neue mit 13 Parametern |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:717-719` | Sperrklausel genau einmal in `cancel_by_customer` |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:789-826` | `cancel_by_partner`: Aufruf von `change_gate` einmal, keine eigene Sperrklausel |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:1046-1051` | Rechte auf den Signaturen mit 10 bzw. 13 Parametern |
| `supabase/migrations/20261115104122_0064_report_flow.sql:176-199` | jüngste Fassung von `change_gate`, Sperrklausel einmal (`:188`), Prüfung auf nicht gefunden direkt danach (`:189`): N7 |
| `supabase/migrations/20261116130000_0068_replay_nach_erfolg.sql:23`, `:36` | nur Aktionsnamen, keine Neudefinition |
| `supabase/migrations/20261116150000_0070_default_privileges.sql:7` | Default-Privilegien nur für `public` |
| `tests/rls/storno-wettlauf.test.ts:27-33` | try/finally im afterAll: in Ordnung |
| `tests/rls/storno-wettlauf.test.ts:57-58` | 10 bzw. 13 Argumente: passend |
| `scripts/sys/gate-db-lib.mjs:39-66` | Format der Freigabe und Prüfung (Modell, Hash und Pfad, Urteil, hohe Funde): dieser Bericht hält es ein |
| `scripts/sys/gate-loesch-lib.mjs:37-44` | Laufbindung, Register, Freigabe aus dem Commit: in Ordnung |
| `scripts/sys/loesch-register.json:4` | Eintrag ohne gebundene Dateien: in Ordnung |
| `tests/support/owner.ts:20-37` | Fehler der Datenbank werden geworfen, ein Abbruch im DO-Block erreicht den Test |
| `tests/unit/sys-gate-loesch.test.ts:146-149` | Registerskripte werden nur als Text gelesen, ein Syntaxfehler fällt dort nicht auf |
| `tsconfig.node.json:7` | `tests` in der Typprüfung enthalten |
| `tmp/proof/sys1/runs.jsonl` (Suche nach dem Wettlauftest) | kein Lauf |

Offene Findings hoch: 1
