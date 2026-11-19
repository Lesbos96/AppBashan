Modell: claude-fable-5-2

# DB-Freigabe 2, Schritt mail1 (R3)

Datum: 2026-11-18
Antrag: `tmp/proof/mail1/db-antrag-2.json` (eine Migration)
Geprüft: die Migration vollständig (48 Zeilen), gegen `.claude/rules/daten.md`, `.claude/rules/geld.md`, den Befund N1 aus `tmp/proof/mail1/db-freigabe-1.md` und die Bezugsmigrationen 0001, 0030, 0031, 0033, 0034, 0036, 0063, 0064, 0070, 0071, 0074. Dazu gelesen: `tests/rls/en-route.test.ts`, `tests/rls/outbox.test.ts`, `tests/rls/public-default.test.ts`, `tests/support/positiv.ts:1-60` und `:450-473`, `supabase/functions/_shared/jobs/handlers.ts:283-339`, `supabase/functions/_shared/jobs/db.ts:119-122`, `tmp/proof/mail1/runs.jsonl`, aus dem Log des roten Laufs 007 nur Kopf, Fehlerzeilen und `EXIT=`.

SHA256: 681126ba743c83b910bbb2aad8b4cbf28bc55f6d3adc679ea763582958b0ad12 supabase/migrations/20261118074249_0075_mail1_faellig.sql

Der Hash ist aus dem Antrag abgeschrieben und stimmt mit dem Hash im Auftrag überein. Selbst nachgerechnet habe ich ihn nicht (kein Werkzeug dafür); das Gate vergleicht ihn beim Push mit der Datei.

Urteil: frei

Nicht ausgeführt: Ich habe die Migration nur gelesen, nicht gegen eine Datenbank laufen lassen. Die Aussagen zum Planer (N1) und zur Warteschlange von pg_net (M1) stützen sich auf das dokumentierte Verhalten von Postgres und pg_net, nicht auf eine Messung.

## Findings

### Hoch
Keine.

### Mittel
- M1 · `tests/rls/en-route.test.ts:137-154` gegen `0075:42` – Der neue Test misst nur die Hilfsfunktion (zwölf Fälle). Die eigentliche Verhaltensänderung von 0075 liegt in `outbox_dispatch` (kein Aufruf der Function mehr, solange nur Zeilen im Wiederholungs-Abstand oder in der Lease warten); die misst kein Test. `tests/rls/outbox.test.ts:81-90` und das Register (`positiv.ts:466`) laufen die Zeile nur durch (Fehlerfreiheit, Rechte), sie messen nicht, ob ein Aufruf entsteht. Wer die Vorprüfung später wieder auf die alte Bedingung stellt, bekommt keinen roten Test. Der rote Lauf 007 zeigt als Ist-Wert in allen zwölf Fällen 42883 (Funktion fehlt), also die Abwesenheit der Hilfsfunktion und nicht das alte Verhalten. – Fix (Sache der Abnahme, kein Hindernis für den Push): Rollback-Probe als Eigentümer, offene Zeilen wie in `outbox.test.ts:6` beiseite, eine wartende Zeile (`pending`, 1 Versuch, vor 1 Minute), `outbox_dispatch` aufrufen und die Zahl der Zeilen in der Warteschlange von pg_net davor und danach vergleichen (0 neue), dann eine fällige Zeile (1 neue). pg_net sendet erst nach Commit, im Rollback geht nichts hinaus. Voraussetzung: die beiden Vault-Einträge sind auf Dev gesetzt und der Eigentümer darf die Warteschlange lesen (beides nicht geprüft). Geht das auf Dev nicht, als Punkt nach OFFEN mit Begründung.

### Niedrig
- N1 · `0075:7` – Die SET-Klausel an der SQL-Hilfsfunktion verhindert, dass der Planer sie in die Abfrage einsetzt. Jede Prüfung ruft sie deshalb je Zeile der Tabelle auf, im Cron einmal pro Minute über die ganze Outbox, sobald nichts fällig ist (auch über alle gesendeten Zeilen). Die Tabelle hat keinen Index auf den Status (`0030:101-113`, in 0031 bis 0074 kommt keiner dazu) und keine Aufbewahrungsgrenze (keine Migration löscht aus der Outbox); den vollen Scan gab es schon vor 0075, neu ist nur der Funktionsaufruf je Zeile. Bei der Größe von Dev (einige tausend Zeilen) belanglos, nicht gemessen. – Kein Fix in 0075. Nach OFFEN: Aufbewahrung der Outbox (gesendete Zeilen nach Frist löschen) vor Livegang; wenn dann noch nötig, die SET-Klausel der Hilfsfunktion streichen (Rumpf nutzt nur eingebaute Funktionen und Operatoren, beide Aufrufer haben einen leeren Suchpfad; der Planer setzt sie dann ein und der Plan entspricht 0074).
- N2 · `0075:6` – Der Parameter vom Zeilentyp bindet die Funktion an die Tabelle: ein `drop table` braucht `cascade`. Neue Spalten und geänderte Spaltentypen stören nicht (der Rumpf ist Text und wird beim Aufruf aufgelöst). Entfällt oder heißt eine der drei gelesenen Spalten anders (`attempts`, `status`, `claimed_at`), scheitert erst der Aufruf, nicht die Migration; das fangen `en-route.test.ts:137-154` und `outbox.test.ts:54-79` ab. Gleiches Muster wie `private.report_gate` (`0064:7`). – Kein Fix.

## Prüffragen aus dem Auftrag

1. Verhalten von `outbox_claim` gegenüber 0074
   - Bedingung: `0075:9-11` ist Zeichen für Zeichen der Ausdruck aus `0074:146-148` (verglichen: Grenze 5, Zweig `pending` mit den drei Alternativen, Faktor 15 Minuten × 4^(Versuche − 1) mit dem Cast vor der Multiplikation, Zweig `sending` mit 10 Minuten Lease, beide Vergleiche strikt).
   - Rest des Rumpfs: `0075:19-30` gegen `0074:142-155` gleich (Aufräumen zuerst, Sortierung nach ID, Grenze 1 bis 50, `for update skip locked`, Update, Join auf die Partner-Mail).
   - Null: Ergibt die Bedingung null (z. B. `sending` ohne `claimed_at`), liefert die Funktion null; `where` und `not exists` behandeln das wie vorher als nicht erfüllt. Ein solcher Zustand entsteht über die Funktionen nicht (der Claim setzt `claimed_at` immer mit).
   - Zeit: `now()` in der als `stable` erklärten Funktion ist die Transaktionszeit, dieselbe wie im Update des Claims.
   - Nebenläufigkeit: Die erneute Prüfung einer inzwischen geänderten Zeile beim Sperren wertet die Funktion mit der neuen Zeilenfassung aus; gesperrte Zeilen werden wie bisher übersprungen. Kein Unterschied zu 0074.
   - Neue hängende Zustände gibt es nicht: `pending` mit weniger als fünf Versuchen wird nach dem Abstand fällig, `sending` nach der Lease, `sending` mit fünf Versuchen räumt `private.outbox_expire` vorher ab (`0036:13-18`).

2. Rückgabetyp
   - `outbox_claim`: dieselbe Tabelle mit sechs Spalten in gleicher Reihenfolge und gleichen Typen (`0075:15` gegen `0074:138`), weiter SECURITY DEFINER.
   - `outbox_dispatch`: `void`, weiter SECURITY INVOKER (`0075:34-35` gegen `0036:58-59`). Der Rumpf `0075:41-46` weicht von `0036:65-70` nur in der Vorprüfung ab; Vault-Lesen, leere Werte, Header, Body und Timeout unverändert.
   - `create or replace` ist damit zulässig, kein `drop` nötig. Die Basis der Edge Function ändert sich durch 0075 nicht (`db.ts:120` ruft `outbox_claim` mit demselben Parameter und liest dieselben sechs Spalten).

3. Rechte
   - `outbox_claim`: seit `0031:214` nur per `create or replace` geändert (0034, 0036, 0074, 0075); Rechte aus `0031:244-247` bleiben (nur service_role).
   - `outbox_dispatch`: seit `0033:5` nur per `create or replace` geändert (0034, 0036, 0075); nach `0033:20` und `0063:3` hat nur der Eigentümer EXECUTE. Das bleibt.
   - `private.outbox_is_due`: Die Migration läuft als postgres; nach `0071:7` bekommt die neue Funktion kein EXECUTE für PUBLIC, der Eigentümer behält seins. Kein Grant in 0075, und das reicht nach `daten.md` (Funktionsrechte): ein Grant ist nur für den echten Aufrufer nötig und für Hilfsfunktionen, die in Policies, Defaults, Checks oder Views unter der Rolle des Anfragenden laufen. Hier ruft sie nur Code, der als Eigentümer läuft:
     - `outbox_claim` ist SECURITY DEFINER; im Rumpf gilt die Rolle des Eigentümers, auch wenn service_role aufruft. service_role braucht weder USAGE auf `private` (hat es nicht, `0001:13-14`) noch EXECUTE auf die Hilfsfunktion.
     - `outbox_dispatch` ist SECURITY INVOKER und nur für den Eigentümer ausführbar; der Cron-Job ist in `0033:25` als postgres angelegt, `outbox.test.ts:97-103` prüft, dass er als Eigentümer der Funktion läuft.
     - Derselbe Rechtezustand gilt seit 0036 für `private.outbox_expire` (`0036:20`, kein Grant), das beide Funktionen an derselben Stelle aufrufen.
   - Konten: anon, authenticated und service_role können die Hilfsfunktion nicht ausführen. Selbst mit EXECUTE läse sie nichts aus der Tabelle (sie rechnet nur auf der übergebenen Zeile), ein Leck entstünde nicht.
   - Register: `positiv.ts` deckt nur das Schema public (`positiv.ts:1-5`); für die Hilfsfunktion in `private` ist kein Eintrag nötig, die Einträge für `outbox_claim` und `outbox_dispatch` (`positiv.ts:458-466`) bleiben richtig. `default-privileges.test.ts:44` verlangt postgres als Eigentümer aller Funktionen in public und private; erfüllt.

4. `search_path`: alle drei Funktionen mit `set search_path = ''` (`0075:7`, `:16`, `:35`). Alle Objekte schemaqualifiziert (`public.outbox`, `public.partners`, `private.outbox_expire`, `private.outbox_is_due`, `vault.decrypted_secrets`, `net.http_post`); `now`, `power`, `interval` und die Operatoren kommen aus dem Systemkatalog, der auch bei leerem Pfad gilt. Der Rumpf der SQL-Funktion wird beim Anlegen geprüft; `power(4, int)` löst auf die float8-Fassung auf (wie in Freigabe 1 begründet), `o.attempts` ist das Feld des Parameters.

5. Parameter vom Zeilentyp: siehe N2. Aufruf mit dem Tabellenalias als ganze Zeile (`0075:23`, `:42`) ist eindeutig, weil die Funktion schemaqualifiziert ist und die Tabelle keine Spalte `o` hat. Keine Rechte-Folge: der Zeilentyp gibt niemandem Zugriff auf die Tabelle.

6. Rollback-Sicherheit
   - Drei Anweisungen, nur Funktionsdefinitionen, kein Datenupdate, kein Seed, nichts, das außerhalb einer Transaktion laufen muss. Scheitert eine, bleibt nichts halb angewendet.
   - `create function` ohne `or replace` in `0075:6`: der Name ist neu (in 0001 bis 0074 kein Treffer), kein Konflikt.
   - Ein Cron-Lauf während des Pushs sieht entweder die alte oder die neue Definition, nie eine Mischung.
   - Zurück ginge es mit den Rümpfen aus `0074:137-157` und `0036:58-72` und einem `drop` der Hilfsfunktion; Daten sind nicht betroffen.

7. Wirkung der geänderten Vorprüfung: Der Handler tut nach der Prüfung des Aufrufers nichts außer Claim, Versand und Markieren (`handlers.ts:293-339`); ein ausgelassener Aufruf ohne fällige Zeile lässt also keine andere Arbeit liegen. Das Aufräumen abgelaufener Zeilen läuft weiter in jedem Cron-Lauf vor der Vorprüfung (`0075:41`). Der Wettlauf zwischen Vorprüfung und Claim einer anderen Instanz führt höchstens zu einem leeren Aufruf.

8. Geld: keine Betragslogik, keine Betrags- oder Gebührenspalte berührt. Die Outbox trägt nur Art, Empfänger und Anfrage-ID.

9. Test und roter Lauf
   - `en-route.test.ts:143-151`: die zwölf Fälle decken beide Seiten jeder Grenze (14/16 Min., 59/61 Min., 15/17 Std., Lease 9/11 Min.), Altzeile ohne `claimed_at`, fünften Versuch und erledigte Zeile; alle Erwartungen folgen aus `0075:9-11`.
   - Roter Lauf 007: Befehl ohne Argumente, Schalter leer, `EXIT=1`, zwei andere Tests grün, Ist-Wert 42883 in allen zwölf Fällen. Bewertung siehe M1.
   - Die Gleichheit des Claims belegt nach dem Push `outbox.test.ts:54-79` (dieselben Grenzen über `outbox_claim` als service_role).

10. Folgepflichten im selben Schritt (nicht Teil dieser Freigabe, Prüfung in der Abnahme)
   - Nach dem Push gezielt laufen lassen: `tests/rls/en-route.test.ts` (grün mit dem `dateiSha` des roten Laufs 007), `tests/rls/outbox.test.ts` frühestens eine Minute nach dem Push (dann belegt `:97-103`, dass der Cron mit der neuen Definition erfolgreich lief, und `:81-90`, dass der Eigentümer die Hilfsfunktion aus `outbox_dispatch` aufrufen darf).
   - `db:types` läuft mit dem Push; ein Unterschied ist nicht zu erwarten (Signaturen in public unverändert).
   - Außerhalb dieses Antrags gesehen, nicht geprüft: `scripts/setup-outbox.mjs:73` löscht und schreibt Vault-Einträge. Die Abnahme prüft, ob das Skript den Dev-Guard als ersten Import hat und unter das Lösch-Gate fällt (`daten.md`, zweiter Punkt).

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0074:146-148` gegen `0075:9-11` | Bedingung zeichengleich |
| `0074:142-155` gegen `0075:19-30` | Rumpf von `outbox_claim` sonst gleich |
| `0036:58-72` gegen `0075:34-48` | `outbox_dispatch`: nur die Vorprüfung geändert, weiter SECURITY INVOKER |
| `0036:13-20` | `private.outbox_expire`: kein Grant, von beiden Funktionen aufgerufen (Vorbild für den Rechtezustand) |
| `0031:214`, `0031:244-247` | `outbox_claim` angelegt, Rechte nur service_role; danach nur `create or replace` |
| `0033:5`, `0033:20-21`, `0033:25` | `outbox_dispatch` angelegt, PUBLIC und Konten entzogen, Cron-Job in der Migration (als postgres) |
| `0063:3` | service_role ohne EXECUTE auf `outbox_dispatch` |
| `0070:7`, `0071:7` | Default-Rechte für neue Funktionen von postgres ohne PUBLIC und ohne die drei Rollen |
| `0001:12-14` | Schema `private`: PUBLIC entzogen, USAGE nur authenticated |
| `0064:7-22` | `private.report_gate`: Parameter vom Zeilentyp, kein Grant; Muster vorhanden |
| `0030:101-113`, `0034:179-181` | Outbox: `attempts` int, `claimed_at` timestamptz, Status mit `sending`; kein Index außer Primärschlüssel und Dedupe |
| `outbox.test.ts:54-79` | misst den Abstand über `outbox_claim` (4 geholt, 3 warten) |
| `outbox.test.ts:81-90`, `:92-95`, `:97-103` | Dispatch als Eigentümer ohne Fehler, service_role abgewiesen, Cron läuft als Eigentümer |
| `positiv.ts:458-466` | Register: Claim für service_role, Dispatch nur Eigentümer; unverändert richtig |
| `public-default.test.ts:12-19` | neue Funktion in `private` ohne Grant für keine der drei Rollen ausführbar |
| `handlers.ts:293-339` | Handler: nur Claim, Versand, Markieren |
| `db.ts:119-122` | Aufruf und Spalten von `outbox_claim` passen zur unveränderten Signatur |
| `runs.jsonl` Zeile 9, Log 007 Zeilen 3-5, 44-55, 78 | roter Lauf ohne Argumente und Schalter, Ist-Wert 42883, `EXIT=1` |
| `db-antrag-2.json:3-4` | Pfad und Hash wie im Auftrag |

Offene Findings hoch: 0
