# MoveNow · Architektur (Ist-Stand)

Stand: 2026-11-05, Commit `1630668` (main), Migrationen 0001–0022. Abgeleitet nur aus Code, Migrationen und Konfiguration im Repository (gelesen, nichts ausgeführt). Der Zustand der gehosteten Supabase-Projekte (Dashboard-Einstellungen, Secrets, Region) ist darin nicht sichtbar und hier als [OFFEN] markiert.

Abgrenzung: `docs/ARCHITECTURE.md` beschreibt die Planung seit S1 und `docs/S9_KONZEPT.md` den geplanten Partnerteil. Diese Datei beschreibt, **was heute gebaut ist**. Geplantes steht nur in Abschnitt 8, Abweichungen zur Planung in Abschnitt 9.

Kürzel: `M01` = `supabase/migrations/20261029141616_0001_foundation.sql` … `M22` = `…_0022_no_self_upgrade.sql` (Nummer = Migrationsnummer). `QH` = `supabase/functions/_shared/quote/handler.ts`, `RH` = `supabase/functions/_shared/route/handler.ts`.

---

## 1. Überblick

MoveNow ist eine reine Client-App (statischer Build) mit Supabase als Backend. Alles, was Vertrauen braucht (Preis, Strecke, Speichern einer Anfrage, Statuswechsel), läuft serverseitig: in Edge Functions mit dem Secret Key oder in SQL-Funktionen mit festen Rechten. Die App liest nur öffentliche Tarife und die eigenen Anfragen; in Tabellen schreibt sie nie direkt.

```
 Browser / später Capacitor-App (Vite, React, TypeScript)
   │  Publishable Key + Nutzer-JWT
   ├── PostgREST (lesen): current_price_version, price_config, service_requests (+ price_revisions), request_photos
   ├── RPC: booking_terms(), withdraw()
   ├── Storage: Bucket request-photos (eigener Staging-Ordner)
   ├── Auth: Magic Link + Code in derselben Mail
   └── Edge Functions
         ├── route  (Geocoding, Strecke)  ──► openrouteservice (HeiGIT)
         └── quote  (Preis, Anfrage)      ──► openrouteservice (HeiGIT)
                         │ Secret Key (service_role)
                         ▼
 Postgres 17 + PostGIS: Tabellen mit RLS, Trigger, SQL-Funktionen, pg_cron, pg_net, Vault
                         │ pg_cron → pg_net
                         ▼
               Edge Function photo-cleanup (räumt Storage auf)
```

## 2. Bausteine

### 2.1 App (`src/`)

- **Stack:** Vite 8, React 19, React Router 8, TypeScript, Tailwind 4, Motion, `@supabase/supabase-js` 2 (`package.json:10-38`). Schrift Inter selbst ausgeliefert über `@fontsource-variable/inter` (`src/main.tsx:5`). Kein Service Worker, kein `vite-plugin-pwa`; vorhanden ist nur das Manifest (`index.html:12`, `public/manifest.webmanifest`). Capacitor ist noch nicht eingebunden.
- **Ordner:** `src/app/` (Router, Shell mit Tab-Bar und Seitenübergängen), `src/screens/` (Seiten; Unterordner `anfrage/`, `entruempelung/`, `konfigurator/`), `src/lib/` (Logik ohne UI: `supabase.ts`, `auth.ts`, `quote.ts`, `route.ts`, `prices.ts`, `uploads.ts`, `photos.ts`, `draft.ts`, `flow.ts`, `preview.ts`, `money.ts`, `session.tsx`), `src/components/` (Bausteine), `src/assets/` (SVG), `src/dev/` (Galerie, nur im Dev-Build, `src/app/router.tsx:69-70`).
- **Routen** (`src/app/router.tsx:26-63`): `/` Start (leitet beim ersten Besuch auf `/willkommen`), `/transport`, `/umzug` (Konfigurator), `/entruempelung` und `/entruempelung/ergebnis` (Wizard), `/montage`, je Leistung `…/termin`, `…/zusammenfassung`, `…/gesendet` (ohne Tab-Bar), `/auftraege` (nur angemeldet, Loader `requireSession`), `/anmelden`, `/profil`, `/profil/preise`, `/profil/datenschutz` und `/profil/impressum` (beide Platzhalter, `src/screens/Seiten.tsx:20-49`). `/miete` und `/profil/vermieter` zeigen „Dieser Bereich ist noch nicht verfügbar“ (`src/screens/Seiten.tsx:56`).
- **Supabase-Client:** `src/lib/supabase.ts:5-10` mit `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; Vite gibt nur Variablen mit diesem Präfix an die App (`vite.config.ts:10`). `detectSessionInUrl: false`; die Sitzung speichert die Bibliothek mit ihrer Voreinstellung.
- **Preisvorschau:** Alias `@pricing` zeigt auf `supabase/functions/_shared/pricing` (`vite.config.ts:14`), also dasselbe Modul, mit dem `quote` rechnet. Tarife liest die App aus `price_config` der aktuellen Version (`src/lib/prices.ts:19-24`). Ein Gebührensatz kommt im App-Code nicht vor.
- **Lokale Speicherung:** `localStorage`: `movenow.onboarded` (ohne Ablauf), `movenow.next` (Rücksprungziel, 15 min), `movenow.handover` (Entwurf für den Mail-Link in einem neuen Tab, 15 min, beim Start bereinigt) (`src/lib/onboarding.ts:1`, `src/lib/auth.ts:18-19`, `src/lib/draft.ts:190-191`, `:223`). `sessionStorage`: Flow-Zustand, Termin, Kontakt, Sendeversuch, angezeigter Preis je Leistung (`src/lib/draft.ts:5-54`, `src/lib/quote.ts:66-73`). Keine Cookies, kein IndexedDB. Abmelden leert `sessionStorage` und die beiden Übergabe-Schlüssel (`src/lib/auth.ts:75-85`).
- **Fotos:** höchstens 8, je höchstens 10 MB, Neu-Kodierung über Canvas zu JPEG (lange Kante ≤ 2000 px, Qualität 0,88), dabei entfallen EXIF-Daten (`src/lib/photos.ts:3-5`, `:13`, `:30-43`). Upload in den Staging-Pfad `{userId}/{clientRef}/{photoId}.jpg` ohne Überschreiben (`src/lib/uploads.ts:30`, `:63`), Anzeige über signierte URLs mit 10 Minuten Laufzeit (`src/lib/uploads.ts:8-9`, `:98-109`).
- **Externe Ressourcen:** keine. Keine Analytics, kein Tracking, keine Fehlerberichte an Dritte, keine Kartenkacheln. Die OSM-Attribution steht im Konfigurator (`src/screens/Konfigurator.tsx:170`).

### 2.2 Supabase

- **Datenbank:** Postgres 17 (`supabase/config.toml:41`) mit den Extensions `postgis`, `moddatetime` (Schema `extensions`, M01:8-9), `pg_cron` (M06:92), `pg_net` (M11:58); Vault wird nur gelesen (Secrets `cleanup_secret`, `cleanup_url`, M20:125-141). Fachliche Tabellen liegen in `public`, Helfer und Trigger-Funktionen in `private` (Schema ohne Tabellen, `usage` nur für `authenticated`, M01:12-14).
- **Auth:** E-Mail-OTP mit Link und Code (Vorlagen `supabase/templates/magic_link.html` und `confirmation.html`, inhaltlich gleich: Code `{{ .Token }}` und Link `…/anmelden#token_hash=…`). Lokale Konfiguration: Code 8 Stellen (`config.toml:233`), gültig 900 s (`:235`), höchstens eine Mail je 60 s (`:231`), `jwt_expiry` 3600 s (`:166`), Registrierung an (`:177`), anonyme Anmeldung aus (`:179`), eigener SMTP aus (`:238`, auskommentiert), MFA/TOTP aus (`:304-306`), Apple aus (`:324`). Die App lässt Codes mit 6–10 Ziffern zu (`src/lib/auth.ts:15`).
- **Storage:** ein privater Bucket `request-photos`, 10 MB je Datei, nur `image/jpeg` (M01:408-409, M11:39).
- **Edge Functions** (alle mit `verify_jwt = false`, `config.toml:418-425`; jede prüft selbst):

| Function | Zweck | Zugang | Liest Secrets (Namen) |
|---|---|---|---|
| `route` | Geocoding-Kandidaten und Routenfakten (km gesamt, km außerhalb Wiens, Fahrzeit, Region) | nur `apikey` = Publishable Key, kein Nutzer nötig (RH:40) | `SUPABASE_URL`, `SECRET_KEY`, `RATE_LIMIT_SECRET`, `PUBLISHABLE_KEY`, `ALLOWED_ORIGINS`, `ORS_API_KEY` (`supabase/functions/route/index.ts:17-21`) |
| `quote` | einziger Schreibweg für Anfragen: prüft Eingaben, rechnet den Preis, speichert Anfrage, Revision, Kontakt, Fotos | Bearer-JWT, geprüft mit `auth.getUser` (QH:210-213) | `SUPABASE_URL`, `SECRET_KEY`, `RATE_LIMIT_SECRET`, `ALLOWED_ORIGINS`, `ORS_API_KEY` (`supabase/functions/quote/index.ts:18-21`) |
| `photo-cleanup` | löscht Storage-Dateien ohne Datenbankzeile | Header `x-cleanup-secret`, Vergleich in konstanter Zeit; nur von pg_cron aufgerufen | `SUPABASE_URL`, `SECRET_KEY`, `CLEANUP_SECRET` (`supabase/functions/photo-cleanup/index.ts:13-29`) |

CORS nur für Origins aus `ALLOWED_ORIGINS` (`supabase/functions/_shared/http.ts:7-15`). Logs der Functions enthalten nur Modus, Status, Dauer und Fehlercode, keine Adressen oder IPs (`supabase/functions/route/index.ts:29`, `quote/index.ts:31`).

- **Zeitgesteuerte Jobs (pg_cron):** `route-cleanup` stündlich Minute 17 (abgelaufene `route_cache`-Zeilen, Zähler älter als 2 Tage; M09:3-16), `geocode-cleanup` stündlich Minute 23 (M19:27), `photo-cleanup` stündlich Minute 23 (ruft per `pg_net` die gleichnamige Function; scheitert sichtbar, wenn Vault-Secrets oder `photo_staging_hours` fehlen; M11:82, M20:125-141).

### 2.3 Externe Dienste

- **openrouteservice über HeiGIT:** Directions `https://api.heigit.org/openrouteservice`, Geocoding `https://api.heigit.org/pelias/v1`, Timeout 8 s, hinter einem Adapter (`supabase/functions/_shared/route/provider.ts:22-26`). Es gehen nur Adresstext bzw. Koordinaten an den Anbieter, keine IP oder Header des Kunden (`provider.ts:2`). Vertrag und Kontingent für den Betrieb: [OFFEN: ORS-Vertrag mit AVV, `docs/OPEN_ISSUES.md:19`, `:23`].
- **Mailversand:** heute der Standard-Mailer von Supabase; ein eigener SMTP-Anbieter ist Pflicht vor dem ersten Test auf einem Handy (`docs/OPEN_ISSUES.md:32`). [OFFEN: Anbieter]
- **Hosting der App:** [OFFEN: Anbieter, laut `CLAUDE.md` vor dem Launch festzulegen].
- **Region der Supabase-Projekte:** steht nicht im Repository (`config.toml` hat keinen Regionswert). [OFFEN: Region des Dev- und des Produktivprojekts bestätigen; `CLAUDE.md` verlangt EU]

## 3. Datenmodell (Endstand nach M22)

Alle Tabellen in `public`, RLS auf allen 18 Tabellen. Beträge sind ganze Cent (`int`).

| Tabelle | Zweck | Personenbezug | Anlage |
|---|---|---|---|
| `profiles` | Konto zu `auth.users` mit Rolle, Name, Telefon | ja | M01:28 |
| `price_versions` | Tarifversionen mit Gültigkeitsdatum, `published`, `content_hash`; veröffentlicht = unveränderlich | nein | M01:73, M15:69-74 |
| `price_config` | Tarifzeilen je Version mit Quelle | nein | M01:81 |
| `platform_settings` | versionierte Einstellungen mit `effective_from` (Gebührensatz, Fristen, Stornostufen, Anfahrtspauschale, Haltefenster, Foto-Frist) | nein | M01:93, M16:23 |
| `service_requests` | Anfrage: Leistung, Status, Adressen, Punkte, Route, Region, Bezirk, Termin, Zeitfenster, `termin_at`, `accept_deadline`, Freitext, `client_ref`, Zeiger auf die aktuelle Revision | ja | M01:105, M10:6-11, M18:101-117, M19:13-16 |
| `price_revisions` | Preis-Snapshot je Anfrage (Eingaben, Snapshot, Version, Hash, Betrag oder Spanne), nur anfügen | indirekt | M18:10-31 |
| `request_contacts` | Kontakt je Anfrage: Name, Telefon, E-Mail, Stiege/Tür | ja | M18:206-213 |
| `request_photos` | Fotoverweise (Storage-Pfad) je Anfrage, unveränderlich | ja | M01:133, M20:30-73 |
| `audit_log` | Journal von Admin- und Kundenaktionen (z. B. `price_confirmed`), nur anfügen | indirekt | M15:19 |
| `status_events` | Journal der Statuswechsel, nur anfügen | indirekt | M17:153-161 |
| `geo_boundaries`, `geo_districts` | Grenzen Wien und Österreich, 23 Wiener Bezirke (OSM, ODbL) | nein | M01:219, M19:54-61 |
| `route_cache` | Rohantwort des Routendienstes, Schlüssel HMAC über Punkte, 24 h | Koordinaten ohne Kontobezug | M06:6 |
| `geocode_cache` | Geocoding-Kandidaten, Schlüssel HMAC über das normierte Label, 24 h (`QH:33`, `:169-190`) | Adresskandidaten ohne Kontobezug | M19:19 |
| `route_rate_limits` | Zähler je Bucket und Zeitfenster, Bucket aus HMAC über IP bzw. Konto | pseudonym | M06:14 |
| `rental_offers`, `rental_bookings` | Mietangebote und Mietanfragen; Phase 2, im Dev-Projekt nur Demo-Angebote (`supabase/seed.sql:118-138`) | ja | M01:144, M01:171 |
| `fee_splits` | Gebührenaufteilung aus S8a; wird seit M18 von niemandem mehr geschrieben, Ablösung durch das Journal in S9b | nein | M01:196, M18:132-133 |

Enums: `user_role` (customer, rental_provider, admin, partner; M01:18), `service_type` (transport, move, clearance, assembly; M01:19), `request_status` (12 Werte, M17:48-51), `region` (vienna, austria, international; M01:23), `offer_status` (M01:24).

Views (beide `security_invoker`): `current_price_version` (höchste veröffentlichte Version mit `effective_on` ≤ heute in Wien; M15:285-290) und `current_fee_rates` (aktueller Gebührensatz; M16:69-78; liefert nur Zeilen, die die Policy von `platform_settings` freigibt).

Löschen: `profiles` hängt mit `on delete cascade` an `auth.users` (M01:29), Anfragen an `profiles` (M01:107), Revisionen, Kontakte, Fotozeilen und Status-Ereignisse an der Anfrage (M18:12, M18:207, M01:135, M17:156). `audit_log` hat keinen Fremdschlüssel; die `actor_id` bleibt nach einer Kontolöschung stehen. Einzel-DELETE auf Anfragen verhindert der Trigger `request_delete_guard` auch für den Eigentümer; nur die Kaskade einer Kontolöschung kommt durch (M18:119-130, M17:138-147). Storage-Dateien bleiben dabei liegen, bis `photo-cleanup` sie als verwaist erkennt. Eine Funktion „Konto löschen“ gibt es nicht (`docs/OPEN_ISSUES.md:7`).

## 4. Datenfluss

### 4.1 Preis ansehen (ohne Konto)
1. Die App liest `current_price_version` und die Zeilen von `price_config` dieser Version (anon darf beides, nur veröffentlichte Versionen; M15:276-283).
2. `@pricing` rechnet im Browser die Vorschau. Kunden-Preispositionen enthalten keine Gebühr.

### 4.2 Adresse und Strecke
1. Ohne Einwilligung des Kunden geht keine Adresse an den Server (`src/lib/route.ts:32`, `src/screens/konfigurator/useRouteCalc.ts:16`); ohne Strecke gibt es ein persönliches Angebot statt eines Preises.
2. Mit Einwilligung: `route` mit `mode = geocode` liefert Kandidaten, der Kunde bestätigt einen. `mode = route` liefert die Routenfakten.
3. `route` prüft Größe (≤ 4 KB), Origin, `apikey`, Eingaben, dann die Zähler (`take_rate_tokens`, fail closed mit 503). Grenzen: je IP 10/min und 80 (Geocoding) bzw. 160 (Route) pro Tag, global 35/min und 800 bzw. 1.600 pro Tag (RH:21-24). Die IP geht nur als HMAC in den Zähler (RH:56).
4. Route: Cache-Treffer oder Aufruf von ORS; gespeichert wird nur die Rohantwort (24 h). `route_geo_facts` (PostGIS) rechnet die km außerhalb Wiens und ob der Punkt in Österreich liegt; fehlt eine Grenze, bricht die Funktion ab (M06:56-89).

### 4.3 Anmeldung
1. Das Konto entsteht erst beim Absenden: `signInWithOtp` mit `shouldCreateUser: true`, Rückkehr nach `/anmelden` (`src/lib/auth.ts:42-47`).
2. Die Mail enthält Code und Link mit demselben Einmal-Token. Der Link wird erst nach einem Tipp auf „Anmelden“ eingelöst und danach aus der Adresse entfernt (`src/screens/Anmelden.tsx:26-35`).
3. Ein Trigger legt beim neuen Auth-Nutzer das Profil mit Rolle `customer` an (`private.handle_new_user`, M01:44-57).
4. Der Entwurf wandert über `movenow.handover` (15 min) in den Tab des Mail-Links.

### 4.4 Fotos
1. Nach der Anmeldung lädt die App die vorbereiteten JPEGs in den eigenen Staging-Ordner `{uid}/{client_ref}/`. Die Storage-Policy lässt das nur zu, solange es zu diesem `client_ref` keine Anfrage gibt, der Name dem Muster entspricht und der Nutzer weniger als 40 nicht übernommene Dateien hat (M20:79-89, M21:46-57).
2. Beim Absenden übernimmt `quote` die Dateien als `request_photos` (höchstens 8; der Trigger `guard_photo_insert` lässt Zeilen nur mit Marker und nur aus dem Staging-Pfad zu, M21:8-26). Danach kann der Kunde Fotos weder hinzufügen noch löschen.
3. `photo-cleanup` entfernt Dateien ohne Zeile nach `photo_staging_hours` (Seed: 24) plus 1 h (M20:106-123).

### 4.5 Anfrage senden (`quote`)
1. Origin, Methode, Größe (≤ 16 KB, QH:27), JWT (`auth.getUser`), danach das Nutzerlimit 6/min und 30/Tag (QH:35, `:215-226`).
2. Eingaben je Leistung über `parse*Input`; der Client liefert nur die Kundenwahl, Adressen (Label und Punkt), Kontakt, Termin, Foto-IDs, `termsHash`, `priceVersion` und den angezeigten Betrag.
3. Idempotenz: gibt es zu `clientRef` schon eine Anfrage des Nutzers, kommt sie zurück (QH:239-242).
4. Bedingungen: `termsHash` muss zu `booking_terms()` passen, sonst 409 `terms_changed` (QH:275-276).
5. Preisversion: die angezeigte, solange ihr Haltefenster (`price_hold_minutes`) trägt, sonst die aktuelle (QH:268-271); `verify_price_version` prüft den Hash, die Tarife müssen vollständig sein.
6. Adressen: Das Label wird serverseitig geocodiert (Cache 24 h, eigene Zähler: global 25/min und 150/Tag, je Nutzer 10/Tag; QH:32) und muss zum Punkt des Clients passen, sonst 422 `address_mismatch` bzw. `address_imprecise` (`_shared/quote/address.ts:19-24`). Abholung muss in Wien liegen (422 `pickup_outside_vienna`, QH:284), ein Ziel außerhalb Österreichs ist nicht buchbar (422 `offer_not_bookable`, QH:290). Der Bezirk kommt aus `geo_districts` (`quote_district`, M19:68-79).
7. Strecke wie in 4.2 (dieselben Zähler); keine Route ergibt ein Angebot statt eines Preises.
8. Preis mit `@pricing`; weicht er vom angezeigten Betrag oder der Version ab: 409 `price_changed`, nichts wird gespeichert (QH:323, `:378`).
9. `quote_save_request` (SECURITY INVOKER, nur `service_role`, M20:150-298) schreibt in einer Transaktion: Anfrage (Status `requested` bei Preis, `awaiting_offer` bei Spanne oder Angebot), Revision 1 (`submit`), Kontakt, Fotos und einen `audit_log`-Eintrag `price_confirmed`. `termin_at` und die Annahmefrist `accept_deadline` rechnet die Datenbank (M18:291-297): höchstens 24 h, höchstens die Hälfte der Zeit bis zum Termin, mindestens 2 h; ein Termin näher als die Mindestfrist wird abgelehnt (`too_late`).
10. Antwort: nur Kundenfelder (ID, Status, Preis-Snapshot, Version), keine Gebühr, kein Partneranteil (QH:84-85, `_shared/quote/snapshot.ts:1`).

Die Mietbuchung (`kind = rental`) läuft im Code über denselben Endpunkt und `quote_save_booking` (M18:326-373), hat aber in der App keine Oberfläche (Phase 2).

### 4.6 Aufträge und Zurückziehen
- Die Liste liest `service_requests` mit der verknüpften `price_revisions`-Zeile, gefiltert auf das eigene Konto (`src/screens/Auftraege.tsx:13`, `:37`); RLS erzwingt dasselbe.
- Zurückziehen über `withdraw(id)` (SECURITY DEFINER, nur `authenticated`, M17:249-279): erlaubt aus `requested`, `awaiting_offer`, `offered`; der Akteur kommt aus `auth.uid()`; der Statuswechsel landet über einen Trigger in `status_events`.

## 5. Rollen

| Rolle | Wer | Heute wirksam |
|---|---|---|
| `anon` | nicht angemeldet | veröffentlichte Tarife, `booking_terms()`, `route` (über den Publishable Key) |
| Kunde (`authenticated`, `profiles.role = customer`) | jedes Konto; Standard beim Anlegen | eigene Anfragen, Revisionen, Kontakte, Fotos lesen; über `quote` senden; `withdraw`; eigenes Profil (nur Name, Telefon) ändern |
| `rental_provider` | nur über `admin_grant_role` | eigene Mietangebote anlegen und ändern, Gebührensatz lesen (Phase-2-Altlast; Selbst-Hochstufung seit M22 entfernt) |
| `admin` | nur über `admin_grant_role`, die nur der Datenbank-Eigentümer ausführen darf (M16:166-181) | Lesen über RLS nur mit `aal2` (`private.is_admin()`, M15:10-15); Schreiben nur über `admin_*`-Funktionen, die nur `service_role` bzw. der Eigentümer aufrufen kann |
| `partner` | Enum-Wert ohne Wirkung | nichts; Partner kommen mit S9b (Abschnitt 8) |
| `service_role` | Edge Functions, pg_cron | umgeht RLS, aber nicht die Grants und Trigger (Abschnitt 6) |
| Eigentümer (`postgres`) | SQL-Konsole im Dashboard | alles; kann Trigger abschalten (dokumentierte Grenze, M17:6) |

Alle App-Rollen sind dieselbe Datenbankrolle `authenticated`; Unterschiede entstehen nur über Policies und Funktionen. Rollenwechsel in `profiles` verhindert der Trigger `guard_profile_role`, außer mit dem transaktionslokalen Marker `app.mv_role_grant`, den nur `admin_grant_role` setzt (M16:130-147).

## 6. Rechtekonzept

### 6.1 Muster
1. **RLS überall**, dazu `revoke all … from anon, authenticated` auf allen Tabellen und gezielte Grants (M01:253-261 und je neue Tabelle). Keine Policy mit `using (true)` auf personenbezogenen Daten.
2. **Schreiben nur serverseitig:** Nutzer haben auf keiner fachlichen Tabelle INSERT oder DELETE; UPDATE nur auf `profiles (display_name, phone)` und (Phase 2) `rental_bookings (status)` und `rental_offers` des eigenen Vermieterkontos.
3. **Auch `service_role` ist begrenzt:** Revoke von UPDATE/DELETE/TRUNCATE auf Revisionen, Kontakten, Fotos, Journalen, Mietanfragen; auf `service_requests` nur `update (current_revision)` (M18:122-125, M20:38, M19:5, M15:47, M17:171).
4. **Statuswechsel nur über Funktionen:** Der Trigger `guard_request_status` prüft das Paar „von → nach“ und einen an die Zeile gebundenen Marker `app.mv_transition = '<id>:<status>'`, ohne Ausnahme für Rolle, admin oder `service_role` (M17:1-6, `:219-239`).
5. **Funktionen:** SECURITY DEFINER nur mit `search_path = ''`; Supabase vergibt EXECUTE per Default an `anon`/`authenticated`, deshalb `revoke all … from public, anon, authenticated` und danach gezielter Grant (M15:249-260, M18:356).
6. **Unveränderlich:** veröffentlichte Preisversionen und ihre Tarifzeilen, Revisionen, Fotozeilen, `audit_log`, `status_events` (Trigger `immutable_row`/`append_only`, auch gegen TRUNCATE; Löschen nur als Kaskade, M17:138-147). Einstellungen sind versioniert: Schlüssel nie ändern, nur neue Zeilen; Löschen nur künftiger Zeilen; neue Gebührensätze brauchen den Vorlauf `fee_notice_days` (mindestens 15) (M16:34-65).
7. **Admin ohne Nutzer-JWT:** Alle `admin_*`-Funktionen nehmen `p_actor` als ersten Parameter, prüfen die Rolle mit `private.assert_admin` (M15:55-63) und schreiben `audit_log`; ausführbar nur für `service_role` bzw. den Eigentümer, nie aus Anfragedaten.

### 6.2 RLS-Matrix (S = lesen, I = anlegen, U = ändern, D = löschen)

| Objekt | anon | Kunde | admin (`aal2`) | `service_role` |
|---|---|---|---|---|
| `profiles` | – | S/U eigene (U nur Name, Telefon) | S | S/I/U, kein D (M18:125) |
| `price_versions`, `price_config` | S veröffentlicht | S veröffentlicht | S alle | nur über `admin_*`/`publish_version`, Trigger sperren Veröffentlichtes |
| `platform_settings` | – | – | S | S; I nur über `admin_set_setting` |
| `service_requests` | – | S eigene | S alle | I über `quote_save_request`, U nur `current_revision`, kein D |
| `price_revisions` | – | S eigene | – | I (nur Revision 1 `submit`, Trigger M18:36-80) |
| `request_contacts` | – | S eigene | – (M18:220) | I |
| `request_photos` | – | S eigene | – | I nur mit Marker (Trigger) |
| `audit_log` | – | – | S | I über Funktionen, nur anfügen |
| `status_events` | – | – | S | nur der Trigger schreibt |
| `rental_offers` | S freigegeben | S freigegeben; Vermieter I/U eigene | S | alles |
| `rental_bookings` | – | S eigene; U `requested → withdrawn` | S | S/I |
| `fee_splits` | – | S mit `payee_id` = eigenes Konto | S | – (seit M18) |
| Geo-Tabellen, Caches, Zähler | – | – | – | alles (keine Policy) |
| Storage `request-photos` | – | S/I/D nur im eigenen Staging-Ordner (Bedingungen 4.4) | – | alles |
| `booking_terms()` | ausführen | ausführen | ausführen | ausführen |
| `withdraw()` | – | ausführen | – | – |

Belege: Policies M01:266-267, M15:50-51, `:276-283`, M16:185-207, M17:114-116, `:174-175`, M18:93-97, `:221-225`, M20:40-41, `:79-104`, M21:46-70.

### 6.3 Geld und Gebühr
- Beträge als ganze Cent in allen Tabellen (M01:151-207, M18:19-30).
- Der Gebührensatz steht nur in `platform_settings` (`fee_rate`, `fee_vat_rate`, Version 1 aus dem Seed, `supabase/seed.sql:86-87`). Kunden lesen ihn weder direkt noch über `current_fee_rates`; `booking_terms()` liefert Kunden nur Stornostufen, Anfahrtspauschale und `termsHash`, keinen `fee_*`-Schlüssel (M16:81-104).
- `splitFee(total, {feeRate, vatRate})` (`supabase/functions/_shared/pricing/fee.ts:17-25`) rechnet wie `platform()` im Prototyp, wird heute aber **nirgends aufgerufen**: Seit S9a-2 entsteht beim Absenden keine Gebührenzeile mehr; das Journal `commission_entries` entsteht bei der Annahme und ist noch nicht gebaut (S9b-4).
- Kaution und Kraftstoff sind nicht Teil der Berechnungsbasis (Preismodul Miete, `docs/PRICING.md`).

### 6.4 Grenzen (bewusst, dokumentiert)
- Der Datenbank-Eigentümer kann Trigger abschalten und Marker setzen; der Inhalts-Hash der Preisversion erkennt nur versehentliche Änderungen (`docs/S9_KONZEPT.md`, R3).
- admin liest Adressen und Freitext in `service_requests` sowie Name und Telefon in `profiles`; Kontakte und Fotos nicht über RLS. Der Storage-Browser des Dashboards zeigt Originalfotos ohne Audit (`docs/S9_KONZEPT.md`, 7.2).
- `private.assert_admin` prüft nur die Rolle, nicht `aal2`; der Schutz liegt darin, dass diese Funktionen kein Nutzer-JWT ausführen kann.
- Die Fotogrenze von 8 prüft der Trigger je Zeile; das Staging-Limit (40) zählt eine Policy (`docs/OPEN_ISSUES.md:9`).

## 7. Statusmaschine

`request_status` hat 12 Werte: `requested`, `awaiting_offer`, `offered`, `accepted`, `in_progress`, `completed`, `withdrawn`, `expired`, `declined`, `unmatched`, `cancelled_by_customer`, `cancelled_by_partner` (M17:48-51).

| Übergang | Akteur | Weg | Stand |
|---|---|---|---|
| (neu) → `requested` / `awaiting_offer` | Kunde über `quote` | `quote_save_request`, Trigger `guard_request_insert` (M17:201-215) | gebaut |
| `requested` / `awaiting_offer` / `offered` → `withdrawn` | Kunde | `withdraw()` (M17:249-279) | gebaut |
| Miete `requested` → `withdrawn` | Kunde | direktes UPDATE, Policy und Trigger `guard_rental_status` (M17:114-132) | gebaut (Phase 2, siehe 9) |
| alle übrigen (Annahme, Angebot, Storno, Ablauf, Durchführung, Fertigmeldung, Korrektur) | Partner, Kunde, System, admin | Funktionen laut `docs/S9_KONZEPT.md` 4.4 | **nicht gebaut** (S9c ff.) |

Jeder Wechsel bei `service_requests` erzeugt eine Zeile in `status_events` mit Akteur und Akteur-Rolle aus den Markern `app.mv_actor` und `app.mv_actor_role` (ohne Marker: `sql`; M17:179-197). Ein Ablauf-Job für `accept_deadline` existiert noch nicht.

## 8. Geplant, nicht gebaut

Quelle: `docs/S9_KONZEPT.md` und `docs/S9b_PLAN.md`; nichts davon steht in Code oder Migrationen.

- **S9b (Migrationen 0023–0026):** Partnerfirmen (`partners`, `partner_members`, Kategorien, Wiener Bezirke, USt.-Regel, Dokumente), Statusmaschine der Firma (`pending`, `active`, `payment_hold`, `suspended`, `rejected`) mit `admin_approve_partner` und `admin_set_partner_status`, Helfer `my_partner_id()`, `my_member_partner_id()`, MFA-Pflicht (`aal2`) für Partner, Lesen des Gebührensatzes für Partner (P2B), Journal `commission_entries` statt `fee_splits`.
- **S9c ff.:** Verteilung an passende Partner (`job_listings`), Annahme mit Frist („erste Annahme gewinnt“), Festangebote bei Spannen, Storno durch Kunde und Partner, Nachtrag mit Fotobeleg, Kontakt nach Annahme (`job_contact`), Foto-Kopien ohne Metadaten für Partner (`photo-publish`, `job-photo`, Bucket `job-photos`), Mail-Outbox, Fertigmeldung nach dem Termin, Provisions-Export.
- **Phase 2:** Admin-Oberfläche, Transportermiete als Partner-Kategorie, Sammelrechnung, SEPA, Zahlungsdienstleister, Push, Capacitor-Build, Bewertungen (`docs/ROADMAP.md:121-127`).

## 9. Abweichungen und Auffälligkeiten

Gefunden beim Abgleich von Code, Migrationen und Doku. Keine davon ist im Rahmen dieses Nachtauftrags geändert worden.

1. **`docs/ARCHITECTURE.md` ist an drei Stellen veraltet:** `:32` und `:100` sagen, `quote` schreibe `fee_splits`; seit M18:132-133 darf das niemand mehr. `:32` nennt „Anfrage bearbeiten“, das mit S9a entfallen ist (`docs/S9_KONZEPT.md`, R2). `:67` nennt die Tab-Bar mit „Miete“, `CLAUDE.md` legt für Phase 1 Start · Aufträge · Profil fest.
2. **Tab-Bar zeigt „Miete“** (`src/app/Shell.tsx:10`), obwohl Phase 1 nur Start · Aufträge · Profil vorsieht. Bekannt (`docs/OPEN_ISSUES.md:100`).
3. **Miete: Status per direktem UPDATE.** `authenticated` hat `update (status)` auf `rental_bookings` (M01:383), die Policy erlaubt `requested → withdrawn` (M17:114-116), ein Trigger sperrt andere Paare (M17:118-132). Es entsteht kein `status_events`-Eintrag. `CLAUDE.md` verlangt „kein direktes UPDATE auf Status“ (dort für Annahme, Angebot, Nachtrag, Storno). Die Miete ist Phase 2 und ohne Oberfläche. Frage an Beks in `docs/nacht/doku.md`.
4. **MFA ist in `config.toml` aus** (`:304-306`). Admin-Lesen über RLS verlangt `aal2` (M15:10-15), Partner sollen `aal2` brauchen. Ob TOTP im Dev-Projekt im Dashboard aktiv ist, ist nicht belegt; laut `docs/PROGRESS.md:9` aktiviert Beks es vor S9b-3. [OFFEN]
5. **Migrationen mit DELETE:** M17:13-16 verwirft alle Anfragen, Fotozeilen, Mietanfragen und `fee_splits`; M19:8-10 schaltet den Löschschutz kurz ab und löscht Anfragen ohne Bezirk. Auf einem leeren Produktivprojekt ist das wirkungslos; auf einem Projekt mit Daten würden diese Migrationen Daten löschen. Bereits als Punkt 5a in der Livegang-Liste festgehalten (`docs/GOLIVE.md:23`: vor dem Push `count(*)` = 0 prüfen).
6. **Namen der Secrets:** Die Functions lesen `SECRET_KEY` (Function-Secret), `.env.example` führt `SUPABASE_SECRET_KEY` (für CLI und Tests). `RATE_LIMIT_SECRET`, `PUBLISHABLE_KEY`, `ALLOWED_ORIGINS` und `SECRET_KEY` stehen nicht in `.env.example`, sondern in `docs/GOLIVE.md:31`. Kein Fehler, aber leicht zu verwechseln.
7. **Kein Service Worker:** Die App ist über das Manifest installierbar, hat aber keinen Offline-Cache. Für den Capacitor-Weg unerheblich.
8. **Keine Funktion „Konto löschen“**, Storage-Dateien bleiben bis zum Aufräumjob liegen; Aufbewahrungsfristen für Anfragen und Fotos sind nicht umgesetzt (`docs/OPEN_ISSUES.md:7`, `docs/ARCHITECTURE.md:62`). Für die Datenschutzerklärung relevant.
9. **`private.geo_boundaries_make_valid()`** hat kein `revoke … from public` (M07:4-13). Es ist eine Trigger-Funktion ohne Rückgabe von Daten; geringe Bedeutung, aber abweichend vom Muster in 6.1.
