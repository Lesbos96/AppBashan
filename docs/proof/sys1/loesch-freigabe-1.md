Modell: claude-fable-5-2
SHA256: 48e95f7db299f535c475bac9e495b2e2c83f395f3d1b10cf7a6383584024d41b tests/support/race-copy.ts
Urteil: gesperrt

# Lösch-Freigabe 1, Schritt sys1

Datum: 2026-11-16
Geprüft (vollständig gelesen): `tests/support/race-copy.ts` (64 Zeilen) und seine Nutzung in `tests/rls/storno-wettlauf.test.ts` (81 Zeilen).
Zur Einordnung gelesen: `scripts/sys/loesch-register.json`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-db-lib.mjs`, `scripts/dev-guard.mjs`, `tests/support/owner.ts`, `tests/unit/sys-gate-loesch.test.ts:96-170`, `docs/freigaben/u1b-loesch-freigabe-1.md`, `.claude/rules/daten.md`, Ausschnitte der Migrationen 0001, 0031, 0062, 0064, 0070, `supabase/functions/_shared/cancel/db.ts:31-84`, `tests/rls/rls.test.ts:496-499`.

Hinweise zum Nachweis:
- Die Hash-Zeile oben ist unverändert aus dem Auftrag (Korrektur der Hauptsession) übernommen und von mir nicht nachgerechnet (kein Shell-Werkzeug). Das Gate rechnet sie gegen die Datei nach.
- Ich konnte nichts ausführen. Alle Aussagen über das Verhalten auf Dev stützen sich auf die Migrationsdateien; ich setze voraus, dass Dev dem Stand bis 0070 entspricht.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*` gelesen.

## Ergebnis in einem Satz

Die Datei ist als Löschweg sauber eingegrenzt (nur Schema `race_ctl`, Freigabeprüfung vor jeder Änderung, Guard zuerst, Kopien für keine API-Rolle erreichbar), aber die Anlage der Kopien kann auf dem aktuellen Schema nicht gelingen, weil zwei der drei Signaturen veraltet sind; der Fix ändert den Hash, darum hier gesperrt statt frei.

## Findings hoch

H1. `tests/support/race-copy.ts:42-43` – Die Signaturen für `cancel_by_customer` (11 Parameter, zweimal `numeric`) und `cancel_by_partner` (14 Parameter, zweimal `numeric`) sind die vor Migration 0062. 0062 hat genau diese Überladungen gelöscht (`supabase/migrations/20261114100000_0062_fee_schedule.sql:702`, `:774`) und mit einem `numeric` weniger neu angelegt (`:703-706` = 10 Parameter, `:775-778` = 13 Parameter; Rechte auf dieselben Signaturen in `:1046-1051`). Keine spätere Migration legt sie wieder an (Suche über 0063 bis 0070). Der Cast auf `regprocedure` wirft damit „function … does not exist“, der ganze DO-Block bricht ab, es entsteht kein Schema. Das ist geschlossen im Fehlerfall (kein Schaden), aber `legeKopienAn` kann nie gelingen: die Negativkontrolle scheitert im `beforeAll` statt mit den gemessenen zwei Erfolgen, und das zählt nach `.claude/rules/tests.md` nicht als Rot-Beweis. Der Test selbst ruft schon mit den neuen Parameterzahlen (`tests/rls/storno-wettlauf.test.ts:54-55`: 10 und 13 Argumente), ebenso `tests/rls/rls.test.ts:499` und `supabase/functions/_shared/cancel/db.ts:31-45`, `:73-84`. Bisher lief der Wettlauftest in sys1 nicht (kein Log, kein Eintrag in `runs.jsonl`), der Fehler ist also noch nicht aufgefallen.
Fix: in Zeile 42 `public.cancel_by_customer(uuid,uuid,bigint,numeric,bigint,bigint,bigint,bigint,integer,integer)`, in Zeile 43 `public.cancel_by_partner(uuid,text,uuid,text,uuid[],bigint,numeric,bigint,bigint,bigint,bigint,integer,integer)`. Ändert den Hash; neue Freigabe (Runde 2) nötig. M1 im selben Zug beheben.

## Findings mittel

M1. `tests/support/race-copy.ts:52-57` – Die Rückübersetzung beweist nur, dass die Kopie höchstens in Namen und Sperrklausel abweicht, nicht, dass der Kopf wirklich umbenannt wurde. Kommt `v.alt` im Text von `pg_get_functiondef` nicht vor (Spalte 2 passt nicht zu Spalte 1, etwa nach einer Umbenennung oder einem Tippfehler), bleibt der Kopf `create or replace function public.…` bzw. `private.…`, die Prüfung in Zeile 54 besteht trotzdem (hin und zurück ist dann beide Male nichts ersetzt), und `execute neu` in Zeile 57 überschreibt die echte Funktion mit der Fassung ohne Sperre und mit 2 s Pause. `drop schema race_ctl cascade` macht das nicht rückgängig. Mit den heutigen Literalen ist der Fall nicht erreichbar (Schema- und Funktionsnamen brauchen keine Anführungszeichen, der Kopf lautet deterministisch `public.cancel_by_customer(` usw.), darum nicht hoch; es ist aber die einzige Stelle, an der die Datei offen statt geschlossen scheitern würde, und genau die Art Drift, die H1 zeigt.
Fix: vor `execute neu` hart prüfen, dass `neu` mit `CREATE OR REPLACE FUNCTION race_ctl.` beginnt und `v.alt` sowie `private.change_gate(` nicht mehr enthält, sonst `raise exception`. Nach der Schleife zusätzlich prüfen, dass `race_ctl` genau drei Funktionen enthält.

## Findings niedrig

N1. `tests/support/race-copy.ts:59-61` – Die Rechte werden entzogen, aber nicht gegengeprüft. Fix: im DO-Block am Ende `has_schema_privilege` (USAGE) und `has_function_privilege` (EXECUTE) für `anon`, `authenticated`, `service_role` abfragen und bei einem Treffer werfen.

N2. `tests/support/race-copy.ts:23` – Das Log schreibt `schemaEntfernt: 1` auch, wenn kein Schema vorhanden war (Normallauf: zweimal je Lauf). Fix: vorher zählen (`pg_namespace`) und die echte Zahl loggen.

N3. `tests/rls/storno-wettlauf.test.ts:27-30` – Wirft `entferneKopien()` im `afterAll`, läuft `sweepTestResidue` nicht mehr. Fix: `try { entferneKopien() } finally { sweepTestResidue(adm, true) }`.

N4. `tests/unit/sys-gate-loesch.test.ts:153-160` – Für `sweep.ts` hält ein Unit-Test die Stellung der Freigabeprüfung fest, für `race-copy.ts` nicht. Durch den Hash der Freigabe gebunden, also kein Loch. Fix: gleichartigen Test ergänzen (beide Funktionen beginnen mit der Freigabeprüfung).

N5. `tests/support/race-copy.ts:37`, `:22` – Anlegen und Entfernen des Schemas lösen auf Dev die DDL-Ereignisse der Plattform aus (Neuladen des API-Schema-Caches). Ohne Wirkung auf Daten; nur festgehalten.

## Antworten auf die Prüffragen

**(1) Löscht oder ändert die Datei etwas außerhalb von `race_ctl`?** Nein, mit der Einschränkung M1. Verändernde Anweisungen sind nur: Schema entfernen (`race-copy.ts:22`), Schema anlegen (`:37`), Rechte am Schema und an den Funktionen des Schemas entziehen (`:38`, `:60-61`) und `execute neu` (`:57`). Die Kaskade trifft den Inhalt des Schemas und Objekte, die von ihm abhängen; solche gibt es nicht: `race_ctl` kommt im ganzen Repository nur in dieser Datei, im Test und im Register vor, keine Migration nennt es, und plpgsql-Rümpfe erzeugen keine Abhängigkeiten. Tabellen, Daten und Funktionen in `public` und `private` bleiben unberührt, solange `execute neu` wirklich nach `race_ctl` schreibt (das ist mit den heutigen Literalen der Fall, aber nicht erzwungen: M1). Die Originale werden nur gelesen (`pg_get_functiondef`, `:46`). Außerhalb der Datenbank schreibt die Datei nur die Logzeile nach `tmp/proof/<schritt>/loesch-lauf.jsonl`.
Zur Einordnung: Die Kopien selbst sind SECURITY DEFINER wie die Originale und verändern beim Aufruf Daten in `public` (Status, Zuordnung, Journal-Gegenbuchung, Audit, Outbox). Das tut der Test bewusst als Eigentümer auf seinen eigenen, committeten Fixtures; diese Aufrufe stehen im Test, nicht in der geprüften Datei, und laufen wie bei den übrigen RLS-Tests außerhalb des Lösch-Gates.

**(2) Kopien nur für den Eigentümer ausführbar?** Ja. Ein neues Schema hat keine Rechte für andere Rollen; der Entzug in `:38` ist die Absicherung dazu. Die Default-Privilegien des Projekts gelten nur für `public` (`supabase/migrations/20261116150000_0070_default_privileges.sql:7`; kein `alter default privileges … on schemas` in den Migrationen), die Funktionen in `race_ctl` bekommen also nur das allgemeine EXECUTE für PUBLIC, und das entzieht `:60-61` samt `anon`, `authenticated`, `service_role` für jede Funktion des Schemas. Anlage und Entzug liegen in einem DO-Block, also in einer Anweisung: andere Verbindungen sehen die Kopien nie mit offenen Rechten. Ist das Schema leer, ist der Text für `execute` leer und die Anweisung wirft (geschlossen). Ohne USAGE auf das Schema sind die Kopien für API-Rollen auch nicht auflösbar, und das Schema steht nicht in den API-Schemas. Gegenprüfung fehlt (N1).

**(3) Abbruch bei unerwarteter Sperrklausel oder abweichender Rückübersetzung?** Sperrklausel: ja. Gezählt wird das exakte Vorkommen; erwartet genau 1 in `change_gate` und `cancel_by_customer`, genau 0 in `cancel_by_partner`, sonst `raise exception` (`:47-51`). Gegen die Quellen geprüft: je ein Vorkommen in `0064_report_flow.sql:188` und `0062_fee_schedule.sql:719` (die ungesperrte Leseanweisung in `:717` trifft das Muster nicht), keines in `0062:789-826`. Rückübersetzung: ja, bei Ungleichheit wird geworfen (`:54-56`); die Prüfung fängt nicht umkehrbare Ersetzungen ab, aber nicht den Fall, dass der Kopf gar nicht umbenannt wurde (M1). Jeder Abbruch rollt den ganzen DO-Block zurück, auch das Anlegen des Schemas. Davor scheitert die Anlage heute ohnehin an H1.

**(4) Freigabeprüfung vor jeder Änderung, Guard als erster Import?** Ja. `entferneKopien`: erste Anweisung (`:21`). `legeKopienAn`: erste Anweisung (`:28`), danach `entferneKopien()` mit erneuter Prüfung, erst dann SQL. Der Guard ist die erste Import-Anweisung (`:7`). Importiert werden nur Guard, Gate-Bibliothek und `owner.ts`; alle drei stehen in der Liste der unkritischen Dateien, die der Unit-Test für jedes Registerskript erzwingt (`tests/unit/sys-gate-loesch.test.ts:145-149`), `owner.ts` und der Guard sind per Hash im Register festgehalten (`scripts/sys/loesch-register.json:20`, `:29`). Registereintrag ohne gebundene Dateien (`:4`) ist richtig: die Datei hat keine weiteren eigenen Abhängigkeiten. Die Prüfung verlangt den Lauf über das Start-Programm, den Registereintrag und eine Freigabe aus dem Commit mit dem aktuellen Hash (`scripts/sys/gate-loesch-lib.mjs:37-44`).

## Nutzung im Test

- `tests/rls/storno-wettlauf.test.ts:26`: Normallauf entfernt nur Reste (`entferneKopien`), die Negativkontrolle legt an; `:27-30` entfernt in beiden Fällen wieder. Ein Absturz hinterlässt nur das unerreichbare Schema, das der nächste Lauf zuerst entfernt. In Ordnung (N3).
- `:51-52`: Die Ziele kommen aus der Konstante `KOPIE` bzw. sind Literale der echten Funktionen; keine Eingabe von außen im SQL außer selbst erzeugten IDs und Werten aus `currentFee`.
- `:33`, `:70`: Titel und Logzeile nennen das Ziel (Kopie oder echte Funktionen) und die Ist-Werte; der Rot-Beweis misst damit die Wirkung der fehlenden Sperre, sobald H1 behoben ist.
- Nicht von mir belegt: dass ohne Sperre wirklich beide Aufrufe gelingen (zweiter Statuswechsel auf denselben Status, zweite Weitervermittlung bei der Firma). `private.set_request_status` sperrt selbst nicht vorab (`0031_distribute_accept.sql:5-17`), `private.cancel_reverse_all` bucht beim zweiten Durchlauf nichts doppelt (`0062:335-338`); der Rest hängt an Triggern, die ich nicht gelesen habe. Das zeigt der rote Lauf.
- Der Test ist nicht per Hash gebunden (das Register erfasst nur `scripts/` und `tests/support/`); diese Freigabe sagt über seine eigenen committeten Fixtures und Aufrufe nichts aus.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tests/support/race-copy.ts:7` | Guard ist die erste Import-Anweisung: in Ordnung |
| `tests/support/race-copy.ts:21`, `:28` | Freigabeprüfung jeweils erste Anweisung: in Ordnung |
| `tests/support/race-copy.ts:22` | einzige Löschanweisung, nur Schema `race_ctl`: in Ordnung |
| `tests/support/race-copy.ts:38`, `:60-61` | Entzug für PUBLIC und die drei API-Rollen an Schema und allen Funktionen des Schemas, im selben DO-Block: in Ordnung (N1) |
| `tests/support/race-copy.ts:42-43` | Signaturen mit zweimal `numeric`, existieren seit 0062 nicht mehr: H1 |
| `tests/support/race-copy.ts:47-51` | exakte Zählung, 1 / 1 / 0 erwartet, sonst Abbruch: in Ordnung |
| `tests/support/race-copy.ts:52-57` | Umbenennung des Kopfes nicht erzwungen: M1 |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:702-706` | alte Überladung gelöscht, neue mit 10 Parametern: bestätigt H1 |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:774-778` | alte Überladung gelöscht, neue mit 13 Parametern: bestätigt H1 |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:1046-1051` | Rechte auf den Signaturen mit einem `numeric`: bestätigt H1 |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:717-719` | Sperrklausel genau einmal im Rumpf von `cancel_by_customer`: passt zur Zählung |
| `supabase/migrations/20261114100000_0062_fee_schedule.sql:789-790` | `cancel_by_partner` ruft `private.change_gate(`, keine eigene Sperrklausel: passt zur Zählung |
| `supabase/migrations/20261115104122_0064_report_flow.sql:176-199` | jüngste Fassung von `change_gate`, Sperrklausel genau einmal (`:188`), Signatur `(uuid, text, uuid)` stimmt mit `race-copy.ts:41` |
| `supabase/migrations/20261116150000_0070_default_privileges.sql:7` | Default-Privilegien nur für Schema `public`: `race_ctl` erbt keine Rechte für API-Rollen |
| `supabase/migrations/20261029141616_0001_foundation.sql:12-14` | einziges weiteres Schema der Migrationen ist `private`; `race_ctl` kommt nicht vor |
| `tests/rls/rls.test.ts:499` | erwartet `cancel_by_partner` mit 13 Parametern: bestätigt H1 |
| `supabase/functions/_shared/cancel/db.ts:31-45`, `:73-84` | Aufrufe mit 13 bzw. 10 benannten Parametern: bestätigt H1 |
| `tests/rls/storno-wettlauf.test.ts:54-55` | Test ruft die Kopien mit 10 bzw. 13 Argumenten, passend zur neuen Signatur |
| `tests/rls/storno-wettlauf.test.ts:26-30` | Anlage nur bei gesetzter Variable, Entfernen immer: in Ordnung (N3) |
| `scripts/sys/loesch-register.json:4` | Eintrag unter den Skripten, keine gebundenen Dateien: in Ordnung |
| `scripts/sys/loesch-register.json:20`, `:29` | Guard und `owner.ts` mit Hash unter den Ausnahmen: in Ordnung |
| `scripts/sys/gate-loesch-lib.mjs:37-44` | Laufbindung, Register, Freigabe aus dem Commit, geschlossen im Fehlerfall: in Ordnung |
| `tests/support/owner.ts:20-37` | SQL als Argument ohne Shell, verlinktes Projekt, Fehler werden geworfen: ein Abbruch im DO-Block erreicht den Test |
| `tests/unit/sys-gate-loesch.test.ts:145-149` | Importprüfung gilt für jedes Registerskript, also auch für `race-copy.ts`: in Ordnung |
| `tmp/proof/sys1/runs.jsonl` (Suche nach dem Wettlauftest) | kein Lauf: H1 bisher unbemerkt |

Offene Findings hoch: 1
