Modell: claude-fable-5-2

# DB-Freigabe 1, Schritt bl1, Migration 0073 (Belege, reject_offers)

Datum: 2026-11-17
Antrag: tmp/proof/bl1/db-antrag-1.json (eine Datei, Hash von dort abgeschrieben; in dieser Sitzung steht kein Werkzeug zum Nachrechnen bereit, den Vergleich mit dem Dateiinhalt macht das Gate).
Umfang: supabase/migrations/20261117190247_0073_belege.sql vollständig (174 Zeilen), Zeile für Zeile gegen die letzten Fassungen: private.receipt_gate und public.photo_receipt_add (0035:278-323), public.my_job_changes (0058:6-47), public.propose_change (0041:5-48), public.reject_offers (0072:42-62), Muster Profilprüfung (0066:83). Dazu .claude/rules/geld.md, .claude/rules/daten.md, tmp/proof/bl1/plan.md, private.change_gate (0064:176-199), private.assignment_access (0030:87-95), private.partner_cancel_fee (0059:35-49), Spalten und Checks von price_revisions (0040:7-27) und job_photos (0035:15-40), Aufrufer in supabase/functions/_shared/photo (handlers.ts:97-121, db.ts:52-62) und src (partnerChange.ts:79, Nachtrag.tsx:91, Absage.tsx:84).
Nicht geprüft: Testdateien und Testläufe des Schritts (Sache der Abnahme), Verhalten auf der Datenbank (die Migration ist noch nicht eingespielt; alle Aussagen stammen aus dem Lesen des SQL).

## Befunde

### hoch
Keine.

### mittel
- M1 · supabase/migrations/20261117190247_0073_belege.sql:12-34 und :47 (mit supabase/functions/_shared/photo/handlers.ts:106-116) – Das Limit 8 steht nicht mehr im Tor, also auch nicht mehr in photo_receipt_check. Bei acht vorhandenen Belegen und bei jeder Wiederholung desselben Bildes liest die Edge Function jetzt den Body, verarbeitet ihn und lädt die Datei hoch, bevor photo_receipt_add ablehnt (receipt_limit) bzw. die alte Id liefert. Jede solche Datei liegt ohne Zeile bis zum Aufräumen (frühestens nach 1 h, 0035:395-396) im Bucket. Vorher war das nur über parallele Aufrufe möglich, jetzt auch nacheinander und ohne Obergrenze. Akteur ist nur ein Partner-Konto mit aal2, aktiver Firma und aktiver Zuordnung; keine Geldwirkung, keine Datenoffenlegung, das Limit selbst bleibt unter der Sperre der Anfrage hart. Die Reihenfolge ist Auflage 3 und damit gewollt; der Befund sperrt nicht. – Fix (kein Eingriff in die Migration): OFFEN S9d-4 (docs/OFFEN.md:43) im selben Schritt erweitern (nicht mehr nur „parallele Uploads“, sondern auch Wiederholung und Aufrufe am Limit; Rate-Limit je Partner bleibt Voraussetzung für den Start), und den Kommentar in handlers.ts:87 („Limit“ in der Torprüfung) bei der nächsten Änderung an der Datei berichtigen. Ob die Edge Function die eben hochgeladene Datei bei Ablehnung oder Dedupe sofort entfernt, gehört in einen eigenen Schritt.

### niedrig
- N1 · supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:41-45 gegen 0073:81-84 – „Verbraucht“ gilt nach 0073 für propose_change (Server) und für receipt_ids (Liste für beide Masken, src/screens/partner/Absage.tsx:84), nicht aber für private.partner_cancel_fee: ein direkter Aufruf der Absage kann die Anfahrtspauschale weiter mit einem Beleg begründen, der schon an einem angenommenen Nachtrag hängt. Kein Rückschritt (Server wie vorher, Oberfläche enger), aber Server und Oberfläche laufen auseinander. – Fix: als Punkt in docs/OFFEN.md aufnehmen (entweder dieselbe Regel in partner_cancel_fee oder ausdrücklich festhalten, dass die Absage verbrauchte Belege annimmt); keine Änderung an 0073.
- N2 · 0073:43-46 mit :128-132 – Lädt die Firma für einen zweiten Nachtrag dasselbe Bild erneut hoch, liefert die Dedupe die Id des alten, schon verbrauchten Belegs (Antwort 200). Die Maske zählt ihn als vorhanden (src/screens/partner/Nachtrag.tsx:91), der Server lehnt den Nachtrag dann mit receipt_required ab. Serverseitig richtig (geschlossen), für die Firma schwer zu deuten. – Fix: Folgepunkt in OFFEN (Meldung in der Maske oder Test, der den Fall festhält); keine Änderung an 0073.
- N3 · 0073:95 – `private.assignment_access(a.request_id, pid)` ist neben `a.ended_at is null` immer wahr (0030:93), also wirkungslos. Bleibt wegen der Auflage „Rumpf sonst wörtlich“ richtig stehen. – Kein Fix.
- N4 · 0073:2 – Der Kopfkommentar sagt, `stable` stehe „in jeder Fassung“; es steht nur bei my_job_changes (richtig so, die anderen vier waren und bleiben volatile). Nur Kommentar. – Kein Fix nötig (eine Änderung würde den Hash ändern und einen neuen Antrag verlangen).
- N5 · 0073:163 – Die Profilprüfung liest ohne Sperre: eine Kontolöschung, die unmittelbar nach der Prüfung festgeschrieben wird, lässt die laufende Ablehnung noch durch. Gleiche Restlücke wie im Muster 0066:83, dort so entschieden. – Kein Fix.

## Auflagen 1 bis 6

1. Attribute: erfüllt. Alle fünf `create or replace` tragen `language plpgsql security definer set search_path = ''` (0073:13, :37, :69, :102, :152); my_job_changes zusätzlich `stable` (0073:69 wie 0058:20). Die vier anderen waren im Vorgänger ohne Volatilitätsangabe (0035:279, 0035:312, 0041:7, 0072:43) und sind es weiter. Signaturen und Rückgabetypen unverändert, bei my_job_changes alle elf Ausgabespalten in Name, Typ und Reihenfolge gleich (0073:56-68 gegen 0058:7-19). Kein `alter function` in irgendeiner Migration, das ein `create or replace` zurücksetzen könnte (Suche über supabase/migrations ohne Treffer).
2. Rechte: erfüllt. In der Datei steht kein grant und kein revoke (Suche ohne Treffer; die Wörter kommen nur im Kommentar Zeile 1 vor). `create or replace` behält Eigentümer und Rechte: receipt_gate ohne EXECUTE für Rollen (0035:325), photo_receipt_add nur service_role (0035:416-426), my_job_changes nur authenticated (0058:49-50, 0066:94-97), propose_change nur service_role (0040:564-569), reject_offers authenticated (0038:739-744). Keine neue Funktion, also kein neuer Eintrag in tests/support/positiv.ts nötig.
3. Reihenfolge photo_receipt_add: erfüllt. Tor in der Deklaration (0073:40), Dedupe mit `order by j.created_at, j.id limit 1` über Anfrage, Art receipt, eigene Firma und Hash (0073:43-46), Limit (0073:47, wörtlich die aus dem Tor entfernte Zeile 0035:298), file_missing (0073:48 wörtlich 0035:318), Insert (0073:49-50 wörtlich 0035:319-320). Das Tor ist bis auf die entfernte Limit-Zeile wörtlich 0035:278-301.
4. reject_offers: erfüllt. Profilprüfung in 0073:163, nach `for update` der Anfrage (0073:161) und vor dem Replay-Zweig (0073:165-168), Wortlaut wie 0066:83, keine Sperre auf profiles. Alle übrigen Zeilen wörtlich 0072:42-62.
5. „Verbraucht“: erfüllt, an beiden Stellen gleich: Revision derselben Anfrage, `source = 'change_order'`, `status = 'accepted'`, Id in `photos` (0073:83-84 und :129-130). Abgelehnte, abgelaufene, zurückgezogene und offene Nachträge verbrauchen nichts. Alle Spalten im neuen Unterabfrage-Teil sind mit Alias angesprochen (`u.`, `j.`), also kein Namenskonflikt mit den Ausgabespalten `request_id`, `source` der Tabellenfunktion.
6. propose_change: erfüllt. Die bisherige Prüfung steht vollständig und wörtlich da (0073:121-126 gegen 0041:26-31), der neue Block folgt danach (0073:127-132). Alle anderen Zeilen wörtlich wie 0041:5-48 (Tor, Basis, Festpreis, offener Nachtrag, erhöhend, Eingaben, Snapshot, Marker, Insert, Audit, Outbox).

## Prüffragen aus dem Auftrag

- Unbeabsichtigte Abweichungen vom Vorgänger: keine gefunden. Abweichungen sind genau: Limit-Zeile aus dem Tor nach add verschoben; Dedupe-Block in add; `not exists`-Teil in receipt_ids; `a.ended_at is null`; Verbrauchs-Block in propose_change; Profilprüfung in reject_offers; `create` wird zu `create or replace` (receipt_gate, photo_receipt_add, my_job_changes).
- Wettlauf: Tor und change_gate sperren die Anfrage `for update` (0073:24, 0064:188), danach die Firma `for share` (Reihenfolge wie 0035:3). Zwei gleichzeitige adds mit gleichem Hash: der zweite wartet im Tor, die Dedupe-Abfrage ist eine spätere Anweisung und sieht unter Read Committed die festgeschriebene Zeile des ersten; Ergebnis eine Zeile, beide dieselbe Id. Limit unter derselben Sperre, also höchstens acht. Verbrauchsprüfung in propose_change läuft unter der Sperre der Anfrage; decide_change setzt `accepted` unter derselben Sperre (0041:71, gleiche Stelle in der letzten Fassung 0064:203 ff.), dazu der Unique-Index für einen offenen Nachtrag (0040:27). Ein fehlender Unique-Index auf Hash ist vertretbar: Belege schreibt nur photo_receipt_add (job_photos ohne DML-Rechte, 0035:64-66), Altbestand mit Dubletten bleibt lesbar, die Dedupe nimmt die älteste Zeile. Voraussetzung ist die Isolationsstufe Read Committed des Aufrufers (PostgREST-Standard); my_job_changes ist nur Anzeige, maßgeblich bleibt propose_change.
- Rechte und Missbrauch: keine Ausweitung. Die Dedupe gibt nur eine Id der eigenen Firma zur selben Anfrage zurück (kein Blick auf Belege anderer Firmen). p_sha NULL trifft keine Zeile und scheitert danach wie bisher am Check der Tabelle (0035:35). p_photos mit NULL-Elementen oder Dubletten scheitert weiter an der alten Prüfung. Ein verbrauchter Beleg allein reicht nicht mehr; ein verbrauchter neben einem neuen bleibt erlaubt (Plan Nr. 3). my_job_changes wird enger (beendete Zuordnung liefert keine Zeile, weniger Ids), nie weiter. reject_offers wird enger. Restpunkte: M1, N1.
- Kundensicht auf die Gebühr: unberührt. Keine der fünf Funktionen liest oder liefert commission_entries, fee_schedules oder einen Gebührenwert; my_job_changes hat dieselben Spalten wie 0058 (keine Gebühr, kein Snapshot, kein Pfad); der Snapshot des Nachtrags trägt weiter nur die Zeilen `booked` und `change_order` (0073:134-137 wörtlich 0041:33-36); reject_offers gibt nichts zurück. Keine Betragsrechnung geändert, alle Beträge bleiben bigint-Cent.
- Regeln: daten.md erfüllt (SECURITY DEFINER mit festem search_path, fester Akteur je Übergang, kein direktes UPDATE auf Status, keine Seed-Daten, Fotolimit 8 bleibt serverseitig). geld.md nicht berührt. Edge Functions: keine Signatur und kein Rückgabetyp ändert sich, ohne Dateiänderung unter supabase/functions ist kein Deploy nötig; `db:types` bleibt inhaltlich gleich.

## Stichproben (selbst nachgeschlagen)

- supabase/migrations/20261108180000_0035_job_photos.sql:278-301 gegen 0073:12-34 – wörtlich gleich bis auf die entfernte Zeile 298.
- supabase/migrations/20261108180000_0035_job_photos.sql:311-323 gegen 0073:36-53 – Dedupe und Limit eingefügt, Rest wörtlich.
- supabase/migrations/20261108180000_0035_job_photos.sql:29-32 – Belege sind per Check immer `ready` und tragen eine Firma; die Dedupe braucht daher keinen Statusfilter.
- supabase/migrations/20261108180000_0035_job_photos.sql:40 – Index (request_id, kind, status) trägt Dedupe und Zählung.
- supabase/migrations/20261112110000_0058_my_job_changes.sql:25-45 gegen 0073:74-96 – zwei Einfügungen (Zeilen 83-84 und `a.ended_at is null` in 95), Rest wörtlich; Klammern der neuen Unterabfrage geschlossen.
- supabase/migrations/20261109130000_0041_s9f_abnahme.sql:17-46 gegen 0073:112-147 – wörtlich, ein Block mehr (127-132).
- supabase/migrations/20261117111227_0072_replay_ablehnen.sql:49-60 gegen 0073:158-171 – wörtlich, zwei Zeilen mehr (162-163).
- supabase/migrations/20261116022741_0066_execute_entzug.sql:83 – Wortlaut der Profilprüfung stimmt mit 0073:163 überein.
- supabase/migrations/20261110100000_0052_account_deletion.sql:7 – Spalte profiles.deleted_at vorhanden.
- supabase/migrations/20261109120000_0040_change_orders.sql:14, :19-23 – `photos uuid[]`, nur bei change_order gesetzt (1 bis 8), Status als Text mit `accepted` in der erlaubten Menge; die Abfrage `= any (u.photos)` passt zum Typ.
- supabase/migrations/20261115104122_0064_report_flow.sql:176-199 – change_gate (letzte Fassung) sperrt die Anfrage `for update`; propose_change prüft „verbraucht“ unter dieser Sperre.
- Suche nach späteren Fassungen der fünf Funktionen in supabase/migrations – letzte Definitionen sind 0035:278, 0035:311, 0058:6, 0041:5, 0072:42; die im Auftrag genannten Vorgänger sind die gültigen.
- supabase/functions/_shared/photo/handlers.ts:106-116 – Reihenfolge check, Body, Verarbeitung, Upload, add; Grundlage für M1.
- src/lib/partnerChange.ts:79, src/screens/partner/Nachtrag.tsx:91, src/screens/partner/Absage.tsx:84 – receipt_ids speist beide Masken; Grundlage für N1 und N2.
- docs/OFFEN.md:28, :43, :82, :86 – die Punkte S9i7-1/2/3/12, S9d-4, n12-1 und rj1-2 stehen dort und passen zum Inhalt der Migration.

SHA256: eb93f02992d2ac789e9f120681bf109b7c96e4cbf96a9bb77962b4a4b5f3609b supabase/migrations/20261117190247_0073_belege.sql
Urteil: frei

Offene Findings hoch: 0
