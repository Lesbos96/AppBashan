Modell: claude-fable-5-2

# Abnahme s9i-7a: Partner-Portal 3a, Nachtrag vorschlagen (Geld, Sicherheit, Schema)

- Datum: 2026-11-12, Branch `s9i-7` (Stand 17f32d5)
- Geprüfter Umfang (vollständig gelesen): `supabase/migrations/20261112110000_0058_my_job_changes.sql`, `supabase/functions/_shared/change/handlers.ts`, `supabase/functions/_shared/change/db.ts`, `supabase/functions/change-propose/index.ts`, `src/lib/partnerChange.ts`, `src/screens/partner/Nachtrag.tsx`, `src/screens/partner/Auftraege.tsx`, `src/lib/jobs.ts`, `src/components/Sheet.tsx` (nur kurz), `tests/rls/partner-my-job-changes.test.ts`, `tests/unit/change-handlers.test.ts`, `tests/unit/partner-change.test.ts`, `tests/e2e/partner-nachtrag.spec.ts`, `tmp/proof/s9i-7-rot-sperre.test.ts.txt`, `tmp/proof/s9i-7-rot-sperre.log`, `tmp/proof/s9i-7-plan.md`.
- Gegengelesen (Abschnitte): 0040 (Gate, Basis, propose_change, Rechte, Index), 0041 (propose_change, withdraw_change), 0035 (receipt_gate, photo_receipt_add), 0030 (assignments, assignment_access), 0023 (my_job_partner_id), 0057 (my_jobs), 0046/0047 (Storno-Basis, reissue), `_shared/photo/handlers.ts`, `_shared/pricing/{change,transport,assembly,clearance}.ts`, `_shared/jobs/handlers.ts` (STATUS, authed, body), `tests/rls/rls.test.ts:483-497`, `tests/e2e/jobs-helpers.ts` (Mocks).
- Nicht geprüft: UI, Texte, Shots, Storno durch die Firma (verschoben), der Rest des Diffs.
- Hinweis 1: `tmp/proof/s9i-7-plan.md` enthält nur den Plan und die Fragen, nicht meine Planprüfung. Die Funde N1 und M1 bis M4 kenne ich nur aus dem Auftrag; ich habe gegen den Plan und den Code geprüft, nicht gegen deren Wortlaut.
- Hinweis 2: In meiner Tool-Liste stand ein eingebautes `advisor`-Tool ohne Parameter (gibt den ganzen Verlauf weiter). Es wurde einmal vor dem Schreiben aufgerufen, danach nicht mehr. Laut CLAUDE.md ist das zu melden.

## Ergebnis

Kein Fund der Stufe hoch. Der Server hält alle Sperren (Betrag, Akteur, Firma, Fenster, ein offener Nachtrag); Kunden und fremde Firmen erfahren nichts, keine Gebühr wird sichtbar. Die mittleren Funde betreffen Belege in der App (Sackgasse und Dubletten) und fehlende Grün-Nachweise. M1 und M4 vor dem Commit beheben; M2 und M3 mit Eintrag in `docs/OPEN_ISSUES.md` und Umsetzung in der nächsten Migration (Storno-Session) zulässig.

## Findings

### hoch
Keine.

### mittel

**M1** `src/screens/partner/Nachtrag.tsx:87` und `:96` (mit `src/screens/partner/Auftraege.tsx:107-117`) – Doppelte Beleg-IDs nach Neuladen im Hintergrund. `useJobs` lädt bei Fokus, Sichtbarkeit und im Minutentakt neu, auch bei offenem Sheet (Rückkehr aus Kamera oder Dateiauswahl löst das am Handy fast immer aus). Ist ein Upload geglückt und das Anlegen danach gescheitert (409 Betrag, Netz, abgelehntes zweites Foto), steht dieselbe ID nach dem Neuladen in `c.receiptIds` und in `uploaded`. `ids = [...c.receiptIds, ...uploaded]` enthält sie doppelt, die Datenbank lehnt Dubletten ab (`0041:27`, `receipt_required`), die App zeigt „Dieses Foto lässt sich nicht verwenden“ und kommt erst nach Schließen und Öffnen weiter. `have` zählt ebenfalls doppelt (Grenze 8 scheinbar früher erreicht). Kein Geldschaden, aber genau der Wiederholungsweg ist blockiert. – Fix: IDs als Menge führen (`[...new Set([...c.receiptIds, ...uploaded])]`), `have` aus derselben Menge; E2E-Fall: nach gescheitertem Anlegen ein `focus`-Ereignis auslösen, erneut senden, `photoIds` ohne Dublette prüfen (der Mock führt `receipt_ids` schon wie der Server, `tests/e2e/jobs-helpers.ts:276`).

**M2** `src/screens/partner/Nachtrag.tsx:98-103`, `:44-56`; `supabase/migrations/20261108180000_0035_job_photos.sql:311-323`, `:298` – Doppelte Belege sind nicht ausgeschlossen. (a) Geht die Antwort eines Uploads verloren, bleibt die Datei in `files`; der nächste Versuch lädt sie noch einmal hoch. (b) „Doch nicht“ nach einem Teil-Upload leert `uploaded`, `onClose` lädt aber nicht neu; `c.receiptIds` bleibt alt, dieselbe Datei wird beim nächsten Öffnen erneut hochgeladen. `photo_receipt_add` fügt ohne Dublettenprüfung ein, es gibt keinen Index auf (Auftrag, sha256) (`0035:40` ist der einzige Index). Jede Dublette verbraucht dauerhaft einen der 8 Plätze (`0035:298` zählt alle Belege, gelöscht wird nie) und erscheint beim Kunden. Die Prüffrage „keine doppelten Belege bei Wiederholung“ ist damit nur für die verlorene Antwort von `change-propose` erfüllt, nicht für den Upload. – Fix: serverseitig idempotent: `photo_receipt_add` gibt bei gleichem `sha256` für denselben Auftrag und dieselbe Firma die vorhandene ID zurück (partieller Unique-Index als Rückhalt), in der nächsten Migration. In der App jetzt: beim Schließen nach mindestens einem Upload neu laden (`onDone()` statt nur `onClose()`).

**M3** `src/screens/partner/Nachtrag.tsx:96`, `supabase/migrations/20261112110000_0058_my_job_changes.sql:32-33`, `supabase/migrations/20261109130000_0041_s9f_abnahme.sql:26-31` – Alle bereiten Belege der Firma hängen automatisch und ohne Abwahl an jedem neuen Nachtrag; ab dem ersten Foto braucht kein weiterer Nachtrag einen neuen Beleg (im E2E ausdrücklich so gewollt: „ein vorhandener Beleg genügt“). Auch die Belege eines schon angenommenen Nachtrags stützen so die nächste Erhöhung. Der Kunde sieht die Fotos und entscheidet, daher kein Geldfehler; der Beweiswert sinkt aber, und die Storno-Pauschale (Belege nach abgelehntem oder abgelaufenem Nachtrag, `0047:99-109`) stützt sich später auf dieselbe Liste. – Entscheidung: Für 7a zulässig mit Eintrag in OPEN_ISSUES. In der nächsten Migration: `propose_change` verlangt mindestens einen Beleg, der an keinem angenommenen Nachtrag dieses Auftrags hängt; `my_job_changes` liefert dazu nur noch die nicht verbrauchten IDs (oder eine zweite Spalte). Belege eines abgelehnten, abgelaufenen oder zurückgezogenen Nachtrags dürfen wiederverwendet werden.

**M4** `tmp/proof/` – Grün-Nachweise unvollständig. (a) `s9i-7-gruen-e2e-nachtrag.log` endet mit EXIT=1 (4 Fehler); grün ist erst `s9i-7-gezielt-5.log` (166 bestanden, EXIT=0). Die Datei mit dem Namen „gruen“ belegt also Rot. (b) Unter `s9i-7-*` liegt kein grüner Unit-Lauf (`change-handlers`, `partner-change`; vorhanden ist nur `s9i-7-rot-unit.log`) und kein voller RLS-Lauf nach dem Einspielen von 0058 (`rls.test.ts:493` prüft, dass `propose_change_basis` nur für service_role ausführbar ist; dazu `change-orders.test.ts` und `change-orders-concurrency`). – Fix: vor dem Commit `check` und die RLS-Suite vollständig über `test-runner` laufen lassen, Logs mit Exit-Code ablegen; die Rot-Datei nicht als Grün-Beleg nach `docs/proof/` übernehmen (Nachweisdateien nicht umbenennen oder ändern, Hinweis in PROGRESS.md).

### niedrig

**N1** `src/lib/partnerChange.ts:20-42` – `request_closed` fehlt in `CODES`. `receipt_gate` wirft den Code (`0035:297`), `photo-receipt` gibt ihn als 409 weiter (`_shared/jobs/handlers.ts:26`); die App macht daraus `unavailable` („Versuche es gleich noch einmal“) statt Schließen und Neuladen. – Fix: `request_closed: 'closed'`, Unit-Fall ergänzen.

**N2** `src/screens/partner/Nachtrag.tsx:111-116` – Scheitert nach 409 die zweite Vorschau, wird `closes` nicht angewandt (z. B. `change_open`, `partner_not_active`): Sheet bleibt offen, der alte Betrag bleibt auf dem Knopf. Der Server fängt es beim nächsten Senden ab. – Fix: im inneren `catch` dieselbe Verzweigung wie außen (`closes` → schließen und neu laden), sonst `preview` verwerfen und zurück zum Formular.

**N3** `supabase/migrations/20261112110000_0058_my_job_changes.sql:36`, `:44` – `cur` (Eingaben und Gesamtpreis der gültigen Revision) ist nicht an den Zeitraum der eigenen Zuordnung gebunden, und beendete Zuordnungen im Fenster bekommen die Zeile ebenfalls, obwohl die App sie dort nicht nutzt (`Auftraege.tsx:158`). Heute ohne Wirkung: dieselbe Anfrage bekommt nie eine zweite Firma (Zuordnungen entstehen nur bei Annahme und Angebotsbestätigung, `0038:424`, `0038:697`; Weitervermittlung legt eine neue Anfrage an, `0046:408-416`). – Fix (Härtung, nächste Migration): `and a.ended_at is null` in der Abfrage, dazu ein Testfall; damit entfällt auch die Abhängigkeit von der Annahme „eine Firma je Anfrage“.

**N4** `tests/rls/partner-my-job-changes.test.ts:81-92`, `:100` – Die Filter der Beleg-Spalte sind nur positiv belegt (Anzahl 2 bzw. 1). Ein gelockerter Filter auf `status = 'ready'`, `kind = 'receipt'` oder `uploaded_partner_id` würde den Test nicht rot machen; ebenso der Filter `proposed_by` (`0058:40`). „Keine Gebühr“ prüft nur die Spaltennamen der obersten Ebene, nicht die Schlüssel in `inputs`. – Fix: Setup um einen fehlgeschlagenen Beleg, ein Kundenfoto (`kind = 'request'`) und einen Beleg mit fremder Firma am selben Auftrag ergänzen (Erwartung weiter 2); Gebührenprüfung auf `to_jsonb(j)::text`.

**N5** `tmp/proof/s9i-7-rot-sperre.log` – Die Lockerungsprobe ist gültig (sie misst die Wirkung: fest 0, gelockert 1, exakte Gleichheit in `s9i-7-rot-sperre.test.ts.txt:31-32`, `:42-43`), das Log zeigt die Ist-Werte aber nicht (die `console.log`-Zeilen fehlen in der Ausgabe). – Fix: künftig Ist-Werte ins Log bringen (Reporter mit Konsolenausgabe); diese Datei unverändert lassen.

**N6** `src/screens/partner/Auftraege.tsx:67-70`, `:252` – Fällt `my_job_changes` bei einem Neuladen im Hintergrund vorübergehend aus, wird die Karte leer und das offene Nachtrag-Sheet verschwindet mitten im Ablauf samt Zustand (`change` wird `undefined`, die Komponente wird ausgehängt). Schon hochgeladene Belege bleiben als Waisen (siehe M2). – Fix: beim stillen Neuladen die bisherigen `changes` behalten, wenn nur die zweite Abfrage scheitert.

**N7** `supabase/functions/_shared/change/handlers.ts:108` mit `0040:315` – Auch die Vorschau sperrt den Auftrag kurz (`for update` im Gate, Firma `for share`), und `change-propose` hat kein Rate-Limit; jede Vorschau prüft zusätzlich den Versions-Hash und liest den Tarif. Eine zugeordnete Firma kann so Last erzeugen und Kundenaktionen am selben Auftrag kurz verzögern. – Fix: in OPEN_ISSUES vormerken (Rate-Limit je Nutzer für Vorschau); kein Blocker.

**N8** `supabase/migrations/20261109130000_0041_s9f_abnahme.sql:20-31` (Bestand, jetzt über die App erreichbar) – Keine Obergrenze für Nachträge je Auftrag; nach Ablehnung kann sofort der nächste folgen, jeder löst eine Mail an den Kunden aus. – Fix: in OPEN_ISSUES vormerken (Einstellung `change_max_per_request`, Prüfung in `propose_change`).

**N9** `src/screens/partner/Nachtrag.tsx:165` – „Mehr“ ist die Differenz zweier Server-Werte, im Gerät gebildet. Ganzzahlig und ohne Rundung, gesendet wird nur der Vorschau-Betrag; als Hinweis vermerkt, kein Fix nötig. Sauberer wäre ein Feld der Vorschau-Antwort.

**N10** `docs/ARCHITECTURE.md` – `my_job_changes` und die Vorschau von `change-propose` sind dort nicht eingetragen (Suche ohne Treffer). – Fix: am Sessionende nachtragen.

## Prüffragen

**(1) Migration 0058**
- Preisgabe Firmenwechsel: keine. Firmenfilter `a.partner_id = pid` (`0058:44`), letzter Nachtrag nur mit `proposed_by = a.partner_id` (`:40`), Belege nur mit `uploaded_partner_id = a.partner_id` (`:33`). Eine zweite Firma an derselben Anfrage gibt es im Schema nicht (siehe N3).
- Fenster: `assignment_access` (`0058:44`, `0030:87-95`), per Lockerungsprobe belegt (0 → 1).
- Status: `pending`, `rejected`, `suspended` und Kunden ohne Firma enden in `partner_not_active` (`0058:27-28`, `0023:97-102`); `payment_hold` liest. aal1: `mfa_required` (`0058:26`), doppelt gesichert durch `my_job_partner_id`. anon: kein EXECUTE (`0058:49`).
- Gebühr: keine Spalte, kein Journalzugriff; `total_cents` ist der Kundenpreis, den die Firma über `my_jobs` schon kennt.
- Personendaten: keine. `inputs` stammen aus `parse*Input` (feste Schlüssellisten, `transport.ts:28-46`, `assembly.ts:11-16`, `clearance.ts:19-30`), Freitext und Adressen liegen in anderen Spalten; `decided_by` wird nicht geliefert.
- Reihenfolge in `propose_change_basis`: Gate, Quelle, Festpreis, offener Nachtrag (`0058:61-65`), deckungsgleich mit `propose_change` (`0041:17-23`; `revision_changed` entfällt in der Basis zu Recht). Alle neuen Codes fallen erst nach dem Gate, fremde Firmen sehen weiter nur `not_found`.
- `create or replace`: Signatur, Rückgabespalten und Attribute (`security definer`, `search_path = ''`, volatil) sind gleich wie `0040:330-332`; Postgres behält Eigentümer und Rechte (`0040:564-573`: nur service_role). Keine Zwischenfassung in 0041 bis 0057. Der Rechte-Test (`rls.test.ts:493`) muss nach 0058 noch einmal laufen (M4).
- Locking: Die Annahme „Basis liest ohne Sperre“ stimmt nicht ganz: das Gate sperrt den Auftrag auch in der Basis, aber nur für die Dauer des Aufrufs. Zwischen Vorschau und Anlegen und zwischen Basis und `propose` schützen: Neuberechnung im selben Aufruf, `p_base` gegen `revision_changed` (`0041:20`), `change_open` unter Sperre (`0041:23`) und der Unique-Index (`0040:27`). `my_job_changes` ist eine einzelne lesende Abfrage, in sich konsistent.

**(2) `handleProposeChange`**
- Vorschau legt nichts an (`handlers.ts:119` vor `propose`), verlangt dasselbe Gate und dieselben Prüfungen, verbietet Belege und gezeigten Betrag (`:97-103`); Antwort nur Gesamtpreis und gebuchter Preis.
- Ohne Vorschau ist `shownTotalCents` Pflicht (sichere positive Ganzzahl); Abweichung endet in 409 `amount_changed` vor dem Anlegen (`:120`), ohne den neuen Betrag zu nennen.
- Schlüssellisten: unbekannte Felder im Körper 400 (`:95`), Routenschlüssel 422 (`:107`), `changes` nur mit Schlüsseln der gültigen Revision und nie `service` (`:112`); Werte prüft `parse*Input`. Verschachtelte Montage kann ein direkter Aufrufer ändern; das ist erlaubt, der Server rechnet und der Kunde entscheidet.
- Reihenfolge: Token und aal2, Form, Gate, Rechnung, Betrag, Anlegen. Vor dem Gate hängen nur Antworten, die allein vom Körper abhängen.
- Wettlauf: zwei parallele Sendungen ergeben genau einen Nachtrag (Sperre im Gate, `change_open`, Unique-Index). Rechnung in Integer-Cent (`change.ts:22-26`), Gebühr kommt hier nicht vor.

**(3) App**
- Die App rechnet keinen Preis; gesendet wird genau `preview.totalCents` (`Nachtrag.tsx:104`), nach 409 nie automatisch neu (`:109-113`). Einzige Rechnung im Gerät: die Anzeige „Mehr“ (N9).
- Wiederholung nach verlorener Antwort von `change-propose`: zweiter Versuch endet in `change_open` schon in der Basis, die App schließt und lädt neu; kein zweiter Nachtrag. Erfüllt.
- Belege: nach verlorener Upload-Antwort oder Schließen sind Dubletten möglich (M2); nach Neuladen im Hintergrund Sackgasse (M1).
- Fehlerzuordnung: vollständig bis auf `request_closed` (N1); unbekannte Codes werden `unavailable`, nie Servertext.
- `closes`: richtig für `closed`, `change_open`, `gone`, `no_change`, `unauthorized`; Lücke im 409-Zweig (N2).
- `Auftraege.tsx`: Knopf nur Anzeige (`canPropose`, `:190`, `:242`), der Server entscheidet; Rückzug über `withdraw_change` mit Bestätigung (`:253-257`), serverseitig eigene Firma und aal2 (`0041:124-148`).
- `Sheet.tsx` (`fit`): kein Fehler mit Geld- oder Sicherheitsbezug gefunden; `locked` sperrt Schließen während der Aktion.

**(4) Tests**
- RLS-Test belegt: Fremdfirma, aal1, Kunde, pending, rejected, suspended, payment_hold, Fenster, anon, Spaltenliste, Rechte, Sicherheitsattribute, Kennzeichen-Probe für Personendaten, Zustände des letzten Nachtrags, vorgezogene Prüfungen der Basis. Lücken: N4.
- Lockerungsprobe Fenster und Firmenfilter: gültig, beide Lockerungen machen die Zeile sichtbar (Ist 1 statt 0, über exakte Erwartung belegt; N5).
- Unit `change-handlers`: Vorschau ohne Anlegen, gleiche Sperren, `amount_changed` in beide Richtungen, Modusprüfung, Schlüssellisten. Ausreichend.
- Unit `partner-change`: Zeilenprüfung, Felder, Aufrufkörper, Zuordnung. Es fehlt `request_closed` (N1).
- E2E: Hauptweg, Doppelklick, 409 mit neuem Betrag, offener Nachtrag, Grenze 8, Rückzug. Es fehlen: Neuladen zwischen zwei Sendeversuchen (M1), verlorene Upload-Antwort (M2).
- Nachweise: M4.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0058:25-28` | uid, aal2, Firma active oder payment_hold vor jeder Zeile; in Ordnung |
| `0058:32-33` | Belege: receipt, ready, eigene Firma, dieser Auftrag; in Ordnung |
| `0058:38-41` | letzter Nachtrag nur der eigenen Firma, feste Spalten, kein `decided_by`; in Ordnung |
| `0058:49-50` | Rechte: public und anon entzogen, authenticated erlaubt; in Ordnung |
| `0058:54-56` gegen `0040:330-332` | Signatur, Rückgabe, Attribute gleich; in Ordnung |
| `0058:63-65` gegen `0041:21-23` | gleiche Reihenfolge und gleiche Codes; in Ordnung |
| `0040:303-325` | Gate: aal2, Mitglied, Sperre Auftrag, Firma, aktive Zuordnung, Status; in Ordnung |
| `0040:27` | Unique-Index: ein offener Nachtrag je Auftrag; in Ordnung |
| `0040:564-573` | Basis und propose nur service_role; in Ordnung |
| `0041:26-31` | Belege 1 bis 8, verschieden, eigene Firma; Dubletten werden abgelehnt (Grundlage M1) |
| `0035:298` | Grenze 8 zählt alle Belege des Auftrags, jeder Status (Grundlage M2) |
| `0035:311-323` | Beleg sofort `ready`, keine Dublettenprüfung (Grundlage M2) |
| `0035:297` | `request_closed` (Grundlage N1) |
| `0038:424`, `0038:697`, `0034:94`, `0039:143` | einzige Stellen, an denen Zuordnungen entstehen; keine zweite Firma je Anfrage |
| `handlers.ts:95-106` | Körperprüfung, Vorschau und Anlegen schließen sich aus; in Ordnung |
| `handlers.ts:119-121` | Vorschau endet vor `propose`; Betrag wird vor dem Anlegen verglichen; in Ordnung |
| `change.ts:22-26` | nur erhöhend, Ganzzahlen; in Ordnung |
| `_shared/jobs/handlers.ts:35` | `amount_changed` → 409; in Ordnung |
| `partnerChange.ts:162-174` | Vorschau ohne Betrag, Anlegen mit gezeigtem Betrag, sonst kein Feld; in Ordnung |
| `Nachtrag.tsx:87`, `:96` | Dubletten möglich (M1) |
| `Nachtrag.tsx:98-103` | Datei bleibt bei verlorener Antwort in der Warteschlange (M2) |
| `Nachtrag.tsx:111-116` | `closes` fehlt im inneren Zweig (N2) |
| `Auftraege.tsx:107-117` | Neuladen bei Fokus, Sichtbarkeit, Minutentakt, auch bei offenem Sheet |
| `Auftraege.tsx:158` | beendete Aufträge bekommen keine Nachtrag-Daten in der Anzeige |
| `rls.test.ts:493` | Rechte-Test deckt `propose_change_basis` ab; Lauf nach 0058 nicht belegt (M4) |
| `s9i-7-rot-sperre.log:5-10` | 2 bestanden, EXIT=0 |
| `s9i-7-gruen-rls-changes.log:5-10` | 4 bestanden, EXIT=0 |
| `s9i-7-gruen-e2e-nachtrag.log:209-215` | 4 Fehler, EXIT=1 (M4) |
| `s9i-7-gezielt-5.log:183-184` | 166 bestanden, EXIT=0 |

Offene Findings hoch: 0
