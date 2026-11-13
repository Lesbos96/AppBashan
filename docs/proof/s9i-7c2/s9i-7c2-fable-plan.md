Modell: claude-fable-5-2

**Entscheidung: ja mit Änderungen.**

**Begründung.** Die Cent-Werte für Buchung und Pauschale stimmen, und der Aufbau passt zu den bestehenden Live-Tests. Zwei Punkte im Entwurf sind falsch: Der Nachtragsbetrag 80000 lässt sich über den Edge-Weg nicht festlegen, und die Rechte-Prüfungen liegen an der falschen Stelle. `accept` und `photo-receipt` wurden live noch nie aufgerufen, `change-propose` und `cancel-partner` sind dagegen schon vollständig abgedeckt. Für die Zeile `change` prüft die Datenbank die Gebührenaufteilung gar nicht (0029:81-90), dort ist der Test die einzige Sperre.

**Antworten**

1. **Fixture statt `quote`: ja.** W1, W2b und W3 brauchen einen vergangenen Termin. Die Abweichung kommt in den Bericht. Die Fixture legt in allen vier Aufträgen `request_contacts` an, nicht nur in W3.
2. **Echter Upload: ja, je ein Beleg in W1 und W3.** Der Beleg ist Voraussetzung für Nachtrag und Pauschale. Bedingungen in Auflage 3 und 4.
3. **W3 = `now() − 2 h` mit `start_job`.** W2b und W3 unterscheiden sich dann nur durch abgelehnten Nachtrag und Beleg, das isoliert die Pauschale als Ursache für `job_contact`. W2b ist sauber, bekommt aber eine Ergänzung (Auflage 5). Kein W4 in dieser Session; `cancel-customer` und `offer-confirm` sind live ungetestet und gehören als Lücke nach `docs/OPEN_ISSUES.md`.
4. **`payment_hold`: sicher mit Auflage 8, ohne Rückweg auf `active`.** Der Rückweg wäre zulässig (0023:112-114), bringt aber nichts: `sweepTestResidue` sperrt die Firma ohnehin (sweep.ts:42-43).
5. **Rechte und Summen: unvollständig und teils doppelt.** Was fehlt und was entfällt, steht in Auflage 6, 7 und 9.
6. **Cent-Werte: Buchung und Pauschale stimmen, Nachtrag nur rechnerisch.**
   - Buchung 68961 → 10344 / 8620 / 1724 / 58617 und Pauschale 6900 → 1035 / 863 / 172 / 5865 stimmen mit fee.ts:22-24.
   - 6900 ist ein Halbcent-Fall (netto 862,5 → 863). Die Datenbank ließe auch 862 zu (0029:101), das Literal 863 ist also nötig.
   - Die Nachtragswerte (11039 / 1656 / 1380 / 276 / 9383) stimmen für 80000 mit change.ts:32-43. `change-propose` rechnet den Betrag aber aus dem Tarif (`_shared/change/handlers.ts:114-118`). 80000 stammt aus den SQL-Fixtures der alten Tests.
7. **Aufräumplan: reicht mit Auflage 4.** Freigegeben ist genau eine zusätzliche Löschung: Storage-Objekte der Belege von Testfirmen. MFA-Faktoren gehen mit den Nutzern.

**Auflagen**

1. **Satzprüfung vor den Fixtures.** In `beforeAll` nach dem Lesen der Sätze `splitFee(68961)` und `splitFee(6900)` gegen die Literale prüfen. Bei Abweichung mit Klartext werfen, bevor etwas committet ist. Ein Skip (TOTP aus) zählt nicht als bestanden; der Bericht nennt die Zahl der bestandenen Tests.
2. **Nachtrag ohne Konstante 80000, kein „Ist-Wert-Fund“.**
   - T ist `totalCents` der Vorschau. Pflicht: `baseCents` = 68961, T > 68961, echte Antwort = T, `price_revisions.total_cents` = T.
   - Die Summe Buchung + Nachtrag kommt aus einem unabhängigen Rechner: Postgres per `ownerSql`, Gebühr = `round(T·Satz)`, netto = `round(Gebühr/(1+USt))`.
   - Zeile `change` = Summe − Buchungsliterale, zusätzlich gleich `splitChange(T, rates, booking)`.
3. **Beleg-JPEG.**
   - Im Speicher erzeugen wie `tests/unit/photo-process.test.ts:124` (`new Image(w,h).fill(...).encodeJPEG`), klein, je Upload eine andere Farbe, keine Datei auf der Platte, kein echtes Foto. Header `content-type: image/jpeg`.
   - Prüfen: 200 mit UUID; Zeile `receipt` / `ready` mit `uploaded_partner_id` der Firma a; genau ein Objekt in `storage.objects`.
4. **Löschen der Belegobjekte.**
   - Eine Hilfsfunktion in `tests/support/sweep.ts` (dev-guard ist dort erster Import), mit demselben `TEST_FIRM`-Prädikat.
   - Sie nimmt nur Pfade aus `job_photos` mit `kind='receipt'`, deren Firma eine Testfirma ist und deren Objekt im Bucket `job-photos` existiert. Pfad gegen das UUID-Muster prüfen; bei mehr als 50 Treffern werfen, ohne zu löschen.
   - Gelöscht wird nur über `service.storage.from('job-photos').remove`. Danach muss die Zählung in `storage.objects` 0 sein.
   - Aufruf am Anfang von `beforeAll` (räumt Reste eines abgebrochenen Laufs) und als Erstes in `afterAll`. Jeder `afterAll`-Schritt bekommt ein eigenes try/catch, damit Sweep und `deleteUsers` immer laufen.
   - Nicht freigegeben: SQL-`delete` auf `storage.objects`, Bucket listen oder leeren, Bucket `request-photos`, Zeilen in `job_photos`, Objekte ohne `job_photos`-Zeile (die nimmt `photo_purge` nach 1 h, 0055:21-23).
5. **Wege.**
   - `job_contact` „gesperrt“ heißt Fehlertext `not_assigned`, „erlaubt“ heißt genau eine Zeile mit dem Fixture-Namen. Ein leeres Ergebnis zählt für keins von beiden.
   - W1: nach `completed` liefert `cancel-partner` 404, Zustand unverändert.
   - W2a: `job_contact` vor dem Storno 1 Zeile, danach `not_assigned`. Genau eine Folgeanfrage, darin kein Listing für Firma a.
   - W2b: vor dem Storno `reason: unavailable` → 409 `too_late_for_reason`, nichts geschrieben (0059:28). Danach Folgeanfragen 0, Outbox `partner_cancelled`.
   - W3: zusätzlich `job_contact` von pb → `not_assigned`, Outbox `partner_cancelled_fee`.
6. **Rechte neu für `accept` und `photo-receipt`.**
   - `accept`: ohne Anmeldung 401; `pa.jwt1` und Kunde 403; pb mit Listing von pa 404; falscher `shownPayoutCents` 409 `payout_changed`, nichts geschrieben; pb auf sein eigenes Listing nach dem Zuschlag 409 und weiterhin genau eine `booking`-Zeile.
   - `photo-receipt`: 401; aal1 und Kunde 403; pb 404; Nicht-JPEG 422 `not_jpeg`. In keinem Fall entsteht eine Zeile oder ein Objekt.
   - Streichen: Edge-Rechte für `change-propose` und `cancel-partner` (stehen in `partner-functions-live.test.ts:106-116, 163-170`) und cust2 bei `my_commissions` (gleiche Klasse wie cust).
7. **Kunde liest keine Gebühr.** Nach dem echten Ablauf mit `cust.db`:
   - `commission_entries` zu den eigenen Aufträgen: 0 Zeilen oder 42501.
   - `platform_settings` mit `fee_rate`: nichts.
   - `price_revisions.snapshot` des Nachtrags von W1: kein Treffer auf `/payout|commission|provision|fee_rate|feeCents|fee_net/i` (nicht auf `fee` allein, wegen `call_out_fee_cents`).
   - pb und `pa.aal1` lesen `commission_entries` ebenfalls leer.
8. **`payment_hold` als letzter Test.**
   - `partnerA` aus `partner_members` zu `pa.id` holen. Vorher prüfen: `contact_email` = `FIRM_MAIL` dieses Laufs, Name ≠ `COVER_FIRM`, Status `active`, alle Journalzeilen der Firma gehören zu den vier Auftrags-IDs dieses Laufs.
   - Aufruf als `select admin_set_partner_status(...) from partners p where p.id = … and p.contact_email = …`, erwartet wird genau eine Ergebniszeile.
   - Danach: `audit_log` mit Akteur adm und `set_partner_status` hat genau eine Zeile, `entity_id` = `partnerA`.
   - `my_commissions` vorher und nachher zeilengleich (IDs und Beträge).
9. **Summen.**
   - Die Schritttabelle (Status, Journal) kommt aus `commission_entries` per `ownerSql`. `my_commissions` zeigt W1 erst nach `completed`; das einmal prüfen (vorher 0 Zeilen).
   - Je Zeile: netto + USt = Gebühr, total − Gebühr = Auszahlung. Gegenbuchung ist die exakte Negation ihrer Bezugszeile.
   - CSV-Beträge ganzzahlig lesen (`^(-?)(\d+),(\d{2})$`), nicht über `Number(...)*100`.
   - Der Abgleich mit `export_commissions` entfällt (steht in `journal-live`).
10. **Monat einfacher.** `my_commissions` ohne Monat aufrufen. `billing_month` jeder Zeile liegt in {Wiener Monat bei Laufbeginn, bei Laufende}, beide aus der DB-Uhr. Die Formel aus 0042:113 nicht im Test nachbauen.
11. **Die fünf Proben heißen „Gegenprobe der Erwartung“.** Es wird keine Sperre gelockert, also sind sie kein Rot-Beweis nach CLAUDE.md.
    - Nur in reinen Lese-Tests, die nach allen schreibenden Schritten stehen.
    - Genau ein Probelauf, jeder Ist-Wert aus dem System im Log.
    - Vorher WIP-Commit, nach dem Zurücknehmen `git diff --exit-code` mit EXIT=0. Der abschließende Grün-Lauf läuft auf den committeten Bytes.
12. **Laufzeit.** Je Schritt eine einzige `ownerSql`-Abfrage (Status, Journalzeilen, Zähler als JSON). 150 s ist ein Ziel; bei Überschreitung berichten, keine Prüfung streichen.

**Risiken, die die Hauptsession testen muss**

- Fixtures in Bezirk 21 und die Folgeanfrage aus W2a verteilen sich an jede aktive Firma auf Dev, auch an fremde. Den Ist-Wert der Listings je Auftrag festhalten.
- Nach dem Löschen der Objekte bleiben `ready`-Zeilen ohne Datei. `job-photo` darf dafür keinen Fehler liefern (`_shared/photo/db.ts:24`).
- Kunde, Firmen und eventuell die Partner-Nutzer bleiben als Rest. Die Zahl kommt in `docs/PROGRESS.md`.
- Vier offene Aufträge bei einem Limit von 5 (`partner_open_jobs_max`): keinen weiteren gleichzeitig annehmen.
- Auth-Rate-Limits bei fünf Konten: gepaced anlegen wie bisher.
