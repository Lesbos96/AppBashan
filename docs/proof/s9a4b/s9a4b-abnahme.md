# Berater-Abnahme S9a-4b (Fotos vor dem Absenden, App + Migration 0021)

- Datum: 2026-11-03
- Geprüft:
  - `tmp/proof/s9a4b-diff.patch`, vollständig (18 Dateien, gegen ad1fa75)
  - `supabase/migrations/20261102120000_0021_photo_limits.sql`, vollständig (unversioniert)
  - zum Abgleich `supabase/migrations/20261102110000_0020_photo_staging.sql`, vollständig
  - im Arbeitsstand: `src/lib/uploads.ts` und `src/lib/photos.ts`, vollständig; `src/screens/anfrage/Zusammenfassung.tsx:150-310`; `src/lib/quote.ts:25-69`
  - `scripts/redproof-s9a4.mjs`: Hilfsfunktionen `:128-139` und `:351-362`, neue Einträge `:396-453`, `:487`, `:531`
  - `scripts/redproof-s9a3.mjs:225`, `:238`
  - `tests/rls/uploads.test.ts`: Hilfsfunktionen `:32-97`, Block `:702-785`
- Nachweise:
  - `s9a4b-check.log`: 364 bestanden, EXIT=0
  - `s9a4b-rls.log`: 176, EXIT=0
  - `s9a4b-e2e.log`: 101, EXIT=0
  - `s9a4b-live-uploads.log`: 41 PASS, EXIT=0
  - `s9a4b-redproof-s9a4.log`, `s9a4b-redproof-s9a3.log`: je EXIT=0
  - `s9a4b-push.log`, `s9a4b-types.log`: EXIT=0
  - `s9a4b-rotbeweis-s9a4.md` und `s9a4b-rotbeweis-s9a3.md`, vollständig
  - `s9a4b-n6.log` und `s9a4b-owner.log` samt `.sql`
  - `s9a4b-plan.md` (eigene Plan-Prüfung)
  - Reihenfolge der Änderungszeiten: `uploads.ts` und `Zusammenfassung.tsx` sind nach `s9a4b-shots.md` geändert; check, rls und e2e liefen danach; 0021 wurde vor `s9a4b-push.log` zuletzt geändert.
- Nicht geprüft: Shots (Reviewer), `docs/S9_KONZEPT.md`, Handler von `quote`.
- Hinweis: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Laut CLAUDE.md habe ich es nicht benutzt.

## Findings

### Hoch

Keine.

### Mittel

**M-1** `src/lib/quote.ts:54-58`, `src/screens/anfrage/Zusammenfassung.tsx:246`, `:248-255`; `0020_photo_staging.sql:188-192`; `src/lib/uploads.ts:14`

**Problem:** Die `clientRef` hängt nicht von den Fotos ab. `refFor` hasht den Körper ohne `photoIds`, und die idempotente Rückgabe von `quote_save_request` ignoriert `p_photo_ids`.

Ausgangslage: Die Anfrage ist auf dem Server gespeichert, die Antwort geht aber verloren, und die App zeigt „offline“ oder „unavailable“. Geht der Kunde dann zurück und ändert die Fotos, bleibt die Ref gleich. Zwei Fälle:
- (a) Foto entfernt: Alle übrigen Pfade stehen im `uploaded`-Set, es wird nichts hochgeladen. `quote` liefert 200 mit der bestehenden Anfrage, und die enthält das entfernte Foto. Die App meldet „gesendet“. Damit gilt „angezeigt = gesendet“ nicht: Der Kunde glaubt das Foto entfernt, der Partner sieht es vor der Annahme.
- (b) Foto hinzugefügt: Der Upload in einen Ordner mit Anfrage scheitert mit 403. Das ergibt dauerhaft `denied` („später noch einmal“), obwohl die Anfrage existiert. Ändert der Kunde danach eine andere Angabe, entsteht eine zweite verbindliche Anfrage.

Der Offline-Text „die Anfrage ist nicht gesendet“ ist in diesem Pfad falsch.

**Fix (Entscheidung):**
- Die sortierten Foto-IDs in den Körper von `refFor` aufnehmen. Eine Fotoänderung gilt dann als neuer Versuch, wie jede andere geänderte Angabe. Das Doppelrisiko nach einer verlorenen Antwort entspricht dem der übrigen Felder und ist nicht neu.
- `renewPhotoIds` nach einem 422 ergibt dann eine neue Ref. Das ist harmlos, denn es gibt keine Anfrage.
- Den Offline-Text auf „Die Fotos sind noch nicht hochgeladen.“ kürzen.
- E2E-Test: `quote` gemockt mit Abbruch, Foto entfernen, erneut senden. Erwartet: neue `clientRef`, und `photoIds` entsprechen genau den angezeigten Fotos.
- Die Doppelanfrage nach einer verlorenen Antwort in `OPEN_ISSUES.md` vermerken. Ein serverseitiger Abgleich des Fotosatzes im idempotenten Zweig wäre die spätere, stärkere Lösung.

**M-2** `src/screens/anfrage/Zusammenfassung.tsx:263-266`; `src/lib/uploads.ts:66-71`; `0021_photo_limits.sql:28-31`, `:56`

**Problem:** Staging-Dateien räumt die App nur nach `photo_missing` und `photo_expired` weg.

Bei jedem anderen fehlgeschlagenen Senden, nach dem der Kunde Angaben ändert, entsteht eine neue `clientRef`. Beispiele: 422 `too_late` oder `district_required`, `invalid_input`, „Angaben ändern“, Netzfehler mit anschließender Korrektur. Mit M-1 kommen Fotoänderungen hinzu. Alle Fotos werden dann neu hochgeladen. Die alten Dateien zählen bis `photo_staging_hours` plus 1 h gegen das Kontingent von 40.

Mit 8 Fotos sperren fünf solcher Runden das Konto für etwa 25 Stunden. Der Kunde sieht nur `denied` und kann seine Anfrage nicht senden. Ein Sicherheitsproblem ist das nicht, die Grenze ist wirksam. Es betrifft aber die Verfügbarkeit des Hauptflows.

**Fix:**
- Im Modul `uploads.ts` den letzten Staging-Stand `{userId, clientRef, paths}` merken.
- Beginnt ein Senden mit einer anderen Ref oder einem anderen Konto, vorher die alten Pfade per `discardStaging` entfernen.
- Hat die alte Ref schon eine Anfrage (verlorene Antwort), lehnt die Delete-Policy ab. Das ist harmlos.
- Unit-Test: Ref-Wechsel, dann `remove` mit den alten Pfaden.

### Niedrig

**N-1** `scripts/redproof-s9a4.mjs:438`; `tmp/proof/s9a4b-rotbeweis-s9a4.md:295-301`, `:448`

**Problem:** Der Eintrag „übernommene Dateien zählen mit“ misst den Ist-Wert richtig: 40 Objekte mit 403, gesperrt 41 Objekte mit ok, und der Test wird rot. Er steht aber als „Art: Sperre“ in der Summe „29 Sperren“.

Das ist keine Sicherheitssperre, sondern ein Aussperr-Schutz (Verfügbarkeit). Das Lockern macht das System strenger, nicht offener. Der Label-Text sagt das, Art und Summe nicht.

**Fix:** Eine eigene Art (etwa „Verfügbarkeit“) mit eigener Zählung im Ergebnis. Die Nachweisdatei bleibt unverändert, der Hinweis gehört in `PROGRESS.md`. Die Sicherheitssperren lauten damit 28 und die Verfügbarkeit 1.

**N-2** `scripts/redproof-s9a4.mjs:360-362`, `:416`

**Problem:** Die Lockerungsausdrücke der älteren Storage-INSERT-Einträge stammen aus 0020: Fremdordner, client_ref, Pfadform. Dasselbe gilt für den neuen A-M2-Insert-Eintrag. Ihnen fehlt die Zählbedingung aus 0021, beim Lockern fallen also zwei Bedingungen weg.

Die Wirkung ist der Zielbedingung nur zuzurechnen, solange A unter 40 nicht übernommenen Dateien liegt. Das ist plausibel, aber nicht belegt.

**Fix:** Allen Lockerungsausdrücken der Insert-Policy die Zählbedingung `(select private.staging_photo_count()) < 40` anhängen. Alternativ die Zählung von A in der Probe ausgeben.

**N-3** `scripts/redproof-s9a3.mjs:238`; `scripts/redproof-s9a4.mjs:487`

**Problem:** Das Label „Schicht: RLS auf platform_settings“ ist veraltet. Der gemessene Wert zeigt eine andere Schicht, nämlich das fehlende EXECUTE auf `photo_staging_interval` (`s9a4b-rotbeweis-s9a3.md:122`). Der Kommentar in `redproof-s9a3.mjs` sagt das richtig.

**Fix:** Das Label auf „Schicht: kein EXECUTE auf photo_staging_interval“ ändern.

**N-4** `src/screens/anfrage/Zusammenfassung.tsx:184-189`, `:256`

**Problem:** `clearPhotos` läuft nur im Unmount-Cleanup, und nur wenn `sentRef` gesetzt ist. Verlässt der Kunde die Seite während des Sendens (zurück, während Uploads oder `quote` laufen), läuft der Cleanup mit `sentRef = false`. Danach setzt der Erfolg `sentRef`, und die Fotos bleiben im Speicher. Sie füllen den nächsten Entwurf desselben Service vor.

Sie sind dort sichtbar, verletzen also „angezeigt = gesendet“ nicht, sind aber unerwartet.

**Fix:** Einen Ref für den Mount-Zustand führen. Ist die Seite beim Erfolg schon weg, sofort `clearPhotos` aufrufen.

**N-5** `src/lib/photos.ts:101-105`; `0021_photo_limits.sql:59-70`

**Problem:** Ein Foto, das schon im Staging lag und danach im Konfigurator entfernt wird, bleibt im Ordner der `clientRef`. Nach dem Senden liegt es im Ordner der Anfrage, ohne Zeile, und der Kunde kann es nicht löschen, bis `photo_cleanup` läuft.

Heute ist das sicher, weil alles über `request_photos` läuft (`ARCHITECTURE.md`, Datenschutz). Ein späterer Partnerzugriff über Ordnerlisten würde diese Dateien aber zeigen.

**Fix:** In `OPEN_ISSUES.md` (S9a-5/S9b) festhalten: Der Partnerzugriff auf Fotos läuft nur über `request_photos`-Zeilen, nie über Ordnerlisten. Optional `discardStaging` beim Entfernen, das ist mit M-2 weitgehend abgedeckt.

**N-6** `tmp/proof/s9a4b-owner.sql:1-6`; `scripts/redproof-s9a4.mjs` (Snapshot, Funktionszeile)

**Problem:** Der Eigentümer von `private.staging_photo_count()` ist nicht direkt geloggt. Geprüft ist nur die Rolle `postgres`, und das vor dem Push. Der Snapshot vergleicht md5 und Rechte, nicht `proowner`.

Funktional ist es belegt: Die 41. Datei wird verweigert. Ohne BYPASSRLS zählte die Funktion 0, und der Test wäre rot.

**Fix:** Der Snapshot-Zeile der Funktion `proowner::regrole`, `prosecdef` und `proconfig` hinzufügen.

**N-7** `docs/OPEN_ISSUES.md` (Zeile R2-N13)

**Problem:** Hinter „Stand S9a-4b“ steht noch der Block „Stand S9a-4a“ mit „fehlt noch (S9a-4b: Rohaufruf …)“. Der Rohaufruf ist inzwischen belegt. Der Inhalt ist ehrlich, die Reihenfolge verwirrt.

**Fix:** Den 4a-Block als überholt kennzeichnen oder einkürzen.

## Beantwortung der Prüffragen

**(1) Ist 0021 korrekt, ohne Querzugriff und ohne Rechte-Ausweitung?** Ja.
- Die Funktion:
  - Sie hat die Form `security definer`, `stable` und `search_path = ''`, ohne Parameter.
  - Die uid kommt nur aus `auth.uid()`, alle Objekte sind schemaqualifiziert (`0021:34-41`).
  - Das LIKE-Präfix ist sicher: Eine uuid enthält weder `%` noch `_`, und das Präfix endet auf `/`. Für anon ergibt `auth.uid()` NULL, die Zählung also 0. anon hat ohnehin kein EXECUTE, und die Policy gilt nur für `authenticated`.
  - Rechte: `revoke all … from public, anon`, `grant execute … to authenticated` (`0021:43-44`).
  - Der Eigentümer `postgres` hat BYPASSRLS und SELECT auf beiden Tabellen, `authenticated` hat USAGE auf `private` (`s9a4b-owner.log`). Die Wirkung ist funktional belegt (N-6).
  - Preisgegeben wird nur die Zahl der eigenen Staging-Dateien. Es gibt keinen Querzugriff, und ein Kunde kann kein fremdes Kontingent belasten, weil der Ordner an die eigene uid gebunden ist (`0021:50`).
- Die Policies:
  - INSERT `0021:46-57` ist 0020 `:79-89` plus die Qualifizierung von `objects.name` und plus die Zählung.
  - DELETE `0021:60-70` ist 0020 `:91-101` plus die Qualifizierung.
  - `ALTER POLICY` lässt Befehl, Rollen und permissiven Typ unverändert.
  - Im Dev-Ausdruck vor dem Push band das unqualifizierte `name` in der Unterabfrage schon an `objects.name` (`s9a4b-n6.log:46`, `:50`). Die Qualifizierung ändert die Semantik also nicht.
- Default und Guard: `drop default` (`0021:6`). Der Guard fängt einen NULL-Pfad vor NOT NULL ab (`0021:18`). Der Kommentar ist korrigiert (`0021:4-5`).
- Die Grenze ist weich (Parallelität, mehrere Konten), das ist richtig dokumentiert. `EXPLAIN` steht noch aus (OPEN_ISSUES).

**(2) Messen die neuen Rot-Beweise den Ist-Wert, sind die Schichten ehrlich, ist A-M2 belegt?** Ja, mit N-1 bis N-3.
- Ist-Werte:
  - Objektzahl 41 gegen 40 (`rotbeweis-s9a4.md:287-293`)
  - Datei weg gegen da und Upload ok gegen 403 mit Objektzahl (`:271-285`)
  - `column_default`, Zeilenzahlen (`:303-317`)
  - Je ein Test wird gelockert rot.
- Schichten: NULL-Pfad (NOT NULL dahinter) und Default (Trigger in der Probe aus, Rollback) sind richtig als Schicht ausgewiesen.
- Live-Einträge: Sie sind als „Beobachtung“ gekennzeichnet und zählen nicht als Rot-Beweis (`:448`). Das erledigt den Teil Kennzeichnung aus A-M1.
- A-M2 ist belegt:
  - Fixture als Eigentümer mit Alt-Pfad `{uid}/{request_id}/…`; die client_ref-Bedingung greift dort nicht (`redproof-s9a4.mjs:396-416`)
  - je ein Rot-Beweis für Delete und Insert
  - eigener Test (`uploads.test.ts:763`)
  - 0 Alt-Zeilen (`s9a4b-n6.log:61-66`)
  - Zur Zurechenbarkeit beim Insert siehe N-2.
- Eintrag „übernommene Dateien zählen mit“: Messung und Wirkrichtung stimmen, der Test wird rot (`uploads.test.ts:732`). Die Einordnung als „Sperre“ ist falsch, es ist ein Aussperr-Schutz ohne Sicherheitsbezug (N-1).

**(3) Gelten „angezeigt = gesendet“ und „Fotos nach dem Senden nicht änderbar“?** Im Normalfall, nach 409 und nach 422 ja. Eine Lücke gibt es nach einer verlorenen Antwort (M-1).
- Abgleich: `photoIds` entsprechen genau `toSend`, also den hochgeladenen Dateien und der angezeigten Liste zum Sendezeitpunkt (`Zusammenfassung.tsx:248-255`).
- Kein doppelter Upload: Das `uploaded`-Set (`uploads.ts:33-48`) verhindert ihn. Ein 409 „already exists“ gilt als Erfolg, das ist sicher, weil die ID clientseitig zufällig ist.
- Mehrfach-Senden sperrt `busy` (`:226-227`).
- Nach `photo_missing`/`photo_expired` werden zuerst die alten Dateien entfernt und das Set geleert, dann gibt es neue IDs (`:263-266`, `uploads.ts:67-70`, `photos.ts:67-68`). Belegt durch E2E mit 4 Uploads, 2 neuen IDs und gleicher `clientRef`.
- Kontowechsel:
  - Die Sitzung wird vor dem Upload geprüft (`:235-238`).
  - Der Pfad enthält die uid, das Set mischt also keine Konten.
  - Upload und `quote` verwenden dieselbe `live`-Sitzung.
- Nach dem Senden ist keine Foto-Bearbeitung mehr möglich:
  - In der App gibt es keine Bearbeitung mehr (`FotoUploads.tsx` gelöscht, E2E prüft 0 Knöpfe).
  - Serverseitig belegen das `live-uploads.log:25-30` und die Beobachtung in `rotbeweis-s9a4.md:416-421`.
- Verwaiste oder zu viele Uploads: M-2 (Kontingent nach Ref-Wechsel), N-4 (Speicher nach Verlassen während des Sendens), N-5 (entfernte Staging-Fotos im Anfrage-Ordner).

**(4) Stimmen OPEN_ISSUES und ARCHITECTURE mit Code und Nachweisen überein?** Ja.
- `ARCHITECTURE.md` passt zu Code, Grants und Policies:
  - Zeilen 18-20 entsprechen den Grants in `s9a4b-n6.log:33-42` und den Policies.
  - Fotos-Abschnitt und Entscheidung 20 entsprechen `uploads.ts` und `0021`.
- Ehrlich zugeordnet:
  - R2-N13 „teilweise“ (Beobachtung ja, Lockern und Redeploy nein, Begründung angegeben)
  - Offen: A-N2/A2-N3, A-N4 (Exit-2-Pfad bei sauberem Baum, deckt sich mit `rotbeweis-s9a4.md:437`), A-N5, A-N9
  - A-N3 Rest, Plan-M-1, N-2, M-4, N-4/N-5 aus S9a-3 unter „S9a-4c oder eigene Nachprüfung, vor S10“
- Nachtragen: M-1, M-2, N-4, N-5 dieses Berichts. Bei N-7 nur die Darstellung bereinigen.
- Die Änderungen per `node -e`/`sed` (`uploads.test.ts`, `fotos.spec.ts`, `shots.spec.ts`, `Gesendet.tsx`) sind im Diff inhaltlich korrekt und schlüssig. Typecheck, Lint und die Läufe sind grün, und sie liefen nach der letzten Codeänderung.

**(5) Gibt es neue hohe Funde zu Geld oder Sicherheit?** Nein.
- Geld: Der Diff berührt weder Preis noch Gebühr. `photoIds` ändern den Snapshot nicht, und die neuen Texte erwähnen keine Gebühr.
- Sicherheit: Es gibt keine Rechte-Ausweitung, kein Secret im Code und keinen Querzugriff. Der Kostenschutz bleibt weich und ist vor dem Livegang offen (A-N10).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0021_photo_limits.sql:34-44` | SECURITY DEFINER, `search_path = ''`, keine Parameter, uid aus `auth.uid()`, Rechte nur `authenticated` ✓ |
| `0021_photo_limits.sql:46-57` vs. `0020:79-89` | gleich bis auf Qualifizierung und Zählung ✓ |
| `0021_photo_limits.sql:60-70` vs. `0020:91-101` | gleich bis auf Qualifizierung ✓ |
| `0021_photo_limits.sql:18` | NULL-Pfad abgefangen (Plan N-1) ✓ |
| `0020_photo_staging.sql:188-192` | idempotente Rückgabe vor jeder Fotoprüfung, `p_photo_ids` ignoriert (M-1) |
| `0020_photo_staging.sql:264-276` | Übernahme nur `{customer}/{client_ref}/{id}.jpg`, Rollback bei Fehler ✓ |
| `s9a4b-owner.log:5-26` | postgres BYPASSRLS true, SELECT auf beiden Tabellen, USAGE `private` ✓ |
| `s9a4b-n6.log:46`, `:50` | unqualifiziertes `name` band schon an `objects.name` ✓ |
| `s9a4b-n6.log:61-66` | 0 Zeilen, 0 ohne Staging-Präfix ✓ |
| `src/lib/quote.ts:30`, `:54-58` | Ref aus Körper inkl. Kontakt, ohne Fotos (M-1) |
| `src/lib/uploads.ts:33-53` | Set, ohne Upsert, 409 als Erfolg, 403 → `denied` ✓ |
| `src/lib/uploads.ts:14` | Offline-Text behauptet „nicht gesendet“ (M-1) |
| `src/lib/uploads.ts:67-71` | Set vor dem Löschen geleert ✓ |
| `src/lib/photos.ts:67-68` | neue IDs für alle Fotos ✓ |
| `Zusammenfassung.tsx:184-189`, `:256` | Leeren nur im Unmount-Cleanup (N-4) |
| `Zusammenfassung.tsx:246-255` | Upload vor `quote`, `photoIds` = `toSend` ✓ |
| `Zusammenfassung.tsx:263-266` | Aufräumen nur bei `photo_missing`/`photo_expired` (M-2) |
| `redproof-s9a4.mjs:351-355`, `:360-362` | Lockerungsausdrücke ohne Zählbedingung (N-2) |
| `redproof-s9a4.mjs:437` | nur Zählbedingung gelockert ✓ |
| `redproof-s9a4.mjs:438` | Art Sperre für Aussperr-Schutz (N-1) |
| `redproof-s9a4.mjs:487`, `redproof-s9a3.mjs:238` | Label der Schicht veraltet (N-3) |
| `redproof-s9a4.mjs:531` | Live-Einträge als Beobachtung ✓ |
| `uploads.test.ts:702-745` | frisches Konto, 40/41, Löschen und Übernehmen geben Platz frei ✓ |
| `uploads.test.ts:763-785` | Alt-Pfad-Fixture, Trigger danach aktiv (`O`) geprüft ✓ |
| `rotbeweis-s9a4.md:444-448` | Definitionen identisch; 29 Sperren / 16 Schichten / 8 Beobachtungen ✓ (N-1 zur Zählung) |
| `rotbeweis-s9a3.md:103-125` | geocode_cache-Wert aus Kundensicht, quote_save_request-Schicht neu ✓ (N-3) |
| `live-uploads.log:1-46` | 41 PASS, ALLES BESTANDEN, EXIT=0 ✓ |
| `s9a4b-check.log:43`, `s9a4b-rls.log:180`, `s9a4b-e2e.log:115` | 364 / 176 / 101 bestanden, je EXIT=0 ✓ |

Offene Findings hoch: 0
