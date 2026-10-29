# MoveNow · Offene Punkte

Je Punkt: Session, Problem, Begründung bzw. nächster Schritt.

## Daten und Betrieb
- **S1 · Freigegebene Angebote ändern:** Vermieter ändern Preise eines freigegebenen Angebots ohne erneute Prüfung, Kunden sehen das sofort (wie in 18 beschrieben). Alternative: ein Trigger setzt das Angebot bei Preisänderungen auf `pending` zurück. Entscheidung Beks vor S9.
- **S1 · Konto löschen:** Bisher kaskadiert das Löschen eines Auth-Nutzers auf Profil, Anfragen, Mietanfragen und `fee_splits`; Storage-Dateien bleiben liegen. Ein Vermieter mit Mietanfragen auf seinen Angeboten lässt sich nicht löschen (FK `rental_bookings.offer_id`). Vorgesehen: eine eigene Edge Function „Konto löschen", die Storage leert und Abrechnungsdaten anonymisiert. Spätestens mit Rechnungen (Später) `fee_splits` auf `restrict` plus Anonymisierung umstellen (Aufbewahrung BAO § 132).
- **S1 · Seed vor dem Launch:** `db:push` spielt `supabase/seed.sql` mit ein (`--include-seed`). Ändert sich der Seed, überschreibt er Tarife und Gebührensatz und legt die Demo-Angebote wieder an. Für das Produktivprojekt den Seed nicht pushen bzw. Demo-Angebote nur in Dev.
- **S1 · Foto-Limit nicht atomar:** Die Grenze von 8 Fotos prüft je eine Policy per `count(*)`. Parallele Uploads können sie knapp überschreiten. Akzeptiert; ein Löschjob räumt nach den Fristen auf.

- **S2 · Tarif-Constraints (Abnahmekriterium S4):** `price_config.value >= 0` als DB-Check und ein Seed-Test `clearance.rate_low ≤ rate ≤ rate_high` fehlen; das Modul wirft bei Verletzung. Eingetragen in der ROADMAP bei S4, `it.todo` in `tests/unit/pricing.test.ts`.
- **S2b · `quote` speichert nur geprüfte Felder (Abnahmekriterium S8a):** `parse*Input` verwirft unbekannte Schlüssel; `quote` darf nur diese und die Snapshot-Felder speichern. Eingetragen in der ROADMAP bei S8a, `it.todo` in `tests/unit/pricing.test.ts`.

## UI
- **S3a · Betragsformat:** CLAUDE.md verlangt `de-AT` EUR über `Intl.NumberFormat`. Das liefert „€ 1 175,00“ (Symbol vorn, Leerzeichen als Tausendertrenner), die Referenz zeigt „1.175,00 €“. `formatEuro` nimmt die Referenz. Entscheidung Beks: dabei bleiben oder CLAUDE.md anpassen.
- **S3a · Icon-Namen ungeprüft:** `Icon` und `Illustration` nehmen Dateinamen als String; ein falscher Name wirft zur Laufzeit statt beim Typecheck. Bei Bedarf Namen als Union generieren.

## Prototyp
- **S1 · `moveRouteHTML` fehlt:** Ein Klick auf „Umzug" im Prototyp wirft einen ReferenceError, weil `moveRouteHTML` in Zeile 51 aufgerufen, aber nirgends definiert wird. Die Preislogik von Umzug (`transportCalc`, Zeile 100) ist nicht betroffen. Die App übernimmt den Fehler nicht (S2, S6).
- **S1 · Google Fonts in der Referenz:** `docs/reference/design/html/17_Wie_rechnet_MoveNow.html` lädt Inter von `fonts.googleapis.com`. Die App übernimmt das nicht (DSGVO); Erledigt in S3a: Inter wird über `@fontsource-variable/inter` selbst gehostet.
- **S1 · Quelle für 46,60 €/h fehlt:** Der Montage-Laufmeterpreis 47,87 € ist das Mittel aus 42 / 46,60 / 55 €/h. Für 42 € (DasUmzugsteam) und 55 € (Kraftpack) nennt der Prototyp Quellen, für 46,60 € nicht. Ebenso ohne Einzelquelle: Entrümpelungs-Mindestpreis 180 €, Etagenzuschlag 25 €, Montage mindestens 2 lfm. Im Seed als „Prototyp v13, ohne Einzelquelle" markiert.
