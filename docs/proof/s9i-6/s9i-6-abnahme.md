Modell: claude-fable-5-2

# Abnahme s9i-6a (Partner-Portal 2a: offene Anfragen, Annahme, Festangebot, eigene Angebote)

- Datum: 2026-11-12, Branch `s9i-6`, Stand `820ed52` (WIP)
- Geprüft (vollständig gelesen): `src/lib/partnerJobs.ts`, `src/lib/jobs.ts`, `src/screens/partner/Anfragen.tsx`, `src/screens/Partner.tsx`, `src/screens/auftrag/Bestaetigen.tsx`, `tests/unit/partner-jobs.test.ts`, `tests/rls/partner-jobs.test.ts`, `tests/e2e/partner-anfragen.spec.ts`, `tests/e2e/jobs-helpers.ts`, `tmp/proof/s9i-6-plan.md`
- Gegengelesen (Abschnitte): Migrationen 0016, 0020, 0023, 0027, 0028, 0030, 0035, 0038, 0039; `supabase/functions/_shared/jobs/handlers.ts`, `jobs/db.ts`, `photo/handlers.ts`, `photo/db.ts`, `pricing/fee.ts`, `quote/parse.ts`; `src/screens/partner/Mfa.tsx`, `src/lib/mfa.ts`, `src/components/Sheet.tsx`; `scripts/scan-dist.mjs`, `package.json`, `playwright.config.ts`; Logs `tmp/proof/s9i-6-*.log` (nur Exit-Codes und Testnamen)
- Grenzen: Ich habe nur Lese-Werkzeuge. Kein Testlauf, kein Build, keine Rot-Probe von mir; Aussagen zu Laufverhalten sind aus dem Code hergeleitet und so gekennzeichnet.
- Hinweis nach CLAUDE.md: Das eingebaute `advisor`-Tool (ohne Parameter) stand in meiner Tool-Liste. Ich habe es nicht aufgerufen.
- Die Plan-Datei enthält nur den Plan, nicht meine Plan-Prüfung; M1, M3, M4, M5 habe ich aus dem Auftragstext übernommen.

Ergebnis: hoch 1, mittel 4, niedrig 9. Kein Datenleck, kein Fehler bei der Annahme selbst (der Server bucht nie einen anderen Betrag als den gezeigten). Der hohe Befund betrifft die Anzeige unter „Angenommen“.

## Findings

### hoch

**H1 · `src/screens/partner/Anfragen.tsx:108`, `:129-130`, `:160` – Karte unter „Angenommen“ zeigt Preis und „Du erhältst“ aus Werten, die nicht mehr gelten müssen.**
`payout` wird für jede Karte aus `l.totalCents` (Momentaufnahme des Listings bei der Verteilung) und dem heute geltenden Satz gerechnet, auch bei `status === 'accepted'`. Verbindlich ist aber die Journalzeile der Annahme (Satz und Betrag von damals, `partner_accept` 0038:427). Die Anzeige weicht ab, ohne dass irgendetwas es bemerkt:
- nach einem Satzwechsel: alle angenommenen Aufträge zeigen die Auszahlung zum neuen Satz;
- nach einem angenommenen Nachtrag: `job_listings.total_cents` wird nie nachgezogen (kein UPDATE auf angenommene Listings in 0040 bis 0056), Preis und Auszahlung bleiben alt;
- nach Storno oder Abschluss: das Listing bleibt `accepted` und ist über `assignment_access` (0030:87-95) noch `partner_access_days` lang sichtbar; die Karte sagt weiter „Angenommen“ und „Du erhältst X“.
Das ist genau Lücke 2 und 3 des Plans (Status, Preis und Auszahlung laufender Aufträge sind für Partner nicht lesbar); der Abschnitt „Angenommen“ mit Beträgen stand nicht im Schnitt 6a. Bei offenen Listings ist die Rechnung in Ordnung, weil der Server sie bei der Annahme vergleicht; bei angenommenen vergleicht niemand.
Fix (ohne Migration): Für `status === 'accepted'` keine Beträge zeigen (weder „Preis für den Kunden“ noch „Du erhältst“ noch Spanne), nur Leistung, Bezirk, Tag und einen neutralen Satz, etwa „Zuschlag erhalten. Stand und Beträge siehst du bald unter Aufträge; bis dahin gilt die Mail.“ `payout` nur rechnen, wenn `isOpen`. E2E: Karte unter „Angenommen“ enthält kein „Du erhältst“ und keinen Betrag. Die verbindliche Zahl kommt in 6b aus `my_jobs()` (Journal), nie aus `splitFee` in der App.

### mittel

**M1 · `src/lib/partnerJobs.ts:192-194`, `src/screens/auftrag/Bestaetigen.tsx:26-31` – Gewinner-Retry (M3 der Plan-Prüfung) nicht umgesetzt und nicht getestet.**
Geht die Antwort einer erfolgreichen Annahme verloren (`offline`, wiederholbar), sendet der zweite Klick erneut; der Server antwortet `already_taken` (0038:376), die App zeigt „Diese Anfrage ist nicht mehr verfügbar“ und lädt neu. Die Liste zeigt die Anfrage dann unter „Angenommen“, der Hinweis sagt das Gegenteil. Der Gewinner kann glauben, er habe verloren. Kein doppeltes Buchen (der Server ist idempotent im Ergebnis), aber eine falsche Aussage über einen verbindlichen Auftrag.
Fix: In `acceptListing` bei Fehlerart `taken` einmal `loadListings()` lesen; steht die Listing-ID dort mit `status === 'accepted'` (nur die eigene Firma mit Zuordnung sieht das, 0038:232), als Erfolg zurückkehren, sonst den Fehler weiterwerfen. E2E: erster Aufruf wird nach dem Zählen abgebrochen und das Listing im Mock auf `accepted` gesetzt, zweiter Aufruf 409 `already_taken`; erwartet: Abschnitt „Angenommen“, kein Text „nicht mehr verfügbar“, genau zwei Aufrufe. Dasselbe Muster mit kleinerem Schaden bei `withdraw_offer` (siehe N8).

**M2 · `scripts/scan-dist.mjs:7`, `package.json:46`, `src/lib/partnerJobs.ts:113` – `npm run build` schlägt voraussichtlich fehl; kein Build-Log für 6a.**
Der dist-Scan sperrt unter „Gebührentabelle“ auch den Namen der Ansicht `current_fee_rates`; der steht jetzt als Zeichenkette im Bundle (einzige Fundstelle in `src/`). Die E2E-Läufe bauen mit `npx vite build` ohne den Scan (`playwright.config.ts:33`), ihr Grün belegt den Build nicht; unter `tmp/proof/s9i-6-*` gibt es keinen Build-Lauf. OPEN_ISSUES S3-F verlangt dafür eine bewusste Freigabe.
Entscheidung: Den Namen der Ansicht aus dem Muster nehmen, die beiden Tabellennamen bleiben gesperrt. Begründung: Der Name verrät nichts; den Wert schützt RLS (Kunde erhält NULL, belegt in `tests/rls/partner-jobs.test.ts:71` und `partner-fee-read.test.ts`). Kommentar in `scan-dist.mjs` und S3-F in OPEN_ISSUES anpassen. Danach `build` über den `test-runner`, EXIT=0 ins Log. In 6b nicht `commission_entries` direkt in der App lesen (bleibt gesperrt), sondern über `my_jobs()`/`my_commissions`.

**M3 · `tests/e2e/partner-anfragen.spec.ts:174-188` – Die fünf Tests „kein Abruf der Liste“ (pending, payment_hold, suspended, rejected, aal1) belegen ihre Aussage nicht.**
Sie waren schon im Rot-Lauf grün, bevor es die Seite gab (`tmp/proof/s9i-6-rot.log:625-629`, `:719`), wurden also nie rot gesehen. Sie prüfen `toHaveCount(0)` und `listingReads === 0` sofort nach der Statuskarte, ohne auf etwas hinter der Schranke zu warten. Fällt die Bedingung `firm.status === 'active'` (`Partner.tsx:71`) weg, startet der Abruf erst nach `loadMfaState`; die Prüfung kann vorher fertig sein und grün bleiben (hergeleitet, nicht gelaufen). Gezählt wird außerdem nur `job_listings`, nicht `partner_offers` und `current_fee_rates`.
Fix: Positiver Anker vor der Negativprüfung: pending und payment_hold warten auf die Überschrift „Dokumente“ (Geschwister von `Anfragen` hinter der Schranke), aal1 auf „Code eingeben“, suspended und rejected auf die Statuskarte plus Netzruhe. Der Mock zählt alle drei Abrufe. Rot-Probe mit Ist-Wert: Bedingung in `Partner.tsx:71` vorübergehend entfernen, pending und payment_hold müssen mit `listingReads >= 1` rot werden; `<Anfragen />` vorübergehend vor die Schranke setzen, aal1, suspended und rejected müssen rot werden. Log nach `tmp/proof/`.

**M4 · `tests/rls/partner-jobs.test.ts:51`, `:54`, `:60-64` – Zwei Prüfungen im Sichtbarkeitstest können nicht fehlschlagen.**
Die Fixture (`request()`, Zeile 22-31) legt weder eine Zeile in `request_contacts` noch in `job_photos` an. „0 Zeilen“ gilt dort auch bei offener Policy. Der Testtitel behauptet „weder Anfrage noch Kontakt“. Die übrigen Prüfungen messen einen echten Ist-Wert (exakte Spaltenliste, `service_requests` und `price_revisions` mit vorhandener Zeile, `not_assigned`, Satz für Kunden `false`, Beträge mit „keine Zeile entstanden“).
Fix: Im Setup je eine Kontaktzeile und ein Foto (`kind = 'request'`, `status = 'ready'`) zum Auftrag anlegen; dann misst „0“ die Sperre.

### niedrig

- **N1 · `src/lib/partnerJobs.ts:112-122`, `Anfragen.tsx:108`, `:242`** – `loadRates` prüft nur „endliche Zahl“. `splitFee` wirft bei Sätzen außerhalb [0, 1) oder mit mehr als 4 Nachkommastellen (`pricing/fee.ts:7-11`); der Wurf fiele ins Rendern der Karte. Heute verhindert das der CHECK 0016:29. Fix: `payoutCents` fängt den Fehler und liefert `null` (Anzeige „kann gerade nicht berechnet werden“).
- **N2 · `src/lib/partnerJobs.ts:20-43`, `:128-131`, `:168-169`** – Nachschlagen in einfachen Objekten trifft auch geerbte Schlüssel (`constructor`, `toString`): `CODES`, `GOODS`, `VEHICLE`, `OBJECT`, `FILL`, `WINDOW`. Folge wäre ein leerer Fehlertext oder der Text einer eingebauten Funktion, kein Kundendatum. Fix: `Object.hasOwn` oder `Map`. Die Werte sind serverseitig Enums (`quote/parse.ts:179-183`, CHECK `time_window_known`).
- **N3 · `tests/unit/partner-jobs.test.ts:76`, `tests/e2e/partner-anfragen.spec.ts:36-37`** – Die Spaltenliste wird nur gegen ein Negativmuster geprüft. Besser: abgefragte Spalten sind Teilmenge der Grant-Liste aus dem RLS-Test (eine Konstante, zwei Tests).
- **N4 · `tests/e2e/partner-anfragen.spec.ts:171`** – `expect(PHOTO).toBeTruthy()` prüft eine Konstante. Entfernen. **`tests/unit/partner-jobs.test.ts:177-180`**: `supabase.rpc` wirft bei Netzfehlern nicht, sondern liefert `error`; der Test beschreibt einen Weg, den es so kaum gibt (real: `unavailable`, ebenfalls wiederholbar).
- **N5 · `Anfragen.tsx:78`, `:86`, `partnerJobs.ts:220`** – Ein abgelaufenes, noch nicht umgestelltes Angebot (`sent`, `valid_until` vorbei) sperrt „Angebot abgeben“ bis zum nächsten Serverlauf; `loadMyOffers` liest ohne Obergrenze (`.limit(20)` statt `slice`); Einträge unter „Meine Angebote“ nennen nur den Betrag, nicht die Anfrage.
- **N6 · `src/lib/jobs.ts:31`** – Bei `payout_changed` liest der Partner „Der Preis hat sich geändert“. Geändert hat sich seine Auszahlung. Eigener Text für die Partner-Seite.
- **N7 · `Partner.tsx:66-76`, `Anfragen.tsx:49-54`** – `partner_not_active` (Firma inzwischen gesperrt) lädt nur die Liste neu, die Statuskarte bleibt „Aktiv“; `mfa_required` ruft `recheck` der Schranke nicht auf. Der Server sperrt in beiden Fällen. Wie S9i5b-6.
- **N8 · `partnerJobs.ts:25`, `:202`** – Wiederholtes Zurückziehen nach verlorener Antwort endet als „Diese Anfrage ist nicht mehr verfügbar“, die Liste zeigt „Zurückgezogen“. Eigene Zuordnung für `withdraw_offer` (`invalid_transition` → still neu laden).
- **N9 · `Anfragen.tsx:242`** – Ohne Sätze lässt sich ein Angebot senden, der Partner sieht dann keine voraussichtliche Auszahlung. Hinweiszeile „kann gerade nicht berechnet werden“ ergänzen oder Senden sperren wie bei der Annahme.

## Prüffragen

**(1) Datensparsamkeit.** Kein Weg gefunden, der Kundendaten, Adresse oder `request_id` vor dem Zuschlag in DOM oder Netz bringt.
- `COLUMNS` (`partnerJobs.ts:75`) ist eine echte Teilmenge des Grants: 0030:121-122 plus `to_district` (0038:316-317). Nicht abgefragt: `partner_id`, `volume_m3`, `created_at`, `decided_at`. `request_id` ist nicht gewährt; ein Abruf damit scheitert als Ganzes (42501).
- `partner_offers`: abgefragt `id, base_revision_id, amount_cents, status, valid_until`, sortiert nach `created_at`; alles im Grant 0039:8-10, `request_id` gesperrt.
- `inputs` kommt ganz über das Netz, enthält aber nur geprüfte Preis-Eingaben: `quote` speichert das Ergebnis von `parseTransportInput`/`parseClearanceInput`/`parseAssembly` (`quote/parse.ts:179-183`), also Enums, Zahlen, Booleans. Freitext liegt in `service_requests.description`, nicht im Listing.
- `scopeLines` (`partnerJobs.ts:140-165`) rendert nur Zahlen (`num`), Booleans und Tabellenwerte; kein Rohstring aus `inputs` erreicht den DOM. `time_window` nur über `WINDOW`, `preferred_date` nur nach Muster.
- Aufrufe senden nur Listing-, Revisions- und Angebots-ID und Beträge (`accept`, `send_offer`, `withdraw_offer`, `job-photo`).
- Fotos: erst auf Antippen, nur offene Listings (`Anfragen.tsx:143`), nur `kind = 'request'` (0035:349-351). Die signierte Adresse enthält einen Zufallsnamen ohne Auftrag oder Nutzer (`photo/db.ts:13`).
- `revision_id` ist je Anfrage für alle Empfänger gleich und im Grant; das ist Bestand, kein Kundendatum.

**(2) Geld.**
- Auszahlung nur aus `splitFee` (`partnerJobs.ts:122`), dieselbe Funktion wie in `handleAccept` (`handlers.ts:100`), Ganzzahlrechnung in Basispunkten. Satz aus `current_fee_rates` mit Spaltenliste `fee_rate, fee_vat_rate` (`:113`); dieselbe Regel wie `private.current_fee()` (0038:262-275, 0028:199-212).
- Ohne Satz (NULL, Fehler, noch am Laden): `payout === null`, „Annehmen“ gesperrt, Sheet nicht gerendert (`Anfragen.tsx:146-149`, `:162`).
- Gezeigt und gesendet wird dieselbe Variable `payout` (Karte `:130`, Sheet `:167`, Aufruf `:163`). Nach jeder Aktion laden Liste, Angebote und Satz neu; dabei werden alle Karten abgebaut, ein offenes Sheet kann seine Zahl nicht unter dem Finger wechseln.
- Kein Euro-Endbetrag aus Float: Anzeige nur `formatEuro(cents)`. `parseEuro` (`:183-188`) ist strikt (ASCII-Ziffern, höchstens 7 Vorkomma- und 2 Nachkommastellen, kein Tausenderpunkt, > 0), Höchstwert 999.999.999 Cent liegt unter `int`. `sendOffer` sperrt vor dem Aufruf alles außer positiven ganzen Cent bis 2^31 − 1 (`:198`).
- Auf dem Bildschirm steht keine Gebühr und kein Prozentsatz; nur „Preis für den Kunden“, „Du erhältst“, „Du erhältst voraussichtlich“ (M4 erfüllt, `:242-243`). Kunden-Screens sind unberührt; die neuen Fehlertexte in `jobs.ts:40-45` nennen keine Gebühr und sind über die Kunden-Tabelle nicht erreichbar.
- Offen: H1 (Beträge unter „Angenommen“), M2 (Build-Sperre für den Ansichtsnamen).

**(3) Wettlauf und Fehlerabbildung.**
- `CODES` deckt alle Codes, die `accept` liefern kann: aus `partner_accept_basis` (0038:369-381) `not_found`, `offer_required`, `listing_declined`, `already_taken`, `expired`, `not_responsible`, `price_not_fixed`; aus dem Handler `revision_changed`, `payout_changed`, `fee_rate_changed`, `unauthorized`, `mfa_required` (`handlers.ts:56-57`, `:99-115`); aus `partner_accept` (0038:402-423) zusätzlich `partner_not_active`, `request_closed`, `partner_job_limit`, `invalid_transition`. Alle stehen in `STATUS` (`handlers.ts:18-51`) und in `CODES`. `invalid_input` und `internal` fallen auf `unavailable`.
- `send_offer` (0039:39-72): `not_found`, `mfa_required`, `partner_not_active`, `amount_out_of_range`, `not_responsible`, `invalid_transition`, `expired`, `listing_declined`, `vat_rule_missing`, `offer_exists`, `offer_limit`: alle abgebildet. `withdraw_offer` (0038:579-586): `not_found`, `mfa_required`, `invalid_transition`: abgebildet.
- `partner_accept` und `partner_accept_basis` sind nach 0038 nicht mehr ersetzt worden, `send_offer` nach 0039 nicht (Suche in 0040 bis 0056 ohne Treffer).
- Doppelklick: `busy` sperrt Knopf und Sheet (`Bestaetigen.tsx:20`, `:38`, `:52`); der Zustand wird noch im ersten Klick gesetzt. Ein Sperr-Ref wie in `Mfa.tsx:42-46` wäre robuster, nötig ist er nicht.
- `payout_changed` (und `revision_changed`, `fee_rate_changed`) führt nie zu erneutem Senden: `confirm` ruft `action` genau einmal je Klick, bei `changed` schließt das Sheet und alles lädt neu; der Partner muss neu öffnen und bestätigen. Der Server wiederholt intern höchstens einmal und vergleicht dabei erneut mit `shownPayoutCents` (`handlers.ts:97-114`).
- Gewinner-Retry: fehlt, siehe M1.

**(4) Zustände.** `Anfragen` hängt nur unter `ACCESS` → `MfaGate` (Schritt `done` nur bei aal2, `mfa.ts:46-48`) → `firm.status === 'active'` (`Partner.tsx:66-71`). pending und payment_hold bekommen die Schranke und die Dokumente, aber keinen Abruf; suspended und rejected nicht einmal die Schranke; aal1 sieht Einrichtung oder Code-Abfrage. Im Code stimmt das. Die Tests dazu tragen nicht (M3). Der Server erzwingt dasselbe unabhängig von der App (0038:231, 0023:89-94; RLS-Test Zeile 138-141, 153-156). Hinweis für 6b: payment_hold darf laut Server angenommene Aufträge sehen und abwickeln, die App zeigt ihm in 6a nichts.

**(5) Tests.**
- Unit: `parseEuro`, `payoutCents`, Whitelist, Code-Tabelle, Vorabsperre von `sendOffer` prüfen, was sie sagen. Die Code-Tabelle wird gegen sich selbst geprüft; ein Abgleich mit `STATUS` des Servers fehlt (niedrig, 6b). Der Rot-Lauf der Unit-Tests ist nur ein Import-Fehler (`s9i-6-rot.log:15`), wie in 5a und 5b.
- E2E: DOM-Prüfung mit Fremdschlüsseln im Mock, gesendeter Betrag gleich gezeigtem, Wettlauf, geänderte Auszahlung (lädt den Satz wirklich neu, zweiter Betrag 55169 stimmt: 68961 − 13792), ohne Sätze, Angebotseingaben, Serverantworten: tragfähig, alle waren rot. Nicht tragfähig: die fünf Zustandstests (M3). Fehlend: Gewinner-Retry (M1), keine Beträge unter „Angenommen“ (H1).
- RLS-Charakterisierungen eines unveränderten Backends, sofort grün: akzeptabel, unter drei Bedingungen. Erstens messen die Prüfungen Ist-Werte und keine bloßen Fehlschläge; das trifft zu bis auf M4. Zweitens sind die Sperren selbst in ihren Sessions rot belegt worden (S9c, S9e); diese Datei fügt nur die exakte Spaltenliste, Rohbeträge und Firmenstatus hinzu. Drittens steht in PROGRESS, dass es für diese Datei keinen Rot-Lauf gab und warum. Die ersten zwei Läufe der Datei waren rot wegen Fehlern in der Fixture (`s9i-6-rls-datei1.log`, `-datei2.log`), nicht wegen einer Sperre; das ist kein Rot-Beweis und darf nicht so genannt werden. Der Statuswechsel per Marker (Zeile 18-19) lässt die offenen Listings stehen und prüft damit den strengeren Fall.

## Für 6b oder OPEN_ISSUES

- `my_jobs()` (Migration 0057): Status, Termin, gebuchter Preis und gebuchte Auszahlung aus dem Journal; ersetzt den Abschnitt „Angenommen“ (H1). Auch für payment_hold.
- Angebots-Aufträge: das Listing behält `total_cents = NULL`; der vereinbarte Betrag muss aus `my_jobs()` kommen.
- „Meine Angebote“: Bezug zur Anfrage (Leistung, Bezirk), Obergrenze, abgelaufene Angebote (N5).
- Firma neu laden bei `partner_not_active`, Schranke neu prüfen bei `mfa_required` (N7).
- Abgleichstest `CODES` gegen die Codes des Servers; eigene Texte für Auszahlung geändert und Zurückziehen (N6, N8).
- `decline_listing` ist nicht gebaut (Plan-Frage 7): nach OPEN_ISSUES.
- Der Ansichtsname im Bundle: Entscheidung aus M2 in S3-F festhalten.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `supabase/migrations/…0030_job_listings.sql:121-122` | Spalten-Grant ohne `request_id`; `COLUMNS` ist Teilmenge |
| `…0038_partner_offers.sql:316-317` | `to_district` gewährt |
| `…0038_partner_offers.sql:228-234` | offen nur `my_partner_id()` (active, aal2) und zuständig; angenommen `my_job_partner_id()` plus Zuordnung |
| `…0039_s9e_abnahme.sql:8-10` | `partner_offers` ohne `request_id` für Konten |
| `…0039_s9e_abnahme.sql:39-72` | Codes von `send_offer`, alle in `CODES` |
| `…0038_partner_offers.sql:369-381`, `:402-423` | Codes der Annahme, alle in `CODES`; Vergleich `p_shown_payout` gegen `p_payout` (`:422`) |
| `…0038_partner_offers.sql:571-590` | `withdraw_offer` nur eigene Firma, aal2 |
| `…0027_partner_fee_read.sql:5-12`, `…0028:199-212` | Satz nur für Firmenmitglieder (aal2) und admin; Ansicht mit `security_invoker` |
| `…0016_settings_admin.sql:29` | Satz im Bereich [0, 1), höchstens 4 Nachkommastellen |
| `…0020_photo_staging.sql:242` | `requested` genau dann, wenn ein Gesamtpreis vorliegt; die Verzweigung Annahme/Angebot in der App passt dazu |
| `…0023_partners.sql:81-102` | drei Helfer mit aal2, Status wie behauptet |
| `…0035_job_photos.sql:340-357` | vor Annahme nur `request`-Fotos, aal2, nie der Kunde selbst |
| `supabase/functions/_shared/photo/db.ts:13` | Dateiname der Kopie zufällig |
| `supabase/functions/_shared/jobs/handlers.ts:94-115` | Eingabeprüfung, Vergleich mit gezeigter Auszahlung, höchstens eine interne Wiederholung |
| `supabase/functions/_shared/pricing/fee.ts:17-25` | Ganzzahlrechnung, kaufmännisch gerundet; App und Server dieselbe Funktion |
| `supabase/functions/_shared/quote/parse.ts:179-183` | `inputs` nur als geprüfte Struktur gespeichert |
| `src/lib/mfa.ts:46-48` | Schranke öffnet nur bei aal2 |
| `scripts/scan-dist.mjs:7`, `playwright.config.ts:33` | Ansichtsname gesperrt; E2E baut ohne den Scan (M2) |
| `tmp/proof/s9i-6-rot.log:625-629`, `:719` | fünf Zustandstests im Rot-Lauf grün (M3) |
| `tmp/proof/s9i-6-rls-datei3.log:5-10`, `s9i-6-runde3.log:81-82` | RLS-Datei 4 von 4, EXIT=0; E2E 44 grün, EXIT=0 |
| `tests/e2e/partner-anfragen.spec.ts:93`, `:98` | 551,69 € und 55169 nachgerechnet, stimmt |

Offene Findings hoch: 1
