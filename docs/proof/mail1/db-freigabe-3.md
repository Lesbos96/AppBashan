Modell: claude-fable-5-2

# DB-Freigabe 3, Schritt mail1 (R3)

Datum: 2026-11-18
Antrag: `tmp/proof/mail1/db-antrag-3.json` (eine Migration)
Geprüft: die Migration vollständig neu (69 Zeilen), gegen `.claude/rules/daten.md`, `.claude/rules/geld.md`, die Freigabe 2 (`tmp/proof/mail1/db-freigabe-2.md`) und die Bezugsmigrationen 0001, 0030, 0031, 0033, 0034, 0036, 0063, 0074. Dazu gelesen: `tests/rls/en-route.test.ts`, `tests/rls/outbox.test.ts`, `tests/support/positiv.ts:448-471`, `supabase/functions/_shared/jobs/handlers.ts:270-353`, `supabase/functions/_shared/jobs/db.ts:95-144`, `tmp/proof/mail1/runs.jsonl` (Zeilen zu `en-route` und zum Push), aus dem Log des roten Laufs 019 nur Kopf, Fehlerzeilen und `EXIT=`.

SHA256: 6f718b88cb7447501a41d71139c4512af1077905a8539119f8df95e1478b251d supabase/migrations/20261118074249_0075_mail1_faellig.sql

Der Hash ist aus dem Antrag abgeschrieben und stimmt mit dem Hash im Auftrag überein. Selbst nachgerechnet habe ich ihn nicht (kein Werkzeug dafür); das Gate vergleicht ihn beim Push mit der Datei. Aus demselben Grund habe ich nicht geprüft, ob der `dateiSha` des roten Laufs 019 zur jetzigen Testdatei passt.

Urteil: frei

Nicht ausgeführt: Ich habe die Migration nur gelesen, nicht gegen eine Datenbank laufen lassen. Die Aussagen zu Sperren und zur Transaktion des Pushs stützen sich auf das dokumentierte Verhalten von Postgres und der Supabase-CLI, nicht auf eine Messung.

Die Freigabe 2 galt für die frühere Fassung (anderer Hash) und deckt diese Datei nicht. Laut `runs.jsonl` gab es für 0075 noch keinen Push (Einträge `db-push-start` und `db-push` nur für 0074, Zeilen 4 und 5); der rote Lauf 019 bestätigt das (Hilfsfunktion fehlt auf Dev).

## Findings

### Hoch
Keine.

### Mittel
- M1 (aus Freigabe 2, weiter offen) · `tests/rls/en-route.test.ts:137-154` gegen `0075:63` – Kein Test misst, ob `outbox_dispatch` den Aufruf der Function auslässt, solange nur wartende Zeilen da sind. Der Test der Hilfsfunktion zeigt im roten Lauf 019 wie im Lauf 007 nur 42883 (Funktion fehlt). – Fix wie in Freigabe 2 beschrieben (Probe über die Warteschlange von pg_net im Rollback) oder Punkt nach OFFEN mit Begründung. Sache der Abnahme, kein Hindernis für den Push.

### Niedrig
- N1 · `0075:44-52` – Der Verfall ist in der Datenbank nicht an die Art der Zeile gebunden: service_role kann jede `sending`-Zeile mit dem Code verfallen lassen, nicht nur „Unterwegs“. Das ist keine Ausweitung: service_role kann seit 0031 jede solche Zeile auch als gesendet markieren (ebenso endgültig), und die einzige Stelle, die den Code sendet, prüft die Art (`handlers.ts:325`). – Kein Fix.
- N2 · `0075:52` – Die Funktion kennt keinen Besitzer eines Claims (wie bisher). Denkbarer Fall: Instanz A hängt länger als die Lease, Instanz B holt die Zeile erneut und sendet vor der Ankunftszeit, A markiert danach den Verfall, das Markieren von B läuft ins Leere. Ergebnis: Mail gesendet, Zeile `failed` mit Verfallscode. Nur ein Buchungsfehler ohne zweite Mail; setzt einen Lauf von über 10 Minuten voraus, den die Laufzeitgrenze der Edge Functions praktisch ausschließt. Dieselbe Klasse gab es schon mit den anderen Codes. – Kein Fix.
- N3 · `tests/rls/en-route.test.ts:164-179` – Der neue Test misst den Verfall nur auf `sending`-Zeilen mit einem Versuch. Nicht gemessen: Verfallscode auf einer Zeile, die nicht `sending` ist, und zusammen mit `p_ok = true`. Beides folgt aus dem Rumpf (die Bedingung in `0075:52` hängt nicht vom Fehlertext ab, `p_ok` steht in jedem `case` zuerst); die Wirkungslosigkeit auf `pending` und `sent` misst `outbox.test.ts:113-116` mit anderen Codes. – Kein Fix; eine Änderung der Testdatei würde einen neuen roten Lauf vor dem Push verlangen und bringt hier keinen zusätzlichen Schutz.
- N4, N5 (aus Freigabe 2, unverändert) · `0075:7` SET-Klausel verhindert das Einsetzen der Hilfsfunktion (Aufbewahrung der Outbox nach OFFEN); `0075:6` Parameter vom Zeilentyp bindet die Funktion an die Tabelle. – Kein Fix in 0075.

## Prüffragen aus dem Auftrag

1. Rechte von `outbox_mark`
   - Angelegt in `0031:232`, Rechte in `0031:242-247`: PUBLIC, anon und authenticated entzogen, EXECUTE nur service_role (und der Eigentümer). Seither nur `create or replace` (0034:203, 0036:43, 0074:159, 0075:40); kein späteres Grant oder Revoke auf die Funktion in den Migrationen (Suche über alle Migrationen). `create or replace` behält die Rechte (`daten.md`, Funktionsrechte).
   - Signatur unverändert `(bigint, boolean, text)`, weiter SECURITY DEFINER; kein `drop`, also kein neuer Rechtezustand nach 0070/0071.
   - Belegt nach dem Push durch `outbox.test.ts:118` (anon: 42501), `rls.test.ts:496` (Liste der service_role-Funktionen) und das Register `positiv.ts:464` (service_role, void); der Eintrag bleibt richtig.

2. Rückgabetyp: `void` wie in 0074 (`0075:40` gegen `0074:159`), Sprache sql. `create or replace` ist zulässig. `database.types.ts` ändert sich nicht (Signatur gleich, Checks stehen nicht in den Typen); `db.ts:130` ruft mit denselben drei Parametern.

3. `search_path`: alle vier Funktionen mit `set search_path = ''` (`0075:7`, `:16`, `:41`, `:56`). Im Rumpf von `outbox_mark` nur `public.outbox` (qualifiziert) und `now()` aus dem Systemkatalog.

4. Check-Liste
   - `0036:9-10`: sechs Codes. 0074 hat den Constraint nicht angefasst (dort nur `kind`, `recipient_kind`, `recipient_id`; `0074:102-110`). `0075:38`: dieselben sechs in derselben Schreibweise plus der Verfallscode. Nichts entfernt, `last_error is null` bleibt erlaubt.
   - Altzeilen: jede Zeile, die den alten Constraint erfüllt, erfüllt den neuen (Obermenge). Das `add constraint` prüft die ganze Tabelle und kann an Bestandsdaten nicht scheitern. Ein Datenupdate ist nicht nötig und nicht enthalten.
   - Der Name bleibt gleich; der zweite Check auf der Spalte (Länge, `0030:111`) hat einen anderen Namen und bleibt.
   - `drop` und `add` laufen in derselben Migration; die Tabelle ist dazwischen exklusiv gesperrt, kein Fenster ohne Constraint für andere Sitzungen.

5. Verhalten von `outbox_mark`
   - Verfall (`p_ok` false, Code exakt gleich): Status `failed`, `claimed_at` null, `last_error` der Code, `attempts` unverändert, `sent_at` null (`0075:44-49`). Die Zeile ist danach endgültig: `private.outbox_is_due` verlangt `pending` oder `sending` (`0075:10-11`), `private.outbox_expire` nur `sending` (`0036:16-17`); keine Migration und kein Skript setzt `failed` zurück (Suche nach Updates auf die Outbox).
   - Alle anderen Fälle wie 0074, Ausdruck für Ausdruck verglichen (`0075:44-51` gegen `0074:163-170`): Erfolg setzt `sent`, `sent_at`, löscht `claimed_at` und `last_error`; Fehlschlag bleibt `pending` bis zum fünften Versuch und behält `claimed_at`; der fünfte endet in `failed` ohne `claimed_at`; unbekannter Text wird `smtp_error`.
   - Null: Ist `p_error` null, ergibt der Vergleich null; im `or` mit `attempts >= 5` zählt dann nur die Versuchszahl, sonst greift der `else`-Zweig. Gleiches Ergebnis wie 0074. `p_ok` null verhält sich wie bisher (wie ein Fehlschlag).
   - Erfolg hat Vorrang: `p_ok = true` mit dem Verfallscode ergibt `sent` ohne Fehlercode.
   - Nur der exakte Code löst den Verfall aus; ein Text, der ihn nur enthält, wird `smtp_error` und bleibt `pending` (gemessen in `en-route.test.ts:170`, `:177`). Den Code des Aufräumens (`lease_expired`) nimmt die Funktion vom Aufrufer weiter nicht an (er steht nicht in der Liste `0075:49`).

6. Nicht-`sending`-Zeilen und fremde Zeilen
   - Die Bedingung `0075:52` ist unverändert (`id` und Status `sending`) und gilt für jeden Zweig. Ein Aufruf mit dem Verfallscode auf `pending`, `sent` oder `failed` ändert nichts.
   - Aufrufen kann nur service_role (Punkt 1). Konten erreichen weder die Funktion noch die Tabelle schreibend (`0030:120`, kein DML für anon, authenticated, service_role). Ein Kunde oder Partner kann also keine Mail verfallen lassen; `set_en_route` legt je Auftrag genau eine Zeile an (`0074:28`, `:36`), ein Hebel entsteht daraus nicht.
   - Eine Bindung an den Claim einer bestimmten Instanz gibt es nicht und gab es nie; siehe N1 und N2.

7. `outbox_expire` und `lease_expired`: `private.outbox_expire` steht nicht in 0075 und bleibt wie `0036:13-18`. Beide Aufrufer rufen es weiter als Erstes (`0075:19`, `:62`). Der Code bleibt in der Check-Liste.

8. Rest der Datei gegen Freigabe 2: `0075:6-32` (Hilfsfunktion, `outbox_claim`) und `0075:55-69` (`outbox_dispatch`) Zeile für Zeile gegen `0074:137-157` und `0036:58-72` verglichen; inhaltlich der Stand, den Freigabe 2 beschreibt (Bedingung zeichengleich zu `0074:146-148`, Dispatch nur mit der neuen Vorprüfung, weiter SECURITY INVOKER, Vault und Header unverändert). Die Aussagen der Freigabe 2 zu Rechten der Hilfsfunktion (kein Grant nötig), Zeilentyp, Null-Verhalten und Nebenläufigkeit gelten weiter.

9. Sperren und Rollback
   - Fünf Anweisungen: zwei Funktionsdefinitionen, `drop`/`add constraint`, zwei weitere Funktionsdefinitionen. Kein Datenupdate, kein Seed, nichts, das außerhalb einer Transaktion laufen muss.
   - Neu gegenüber Freigabe 2: `alter table` nimmt eine exklusive Sperre auf der Outbox und prüft alle Zeilen. Ein Cron-Lauf oder eine Annahme, die gerade in die Outbox schreibt, wartet kurz; umgekehrt wartet die Migration auf laufende Schreiber. Ein Deadlock ist nicht zu erwarten (die Migration hält vorher nur Katalogzeilen der Funktionen, die Aufrufer nicht sperren). Bei der Größe von Dev belanglos.
   - Zurück ginge es mit den Rümpfen aus 0074 und 0036 und der alten Check-Liste, sofern dann keine Zeile den neuen Code trägt.

10. Edge Function und Reihenfolge (`daten.md:33`)
   - Die Basis von `outbox-send` ändert sich nur im Verhalten von `outbox_mark`. Beide Reihenfolgen sind sicher: neue Function vor der Migration → der Code wird unter 0074 zu `smtp_error`, die Zeile wartet und verfällt bei jedem weiteren Versuch erneut, gesendet wird nach der Ankunftszeit nie; Migration vor der neuen Function → der Code wird nicht benutzt. Deploy im selben Schritt bleibt Pflicht.
   - `handlers.ts:325-330`: Verfall nur für die Art „Unterwegs“ mit Auftrag, vor dem Versand; Log nur mit ID und Art, keine Adresse. `db.ts:109-113`: fehlende oder erreichte Ankunftszeit gilt als verfallen, ein Lesefehler wirft und zählt als normaler Versuch (kein vorschneller Verfall). service_role liest `service_requests` bereits (`0001:253-257` entzieht nur anon und authenticated; `quote/db.ts:105`); die neue Spalte aus 0074 ist vom Tabellenrecht gedeckt.

11. Geld: keine Betragslogik, keine Betrags- oder Gebührenspalte berührt. Die Outbox trägt nur Art, Empfänger und Auftrags-ID.

12. Tests und roter Lauf 019
   - Kopf: Befehl ohne Argumente, Schalter leer (`019…log:3-5`), `EXIT=1` (`:96`); `runs.jsonl` Zeile 21: `exit` 1, `args` und `schalter` leer, 2 rot, 2 grün.
   - „Verfall“: Ist-Wert `pending:1:smtp_error:true` statt `failed:1:expired:false` (`019…log:70-74`). Das misst das alte Verhalten (Zeile bleibt in der Wiederholung), nicht nur einen fehlgeschlagenen Schritt: gültiger Rot-Beweis für die Änderung an `outbox_mark`.
   - „fällige Zeilen“: Ist-Wert 42883 in allen zwölf Fällen (`019…log:46-57`), wie in Freigabe 2 bewertet (M1).
   - Erwartungen des neuen Tests folgen aus dem Rumpf: a `failed:1`, Code, ohne `claimed_at` (`0075:44`, `:46`, `:49`); b `pending:1:smtp_temp` mit `claimed_at`; c Text → `smtp_error`; der Code ist per UPDATE des Eigentümers zulässig (`0075:38`). Dass Freitext weiter am Check scheitert, misst `outbox.test.ts:107`, `:121`.

13. Folgepflichten im selben Schritt (nicht Teil dieser Freigabe, Prüfung in der Abnahme)
   - Nach dem Push gezielt: `tests/rls/en-route.test.ts` grün mit dem `dateiSha` des Laufs 019 (51e3d422…), `tests/rls/outbox.test.ts` frühestens eine Minute nach dem Push (Cron mit neuer Definition erfolgreich, `:97-103`; Rechte und Check, `:105-132`).
   - `outbox-send` neu deployen.
   - M1 erledigen oder nach OFFEN.
   - Weiter ungeprüft, aus Freigabe 2 übernommen: `scripts/setup-outbox.mjs` (geändert, schreibt Vault-Einträge) auf Dev-Guard als ersten Import und Lösch-Gate prüfen.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `db-antrag-3.json:3-4` | Pfad und Hash wie im Auftrag |
| `0036:9-10` gegen `0075:37-38` | sechs Codes unverändert, einer dazu |
| `0074:102-110` | 0074 ändert `outbox_last_error_code` nicht |
| `0030:111` | zweiter Check auf `last_error` (Länge) mit eigenem Namen, unberührt |
| `0074:159-172` gegen `0075:40-53` | Kopf gleich; Rumpf nur um den Verfallscode in Status, `claimed_at` und Codeliste erweitert, Bedingung gleich |
| `0031:232`, `0031:242-247` | `outbox_mark` angelegt, nur service_role; danach nur `create or replace` |
| `0034:203`, `0036:43` | weitere `create or replace` derselben Signatur |
| `0036:13-20` | `private.outbox_expire` unverändert, nicht in 0075 |
| `0074:146-148` gegen `0075:9-11` | Bedingung zeichengleich |
| `0036:58-72` gegen `0075:55-69` | Dispatch: nur die Vorprüfung anders, SECURITY INVOKER |
| `0030:120`, `0030:123`, `0030:140` | Outbox: kein DML für Konten und service_role, Lesen nur admin |
| `0034:181` | Status-Check enthält `failed` und `sending` |
| `0001:253-257` | Entzug auf `service_requests` nur für anon und authenticated |
| `handlers.ts:289-294` | `safeCode` liefert den Verfallscode nie selbst; er kommt nur aus `:328` |
| `handlers.ts:325-330` | Verfall nur bei Art „Unterwegs“, vor dem Versand, Log ohne Adresse |
| `db.ts:109-113`, `:129-132` | Lesen der Ankunftszeit wirft bei Fehler; `outbox_mark` mit drei Parametern |
| `outbox.test.ts:113-116`, `:126-129` | Markieren auf `pending` und `sent` wirkungslos |
| `outbox.test.ts:117-118`, `:130-131` | Konto und anon: 42501 |
| `positiv.ts:464` | Register: service_role, void; unverändert richtig |
| `en-route.test.ts:157-180` | Verfall, anderer Fehlschlag, Text als Code, Check |
| `outbox-handler.test.ts:153-170` (nur Treffer gelesen) | Handler markiert mit dem Code, übrige Zeilen laufen weiter, Lesefehler zählt als Fehlversuch |
| `runs.jsonl` Zeilen 4, 5, 21 | Push bisher nur 0074; Lauf 019 rot ohne Argumente und Schalter |
| `019…log:3-5`, `:27-57`, `:70-74`, `:96` | Kopf, beide Fehlschläge mit Ist-Wert, `EXIT=1` |

Offene Findings hoch: 0
