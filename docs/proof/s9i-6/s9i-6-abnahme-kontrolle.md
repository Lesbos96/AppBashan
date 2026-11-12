Modell: claude-fable-5-2

# Kontrollrunde zur Abnahme s9i-6a (Partner-Portal 2a)

- Datum: 2026-11-12, Branch `s9i-6`, Stand `60a33d4`
- Bezug: `tmp/proof/s9i-6-abnahme.md` (hoch 1: H1; mittel M1 bis M4; niedrig N1 bis N9)
- Vollständig gelesen: `src/screens/partner/Anfragen.tsx`, `src/lib/partnerJobs.ts`, `src/lib/jobs.ts`, `src/screens/auftrag/Bestaetigen.tsx`, `src/screens/Partner.tsx`, `scripts/scan-dist.mjs`, `tests/e2e/partner-anfragen.spec.ts`, `tests/e2e/jobs-helpers.ts`, `tests/unit/partner-jobs.test.ts`, `tests/rls/partner-jobs.test.ts`, `supabase/functions/_shared/pricing/fee.ts`, `vite.config.ts`, `tmp/proof/s9i-6-rotprobe.log`, `tmp/proof/s9i-6-build.log`, `tmp/proof/s9i-6-plan.md`
- Abschnitte: Migration 0038 (Zeilen 224-234, 360-431), `tests/rls/job-photos.test.ts:252-284`, `docs/AUTOPILOT.md:174-179` (Entscheidungen 75 bis 80), `docs/OPEN_ISSUES.md:359`, `:554-562`; Logs `s9i-6-check.log`, `s9i-6-e2e-1.log`, `s9i-6-e2e-2.log`, `s9i-6-rls-1.log`, `s9i-6-runde4.log` (nur Exit-Codes, Zählungen, Testnamen)
- Grenzen: nur Lese-Werkzeuge. Kein Testlauf, kein Build, keine Rot-Probe von mir. Aussagen zum Laufverhalten stammen aus den Logs oder sind aus dem Code hergeleitet und so benannt. Ob die Logs zum Stand `60a33d4` gehören, kann ich nicht prüfen (kein Git-Zugriff); die Zeilennummern in `s9i-6-rotprobe.log` und `s9i-6-runde4.log` passen zur heutigen Testdatei.
- Hinweis nach CLAUDE.md: Das eingebaute `advisor`-Tool (ohne Parameter) stand in meiner Tool-Liste. Ich habe es nicht aufgerufen.

Ergebnis: H1 und M1 bis M4 behoben, N1 und N6 behoben, N2 teilweise. Neu: hoch 0, mittel 0, niedrig 6. Entscheidung 76 trägt unverändert.

## Kontrolle der alten Findings

| Finding | Stand | Beleg |
|---|---|---|
| H1 | behoben, richtig | `Anfragen.tsx:108-110` rechnet `payout` nur bei `isOpen`; Preis, „Du erhältst“ und Spanne stehen nur im Zweig `isOpen` (`:128-143`), ebenso Frist, Fotos, Knöpfe und beide Sheets (`:144-161`, `:164-175`). Angenommene Karte: Leistung, Bezirke, Tag, Umfang, „Du hast den Zuschlag erhalten.“ (`:162`). Test `partner-anfragen.spec.ts:220-225` prüft die Karte gegen Euro-Zeichen, „Du erhältst“ und „Preis“; gegen den alten Stand wäre er rot (689,61 € stand in der Karte). Grün in `s9i-6-runde4.log:79-80`. Rest (kein Status, nach Storno weiter „Zuschlag erhalten“) steht als S9i6-1 (mittel, 6b) in `OPEN_ISSUES.md:555`. |
| M1 | behoben, Bedingung eng genug | `partnerJobs.ts:207-216`: nur `JobError` mit Art `taken` löst den Abruf aus; Erfolg nur, wenn dieselbe Listing-ID mit `accepted` in der Liste steht; Lesefehler ergibt eine leere Liste, der ursprüngliche Fehler wird weitergeworfen. Die Listing-Zeile gehört genau einer Firma (`job_listings` je Firma; die Zeilen der Verlierer werden `closed`, 0030:171), und `accepted` liest nur die Firma mit Zuordnung (0038:232). Ein fremder Gewinn kann also nie als eigener erscheinen. Unit: vier Fälle (`partner-jobs.test.ts:151-176`), E2E `:209-218`. Siehe K2, K5. |
| M2 | behoben | `scan-dist.mjs:8`: Muster „Gebührentabelle“ enthält nur noch die zwei Tabellennamen, der Ansichtsname ist heraus; Kommentar `:2-3`. `s9i-6-build.log:3`, `:47-48`: `tsc`, `vite build`, Scan, 0 Treffer, EXIT=0. In `src/` kommen die zwei gesperrten Namen nicht vor (Suche, 0 Treffer). S3-F angepasst (`OPEN_ISSUES.md:359`). |
| M3 | behoben, Probe aussagekräftig | Anker vor der Negativprüfung (`partner-anfragen.spec.ts:177-199`), Zähler für alle drei Abrufe (`jobs-helpers.ts:91`, `:100`, `:107`), Gegenprobe `:201-207`. Rot-Probe siehe unten. Siehe K3. |
| M4 | behoben | Fixture legt eine Kontaktzeile an (`tests/rls/partner-jobs.test.ts:30`); Gegenprobe als Eigentümer zählt Kontakt, Anfrage und Revision (`:56`, erwartet 3, `:66`). Die Foto-Prüfung ist aus diesem Test heraus und im Titel auf `job-photos.test.ts` verwiesen; dort scheitert der Partner an der Tabelle selbst (`job-photos.test.ts:262`, `:284`, 42501), das hängt nicht von vorhandenen Zeilen ab. `job_contact` vor Zuschlag: `not_assigned` (`:53`, `:64`). |
| N1 | behoben | `partnerJobs.ts:124-130` fängt den Wurf von `splitFee` und liefert `null`; Unit `partner-jobs.test.ts:180-183`. |
| N2 | teilweise | `own()` (`partnerJobs.ts:44`) schützt `GOODS`, `VEHICLE`, `OBJECT`, `FILL`, `WINDOW` und `kindOf`. Der Weg über `invoke` nicht: siehe K1. |
| N6 | behoben | Eigene Fehlerart `payout` mit eigenem Text (`jobs.ts:18`, `:42`), Zuordnung `partnerJobs.ts:30-31`; `revision_changed` bleibt „Preis geändert“ (`:32`), das ist richtig. Siehe K4. |
| N3 bis N5, N7 bis N9 | offen, eingetragen | S9i6-2 bis S9i6-4 (`OPEN_ISSUES.md:556-558`). Die Konstantenprüfung aus N4 ist entfernt. |

### Rot-Probe M3 (`tmp/proof/s9i-6-rotprobe.log`)

- Probe 1 (Bedingung `active` entfernt): rot genau pending und payment_hold (`:36`, `:81`), grün suspended, rejected, aal1 (`:125-127`), EXIT=1 (`:132`). Das ist das erwartete Bild: die drei anderen schützt die Schranke bzw. `ACCESS`.
- Probe 2 (Anfragen zusätzlich vor der Schranke): rot alle fünf (`:206`, `:251`, `:296`, `:341`, `:386`), EXIT=1 (`:433`).
- Ist-Wert in beiden Proben: Überschrift „Offene Anfragen“ einmal vorhanden statt nie (`Received: 1`, z. B. `:42`). Das misst die Wirkung der gelockerten Sperre, nicht nur einen Fehlschlag.
- Der sechste rote Test in Probe 2 („Angebot zurückziehen“, `:167-171`) ist ein Nebeneffekt der Probe: zwei Knöpfe „Zurückziehen“, weil die Anfragen bei aktiver Firma doppelt gerendert waren. Er lief nur mit, weil der Filter auf „Status“ auch seinen Titel trifft. Kein Befund.
- Zurückgebaut: `Partner.tsx:66-71` hat beide Bedingungen; die Vollläufe danach sind grün.
- Einschränkung: siehe K3.

## Neue Findings

### hoch

Keine.

### mittel

Keine.

### niedrig

- **K1 · `src/lib/jobs.ts:70` – N2 greift nicht für `accept` und `job-photo`.** Beide laufen über `invoke` → `asKind`, dort steht weiter das ungeschützte Nachschlagen in der Code-Tabelle. Ein Fehlercode wie `constructor` ergäbe eine Funktion als Fehlerart, also einen leeren Hinweis mit „Schließen“. `kindOf` mit `own()` (`partnerJobs.ts:45`) nutzt nur der RPC-Weg (`:51`); der Unit-Test dazu prüft nur `sendOffer` (`partner-jobs.test.ts:187-188`). Der Server sendet nur eigene Codes, kein Kundendatum betroffen. Fix: `asKind` mit `Object.hasOwn` (eine Zeile, deckt auch die Kunden-Tabelle), Unit-Fall für `acceptListing` mit Code `constructor` → `unavailable`.
- **K2 · `tests/e2e/partner-anfragen.spec.ts:209-218` – Der Test bildet nur den zweiten Versuch ab.** Ein Aufruf, sofort `already_taken`, Listing im Mock schon `accepted`. Der Titel nennt den verlorenen ersten Versuch; die Folge „Netzfehler → Sheet bleibt offen → zweiter Klick → Angenommen“ mit genau zwei Aufrufen ist für die Annahme nicht belegt. Die Logik selbst tragen die vier Unit-Fälle. Fix: erster Aufruf im Mock abbrechen (`route.abort`), Fehlertext im Sheet abwarten, Listing auf `accepted`, zweiter Klick; erwartet zwei Einträge in `jobs.accepts`.
- **K3 · `tests/e2e/partner-anfragen.spec.ts:187-189`, `:197-198` – Die Zählerprüfung wurde nie rot gesehen.** In beiden Proben scheitert zuerst die Überschrift, `noJobReads` wird nicht erreicht. Dass die Zähler zählen, belegt nur die Gegenprobe (`:201-207`). Ein Abruf ohne sichtbare Überschrift (z. B. Vorabladen außerhalb der Komponente) wäre damit nicht als rot belegt. Fix: `noJobReads` vor die DOM-Prüfungen stellen oder beide als `expect.soft`; bei der nächsten Probe den Ist-Wert der Zähler ins Log.
- **K4 · `tests/e2e/partner-anfragen.spec.ts:92` – Der Text aus N6 ist nicht festgenagelt.** Das Muster lässt „Preis“ oder „Auszahlung“ zu, der Test wäre auch mit dem alten Text grün. Der Unit-Test `:146-149` prüft nur die Fehlerart. Fix: auf „Deine Auszahlung hat sich geändert“ prüfen.
- **K5 · `src/lib/partnerJobs.ts:211-213` – Der Gewinner-Retry meldet Erfolg auf Firmenebene, ohne Stand und Betrag.** Zwei Randfälle: (a) Ein Kollege derselben Firma hat schon angenommen, die eigene Ansicht ist alt und zeigt wegen eines zwischenzeitlichen Satzwechsels eine andere Auszahlung im Sheet; der Klick endet als Erfolg, gebucht ist der Betrag des Kollegen. (b) Der Auftrag wurde zwischen erstem und zweitem Versuch storniert; die Karte sagt „Zuschlag erhalten“. Beides ist die Lücke aus S9i6-1, kein falscher Buchungssatz (der Server bucht nur bei gleichem gezeigtem Betrag, 0038:422). Beim reinen Antwortverlust stimmen gezeigter und gebuchter Betrag, weil das Sheet zwischen den Klicks nicht neu lädt. Fix in 6b: Nachweis über `my_jobs()` (Listing-ID und Status `accepted`/`in_progress`) statt über die Liste, danach die gebuchten Beträge aus dem Journal zeigen. In S9i6-1 ergänzen. Scheitert der Nachweis-Abruf, bleibt „nicht mehr verfügbar“ stehen; das ist die richtige Richtung (nie Erfolg ohne Beleg).
- **K6 · `src/screens/partner/Anfragen.tsx:162` – Der Satz verweist nicht auf die Quelle der Beträge.** Vorgeschlagen war ein Hinweis, wo Stand und Beträge bis 6b stehen (Mail). Ohne ihn sieht der Partner nach der Annahme keinen Betrag mehr. Kein Geldfehler; mit 6b erledigt. Bis dahin in S9i6-1 belassen.

## Prüfung auf neue Fehler durch die Änderungen

- **`payoutCents` liefert `number | null`.** Aufrufstellen in `src/`: nur `Anfragen.tsx:110` und `:244` (Suche). `:110`: `null` sperrt „Annehmen“ und zeigt den Hinweis (`:148-151`); das Sheet entsteht nur bei `payout !== null` (`:164`), damit ist auch `l.totalCents!` (`:168`) gedeckt. `:244`: Zeile „voraussichtlich“ entfällt bei `null`; der Ausdruck rechnet zweimal, das ist harmlos. Kein Weg, auf dem `null` als Betrag gesendet oder als 0 gezeigt wird. `splitFee` wirft auch bei ungültigem Gesamtpreis (`fee.ts:19`); auch das endet als `null`, also gesperrt.
- **Fehlerart `payout`.** `jobErrorText` ist `Record<JobErrorKind, string>`, der Typ erzwingt den Text (`jobs.ts:31`, `:42`). `stale` enthält `payout` (`:67`): Sheet schließt, Hinweis, Liste und Satz laden neu, kein erneutes Senden (E2E `:87-99`, zweiter Betrag 55169). `retryable` enthält sie nicht, richtig. Die Kunden-Tabelle (`jobs.ts:50-64`) kann `payout` nicht liefern; der Text nennt keine Gebühr und keinen Satz.
- **`own()` mit `Object.hasOwn`.** ES2022; `tsconfig.json:3-4` steht auf ES2023. `vite.config.ts` setzt kein `build.target`, es gilt der Vite-Standard (weit verbreitete Browser), der `Object.hasOwn` einschließt (Chrome 93, Firefox 92, Safari 15.4). Keine neue Anforderung: `src/screens/Profil.tsx:24` nutzt es schon. Für Capacitor heißt das iOS 15.4 oder neuer; das ist durch den Vite-Standard ohnehin Mindeststand. `own(WINDOW, null)` ergibt `undefined`, `windowLabel` liefert weiter `null` (`partnerJobs.ts:180`). Lücke: K1.
- **Gewinner-Retry.** Zwei Abrufe der Liste nach dem Erfolg (einer in `acceptListing`, einer im Neuladen), harmlos. `loadListings` wirft Postgrest-Objekte; `.catch` fängt alles. Der Abruf läuft nur bei `taken`, andere Fehler lesen nichts (Unit `:171-175`).
- **`scan-dist.mjs`.** Die zwei Tabellennamen bleiben gesperrt, der Scan auf Schlüssel und Tokens ist unverändert.
- **Zustandstests und 6b.** Die Zähler erfassen nur Anfragen, Angebote und Sätze. Wenn 6b für payment_hold `my_jobs()` lädt, bleiben die Tests gültig.

## Entscheidung 76 (`my_jobs()` in 6b)

Trägt unverändert. Die Behebung von H1 macht sie zur Voraussetzung dafür, dass Partner nach der Annahme wieder Beträge sehen. Nichts in 6a widerspricht dem Zuschnitt (`docs/AUTOPILOT.md:175`). Für die Plan-Prüfung von 6b:

1. Beträge als Summen der eigenen Journalzeilen: vor dem Summieren die Zeilenarten belegen (Buchung, Gegenbuchung mit negierten Spalten, Nachtrag als Differenz oder als Storno plus Neubuchung). Test mit Annahme, Nachtrag, Storno; Summe nach Storno 0.
2. Angebots-Aufträge: das Listing hat keinen Gesamtpreis; `total_cents` und `payout_cents` kommen nur aus dem Journal. Fall ohne Journalzeile festlegen (NULL, nie 0 als Betrag).
3. payment_hold: die Aufträge-Liste gehört hinter die Schranke, aber außerhalb der Bedingung `active` (`Partner.tsx:71`).
4. Gewinner-Retry auf `my_jobs()` umstellen (K5); bleibt er auf der Liste, darf `loadListings` angenommene Zeilen nicht wegfiltern.
5. Abschnitt „Angenommen“ in `Anfragen.tsx` entfernen, sobald die Aufträge-Liste steht (S9i6-1).
6. `request_id` erreicht den Partner erst mit der Zuordnung; die DOM-Prüfung gegen `request_id` gilt weiter für die Anfragen-Ansicht.
7. Die App liest das Journal nie direkt (dist-Scan), nur über `my_jobs()` und `my_commissions`.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `src/screens/partner/Anfragen.tsx:108-110`, `:128-162` | Beträge, Frist, Fotos, Knöpfe nur bei `isOpen`; angenommen nur neutraler Satz |
| `src/screens/partner/Anfragen.tsx:164-175` | Sheets nur bei offenen Listings; Annahme-Sheet nur mit Auszahlung |
| `src/screens/partner/Anfragen.tsx:244` | zweite Aufrufstelle von `payoutCents`, `null` blendet die Zeile aus |
| `src/lib/partnerJobs.ts:207-216` | Retry nur bei `taken`, gleiche ID, `accepted`; Lesefehler lässt den Fehler stehen |
| `src/lib/partnerJobs.ts:44-45`, `:51` | `own()` und `kindOf`, nur im RPC-Weg genutzt |
| `src/lib/jobs.ts:70`, `:73-82` | `asKind` ohne Schutz, Weg von `accept` und `job-photo` (K1) |
| `src/lib/jobs.ts:42`, `:67-68` | Text und Einordnung der Fehlerart `payout` |
| `supabase/migrations/…0038_partner_offers.sql:229-233` | `accepted` nur für die Firma mit Zuordnung |
| `supabase/migrations/…0038_partner_offers.sql:413`, `:418`, `:422` | `already_taken` bei vergebenem Auftrag oder nicht offenem Listing; Vergleich mit gezeigter Auszahlung |
| `supabase/migrations/…0030_job_listings.sql:171` | übrige offene Listings werden `closed`, nie `accepted` |
| `supabase/functions/_shared/pricing/fee.ts:7-11`, `:18-19` | Würfe, die `payoutCents` jetzt als `null` meldet |
| `scripts/scan-dist.mjs:2-3`, `:8` | Ansichtsname freigegeben, zwei Tabellennamen gesperrt |
| `tmp/proof/s9i-6-build.log:3`, `:47-48` | Build mit Scan, 0 Treffer, EXIT=0 |
| `tmp/proof/s9i-6-rotprobe.log:36-42`, `:81`, `:125-132` | Probe 1: pending und payment_hold rot mit Ist-Wert 1, drei grün, EXIT=1 |
| `tmp/proof/s9i-6-rotprobe.log:206`, `:251`, `:296`, `:341`, `:386`, `:433` | Probe 2: alle fünf rot, EXIT=1 |
| `tmp/proof/s9i-6-rotprobe.log:167-171` | Nebeneffekt der Probe (zwei Knöpfe), kein Befund |
| `tests/e2e/partner-anfragen.spec.ts:177-207` | Anker, Netzruhe, drei Zähler, Gegenprobe |
| `tests/e2e/partner-anfragen.spec.ts:220-225` | H1-Test prüft Karte gegen Betrag und Bezeichnungen |
| `tests/e2e/partner-anfragen.spec.ts:92` | Muster zu weit (K4) |
| `tests/unit/partner-jobs.test.ts:151-176`, `:179-190` | Gewinner-Retry vier Fälle; Härtung N1, N2 |
| `tests/rls/partner-jobs.test.ts:30`, `:52-56`, `:63-66` | Kontaktzeile, Sperre gemessen, Gegenprobe 3 |
| `tests/rls/job-photos.test.ts:262`, `:284` | Partner liest `job_photos` nicht (42501) |
| `src/screens/Partner.tsx:66-71` | beide Bedingungen nach der Probe wieder vorhanden |
| `vite.config.ts:7-19`, `tsconfig.json:3-4`, `src/screens/Profil.tsx:24` | kein eigenes Build-Ziel; `Object.hasOwn` schon im Bestand |
| `tmp/proof/s9i-6-check.log:104`, `:109` | 1005 Tests, EXIT=0 |
| `tmp/proof/s9i-6-e2e-1.log:620-622`, `:650-654` | erster Lauf: ein Test rot (Socket-Fehler beim Seitenaufruf, `barrierefreiheit.spec.ts:300`), EXIT=1 |
| `tmp/proof/s9i-6-e2e-2.log:26`, `:617-619` | ganzer Lauf wiederholt: 580 Tests, 578 grün, 2 bewusst übersprungen (Rot-Beweis `backend.spec.ts:32`), EXIT=0 |
| `tmp/proof/s9i-6-rls-1.log:375`, `:380` | 305 Tests, EXIT=0 |
| `docs/OPEN_ISSUES.md:359`, `:555-558` | S3-F angepasst; S9i6-1 bis S9i6-4 eingetragen |
| `docs/AUTOPILOT.md:175` | Entscheidung 76, Feldliste und Schutz von `my_jobs()` |

Offene Findings hoch: 0
