Modell: claude-fable-5-2

# DB-Freigabe 1, Schritt sys2 (Migration 0071, globaler PUBLIC-Default)

Datum: 2026-11-16
Antrag: `tmp/proof/sys2/db-antrag-1.json` (1 offene Migration)
Stand beim Prüfen: Branch `sys2`, HEAD `5caead2`, Arbeitsbaum sauber.

Geprüfter Umfang (vollständig gelesen):
- `supabase/migrations/20261116160000_0071_public_default.sql`
- `supabase/migrations/20261116150000_0070_default_privileges.sql`
- `tests/rls/public-default.test.ts`
- `tmp/proof/sys2/009-tests_rls_public-default.test.ts.log` (Kopf, Fehlerstellen, Ende; nicht komplett)
- `.claude/rules/daten.md`, `.claude/rules/geld.md`, `.claude/rules/tests.md`, `CLAUDE.md`

Nicht gelesen (Auftrag begrenzt auf die genannten Dateien): `tests/support/owner.ts`, `tests/rls/default-privileges.test.ts`, `docs/BEKS.md`, `docs/OFFEN.md`, `runs.jsonl`, `0006_route_infra.sql`. Was daraus folgt, steht unter „Nicht geprüft“.

SHA256: bbcee1a601d3021ff00d266616da1268ada5771b9f3ffcd7e44799531439506a supabase/migrations/20261116160000_0071_public_default.sql

Hinweis zum Hash: aus dem Antrag abgeschrieben (Vorgabe für DB-Freigaben). Selbst nachrechnen konnte ich ihn nicht, mir steht kein Shell-Werkzeug zur Verfügung; den Abgleich mit der Datei macht das Gate bei `db:push`.

Urteil: frei

## Findings

### hoch
Keine.

### mittel

- `tests/rls/public-default.test.ts:45-46` – Der Katalogvergleich „vor und nach 0071 gleich“ wird vom Test nicht erzwungen: Fall 4 gibt den Hash nur aus und prüft `rows.length > 0`, ist also immer grün. Die Gleichheit ist allein ein Vergleich zweier Log-Zeilen. – Fix: Testdatei nicht mehr anfassen (jede Änderung entwertet den Rot-Lauf 009 über `dateiSha`). In der Abnahme die Hash-Zeile des grünen Laufs wörtlich neben `009-…log:16` stellen (259 Zeilen, `822ff1083212d26f0908c44f282ee31a91925bb27f36b74b3a294e669166ccef`). Weicht Zeilenzahl oder Hash ab: anhalten, nicht nachbessern.

- `supabase/migrations/20261116160000_0071_public_default.sql:1` gegen `…0070_default_privileges.sql:5-6` – 0070 hat den globalen PUBLIC-Default ausdrücklich offen gelassen und als Frage an Beks gestellt (OFFEN sys1-1). 0071 beruft sich auf „BEKS 1“. Die Antwort habe ich nicht gesehen (außerhalb des Leseumfangs). – Fix: In der Abnahme die Fundstelle der Entscheidung (BEKS bzw. ENTSCHEIDUNGEN, mit Zeile) nennen und OFFEN sys1-1 schließen. Fehlt das Ja von Beks, vor dem Push anhalten.

- `.claude/rules/daten.md:22` – Die Aufzählung, wo ein Aufrufer künftig EXECUTE braucht („Policies, Defaults, Checks oder Views“), ist unvollständig. Bisher deckte PUBLIC stillschweigend auch diese Fälle ab, die mit 0071 für neue Funktionen wegfallen:
  - Hilfsfunktionen, die eine Triggerfunktion ohne SECURITY DEFINER aufruft. Die Triggerfunktion selbst braucht kein EXECUTE, die verschachtelte Funktion schon, und zwar für die Rolle, die die Zeile schreibt. Bei Triggern auf `auth.users` oder `storage.objects` ist das die jeweilige Dienstrolle von Supabase, nicht `authenticated`.
  - Funktionen in Index-Ausdrücken und generierten Spalten (laufen beim INSERT/UPDATE mit den Rechten des Schreibenden).
  - Verschachtelte Aufrufe aus SECURITY-INVOKER-RPCs.
  - Aggregate und Prozeduren (der Default „on functions“ umfasst alle Routinen).
  - Auth-Hooks (Aufrufer ist die Auth-Dienstrolle).
  Wirkung ist jeweils 42501, also fail closed, kein Leck. – Fix: als Risiko in OFFEN festhalten oder den Satz verallgemeinern („überall, wo die Funktion mit den Rechten des Aufrufers läuft, auch verschachtelt und unter Dienstrollen“). Kein Hindernis für den Push, weil bestehende Funktionen unberührt bleiben.

### niedrig

- `tests/rls/public-default.test.ts:29-34` – Titel sagt „genau eine globale Zeile“, geprüft wird „mindestens ein ACL-Eintrag und keiner für PUBLIC“ (die Zeilen sind entfaltete ACL-Einträge, nicht Zeilen von `pg_default_acl`). Inhaltlich reicht es: je Rolle, Schema und Objekttyp gibt es höchstens eine Zeile, und nach dem Revoke bleibt genau der Eintrag für `postgres`. – Fix: keiner an der Datei (Rot-Beweis); in der Bewertung so benennen.

- `tmp/proof/sys2/009-tests_rls_public-default.test.ts.log:28` – Der Rot-Lauf zeigt den Ist-Wert für Fall 1 nur für `public.anon` (die Schleife in `public-default.test.ts:18` bricht beim ersten Fehler ab). Für `private` gibt es keinen Vorher-Wert im Log. Der Rot-Beweis zählt trotzdem (Ist-Wert `= true` statt `= false`, dazu Fall 2 mit `anon: "= true"` in Zeile 52 und Fall 3 mit 0 Zeilen in Zeile 68). – Fix: keiner; der grüne Lauf muss alle sechs Kombinationen bestehen.

- `.claude/rules/daten.md:22` – „`create extension` als `postgres` legt Funktionen ohne EXECUTE für PUBLIC an“ gilt nur, wenn `postgres` tatsächlich die anlegende Rolle ist. Auf der Supabase-Plattform können Erweiterungen (auch über das Dashboard) unter einer Plattformrolle angelegt werden; dann greift der Default nicht und PUBLIC bleibt. Umgekehrt legen Plattform-Ereignistrigger beim Ein- und Ausschalten mancher Erweiterungen (GraphQL, Netz, Cron) Hüllfunktionen unter der gerade aktiven Rolle an, die dann ohne PUBLIC entstehen können. Nicht am Katalog geprüft. – Fix: Die Nachprüfung nach jeder Erweiterungs-Änderung in beide Richtungen formulieren (Eigentümer und ACL der neuen Funktionen ansehen), in OFFEN vermerken.

- `tests/rls/public-default.test.ts:42` – Der Auszug deckt nur `public` und `private`. Die laut Auftrag 49 Funktionen von `postgres` im Schema `extensions` stehen nicht im Hash. Sachlich unkritisch (ein Default ändert nie bestehende Objekte). – Fix: keiner nötig; in der Abnahme als Grenze des Nachweises nennen.

- Bestand, laut Auftrag (nicht selbst abgefragt): `private.geo_boundaries_make_valid` hat `proacl` NULL, also EXECUTE für PUBLIC. 0071 ändert das nicht. Praktisch harmlos, weil Postgres den direkten Aufruf einer Triggerfunktion ablehnt. – Fix: in OFFEN als Aufräumpunkt (ausdrückliches Revoke in einem späteren Schritt), damit der Katalog keine PUBLIC-Zeile mehr trägt.

- Reihenfolge der Migrationen – Funktionen aus 0001 bis 0069, die sich auf stillschweigende Rechte verlassen (alter Schema-Default bzw. PUBLIC, kein ausdrückliches Grant), behalten sie nur, weil 0070 und 0071 danach laufen. – Fix: in OFFEN festhalten: kein Squash und kein Umsortieren der Migrationen ohne ACL-Vergleich; Produktion durch Abspielen in Reihenfolge aufbauen und danach `pg_default_acl` und den Katalogauszug gegen Dev prüfen.

## Prüffragen

**(1) Inhalt der Migration.** Bestätigt. `…0071_public_default.sql:7` ist die einzige Anweisung: `alter default privileges for role postgres revoke execute on functions from public;`, ohne IN SCHEMA; Zeilen 1 bis 6 sind Kommentar. Die Anweisung schreibt genau eine Zeile in `pg_default_acl` (Rolle `postgres`, global, Funktionen) mit dem eingebauten Default abzüglich PUBLIC, also nur noch dem Eigentümer-Eintrag. Sie nimmt keinem bestehenden Objekt ein Recht, legt keine Daten, Tabellen oder Funktionen an, braucht keine Tabellensperre und ist transaktional. `postgres` darf den Default der eigenen Rolle ändern. Rechte werden nur enger, nirgends weiter.

**(2) Verträglichkeit mit 0070 und dem Katalog.** Bestätigt, mit einer Einschränkung beim Nachweis.
- Postgres bildet die Rechte eines neuen Objekts aus dem globalen Default der anlegenden Rolle, vereinigt mit dem Schema-Default. 0070 hat aus dem Schema-Default für `public` die drei API-Rollen entfernt, 0071 nimmt PUBLIC aus dem globalen Default. Zusammen bleibt für neue Funktionen von `postgres` in `public` nur der Eigentümer. Die beiden Anweisungen überschneiden sich nicht und heben sich nicht auf.
- Der Zustand vor 0071 passt dazu: globaler Default (eingebaut, mit PUBLIC) vereinigt mit dem Schema-Rest ergibt wieder PUBLIC, daher `anon: = true` im Rot-Lauf.
- Der Default gilt nur für Objekte, die `postgres` künftig anlegt. Funktionen anderer Eigentümer (Plattform- und Dienstrollen) und alle bestehenden Funktionen bleiben unberührt.
- Einschränkung: Ob in `private` oder einem anderen Schema ein eigener Schema-Default für `postgres` steht, der einer Rolle wieder EXECUTE gibt, kann ich nicht aus Dateien belegen. Für `public` und `private` beweist es der grüne Lauf (Fall 1, sechs Kombinationen). Für weitere Schemas gibt es keinen Test; dort greift die Regel „ausdrückliches Grant“ unabhängig davon.
- Ob `tests/rls/default-privileges.test.ts` (0070) eine Erwartung enthält, die 0071 umkehrt (z. B. „PUBLIC bleibt“ oder eine feste Zeilenzahl in `pg_default_acl`), habe ich nicht gelesen. Das zeigt der gezielte Lauf dieser Datei nach dem Push.

**(3) Test misst die Wirkung.** Bestätigt.
- Fall 1 (`public-default.test.ts:12-19`) legt je eine Funktion in `public` und `private` ohne jedes Revoke an und fragt das wirksame Recht (einschließlich PUBLIC und Rollenvererbung) für `anon`, `authenticated`, `service_role` ab. Das ist die Wirkung, nicht die Existenz.
- Fall 2 (`:21-27`) belegt die Regel aus `daten.md`: Grant nur für `service_role` öffnet nur diese Rolle.
- Fall 3 (`:29-35`) prüft die globale Default-Zeile.
- Rot-Lauf 009: Commit `b19bb70`, Arbeitsbaum sauber, `Argumente: []`, `Schalter: []`, `EXIT=1`, 3 rot und 1 grün. Ist-Werte im Log: `expected '= true' to be '= false'` (Zeile 28), `anon: "= true"` (Zeile 52), `expected 0 to be greater than 0` (Zeile 68). Kein Absturz, kein Netzfehler. Der Lauf zählt als Rot-Beweis.
- Dass die Proben zurückgerollt werden, stützt das Log selbst: Fall 2 legt `public.zz_pd_probe()` erneut an und liefert Werte statt eines Namenskonflikts. Den Mechanismus in `tests/support/owner.ts` habe ich nicht gelesen.
- Laufen die Proben nicht als `postgres`, bliebe der Lauf nach dem Push rot; das zeigt sich also von selbst.
- Der Hash-Vergleich ist Handarbeit der Abnahme (Finding mittel 1).

**(4) Katalogfakten.** Nicht selbst abgefragt; ich habe keinen Datenbankzugang, und die Connector-Werkzeuge sind laut `daten.md:31` gesperrt. Aus Dateien belegt sind nur: 259 ACL-Zeilen über `public` und `private` und der Hash (`009-…log:16`). Die Angaben 83 und 81 Funktionen, die eine PUBLIC-Triggerfunktion und die 49 Erweiterungsfunktionen übernehme ich als Angabe der Hauptsession. Sie sind in sich stimmig (164 Funktionen, 259 Rechtezeilen) und tragen das Urteil nicht: es folgt schon daraus, dass ein Default bestehende Objekte nie ändert. Die Aussage „Triggerfunktion braucht zur Laufzeit kein EXECUTE“ ist richtig (geprüft wird beim Anlegen des Triggers für dessen Ersteller).

**Rollback.** `alter default privileges for role postgres grant execute on functions to public;` ist richtig: das Ergebnis entspricht wieder dem eingebauten Default, Postgres entfernt die Zeile aus `pg_default_acl`. Funktionen, die zwischen Push und Rollback entstanden sind, bleiben ohne PUBLIC (sie haben dann ihr ausdrückliches Grant); der Rollback öffnet rückwirkend nichts.

**Geld.** Nicht berührt. Keine Tabelle, kein Betrag, keine Funktion der Geldwege wird geändert; die Basis der Edge Functions bleibt gleich, ein Redeploy ist nicht nötig (`daten.md:33`). Die Gebührensicht für Kunden wird nicht weiter, neue Funktionen sind ohne Grant für `anon` und `authenticated` gesperrt.

## Risiken für Abnahme und OFFEN

Für die Abnahme:
1. Hash-Zeile des grünen Laufs wörtlich gegen `009-…log:16` (Finding mittel 1). Der grüne Lauf muss ohne Argumente und ohne Schalter laufen und alle vier Fälle bestehen.
2. `tests/rls/public-default.test.ts` nach dem Push nicht mehr ändern (Rot-Beweis hängt an `dateiSha`). `tests/support/owner.ts` gegen den Stand von Commit `b19bb70` prüfen, weil `dateiSha` die Support-Dateien nicht deckt.
3. Fundstelle der Beks-Entscheidung „BEKS 1“ belegen (Finding mittel 2).
4. `tests/rls/default-privileges.test.ts` nach dem Push gezielt laufen lassen; der Volllauf `rls` am Ende deckt den Rest (Register `tests/support/positiv.ts`).
5. Grenze des Nachweises nennen: Auszug nur `public` und `private`; Katalogfakten zu `extensions` sind eine einmalige Abfrage ohne Log.

Für OFFEN:
1. Produktion: nach dem Aufbau `pg_default_acl` (globale Zeile für `postgres` ohne PUBLIC, Schema-Zeile `public` ohne die drei API-Rollen) und den Katalogauszug gegen Dev prüfen. Voraussetzung dort: Migrationen laufen als `postgres`; sonst wirkt 0071 nicht auf die angelegten Funktionen.
2. Erweiterungen: nach jedem `create extension`, `alter extension … update` oder Ein- und Ausschalten im Dashboard Eigentümer und ACL der neuen Funktionen prüfen, in beide Richtungen (fehlendes EXECUTE für App-Rollen; verbliebenes PUBLIC bei fremdem Eigentümer).
3. Stille Aufrufer neuer Funktionen: verschachtelte Hilfsfunktionen unter Dienstrollen (Trigger auf `auth.users`, `storage.objects`), Index-Ausdrücke, generierte Spalten, Aggregate, Auth-Hooks (Finding mittel 3). Fehlerbild 42501.
4. Kein Squash und kein Umsortieren der Migrationen ohne ACL-Vergleich vorher und nachher.
5. Aufräumen: ausdrückliches Revoke für die eine PUBLIC-Triggerfunktion in `private`.
6. Funktionen, die nicht über Migrationen entstehen (SQL-Editor als `postgres`), entstehen jetzt ebenfalls ohne PUBLIC; solche unter anderen Rollen weiterhin mit PUBLIC. Der Katalogauszug ist der Ort, an dem das auffällt.

## Nicht geprüft

- Katalog der Dev-Datenbank (alle Angaben zu Punkt 4 außer Zeilenzahl und Hash).
- `tests/support/owner.ts` (Rolle und Rollback der Proben), `runs.jsonl` (Eintrag und `dateiSha` zu Lauf 009).
- `tests/rls/default-privileges.test.ts` auf Erwartungen, die 0071 berührt.
- `docs/BEKS.md`, `docs/OFFEN.md`, `docs/ENTSCHEIDUNGEN.md` (Entscheidung BEKS 1, Eintrag sys1-1, Produktions-Hinweis).
- Das in `daten.md:22` genannte Muster `0006_route_infra.sql:84-87`.
- Verhalten der Plattform beim Anlegen von Erweiterungen (anlegende Rolle); als Risiko formuliert, nicht belegt.

## Stichproben

- `supabase/migrations/20261116160000_0071_public_default.sql:7` – eine Anweisung, `for role postgres`, kein IN SCHEMA, nur `revoke execute on functions from public`. In Ordnung.
- `supabase/migrations/20261116160000_0071_public_default.sql:1-6` – Kommentar stimmt mit der Anweisung überein (global, nur künftige Funktionen von `postgres`, Bestand unberührt). In Ordnung.
- `supabase/migrations/20261116150000_0070_default_privileges.sql:7` – schemagebunden (`in schema public`), nur die drei API-Rollen; überschneidet sich nicht mit 0071. In Ordnung.
- `supabase/migrations/20261116150000_0070_default_privileges.sql:5-6` – globaler Default dort bewusst offen gelassen, Verweis auf Frage an Beks. Führt zu Finding mittel 2.
- `tests/rls/public-default.test.ts:16` – Abfrage des wirksamen EXECUTE-Rechts je Rolle und Schema. Misst Wirkung.
- `tests/rls/public-default.test.ts:26` – erwartet `anon` und `authenticated` gesperrt, `service_role` offen. Passt zu `daten.md:22`.
- `tests/rls/public-default.test.ts:32` – Filter auf globale Zeile, Funktionen, Rolle `postgres`. Richtig.
- `tests/rls/public-default.test.ts:41` – NULL-ACL wird über den eingebauten Default aufgelöst, PUBLIC erscheint also im Auszug. Richtig.
- `tests/rls/public-default.test.ts:46` – einzige Erwartung in Fall 4 ist „mehr als 0 Zeilen“. Führt zu Finding mittel 1.
- `tmp/proof/sys2/009-…log:1-5` – Commit `b19bb70`, sauber, keine Argumente, keine Schalter. In Ordnung.
- `tmp/proof/sys2/009-…log:16` – 259 Zeilen, Hash beginnt `822ff108`, endet `ccef`. Stimmt mit dem Auftrag.
- `tmp/proof/sys2/009-…log:28`, `:52`, `:68` – Ist-Werte der drei roten Fälle. In Ordnung.
- `tmp/proof/sys2/009-…log:81`, `:89` – 3 rot, 1 grün, `EXIT=1`. In Ordnung.
- `tmp/proof/sys2/db-antrag-1.json:3-4` – eine Datei, Pfad und Hash wie oben übernommen.
- `.claude/rules/daten.md:22` – Regel deckt 0070 und 0071, Hinweis auf Erweiterungen und Produktion vorhanden; Lücken siehe Findings mittel 3 und niedrig 3.
- `.claude/rules/daten.md:33` – Redeploy-Pflicht greift nicht (Basis der Edge Functions unverändert).

Offene Findings hoch: 0
