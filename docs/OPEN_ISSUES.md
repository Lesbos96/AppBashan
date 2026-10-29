# MoveNow · Offene Punkte

Je Punkt: Session, Problem, Begründung bzw. nächster Schritt.

## Daten und Betrieb
- **S1 · Freigegebene Angebote ändern:** Vermieter ändern Preise eines freigegebenen Angebots ohne erneute Prüfung, Kunden sehen das sofort (wie in 18 beschrieben). Alternative: ein Trigger setzt das Angebot bei Preisänderungen auf `pending` zurück. Entscheidung Beks vor S9.
- **S1 · Konto löschen:** Bisher kaskadiert das Löschen eines Auth-Nutzers auf Profil, Anfragen, Mietanfragen und `fee_splits`; Storage-Dateien bleiben liegen. Ein Vermieter mit Mietanfragen auf seinen Angeboten lässt sich nicht löschen (FK `rental_bookings.offer_id`). Vorgesehen: eine eigene Edge Function „Konto löschen", die Storage leert und Abrechnungsdaten anonymisiert. Spätestens mit Rechnungen (Später) `fee_splits` auf `restrict` plus Anonymisierung umstellen (Aufbewahrung BAO § 132).
- **S1 · Seed vor dem Launch:** `db:push` spielt `supabase/seed.sql` mit ein (`--include-seed`). Ändert sich der Seed, überschreibt er Tarife und Gebührensatz und legt die Demo-Angebote wieder an. Für das Produktivprojekt den Seed nicht pushen bzw. Demo-Angebote nur in Dev.
- **S1 · Foto-Limit nicht atomar:** Die Grenze von 8 Fotos prüft je eine Policy per `count(*)`. Parallele Uploads können sie knapp überschreiten. Akzeptiert; ein Löschjob räumt nach den Fristen auf.

## Prototyp
- **S1 · `moveRouteHTML` fehlt:** Ein Klick auf „Umzug" im Prototyp wirft einen ReferenceError, weil `moveRouteHTML` in Zeile 51 aufgerufen, aber nirgends definiert wird. Die Preislogik von Umzug (`transportCalc`, Zeile 100) ist nicht betroffen. Die App übernimmt den Fehler nicht (S2, S6).
- **S1 · Google Fonts in der Referenz:** `docs/reference/design/html/17_Wie_rechnet_MoveNow.html` lädt Inter von `fonts.googleapis.com`. Die App übernimmt das nicht (DSGVO); Inter wird bei Bedarf selbst gehostet (S3a).
- **S1 · Quelle für 46,60 €/h fehlt:** Der Montage-Laufmeterpreis 47,87 € ist das Mittel aus 42 / 46,60 / 55 €/h. Für 42 € (DasUmzugsteam) und 55 € (Kraftpack) nennt der Prototyp Quellen, für 46,60 € nicht. Ebenso ohne Einzelquelle: Entrümpelungs-Mindestpreis 180 €, Etagenzuschlag 25 €, Montage mindestens 2 lfm. Im Seed als „Prototyp v13, ohne Einzelquelle" markiert.
