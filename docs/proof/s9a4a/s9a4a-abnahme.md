# S9a-4a Abnahme (Berater): Fotos vor dem Absenden, Backend

- Datum: 2026-11-02
- Geprüfter Umfang (vollständig gelesen): `supabase/migrations/20261102110000_0020_photo_staging.sql`; `supabase/functions/_shared/quote/parse.ts`, `db.ts`; aus `handler.ts` die Foto- und Fehlerpfade (`:58-62`, `:150-162`, `:248-257`, `:335-345`); aus `database.types.ts` `request_photos`, `quote_save_request`, `photo_*`; `tests/rls/uploads.test.ts`; aus `tests/rls/rls.test.ts` die Fixtures und die Foto-Tests (`:95-264`); `scripts/redproof-s9a4.mjs`; Kopf von `scripts/redproof-s9a3.mjs` (`:1-40`); `docs/OPEN_ISSUES.md:50-126`; `docs/PROGRESS.md:200-221`. Nachweise: `tmp/proof/s9a4a-check.log`, `s9a4a-rls.log`, `s9a4a-e2e.log` (Ergebniszeilen), `s9a4a-redproof.log`, `s9a4-rotbeweis.md`, `s9a4a-push.log`, `s9a4a-deploy.log`, `s9a4a-types.log`. Zum Abgleich: `tmp/proof/s9a4a-plan.md` (meine Vorprüfung), `tmp/proof/s9a3-abnahme.md:40-47` (Ursprung R2-N13), `docs/proof/s9a3b/s9a3b-abnahme-runde2.md:20-93` (A2-N1 bis A2-N6), `docs/ARCHITECTURE.md` (Fundstellen zu Fotos).
- Nicht geprüft: Live-Datenbank (kein Zugriff), Byte-Gleichheit der deployten Function, App-Code (bleibt für S9a-4b).
- Hinweis zur Umgebung: In meiner Tool-Liste stand ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nach CLAUDE.md nicht benutzt.

## Ergebnis

Die Migration setzt M-1, M-2, N-2, N-3 und N-4 aus der Vorprüfung richtig um. Ich sehe keinen Querzugriff, keine Rechte-Ausweitung und keinen Geldbezug. `quote_save_request` ändert gegenüber dem geprüften Plan nur Kleinigkeiten: den Default `null` für `p_photo_ids` und den NULL-Zweig bei `created_at`. Preis, Gebühr und Snapshot sind nicht berührt. Die Tests sind grün (`check` 365, `rls` 172, `e2e` 97, jeweils `EXIT=0`), der Rot-Beweis besteht 48 von 48 Prüfungen, die Definitionen sind vorher und nachher gleich.

Offen sind zwei Punkte in der Beweisführung (mittel):
- „R2-N13 erledigt“ ist so nicht gedeckt.
- Für die neue Zeilen-Bedingung aus M-1 fehlen der Wirkungsbeweis und die verlangte Zählung der Alt-Zeilen.

Dazu kommen Doku-Nachzüge und Sperren ohne Lockerungsbeweis (niedrig).

## Findings

### hoch

Keine.

### mittel

**A-M1** `scripts/redproof-s9a4.mjs:467-470`, `:483-490`, `:493`; `tmp/proof/s9a4-rotbeweis.md:319-359`; `docs/OPEN_ISSUES.md:120`, `docs/PROGRESS.md:219`: **Problem:** „R2-N13 erledigt“ ist durch die Live-Probe nicht gedeckt.
- R2-N13 verlangte laut `tmp/proof/s9a3-abnahme.md:46` einen Rohaufruf der deployten `quote` mit falschem `shown`. Gemessen werden sollten Status und Zeilenzahl, einmal gelockert (200, eine Zeile) und einmal nach dem Redeploy (409, keine Zeile). Ersatzweise sollte R2-N13 offen bleiben.
- Die Live-Probe lockert nichts. Sie misst keine der Function-Sperren aus S9a-3 (`shown`, `termsHash`, Preisversion). `settle()` durchläuft zwar zweimal 409, das Ergebnis wird aber nicht festgehalten (`:484-489`).
- Die sechs Live-Einträge sind trotzdem als „Art: Sperre“ ausgewiesen, mit identischen Werten unter „Gelockert/Beobachtet“ und „Gesperrt/Wiederhergestellt“ (`s9a4-rotbeweis.md:321-323`). In der Summe stehen sie als „Live 6“ neben den Rot-Beweisen (`:386`). Das widerspricht der Regel in `CLAUDE.md`, dass ein Rot-Beweis nur zählt, wenn er die Wirkung der gelockerten Sperre misst.
- Gedeckt ist dagegen, dass die deployte Function die neue Fassung ist (siehe Prüffrage 3).

**Fix:**
- Die Live-Einträge als „Beobachtung“ ausweisen und nicht als Sperre zählen. Die Nachweisdatei bleibt unverändert, die Korrektur gehört in PROGRESS und ins Skript für künftige Läufe.
- Zwei beobachtete Fälle ergänzen, jeweils mit Ist-Wert:
  - falsches `shown` ergibt `409 price_changed` und 0 Anfragen zur `clientRef`
  - falscher `termsHash` ergibt `409 terms_changed` und 0 Anfragen
- R2-N13 bis dahin in `OPEN_ISSUES.md:74` und `:120` auf „teilweise“ setzen. Begründung: Die Quelltext-Mutation von S9a-3 belegt, dass die Tests die Sperren erkennen. Die Live-Beobachtung belegt dann den Zustand des Deploys. Erst beides zusammen schließt R2-N13.

**A-M2** `0020_photo_staging.sql:88`, `:100`; `redproof-s9a4.mjs:373-374`; `docs/PROGRESS.md:216-221`: **Problem:** Für die Zeilen-Bedingung aus Plan-M-1 fehlen Wirkungsbeweis und Zählung. Die Bedingung selbst ist richtig umgesetzt.
- Der Plan verlangte drei Dinge (`s9a4a-plan.md:21`):
  - einen Test, in dem der Kunde ein übernommenes Objekt löscht, dessen zweiter Ordner nicht die `client_ref` ist (Fixture als Eigentümer, Ist-Wert: Objekt bleibt)
  - einen Rot-Beweis, der genau diese Bedingung einzeln lockert
  - vor dem Push eine SQL-Zählung der Zeilen, deren Pfad nicht mit `customer_id/client_ref/` der Anfrage beginnt, festgehalten in PROGRESS
- Umgesetzt ist nur ein Paar „Schicht“-Einträge auf ein Objekt im `client_ref`-Ordner. Dort hält jede der beiden Bedingungen allein (`s9a4-rotbeweis.md:247-261`, Wert „entfernt 0 | Datei da“ in beiden Zuständen). Die eigene Wirkung der Zeilen-Bedingung zeigt das nicht.
- Für die Zeilen-Bedingung in der Insert-Policy (`:88`) gibt es weder Test noch Eintrag.
- Die Zählung steht nicht in PROGRESS. Ob es auf Dev Alt-Zeilen gibt, die nur diese Bedingung schützt, ist damit unbelegt.

**Fix:**
- Fixture als Eigentümer anlegen: `guard_photo_insert` kurz abschalten oder mit Marker arbeiten, dann eine `request_photos`-Zeile mit dem Pfad `{uid}/{request_id}/{uuid}.jpg` zu einer eigenen Anfrage einfügen und die Datei per `service_role` hochladen.
- Test: Der Kunde löscht die Datei, Ist-Wert „entfernt 0, Datei da“. Er lädt unter demselben Namen hoch, Ist-Wert 403.
- Rot-Beweis: nur die Zeilen-Bedingung lockern (Delete und Insert je ein Eintrag), erwartet „entfernt 1 | Datei weg“ bzw. „ok | 1“.
- Die Zählung der Alt-Zeilen auf Dev nachholen und in PROGRESS festhalten.

### niedrig

**A-N1** `docs/OPEN_ISSUES.md:73`, `:74`, `:95`, `:113` gegen `:120`, `:125`: **Problem:** Status-Widersprüche und doppelte Kennungen.
- `:74` führt R2-N13 weiter als „Offen (S9a-4)“.
- `:95` kündigt A1-N9 weiter als Teil der Migration 0020 an.
- `:73` nennt für R2-N12 den Teilschritt „S9a-1 bis S9a-4“.
- `:113` führt M-1 bis M-3 weiter als „offen“.
- Die neue Zuordnung steht nur im Abschnitt `:119-126`.
- Dazu kommt `:120`: „R2-N13 / M-1“ und „M-2“ meinen dort die Abnahme S9a-3, Runde 1. Im selben Abschnitt verweist PROGRESS auf Plan-M-1 und Plan-M-2 aus 4a (`PROGRESS.md:220`), also gleiche Kennungen mit anderer Bedeutung (wie A2-N2).

**Fix:**
- Die Tabellenzeilen `:73`, `:74`, `:95` und `:113` auf den neuen Stand setzen (erledigt, teilweise oder neuer Teilschritt).
- In `:120` die Quelle der Kennungen nennen, z. B. „M-1 (Abnahme S9a-3, Runde 1)“.

**A-N2** `docs/OPEN_ISSUES.md:105`, `:126`: **Problem:** A2-N3 ist nicht nachgezogen. In der Liste der fehlenden Tests fehlt weiter die Kartensperre im Zustand `price_changed` (ohne Einwilligung, nach Kontowechsel). Auch die Übergabe an 4b in `:126` nennt sie nicht. **Fix:** Den Fall in `:105` ergänzen und mit A-M1 (S9a-3b) für 4b bündeln.

**A-N3** `docs/OPEN_ISSUES.md:121`; `docs/ARCHITECTURE.md:18`, `:47`, `:61`, `:103`, `:125`: **Problem:** Zwei Doku-Lücken.
- Der Doku-Nachzug von Konzept und Plan hat keinen Teilschritt, das gleiche Muster wie A2-N1.
- `ARCHITECTURE.md` beschreibt noch den Weg von vor 0020:
  - `:18`: Pfad `{user}/{request}/…`
  - `:47`: Matrix mit Insert und Delete bei offener Anfrage und Lesen durch admin
  - `:61`: Karenz 1 h, Zeilen ohne Datei nach 48 h löschen
  - `:103`: Ablauf in der App
  - `:125`: Trigger mit Advisory-Lock, „Foto-Zeilen legt nur der Kunde an“
- Diese Datei fehlt in der Nachzugsliste. S9a-4b würde nach einer veralteten Sicherheitsmatrix bauen.

**Fix:**
- In `:121` einen Teilschritt nennen (spätestens S9a-4b).
- Die genannten Zeilen in `ARCHITECTURE.md` in die Liste aufnehmen und dort mit 4b nachziehen. Zu `:47` gehört: kein admin-Lesen, Staging-Insert und -Delete nur ohne Anfrage und ohne Zeile, `request_photos` nur über `quote_save_request`.

**A-N4** `redproof-s9a4.mjs:541-554`; `s9a4-rotbeweis.md:375-380`; `docs/OPEN_ISSUES.md:120`; `docs/PROGRESS.md:219`: **Problem:** A-N4 ist in diesem Lauf nicht trennscharf belegt.
- Das Label sagt das selbst: „Baum war schon unsauber: Wirkung der Hilfsdatei nicht getrennt“.
- Exit 2 und „ABBRUCH“ kamen von den uncommitteten Änderungen an `handler.ts`, `parse.ts` und `db.ts`. Dass eine unversionierte Datei allein den Abbruch auslöst, ist damit nicht gezeigt.
- OPEN_ISSUES `:120` nennt die Einschränkung im Allgemeinen („trennscharf nur bei sauberem Baum“), führt A-N4 aber unter „Erledigt“ und verschweigt, dass dieser Lauf der unsaubere Fall war. PROGRESS `:219` nennt die Einschränkung gar nicht.

**Fix:** A-N4 auf „teilweise“ setzen. Nach dem Commit (sauberer Baum) einen vollen Lauf oder einen eigenen Werkzeug-Aufruf nachholen. Andernfalls in PROGRESS festhalten, dass der Exit-2-Pfad nur beim Fall „geänderte Datei“ belegt ist.

**A-N5** `0020_photo_staging.sql:24-25`, `:119`, `:133`; `tests/rls/uploads.test.ts:415-447`: **Problem:** Drei neue Sperren haben weder Test noch Lockerungsbeweis.
- der Wertecheck `platform_settings_staging` (Plan-N-4)
- der Aufruf von `photo_staging_interval()` in `photo_cleanup` (erster Teil von Plan-M-2): Der Test zu „fehlt“ prüft nur `quote_save_request`, `photo_orphans` und das Intervall.
- `coalesce(created_at, '-infinity')` in `photo_orphans` (Plan-N-3; praktisch nicht erreichbar, ein Ist-Wert-Test wäre trotzdem billig)

Die Karenz hat einen Rot-Beweis per Probe (`s9a4-rotbeweis.md:287-293`), aber keinen Test in der Suite.

**Fix:**
- Je ein Test als Eigentümer mit Rollback (`probes`):
  - Einfügen von `photo_staging_hours` mit 0, 169 und 1,5 ergibt 23514. Eine neue Zeile ist wegen `append_only` nur so prüfbar.
  - `photo_cleanup()` ohne Einstellung ergibt `P0001: setting_missing`. Der Rollback verwirft den pg_net-Eintrag.
  - Ein Objekt mit `created_at = null` steht in `photo_orphans`.
  - Für die Karenz: Eine Datei mit 24,5 h steht nicht auf der Liste, eine mit 25,5 h steht darauf.
- Je ein Eintrag im Rot-Beweis.

**A-N6** `docs/PROGRESS.md:218`; `tmp/proof/s9a4a-push.log:7-14`: **Problem:** „Datei = Dev-Stand“ ist nur zum Teil belegt.
- Gepusht wurde einmal (Exit 0). Danach wurde die Migrationsdatei geändert und Dev per Hand-SQL angeglichen. Für das Hand-SQL gibt es kein Log.
- Indirekt belegt sind:
  - der Default (`database.types.ts:608`: `storage_path?`, erzeugt per `--linked`)
  - die NULL- und Ablaufprüfung in `quote_save_request` und die Karenz: Der Rot-Beweis findet seine Suchmuster in den Live-Definitionen, sonst bräche er mit „Muster nicht gefunden“ ab.
  - die Zeilen-Bedingung der Delete-Policy (Schicht-Eintrag `:255-261`)
- Nicht belegt sind die Zeilen-Bedingung der Insert-Policy, die Prüfung in `photo_cleanup` und der Check `platform_settings_staging`.

**Fix:** Eine Leseabfrage auf Dev mit Log nach `tmp/proof/` ausführen: `pg_policies.with_check` der Insert-Policy, `pg_get_functiondef` von `photo_cleanup`, `pg_constraint` für `platform_settings_staging`, `column_default` von `request_photos.storage_path`. Die Werte gegen die Datei halten und das Ergebnis in PROGRESS festhalten.

**A-N7** `docs/PROGRESS.md:218`; `tests/rls/rls.test.ts:202`, `:256`: **Problem:** Der Default `''` für `storage_path` bleibt nur, damit Code typgeprüft wird, den 4b ersetzt (`src/lib/uploads.ts`). Er ist damit eine Übergangslösung.
- Sicherheitlich ist er harmlos: Ein leerer Pfad scheitert am Präfix-Check des Triggers (`0020:54`).
- In OPEN_ISSUES steht er nicht als Aufgabe für 4b.
- Die RLS-Tests `:202` und `:256` stützen sich darauf, dass `storage_path` fehlen darf, und prüfen nur `not.toBeNull()` statt `42501`.

**Fix:**
- In OPEN_ISSUES „S9a-4a“ als Aufgabe für 4b eintragen: Default in der 4b-Migration entfernen, Typen neu erzeugen.
- Die beiden Asserts auf `{ code: '42501' }` schärfen.

**A-N8** `0020_photo_staging.sql:86`, `:98`: **Problem:** In der Unterabfrage über `public.service_requests r` steht `(storage.foldername(name))[2]` unqualifiziert. Heute bindet `name` an `objects.name`, weil `service_requests` keine Spalte `name` hat (`database.types.ts:662-685`). Bekäme die Tabelle später eine solche Spalte, änderte sich die Policy still. **Fix:** Mit der nächsten Migration, die diese Policies anfasst (4b), `objects.name` schreiben, wie schon in der Zeilen-Bedingung `:88`.

**A-N9** `redproof-s9a4.mjs:367`; `uploads.test.ts:161-163`: **Problem:** Der Eintrag „Storage-DELETE: Fremdordner-Bedingung entfernt, dazu SELECT-Sicht geöffnet“ misst die Wirkung über die Probe richtig („entfernt 1 | Datei weg“). Der zugeordnete Test wird aber schon beim Download rot, also an der geöffneten SELECT-Policy, nicht am Löschen (`s9a4-rotbeweis.md:236`). Dass ein Test das Löschen allein erkennt, ist nicht gezeigt. Die Ordner-Bedingung der Delete-Policy allein ist eine Schicht hinter der SELECT-Policy (die Storage-API liest vor dem Löschen) und als solche nicht eigens ausgewiesen. **Fix:** Im Label „Kombination“ vermerken. Optional einen Test ergänzen, der nur das fremde Löschen prüft (ohne vorherigen Download).

**A-N10** `0020_photo_staging.sql:79-89`: **Problem:** Für Staging-Uploads gibt es keine Mengengrenze je Nutzer. Ein Konto kann beliebig viele Ordner mit je beliebig vielen Dateien bis 10 MB anlegen. Aufgeräumt wird erst nach 25 h. Das ist ein Kosten- bzw. Kontingentrisiko, kein Datenzugriff. Vorher (S8b-3) begrenzte nur das Rate-Limit von `quote` die Menge, das Ausmaß ist also ähnlich. **Fix:** Als Punkt vor dem Livegang in OPEN_ISSUES aufnehmen, z. B. eine Bedingung in der Insert-Policy, die die eigenen Objekte der letzten `photo_staging_hours` zählt (Grenze nach Entscheidung von Beks), zusammen mit dem Captcha-Punkt.

## Beantwortung der Prüffragen

**(1) Sind M-1, M-2, N-2, N-3 und N-4 korrekt umgesetzt?** Ja, Zeile für Zeile:
- **M-1:** Die Insert-Policy `:88` und die Delete-Policy `:100` verlangen gleichlautend `not exists (… request_photos p where p.storage_path = objects.name)`. Die Spalte ist qualifiziert. Der Kunde sieht seine eigenen Zeilen über `request_photos_select` (`:40-41`) mit SELECT-Grant (`:37`), die Bedingung greift also. Der Nachweis fehlt (A-M2).
- **M-2:**
  - `photo_cleanup` ruft `perform public.photo_staging_interval()` vor dem Lesen des Vault auf (`:133`).
  - `photo_orphans` ist jetzt plpgsql. `cutoff` wird im `declare` berechnet (`:114`), also vor `return query`. Der Fehler kommt damit auch bei leerem Bucket.
  - `create or replace` behält die bisherigen Rechte: anon und Kunde bekommen 42501 (`uploads.test.ts:632-648`).
- **N-2:** Die Karenz `- interval '1 hour'` steht nur im Aufräumen (`:114`). Die Übernahme prüft ohne Karenz (`:271`). Ein gelistetes Objekt ist damit älter als die Übernahmegrenze plus 1 h und kann nicht mehr übernommen werden.
- **N-3:** In `quote_save_request` gilt `pcreated is null or …` als abgelaufen (`:271`). In `photo_orphans` steht `coalesce(o.created_at, '-infinity')` (`:119`). Nebenwirkung: Bei fehlender Datei setzt `select … into` den Wert auf NULL. Gälte `not found` nicht mehr, griffe dahinter `photo_expired`. Der Rot-Beweis weist das als Schicht aus (`s9a4-rotbeweis.md:7-13`), das ist richtig.
- **N-4:** `platform_settings_staging` erlaubt nur ganze Stunden von 1 bis 168 (`:24-25`). Der Seed-Wert 24 passt. Der Zweig `v <= 0` (`:16`) ist damit nur noch Schicht.

Weitere Zeilen:
- `p_photo_ids … default null` (`:158`) ist unbedenklich, weil nur `service_role` ausführen darf (`:289-298`).
- `too_many_photos` wird vor `photo_staging_interval()` geprüft (`:209-212`).
- Marker setzen und zurücksetzen (`:264`, `:276`), Trigger mit Marker, Präfix aus der Zielanfrage und Zählung (`:50-59`): unverändert gegenüber der Vorprüfung, richtig.
- Die Signaturen von Drop, Revoke und Grant stimmen überein (`:144-148`, `:289-298`).

**(2) Messen die Rot-Beweise den Ist-Wert, und sind Schichten ehrlich ausgewiesen?**
- SQL-Teil:
  - Alle 25 Sperren messen einen Ist-Wert: Zeilenzahl, Objektzahl, „Datei da/weg“ oder Zielanfrage der Zeile, gelockert und gesperrt jeweils verschieden. 16 haben einen zugeordneten Test, der gelockert rot wurde.
  - Die 14 Schichten sind als Schicht benannt, mit der zweiten Sperre im Label.
  - `photo_missing` ist ehrlich als Schicht ausgewiesen, mit Begründung N-3. Die Kombination mit dem entfernten NULL-Zweig liefert die Wirkung „ok | 1/1“.
  - `too_many_photos` steht als Schicht in Funktion und Trigger plus Kombination „ok | 1/9“, richtig.
  - Das Storage-DELETE-Paar ist ehrlich als zwei Schichten ausgewiesen. Damit ist die eigene Wirkung der Zeilen-Bedingung aber nicht belegt (A-M2).
  - Die Kombination „Fremdordner + SELECT“ ist im Label genannt, der Test ist nur über SELECT rot (A-N9).
- Live-Teil: Das sind keine Rot-Beweise, sie sind aber als „Sperre“ gezählt (A-M1).

Sperren der Migration **ohne** Lockerungsbeweis mit eigener Wirkung:
- Check `platform_settings_staging` (`:24-25`): weder Test noch Beweis (A-N5)
- `photo_cleanup` mit Intervallprüfung (`:133`): weder Test noch Beweis (A-N5)
- `coalesce(created_at, '-infinity')` (`:119`): weder Test noch Beweis (A-N5)
- Zeilen-Bedingung der Insert-Policy (`:88`): weder Test noch Beweis (A-M2)
- Zeilen-Bedingung der Delete-Policy (`:100`): nur Schicht (A-M2)
- Ordner-Bedingung der Delete-Policy (`:95`) allein: nur in Kombination mit SELECT (A-N9)
- Revoke von `request_photos` für anon (`:36`), Revoke von EXECUTE auf `photo_staging_interval` und `quote_save_request` für anon (`:27`, `:293`), EXECUTE auf `photo_cleanup` für authenticated: nur als 42501 getestet, nicht gelockert. Hinter den Revokes für authenticated liegen ausgewiesene Schichten. Für anon fehlen solche Einträge; ich halte das für vertretbar, weil anon auch keine Sicht auf `platform_settings` hat.
- `v <= 0` (`:16`): Schicht hinter dem Check, ohne Eintrag

**(3) Belegt die Live-Probe, dass die deployte Function die neue Fassung ist? Ist „R2-N13 erledigt“ gedeckt?**
- Neue Fassung: ja, über das Verhalten, und das Ergebnis liegt im Log (`s9a4a-redproof.log:134-139`).
  - Die alte `parse.ts` verwarf unbekannte Schlüssel (`parse.ts:2`). `photoIds: "x"` ergäbe dort keinen 400 beim Parsen. Die neue Fassung antwortet mit `400 invalid_input` (`:134`).
  - `422 photo_missing` und `422 too_many_photos` (`:135-136`) gibt es nur mit den Codes in `handler.ts:157-159`.
  - Die übernommene Zeile in `request_photos` (`:137`) entsteht nur, wenn `db.ts:145` `p_photo_ids` übergibt. Eine alte Function ohne das Argument liefe wegen des Defaults ohne Fehler durch und legte keine Zeile an.
  - Deploy: `s9a4a-deploy.log:17`, `:25`, `:29`, `:32` (`parse.ts`, `db.ts`, `handler.ts` hochgeladen, `EXIT=0`).
  - Nicht belegt ist eine Byte-Gleichheit mit dem Arbeitsstand. Eine Änderung nach dem Deploy mit gleichem Verhalten bliebe unentdeckt. Das ist vertretbar, weil die Abnahme vor dem Commit liegt.
  - Probe 1 hat keine Gegenkontrolle mit gültigem `photoIds`. Probe 4 deckt das ab.
- „R2-N13 erledigt“: nicht gedeckt (A-M1). Die Sperren der Function aus S9a-3 sind live weder gelockert noch als Ist-Wert festgehalten.

**(4) Steht A-N4 offen im Bericht und in OPEN_ISSUES?**
- Im Rot-Beweis ja, im Label (`s9a4-rotbeweis.md:375`, Log `:142`).
- In OPEN_ISSUES `:120` steht nur die allgemeine Einschränkung, unter „Erledigt“, ohne den Hinweis, dass dieser Lauf der unsaubere Fall war. PROGRESS `:219` nennt sie gar nicht. A-N4 ist damit nur teilweise erledigt (A-N4 oben).

**(5) Testabdeckung der fachlichen Vorgaben** (`uploads.test.ts`):

| Vorgabe | Abdeckung |
|---|---|
| eigenes Staging erlaubt | `:100-119`, mit signiertem Link und privatem Bucket ✓ |
| fremdes Lesen, Ändern, Löschen verweigert | `:152-206`: Download, Upsert, Update, Remove, Move, Copy, List; Datei byte-gleich ✓ |
| anon verweigert | Upload `:129`, Download und Remove `:192-197`, `request_photos` `:283`, `:503-543`, RPCs `:632-648` ✓ |
| Übernahme eigen erlaubt | `:257-285`, Doppel-ID `:287` ✓ |
| Übernahme fremd verweigert | `:298-313`, anderer eigener Ordner und nie hochgeladene ID `:315` ✓ |
| Übernahme abgelaufen verweigert | `:327-341`, mit Gegenfall 23 h ✓ |
| nach Absenden: Hinzufügen | `:465`, Wiederholung `:357` ✓ |
| nach Absenden: Löschen | übernommene Datei `:479`, nicht genannte Datei `:472` ✓ |
| nach Absenden: Ersetzen | Upsert und Update `:479` ✓ |
| nach Absenden: Umhängen | `request_photos` für Kunde und anon `:503`, für `service_role` `:545`, Trigger für Eigentümer `:584` ✓ |
| auch für `service_role` | UPDATE, DELETE und INSERT `:545`. TRUNCATE nur als Eigentümer `:584` und als Schicht im Rot-Beweis, vertretbar |
| `photo_staging_hours` fehlt ergibt `setting_missing` | SQL-Ebene `:415-447`. Lücke: `photo_cleanup` (A-N5). Die Abbildung auf `500 setting_missing` im Handler ist hier nicht getestet (`handler.ts:255`). |
| Cleanup löscht nur abgelaufene, nicht übernommene Dateien | Liste `:650-663`, echter Lauf `:674-698`, auch im Ordner mit Anfrage ✓. Lücke: Karenzzone 24–25 h (A-N5) |

Weitere Lücken:
- Alt-Objekte und die Zeilen-Bedingung (A-M2)
- Wertecheck (A-N5)
- `photo_expired` über den Handler (422): nur SQL-seitig getestet

**(6) Stimmen OPEN_ISSUES und PROGRESS mit dem Code überein? Ist die Zuordnung vollständig?**
- Der Inhalt des neuen Abschnitts `OPEN_ISSUES.md:119-126` stimmt mit Migration und Handler überein:
  - Codes, Karenz, Übernahme der genannten IDs
  - Restgrenzen `service_role`/Storage, N-1-Race und Eigentümer
  - Lücke in der App bis 4b, Vorgaben für 4b, Punkt für S9d
- `PROGRESS.md:217-219` stimmt mit den Logs überein (365, 172, 97, `EXIT=0`; 48 von 48). Dort steht „Live-Probe … R2-N13“, siehe A-M1.
- Nachzug aus S9a-3b:
  - A2-N1 erledigt (`:105`: „(S9a-4)“ und „Plan-M-1 (S9a-3b)“)
  - A2-N2 erledigt (`:105`: „(Abnahme S9a-3, Runde 2, …)“)
  - A2-N4 bis A2-N6 erledigt (`PROGRESS.md:214`)
  - **A2-N3 offen** (A-N2)
- Widersprüche: Tabellenzeilen `:73`, `:74`, `:95`, `:113` und doppelte Kennungen in `:120` (A-N1).
- Ohne Teilschritt bzw. nicht erfasst: Doku-Nachzug `:121` und `ARCHITECTURE.md` (A-N3), Default `''` (A-N7), Mengengrenze (A-N10).
- Plan-N-5, letzter Punkt (Restgrenze `service_role` in Kopf oder ARCHITECTURE): Steht in OPEN_ISSUES `:122`, nicht im Kopf von 0020 und nicht in ARCHITECTURE. Als Teil von A-N3 nachziehen.

**(7) Neue hohe Funde zu Geld oder Sicherheit?** Keine.
- Den Pfad baut der Server aus `p_customer` (Nutzer-ID aus dem JWT), `p_client_ref` und der ID (`0020:266`). Damit gibt es auch kein Orakel auf fremde Dateien: `photo_missing` sagt nur etwas über den eigenen Ordner.
- Weitere Prüfungen ohne Fund:
  - Marker: Setzer ist nur `quote_save_request`, an `r.id` gebunden.
  - Kaskade über `immutable_row`: Test `:618`.
  - Rechte von `request_photos`.
  - Lesen ohne admin.
  - Staging ohne UPDATE-Policy.
- Geld: keine Änderung an Preis, Snapshot oder Gebühr. Im Foto-Teil gibt es keine Beträge und keinen Satz.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/migrations/20261102110000_0020_photo_staging.sql:24-25` | Check ganze Stunden 1–168 (N-4) ✓; ohne Test (A-N5) |
| `0020_photo_staging.sql:36-38` | anon/authenticated nur SELECT für authenticated; `service_role` ohne update/delete/truncate ✓ |
| `0020_photo_staging.sql:50-59` | Marker gegen `request_id`, Präfix aus der Anfrage, Zählung ≥ 8 ✓ |
| `0020_photo_staging.sql:70-73` | `immutable_row` für UPDATE/DELETE/TRUNCATE ✓ |
| `0020_photo_staging.sql:86`, `:98` | `name` in Unterabfrage unqualifiziert (A-N8) |
| `0020_photo_staging.sql:88`, `:100` | Zeilen-Bedingung, `objects.name` qualifiziert (M-1) ✓; Nachweis fehlt (A-M2) |
| `0020_photo_staging.sql:114`, `:119` | Karenz 1 h (N-2), `coalesce` (N-3) ✓ |
| `0020_photo_staging.sql:133` | Intervall vor Vault (M-2) ✓; ohne Test (A-N5) |
| `0020_photo_staging.sql:158`, `:289-298` | `default null`, nur `service_role` ✓ |
| `0020_photo_staging.sql:209-212`, `:264-276` | Anzahl vor Intervall; Marker gesetzt und zurückgesetzt; `pcreated is null` als abgelaufen ✓ |
| `supabase/functions/_shared/quote/parse.ts:2`, `:61`, `:165-169` | alte Fassung verwarf unbekannte Schlüssel; `photoIds` erlaubt, ≤ 50, RFC-UUID, klein ✓ |
| `supabase/functions/_shared/quote/handler.ts:157-159`, `:255` | 422 für die drei Foto-Codes, 500 `setting_missing` ✓ |
| `supabase/functions/_shared/quote/db.ts:121`, `:145` | `p_customer` aus `customerId`, `p_photo_ids` durchgereicht ✓ |
| `supabase/functions/_shared/database.types.ts:608`, `:916` | `storage_path?` (Default auf Dev vorhanden), `p_photo_ids?` ✓ |
| `tests/rls/uploads.test.ts:415-447` | `setting_missing` für Absenden, Liste, Intervall; `photo_cleanup` fehlt (A-N5) |
| `tests/rls/uploads.test.ts:472-477` | nicht genannte Datei im Ordner mit Anfrage bleibt ✓ |
| `tests/rls/uploads.test.ts:545-582` | `service_role`: 42501 bei UPDATE/DELETE, `photo_insert_forbidden` bei INSERT ✓ |
| `tests/rls/uploads.test.ts:674-698` | echter Aufräumlauf, abgelaufen weg, frisch und übernommen bleiben ✓ |
| `tests/rls/rls.test.ts:107-112` | Fixture über Staging und `p_photo_ids` ✓ |
| `tests/rls/rls.test.ts:202`, `:256` | Insert ohne `storage_path`, nur `not.toBeNull()` (A-N7) |
| `scripts/redproof-s9a4.mjs:373-374` | DELETE-Paar beidseitig Schicht (A-M2) |
| `scripts/redproof-s9a4.mjs:367` | Kombination DELETE+SELECT; Test rot über Download (A-N9) |
| `scripts/redproof-s9a4.mjs:467-470`, `:484-489` | Live-Einträge als „Sperre“ mit gleichen Werten; 409-Schritte nicht festgehalten (A-M1) |
| `scripts/redproof-s9a4.mjs:541-554` | A-N4 mit Hinweis auf unsauberen Baum ✓ / A-N4 |
| `scripts/redproof-s9a3.mjs:1` | nur Kopfkommentar neu ✓ |
| `tmp/proof/s9a4-rotbeweis.md:7-21` | `photo_missing` als Schicht plus Kombination mit Ist-Wert ✓ |
| `tmp/proof/s9a4-rotbeweis.md:247-261` | Zeilen- und `client_ref`-Bedingung je nur Schicht (A-M2) |
| `tmp/proof/s9a4-rotbeweis.md:375`, `:386` | Label „Baum war schon unsauber“; Summe zählt „Live 6“ (A-M1, A-N4) |
| `tmp/proof/s9a4a-redproof.log:134-145` | Live-Ergebnisse im Log, „Definitionen vorher und nachher identisch“, `EXIT=0` ✓ |
| `tmp/proof/s9a4a-push.log:7-14` | ein Push von 0020, `EXIT=0` ✓ |
| `tmp/proof/s9a4a-deploy.log:17`, `:25`, `:29`, `:32` | `parse.ts`, `db.ts` hochgeladen, Function `quote` deployt, `EXIT=0` ✓ |
| `tmp/proof/s9a4a-check.log:43`, `:48`; `s9a4a-rls.log:176`, `:181`; `s9a4a-e2e.log:111-112` | 365 / 172 / 97, jeweils `EXIT=0` ✓ |
| `tmp/proof/s9a3-abnahme.md:46` | R2-N13 verlangt gelockert 200 mit Zeile, nach Redeploy 409 ohne Zeile (A-M1) |
| `docs/OPEN_ISSUES.md:74`, `:95`, `:113` | veraltet gegenüber `:120`, `:125` (A-N1) |
| `docs/OPEN_ISSUES.md:105` | A2-N1 und A2-N2 erledigt; Kartensperre bei `price_changed` fehlt (A-N2) |
| `docs/PROGRESS.md:214` | A2-N4 bis A2-N6 nachgezogen ✓ |
| `docs/PROGRESS.md:218` | Default `''` behalten, Dev per SQL; ohne Log (A-N6, A-N7) |
| `docs/ARCHITECTURE.md:47`, `:61` | Matrix und Aufräumen auf dem Stand vor 0020 (A-N3) |

Offene Findings hoch: 0
