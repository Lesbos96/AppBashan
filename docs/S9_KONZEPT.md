# MoveNow · S9-Konzept: Partner, verbindliche Buchung, Abrechnung

Stand: 2026-11-01. Reines Konzeptdokument: kein Code, keine Migration, kein SQL zum Ausführen. Es beschreibt, was gebaut werden soll, damit Beks entscheiden kann. Nichts hier ist umgesetzt oder freigegeben, bevor Beks es bestätigt.

Kennzeichnung: **[Entscheidung Beks]** = feste Vorgabe (E1–E5). **[Entwurf]** = mein Vorschlag zur Umsetzung der Entscheidungen, noch nicht freigegeben. **[Vorschlag – Beks bestätigt]** = offene Entscheidung (Abschnitt 10). **[Frage Recht]** = nicht geklärt, geht an Anwalt/WKO (Abschnitt 11). **[B#n]** = eingearbeitetes Finding n aus dem Berater-Bericht Runde A (`tmp/proof/s9-konzept-berater-plan.md`). **[Finding n]**, **[R2-n]**, **[R3-n]** = Finding n aus der Abnahme Runde 1, 2 bzw. 3 (`tmp/proof/s9-konzept-abnahme-runde1.md`, `-runde2.md`, `s9-konzept-abnahme.md`).

Beleg-Kürzel für Dateien (Abschnitt 2): `M01` = `supabase/migrations/20261029141616_0001_foundation.sql`, `M02` = `…20261029142841_0002_hardening.sql`, `M03` = `…20261029143406_0003_policy_recursion.sql`, `M04` = `…20261029190744_0004_price_config_checks.sql`, `M10` = `…20261030120000_0010_quote.sql`, `M11` = `…20261101120000_0011_photos.sql`, `M13` = `…20261101140000_0013_photo_limit_retry.sql`, `M14` = `…20261101150000_0014_photo_cleanup_loud.sql`; `H` = `supabase/functions/_shared/quote/handler.ts`; `Q` = `supabase/functions/_shared/quote/db.ts`; `F` = `supabase/functions/_shared/pricing/fee.ts`.

---

## 1. Entscheidungen E1–E5 und daraus folgende Anforderungen

### 1.1 Übernommene Entscheidungen [Entscheidung Beks]

- **E1 · Verbindliche Buchungsanfrage mit Preisgarantie.** Der Kunde sendet zum angezeigten Festpreis („Zahlungspflichtig buchen“). Preis und angegebener Umfang werden beim Absenden eingefroren (Snapshot mit Preisversion). Der Vertrag entsteht erst, wenn ein Partner in der App annimmt. Vertragspartner des Kunden ist der Partner, MoveNow vermittelt. Die Plattform verteilt die Anfrage an passende Partner (Kategorie, Gebiet, Termin), die erste Annahme gewinnt. Es gibt eine Annahmefrist; danach „abgelaufen“, der Kunde wird informiert und kann neu senden. Bei Spannen oder `needsQuote` schickt der Partner ein Festangebot in der App, der Kunde bestätigt in der App, danach gilt dieselbe Preisgarantie.
- **E2 · Preisänderungen erzeugen immer eine neue Preisversion.** Bestehende Anfragen und Buchungen behalten ihre Version. Das wird in der Datenbank erzwungen (Trigger, Constraints, RLS), nicht nur in der Oberfläche. Der Preis ändert sich für einen Kunden nach Ansicht oder Buchung nie, außer durch E3.
- **E3 · Mehraufwand (Nachtrag).** Der Partner kann einen Nachtrag mit Fotobeleg vorschlagen. Der Betrag entsteht ausschließlich über das Preismodul aus korrigierten Eingaben (kein freier Betrag). Nur bei Zustimmung des Kunden in der App entsteht eine neue Preisversion. Bei Ablehnung gilt der gebuchte Umfang zum alten Preis; ist das unmöglich, Storno.
- **E4 · Abrechnung Phase 1.** Der Partner stellt dem Kunden den Gesamtpreis in Rechnung, der Kunde zahlt direkt an den Partner. MoveNow stellt dem Partner monatlich eine Sammelrechnung über die Provision (`splitFee`), Einzug per SEPA-Lastschrift-Mandat aus der Partner-Registrierung. Phase 2 (später): Stripe Connect. Das Datenmodell sieht das vor, setzt es nicht um.
- **E5 · Gebühr.** Kunden sehen die Gebühr nirgends, nur den Gesamtpreis. Partner sehen ihre Provision und Auszahlung (P2B-Transparenz).

### 1.2 Daraus folgende Anforderungen

Jede Anforderung hat eine Nummer (R#), auf die Abschnitte 4–9 und 13 verweisen.

| R# | Anforderung | Folgt aus |
|---|---|---|
| R1 | Der Server bindet den Kunden nur an einen Preis, den der Kunde gesehen hat: Der Aufruf trägt den angezeigten Betrag und die Preisversion, bei Abweichung 409 `price_changed` ohne Speichern [B1]. **Auslegung von E2 [Vorschlag – Beks bestätigt, Frage 4]: „nie stillschweigend“. Eine Abweichung bindet den Kunden nie, sie zeigt den neuen Preis und braucht eine erneute ausdrückliche Bestätigung.** | E1, E2 |
| R2 | „Anfrage bearbeiten“ nach dem Absenden entfällt; zurückziehen und neu senden [B2] | E1, E2 |
| R3 | Tarifversionen, Angebotsversionen (Vermieter) und Preisrevisionen je Auftrag sind unveränderlich, per Trigger auch gegen admin über die API. **Grenze:** Wer im Dashboard als Datenbank-Eigentümer SQL ausführt (so wird admin gesetzt), kann Trigger abschalten und auch `content_hash` neu schreiben. Der Inhalts-Hash (`content_hash`, 5.1) erkennt deshalb **versehentliche** Änderungen, keine absichtlichen eines Eigentümers; gegen Letztere hilft der Hash in jeder Revision und im Audit-Eintrag der Preisbestätigung, weil eine spätere Abweichung dann nachweisbar bleibt, und die Integritätsprüfung im Nachtrag (Modul(alt) = gebuchter Betrag, 5.6) [B3, B4, B11-Finding 11, R2-4] | E2 |
| R4 | Jede Preisänderung eines Auftrags ist eine Revision mit Quelle (`submit`, `partner_offer`, `change_order`); ein Nachtrag rechnet mit der gebuchten Version, nie mit der aktuellen; auch eine Weitervermittlung nach Partner-Storno läuft mit der eingefrorenen Revision [B5] | E2, E3 |
| R5 | Statusübergänge nur über serverseitige Funktionen (Muster in 4.5); kein UPDATE-Grant auf `service_requests`/`rental_bookings` für `authenticated` (auch nicht admin); ein Trigger lässt nur definierte Paare zu und gilt ohne Rollen-Ausnahme [B19] | E1 |
| R6 | „Erste Annahme gewinnt“ ist ein einziges Compare-and-Set; Annahme prüft Frist, Status und Revision selbst [B20, B21] | E1 |
| R7 | Partner lesen nie Zeilen aus `service_requests`, `request_photos`, `profiles`, `storage.objects`; sie lesen nur eine vom Server geschriebene Projektion (`job_listings`) und Kontaktdaten nur über eine RPC nach Annahme [B11, B12] | E1, Datenschutz |
| R8 | Ein Partner ist erst „aktiv“, wenn admin ihn geprüft und freigegeben hat; die Zuständigkeit prüft `private.my_partner_id()`, nicht die Rolle [B13, B36, B39] | E1 |
| R9 | Fotos für Partner nur als serverseitig geprüfte, neu kodierte Kopien ohne Metadaten, signierte URLs mit kurzer Laufzeit [B14] | CLAUDE.md, OPEN_ISSUES |
| R10 | Die Provision entsteht bei der Annahme (nicht beim Absenden), mit dem dann gültigen Satz und der USt.-Regel des Partners; der Partner sieht vor der Annahme „Du erhältst X“; die Schreibung von `fee_splits` in `quote` entfällt mit S9a [B26] | E4, E5 |
| R11 | Provisionen werden in einem unveränderlichen Journal geführt (Buchung, Nachtrag, Storno, Korrektur), `ON DELETE RESTRICT`; Kundenkonten mit bestätigten Aufträgen werden anonymisiert, nicht kaskadiert gelöscht [B27, B35] | E4 |
| R12 | Gebührensätze haben ein Gültigkeitsdatum (Vorlauf für Änderungen) [B29] | E5, P2B |
| R13 | Kontodaten liegen nicht in der App-Datenbank; Mandat und Einzug über einen Zahlungsdienstleister [B32] | E4 |
| R14 | Mails und Benachrichtigungen über eine Outbox mit Dedupe-Schlüssel, nie innerhalb der Transaktion, nie mit Gebühr an Kunden, nie mit Adresse an Partner [B24, B41] | E1, E5 |
| R15 | Zustimmungen und Zugriffe sind belegbar (Audit-Log, nur anfügen) [B42] | E1, E3 |
| R16 | Das Datenmodell trägt Felder für Stripe Connect, ohne es zu nutzen | E4 |
| R17 | Verbindliche Beträge werden centgenau mit `formatEuro` angezeigt, nie gerundet; Festpreis heißt `kind = price` mit `low == high` [B7] | E1 |

### 1.3 Regeländerungen und Freigaben (Voraussetzung vor Umsetzung) [B25]

Das Konzept widerspricht dem heutigen Projektstand an diesen Stellen; vor Umsetzung entscheidet Beks, welche Regel sich ändert:

| Stelle | Heutige Regel | Änderung durch E1–E5 |
|---|---|---|
| `CLAUDE.md` Kopf | „unverbindliche Anfrage“, „Partner bestätigt Termin und Preis (in dieser Phase außerhalb der App)“ | verbindliche Buchungsanfrage, Annahme in der App |
| `CLAUDE.md` Daten und Sicherheit | „Kunden setzen nur die Status ‚angefragt‘ und ‚zurückgezogen‘. Alle anderen Status setzt nur admin.“ | Annahme/Angebot/Nachtrag/Storno laufen über Funktionen mit Akteur je Übergang |
| `CLAUDE.md` Geld | Gebührenaufteilung in `fee_splits`, entsteht beim Absenden | Journal, entsteht bei der Annahme |
| `docs/ARCHITECTURE.md:28` (Statusfluss), `:34`, `:25`, `:117` | Statusfluss, `payee_id` null bis Partnerzuordnung, `partners` mit Login je Firma, Vermieter sehen keine Mietanfragen | Abschnitte 4, 5, 6 |
| `docs/ROADMAP.md:7` und „Später“ | Partner-Portal, Zahlung und Admin-Oberfläche nur nach Freigabe | Freigabe ist diese Entscheidung; S9 ist dort schon die Transportermiete |
| Einwilligungstext der Zusammenfassung (`docs/OPEN_ISSUES.md:89`) | „Ich sende eine unverbindliche Anfrage …“ | rechtlich geprüfter Text und Button-Beschriftung (Abschnitt 11) |
| `docs/OPEN_ISSUES.md:6` | Vermieter ändern freigegebene Angebote ohne erneute Prüfung | entschieden durch E2: jede Änderung ist eine neue Version (Abschnitt 5.3) |

Die Sessions dieses Konzepts heißen hier **S9a ff.**, wie vom Auftraggeber vorgegeben; in der ROADMAP ist „S9“ aber bereits die Transportermiete mit Vermieterbereich (Abschnitt 14, Frage 1).

---

## 2. Ist-Stand mit Belegtabelle

Alle Aussagen unten sind aus den Dateien belegt (Erhebung per Lesezugriff, Stichproben von mir gegengeprüft). Was nicht belegt werden konnte, steht in 2.6.

### 2.1 Tabellen, Enums, Constraints

| Aussage | Beleg |
|---|---|
| Enum `user_role`: customer, rental_provider, admin, partner | M01:18 |
| Enum `request_status`: requested, inspection_requested, confirmed, in_progress, completed, withdrawn, expired | M01:20-22 |
| Enum `service_type`: transport, move, clearance, assembly; `region`: vienna, austria, international; `offer_status`: pending, approved, archived | M01:19, 23, 24 |
| `service_requests`: `customer_id` (FK `profiles`, cascade), `inputs`/`price_snapshot` jsonb, `price_version` FK, `estimate_cents`, `needs_quote`, Adressen, `geography`-Punkte, `route` | M01:105-129 |
| Checks `estimate_xor_quote` und `inspection_needs_quote` | M01:127-128 |
| Spalten `description`, `volume_m3`, `client_ref` (unique je Kunde) | M10:6-11 |
| `request_photos`: `request_id` (cascade), `storage_path` unique | M01:133-138 |
| `rental_offers`: `provider_id` default `auth.uid()`, alle Preisfelder in Cent, `status` default pending, `is_demo`, Check `provider_or_demo` | M01:144-166 |
| `rental_bookings`: `offer_id` FK ohne cascade, `customer_id` (cascade), `status`, `price_snapshot`, `price_version` FK (Kundentarif-Version), `total_cents`, `deposit_cents`, `client_ref` | M01:171-189, M10:14-16 |
| `rental_bookings`: Check `status <> 'inspection_requested'`, `return_at > pickup_at` | M01:175, 188 |
| `fee_splits`: höchstens eine Zeile je Anfrage bzw. Buchung (`unique`), `payee_id` set null, Sätze und Beträge, Checks `one_subject`, `fee_parts`, `payout_rest` | M01:196-212 |
| `price_versions` (`version`, `effective_on`), `price_config` (PK `version`,`key`, Cent-Werte) | M01:73-90 |
| `platform_settings`: PK (`key`,`version`), kein Gültigkeitsdatum | M01:93-100 |
| View `current_fee_rates` (security_invoker, nur `authenticated` lesbar; Kunden sehen NULL) | M10:21-27 |

### 2.2 Policies und Rechte (RLS)

| Aussage | Beleg |
|---|---|
| Auf allen Tabellen zuerst `revoke all` für anon/authenticated, dann gezielte Grants | M01:253-257 |
| `service_requests`: Kunde `select` eigene (oder admin); `update` nur Spalte `status`, nur aus requested/inspection_requested nach `withdrawn`; admin darf jeden Status setzen; kein `insert`-Grant | M01:302-316 |
| `rental_bookings`: Kunde `select` eigene (oder admin), `update` nur `status` von requested nach withdrawn, kein `insert`-Grant; **keine Policy für Vermieter** | M01:382-396 |
| `fee_splits`: `select` nur `payee_id = auth.uid()` oder admin; keine Schreibrechte | M01:399-402 |
| `rental_offers`: anon/Kunden sehen `approved`; Vermieter `insert`/`update` eigene Zeilen mit Spalten-Grant ohne `status`, `is_demo`, `provider_id`; `provider_name` ist änderbar | M01:355-379 |
| `price_versions`/`price_config`: lesen anon+authenticated (`using (true)`); schreiben und **löschen** admin | M01:270-287 |
| `platform_settings`: lesen nur rental_provider/admin, schreiben admin | M01:290-299 |
| `request_photos`: `insert` nur (`id`,`request_id`) bei eigener offener Anfrage, Pfad `{uid}/{request}/` | M11:21-34 |
| Storage `request-photos`: `select` Ordner = eigene `uid` oder admin; `insert` nur in eingetragene Pfade; `delete` bei offener Anfrage; keine `update`-Policy | M01:411-415, M03:27-39, M02:24-35; Test `tests/rls/uploads.test.ts:191` |

### 2.3 Funktionen, RPCs, Trigger

| Aussage | Beleg |
|---|---|
| `private.my_role()`: SECURITY DEFINER, fester `search_path` | M01:37-42 |
| `become_rental_provider()`: macht jeden `customer` auf Aufruf sofort zum `rental_provider` | M01:60-69 |
| `quote_save_request` (security invoker, nur `service_role`): Anlegen oder Bearbeiten (nur Status `requested`), schreibt `fee_splits` per Upsert, Fehler `55000`/`P0002` | M10:32-105 (Bearbeiten M10:72-79, `fee_splits` M10:89-101), Execute M10:146-155 |
| `quote_save_booking` (nur `service_role`): Miete anlegen und `fee_splits` | M10:108-143, 157-164 |
| `splitFee(totalCents, {feeRate, vatRate})`: Ganzzahl, half-up; fee = round(total × Satz), netto = round(fee / (1 + USt.)), USt. = fee − netto, Auszahlung = total − fee | F:6-25 |
| `quote`: rechnet immer mit aktueller Version neu und speichert; kennt keinen Preis vom Client | H:188-195 (Version und Sätze laden), H:241-260 (Speichern) |
| `quote`: Status wird serverseitig gesetzt (`inspection_requested` bei Entrümpelung mit Angebotspflicht, sonst `requested`) | H:246 |
| `quote` schreibt `fee_splits` beim Absenden mit `payee_id = null`; bei Angebotspflicht keine Zeile | H:259, M10:89-101 |
| Mietangebot wird per id mit `status = approved` geladen; `payee_id` = Vermieter | Q:50, H:265-307 |
| Preisversion „aktuell“ = höchste mit `effective_on` ≤ heute, View `current_price_version` | M04:9-16 |
| Foto-Limit 8 per BEFORE-INSERT-Trigger unter Advisory-Lock; Pfad vom Server | M11:5-19, M13:2-13 |
| `photo_cleanup()` wirft bei fehlendem Vault einen Fehler | M14:17-19 |

### 2.4 Foto-Bucket

| Aussage | Beleg |
|---|---|
| Privater Bucket `request-photos`, 10 MB, nur `image/jpeg` | M01:408-409, M11:38-39 |
| Der Bucket prüft den Content-Type-Header, nicht die Bytes; Partner-Portal-Pflicht in OPEN_ISSUES | `docs/ARCHITECTURE.md:60`, `docs/OPEN_ISSUES.md:103` |

### 2.5 Tests (RLS)

`tests/rls/rls.test.ts:253` (Mietanfragen eigene), `:268-304` (Kunde setzt nur „zurückgezogen“), `:360-395` (Gebühren), `:397-446` (`price_config`), `:463-487` (Rollen); `tests/rls/quote.test.ts:237-272` (Miete), `:275-322` (Rechte); `tests/rls/uploads.test.ts:48-245`.

### 2.6 Nicht belegbar oder nicht vorhanden

- Es gibt **keine** Tabelle `partners`, `quotes`, keine Funktion `is_admin` (Admin-Prüfung über `private.my_role() = 'admin'`, M01:264), keine Vermieter-Policy auf `rental_bookings`, keinen Test dafür.
- EXIF-Entfernung ist reine Client-Logik, in Migrationen und Edge Functions nicht vorhanden (`docs/ARCHITECTURE.md:60`).
- `partners` und `quotes` stehen nur als „später, nur geplant“ in `docs/ARCHITECTURE.md:25`.
- Belegt (Prüfung des Beraters): `quote` läuft mit `verify_jwt = false`, das Nutzer-JWT prüft die Function selbst (`supabase/config.toml:419-425`, `docs/ARCHITECTURE.md:94`, `supabase/functions/quote/index.ts:2`). Das Muster „Edge Function prüft JWT, schreibt über service_role“ gilt für die neuen Übergänge (4.5).

### 2.7 Wo der Ist-Stand E1–E5 widerspricht (Umbaubedarf)

| Nr. | Widerspruch | Beleg | Lösung im Konzept |
|---|---|---|---|
| U1 | `quote` speichert den Serverpreis auch bei Abweichung vom angezeigten [B1] | H:188-195, 241-260 | R1, 409 `price_changed` |
| U2 | Bearbeiten nach dem Absenden rechnet neu [B2] | M10:72-79 | R2 |
| U3 | Tarifversionen nur per Konvention unveränderlich, admin kann ändern/löschen, halb befüllte Version wird sofort aktuell [B3] | M01:271-287, M04:9-14, `docs/ARCHITECTURE.md:121` | R3, `published` |
| U4 | Vermieter ändern ihr Angebot in der Zeile; `rental_bookings.price_version` ist die Kundentarif-Version [B4] | M01:173,183,360-379, Q:50 | `rental_offer_versions` |
| U5 | Kunden- und admin-UPDATE auf `status` ohne Übergangsregeln [B19] | M01:303,308-316,383,388-396 | R5 |
| U6 | `fee_splits`: eine Zeile je Anfrage, Upsert, Kaskadenlöschung, `payee` null bei Kontolöschung [B27] | M01:196-212, M10:97-100, `docs/OPEN_ISSUES.md:7` | Journal R11 |
| U7 | Gebühr entsteht beim Absenden ohne Empfänger [B26] | H:259 | R10 |
| U8 | Gebührensatz ohne Gültigkeitsdatum [B29] | M10:21-24 | R12 |
| U9 | `become_rental_provider` macht sofort zum Vermieter [B13, B36] | M01:60-69 | R8 |
| U10 | Ein Login je Firma (`partners.id = profiles.id`) [B15] | `docs/ARCHITECTURE.md:25` | `partner_members` |
| U11 | Bucket prüft nur den Header; kein Partner-Bereich [B14] | `docs/OPEN_ISSUES.md:103` | Abschnitt 7 |
| U12 | Konto löschen kaskadiert auf bestätigte Aufträge (Kaskade M01:107, 174); der Fremdschlüssel M01:173 ohne Kaskade blockiert dagegen das Löschen eines Vermieters mit Buchungen (`docs/OPEN_ISSUES.md:7`) [B35, B38] | M01:107, 174; M01:146, 173 | R11 |

---

## 3. Rollen

| Rolle | Wer | Was sie darf (Kurzfassung) | Quelle |
|---|---|---|---|
| **anon** | nicht angemeldet | Tarife, freigegebene Mietangebote lesen; `route` aufrufen (Rate-Limits) | M01:270-287, 365-366; `docs/ARCHITECTURE.md:84` |
| **Kunde** (`customer`) | angemeldeter Nutzer | eigene Anfragen/Buchungen/Fotos lesen; über `quote` buchen; zurückziehen, stornieren, Angebote und Nachträge entscheiden (neu, über Funktionen) | M01:302-316 |
| **Partner** (neu, inkl. Vermieter) | Firma mit Mitgliedern, `partner_members` | nur im Status `active` (`my_partner_id()`): Listings lesen, annehmen, anbieten, Nachtrag vorschlagen, eigene Provision und Rechnungen lesen. **Vermieter sind Partner der Kategorie Miete**; `rental_provider` entfällt als eigene Rolle | R8 |
| **Partner-Mitglied** | Person der Firma | Rolle `owner` (alles inkl. Bank/Mandat) oder `staff` (Annehmen, Aufträge) | [B15] |
| **admin** | nur per SQL im Dashboard gesetzt | Partner prüfen und freigeben/sperren, Korrekturbuchungen; **darf keine Preise, Revisionen, Journal-Zeilen verändern** (Trigger) | M01:264, [B3, B19] |
| **service_role** | Edge Functions, pg_cron | umgeht RLS; schreibt Revisionen, Listings, Journal; alle vertrauenswürdige Geschäftslogik läuft hier | `docs/ARCHITECTURE.md:38` |

Neue Datenbankrolle gibt es nicht: alle App-Rollen sind `authenticated`, deshalb gelten Spalten-Grants für alle gleich (U-Befund [B11]); Unterschiede entstehen nur über Policies und RPCs.

---

## 4. Statusmaschine

### 4.1 Zustände des Auftrags (`service_requests.status`, Entwurf)

Das heutige Enum (M01:20-22) wird erweitert; `confirmed` heißt künftig `accepted` (Annahme = Vertragsschluss). [Entwurf]

| Status | Bedeutung | Vertrag? |
|---|---|---|
| `requested` | angefragt: Preis und Umfang eingefroren, Frist läuft, an Partner verteilt (Festpreis) | nein |
| `awaiting_offer` | angefragt, Spanne/`needsQuote`: wartet auf Festangebot eines Partners | nein |
| `offered` | mindestens ein Festangebot liegt vor, Kunde entscheidet | nein |
| `inspection_requested` | Besichtigung (nur Entrümpelung); **entfällt oder bekommt eigene Übergänge, sobald Beks Frage 6 entschieden hat; bis dahin hat der Status in 4.4 keinen Übergang** | nein |
| `accepted` | angenommen (Festpreis: durch Partner; Angebot: durch Kunden-Bestätigung) | **ja** |
| `in_progress` | Auftragstag begonnen | ja |
| `completed` | durchgeführt (Partner meldet, Kunde bestätigt oder Frist) | ja |
| `settled` | abgerechnet: alle Journal-Zeilen des Auftrags sind auf einer **bezahlten oder eingezogenen** Provisionsrechnung; nur aus `completed` erreichbar (storniert Aufträge mit Stornogebühr bleiben in ihrem Storno-Status; ihre Journal-Zeilen werden trotzdem mit abgerechnet) | ja |
| `withdrawn` | Kunde zieht vor Vertragsschluss zurück | nein |
| `expired` | Annahmefrist oder Angebotsfrist ohne Entscheidung abgelaufen | nein |
| `declined` | Kunde lehnt alle vorliegenden Angebote ab | nein |
| `unmatched` | alle passenden Partner haben abgelehnt oder es gibt keinen | nein |
| `cancelled_by_customer` | Storno nach Vertragsschluss durch Kunden | ja |
| `cancelled_by_partner` | Storno nach Vertragsschluss durch Partner | ja |

„Zurückgezogen“ (vor Vertragsschluss) und „storniert“ (nach Vertragsschluss) werden für die Provision getrennt geführt [B34]. Ob die Bindung des Kundenangebots schon vor der Annahme besteht und ein Rückzug vor Annahme kostenlos bleibt, ist offen **[Frage Recht 3]**; die Statusmaschine setzt es bis zur Klärung als Annahme der Planung voraus.

### 4.2 Nachtrag (`price_revisions.status` mit `source = change_order`)

`proposed` → `accepted` (neue Revision gilt, neue Preisversion der Buchung) | `declined` | `expired` (Frist) | `withdrawn` (Partner zieht zurück). Der Auftragsstatus bleibt `accepted`/`in_progress`; es gibt höchstens einen offenen Nachtrag je Auftrag. [Entwurf]

### 4.3 Festangebot (`partner_offers.status`)

`sent` → `confirmed` (Kunde) | `rejected` (Kunde) | `superseded` (Kunde bestätigt ein anderes Angebot, atomar) | `expired` (`valid_until`) | `withdrawn` (Partner). Nach dem Senden unveränderlich (Trigger). [Entwurf, B8, B23]

### 4.4 Übergänge: Akteur und Erzwingung

Alle Übergänge laufen über eine Funktion nach dem Muster in 4.5; der BEFORE-UPDATE-Trigger lässt nur die Paare der Spalte „von → nach“ zu, **ohne Ausnahme für Rolle, auch für admin, `service_role` und `postgres`** [B19]. Spalten für Preis, Umfang und Revision sind außerhalb dieser Funktionen gesperrt (kein UPDATE-Grant für `authenticated`). „RPC“ in der Tabelle heißt: Funktion nach 4.5, nicht notwendig eine SQL-RPC.

| # | Von → nach | Akteur | Erzwingung (Funktion/Mittel) |
|---|---|---|---|
| T1 | – → `requested` / `awaiting_offer` | Kunde | Edge Function `quote` (Revision 1 mit `source = submit`, Haltefenster R1) |
| T2 | `requested`/`awaiting_offer`/`offered` → `withdrawn` | Kunde | RPC `withdraw` (Compare-and-Set auf Status); kostenlos nur, solange Frage Recht 3 nichts anderes ergibt |
| T3 | `requested` → `accepted` | Partner | RPC `accept` (Compare-and-Set: Status, Revision, Frist, aktiver zuständiger Partner, gezeigte Auszahlung) |
| T4 | `awaiting_offer` → `offered` | Partner | RPC `send_offer` (legt Angebot an; Bedingungen siehe 5.7) |
| T4b | `offered` → `awaiting_offer` | System | wenn alle Angebote per `valid_until`/`withdrawn` abgelaufen sind, bevor die Frist der Anfrage endet [B23] |
| T5 | `offered` → `accepted` | Kunde | RPC `confirm_offer` (Compare-and-Set; setzt andere Angebote `superseded`) |
| T6 | `offered` → `declined` | Kunde | RPC `reject_offers` |
| T7 | `requested`/`awaiting_offer`/`offered` → `expired` | System | pg_cron-Job; die Annahme prüft die Frist trotzdem selbst |
| T8 | `requested`/`awaiting_offer` → `unmatched` | System | wenn alle Empfänger abgelehnt haben (`decline_listing`) |
| T9 | `accepted` → `in_progress` | Partner | RPC `start` (frühestens am Termin) |
| T10 | `in_progress` → `completed` | Partner (Meldung), Kunde (Bestätigung) | RPC `complete`; ohne Kundenrückmeldung nach Frist durch System |
| T11 | `completed` → `settled` | System | Rechnungslauf (Abschnitt 9) |
| T15 | `accepted`/`in_progress` → `completed` | System | Termin + Frist (Wert Frage 21) ohne Storno und ohne Partnermeldung; **außer** der Kunde meldet „hat nicht stattgefunden“ (dann Prüfung durch admin, Audit-Log). Ohne T15 würde ein Partner, der nie startet oder meldet, nie Provision zahlen [Finding 3]. Die App fragt den Kunden nach dem Termin unabhängig vom Partner |
| T16 | `cancelled_by_partner` (auch nach T14) → neue Anfrage | Kunde (Knopf); automatisch nur nach Entscheidung zu Frage 12 | Eigene Edge Function „neu vermitteln“ (Art A, **ausdrücklich vom Haltefenster in `quote` ausgenommen**): legt eine neue Anfrage mit denselben eingefrorenen Eingaben an; die Revision wird als **neue Zeile mit `copied_from_revision_id`** kopiert (Betrag, Hash und Preisversion identisch, nicht neu gerechnet). Regeln: (1) Spalte `reissued_from` mit Unique-Index: höchstens eine Folgeanfrage je Quelle (Idempotenz bei Doppelklick oder System + Knopf). (2) Die Preisgarantie gilt in der Kette nur bis Termin + X Tage, höchstens Y Tage nach dem Storno (Frage 12); danach endet sie ausdrücklich, und ein Neustart rechnet zum dann aktuellen Preis. (3) Läuft die Folgeanfrage ab (`expired`/`unmatched`), ist eine weitere Folgeanfrage aus ihr erlaubt, solange die Garantiefrist läuft. (4) Nicht erlaubt bei Revisionen mit Quelle `partner_offer` (der Betrag eines fremden Angebots gilt nicht für andere Partner) und bei Mieten (anderer Vermieter = andere Angebotsversion): dort entsteht stattdessen eine **neue Anfrage** mit Kopie der `submit`-Revision 1 (Spanne) im Status `awaiting_offer`, **ohne Preisgarantie**, weil die Angebote neu kommen; bei Mieten entscheidet der Kunde neu (Frage 12b). „Zurück zu `awaiting_offer`“ ist kein Paar in 4.4, `cancelled_by_partner` bleibt Endzustand. Nach Ende der Garantiefrist (Regel 2) läuft ein Neustart nur über `quote` (T1 mit R1), nie automatisch [R3-7]. (5) Automatisch ausgelöst bindet T16 den Kunden ohne neue Erklärung: **[Frage Recht 3/6]** [Finding 2, Berater R2-3] |
| T12 | `accepted`/`in_progress` → `cancelled_by_customer` | Kunde | RPC `cancel_by_customer` (Stornoregeln, Abschnitt 10) |
| T13 | `accepted`/`in_progress` → `cancelled_by_partner` | Partner | RPC `cancel_by_partner` (Sanktion, Provision 0) |
| T14 | `accepted`/`in_progress` → `cancelled_by_partner`, `cancelled_by_customer` oder `completed` (z. B. wenn die Prüfung nach „hat nicht stattgefunden“ das Gegenteil ergibt) | admin | Funktion `admin_correct` (Art A) mit Begründung und Audit-Log; nie freies UPDATE [R2-14] |
| N1 | – → Nachtrag `proposed` | Partner | Funktion `propose_change` (Art A: Eingaben → `parse*Input` → Preismodul mit gebuchter Version nach der Regel in 5.6, Fotobeleg Pflicht) |
| N2 | Nachtrag `proposed` → `accepted`/`declined` | Kunde | RPC `decide_change` |
| N3 | Nachtrag `proposed` → `expired`/`withdrawn` | System/Partner | Job bzw. RPC |

Das Zurückziehen (T2) und die Annahme (T3) ändern dieselbe Zeile; die Zeilensperre ordnet beide nacheinander, genau eine gewinnt [B20].

### 4.5 Erzwingung: Muster für die Funktionen [Finding 4, 10, R2-8, R2-11]

Preisrechnung, Eingabeprüfung und Gebühr sind TypeScript (`parse*Input`, Preismodul, `splitFee`); eine SQL-Funktion kann sie nicht aufrufen. Eine zweite Gebührenrechnung in SQL ist ausgeschlossen (`splitFee` bleibt die einzige Stelle, 9.1). Deshalb zwei Arten:

| Art | Übergänge | Aufbau |
|---|---|---|
| **A. Edge Function + SQL-Funktion** (wie `quote`/M10) | T1, T3, T4, T5, T6, T12, T13, T14, T16, N1, N2, `confirm_offer`, `admin_*` | Die Edge Function prüft das JWT (Nutzer, `aal`), validiert Eingaben, rechnet in TS (Preismodul, `splitFee`), ruft dann **eine** SQL-Funktion auf, die nur `service_role` ausführen darf (`revoke` für alle anderen, fester `search_path`). Diese schreibt Compare-and-Set, Revision, Journal-Zeile, Outbox und Audit-Log **in einer Transaktion**. Vertrauensgrenze: `p_actor` ist **ausschließlich** die `user_id` aus dem geprüften JWT. Die SQL-Funktion leitet `partner_id` daraus selbst ab und prüft Mitgliedschaft und Status `active` **in derselben Transaktion unter Sperre der Partnerzeile**; eine `partner_id` aus dem Request-Body wird nie angenommen. Die Edge Function übergibt Satz und Satzversion. **Für neue `booking`-Zeilen (T3, T5)** vergleicht die SQL-Funktion sie mit `current_fee_rates` und bricht bei Abweichung mit 409 `fee_rate_changed` ab. **Für Nachtrag (N2) und Stornogebühr (T12)** gilt der bei der Annahme eingefrorene Satz (9.3, 9.4): Die SQL-Funktion liest Satz und `vat_rule` unter Sperre aus der `booking`-Zeile und vergleicht sie mit den Werten der Edge Function, bei Abweichung 409 `fee_basis_changed`; nach einem Satzwechsel bleibt ein Nachtrag also möglich und bucht mit dem alten Satz. Die Statusprüfung der Partner folgt den beiden Prüfungen in 5.2 (Helfer-Varianten mit `p_actor` als Parameter, weil `auth.uid()` unter `service_role` NULL ist): annehmen nur `active`, abwickeln auch `payment_hold` [R3-1, R3-8]. `aal` prüft nur die Edge Function; das ist eine dokumentierte Grenze. Unter `service_role` ist `auth.uid()` NULL: Eigentum, Zuordnung und Status prüft die SQL-Funktion über `p_actor` selbst [R2-8] |
| **B. SQL-RPC für `authenticated`** | `withdraw` (T2), `decline_listing`, `start` (T9), `complete` (T10, Meldung bzw. Bestätigung), N3 (Nachtrag zurückziehen), reine Statuswechsel ohne Geld und ohne Preisrechnung | SECURITY DEFINER, fester `search_path`, eigene Akteurprüfung über `auth.uid()` und `my_partner_id()`, Execute nur für `authenticated`; Compare-and-Set auf den Status |
| **C. System** | T7, T4b, T8 (alle Listings abgelehnt/abgelaufen), T10-Fallback, T11, T15, N3 (Ablauf) | pg_cron oder Edge Function mit `service_role`; Fristprüfung der Annahme bleibt trotzdem im Übergang selbst |

Die Grenze „`aal` nur in der Edge Function“ gilt nur für Art A. Art-B-RPCs mit Kundendaten (`job_contact`, `my_job_partner`) prüfen selbst `(select auth.jwt()->>'aal') = 'aal2'`; „Fotos fertig“ ist Art B, der Timeout-Job Art C [R3-4, R3-9]. Für alle gilt: Es gibt keinen UPDATE-Grant für `authenticated` auf `service_requests` und `rental_bookings` (auch nicht für admin); der Paar-Trigger gilt ohne Rollen-Ausnahme, schützt also auch vor Fehlern in den Funktionen selbst.

### 4.6 Zustände der Miete

`rental_bookings.status` nutzt dieselben Zustände ohne `inspection_requested`, `awaiting_offer`, `offered` (M01:175). Die Miete geht direkt an den Vermieter des gebuchten Angebots (Abschnitt 8.8).

---

## 5. Datenmodell-Entwurf

Beschreibung, kein SQL. Alle Beträge Integer-Cent. Alle neuen Tabellen: RLS an, `revoke all` für anon/authenticated, gezielte Grants wie M01:253-257.

### 5.1 Preisversionen und Gebührensätze

- **`price_versions`** (besteht): neue Spalte `published` (bool, Standard false). Die View `current_price_version` filtert auf `published`. Ab `published = true` verbietet ein Trigger UPDATE und DELETE der Zeile und aller zugehörigen `price_config`-Zeilen, auch für admin über die API [B3]. `published` setzt eine Funktion `publish_version` (nur admin, setzt zugleich `published_at` und `content_hash`); direktes UPDATE von `published` entfällt, UPDATE der Zeile ist nur bei `published = false` möglich. Beim Veröffentlichen wird ein Inhalts-Hash der Version gespeichert (`content_hash`): kanonisch an **einer** Stelle in SQL berechnet: `private.price_version_hash(v)` (Zeilen nach `key` sortiert, `value::text`, sha256 über `extensions.digest`). `publish_version` berechnet und setzt Hash und `published_at` unter Sperre der Version; `quote` und der Nachtrag rufen eine Prüffunktion nur für `service_role` auf und vergleichen den neu berechneten mit dem gespeicherten Hash. `authenticated` hat kein Grant auf `published`, `published_at`, `content_hash`. Test: Eigentümer-Lauf (`supabase db query --linked`, Trigger aussetzen) oder Unit-Test des Vergleichs; über die API lässt sich der Trigger nicht aussetzen [R3-3]. `quote` und der Nachtrag prüfen ihn vor dem Rechnen und brechen bei Abweichung ab; der Hash wird zusätzlich in jede Revision und in den Audit-Eintrag der Preisbestätigung geschrieben. Das benennt die Grenze ehrlich: Der Hash erkennt versehentliche Änderungen; wer als Datenbank-Eigentümer Trigger abschaltet, kann auch den Hash ändern, die Abweichung bleibt aber über die in Revisionen und Audit gespeicherten Hashes nachweisbar [Finding 11, R2-4].
- **`platform_settings`** (besteht): neue Spalte `effective_from` (Datum); `current_fee_rates` wählt je Schlüssel die höchste Version mit `effective_from ≤ heute` [B29]. Ein Trigger erzwingt für `fee_rate`/`fee_vat_rate`: `effective_from ≥ current_date (Europe/Vienna) + Vorlauf` (Vergleich mit dem Datum der Datenbank, nicht mit einer per API setzbaren Spalte; Vorlauf nennt Beks, Frage 15; ob P2B Art. 3 mit 15 Tagen anwendbar ist, ist **[Frage Recht 4]**). Zeilen dieser Schlüssel sind ab Anlage unveränderlich, auch für admin (kein UPDATE); DELETE nur, solange `effective_from` in der Zukunft liegt. Ausnahme nur die erste Version (Seed). Sonst könnte admin den Wert der geltenden Zeile direkt ändern oder löschen, und der Satz gälte sofort [Finding 8, R2-5].
- **`partner_vat_rules`**: je Partner Regel für die USt. der Provision (`standard_20`, `reverse_charge`, `none`), `valid_from`; bei der Annahme wird die gültige Regel ins Journal kopiert [B30, B26].

### 5.2 Partner

- **`partners`** (Firma): `id`, Firmenname, UID, Rechtsform, Status (`pending`, `active`, `suspended`, `payment_hold`, `rejected`), `payout_model` (`direct`, `connect`), `stripe_account_id` (null, nur für Phase 2), `verified_at`, `verified_by`. Status, Prüfdatum, `payout_model` und Satz setzt nur admin; der Partner ändert nur Stammdaten [B39, R16].
- **`partner_members`**: (`partner_id`, `user_id`, `role` = `owner`/`staff`), eindeutig je Paar; zusätzlich `unique (user_id)`: ein Nutzer gehört höchstens einer Firma an (der Firmenstatus liegt in `partners`, ein Index über zwei Tabellen ist nicht möglich) [R3-13]. Ersetzt `partners.id = profiles.id` [B15].
- **`partner_categories`**: (`partner_id`, `service`) mit den Leistungen `transport`, `move`, `clearance`, `assembly`, `rental`.
- **`partner_regions`**: (`partner_id`, PLZ oder Bezirk), Gebiet als Liste; Reichweite in km ist Frage 11.
- **`partner_documents`**: Unterlagen (Gewerbeschein, Firmenbuch, Ausweis, UID-Prüfung VIES-Protokoll); Dateien in eigenem privatem Bucket, nur admin, mit Löschfrist [B39].
- **Helfer** (zwei getrennte Prüfungen) [R2-12]: `private.my_partner_id()` („darf annehmen“): liefert die Firmen-ID nur, wenn Mitglied **und** Firmenstatus `active` [B13, B40]. `private.my_job_partner_id()` („darf zugeordnete Aufträge abwickeln“): Mitglied und Firmenstatus `active` **oder** `payment_hold`, nur für `job_contact`, `start`, `complete` und Nachträge bereits zugeordneter Aufträge (10.4: laufende Aufträge werden abgewickelt). `suspended` und `pending` liefern in beiden Fällen NULL. Für Kundendaten verlangen die Funktionen zusätzlich `aal2` (MFA, geprüft in der Edge Function, 4.5). Beide SECURITY DEFINER, fester `search_path`.
- **`my_job_partner(job)`**: RPC mit fester Spaltenliste (Firmenname, Kontakt) für den Kunden des Auftrags nach der Annahme; der Kunde hat kein Leserecht auf `partners`.

### 5.3 Vermieter-Angebote

- **`rental_offer_versions`**: nur Insert. Alle `offerFields` des heutigen `rental_offers` (M01:144-166) als Spalten, plus `provider_name`; `offer_id`, `version` (1, 2, …), `created_at`, `approved_at`/`approved_by`. Ein Trigger verbietet UPDATE und DELETE der Angebotsfelder; die Freigabe (`approved_at`, `approved_by`) darf **einmalig** gesetzt werden (nur NULL → Wert, nur durch die Freigabefunktion von admin), analog zu `invoice_id` im Journal [R2-11].
- **`rental_offers`** (besteht, verschlankt): `partner_id` statt `provider_id` (Demo-Angebote bleiben mit `is_demo`), `current_version_id`, `status`. Jede Änderung eines Vermieters legt eine neue Version an; sie wird nach Freigabe durch admin zur gültigen (Frage 7: Freigabe je Version) [B4, B18]. **Spalten-Grants (Selbstfreigabe verhindern):** Partner haben `insert` auf `rental_offer_versions` und `rental_offers` nur auf die Angebotsfelder (wie heute M01:356-363), **nicht** auf `approved_at`, `approved_by`, `status`, `current_version_id`, `is_demo`, `partner_id` (`partner_id` setzt der Default aus der Mitgliedschaft). `current_version_id` setzt nur die Freigabefunktion von admin [Finding 9].
- **`rental_bookings`** (besteht): `offer_version_id` NOT NULL ersetzt `price_version` für Mieten; Fremdschlüssel auf die Version, nie auf die Zeile [B4].

### 5.4 Revisionen (Preis-Snapshot je Auftrag)

- **`price_revisions`**: `request_id` bzw. `booking_id`, `n` (1, 2, …), `source` (`submit`, `partner_offer`, `change_order`), `inputs` (nur Ergebnis von `parse*Input`), `snapshot` (Kunden-Positionen, nie Gebühr), `price_version` bzw. `offer_version_id`, `total_cents`, `status` (nur für Nachträge, siehe 4.2), `photos` (Verweise auf Beleg-Fotos), `decided_by`, `decided_at`, `created_at`. Nur Insert, Status nur über Funktionen, Preisfelder per Trigger unveränderlich [B5].
- **`service_requests.current_revision`** zeigt auf die gültige Revision; `price_snapshot`/`estimate_cents`/`inputs` der Anfrage werden durch die Revision ersetzt (kein Doppelbestand). `current_revision` ist per Trigger geschützt: **Erstes Setzen** (NULL → Revision `n = 1` derselben Anfrage) einmalig, in derselben Transaktion wie das Anlegen (T1, und bei T16 die kopierte Revision); danach nur auf eine Revision **derselben** Anfrage mit `n = alt + 1`, und zwar auf einen angenommenen `change_order` oder auf eine `partner_offer` beim Übergang `offered → accepted`; sonst Fehler. Für `rental_bookings` gilt dieselbe Regel (Revision 1 beim Buchen, Nachträge bei Mieten gibt es nicht). Der Fremdschlüssel `price_revisions` → Auftrag hat `ON DELETE RESTRICT`; `price_revisions` führt zusätzlich `copied_from_revision_id` (T16) und `content_hash` (Hash der Preisversion bei der Revision, 5.1); eine kopierte Revision trägt die Quelle des Originals [R3-5] (ein Fehler in einer Funktion würde sonst den Kundenpreis ohne E3 ändern) [R2-16]. Neue Spalten an der Anfrage: `accept_deadline`, `photos_closed_at`, `reissued_from` (T16); der annehmende Partner steht nur in `assignments` (kein Doppelbestand), Kontaktdaten in `request_contacts`.
- **Haltefenster:** Der Aufruf von `quote` trägt `shownTotalCents` und `priceVersion`; der Server rechnet mit genau dieser Version, wenn sie aktuell ist oder seit höchstens N Minuten ersetzt wurde (N: Frage 4); sonst 409 `price_changed` mit neuem Snapshot, nichts wird gespeichert [B1]. Der Ersetzungszeitpunkt einer Version ist `max(Mitternacht Europe/Vienna an effective_on, published_at)`; dafür bekommt `price_versions` die Spalte `published_at` (gesetzt von `publish_version`). Die Weitervermittlung T16 ist vom Haltefenster ausgenommen und hat ihre eigene, begrenzte Garantiefrist (4.4).

### 5.5 Verteilung und Annahme

- **`job_listings`**: je Anfrage bzw. Buchung (genau eines von `request_id`/`booking_id`) und Empfänger-Partner eine Zeile, vom Server geschrieben. Spalten (abschließend): `listing_id`, `partner_id`, `request_id`/`booking_id` (nicht für Partner lesbar, nur intern), Bezirk/PLZ, `service`, `inputs` (nur Preisfelder), `volume_m3`, `preferred_date`, `time_window`, Foto-IDs (Kopien), `accept_deadline`, `status` (`open`, `closed`, `declined`). Auszahlungsvorschau und Provision werden **beim Lesen berechnet**, und zwar nur durch eine Edge Function oder im Partner-Client mit demselben `splitFee`-Modul und dem lesbaren Satz (keine SQL-View: das wäre eine zweite Gebührenrechnung in SQL, 9.1); sie werden nicht gespeichert, damit sie bei einem Satzwechsel nicht veralten und jede Annahme nicht mit 409 endet [Finding 19, R2-10]. Bei Mieten gibt es genau ein Listing je Buchung (für den Vermieter des Angebots). **Es gibt keine Spalten für Adresse, Punkte, Route, Freitext, Kunden-ID, `client_ref`.** [B11]
- **`assignments`**: (genau eines von `request_id`/`booking_id`, `partner_id`, `accepted_at`, `ended_at`, `ended_reason`). Partieller Unique-Index: höchstens eine aktive Zuordnung je Anfrage bzw. Buchung [B20].
- **`partner_offers`** (Festangebote): `request_id`, `partner_id`, `total_cents` (ganze Cent > 0, Obergrenze Frage 5; optional nur in der Spanne ± x %), `inputs` (Umfang), `valid_until`, Status siehe 4.3, `note`. Nach dem Senden unveränderlich. **Keine Spalten für Gebühr oder Auszahlung** [B8].
- **`request_contacts`** (genau eines von `request_id`/`booking_id`): Name, Telefon, E-Mail des Kunden, beim Absenden gespeichert (mit Hinweis an den Kunden, dass der Partner sie nach Annahme bekommt). Beim Absenden zeigt die App dem Kunden einen Hinweis, dass der Partner den Kontakt nach Annahme bekommt; ob das als Rechtsgrundlage der Weitergabe reicht, ist **[Frage Recht 10]**. Lesen nur über die RPC `job_contact(job)` (SECURITY DEFINER, fester `search_path`, feste Spaltenliste): prüft aktive Zuordnung und zugelassenen Partner (`my_job_partner_id()`); Zugriff endet bei Storno und X Tage nach `completed` (Frage 9); jeder Zugriff wird protokolliert [B12].
- **`job_photos`**: Kopien der Kundenfotos (siehe Abschnitt 7).

### 5.6 Nachträge

Siehe `price_revisions` mit `source = change_order`. Zusätzlich: höchstens ein offener Nachtrag je Auftrag (partieller Unique-Index), Pflicht-Fotobeleg (mindestens 1 Foto aus der Pipeline), Rechnung mit der gebuchten `price_version` und nur den geänderten Feldern von `inputs`, erneut über `parse*Input` geprüft [B5].

**Rechenregel des Nachtrags [Finding 1]:** Der vereinbarte Preis ist je nach Quelle der Revision unterschiedlich entstanden, deshalb gilt:

| Revision, auf die der Nachtrag aufsetzt | Neuer Gesamtpreis |
|---|---|
| `submit` oder `change_order` mit Festpreis (Preismodul); gilt auch für eine Kette von Nachträgen | neuer Gesamtpreis = Modul(neue Eingaben, **gebuchte** Preisversion). Vorher Integritätsprüfung: Modul(alte Eingaben, gebuchte Version) muss gleich `revision.total_cents` sein, sonst Abbruch (erkennt veränderte Tarife und Fehler in Funktionen). Das Ergebnis muss `kind = price` mit `low == high` sein, sonst Fehler `not_fixed_price`. **Preismodul-Formeln sind mit versioniert [R3-2]:** Ergebnisse veröffentlichter Versionen sind eingefroren; eine Formeländerung in `@pricing` gibt es nur zusammen mit einer neuen `price_version`, das Modul verzweigt nach Version. Je veröffentlichter Version gibt es einen Golden-Test (Beispiele aus der README und Stichproben gespeicherter Revisionen). Schlägt die Integritätsprüfung trotzdem fehl, meldet die Funktion `price_basis_changed`; der Fall wird wie ein unmöglicher Auftrag nach 10.3 behandelt. **Adressen und Route sind im Nachtrag nicht änderbar**; gerechnet wird mit der gespeicherten `route` |
| `partner_offer` (Festangebot, Spanne/`needsQuote`) | **E3-konformer Standard: kein Nachtrag.** Der vereinbarte Betrag ist der Partnerbetrag, nicht ein Modulpreis, und E3 erlaubt keinen freien Betrag. Es gilt der gebuchte Umfang zum gebuchten Preis; ist er unmöglich, Storno nach Abschnitt 10.3. **Nur wenn Beks E3 ändert** (Frage 8b), käme ein „Nachtragsangebot“ dazu: nur der zugeordnete Partner, Status bleibt `accepted`, Revision `partner_offer`, Journal `kind = change` nach 9.3, mit Obergrenze und Bestätigung des Kunden. Dieser Übergang steht bewusst **nicht** in 4.4 |

Ob ein Nachtrag den Preis auch senken darf: Frage 8.

### 5.7 Festpreis und Festangebot (Begriffe)

- **Festpreis** = `kind = price` und `low == high`. Entrümpelung hat heute immer eine Spanne (`clearance.ts:57-60`, [B7]) und läuft deshalb immer über das Angebotsverfahren. Transport/Umzug: Der Festpreis umfasst die angegebenen Stunden (`billedHours`, `transport.ts:90-100`); Mehrstunden sind nur über einen Nachtrag möglich, der **vor** der Mehrleistung bestätigt wird [B6, Frage 8].
- **Festangebot** = vom Partner gesetzter Betrag in der Spanne, nach dem Senden unveränderlich, mit `valid_until`. Bestätigt der Kunde, entsteht eine Revision mit `source = partner_offer`; die Bestätigung nennt Angebots-ID und Betrag und wird im Audit-Log festgehalten.

### 5.8 Geld

- **`commission_entries`** (Journal, ersetzt `fee_splits`): `partner_id`, `request_id`/`booking_id`, `revision_id`, `kind` (`booking`, `change`, `cancellation`, `cancellation_fee`, `correction`), `reverses_entry_id` (für Gegenbuchungen, eindeutig: höchstens eine Gegenbuchung je Zeile), `total_cents`, `fee_rate`, `fee_vat_rate`, `fee_cents`, `fee_net_cents`, `fee_vat_cents`, `payout_cents` (Beträge bei `change`/`cancellation`/`correction` dürfen negativ sein; Checks `fee_parts` und `payout_rest` gelten, `non_negative` und `total_cents >= 0` gelten **nicht**), `vat_rule`, `invoice_id` (null bis abgerechnet), `created_at`. Nur anfügen; UPDATE und DELETE per Trigger verboten (Ausnahme: einmaliges Setzen von `invoice_id`); `ON DELETE RESTRICT` auf Partner und Auftrag; Korrekturen nur als Gegenbuchung [B27].
- **`commission_invoices`**: `partner_id`, `period`, laufende Nummer (Zählerzeile mit Sperre, keine Sequence), Summen (netto, USt., brutto), Status (`issued`, `paid`, `failed`, `credited`), Verweis auf das PDF im privaten Bucket, `psp_payment_id`. Unveränderlich nach Ausstellung; Aufbewahrungsdauer 7 Jahre angenommen (BAO § 132), mit der Steuerberatung zu bestätigen [B33].
- **`partner_payment_mandates`**: `partner_id`, `psp` (Zahlungsdienstleister), `psp_customer_id`, `mandate_id`, Mandatsreferenz, Schema (CORE/B2B), Status, `signed_at`, `iban_last4`, `creditor_id` (Gläubiger-ID von MoveNow). **Keine IBAN und keine Kontodaten im Klartext in der App-Datenbank.** Vorschlag: Lastschrift über einen Zahlungsdienstleister (z. B. Stripe SEPA Debit); dann liegen Kontodaten dort, MoveNow hält nur die IDs. Das passt zur späteren Phase 2 [B32, R13]. Falls DAC7 (DPMG) die IBAN des Partners verlangt (Frage Recht 7), liegt sie verschlüsselt, nur für `service_role` lesbar, nicht in einer Tabelle der Data API.
- **Stripe-Connect-Vorbereitung (nicht umsetzen):** `partners.payout_model`, `partners.stripe_account_id`, `commission_entries.payment_flow` (`invoice_sepa` heute, `connect_fee` später). Mehr braucht Phase 2 im Schema nicht [R16].

### 5.9 Infrastruktur

- **`outbox`**: Benachrichtigungen (Mail/Push), Eintrag in derselben Transaktion wie die Zustandsänderung, `dedupe_key` eindeutig, Versand durch eine Edge Function nach Commit; Status `pending`/`sent`/`failed` [B24].
- **`audit_log`**: nur anfügen. Preisbestätigung (Nutzer, Zeit, Snapshot-Hash, Version des Bestätigungstexts), Entscheidung über Nachträge, Zugriff auf Kontaktdaten, Statusänderungen durch admin, Partner-Sperren [B42, R15].
- **`status_events`**: Historie je Auftrag (von, nach, Akteur, Zeit); füttert die Timeline in Screen 14.

---

## 6. RLS-Matrix

S/I/U/D = select/insert/update/delete. „RPC“ = nur über die benannte Funktion. „eigene“ = per `auth.uid()` bzw. Mitgliedschaft in der eigenen Firma. **Verweigert wird mit dem genauen Fehler 42501 (permission denied) bzw. 0 sichtbaren Zeilen bei SELECT** (RLS filtert). Partner = aktiver Partner (`my_partner_id()` nicht null); „pending“ = Partner mit Status pending/suspended: sieht nur die eigene Firma.

| Tabelle | anon | Kunde | Partner (aktiv) | admin | service_role |
|---|---|---|---|---|---|
| `service_requests` | – | S eigene; kein I/U/D | **S 0 Zeilen**; kein I/U/D | S (Adresse und Freitext lesbar; ein SELECT lässt sich nicht protokollieren: dokumentierte Grenze, Frage 22); kein U | alle |
| `profiles` | – | S eigene; U (`display_name`, `phone`) | **S nur eigene Zeile**; fremde Kunden-Profile 0 Zeilen | S | alle |
| `price_revisions` | – | S eigene Aufträge (ohne Gebühr, die es dort nicht gibt) | S nur Revisionen zugeordneter Aufträge (Angebot/Nachtrag) | S | I/U (Nachtragsstatus über die Funktionen) |
| `request_photos` + Bucket `request-photos` | – | wie heute (M11:21-34), nur bis zum Ende des Upload-Fensters (7.1) | **S 0, keine Storage-Policy** | Originalfotos nur über protokollierende Funktion `admin_photo` (Audit-Log), kein freies S | alle |
| `job_photos` + Bucket `job-photos` | – | – | **kein direkter Zugriff**; URL nur über Edge Function | – | alle |
| `job_listings` | – | – | S eigene Zeilen (offen, Frist nicht abgelaufen, zuständig) | S | I/U |
| `partner_offers` | – | S zu eigenen Aufträgen (ohne Auszahlung) | S/I über RPC `send_offer` (eigene) | S | U |
| `assignments` | – | S eigene Aufträge | S eigene | S | I/U |
| `request_contacts` | – | S eigene | RPC `job_contact` (nur zugeordnet, zugelassen nach 5.2, `aal2`) | nur über protokollierende Funktion `admin_contact` (Audit-Log), kein freies S | alle |
| `rental_offers` | S approved | S approved | S/I eigene Firma; Änderung nur über neue Version | S, Freigabe | alle |
| `rental_offer_versions` | S der freigegebenen aktuellen | wie anon | S/I eigene (nur Insert) | S/U (nur Freigabe) | alle |
| **`rental_bookings`** | – | **S nur eigene** (`customer_id = auth.uid()`), kein I/U/D | **S 0 Zeilen**; Zugriff nur über `job_listings` (Kategorie Miete) und `job_contact` | S | alle |
| `commission_entries` | – | **verweigert (S 0)** | S eigene Firma; kein I/U/D | S; kein U/D (Trigger) | I; U nur einmaliges Setzen von `invoice_id` |
| `commission_invoices` | – | – | S eigene Firma | S | alle |
| `partner_payment_mandates` | – | – | S eigene (ohne Kontodaten, die es nicht gibt) | S | alle |
| `partners`, `partner_members`, `partner_regions`, `partner_categories` | – | – | S eigene Firma; U nur Stammdaten (Spalten-Grant ohne Status, `verified_*`, `payout_model`) | S/U | alle |
| `partner_documents` + Bucket | – | – | I eigene, S eigene Metadaten | S | alle |
| `price_versions`, `price_config` | S (`published`) | S (`published`) | S | S/I; Veröffentlichen nur über `publish_version`; U/D **verweigert** ab `published` (Trigger) | alle |
| `platform_settings` | – | – | S Satz über `current_fee_rates` | S/I; D nur für Zeilen mit `effective_from` in der Zukunft; U verweigert | alle |
| `outbox`, `audit_log`, `status_events` | – | S `status_events` eigene Aufträge | – | S | alle |

### 6.1 Geplante RLS-Tests (je erlaubt UND verweigert, erwarteter Fehler)

Jeder Test läuft mit zwei Kunden, zwei Partner-Firmen, einem pending-Partner, admin und anon (Tests sequenziell und gepaced, wie in CLAUDE.md).

| Test | Erlaubt | Verweigert | Erwarteter Fehler |
|---|---|---|---|
| **Auflage 6a:** `rental_bookings` nur eigene Zeilen | Kunde A liest A-Buchung | Kunde B liest A-Buchung (0 Zeilen); aktiver Partner/Vermieter liest direkt 0 Zeilen; anon 0 | 0 Zeilen bei SELECT; I/U/D als Kunde: 42501 |
| `service_requests` für Partner | – | Partner liest fremde und zugeordnete Anfrage direkt | 0 Zeilen |
| Spalten von `job_listings` | Partner liest eigene Listings | Schema-Test: keine Spalten für Adresse, Punkte, Route, Freitext, `customer_id` | Test rot, sobald eine Spalte dazukommt |
| Fremdes Listing | Partner A liest A-Listing | Partner B liest A-Listing (nicht zuständig, Gebiet fremd) | 0 Zeilen |
| Listing nach Frist/Annahme | offen vor Frist | nach Fristende; nach Annahme durch anderen Partner | 0 Zeilen |
| Pending/suspended Partner | – | `accept`, `send_offer`, `job_contact`, Listings | 42501 bzw. Funktionsfehler `partner_not_active` |
| Kontaktdaten | zugeordneter Partner `job_contact` | nicht zugeordneter, abgelehnter, nach Storno/Frist | Funktionsfehler `not_assigned` (kein Datenleck in der Meldung) |
| Fotos | zugeordneter/zuständiger Partner erhält signierte URL der Kopie | anderer Partner; Original-Bucket; nach Annahme durch anderen; abgelaufenes Listing | 403 von der Function; Storage 0 Zeilen/403 |
| Gebühr für Kunden | – | Kunde liest `commission_entries`, Gebühr in `price_revisions`, `partner_offers`-Auszahlung, `job_listings` | 0 Zeilen bzw. Spalte existiert nicht |
| Journal unveränderlich | Service schreibt Gegenbuchung | UPDATE/DELETE als admin und als service_role | Trigger-Fehler `append_only` |
| Version unveränderlich | admin legt neue unveröffentlichte Version an | admin ändert/löscht veröffentlichte Version oder Zeilen | Trigger-Fehler `version_published` |
| Angebotsversion | Vermieter legt neue Version an | Vermieter ändert/löscht bestehende Version; Buchung zeigt weiter auf alte | Trigger-Fehler `append_only` |
| Statusübergänge | erlaubte Funktion je Akteur | direktes UPDATE `status` als Kunde, Partner, admin; Funktion durch falschen Akteur; unerlaubtes Paar | 42501 bzw. `invalid_transition` |
| Annahme-Konkurrenz | genau 1 von 10 parallelen Annahmen | die anderen 9; Annahme gegen Rücknahme: genau eine; Annahme nach Fristende (Cron noch nicht gelaufen) | 409 `already_taken`/`expired` |
| Preisbindung | `quote` mit gleichem angezeigten Preis | Versionswechsel/Angebotsänderung/andere Route zwischen Vorschau und Absenden | 409 `price_changed`, keine Zeile |
| Nachtrag | Partner schlägt über Preismodul vor, Kunde stimmt zu | freier Betrag; Nachtrag mit aktueller statt gebuchter Version; zwei offene Nachträge; Zustimmung eines Fremden | Funktionsfehler, 42501 |
| Kontolöschung | anonymisieren bei bestätigten Aufträgen | Kaskadenlöschung des Auftrags/Journals | FK-Fehler 23503 (RESTRICT) |
| Partner-Registrierung | Mitglied ändert Stammdaten | ändert `status`, `verified_*`, `payout_model`, Satz | 42501 |
| MFA | RPC mit `aal2` (auch `job_contact`, `my_job_partner`) | RPC mit `aal1` für Kundendaten/Bankdaten, auch `job_contact` direkt per RPC | Funktionsfehler `mfa_required` |
| `payment_hold` | `job_contact`, `start`, `complete`, Nachtrag für zugeordnete Aufträge | `accept`, `send_offer` für neue Aufträge | Funktionsfehler `partner_not_active` |
| Nachtrag bei Festangebot | – | `propose_change` auf Auftrag mit Revision `partner_offer` | Funktionsfehler `change_not_allowed` |
| Nachtrag nur Festpreis | Eingaben ergeben `kind = price` | Ergebnis ist Spanne/`needsQuote`; Änderung von Adresse oder Route | `not_fixed_price`; `route_locked` |
| Satzwechsel nach Annahme | Nachtrag und Stornogebühr mit eingefrorenem Satz | Nachtrag mit aktuellem Satz nach Satzwechsel | Funktionsfehler `fee_basis_changed` bei Abweichung; Test: Journal-Zeile trägt alten Satz |
| Erstes Setzen `current_revision` | NULL → `n = 1` bei T1/T16 | zweites Setzen auf `n = 1`; Setzen auf fremde Revision | Trigger-Fehler `invalid_revision_pointer` |
| Preismodul-Formel | Golden-Tests je veröffentlichter Version | Integritätsprüfung schlägt an (Modul(alt) ≠ gebuchter Betrag) | Funktionsfehler `price_basis_changed` |
| Direktzugriff Partner | – | Partner liest `profiles` (fremde), `request_photos`, `storage.objects` im Original-Bucket, `service_requests` direkt | 0 Zeilen bzw. 42501 |
| Querzugriff zwischen Partnern | Partner A liest eigene Zeilen | Partner B liest `commission_entries`, `commission_invoices`, `assignments`, `partner_offers`, `partner_payment_mandates`, `job_listings` von Partner A | 0 Zeilen |
| Fristen für Sätze | admin legt Satz mit Vorlauf an | admin legt `fee_rate` mit `effective_from` vor Ablauf des Vorlaufs an; admin ändert (UPDATE) oder löscht (DELETE) den geltenden Satz | Trigger-Fehler `fee_rate_notice` bzw. `fee_rate_immutable` |
| Journal: Storno nach Nachtrag | Gegenbuchung je Zeile | Nachtrag angenommen, dann Partner-Storno: Summe `fee_cents` des Auftrags ≠ 0; doppelte Gegenbuchung derselben Zeile | Test rot; Unique-Fehler 23505 auf `reverses_entry_id` |
| `current_revision` | Wechsel auf `n = alt + 1` derselben Anfrage (angenommener `change_order` bzw. `offered → accepted`) | Zeiger auf fremde Revision, andere `n`, nicht angenommenen Nachtrag | Trigger-Fehler `invalid_revision_pointer` |
| Weitervermittlung (T16) | genau eine Folgeanfrage je Quelle | zweite Folgeanfrage (Doppelklick); T16 bei `partner_offer`/Miete; nach Ablauf der Garantiefrist zum alten Preis | Unique-Fehler 23505; Funktionsfehler `reissue_not_allowed` |
| Fotos nach dem Schließen | Insert/Delete vor `photos_closed_at` | Upload und Löschen nach `photos_closed_at` | 42501 bzw. 0 Zeilen |
| Vertrauensgrenze Art A | Funktion leitet `partner_id` aus `user_id` im JWT ab | `partner_id` aus dem Body; Partner in `payment_hold` nimmt an; veralteter Satz | Funktionsfehler `partner_not_active`; 409 `fee_rate_changed` |
| Selbstfreigabe Vermieter | Vermieter legt neue Version an | Vermieter setzt `approved_*`, `status`, `current_version_id`, `partner_id` oder gibt eigene Version frei | 42501 |
| Hash der Tarifversion | `quote` mit unveränderter Version | Inhaltsänderung der Zeilen außerhalb der Trigger (Test setzt Trigger aus) | Abbruch `version_hash_mismatch` |
| Admin-Support | `admin_contact`/`admin_photo` mit Audit-Eintrag | freies SELECT auf `request_contacts`/Original-Bucket als admin | 0 Zeilen bzw. 42501 |
| Auftrag ohne Partnermeldung | – | Auftrag bleibt nach Termin + Frist nicht in `accepted` | Systemübergang T15, Journal-Zeile fällig |
| Weitervermittlung | neue Anfrage mit kopierter Revision und Preisversion | Weitervermittlung zum aktuellen Preis | Funktionsfehler `price_not_frozen` |

---

## 7. Partner-Zugriff auf Fotos (Auflage G)

**Ausgangslage:** Der Bucket `request-photos` prüft nur den Content-Type-Header (`docs/ARCHITECTURE.md:60`); ein Client ohne App kann Dateien mit GPS-Daten hochladen, GPS verrät die Hausnummer (`docs/OPEN_ISSUES.md:103`). Partner dürfen deshalb nie das Original sehen [B14].

### 7.1 Pipeline

1. Nach dem Absenden (Zeilen und Dateien im Original-Bucket) und vor der Verteilung läuft eine Edge Function (`photo-publish`, service_role): prüft die Bytes (Magic Number, Dekodierbarkeit, Pixel- und Dateigröße), kodiert neu als JPEG (lange Kante höchstens 1600 px), schreibt **ohne Metadaten** in den eigenen privaten Bucket `job-photos` und trägt `job_photos` ein (`request_id`, `source_photo_id`, Pfad, Prüfsumme).
2. **Upload-Fenster [Finding 13]:** Heute laufen Uploads asynchron nach dem Absenden (`docs/ARCHITECTURE.md:103`), und Kunden dürfen bei offenem Status Fotos anlegen (M11:25-34, M03:27-39) und löschen (M01:343-351, M02:24-35). Künftig: Der Kunde bestätigt „Fotos fertig“, oder ein Timeout (Wert Frage 23) beendet das Fenster. Erst dann wird verteilt; ab dem Schließen ist die Auswahl eingefroren. Dafür bekommt die Anfrage die Spalte `photos_closed_at` (gesetzt durch „Fotos fertig“ bzw. den Timeout-Job); eine Status-Liste könnte „vor“ und „nach Verteilung“ nicht unterscheiden, weil der Status in beiden Fällen `requested`/`awaiting_offer` bleibt. Alle vier Foto-Policies (M11:25-34, M01:343-351, M03:27-39, M02:24-35) prüfen `photos_closed_at is null`; die Verteilung setzt `photos_closed_at` voraus [R2-6]. Fotos, die später fehlen, ersetzt nur ein Nachtrag mit Beleg. Schlägt die Verarbeitung eines Fotos fehl, sieht der Partner es nicht; der Kunde bekommt eine Meldung.
3. Messen vor Umsetzung: CPU- und Speicherlimit der Edge Function beim Dekodieren von 10-MB-Bildern. Alternative: Supabase Image Transformations, vorher prüfen, ob sie die Metadaten entfernen und welchen Plan sie brauchen [B14].
4. Nachtrag-Fotos (Beleg des Partners) durchlaufen dieselbe Pipeline.

### 7.2 Wer sieht wann

| Zeitpunkt | Wer | Bedingung |
|---|---|---|
| Vor Annahme | nur Partner, denen die Anfrage angeboten wird | Listing `open`, Frist nicht abgelaufen, Partner `active`, Kategorie und Gebiet passen, Partner ist nicht der Kunde (keine Selbstbuchung) |
| Nach Annahme | nur der zugeordnete Partner | aktive `assignment`; endet bei Storno und X Tage nach `completed` (Frage 9) |
| Nie | andere Partner, anon. admin nur über die protokollierenden Funktionen `admin_photo` und `admin_contact` (Audit-Log); ein freies SELECT als admin wird entzogen, weil sich SELECT nicht per Trigger protokollieren lässt (pgAudit als Variante: Frage 22). Ausnahme und dokumentierte Grenze: Adresse und Freitext in `service_requests` sowie Name und Telefon in `profiles` bleiben für admin lesbar (Frage 22) | – |

### 7.3 Zugriffsweg

- Keine Storage-Policy für Partner, kein Direktzugriff auf `storage.objects`.
- Eine Edge Function `job-photo` prüft Berechtigung (siehe Tabelle) und erzeugt eine **signierte URL mit 10 Minuten Laufzeit** (wie heute `photoUrls`); Anzeige im Browser, kein Download-Knopf, kein dauerhafter Link.
- Löscht der Kunde ein Foto (nur solange offen), löscht ein Trigger/Job auch die Kopie; das Aufräumen (`photo-cleanup`) deckt beide Buckets ab. Nach Storno/Frist werden die Kopien gelöscht (Frist Frage 9).
- Der Kunde wird vor dem Absenden informiert, dass mehrere Partner seine Fotos sehen, bevor einer annimmt (Text mit Beks, rechtlich zu prüfen).

---

## 8. Abläufe als Schrittfolgen

Akteur in Klammern; „Funktion“ ist die serverseitige Erzwingung (4.4).

### 8.1 Festpreis-Buchung (Transport, Umzug, Montage mit Festpreis)

1. (Kunde) Konfigurator zeigt Festpreis aus der Vorschau (`@pricing`), Zusammenfassung zeigt den Betrag **centgenau** und die Button-Beschriftung nach Rechtsprüfung (Abschnitt 11).
2. (Kunde) Absenden: `quote` mit `shownTotalCents`, `priceVersion`, `clientRef`. Server prüft Eingaben (`parse*Input`), rechnet mit der genannten Version, vergleicht. Abweichung: 409 `price_changed`, neuer Preis wird gezeigt, der Kunde bestätigt erneut. [R1]
3. (Server) Speichert Anfrage und Revision 1 (`submit`), schreibt Kontaktdaten und startet das Upload-Fenster (7.1). Nach „Fotos fertig“ oder Timeout und fertiger Foto-Pipeline setzt der Server `accept_deadline` aus `now()` der Datenbank, schreibt `job_listings` für passende aktive Partner (Kategorie, Gebiet, Termin) und Outbox-Einträge. **Keine Provisionszeile, keine `fee_splits`-Zeile.**
4. (Partner) Sieht das Listing mit Bezirk/PLZ, Umfang, Fotos (Kopien), Preis und „Du erhältst X“.
5. (Partner) `accept` mit `shown_payout_cents` und Revision: Compare-and-Set auf Status `requested`, Revision, Frist. Gewinnt er: `accepted`, `assignment`, Listings schließen, `commission_entries(booking)` mit Satz und USt.-Regel dieses Zeitpunkts, Outbox. Weicht die gezeigte Auszahlung von der aktuellen ab: 409. [R6, R10]
6. (Kunde) Bekommt Bestätigung mit Partner und Kontakt; (Partner) `job_contact` liefert Adresse und Kontakt.

### 8.2 Spanne → Angebot → Bestätigung

1. (Kunde) Sendet eine Anfrage mit Spanne/`needsQuote`; Status `awaiting_offer`, Revision 1 enthält die Spanne, keine Provisionszeile.
2. (Server) Verteilt wie 8.1.
3. (Partner) `send_offer`: Betrag in ganzen Cent in der Spanne (± x %), `valid_until`; Angebot ist danach unveränderlich. Höchstens N offene Angebote je Anfrage [B23].
4. (Kunde) Sieht jedes Angebot mit Betrag und Partner; `confirm_offer` für ein Angebot: Compare-and-Set auf Status `offered`, Angebot `sent`, `valid_until`; setzt andere Angebote `superseded`; neue Revision (`partner_offer`), Status `accepted`, Journal wie 8.1 Schritt 5 mit dem Angebotsbetrag; Eintrag im Audit-Log.
5. Lehnt der Kunde alle ab: `declined`. Läuft die Frist ab: `expired`.

### 8.3 Fristablauf

1. (System) pg_cron findet Anfragen mit `accept_deadline < now()` im Status `requested`/`awaiting_offer`/`offered` und setzt `expired`, schließt Listings, schreibt Outbox.
2. Die Annahme prüft die Frist selbst, auch wenn der Job noch nicht lief: 409 `expired`. [B21]
3. (Kunde) Wird informiert; Neu senden ist eine neue Anfrage mit dem dann gültigen Preis (neue Ansicht im Sinne von E2).

### 8.4 Ablehnung durch alle Partner

1. (Partner) `decline_listing` je Partner (Listing `declined`).
2. (System) Sind alle Empfänger-Listings `declined` oder abgelaufen: Anfrage `unmatched`; Kunde wird informiert, Outbox. Kein Partner gefunden (leere Empfängermenge beim Verteilen) führt ebenfalls zu `unmatched` mit Hinweis, den Umfang oder Termin anzupassen.

### 8.5 Storno durch Kunden

1. Vor Vertrag (`requested`, `awaiting_offer`, `offered`): `withdraw` → `withdrawn`, Listings schließen, nach dem Planungsstand keine Kosten und keine Provision **[Frage Recht 3: Bindung des Kundenangebots bis zur Annahme ungeklärt]**.
2. Nach Vertrag: `cancel_by_customer` → `cancelled_by_customer`; die Stornokosten nach Regel (Abschnitt 10) gehen vom Partner dem Kunden in Rechnung; Provision nach Abschnitt 9.4. Zugriff des Partners auf Kontakt und Fotos endet nach der Frist (Frage 9).

### 8.6 Storno durch Partner

1. `cancel_by_partner` (nur nach Annahme) → `cancelled_by_partner`; Pflicht-Begründung.
2. Provision 0 (Gegenbuchungen als exakte Negation aller Journal-Zeilen des Auftrags, auch angenommener Nachträge, 9.4); Sanktion nach Regel (Verwarnung, Sperre bei Wiederholung, P2B-Begründung); der Kunde wird informiert. **Er kann neu vermitteln (T16): neue Anfrage mit denselben eingefrorenen Eingaben, derselben Revision und Preisversion, nie zum dann aktuellen Preis** [Finding 2, E2]. Ob die Weitervermittlung automatisch oder auf Knopfdruck läuft, entscheidet Frage 12; der Preis ist nicht verhandelbar. Gilt ebenso nach einer Korrektur durch admin (T14).
3. Gegen Missbrauch (Annehmen und Stornieren, um Adressen zu sammeln): Obergrenze offener angenommener Aufträge, Storno-Quote je Partner, Sperrregel mit Begründung [B16].

### 8.7 Nachtrag (Mehraufwand)

1. (Partner) `propose_change` vor der Mehrleistung: korrigierte Eingaben, Pflicht-Fotobeleg; die Edge Function (Art A, 4.5) prüft mit `parse*Input` und rechnet mit der **gebuchten** Preisversion über das Preismodul nach der Regel in 5.6 (Modul neu mit gebuchter Version, Integritätsprüfung gegen die gebuchte Revision, nur Festpreis, keine Adress- oder Routenänderung); es gibt kein Betragsfeld. Bei Aufträgen aus einem Festangebot gibt es keinen Nachtrag (E3-konformer Standard, Frage 8b). [R4]
2. (Kunde) Erhält Benachrichtigung; sieht Differenz und neuen Gesamtpreis, Beleg-Fotos (durch dieselbe Pipeline). `decide_change`.
3. Zustimmung: neue Revision (`change_order`), neuer Gesamtpreis, `commission_entries(change)` (Abschnitt 9.3), Audit-Log.
4. Ablehnung oder Ablauf: gebuchter Umfang zum alten Preis; ist der Auftrag dann unmöglich, Storno nach Abschnitt 10 (Kostenregel). Ohne Zustimmung darf der Partner die Mehrleistung nicht verlangen.

### 8.8 Miete (Sonderfall)

1. (Kunde) Bucht ein freigegebenes Angebot (aktuelle Version) zum angezeigten Betrag; `quote` mit `offerVersionId` und `shownTotalCents`; Abweichung 409. Kaution ist nie Teil des Preises oder der Provisionsbasis.
2. (Server) Legt die Buchung mit `offer_version_id` und Revision 1 an; die Buchung geht **direkt an den Vermieter des Angebots** (keine Verteilung an viele). Frist wie 8.3.
3. (Vermieter, Partner der Kategorie Miete) `accept`, wie 8.1 (Compare-and-Set auf die eine Buchung); Journal-Zeile bei Annahme.
4. Mehr-Kilometer nach Rückgabe, Schäden, Selbstbehalt, Kraftstoff: Regel Frage 13; sie gehören nie zur Provisionsbasis, soweit es Kaution, Kraftstoff und Schäden betrifft [B9].

---

## 9. Geld

### 9.1 Grundsätze

- Cent-Ganzzahlen, Rechnen wie der Prototyp, gerundet erst am Ende (CLAUDE.md, „Geld“). Die Preislogik wird **nicht neu geschrieben**: `splitFee(totalCents, {feeRate, vatRate})` aus `supabase/functions/_shared/pricing/fee.ts` (F:6-25) bleibt die einzige Stelle, die die Gebühr kennt; der Satz kommt als Parameter aus `platform_settings` über `current_fee_rates` (jetzt mit `effective_from`).
- Kunden sehen die Gebühr nirgends: nicht in Preisen, Revisionen, Angeboten, Listings, Mails, Rechnungen des Partners an den Kunden. Partner sehen Provision und Auszahlung vor der Annahme und im Journal (E5).
- Kaution, Kraftstoff und Schäden sind nie Berechnungsbasis.

### 9.2 Provision je Auftrag

Bei der Annahme (T3/T5) schreibt dieselbe Transaktion `commission_entries(kind = booking)`: `splitFee(total, Sätze zum Zeitpunkt der Annahme)`, `vat_rule` des Partners. Vorher gibt es keine Zeile; die Vorschau „Du erhältst X“ in `job_listings` rechnet mit demselben `splitFee`, die Annahme prüft `shown_payout_cents` und lehnt bei Abweichung (Satzänderung dazwischen) mit 409 ab. [B26]

### 9.3 Nachtrag

Nach Zustimmung: `splitFee(neuer Gesamtpreis, Satz und USt.-Regel der Buchungszeile)` rechnen, also **mit dem bei der Annahme eingefrorenen Satz**, nicht mit dem aktuellen; so mischt die Differenz keine zwei Sätze und eine Satzsenkung ergibt bei einer Preiserhöhung keine negative Provision. Die **Differenz der Komponenten** zur Summe der bisherigen Zeilen dieses Auftrags wird als `kind = change` gebucht (nicht `splitFee(Differenz)`), damit sich Rundungen nicht addieren [B28]. `splitFee` wird nur mit nicht negativem Gesamtpreis aufgerufen (F:19 wirft sonst); die Differenz entsteht aus zwei solchen Aufrufen. Ein abgelehnter Nachtrag bucht nichts.

### 9.4 Storno

- Vor Vertrag (`withdrawn`, `expired`, `declined`, `unmatched`): keine Zeile, keine Provision.
- Nach Vertrag, Storno durch den Kunden: Der Storno negiert **jede noch nicht gegengebuchte Zeile des Auftrags einzeln** (die `booking`-Zeile und alle `change`-Zeilen) als `cancellation` mit `reverses_entry_id`, jeweils als **exakte Negation**, nie über `splitFee`. Ein Unique-Index auf `reverses_entry_id` verhindert eine doppelte Gegenbuchung. Darf der Partner eine Stornogebühr berechnen, kommt eine neue Zeile der Art `cancellation_fee` auf diese Basis (`splitFee(Stornogebühr)` mit Satz und `vat_rule` der Buchungszeile). Provisionsbasis ist der Betrag, den der Partner dem Kunden berechnen darf [B31, Finding 7]. Test: „Nachtrag angenommen, dann Storno ⇒ Summe der `fee_cents` des Auftrags = 0 (bzw. = Provision der Stornogebühr)“.
- Storno durch den Partner: dieselben Gegenbuchungen aller Zeilen, Summe der Provision 0, Sanktion.
- Storno nach bereits ausgestellter Rechnung: Storno- bzw. Korrekturrechnung im Folgemonat (Journal-Zeile `cancellation` mit Verweis auf die Rechnung), nie Änderung der Rechnung; ob diese Form zulässig ist und ob „Gutschrift“ (im UStG ein belegter Begriff) so heißen darf, ist mit der Steuerberatung zu bestätigen (Frage 14). Den Betrag der Stornogebühr rechnet der Server aus Regel (10.2) und Revisionsbetrag, es gibt keinen freien Betrag [R3-14].
- Gegen Umgehung („Storno melden, bar kassieren“): Nach dem Termin fragt die App den Kunden, ob der Auftrag stattgefunden hat; Abweichungen lösen eine Prüfung aus.

### 9.5 Monatsabrechnung

1. Am Monatsende (Wiener Zeit) bündelt ein Job alle Zeilen mit `invoice_id` null und Status `completed` bzw. storniert (Basis: durchgeführte Aufträge und Stornogebühren) je Partner zu einer Sammelrechnung. Aufträge, die der Partner nie meldet, werden über T15 (Termin + Frist) `completed` und damit abgerechnet; ohne T15 bliebe ein nie gestarteter Auftrag dauerhaft in `accepted`.
2. Brutto = Summe `fee_cents`; Netto und USt. nach festgelegtem Rechenweg (je Zeile summiert oder einmal auf die Summe; beides ergibt eine Abweichung von höchstens n × 0,5 Cent; Rechenweg mit Steuerberatung festlegen und per Test sichern, Frage 14) [B28].
3. Fortlaufende Rechnungsnummer (Zählerzeile mit Sperre), PDF im privaten Bucket; Aufbewahrungsdauer (7 Jahre nach BAO § 132 angenommen) mit der Steuerberatung zu bestätigen, Abschnitt 12.
4. Einzug per SEPA-Lastschrift über den Zahlungsdienstleister mit Vorabankündigung (Frist nach SEPA-Schema), Gläubiger-ID; Rücklastschrift → Partner `payment_hold` (Abschnitt 10, Punkt 4).
5. Auftragsstatus `settled`, sobald alle Zeilen auf einer bezahlten oder eingezogenen Rechnung stehen.

### 9.6 Was mit `fee_splits` passiert

`fee_splits` wird durch das Journal ersetzt (keine Kompatibilitätsschicht, Dev-Daten werden verworfen). Heutige Eigenschaften, die entfallen: eine Zeile je Anfrage, Upsert, Kaskadenlöschung, `payee_id` null bei Kontolöschung (M01:196-212, M10:97-100). Die Checks `fee_parts` und `payout_rest` (M01:211-212) übernimmt das Journal; **nicht** übernommen werden `non_negative` (M02:43-44) und `total_cents >= 0` (M01:201), weil Gegenbuchungen negativ sind (5.8). Die Schreibung von `fee_splits` in `quote` (H:259, M10:89-101) entfällt mit S9a, damit beim Absenden keine Gebührenzeile ohne Empfänger mehr entsteht; das Journal selbst entsteht in S9b (es braucht `partners`).

### 9.7 Phase 2 (später)

Bei `payout_model = connect` entsteht dieselbe Journal-Zeile mit `payment_flow = connect_fee`; die Gebühr wird als Application Fee abgezogen statt per Sammelrechnung eingezogen. Das Schema ändert sich dafür nicht (Felder in 5.8).

---

## 10. Vorschläge, die Beks entscheidet

Jede Zeile ist **Vorschlag – Beks bestätigt**; bis dahin gilt keine Variante.

### 10.1 Annahmefrist

| Variante | Beschreibung | Folgen |
|---|---|---|
| A | feste 24 Stunden ab Absenden | einfach; bei Terminen in 2 Tagen kann ein Kunde zu lange warten; Partner antworten selten nachts |
| B | **gestaffelt:** höchstens 24 Stunden, höchstens die Hälfte der Zeit bis zum Wunschtermin, mindestens 2 Stunden | Kunde bekommt rechtzeitig Klarheit; etwas mehr Logik (Berater empfiehlt Frist aus `now()` der DB, höchstens Wunschtermin minus Vorlauf [B21]) |
| C | kurz: 4 Stunden, danach Neustart | schnelle Gewissheit; Partnern bleibt wenig Zeit, mehr Fälle `expired` und `unmatched` |

Vorschlag: B. Zu entscheiden auch: Frist für Festangebote (`valid_until`) und für Nachträge.

### 10.2 Stornoregeln und -kosten

| Variante | Kunde (nach Annahme) | Partner (nach Annahme) |
|---|---|---|
| A | kostenlos bis 48 Stunden vor Termin; danach 50 %; ab 24 Stunden 100 % des Preises | Provision 0, erste Verwarnung, ab 2. Storno in 90 Tagen Sperre auf Zeit |
| B | kostenlos bis 72 Stunden; 25 % bis 24 Stunden; danach 50 % | wie A, zusätzlich Ersatzvermittlung, wenn möglich (Frage 12) |
| C | gestaffelt nach Leistungsart (Transport/Miete mit festem Termin strenger als Entrümpelung/Montage) | wie A |

Folgen: Stornogebühren sind Teil der Provisionsbasis (9.4); Klauseln müssen § 6 KSchG standhalten (Frage Recht 5). Vorschlag: C, Zahlen nach Rechtsprüfung.

### 10.3 Kosten bei unmöglichem Auftrag nach abgelehntem Nachtrag

| Variante | Regel | Folgen |
|---|---|---|
| A | Kunde zahlt eine Anfahrts-/Ausfallpauschale an den Partner (Betrag aus dem Preismodul, z. B. Mindestpreis oder 1 Stunde) | Partner ist geschützt; Konflikte, wenn der Kunde den Mangel nicht kannte |
| B | kostenlos für beide; Partner trägt den Aufwand | kundenfreundlich; Partner wehren sich, Nachträge werden häufiger gestellt |
| C | je nach Ursache: falsche Angaben des Kunden → A, Fehleinschätzung des Partners → B | gerecht, aber Streit über die Ursache |

Vorschlag: C, mit Fotobeleg als Entscheidungsgrundlage.

### 10.4 Partner, der die Provision nicht zahlt

| Variante | Stufen | Folgen |
|---|---|---|
| A | Rücklastschrift → sofort `payment_hold` (keine neuen Annahmen), Mahnung nach 7 Tagen, Sperre nach 30 Tagen | schnell, hart; Fehlbuchungen sperren zu Unrecht |
| B | Rücklastschrift → Erinnerung, `payment_hold` nach 14 Tagen, Sperre nach 45 Tagen, danach Inkasso | fair; Risiko steigt |
| C | wie B, plus Sicherheitsleistung/Kaution bei neuen Partnern | schützt MoveNow; höhere Einstiegshürde |

Immer: schriftliche Begründung der Sperre (P2B Art. 4, Frage Recht 4) und Möglichkeit der Stellungnahme; laufende Aufträge werden abgewickelt oder umgeleitet.

### 10.5 Weitere Entscheidungen, die Beks trifft

Haltefenster für den Preis (N Minuten; 10, 60 oder nur die aktuelle Version), Obergrenze und Spanne des Festangebots, Besichtigung (eigener Annahmeschritt oder streichen), MFA-Pflicht für Partner, Kontaktzugriff X Tage nach `completed`, Freigabe je Angebotsversion der Vermieter. Sie stehen mit Nummern in Abschnitt 14.

---

## 11. Rechtliche Prüfpunkte (nicht geklärt, Fragen an Anwalt/WKO)

Nichts hier ist beantwortet oder als zulässig dargestellt.

1. **FAGG-Informationspflichten und Button-Beschriftung:** Welche Informationen muss der Kunde vor der Bindung sehen (Gesamtpreis, Vertragspartner, Dauer, Widerrufsinformation)? Ist „Zahlungspflichtig buchen“ die richtige Beschriftung, wenn der Kunde direkt an den Partner zahlt und der Vertrag erst mit Annahme entsteht?
2. **Rücktrittsrecht je Leistungsart:** Transport und Fahrzeugmiete mit festem Termin (Ausnahme nach FAGG § 18 Abs. 1 Z 10?) gegenüber Entrümpelung und Montage; vorzeitiger Leistungsbeginn und Wertersatz; Belehrung und Einwilligung im Ablauf.
3. **Bindungsfrist des Kundenangebots:** § 862 ABGB gegenüber dem Zurückziehen (T2) vor Annahme; ist ein Widerruf bis zur Annahme zulässig oder bindend?
4. **P2B-Verordnung (EU 2019/1150):** Art. 3 (15 Tage Vorlauf für Änderungen der Bedingungen, inklusive Provisionssatz), Art. 4 (begründete Sperre), Art. 5 (Ranking/„erste Annahme“), Art. 11 (Beschwerdeverfahren); was muss in den Partner-AGB stehen?
5. **Stornoklauseln:** § 6 KSchG für Kunden-Stornokosten (Abschnitt 10.2).
6. **Omnibus-Hinweis/§ 4a FAGG:** Der Kunde muss vor der Bindung wissen, wer Vertragspartner ist; der Partner steht aber erst nach der Annahme fest. Wie ist der Hinweis zu formulieren?
7. **ZaDiG:** Warum läuft in Phase 1 kein Geld über MoveNow (Kunde zahlt direkt an Partner, MoveNow zieht nur die eigene Provision ein)? Reicht diese Konstruktion, damit keine Zahlungsdienst-Konzession nötig ist? Gilt dasselbe für Phase 2 mit Stripe Connect? Dazu: Meldepflicht nach DPMG/DAC7 (IBAN des Anbieters?), Risiko einer Leistungskommission (§ 3a UStG) und Haftung als Vermittler.
8. **Gewerbeberechtigung für die Vermittlung** (und ob Güterbeförderung durch die Partner eine Konzession erfordert); Pflichten bei Entrümpelung (Abfall).
9. **Umsatzsteuer:** Stimmt „inkl. 20 % USt.“ der Provision, wenn der Partner Kleinunternehmer ist oder im EU-Ausland sitzt (Reverse Charge)? Ist MoveNow selbst Kleinunternehmer?
10. **DSGVO:** Rollen zwischen MoveNow und Partner (getrennte Verantwortliche oder Auftragsverarbeitung), Weitergabe von Kontakt und Fotos nach Annahme, Aufbewahrungsfristen, Mail-Dienstleister (Auftragsverarbeitungsvertrag, EU).
11. **SEPA:** CORE oder B2B, Vorabankündigung, Gläubiger-ID, Widerruf des Mandats.

---

## 12. Abhängigkeiten zu offenen Entscheidungen

| Entscheidung | Betrifft | Stand |
|---|---|---|
| **Mailanbieter** (Custom SMTP, Auftragsverarbeitungsvertrag, EU) | Benachrichtigungen an Kunden und Partner, Outbox-Versand, Auth-Mails mit Code (`docs/OPEN_ISSUES.md:31`), SPF/DKIM/DMARC | offen; ohne ihn keine Annahme-/Fristmeldungen [B41] |
| **Aufbewahrungsfristen** (Fotos 90 Tage, Aufträge 3 Jahre, ab Rechnungen 7 Jahre BAO § 132, Kontakt X Tage) | Löschjobs, Anonymisierung, Journal, Kontakt-/Foto-Zugriff | Vorschlag in `docs/ARCHITECTURE.md:62`, Entscheidung offen |
| **Domain** | `ALLOWED_ORIGINS`, Site URL, Redirects der Auth-Mails, Absender (DMARC), Links in Mails | offen (`docs/OPEN_ISSUES.md:19, 31`) |
| **Zahlungsdienstleister für SEPA** (Stripe oder anderer) | Mandat, Einzug, Phase 2 | offen; Frage Recht 7 |
| **Steuerberatung** | USt.-Rechenweg der Sammelrechnung, Kleinunternehmer, Reverse Charge | offen |
| **ORS-Vertrag** (Routing) | Preise der Umzüge in der Vorschau und bei `quote` | offen (`docs/OPEN_ISSUES.md:18, 22`) |
| **Partner-AGB und Kunden-AGB** | Button, Einwilligungstexte, Sperre, Storno | offen; Platzhalter `/profil/impressum` |
| **Hosting** | Auslieferung der App, Edge-Function-Regionen | offen (CLAUDE.md) |

---

## 13. Umsetzungsplan

Namen: **S9a ff.** wie vorgegeben, aber siehe Frage 1: „S9“ ist in der ROADMAP schon die Transportermiete. Jeder Schritt ist eine Session nach CLAUDE.md (Checks grün, Commit, Stopp). Reihenfolge ist Abhängigkeit; ein Schritt beginnt erst, wenn Beks die Regeländerungen aus 1.3 und die Entscheidungen aus 10 freigegeben hat.

| Schritt | Umfang | Migrationen (nur benannt) | Tests | Opus-Berater |
|---|---|---|---|---|
| **S9a Fundament** | Regeln in CLAUDE.md/ARCHITECTURE/ROADMAP anpassen (nach Freigabe); `published` + `content_hash` + Unveränderlichkeit der Preisversionen; `effective_from` mit Mindestvorlauf für Gebührensätze; `status_events`, `audit_log`; Statusfunktionen (`withdraw`), Übergangs-Trigger ohne Rollen-Ausnahme, UPDATE-Grants entzogen; `price_revisions` und `current_revision`; `quote` mit `shownTotalCents`/`priceVersion`, Haltefenster, 409 `price_changed`; Bearbeiten nach Absenden entfällt; Kontaktdaten beim Absenden; **`quote` schreibt kein `fee_splits` mehr, weder für Anfragen (H:259, M10:89-101) noch für Mieten (H:305, M10:136-140; die App liest `fee_splits` nirgends, `src/` ohne Treffer)**; das Journal folgt in S9b, weil es `partners` braucht [Finding 5, R2-7, R3-12]; RPC „Fotos fertig“ (Art B); Anpassung der bestehenden Tests `tests/rls/rls.test.ts:268-304` (admin verliert das UPDATE auf `status`); `price_revisions` nur für Anfragen (die Spalte `offer_version_id` für Mieten kommt in S9g) [R3-6d]; `photos_closed_at` und Upload-Fenster | `…_versions_published`, `…_fee_effective_from`, `…_revisions`, `…_status_machine`, `…_request_contacts`, `…_photos_closed` | Unit (Haltefenster, Version, Hash, Rundung, `splitFee` unverändert), RLS (Version unveränderlich, Hash, Satzvorlauf und Unveränderlichkeit, Statusübergänge, direktes UPDATE verweigert, `current_revision`-Zeiger, Fotos nach Schließen), E2E (Preis ändert sich zwischen Vorschau und Absenden) | **ja** (Geld, Schema, RLS) |
| **S9b Partner und Journal** | `partners`, `partner_members`, Kategorien, Gebiete, Dokumente; `partner_vat_rules`; Helfer `my_partner_id()` (annehmen) und `my_job_partner_id()` (abwickeln); Registrierung mit Prüfung durch admin; MFA (TOTP) für Partner-RPCs; `become_rental_provider` entfällt; **Journal `commission_entries` (Trigger append-only, `ON DELETE RESTRICT` auf `partners`, ohne Rechnungen und SEPA) ersetzt `fee_splits`** | `…_partners`, `…_partner_registration`, `…_commission_journal` (Spalte `invoice_id` zunächst ohne Fremdschlüssel; er folgt in S9h) | RLS (Spalten-Grants, pending/suspended, Auflage 6a vorbereiten, Journal append-only, Kunde liest Journal nicht, Querzugriff), Unit (Registrierung, Gegenbuchung = Negation, Storno nach Nachtrag), E2E (Registrierung bis Freigabe) | **ja** (Rollen, RLS, Auth, Geld) |
| **S9c Verteilung und Annahme** | `job_listings`, `assignments`, Verteilung nach Kategorie/Gebiet/Termin, `accept` (Compare-and-Set), `decline_listing`, Frist und `expired` per pg_cron, Outbox und Mail-Versand, `job_contact`, `my_job_partner(job)` (RPC für den Kunden, braucht `assignments`), `start` (T9) und `complete` (T10) [R3-6c, e] | `…_job_listings`, `…_assignments`, `…_accept`, `…_deadlines_cron`, `…_outbox` | RLS (Listing-Spalten, fremde Listings, Kontakt), **Nebenläufigkeit** (10 parallele Annahmen = 1; Annahme gegen Rücknahme; Annahme nach Fristende), Unit (Verteilung), E2E (Kunde bucht, Partner nimmt an) | **ja** |
| **S9d Fotos für Partner** | Pipeline `photo-publish` (Prüfen, Neu-Kodieren, Metadaten entfernen), Bucket `job-photos`, `job_photos`, Function `job-photo` mit signierten URLs, Aufräumen für beide Buckets; Messung CPU/Speicher | `…_job_photos` | RLS/Storage (Partner ohne Direktzugriff), Unit (Neu-Kodierung ohne EXIF), E2E (Foto im Listing, Original unzugänglich) | **ja** (Sicherheit) |
| **S9e Festangebot** | `partner_offers`, `send_offer`, `confirm_offer`/`reject_offers`, `valid_until`, `superseded`, Besichtigung nach Entscheidung 10.5 | `…_partner_offers` | RLS (Unveränderlichkeit, Kunde sieht keine Auszahlung), Nebenläufigkeit (zwei Angebote), E2E | **ja** |
| **S9f Nachtrag** | `propose_change` (Preismodul mit gebuchter Version), `decide_change`, Beleg-Fotos über die Pipeline (**setzt S9d voraus**: Reihenfolge S9d vor S9f) | `…_change_orders` | Unit (Preis aus Eingaben, gebuchte Version, nie aktuelle), RLS (kein freier Betrag, ein offener Nachtrag), E2E | **ja** (Geld) |
| **S9g Miete und Vermieter** | `rental_offer_versions`, `rental_offers` mit `partner_id`, Buchung mit `offer_version_id`, Direkt-Annahme durch den Vermieter; **Auflage 6a**: `rental_bookings` nur eigene Zeilen, Partner 0 Zeilen; Vermieterbereich (Screen 18) auf Partner umgestellt | `…_rental_versions`, `…_rental_bookings_partner` | RLS (Auflage 6a, Version unveränderlich, kein Direktzugriff), E2E (Cargo-Van 276,00 € mit Kaution 500,00 € separat) | **ja** |
| **S9h Abrechnung** | `commission_invoices` (und der Fremdschlüssel von `commission_entries.invoice_id`, den S9b noch ohne Fremdschlüssel anlegt), Monatslauf, Rechnungsnummer, PDF, SEPA-Mandat und Einzug über Zahlungsdienstleister, `payment_hold`, Systemübergang T15 und Meldung „hat stattgefunden?“ (Das Journal selbst entsteht in S9b, `partner_vat_rules` ebenfalls, weil `accept` in S9c die `vat_rule` schreibt) | `…_invoices`, `…_mandates`, `…_vat_rules` | Unit (Rundung der Rechnung, Gutschrift im Folgemonat, T15 rechnet nach Frist ab), RLS (Partner sieht nur eigene Rechnungen, Mandat ohne Kontodaten), E2E | **ja** (Geld, Pflicht) |
| **S9i Storno, Sperren, Konto löschen** | `cancel_by_customer`/`cancel_by_partner`, Stornoregeln, Sanktionen, Sperrverfahren mit Begründung, Konto löschen mit Anonymisierung (inkl. Vermieter mit Buchungen), `admin_correct` (T14) und „neu vermitteln“ (T16) [R3-6e] | `…_cancellation`, `…_account_deletion` | Unit (Regeln), RLS (Kaskade verweigert, 23503), E2E | **ja** |
| **S9j Oberflächen** | Kunde: Button/Texte nach Rechtsprüfung, Aufträge-Detail (14) mit Status, Angebote, Nachtrag; Partner-Portal (Listings, Annahme, Angebot, Nachtrag, Abrechnung); `formatEuro` für alle verbindlichen Beträge | – | E2E mit Tastatur, `shots` (Reviewer mit Bildsicht, Regel in CLAUDE.md) | nein (nur UI), Geld-Anzeige durch Reviewer |

**Reihenfolge:** S9a → S9b → S9c → (S9d, S9e, S9f; je Abnahme) → S9g → S9h → S9i → S9j. S9d muss vor dem ersten Partner mit Foto-Sicht (S9c in Produktion) fertig sein; ohne S9d bekommt S9c im Listing keine Fotos; **S9d liegt vor S9f** (Beleg-Fotos). Die Spalte `price_revisions.offer_version_id` und der Fremdschlüssel auf `rental_offer_versions` kommen erst mit S9g. Das Journal liegt in S9b (nach `partners`, vor S9c), damit S9c (`accept`), S9e (`confirm_offer`) und S9f (Nachtrag) schon Zeilen schreiben können; S9a entfernt nur die `fee_splits`-Schreibung in `quote`. S9h ergänzt Rechnung, Mandat und Einzug. Alle Übergänge mit Preis oder Gebühr (Art A in 4.5) sind Edge Function + SQL-Funktion, das Muster von `quote`.

---

## 14. Offene Fragen an Beks

1. **Namen:** In der ROADMAP ist „S9“ die Transportermiete mit Vermieterbereich. Sollen die Schritte hier S9a ff. heißen (wie beauftragt) oder umbenannt werden (z. B. P1 ff.), und in welcher Reihenfolge stehen sie zur Miete? (Das Konzept zieht die Miete in S9g auf Partner um.)
2. **Regeländerungen (1.3):** Gibst du die Änderungen an CLAUDE.md („unverbindlich“, „Partner bestätigt außerhalb der App“, „Kunden setzen nur …“), ARCHITECTURE und der ROADMAP („Später“) frei?
3. **Bearbeiten nach dem Absenden:** Streichen (Vorschlag, zurückziehen und neu senden) oder nur vor der Verteilung erlauben?
4. **Haltefenster (N) und Auslegung von E2:** Wie lange darf der Kunde noch zum alten Preis buchen, nachdem eine neue Preisversion gilt (10 Minuten, 60 Minuten, gar nicht)? Bestätigst du die Auslegung „E2 heißt: nie stillschweigend; eine Abweichung bindet nie und braucht erneute ausdrückliche Bestätigung“?
5. **Festangebot:** Obergrenze des Betrags und ob er nur innerhalb der angezeigten Spanne ± x % liegen darf; höchstens N offene Angebote je Anfrage; Gültigkeit.
6. **Besichtigung:** eigener Annahmeschritt („Besichtigung annehmen“, ein Partner, Adresse wird freigegeben, eigene Frist und Stornoregeln) oder streichen und nur nach Fotos anbieten? (Heute `inspection_requested`, M01:128.)
7. **Vermieter-Freigabe:** Muss jede neue Angebotsversion eines Vermieters erneut von admin freigegeben werden (vorher: `OPEN_ISSUES.md:6`)? Ändert sich `provider_name` nur mit Neufreigabe?
8. **Festpreis und Nachträge bei Transport/Umzug:** Umfasst der Festpreis die angegebenen Stunden, und sind Mehrstunden nur über einen vorab bestätigten Nachtrag möglich? Darf ein Nachtrag den Preis auch senken?
   **8b. Nachtrag bei Festangebot (Abweichung von E3 nur auf deine Änderung):** Standard nach E3: Bei Aufträgen aus einem Partner-Festangebot (Entrümpelung, `needsQuote`) gibt es **keinen** Nachtrag, weil der Betrag nicht aus dem Preismodul stammt; gebuchter Umfang zum gebuchten Preis, sonst Storno (10.3). Soll es trotzdem Mehraufwand geben, müsstest du E3 ändern: ein Nachtragsangebot des zugeordneten Partners mit freiem Betrag (Obergrenze) und Bestätigung des Kunden. Welche Variante?
9. **Kontakt und Fotos nach dem Auftrag:** Wie viele Tage nach `completed` oder Storno darf der Partner Kontaktdaten und Fotos noch sehen (X)?
10. **Partner-Firma:** Soll die Firma mehrere Mitglieder (Fahrer, Disponent) haben (Konzept: ja) und gilt MFA (TOTP) als Pflicht für Partner?
11. **Gebiet:** Gebiet als PLZ-/Bezirksliste (Konzept) oder zusätzlich Radius um einen Standort? Gilt das Gebiet für Abholung, Ziel oder beide (Umzug über Wien hinaus)?
12. **Weitervermittlung nach Partner-Storno (T16):** Läuft sie automatisch oder auf Knopfdruck des Kunden (automatisch bindet den Kunden ohne neue Erklärung, Frage Recht 3/6)? Der Preis steht fest: dieselbe eingefrorene Revision und Preisversion, nie der dann aktuelle Preis. Zu entscheiden: Dauer der Garantiefrist (Termin + X Tage, höchstens Y Tage nach dem Storno).
   **12b. T16 bei Festangebot und Miete:** Konzept: nicht erlaubt, weil der Betrag eines fremden Angebots bzw. einer anderen Angebotsversion für andere nicht gilt; der Kunde entscheidet neu (zurück zu `awaiting_offer` bzw. neue Miete). Einverstanden?
13. **Miete:** Regel für Mehr-Kilometer nach Rückgabe, Schäden und Selbstbehalt (Nachtrag, Abrechnung durch den Vermieter, nur außerhalb der Plattform?).
14. **USt. der Sammelrechnung:** Rechenweg (je Zeile oder auf die Summe) und Umgang mit Partnern ohne österreichische USt.-Pflicht, mit der Steuerberatung festlegen.
15. **Gebührenänderung:** Mindestvorlauf für Änderungen des Satzes (die Datenbank erzwingt ihn per Trigger; ob P2B Art. 3 mit 15 Tagen gilt, ist Frage Recht 4) und Information der Partner.
16. **Zahlungsdienstleister** für SEPA und später Connect: Stripe oder ein anderer; wer hält die Gläubiger-ID?
17. **Partner-Qualität:** Obergrenze offener angenommener Aufträge je Partner, Storno-Quote und Sperrstufen (Abschnitt 10.4).
18. **Nachweis „Hat der Auftrag stattgefunden?“:** Soll die App den Kunden danach fragen (Gegen Umgehung, 9.4), und wie lange ist die Antwortfrist?
19. **Realtime/Push:** Sollen Partner Benachrichtigungen per Push erhalten (nur PLZ und Service) oder nur per Mail? Broadcast-Kanäle brauchen eigene Regeln [B17].
20. **Rechtsprüfung:** Wer klärt die Punkte aus Abschnitt 11, und bis wann (Voraussetzung für S9j)?
21. **Automatische Fertigmeldung (T15):** Wie viele Tage nach dem Termin gilt ein Auftrag ohne Storno und ohne Partnermeldung als durchgeführt (und damit als abrechenbar)? Wie lange hat der Kunde Zeit, „hat nicht stattgefunden“ zu melden?
22. **Admin-Einsicht:** Adresse und Freitext in `service_requests` sowie Name und Telefon in `profiles` (M01:264) sind für admin heute per SELECT lesbar; Kontakt (`request_contacts`) und Originalfotos laufen nur über protokollierende Funktionen. Reicht das, soll admin-SELECT auf `profiles` auf die eigene Zeile beschränkt werden, oder soll auch die Adresse hinter eine protokollierende Funktion? Variante: pgAudit (Objekt-Audit) für SELECT auf diese Tabellen, falls der Plan es erlaubt (zu prüfen); „SELECT lässt sich nicht per Trigger protokollieren“ ist die engere Aussage.
23. **Upload-Fenster:** Wie lange (Timeout) und ob der Kunde „Fotos fertig“ bestätigen muss, bevor verteilt wird (7.1); danach ist die Fotoauswahl eingefroren.
