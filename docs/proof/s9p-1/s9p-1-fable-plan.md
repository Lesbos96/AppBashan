Modell: claude-fable-5-2

# s9p-1 Planprüfung Provisionsstaffel (Kennung p1-1411-a) – Bericht zu Vorlage 1

- Datum: 2026-11-14
- Geprüft (vollständig gelesen): `supabase/migrations/20261114100000_0062_fee_schedule.sql` (1010 Zeilen), `tmp/proof/s9p-1-funktionsdiff.log`, `tmp/proof/s9p-1-fakten.md`, `tmp/proof/s9p-1-fable-vorlage-1.md`, `docs/S9_KONZEPT.md` 9.1–9.6.
- Gegengelesen (Ausschnitte): Migrationen 0016, 0023, 0027, 0028, 0038, 0039, 0040, 0042, 0046, 0050, 0059; `supabase/functions/_shared/pricing/fee.ts`, `change.ts`; `src/lib/partnerJobs.ts`; `tests/rls/change-orders.test.ts`; Seeds.
- Nicht geprüft: Edge Functions, Client, CSV (folgen laut Vorlage). Den SHA-256 der Migration habe ich nicht nachgerechnet (kein Shell-Werkzeug); geprüft ist der Text, wie er heute in der Datei steht. `docs/ARCHITECTURE.md` nicht gelesen (für diese Prüfung nicht nötig).
- Das eingebaute advisor-Tool wurde nicht aufgerufen.

Ergebnis in einem Satz: Rechnung, Rundung, Ablauf je Übergang und die mechanische Umstellung der 14 Funktionen stimmen; die Migration kann aber so nicht bleiben, weil sie dem Secret-Key ein Schreibrecht auf die Staffel gibt, das der bisherige Schutz (0016) ausschloss, und weil drei Schutzstellen die neue Spalte nicht abdecken.

## Findings

### Hoch

**H1** `0062:33` (mit `0062:15-22`, `0062:62-69`) – `grant insert` auf `fee_schedules` und `fee_schedule_tiers` an service_role. Der append-only-Trigger verhindert nur UPDATE/DELETE einzelner Zeilen; die Stufenmenge einer Version ist damit nicht unveränderlich. Mit dem Secret-Key lässt sich
- eine weitere Stufe an eine geltende oder schon benutzte Version anfügen. Beispiel: Zeile (Version 2, Stufe 4, bis 200000, 500 bp). `fee_cents` setzt nach der offenen Stufe `prev` nicht weiter (`0062:66`), Stufe 4 zählt den Bereich 100000–200000 ein zweites Mal. Die Provision bestehender Aufträge ändert sich rückwirkend für jeden Nachtrag und jede Stornogebühr, und der Guard nimmt es an, weil er mit derselben Funktion rechnet. Bei Version 1 (eine offene Stufe) genügt eine beliebige zweite Stufe.
- eine neue Version mit `valid_from` heute einfügen, die sofort gilt.

Bisher war genau das auch für service_role gesperrt: `0016:34-59` (`guard_platform_setting`) macht geltende Gebührenzeilen unveränderlich und verlangt für neue den Vorlauf `fee_notice_days` (mindestens 15 Tage, `0016:30`). Die Migration weitet also die Rechte des Secret-Keys auf die Provisionsbedingungen aus und widerspricht ihrem eigenen Kopf („Zeilen sind unveränderlich“, `0062:9`).
Fix: `0062:33` streichen, Kommentar `0062:9` anpassen. Neue Staffeln kommen nur per Migration (geprüft, mit Hash). Tests, die eine dritte Version brauchen, nehmen den Eigentümer-Weg wie bisher beim Satz (`tests/support/owner.ts`, Muster `tests/rls/change-orders.test.ts:396`). Zusätzlich N1 (fail closed bei kaputter Stufenmenge).

### Mittel

**M1** `0062:125-127` – `fee_rate` und `fee_rate_version` werden unwiederbringlich gelöscht, ohne dass die Migration prüft, dass der Bestand wirklich 15 % ist. Auf Dev ist das nachweislich nicht garantiert: `tests/rls/change-orders.test.ts:396` fügt mit abgeschalteten Triggern `fee_rate` Version 99 = 0,10 mit Datum heute ein, `:400` liest danach Journalzeilen mit eingefrorenem Satz. Solche Zeilen würden stumm zu „v1 15 %“; der Nachweis im Journal wäre falsch und Folgezeilen dieser Aufträge würden mit 15 % gerechnet.
Fix: vor `0062:125` ein `do`-Block, der abbricht, wenn es in `commission_entries` eine Zeile mit `fee_rate <> 0.15` gibt (Meldung mit Anzahl). Dev vorher über den Eigentümer-Weg bereinigen; Zählung vor dem Push als Log nach `tmp/proof/`.

**M2** `0062:220-236` – Der Guard prüft bei `booking` nicht mehr, welche Version zulässig ist; jede vorhandene Version geht durch, solange die Gebühr zur Version passt. Bisher prüfte der Guard den Satz selbst gegen den geltenden (`0040:246-254`), ausdrücklich „unabhängig von der Funktion (gilt auch für Eigentümer-SQL)“ (`0028:52`). Heute gibt es keinen Weg daran vorbei (nur `partner_accept` und `confirm_offer` buchen `booking`, beide prüfen), aber die zweite Sicherung ist weg, und eine künftige Funktion könnte mit Version 1 buchen.
Fix: im Guard die erwartete Version selbst bestimmen. Stammt die Revision aus einem Angebot (`rev.source = 'partner_offer'`, `0062:450-451`), dann die Version des Angebots aus `rev.snapshot ->> 'offerId'` (gleicher Auftrag, gleiche Firma, Status `confirmed`; der Status ist bei `0062:459` schon gesetzt, bevor `0062:464` bucht); sonst `private.current_fee_schedule()`. Abweichung: `rate_mismatch`. Die Prüfungen in `partner_accept` (`0062:370-374`) und `confirm_offer` (`0062:440-444`) bleiben.

**M3** `0038:36-47` (`private.guard_partner_offer`, in 0062 nicht angefasst) – Die Unveränderlichkeitsliste des Angebots kennt `fee_schedule_version` nicht. Im Statuswechsel aus `sent` ließe sich die eingefrorene Version in derselben Anweisung ändern; `0038:35` verspricht „alles andere unveränderlich, auch für den Eigentümer“. Die Version ist jetzt geldrelevant (sie bestimmt die Provision beim Zuschlag).
Fix: `create or replace` der Funktion in 0062, `fee_schedule_version` in beide Zeilenlisten aufnehmen.

### Niedrig

**N1** `0062:62-69` – `fee_cents` prüft die Stufenmenge nicht. Version ohne offene Stufe: über der letzten Grenze fällt stumm keine Provision an. Stufe nach der offenen oder nicht steigende Grenzen: Doppelzählung. Fix: fail closed mit `setting_missing`, wenn eine Grenze nicht größer als die vorige ist, nach der offenen Stufe noch eine folgt oder am Ende keine offene Stufe da war. Die TS-Seite spiegelt dieselbe Regel.

**N2** `0062:111` – `payout_preview` verlangt über `private.my_member_partner_id()` bereits aal2 (`0023:81-86`); ein Firmenkonto mit aal1 bekommt `not_found` statt `mfa_required` wie bei `my_commissions` (`0062:969`). Sicher, aber uneinheitlich. Fix (mitnehmen, da die Datei neu entsteht): aal-Prüfung mit `mfa_required` vor der Mitgliedsprüfung.

**N3** `0027:8-12` (Policy bleibt) – Partnerkonten lesen weiter `fee_rate` = 0,15 aus `platform_settings`, obwohl 12/10/7 gilt. Das ist für P2B-Transparenz irreführend. Fix (mitnehmen): Policy `platform_settings_select` für Partner auf `fee_vat_rate` einschränken. Die Zeile selbst bleibt (siehe Punkt 5).

**N4** `0062:525` – Liefert `current_fee_schedule()` null, scheitert `send_offer` mit einer NOT-NULL-Verletzung statt `setting_missing`. Kann mit Version 1 (gültig seit 2026-10-28) nicht eintreten; kein Änderungszwang.

**N5** Doku – `docs/S9_KONZEPT.md:547-557` (9.1–9.3) beschreibt noch den flachen Satz, `current_fee_rates` und `splitFee(total, {feeRate})`; CLAUDE.md nennt 15 % und `round(total × 0,15)`. Konzept im Doku-Schritt nachziehen; CLAUDE.md ändert nur Beks.

**N6** Vorlauf – Version 2 gilt ohne Ankündigungsfrist. Das ist Beks' Vorgabe und eine reine Senkung (v2 liegt für jeden Betrag unter v1). Der bisher technisch erzwungene Vorlauf (`0016:56`) gilt für Staffeln nicht mehr; für künftige Versionen wird er Prüfpunkt der Migration (`valid_from` mindestens Einspieltag plus `fee_notice_days`, außer Beks ordnet es anders an). Hinweis an Beks für die Rechtsprüfung (Konzept Abschnitt 11), kein SQL-Fund.

## Antworten auf die Punkte 1–10

1. **Spalten löschen: ja, mit M1.** „Behalten, nullable“ wäre eine zweite, nicht mehr geprüfte Quelle (neue Zeilen null, kein Guard) und damit der schlechtere Beweis. Kein Zeilen-UPDATE, der Trigger feuert bei `ADD COLUMN … DEFAULT` und `DROP COLUMN` nicht; die Vorgabe 1 bleibt für Bestandszeilen nach `DROP DEFAULT` erhalten. Verlustfrei ist das Löschen aber nur, wenn jede Bestandszeile 15 % trägt; das muss die Migration selbst prüfen (M1). Version 1 (1500 bp, ab 2026-10-28) und die unveränderliche Zeile `fee_rate` in `platform_settings` halten den alten Satz fest.
2. **`partner_offers.fee_schedule_version`: ja, mit M3.** Offene Angebote auf Version 1 entspricht der Vorgabe und dem, was der Firma beim Senden gezeigt wurde (Vorschau mit 15 %). Die Spalte ist für Konten nicht lesbar (Spalten-Grant `0039:9-10` ohne die neue Spalte), der Kunde liest nur `my_request_offers` (`0038:610-611`, ohne Version). Kein Leck.
3. **Exakte Prüfung: richtig, kein Risiko.** Alt (`fee.ts:22`) und neu (`0062:69`) sind dieselbe Ganzzahlformel; Version 1 ergibt für jeden Betrag den bisherigen Wert. Nachtrag: `splitChange` bucht die Differenz zur Journalsumme (`change.ts:33-40`), die kumulierte Gleichung gilt also unabhängig von alten Zeilen; Version je Auftrag fest (`0062:242`). Storno negiert, Pauschale rechnet neu. Die Staffel ist monoton, Differenzen werden nicht negativ (`change.ts:41` bleibt erfüllbar). Weichen TS und SQL ab, scheitert die Buchung (fail closed) statt falsch zu buchen. Netto mit 0,5 Toleranz ist in Ordnung.
4. **Heute keine ausnutzbare Lücke**, aber die unabhängige Sicherung des Guards fehlt: M2 umsetzen.
5. **Zeile `fee_rate` nicht in der Migration löschen.** Sie ist per Trigger unveränderlich (`0016:46-49`); Löschen hieße, in einer Migration eine Sperre zu lockern, und sie ist die Historie des alten Satzes. Aber: Lesbarkeit für Partner jetzt schließen (N3), in den Seeds (`supabase/seed.sql:86`, `seed.prod.sql:86`) die Zeile im Folgeschritt streichen, Restzeilen bestehender Datenbanken in `docs/OPEN_ISSUES.md` vermerken. `drop view current_fee_rates` ist richtig; es gibt keine abhängigen Objekte.
6. **Nicht ausreichend: H1.** Lesen ist richtig geregelt: Firmenmitglieder jedes Status mit aal2 und admin mit aal2 (wie 0027), Kunden und anon nichts; künftige Versionen sind vorab lesbar (angekündigte Bedingungen). `valid_from` = Einspieltag je Umgebung ist in Ordnung.
7. **Angemessen, so lassen (plus N2).** Die Annahme der Vorlage „kein aal2“ stimmt nicht: `my_member_partner_id()` verlangt aal2 (`0023:85`), ebenso das Lesen des Satzes seit 0027 (`0027:11`). Keine Lockerung, kein „aktiv“ nötig (Bedingungen dürfen auch wartende Firmen sehen). `payout_preview` rechnet nur mit der geltenden Version: nur für Vorschauen vor der Bindung verwenden (Listing, Angebotsbetrag: `Anfragen.tsx:101`, `:233`); Beträge laufender Aufträge kommen weiter vom Server (`Auftraege.tsx:215`).
8. **In Ordnung.** Typ, drei Funktionen und Grants entsprechen 0042 (`0042:148-152` gegen `0062:976-980`); `fs.label` ist durch den Fremdschlüssel immer vorhanden. Folgearbeit: `src/lib/partnerJournal.ts:14`, CSV, `db:types`.
9. **Keine weiteren Nutzer.** Alle Aufrufer von `commission_book` (Annahme, Angebot, Nachtrag, beide Stornos, admin-correct, `cancel_reverse_all`) und alle Leser von `bk.fee_rate` haben ihre neueste Definition in 0062; `current_fee()` rufen nur vier neu definierte Funktionen; `journal_sums` (`0040:190-200`) und `propose_change_basis` (0058) nutzen keine Satzspalten; keine Policy, kein Index, keine View hängt an den Spalten. Übrig bleiben nur die Policy aus 0027 (N3), `guard_platform_setting` (Schlüsselnamen, harmlos) und die nicht angepasste `guard_partner_offer` (M3). Seeds schreiben weder Angebote noch Journalzeilen.
10. **Rundung stimmt.** `(2*s + 10000) / 20000` in bigint ist half-up für s ≥ 0 und identisch mit `fee.ts:22`. Von Hand (s = Σ Anteil × bp):

| Version | Basis | s | Provision |
|---|---|---|---|
| 2 | 30000 | 36.000.000 | 3600 |
| 2 | 50000 | 60.000.000 | 6000 |
| 2 | 50001 | 60.001.000 | 6000 |
| 2 | 68961 | 78.961.000 | 7896 |
| 2 | 76041 | 86.041.000 | 8604 |
| 2 | 80000 | 90.000.000 | 9000 |
| 2 | 100000 | 110.000.000 | 11000 |
| 2 | 100001 | 110.000.700 | 11000 |
| 2 | 150000 | 145.000.000 | 14500 |
| 2 | 300000 | 250.000.000 | 25000 |
| 2 | 6900 | 8.280.000 | 828 |
| 1 | 68961 | 103.441.500 | 10344 |
| 1 | 7080 | 10.620.000 | 1062 |
| 1 | 6900 | 10.350.000 | 1035 |

Nachtrag: 8604 − 7896 = 708; Auszahlung 68961 − 7896 = 61065 und 7080 − 708 = 6372; Summe 67437 = 76041 − 8604. Grenze 50000 und 100000 liegen in der unteren Stufe (`least(p_base, up_to) − prev`). Alle Erwartungswerte der Vorlage bestätigt.

## Auflagen ohne SQL (für die Folgeschritte)

- TS `splitFee` mit Stufen: eine Summe, eine Rundung, dieselben Vektoren wie oben plus Halbcent-Fälle; ein Kreuztest TS gegen `payout_preview` über Zufallsbeträge und beide Grenzen.
- `fee_tiers` nie in eine Antwort an Kunden (Angebot bestätigen, Nachtrag, Kundenstorno laufen mit Kunden-Akteur).
- RLS-Tests für beide neuen Tabellen und `payout_preview`: Kunde, anon, Firmenkonto aal1, Firmenkonto aal2 je Status, service_role ohne INSERT/UPDATE/DELETE; Rot-Beweis mit Ist-Wert.
- Migration und Edge Functions je Umgebung zusammen ausrollen; dazwischen scheitern alle Geldwege (alte Signaturen fehlen), das ist fail closed, aber ein Ausfall.
- Tests mit einer dritten Version dürfen das geltende Dev-Schema nicht dauerhaft verstellen (Tabellen sind append-only): Erwartungswerte an die ausdrückliche Version binden oder die Testversion über den Eigentümer-Weg wieder entfernen.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0062:51-71` mit 30000, 50000, 50001, 100001 durchgerechnet | stimmt, Grenze in der unteren Stufe |
| `supabase/functions/_shared/pricing/fee.ts:22` | gleiche Formel wie `0062:69` |
| `supabase/functions/_shared/pricing/change.ts:33-41` | Differenz der Komponenten, wirft bei negativer Komponente |
| `0023:81-86` | `my_member_partner_id()` verlangt aal2; Annahme der Vorlage zu Punkt 7 falsch |
| `0027:8-12` | Satz lesen über denselben Helfer, also aal2 |
| `0016:34-59` | bisheriger Schutz: unveränderlich, Vorlauf; gilt für Staffeln nicht mehr (H1) |
| `0028:187-196` | kein Schreib-Grant aufs Journal, `commission_book` ohne Grant |
| `0038:36-47` | Angebots-Guard ohne die neue Spalte (M3) |
| `0039:9-10`, `0038:610-611` | Version für Konten und Kunden nicht lesbar |
| `0040:204-299` gegen `0062:182-277` | Diff im Log zutreffend, nur Satz-/Versionsstellen |
| `0046:272-288` gegen `0062:283-299` | zutreffend |
| `0046:314-359` gegen `0062:657-702` | zutreffend |
| `0050:24-119` gegen `0062:807-902` | zutreffend |
| `0059:56-133` gegen `0062:706-781` | zutreffend |
| `0042:79-152` gegen `0062:905-980` | Typ und Grants wie vorher, nur die Spalte |
| Signaturen `0062:130`, `:331`, `:405`, `:559`, `:656`, `:728`, `:806` und Grants `0062:983-1009` | passen zu alter und neuer Parameterliste |
| Suche `commission_book(` über alle Migrationen | jede neueste Aufruferdefinition steht in 0062 |
| `tests/rls/change-orders.test.ts:396-400` | Dev kann Zeilen mit Satz 0,10 enthalten (M1) |
| `src/lib/partnerJobs.ts:114-130`, `src/screens/partner/Anfragen.tsx:101`, `:233`, `Auftraege.tsx:215` | Client-Vorschau nur vor der Bindung; `payout_preview` reicht dafür |
| `supabase/seed.sql:86`, `seed.prod.sql:86` | nur die Zeile `fee_rate`; keine Angebote, keine Journalzeilen |

## Für Vorlage 2 nötig

H1 (Grant streichen), M1 (Bestandsprüfung vor dem Löschen), M2 (Version im Guard), M3 (Angebots-Guard), dazu N1–N3 in derselben Datei. Danach neuer Hash und neuer Funktionsdiff; ich prüfe dann nur die geänderten Stellen.

Offene Findings hoch: 1
Keine Freigabe: `0062:33` gibt service_role ein Schreibrecht auf die Staffel (rückwirkend änderbar, kein Vorlauf, H1); dazu fehlen die Bestandsprüfung vor dem Löschen der Satzspalten (M1), die Versionsprüfung im Journal-Guard (M2) und die neue Spalte im Angebots-Guard (M3).
