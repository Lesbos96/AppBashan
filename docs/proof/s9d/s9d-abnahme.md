# S9d Abnahme (Fotos für Partner): Sicherheits- und Schemalogik

- Datum: 2026-11-08
- Branch: s9d (nicht committeter Stand)
- Prüfer: advisor-report (Opus), nur Lesen; Tests nicht selbst gestartet (laufen laut Auftrag im Hintergrund)
- Hinweis an Beks: In der Tool-Liste dieses Subagents stand ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt (CLAUDE.md, Abschnitt Sessions und Modelle).

Geprüfter Umfang:
- `supabase/migrations/20261108180000_0035_job_photos.sql` (vollständig)
- `supabase/migrations/20261108190000_0036_outbox_harden.sql` (vollständig)
- `supabase/functions/_shared/photo/{handlers,db,process}.ts`, `photo-publish`, `photo-receipt`, `job-photo`, `admin-photo`, `photo-cleanup` (je `index.ts`)
- `supabase/functions/_shared/jobs/handlers.ts` (K3, Text `photo_failed`), `_shared/jobs/db.ts`, `_shared/http.ts` (`readBytesLimited`)
- Tests: `tests/rls/job-photos.test.ts`, `job-photos-concurrency.test.ts`, `outbox.test.ts`, `tests/unit/photo-process.test.ts`, `photo-handlers.test.ts`, `outbox-handler.test.ts`
- Abgleich mit: `tmp/proof/s9d-plan.md` (inkl. Freigabe), `docs/S9_KONZEPT.md` Abschnitte 7 und 13, frühere Migrationen 0001, 0015, 0018, 0020, 0023, 0024/0025, 0030, 0031, 0033, 0034 (Stellen siehe Stichproben), `supabase/config.toml`, `src/lib/photos.ts`, `scripts/setup-photo-publish.mjs`

Ergebnis: keine Befunde der Schwere hoch. Die Zugriffsgrenzen (kein Direktzugriff, Akteur aus dem Token, gleiche Bedingung wie `job_listings_select`), die Grants und die Sperrreihenfolge halten. Zwei Befunde mittel: Nach dem Aufräumen ist der Support-Zugang zu einer Anfrage ganz unbrauchbar, und ein systemischer Ausfall der Pipeline bleibt still.

---

## Befunde

### Hoch

Keine.

### Mittel

**M1. Nach `photo_purge` ist `admin-photo` für die betroffene Anfrage ganz unbrauchbar, auch Belege und vorhandene Originale**
- Stellen: `supabase/migrations/20261108180000_0035_job_photos.sql:376-379` (`admin_photo` gibt alle Zeilen zurück, ohne zu prüfen, ob die Datei noch existiert), `supabase/functions/_shared/photo/db.ts:23-26` (`sign` wirft `sign_failed`, sobald eine einzige URL fehlt), `0035:398-411` (Aufräumen löscht Dateien, die `job_photos`-/`request_photos`-Zeile bleibt `ready` bzw. bestehen).
- Szenario: Auftrag `completed`, Zuordnung vor 31 Tagen beendet. `photo-cleanup` löscht die Kopien (`kind = 'request'`), die Zeilen bleiben `ready` mit `storage_path`. Später kommt eine Reklamation oder ein Nachtragsstreit, der Support ruft `admin-photo` auf. `admin_photo` liefert Originale, Kopien und Belege. `createSignedUrls` gibt für die gelöschten Kopien Einträge ohne `signedUrl` zurück, `sign` wirft, die Function antwortet 500. Der admin sieht weder die Belege (die Beweisfotos, die nie gelöscht werden sollen) noch die noch vorhandenen Originale. Dasselbe gilt für jede zurückgezogene Anfrage (Originale und Kopien gelöscht). Es leckt nichts, aber der einzige protokollierte Support-Weg fällt genau dann aus, wenn er gebraucht wird.
- Vorschlag: In `admin_photo` (und zur Absicherung auch in `job_photo_list`) nur Zeilen zurückgeben, deren Objekt noch existiert (`exists (select 1 from storage.objects o where o.bucket_id = … and o.name = …)`). Alternativ `sign` tolerant machen: fehlende Einträge überspringen statt die ganze Antwort zu verwerfen. Dazu eine Rollback-Probe: Kopie gelöscht, `admin_photo` liefert weiterhin Original und Beleg.

**M2. Ein systemischer Ausfall der Pipeline endet still in `attempts_exhausted`: Kundenmail „Foto ließ sich nicht verarbeiten“ und Verteilung ohne Fotos**
- Stellen: `0035:192-196` (Claim setzt nach 3 Versuchen `failed`/`attempts_exhausted`), `0035:159-163` (`photo_settle`: Mail bei jedem `failed`, danach Verteilung), `supabase/functions/_shared/photo/handlers.ts:42-43, 72-74` (401/503/500 markieren nichts, die Lease läuft ab).
- Szenario: Die Secrets sind eingerichtet, aber Vault-`publish_secret` und Function-Secret `PUBLISH_SECRET` stimmen nicht überein (z. B. nur eine Seite rotiert, oder `supabase secrets set` im Setup-Skript scheitert erst nach dem Vault-Schritt bei einer zweiten Ausführung). Weitere Auslöser: Die Function scheitert beim Import, oder die Neu-Kodierung überschreitet das CPU-Limit. Jeder Aufruf endet dann mit 401 bzw. 500. Der Cron-Lauf selbst ist erfolgreich (`net.http_post` ist nur eingereiht), `cron.job_run_details` bleibt grün. Nach etwa 9 Minuten steht jedes Foto jeder neuen Anfrage auf `failed`/`attempts_exhausted`. Jeder Kunde bekommt die Aufforderung, zurückzuziehen und neue Fotos zu senden (was nichts hilft), und die Partner bekommen Listings ganz ohne Fotos. Ein Ausfall der Infrastruktur sieht damit genauso aus wie ein schlechtes Foto. Ohne Blick in die Edge-Logs fällt das nicht auf. Das ist die Antwort auf Prüffrage c, zweiter Teil.
- Vorschlag: (1) Die Mail `photo_failed` nur bei inhaltlichen Codes (`not_jpeg`, `too_large`, `dimensions`, `unsupported`, `decode_failed`, `source_missing`), nicht bei `attempts_exhausted`. (2) `attempts_exhausted` sichtbar machen, z. B. `photo_publish_dispatch` mit `raise warning` und Zähler oder eine Gesundheitsabfrage für `docs/OPEN_ISSUES.md`. (3) Am Ende von `scripts/setup-photo-publish.mjs` ein Probeaufruf mit dem Vault-Wert und einer Zufalls-ID, der 409 (`stale_claim`) statt 401 erwarten muss. Ob eine Anfrage bei `attempts_exhausted` ohne Fotos verteilt wird, bleibt eine Produktentscheidung (Konzept 7.1 Nr. 2 sagt ja); die Mail an den Kunden ist in diesem Fall aber falsch.

### Niedrig

**N1. Keine Verkleinerung auf 1600 px (Widerspruch zu Konzept 7.1 Nr. 2 und Plan E4)**
- Stellen: `supabase/functions/_shared/photo/process.ts:17-18, 85-107`; `docs/S9_KONZEPT.md:460` („lange Kante höchstens 1600 px“); Plan E4.
- Szenario: Ein 2000 × 1500-Foto aus der App (`src/lib/photos.ts:5`, Kante 2000) geht unverkleinert nach `job-photos`. Das ist kein Sicherheitsproblem, die Freigabe hat nur die Eingangsgrenze (2048 px, 4,2 MP) festgelegt, nicht die Verkleinerung gestrichen.
- Vorschlag: Entweder `image.resize` auf eine lange Kante von 1600 vor `encodeJPEG` (verringert auch Speicher und Ausgabegröße), oder die Abweichung im Konzept bzw. in PROGRESS festhalten.

**N2. `photo_claim` fängt Fehler nicht je Auftrag ab (N7-Muster fehlt): ein fehlerhafter Auftrag hält die ganze Pipeline an**
- Stellen: `0035:206` (`perform private.photo_settle(r.id)` ohne `begin … exception`), im Gegensatz zu `0035:139-143` (`distribute_pending`).
- Szenario: Wirft `distribute_request` für einen Auftrag (heute ist kein Auslöser bekannt, `revision_missing` schließt `0018:187-195` aus), rollt die gesamte Dispatch-Transaktion zurück. Weil die Reihenfolge `created_at` ist, steht derselbe Auftrag jede Minute vorn. Alle anderen Fotos bleiben unbearbeitet, bis seine Frist abläuft (dann fällt er aus der Auswahl).
- Vorschlag: `photo_settle` im Claim in einen eigenen Block mit `exception when others then raise warning 'photo_settle_failed % %', r.id, sqlstate` legen (der Claim-Teil bleibt davon unberührt).

**N3. Die Pixelgrenze liest nur das erste SOF-Segment**
- Stellen: `process.ts:44-51` (Rückgabe beim ersten SOF), `process.ts:97` (die zweite Prüfung kommt erst nach dem Dekodieren, also nach der Speicheranforderung).
- Szenario: JPEG mit kleinem erstem SOF und einem zweiten, großen SOF hinter dem ersten Scan. Folgt der Decoder dem späteren Bildkopf (Verhalten von `imagescript` nicht belegt), kann er große Puffer anfordern. Folge: Abbruch des Workers (Speicher), kein Datenleck. Bei Anfrage-Fotos folgen danach drei Versuche und `attempts_exhausted` (mit M2 eine irreführende Mail), bei Belegen trifft es nur den eigenen Aufruf.
- Vorschlag: Vor dem Dekodieren die ganze Datei auf weitere SOF-Marker außerhalb der Entropie-Daten prüfen (Bytefolge 0xFF gefolgt von einem SOF-Code, gestopfte Nullbytes und RST überspringen) und bei mehr als einem mit `unsupported` abweisen. Dazu ein Unit-Fall.

**N4. `photo_claim` ist für service_role freigegeben, obwohl nur der Cron (Eigentümer) es braucht**
- Stelle: `0035:423`.
- Szenario: Wer den Secret Key hat (Edge Functions, Skripte), kann mit wiederholten Aufrufen von `photo_claim` die Versuche verbrauchen und alle offenen Fotos auf `attempts_exhausted` setzen. Keine Function ruft es auf.
- Vorschlag: Kein Grant an service_role; die Tests rufen den Claim als Eigentümer (die Proben-Helfer können das).

**N5. Belege: parallele Aufrufe beim 7. Beleg laden je bis zu 4 MiB hoch, bevor `add` scheitert**
- Stellen: `supabase/functions/_shared/photo/handlers.ts:99-109`, `0035:298`.
- Szenario: Ein Partner sendet viele Aufrufe gleichzeitig. Alle passieren `check` (7 < 8) und laden hoch, nur einer gewinnt `add`. Die Reste liegen bis zum stündlichen Aufräumen als Waisen in `job-photos`, Teil (a) von `photo_purge` löscht sie nach 1 h. Es gibt keine Rechte-Ausweitung, nur Speicher und CPU.
- Vorschlag: vorerst hinnehmen; bei Bedarf ein Rate-Limit je Partner (Muster `route`).

**N6. `fail()` schreibt den Text unbekannter Fehler ins Log; der Test prüft das Log nicht**
- Stellen: `photo/handlers.ts:17`; `tests/unit/photo-handlers.test.ts:86-94` (übergibt einen pfadartigen Fehlertext, prüft aber nur die Antwort, nicht `d.logs`).
- Szenario: Heute ersetzt `db.ts` die Fehler von Storage und Netz durch feste Texte (`download_failed`, `upload_failed`, `sign_failed`), es leckt also nichts. Ein späterer Umbau, der eine Storage-Meldung mit Objektpfad durchreicht, käme aber unbemerkt durch.
- Vorschlag: Im Test zusätzlich prüfen, dass das Log keinen Fehlertext enthält; im Log nur feste Codes schreiben (wie `safeCode` in outbox-send).

---

## Antworten auf die Prüffragen

**a) Erreicht ein Partner ohne Annahme oder nach dem Zugriffsende Kopien, Originale oder Belege? Sieht ein Kunde fremde Belege?**
Nein.
- Direktzugriff: Der Bucket `job-photos` hat keine Policy (`0035:5-7`). Alle Policies auf `storage.objects` sind an ihren Bucket gebunden (Stichproben unten); `job_photos` ist für anon und authenticated ohne jedes Recht (`0035:64-66`), Probe `job-photos.test.ts:253-259`.
- Originale: Nur der Kunde liest den eigenen Ordner (`0020:103-104`); Partner und admin lesen sie nicht (Probe Zeile 255/259), admin nur über `admin_photo` mit Audit-Eintrag.
- `job_photo_list`: Akteur und aal stammen aus dem geprüften Token (`jobs/db.ts:15-23`). Vor der Annahme gilt `open`, Frist, `active`, `in_scope`, nur `kind = 'request'`. Danach gilt `accepted`, `active`/`payment_hold` und `assignment_access` (30 Tage). Das ist dieselbe Bedingung wie `job_listings_select` (`0034:16-21`), zusätzlich nie der Kunde selbst (`0035:348-354`). Ein Partner sieht Belege erst nach der Annahme, eine fremde Firma nie (Probe Zeile 215, 235).
- Nach dem Zugriffsende bleibt nur eine schon ausgegebene signierte URL bis zu 600 s gültig (Konzept 7.3, gewollt).
- Belege hochladen geht nur mit aktiver Zuordnung (`ended_at is null`) und Status `accepted`/`in_progress` (`0035:294-297`).
- Kunde: nur `customer_id = p_actor` und nur `receipt` (`0035:359-362`); ein fremder Kunde bekommt `not_found` (Probe Zeile 163, 182).
- Die Signatur-URL enthält nur `<uuid>.jpg` (CHECK `0035:21`, Probe Zeile 296-312).

**b) Ist die Metadatenfreiheit belastbar? Landet das Original ungefiltert in `job-photos`?**
Belastbar.
- Die Ausgabe entsteht nur aus den dekodierten Pixeln (`process.ts:93, 101`). `stripMetadata` entfernt danach APP1 bis APP15 und COM aus der Encoder-Ausgabe (`process.ts:59-78`). Die Unit-Probe prüft eingeschleustes EXIF, XMP und einen GPS-Text auf Abwesenheit (`photo-process.test.ts:67-80`).
- Magic Number, Eingang 10 MB, SOF-Grenze vor dem Dekodieren (2048 px / 4,2 MP), nur SOF0/1/2, 8 Bit, 1 oder 3 Komponenten, Ausgabe höchstens 4 MiB (Bucket-Grenze `0035:7`).
- Restrisiko: N3 (zweites SOF) und das CPU-Limit, das ich nicht gemessen habe (offene Frage 4).
- Ein ungefilterter Pfad existiert nicht. Beide Uploads schreiben ausschließlich `out.bytes` (`handlers.ts:68, 108`), es gibt keinen Rückfall auf die Eingangsbytes, und ein Nicht-`PhotoError` aus der Verarbeitung führt zu 500 ohne Upload (`handlers.ts:63`). `photo_publish_mark` und `photo_receipt_add` nehmen nur Pfade, die als Objekt existieren, und nur service_role ruft sie auf. Der Pfad stammt aus `upload()` (Zufalls-UUID, `upsert: false`, `db.ts:12-16`), nie aus der Anfrage.

**c) Claim, Mark und Lease gegen Doppelverarbeitung, verlorene Antworten und Wettläufe; kann eine Anfrage unbemerkt auf `requested` hängen?**
- Doppelte Verarbeitung: Der Claim zählt den Versuch und setzt die Lease in derselben Transaktion vor `net.http_post` (pg_net sendet erst nach dem Commit). `begin` und `mark` verlangen genau diesen Versuch, eine gültige Lease und `pending` (`0035:247-249, 266`). Ein zweiter Aufruf mit demselben Versuch lädt eine zweite Datei hoch, sein `mark` scheitert mit `stale_claim`, die Datei wird nach 1 h als Waise gelöscht (`0035:394-396`). Sicher.
- Verlorene Antwort: Für den Zustand unerheblich, entscheidend ist allein das `mark`. Ein Absturz nach dem Upload hinterlässt eine Waise, danach folgt der nächste Versuch.
- Letzte zwei Fotos parallel: Beide sperren zuerst den Auftrag (`0035:264`), das zweite `photos_pending` sieht unter READ COMMITTED den Commit des ersten, `distribute_request` ist wiederholbar (Listing-Existenzprüfung). Es gibt genau eine Verteilung; die Probe `job-photos-concurrency.test.ts:44-62` deckt das ab.
- Claim gegen Mark: Der Claim sperrt mit `skip locked`, das Mark wartet und scheitert danach am erhöhten Versuch. Ein Deadlock ist nicht möglich, weil beide zuerst den Auftrag sperren und das Mark keine Zeilensperre hält, während es auf den Auftrag wartet.
- Zurückziehen während der Verarbeitung: Das Mark setzt `ready`, `photo_settle` schickt wegen des Status keine Mail, `distribute_request` kehrt mit 0 zurück, die Kopie fällt unter Teil (b) des Aufräumens. Sicher, aber nicht getestet (siehe Testlücken).
- Hängen: Unbegrenzt hängt nichts. Alle Wege sind durch `accept_deadline` begrenzt (Claim `0035:183`, Ablauf über `expire_requests`). Ohne Secrets scheitert der Cron sichtbar. Unbemerkt bleibt aber der Fall M2: Eingerichtete, aber nicht funktionierende Pipeline (Secret-Abweichung, Import- oder CPU-Fehler) führt nach etwa 9 Minuten zu `attempts_exhausted`, Verteilung ohne Fotos und einer irreführenden Kundenmail. Theoretisch bleibt zusätzlich der Fall N2.

**d) Leckt eine Antwort, ein Log oder eine Outbox-Zeile Pfade, Adressen, Namen oder die Gebühr?**
Nein, mit einer Ausnahme in der Testabdeckung (N6).
- Antworten: `photo-publish` liefert nur den Status, `photo-receipt` die Foto-ID, `job-photo` ID, Art und signierte URL, `photo-cleanup` Zähler.
- Logs: Foto-ID und fester Code (`handlers.ts:56, 65, 70`).
- Outbox: Art, Empfänger-ID, Anfrage-ID, Dedupe-Schlüssel ohne Personenbezug (`0035:161`).
- Mailtext `photo_failed` ohne Gebühr und ohne Namen (`jobs/handlers.ts:161`, Unit-Probe `photo-handlers.test.ts:239-255`).
- `last_error` trägt nur feste Codes (CHECK `0036:9-10`, Abbildung `0036:50-54`, `safeCode` `jobs/handlers.ts:174-180` liefert nur Codes aus der CHECK-Liste).
- `admin-photo` liefert Signatur-URLs der Originale mit Kunden-UID im Pfad, aber nur an admin mit aal2 und mit Audit-Eintrag (gewollt, Konzept 7.2).
- Die Gebühr kommt in keiner der geprüften Dateien vor.

**e) Grants und search_path**
Stimmen.
- Alle neun neuen `public`-Funktionen sind von public, anon, authenticated und service_role entzogen. Nur service_role erhält wieder Rechte, `photo_publish_dispatch` niemand außer dem Eigentümer (`0035:416-426`). Proben: Konto und anon bekommen 42501 (`job-photos.test.ts:93-94, 166, 264, 272`).
- `job_photos`: kein DML für irgendeine Rolle, service_role nur SELECT (`0035:65-66`). Updates und Löschen sind zusätzlich per Trigger gesperrt (`0035:42-61`).
- Outbox: Kein neuer Grant; `create or replace` behält die Rechte aus `0031:242-247` und `0033:20-21`.
- Alle SECURITY-DEFINER-Funktionen in 0035/0036 haben `set search_path = ''`. Die Invoker-Funktionen (`photo_publish_dispatch`, `outbox_dispatch`, `outbox_expire`) und der Trigger ebenfalls.
- Die privaten Helfer sind nur von public entzogen; das entspricht dem bisherigen Muster (z. B. `0031:27`).
- Einzige Lockerung über das Nötige hinaus: N4.

**f) Löscht `photo_purge` Dateien, die noch gebraucht werden?**
Nein.
- Belege: nie, Teil (b) nur `kind = 'request'`, Teil (a) nur Dateien ohne Zeile (`0035:396, 399`; Probe Zeile 270/291).
- Kopien offener oder angenommener Aufträge: Die Statusliste in (b) enthält weder `requested`, `awaiting_offer`, `offered`, `accepted` noch `in_progress`. Nach `completed` oder Storno bleibt die Kopie, solange irgendeine Zuordnung aktiv oder jünger als `partner_access_days` ist. Das ist dasselbe Fenster wie `assignment_access` (`0030:87-95`), es wird also nichts gelöscht, was ein Partner noch lesen darf.
- Originale: nur bei `withdrawn` (`0035:411`).
- Waisen erst nach 1 h; die Lease von 3 Minuten und der sofortige `add` liegen weit darunter.
- Folgeschaden der gelöschten Dateien: M1 (bleibende Zeilen mit Pfad brechen die Signatur für den admin).
- Für S9h zu beachten: Teil (b) löscht Kopien bei `unmatched`/`expired` sofort. Die Neuverteilung T16 (Konzept 7.3, „Kopie, auf die noch ein anderes Listing derselben Neuverteilung zeigt“) muss Kopien vorher übernehmen oder die Bedingung anpassen.

---

## Testlücken, die einen realen Fehler durchließen

1. `photo_purge` ist nur für „offen“ und „zurückgezogen“ geprüft (`tests/rls/job-photos.test.ts:265-292`). Es fehlen: `accepted`/`in_progress` bleibt, `completed` mit Zuordnungsende vor 29 Tagen bleibt, vor 31 Tagen gelöscht, `expired`/`unmatched` gelöscht, Beleg eines alten `completed` bleibt. Ein versehentlich aufgenommenes `accepted` in (b) oder ein falsches Intervall bliebe grün.
2. `job_photo_list` außerhalb der Zuständigkeit (Kategorie oder Bezirk nachträglich entfernt) ist nicht geprüft, obwohl Plan und Freigabe es verlangen; der Gleichheitstest deckt nur Frist und `suspended` ab (`job-photos.test.ts:148-191`). Fehlte `in_scope`, bliebe alles grün.
3. Keine Probe, dass `photo_claim` zurückgezogene, abgelaufene oder fristüberschrittene Anfragen auslässt (`0035:183`).
4. Keine Probe für `photo_publish_mark` auf einer inzwischen zurückgezogenen Anfrage (keine Mail, keine Verteilung, Kopie danach in `photo_purge`).
5. `receipt_gate` auf SQL-Ebene ohne `request_closed` (`completed`) und ohne `suspended`; beides gibt es nur mit Fakes im Unit-Test.
6. Keine Probe für M1 (Zeile `ready`, Objekt gelöscht, `admin_photo` und `job_photo_list`).
7. Kein Unit-Fall mit zweitem SOF (N3); keine Prüfung der Log-Inhalte bei unbekannten Fehlern (N6).

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0035:6-7` | Bucket `job-photos` privat, 4 MiB, nur JPEG, keine Policy in 0035 |
| `0001:411-415`, `0020:79-104`, `0021:46-64`, `0024:204-207`, `0025:5-6` | alle Policies auf `storage.objects` sind an `request-photos` bzw. `partner-documents` gebunden; keine wirkt auf `job-photos` |
| `0035:65-66` | `job_photos`: alles entzogen, nur SELECT für service_role |
| `0035:416-426` | 9 Funktionen entzogen, 8 an service_role, `photo_publish_dispatch` ohne Grant |
| `0035:349-354` gegen `0034:16-21` und `0023:89-102` | Bedingungen gleich (Status, Frist, `active` bzw. `active`/`payment_hold`, `in_scope`, `assignment_access`), plus Ausschluss des Kunden |
| `0035:184` | Claim mit `for update of s skip locked` |
| `0035:264-266` | Mark: Auftrag, dann Zeile; Versuch, Lease und `pending` geprüft |
| `0035:290-298` | Beleg-Tor: Auftrag `for update`, Firma `for share`, Zählung unter Auftragssperre |
| `0035:398-411` | Aufräumen (b) nur `kind = 'request'`, (c) nur `withdrawn` |
| `0030:87-95` | `assignment_access`: gleiches Fenster wie Aufräumen (b) |
| `0018:187-195` | jede Anfrage hat beim Commit eine Revision (`revision_missing` in `distribute_request` praktisch unerreichbar) |
| `0015:55-62` | `assert_admin` ohne aal; aal2 prüft die Function (`photo/handlers.ts:160`, `jobs/handlers.ts:45`), wie `admin-contact` |
| `0031:242-247`, `0033:20-21` | Grants von `distribute_*`, `outbox_*` bleiben bei `create or replace` erhalten |
| `0036:9-10`, `0036:50-55` | CHECK auf feste Codes; `outbox_mark` wirkt nur auf `sending` |
| `0036:65` | `outbox_expire` läuft im Cron vor der Leerprüfung (K1) |
| `photo/db.ts:12-16` | Kopie unter `randomUUID().jpg`, `upsert: false` |
| `photo/db.ts:23-26` | `sign` wirft bei einer einzigen fehlenden URL (Befund M1) |
| `photo/handlers.ts:99-100` | Tor vor dem Lesen des Bodys |
| `process.ts:44-51` | Grenze nur aus dem ersten SOF (Befund N3) |
| `process.ts:85-107` | keine Verkleinerung (Befund N1) |
| `src/lib/photos.ts:5` | App kodiert auf Kante 2000, unter der Grenze 2048 |
| `supabase/config.toml:436-446` | `verify_jwt = false` für alle vier neuen Functions; JWT prüft `getUser` (`jobs/db.ts:15-23`) |
| `jobs/handlers.ts:161` | Text `photo_failed` ohne Gebühr und ohne Personenbezug |
| `quote/db.ts:150-158` | `quote` liest nach `distribute_request` den Status neu und meldet `requested` |
| `http.ts:23-45` | `readBytesLimited` bricht auch ohne `content-length` beim Überschreiten ab |

---

## Offene Fragen

1. 1600 px (Konzept 7.1 Nr. 2, Plan E4) oder 2048 px ohne Verkleinerung (Umsetzung)? Bitte entscheiden und im Konzept nachziehen (N1).
2. Soll `attempts_exhausted` die Kundenmail auslösen (M2)? Mein Vorschlag: nein, stattdessen sichtbare Warnung im Betrieb.
3. Originale in `request-photos` bleiben bei `expired`, `unmatched` und `completed` unbegrenzt liegen (gelöscht wird nur bei `withdrawn` und erst mit S9h beim Konto). Ist diese Aufbewahrungsdauer gewollt (DSGVO-Speicherbegrenzung)?
4. Die Messung (CPU 2 s, 256 MB) für ein progressives 2000-px-Bild in `docs/proof/s9d/` habe ich nicht geprüft. Überschreitet die Neu-Kodierung das CPU-Limit, endet jedes Foto in `attempts_exhausted` (siehe M2).
5. Für S9h: Wie übernimmt T16 die Kopien, wenn Teil (b) des Aufräumens sie bei `unmatched`/`expired` sofort löscht?

Offene Findings hoch: 0
