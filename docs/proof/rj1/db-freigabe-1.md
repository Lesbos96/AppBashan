Modell: claude-fable-5-2

# DB-Freigabe 1 für Schritt rj1

Datum: 2026-11-17
Umfang: Antrag `tmp/proof/rj1/db-antrag-1.json` (eine Datei), Migration 0072 vollständig gelesen (62 Zeilen), beide Rümpfe Zeile für Zeile gegen die letzte Fassung in 0038 (`decline_listing` 0038:433-461, `reject_offers` 0038:592-607) verglichen, gegen das Muster 0069 (`withdraw`, `withdraw_offer`), gegen die Rechte-Anweisungen (0031:249-250, 0038:738-744, 0066:94-97, Defaults 0070 und 0071), gegen alle Schreibstellen auf `job_listings` und alle Stellen mit dem Status `declined` in `supabase/migrations`, gegen das Statustor (0049:16-41), den Ereignis-Trigger (0017:151-197) und die Helfer (0023:81-94, 0031:5-25). Regeln: `.claude/rules/daten.md`, `.claude/rules/geld.md`. Rot-Lauf 001 in `tmp/proof/rj1/` nur am Kopf, an den Fehlerstellen und an `EXIT=` gelesen.

SHA256: 163d7d3158dee989b465773c6714aea486af7b3c9bbec1c1077b762f80e42b9e supabase/migrations/20261117111227_0072_replay_ablehnen.sql

Urteil: frei

Grenzen der Prüfung
- Der Hash ist aus dem Antrag abgeschrieben (Antrag und Auftrag nennen denselben Wert). Ich habe kein Werkzeug, um ihn selbst zu berechnen; den Abgleich mit der Datei macht das Gate.
- Ein Plan zu rj1 liegt unter `tmp/proof/rj1/` nicht als Datei vor. Geprüft habe ich gegen die Punkte aus dem Auftrag und gegen `docs/OFFEN.md:83`.
- Die Rümpfe habe ich Zeile für Zeile gelesen und verglichen, nicht mit einem Diff-Programm.
- Rechte habe ich aus den Migrationen und dem Register `tests/support/positiv.ts` abgeleitet, nicht an der Datenbank abgefragt. Die Migration ist noch nicht angewendet; die grünen Läufe danach sind nicht Teil dieser Freigabe.
- Die Nebenläufigkeit (zwei gleichzeitige Aufrufe) habe ich aus dem Code hergeleitet (Zeilensperren, neuer Schnappschuss je Anweisung bei Read Committed), nicht gemessen. Die Testdatei enthält keinen Wettlauf mit zwei Verbindungen.
- Die Testdatei `tests/rls/replay-ablehnen.test.ts` habe ich gelesen, um den Rot-Lauf einzuordnen, aber nicht abgenommen. `tests/rls/listings.test.ts` und `tests/rls/offers.test.ts` nur an den zwei geänderten Erwartungen. Die Oberfläche und `docs/` sind nicht Teil dieser Freigabe.

## Findings

### hoch
Keine.

### mittel
Keine.

### niedrig
- N1 `supabase/migrations/20261117111227_0072_replay_ablehnen.sql:54-57` – `reject_offers` prüft das gelöschte Profil nicht (auch die Vorfassung nicht, 0038:599-603). `declined` ist ein Endzustand, mit dem `delete_account` durchläuft (0066:33); ein gelöschtes Konto mit noch gültigem Zugriffstoken bekommt bei der Wiederholung jetzt „ok“ statt `invalid_transition`. Keine Schreibwirkung, keine Daten in der Antwort (Rückgabe `void`), nur die eigene Anfrage. – Fix: keiner nötig. Wer es einheitlich will, ergänzt bei der nächsten Änderung an `reject_offers` dieselbe Profilprüfung wie in 0066:83. Kein Grund, den Push aufzuhalten.
- N2 `docs/OFFEN.md:83` – Der Eintrag sagt, `decline_listing` habe keinen App-Aufruf. Im Stand des Zweigs gibt es ihn (`src/lib/partnerJobs.ts:208-210`, `src/screens/partner/Anfragen.tsx:173`). Für die Migration ohne Folge (eine verlorene Antwort endet danach mit Erfolg statt mit der Fehlerart `taken`, `src/lib/partnerJobs.ts:24`). – Fix: den Eintrag beim Abschluss von rj1 berichtigen oder schließen.

## Prüffragen

Rümpfe gegen 0038 (Unterschied nur je ein Replay-Block): ja.
- `decline_listing`: 0072:10-27 = 0038:433-450 (Kommentar, Kopf, `security definer`, `search_path = ''`, Deklaration, `not_found`, `mfa_required`, `partner_not_active`, Eigentumslesung, Sperre der Anfrage, Sperre des Listings). Neu nur 0072:28-29. 0072:30-40 = 0038:451-461 (`invalid_transition`, `offer_exists`, UPDATE, T8 mit Outbox). 0038 ist die jüngste Fassung (frühere: 0031:166, 0034:104; danach keine).
- `reject_offers`: 0072:42 hat `create or replace` statt `create` (0038:592), sonst 0072:43-52 = 0038:593-602. Neu nur 0072:53-57. 0072:58-62 = 0038:603-607. 0038 ist die einzige Vorfassung.
- Signatur und Rückgabetyp beider Funktionen sind gleich (`uuid`, `void`); ein anderer Rückgabetyp ließe `create or replace` scheitern, nichts halb angewendet.
- Die Blöcke folgen dem Muster 0069: `decline_listing` wie `withdraw_offer` (0069:126-127, Firma als Partei, Zustand der eigenen Zeile), `reject_offers` wie `withdraw` und `start_job` (0069:31-34, 0069:60-63, Status plus Ereignis mit Akteur und Rolle).

Rechte: unverändert, nur `authenticated`.
- `decline_listing`: PUBLIC und `anon` entzogen, `authenticated` gewährt (0031:249-250); `service_role` entzogen (0066:94-97).
- `reject_offers`: allen vier (PUBLIC, `anon`, `authenticated`, `service_role`) entzogen, dann nur `authenticated` gewährt (0038:738-744).
- 0072 enthält kein `grant` und kein `revoke`. `create or replace` behält Eigentümer und Rechte; die Defaults aus 0070 und 0071 wirken nur auf neue Objekte. Register: beide `als: 'authenticated'` (`tests/support/positiv.ts:208, 210`).
- Keine neue Funktion, keine Rechte-Ausweitung, kein neuer Leseweg.

1. Replay hinter aal2, aktiver Firma, Eigentum und Sperren: ja.
   - `decline_listing`: Anmeldung (0072:20), aal2 (0072:21), aktive Firma über `my_partner_id` (0072:22-23; die Funktion verlangt Status `active` und aal2, 0023:89-94), eigenes Listing (0072:24-25), Sperre der Anfrage (0072:26), Sperre des Listings (0072:27), erst dann der Block (0072:29).
   - `reject_offers`: Anmeldung (0072:49), eigene Anfrage (0072:50-51), Sperre (0072:52), dann der Block (0072:54-57). aal2 verlangt die Funktion für Kunden nicht, wie im Bestand.
   - Der Test belegt die Reihenfolge von außen: nach der Sperrung der Firma endet die Wiederholung mit `partner_not_active` (`tests/rls/replay-ablehnen.test.ts:121-123, 161`), mit aal1 mit `mfa_required`, für die fremde Firma und den fremden Kunden mit `not_found` (Zeilen 143-145, 218-219).
2. Wer setzt `declined`: nur diese beiden Funktionen.
   - Am Listing: `declined` schreiben nur die Fassungen von `decline_listing` (0031:184, 0034:122, 0038:455, 0072:34). Alle anderen Schreibstellen setzen `closed` oder `accepted` und nur auf offene Zeilen: `close_listings` (0030:171, `status = 'open'`), `admin_set_partner_status` (0038:497, 0039:201, `status = 'open'`), `confirm_offer` (0039:141, 0062:506, `status = 'open'`), `partner_accept` (0062:423, nach der Prüfung unter Sperre in 0062:409-411, die bei `declined` mit `listing_declined` endet). `declined` am Listing ist damit ein Endzustand.
   - Eine neue Zeile für dasselbe Paar entsteht nicht: `unique (request_id, partner_id)` (0030:48), die Verteilung fügt nur ein, wenn die Anfrage noch kein Listing hat (0038:331, 0046:243), kein `on conflict` auf Listings.
   - Kein Konto hat DML auf `job_listings` (0030:120-124).
   - An der Anfrage: `set_request_status(…, 'declined', …)` steht nur in `reject_offers` (0038:605, 0072:60); kein anderes UPDATE setzt den Status auf `declined`. Das Statustor lässt `declined` nur aus `offered` zu und nur mit Marker (0049:32, 0049:36-38); aus `declined` führt kein Paar heraus (0049:23-33). Das Ereignis schreibt der Trigger mit Akteur und Rolle aus den Einstellungen der Übergangsfunktion (0017:179-197, 0031:9-11); kein Konto hat Schreibrecht auf `status_events` (0017:171-172).
   - Die zusätzliche Ereignisprüfung in 0072:55 ist damit Gürtel zum Hosenträger; sie hält den Replay auch dann zu, wenn `declined` je auf anderem Weg entsteht (Test R4, R5, `tests/rls/replay-ablehnen.test.ts:197-203`).
   - Am Listing gibt es keinen Akteur; die Firma ist die Partei (jedes aal2-Mitglied der aktiven Firma), wie bei `withdraw_offer` in 0069:126-127. Ein Listing `declined` mit gesendetem Angebot derselben Firma kann es nicht geben (`offer_exists` vor dem Ablehnen, 0072:31-33; `listing_declined` vor dem Angebot, 0068:111), der Block überspringt also keine wirksame Prüfung.
3. Existenz-Orakel und Wettlauf: kein neues Orakel, der Wettlauf trägt.
   - Fremdes oder unbekanntes Listing: `not_found` vor dem Block (0072:24-25), gleicher Code für beide Fälle, wie bisher. Fremde oder unbekannte Anfrage: `not_found` (0072:50-51). Der Block antwortet nur dem Eigentümer und sagt ihm nur, was er selbst getan hat; die Firma konnte „abgelehnt“ schon bisher von „geschlossen“ unterscheiden (`listing_declined` gegen `already_taken`, 0062:410-411).
   - Zwei gleichzeitige Aufrufe derselben Firma: beide bestehen die Lesung ohne Sperre (0072:24), der zweite wartet an der Anfrage (0072:26), liest danach das Listing mit neuem Schnappschuss (0072:27) und endet in 0072:29 mit Erfolg ohne Wirkung. Vorher endete er mit `invalid_transition`.
   - Zwei gleichzeitige Aufrufe desselben Kunden: der zweite wartet in 0072:52, bekommt die aktuelle Zeile (`declined`) und sieht in 0072:55 das inzwischen geschriebene Ereignis (eigene Anweisung, neuer Schnappschuss; die Funktion ist volatil).
   - Sperrreihenfolge unverändert: Anfrage vor Listing (0072:26-27 = 0038:449-450). Der Block liegt hinter beiden Sperren und nimmt keine weitere; kein neues Deadlock-Paar. Alle Schreiber des Listings halten zuvor die Anfrage (Trigger auf der Anfrage, 0030:178-180; `admin_set_partner_status` 0038:482; `partner_accept` 0038:407).
   - Sperrdauer: Der Replay hält die beiden Zeilensperren so kurz wie bisher der Fehlerweg (der sperrte auch vor `invalid_transition`); kein neuer Hebel, um andere aufzuhalten.
4. Replay schreibt nichts: ja.
   - `decline_listing`: `return` in 0072:29 vor dem UPDATE (0072:34), vor `set_request_status` (0072:36) und vor `outbox_put` (0072:37). Kein Status, kein `decided_at`, kein Ereignis, keine Outbox-Zeile.
   - `reject_offers`: `return` in 0072:56 vor dem UPDATE der Angebote (0072:59) und vor `set_request_status` (0072:60); damit laufen auch die Trigger `close_offers` (0038:198-215), `close_listings` und der Ereignis-Trigger nicht.
   - Der Test vergleicht vor und nach der Wiederholung Ereignisse, Outbox, Audit, `decided_at` von Listings und Angeboten (zurückdatiert, damit ein neues `now()` auffiele) und den Status (`tests/rls/replay-ablehnen.test.ts:56-66, 137-138, 216`), dazu die Zähler: ein Ereignis `unmatched`, eine Outbox-Zeile, ein Ereignis `declined` (Zeilen 140-141, 215).

Geld und Kundendaten: nicht berührt. Keine Tabelle, keine Spalte, keine Policy, kein Trigger, keine Daten, kein Seed, kein Secret. Keine Betragsrechnung, kein Journalzugriff, kein neuer Leseweg auf Gebühr oder Staffel. Beide Rümpfe `security definer` mit `search_path = ''`, alle Objekte mit Schema genannt. Fester Akteur je Übergang bleibt (`customer` mit `uid` in 0072:60, `system` bei T8 in 0072:36).

Edge Functions: keine ruft eine der beiden Funktionen (Treffer nur in `supabase/functions/_shared/database.types.ts:1762, 2125`); Signaturen und Rückgabetypen bleiben gleich, kein Zwang zum Neu-Deploy.

Rot-Lauf 001 (Stand davor, Commit b173845, `EXIT=1`, `Argumente: []`, `Schalter: []`): zählt. Beide Tests scheitern an der ersten Wiederholung mit dem Ist-Wert `P0001: invalid_transition` statt „ok“ (Log Zeilen 24-27 und 40-43; Erwartungen `tests/rls/replay-ablehnen.test.ts:130, 213`). Das misst die fehlende Wirkung, nicht nur einen Abbruch: die Erwartungen davor (aal1, Kunde, fremde Firma, erster Aufruf) bestehen. `runs.jsonl:1` trägt Exit 1 und den `dateiSha` der Testdatei.

## Stichproben (selbst nachgeschlagen)

- `tmp/proof/rj1/db-antrag-1.json:3-4` – eine Datei, Hash wie im Auftrag. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:433-461` – Vorfassung `decline_listing`; gleich bis auf 0072:28-29. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:592-607` – Vorfassung `reject_offers`; gleich bis auf `or replace` und 0072:53-57. In Ordnung.
- `supabase/migrations/20261116140000_0069_replay_rest.sql:31-34, 60-63, 126-127` – Muster der Blöcke (Status plus Ereignis mit Akteur; Firma als Partei). In Ordnung.
- `supabase/migrations/20261108140000_0031_distribute_accept.sql:249-250` – Rechte `decline_listing`. In Ordnung.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:94-97` – `service_role` für `decline_listing` entzogen. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:738-744` – Rechte `reject_offers`, nur `authenticated`. In Ordnung.
- `supabase/migrations/20261116150000_0070_default_privileges.sql:7`, `supabase/migrations/20261116160000_0071_public_default.sql:7` – nur Defaults für neue Objekte. In Ordnung.
- `tests/support/positiv.ts:185, 208, 210` – Register: Kunde aal1 bzw. Firma aal2, beide `authenticated`. In Ordnung.
- `supabase/migrations/20261107100000_0023_partners.sql:89-94` – `my_partner_id`: Mitglied, Firma `active`, aal2. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:4, 30-49, 120-124, 167-180` – Statuswerte, Eindeutigkeit, kein DML für Konten, `close_listings` nur auf offene Zeilen. In Ordnung.
- `supabase/migrations/20261109110000_0039_s9e_abnahme.sql:141, 201` und `supabase/migrations/20261114100000_0062_fee_schedule.sql:409-411, 423, 506` – übrige Schreiber setzen `closed` oder `accepted`, nie auf eine abgelehnte Zeile. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:331`, `supabase/migrations/20261109180000_0046_cancel_by_partner.sql:243` – Verteilung nur ohne vorhandene Listings. In Ordnung.
- `supabase/migrations/20261109210000_0049_admin_correct.sql:16-41` – jüngstes Statustor: `declined` nur aus `offered`, kein Paar aus `declined` heraus, Marker nötig. In Ordnung.
- `supabase/migrations/20261101180000_0017_status_machine.sql:153-197` – `status_events` nur anfügen, nur der Trigger schreibt, Akteur aus den Einstellungen. In Ordnung.
- `supabase/migrations/20261108140000_0031_distribute_accept.sql:5-25` – `set_request_status` setzt Marker und Akteur; `outbox_put` mit `on conflict do nothing`. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:198-215` – `close_offers` läuft nur bei Statuswechsel, im Replay also nicht. In Ordnung.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:23-36` – Löschung läuft bei `declined` durch; Grundlage für N1.
- `src/lib/partnerJobs.ts:19-55, 208-210`, `src/screens/partner/Anfragen.tsx:173` – App-Aufruf von `decline_listing` vorhanden, `invalid_transition` bisher als `taken`; Grundlage für N2.
- `tests/rls/replay-ablehnen.test.ts:72-162` – Firma: Wiederholung vor und nach T8, aal1, Kunde, fremde Firma, geschlossene und angenommene Listings, `offer_exists`, gesperrte Firma. In Ordnung (gelesen, nicht abgenommen).
- `tests/rls/replay-ablehnen.test.ts:165-231` – Kunde: Wiederholung, fremder Kunde, Firma, ohne Angebot, nach Rückzug, `declined` durch andere Person und durch System. In Ordnung (gelesen, nicht abgenommen).
- `tests/rls/listings.test.ts:257`, `tests/rls/offers.test.ts:417` – die zwei alten Erwartungen „nochmal“ stehen jetzt auf „ok“ mit Verweis auf 0072. In Ordnung.
- `tmp/proof/rj1/001-tests_rls_replay-ablehnen.test.ts.log:1-5, 15-27, 39-43, 56-57, 65` – Kopf ohne Argumente und Schalter, zwei Tests rot mit Ist-Wert `invalid_transition`, `EXIT=1`. In Ordnung.
- `tmp/proof/rj1/runs.jsonl:1` – Lauf 1 über das Start-Programm, Exit 1, `dateiSha` gesetzt. In Ordnung.

Offene Findings hoch: 0
