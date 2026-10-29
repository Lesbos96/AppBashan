# MoveNow · Offene Punkte

Je Punkt: Session, Problem, Begründung bzw. nächster Schritt.

## Daten und Betrieb
- **S1 · Freigegebene Angebote ändern:** Vermieter ändern Preise eines freigegebenen Angebots ohne erneute Prüfung, Kunden sehen das sofort (wie in 18 beschrieben). Alternative: ein Trigger setzt das Angebot bei Preisänderungen auf `pending` zurück. Entscheidung Beks vor S9.
- **S1 · Konto löschen:** Bisher kaskadiert das Löschen eines Auth-Nutzers auf Profil, Anfragen, Mietanfragen und `fee_splits`; Storage-Dateien bleiben liegen. Ein Vermieter mit Mietanfragen auf seinen Angeboten lässt sich nicht löschen (FK `rental_bookings.offer_id`). Vorgesehen: eine eigene Edge Function „Konto löschen", die Storage leert und Abrechnungsdaten anonymisiert. Spätestens mit Rechnungen (Später) `fee_splits` auf `restrict` plus Anonymisierung umstellen (Aufbewahrung BAO § 132).
- **S1 · Seed vor dem Launch:** `db:push` spielt `supabase/seed.sql` mit ein (`--include-seed`). Ändert sich der Seed, überschreibt er Tarife und Gebührensatz und legt die Demo-Angebote wieder an. Für das Produktivprojekt den Seed nicht pushen bzw. Demo-Angebote nur in Dev.
- **S1 · Foto-Limit nicht atomar:** Die Grenze von 8 Fotos prüft je eine Policy per `count(*)`. Parallele Uploads können sie knapp überschreiten. Akzeptiert; ein Löschjob räumt nach den Fristen auf.

- **S2b · `quote` speichert nur geprüfte Felder (Abnahmekriterium S8a):** `parse*Input` verwirft unbekannte Schlüssel; `quote` darf nur diese und die Snapshot-Felder speichern. Eingetragen in der ROADMAP bei S8a, `it.todo` in `tests/unit/pricing.test.ts`.

- **S4 · Seed-Weg für das echte Projekt:** `db:push --include-seed` wirkt nicht verlässlich: Der Push mit geändertem `supabase/seed.sql` meldete Erfolg, spielte die Änderung aber nicht ein (Dev-Projekt zeigte die alten Quellen-Labels); Ursache nicht geklärt, vermutlich verfolgt die CLI den Seed-Stand (Hash). Verlässlicher Weg: Migrationen mit `npm run db:push`, den Seed danach direkt und idempotent (Upserts) mit `npx dotenv -e .env.local -- supabase db query --linked -f supabase/seed.sql` gegen das verlinkte Projekt, dann prüfen (`select count(*), max(researched_at) from price_config` und die Zeilen `rental.reference`, `clearance.rate*`). Für das Produktivprojekt nur Tarife und Gebührensatz (`price_config`, `price_versions`, `platform_settings`) einspielen, nicht die Demo-Angebote; dafür eine eigene Produktiv-Seed-Datei anlegen, bevor es live geht.
- **S4 · Offline-Fehlerzustand verzögert:** `postgrest-js` wiederholt Netzwerkfehler und 5xx mit Wartezeit, der Fehlerzustand des Info-Sheets erscheint ohne Verbindung erst nach einigen Sekunden. Der Offline-Hinweis oben erscheint sofort.
- **S4 · Bundle über 500 kB:** Der Build meldet einen Chunk über 500 kB (Warnung). Aufteilen per Lazy-Routes vor S10 (Lighthouse).

## UI
- **S4 · Profil gegenüber `16`:** „Mitteilungen" fehlt (keine Benachrichtigungen in dieser Phase), „Mit E-Mail-Link anmelden" ist deaktiviert (kommt mit S8b), Darstellung (Automatisch) und Region (Wien, AT) sind Anzeigen ohne Auswahl, ebenso die Region-Pille auf Start (nur Wien).
- **S4 · Farben im Code:** `#2e918a` (Kachel Region) und `#4a5f63` (Kacheln Datenschutz, Impressum) stehen direkt in `Profil.tsx`; bei Gelegenheit als Tokens in `theme.css`.
- **S4 · Hero bei 768 px:** Die Startmarke der Route im Hero liegt knapp am Text („Weniger Aufwand."), weil die Grafik mit `slice` skaliert. Bei Bedarf Route nach rechts rücken.
- **S4 · Tarif-Aktivierung:** Neue Tarife als neue `price_version` mit künftigem `effective_on` anlegen, erst die Zeilen eintragen; `current_price_version` schaltet am Datum (Wiener Zeit) um.
- **S3b · Sheet bei Größenänderung:** `Sheet` liest `window.innerHeight` nur beim Öffnen; Drehen oder Fenstergröße bei offenem Sheet lässt Höhe und Detents falsch. Bei Bedarf Resize-Listener oder `dvh`.
- **S3b · Segmented Control 36 px:** wie die Referenz, unter 44 px Touch-Ziel. Vor S6 entscheiden, ob die Labels auf 44 px Klickfläche gestreckt werden.
- **S3b · Dark-Varianten abgeleitet:** Primär-Button-Verlauf und Segment-Thumb im Dark Mode ohne Referenz nach dem Dark-Muster. Schatten des Thumbs und Fortschrittsspur (`bg-fill` statt 10 %) nicht eigens als Token.
- **S3a · Icon-Namen ungeprüft:** `Icon` und `Illustration` nehmen Dateinamen als String; ein falscher Name wirft zur Laufzeit statt beim Typecheck. Bei Bedarf Namen als Union generieren.

## Prototyp
- **S1 · `moveRouteHTML` fehlt:** Ein Klick auf „Umzug" im Prototyp wirft einen ReferenceError, weil `moveRouteHTML` in Zeile 51 aufgerufen, aber nirgends definiert wird. Die Preislogik von Umzug (`transportCalc`, Zeile 100) ist nicht betroffen. Die App übernimmt den Fehler nicht (S2, S6).
- **S1 · Google Fonts in der Referenz:** `docs/reference/design/html/17_Wie_rechnet_MoveNow.html` lädt Inter von `fonts.googleapis.com`. Die App übernimmt das nicht (DSGVO); Erledigt in S3a: Inter wird über `@fontsource-variable/inter` selbst gehostet.
- **S1 · Quelle für 46,60 €/h fehlt:** Der Montage-Laufmeterpreis 47,87 € ist das Mittel aus 42 / 46,60 / 55 €/h. Für 42 € (DasUmzugsteam) und 55 € (Kraftpack) nennt der Prototyp Quellen, für 46,60 € nicht. Ebenso ohne Einzelquelle: Entrümpelungs-Mindestpreis 180 €, Etagenzuschlag 25 €, Montage mindestens 2 lfm. Im Seed als „Ohne Einzelquelle" markiert.
