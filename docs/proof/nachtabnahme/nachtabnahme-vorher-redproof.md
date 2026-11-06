# Prüfbericht Nachtabnahme: redproof-s9a4 (Vorher-Basis) und Shell inert/aria-hidden

Datum: 2026-11-05 · Prüfer: advisor-report (Opus) · Branch `nachtabnahme`, Commit 2410e69

## Geprüfter Umfang

- `scripts/redproof-s9a4.mjs` vollständig (765 Zeilen), `src/app/Shell.tsx` vollständig (114 Zeilen), jeweils Ist-Stand HEAD.
- Den Diff `f29a551..HEAD` konnte ich ohne Bash nicht erzeugen; geprüft wurden deshalb beide Dateien vollständig. Der Vorgängerstand ist nur indirekt sichtbar: `tmp/proof/nachtabnahme-redproof-s9a4.log:56-66` zeigt einen Abbruch der alten Fassung (Transportfehler bei der Trigger-Lockerung, `apply` direkt aus `runSql`, ohne Wiederholung und ohne finally).
- Soll-Referenz: `supabase/migrations/…0020_photo_staging.sql` (Ausschnitte 27-38, 100-159), `…0021_photo_limits.sql` vollständig, `…0022_no_self_upgrade.sql` vollständig.
- Dev-Ist: `tmp/proof/nachtabnahme-devcheck.log`, `tmp/proof/nachtabnahme-funcbodies-vergleich.log`.
- Für (c) zusätzlich `src/screens/anfrage/Zusammenfassung.tsx:206-207, 236-295` (Senden, onBlur) und die Fundstellen der Speicherung in `src/lib/draft.ts` (per Suche).
- Hinweis: In meiner Tool-Liste steht ein eingebautes `advisor`-Werkzeug ohne Parameter. Ich habe es nach CLAUDE.md nicht benutzt.

## Findings

### Hoch

**H-1 `scripts/redproof-s9a4.mjs:709-717, 588, 742, 758` – Die Vorher-Basis ist nur für Trigger abgesichert, sonst gilt der Startzustand als Basis**
- Problem: Vor dem Lauf prüft das Skript allein, ob ein Trigger den Zustand „D“ hat. Für Funktionskörper, Funktionsrechte, Tabellenrechte, Policies, den Spalten-Default und die Existenz von `become_rental_provider` gibt es keinen Vergleich mit dem Sollstand aus den Migrationen. `before` (Zeile 588) ist ein relativer Schnappschuss; Zeile 758 meldet „identisch“, wenn Nachher gleich Vorher ist, auch wenn beides gelockert ist.
- Szenario: Ein Lauf wird während des Schritts zu 0022 abgebrochen (Strg+C während des vitest-Laufs, Zeile 583; das ist der längste Schritt). Danach existiert `public.become_rental_provider()` mit EXECUTE für authenticated (Zeilen 540-556). Jeder Dev-Kunde kann sich hochstufen und den Gebührensatz lesen; 0022:7 ist damit aufgehoben. Der nächste Lauf mit `--only photo_expired` startet (keine Trigger aus) und nimmt die Funktion in `before` auf (sie steht in der Funktionsliste, Zeile 53). Sie bleibt auch in `after`; der Lauf meldet „Definitionen … identisch“ und „REDPROOF BESTANDEN“ und schreibt `tmp/proof/s9a4-rotbeweis-teil.md`. Der Nachweis ist dann falsch. Dasselbe gilt für eine offen gebliebene Policy-Lockerung, etwa `request_photos_select` mit der Bedingung „immer wahr“, außerhalb der `--only`-Auswahl.
- Abschwächung: Ein Volllauf scheitert in den meisten Fällen laut. Bei Funktionskörpern bricht er mit „Muster nicht gefunden“ ab, bei Policies weicht der gesperrte Wert ab, bei der Funktion aus 0022 scheitert `create function`. Rechte und Default stellt die statische Wiederherstellung der toggle-Schritte stillschweigend her, die Abweichung meldet dann der Vorher/Nachher-Vergleich. Absicht ist das nicht, und für `--only` gilt es nicht.
- Fix: Eine Soll-Datei für die SNAPSHOT-Abfrage (Zeilen 45-62) einchecken, erzeugt aus einer Datenbank, die nur aus den Migrationen gebaut ist (lokales Reset oder Branch-Projekt), nicht aus Dev. Beim Start `snapshot()` gegen die Soll-Datei prüfen; bei Abweichung ABBRUCH mit Exit 2 und Liste der abweichenden Schlüssel (nur Schlüssel `k` und Objektname, keine Körper). Am Ende `after` ebenfalls gegen die Soll-Datei prüfen, nicht nur gegen `before`. Konkret muss die Soll-Datei Folgendes festhalten:
  - die md5-Werte, ACLs, `prosecdef` und `proconfig` der Funktionen aus Zeile 52-53, inklusive der Abwesenheit von `become_rental_provider`;
  - die vier Policies;
  - die ACLs der drei Tabellen;
  - „kein Default“ für `storage_path`;
  - RLS eingeschaltet;
  - alle Trigger auf „O“.
  
  Ändert sich eine Migration, wird die Soll-Datei im selben Commit neu erzeugt. Zusätzlich sollte die Startprüfung `e !== 'O'` statt `e === 'D'` verlangen (siehe N-3).

### Mittel

**M-1 `scripts/redproof-s9a4.mjs:2, 16, 22-35, 165-183, 731-741` – Bei Signal, Kill oder Verbindungsverlust bleibt jede committete Lockerung offen; nur Trigger haben ein Netz**
- Problem: Jede `apply`-Lockerung ist ein eigener CLI-Aufruf über die Management-API und wird sofort committet (Zeile 2 sagt das ausdrücklich). Betroffen sind:
  - Funktionskörper per `create or replace` (Zeilen 128-141),
  - Rechte über `toggle` (Zeile 144),
  - Policies (Zeilen 146-154),
  - die Policy `redproof_update` (Zeile 403),
  - der Spalten-Default (Zeile 469),
  - die Funktion aus 0022 (Zeile 559),
  - Trigger (Zeile 143).

  Zwischen `apply` und `restore` ist die Lockerung für alle Verbindungen auf Dev wirksam, auch während des vitest-Laufs. Was in welchem Fall passiert:
  - Bei einer Exception greift `finally` (Zeilen 176-183); das ist korrekt.
  - SIGINT/Strg+C, das Schließen der Konsole (SIGHUP/SIGBREAK) oder `taskkill` beenden Node ohne JS-`finally`. Es gibt keinen `process.on`-Handler.
  - Bei Verbindungsverlust führt die Management-API die Abfrage serverseitig zu Ende; ein verlorene Antwort rollt nichts zurück. Schlagen danach auch die drei Wiederholungen des `restore` fehl, bleibt die Lockerung offen.
  - Das Netz in Zeilen 736-737 setzt nur Trigger zurück und entfernt `redproof_update`. Funktionskörper, Rechte, Policies, Default und die Funktion aus 0022 haben kein Netz.
  - Für die statischen Schritte (`toggle`, Trigger, Funktion aus 0022) gibt es nicht einmal eine Wiederherstellungsdatei (Zeile 170, nur bei `saved`).
- Szenario: Abbruch per Strg+C während des vitest-Laufs für „request_photos_select: jeder liest“ (Zeile 347). Die Policy bleibt offen, jeder Dev-Kunde liest fremde Fotozeilen, und nichts weist beim nächsten Start darauf hin (siehe H-1).
- Fix (zusammen mit H-1):
  - (1) Schritte ohne Test und mit reiner SQL-Probe brauchen keinen Commit. DDL ist in Postgres transaktional, also gehört die Lockerung in die Probe-Transaktion (`begin; <Lockerung>; <Probe>; rollback;`). Betroffen sind etwa die Schicht-Schritte, die Rechte-Toggles, Karenz, NULL-Pfad, die Admin-Klauseln und die EXECUTE-Schritte. Committet wird nur noch, wo vitest, die Storage-API oder PostgREST den Zustand sehen müssen.
  - (2) Vor jedem `apply` eine Offen-Markierung unter `tmp/proof/` schreiben, mit Label und **ausführbarem** Wiederherstellungs-SQL; nach erfolgreichem `restore` löschen. Beim Start: Markierung vorhanden heißt ABBRUCH, oder zuerst wiederherstellen und dann die Soll-Prüfung aus H-1 laufen lassen.
  - (3) Handler für SIGINT, SIGTERM, SIGBREAK und SIGHUP, der das offene `restore` synchron ausführt (`sql` ist synchron) und mit 130 endet.
  - (4) Im `finally`-Netz alle statischen Wiederherstellungen idempotent nachziehen: die Rechte-Revokes, `drop default`, `drop function if exists` für die Funktion aus 0022 und `drop policy if exists`.

**M-2 `scripts/redproof-s9a4.mjs:179-184, 169` – Nach einem gescheiterten restore läuft die Schleife weiter und schreibt die Lockerung als neues „Original“ fest**
- Problem: Der `catch` in Zeile 179 protokolliert den Fehler und macht weiter. Der nächste Schritt auf dasselbe Objekt liest in `save()` (Zeile 169, außerhalb des `try`) die gelockerte Definition als Ausgangszustand und stellt am Ende auf sie zurück. `request_photos_objects_delete` wird in sechs Schritten gelockert, `request_photos_objects_insert` in fünf. Die Wiederherstellungsdatei des Folgeschritts enthält dann die gelockerte Fassung, und ein späteres erfolgreiches `restore` setzt die Lockerung erneut. Die Abschlusszeile in Zeile 740 nennt nur das Label des ersten Schritts. Wer von Hand die zuletzt geschriebene Datei einspielt, stellt den gelockerten Zustand her.
- Szenario: Transportfehler (in der Nacht schon einmal aufgetreten, `nachtabnahme-redproof-s9a4.log:71-75`), dreimal hintereinander beim `restore` der Delete-Policy. Die Folgeschritte zementieren die gelockerte Delete-Policy.
- Fix: Scheitert `restore` endgültig, sofort werfen und keine weitere Lockerung beginnen. Die Ausgabe nennt Label und Pfad der zugehörigen Wiederherstellungsdatei.

**M-3 `scripts/redproof-s9a4.mjs:581-586, 187` – Der Rot-Nachweis eines Tests kann aus einer veralteten JSON-Datei stammen**
- Problem: `out` ist ein fester Pfad. Er wird vor `spawnSync` nicht gelöscht, und `r.status` wird nicht geprüft. Bricht vitest ab, bevor der Reporter schreibt (Konfigurationsfehler, dotenv, Absturz), liest Zeile 584 die Datei des vorigen Schritts oder des vorigen Laufs. Deren roter Test zählt dann als „Test rot“ (Zeile 187), obwohl der zuständige Test nie gelaufen ist. Das ist ein falscher Rot-Beweis im Sinne von CLAUDE.md: Gemessen wird nicht die Wirkung der Sperre. Außerdem hat `spawnSync` kein `timeout`. Hängt vitest, bleibt die committete Lockerung unbegrenzt offen.
- Fix: `rmSync(out, { force: true })` vor dem Start. Danach verlangen, dass die Datei neu ist, dass `ran > 0` gilt und dass jeder fehlgeschlagene `fullName` das Muster enthält; sonst ist der Schritt FEHLER. Dazu ein `timeout` (z. B. 10 min) mit anschließendem `restore`.

**M-4 `scripts/redproof-s9a4.mjs:168, 477-494` mit `0020_photo_staging.sql:110-123` – Bleibt eine photo_orphans-Lockerung offen, löscht der stündliche Aufräumlauf echte Dev-Dateien**
- Problem: Das Zeitfenster Minute 27-50 wird nur beim Start des Schritts geprüft. Bei Abbruch (M-1), bei hängendem vitest (M-3) oder bei gescheitertem `restore` (M-2) bleibt `photo_orphans` gelockert, und der Aufräumjob läuft zur Minute :23. Was er dann löscht, hängt von der Lockerung ab:
  - Bei „Ablauf nicht mehr beachtet“ (Zeile 484) liegt der Stichtag in der Zukunft. Der Job löscht dann **alle** nicht übernommenen Dateien aller Dev-Konten, darunter Fixtures laufender E2E- oder RLS-Tests.
  - Bei „übernommene Dateien nicht mehr ausgenommen“ (Zeile 478) löscht er übernommene Dateien. Ihre unveränderlichen `request_photos`-Zeilen bleiben ohne Datei zurück; laut 0020:107 wird eine solche Zeile nie mehr gelöscht.
- Fix: Wie M-1 (1)-(3). Zusätzlich während der photo_orphans-Schritte den Cron-Job pausieren und danach wieder aktivieren, oder vor dem `restore` hart abbrechen, wenn die Uhr :20 erreicht.

### Niedrig

**N-1 `scripts/redproof-s9a4.mjs:170, 747` – Die Wiederherstellungsdateien enthalten JSON, kein SQL**
Der Bericht (Zeile 747) nennt sie „Restore-SQL“ mit der Endung `.sql`, sie enthalten aber JSON: das Array der Funktionsdefinitionen bzw. ein Objekt mit `qual` und `with_check`. Von Hand ist eine Wiederherstellung damit nicht direkt ausführbar. Der Dateiname taucht außerdem in keiner Konsolenzeile auf. Fix: ausführbares SQL schreiben (`alter policy … using (…)`, Funktionsdefinitionen mit `;`) und den Pfad im Log nennen.

**N-2 `scripts/redproof-s9a4.mjs:742` – Nach einem Abbruch in `run()` folgt ein TypeError**
`outcome` ist dann `undefined`, und Zeile 742 wirft einen TypeError, der den eigentlichen Fehler überlagert. Laut ist der Abbruch trotzdem, ein Bericht entsteht nicht. Fix: `if (!outcome) process.exit(1)` nach dem `finally`.

**N-3 `scripts/redproof-s9a4.mjs:714, 718-724` – Die Startprüfung erkennt nur „D“**
„R“ (nur bei Replikation) und „A“ würden nicht erkannt; „R“ wirkt im normalen Betrieb wie ausgeschaltet. `restoreTriggers` setzt dann auf diesen Zustand zurück. Fix: Soll ist „O“ (devcheck-Log 66-118), also `e !== 'O'` als Abbruchkriterium.

**N-4 `scripts/redproof-s9a4.mjs:22-35` – Wiederholung bei Timeout, während die erste Anfrage serverseitig noch läuft**
Zwei gleichzeitige `create or replace` auf dieselbe Funktion können „tuple concurrently updated“ auslösen. Das gilt nicht als Transportfehler und landet beim `restore` als „gescheitert“ in `restoreFailed`, obwohl die erste Anfrage gegriffen hat. Folge nur ein Fehlalarm, der zusammen mit M-2 aber den Lauf stoppen sollte. Fix: Nach einem Transportfehler beim `restore` nicht blind wiederholen, sondern den Zustand lesen (md5 bzw. Policy-Text) und mit dem gespeicherten vergleichen.

**N-5 `src/app/Shell.tsx:67-95` – Fokus nach Zurück auf der Überschrift statt auf dem auslösenden Element**
Nach „Zurück“ landet der Fokus auf der Überschrift der Zielseite, nicht auf dem Element, das die verlassene Seite geöffnet hatte. Das ist keine Regression durch inert und WCAG-konform; nur zur Vollständigkeit.

## Prüffragen

**(a) Kann ein Abbruch eine Sperre auf Dev offen lassen?** Ja.
- **Was offen bleiben kann:** Jede der committeten Lockerungen: Funktionskörper (`quote_save_request`, `guard_photo_insert`, `photo_staging_interval`, `staging_photo_count`, `photo_orphans`), Rechte (INSERT/UPDATE/DELETE/TRUNCATE auf `request_photos`, EXECUTE auf drei Funktionen), Policies (`request_photos_select`, Storage SELECT/INSERT/DELETE, `redproof_update`), der Spalten-Default von `storage_path`, die Funktion aus 0022 und Trigger.
- **Wann:** bei SIGINT, Kill, Schließen der Konsole und bei Verbindungsverlust mit gescheitertem `restore`.
- **Was in begin…rollback läuft:** nur die Probe-Setups. Dazu gehören:
  - das Entfernen der Einstellung `photo_staging_hours` (Zeile 219, 265),
  - die inneren Schichten für `quote_save_request` (Zeilen 505-515),
  - das Ausschalten des Triggers in der Default-Probe (Zeile 471),
  - die `created_at`-Verschiebungen (Zeilen 239, 475, 492).

  Diese sind bei jedem Abbruch sicher. Die Einstellung kann also nicht offen bleiben.
- **Die Alt-Zeilen (Zeile 421):** laufen in einer eigenen Transaktion mit commit und sind atomar.
- **Lockerungen außerhalb einer Transaktion:** Ja, alle `apply`-Schritte (Autocommit je CLI-Aufruf), siehe M-1.
- **Netz:** Ein Netz gibt es nur für Trigger und `redproof_update`, siehe M-1, M-2 und M-4.

**(b) Ist die Vorher-Basis gegen einen gelockerten Ausgangszustand abgesichert?** Nur für ausgeschaltete Trigger. Es fehlt der Vergleich mit dem Sollstand aus den Migrationen für:
- Funktions-md5, Funktions-ACL, `prosecdef` und `proconfig` der Funktionen aus Zeile 52-53;
- die Abwesenheit von `public.become_rental_provider` (0022:7);
- den Text der Policies `request_photos_select`, `request_photos_objects_select`, `request_photos_objects_insert` (0021:46-57) und `request_photos_objects_delete` (0021:60-70) sowie das Fehlen fremder Policies auf `storage.objects` (z. B. `redproof_update`);
- die Tabellen-ACLs von `request_photos`, `service_requests` und `platform_settings` (0020:36-38);
- „kein Default“ für `storage_path` (0021:6);
- `photo_staging_interval` nur für service_role (0020:27-28);
- RLS eingeschaltet;
- Trigger exakt auf „O“.

Fix: H-1 (Soll-Datei aus migrationsgebauter DB, Prüfung am Start und am Ende) und M-1 (2) (Offen-Markierung).

**(c) Shell.tsx inert/aria-hidden: Wirkung auf Fokus, Senden und Entwurf.** Kein Befund hoch oder mittel.
- **Fokus:** inert wird im selben Commit gesetzt, in dem die neue Seite eingehängt wird (`useIsPresent`, Zeilen 31, 35-36). Der Browser nimmt einem fokussierten Element der alten Seite den Fokus; dabei feuert `blur`. Der Effekt in Zeilen 70-95 deckt beide Reihenfolgen ab: `before` ist der alte Link oder `body`, und in beiden Fällen bekommt die neue Überschrift den Fokus (Zeilen 79-84). Hat der Nutzer schon in die neue Seite fokussiert, bleibt der Fokus dort (Zeile 80). Die TabBar liegt außerhalb von `Page` (Zeile 109) und wird nie inert. Portale gibt es in `src` nicht; die fixierte Aktionsleiste liegt also in der Seite und ist während der Ausblendung korrekt gesperrt.
- **Senden:** inert sperrt nur Eingaben, keine laufenden Promises. `send` (Zusammenfassung.tsx:240-290) läuft weiter, wenn der Nutzer währenddessen die Seite verlässt; `mounted.current` (Zeile 273) behandelt diesen Fall schon. inert verhindert jetzt zusätzlich, dass ein Tipp auf die ausblendende Seite eine Aktion auslöst. Einen doppelten Versand verhindert davon unabhängig schon `busy.current` (Zeile 241).
- **Entwurf:** Der Entwurf liegt im sessionStorage (`draft.ts:48, 90, 113`; `flow.ts:187`) und wird beim Ändern geschrieben, nicht beim Verlassen. Das von inert ausgelöste `blur` ruft in der Zusammenfassung nur `leave` auf (Zeile 206): Es setzt einen Hinweis-Zustand auf der ausblendenden Seite und schreibt nichts. Fotos liegen nur im Speicher (`photos.ts:49`). Ihr Verlust beim Verlassen kommt vom Aushängen, nicht von inert. Neue Instanz je `seq` (Zeilen 57, 105): Zustand, der nur in der Komponente liegt, geht bei schneller Rückkehr verloren. Das ist beabsichtigt und keine Folge dieses Commits.
- **aria-hidden zusätzlich zu inert:** wirkt doppelt, aber ohne Schaden. Live-Regionen der ausblendenden Seite (etwa Zusammenfassung.tsx:477) werden nicht mehr angesagt; so ist es gewollt.
- **React 19:** `package.json:13` (`react` ^19.3.1). `inert` als Boolean wird korrekt gesetzt.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| scripts/redproof-s9a4.mjs:2 | Lockerung „committet, Eigentümer-SQL“, Absicht bestätigt |
| scripts/redproof-s9a4.mjs:16, 25 | Jede `sql()` ist ein eigener CLI-Aufruf `db query --linked`, also Autocommit |
| scripts/redproof-s9a4.mjs:121 | Probe in `begin; … rollback;`, bei Abbruch sicher |
| scripts/redproof-s9a4.mjs:169-183 | `save` außerhalb von `try`, `apply`/`probe`/Tests in `try`, `restore` in `finally`; ein Fehler im `restore` setzt die Schleife fort |
| scripts/redproof-s9a4.mjs:219, 265 | Entfernen der Einstellung nur im Probe-Setup (Rollback) |
| scripts/redproof-s9a4.mjs:421 | Alt-Zeilen: Trigger aus, Einfügen und Trigger an in einer Transaktion mit commit, atomar |
| scripts/redproof-s9a4.mjs:540-560 | Funktion aus 0022 wird committet angelegt und per `drop` zurückgenommen; kein Netz im `finally` |
| scripts/redproof-s9a4.mjs:582-584 | Fester Ausgabepfad, kein Löschen, kein Status-Check, kein Timeout |
| scripts/redproof-s9a4.mjs:709-717 | Startprüfung nur auf Trigger mit Zustand „D“ |
| scripts/redproof-s9a4.mjs:736-737 | Netz: Trigger und `redproof_update`, sonst nichts |
| scripts/redproof-s9a4.mjs:758 | „identisch“ gilt relativ zu `before` |
| supabase/migrations/…0021_photo_limits.sql:6 | `storage_path` ohne Default, Soll bestätigt (devcheck 17-18: „kein Default“) |
| supabase/migrations/…0022_no_self_upgrade.sql:7 | `drop function public.become_rental_provider()`, das Soll ist die Abwesenheit |
| supabase/migrations/…0020_photo_staging.sql:36-38 | request_photos: authenticated nur SELECT; service_role ohne UPDATE/DELETE/TRUNCATE; stimmt mit devcheck 10 überein |
| supabase/migrations/…0020_photo_staging.sql:110-123 | `photo_orphans`-Stichtag mit einer Stunde Karenz, Grundlage für M-4 |
| tmp/proof/nachtabnahme-devcheck.log:5-119 | Dev-Ist sauber: Trigger alle „O“, Policies und ACLs wie in den Migrationen. Eine Zeile zu `become_rental_provider` fehlt; ob die Abfrage sie überhaupt erfasst, geht aus dem Log nicht hervor |
| tmp/proof/nachtabnahme-funcbodies-vergleich.log:1-5 | „GLEICH“ für fünf Funktionen; das Log zeigt nur Längen, die Vergleichsmethode liegt außerhalb dieses Umfangs |
| tmp/proof/nachtabnahme-redproof-s9a4.log:56-75 | Alte Fassung: Transportfehler mitten im Lauf, Abbruch ohne Wiederherstellung; der Anlass für den Commit ist nachvollziehbar |
| src/app/Shell.tsx:31-36 | `useIsPresent`, inert und aria-hidden nur auf der ausblendenden Seite |
| src/app/Shell.tsx:75-84 | Die Fokusführung deckt beide Fälle ab: alter Link noch aktiv oder schon `body` |
| src/screens/anfrage/Zusammenfassung.tsx:241, 273 | Sperre gegen doppeltes Senden und Behandlung des Verlassens während des Sendens unabhängig von inert |
| package.json:13 | React 19, `inert` als Boolean unterstützt |

Offene Findings hoch: 1
