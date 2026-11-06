# Abnahme Nacht-Merges · Runde 1 von 2 (Berater, Geld/Sicherheit/Schema)

- **Datum:** 2026-11-06
- **Branch/Stand:** `nachtabnahme`, HEAD laut Auftrag 09205fe (Soll-Basis 086663f + Config-Commit). Git selbst nicht ausgeführt; geprüft wurde der Patch.
- **Umfang:** `tmp/proof/nachtabnahme-abnahme.patch` (= Diff 1630668..HEAD über `src`, `tests`, `scripts`, `package.json`, 60 Dateien), vollständig in Teilen gelesen. Dazu die aktuellen Dateien `src/lib/uploads.ts`, `src/lib/quote.ts` (1–110, 127–220), `src/lib/draft.ts`, `src/lib/auth.ts` (98–131), `src/screens/Anmelden.tsx`, `src/screens/anfrage/Zusammenfassung.tsx` (150–349, Dialogstellen), `src/screens/anfrage/Gesendet.tsx` (1–60), `playwright.config.ts`, `scripts/live-uploads.mjs` (55–77), `docs/AUDIT_NACHT.md`, Ausschnitte aus `docs/OPEN_ISSUES.md`, `docs/ARCHITECTURE.md`, `supabase/functions/_shared/{pricing,quote}` (nur lesend, nur gegrept) und die Teil-C/G-Logs in `tmp/proof/`.
- **Maßstab:** `CLAUDE.md` (Geld, Daten und Sicherheit, UI), `docs/S9_KONZEPT.md` (Akteur je Übergang; der Patch berührt keine Statusübergänge und keine Function).
- **Hinweis Werkzeug:** In der Tool-Liste dieses Laufs stand ein eingebautes, parameterloses `advisor`-Tool. Nach `CLAUDE.md` wurde es nicht benutzt.

## Ergebnis in einem Satz

Die Code-Änderungen der Nacht sind für Geld und Sicherheit sauber: „angezeigt = gesendet“ hat jetzt genau eine Quelle, Staging wird vollständiger geräumt, die Übergabe ist auf einen Service begrenzt, die Mock-Schicht steckt nicht im Build, und die Sperren s9a1–s9a4 greifen vor jeder Dev-Abfrage. Offen sind der vorbestehende hohe Doku-Fund H-1 aus dem Audit (vom Patch nicht berührt) und ein fehlender Live-Beleg für 409 gegen die deployte `quote`.

## Findings

### Hoch

| Nr. | Datei:Zeile | Problem | Fix |
|---|---|---|---|
| H-1 (Audit, vorbestehend) | `docs/ARCHITECTURE.md:123`, `:45`, `:46`, `:32`, `:97`, `:100` | Der einzige hohe Fund aus `docs/AUDIT_NACHT.md:14` ist **offen**. Die Architekturquelle beschreibt weiter geschlossene Pfade als gültig: `:123` (Vermieter über „Für Vermieter“ liest den Gebührensatz, Funktion seit 0022 gelöscht), `:45` admin mit Schreibrechten auf `platform_settings`, `:46` Kunden-UPDATE auf `service_requests.status`, `:32/:97/:100` `quote` schreibe `fee_splits` und lese `current_fee_rates`. Der Patch enthält keine Doku. Die Nacht-Merges verursachen den Fund nicht und verschlimmern ihn nicht. Er bleibt aber das Risiko, vor dem das Audit warnt: S9b-1 baut Rollen und RLS, und wer nach diesen Zeilen baut, öffnet den Gebührensatz wieder. | Wie im Audit vorgeschlagen: Entscheidung 17 streichen bzw. „Vermieterrolle nur über `admin_grant_role`“; RLS-Matrix auf den Endzustand nach 0022 bringen; Geldfluss 2 und Abschnitt „quote“ auf 0018–0020 (keine Gebühr in `quote`, Journal ab S9b-4). Nur Doku, nur per Edit. Spätestens vor S9b-1; für den Merge der Nacht-Branches nach `main` ist das kein Code-Blocker. |

Der Patch selbst bringt **keinen** hohen Fund.

### Mittel

| Nr. | Datei:Zeile | Problem | Fix |
|---|---|---|---|
| M-1 | `scripts/live-uploads.mjs:71-76`; `scripts/redproof-s9a4.mjs:667-673`; `tmp/proof/nachtabnahme-c-live-uploads.log:21`, `:23` | **Für 409 gegen die deployte `quote` gibt es in Teil C keinen Beleg.** `live-uploads.mjs` ruft die deployte Function auf (`:62`) und geht dabei über 409 `terms_changed` und 409 `price_changed` (`:71-76`), prüft beide aber nicht: Liefert der erste Aufruf etwas anderes als 409, gibt der Helfer es unverändert zurück (`:72`). Selbst ein 200 auf einen falschen `termsHash` mit `shown` 0 Cent ergäbe deshalb „PASS quote mit photoIds: 200“ (Log `:21`). Die einzigen ausdrücklichen 409-Prüfungen gegen den Deploy-Stand stehen in `redproof-s9a4.mjs:667-673` („falscher termsHash → 409 …“, „falsches shown → 409 …“), und das Skript ist jetzt gesperrt (Exit 2). `live-quote-app.mjs` und `live-test.mjs` enthalten keine 409-Prüfung und liefen in Teil C nicht. Die RLS-Suite belegt 409 nur für den Handler-Code gegen die Dev-DB (`nachtabnahme-c-rls.log:10-19`), nicht für die deployte Function. Für 422 gegen den Deploy-Stand gibt es einen Beleg: `photo_missing` (Log `:23`). | In `live-uploads.mjs` `quote()` beide Zwischenschritte prüfen (erster Aufruf genau 409 `terms_changed` und keine Anfrage, zweiter genau 409 `price_changed` mit Snapshot, sonst `check(false, …)`), oder die Live-Rohaufrufe aus `redproof-s9a4` (5b) als eigenes, ungesperrtes Lese-/Prüfskript mit Dev-Guard ausgliedern. Lauf mit Log `tmp/proof/…` und `EXIT=`. Der Patch ändert kein `supabase/functions`, deshalb mittel. |

### Niedrig

| Nr. | Datei:Zeile | Problem | Fix |
|---|---|---|---|
| N-1 | `src/screens/anfrage/Zusammenfassung.tsx:229-237`, `:240-242` | Umgekehrter Wettlauf zu A4c-N1: `otherAccount` setzt `busy` nicht. Tippt der Kunde während `await discardStaging`/`await leaveAccount()` auf „Anfrage senden“, kann `send` die alte Sitzung noch lesen und unter dem alten Konto senden. Danach liegt der schon gesendete Entwurf in der Übergabe (`stashDraft` lief vorher), und nach der neuen Anmeldung stellt `restoreDraft` ihn wieder her (mögliche Doppelanfrage unter dem neuen Konto). Das Zeitfenster ist kurz. Kein Rechte- und kein Geldpfad: Der Server bindet die Anfrage an das geprüfte Token. | Am Anfang von `otherAccount` `busy.current = true` setzen (im `finally` zurück) und die Leiste über einen State sperren; E2E: „Anderes Konto“ antippen, mit verzögertem Abmelde-Mock sofort „Anfrage senden“, erwartet 0 Aufrufe von `quote`. |
| N-2 | `tests/e2e/anfrage.spec.ts:84-93` (Patch-Zeilen 1391-1400) | Der A4c-N1-Test belegt nur `disabled`. `click({ force: true })` auf einen deaktivierten Knopf löst kein `click` aus, die Wache `if (busy.current) return` (`Zusammenfassung.tsx:231`) wird also nicht gemessen. Die Endprüfungen (URL `gesendet`, ein Aufruf) wären auch mit dem alten Code möglich gewesen, weil das späte `navigate` nach `gesendet` gewinnt. Rot wird der Test nur über `toBeDisabled()`; das reicht für den Fix, ist aber kein Wirkungsbeweis für die Wache. | Optional zusätzlich prüfen, dass die URL nie `/anmelden` war (`page.on('framenavigated')`) und dass die Sitzung nach dem Senden noch dasselbe Konto ist. |
| N-3 | `src/app/router.tsx:30`, `:87-93` | Lazy Loading: Scheitert ein Chunk (offline), zeigt der Router `errorElement` (`Fehler`). Der Entwurf bleibt im sessionStorage, nichts wird gesendet oder verloren. Der Kommentar „der Router lädt beim Aufruf erneut“ ist nicht belegt: Ob ein gescheitertes `import()` derselben URL im selben Dokument neu geladen wird, hängt vom Browser ab, und der Vorab-Abruf (`prefetch`) könnte genau diesen Fehlschlag festsetzen. Nur Verfügbarkeit. | E2E: Chunk-Anfrage einmal abbrechen, danach erneut navigieren; erwartet die Seite statt `Fehler`. Sonst Kommentar korrigieren und in `Fehler` einen „Neu laden“-Knopf anbieten. |
| N-4 | `scripts/redproof-s9a4.mjs` (Patch-Zeilen 71-92, 99-114) | Der neue Code hinter der Sperre wiederholt bei Transportfehlern auch nicht idempotente Fixture-Inserts (der Kommentar sagt es). Nach einer endgültig gescheiterten Wiederherstellung läuft die Schleife weiter (= M-2 aus `nachtabnahme-vorher-redproof-r2.md`, `OPEN_ISSUES.md:261`). Hinter der Sperre gibt es heute keine Wirkung. | In R1 mit M-2 erledigen: nach gescheitertem `restore` sofort abbrechen, Inserts nicht automatisch wiederholen. |

## Schwerpunkte

### (1) angezeigt = gesendet: erfüllt

- `buildBody` liest `shown` nur aus `readShownFull` (`src/lib/quote.ts:30`). Das Feld `Confirmed.shown` gibt es nicht mehr (`quote.ts:18`, c891a92). Der Unit-Test schiebt absichtlich ein fremdes `shown` unter und erwartet den gemerkten Wert (Patch 2934-2944).
- Preiskarte und Senden lesen dieselbe Quelle: Karte `Zusammenfassung.tsx:220`, `:342` (`shownLabel(readShownFull)`), Senden `:254` (`buildBody`), Bestätigung `:274` (`shown: readShownFull(path)`).
- `readShownFull`/`parseShown` (`draft.ts:120-135`): nur ganze Cent ≥ 0 und nur bekannte Felder, Zusatzfelder fallen weg (Unit-Test Patch 2786-2789). `shownKey`/`readShown` sind entfernt, auch aus `draftKeys` (`draft.ts:105`).
- Plan-M-1 (fc30353): `Sent.shown` trägt den vollen `Shown` (`draft.ts:145`, `:172`). `Gesendet.tsx:20-21` vergleicht `shownLabel(sent.shown)` mit `priceLabel(snapshot).main`, also Anzeige mit Anzeige („X bis Y“ gegen „X bis Y“). Die Unit-Tests `tests/unit/gesendet.test.ts` decken ab: Spanne gleich ohne Hinweis, Spanne anders mit Hinweis, Spanne zu Angebot mit Hinweis, Festpreis in Cent, eine alte `shownCents`-Bestätigung ergibt keinen Hinweis.
- 409-Dialoge: „Der Preis wurde aktualisiert.“ (`Zusammenfassung.tsx:428-432`) zeigt `priceLabel(newSnapshot).main`. „Übernehmen“ speichert `shownFromSnapshot` per `rememberShown` und prüft das Zurücklesen (`:304-310`). Gesendet wird danach wieder nur über `buildBody`. „Die Bedingungen wurden aktualisiert.“ (`:441-444`) zeigt die Stufen aus `conflict.terms`, gesendet wird deren `termsHash` (`:254`, `:314`). Die Sperre `canSend` gilt für Leiste und Karte (`:296`, `:455`). E2E grün: `nachtabnahme-c-e2e.log:91`, `:94`, `:96`, `:98`, `:100`, `:101`.
- `refBody`/`clientRef` (`quote.ts:58-60`): `priceVersion`, `termsHash` und `shown` sind neutralisiert, `photoIds` sortiert. Nach einem 409 bleibt die Ref also gleich, ein anderer Fotosatz ergibt eine neue Ref. Belege: E2E „clientRef bleibt gleich“ (`c-e2e.log:91`) und `wege.spec.ts` (503 und erneutes Senden mit derselben Ref, Patch 2319-2333).
- Geld: Die Beträge kommen vom Server, die App rechnet nichts neu, das Format läuft über `formatEuro`. Im Patch kein Gebührenwort und kein fester Satz; die neuen E2E prüfen Text und Body auf Gebührenbegriffe (`wege.spec.ts`, Patch 2240-2242).

### (2) Staging/Uploads: erfüllt

- A4c-N2 (2464690): `tried` wird vor dem Upload gefüllt (`src/lib/uploads.ts:65`). Ref-Wechsel (`:55`) und `discardStaging` (`:93`) räumen `tried` statt nur der bestätigten `paths`. Ein zweiter Upload bleibt nur bei bestätigten `paths` aus (`:63`). Drei Unit-Fälle (Patch 3949-3970): verlorene Antwort mit Ref-Wechsel, mit `discardStaging` und ein erneuter Versuch bei gleicher Ref.
- Übernommene Dateien schützt der Server: Löschen erlaubt die Policy 0021 nur ohne Anfrage zur Ref (Kommentar `uploads.ts:40`). Ein `remove` auf Pfade einer schon gespeicherten Anfrage bleibt deshalb wirkungslos. Die bekannte Restgrenze N-11 (`OPEN_ISSUES.md:221`) bleibt.
- M-2 (S9a-4b): `stagingFor` räumt beim Ref-Wechsel desselben Kontos (`uploads.ts:50-57`). Bei einem anderen Konto räumt `otherAccount` vorher noch mit der alten Sitzung (`Zusammenfassung.tsx:234`).
- A4c-N1 (ed2fb72): Wache `Zusammenfassung.tsx:231` und `disabled={sending}` am Knopf (Patch 1137). E2E grün (`c-e2e.log:35`, `:155`). Restpunkte siehe N-1 und N-2.
- `discardStaging` läuft nach `photo_missing`/`photo_expired` (`Zusammenfassung.tsx:280-283`, E2E `c-e2e.log:97`, `:99`) und vor dem Kontowechsel.
- Kontingent 40 / höchstens 8: Server `supabase/migrations/20261102120000_0021_photo_limits.sql:56` (Zählung `< 40`), Client `src/lib/photos.ts:3` (`MAX_PHOTOS = 8`), Server 9 IDs → 422 `too_many_photos` (`c-rls.log:67`), echte Uploads gegen Dev 41/41 PASS (`c-live-uploads.log:1-45`, `EXIT=0` `:46`). Der Patch lockert keine dieser Grenzen.

### (3) Anmeldung/Übergabe: erfüllt

- F5 (b077005): `stashDraft` speichert `path` (`draft.ts:192`). `restoreDraft` verwirft eine Übergabe ohne gültigen `path` (`:207`) und übernimmt nur `draftKeys(raw.path)` (`:209-211`), nur fehlende Schlüssel und nur Strings, mit Größengrenze (`:208`). Unit-Tests: Patch 2848-2862 (fremder Service fällt weg; ohne bzw. mit unbekanntem `path` wird alles verworfen und der Eintrag gelöscht).
- `safeNext` (`src/lib/auth.ts:98-108`) ist unverändert (nicht im Patch): nur gleiche Origin, keine Steuerzeichen, kein `//host`, nie zurück auf `/anmelden`. `takeNext` prüft beim Lesen erneut (`:126`). E2E für vier Angriffsziele grün nach dem Config-Commit (`tests/e2e/anmelden.spec.ts:90-96`, `nachtabnahme-g-anmelden-e2e.log:37-38`).
- Login-CSRF: unverändert. Ein Link-Token meldet nie automatisch an (`Anmelden.tsx:66-72` nur im Schritt `email`). Bei bestehender Sitzung kommt eine Warnung mit ausdrücklicher Bestätigung (`:172-183`), nach der Anmeldung steht das Konto im Text (`:198`). Beim Senden gilt die Einwilligung nur für das angezeigte Konto (`Zusammenfassung.tsx:172-176`), und `send` vergleicht das live gelesene Konto mit dem angezeigten (`:249`). Restrisiko wie bisher (N-9 aus S9a-3: Kontakt bis 15 min in der Übergabe), vom Patch nicht berührt. Im Patch ist an `Anmelden.tsx` nur `autoFocus` dazugekommen.

### (4) Mock-Schicht und Live-Prüfungen: teilweise erfüllt, offen ist M-1

- **Nicht im Build:** `tests/e2e/backend.ts` liegt nur unter `tests/` und wird von keinem `src`-Modul importiert. `nachtabnahme-c-build.log:44` „dist-Scan: 0 Treffer“, `:46-51` keine Mock-Bezeichner in `src` und `dist`, `:52` `EXIT=0`.
- **Abgeschlossenheit der E2E:** Die Fixture bricht jeden Aufruf an einen fremden Host ab, und der Test scheitert, wenn die Liste ungemockter Aufrufe nicht leer ist (`backend.ts`, Patch 1536-1567). `playwright.config.ts:34` setzt eine nie auflösbare Platzhalter-URL. Selbsttest `backend.spec.ts`, der Rot-Beweis ist nur per Variable aktiv (die 2 übersprungenen Tests in `c-e2e.log:313`).
- **Echte Uploads gegen Dev:** ja. `scripts/live-uploads.mjs` mit 41 Prüfungen, u. a. „quote mit photoIds: 200 und Anfrage angelegt“ (`c-live-uploads.log:21`) und „quote mit nie hochgeladener ID: 422 photo_missing“ (`:23`) gegen die deployte Function (`live-uploads.mjs:62`), `EXIT=0` (`:46`).
- **422 gegen die deployte `quote`:** belegt für `photo_missing` (s. o.). Die übrigen 422 (`pickup_outside_vienna`, `too_late`, Adressen) sind nur für den Handler gegen die Dev-DB belegt (`c-rls.log:29`, `:31`, `:32`, `:90`).
- **409 gegen die deployte `quote`:** **kein Beleg in Teil C** → M-1. Die E2E-409-Tests (`anfrage.spec.ts:277`, `:296`, `:315`, `:333`, `:355`, `:365`, `:398`) sind gemockt (`c-e2e.log:91-118`). Die RLS-409-Tests laufen über den lokalen Handler (`tests/rls/quote.test.ts:5-6` importiert `handleQuote`, `c-rls.log:10-19`, `:50`).
- **Gelöschte oder geänderte Live-Tests seit 1630668 (aus dem Patch):**
  - `scripts/live-*.mjs`: keine Änderung (keine Datei im Patch).
  - `tests/rls/**`: keine Änderung.
  - `tests/e2e/anfrage-helpers.ts` `anonymousPrices`: `continue` → `fallback`. Damit fällt der einzige Kontakt der E2E zum Dev-Projekt weg (Tarife, `current_price_version`, `booking_terms`). Das ist gewollt (Audit N-16). Die Live-Lesbarkeit deckt die RLS-Suite ab (`c-rls.log:142` `price_config`, `:161` `booking_terms` ohne `fee_*` für anon und Kunden).
  - `tests/e2e/shell.spec.ts`: Test „Info-Sheet zeigt Tarife aus der Datenbank, ohne Gebühr“ heißt jetzt „… (Mock aus seed.sql), ohne Gebühr“. Die Gebührenprüfung bleibt, die Quelle ist jetzt der Seed. Die Prüfung des Tabs „Miete“ ist entfallen, weil der Tab entfernt wurde.
  - Gesperrt (nicht gelöscht): `scripts/redproof-s9a1..s9a4.mjs`, darunter die Live-Rohaufrufe mit 409 in `redproof-s9a4.mjs:667-673` → M-1.
  - Unit: zwei alte `draft.test.ts`-Fälle zu `readShown` bzw. `Confirmed.shown` wurden durch strengere Fälle ersetzt. In `photos.test.ts` fällt das `if (!type) return` weg (Test wird dadurch strenger, Audit N-11).

### (5) Lazy Loading ohne Wirkung auf Senden und Entwurf: erfüllt (Hinweis N-3)

- `src/lib/draft.ts` importiert der Router statisch (`router.tsx` importiert `paths, services`), damit liegt es im Einstiegs-Chunk. `uploads.ts` (Modulzustand `staged`) und `quote.ts` sind ES-Module mit genau einer Instanz je Seite, auch wenn sie in verschiedenen Chunks vorkommen. Der Staging-Stand wird also nicht verdoppelt.
- `lazyPage` (`router.tsx:30`) lädt nur das Element. `handle` bleibt statisch (Titel und Shell), der Loader `requireSession` bleibt an `auftraege`.
- Senden: Zusammenfassung, Termin und Gesendet lesen und schreiben weiterhin nur sessionStorage. Der Chunk von `gesendet` wird erst nach `finishDraft` gebraucht (`Zusammenfassung.tsx:274-275`), ein Ladefehler dort sendet nichts doppelt. Der Vorab-Abruf (`router.tsx:87-93`) hat außer `import()` keine Seiteneffekte. `purgeHandover` läuft weiter nur in `main.tsx:11`.
- E2E über alle Wege grün (`c-e2e.log:314-315`, 294 bestanden, `EXIT=0`).

### (6) flow.ts/draft.ts: erfüllt

- 92a466a: `whole()` (`src/lib/flow.ts:66`) für `crew`, `vehicles`, `fromFloor`, `toFloor`, `boxes`, `parking` und `floor` der Entrümpelung (`:160`). Das passt genau zu den Feldern, die das Preismodul mit `int()` liest (`supabase/functions/_shared/pricing/transport.ts:33-42`, `clearance.ts:26`). `hours`, `assemblyLm`, `area` und `volume` bleiben Dezimalzahlen wie im Preismodul (`dec(...)` in `transport.ts:36`, `assembly.ts:14-15`, `clearance.ts:23`; `volume` 1–100 in `quote/parse.ts:171-172`).
- Längen wie `quote`: Label 200 (`parse.ts:81`), Beschreibung 500/800 (`parse.ts:179`, `:181`), Routenlinie höchstens 50.000 Punkte (`flow.ts:71`, `:90`). Unit-Tests `flow.test.ts` und `flow-limits.test.ts` (543/543, `nachtabnahme-c-check.log:53`, `EXIT=0` `:58`).
- `draft.ts`: siehe (1) und (3). Kein Geldwert wird im Client erzeugt. `parseShown` prüft nur Form und Ganzzahligkeit; über den Preis entscheidet der Server per 409.

### (7) Hoher Fund aus docs/AUDIT_NACHT.md: offen

- Fund: **H-1**, `docs/AUDIT_NACHT.md:14`: Die Architekturquelle beschreibt geschlossene bzw. entfallene Sicherheits- und Geldpfade als gültig.
- Beleg „offen“: `docs/ARCHITECTURE.md:123` lautet weiterhin „Wer über „Für Vermieter“ Vermieter wird, liest den Gebührensatz …“. Ebenso unverändert sind `:45` (admin `S I U D` auf `platform_settings`), `:46` (Kunde `U (status)`), `:32`/`:97`/`:100` (`fee_splits`/`current_fee_rates` in `quote`). Der Patch enthält keine Doku-Datei, also keinen Beleg für eine Erledigung. Siehe Finding H-1.

### (8) Sperren s9a1–s9a4 und Shell.tsx: erfüllt

- Sperren: In allen vier Skripten steht direkt nach `import './dev-guard.mjs'` eine Zeile auf stderr und `process.exit(2)` (`scripts/redproof-s9a1.mjs:6-8`, `s9a2.mjs:9-11`, `s9a3.mjs:10-12`, `s9a4.mjs:9-11`). Die übrigen statischen Importe werden vorher ausgewertet (ESM), sind aber nur Node-Builtins und `@supabase/supabase-js` ohne Netzwirkung. Der Dev-Guard selbst fragt nichts ab, er prüft nur Variablen und Dateien (`scripts/dev-guard.mjs:14-20`). Jede `sql(...)`/`cli(...)`-Abfrage steht hinter der Sperre, auch die neue Trigger-Momentaufnahme in s9a4 (Patch 123-124) und die Arbeitsbaum-Prüfung in s9a3 (`:34-35`). Die Meldung lautet „Gesperrt bis R1 …“ ohne „ABBRUCH“ und ist damit vom Dev-Guard-Abbruch unterscheidbar. Logs: `nachtabnahme-sperre-s9a1.log:1-2` bis `-s9a4.log:1-2`, jeweils `EXIT=2`.
- `src/app/Shell.tsx`: `useIsPresent()` in der direkten Kind-Komponente von `AnimatePresence` (`:31`). Die ausblendende Seite bekommt `inert` und `aria-hidden` (`:35-36`), ist damit sofort aus Tastatur-, Zeiger- und Leserbaum, bleibt aber für die Animation im DOM. React 19 (`package.json:13`) unterstützt das boolesche `inert`. Tabs Start · Aufträge · Profil (`:9-13`) wie in `CLAUDE.md` „UI“. Der Fokus springt nach dem Seitenwechsel auf `h1` und wird nicht weggezogen, wenn der Nutzer schon fokussiert hat. Keine Sicherheits- oder Geldwirkung. E2E `c-shell-e2e.log` laut Auftrag 200 bestanden.

### Config-Commit 09205fe: unkritisch

- `playwright.config.ts:20` `baseURL` und `:29-30` `--host 127.0.0.1` passen zusammen. Die Mock-Fixture nimmt die App-Origin aus `baseURL` (`backend.ts`, Patch 1561), deshalb müssen beide gleich sein, und sie sind es.
- `tests/e2e/anmelden.spec.ts:95` `toHaveURL('/')` wird gegen `baseURL` aufgelöst und vergleicht damit die ganze URL `http://127.0.0.1:5173/`. Das ist genauso streng wie vorher und nicht mehr an `localhost` gebunden. Beleg `nachtabnahme-g-anmelden-e2e.log:37-38` (32 bestanden, `EXIT=0`).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `src/lib/quote.ts:18` | `Confirmed` ohne `shown` |
| `src/lib/quote.ts:30-31` | `shown` nur aus `readShownFull`, sonst `null` |
| `src/lib/quote.ts:58-60` | `refBody` neutralisiert Version, Hash und `shown`; Fotos sortiert |
| `src/lib/draft.ts:105` | `draftKeys` ohne `shownKey` |
| `src/lib/draft.ts:120-126` | `parseShown`: nur ganze Cent ≥ 0, nur bekannte Felder |
| `src/lib/draft.ts:192` | Übergabe mit `path` |
| `src/lib/draft.ts:207-211` | Übernahme nur bei gültigem `path` und nur dessen Schlüssel |
| `src/lib/uploads.ts:55`, `:65`, `:93` | `tried` vor dem Upload, beim Ref-Wechsel und in `discardStaging` geräumt |
| `src/lib/photos.ts:3` | `MAX_PHOTOS = 8` |
| `supabase/migrations/20261102120000_0021_photo_limits.sql:56` | Staging-Zählung `< 40` |
| `src/lib/auth.ts:98-108` | `safeNext` unverändert streng |
| `src/screens/Anmelden.tsx:172-183` | Link-Anmeldung nur per Knopf, Warnung bei bestehender Sitzung |
| `src/screens/anfrage/Zusammenfassung.tsx:231` | Wache gegen Kontowechsel beim Senden |
| `src/screens/anfrage/Zusammenfassung.tsx:249` | Live-Konto = angezeigtes Konto, sonst kein Senden |
| `src/screens/anfrage/Zusammenfassung.tsx:274` | Bestätigung mit `readShownFull` |
| `src/screens/anfrage/Zusammenfassung.tsx:304-310` | angenommener Preis gespeichert und zurückgelesen |
| `src/screens/anfrage/Zusammenfassung.tsx:428`, `:441` | Texte der 409-Dialoge wie gefordert |
| `src/screens/anfrage/Gesendet.tsx:20-21` | Vergleich Anzeige gegen Anzeige |
| `src/lib/flow.ts:66`, `:90`, `:160` | Ganzzahl-Prüfung, Punktgrenze der Route, Etage der Entrümpelung |
| `supabase/functions/_shared/pricing/transport.ts:33-42` | `int()` genau für die Felder mit `whole()` |
| `src/app/router.tsx:30`, `:87-93` | `lazyPage`, Vorab-Abruf ohne Seiteneffekt |
| `src/app/Shell.tsx:31`, `:35-36` | `useIsPresent`, `inert`, `aria-hidden` |
| `scripts/redproof-s9a1.mjs:6-8` (ebenso s9a2 `:9-11`, s9a3 `:10-12`, s9a4 `:9-11`) | Exit 2 direkt nach dem Dev-Guard |
| `scripts/dev-guard.mjs:14-20` | nur Umgebungs- und Dateiprüfung, „ABBRUCH“ nur hier |
| `scripts/live-uploads.mjs:62`, `:71-76` | deployte `quote`; 409-Schritte ohne Prüfung (M-1) |
| `scripts/redproof-s9a4.mjs:667-673` | einzige ausdrückliche 409-Live-Prüfung, gesperrt |
| `tests/rls/quote.test.ts:5-6` | RLS-Quote-Tests über den lokalen Handler |
| `playwright.config.ts:20`, `:29`, `:34` | 127.0.0.1 einheitlich, Platzhalter-Backend |
| `tests/e2e/anmelden.spec.ts:95` | `toHaveURL('/')` |
| `docs/ARCHITECTURE.md:123`, `:45`, `:46` | H-1 unverändert |
| `tmp/proof/nachtabnahme-c-build.log:44-52` | 0 Treffer, keine Mock-Bezeichner, `EXIT=0` |
| `tmp/proof/nachtabnahme-c-live-uploads.log:21`, `:23`, `:46` | 200, 422 `photo_missing`, `EXIT=0` |
| `tmp/proof/nachtabnahme-c-rls.log:183`, `:188` | 176 bestanden, `EXIT=0` |
| `tmp/proof/nachtabnahme-c-e2e.log:35`, `:91`, `:314-315` | A4c-N1, 409-Preis, 294 bestanden, `EXIT=0` |
| `tmp/proof/nachtabnahme-c-check.log:53`, `:58` | 543 bestanden, `EXIT=0` |
| `tmp/proof/nachtabnahme-sperre-s9a1.log:1-2` … `-s9a4.log:1-2` | Sperrtext ohne „ABBRUCH“, `EXIT=2` |
| `tmp/proof/nachtabnahme-g-anmelden-e2e.log:37-38` | 32 bestanden, `EXIT=0` |

Offene Findings hoch: 1
