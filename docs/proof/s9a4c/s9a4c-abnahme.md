# Berater: Abnahme S9a-4c

- Datum: 2026-11-03
- Stand: Branch `s9a4c`, HEAD e22c039 (laut Auftrag; Baum sauber), Dev-Projekt laut Auftrag. Ich habe keinen Datenbank- und keinen git-Zugang. Dev-Fakten stammen nur aus den Logs unter `tmp/proof/`.
- Prüfgegenstand: `tmp/proof/s9a4c-diff.patch` (git diff 0bb621c..HEAD, 21 Dateien), gegen meinen Plan `tmp/proof/s9a4c-plan.md` (AK1 bis AK7).
- Hinweis: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Laut CLAUDE.md habe ich es nicht benutzt.

## Geprüft / Nicht geprüft

**Geprüft (vollständig gelesen):**
- `tmp/proof/s9a4c-diff.patch`, alle 976 Zeilen
- `supabase/migrations/20261103120000_0022_no_self_upgrade.sql` (im Diff vollständig), `20261102120000_0021_photo_limits.sql` vollständig, `0016_settings_admin.sql:120-194`
- `src/lib/uploads.ts` vollständig, `src/lib/quote.ts:40-84`, `src/screens/anfrage/Zusammenfassung.tsx:160-339` und `:398-477`
- `scripts/redproof-s9a4.mjs:1-180` (Snapshot, `probe`, `runSql`) und die Einträge im Diff; `scripts/redproof-s9a3.mjs:36-95` und die Einträge im Diff; `scripts/dev-guard.mjs`; `scripts/scan-proof.mjs`
- Nachweise: `s9a4c-rot-sicherheit.log` (1-105), `s9a4c-rot-app.log` (gezielt), `s9a4c-explain.log`, `s9a4c-roles.log`, `s9a4c-migrations.log`, `s9a4c-rls.log`/`-check.log`/`-e2e.log`/`-live-uploads.log`/`-redproof-*.log` (per Grep auf Fehler, Summen, EXIT), `s9a4-rotbeweis.md` und `s9a3-rotbeweis.md` (Einträge isoliert, 0022, Verfügbarkeit, Summen)
- Doku: `docs/OPEN_ISSUES.md:118-133` und der neue Block `:215-221` (über den Diff), `docs/GOLIVE.md:54`, `docs/ARCHITECTURE.md:6`, `docs/S9_KONZEPT.md` (Grep auf die Funktion)
- Repo-weiter Grep auf die gelöschte Funktion, auf den Rollen-Marker und auf `profiles`/`fee_rate` in `supabase/`

**Nicht geprüft:**
- Live-Zustand von Dev über die Logs hinaus. Insbesondere: Die Kollation von `storage.objects.name` habe ich nur indirekt aus dem EXPLAIN erschlossen (Index Cond trotz `collate "C"`, also passt die Spaltenkollation).
- Den Plan der Zählung **innerhalb** der DEFINER-Funktion (als Eigentümer, generischer Plan). Das EXPLAIN in `s9a4c-explain.log` misst den Funktionsrumpf als `authenticated` (RLS-Filter sichtbar). Die Wirkung der Grenze nach 0022 ist aber im Redproof belegt (`s9a4-rotbeweis.md:287-301`).
- Die Screenshots (`tmp/playwright/...`) und die UI-Seite der E2E-Läufe. Ich habe nur Exit-Codes und Assertions gelesen.
- Den JSON-Report der RLS-Suite. Den grünen Lauf des Tests „kein Selbst-Upgrade" belege ich nur über die Summe (40 von 40 in `rls.test.ts`, `s9a4c-rls.log:8`), denn der Reporter listet ihn nicht einzeln.
- `scan:proof` und das Kopieren nach `docs/proof/s9a4c/`. Beides steht noch aus, der Ordner existiert nicht (AK7, siehe unten).
- `.claude/settings.json`, `package.json` und `scripts/db-seed-dev.mjs` (Teil 0) nur kurz gesichtet: Der Seed-Pfad importiert zuerst den Dev-Guard, und `db:push` setzt das Seed-Flag nicht mehr. Kein Befund.

## Findings

Keine hohen und keine mittleren Findings. Alle neuen Findings sind niedrig. Präfix `A4c-`.

### Hoch

keine

### Mittel

keine

### Niedrig

**A4c-N1 – `Zusammenfassung.tsx:405`, `:454`, `:220-226`: „Anderes Konto“ ist auch während des Sendens bedienbar**
- **Problem:**
  - `otherAccount` prüft `busy` nicht.
  - Ein Klick während `uploadAll` setzt den Staging-Stand zurück und löscht die schon geladenen Pfade.
  - Das laufende `send()` arbeitet mit seinem lokalen Stand weiter: Es lädt nach dem Abmelden ohne Sitzung (Fehler `denied`), oder `quote` läuft mit dem noch gültigen alten Token. Nach einer Löschung endet das in `photo_missing`; wurde schon gespeichert, verweigert die Delete-Policy das Löschen.
  - Ergebnis: Es gibt keinen Rechte- oder Geldpfad. Möglich ist aber eine Anfrage unter dem alten Konto, nachdem der Kunde schon „Anderes Konto“ gewählt hat. Außerdem holt ein spätes `navigate('/…/gesendet')` den Kunden von der Anmeldung weg.
  - `removePaths` hat keine Zeitgrenze, das Abmelden wartet also auf `remove`.
- **Fix:** Beide Knöpfe mit „Anderes Konto“ bzw. „Neu anmelden“ während `sending` deaktivieren, oder in `otherAccount` mit `if (busy.current) return` abbrechen.

**A4c-N2 – `uploads.ts:63-71`: Eine Datei, deren Upload-Antwort verloren ging, steht nicht im Staging-Stand**
- **Problem:**
  - Ein Pfad kommt erst nach Erfolg bzw. 409 in `s.paths`.
  - Fall: Der Upload landet auf dem Server, die Antwort geht aber verloren (offline/failed). Dann entfernt ein späterer Ref-Wechsel die Datei nicht, und sie zählt bis `photo_cleanup` gegen das Kontingent.
  - Das ist ein Rest von M-2 und betrifft nur die Verfügbarkeit (weiche Grenze).
- **Fix:** Den Pfad vor dem Upload in eine Menge „versucht“ aufnehmen und diese beim Ref-Wechsel bzw. in `discardStaging` mitlöschen. Das Löschen einer nicht vorhandenen Datei ist harmlos. Der Unit-Fall dazu: Upload-Fehler, danach Ref-Wechsel, `remove` enthält den Pfad.

**A4c-N3 – Snapshot der Redproofs deckt die in INNER geöffneten Objekte nicht ganz ab (`redproof-s9a4.mjs:30-48`, `redproof-s9a3.mjs:36-52`)**
- **Problem:**
  - INNER legt Policies an und gibt Rechte frei auf `platform_settings`, `service_requests`, `price_revisions`, `request_contacts` und `audit_log`.
  - Der Snapshot in s9a4 erfasst Policies nur für `request_photos`/`platform_settings`/`storage.objects`. Der Snapshot in s9a3 erfasst weder `platform_settings` noch `audit_log`, und seine Funktionsliste enthält `photo_staging_interval` nicht, obwohl s9a3 dessen EXECUTE jetzt committet umschaltet.
  - Durch die Bauart ist das abgesichert: `probe()` läuft immer zwischen `begin` und `rollback` (`redproof-s9a4.mjs:104-109`). Die gesperrte Probe belegt außerdem den Rückbau des Rechts auf `photo_staging_interval` (`s9a3-rotbeweis.md:131`, `s9a4-rotbeweis.md:363`). „Snapshot vorher = nachher“ gilt deshalb nur für die erfassten Objekte.
- **Fix:**
  - `audit_log`, `price_revisions` und `request_contacts` in die OBJECTS bzw. Policy-Liste von s9a4 aufnehmen, `photo_staging_interval` in die Funktionsliste von s9a3.
  - Oder am Ende beider Skripte eine Restprüfung: keine Policy mit Präfix `redproof_` und kein INSERT-Recht für `authenticated` auf diesen Tabellen.

**A4c-N4 – AK5 (zweiter Teil) und AK6 ohne Test**
- **Problem:**
  - Kein Test belegt, dass „Anderes Konto“ vor dem Abmelden `discardStaging` mit der alten Sitzung ruft (`Zusammenfassung.tsx:223`). `anfrage.spec.ts:196` prüft nur das Abmelden.
  - Kein Test belegt N-4: Seite während des Sendens verlassen, nach dem Erfolg ist der Fotospeicher leer (`:262`). Im Plan war der E2E optional, AK6 nennt die Wirkung aber als Kriterium.
  - Beim Lesen des Codes habe ich beides als korrekt befunden.
- **Fix:** Zwei E2E-Fälle in `fotos.spec.ts` mit gemocktem Storage:
  - Senden scheitert, dann „Anderes Konto“: `removedFiles` enthält die Pfade, vor dem Logout-Aufruf.
  - `quote` mit `delay`, währenddessen über die App zum Foto-Schritt: Nach der Antwort zeigt er „0 von 8“.

**A4c-N5 – M-2 war vor dem Code nur durch `TypeError` rot (`s9a4c-rot-app.log:39-52`)**
- **Problem:**
  - Die Unit-Fälle zum Staging-Stand scheiterten, weil die Funktion fehlte (`forgetStaging is not a function`), nicht an der Wirkung (kein `remove` vor dem neuen Upload).
  - Der E2E-Fall hält bei `fotos.spec.ts:178` (M-1, Ist-Wert: dieselbe Ref). Die Assertion zum Entfernen (`:181`) lief im Rot-Zustand nie.
  - M-2 ist keine Sperre im Sinne der Rot-Beweis-Regel, sondern ein App-Fehler (Verfügbarkeit). Darum ist das niedrig.
- **Fix:** Optional, bei der nächsten Berührung von `uploads.ts`: den Unit-Fall „Ref-Wechsel“ einmal gegen die alte Logik laufen lassen (Stub mit dem Export der alten Signatur), damit der Ist-Wert „kein remove“ im Log steht.

**A4c-N6 – `docs/GOLIVE.md:54` (Punkt 23): Die Alternative löst N-12 nicht, und die Prüfung greift zu kurz**
- **Problem:**
  - Die Alternative „serverseitiger Abgleich des Fotosatzes im idempotenten Zweig von `quote_save_request`“ greift nur bei **derselben** Ref (Server-Seite von M-1). N-12 entsteht aber mit einer **neuen** Ref, also ohne idempotenten Zweig.
  - Außerdem merkt sich `refFor` nur den letzten Versuch je Pfad (`quote.ts:63-78`). Zwischen verlorener Antwort und erneutem Senden können mehrere Ref-Wechsel liegen, dann reicht „vorherige Ref“ nicht.
- **Fix:** Punkt 23 umformulieren:
  - Die App merkt sich je Pfad alle seit dem letzten bestätigten Erfolg gesendeten, unbestätigten Refs (sessionStorage).
  - Vor dem Senden mit neuer Ref prüft sie, ob es zu einer davon schon eine eigene Anfrage gibt (`service_requests.client_ref`, RLS „nur eigene“).
  - Die Server-Alternative streichen oder als „zusätzlich, für M-1“ kennzeichnen.

**A4c-N7 – Doku-Reste, die dem neuen Stand widersprechen**
- `docs/S9_KONZEPT.md:286`: Dort steht weiter „`become_rental_provider` entfällt (S9b)“. Plan-Schritt 8 verlangt „entfällt schon in S9a-4c (0022)“. `:159` ist nachgezogen, `:286` nicht. `:649` (Migrationsliste S9b) ebenso anpassen oder dort als „bereits in 0022“ vermerken.
- `docs/OPEN_ISSUES.md:126`: „A1-N9 (`become_rental_provider` ohne Journalzeile) → S9b“ ist gegenstandslos, die Funktion ist gelöscht.
- `docs/OPEN_ISSUES.md:131`: „`EXPLAIN` der Zählung … steht aus“. Das ist erledigt (`s9a4c-explain.log`, 0022 Abschnitt 2, `:216`).
- `docs/OPEN_ISSUES.md:132`: A-N4 steht dort weiter unter „Offen“. `:216` meldet es als erledigt.
- **Fix:** An den genannten Zeilen jeweils „erledigt in S9a-4c (siehe unten)“ ergänzen bzw. den Text anpassen (Edit, kein Skript).

**A4c-N8 – Gesperrter Wert im 0022-Eintrag ist der Startwert, keine Messung (`redproof-s9a4.mjs:544-550`)**
- **Problem:**
  - Gesperrt bricht `perform public.become_rental_provider()` mit 42883 ab, der Zähler wird nie gelesen. Die `0` ist der in `setup` gesetzte Startwert.
  - Die Messung „Kunde liest keinen Gebührenschlüssel“ im gesperrten Zustand liefert der zuständige RLS-Test (dritte Assertion, `rls.test.ts:448`, grün). Dasselbe Muster hat der `geocode_cache`-Eintrag. Beides entspricht meinem Plan. Gemeinsam ist der Beweis vollständig.
- **Fix:** Optional. Die Zählung der Gebührenschlüssel als eigene Anweisung nach dem Aufruf unter `authenticated` ausführen (zweiter DO-Block mit eigenem Exception-Handler), dann ist der gesperrte Wert gemessen.

## Antworten auf die Prüffragen

### (1) Ist 0022 korrekt, ohne Rechte-Ausweitung oder Querzugriff? Ist H-1 geschlossen?

Ja, beides.

**Abschnitt 1:**
- `drop function public.become_rental_provider()` ohne `if exists`. Das ist richtig, die Migration soll scheitern, wenn der Stand nicht stimmt.
- Keine Abhängigkeiten: Der Grep findet keine Policy, keine View und keine Funktion, die sie aufruft.
- Die App ruft sie nicht auf. `profil/vermieter` ist ein Platzhalter (`router.tsx:33`).
- Die Typen sind nachgezogen (Diff `database.types.ts`).

**Abschnitt 2:**
- Der Bereich `[uid/, uid0)` mit `collate "C"` ist für eine UUID-Zeichenkette gleichwertig mit dem alten Pattern `uid/%`. Die UUID enthält weder `_` noch `%`, und zwischen `/` und `0` liegt in C kein Zeichen.
- uid nur aus `auth.uid()`, kein Parameter. Preisgegeben wird nur eine Zahl über den eigenen Ordner. Ohne Anmeldung ist das Ergebnis 0.
- `create or replace` behält Eigentümer und Rechte. Der DEFINER-Allowlist-Test ist grün, `staging_photo_count()` nur für `authenticated`.
- EXPLAIN: Die Pattern-Form ist ein Seq Scan. Die Bereichsform ist ein Index Only Scan mit Index Cond auf `name` (`s9a4c-explain.log:100-103`).
- Die Grenze wirkt nach 0022 weiter: `403 | 40` gesperrt, `ok | 41` gelockert (`s9a4-rotbeweis.md:287-293`).

**H-1 geschlossen, kein anderer Weg zu `rental_provider`:**
- `profiles.role` ist für `authenticated` nicht schreibbar, es gibt nur Spaltenrechte auf `display_name`/`phone` (`0001:261`).
- Der Trigger `guard_role` verlangt den Marker (`0016:130-147`).
- Den Marker setzt nach 0022 nur noch `admin_grant_role`. Dessen EXECUTE ist für `public`, `anon`, `authenticated` und `service_role` entzogen (`0016:179-180`), also nur Eigentümer, mit Journal.
- `handle_new_user` legt nur `id` an (`0001:48`).
- Lesewege zum Gebührensatz: `current_fee_rates` ist `security_invoker` (`0016:69`, RLS greift), `booking_terms` hat eine feste Liste ohne `fee_*`. Die Edge Functions berühren `profiles`/`platform_settings` nicht schreibend.
- Verbliebene Aufrufer: nur `scripts/redproof-s9a1.mjs:26` (Snapshot-Namensliste, harmlos) und der Rot-Beweis in s9a4.
- Dev: 0 Nutzer, 0 Profile, 0 `rental_provider` nach dem Push (`s9a4c-roles.log:7-16`). Es gibt also kein Altkonto, das sich vorher hochgestuft hätte.

### (2) Messen die Rot-Beweise den Ist-Wert? Ist INNER nur in der Probe offen? Snapshot? M-3?

**Ist-Wert:** Ja.
- `quote_save_request` und `photo_staging_interval`: gelockert `ok | n+1`, gesperrt `42501 der Zielsperre | n`. In s9a3 sind das 2/1 (`s9a3-rotbeweis.md:119-133`), in s9a4 4/3 (`s9a4-rotbeweis.md:351-365`). Der Wert ist die Zahl der Anfragen des Kunden, gelesen als Eigentümer in derselben Transaktion.
- 0022: gelockert `ok | 2` (2 Gebührenschlüssel aus Kundensicht), gesperrt `42883 … | 0`. Der zuständige Test war gelockert rot (`s9a4-rotbeweis.md:367-373`). Zum gesperrten Wert siehe A4c-N8.

**INNER:**
- INNER steht nur im `setup` der Probe. `probe()` führt `begin; setup; …; rollback;` in einem Aufruf aus (`redproof-s9a4.mjs:104-109`, `redproof-s9a3.mjs:85-90`).
- Committet wird allein das Toggle der Zielsperre. Der Rückbau läuft im `finally` (`redproof-s9a4.mjs:157-163`).

**Snapshot:**
- In beiden Läufen sind die Definitionen vorher und nachher gleich (`s9a4c-redproof-s9a4.log:173`, `s9a4c-redproof-s9a3.log:101`). Die Erweiterung um Eigentümer, `prosecdef`, `proconfig`, `my_role`/`is_admin`/`admin_grant_role` und die gelöschte Funktion ist umgesetzt (N-6).
- Die Abdeckung der INNER-Objekte ist unvollständig, siehe A4c-N3.

**M-3:** Ja, M-3 gilt jetzt als Wirkungsbeweis.
- Je Eintrag ist genau eine Sperre umgeschaltet, die übrigen Schichten sind in der Probe neutralisiert. Gelockert entsteht eine Anfrage mit selbst gewähltem Preis (`p_total` frei), gesperrt nicht.
- `geocode_cache`: gelockert ist die eigene Testzeile sichtbar (1), gesperrt kommt 42501 und 0. Der zuständige Test war rot.

**Weitere Einträge:**
- N-1: Die Art „Verfügbarkeit“ wird getrennt gezählt (`s9a4-rotbeweis.md:297`, Summe `:456`).
- N-2: Die Zählbedingung ist in allen Insert-Lockerungen außer der eigenen erhalten (`redproof-s9a4.mjs:356`).
- N-3: entfällt durch die neuen Labels.

### (3) Sind M-1, M-2 und N-4 korrekt umgesetzt? Gibt es neue Fehlerfälle?

**M-1:** korrekt.
- `refBody` entspricht dem Plan wörtlich (`quote.ts:55-57`). Die Ref hängt an den sortierten Foto-IDs, Bestätigtes zählt nicht.
- Gesendet werden genau die angezeigten IDs (`Zusammenfassung.tsx:248-259`, dieselbe `toSend`-Liste).
- „Angezeigt = gesendet“ gilt im idempotenten Zweig, weil eine Ref genau einen Fotosatz hat.
- Belege:
  - Unit `draft.test.ts` (rot: `refBody is not a function`, grün in `s9a4c-check.log`)
  - E2E `fotos.spec.ts:158`: rot mit Ist-Wert „gleiche Ref“ (`s9a4c-rot-app.log:284-295`), grün in `s9a4c-e2e.log:62`
  - 422-Fälle auf neue Ref umgestellt und grün
- Offline-Text wie geplant (`uploads.ts:14`). Der Text für eine verlorene `quote`-Antwort (`quote.ts:233`) behauptet nicht „nicht gesendet“.

**M-2:** korrekt.
- Der Staging-Stand je Konto und Ref entspricht dem Plan.
- Beim Ref-Wechsel im selben Konto kommt zuerst `remove` der alten Pfade, dann der Upload. Bei einem Kontowechsel löscht die neue Sitzung nichts. Nach Erfolg setzt `forgetStaging` den Stand zurück. Dazu die Unit-Fälle in `uploads.test.ts`.
- Delete-Policy (`0021:60-70`): Gibt es zur alten Ref schon eine Anfrage (verlorene Antwort), wird nichts gelöscht. Übernommene Dateien sind geschützt.

**N-4:** korrekt.
- Die Mount-Ref wird im Effekt gesetzt und wieder zurückgesetzt. Das ist auch unter StrictMode richtig.
- Ist die Seite beim Erfolg schon verlassen, wird `clearPhotos` direkt gerufen (`Zusammenfassung.tsx:184-191`, `:262`). Ein Test fehlt (A4c-N4).

**Neue Fehlerfälle:**
- **Race:** `send` ist durch `busy` gegen Doppelklick geschützt. Offen ist nur „Anderes Konto“ während des Sendens (A4c-N1).
- **Ref-Wechsel nach Teilupload:** Die geladenen Pfade werden entfernt. Eine Datei mit verlorener Upload-Antwort bleibt liegen (A4c-N2).
- **`discardStaging` bei anderem Konto:** Ist der Stand von Konto A und die Sitzung schon B (Wechsel in anderem Tab), verweigert die Delete-Policy den fremden Ordner (`foldername[1] = auth.uid()`). Es entsteht kein Querzugriff, A räumt `photo_cleanup` auf. Unschädlich.
- **N-11:** Der Lösch-Wettlauf mit einer noch laufenden Übernahme ist dokumentiert (`OPEN_ISSUES.md:220`).

### (4) Stimmen Doku, OPEN_ISSUES und GOLIVE mit Code und Nachweisen überein?

Überwiegend ja, mit Ausnahmen.

**Stimmt überein:**
- `ARCHITECTURE.md:6`: Rolle nur über `admin_grant_role`, kein Selbst-Upgrade
- `S9_KONZEPT.md:159`
- OPEN_ISSUES-Block S9a-4c Teil 1 (`:216-221`): H-1, N-9, M-1, M-2, N-4, M-3, N-1/2/3/6/7/8 erledigt; N-5, N-10, N-11, N-12, N-9-Erweiterung offen
- GOLIVE 23 als Blocker
- PROGRESS: Herkunft von `s9a4c-rot-app.log` und der Nachtrag zur Rollenzählung decken sich mit den Logs.

**Abweichungen:**
- A4c-N6 (GOLIVE 23: Alternative und Umfang der Prüfung)
- A4c-N7 (`S9_KONZEPT.md:286`/`:649`, `OPEN_ISSUES.md:126`, `:131`, `:132`)
- `OPEN_ISSUES.md:216` verweist auf `docs/proof/s9a4c/s9a4c-plan.md`. Den Ordner gibt es noch nicht, er entsteht erst mit AK7.

### (5) Gibt es neue hohe Funde zu Geld oder Sicherheit?

Nein.
- **Geld:** Der Diff ändert keine Preis- und keine Gebührenlogik. `refBody` wirkt nur auf die Ref. Der gesendete Körper enthält weiterhin `priceVersion`, `termsHash` und `shown`, und der Server rechnet.
- **Gebühr:** Mit H-1 ist der letzte bekannte Leseweg eines Kunden zum Gebührensatz geschlossen. Belegt ist das durch den RLS-Test (Kunde liest `[]`) und den Rot-Beweis.
- **Keine Secrets im Diff.** Der Seed-Pfad läuft hinter dem Dev-Guard. Die Rechte-Liste in `.claude/settings.json` verschärft nur.

### Akzeptanzkriterien

| AK | Ergebnis |
|---|---|
| AK1 (H-1) | erfüllt: Rot-Log mit Ist-Wert (`rot-sicherheit.log:61`, `:80`), danach RPC-Fehler, Rolle `customer`, `[]`; Redproof `ok \| 2` / `42883 … \| 0`, Test gelockert rot |
| AK2 (N-9) | erfüllt: Liste wörtlich wie im Plan, Eigentümer und `search_path` per `expect.soft`; rot vor 0022 mit der zusätzlichen Zeile, danach grün |
| AK3 (M-3) | erfüllt: 2+2 isolierte Einträge plus `geocode_cache`, Werte wie vorab festgelegt; Snapshot gleich (mit Abdeckungslücke A4c-N3) |
| AK4 (M-1) | erfüllt (Unit, E2E, Offline-Text). Die E2E-Navigation weicht vom Planentwurf ab (über die App statt `goBack`, im Test begründet); die Assertions sind unverändert |
| AK5 (M-2) | im Code erfüllt; der Teil „`discardStaging` vor ‚Anderes Konto‘“ ist ungetestet (A4c-N4) |
| AK6 (N-4) | im Code erfüllt, ungetestet (A4c-N4) |
| AK7 | teilweise: jeder Lauf mit EXIT im Log; `scan:proof` und die Kopie nach `docs/proof/s9a4c/` stehen vor dem Commit noch aus |

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0022_no_self_upgrade.sql:7` | `drop function public.become_rental_provider()`, ok |
| `0022_no_self_upgrade.sql:12-20` | DEFINER, `search_path = ''`, Bereich mit `collate "C"`, Muster `not exists … request_photos` wörtlich erhalten, ok |
| `0021_photo_limits.sql:39` | alte Pattern-Form (Vergleich), gleichwertig zum Bereich |
| `0021_photo_limits.sql:60-70` | Delete nur im eigenen Ordner, ohne Anfrage zur Ref, ohne Zeile, ok für M-2 |
| `0016_settings_admin.sql:130-147` | Rollen-Trigger verlangt den Marker, ok |
| `0016_settings_admin.sql:166-180` | `admin_grant_role` nur Eigentümer, mit Journal, ok |
| `0016_settings_admin.sql:188-189` | Lesen von `platform_settings` nur für `rental_provider`/admin (N-10 bleibt S9b) |
| `0001_foundation.sql:260-261` | `authenticated` darf nur `display_name`/`phone` ändern, ok |
| `0001_foundation.sql:48` | neues Profil nur mit `id`, Rolle per Default, ok |
| `s9a4c-rot-sicherheit.log:55-104` | 2 rot, Ist-Wert (Aufruf erfolgreich bzw. Funktion in der Liste), EXIT=1 |
| `s9a4c-rls.log:8`, `:181`, `:186` | 40/40 in `rls.test.ts`, 176 gesamt, EXIT=0 |
| `s9a4c-check.log:45`, `:50` | 368 bestanden, EXIT=0 |
| `s9a4c-e2e.log:62`, `:116-117` | M-1-E2E ok, 102 bestanden, EXIT=0 |
| `s9a4c-explain.log:27-30` / `:100-103` | Pattern: Seq Scan mit Filter; Bereich: Index Cond auf `name` |
| `s9a4c-roles.log:11-16` | `postgres`, 0/0/0 |
| `s9a4c-migrations.log:2` | 20261103120000 lokal = remote |
| `s9a4c-push.log:9-13` | nur 0022, keine Seeds, EXIT=0 |
| `s9a4c-rot-app.log:284-295` | M-1 rot bei `fotos.spec.ts:178` mit gleicher Ref, EXIT=1 (`:313`) |
| `s9a4c-rot-app.log:28`, `:52` | Unit rot nur durch fehlende Funktion (A4c-N5) |
| `redproof-s9a4.mjs:104-109` | Probe: `begin … rollback`, Wert als Eigentümer, ok |
| `redproof-s9a4.mjs:150-172` | Toggle committet, Rückbau im `finally`, Probe erneut, ok |
| `redproof-s9a4.mjs:37-39` | Snapshot mit Eigentümer, `prosecdef`, `proconfig`, ok (N-6) |
| `redproof-s9a4.mjs:356`, `:439` | N-2-Bedingung, Art „Verfügbarkeit“, ok |
| `redproof-s9a4.mjs:485-506` | INNER nur im `setup`, Werte 4/3, ok |
| `redproof-s9a4.mjs:544-550` | 0022-Eintrag, gesperrter Wert = Startwert (A4c-N8) |
| `redproof-s9a3.mjs:45-47` | Funktionsliste ohne `photo_staging_interval` (A4c-N3) |
| `redproof-s9a3.mjs:245-256` | INNER wie Plan, `saveProbe`, ok |
| `s9a4-rotbeweis.md:351-373`, `:456` | isolierte Einträge und 0022 bestanden; 31 Sperren, 14 Schichten, 1 Verfügbarkeit, 57 |
| `s9a3-rotbeweis.md:103-133`, `:260` | `geocode_cache` 1/0, Speicherfunktion 2/1, Definitionen identisch |
| `uploads.ts:49-56` | Stand je Konto und Ref, Löschen nur im selben Konto, ok |
| `uploads.ts:63-71` | Pfad erst nach Erfolg im Stand (A4c-N2) |
| `uploads.ts:87-96` | `discardStaging`/`forgetStaging` wie Plan, ok |
| `quote.ts:55-57` | `refBody` wie Plan, ok |
| `quote.ts:63-78` | Ref merkt nur den letzten Versuch (A4c-N6) |
| `Zusammenfassung.tsx:184-191`, `:262` | Mount-Ref (N-4), ok |
| `Zusammenfassung.tsx:220-226`, `:405` | Aufräumen vor dem Abmelden ok; Knopf während des Sendens aktiv (A4c-N1) |
| `Zusammenfassung.tsx:248-259` | gleiche Liste für Ref, Upload und `photoIds`, ok |
| `rls.test.ts:444-468` | Tests wie Plan; Allowlist exakt |
| `router.tsx:33` | „Für Vermieter“ nur Platzhalter, kein RPC |
| `S9_KONZEPT.md:286` | noch „entfällt (S9b)“ (A4c-N7) |
| `OPEN_ISSUES.md:126`, `:131`, `:132` | veraltet (A4c-N7) |
| `GOLIVE.md:54` | Punkt 23 vorhanden; Alternative trägt nicht (A4c-N6) |

Offene Findings hoch: 0
