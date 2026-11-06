# Abnahme Nacht-Merges · Runde 2 von 2 (Berater, Geld/Sicherheit/Schema)

- **Datum:** 2026-11-06
- **Branch/Stand:** `nachtabnahme`, HEAD laut Auftrag 2bc7ab7. Git selbst nicht ausgeführt, keine Läufe. Grundlage sind die Patches und die aktuellen Dateien.
- **Umfang:**
  - `tmp/proof/nachtabnahme-abnahme-r2.patch` (61 Dateien). Abgleich der Dateiliste mit Runde 1 (60 Dateien): neu ist nur `playwright.config.ts`, `vite.config.ts` ist nicht im Diff.
  - Gelesen: Abschnitte `package.json`, `playwright.config.ts`, `src/app/router.tsx`, `tests/e2e/anmelden.spec.ts`, `backend.spec.ts`, `backend.ts`, `shell.spec.ts`, `smoke.spec.ts`, `tests/shots/shots.spec.ts`.
  - `tmp/proof/nachtabnahme-abnahme-r2-docs.patch` vollständig (`docs/ARCHITECTURE.md`, `docs/AUDIT_NACHT.md`, `docs/OPEN_ISSUES.md`).
  - Aktuell und vollständig gelesen: `docs/ARCHITECTURE.md`, `playwright.config.ts`, `src/main.tsx`, `src/app/router.tsx`. Ausschnitte: `src/screens/Seiten.tsx` (53–82), `src/screens/Start.tsx` (40–69), `index.html` (`#root`), `tests/e2e/anmelden.spec.ts` (86–97).
  - Migrationen (nur lesend): `0016` vollständig, `0022` vollständig, `0017` (gegrept, 100–144 gelesen), `0018` (1–12, 118–135, 325–374, gegrept). Zur Restsuche zusätzlich `0001` (260–409) und `0015` (255–289), weil die verbliebenen Fehlzeilen der Matrix dort ihren Endzustand haben. `tests/rls/quote.test.ts` gegrept.
  - Logs: `nachtabnahme-e2e-nach-09205fe.log`, `nachtabnahme-d-shots-all-3.log`.
- **Hinweis Werkzeug:** In der Tool-Liste stand wieder ein eingebautes, parameterloses `advisor`-Tool. Nach `CLAUDE.md` und Auftrag wurde es nicht benutzt.

## Ergebnis in einem Satz

H-1 ist im Kern erledigt: Selbst-Upgrade, Schreibrechte auf `platform_settings`, Kunden-UPDATE auf den Status und die Gebühr in `quote` beschreibt die Architektur jetzt wie den Endzustand nach 0022. Einige Zeilen derselben Fehlerklasse bleiben aber stehen (Admin-Schreibrechte auf Tarife, Admin-`U (status)` auf `rental_bookings`, Entscheidung 23, `payee_id` bei der Miete), und die neue Stand-Zeile erklärt die Matrix trotzdem zum Endzustand. Das ist **mittel** (M-2), nicht hoch. Im Code hat sich seit Runde 1 nur die Playwright-Konfiguration geändert, und sie schwächt keine Prüfung ab.

## Findings

### Hoch

Keine.

### Mittel

| Nr. | Datei:Zeile | Problem | Fix |
|---|---|---|---|
| M-1 (Runde 1, offen) | `scripts/live-uploads.mjs:71-76`; `scripts/redproof-s9a4.mjs:667-673` | Kein Live-Beleg für 409 `terms_changed`/`price_changed` gegen die deployte `quote`. Seit Runde 1 hat sich unter `scripts/` nichts geändert. | Wie in Runde 1 und `OPEN_ISSUES` NA-1 (Teilschritt R1, vor S9b-1). |
| M-2 (neu, Rest von H-1) | `docs/ARCHITECTURE.md:43`, `:50`, `:131`, `:104`, `:58` | **In der Architekturquelle stehen weiter Pfade, die es nicht mehr gibt, und die neue Stand-Zeile `:58` erklärt die Matrix ausdrücklich zum „Endzustand nach Migration 0022“.** (a) `:43`: admin `S I U D` auf `price_versions`/`price_config`, anon und Kunde `S` ohne Einschränkung. Endzustand: Schreib-Policies gelöscht und Rechte entzogen (`0015:264-270`). Geschrieben wird nur über `admin_*`-Funktionen mit `service_role` (`0015:255-260`). Lesen dürfen anon und Kunden nur veröffentlichte Versionen, admin mit aal2 alles (`0015:276-283`). (b) `:50`: admin `S, U (status)` auf `rental_bookings`. Endzustand: `0017:25` löscht die alte Policy, `0017:114-116` legt sie nur für den Kunden neu an (requested → withdrawn), dazu der Trigger `0017:118-132`. admin hat **kein** UPDATE. (c) `:131` Entscheidung 23 „Anfrage und Gebührenaufteilung sind atomar“: seit 0018 schreibt `quote` keine Gebühr mehr (`0018:1`, `:6`, `:133`; Test `tests/rls/quote.test.ts:175`). Das widerspricht den schon korrigierten Stellen `:32` und `:102`. (d) `:104` „`payee_id` ist der Vermieter (Demo: null)“: `quote_save_booking` schreibt seit 0018 keine Gebührenzeile und kein `payee_id` mehr (`0018:325-354`). Keiner dieser Pfade erlaubt einem Kunden oder Partner eine Hochstufung oder öffnet ihm den Gebührensatz, deshalb nicht hoch. Wer aber nach (a) oder (b) baut, gibt dem Admin-JWT direkte Schreib- bzw. Statusrechte zurück. Das widerspricht `CLAUDE.md` („Admin-Funktionen mit p_actor laufen nur über service_role“, „Kein direktes UPDATE auf Status“). | Nur Doku, per Edit, spätestens mit der Vervollständigung der Matrix vor S9b-1. (a) „anon/Kunde: S nur veröffentlichte Versionen; admin: S (aal2); Schreiben nur über die `admin_*`-Preisfunktionen (nur `service_role`, 0015)“. (b) admin-Spalte nur „S“; beim Kunden den Trigger `guard_rental_status` nennen. (c) „Anfrage und Revision atomar (0018); Gebührenaufteilung ab S9b-4 bei der Annahme“. (d) Satz streichen oder „keine Gebührenzeile; Vermieter steht in `rental_offers.provider_id`“. Bis dahin `:58` auf „Endzustand nach 0022 für die Zeilen platform_settings, service_requests, fee_splits, current_fee_rates“ eingrenzen. |
| M-3 (= `OPEN_ISSUES` NA-6, Reviewer) | `src/app/router.tsx:60`; `src/screens/Start.tsx:55-66` | `/miete` ist per URL und über die Startkarte erreichbar, Ziel ist der Platzhalter „Dieser Bereich ist noch nicht verfügbar“ (`Seiten.tsx:53-60`). Die Karte verspricht „Tageweise, von 6 bis 17 m³“ (`Start.tsx:63`), obwohl Phase 1 kein Mietangebot hat. Keine Wirkung auf Geld oder Sicherheit (siehe Prüffrage 10). Die Einstufung mittel folgt dem Produktbild. | Entscheidung Beks (wie NA-6). Wird die Karte belassen, den Umfangstext ohne konkrete Größen schreiben, solange es keine Angebote gibt. |

### Niedrig

| Nr. | Datei:Zeile | Problem | Fix |
|---|---|---|---|
| N-1 (Runde 1, offen) | `src/screens/anfrage/Zusammenfassung.tsx:229-242` | `otherAccount` setzt `busy` nicht. Unverändert. | wie Runde 1 und NA-2 |
| N-2 (Runde 1, offen) | `tests/e2e/anfrage.spec.ts:84-93` | Der A4c-N1-Test belegt nur `disabled`. Unverändert. | wie Runde 1 und NA-3 |
| N-3 (Runde 1, offen, berichtigt) | `src/app/router.tsx:85`, `:87-93`; `src/screens/Seiten.tsx:78` | Berichtigung zu Runde 1: `Fehler` **hat** schon einen Knopf „Neu laden“ (`Seiten.tsx:78`, `window.location.reload()`). Offen bleiben der nicht belegte Kommentar `router.tsx:85` („der Router lädt beim Aufruf erneut“) und das Fehlen eines automatischen Wiederholversuchs. Einzelheiten unter Prüffrage 5. | Kommentar auf das tatsächliche Verhalten ändern („Ladefehler → Fehlerseite mit ‚Neu laden‘“) oder per E2E belegen (Chunk-Anfrage einmal abbrechen, erneut navigieren). NA-4 entsprechend anpassen (siehe N-8). |
| N-4 (Runde 1, offen) | `scripts/redproof-s9a4.mjs` | Nicht idempotente Inserts werden wiederholt. Steht hinter der Sperre. Unverändert. | wie Runde 1 und NA-5 (R1) |
| N-5 (neu) | `docs/ARCHITECTURE.md:69`, `:79`, `:3`, `:38-41` | `:69` „Tab-Bar: Start · Miete · Aufträge · Profil“ und `:79` `/miete` mit Tab-Bar „ja“ widersprechen `CLAUDE.md` (UI, Phase 1) und `shell.spec.ts` (drei Tabs). Der Kopf `:3` sagt „Stand S1 … 0001, 0002“. In der admin-Spalte der Matrix fehlt der Hinweis „nur mit aal2“ (`0016:183`, `private.is_admin()`), den `CLAUDE.md` für Journal und Satz verlangt. | Nur Doku: Tab-Bar Phase 1 eintragen, Kopf auf „Stand nach 0022“ ändern, Matrix-Kopf um „admin = `private.is_admin()` (aal2)“ ergänzen. |
| N-6 (neu) | `playwright.config.ts:31` | `reuseExistingServer: true` nimmt jeden Prozess, der auf `127.0.0.1:5173` antwortet, auch einen Server aus einem anderen Arbeitsbaum oder Branch oder einen `vite preview` mit altem Build. Ein Nachweislauf könnte dann alten Code grün melden, und das Log zeigt nicht, ob der Server wiederverwendet wurde. Ein echtes Backend erreicht er trotzdem nicht (siehe Prüffrage 9). | Für Nachweisläufe die Wiederverwendung per Variable abschalten (z. B. nur ohne `CI`/Nachweis-Variable wiederverwenden) oder im Bericht vermerken, dass vor dem Lauf kein Server lief. |
| N-7 (neu) | `src/main.tsx:5-6`, `index.html:16` | Scheitert ein statischer Import des Einstiegs, bleibt `#root` leer, ohne jeden Text. Der Entwurf geht nicht verloren. Einzelheiten unter Prüffrage 5. | Optional: statischer Hinweis in `#root` (wird beim Rendern ersetzt), z. B. „MoveNow lädt … Bleibt diese Seite leer, lade neu.“ |
| N-8 (neu, Doku) | `docs/OPEN_ISSUES.md` (NA-4; Vermerk b301fa0) | Der Fix in NA-4 verlangt einen Knopf „Neu laden“ in `Fehler`, den es schon gibt (übernommener Fehler aus Runde 1). Der Vermerk zu b301fa0 sagt im selben Satz „Shots grün“ und „Shot steht aus“. | NA-4 auf „Kommentar korrigieren oder E2E“ kürzen. Im b301fa0-Vermerk „Shot steht aus“ durch „Umbruch nicht per `boundingBox()` gemessen“ ersetzen. |

## Prüffragen

### A) Schwerpunkte

**(1) angezeigt = gesendet: erfüllt (Urteil aus Runde 1).** Die Dateien `src/lib/quote.ts`, `src/lib/draft.ts`, `Zusammenfassung.tsx` und `Gesendet.tsx` sind im r2-Patch gegenüber Runde 1 unverändert, geändert hat sich nur die Doku. `buildBody` liest `shown` nur aus `readShownFull` (`quote.ts:30`). Karte, Senden und Bestätigung lesen dieselbe Quelle (`Zusammenfassung.tsx:220`, `:254`, `:274`). Die E2E sind nach 09205fe erneut grün (`nachtabnahme-e2e-nach-09205fe.log:320-322`).

**(2) Staging/Uploads: erfüllt (Urteil aus Runde 1).** `tried` wird vor dem Upload gefüllt (`uploads.ts:65`) und beim Ref-Wechsel sowie in `discardStaging` geräumt (`:55`, `:93`). Kontingent 40 auf dem Server (`0021:56`), höchstens 8 im Client (`photos.ts:3`). Unverändert.

**(3) Anmeldung/Übergabe: erfüllt (Urteil aus Runde 1).** `restoreDraft` übernimmt nur bei gültigem `path` und nur dessen Schlüssel (`draft.ts:207-211`). `safeNext` ist unverändert (`auth.ts:98-108`). Die vier Weiterleitungsziele sind nach 09205fe in beiden Projekten grün, z. B. `e2e-nach-09205fe.log:12`, `:14`, `:17`, `:177-180`.

**(4) Mock-Schicht und Live-Prüfungen: teilweise, M-1 offen.** Die Mock-Schicht steckt nicht im Build (Runde 1, `c-build.log:44-52`). Die Sperre für fremde Hosts arbeitet mit der Origin aus `baseURL` (Patch 1579-1587, 1603-1606). Für 409 gegen die deployte `quote` gibt es weiter keinen Beleg (M-1 = NA-1).

**(5) Lazy Loading: erfüllt für Geld und Entwurf; Ladefehler nur teilweise behandelt, niedrig (N-3, N-7).**
- **Was es gibt:**
  - Eine Fehlergrenze: Jede Lazy-Route liegt unter der Wurzel mit `errorElement: <Fehler />` (`router.tsx:56`). Ein abgelehntes `lazy` (`router.tsx:30`) landet dort.
  - Neuladen: `Fehler` erkennt den Ladefehler als „kein 404“ und zeigt „Neu laden“ (`Seiten.tsx:64`, `:74-78`). Ein volles Neuladen holt das Modul in einem neuen Dokument wieder vom Netz.
  - Der Entwurf liegt im sessionStorage. Er übersteht das Neuladen im selben Tab und auch die Fehlerseite, denn dabei wird nichts gelöscht. `purgeHandover` räumt nur die abgelaufene Übergabe (`main.tsx:11`).
  - Senden: Der Chunk `gesendet` wird erst nach `finishDraft` gebraucht (`Zusammenfassung.tsx:274-275`, Runde 1). Scheitert er, zeigt die Fehlerseite unter der neuen URL „Neu laden“, danach erscheint die Bestätigung aus dem sessionStorage. Es wird nichts doppelt gesendet.
- **Was fehlt:**
  - ein automatischer Wiederholversuch (die Fehlerseite verlangt einen Tipp);
  - eine Behandlung von `vite:preloadError`. Dass ein Hilfs-Chunk nach einem neuen Deploy nicht mehr gefunden wird, endet ebenfalls auf der Fehlerseite. Das ist korrekt, aber nicht schön.
  - Der Kommentar `router.tsx:85` ist nicht belegt. Ob ein gescheiterter Vorab-Abruf (`:89`) den späteren Aufruf im selben Dokument vergiftet, hängt von der Modul-Map des Browsers und vom Lazy-Cache des Routers ab. Schlimmstenfalls kommt bis zum Neuladen die Fehlerseite statt der Seite.
- **Einstiegs-Import außerhalb von React** (`main.tsx:5`, `import '@fontsource-variable/inter'`):
  - Im Vite-Dev-Server ist jeder Import eine eigene Anfrage. Ein Fehlschlag verhindert dann die Auswertung von `main.tsx`, und `#root` bleibt leer (`index.html:16`, beobachtet in NA-9).
  - Im Produktions-Build zieht Vite einen CSS-Import nach seinem Standardverhalten in eine eigene Stylesheet-Datei. Ein Fehlschlag dort lässt das JS weiterlaufen (nicht selbst am `dist` geprüft). Eine leere Seite bleibt möglich, wenn der Einstiegs-Chunk selbst scheitert. Das gilt für jede SPA und ist nicht durch das Lazy Loading entstanden.
  - Der Kunde verliert nichts: Nach dem Neuladen ist der Entwurf wieder da.
- **Einstufung niedrig:** keine Wirkung auf Geld, Rechte oder Daten, kein Doppel-Senden, kein Datenverlust. Der Weg zurück („Neu laden“ bzw. Neuladen durch den Browser) besteht, betroffen ist nur die Verfügbarkeit.

**(6) flow.ts/draft.ts: erfüllt (Urteil aus Runde 1).** `whole()` (`flow.ts:66`) deckt genau die `int()`-Felder des Preismoduls ab (`transport.ts:33-42`). Längen und Punktgrenze passen zu `quote`. Unverändert.

**(7) Hoher Fund aus `docs/AUDIT_NACHT.md`: im Kern erledigt, Rest mittel (M-2).** Siehe Abschnitt B.

**(8) Sperren s9a1–s9a4 und `Shell.tsx`: erfüllt (Urteil aus Runde 1).** Exit 2 direkt nach dem Dev-Guard, ohne „ABBRUCH“ (`sperre-*.log`). Tabs Start · Aufträge · Profil, nach 09205fe in beiden Projekten grün (`e2e-nach-09205fe.log:128`, `:288`). Unverändert.

**(9) Commit 09205fe: keine Prüfung abgeschwächt.**
- `playwright.config.ts:20` (`baseURL`) und `:29-30` (`--host 127.0.0.1`, `url`) zeigen auf dieselbe Origin. Die Fixture nimmt die App-Origin aus `baseURL` (`backend.ts`, Patch 1604) und bricht alles andere ab (Patch 1581-1586).
- `anmelden.spec.ts:95` `toHaveURL('/')`: Playwright löst einen String gegen `baseURL` auf und vergleicht die **ganze** URL als exakten String, also `http://127.0.0.1:5173/` mit Origin, Pfad, ohne Query und ohne Fragment. Das ist genauso streng wie die frühere feste `localhost`-URL. Eine Weiterleitung auf einen fremden Host würde zudem von der Sperre abgebrochen und ergäbe eine andere URL, also rot.
- `reuseExistingServer: true` (`:31`) mit einem von Hand gestarteten Server:
  - **Der Server antwortet auf `127.0.0.1:5173`** (z. B. `localhost` wurde zu IPv4 aufgelöst): Er wird wiederverwendet. Die Tests laufen gegen `127.0.0.1`, weil `baseURL` fest ist, und die Fixture rechnet mit derselben Origin. Einen Origin-Wechsel gibt es nicht. Der Server behält seine echten `NEXT_PUBLIC_*`-Werte (Kommentar `:33`). Die Aufrufe der App gehen dann an einen fremden Host und landen entweder in den hostunabhängigen Mocks oder werden abgebrochen und gemeldet. Ein echtes Backend wird nicht erreicht. Mögliche Folge ist ein rotes Ergebnis (anderer Auth-Speicherschlüssel, Mocks mit Platzhalter-Host), nie ein falsch grünes.
  - **Der Server lauscht nur auf `::1`** (Windows-`localhost`): `127.0.0.1:5173` antwortet nicht, Playwright startet einen eigenen Server auf `127.0.0.1` (`--strictPort`). Lässt sich der Port nicht binden, bricht der Lauf laut ab. In beiden Fällen gibt es keinen falsch grünen Lauf gegen eine fremde Origin.
  - Restpunkt N-6: Ein wiederverwendeter Server mit **altem Code** kann grün melden, ohne dass das Log es zeigt.
- Beleg: `e2e-nach-09205fe.log:6` (296 Tests), `:320-322` (2 übersprungen, 294 bestanden, `EXIT=0`).

**(10) `/miete` per direkter URL: mittel (Produkt), ohne Wirkung auf Geld und Sicherheit, kein Verstoß gegen den Wortlaut von `CLAUDE.md`.**
- `router.tsx:60` legt `miete` als Wurzelseite mit `Folgt` an. `Start.tsx:55-66` verlinkt dorthin.
- Sicherheit und Geld: Der Platzhalter lädt keine Daten und ruft keine Function auf. Es wird kein Mietpreis berechnet und nichts gesendet.
- `CLAUDE.md`, UI, „Tab-Bar: Start · Aufträge · Profil“: erfüllt, die Tab-Bar hat drei Tabs (`shell.spec.ts`, Patch 2156-2157, grün). Die Regel betrifft die Tab-Bar, nicht die Erreichbarkeit einer Route.
- „Was unter Später steht, baust du nur nach Freigabe“: Die Transportermiete steht unter „Später“ (`docs/ROADMAP.md:124`). Gebaut ist davon nichts außer dem Platzhalter. Route und Startkarte stammen aus der Zeit vor der Nacht (im Patch kam nur `title` dazu, Patch 403/407). Die Karte verlangt `DESIGN_BRIEF.md:118`.
- Spannung zu „Keine erfundenen … Verfügbarkeiten“ und „Beispieldaten aus der Design-Referenz kommen nicht in die App“: der Text „Tageweise, von 6 bis 17 m³“ (`Start.tsx:63`). Deshalb mittel (M-3 = NA-6) mit Entscheidung durch Beks, nicht hoch.

### B) H-1: Korrektur in `docs/ARCHITECTURE.md`

**Richtig korrigiert (gegen die Migrationen geprüft):**
- Entscheidung 17 (`:125`) und Rollen (`:6`): `become_rental_provider()` wurde gelöscht (`0022:4-7`). `admin_grant_role` ist für `public`, `anon`, `authenticated` und `service_role` entzogen, also nur für den Eigentümer ausführbar (`0016:179-180`), und schreibt ins Journal (`0016:174-175`).
- `platform_settings` (`:45`): Die Schreib-Policies sind gelöscht und die Rechte entzogen (`0016:215-218`). `admin_set_setting` ist nur für `service_role` ausführbar (`0016:181`). Lesen dürfen nur rental_provider und admin (`0016:188-189`).
- `service_requests` (`:46`): Die Policy ist gelöscht (`0017:20`), UPDATE ist entzogen (`0017:243`), zurückgezogen wird nur über `withdraw()`, das nur `authenticated` ausführen darf (`0017:278-279`). Lesen für admin: `0016:191-192`.
- Geldfluss 2 (`:32`), Ablauf (`:99`), Schreiben (`:102`), Entscheidung 7 (`:115`) und Entscheidung 22 (`:130`): `quote_save_*` ohne `fee_splits` (`0018:1`, `:6`), Schreibrechte für `service_role` entzogen (`0018:133`), Tabelle geleert (`0017:13`). Test: `quote.test.ts:175`, `:182-184`.
- `current_fee_rates` (`:54`): Kunde NULL, Vermieter Satz, anon kein Recht (`quote.test.ts:295-297`).

**Stellen mit demselben Fehler (Suche nach `fee_splits`, `current_fee_rates`, `become_rental_provider`, `U (status)`, `platform_settings`):**
- `become_rental_provider`: nur noch als „entfällt/entfiel“ (`:6`, `:125`). Richtig.
- `platform_settings`: `:16`, `:24`, `:34`, `:45`, `:64`. Richtig.
- `current_fee_rates`: `:54`, `:130`. Richtig.
- `fee_splits`: `:21`, `:24`, `:32`, `:51`, `:102`, `:115` richtig. **`:131` falsch** (Entscheidung 23, M-2c). `:104` `payee_id` (M-2d) gehört zur selben Fehlerklasse.
- `U (status)`: **`:50` admin falsch** (M-2b). Der Kundenteil von `:50` stimmt (`0017:114-116`).
- Ohne Suchwort, gleiche Klasse: **`:43` admin `S I U D` auf Tarife falsch** (M-2a, `0015:264-270`).

**Reicht die unvollständige Matrix, um H-1 als erledigt zu werten?** Ja, für die Einstufung hoch. H-1 war hoch, weil die Doku einen **geschlossenen Pfad als gültig** beschrieb, über den jedes Konto den Gebührensatz liest (Selbst-Upgrade) und `quote` wieder Gebühren schreibt. Diese Zeilen sind korrigiert. Die sieben fehlenden Objekte (`:58`) beschreiben keine falschen Rechte, sie fehlen nur. Der Text sagt das ausdrücklich, verweist auf 0016–0020 und nennt einen Termin (S9b-1). Wer dort baut, muss die Migrationen lesen und wird nicht in die Irre geführt. Was bleibt (M-2), betrifft nur die admin-Rolle, die niemand selbst erlangen kann (`0016:179-180`). Es öffnet weder Kunden noch Partnern einen Pfad, und `CLAUDE.md` geht bei Widerspruch vor und verbietet beide Bauweisen ausdrücklich. Deshalb mittel. Der Status „erledigt“ in `AUDIT_NACHT.md` H-1 sollte aber auf M-2 verweisen. Und weil `:58` jetzt „Endzustand nach 0022“ behauptet, muss M-2 vor S9b-1 erledigt sein, zusammen mit der Vervollständigung der Matrix.

### C) `OPEN_ISSUES` NA-1 bis NA-9 und die Vermerke „geprüft“

| NA | Abgleich |
|---|---|
| NA-1 | = M-1, mittel, R1. Stimmt. |
| NA-2 | = N-1. Stimmt. |
| NA-3 | = N-2. Stimmt. |
| NA-4 | = N-3. Der Fix-Teil „in `Fehler` ‚Neu laden‘ anbieten“ ist schon umgesetzt (`Seiten.tsx:78`); mein Fehler aus Runde 1. Anpassen (N-8). |
| NA-5 | = N-4, R1. Stimmt. |
| NA-6 | Reviewer-Fund. Ich übernehme ihn als M-3 und stimme der Einstufung mittel zu. |
| NA-7, NA-8 | Nur UI, Reviewer. Nicht mein Prüfgebiet, kein Widerspruch. |
| NA-9 | Ursache korrekt als „nicht belegt“ markiert. Ergänzung: Das Fehlerbild (leeres `#root` bei einem gescheiterten Einzelimport) gilt so nur für den Dev-Server (siehe Prüffrage 5). |

Es fehlen: **M-2** (Restzeilen der Architektur), **N-5** (Tab-Bar und Kopf in ARCHITECTURE, aal2-Hinweis), **N-6** (`reuseExistingServer` bei Nachweisläufen), **N-7** (Hinweis bei leerem `#root`). Die Einleitung des NA-Abschnitts nennt H-1 „korrigiert“, ohne den Rest M-2 zu erwähnen.

**Deckt die Beweislage die Vermerke „Nachabnahme 06.11. durch Berater und Tests geprüft“?**
- Tab „Miete“ entfernt (96f51ea, 13282fa): ja. Berater Runde 1 (8). E2E mit drei Tabs und gemessenen Breiten (Patch 2156-2162), grün in beiden Projekten (`e2e-nach-09205fe.log:128`, `:288`).
- `Confirmed.shown` (c891a92) und Plan-M-1 (fc30353): ja (1). Unit-Tests aus Runde 1 (`c-check.log:53`, `:58`).
- Längen und Punkte (4b6f80f): ja (6).
- F5 (b077005): ja (3).
- A4c-N1 (ed2fb72): ja, mit den genannten Restpunkten NA-2 und NA-3. Ehrlich vermerkt.
- A4c-N2 (2464690): ja (2).
- ee47792 („Shots grün, Bild nicht gezielt geprüft“): Der Vermerk ist ehrlich. Zusätzlich prüft der Shot-Schritt den Text „Angefragt“ per DOM (Patch 2567-2568, `shots-all-3.log:551-552` grün). Das trägt.
- b301fa0: Der Vermerk widerspricht sich („Shots grün“ und „Shot steht aus“, N-8). Belegt ist der Text mit geschützten Leerzeichen (Unit `route-text.test.ts`, Patch 3732 ff.). Nicht belegt ist der Nicht-Umbruch bei 390/430 px. Den müsste nach `CLAUDE.md` `boundingBox()` messen, ein Bild reicht nicht. Weil der Vermerk nicht „geprüft“ behauptet, ist das nur niedrig.

### D) Urteil je Finding aus Runde 1

| Finding | Urteil |
|---|---|
| H-1 | **Erledigt** für hoch: die sechs genannten Stellen sind richtig korrigiert. Der Rest derselben Klasse geht als **neu M-2** (mittel, Teilschritt vor S9b-1) weiter. |
| M-1 | **Offen**, Teilschritt R1 vor S9b-1 (NA-1). |
| N-1 | **Offen**, vor S10 (NA-2). |
| N-2 | **Offen**, vor S10 (NA-3). |
| N-3 | **Offen**, berichtigt: Der Knopf „Neu laden“ existiert. Offen sind der Kommentar bzw. der E2E-Beleg (NA-4, vor S10). |
| N-4 | **Offen**, R1 (NA-5). |

Neu: M-2, M-3 (= NA-6), N-5, N-6, N-7, N-8. Keiner davon ist hoch.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `docs/ARCHITECTURE.md:6`, `:125` | Rolle nur über `admin_grant_role`, Selbst-Upgrade entfallen: richtig |
| `docs/ARCHITECTURE.md:32`, `:99`, `:102` | keine Gebühr in `quote`: richtig |
| `docs/ARCHITECTURE.md:43` | admin `S I U D` auf Tarife: **falsch** (M-2a) |
| `docs/ARCHITECTURE.md:45` | `platform_settings` ohne Schreibrechte für Nutzer: richtig |
| `docs/ARCHITECTURE.md:46` | `service_requests` ohne UPDATE: richtig |
| `docs/ARCHITECTURE.md:50` | admin `U (status)` auf `rental_bookings`: **falsch** (M-2b) |
| `docs/ARCHITECTURE.md:51`, `:54` | `fee_splits` leer, `current_fee_rates` je Rolle: richtig |
| `docs/ARCHITECTURE.md:58` | Stand-Zeile behauptet Endzustand, nennt die fehlenden Objekte |
| `docs/ARCHITECTURE.md:69`, `:79` | Tab-Bar mit „Miete“: veraltet (N-5) |
| `docs/ARCHITECTURE.md:104` | `payee_id` bei der Miete: veraltet (M-2d) |
| `docs/ARCHITECTURE.md:115`, `:130` | Entscheidungen 7 und 22: richtig |
| `docs/ARCHITECTURE.md:131` | Entscheidung 23 „Gebührenaufteilung atomar“: **veraltet** (M-2c) |
| `supabase/migrations/…0015_versions_published.sql:264-270`, `:276-283` | Schreib-Policies und -Rechte auf Tarife weg; Lesen nur veröffentlicht bzw. admin |
| `supabase/migrations/…0016_settings_admin.sql:174-181` | `admin_grant_role` nur Eigentümer, mit Journal; `admin_set_setting` nur `service_role` |
| `supabase/migrations/…0016_settings_admin.sql:188-189`, `:215-218` | Satz lesen nur rental_provider und admin; Schreiben auf Settings entzogen |
| `supabase/migrations/…0017_status_machine.sql:20`, `:25`, `:114-116`, `:243`, `:278-279` | Kunden-UPDATE auf Anfragen weg; Miet-UPDATE nur für den Kunden; `withdraw` nur `authenticated` |
| `supabase/migrations/…0018_revisions_contacts.sql:6`, `:133`, `:325-354` | `fee_splits` ohne Schreiber; `quote_save_booking` ohne Gebühr und `payee_id` |
| `supabase/migrations/…0022_no_self_upgrade.sql:7` | `become_rental_provider` gelöscht |
| `supabase/migrations/…0001_foundation.sql:383`, `:388-396` | ursprüngliche admin-Zweige, durch 0017 ersetzt |
| `tests/rls/quote.test.ts:175`, `:182-184`, `:295-297` | keine Gebührenzeile; Kunde/anon ohne Zugriff; Satz je Rolle |
| `src/app/router.tsx:30`, `:56`, `:60`, `:85`, `:87-93` | `lazy`, Fehlergrenze an der Wurzel, `/miete`, Kommentar unbelegt, Vorab-Abruf |
| `src/screens/Seiten.tsx:53-60`, `:64`, `:78` | Platzhalter „Folgt“; Fehlerseite mit „Neu laden“ |
| `src/screens/Start.tsx:55-66` | Karte „Transporter mieten“ → `/miete`, Text mit 6 bis 17 m³ |
| `src/main.tsx:5`, `:11`, `:13` | Font-Import im Einstieg, `purgeHandover`, `createRoot` |
| `index.html:16` | `#root` leer, ohne Hinweis |
| `playwright.config.ts:20`, `:29-31`, `:34` | 127.0.0.1 einheitlich, Wiederverwendung an, Platzhalter-Backend |
| `tests/e2e/anmelden.spec.ts:90-96` | vier Angriffsziele, `toHaveURL('/')` |
| `tmp/proof/nachtabnahme-abnahme-r2.patch` 1579-1587, 1601-1606 | Origin aus `baseURL`, fremde Hosts abgebrochen, leere Liste Pflicht |
| `tmp/proof/nachtabnahme-abnahme-r2.patch` 2156-2162 | drei Tabs, Breiten gemessen |
| `tmp/proof/nachtabnahme-e2e-nach-09205fe.log:6`, `:12-17`, `:128`, `:320-322` | 296 Tests, Angriffsziele grün, Tab-Test grün, 294 bestanden, 2 übersprungen, `EXIT=0` |
| `tmp/proof/nachtabnahme-d-shots-all-3.log:551-552` | 536 bestanden, `EXIT=0` |
| `docs/ROADMAP.md:124`; `docs/DESIGN_BRIEF.md:118` | Miete unter „Später“; Startkarte im Brief verlangt |

Offene Findings hoch: 0
