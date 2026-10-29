# MoveNow · Session-Prompts für Claude Code

## Vorbereitung (einmalig)

Die Schritte stehen auch in `STARTEN.md` im Projektordner.

1. Ordner `MoveNow` an einen festen Platz legen, z. B. `C:\Users\gesch\Projekte\MoveNow`.
2. Ihre `.env.local` in diesen Ordner legen. Die Namen stehen in `.env.example`; die zwei App-Variablen beginnen mit `VITE_`.
3. Das Supabase-Projekt haben Sie schon, wenn Ihre `.env.local` Werte enthält. Empfehlung: Region Frankfurt (eu-central-1), neue API-Schlüssel (Publishable und Secret), Legacy-Schlüssel deaktiviert.
4. GitHub ist optional. Ohne Remote committet Claude Code lokal und bietet am Ende von S1 an, ein privates Repo anzulegen.
5. Claude Code (Desktop-App): Ordner öffnen. REA und andere MCP-Server, die das Projekt nicht braucht, für dieses Projekt abschalten (siehe `STARTEN.md`).
6. Nur für S1: `/model opus`. Effort steht in `.claude/settings.json` auf medium. Ab S2 gilt wieder Sonnet 5.5 aus `.claude/settings.json`; hat Claude Code Opus behalten: `/model sonnet`.

## Erste Nachricht je Session

- S1: `Arbeite den Abschnitt „Kickoff · Session S1" in docs/SESSION_PROMPTS.md vollständig ab.`
- Ab S2: `Starte Session S2 nach dem Standard-Prompt in docs/SESSION_PROMPTS.md.` (Nummer anpassen)

---

## Kickoff · Session S1 (Opus 5.5)

```
Du bist Lead-Architekt für MoveNow. Diese Session ist S1 aus docs/ROADMAP.md und läuft mit Opus 5.5. Prüfe das zuerst: Läufst du nicht als Opus 5.5, sag mir, dass ich /model auf Opus stellen soll, und warte. Ab S2 arbeitet Sonnet 5.5 nach deinen Vorgaben weiter, also schreib alles so, dass eine neue Session ohne dieses Gespräch weiterkommt.

Lies zuerst CLAUDE.md, docs/ROADMAP.md (Abschnitt S1), den Kopf und die Abschnitte 0, 2, 4, 5, 6 und 8 von docs/DESIGN_BRIEF.md sowie docs/reference/design/README.md. Die großen Referenzen (docs/reference/MoveNow_Prototyp.html, docs/reference/design/html/) lädst du nicht komplett: Lass Explore die Rechenfunktionen, den state-Aufbau und die offerFields aus dem Prototyp auflisten. Sieh dir die Screens in docs/reference/design/screens/ an, soweit sie die Screen- und Routenstruktur betreffen. Design-Details sind erst ab S3 dran.

Ziel: lauffähiges Fundament und verbindliche Architektur. Noch keine Feature-Screens.

Aufgaben
1. Harness prüfen: .claude/settings.json und .claude/agents/* validieren (claude plugin validate .claude/agents, falls verfügbar). Starte Explore (Aufgabe: die Funktionen calc, transportCalc, rentCalc, platform und cents im Prototyp mit Zeilennummern finden) und test-runner (Aufgabe: node --version, npm --version, git --version und npx --yes supabase --version ausführen) je einmal im Hintergrund. Sag mir sofort Bescheid, damit ich die Modelle in /tasks kontrolliere, und arbeite ohne zu warten weiter. Fehlt ein Werkzeug, nenn es mir mit dem Installationsschritt für Windows.
2. Gerüst: Vite + React + TypeScript strict, React Router, Tailwind CSS, Motion, ESLint, Vitest, Playwright (Chromium; shots mit 390×844 und deviceScaleFactor 2, Full Page, Light und Dark; shots:all zusätzlich 430×932, 768×1024, 1280×800). Pfad-Alias @pricing auf supabase/functions/_shared/pricing/. Skripte check, build, test:e2e, shots, shots:all, db:types, db:push, env:check. Supabase-CLI über npx. Alles, was Secrets braucht, läuft über dotenv-cli mit .env.local, damit du die Datei nie liest. .env.example und .gitignore liegen schon im Ordner: nur ergänzen, nichts entfernen. git init, falls noch kein Repo besteht. Ist kein Remote gesetzt, committe lokal und frag erst im Abschlussbericht danach.
3. Führe npm run env:check aus. Fehlt ein Name aus .env.example, sag mir genau welcher und warte. Findet env:check stattdessen NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, sag mir, dass ich sie in VITE_SUPABASE_URL bzw. VITE_SUPABASE_PUBLISHABLE_KEY umbenennen soll.
4. Supabase: supabase init, mit dem Dev-Projekt verlinken (SUPABASE_PROJECT_REF, Passwort und Token kommen per dotenv-cli aus .env.local).
5. docs/ARCHITECTURE.md, höchstens zwei Seiten:
   - Rollen in dieser Phase: customer, rental_provider, admin. partner ist für später vorgesehen (siehe „Später" in der ROADMAP) und wird nur im Enum und als Planung beschrieben.
   - Datenmodell (Tabellen, Schlüssel, Enums). Ausgangspunkt unten, verbessere ihn und begründe Abweichungen kurz. Gleiche ihn mit Abschnitt 6 des Briefings ab.
   - Statusfluss nach den Screens 13 und 14: angefragt bzw. Besichtigung angefragt → Termin und Preis bestätigt → Auftragstag → abgeschlossen, dazu zurückgezogen und abgelaufen. In dieser Phase setzt der Kunde nur „angefragt" (beim Absenden) und „zurückgezogen"; alle anderen Status setzt admin (vorerst im Supabase-Dashboard). Mietanfragen analog.
   - Geldfluss: Der Server rechnet den Richtpreis und speichert ihn als Snapshot mit price_version. Die 15-%-Aufteilung wird je Anfrage und je Mietanfrage in fee_splits gespeichert, die Kunden nie lesen können; Kunden sehen nur Gesamtpreis und ihre Positionen. Vermieter sehen die Aufteilung in ihrer Abrechnung. Partnerangebote, Zahlung und Rechnung kommen erst später (Stripe Connect, Partner als Leistungserbringer); das Schema soll das ohne Umbau erlauben.
   - RLS-Matrix: Rolle × Tabelle × select / insert / update / delete
   - Datenschutz: Foto-Speicherung, Vorschlag für Löschfristen, und für später: was Partner vor und nach Annahme sehen
   - App-Struktur: Routen, Tab-Bar, welche Referenz-Screens zu welcher Route gehören, Buchungsflows ohne Tab-Bar
   - Entscheidungen mit je einem Satz Begründung
6. Migration 0001 nach ARCHITECTURE.md, nur für die Tabellen dieser Phase (Liste unten): postgis, Enums, Tabellen, Indizes, Trigger für updated_at, RLS und Policies, privater Storage-Bucket request-photos mit Policies. partners und quotes nur in ARCHITECTURE.md planen, noch nicht anlegen.
7. supabase/seed.sql: price_config mit allen Kunden-Tarifen aus dem Prototyp, je mit Quelle, URL und Recherchedatum 2026-10-28. Gebührensatz und USt.-Satz der Gebühr nur in platform_settings. Die drei Mietangebote aus sampleOffers, sichtbar als Demo markiert. Danach db:push.
8. RLS-Integrationstests mit Vitest, sequenziell, Testnutzer im Setup über die Admin-API, gepaced wegen Auth-Rate-Limits:
   - anon liest nichts Personenbezogenes
   - Kunde A sieht Anfragen, Fotos und Mietanfragen von Kunde B nicht
   - Kunde kann keinen Status außer „zurückgezogen" setzen
   - Vermieter sieht und ändert nur eigene Fahrzeuge; Kunden sehen nur freigegebene Fahrzeuge
   - Kunde und anon lesen weder fee_splits noch platform_settings
   - nur admin ändert price_config
   - niemand kann die eigene Rolle selbst auf admin setzen; die Vermieter-Rolle entsteht nur über den vorgesehenen Weg im Vermieterbereich
9. Leere docs/OPEN_ISSUES.md und docs/PRICING.md anlegen. Bekannter Fehler im Prototyp: Ein Klick auf „Umzug" wirft einen ReferenceError, weil moveRouteHTML nicht definiert ist. Trag das in OPEN_ISSUES.md ein; die Preislogik von Umzug (transportCalc) ist davon nicht betroffen.
10. docs/ROADMAP.md S2–S10 prüfen. Nur schärfen (Akzeptanzkriterien, Reihenfolge, Abhängigkeiten), keinen Umfang hinzufügen. Änderungen am Ende auflisten.

Datenmodell-Ausgangspunkt (Tabellennamen wie im Briefing, Abschnitt 6)
- profiles (id = auth.users.id, role customer|rental_provider|admin, display_name, phone)
- service_requests (id, customer_id, service, status, inputs jsonb mit Schema-Prüfung, price_snapshot jsonb nur mit Kunden-Positionen, price_version, estimate_cents, needs_quote, from_address, to_address, from_postcode, to_postcode, from_point, to_point geography, route jsonb, region vienna|austria|international, preferred_date, time_window, created_at)
- request_photos (id, request_id, storage_path)
- rental_offers (id, provider_id, name, station, size_m3, daily_cents, km_per_day, extra_km_cents, cover_daily_cents, excess_cents, cover_excess_cents, driver_daily_cents, booking_fee_cents, one_way_cents, deposit_cents, status pending|approved|archived, is_demo)
- rental_bookings (id, offer_id, customer_id, pickup_at, return_at, km, cover, extra_driver, return_station, total_cents, deposit_cents, price_version, status)
- price_config (key, value, unit, source_label, source_url, researched_at, version), öffentlich lesbar, nur Kunden-Tarife
- platform_settings (key, value, version), z. B. Gebührensatz 0,15 und USt.-Satz der Gebühr 0,20, lesbar nur für rental_provider und admin (später auch partner)
- fee_splits (id, service_request_id oder rental_booking_id, total_cents, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, price_version), lesbar nur für den betroffenen Vermieter und admin
- geo_boundaries (slug, geom)
- Später, nur planen: partners, quotes

Loop: bauen → test-runner (check, build, RLS-Tests) → fixen. Wiederholen, bis alles grün ist, höchstens 5 Runden. Danach reviewer über den Gesamt-Diff mit Fokus RLS, Geldfelder, Gebühren-Sichtbarkeit und Secrets; Findings „hoch" beheben und erneut prüfen lassen.

Abschluss: S1 in der ROADMAP abhaken, PROGRESS.md ergänzen, Commit „S1: Fundament und Architektur", Push, falls ein Remote gesetzt ist. Dann ein Bericht an mich:
- Nachweise: Exit-Codes, Testzahlen, Report-Pfade
- Entscheidungen, die ich treffen muss, je mit deiner Empfehlung
- Bestätigung, dass S2 mit dem Standard-Prompt aus docs/SESSION_PROMPTS.md starten kann
- Falls kein Remote gesetzt ist: das Angebot, ein privates GitHub-Repo anzulegen (mit gh, falls installiert und angemeldet, sonst mit meiner Repo-URL). Erst nach meinem Ja.
Dann stoppen.

Wenn dich etwas blockiert, das nur ich lösen kann (Schlüssel, Login, Passwort, Freigabe): einmal fragen, mit dem exakten Schritt für mich, dann warten.
```

---

## Standard-Prompt · ab Session S2 (Sonnet 5.5, Effort medium)

Vorher: neue Session starten. Sonnet 5.5 und Effort medium kommen aus `.claude/settings.json` (sonst `/model sonnet`). `<N>` ersetzen.

```
Session S<N> aus docs/ROADMAP.md. Läufst du nicht als Sonnet 5.5, sag es mir und warte.

Steht in docs/PROGRESS.md, dass S<N> schon begonnen wurde, mach an der dort notierten Stelle weiter.

Lies CLAUDE.md, docs/PROGRESS.md und in docs/ROADMAP.md nur den Abschnitt S<N>. Aus docs/ARCHITECTURE.md und docs/DESIGN_BRIEF.md nur die Teile, die S<N> betrifft. Bei UI-Arbeit: die in S<N> genannten Referenz-Screens aus docs/reference/design/screens/ ansehen und Werte aus dem passenden HTML in docs/reference/design/html/ über Explore holen.

1. Plane in höchstens 10 Zeilen: Dateien, Tests, Akzeptanzkriterien, Referenz-Screens. Betrifft der Plan Datenmodell, RLS, Rollen, Preis- oder Gebührenlogik, Auth oder Edge Functions, lass ihn vorher vom advisor (Opus) prüfen und übernimm seine Entscheidung. Dann ohne Rückfrage anfangen.
2. Arbeite nach dem Loop in CLAUDE.md, höchstens 5 Runden je Screen bzw. Aufgabe. Prüfläufe nur über test-runner, Suche über Explore, mechanische Arbeit über mech-editor.
3. Zum Schluss reviewer über den Gesamt-Diff. Bei UI vorher einmal shots:all, damit der reviewer alle Größen in Light und Dark sieht. Findings „hoch" beheben und erneut prüfen.
4. ROADMAP abhaken, PROGRESS.md 3–5 Zeilen, Offenes in OPEN_ISSUES.md, Commit „S<N>: <Titel>", Push, falls ein Remote gesetzt ist.
5. Bericht an mich: was fertig ist, Nachweise (Exit-Codes, Testzahlen, Report-Pfade, Screenshot-Pfade), offene Punkte, Entscheidungen für mich mit Empfehlung. Dann stoppen.

Braucht eine Entscheidung mich: einmal fragen, mit Empfehlung, dann warten.
Bleibt ein Fehler nach 2 Runden rot: Ursache und Hypothesen an den advisor geben und seinem Vorschlag folgen. Hilft auch das nach 2 weiteren Runden nicht, stoppen und mir berichten.
```

## Rolle von Opus
- S1: Opus ist Hauptmodell und legt die Architektur fest.
- Ab S2: Opus ist der `advisor`-Subagent. Sonnet baut und fragt ihn bei Datenmodell, RLS, Rollen, Preis- und Gebührenlogik, Auth, Edge Functions und bei Fehlern, die nach 2 Runden rot bleiben.
- Große Architektur-Änderungen später (z. B. Einführung der Zahlung): wieder eine eigene Session mit `/model opus`.

Effort bleibt auch dann medium (`effortLevel` in `.claude/settings.json`). Nur bei einem wirklich harten Problem mit `/effort high` erhöhen.
