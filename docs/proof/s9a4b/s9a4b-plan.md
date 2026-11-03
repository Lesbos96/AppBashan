# Berater-Prüfung Plan S9a-4b (Fotos vor dem Absenden, App + Migration 0021)

- Datum: 2026-11-02
- Geprüft: `tmp/proof/s9a4b-kurzplan.md` (vollständig), `supabase/migrations/20261102120000_0021_photo_limits.sql` (vollständig, ungepusht), `supabase/migrations/20261102110000_0020_photo_staging.sql` (vollständig), `tmp/proof/s9a4b-n6.log` (vollständig), `docs/proof/s9a4a/s9a4a-abnahme.md` (A-M1, A-M2, A-N7, A-N8, A-N10 und Stichprobentabelle), `src/lib/uploads.ts` (vollständig), `docs/OPEN_ISSUES.md:115-127`, `CLAUDE.md` (Daten und Sicherheit). Zum Abgleich: `0003_policy_recursion.sql` (vollständig), `0001_foundation.sql:400-431`, Fundstellen von `request_photos`/`storage_path` in Migrationen, Tests und Skripten.
- Hinweis: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Laut CLAUDE.md habe ich es nicht benutzt.

## Findings

### Hoch

**H-1** `0021_photo_limits.sql:22-27`: **Problem:** Die Zählung liest `storage.objects` innerhalb einer Policy auf `storage.objects`. Postgres expandiert dabei die SELECT-Policies von `storage.objects` für die Unterabfrage. `request_photos_objects_select` enthält eine Unterabfrage (`(select auth.uid())`, `0020:104`), und `storage.objects` steht zu diesem Zeitpunkt schon in der Liste der gerade expandierten Relationen. Ergebnis: Jeder Upload scheitert mit 42P17 („infinite recursion detected in policy for relation objects“), schon der erste, nicht erst der 41. Das schlägt geschlossen fehl, also kein Datenleck, aber der ganze Foto-Weg fällt aus. Das Projekt hat genau diesen Fall schon dokumentiert und gelöst (`0003_policy_recursion.sql:1-3`: Policy auf X darf X nicht per Unterabfrage lesen, Zählung über SECURITY-DEFINER-Funktion). Der Kurzplan nennt das Risiko (`kurzplan:34`), verschiebt die Klärung aber auf den RLS-Test. Die Entscheidung gehört in den Plan.
**Fix:**
- In 0021 eine Funktion `private.staging_photo_count()` anlegen: `returns bigint`, `language sql stable security definer set search_path = ''`, ohne Parameter. Die uid kommt innerhalb der Funktion aus `auth.uid()`, damit kein Aufrufer fremde Ordner zählen kann.
- Körper wie die heutige Unterabfrage (`0021:23-26`): Bucket `request-photos`, Präfix der eigenen uid, ohne Zeile in `request_photos`.
- Rechte: `revoke all … from public, anon`, `grant execute … to authenticated`. `authenticated` hat USAGE auf `private` (`0001:14`).
- In der Policy: `and (select private.staging_photo_count()) < 40`.
- Pflicht vor dem Push, als Leseabfrage auf Dev mit Log: Der Funktionseigentümer muss `storage.objects` ohne RLS lesen (`rolbypassrls` des Eigentümers, `has_table_privilege(…, 'storage.objects', 'select')`) und `public.request_photos` lesen. Fehlt BYPASSRLS, sieht die Funktion 0 Zeilen. Die Grenze wäre dann still wirkungslos, also offen statt geschlossen.
- Akzeptanz:
  - Upload Nr. 1 und Nr. 40 gelingen.
  - Nr. 41 wird verweigert (Storage 403, Ursache 42501, nicht 42P17).
  - Ist-Wert im Rot-Beweis: Objektzahl 41 bei gelockerter Bedingung, 40 bei gesperrter.

### Mittel

**M-1** `kurzplan:9-10`; `OPEN_ISSUES.md:124` (A-M2): **Problem:** 4b-1 ändert die Insert- und die Delete-Policy (`0021:12-41`). Den Wirkungsbeweis der Zeilen-Bedingung „keine Zeile in `request_photos`“ (A-M2) verschiebt der Plan aber nach 4b-2. Die Abnahme von 4b-1 würde damit geänderte Policies abnehmen, deren älteste offene Sperre weiter ohne Wirkungsbeweis ist. Der neue 0021-Test „übernommene Dateien zählen nicht“ braucht ohnehin dieselbe Fixture (Zeile in `request_photos` als Eigentümer). **Fix:** A-M2 nach 4b-1 ziehen: Test und je ein Rot-Beweis für Insert und Delete in `redproof-s9a4.mjs`, dazu die Zählung der Alt-Zeilen. 4b-2 behält die restlichen Werkzeug- und Doku-Punkte.

### Niedrig

**N-1** `0021_photo_limits.sql:4`; `0020_photo_staging.sql:54`: **Problem:** Der Kommentar stimmt nicht. BEFORE-ROW-Trigger laufen vor der NOT-NULL-Prüfung, der Trigger kommt also zuerst.
- Ohne Marker scheitert ein Insert ohne Pfad am Trigger (`photo_insert_forbidden`, P0001).
- Mit Marker ergibt die Bedingung `not found or not starts_with(NULL, …)` NULL, und `IF` lässt die Zeile durch. Erst NOT NULL fängt sie (23502).
- Bisher hat der Default `''` dafür gesorgt, dass der Trigger griff. Nach `drop default` bleibt NOT NULL die einzige Schicht.

**Fix:**
- In 0021 `private.guard_photo_insert()` per `create or replace` härten: `if not found or new.storage_path is null or not starts_with(…)`.
- Den Kommentar in Zeile 4 korrigieren: Der Trigger lehnt ab, NOT NULL ist die zweite Schicht.

**N-2** `kurzplan:31`: **Problem:** Zwei Fehler im Plan für den Rot-Beweis.
- Er erwartet „23514/`photo_insert_forbidden`“. Ein `raise exception` liefert aber P0001, nicht 23514.
- Die Variante „ohne Trigger, Zeile mit `''`“ legt eine unveränderliche Zeile an. `photo_immutable` (`0020:70-73`) verhindert, dass sie später gelöscht wird.

**Fix:**
- Erwartete Codes: P0001 `photo_insert_forbidden` bzw. 23502.
- Der Ist-Wert-Schritt (Default wiederhergestellt und Trigger aus, Zeile mit `''` sichtbar) läuft vollständig in einer Transaktion mit ROLLBACK. Danach per Leseabfrage belegen: 0 Zeilen mit leerem Pfad, Default wieder entfernt, Trigger aktiv.

**N-3** `tests/rls/rls.test.ts:202`, `:256`: **Problem:** Nach `drop default` und `db:types` verlangt der Insert-Typ `storage_path`. `insert({ request_id })` besteht dann den Typcheck nicht mehr. Fügt man irgendeinen Pfad ein, misst der Test vielleicht etwas anderes als den fehlenden INSERT-Grant. **Fix:** In beiden Asserts einen gültigen Pfad mitgeben, etwa `{uid}/{client_ref}/{uuid}.jpg` der eigenen bzw. fremden Anfrage, und auf `42501` prüfen. Dann ist der fehlende Grant (`0020:36-37`) die einzige Sperre. Der Fall 23502 gehört getrennt in den SQL-Test als Eigentümer mit gesetztem Marker, wie im Plan.

**N-4** `kurzplan:26`: **Problem:** Die 40 Fixture-Zeilen in `storage.objects` haben keine Zeile in `request_photos` und zählen damit gegen das Kontingent des Testkontos. Bleiben sie liegen (Abbruch, oder Supabase blockiert ein direktes SQL-DELETE auf Storage-Tabellen), sperren sie spätere Läufe mit demselben Konto für `photo_staging_hours` plus Karenz. Die Tests würden dadurch unzuverlässig. **Fix:**
- Für den 40er-Test ein eigenes, frisches Konto nehmen.
- Aufräumen über die Storage-API (`remove`, service_role) in `afterAll`.
- Vor dem Test assert: Zählung des Kontos ist 0.

**N-5** `0021_photo_limits.sql:23-26`: **Problem:** Das Muster ist nicht konstant (`auth.uid()` ist ein Funktionswert). Postgres kann daraus keinen Indexbereich ableiten. Die Zählung durchläuft deshalb bei jedem Upload alle Objekte des Buckets. Übernommene Fotos bleiben dauerhaft, der Bucket wächst also linear. Korrekt ist die Zählung trotzdem: Eine uuid enthält weder Prozentzeichen noch Unterstrich, und das Präfix endet auf `/`. **Fix:** In der Funktion aus H-1 `EXPLAIN` auf Dev loggen. Bei einem Scan über den ganzen Bucket als Bereichsbedingung schreiben (`o.name collate "C" >= uid || '/'` und `< uid || '0'`), dann greift der Index `(bucket_id, name)`. Kein Blocker für 4b-1.

**N-6** `kurzplan:15`: **Problem:** Für `photo_expired`/`photo_missing` sagt der Plan „Wiederholung mit derselben `clientRef`“. Offen bleibt, unter welchem Namen neu hochgeladen wird. Mit `upsert: false` ergibt derselbe Name bei `photo_expired` 409. **Fix:**
- Bei `photo_expired`: alte Staging-Datei löschen (erlaubt, keine Anfrage zur `clientRef`), dann mit neuer `crypto.randomUUID()` hochladen. `Photo.id` folgt dem neuen Namen.
- Bei `photo_missing`: neue UUID.
- Unit-Test dafür.

**N-7** `0021_photo_limits.sql:9-10`: **Problem:** Die Grenze ist weich und kein vollständiger Kostenschutz, und der Kommentar sagt das richtig. Ein Skript mit vielen parallelen Uploads kann sie deutlich überschreiten. Übernommene Fotos zählen nie, begrenzt sind sie nur durch das Nutzerlimit von `quote` und höchstens 8 je Anfrage. Neue Konten umgehen jede Grenze je Konto. **Fix:** Für 4b-1 so lassen. A-N10 bleibt mit dem Captcha-Punkt vor dem Livegang offen. In `OPEN_ISSUES.md` festhalten: Das Kontingent ist weich, und übernommene Fotos sind nur über das Nutzerlimit von `quote` begrenzt.

## Beantwortung der Prüffragen

**(1a) Ist 40 angemessen?** Ja.
- Ein normaler Ablauf braucht höchstens 8 Fotos je Entwurf. 40 lassen also fünf offene Entwürfe zu.
- Je Konto liegen damit höchstens etwa 400 MB im Staging (10 MB je Datei, `0001:409`). Das ist begrenzt und reicht als Kostenschutz.
- Fest im SQL wie die 8 je Anfrage. Keine Einstellung nötig.

**(1b) Zähler in der Policy statt eigener Funktion?** Nein, mit Funktion (H-1).
- In der Policy entsteht 42P17 durch Selbstbezug. Die SECURITY-DEFINER-Funktion mit `search_path = ''` ohne Parameter vermeidet die Rekursion, weil der Funktionskörper erst zur Laufzeit geplant wird.
- Snapshot: Die RLS-Prüfung beim INSERT läuft vor dem Einfügen. Die neue Zeile zählt also nicht mit, und `< 40` lässt genau 40 zu.
- Last: siehe N-5.
- Ein Trigger auf `storage.objects` scheidet aus (Restgrenze `OPEN_ISSUES.md:122`).

**(1c) Was passiert beim 41. Upload?** Storage antwortet 403. Der Grund steht im Text der Policy-Verletzung, ein eigener Code fehlt. Die App kann das Kontingent nicht sicher von anderen RLS-Ablehnungen unterscheiden.
- Empfehlung: 403 beim Upload pauschal als eigener Fehlertext, ruhig und ohne Behauptung „zu viele“, etwa „Das Foto lässt sich gerade nicht hochladen. Versuch es später noch einmal.“ So lässt sich der Fall von `failed` unterscheiden.
- Keine Zähl-RPC für die App. Das Limit von 8 je Anfrage prüft die App ohnehin lokal, der Server meldet es mit dem 422 `too_many_photos`.

**(1d) Ist das Entfernen des Defaults sauber?** Ja.
- Kein anderer Insert-Pfad in der Datenbank: `authenticated` hat kein INSERT (`0020:36-37`), geschrieben wird nur in `quote_save_request` mit Pfad (`0020:266`, `:274`), und der Trigger verlangt den Marker (`0020:50`).
- Code-Fundstellen ohne Pfad: `src/lib/uploads.ts:31`, `scripts/live-uploads.mjs:58`, `:96`, `tests/rls/rls.test.ts:202`, `:256`. Alle werden in 4b-1 ersetzt bzw. geschärft (N-3). `tests/rls/uploads.test.ts:601`, `:605` und `scripts/redproof-s9a4.mjs:248` setzen den Pfad.
- Zur Härtung: N-1.

**(2) Ist die Zählbedingung korrekt und umgehungsfest?**
- Die Logik stimmt, bis auf H-1 (Rekursion) und N-5 (Last).
- Fremde Ordner: Die Ordner-Bedingung `foldername[1] = uid` (`0021:16`) verhindert Uploads in andere Konten. Mit der Funktion ohne Parameter gibt es auch keine Zählung fremder Ordner.
- Andere `client_ref` desselben Kontos werden mitgezählt, also keine Umgehung über neue Ordner.
- In Ordnern mit Anfrage ist kein Upload möglich (`0021:17-20`).
- Überschreiben (Upsert) erhöht die Zahl nicht. Eine UPDATE-Policy für diesen Bucket gibt es nicht.
- Umgehung nur über Parallelität oder mehrere Konten (N-7).
- Aussperren:
  - Nicht dauerhaft, weil übernommene Dateien nicht zählen.
  - Zeitweise ja: Dateien in einem Ordner mit Anfrage, die nicht in `photoIds` standen, kann der Kunde nicht löschen (`0021:36-39`). Sie zählen, bis `photo_cleanup` sie nach `photo_staging_hours` plus Karenz entfernt.
  - Dateien im Staging ohne Anfrage kann der Kunde löschen, die App kennt sie nach einem Neuladen aber nicht mehr.
  - Dauerhaft wird es nur, wenn `photo_cleanup` ausfällt. Der Lauf scheitert dann aber sichtbar (`0020:133-138`).
  - Für eine Vorabprüfung genügt das.

**(3) Ist `alter policy` gleichwertig zur Neuanlage?** Ja.
- `ALTER POLICY` mit nur `WITH CHECK` (bzw. nur `USING`) lässt Befehl (INSERT/DELETE), Rollen (`authenticated`) und den permissiven Typ unverändert (`0020:79`, `:91`). Auf Dev funktioniert es bereits für Storage (`0020:103`).
- Außer der Zählung (Insert) und der Qualifizierung von `objects.name` ändert sich nichts. Die Ausdrücke `0021:14-21` und `:33-40` sind sonst wortgleich mit `0020:81-88` und `:93-100`. Das unqualifizierte `name` band auch vorher an `objects.name`, wie der Dev-Ausdruck im Log zeigt.
- Nachweis: Definitionsvergleich vor und nach dem Push (`pg_policies`). Einziger erwarteter Unterschied ist der Zählausdruck.

**(4) Ist der Teilungsvorschlag sinnvoll?** Ja, mit einer Verschiebung.
- Der Default fällt richtigerweise in 4b-1 zusammen mit der App: Typen, `uploads.ts` und die Tests ändern sich gemeinsam, und der alte Weg scheitert gegen 0020 ohnehin (`OPEN_ISSUES.md:123`).
- A-M2 gehört nach 4b-1 (M-1).
- 0020 und 0021 kommen erst mit dem Commit von 4b-1 in eine andere Umgebung als Dev.
- Die Punkte aus S9a-3 (Plan-M-1, `Confirmed.shown`, N-2, M-4, N-4/N-5) berühren weder die Gebühr noch neue Rechte. Die Zuordnung entscheidet Beks.

**(5) Fehlt etwas, das Geld oder Sicherheit berührt?**
- Geld: Nein. Der Plan berührt weder Preis noch Gebühr. `photoIds` ändern den Snapshot nicht, und eine 422 legt keine Anfrage an (Rollback, `0020:262-263`).
- Sicherheit, ergänzen:
  - Leseabfrage zum Funktionseigentümer (H-1)
  - Guard-Härtung bei NULL (N-1)
  - ROLLBACK im Rot-Beweis (N-2)
  - frisches Konto für den 40er-Test (N-4)
- Schon abgedeckt:
  - EXIF wird durch die Neu-Kodierung über Canvas entfernt (`src/lib/photos.ts:13`, `:30-43`).
  - Der Bucket nimmt nur JPEG an (`0011_photos.sql:39`).
  - `live-uploads.mjs` importiert den dev-guard zuerst (`scripts/live-uploads.mjs:6`).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0021_photo_limits.sql:22-27` | Unterabfrage auf `storage.objects` in Policy auf `storage.objects` (H-1) |
| `0003_policy_recursion.sql:1-3`, `:7-12` | Präzedenz 42P17, Lösung per SECURITY DEFINER in `private` ✓ |
| `0020_photo_staging.sql:103-104` | SELECT-Policy enthält Unterabfrage `(select auth.uid())`, löst die Rekursionsprüfung aus |
| `0001_foundation.sql:14` | USAGE auf `private` für `authenticated` ✓ |
| `0001_foundation.sql:136` | `storage_path not null unique`, Index für `not exists` ✓ |
| `0001_foundation.sql:409` | 10 MB je Datei ✓ |
| `0011_photos.sql:39` | nur `image/jpeg` ✓ |
| `0012_photo_path_default.sql:2` | Herkunft des Defaults `''` ✓ (Dev-Log: Default `''::text`) |
| `0020_photo_staging.sql:36-37` | `authenticated` nur SELECT ✓ (Dev-Log: SELECT) |
| `0020_photo_staging.sql:50-56` | Marker- und Präfix-Prüfung; NULL-Pfad fällt durch (N-1) |
| `0020_photo_staging.sql:70-73` | unveränderliche Zeilen, betrifft Rot-Beweis (N-2) |
| `0020_photo_staging.sql:264-276` | einziger Insert-Pfad, Pfad immer gesetzt ✓ |
| `0021_photo_limits.sql:14-21` vs. `0020:81-88` | wortgleich bis auf Qualifizierung ✓ |
| `0021_photo_limits.sql:33-40` vs. `0020:93-100` | wortgleich bis auf Qualifizierung ✓ |
| `tmp/proof/s9a4b-n6.log:46`, `:50` | Dev-Policies entsprechen 0020; Unterabfrage bindet `objects.name` ✓ |
| `tmp/proof/s9a4b-n6.log:65` | 0 Zeilen in `request_photos` ✓ |
| `src/lib/uploads.ts:31` | Insert ohne Pfad, Typbruch nach `drop default` (bestätigt die Kopplung in 4b-1) |
| `tests/rls/rls.test.ts:202`, `:256` | Insert ohne Pfad, nur `not.toBeNull()` (N-3) |
| `tests/rls/uploads.test.ts:601`, `:605` | Pfad gesetzt ✓ |
| `scripts/live-uploads.mjs:6`, `:58`, `:96` | dev-guard zuerst ✓; Inserts ohne Pfad, werden in Z3 ersetzt |
| `src/lib/photos.ts:13`, `:43` | Canvas-Neukodierung, JPEG ✓ |
| `OPEN_ISSUES.md:122-124` | Restgrenze Trigger auf Storage, Vorgaben 4b, A-M2/A-N7/A-N8/A-N10 ✓ |

Offene Findings hoch: 1
