# Verbesserungsvorschläge · Code-Review MoveNow, Stand 8. November 2026

## Kontext

Dieser Bericht bewertet Code und Aufbau: Was lässt sich besser machen? Er enthält nur Vorschläge, am Code ändert er nichts.

**Grundlage:** Branch `s9d`, letzter Commit `1dc7ac1` (S9d-Zwischenstand), dazu die noch uncommitteten S9d-Dateien: Foto-Functions und die Migrationen 0036 und 0037. Die Kernlogik habe ich selbst gelesen: `quote`, `accept`, die Foto-Handler, Preis- und Gebührenmodul, Entwurfs-Speicher, Router, Zusammenfassung, Stichproben aus den Migrationen. Drei Such-Agenten haben Fakten zu Frontend, Backend und Tests/Doku gesammelt. Ihre Behauptungen habe ich stichprobenartig nachgeprüft. Vier davon waren falsch und fehlen hier: angeblicher Widerspruch 500/800 Zeichen, ungeprüfte `Terms`, `Authorization: undefined` bei fehlendem ORS-Schlüssel, nie gesetzter Marker `mv_partner_delete` (das ist Absicht, Eigentümer-SQL).

**Nicht abgedeckt:** Ich habe keine Tests ausgeführt. Nicht jede der 37 Migrationen ist Zeile für Zeile auditiert; die Geld- und Sicherheitslogik hat der `advisor` je Session bereits abgenommen. `docs/reference/` habe ich nicht bewertet.

### Umfang in Zahlen

| Bereich | Dateien | Zeilen |
|---|---|---|
| `src/` (TS/TSX/CSS) | 56 | 5.835 |
| `supabase/migrations/` | 37 | 5.250 |
| `supabase/functions/` | 42 | 4.700 (davon 1.877 generierte Typen) |
| `tests/` | 80 | 14.265 (+ 4.619 Zeilen Golden-JSON) |
| `scripts/` | 31 | 3.640 (+ 2.879 Zeilen `redproof-soll.json`) |
| `docs/` ohne `docs/reference/` | 235 | 4,4 MB, davon `docs/proof/` 205 Dateien / 3,5 MB |

211 Commits in 11 Tagen, davon 88 (42 %) nur in `docs/`.

---

## Kurzfazit

Das Fundament ist ungewöhnlich sorgfältig: RLS überall, `search_path = ''` an jeder SECURITY-DEFINER-Funktion, unveränderliche Journale per Trigger, Compare-and-Set bei Statuswechseln, Ganzzahl-Gebührenrechnung, serverseitige Neuberechnung mit Bestätigungsschleife (409). Dort würde ich wenig ändern.

Die Schwächen liegen im **Aufbau**, nicht in der Fachlogik:

1. Es gibt keine CI. Jede Prüfung läuft von Hand, die RLS-Tests nur gegen das gemeinsame Dev-Projekt.
2. Den Ist-Stand des Schemas liefert nur die Kette aus 37 Migrationen. Funktionen werden bis zu dreimal ersetzt, oft noch in derselben Session, und die Doku verweist auf Migrationszeilen.
3. Der Vertrag zwischen App und Server ist untypisiert und mehrfach abgeschrieben.
4. Die Edge Functions teilen Hilfscode über Fachmodule, ohne Import-Map, ohne Lockfile, größtenteils ohne Lint.
5. Das Backend ist der App weit voraus: Die Partner-Logik ist komplett, eine Partner-Oberfläche gibt es nicht.
6. Prozess und Nachweise erzeugen mehr Dateien als der Produktcode.

---

## Was gut ist und bleiben sollte

- **Sicherheit:** RLS auf allen 29 Tabellen, kein `using (true)` mehr, keine `p_actor`-Funktion für `authenticated`, Marker für Übergänge, aal2-Prüfung, zeitkonstanter Secret-Vergleich (`jobs/handlers.ts:165`), Limiter schließt bei Ausfall (`quote/handler.ts:134`), Logs ohne Nutzer-ID, Adresse und IP, HMAC-Schlüssel im Cache, serverseitige Neu-Kodierung der Fotos ohne Metadaten.
- **Geld:** Integer-Cent, Gebühr in Basispunkten ohne Float (`pricing/fee.ts:17-25`), Largest-Remainder für Preiszeilen (`pricing/money.ts:33-48`), Preis-Haltefenster, idempotente `clientRef`, 409 mit neuem Preis statt stiller Übernahme.
- **Testbarkeit:** Handler bekommen alle Abhängigkeiten injiziert (`QuoteDeps`, `AcceptDeps`) und laufen ohne Netz in Vitest. Property-Tests mit fast-check, Golden-Tests gegen den Prototyp, Nebenläufigkeitstests für die Annahme.
- **Preismodul:** rein, ohne Abhängigkeiten, läuft in Vite und Deno, klare `parse*`/`compute*`-Trennung, Angebotsgründe statt Magie.
- **Frontend:** Lazy Routes mit Prefetch im Leerlauf und Rücksicht auf den Datensparmodus (`router.tsx:87-93`), Fokus auf die `h1` nach Routenwechsel, natives `<dialog>` für Sheets, `MotionConfig reducedMotion="user"`, einheitliches `Loadable`-Muster.

---

## Die wichtigsten Baustellen

| # | Maßnahme | Aufwand | Nutzen |
|---|---|---|---|
| 1 | CI mit GitHub Actions: `check`, `build`, E2E (alles ohne Secrets) | klein | hoch |
| 2 | Basis der Edge Functions: `deno.json` mit Import-Map und Lock, gemeinsame Module für HTTP, Auth, Fehler und Env, `deno lint`/`deno fmt` | klein bis mittel | hoch |
| 3 | Migrationen vor dem ersten Prod-Deploy zu einer Baseline zusammenfassen, danach deklarative Schemas | mittel | hoch |
| 4 | Gemeinsames Vertragsmodul für App und Functions (Schemas, Fehlercodes, Konstanten) | mittel | hoch |
| 5 | RLS-Tests gegen einen lokalen Stack in der CI, pgTAP für reine Policy-Prüfungen | mittel | hoch |
| 6 | Nächster Schritt als dünner Partner-Durchstich in der App, bevor weitere Backend-Schichten kommen | Planung | hoch |
| 7 | Phase-2-Mietpfad aus `quote`, Schema und Preismodul entfernen | klein | mittel |
| 8 | `Zusammenfassung.tsx` und den Entwurfs-Speicher (`draft.ts`/`flow.ts`) entflechten | mittel | mittel |
| 9 | Repo entschlacken: `docs/proof`, `tmp/`, verwaiste Skripte, veraltete Doku | klein | mittel |
| 10 | `theme.css` aus `tokens.json` erzeugen, Formatierung zentralisieren, harte Farben ersetzen | klein | niedrig bis mittel |

Details folgen nach Bereichen.

---

## 1. Aufbau und Architektur

### 1.1 Das Backend läuft der App weit voraus

Migrationen 0023 bis 0037 und sechs Edge Functions (`accept`, `admin-contact`, `admin-photo`, `job-photo`, `photo-receipt`, `photo-publish`) bilden Partner-Registrierung, Verteilung, Annahme, Journal und Foto-Pipeline vollständig ab. In `src/` gibt es dafür keinen einzigen Aufruf: keine Partner-Route, kein `withdraw`, kein Auftragsdetail (ROADMAP S8b, zwei offene Punkte). Diese Logik wird nur von Tests aufgerufen.

**Warum das zählt:** Deine eigene Regel lautet „Grow the system in layers … end to end“. Ein Vertrag, den kein echter Client nutzt, offenbart seine Fehler erst, wenn die Oberfläche kommt. Dann sind schon 15 Migrationen darauf gebaut.

**Vorschlag:** Vor S9e ff. den dünnsten Partner-Durchstich bauen: Listing sehen → annehmen → Kontakt sehen, mit TOTP-Anmeldung. Dazu Auftragsdetail und Zurückziehen für Kunden. Erst danach weitere Backend-Fähigkeiten.

### 1.2 Geteilter Code ohne klare Grenze

- Das Preismodul ist sauber über den Alias `@pricing` geteilt.
- Andere geteilte Teile importiert die App über relative Pfade quer durchs Repo, z. B. `src/lib/flow.ts:3` → `../../supabase/functions/_shared/route/facts.ts`.
- `tsconfig.json:25` nimmt Server-Code (`_shared/quote`, `_shared/route`, `http.ts`) in das App-Projekt mit DOM-Typen auf. Deno-Code wird so unter Browser-Annahmen typgeprüft, `jobs/` und `photo/` dagegen gar nicht vom App-`tsc`.

**Vorschlag:** Ein Ordner für alles, was beide Seiten brauchen (`supabase/functions/_shared/contract/` mit Alias `@contract`, analog zu `@pricing`). Der restliche Function-Code gehört nicht ins App-`tsconfig`, sondern nur zu `deno check`.

### 1.3 Phase-2-Code ist live erreichbar

Die Miete ist laut ROADMAP „Später“, die Oberfläche nur ein Platzhalter (`router.tsx:60`). Trotzdem gilt:

- `quote` nimmt `service: 'rental'` von jedem angemeldeten Konto an (`quote/parse.ts:128-145`, `quote/handler.ts:348-395`).
- Dazu kommen `quote_save_booking`, `rental_offers` mit Lese-Policy für `anon`, `rental_bookings`, `pricing/rental.ts` und die Rolle `rental_provider` in Policies. `rental_provider` vergibt seit 0022 nichts mehr.
- Im Dev-Seed liegen Demo-Angebote (`seed.sql:119-138`). Damit lassen sich in Dev echte Mietanfragen anlegen; in Prod endet der Pfad mit 404.
- Der Enum-Wert `partner` in `user_role` hat keine Wirkung (`0001:18`).

**Vorschlag:** Entfernen. Phase 2 baut die Miete laut `S9_KONZEPT` 5.3 ohnehin als Partner-Kategorie neu; Git behält den alten Stand. Das spart Angriffsfläche, Tests und RLS-Zeilen in der Doku.

### 1.4 Gebührenfunktion im Kundenmodul (niedrig)

`pricing/index.ts:5` exportiert `splitFee` aus demselben Paket, das die App für die Vorschau lädt. Tree-Shaking und `scan-dist.mjs` halten die Funktion aus dem Bundle, und ohne Satz ist sie harmlos. Begrifflich ist sie aber Server-Logik. Ein eigenes `_shared/fee/` macht die Grenze sichtbar, statt sie per Build-Scan zu erzwingen.

---

## 2. Datenbank und Migrationen

### 2.1 Kein lesbarer Ist-Stand des Schemas

Wie eine Funktion heute aussieht, zeigt nur die letzte Migration, die sie ersetzt:

- `commission_book`: 0028 → 0029 → 0030
- `outbox_claim`: 0031 → 0034 → 0036
- `distribute_pending`: 0031 → 0034 → 0035
- `photo_cleanup`: 0011 → 0014 → 0020
- `photo_claim`, `photo_settle`, `job_photo_list`, `admin_photo`: 0035 → 0037, in derselben Session
- Die Storage-Policies für `request-photos` laufen über bis zu sechs Migrationen.

Dahinter steckt ein Muster: S9c und S9d enden jeweils mit einer Abnahme-Migration (`0034_s9c_abnahme`, `0037_s9d_abnahme`), die Funktionen aus den Stunden davor ersetzt. Das ist zwangsläufig, weil eine auf Dev gepushte Migration nicht mehr geändert werden darf.

`ARCHITECTURE.md` muss deshalb mit Belegen wie „0016:130-147“ arbeiten und sagt selbst „es gilt der Endzustand, nicht die Zwischenstände“. Ein Reviewer muss 37 Dateien im Kopf zusammenführen.

**Vorschlag:**
1. Vor dem ersten Prod-Deploy mit `supabase migration squash` eine Baseline erzeugen. Noch gibt es keine Prod-Daten, das ist jetzt billig.
2. Danach das Schema deklarativ führen (`supabase/schemas/*.sql`, eine Datei je Bereich) und Migrationen mit `supabase db diff` erzeugen. Jede Funktion steht dann genau einmal im Repo. Ein Abnahme-Befund ist eine Änderung an der Funktion selbst, die Migration entsteht per Diff, und die Doku verweist auf Dateien statt auf Migrationszeilen.

### 2.2 Migrationen enthalten Dev-Datenpflege

- `0017_status_machine.sql:13-16` leert `fee_splits`, `request_photos`, `rental_bookings` und `service_requests` vollständig.
- `0019:9` löscht Anfragen ohne Bezirk.
- `0036:6-7` schreibt bestehende Outbox-Zeilen um.

Auf einer leeren Prod-DB ist das folgenlos, auf jeder Umgebung mit Daten wäre es Datenverlust. Eine Baseline (2.1) wirft diese Zeilen ohnehin raus. Danach gehört Datenpflege für Dev in Skripte mit `dev-guard`, nicht in Migrationen.

### 2.3 Fehlercodes als lose Strings zwischen SQL und TypeScript

SQL meldet `raise exception 'already_taken'` (P0001, Meldung = Code). Jede Seite pflegt dazu ihre eigene Liste:

- `quote/handler.ts:152-162` (`WRITE_ERRORS`) plus Sonderfall `setting_missing` (`:255`)
- `jobs/handlers.ts:18-39` (`STATUS`, gemischt aus Annahme, Fotos und Admin)
- in der App `src/lib/quote.ts:223-238` (`rejectedText`, `errorText`)

Ein Tippfehler oder ein neuer Code fällt erst als 500 im Betrieb auf.

**Vorschlag:** Eine Liste aller Codes als `const`-Union im Vertragsmodul (4.3), dazu ein Unit-Test, der alle `raise exception '<code>'` aus den Migrationen (bzw. später `supabase/schemas/`) einsammelt und gegen diese Liste prüft. Das sind etwa 20 Zeilen Test.

### 2.4 Dieselbe Konstante an mehreren Stellen

In `0036` stehen „5 Versuche“ und „10 Minuten Lease“ je zweimal (`:17`, `:31`). Die Liste der Fehlercodes steht dreimal in SQL (`:7`, `:10`, `:52`) und ein viertes Mal in TypeScript (`jobs/handlers.ts:174-180`).

**Vorschlag:** In SQL eine Quelle, etwa eine `immutable`-Funktion oder Domain bzw. `platform_settings`. In TypeScript die Codes aus dem Vertragsmodul.

### 2.5 Wiederholte Prüfblöcke in den Übergangsfunktionen

`start_job`, `complete_job` und `job_contact` (`0032:12-15`, `:36-46`, `:65-69`) wiederholen dieselbe Folge: `uid is null` → `aal2` → `my_job_partner_id()` → Zuordnung prüfen. Ein Helfer `private.require_job_partner(p_request) returns uuid` bündelt das. Dann ändert sich eine Regel an einer Stelle statt an fünf.

### 2.6 Kleinere Punkte

- Zwei Mechanismen für „unveränderlich“: `private.append_only` (0015) und `private.immutable_row` (0017, 0030). Einer reicht.
- `seed.sql` und `seed.prod.sql` sind zu 116 Zeilen identisch. Ein Test hält sie synchron (`tests/unit/seed-prod.test.ts:40-42`). Einfacher: `sql_paths = ["./seed.prod.sql", "./seed.dev.sql"]` in `config.toml:72`. Der Dev-Seed enthält dann nur die Ergänzungen, Duplikat und Test entfallen.
- `config.toml` bildet die Auth-Einstellungen des gehosteten Projekts nicht ab (`config push` ist gesperrt). Mindestlänge 6 für Passwörter (`:183`) gilt nur lokal. Die Prod-Werte (Passwortregeln, Schutz vor geleakten Passwörtern für Admin-Konten) gehören in die Go-live-Prüfung.

---

## 3. Edge Functions

### 3.1 Gemeinsame Helfer liegen in Fachmodulen

- `HttpError` steht in `route/facts.ts` und wird von `http.ts:2`, `quote/handler.ts:17` und `photo/handlers.ts:5` importiert.
- `authed`, `body`, `preflight`, `sameSecret`, `STATUS` und `UUID` stehen in `jobs/handlers.ts` und werden von `photo/handlers.ts:6` importiert.
- `quote/handler.ts:19` holt die Limits aus `route/handler.ts`.
- `photo-cleanup/index.ts:21-26` hat ein zweites `sameSecret`.

**Vorschlag:** Eine flache Basis unter `_shared/`, aus der jede Function nur importiert:
- `http.ts`: `json`, CORS, `preflight`, Body-Grenzen, `HttpError`
- `auth.ts`: Bearer-Token lesen, `requireUser({ aal2 })`, `sameSecret`
- `errors.ts`: ein Fehlertyp und eine Abbildung Code → Status
- `env.ts`: Env-Werte lesen
- `limits.ts`: Rate-Limits

### 3.2 Zwei Fehlermodelle, drei Wege zum Token

- **Fehler:** `quote` hat einen eigenen großen `catch` (`handler.ts:246-258`) mit `HttpError`, `Conflict`, `InputError`, `TariffError` und P0001. Die S9c/S9d-Functions nutzen `DbError` mit `STATUS` und `fail()`.
- **Token:** `quote` liest es mit `/^Bearer (.+)$/` plus `JWT_FORM` (`handler.ts:210-212`), `authed()` mit `.replace(/^Bearer\s+/i, '')` (`jobs/handlers.ts:42`). `handleJobPhoto` kopiert `authed()` inline ohne aal2-Pflicht (`photo/handlers.ts:132-134`).
- **Limits:** Der Limiter-Block (try → 503, nicht erlaubt → 429) steht in `quote/handler.ts` dreimal (`:126-137`, `:173-183`, `:216-226`).

**Vorschlag:** `requireUser(req, { aal2: boolean })` und `await limit(deps, checks)` als je eine Funktion. Dazu ein Fehlertyp mit Code und optionalem Body. Das spart Code und schließt die Lücke, in der eine neue Function die Prüfung leicht anders schreibt.

### 3.3 Boilerplate in jeder `index.ts`

Laut Suche wiederholen alle zehn `index.ts` den `env()`-Helfer, `createClient<Database>(…SECRET_KEY…)` und meist das Parsen von `ALLOWED_ORIGINS` (z. B. `accept/index.ts:8-15`, `quote/index.ts:12-20`). Ein `_shared/env.ts` mit `env()`, `serviceClient()` und `allowedOrigins()` macht jede `index.ts` zu drei Zeilen.

### 3.4 Keine Import-Map, kein Lockfile

- Unter `supabase/functions/` gibt es weder `deno.json` noch `deno.lock`.
- `npm:@supabase/supabase-js@2` (`quote/index.ts:5`) zieht beim Deploy die jeweils neueste 2.x, die App nutzt `^2.118.0` aus `package-lock.json`. Die Deploys sind damit nicht reproduzierbar.
- `npm:imagescript@3.17.0` steht im Code und braucht deshalb Umleitungen in `vite.config.ts:17` und `tsconfig.json:22`.

**Vorschlag:** `supabase/functions/deno.json` mit `imports` (z. B. `"imagescript": "npm:imagescript@3.17.0"`, `"@supabase/supabase-js": "npm:@supabase/supabase-js@^2.118.0"`) und eingechecktem `deno.lock`. Die Functions importieren dann bare Specifier, und beide Umleitungen entfallen.

### 3.5 Lint, Format und Typprüfung decken die Functions nur teilweise ab

- ESLint prüft nur `src/` und `_shared/pricing/` (`eslint.config.js:12`). Rund 2.300 Zeilen handgeschriebener Function-Code sind ungelintet.
- Ein Formatter fehlt ganz (kein Prettier, Biome oder `deno fmt`). Man sieht es an Stellen wie `const normalize =(label` (`quote/handler.ts:164`).
- `check:deno` (`package.json:69`) zählt 13 Dateien einzeln auf. Jede neue Function muss man von Hand nachtragen.

**Vorschlag:** `deno lint` und `deno fmt --check` über `supabase/functions/`, `deno check supabase/functions/*/index.ts` per Glob. Für `src/` und `tests/` Prettier (oder `deno fmt` für alles, dann eine einzige Formatregel).

### 3.6 Kleinere Befunde

- `outbox-send/index.ts:22` antwortet mit 503 `mail_not_configured`, bevor das Secret geprüft ist. Unangemeldete Aufrufer erfahren so den Konfigurationsstand. Außerdem liest es `OUTBOX_SECRET` und `APP_URL` erst je Request (`:25-26`); fehlen sie, wirft der Handler einen unbehandelten Fehler, statt beim Start zu scheitern wie die anderen Functions.
- `nodemailer` läuft ohne eigene Timeouts (`outbox-send/index.ts:18`). Mit bis zu 25 Mails je Lauf (`jobs/handlers.ts:198`) kann ein langsamer SMTP-Server die Laufzeitgrenze der Function reißen. Besser: `connectionTimeout`/`socketTimeout` setzen.
- `jobs/db.ts:15-24` prüft das Token per `auth.getUser` (Netzaufruf) und dekodiert danach die Payload von Hand per `atob`, um `aal` zu lesen. Prüfenswert ist `auth.getClaims(jwt)`: Mit den neuen asymmetrischen Schlüsseln prüft es die Signatur lokal über JWKS und liefert `aal` direkt. Der Abtausch: `getUser` erkennt widerrufene Sitzungen sofort. Für Admin-Functions würde ich `getUser` behalten, für `job-photo` reichen Claims.

---

## 4. Vertrag zwischen App und Server

### 4.1 Untypisierter Body, doppelte Regeln

Die App baut den `quote`-Aufruf als `Record<string, unknown>` (`src/lib/quote.ts:9`, `:28-51`). Der Server definiert dazu einen sauberen Typ `QuoteCall` (`quote/parse.ts:43-50`). Verbunden sind die beiden nur durch Konvention und E2E-Mocks. Dieselben Regeln stehen mehrfach im Code:

| Regel | Stellen |
|---|---|
| E-Mail- und Telefon-Regex | `Zusammenfassung.tsx:162-163`, `quote/parse.ts:55-56` |
| UUID-Regex, unterschiedlich streng | `src/lib/quote.ts:139` (v1–8), `quote/parse.ts:52` (v1–8), `jobs/handlers.ts:15` (jede Version) |
| Zeitfenster | `src/lib/draft.ts:14-19`, `quote/parse.ts:25` |
| `viennaToday` | `src/lib/draft.ts:102`, `quote/time.ts` |
| Längen der Beschreibung (500/800) | `src/lib/flow.ts:70`, `:161`, `quote/parse.ts:175-181` |
| Typen `Contact`, `Place`, `Shown` | je 2–3 Fassungen in `src/lib/quote.ts`, `draft.ts`, `flow.ts`, `quote/parse.ts`, `quote/hold.ts` |
| Feldname `volume` (App) ↔ `volumeM3` (Server) | `src/lib/quote.ts:39`, `quote/parse.ts:171-179` |

### 4.2 Feldname aus dem Fehlertext gelesen

Bei 400 liest die App den betroffenen Feldnamen per Regex aus der deutschen Servermeldung, etwa `"preferredDate: Format YYYY-MM-DD erwartet"` (`src/lib/quote.ts:169-172`). Wer eine Meldung umformuliert, bricht die Fehlerführung der App, ohne dass ein Typ oder Test anschlägt.

**Vorschlag:** strukturierte Antwort `{ error: 'invalid_input', field: 'preferredDate' }`.

### 4.3 Vorschlag: ein Vertragsmodul mit Schema-Bibliothek

Ein Modul `_shared/contract/`, das App und Functions importieren:

- Schemas mit **Zod 4** für den `quote`-Aufruf, die Antworten (`QuoteResponse`, `Snapshot`, `Terms`) und die Bodies der Partner-Functions. TypeScript-Typen entstehen per `z.infer`, Validator und Typ können nicht auseinanderlaufen. In der App bei Bedarf `zod/mini` für ein kleines Bundle.
- Fehlercodes als Union (siehe 2.3) und gemeinsame Konstanten (Zeitfenster, Längen, Regex).

Das ersetzt die handgeschriebenen Prüfer, die es heute in mindestens fünf Stilen gibt: `quote/parse.ts`, `pricing/input.ts` (`rec`/`dec`/`int`/`oneOf`), die `valid*`-Funktionen in `flow.ts` und `draft.ts`, die `parse*`-Funktionen in `src/lib/quote.ts` und die `typeof`-Ketten in `jobs/handlers.ts:82`. Das Preismodul darf dafür eine Abhängigkeit bekommen; Zod läuft in Vite und Deno.

---

## 5. Frontend

### 5.1 `Zusammenfassung.tsx` (498 Zeilen)

Die innere Komponente `Inhalt` (`:166-497`) vereint vieles auf einmal:
- Einwilligung je Konto
- Kontaktformular mit Validierung und Hinweisen
- die Sende-Orchestrierung (`:240-290`) mit drei Refs (`busy`, `sentRef`, `mounted`) und sieben `useState`: Sitzungsprüfung, Body, Foto-Upload, `quote`, Fehlerzuordnung, 409-Bestätigung, Countdown
- das gesamte Rendering

Weitere Stellen:
- Zeile 320 ist eine verschachtelte Ternary-Kette über eine ganze Bildschirmbreite.
- `:486-489` kopiert das Styling des Primärbuttons auf einen `Link`.
- `summaryOf` baut Zeilen als Strings mit `' · '` (`:40-41`), die Komponente `Strecke` zerlegt sie wieder per `lastIndexOf(' · ')` (`:107`).

**Vorschlag:**
- `useSendRequest(path)` als `useReducer`-Zustandsmaschine (idle → sending → error/changed/photos), testbar als reine Funktion.
- `KontaktFormular` als eigene Komponente.
- `messageFor(status)` statt der Ternary-Kette.
- Eine `ButtonLink`-Variante.
- `summaryOf` liefert strukturierte Daten (`{ address, floor, lift }`) statt Strings.

### 5.2 `draft.ts` und `flow.ts`: ein Konzept, zwei Module

- Beide speichern Entwurfszustand im `sessionStorage`.
- `useTermin` (`draft.ts:81-99`) ist fast wörtlich `useStored` (`flow.ts:178-196`).
- Das Muster „try / JSON.parse / prüfen / catch“ steht sechsmal da (`readContact`, `readTermin`, `readShownFull`, `readSent`, `readStored`, `refFor`).
- Die Speicherschlüssel der Flows sind doppelt definiert: `services[path].flowKey` (`draft.ts:5-8`) und die Template-Strings in `flow.ts:198-204`.

**Vorschlag:** ein Modul `draftStore` mit `stored(key, schema)` und einem Hook. Die Schlüssel kommen nur aus `services`, die Prüfung aus den Schemas (4.3).

### 5.3 Zustand wird beim Rendern aus dem Speicher gelesen

`Zusammenfassung.tsx:170-171` und `:220` rufen bei jedem Render `readTermin`, `summaryOf` und `readShownFull` auf, also JSON-Parsen und Prüfung des Speichers. Der `sessionStorage` ist damit die Quelle der Wahrheit, nicht React. Das macht Abläufe wie „409 bestätigen → `rememberShown` → sofort nachlesen und vergleichen“ (`:305-310`) nötig.

**Vorschlag:** Speicher nur als Persistenz nutzen. Den Zustand einmal laden und dann im Store halten (Context oder `useSyncExternalStore`, beides ohne neue Abhängigkeit).

### 5.4 Daten laden

- `useLoad` (`src/lib/prices.ts:46-66`) lädt je Komponente neu, ohne Cache.
- Die Tarife holen Konfigurator, Wizard, Ergebnis, Montage, Preis-Sheet und Zusammenfassung jeweils selbst. Lade- und Fehlertexte stehen laut Suche fünfmal gleich da.
- `Auftraege.tsx:36-50` fragt die Datenbank direkt im Screen ab.

**Vorschlag:** Die Router-Loader nutzen, die schon im Einsatz sind (`requireSession`, `router.tsx:46`). Tarife und Bedingungen lädt ein Loader am Eltern-Route-Knoten einmal, Fehler übernimmt das `errorElement`. Erst wenn das Partner-Portal viel Server-Zustand bringt, lohnt TanStack Query.

### 5.5 Race-Condition in der Adresssuche (niedrig)

`Strecke.tsx:67-76`: Tippt man während einer laufenden Suche weiter, setzt `onChange` den Zustand auf `idle` (`:86-89`) und der Button wird wieder aktiv. Eine zweite Suche ist möglich, und die langsamere Antwort überschreibt die neuere. Der Server prüft die Adresse ohnehin neu, der Schaden bleibt also bei falschen Kandidaten in der Liste. Abhilfe: Request-Zähler oder `AbortController` wie in `useRouteCalc.ts`.

### 5.6 Styling und Tokens

- `src/theme.css` ist von Hand aus `docs/reference/design/tokens.json` übertragen. Kein Skript erzeugt oder prüft die Datei, Token-Änderungen driften also unbemerkt.
- Hinzu kommen 21 harte Farbwerte in 8 TSX-Dateien (2 davon in der Dev-Galerie), z. B. `Strecke.tsx:228-263` (9), `Konfigurator.tsx:213-215`, `Profil.tsx:62-68`, `Start.tsx:33`, `:59`. Dazu viele Pixelwerte wie `h-[54px]` oder `text-[12.5px]`.

**Vorschlag:** Ein kleines Skript `tokens.json → theme.css` (oder Tailwind `@theme` direkt aus JSON) mit Check in der CI. Die Farben in Tokens überführen.

### 5.7 Formatierung verstreut

- `toFixed(1).replace('.', ',')` steht laut Suche fünfmal da (`Konfigurator.tsx:178`, `Strecke.tsx:13`, `anfrage/format.ts:17`, `preview.ts:87-89`, `Ergebnis.tsx:128`).
- Datumsformate liegen in `format.ts`, `Termin.tsx:15` und `draft.ts:102`.
- Pluralbildung ist doppelt.

**Vorschlag:** Ein `src/lib/format.ts` nur mit `Intl.NumberFormat`/`Intl.DateTimeFormat`, analog zu `formatEuro`.

### 5.8 Ordner und Benennung

- Deutsch und Englisch sind gemischt (`Zusammenfassung`, `Auftraege` neben `draft`, `flow`, `quote`).
- `screens/Konfigurator.tsx` liegt neben dem Ordner `screens/konfigurator/`.
- `PreiseSheet.tsx` steht unter `screens/`, obwohl es eine Komponente ist.
- Hooks liegen an vier Orten.
- UI-Texte stehen in `lib/preview.ts` und `lib/quote.ts`.

**Vorschlag:** Feature-Ordner (`features/anfrage/{screens,hooks,lib,texts}`) und eine feste Sprachregel, z. B. Code englisch und UI-Texte deutsch.

### 5.9 Kleinigkeiten

- `Stepper` (`Controls.tsx:73`) nutzt nur die Dev-Galerie.
- „PWA“ heißt heute: Manifest ohne Service Worker. Das ist mit Blick auf Capacitor in Ordnung, sollte aber so in `ARCHITECTURE.md` stehen.

---

## 6. Tests

### 6.1 Keine CI

Es gibt weder `.github/` noch Git-Hooks. Ob `main` grün ist, hängt davon ab, dass jemand `check`, `test:rls` und `test:e2e` von Hand laufen ließ. Das Repo liegt schon auf GitHub (`origin`).

**Vorschlag:** GitHub Actions mit drei Jobs:
1. `check` + `build`
2. E2E (läuft schon ganz ohne Backend, siehe 6.3)
3. RLS gegen einen lokalen Stack (6.2)

Die ersten beiden brauchen keine Secrets.

### 6.2 RLS-Tests nur gegen das gemeinsame Dev-Projekt

Laut Suche gibt es etwa 205 Tests in 18 Dateien. Sie laufen sequenziell (`vite.config.ts:29`), mit 400 ms Pause (an drei Stellen definiert: `tests/support/db.ts:19`, `rls.test.ts:27`, `route.test.ts:19`), festen Sleeps bis 3 s (`uploads.test.ts:687`) und Warten auf die volle Minute (`quote.test.ts:314`). Sie teilen sich Zustand und Rate-Limits mit allem anderen auf dem Dev-Projekt und brauchen den Secret Key.

**Vorschlag:**
- In der CI `supabase start` und `supabase db reset` mit Migrationen und Seed. Die Wiener Grenzen und Bezirke brauchen dafür eine kleine Geometrie-Fixture statt des Imports.
- Reine Policy- und Grant-Prüfungen (die RLS-Matrix) als pgTAP-Tests (`supabase test db`): je Test eine Transaktion mit Rollback, Sekunden statt Minuten.
- Das Dev-Projekt bleibt für einen kurzen Rauchtest.

### 6.3 E2E nur gegen Mocks

`tests/e2e/backend.ts:66-72` blockt jeden fremden Host, die Specs mocken `quote`, `route` und Auth per `page.route`. Das macht die Tests deterministisch, gut so. Es gibt aber keinen Test, in dem App, Edge Function und Datenbank zusammen laufen. Der Vertrag aus Kapitel 4 ist also nirgends automatisch geprüft. Die `live-*.mjs`-Skripte decken das manuell ab.

**Vorschlag:** ein Rauchtest „Anfrage senden“ gegen den lokalen Stack in der CI (6.2).

### 6.4 Feste Wartezeiten und doppelte Helfer

- 11 feste Pausen (`waitForTimeout`/`setTimeout`) in E2E und Shots, davon 5 in `anfrage.spec.ts`; weitere 5 in den RLS-Tests.
- CSS-Selektoren wie `dialog[open]` oder `input[type=file][multiple]` statt Rollen.
- Doppelte Helfer: `euro`, `press`, Mock-Muster, Prüfungen auf fehlende Gebühr.

**Vorschlag:** Web-First-Assertions statt Pausen, gemeinsame Fixtures in `tests/e2e/fixtures.ts`.

### 6.5 Keine Coverage-Messung

`coverage/` steht in `.gitignore`, gemessen wird aber nicht. `quote/parse.ts`, die wichtigste Vertrauensgrenze, wird nur indirekt über die Handler-Tests geprüft. Ob dabei jeder Zweig läuft, weiß niemand.

**Vorschlag:** `vitest --coverage` (v8) in `check`, zunächst nur als Bericht.

### 6.6 Rot-Beweis-Maschinerie

Die `redproof`-Kette umfasst `redproof-lib` (625 Zeilen), `-s9a3` (417), `-s9a4` (700), `-migrations` (304), `-soll.json` (2.879) und rund 1.000 Zeilen eigene Tests. Sie deployt gelockerte Funktionen auf das gemeinsame Dev-Projekt und stellt sie danach wieder her.

Die Idee ist richtig: Ein Test zählt erst, wenn er ohne die Sperre rot wird. Die Umsetzung ist aber teuer, und sie ist riskant, weil Sperren auf einer geteilten Datenbank gelockert werden.

**Vorschlag:** Mit lokalem Stack (6.2) wird ein Rot-Beweis zu „Migration ohne Sperre in eine Wegwerf-DB, Test muss rot sein“. Das sind wenige Zeilen, ohne Restore-Logik. Die sessionsgebundenen Skripte (`-s9a3`, `-s9a4`) danach löschen.

---

## 7. Repo-Hygiene und Tooling

- **`docs/proof/`:** 3,5 MB in 205 Dateien. Darunter Playwright-Trace-Quellen (`nachtabnahme/*/src/*.ts`), SQL-Dumps mit 3.400 bis 3.700 Zeilen (`r1/r1-dev-sql-s9a3.sql`, `-s9a4.sql`), zwei `.mjs`-Skripte (`r1/r1-deploy-diag.mjs`, `r1-purge-probe.mjs`) und zwei READMEs (`s9a1/README.md`, `s9a3/README.md`). Die READMEs verstoßen gegen deine eigene Regel. Nachweise gehören als Artefakte in die CI oder auf einen eigenen Branch; im Repo genügt je Abnahme eine kurze Zusammenfassung.
- **`tmp/`:** `tmp/proof/s8b1-fixes-reviewer.md` und `s8b1-shots.md` sind trotz `.gitignore:14` versioniert. Lösung: `git rm --cached`.
- **Verwaiste Skripte:** `live-test.mjs`, `live-quote-app.mjs`, `live-uploads.mjs`, `live-r3.mjs`, `redproof-s9a3/-s9a4/-restore/-cleanup.mjs`, `storage-reset.mjs` und `s9a1-verify.mjs` nennt nur die Doku, kein `package.json`-Eintrag. Einmalskripte einer Session nach der Abnahme löschen; Git behält sie.
- **`db:push`:** `package.json:66` ruft `supabase db push --linked --yes` auf. Das Ziel ist das gerade verlinkte Projekt, bestätigt wird automatisch. Sobald es Prod gibt, sollte jedes Ziel explizit sein (`--project-ref` je Umgebung), und Prod-Pushes laufen nur über die CI.
- **`envPrefix: 'NEXT_PUBLIC_'`** (`vite.config.ts:10`) ist die Next.js-Konvention in einem Vite-Projekt. Das funktioniert, verwirrt aber jeden, der Vite kennt. Steht so in CLAUDE.md, daher nur als Hinweis.

---

## 8. Prozess und Dokumentation

### 8.1 Menge und Dichte

- `S9_KONZEPT` hat 716 Zeilen, `OPEN_ISSUES` 400, `S9b_PLAN` 355, `PROGRESS` 330, `ARCHITECTURE` 230. Einzelne Zeilen sind Absätze mit über 2.000 Zeichen und Belegen auf Migrationszeilen.
- Dazu kommen `docs/nacht/` (8 Dateien, teils Duplikate von `OPEN_ISSUES` und `AUDIT_NACHT`) und abgeschlossene Pläne (`S9a_PLAN`, `S9b_PLAN`).

**Vorschlag:**
- Was sich erzeugen lässt, erzeugen statt schreiben. Die RLS-Matrix in `ARCHITECTURE.md` (Abschnitt „RLS- und Rechte-Matrix“ samt Partner-Tabellen) wird mit pgTAP zum ausführbaren Test; der Test ist dann die Doku.
- `ARCHITECTURE.md` auf Konzepte kürzen (2–3 Seiten).
- Erledigte Pläne und Nacht-Berichte archivieren oder löschen.
- Eine einzige Liste offener Punkte führen.

### 8.2 Veraltete Aussagen (Beispiele)

- `ARCHITECTURE.md:3` nennt „Stand: Endzustand nach Migration 0022“, beschreibt aber schon S9d mit 0035 und 0036 (`:154`).
- `OPEN_ISSUES.md:8`: „`db:push` spielt `seed.sql` mit ein (`--include-seed`)“. Das Flag gibt es nicht mehr (`package.json:66`).
- `S9a_PLAN.md:72`, `:74` verweisen auf `scripts/redproof-s9a1.mjs`, die Datei existiert nicht.
- `STARTEN.md:9` spricht von 5 Subagents, es sind 6.

Je mehr Doku es gibt, desto schneller veraltet sie. Kürzen (8.1) senkt das Risiko mehr als häufigeres Nachpflegen.

### 8.3 Prozessaufwand

42 % der Commits ändern nur Doku. `docs/proof/` macht rund 80 % von `docs/` aus (ohne die Design-Referenz). Ein Teil davon kommt aus den Prozessregeln in CLAUDE.md: Rot-Beweise, Nachweisdateien je Schritt, Abnahmen, Shot-Tabellen mit Bildbeobachtungen je Zeile. Für Geld- und Sicherheitslogik ist dieser Aufwand gerechtfertigt. Für UI und Routine kostet er mehr, als er bringt.

**Vorschlag:** Den strengen Nachweis-Modus auf Sessions mit Geld-, Rechte- oder Schemaänderungen begrenzen. Alles andere prüft die CI (6.1); deren Ergebnis ist der Nachweis.

---

## 9. Reihenfolge

**A · Schnell, je höchstens ein Tag, ohne fachliches Risiko**
1. CI mit `check`, `build`, E2E (6.1)
2. `deno.json` mit Import-Map und Lock, `deno lint`/`fmt`, `check:deno` per Glob (3.4, 3.5)
3. Gemeinsame Function-Module für HTTP, Auth, Fehler, Env und Limits; Boilerplate raus (3.1–3.3)
4. Strukturierter `field` in 400-Antworten (4.2), Race in der Adresssuche (5.5), `outbox-send` erst nach der Secret-Prüfung (3.6)
5. Repo-Hygiene: `tmp/` untracken, verwaiste Skripte löschen, README und `.mjs` aus `docs/proof` entfernen, veraltete Aussagen korrigieren (7, 8.2)

**B · Vor dem Go-live**
6. Migrationen zur Baseline zusammenfassen, deklarative Schemas einführen, Dev-Datenpflege aus den Migrationen entfernen (2.1, 2.2)
7. Lokaler Supabase-Stack in der CI, pgTAP für die RLS-Matrix, Rauchtest App ↔ `quote` (6.2, 6.3)
8. Phase-2-Mietpfad entfernen (1.3)
9. Vertragsmodul mit Zod und Fehlercode-Liste samt Abgleichtest (2.3, 4.3)

**C · Laufend, mit den nächsten Features**
10. Partner-Durchstich vor weiteren Backend-Schichten (1.1)
11. `Zusammenfassung` entflechten und Entwurfs-Speicher vereinheitlichen, wenn dort ohnehin gearbeitet wird (5.1–5.3)
12. Tokens generieren, Formatierung zentralisieren, Ordnerstruktur nach Features (5.6–5.8)
13. Doku kürzen, Nachweis-Modus auf Geld und Sicherheit begrenzen (8.1, 8.3)

---

## Umsetzung und Prüfung

- Dieser Bericht ändert nichts am Code.
- Jede Maßnahme oben wäre ein eigener ROADMAP-Abschnitt und damit eine eigene Session nach deiner Freigabe. Schema- und Rechteänderungen (2.1, 2.3, 6.2) brauchen laut CLAUDE.md vorher den `advisor`.
- **Prüfung je Maßnahme:** `npm run check` und `npm run build` grün, `npm run test:rls` und `npm run test:e2e` grün. Bei 2.1 zusätzlich ein Schema-Diff: alte Kette gegen Baseline auf frischer lokaler DB, `supabase db diff` muss leer sein. Ab Maßnahme 1 übernimmt die CI diese Läufe bei jedem Push.
