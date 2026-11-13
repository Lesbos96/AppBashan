# s9i-7c2 Fakten (lesend geprüft, Kennung 7c2-1311-a)

Alle Angaben aus dem Code von main 6e6bd5c; Pläne früherer Sessions nicht übernommen.

## Schritte W1 bis W3

| Schritt | Aufruf | Akteur, aal | Bedingung (DB-Uhr) | Wirkung |
|---|---|---|---|---|
| Anfrage | **Fixture** (SQL, wie journal-live.test.ts:83-90): `service_requests` + `price_revisions` n=1 + `distribute_request` | Eigentümer | Edge `quote` ist live nicht getestet (nur e2e-Mock, tests/e2e/anfrage-helpers.ts:30; Routenanbieter extern) | Status `requested`, Listing je Firma im Bezirk 21 mit Leistung `move` (`partner_categories`, Zone `private.in_scope`, 0034:5) |
| Zuschlag | Edge `accept` `{listingId, revisionId, shownPayoutCents}` (src/lib/partnerJobs.ts:209) → `partner_accept` | Firma, aal2 | `accept_deadline > now()` (0038:415), Status `requested`, Firma `active` (0038:409); **kein** termin_at-Bezug | `accepted`, Zuordnung, Journal `booking` (0038:427); Auftrag mit `source=partner_offer` wäre für Nachtrag gesperrt (0040:361), daher Festpreis-Weg |
| Start | RPC `start_job(p_request)` (0032:4) | Firma, aal2 | `now() >= termin_at` (0032:21), Status `accepted` | `in_progress` |
| Beleg | Edge `photo-receipt?request=` JPEG-Body (partnerChange.ts:185); legt `job_photos` kind=receipt **direkt als `ready`** an (0035:319-320); `photo_claim`/CLAIM_ALL gehört nur zu Kundenfotos (`kind=request`, 0035:171), nicht zu Belegen | Firma, aal2 | Zuordnung offen, Limit 8 | Belegzeile + Storage-Objekt im Bucket `job-photos` |
| Nachtrag | Edge `change-propose` `{requestId, changes, photoIds, shownTotalCents}`; Vorschau `preview:true` | Firma, aal2 | `change_gate`: Status accepted/in_progress (0040:322); Festpreis, erhöhend, 1-8 Belege, kein offener Nachtrag (0040:361-372); `valid_until = now()+change_valid_hours` | Revision `change_order` Status `proposed`; kein Journal |
| Zustimmung | Edge `change-decide` `{revisionId, decision:'accept', shownTotalCents}` → `decide_change` | Kunde (aal1 genügt) | nicht abgelaufen (0040:442), Status accepted/in_progress | Revision `accepted`, Zeiger, Journal `change` mit Differenz (0040:477); Ablehnen: `declined`, kein Journal |
| Abschluss | RPC `complete_job(p_request)` (0043:4) | Kunde | `now() >= termin_at`, Status accepted/in_progress, nicht gemeldet (0043:17) | `completed`, Zuordnung `ended_reason=completed` |
| Storno Firma | Edge `cancel-partner` `{requestId, reason, photoIds?, shownCallOutCents, preview?}` → `cancel_by_partner` | Firma, aal2 (Status active oder payment_hold, 0040:318) | Grund `unavailable`/`other` nur `now() < termin_at` (0059:28); `scope_impossible` jederzeit; Pauschale nur bei Grund `scope_impossible` **und** letztem nicht zurückgezogenem Nachtrag declined/expired (0059:7-14) | `cancelled_by_partner`, `cancel_reverse_all` (Gegenbuchungen), bei Pauschale Zeile `cancellation_fee`, sonst `reissue_request` (neue Folgeanfrage) (0059:107-123) |
| job_contact | RPC | Firma, aal2 | Zugriffsfenster `partner_access_days` (0030:87); nach `cancelled_by_partner` nur bei fälliger Pauschale (0060:34-38) | sonst `not_assigned` |
| my_cancel_info | RPC | Kunde | nur eigener Auftrag | Pauschale in Cent |
| Journal lesen | RPC `my_commissions(p_month)` (0042:133) | Firma, jeder Firmenstatus, aal2 | – | Zeilen nur mit Endstatus-Ereignis |

## Zeitbedingungen
- Eine Wiener-Tagesende-Bedingung gibt es in keinem dieser Schritte; nur `now()` gegen `termin_at` (timestamptz) und `accept_deadline`. Fixtures setzen `termin_at` relativ zur DB-Uhr (`now() - interval '2 hours'` für Start/Abschluss, `now() + interval '14 days'` für Storno vor dem Termin). Direktes Einfügen mit vergangenem `termin_at` ist üblich (completion.test.ts:34, 51).

## Journal und Monat
- `billing_month` je Zeile = Monat (Europe/Vienna) von `greatest(min(Endstatus-Ereignis), created_at)` (0042:110-113); Aufträge ohne Endstatus erscheinen nicht. Kurz vor Monatswechsel können Zeilen eines Auftrags in verschiedenen Monaten stehen. Der Test ruft daher `my_commissions` ohne Monat (alle Monate) auf, filtert auf die eigenen Aufträge und prüft jede Zeile gegen den in der Datenbank berechneten Erwartungsmonat.

## Wiederverwendung aus journal-live.test.ts
- Fixture `job()` (Zeilen 83-90) mit Terms-Block (`call_out_fee_cents` 6900), `firm()`/`insertUsers`/`grantAdmin` (tests/support/partner.ts), `tryAal2User` mit `freshCode` (totp.ts:19), `fn()` für Edge Functions, `appCall` (my_commissions wie die App), `journalCsv` Zeilen 188-199 (Cent aus „69,00“), `sweepTestResidue(adm[, true])` + `deleteUsers()`.
- Unterschied zu J1/J2/J4: dort werden Zuschlag und Nachtrag per SQL (`partner_accept`, `propose_change`, `decide_change`) gesetzt; flow-live ruft sie über die deployten Wege auf.

## Aufräumen
- Journal, Zuordnungen, Belege, Nachträge sind unlöschbar (sweep.ts:15): Firmen werden gesperrt, Kunde/Aufträge bleiben. Neu: Belege aus `photo-receipt` liegen als Objekte im Bucket `job-photos`; sie fallen nach `receipt_retention_days` (365) über `photo_purge` (0055). Storage-Objekte dieses Laufs werden am Ende per Storage-API gelöscht; die Zeilen in `job_photos` bleiben (unlöschbar, referenzieren das Journal).
