Modell: claude-fable-5-2

# DB-Freigabe u3-1, Antrag 1

Datum: 2026-11-15
Umfang: `tmp/proof/u3-1/db-antrag-1.json` und die dort genannte Migration (eine Datei, eine Anweisung). Nicht geprüft: die geänderten Testdateien als Ganzes (nur die Stellen aus der Stichprobenliste), der Endstand des Schritts.

SHA256: e3ef7333ad31180d12fd787b511bb4eecf78d8dec41731cc7cf96823ed564d3b supabase/migrations/20261115092753_0063_outbox_dispatch_owner_only.sql

Hinweis zum Hash: Der Wert ist aus dem Antrag abgeschrieben, nicht selbst gebildet. Der Berater hat kein Shell-Werkzeug (nur Lesen, Suchen, Schreiben), `sha256sum` war nicht ausführbar. Gelesen und geprüft wurde der Inhalt der Datei (3 Zeilen: zwei Kommentarzeilen, ein `revoke execute on function public.outbox_dispatch() from service_role;`), er stimmt mit dem Auftrag überein. Die Bindung bleibt fail closed: `scripts/sys/gate-db-lib.mjs:29` bildet den Hash beim Push selbst aus der Datei und `:57-58` verlangt Gleichheit mit dieser Zeile; weicht die Datei vom Antrag ab oder ändert sie sich, gibt es keinen Push.

## Begründung

1. Nur das nötige Recht. Die Migration nimmt genau ein Recht (EXECUTE) von genau einer Rolle (`service_role`) auf genau einer Funktion. Kein `grant`, kein `create or replace`, keine Änderung an Eigentümer, `security`-Art, `search_path`, Schema-Rechten, Tabellen, Policies oder Cron-Einträgen.
2. Keine Rechte-Ausweitung. Ein `revoke` kann den Rechtestand nur verkleinern. `public`, `anon` und `authenticated` waren schon seit `0033:20` ohne Recht; `0034:214` und `0036:58` sind `create or replace` und lassen die Rechte unverändert; nach 0033 gibt es im ganzen Migrationsordner keine weitere Rechtevergabe auf diese Funktion (Suche über alle 63 Dateien). Nach 0063 bleibt nur der Eigentümer.
3. Kein verlorener Aufrufer. Das Recht lief ins Leere: Die Funktion ist `security invoker` (`0036:59`) und greift in der ersten Anweisung auf `private.outbox_expire()` zu (`0036:65`); `service_role` hat kein USAGE auf `private` (`0001:13-14`, nur `authenticated`). Der Ist-Wert steht im Log `001-…outbox.test.ts.log:23` (42501, Schema `private`). Im Repo ruft niemand die Funktion als `service_role`: Treffer in `supabase/functions/**` sind nur zwei Kommentare und die generierten Typen (`outbox-send/index.ts:2`, `_shared/jobs/handlers.ts:264`, `_shared/database.types.ts:1872`), in `src/**` und `scripts/**` keiner.
4. Keine Wirkung auf den Cron. Der Job `outbox-dispatch` (`0033:25`) wurde von derselben Migrationsrolle angelegt, die die Funktion erzeugt hat (`0033:5`), und läuft als diese Rolle. Das Recht des Eigentümers steht nicht in dem Eintrag, den das `revoke` entfernt. Der Cron-Eintrag wird in keiner späteren Migration neu angelegt oder geändert (Suche nach Anlegen, Entfernen und Ändern von Jobs: nur `0033:25`). Der grüne Eigentümer-Weg ist im Test vorhanden (`tests/rls/outbox.test.ts:54-63`, im Lauf 001 bestanden) und muss nach dem Push grün bleiben.
5. Gleiches Muster wie `photo_publish_dispatch`: dort Entzug für alle vier Rollen (`0035:416-421`) und keine Rückgabe (`0035:422-426` nennt die Funktion nicht), Aufruf nur durch den Cron (`0035:428`).
6. Geld: nicht berührt. Keine Betragsspalte, keine Gebührenfunktion, kein Leseweg für Kunden. Die Funktion stößt nur den Mailversand an.
7. Schema und Nebenläufigkeit: keine Tabellen-, Constraint-, Trigger- oder Fremdschlüssel-Änderung. Die Anweisung ändert nur den Rechte-Eintrag der Funktion; ein gleichzeitig laufender Cron-Aufruf wird nicht blockiert und blockiert nicht. Wiederholbar (ein zweites `revoke` ändert nichts).
8. Edge Functions: keine Basis geändert, kein Neu-Deploy nötig (`.claude/rules/daten.md:32` greift nicht).
9. Fail-sichtbar: Wirkt das `revoke` auf Dev wider Erwarten nicht (anderer Rechtegeber), bleibt der Katalog-Test rot (`tests/rls/positiv.test.ts`, Ist-Wert im Log `002-…positiv.test.ts.log:32`), der Schritt kann dann nicht grün enden. Ein späteres Neuanlegen der Funktion mit Standardrechten fängt derselbe Test.

## Findings

### hoch
Keine.

### mittel
- `docs/ARCHITECTURE.md:149` – Die Matrix führt `outbox_dispatch` in der Zeile der Funktionen mit EXECUTE für `service_role` (Quelle 0033). Nach dem Push stimmt das nicht mehr und widerspricht dem Register (`tests/support/positiv.ts:443-444`). – Fix im selben Schritt (keine Bedingung für den Push): `outbox_dispatch` aus der Zeile nehmen und wie `:148` eigens führen (kein EXECUTE, nur der Cron als Eigentümer, 0063).

### niedrig
- `tests/rls/outbox.test.ts:65-68`, Log `001-…outbox.test.ts.log:23` – Der Rot-Lauf dieses Tests misst keine gelockerte Sperre: Der Aufruf scheiterte schon vorher, nur mit anderer Meldung (Schema statt Funktion). Als Rot-Beweis im Sinn von `.claude/rules/tests.md` trägt der Katalog-Test (`002-…positiv.test.ts.log:32`, Ist-Wert: EXECUTE für `service_role` vorhanden, Register erwartet keins). – Fix: in Bewertung und Abnahme den Katalog-Lauf als Rot-Beweis nennen, den Outbox-Test als Regressionsschutz.
- `supabase/migrations/20261115092753_0063_outbox_dispatch_owner_only.sql:2` – Der Kommentar ist verkürzt: Das Recht selbst öffnete nichts (Invoker-Funktion, 42501); gemeint ist, dass ein funktionierender Aufruf für `service_role` Rechte auf `private`, `vault` und `net` verlangen würde. – Kein Fix vor dem Push (jede Änderung ändert den Hash und braucht einen neuen Antrag); sachlich richtig genug.
- `docs/OFFEN.md:52` – Der Eintrag u3-1 beschreibt den alten Zustand. – Fix: nach dem grünen Lauf schließen (üblicher Abschluss des Schritts).

## Prüffragen aus dem Auftrag

- Nur das nötige Recht? Ja. Ein Recht, eine Rolle, eine Funktion (Begründung 1).
- Keine Rechte-Ausweitung? Ja. Reiner Entzug; kein anderer Rechteträger kommt hinzu, kein Schema- oder Tabellenrecht wird berührt (Begründung 2).
- Keine Wirkung auf den Cron? Ja, nach Lage der Migrationen: Der Cron läuft als Eigentümer, dessen Recht bleibt (Begründung 4). Nicht selbst auf Dev geprüft (kein DB-Zugang des Beraters); Beleg nach dem Push ist `tests/rls/outbox.test.ts:54-63` grün.

## Nach dem Push zu belegen (für die Abnahme)

- `npm run t -- tests/rls/outbox.test.ts`: alle 4 Tests grün (Eigentümer-Weg `:54-63` weiter „ok“, `service_role` `:65-68` mit der Funktions-Meldung).
- `npm run t -- tests/rls/positiv.test.ts`: Katalog ohne Abweichung für `outbox_dispatch`.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `tmp/proof/u3-1/db-antrag-1.json:3-4` | Ein Eintrag, Pfad und Hash wie oben |
| `supabase/migrations/20261115092753_0063_outbox_dispatch_owner_only.sql:3` | Einzige Anweisung, Entzug von EXECUTE für `service_role`, Signatur ohne Argumente passt zu `0033:5` |
| `supabase/migrations/20261108160000_0033_deadlines_cron.sql:5-6` | Funktion angelegt, `security invoker`, `search_path = ''` |
| `supabase/migrations/20261108160000_0033_deadlines_cron.sql:20-21` | Entzug für `public`, `anon`, `authenticated`; einzige Vergabe an `service_role` |
| `supabase/migrations/20261108160000_0033_deadlines_cron.sql:25` | Cron `outbox-dispatch`, jede Minute, einziger Aufrufer |
| `supabase/migrations/20261108170000_0034_s9c_abnahme.sql:214-227` | `create or replace`, keine Rechteänderung |
| `supabase/migrations/20261108190000_0036_outbox_harden.sql:58-72` | Aktuelle Fassung, Invoker; `:65` erster Zugriff auf Schema `private` |
| `supabase/migrations/20261108190000_0036_outbox_harden.sql:13-20` | `private.outbox_expire` ohne Recht für `public` |
| `supabase/migrations/20261029141616_0001_foundation.sql:12-14` | Schema `private`: USAGE nur für `authenticated`, nicht `service_role` |
| `supabase/migrations/20261108180000_0035_job_photos.sql:416-428` | `photo_publish_dispatch` ohne EXECUTE für alle vier Rollen, nur Cron |
| Suche `outbox_dispatch` in `src`, `scripts`, `supabase/functions`, `tests` | Kein Aufruf als `service_role` außer dem neuen Negativtest |
| Suche nach Job-Anlage und Job-Änderung in `supabase/**` | `outbox-dispatch` nur in `0033:25` |
| `tests/rls/outbox.test.ts:54-63` | Eigentümer-Weg mit Wirkung (Zeile wird `failed`), im Lauf 001 bestanden |
| `tests/rls/outbox.test.ts:65-68` | Negativtest für `service_role`, erwartet die Funktions-Meldung |
| `tests/support/positiv.ts:443-444` | Register: Akteur Eigentümer, kein EXECUTE für andere |
| `tests/support/positiv.ts:177-182` | Keine Ausnahme für `outbox_dispatch` mehr |
| `tmp/proof/u3-1/001-tests_rls_outbox.test.ts.log:23,53` | Rot, Ist-Wert 42501 Schema `private`, EXIT=1 |
| `tmp/proof/u3-1/002-tests_rls_positiv.test.ts.log:32,55` | Rot, Ist-Wert EXECUTE für `service_role` gegen leeres Register, EXIT=1 |
| `tmp/proof/u3-1/runs.jsonl:1-2` | Beide Läufe über das Start-Programm, Exit 1 |
| `docs/ARCHITECTURE.md:148-149` | Matrix noch im alten Stand (Finding mittel) |
| `scripts/sys/gate-db-lib.mjs:29,39-65` | Gate bildet den Hash selbst, verlangt Urteil und Hoch-Zeile je genau einmal |

Urteil: frei
Offene Findings hoch: 0
