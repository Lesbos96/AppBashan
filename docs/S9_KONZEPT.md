# MoveNow · S9-Konzept: Partner, verbindliche Buchung, Provisions-Journal

Stand: 2026-11-01, überarbeitet nach den Entscheidungen von Beks vom 01.11.2026 (MVP-Schnitt Phase 1; Abschnitte 10, 13 und 14). Reines Konzeptdokument: kein Code, keine Migration, kein SQL zum Ausführen. Es beschreibt, was gebaut werden soll. Nichts hier ist umgesetzt; die Regeländerungen in 1.3 sind von Beks freigegeben und angewendet.

Kennzeichnung: **[Entscheidung Beks]** = feste Vorgabe (E1–E5). **[Entschieden (Beks, 01.11.2026)]** = Entscheidung vom 01.11.2026. **[Entwurf]** = mein Vorschlag zur Umsetzung, noch nicht freigegeben. **[Frage Recht]** = nicht geklärt, geht an Anwalt/WKO (Abschnitt 11). **[Phase 2]** = wird in Phase 1 nicht gebaut; das Datenmodell darf es vorsehen. **[B#n]** = eingearbeitetes Finding n aus dem Berater-Bericht Runde A (`tmp/proof/s9-konzept-berater-plan.md`). **[Finding n]**, **[R2-n]**, **[R3-n]** = Finding n aus der Abnahme Runde 1, 2 bzw. 3 (`tmp/proof/s9-konzept-abnahme-runde1.md`, `-runde2.md`, `-runde3.md`). **[R4-n]** und höher = Findings der folgenden Abnahmen (`tmp/proof/s9-konzept-abnahme-runde4.md` ff.).

Beleg-Kürzel für Dateien (Abschnitt 2): `M01` = `supabase/migrations/20261029141616_0001_foundation.sql`, `M02` = `…20261029142841_0002_hardening.sql`, `M03` = `…20261029143406_0003_policy_recursion.sql`, `M04` = `…20261029190744_0004_price_config_checks.sql`, `M10` = `…20261030120000_0010_quote.sql`, `M11` = `…20261101120000_0011_photos.sql`, `M13` = `…20261101140000_0013_photo_limit_retry.sql`, `M14` = `…20261101150000_0014_photo_cleanup_loud.sql`; `H` = `supabase/functions/_shared/quote/handler.ts`; `Q` = `supabase/functions/_shared/quote/db.ts`; `F` = `supabase/functions/_shared/pricing/fee.ts`.

---

## 1. Entscheidungen E1–E5 und daraus folgende Anforderungen

### 1.1 Übernommene Entscheidungen [Entscheidung Beks]

- **E1 · Verbindliche Buchungsanfrage mit Preisgarantie.** Der Kunde sendet zum angezeigten Festpreis („Zahlungspflichtig buchen“). Preis und angegebener Umfang werden beim Absenden eingefroren (Snapshot mit Preisversion). Der Vertrag entsteht erst, wenn ein Partner in der App annimmt. Vertragspartner des Kunden ist der Partner, MoveNow vermittelt. Die Plattform verteilt die Anfrage an passende Partner (Kategorie, Gebiet, Termin), die erste Annahme gewinnt. Es gibt eine Annahmefrist; danach „abgelaufen“, der Kunde wird informiert und kann neu senden. Bei Spannen oder `needsQuote` schickt der Partner ein Festangebot in der App, der Kunde bestätigt in der App, danach gilt dieselbe Preisgarantie.
- **E2 · Preisänderungen erzeugen immer eine neue Preisversion.** Bestehende Anfragen und Buchungen behalten ihre Version. Das wird in der Datenbank erzwungen (Trigger, Constraints, RLS), nicht nur in der Oberfläche. Der Preis ändert sich für einen Kunden nach Ansicht oder Buchung nie, außer durch E3.
- **E3 · Mehraufwand (Nachtrag).** Der Partner kann einen Nachtrag mit Fotobeleg vorschlagen. Der Betrag entsteht ausschließlich über das Preismodul aus korrigierten Eingaben (kein freier Betrag). Nur bei Zustimmung des Kunden in der App entsteht eine neue Preisversion. Bei Ablehnung gilt der gebuchte Umfang zum alten Preis; ist das unmöglich, Storno.
- **E4 · Abrechnung.** Der Partner stellt dem Kunden den Gesamtpreis in Rechnung, der Kunde zahlt direkt an den Partner. MoveNow führt die Provision (`splitFee`) in einem Journal. **[Entschieden (Beks, 01.11.2026)] Phase 1:** Provisions-Journal mit CSV-Export; die Rechnung an den Partner stellt Beks außerhalb der App, der Partner zahlt per Überweisung auf Rechnung. Die automatische Sammelrechnung mit SEPA-Lastschrift und Zahlungsdienstleister ist **[Phase 2]**, ebenso Stripe Connect. Das Datenmodell sieht Stripe Connect vor, setzt es nicht um (5.8).
- **E5 · Gebühr.** Kunden sehen die Gebühr nirgends, nur den Gesamtpreis. Partner sehen ihre Provision und Auszahlung (P2B-Transparenz).

### 1.2 Daraus folgende Anforderungen

Jede Anforderung hat eine Nummer (R#), auf die Abschnitte 4–9 und 13 verweisen.

| R# | Anforderung | Folgt aus |
|---|---|---|
| R1 | Der Server bindet den Kunden nur an einen Preis, den der Kunde gesehen hat: Der Aufruf trägt den angezeigten Betrag und die Preisversion, bei Abweichung 409 `price_changed` ohne Speichern [B1]. **Auslegung von E2 [Entschieden (Beks, 01.11.2026)]: „nie stillschweigend“.** Eine Abweichung bindet den Kunden nie, sie zeigt den neuen Preis und braucht eine erneute ausdrückliche Bestätigung. | E1, E2 |
| R2 | „Anfrage bearbeiten“ nach dem Absenden entfällt [Entschieden (Beks, 01.11.2026)]: zurückziehen und neu senden [B2] | E1, E2 |
| R3 | Tarifversionen und Preisrevisionen je Auftrag sind unveränderlich, per Trigger auch gegen admin über die API. **Grenze:** Wer im Dashboard als Datenbank-Eigentümer SQL ausführt (so wird admin gesetzt), kann Trigger abschalten und auch `content_hash` neu schreiben. Der Inhalts-Hash (`content_hash`, 5.1) erkennt deshalb **versehentliche** Änderungen, keine absichtlichen eines Eigentümers; gegen Letztere hilft der Hash in jeder Revision und im Audit-Eintrag der Preisbestätigung, weil eine spätere Abweichung dann nachweisbar bleibt, und die Differenzregel im Nachtrag (5.6) [B3, B4, B11-Finding 11, R2-4] | E2 |
| R4 | Jede Preisänderung eines Auftrags ist eine Revision mit Quelle (`submit`, `partner_offer`, `change_order`); ein Nachtrag rechnet mit der gebuchten Version, nie mit der aktuellen; auch die automatische Neuverteilung nach Partner-Storno läuft mit der eingefrorenen Revision [B5] | E2, E3 |
| R5 | Statusübergänge nur über serverseitige Funktionen (Muster in 4.5); kein UPDATE-Grant auf `service_requests` für `authenticated` (auch nicht admin); ein Trigger lässt nur definierte Paare zu und gilt ohne Rollen-Ausnahme [B19] | E1 |
| R6 | „Erste Annahme gewinnt“ ist ein einziges Compare-and-Set; Annahme prüft Frist, Status und Revision selbst [B20, B21] | E1 |
| R7 | Partner lesen nie Zeilen aus `service_requests`, `request_photos`, `profiles`, `storage.objects`; sie lesen nur eine vom Server geschriebene Projektion (`job_listings`) und Kontaktdaten nur über eine RPC nach Annahme [B11, B12] | E1, Datenschutz |
| R8 | Ein Partner ist erst „aktiv“, wenn admin ihn geprüft und freigegeben hat; die Zuständigkeit prüft `private.my_partner_id()`, nicht die Rolle [B13, B36, B39] | E1 |
| R9 | Fotos für Partner nur als serverseitig geprüfte, neu kodierte Kopien ohne Metadaten, signierte URLs mit kurzer Laufzeit [B14] | CLAUDE.md, OPEN_ISSUES |
| R10 | Die Provision entsteht bei der Annahme (nicht beim Absenden), mit dem dann gültigen Satz und der USt.-Regel des Partners; der Partner sieht vor der Annahme „Du erhältst X“; die Schreibung von `fee_splits` in `quote` entfällt mit S9a [B26] | E4, E5 |
| R11 | Provisionen werden in einem unveränderlichen Journal geführt (Buchung, Nachtrag, Storno, Korrektur), `ON DELETE RESTRICT`; Kundenkonten mit bestätigten Aufträgen werden anonymisiert, nicht kaskadiert gelöscht [B27, B35] | E4 |
| R12 | Gebührensätze haben ein Gültigkeitsdatum; Änderungen brauchen 30 Tage Vorlauf (`fee_notice_days`), die Datenbank erzwingt es [Entschieden (Beks, 01.11.2026)] [B29] | E5, P2B |
| R13 | **[Phase 2]** Kontodaten liegen nicht in der App-Datenbank; Mandat und Einzug über einen Zahlungsdienstleister [B32] | E4 |
| R14 | Mails über eine Outbox mit Dedupe-Schlüssel, nie innerhalb der Transaktion, nie mit Gebühr an Kunden, nie mit Adresse an Partner; es gibt nur Mail und die Liste in der App, keine Push-Nachrichten [Entschieden (Beks, 01.11.2026)] [B24, B41] | E1, E5 |
| R15 | Zustimmungen und Zugriffe sind belegbar (Audit-Log, nur anfügen) [B42] | E1, E3 |
| R16 | Das Datenmodell trägt Felder für Stripe Connect, ohne es zu nutzen | E4 |
| R17 | Verbindliche Beträge werden centgenau mit `formatEuro` angezeigt, nie gerundet; Festpreis heißt `kind = price` mit `low == high` [B7] | E1 |
| R18 | Alle Geld- und Zeitwerte (Fristen, Stufen, Grenzen, Pauschalen) stehen als einstellbare Schlüssel in `platform_settings` (5.10), nicht im Code. Was ein Kunde bei Vertragsschluss gesehen hat (Stornostufen, Pauschale), steht im Snapshot der Revision und gilt für diesen Auftrag unverändert [Entschieden (Beks, 01.11.2026)]; rein technische Laufzeiten wie die 10 Minuten der signierten URL (7.3) sind keine Geschäftswerte | E2 |
| R19 | Partner-Zugriffe verlangen `aal2` (MFA per TOTP, Pflicht für Partner, nicht für Kunden): Die Helfer `my_partner_id()` und `my_job_partner_id()` liefern ohne `aal2` NULL, die Edge Functions prüfen `aal` selbst (4.5) [Entschieden (Beks, 01.11.2026)] | E1, Datenschutz |

### 1.3 Regeländerungen und Freigaben [Angewendet (Beks, 01.11.2026)] [B25]

Das Konzept widersprach dem damaligen Projektstand an diesen Stellen. **Angewendet (Beks, 01.11.2026):** Beks hat die Änderungen freigegeben; sie stehen in `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` und `docs/OPEN_ISSUES.md`. Die Spalte „Heutige Regel“ nennt den Stand vor der Anwendung. Schritte heißen S9a ff. [Entschieden (Beks, 01.11.2026)].

| Stelle | Heutige Regel | Vorgeschlagene Änderung |
|---|---|---|
| `CLAUDE.md` Kopf | „unverbindliche Anfrage“, „Partner bestätigt Termin und Preis (in dieser Phase außerhalb der App)“ | verbindliche Buchungsanfrage, Annahme in der App |
| `CLAUDE.md` Daten und Sicherheit | „Kunden setzen nur die Status ‚angefragt‘ und ‚zurückgezogen‘. Alle anderen Status setzt nur admin.“ | Annahme, Angebot, Nachtrag und Storno laufen über Funktionen mit Akteur je Übergang |
| `CLAUDE.md` Geld | Gebührenaufteilung in `fee_splits`, entsteht beim Absenden | Journal `commission_entries`, entsteht bei der Annahme |
| `docs/ARCHITECTURE.md:28` (Statusfluss), `:34`, `:25`, `:117` | Statusfluss, `payee_id` null bis Partnerzuordnung, `partners` mit Login je Firma, Vermieter sehen keine Mietanfragen | Abschnitte 4, 5, 6 (Vermieter-Teil erst in Phase 2) |
| `docs/ROADMAP.md:7` | „In dieser Phase keine echten Zahlungen, keine echten Buchungsbestätigungen“ | Phase 1 enthält echte Buchungsbestätigungen (Annahme in der App); echte Zahlungen über MoveNow bleiben ausgeschlossen (der Kunde zahlt den Partner direkt, der Partner MoveNow per Überweisung außerhalb der App) |
| `docs/ROADMAP.md:8` (Reihenfolge) | „S9 nach S8b; S10 zuletzt“ | „S9a bis S9i nach S8b, S10 zuletzt“ |
| `docs/ROADMAP.md:103` (S8b) | „Anfrage bearbeiten“ und „Anfrage zurückziehen“ mit direktem Status-Update | „Anfrage bearbeiten“ streichen; „zurückziehen“ läuft über die Funktion `withdraw` (S9a) |
| `docs/ROADMAP.md:105-109` (S9 Transportermiete und Vermieterbereich) | S9 = Miete und Vermieterbereich (mit `fee_splits`, `become_rental_provider`) | S9 nach „Später“ verschieben (Phase 2: Miete als Partner-Kategorie, Abschnitt 5.3); an seine Stelle treten S9a bis S9i aus Abschnitt 13; S10 bleibt zuletzt |
| `docs/ROADMAP.md:120-126` („Später“) | Partner-Portal, Admin-Oberfläche mit E-Mail-Benachrichtigungen, Vermieter bestätigt Mietanfragen, Zahlung und Rechnung über Stripe Connect | Partner-Portal und E-Mail-Benachrichtigungen werden Phase 1 (S9a ff.); Admin-Oberfläche, Miete, automatische Sammelrechnung, SEPA, Zahlungsdienstleister, Push, pgAudit, Radius-Gebiete und Mehrfach-Mitglieder in der Oberfläche bleiben „Später“ (Phase 2) |
| Einwilligungstext der Zusammenfassung (`docs/OPEN_ISSUES.md:89`) | „Ich sende eine unverbindliche Anfrage …“ | rechtlich geprüfter Text und Button-Beschriftung (Abschnitt 11); Beks klärt das vor dem Bau des Buchungsbuttons |
| `docs/OPEN_ISSUES.md:6` | Vermieter ändern freigegebene Angebote ohne erneute Prüfung | bleibt bis Phase 2 offen (5.3) |

### 1.4 Phase 1 und Phase 2 [Entschieden (Beks, 01.11.2026)]

**Phase 1 (MVP):** Partner-Registrierung mit Prüfung durch admin, Verteilung, Annahme mit Frist, Festpreis-Buchung, Festangebot bei Spannen, Storno (Kunde und Partner), Nachtrag, Kontakt nach Annahme, Provisions-Journal (`commission_entries`) mit CSV-Export. Zahlung der Provision per Überweisung auf Rechnung, die Beks außerhalb der App stellt.

**Phase 2 (nicht in Phase 1; die Abschnitte tragen [Phase 2], das Datenmodell darf es vorsehen):** Transportermiete und Vermieter inklusive Freigaben, Kilometer und Schäden; automatische Sammelrechnung, SEPA, Zahlungsdienstleister, `payment_hold`-Automatik; Push; pgAudit; Radius-Gebiete; Mehrfach-Mitglieder in der Oberfläche. Die Besichtigung ist gestrichen (F6); bei Bedarf käme sie in Phase 2 neu.

Alle Geld- und Zeitwerte sind einstellbare Schlüssel in `platform_settings` (5.10, R18).

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

### 2.7 Wo der Ist-Stand E1–E5 und den Entscheidungen widerspricht (Umbaubedarf)

| Nr. | Widerspruch | Beleg | Lösung im Konzept |
|---|---|---|---|
| U1 | `quote` speichert den Serverpreis auch bei Abweichung vom angezeigten [B1] | H:188-195, 241-260 | R1, 409 `price_changed` |
| U2 | Bearbeiten nach dem Absenden rechnet neu [B2] | M10:72-79 | R2 |
| U3 | Tarifversionen nur per Konvention unveränderlich, admin kann ändern/löschen, halb befüllte Version wird sofort aktuell [B3] | M01:271-287, M04:9-14, `docs/ARCHITECTURE.md:121` | R3, `published` |
| U4 | Vermieter ändern ihr Angebot in der Zeile; `rental_bookings.price_version` ist die Kundentarif-Version [B4] | M01:173,183,360-379, Q:50 | **[Phase 2]** `rental_offer_versions` (5.3) |
| U5 | Kunden- und admin-UPDATE auf `status` ohne Übergangsregeln [B19] | M01:303,308-316,383,388-396 | R5; `rental_bookings` siehe 4.6 |
| U6 | `fee_splits`: eine Zeile je Anfrage, Upsert, Kaskadenlöschung, `payee` null bei Kontolöschung [B27] | M01:196-212, M10:97-100, `docs/OPEN_ISSUES.md:7` | Journal R11 |
| U7 | Gebühr entsteht beim Absenden ohne Empfänger [B26] | H:259 | R10 |
| U8 | Gebührensatz ohne Gültigkeitsdatum [B29] | M10:21-24 | R12 |
| U9 | `become_rental_provider` macht sofort zum Vermieter; ein Kunde könnte sich so Zugriff auf den Gebührensatz verschaffen [B13, B36] | M01:60-69, M01:290-299 | R8; die Funktion entfällt seit S9a-4c (Migration 0022) |
| U10 | Ein Login je Firma (`partners.id = profiles.id`) [B15] | `docs/ARCHITECTURE.md:25` | `partner_members` |
| U11 | Bucket prüft nur den Header; kein Partner-Bereich [B14] | `docs/OPEN_ISSUES.md:103` | Abschnitt 7 |
| U12 | Konto löschen kaskadiert auf bestätigte Aufträge (Kaskade M01:107, 174); der Fremdschlüssel M01:173 ohne Kaskade blockiert dagegen das Löschen eines Vermieters mit Buchungen (`docs/OPEN_ISSUES.md:7`) [B35, B38] | M01:107, 174; M01:146, 173 | R11, S9h |
| U13 | Status `inspection_requested` und Check `inspection_needs_quote`: die Besichtigung ist gestrichen | M01:20-22, 127-128; H:246 | Enum neu in S9a, Entrümpelung läuft über `awaiting_offer` |
| U14 | Foto-Uploads laufen nach dem Absenden, Kunde darf bei offenem Status hinzufügen und löschen [F23] | `docs/ARCHITECTURE.md:103`, M11:21-34, M03:27-39, M02:24-35 | 7.1: Fotos vor dem Absenden |

---

## 3. Rollen

| Rolle | Wer | Was sie darf (Kurzfassung) | Quelle |
|---|---|---|---|
| **anon** | nicht angemeldet | Tarife, freigegebene Mietangebote lesen; `route` aufrufen (Rate-Limits) | M01:270-287, 365-366; `docs/ARCHITECTURE.md:84` |
| **Kunde** (`customer`) | angemeldeter Nutzer (MFA nicht nötig) | eigene Anfragen/Fotos lesen; über `quote` buchen; zurückziehen, stornieren, Angebote und Nachträge entscheiden (neu, über Funktionen) | M01:302-316 |
| **Partner** (neu) | Firma mit Mitgliedern, `partner_members` | im Status `active` und mit `aal2` (`my_partner_id()`): Listings lesen, annehmen, anbieten; für bereits zugeordnete Aufträge auch in `payment_hold` (`my_job_partner_id()`): abwickeln, Nachtrag vorschlagen, stornieren; eigenes Journal lesen (auch in `payment_hold`). Vermieter als Partner der Kategorie `rental`: **[Phase 2]**; `rental_provider` bleibt bis dahin eine Rolle ohne Oberfläche und ohne Selbst-Hochstufung | R8, R19 |
| **Partner-Mitglied** | Person der Firma | Datenmodell: Rolle `owner` oder `staff`, `unique (user_id)`. Phase 1 legt nur `owner` an (Oberfläche nur für den Inhaber); Rechte von `staff` und Mehrfach-Mitglieder in der Oberfläche sind **[Phase 2]** | [B15], [Entschieden (Beks, 01.11.2026)] |
| **admin** | nur über `admin_grant_role` durch den Datenbank-Eigentümer gesetzt | Partner prüfen und freigeben/sperren, Korrekturbuchungen, Streitentscheidung; **darf keine Preise, Revisionen, Journal-Zeilen verändern** (Trigger) | M01:264, [B3, B19] |
| **service_role** | Edge Functions, pg_cron | umgeht RLS; schreibt Revisionen, Listings, Journal; alle vertrauenswürdige Geschäftslogik läuft hier | `docs/ARCHITECTURE.md:38` |

Neue Datenbankrolle gibt es nicht: alle App-Rollen sind `authenticated`, deshalb gelten Spalten-Grants für alle gleich (U-Befund [B11]); Unterschiede entstehen nur über Policies und RPCs.

**Admin in Phase 1 (ohne Admin-Oberfläche) [Entschieden (Beks, 01.11.2026), Frage 26]:** Admin-Aktionen laufen **nur** über die unten genannten Admin-Funktionen (RPC) oder benannte Skripte; **nie** direktes INSERT, UPDATE oder DELETE auf Tabellen, auch nicht in der SQL-Konsole. Zwei Wege [R4-3]: **(1) SQL-Konsole** nur für Funktionen **ohne Gebührenrechnung und ohne Storage**: `admin_approve_partner`, `admin_set_partner_status` (schließt beim Wechsel nach `payment_hold`/`suspended` in derselben Transaktion die offenen Listings und setzt `sent`-Angebote auf `withdrawn` und wendet dabei in derselben Transaktion T4b bzw. T7 an, mit Outbox-Zeile an die betroffenen Kunden, 10.4 [R9-9]), `admin_create_price_version`, `admin_set_price_config` (nur solange `published = false`), `publish_version`, `admin_set_setting(p_actor, key, value, effective_from)` (auch zum Löschen künftiger `fee_*`-Zeilen), `export_commissions` und `admin_grant_role` (nur für den Datenbank-Eigentümer, Tabelle oben, Zeile admin) [R8-6, R8-18, R9-13]; alle Statuskorrekturen (T14) laufen über `admin-correct`. Diese `admin_*`-Funktionen sowie `publish_version(p_actor, version)` und `export_commissions(p_actor, monat)` darf nur `service_role` oder der Datenbank-Eigentümer ausführen (`revoke` für `public`, `anon`, `authenticated`) [R10-2]. Beks ruft sie in der SQL-Konsole des Supabase-Dashboards auf, mit `p_actor` = der `user_id` seines admin-Kontos; die Funktion prüft, dass `p_actor` in `profiles` die Rolle `admin` hat, und schreibt `p_actor` in den Audit-Log. Ausnahme `admin_grant_role`: Sie prüft `p_actor` nicht (sonst entstünde nie der erste admin), ist nur für den Eigentümer ausführbar und schreibt den Audit-Eintrag mit Akteur „Eigentümer“ [R10-11]. Kategorien, Bezirke und `vat_rule` eines Partners setzt admin über Parameter von `admin_approve_partner` [R10-1]. Das ergibt dieselbe Vertrauensgrenze wie bei Art A (4.5): `p_actor` kommt nicht vom Client. Ergebnislisten (z. B. der CSV-Export) lädt Beks aus der Konsole herunter. **(2) Edge Functions nach Art A** für alles, was `splitFee` oder Storage braucht, weil SQL beides nicht kann (9.1): `admin-correct` (T14, neue Gebührenzeile für Stornogebühr oder Pauschale), `admin-photo` (signierte URL), `admin-contact`. Sie nehmen das JWT von admin (`aal2`) und werden in Phase 1 über ein lokales Aufruf-Skript ohne Oberfläche gestartet. Eine Admin-Oberfläche ist **[Phase 2]**.

---

## 4. Statusmaschine

### 4.1 Zustände des Auftrags (`service_requests.status`, Entwurf)

Das Enum (M01:20-22) wird in S9a neu angelegt (Dev-Daten werden verworfen, keine Kompatibilitätsschicht): `inspection_requested` und `confirmed` entfallen, `confirmed` heißt künftig `accepted` (Annahme = Vertragsschluss). [Entwurf]

| Status | Bedeutung | Vertrag? |
|---|---|---|
| `requested` | angefragt: Preis und Umfang eingefroren, Frist läuft, an Partner verteilt (Festpreis) | nein |
| `awaiting_offer` | angefragt, Spanne oder `needsQuote`: wartet auf Festangebot eines Partners (ohne Spanne: freier Betrag, 5.5, Frage 28) | nein |
| `offered` | mindestens ein Festangebot liegt vor, Kunde entscheidet | nein |
| `accepted` | angenommen (Festpreis: durch Partner; Angebot: durch Kunden-Bestätigung) | **ja** |
| `in_progress` | Auftragstag begonnen | ja |
| `completed` | durchgeführt (Kunde bestätigt, Partner meldet oder 7 Tage nach dem Termin ohne Meldung des Kunden, T10/T15) | ja |
| `withdrawn` | Kunde zieht vor Vertragsschluss zurück | nein |
| `expired` | Annahmefrist oder Angebotsfrist ohne Entscheidung abgelaufen | nein |
| `declined` | Kunde lehnt alle vorliegenden Angebote ab | nein |
| `unmatched` | alle passenden Partner haben abgelehnt oder es gibt keinen | nein |
| `cancelled_by_customer` | Storno nach Vertragsschluss durch Kunden | ja |
| `cancelled_by_partner` | Storno nach Vertragsschluss durch Partner | ja |

`completed` ist in Phase 1 der Endzustand eines durchgeführten Auftrags. Der Status `settled` („auf einer bezahlten Provisionsrechnung abgerechnet“) gehört zur automatischen Sammelrechnung und ist **[Phase 2]**.

„Zurückgezogen“ (vor Vertragsschluss) und „storniert“ (nach Vertragsschluss) werden für die Provision getrennt geführt [B34]. Ob die Bindung des Kundenangebots schon vor der Annahme besteht und ein Rückzug vor Annahme kostenlos bleibt, ist offen **[Frage Recht 3]**; die Statusmaschine setzt es bis zur Klärung als Annahme der Planung voraus.

### 4.2 Nachtrag (`price_revisions.status` mit `source = change_order`)

`proposed` → `accepted` (neue Revision `change_order` gilt, `price_version` bleibt die gebuchte) | `declined` | `expired` (nach `change_valid_hours`, 5.10) | `withdrawn` (Partner zieht zurück). Der Auftragsstatus bleibt `accepted`/`in_progress`; es gibt höchstens einen offenen Nachtrag je Auftrag. [Entwurf]

### 4.3 Festangebot (`partner_offers.status`)

`sent` → `confirmed` (Kunde) | `rejected` (Kunde) | `superseded` (Kunde bestätigt ein anderes Angebot, atomar) | `expired` (`valid_until`) | `withdrawn` (Partner; System, wenn `confirm_offer` einen nicht `active` Partner findet, T5; admin über `admin_set_partner_status`, Abschnitt 3, 10.4). Nach dem Senden unveränderlich (Trigger). `valid_until` = der frühere Zeitpunkt aus „Senden + `offer_valid_hours` (48 h)“ und „Termin“ [Entschieden (Beks, 01.11.2026)]. [Entwurf, B8, B23]

### 4.4 Übergänge: Akteur und Erzwingung

Alle Übergänge laufen über eine Funktion nach dem Muster in 4.5; der BEFORE-UPDATE-Trigger lässt nur die Paare der Spalte „von → nach“ zu, **ohne Ausnahme für Rolle, auch für admin, `service_role` und `postgres`** [B19]. Spalten für Preis, Umfang und Revision sind außerhalb dieser Funktionen gesperrt (kein UPDATE-Grant für `authenticated`). „RPC“ in der Tabelle heißt: Funktion nach 4.5, nicht notwendig eine SQL-RPC. Ein AFTER-UPDATE-Trigger schreibt `status_events` (Akteur aus einer transaktionslokalen Einstellung, die die Funktionen setzen; leer heißt „direktes SQL“). Der BEFORE-UPDATE-Trigger verlangt zusätzlich einen transaktionslokalen Marker der Übergangsfunktionen, damit ein freies UPDATE in der SQL-Konsole kein gültiges Paar durchwinkt, ohne `status_events`, Journal und Export zu erzeugen [R4-13]. **Grenze:** Der Datenbank-Eigentümer kann den Marker setzen oder Trigger abschalten, wie bei den Preisen (R3). Ein BEFORE-INSERT-Trigger lässt nur `requested` und `awaiting_offer` zu (T1, T16) [R4-20f].

| # | Von → nach | Akteur | Erzwingung (Funktion/Mittel) |
|---|---|---|---|
| T1 | – → `requested` / `awaiting_offer` | Kunde | Edge Function `quote` (Revision 1 mit `source = submit`, Haltefenster R1; übernimmt die Fotos aus dem Staging-Pfad, 7.1; berechnet `termin_at` (5.4) und setzt `accept_deadline` aus `now()` der Datenbank, 10.1; schreibt die Stornostufen in den Snapshot, nachdem der Aufruf mit `termsHash` bestätigt hat, dass der Kunde dieselben Werte sah (409 `terms_changed`, 5.4); nimmt `kind = offer` ohne Spanne als `awaiting_offer` an (Festangebot mit freiem Betrag, Frage 28); nur ein Auslandsziel ist in Phase 1 nicht buchbar (422 `offer_not_bookable`, nichts gespeichert); prüft jede Adresse mit Preis- oder Verteilungswirkung durch serverseitige Geokodierung, mit Pflichtpunkt und hausnummerngenauem Kandidaten (422 `address_point_required`, `address_mismatch`, `address_imprecise`, 5.5; gespeichert wird das kanonische Label) und verlangt einen Wiener Bezirk der Abholadresse (422 `district_required`, 5.5); lehnt Termine näher als `accept_min_hours` ab, 422 `too_late`) |
| T2 | `requested`/`awaiting_offer`/`offered` → `withdrawn` | Kunde | RPC `withdraw` (Compare-and-Set auf Status); kostenlos nur, solange Frage Recht 3 nichts anderes ergibt |
| T3 | `requested` → `accepted` | Partner | Funktion `accept` (Compare-and-Set: Status, Revision, Frist, aktiver zuständiger Partner mit `aal2`, gezeigte Auszahlung; die gültige Revision hat `total_cents is not null`, sonst Abbruch fail closed [R9-11]; höchstens `partner_open_jobs_max` offene Aufträge, sonst 409 `partner_job_limit`) |
| T4 | `awaiting_offer` → `offered` | Partner | Funktion `send_offer` (legt Angebot an; Bedingungen siehe 5.7; nur vor `accept_deadline`) |
| T4b | `offered` → `awaiting_offer` | System | wenn kein Angebot mehr gültig ist (`valid_until`/`withdrawn`/abgelehnt) und `accept_deadline` noch nicht erreicht ist (Umsetzung S9e) [B23] |
| T5 | `offered` → `accepted` | Kunde (`p_actor` ist der Eigentümer der Anfrage; ein Partner bestätigt nie) | Funktion `confirm_offer` (Compare-and-Set; setzt andere Angebote `superseded`; prüft wie T3 das Limit des Partners, bei Überschreitung 409 `partner_job_limit`, der Kunde wählt dann ein anderes Angebot; prüft unter Sperre der Partnerzeile, dass der anbietende Partner `active` ist [R7-1]: sonst ist das Angebot ungültig: Die SQL-Funktion wirft nicht, sondern committet das Angebot als `withdrawn` (Akteur `system`, Grund `partner_not_active`) und die Outbox-Zeile für den Kunden, wendet bei letztem gültigen Angebot T4b bzw. T7 an und liefert den Ergebniscode, den die Edge Function auf 409 `partner_not_active` abbildet; der Kunde wählt ein anderes Angebot) [R8-5] |
| T6 | `offered` → `declined` | Kunde | RPC `reject_offers` |
| T7 | `requested`/`awaiting_offer` → `expired`; `offered` → `expired` | System | pg_cron-Job: `requested`/`awaiting_offer` mit `accept_deadline < now()`; `offered`, wenn `accept_deadline < now()` und kein Angebot mehr gültig ist (sonst bleibt der Status, bis das letzte `valid_until` abläuft, dann gilt T4b bzw. diese Regel; der `offered`-Zweig entsteht mit S9e); die Annahme prüft die Frist trotzdem selbst |
| T8 | `requested`/`awaiting_offer` → `unmatched` | System | wenn kein offenes Listing mehr besteht (alle Empfänger abgelehnt, `decline_listing`, oder `closed` durch `admin_set_partner_status`) oder niemand passt; `admin_set_partner_status` wendet T8 mit Outbox an den Kunden an, wenn danach kein offenes Listing bleibt [R10-9] |
| T9 | `accepted` → `in_progress` | Partner | RPC `start` (frühestens am Termin) |
| T10 | `accepted`/`in_progress` → `completed` | Kunde (Bestätigung „durchgeführt“, auch aus `accepted`, frühestens ab `termin_at`), Partner (Meldung, nur aus `in_progress`) | RPC `complete`; der Kunde wird nach dem Termin gefragt (8.5b) [R4-18] |
| T12 | `accepted`/`in_progress` → `cancelled_by_customer` | Kunde | Funktion `cancel_by_customer` (Stornostufen aus der Revision, Abschnitt 10.2; Gebühr 0, wenn `cancel_fee_waived`, T16) |
| T13 | `accepted`/`in_progress` → `cancelled_by_partner` | Partner | Funktion `cancel_by_partner` (Pflicht-Grund; Gegenbuchungen aller Journal-Zeilen, Provision 0; Qualitätszähler 10.2; löst in derselben Transaktion T16 aus; Grund `scope_impossible` nach 10.3: dann bucht T13 statt der Nullsumme sofort die Zeile `cancellation_fee` auf die Pauschale aus dem Snapshot) |
| T14 | `accepted`/`in_progress`/`completed` → `cancelled_by_partner`, `cancelled_by_customer` oder `completed` (z. B. wenn die Prüfung nach „hat nicht stattgefunden“ das Gegenteil ergibt; aus `completed` nur in einen Storno-Status, mit Gegenbuchung aller Zeilen). Zusätzlich Journal-Korrektur an `cancelled_*` ohne Statuswechsel: Entscheidet admin im Streit um die Pauschale (10.3) für den Kunden, negiert `admin-correct` die Zeile `cancellation_fee` als `correction` [R5-3]; T14 in `cancelled_by_partner` setzt `assignments.ended_reason` wie T13, damit der Qualitätszähler den Storno zählt [R6-8] | admin | Edge Function `admin-correct` (Art A; Phase 1 per Skript mit admin-JWT und `aal2`, Abschnitt 3), weil sie eine Gebührenzeile rechnen kann (`cancellation_fee`, Pauschale); mit Begründung und Audit-Log; nie freies UPDATE [R2-14, R4-3] |
| T15 | `accepted`/`in_progress` → `completed` | System | Termin + `completion_days` (7) ohne Storno und ohne Meldung „hat nicht stattgefunden“ des Kunden (`not_done_reported_at`); meldet der Kunde das, prüft admin (T14, Audit-Log). Ohne T15 würde ein Partner, der nie startet oder meldet, nie Provision zahlen [Finding 3, Entschieden (Beks, 01.11.2026)] |
| T16 | `cancelled_by_partner` → neue Anfrage (`requested`) | System, in derselben Transaktion wie T13 (Art A) | **Automatische Neuverteilung zum gleichen Preis** [Entschieden (Beks, 01.11.2026)], nur wenn (1) der Termin mindestens `reissue_min_hours` (24 h) entfernt ist, (2) die gültige Revision nicht die Quelle `partner_offer` hat (kein Festangebot, [F12b]; ein angenommener Nachtrag bleibt zulässig, die kopierte Revision trägt dann die Quelle `change_order`) [R4-9] und (3) der Grund nicht `scope_impossible` ist. Sie legt eine neue Anfrage mit denselben eingefrorenen Eingaben an; die Revision wird als **neue Zeile mit `copied_from_revision_id`** kopiert (Betrag, Hash, Preisversion, Stornostufen und `termin_at` identisch, nicht neu gerechnet); die `job_photos` und `request_contacts` werden als Zeilen kopiert (dieselben Dateien); der stornierende Partner ist von den Listings ausgeschlossen; `accept_deadline` nach 10.1; die Verteilung läuft sofort. Spalte `reissued_from` mit Unique-Index: höchstens eine Folgeanfrage je Quelle. Die Folgeanfrage trägt `cancel_fee_waived = true`: Der Kunde wird per Mail informiert und darf sie kostenlos zurückziehen (T2) oder, nach neuer Annahme, kostenlos stornieren (T12). Ist eine Bedingung nicht erfüllt (Termin näher als 24 h, Festangebot, Miete **[Phase 2]**), entsteht nichts automatisch: Der Kunde sendet eine neue Anfrage über `quote` zum dann gültigen Preis (T1 mit R1). `cancelled_by_partner` bleibt Endzustand, „zurück zu `awaiting_offer`“ ist kein Paar. Dass eine automatische Folgeanfrage den Kunden ohne neue Erklärung bindet, ist **[Frage Recht 3/6]** [Finding 2, Berater R2-3, R3-7] |
| N1 | – → Nachtrag `proposed` | Partner | Funktion `propose_change` (Art A: Eingaben → `parse*Input` → Preismodul mit gebuchter Version nach der Regel in 5.6, Fotobeleg Pflicht, nur erhöhend) |
| N2 | Nachtrag `proposed` → `accepted`/`declined` | Kunde | Funktion `decide_change` (Art A) |
| N3 | Nachtrag `proposed` → `expired`/`withdrawn` | System/Partner | Job bzw. RPC |

T11 (`completed` → `settled`) ist **[Phase 2]**. Das Zurückziehen (T2) und die Annahme (T3) ändern dieselbe Zeile; die Zeilensperre ordnet beide nacheinander, genau eine gewinnt [B20].

### 4.5 Erzwingung: Muster für die Funktionen [Finding 4, 10, R2-8, R2-11]

Preisrechnung, Eingabeprüfung und Gebühr sind TypeScript (`parse*Input`, Preismodul, `splitFee`); eine SQL-Funktion kann sie nicht aufrufen. Eine zweite Gebührenrechnung in SQL ist ausgeschlossen (`splitFee` bleibt die einzige Stelle, 9.1). Deshalb zwei Arten:

| Art | Übergänge | Aufbau |
|---|---|---|
| **A. Edge Function + SQL-Funktion** (wie `quote`/M10) | T1, T3, T4, T5, T6, T12, T13 (mit T16), T14 (`admin-correct`), N1, N2, `confirm_offer`, `admin-photo`, `admin-contact` | Die Edge Function prüft das JWT (Nutzer, `aal`), validiert Eingaben, rechnet in TS (Preismodul, `splitFee`), ruft dann **eine** SQL-Funktion auf, die nur `service_role` ausführen darf (`revoke` für alle anderen, fester `search_path`). Diese schreibt Compare-and-Set, Revision, Journal-Zeile, Outbox, `status_events` und Audit-Log **in einer Transaktion**. Vertrauensgrenze: `p_actor` ist **ausschließlich** die `user_id` aus dem geprüften JWT (bei den SQL-Funktionen `admin_*` in Phase 1 die im Dashboard genannte admin-`user_id`, die die Funktion gegen `profiles.role` prüft, Abschnitt 3; bei den admin-Edge-Functions die `user_id` aus dem JWT von admin). Die SQL-Funktion leitet `partner_id` daraus selbst ab und prüft Mitgliedschaft und Status **in derselben Transaktion unter Sperre der Partnerzeile**; eine `partner_id` aus dem Request-Body wird nie angenommen. Die Edge Function übergibt Satz und Satzversion. **Für neue `booking`-Zeilen (T3, T5)** vergleicht die SQL-Funktion sie mit `current_fee_rates` und bricht bei Abweichung mit 409 `fee_rate_changed` ab. **Für Nachtrag (N2), Stornogebühr (T12), Pauschale (T13) und Korrekturen (T14)** gilt der bei der Annahme eingefrorene Satz (9.3, 9.4): Die SQL-Funktion liest Satz und `vat_rule` unter Sperre aus der `booking`-Zeile und vergleicht sie mit den Werten der Edge Function, bei Abweichung 409 `fee_basis_changed`; nach einem Satzwechsel bleibt ein Nachtrag also möglich und bucht mit dem alten Satz. Die Statusprüfung der Partner folgt den beiden Prüfungen in 5.2 (Helfer-Varianten mit `p_actor` als Parameter, weil `auth.uid()` unter `service_role` NULL ist): annehmen nur `active`, abwickeln und `cancel_by_partner` auch in `payment_hold` [R3-1, R3-8]. `aal` prüft hier nur die Edge Function; das ist eine dokumentierte Grenze. Unter `service_role` ist `auth.uid()` NULL: Eigentum, Zuordnung und Status prüft die SQL-Funktion über `p_actor` selbst [R2-8]. Die Codes `fee_rate_changed` und `fee_basis_changed` gehen nie an Kunden (sie verrieten eine Gebühr): Bei Aufrufen des Kunden (T5, N2, T12) versucht die Edge Function es einmal erneut, sonst liefert sie den neutralen Code `retry`: bei T5 nach Neuladen von `current_fee_rates`, bei N2 und T12 nach Neuladen der `booking`-Zeile (dort gilt der eingefrorene Satz, nicht `current_fee_rates`). Kundenantworten enthalten nie `fee_*`-Codes [R8-17, R9-8] |
| **B. SQL-RPC für `authenticated`** | `withdraw` (T2), `decline_listing`, `start` (T9), `complete` (T10), `report_not_done`, `withdraw_offer` (Partner, 4.3), N3 (Nachtrag zurückziehen), reine Statuswechsel ohne Geld und ohne Preisrechnung | SECURITY DEFINER, fester `search_path`, eigene Akteurprüfung über `auth.uid()` und `my_partner_id()`, Execute nur für `authenticated`; Compare-and-Set auf den Status |
| **C. System** | T7, T4b, T8 (alle Listings abgelehnt/abgelaufen), T15, N3 (Ablauf), Verteilung nach den Foto-Endzuständen (7.1) | pg_cron oder Edge Function mit `service_role`; Fristprüfung der Annahme bleibt trotzdem im Übergang selbst |

Die Grenze „`aal` nur in der Edge Function“ gilt nur für Art A. Art-B-RPCs und RLS-Policies mit Partnerzugriff prüfen `aal2` über die Helfer `my_partner_id()`/`my_job_partner_id()` (5.2); `job_contact` prüft zusätzlich selbst `(select auth.jwt()->>'aal') = 'aal2'`; `my_job_partner` ist die Kunden-RPC und prüft nur „Kunde des Auftrags“ und dass die Zuordnung besteht oder mit `completed` endete (5.5), ohne `aal2` (F10, [R4-2]); die Edge Functions `job-photo` und `photo-publish` verlangen `aal2` [R3-4, R19]. Für alle gilt: Es gibt keinen UPDATE-Grant für `authenticated` auf `service_requests` (auch nicht für admin); der Paar-Trigger gilt ohne Rollen-Ausnahme, schützt also auch vor Fehlern in den Funktionen selbst.

### 4.6 Zustände der Miete [Phase 2]

Die Miete läuft in Phase 1 nicht über Verteilung und Annahme. `rental_bookings.status` und der Miete-Zweig von `quote` bleiben bis Phase 2 wie in M01:175 und M10:108-143, nur ohne `fee_splits` (S9a). Zustände und Annahme durch den Vermieter beschreibt Phase 2.

---

## 5. Datenmodell-Entwurf

Beschreibung, kein SQL. Alle Beträge Integer-Cent. Alle neuen Tabellen: RLS an, `revoke all` für anon/authenticated, gezielte Grants wie M01:253-257.

### 5.1 Preisversionen und Gebührensätze

- **`price_versions`** (besteht): neue Spalte `published` (bool, Standard false). Die View `current_price_version` filtert auf `published`. Ab `published = true` verbietet ein Trigger UPDATE und DELETE der Zeile und aller zugehörigen `price_config`-Zeilen sowie INSERT neuer `price_config`-Zeilen in die Version, auch für admin über die API [B3, R4-20d]. `published` setzt eine Funktion `publish_version(p_actor, version)` (nur admin nach der Prüfung aus Abschnitt 3, nicht für `authenticated` ausführbar, setzt zugleich `published_at` und `content_hash`); direktes UPDATE von `published` entfällt, UPDATE der Zeile ist nur bei `published = false` möglich. Beim Veröffentlichen wird ein Inhalts-Hash der Version gespeichert (`content_hash`): kanonisch an **einer** Stelle in SQL berechnet: `private.price_version_hash(v)` (Zeilen nach `key` sortiert, je Zeile `key`, `value::text` und `unit`, sha256 über `extensions.digest`). `publish_version` berechnet und setzt Hash und `published_at` unter Sperre der Version; `quote` und der Nachtrag rufen eine Prüffunktion nur für `service_role` auf und vergleichen den neu berechneten mit dem gespeicherten Hash. `authenticated` hat kein Grant auf `published`, `published_at`, `content_hash`. Test: Eigentümer-Lauf (`supabase db query --linked`, Trigger aussetzen) oder Unit-Test des Vergleichs; über die API lässt sich der Trigger nicht aussetzen [R3-3]. `quote` und der Nachtrag prüfen ihn vor dem Rechnen und brechen bei Abweichung ab; der Hash wird zusätzlich in jede Revision und in den Audit-Eintrag der Preisbestätigung geschrieben. Das benennt die Grenze ehrlich: Der Hash erkennt versehentliche Änderungen; wer als Datenbank-Eigentümer Trigger abschaltet, kann auch den Hash ändern, die Abweichung bleibt aber über die in Revisionen und Audit gespeicherten Hashes nachweisbar [Finding 11, R2-4].
- **`platform_settings`** (besteht): neue Spalte `effective_from` (Datum); `current_fee_rates` wählt je Schlüssel die Zeile mit dem größten `effective_from ≤ heute` (bei Gleichstand die höchste Version) [B29, R4-20h]. Ein Trigger erzwingt für `fee_rate`, `fee_vat_rate` und `fee_notice_days`: `effective_from ≥ current_date (Europe/Vienna) + fee_notice_days`, wobei die Datenbank den **zum Zeitpunkt des Eintrags geltenden** Wert von `fee_notice_days` liest (Vergleich mit dem Datum der Datenbank, nicht mit einer per API setzbaren Spalte). Der Vorlauf beträgt 30 Tage [Entschieden (Beks, 01.11.2026)]; weil `fee_notice_days` selbst so versioniert und unveränderlich ist, wirkt auch eine Verkürzung des Vorlaufs erst nach dem bisherigen Vorlauf. Ob P2B Art. 3 (15 Tage) damit erfüllt und die Information der Partner ausreicht, ist **[Frage Recht 4]**. Zeilen dieser Schlüssel sind ab Anlage unveränderlich, auch für admin (kein UPDATE); DELETE nur, solange `effective_from` in der Zukunft liegt. Ausnahme nur die erste Version (Seed). Sonst könnte admin den Wert der geltenden Zeile direkt ändern oder löschen, und der Satz gälte sofort [Finding 8, R2-5]. Die übrigen Schlüssel (5.10) brauchen keinen Vorlauf.
- **`partner_vat_rules`**: je Partner Regel für die USt. der Provision (`standard_20`, `reverse_charge`, `none`), `valid_from`; bei der Annahme wird die gültige Regel ins Journal kopiert [B30, B26]. Welche Regel für wen gilt, klärt die Steuerberatung (Frage 14, blockiert nur Phase 2); in Phase 1 setzt admin sie bei der Freigabe.

### 5.2 Partner

- **`partners`** (Firma): `id`, Firmenname, UID, Rechtsform, Status (`pending`, `active`, `suspended`, `payment_hold`, `rejected`), `payout_model` (`direct`, `connect`), `stripe_account_id` (null, nur für Phase 2), `verified_at`, `verified_by`, Kontaktname, Telefon und E-Mail der Firma (für `my_job_partner`). Status, Prüfdatum, `payout_model` und Satz setzt nur admin; der Partner ändert nur Stammdaten [B39, R16]. `payment_hold` und `suspended` setzt in Phase 1 admin von Hand (10.4); die Automatik ist **[Phase 2]**.
- **`partner_members`**: (`partner_id`, `user_id`, `role` = `owner`/`staff`), `unique (partner_id, user_id)` und zusätzlich `unique (user_id)`: ein Nutzer gehört höchstens einer Firma an (der Firmenstatus liegt in `partners`, ein Index über zwei Tabellen ist nicht möglich) [R3-13]. Phase 1: Registrierung und Oberfläche legen nur `owner` an; `staff` und weitere Mitglieder in der Oberfläche sind **[Phase 2]** [Entschieden (Beks, 01.11.2026)]. Die Registrierung läuft nur über eine SECURITY-DEFINER-Funktion, die eine **neue** Firma (`pending`) samt `owner` für `auth.uid()` anlegt und nie eine `partner_id` vom Client annimmt; Partner haben kein INSERT auf `partner_members` (6), sonst könnte sich ein Nutzer in eine fremde, aktive Firma eintragen [R6-4]. Ersetzt `partners.id = profiles.id` [B15].
- **`partner_categories`**: (`partner_id`, `service`) mit den Leistungen `transport`, `move`, `clearance`, `assembly`; `rental` kommt mit Phase 2.
- **`partner_regions`**: (`partner_id`, `district` 1–23): das Gebiet ist eine Liste Wiener Bezirke; maßgeblich ist der Bezirk der Abholadresse [Entschieden (Beks, 01.11.2026)]. Radius-Gebiete sind **[Phase 2]**.
- **`partner_documents`**: Unterlagen (Gewerbeschein, Firmenbuch, Ausweis, UID-Prüfung VIES-Protokoll); Dateien in eigenem privatem Bucket, nur admin, mit Löschfrist [B39].
- **Helfer** (zwei getrennte Prüfungen) [R2-12]: `private.my_partner_id()` („darf annehmen“): liefert die Firmen-ID nur, wenn Mitglied, Firmenstatus `active` **und** `aal2` [B13, B40, R19]. `private.my_job_partner_id()` („darf zugeordnete Aufträge abwickeln“): Mitglied und Firmenstatus `active` **oder** `payment_hold` sowie `aal2`, nur für bereits zugeordnete Aufträge, auch in `payment_hold` (10.4: laufende Aufträge werden abgewickelt): das `accepted`-Listing, `price_revisions`, `job-photo`, `photo-publish`, `job_contact`, `start`, `complete`, Nachtrag und `cancel_by_partner` (ein Partner, der nicht ausführen kann, storniert besser früh, dann greift T16 für den Kunden) [R6-2]. `suspended` und `pending` liefern in beiden Fällen NULL. Beide SECURITY DEFINER, fester `search_path`. Die Policies auf `partners` und `partner_members` (eigene Firma lesen, Stammdaten ändern) hängen an der Mitgliedschaft, nicht an diesen Helfern, damit Registrierung und MFA-Einrichtung mit `aal1` möglich sind.
- **`my_job_partner(job)`**: RPC mit fester Spaltenliste (Firmenname, Kontakt) für den Kunden des Auftrags nach der Annahme; der Kunde hat kein Leserecht auf `partners`.

### 5.3 Vermieter-Angebote und Miete [Phase 2]

Nicht Teil von Phase 1. Phase 1 lässt `rental_offers`, `rental_bookings` und den Miete-Zweig von `quote` wie sie sind, ohne Verteilung, Annahme, Journal und Oberfläche; nur die Schreibung von `fee_splits` entfällt (S9a), und `become_rental_provider` entfällt (erledigt in S9a-4c, Migration 0022). Für Phase 2 gilt als Entwurf: `rental_offer_versions` (nur Insert, alle Angebotsfelder, Version, Freigabe einmalig durch admin), `rental_offers` mit `partner_id` und `current_version_id`, `rental_bookings.offer_version_id` statt `price_version`, Selbstfreigabe durch Spalten-Grants verhindert [B4, B18, Finding 9, R2-11]; Vermieter sind Partner der Kategorie `rental`; Freigabe je Version (Frage 7), Kilometer, Schäden und Selbstbehalt (Frage 13) entscheidet Phase 2.

### 5.4 Revisionen (Preis-Snapshot je Auftrag)

- **`price_revisions`**: `request_id`, `n` (1, 2, …), `source` (`submit`, `partner_offer`, `change_order`), `inputs` (nur Ergebnis von `parse*Input`), `snapshot` (Kunden-Positionen und die dem Kunden gezeigten Stornostufen samt Pauschale, nie Gebühr), `price_version`, `total_cents`, `low_cents`, `high_cents` (Check je Art: Festpreis `total > 0` und `total = low = high`; Spanne `total` NULL und `0 < low < high` (`low = high` ohne `total` ist keine gültige Spanne); Angebot ohne Spanne alle drei NULL; `send_offer` liest die Spanne nur aus diesen Spalten, R1 vergleicht bei Spanne `low`/`high` und bei „ohne Spanne“ die Art samt Gründen, `shownTotalCents` ist dann NULL) [R8-4, R9-11], `status` (nur für Nachträge, siehe 4.2), `photos` (Verweise auf Beleg-Fotos), `decided_by`, `decided_at`, `created_at`. Nur Insert, Status nur über Funktionen, Preisfelder per Trigger unveränderlich [B5]. Für Mieten **[Phase 2]**: `booking_id`, `offer_version_id`.
- **Stornostufen im Snapshot [Entwurf, R18]:** Die Werte `cancel_free_hours`, `cancel_late_percent`, `cancel_full_percent`, `cancel_full_days_before` und `call_out_fee_cents` (5.10) werden beim Absenden (T1) in den Snapshot der Revision 1 geschrieben; die Revision der Bestätigung eines Festangebots (T5), Nachträge und kopierte Revisionen (T16) übernehmen sie unverändert aus der Revision 1, nie aus dem aktuellen Stand der Einstellungen [R4-4]. Damit T1 nur schreibt, was der Kunde sah, liefert `booking_terms()` die genannten fünf Werte einschließlich `call_out_fee_cents` und zusätzlich einen Hash dieser Werte (`termsHash`); `quote` trägt ihn, bei Abweichung antwortet es mit 409 `terms_changed` und speichert nichts, der Kunde bestätigt die neuen Werte. `cancel_by_customer` und die Pauschale rechnen mit den Werten der `current_revision`, nie mit dem aktuellen Stand der Einstellungen. Der Kunde sieht dieselben Werte vor dem Absenden über die RPC `booking_terms()` (feste Schlüsselliste ohne `fee_*`, Art B, Execute für `anon` und `authenticated`).
- **`service_requests.current_revision`** zeigt auf die gültige Revision; `price_snapshot`/`estimate_cents`/`inputs` der Anfrage werden durch die Revision ersetzt (kein Doppelbestand). `current_revision` ist per Trigger geschützt: **Erstes Setzen** (NULL → Revision `n = 1` derselben Anfrage) einmalig, in derselben Transaktion wie das Anlegen (T1, und bei T16 die kopierte Revision); danach nur auf eine Revision **derselben** Anfrage mit `n = alt + 1`, und zwar auf einen angenommenen `change_order` oder auf eine `partner_offer` beim Übergang `offered → accepted`; sonst Fehler. Der Fremdschlüssel `price_revisions` → Auftrag hat `ON DELETE CASCADE`: Aufträge mit Vertrag schützt das Journal (`ON DELETE RESTRICT` auf `commission_entries.request_id`, Zeile ab der Annahme), alle anderen dürfen mit dem Konto verschwinden; sonst scheiterte jede Kontolöschung schon ab S9a [R4-12]. `price_revisions` führt zusätzlich `copied_from_revision_id` (T16) und `content_hash` (Hash der Preisversion bei der Revision, 5.1); eine kopierte Revision trägt die Quelle des Originals [R3-5] (ein Fehler in einer Funktion würde sonst den Kundenpreis ohne E3 ändern) [R2-16]. Neue Spalten an der Anfrage: `accept_deadline`, `termin_at` (timestamptz, bei T1 aus Datum und Zeitfenster berechnet, danach unveränderlich, T16 kopiert es) und `district` (5.5) (S9a), `not_done_reported_at` (S9g), `reissued_from` und `cancel_fee_waived` (S9h); der annehmende Partner steht nur in `assignments` (kein Doppelbestand), Kontaktdaten in `request_contacts`.
- **Haltefenster:** Der Aufruf von `quote` trägt `shownTotalCents` und `priceVersion`; der Server rechnet mit genau dieser Version, wenn sie aktuell ist oder seit höchstens `price_hold_minutes` (30) ersetzt wurde [Entschieden (Beks, 01.11.2026)]; sonst 409 `price_changed` mit neuem Snapshot, nichts wird gespeichert [B1]. Der Ersetzungszeitpunkt einer Version (der Zeitpunkt, ab dem ihr Nachfolger gilt) ist der spätere Zeitpunkt aus Mitternacht Europe/Vienna an `effective_on` des Nachfolgers und dessen `published_at` [R4-20g]; dafür bekommt `price_versions` die Spalte `published_at` (gesetzt von `publish_version`). Die Neuverteilung T16 ist vom Haltefenster ausgenommen: Sie kopiert die Revision und rechnet nicht.

### 5.5 Verteilung und Annahme

- **`job_listings`**: je Anfrage und Empfänger-Partner eine Zeile, vom Server geschrieben. Empfänger sind aktive Partner mit passender Kategorie, dem Bezirk der Abholadresse in `partner_regions` und ohne Ausschluss (T16). Den Bezirk liefert die Wiener PLZ der Abholadresse (1010–1230 → Bezirk 1–23). Die App sendet heute keine PLZ: Entrümpelung und Montage senden nur den Freitext-Ort, Transport einen Punkt mit Label (`src/lib/quote.ts:28-37`). Deshalb gilt [Entschieden (Beks, 01.11.2026), Frage 29]: Die serverseitige Geokodierung liefert eine PLZ (Pelias `postalcode`, `supabase/functions/_shared/route/provider.ts:69`; `Candidate.postcode`, `facts.ts:7`; `route` reicht sie unverändert durch, `handler.ts:74-75`). `quote` nimmt heute ein optionales `postcode` des Clients an (`_shared/quote/parse.ts:19, 65-66`, Spalten `from_postcode`/`to_postcode`, `db.ts:105, 109`); die App sendet es nicht (`src/lib/quote.ts:33, 37`) und `quote` gibt es nicht zurück (`handler.ts:316`). Ein Client-Wert zählt nicht: `quote` geokodiert das Label **jeder** Adresse mit Preis- oder Verteilungswirkung serverseitig, also Abholung und Ziel bei Transport und Umzug und den Ort bei Entrümpelung und Montage. Jede dieser Adressen verlangt einen Punkt; fehlt er, antwortet `quote` mit 422 `address_point_required`, nichts wird gespeichert [R9-1]. Die Geokodierung läuft über `limitedGeocode` mit einem **eigenen globalen Kontingent für `quote`** (getrennt vom Zähler der öffentlichen Function `route`, damit eine erschöpfte anonyme Vorschau keine Buchungen stilllegt) und dem weiter geltenden Limit je Nutzer; die Werte werden mit dem ORS-Plan festgelegt (`docs/OPEN_ISSUES.md:19`) [R9-6]. Der Cache speichert nur den HMAC des Labels als Schlüssel und die Kandidaten, keine Klartext-Labels als Schlüssel, mit TTL und stündlicher Bereinigung wie `route_cache` (Migration 0009) [R9-5]. `quote` verlangt einen Kandidaten, dessen Koordinaten dem gesendeten Punkt innerhalb einer festen technischen Toleranz entsprechen **und** der hausnummerngenau ist (Ebene `address` bzw. `venue`; `Candidate` führt heute weder Ebene noch Straße oder Hausnummer, `facts.ts:7`, `provider.ts:30, 69`: S9a ergänzt `layer`, Straße und Hausnummer); sonst 422 `address_mismatch` bzw. 422 `address_imprecise` (Ort oder Straße ohne Hausnummer), nichts wird gespeichert [R8-1, R9-1]. Gespeichert und an den Partner weitergegeben wird das **kanonische Label des Kandidaten**, nie der Freitext des Clients; es entsteht in **einer** Funktion `canonicalLabel(candidate)` in `_shared/route` (Straße, Hausnummer, PLZ, Ort), die `route` und `quote` beide nutzen, und die App zeigt bei der Bestätigung der Adresse genau dieses Label [R9-1, R10-4]. Weil der Freitext wegfällt, gibt es ein optionales Feld „Stiege/Tür“ ohne Geokodierung, gespeichert in `request_contacts` und nie im Listing [R10-4]. Route, Region (Auslandsziel) und Bezirk entstehen nur aus den so geprüften Punkten, und zwar aus den **Koordinaten des passenden Kandidaten**; der Client-Punkt dient nur dem Abgleich [R10-5]; der Client-Punkt allein bindet den Preis nie. Fällt der Anbieter aus oder greift ein Limit (429/502), antwortet `quote` fail closed (503/429, nichts gespeichert, kein Rückfall, kein `route_missing`) [R8-8]. Die Region wird unabhängig vom Routing nur aus dem Österreich-Polygon am geprüften Punkt bestimmt (`country` am Kandidaten dient nur der Anzeige, `facts.ts:30`); ist sie nicht bestimmbar, folgt fail closed [R8-3, R9-5]. `route_missing` entsteht nur, wenn das Routing den geprüften Punkt als unerreichbar meldet (`no_route`); jeder Ausfall und jedes Limit von Geocoding oder Routing ergibt 503/429 [R9-4]. Es gibt **kein neues Pflichtfeld**; die PLZ des geprüften Kandidaten bestimmt den Bezirk. Liefert der Anbieter keine PLZ (`null`) oder eine PLZ außerhalb 1010–1230 bei einem Punkt in Wien (Sonder-PLZ), erscheint das Feld „Wiener PLZ“ (eigener Schlüssel im Body, nur dann ausgewertet) nur als Rückfall; der Body-Schlüssel `postcode` und die Spalten `from_postcode`/`to_postcode` entfallen in S9a [R10-6, R10-7]; der Wert wird nur angenommen, wenn der geprüfte Punkt per PostGIS in Wien liegt, die PLZ im Bereich 1010–1230 liegt **und zum Bezirk des Punkts passt** (Wiener Bezirksgrenzen als PostGIS-Geometrie, Import wie die Stadtgrenze, Quelle bestimmt S9a); sonst 422 `district_required` [R9-10]. Empfehlung des Beraters an Beks: den Bezirk nur aus dem Polygon bestimmen (S9a importiert die Grenzen ohnehin), dann entfallen Rückfallfeld und PLZ-Zuordnung; die Entscheidung 29 (Rückfallfeld) gilt bis zu Beks' Antwort unverändert. Entrümpelung und Montage nutzen dafür dieselbe Adresssuche mit Einwilligung und Bestätigung wie der Transport (Regel „Karten“ in `CLAUDE.md`); ein reiner Freitext-Ort genügt nicht mehr (Folge für S9a). `quote` prüft den Bereich 1010–1230 (der Punkt liegt immer vor, zusätzlich „Punkt in Wien“), speichert `district` an der Anfrage und antwortet sonst mit 422 `district_required` [R4-5]. Abholung außerhalb Wiens ist in Phase 1 nicht buchbar, die App zeigt eine klare Meldung vor dem Absenden (F11, R5-11); ein Ziel im Inland außerhalb Wiens ist erlaubt. Passt danach kein Partner, entsteht kein Listing und die Anfrage wird `unmatched`. Spalten (abschließend): `listing_id`, `partner_id`, `request_id` (nicht für Partner lesbar, nur intern), Bezirk der Abholung, bei Transport und Umzug zusätzlich die PLZ des Ziels (vierstellig, ohne Straße und Hausnummer, damit der Partner ein Festangebot mit Kenntnis der Strecke abgibt) [R9-4], `service`, `inputs` (nur Preisfelder), `volume_m3`, `preferred_date`, `time_window`, Foto-IDs (Kopien), `revision_id`, `total_cents` (Festpreis) bzw. `low_cents`/`high_cents` (Spanne; beides ohne Personenbezug), `accept_deadline`, `status` (`open`, `closed`, `declined`, `accepted`). Der Partner, der annimmt, behält sein Listing als `accepted` und liest es, solange sein Zugriff nach 7.2 besteht (Termin und Umfang des eigenen Auftrags); die Listings der anderen werden `closed` [R4-6]. Auszahlungsvorschau und Provision werden **beim Lesen berechnet**, und zwar nur durch eine Edge Function oder im Partner-Client mit demselben `splitFee`-Modul und dem lesbaren Satz (keine SQL-View: das wäre eine zweite Gebührenrechnung in SQL, 9.1); sie werden nicht gespeichert, damit sie bei einem Satzwechsel nicht veralten und jede Annahme nicht mit 409 endet [Finding 19, R2-10]. **Es gibt keine Spalten für Adresse, Punkte, Route, Freitext, Kunden-ID, `client_ref`.** [B11]
- **`assignments`**: (`request_id`, `partner_id`, `accepted_at`, `ended_at`, `ended_reason` = `completed`, `cancelled_by_customer`, `cancelled_by_partner`). Partieller Unique-Index auf `ended_at is null`: höchstens eine aktive Zuordnung je Anfrage [B20]. **„Zuordnung besteht“** (für `job_contact`, das Listing `accepted`, Fotos, 7.2) heißt: `ended_at` ist leer oder liegt höchstens `partner_access_days` zurück; `my_job_partner` liefert dem Kunden den Partner, solange die Zuordnung besteht oder mit `completed` endete [R5-4]. Die offenen Aufträge eines Partners (`partner_open_jobs_max`) und der Qualitätszähler (10.2) werden hieraus gezählt.
- **`partner_offers`** (Festangebote): `request_id`, `partner_id`, `total_cents` (ganze Cent > 0, sonst `offer_amount_invalid`; hat die Revision 1 eine Spanne, **innerhalb der Spanne** `low ≤ total ≤ high`, sonst Fehler `offer_out_of_range`; hat sie keine Spanne (`kind = offer`, `needsQuote`), ist der Betrag frei und gilt nur durch die ausdrückliche Bestätigung des Kunden [Entschieden (Beks, 01.11.2026), Frage 28]; `send_offer` prüft dazu ausdrücklich `low is null or high is null` statt eines Vergleichs mit NULL [R4-1, R5-6]), `inputs` (Umfang), `valid_until` (4.3), Status siehe 4.3, `note`. Höchstens `offers_open_max` (3) Angebote im Status `sent` je Anfrage (Fehler `offer_limit`) und höchstens eines je Partner und Anfrage (partieller Unique-Index, Fehler `offer_exists`), damit ein Partner nicht alle Plätze belegt. Gezählt wird unter `FOR UPDATE` der Anfragezeile, nur `sent` mit `valid_until > now()` (4 parallele Angebote ergeben 3) [R8-12]. `send_offer` setzt unter derselben Sperre zuerst abgelaufene `sent`-Angebote der Anfrage auf `expired` (Akteur `system`), damit der partielle Unique-Index ein neues Angebot desselben Partners nicht wegen eines mangels Cron-Lauf noch `sent` stehenden abgelaufenen blockiert [R9-12]. Eine technische Obergrenze des freien Betrags ist der Schlüssel `offer_max_cents` in `platform_settings` (5.10); der Wert ist offen, Beks nennt ihn; ist er nicht gesetzt, antwortet `send_offer` bei Angeboten ohne Spanne fail closed mit `setting_missing`, ein Betrag darüber ergibt `offer_amount_invalid` (der Check greift nur bei Angeboten ohne Spanne); die Bestätigung zeigt den Betrag deutlich [R8-13, R9-7]. Nach dem Senden unveränderlich. **Keine Spalten für Gebühr oder Auszahlung** [B8, Entschieden (Beks, 01.11.2026)].
- **`request_contacts`** (je Anfrage): Name, Telefon, E-Mail des Kunden, beim Absenden gespeichert. Beim Absenden zeigt die App dem Kunden einen Hinweis, dass der Partner den Kontakt nach Annahme bekommt; ob das als Rechtsgrundlage der Weitergabe reicht, ist **[Frage Recht 10]**. Lesen nur über die RPC `job_contact(job)` (SECURITY DEFINER, fester `search_path`, feste Spaltenliste): prüft, dass die Zuordnung besteht (5.5), den zugelassenen Partner (`my_job_partner_id()`) und `aal2`; der Zugriff endet `partner_access_days` (30) Tage nach `completed` bzw. nach dem Storno [Entschieden (Beks, 01.11.2026)]; jeder Zugriff wird protokolliert [B12].
- **`job_photos`**: Kopien der Kundenfotos und Beleg-Fotos (siehe Abschnitt 7).

### 5.6 Nachträge

Siehe `price_revisions` mit `source = change_order`. Zusätzlich: höchstens ein offener Nachtrag je Auftrag (partieller Unique-Index), Pflicht-Fotobeleg (mindestens 1 Foto aus der Pipeline), Rechnung mit der gebuchten `price_version` und nur den geänderten Feldern von `inputs`, erneut über `parse*Input` geprüft [B5].

**Festpreis in beide Richtungen [Entschieden (Beks, 01.11.2026)]:** Der Festpreis gilt für beide Seiten: weder Mehrforderung ohne Nachtrag noch Abzug bei geringerem Aufwand. Ein Nachtrag kann den Preis deshalb **nur erhöhen** (neuer Gesamtpreis > gebuchter Gesamtpreis, sonst Fehler `change_not_increasing`) und gilt **nur mit Zustimmung des Kunden**.

**Rechenregel des Nachtrags [Finding 1]:** Der vereinbarte Preis ist je nach Quelle der Revision unterschiedlich entstanden, deshalb gilt:

| Revision, auf die der Nachtrag aufsetzt | Neuer Gesamtpreis |
|---|---|
| `submit` oder `change_order` mit Festpreis (Preismodul); gilt auch für eine Kette von Nachträgen | **[Entschieden (Beks, 01.11.2026), Frage 30]** neuer Gesamtpreis = gebuchter Preis + Modul(neue Eingaben, **gebuchte** `price_version`) − Modul(alte Eingaben, **gebuchte** `price_version`), gerechnet mit dem aktuellen Code. Alte Eingaben sind die der gültigen Revision, neue die über `parse*Input` geprüften Eingaben des Nachtrags. Beide Aufrufe müssen `kind = price` mit `low == high` liefern, sonst Fehler `not_fixed_price`. Nur wenn die Differenz > 0 ist (F8), entsteht ein Nachtrag, sonst Fehler `change_not_increasing`. Mindestpreise und Rundung verfälschen die Differenz nicht, weil beide Aufrufe dieselbe Version und denselben Code nutzen (bleibt der Preis wegen eines Mindestpreises gleich, ist die Differenz 0 und es gibt keinen Nachtrag). Fehlt in der gebuchten Version ein Schlüssel, den der heutige Code braucht, antwortet die Funktion fail closed mit `tariff_incomplete` (nie ein Standardwert) [R8-19]. Der gebuchte Preis wird nie neu gerechnet; eine Formeländerung in `@pricing` verändert ihn nicht, es gibt weder eine Versionsverzweigung des Moduls noch Golden-Tests je Version noch eine Integritätsprüfung gegen den gebuchten Betrag. Der Kunde stimmt dem neuen Gesamtbetrag zu (`decide_change`). **Adressen und Route sind im Nachtrag nicht änderbar**; gerechnet wird mit der gespeicherten `route` |
| `partner_offer` (Festangebot, Spanne/`needsQuote`) | **Kein Nachtrag** [Entschieden (Beks, 01.11.2026), E3-konform]. Der vereinbarte Betrag ist der Partnerbetrag, nicht ein Modulpreis, und E3 erlaubt keinen freien Betrag. Es gilt der gebuchte Umfang zum gebuchten Preis; ist er unmöglich, Storno nach Abschnitt 10.3 |

Die Funktion `propose_change` lehnt eine Revision mit Quelle `partner_offer` mit `change_not_allowed` ab. 
### 5.7 Festpreis und Festangebot (Begriffe)

- **Festpreis** = `kind = price` und `low == high`. Entrümpelung hat eine Spanne (`clearance.ts:57-60`, [B7]), außer bei Gewerbe, starker Befüllung und Sonderfall: Dort liefert das Modul `kind = offer` ohne Spanne (`clearance.ts:32-47`); beides läuft über das Angebotsverfahren [R4-1]. Transport/Umzug: Der Festpreis umfasst die angegebenen Stunden (`billedHours`, `transport.ts:90-100`); Mehrstunden sind nur über einen Nachtrag möglich, der **vor** der Mehrleistung bestätigt wird [B6].
- **Festangebot** = vom Partner gesetzter Betrag **innerhalb der Spanne** (bei `kind = offer` ohne Spanne ein freier Betrag, Frage 28), nach dem Senden unveränderlich, mit `valid_until` (48 h, höchstens bis zum Termin), höchstens 3 offene je Anfrage, höchstens eines je Partner. Bestätigt der Kunde, entsteht eine Revision mit `source = partner_offer`; die Bestätigung nennt Angebots-ID und Betrag und wird im Audit-Log festgehalten.

### 5.8 Geld

- **`commission_entries`** (Journal, ersetzt `fee_splits`): `partner_id`, `request_id`, `revision_id`, `kind` (`booking`, `change`, `cancellation`, `cancellation_fee`, `correction`), `reverses_entry_id` (für Gegenbuchungen, eindeutig: höchstens eine Gegenbuchung je Zeile), `total_cents`, `fee_rate`, `fee_vat_rate`, `fee_cents`, `fee_net_cents`, `fee_vat_cents`, `payout_cents` (Beträge bei `change`/`cancellation`/`correction` dürfen negativ sein; Checks `fee_parts` und `payout_rest` gelten, `non_negative` und `total_cents >= 0` gelten **nicht**), `vat_rule`, `payment_flow` (`invoice_transfer` heute, `connect_fee` später), `created_at`. Nur anfügen; UPDATE und DELETE per Trigger verboten, ohne Ausnahme; `ON DELETE RESTRICT` auf Partner und Auftrag; Korrekturen nur als Gegenbuchung [B27]. Die Spalte `invoice_id` kommt mit der Sammelrechnung in Phase 2 (dann mit einmaligem Setzen als einziger Ausnahme).
- **CSV-Export [Entschieden (Beks, 01.11.2026)]:** Funktion `export_commissions(p_actor, monat)` (nur admin, Abschnitt 3): eine Zeile je Journal-Zeile mit Auftrags-ID, Partner, Art, Gesamtpreis, Satz, Provision netto/USt./brutto, Auszahlung, `vat_rule`, Auftragsstatus und Endzeitpunkt, **ohne Kundendaten**. Abrechnungsmonat einer Zeile ist der Monat (Europe/Vienna) von `max(Zeitpunkt des **ersten** Wechsels des Auftrags in einen Endstatus (`completed`, `cancelled_*`, aus `status_events`), `created_at` der Zeile)`; jede Zeile erscheint in genau einem Monat, spätere Wechsel (T14) verschieben nur ihre eigenen Gegenbuchungen; Aufträge ohne Endstatus erscheinen noch nicht [R5-2]. Partner sehen dieselben Zeilen für ihre Firma (RLS) und exportieren sie aus der Liste im Portal; den Abrechnungsmonat liefert eine Funktion für die eigene Firma mit `aal2` (S9g), weil Partner `status_events` nicht lesen. Die Rechnung selbst stellt Beks außerhalb der App.
- **Stripe-Connect-Vorbereitung (nicht umsetzen):** `partners.payout_model`, `partners.stripe_account_id`, `commission_entries.payment_flow`. Mehr braucht Phase 2 im Schema nicht [R16].
- **[Phase 2]** `commission_invoices` (laufende Nummer, Summen, Status, PDF, Aufbewahrung 7 Jahre nach BAO § 132 angenommen, mit der Steuerberatung zu bestätigen [B33]) und `partner_payment_mandates` (nur IDs des Zahlungsdienstleisters, keine IBAN in der App-Datenbank [B32, R13]; ob DAC7 die IBAN schon in Phase 1 verlangt, klärt Frage Recht 7).

### 5.9 Infrastruktur

- **`outbox`**: Benachrichtigungen per Mail, Eintrag in derselben Transaktion wie die Zustandsänderung, `dedupe_key` eindeutig, Versand durch eine Edge Function nach Commit; Status `pending`/`sent`/`failed` [B24]. Es gibt keine Push-Nachrichten und kein Realtime; Partner und Kunden sehen Neues beim Öffnen der Liste in der App [Entschieden (Beks, 01.11.2026)].
- **`audit_log`**: nur anfügen. Preisbestätigung (Nutzer, Zeit, Snapshot-Hash, Version des Bestätigungstexts), Entscheidung über Nachträge, Zugriff auf Kontaktdaten, Statusänderungen durch admin, Partner-Sperren [B42, R15].
- **`status_events`**: Historie je Auftrag (von, nach, Akteur-ID, Akteur-Rolle als eigene Spalte, die der Trigger schreibt, Zeit); füttert die Timeline in Screen 14 und den Abrechnungsmonat (5.8).
- **Löschverhalten [R5-10]:** `ON DELETE RESTRICT` nur bei `commission_entries`; `audit_log` und `status_events` ohne Fremdschlüssel auf den Auftrag; alle übrigen abhängigen Tabellen (`request_contacts`, `job_listings`, `assignments`, `partner_offers`, `job_photos`, `outbox`) `ON DELETE CASCADE`.

### 5.10 Einstellbare Werte (`platform_settings`) [Entschieden (Beks, 01.11.2026)]

Alle Werte sind Schlüssel in `platform_settings` (R18); im Code steht keiner fest. „Termin“ ist `termin_at`: Datum des Wunschtermins plus Beginn des gewählten Zeitfensters (Wiener Zeit), bei Anfragen ohne Zeitfenster 00:00 des Termintags. `quote` berechnet es einmal (T1) und speichert es unveränderlich an der Anfrage und im Snapshot, damit spätere Änderungen der Fensterzeiten keine Fristen bestehender Aufträge verschieben [R4-14]. Lesen und Schreiben nur admin; Edge Functions und SQL-Funktionen lesen als `service_role`; Partner lesen über eine eigene Policy nur `fee_rate` und `fee_vat_rate` (`private.my_member_partner_id() is not null` mit `aal2`: alle Mitglieder einer Partnerfirma unabhängig vom Status (nicht `my_partner_id()`: es liefert nur bei `active`), auch künftige Zeilen, damit der angekündigte Satz sichtbar ist; P2B-Transparenz) [Entschieden (Beks, 01.11.2026)]; `current_fee_rates` ist `security_invoker` (M10:21-27) und liefert ohne diese Policy nichts [R4-7]; Kunden sehen nur die Stornostufen über `booking_terms()` (5.4). Die Policy „lesen nur rental_provider/admin“ (M01:290-299) entfällt in S9b. Rein technische Laufzeiten (z. B. die 10 Minuten der signierten URL, 7.3) sind keine Geschäftswerte und stehen nicht hier.

| Schlüssel | Wert | Wirkung |
|---|---|---|
| `fee_rate`, `fee_vat_rate` | bestehen (Seed) | Gebührensatz und USt. der Gebühr, `effective_from` mit Vorlauf (5.1) |
| `fee_notice_days` | 30 | Vorlauf für Änderungen der drei Gebührenschlüssel (5.1) |
| `price_hold_minutes` | 30 | Haltefenster für den alten Preis (5.4) |
| `accept_max_hours` / `accept_min_hours` / `accept_lead_share_percent` | 24 / 2 / 50 | Annahmefrist (10.1) |
| `offer_valid_hours` | 48 | Gültigkeit eines Festangebots, höchstens bis zum Termin (4.3) |
| `offers_open_max` | 3 | offene Festangebote je Anfrage (5.5) |
| `change_valid_hours` | 2 | Gültigkeit eines Nachtrags (4.2) [Entschieden (Beks, 01.11.2026)] |
| `partner_access_days` | 30 | Zugriff des Partners auf Kontakt und Fotos nach `completed` bzw. Storno (5.5, 7.2) |
| `completion_days` | 7 | Antwortfrist des Kunden und automatische Fertigmeldung nach dem Termin (T15) |
| `reissue_min_hours` | 24 | Mindestabstand zum Termin für die automatische Neuverteilung (T16) |
| `cancel_free_hours` / `cancel_late_percent` | 48 / 50 | Storno des Kunden: kostenlos bis 48 h vor dem Termin, danach 50 % des Gesamtpreises (10.2) |
| `cancel_full_percent` / `cancel_full_days_before` | 100 / 0 | 100 % ab dem Termintag (0 Kalendertage vor dem Termin, Wiener Zeit) |
| `call_out_fee_cents` | 6900 (vorläufig) | feste Anfahrtspauschale (10.3), Provision fällt an (9.4) [Entschieden (Beks, 01.11.2026)] |
| `offer_max_cents` | 800000 (8.000,00 €) [Entschieden (Beks, 01.11.2026)] | Obergrenze des freien Betrags eines Festangebots ohne Spanne (5.5); `send_offer` lehnt höhere Beträge ab; fehlt der Schlüssel, antwortet es fail closed |
| `partner_open_jobs_max` | 5 | offene angenommene Aufträge (`accepted`, `in_progress`) je Partner |
| `partner_cancel_review_count` / `partner_cancel_review_days` | 3 / 30 | Prüfung ab 3 Partner-Stornos in 30 Tagen (10.2) |
| `photo_staging_hours` | 24 [Entschieden (Beks, 01.11.2026)] | Aufräumfrist für Fotos im Staging-Pfad ohne Anfrage (7.1) |
| `window_start_<fenster>` | `morning` 08:00, `midday` 11:00, `afternoon` 14:00, `flexible` 08:00, Wiener Ortszeit [Entschieden (Beks, 01.11.2026)] | Beginn des Zeitfensters der Entrümpelung und Montage; Grundlage von `termin_at`. `flexible` = Beginn des Termintags. Die App kennt vier Fenster: `morning` „Vormittag“, `midday` „Mittag“, `afternoon` „Nachmittag“, `flexible` „Flexibel“ (`src/lib/draft.ts:14-19`, Standard `flexible` `draft.ts:26`; Prüfliste `supabase/functions/_shared/quote/parse.ts:22`) |

Die Werte der Stornostufen und der Pauschale gelten für einen Auftrag so, wie sie im Snapshot der Revision stehen (5.4); alle anderen Werte gelten ab Änderung für neue Vorgänge. Die Stornowerte sind vorläufig bis zur Rechtsprüfung (Frage Recht 5).

---

## 6. RLS-Matrix

S/I/U/D = select/insert/update/delete. „RPC“ = nur über die benannte Funktion. „eigene“ = per `auth.uid()` bzw. Mitgliedschaft in der eigenen Firma. **Verweigert wird mit dem genauen Fehler 42501 (permission denied) bzw. 0 sichtbaren Zeilen bei SELECT** (RLS filtert). Partner = aktiver Partner mit `aal2` (`my_partner_id()` nicht null); „pending“ = Partner mit Status pending/suspended: sieht nur die eigene Firma. Die Spalte admin gilt für die Policies; in Phase 1 gibt es keine Admin-Oberfläche (Abschnitt 3). **admin = Rolle admin mit `aal2`:** S9a/S9b ersetzen jede Klausel `my_role() = 'admin'` durch den Helfer `private.is_admin()` (SECURITY DEFINER, fester `search_path`, Rolle admin und `auth.jwt()->>'aal' = 'aal2'`); mit `aal1` liest admin über die API nichts [R10-3].

| Tabelle | anon | Kunde | Partner (aktiv, aal2) | admin | service_role |
|---|---|---|---|---|---|
| `service_requests` | – | S eigene; kein I/U/D | **S 0 Zeilen**; kein I/U/D | S (Adresse und Freitext lesbar; ein SELECT lässt sich nicht protokollieren: dokumentierte Grenze, Frage 22 entschieden); kein U | alle |
| `profiles` | – | S eigene; U (`display_name`, `phone`) | **S nur eigene Zeile**; fremde Kunden-Profile 0 Zeilen | S | alle |
| `price_revisions` | – | S eigene Aufträge (ohne Gebühr, die es dort nicht gibt) | S nur Revisionen zugeordneter Aufträge (Angebot/Nachtrag), auch in `payment_hold` | S | I/U (Nachtragsstatus über die Funktionen) |
| `request_photos` + Bucket `request-photos` | – | Storage-Insert/Delete nur im Staging-Pfad `{uid}/{client_ref}/`, solange es zu `client_ref` keine Anfrage gibt (die 8er-Grenze prüft `quote`); `request_photos` kein I/U/D für `authenticated`, nur `quote` schreibt; nach dem Absenden nur Lesen (7.1) | **S 0, keine Storage-Policy** | Originalfotos nur über die protokollierende Edge Function `admin-photo` (Audit-Log), kein freies S | alle |
| `job_photos` + Bucket `job-photos` | – | kein direkter Zugriff; Beleg-Fotos eigener Nachträge nur über Edge Function `job-photo` | **kein direkter Zugriff**; URL über Edge Function `job-photo`, Beleg-Upload nur über `photo-publish` | – | alle |
| `job_listings` | – | – | S eigene Zeilen (offen und Frist nicht abgelaufen, oder `accepted` solange der Zugriff nach 7.2 besteht, auch in `payment_hold`) | S | I/U |
| `partner_offers` | – | S zu eigenen Aufträgen (ohne Auszahlung) | S/I über Funktion `send_offer` (eigene) | S | I/U |
| `assignments` | – | S eigene Aufträge | S eigene | S | I/U |
| `request_contacts` | – | S eigene | RPC `job_contact` (nur zugeordnet, zugelassen nach 5.2, `aal2`, bis 30 Tage nach Ende) | nur über die protokollierende Edge Function `admin-contact` (Audit-Log), kein freies S | alle |
| **`rental_bookings`**, `rental_offers` | S approved (nur Angebote) | `rental_bookings`: **S nur eigene** (`customer_id = auth.uid()`), kein I/U/D | **S 0 Zeilen**; keine Policy für Partner (Phase 1 unverändert, M01:382-396) | S | alle |
| `commission_entries` | – | **verweigert (S 0)** | S eigene Firma, auch in `payment_hold` (über Mitgliedschaft und `aal2`, unabhängig vom Firmenstatus); kein I/U/D [Entschieden (Beks, 01.11.2026)] | S mit `aal2`; kein U/D (Trigger) | I |
| `partners`, `partner_members`, `partner_regions`, `partner_categories` | – | – | S eigene Firma (mit `aal1` lesbar, Registrierung); U nur Stammdaten (Spalten-Grant ohne Status, `verified_*`, `payout_model`) | nur S; kein I/U/D für `authenticated`. Schreiben nur über `admin_approve_partner` und `admin_set_partner_status` (Abschnitt 3) [R10-1] | alle |
| `partner_vat_rules` | – | – | S eigene | nur S; Schreiben nur über `admin_approve_partner` (Abschnitt 3) | alle [R10-1] |
| `partner_documents` + Bucket | – | – | I eigene, S eigene Metadaten | S | alle |
| `price_versions`, `price_config` | S (`published`) | S (`published`) | S | nur S; kein I/U/D für `authenticated`. Schreiben nur über `admin_create_price_version`, `admin_set_price_config`, `publish_version` (Abschnitt 3); U/D ab `published` zusätzlich per Trigger verweigert [R9-2] | alle |
| `platform_settings` | – | – (Stornostufen nur über `booking_terms()`) | S nur `fee_rate`, `fee_vat_rate` (eigene Policy für alle Partner-Konten unabhängig vom Status, auch künftige Zeilen; `current_fee_rates` ist `security_invoker`) [Entschieden (Beks, 01.11.2026)] | nur S; kein I/U/D für `authenticated`. Schreiben, auch das Löschen künftiger `fee_*`-Zeilen, nur über `admin_set_setting` (Abschnitt 3); U auf `fee_*` per Trigger verweigert [R9-2] | alle |
| `status_events` | – | S eigene Aufträge über eine View mit `security_invoker` und dem Akteur als Rolle (die Spalte mit der Akteur-ID hat keinen Spalten-Grant für `authenticated`) [R4-20p] | – | S | alle |
| `outbox`, `audit_log` | – | – | – | S | alle [R5-1] |

**[Phase 2]:** `rental_offer_versions`, `commission_invoices` und `partner_payment_mandates` bekommen ihre Zeilen in der Matrix mit der jeweiligen Migration.

### 6.1 Geplante RLS-Tests (je erlaubt UND verweigert, erwarteter Fehler)

Jeder Test läuft mit zwei Kunden, zwei Partner-Firmen, einem pending-Partner, admin und anon (Tests sequenziell und gepaced, wie in CLAUDE.md).

| Test | Erlaubt | Verweigert | Erwarteter Fehler |
|---|---|---|---|
| **Auflage 6a:** `rental_bookings` nur eigene Zeilen | Kunde A liest A-Buchung | Kunde B liest A-Buchung (0 Zeilen); aktiver Partner liest direkt 0 Zeilen; anon 0 | 0 Zeilen bei SELECT; I/U/D als Kunde: 42501 |
| `service_requests` für Partner | – | Partner liest fremde und zugeordnete Anfrage direkt | 0 Zeilen |
| Spalten von `job_listings` | Partner liest eigene Listings | Schema-Test: keine Spalten für Adresse, Punkte, Route, Freitext, `customer_id` (erlaubt: Bezirk der Abholung, PLZ des Ziels) | Test rot, sobald eine Spalte dazukommt |
| Fremdes Listing | Partner A liest A-Listing | Partner B liest A-Listing (nicht zuständig, Bezirk fremd) | 0 Zeilen |
| Listing nach Frist/Annahme | offen vor Frist | nach Fristende; nach Annahme durch anderen Partner | 0 Zeilen |
| Pending/suspended Partner | – | `accept`, `send_offer`, `job_contact`, Listings | 42501 bzw. Funktionsfehler `partner_not_active` |
| MFA | Partner mit `aal2` liest Listings, ruft `job_contact` | Partner mit `aal1`: Listings (0 Zeilen), `job_contact`, `job-photo`, `photo-publish`. Kunde ohne MFA bucht und liest `my_job_partner` nach der Annahme (erlaubt); fremder Kunde und Aufruf vor der Annahme (verweigert) [R4-2] | 0 Zeilen bzw. Funktionsfehler `mfa_required` |
| Kontaktdaten | zugeordneter Partner `job_contact` bis `partner_access_days` nach Ende | nicht zugeordneter, abgelehnter; nach Storno/`completed` + 30 Tage | Funktionsfehler `not_assigned` (kein Datenleck in der Meldung) |
| Fotos | zugeordneter/zuständiger Partner erhält signierte URL der Kopie; Kunde erhält URL für Beleg-Fotos eigener Nachträge | anderer Partner; Original-Bucket; nach Annahme durch anderen; abgelaufenes Listing; fremder Kunde | 403 von der Function; Storage 0 Zeilen/403 |
| Fotos vor dem Absenden | Storage-Insert in den Staging-Pfad ohne Anfrage (bis 8); `quote` übernimmt sie | Insert und Delete nach dem Absenden; Insert in fremden Ordner; `request_photos`-Insert direkt; neunte Datei im Ordner (Storage lässt sie zu, `quote` lehnt ab) | 42501 bzw. 0 Zeilen; `quote`: 422 `too_many_photos` |
| Gebühr für Kunden | – | Kunde liest `commission_entries`, Gebühr in `price_revisions`, `partner_offers`-Auszahlung, `job_listings`, `platform_settings`, `outbox`, `audit_log` | 0 Zeilen bzw. Spalte existiert nicht |
| Journal unveränderlich | Service schreibt Gegenbuchung | UPDATE/DELETE als admin und als service_role | Trigger-Fehler `append_only` |
| Version unveränderlich | admin legt über `admin_create_price_version`/`admin_set_price_config` eine neue unveröffentlichte Version an | admin ändert/löscht veröffentlichte Version oder Zeilen, fügt Zeilen hinzu; admin-JWT (`aal1`) schreibt `price_versions`/`price_config`/`platform_settings` direkt über PostgREST | Trigger-Fehler `version_published`; 42501 [R9-2] |
| Statusübergänge | erlaubte Funktion je Akteur | direktes UPDATE `status` als Kunde, Partner, admin; Funktion durch falschen Akteur; unerlaubtes Paar | 42501 bzw. `invalid_transition` |
| Annahme-Konkurrenz | genau 1 von 10 parallelen Annahmen | die anderen 9; Annahme gegen Rücknahme: genau eine; Annahme nach Fristende (Cron noch nicht gelaufen) | 409 `already_taken`/`expired` |
| Partner-Limit | `accept` bis zum fünften offenen Auftrag | sechster offener Auftrag; `confirm_offer` bei vollem Limit des Partners | 409 `partner_job_limit` |
| Preisbindung | `quote` mit gleichem angezeigten Preis; Version höchstens 30 Minuten ersetzt | Versionswechsel vor mehr als 30 Minuten/andere Route zwischen Vorschau und Absenden | 409 `price_changed`, keine Zeile |
| Nachtrag | Partner schlägt über Preismodul vor (Preis höher), Kunde stimmt zu | freier Betrag; gleicher oder niedrigerer Preis; Nachtrag mit aktueller statt gebuchter Version; zwei offene Nachträge; Zustimmung eines Fremden | Funktionsfehler `change_not_increasing`, 42501 |
| Nachtrag bei Festangebot | – | `propose_change` auf Auftrag mit Revision `partner_offer` | Funktionsfehler `change_not_allowed` |
| Nachtrag nur Festpreis | Eingaben ergeben `kind = price` | Ergebnis ist Spanne/`needsQuote`; Änderung von Adresse oder Route | `not_fixed_price`; `route_locked` |
| Festangebot | Betrag innerhalb der Spanne, bis zu 3 offene, `valid_until` ≤ Termin; ohne Spanne (`low is null or high is null`) freier Betrag > 0 | Betrag außerhalb einer vorhandenen Spanne; Betrag ≤ 0; viertes offenes Angebot (4 parallele Angebote ergeben 3); zweites offenes Angebot desselben Partners; neues Angebot nach abgelaufenem, noch `sent` stehendem Angebot desselben Partners geht durch (wird zuerst `expired`); ohne Spanne und Betrag über `offer_max_cents`; ohne Spanne und ohne gesetztes `offer_max_cents`; Änderung nach dem Senden | `offer_out_of_range`; `offer_amount_invalid`; `setting_missing`; `offer_limit`; `offer_exists`; Trigger-Fehler `append_only` |
| Stornostufen aus Revision | Storno mit den Werten des Snapshots; `quote` mit passendem `termsHash` | Wert zwischen Anzeige und Absenden geändert; Wert zwischen Absenden und `confirm_offer` geändert (die Revision trägt die Werte der Revision 1); Änderung von `cancel_*` nach dem Absenden wirkt auf den bestehenden Auftrag | 409 `terms_changed`; Test: Gebühr entspricht dem Snapshot [R4-4] |
| Anfahrtspauschale | Pauschale nur bei `scope_impossible` mit Fotobeleg, Zeile bei T13; admin negiert sie im Streit ohne Statuswechsel | Pauschale ohne Beleg oder ohne `scope_impossible`; freier Betrag | Funktionsfehler `call_out_not_allowed` |
| Kontolöschung | anonymisieren bei bestätigten Aufträgen; Kunde mit zurückgezogener oder abgelaufener Anfrage lässt sich löschen | Kaskadenlöschung des Auftrags/Journals | FK-Fehler 23503 (RESTRICT) |
| Partner-Registrierung | Mitglied ändert Stammdaten | ändert `status`, `verified_*`, `payout_model`, Satz; legt eine Mitgliedschaft in fremder Firma an; legt zweite Mitgliedschaft desselben Nutzers an | 42501; 23505 auf `unique (user_id)` |
| `payment_hold` | `job_contact`, `start`, `complete`, Nachtrag für zugeordnete Aufträge; `accepted`-Listing, Revision und Journal lesen; `cancel_by_partner` | `accept`, `send_offer` für neue Aufträge; `confirm_offer` auf das Angebot eines Partners, der inzwischen nicht `active` ist (R7-1) | Funktionsfehler `partner_not_active`; nach 409 `partner_not_active`: Angebot `withdrawn` (Akteur `system`), Outbox-Zeile vorhanden, Status nach T4b bzw. T7 [R9-3]; `admin_set_partner_status` auf `payment_hold`/`suspended`: Listings `closed`, `sent`-Angebote `withdrawn` (Akteur admin), T4b bzw. T7 angewendet, Outbox-Zeile an den Kunden [R9-9] |
| Satzwechsel nach Annahme | Nachtrag und Stornogebühr mit eingefrorenem Satz | Nachtrag mit aktuellem Satz nach Satzwechsel | Funktionsfehler `fee_basis_changed` bei Abweichung der SQL-Funktion; Test: Journal-Zeile trägt alten Satz. Test der Edge Function: Kundenantworten (T5, N2, T12) enthalten nie `fee_*`-Codes, nur `retry` [R9-8] |
| `current_revision` | NULL → `n = 1` bei T1/T16; Wechsel auf `n = alt + 1` derselben Anfrage (angenommener `change_order` bzw. `offered → accepted`) | zweites Setzen auf `n = 1`; Zeiger auf fremde Revision, andere `n`, nicht angenommenen Nachtrag | Trigger-Fehler `invalid_revision_pointer` |
| Nachtrag-Rechenregel (5.6) | gebuchter Preis + Modul(neu) − Modul(alt), beide mit der gebuchten Version; Ergebnis unabhängig von später veröffentlichten Versionen | Differenz ≤ 0 (auch wenn ein Mindestpreis greift); Rechnung mit der aktuellen Version | Funktionsfehler `change_not_increasing` |
| Direktzugriff Partner | – | Partner liest `profiles` (fremde), `request_photos`, `storage.objects` im Original-Bucket, `service_requests` direkt | 0 Zeilen bzw. 42501 |
| Querzugriff zwischen Partnern | Partner A liest eigene Zeilen | Partner B liest `commission_entries`, `assignments`, `partner_offers`, `job_listings` von Partner A | 0 Zeilen |
| Fristen für Sätze | admin legt über `admin_set_setting` einen Satz mit 30 Tagen Vorlauf an | admin legt `fee_rate` oder `fee_notice_days` mit `effective_from` vor Ablauf des geltenden Vorlaufs an; admin ändert (UPDATE) oder löscht (DELETE) den geltenden Satz; admin-JWT schreibt `platform_settings` direkt (42501) | Trigger-Fehler `fee_rate_notice` bzw. `fee_rate_immutable` |
| Journal: Storno nach Nachtrag | Gegenbuchung je Zeile | Nachtrag angenommen, dann Partner-Storno: Summe `fee_cents` des Auftrags ≠ 0; doppelte Gegenbuchung derselben Zeile | Test rot; Unique-Fehler 23505 auf `reverses_entry_id` |
| Neuverteilung (T16) | genau eine Folgeanfrage je Quelle bei Termin ≥ 24 h, Quelle `submit` oder `change_order`; kopierte Revision, Preisversion, Kontakt und Fotos; stornierender Partner ohne Listing | zweite Folgeanfrage (Doppelklick); bei `partner_offer`, `scope_impossible` oder Termin < 24 h; zum aktuellen Preis | Unique-Fehler 23505; keine Folgeanfrage; Funktionsfehler `price_not_frozen` |
| Vertrauensgrenze Art A | Funktion leitet `partner_id` aus `user_id` im JWT ab | `partner_id` aus dem Body; Partner in `payment_hold` nimmt an; veralteter Satz | Funktionsfehler `partner_not_active`; 409 `fee_rate_changed` |
| Hash der Tarifversion | `quote` mit unveränderter Version | Inhaltsänderung oder neue Zeile in einer veröffentlichten Version außerhalb der Trigger (Eigentümer-Lauf oder Unit-Test des Vergleichs, 5.1; über die API lässt sich der Trigger nicht aussetzen) | Abbruch `version_hash_mismatch` |
| Admin-Support | `admin-contact`/`admin-photo` mit Audit-Eintrag | freies SELECT auf `request_contacts`/Original-Bucket als admin | 0 Zeilen bzw. 42501 |
| Auftrag ohne Meldung | Auftrag wird nach Termin + 7 Tage `completed` (T15); Journal-Zeile exportierbar | Auftrag mit Meldung „hat nicht stattgefunden“ wird automatisch `completed` | Systemübergang T15; Test: bleibt offen bis admin entscheidet |
| Qualitätszähler | admin sieht Partner ab 3 Stornos in 30 Tagen | Partner oder Kunde liest `partner_quality` | 0 Zeilen bzw. 42501 |
| Einstellungen | `booking_terms()` liefert nur die Stornowerte; jedes Partner-Konto (auch nicht aktiv) liest `fee_rate`, `fee_vat_rate` (auch künftige Zeilen) | `booking_terms()` liefert `fee_*`; Kunde liest `platform_settings`; Partner liest andere Schlüssel | Test rot; 0 Zeilen [R4-7] |
| Adressprüfung | Label und Punkt jeder Adresse stimmen überein, Kandidat hausnummerngenau; gespeichertes Label = Kandidatenlabel (mit PLZ und Ort) | Label Linz mit Punkt in Wien; Label „Wien“ mit Punkt am Mittelpunkt; kein Punkt bei Transport/Umzug; Entrümpelung/Montage ohne Punkt; Anbieter fällt aus oder Limit (auch Quote-Kontingent erschöpft, `route`-Zähler dagegen unberührt) | 422 `address_mismatch`; 422 `address_imprecise`; 422 `address_point_required` (beide Fälle ohne Punkt); 503/429 fail closed, keine Zeile [R8-1, R8-3, R8-8, R9-1, R9-6] |
| Bezirk | `quote` leitet den Bezirk serverseitig aus dem geprüften Punkt ab (Punkt in den Wiener Bezirksgrenzen, `geo_districts`; die PLZ und ein Client-`postcode` spielen keine Rolle, kein Rückfallfeld) und speichert `district` | Abholung außerhalb Wiens; Wiener Punkt ohne Bezirk im Polygon; manipulierte Koordinaten oder Client-`postcode` | 422 `pickup_outside_vienna` bzw. `district_required`; Test: Ziel im Inland außerhalb Wiens bleibt buchbar [R4-5] |
| `termin_at` | Berechnung bei T1; T16 kopiert den Wert | spätere Änderung von `window_start_*` verschiebt `termin_at` bestehender Anfragen; UPDATE von `termin_at` | Test: Fristen bleiben; Trigger-Fehler [R4-14] |
| Freies Status-UPDATE | Übergangsfunktion setzt den Marker, `status_events` entsteht | direktes UPDATE auf ein gültiges Paar ohne Marker (als `service_role` und als Eigentümer ohne Marker); INSERT mit anderem Status als `requested`/`awaiting_offer` | `invalid_transition` [R4-13] |
| Staging-Fotos | Datei im Staging-Ordner übersteht das Aufräumen bis `photo_staging_hours`; `quote` legt `request_photos` unter `service_role` an | Aufräumen vor Ablauf; Aufräumen eines Ordners, zu dem eine Anfrage existiert | Test: Datei vorhanden bzw. Zeilen angelegt [R4-8] |
| Abrechnungsmonat | `completed` im Monat M, T14 auf `cancelled_*` im Monat M+1: M enthält die `booking`-Zeile, M+1 nur die Gegenbuchungen; der Export von M bleibt unverändert | eine Zeile in zwei Monaten; doppelte Zeilen durch mehrere Endstatus-Ereignisse | Test rot [R5-2] |
| Zuordnung nach `completed` | Kunde liest `my_job_partner` nach `completed`; Partner liest sein `accepted`-Listing und `job_contact` am Tag 29 nach `completed` | Partner am Tag 31 nach `completed` | Funktionsfehler `not_assigned` [R5-4] |
| Anfrage ohne Spanne | `quote` mit `kind = offer` (Klavier, Tresor, Gewerbe, `route_missing` nur bei `no_route` mit bekannter Inlandsregion, Entwurf zur Bestätigung durch Beks [R9-4]) wird `awaiting_offer`; Kunde bestätigt eines der Angebote | `quote` mit Auslandsziel; Bestätigung durch den Partner; Bestätigung eines abgelaufenen Angebots | 422 `offer_not_bookable`, keine Zeile; 42501; `offer_expired` [R5-6] |
| Frühe Bestätigung | Kunde bestätigt „durchgeführt“ ab `termin_at` | Kunde bestätigt vor `termin_at` (danach könnten weder Partner noch Kunde stornieren) | `invalid_transition` [R5-14b] |
| MFA admin | admin-Edge-Functions mit `aal2` | `admin-correct`, `admin-photo`, `admin-contact` mit `aal1` | Funktionsfehler `mfa_required` [R5-14c] |
| admin über die API | admin-JWT (`aal2`) liest per Policy; Funktionen nur über Konsole/`service_role` | admin-JWT (`aal1`) ändert `partners.status` direkt; ruft `publish_version` bzw. `export_commissions` per RPC; liest `service_requests`/`profiles` | 42501; 42501; 0 Zeilen [R10-1, R10-2, R10-3] |
| `admin_set_partner_status` ohne Empfänger | Sperre des einzigen Empfängers: Anfrage wird `unmatched` mit Outbox | Anfrage bleibt bis zur Frist ohne offenes Listing | Test rot [R10-9] |

---

## 7. Partner-Zugriff auf Fotos (Auflage G)

**Ausgangslage:** Der Bucket `request-photos` prüft nur den Content-Type-Header (`docs/ARCHITECTURE.md:60`); ein Client ohne App kann Dateien mit GPS-Daten hochladen, GPS verrät die Hausnummer (`docs/OPEN_ISSUES.md:103`). Partner dürfen deshalb nie das Original sehen [B14].

### 7.1 Pipeline

1. **Fotos nur vor dem Absenden [Entschieden (Beks, 01.11.2026), Entwurf zur Umsetzung]:** Die App lädt die Fotos **vor** dem Absenden in einen Staging-Pfad `{uid}/{client_ref}/` des Buckets `request-photos` (nur JPEG, 10 MB je Datei, höchstens 8 Dateien je Ordner, maßgeblich geprüft von `quote` (422 `too_many_photos`; eine Zählung in der Storage-Policy ginge nur über eine SECURITY-DEFINER-Funktion wie in M03 und wäre nicht atomar, `docs/ARCHITECTURE.md:125`); die Storage-Policy lässt den Insert nur zu, solange zu diesem `client_ref` keine Anfrage des Kunden existiert). „Absenden“ bedeutet „Fotos fertig“: `quote` (T1) übernimmt in derselben Transaktion die Dateien des Ordners als `request_photos` der neuen Anfrage (der Server prüft Pfad, Anzahl und Existenz in `storage.objects`; über 8 Dateien: 422 `too_many_photos`). Ab dann gibt es für den Kunden kein Hinzufügen und Löschen mehr (Policies M11:21-34, M01:343-351, M03:27-39, M02:24-35 sowie `request_photos_select` (M01:322-329) und `request_photos_objects_select` (M01:411-415) entfallen und werden ersetzt, die beiden letzten ohne die admin-Klausel (7.2: kein freies SELECT); ebenso der BEFORE-INSERT-Trigger aus M11/M13, der `storage_path` aus `auth.uid()` und `request_id` setzt und unter `service_role` scheitert, `docs/OPEN_ISSUES.md:104`: Den Pfad setzt `quote` nach der Prüfung in `storage.objects`, das Limit von 8 prüft `quote`) [R4-8]. Es gibt keinen eigenen Schritt „Fotos fertig“ und keinen Timeout-Job. Wer ein Foto vergessen hat, zieht zurück und sendet neu (R2); Fotos, die später fehlen, ersetzt nur ein Nachtrag mit Beleg. Ein Upload setzt ein Konto voraus, das heute erst beim Absenden entsteht (`docs/ARCHITECTURE.md:84`): Die App hält die Fotos bis zur Anmeldung lokal im Entwurf (`docs/OPEN_ISSUES.md:88` wird angepasst; EXIF entfernt wie bisher der Client), lädt sie nach der Anmeldung in den Staging-Pfad und ruft erst dann `quote` auf [Entwurf, UI-Teil von S9a]. Staging-Dateien ohne Anfrage räumt `photo_cleanup` erst nach `photo_staging_hours` auf (die View `photo_orphans`, M11:43-51, listet Dateien ohne Zeile heute nach 1 h und nimmt Staging-Ordner ohne Anfrage bis dahin aus); ein Gesamtlimit je Nutzer gibt es nicht (Konten sind angemeldet, Risiko mit dem Kontingent zu messen).
2. **Pipeline nach dem Absenden:** Eine Edge Function `photo-publish` (service_role, vom Server nach dem Commit angestoßen) prüft je Foto die Bytes (Magic Number, Dekodierbarkeit, Pixel- und Dateigröße), kodiert neu als JPEG (lange Kante höchstens 1600 px), schreibt **ohne Metadaten** in den eigenen privaten Bucket `job-photos` und trägt `job_photos` ein (`request_id`, `source_photo_id`, Pfad, Prüfsumme, Status `ready`/`failed`; `failed` nach den Wiederholungen der Function). Die **Verteilung** (Listings, 5.5) erfolgt erst, wenn jedes Foto `ready` oder `failed` ist (Art C); die `accept_deadline` läuft seit dem Absenden (T1), die Verteilung verlängert sie nicht. Ein `failed`-Foto sieht der Partner nicht; der Kunde bekommt eine Mail und kann zurückziehen und neu senden.
3. Messen vor Umsetzung: CPU- und Speicherlimit der Edge Function beim Dekodieren von 10-MB-Bildern. Alternative: Supabase Image Transformations, vorher prüfen, ob sie die Metadaten entfernen und welchen Plan sie brauchen [B14].
4. **Beleg-Fotos des Partners (Nachtrag):** Der Partner hat keinen Storage-Zugriff. Er lädt die Fotos über `photo-publish` hoch (JWT, aktive Zuordnung, `aal2`); die Function prüft, kodiert neu und schreibt direkt nach `job-photos`. Der Kunde des Auftrags sieht sie über `job-photo`.

### 7.2 Wer sieht wann

| Zeitpunkt | Wer | Bedingung |
|---|---|---|
| Vor Annahme | nur Partner, denen die Anfrage angeboten wird | Listing `open`, Frist nicht abgelaufen, Partner `active` mit `aal2`, Kategorie und Bezirk passen, Partner ist nicht der Kunde (keine Selbstbuchung) |
| Nach Annahme | nur der zugeordnete Partner | Zuordnung besteht (5.5); endet `partner_access_days` (30) Tage nach `completed` bzw. nach dem Storno [Entschieden (Beks, 01.11.2026)] |
| Nie | andere Partner, anon. admin nur über die protokollierenden Edge Functions `admin-photo` und `admin-contact` (Art A, Audit-Log; `admin-photo` erzeugt die signierte URL, was SQL nicht kann); ein freies SELECT als admin wird entzogen, weil sich SELECT nicht per Trigger protokollieren lässt (pgAudit ist **[Phase 2]**). Ausnahme und dokumentierte Grenze: Adresse und Freitext in `service_requests` sowie Name und Telefon in `profiles` bleiben für admin lesbar [Entschieden (Beks, 01.11.2026): reicht für Phase 1]. Weitere dokumentierte Grenze: Der Storage-Browser des Dashboards zeigt die Originalfotos ohne Audit-Log, wie das SELECT auf `service_requests` [R4-3] | – |

### 7.3 Zugriffsweg

- Keine Storage-Policy für Partner, kein Direktzugriff auf `storage.objects`.
- Eine Edge Function `job-photo` prüft Berechtigung (siehe Tabelle, `aal2`) und erzeugt eine **signierte URL mit 10 Minuten Laufzeit** (wie heute `photoUrls`); Anzeige im Browser, kein Download-Knopf, kein dauerhafter Link. Dem Kunden liefert sie auch die Beleg-Fotos der Nachträge seiner Aufträge.
- Löscht der Kunde sein Konto oder zieht er zurück, räumt `photo-cleanup` beide Buckets auf. Nach dem Zugriffsende (30 Tage nach `completed` bzw. Storno) werden die Kopien gelöscht; eine Kopie, auf die noch ein anderes Listing derselben Neuverteilung (T16) zeigt, bleibt bis dahin bestehen.
- Der Kunde wird vor dem Absenden informiert, dass mehrere Partner seine Fotos sehen, bevor einer annimmt (Text mit Beks, rechtlich zu prüfen).

---

## 8. Abläufe als Schrittfolgen

Akteur in Klammern; „Funktion“ ist die serverseitige Erzwingung (4.4).

### 8.1 Festpreis-Buchung (Transport, Umzug, Montage mit Festpreis)

1. (Kunde) Konfigurator zeigt Festpreis aus der Vorschau (`@pricing`); Fotos werden in den Staging-Pfad geladen (7.1); die Zusammenfassung zeigt den Betrag **centgenau**, die Stornostufen und die Anfahrtspauschale (`booking_terms()` mit `termsHash`) und die Button-Beschriftung nach Rechtsprüfung (Abschnitt 11).
2. (Kunde) Absenden = „Fotos fertig“: `quote` mit `shownTotalCents`, `priceVersion`, `termsHash`, `clientRef`. Server prüft Eingaben (`parse*Input`), rechnet mit der genannten Version, vergleicht. Abweichung: 409 `price_changed`, neuer Preis wird gezeigt, der Kunde bestätigt erneut. [R1]
3. (Server) Speichert Anfrage und Revision 1 (`submit`, mit Stornostufen), schreibt Kontaktdaten, übernimmt die Fotos, setzt `accept_deadline` aus `now()` der Datenbank (10.1) und stößt `photo-publish` an. Sind alle Fotos `ready` oder `failed`, schreibt der Server `job_listings` für passende aktive Partner (Kategorie, Bezirk der Abholadresse, Termin) und Outbox-Einträge. **Keine Provisionszeile, keine `fee_splits`-Zeile.**
4. (Partner) Sieht das Listing mit Bezirk, Umfang, Fotos (Kopien), Preis und „Du erhältst X“.
5. (Partner) `accept` mit `shown_payout_cents` und Revision: Compare-and-Set auf Status `requested`, Revision, Frist, Limit offener Aufträge. Gewinnt er: `accepted`, `assignment`, Listings schließen, `commission_entries(booking)` mit Satz und USt.-Regel dieses Zeitpunkts, Outbox. Weicht die gezeigte Auszahlung von der aktuellen ab: 409. [R6, R10]
6. (Kunde) Bekommt Bestätigung mit Partner und Kontakt; (Partner) `job_contact` liefert Adresse und Kontakt.

### 8.2 Spanne → Angebot → Bestätigung

1. (Kunde) Sendet eine Anfrage mit Spanne (Entrümpelung); Status `awaiting_offer`, Revision 1 enthält die Spanne, keine Provisionszeile. Anfragen mit `needsQuote` ohne Spanne gehen ebenso als `awaiting_offer` ein (Frage 28); nur ein Auslandsziel ist nicht buchbar (T1).
2. (Server) Verteilt wie 8.1.
3. (Partner) `send_offer`: Betrag in ganzen Cent > 0, bei vorhandener Spanne **innerhalb der Spanne**, ohne Spanne frei; `valid_until` = der frühere Zeitpunkt aus 48 h und Termin; Angebot ist danach unveränderlich. Höchstens 3 offene Angebote je Anfrage, höchstens eines je Partner [B23].
4. (Kunde) Sieht alle offenen Angebote mit Betrag und Partner und bestätigt eines; `confirm_offer` für ein Angebot: Compare-and-Set auf Status `offered`, Angebot `sent`, `valid_until`, Status des anbietenden Partners `active` (R7-1, T5); setzt andere Angebote `superseded`; neue Revision (`partner_offer`, mit Stornostufen), Status `accepted`, Journal wie 8.1 Schritt 5 mit dem Angebotsbetrag; Eintrag im Audit-Log.
5. Lehnt der Kunde alle ab: `declined`. Läuft die Frist ab: `expired` (T7).

### 8.3 Fristablauf

1. (System) pg_cron wendet T7 an: setzt `expired`, schließt Listings, schreibt Outbox.
2. Die Annahme prüft die Frist selbst, auch wenn der Job noch nicht lief: 409 `expired`. [B21]
3. (Kunde) Wird per Mail informiert; Neu senden ist eine neue Anfrage mit dem dann gültigen Preis (neue Ansicht im Sinne von E2).

### 8.4 Ablehnung durch alle Partner

1. (Partner) `decline_listing` je Partner (Listing `declined`).
2. (System) Sind alle Empfänger-Listings `declined` oder abgelaufen: Anfrage `unmatched`; Kunde wird informiert, Outbox. Kein Partner gefunden (leere Empfängermenge beim Verteilen) führt ebenfalls zu `unmatched` mit Hinweis, den Umfang oder Termin anzupassen.

### 8.5 Storno durch Kunden

1. Vor Vertrag (`requested`, `awaiting_offer`, `offered`): `withdraw` → `withdrawn`, Listings schließen, nach dem Planungsstand keine Kosten und keine Provision **[Frage Recht 3: Bindung des Kundenangebots bis zur Annahme ungeklärt]**.
2. Nach Vertrag: `cancel_by_customer` → `cancelled_by_customer`; Stufen aus dem Snapshot (10.2): kostenlos bis 48 h vor dem Termin, danach 50 % des Gesamtpreises, am Termintag 100 %; bei `cancel_fee_waived` (Folgeanfrage nach Partner-Storno) kostenlos. Die Stornogebühr stellt der Partner dem Kunden in Rechnung; Provision nach 9.4. Der Zugriff des Partners auf Kontakt und Fotos endet 30 Tage nach dem Storno.

### 8.5b Nach dem Termin [Entschieden (Beks, 01.11.2026)]

1. (System) Nach dem Termin fragt die App den Kunden (Mail und Liste), ob der Auftrag stattgefunden hat. Antwortfrist `completion_days` (7).
2. (Kunde) „Ja“ → `complete`. „Nein“ → `report_not_done`: setzt `not_done_reported_at`; der Auftrag bleibt offen (oder wurde vom Partner schon als `completed` gemeldet) und admin prüft (T14, Audit-Log, bei `completed` mit Gegenbuchung).
3. (System) Ohne Antwort gilt der Auftrag 7 Tage nach dem Termin als durchgeführt (T15, `completed`).

### 8.6 Storno durch Partner

1. `cancel_by_partner` (nur nach Annahme) → `cancelled_by_partner`; Pflicht-Grund.
2. Provision 0 (Gegenbuchungen als exakte Negation aller Journal-Zeilen des Auftrags, auch angenommener Nachträge, 9.4); der Partner zahlt dem Kunden nichts; der Qualitätszähler steigt (10.2); der Kunde wird informiert. In derselben Transaktion läuft T16: Termin ≥ 24 h entfernt und Quelle nicht `partner_offer` → neue Anfrage zum **gleichen** Preis, automatisch verteilt, der stornierende Partner ausgeschlossen, der Kunde darf kostenlos zurückziehen oder stornieren; sonst sendet der Kunde neu über `quote` zum dann gültigen Preis [Finding 2, E2]. Gilt ebenso nach einer Korrektur durch admin (T14), soweit T14 auf `cancelled_by_partner` führt.
3. Gegen Missbrauch (Annehmen und Stornieren, um Adressen zu sammeln): höchstens 5 offene angenommene Aufträge je Partner; ab 3 Partner-Stornos in 30 Tagen prüft admin; eine Sperre setzt nur admin mit Begründung [B16, Entschieden (Beks, 01.11.2026)].

### 8.7 Nachtrag (Mehraufwand)

1. (Partner) `propose_change` vor der Mehrleistung: korrigierte Eingaben, Pflicht-Fotobeleg; die Edge Function (Art A, 4.5) prüft mit `parse*Input` und rechnet mit der **gebuchten** Preisversion über das Preismodul nach der Regel in 5.6 (gebuchter Preis + Modul(neu) − Modul(alt), beide mit gebuchter Version, nur Festpreis, nur bei Differenz > 0, nur erhöhend, keine Adress- oder Routenänderung); es gibt kein Betragsfeld. Bei Aufträgen aus einem Festangebot gibt es keinen Nachtrag. [R4]
2. (Kunde) Erhält eine Mail; sieht Differenz und neuen Gesamtpreis, Beleg-Fotos (durch dieselbe Pipeline). `decide_change`.
3. Zustimmung: neue Revision (`change_order`), neuer Gesamtpreis, `commission_entries(change)` (Abschnitt 9.3), Audit-Log.
4. Ablehnung oder Ablauf: gebuchter Umfang zum alten Preis; ist der Auftrag dann unmöglich, meldet der Partner `cancel_by_partner` mit Grund `scope_impossible` und Fotobeleg: Regel nach 10.3. Ohne Zustimmung darf der Partner die Mehrleistung nicht verlangen.

### 8.8 Miete [Phase 2]

Nicht Teil von Phase 1 (5.3). Als Entwurf für Phase 2: Der Kunde bucht ein freigegebenes Angebot (aktuelle Version) zum angezeigten Betrag, die Buchung geht direkt an den Vermieter des Angebots, der Vermieter nimmt an wie in 8.1; Kaution, Kraftstoff und Schäden sind nie Teil von Preis oder Provisionsbasis [B9]; Mehr-Kilometer, Schäden und Selbstbehalt regelt Phase 2 (Frage 13).

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
- Nach Vertrag, Storno durch den Kunden: Der Storno negiert **jede noch nicht gegengebuchte Zeile des Auftrags einzeln** (die `booking`-Zeile und alle `change`-Zeilen) als `cancellation` mit `reverses_entry_id`, jeweils als **exakte Negation**, nie über `splitFee`. Ein Unique-Index auf `reverses_entry_id` verhindert eine doppelte Gegenbuchung. Fällt eine Stornogebühr an (10.2: 50 % bzw. 100 % des Gesamtpreises der `current_revision`, kaufmännisch auf Cent gerundet wie `splitFee`), kommt eine neue Zeile der Art `cancellation_fee` auf diese Basis (`splitFee(Stornogebühr)` mit Satz und `vat_rule` der Buchungszeile). Provisionsbasis ist der Betrag, den der Partner dem Kunden berechnen darf [B31, Finding 7]. Test: „Nachtrag angenommen, dann Storno ⇒ Summe der `fee_cents` des Auftrags = 0 (bzw. = Provision der Stornogebühr)“. Den Betrag rechnet der Server aus den Stufen im Snapshot und dem Revisionsbetrag, es gibt keinen freien Betrag [R3-14].
- Storno durch den Partner: dieselben Gegenbuchungen aller Zeilen, Summe der Provision 0. Ausnahme `scope_impossible` mit fälliger Anfahrtspauschale nach 10.3: eine Zeile `cancellation_fee` auf die Pauschale (Provision fällt an wie bei der Stornogebühr [Entschieden (Beks, 01.11.2026), Frage 27]), Summe = Provision der Pauschale; die Zeile wird mit T13 gebucht, widerspricht der Kunde und entscheidet admin für ihn, negiert `admin-correct` sie als `correction` ohne Statuswechsel (4.4).
- Korrektur nach Abrechnung: nie Änderung einer Zeile, nur Gegenbuchung (`correction`) im Monat der Korrektur (5.8); wie sie steuerlich auf der Rechnung heißen darf, klärt die Steuerberatung (Frage 14).
- Gegen Umgehung („Storno melden, bar kassieren“): Nach dem Termin fragt die App den Kunden, ob der Auftrag stattgefunden hat (8.5b, nur bei nicht stornierten Aufträgen); Abweichungen lösen eine Prüfung aus. Ein Partner-Storno am Termintag fängt nur der Qualitätszähler ab (10.2) [R4-19].

### 9.5 Provisions-Export und Rechnung (Phase 1)

1. Beks ruft `export_commissions(p_actor, monat)` auf (5.8) und erhält die Zeilen des Abrechnungsmonats (Endstatus im Monat). Aufträge, die der Partner nie meldet, werden über T15 `completed` und damit exportierbar.
2. Beks stellt dem Partner die Rechnung über die Provision außerhalb der App; der Partner zahlt per Überweisung auf Rechnung. USt.-Rechenweg und Rechnungsform liegen bei Beks und der Steuerberatung (Frage 14).
3. Bleibt die Zahlung aus, setzt admin `payment_hold` und später `suspended` von Hand (10.4).
4. **[Phase 2]** Automatische Sammelrechnung am Monatsende (Rechnungsnummer mit Zählerzeile unter Sperre, PDF im privaten Bucket, Aufbewahrung 7 Jahre nach BAO § 132 angenommen), SEPA-Lastschrift über einen Zahlungsdienstleister, Status `settled`, `payment_hold` bei Rücklastschrift automatisch.

### 9.6 Was mit `fee_splits` passiert

`fee_splits` wird durch das Journal ersetzt (keine Kompatibilitätsschicht, Dev-Daten werden verworfen). Heutige Eigenschaften, die entfallen: eine Zeile je Anfrage, Upsert, Kaskadenlöschung, `payee_id` null bei Kontolöschung (M01:196-212, M10:97-100). Die Checks `fee_parts` und `payout_rest` (M01:211-212) übernimmt das Journal; **nicht** übernommen werden `non_negative` (M02:43-44) und `total_cents >= 0` (M01:201), weil Gegenbuchungen negativ sind (5.8). Die Schreibung von `fee_splits` in `quote` (H:259, M10:89-101) entfällt mit S9a, damit beim Absenden keine Gebührenzeile ohne Empfänger mehr entsteht; das Journal selbst entsteht in S9b (es braucht `partners`).

### 9.7 Phase 2 (später)

Bei `payout_model = connect` entsteht dieselbe Journal-Zeile mit `payment_flow = connect_fee`; die Gebühr wird als Application Fee abgezogen statt per Rechnung eingezogen. Das Schema ändert sich dafür nicht (Felder in 5.8).

---

## 10. Entscheidungen von Beks (01.11.2026): Frist, Storno, Kosten, Zahlungsverzug

Die nicht gewählten Varianten sind gestrichen. Alle Werte sind einstellbare Schlüssel (5.10).

### 10.1 Annahmefrist [Entschieden (Beks, 01.11.2026): Variante B]

Gestaffelt: höchstens 24 Stunden, höchstens die Hälfte der Zeit bis zum Termin, mindestens 2 Stunden. Formel: `accept_deadline = now() + max(accept_min_hours, min(accept_max_hours, accept_lead_share_percent % × (Termin − now())))`, `now()` der Datenbank [B21]; `quote` lehnt Termine näher als `accept_min_hours` ab (T1). Festangebote gelten 48 Stunden, höchstens bis zum Termin (4.3). Ein Nachtrag gilt `change_valid_hours` (2) Stunden [Entschieden (Beks, 01.11.2026)].

### 10.2 Stornoregeln und -kosten [Entschieden (Beks, 01.11.2026)]

- **Kunde (nach Annahme):** kostenlos bis 48 Stunden vor dem Termin; danach 50 % des Gesamtpreises; am Termintag 100 %. Maßgeblich sind die Werte im Snapshot der Revision (5.4). Die Folgeanfrage nach einem Partner-Storno (T16) darf der Kunde kostenlos stornieren (`cancel_fee_waived`).
- **Partner (nach Annahme):** Storno ohne Geld; Provision 0 (Gegenbuchung, 9.4). Folgen: **Qualitätszähler** (Anzahl `cancelled_by_partner` je Partner in `partner_cancel_review_days`, gezählt aus `assignments`; admin sieht Partner ab `partner_cancel_review_count` in einer Ansicht `partner_quality`, nur admin, ohne Benachrichtigung) und **Weitervermittlung** (T16). Eine Sperre setzt nur admin mit Begründung (P2B Art. 4, Frage Recht 4).
- Die Werte sind **vorläufig bis zur Rechtsprüfung**; Klauseln müssen § 6 KSchG standhalten (Frage Recht 5). Stornogebühren sind Teil der Provisionsbasis (9.4).

### 10.3 Kosten bei unmöglichem Auftrag nach abgelehntem Nachtrag [Entschieden (Beks, 01.11.2026): Variante C]

Eine **feste, einstellbare Anfahrtspauschale** (`call_out_fee_cents`) fällt nur an, wenn der Partner mit Fotobeleg zeigt, dass die Angaben des Kunden falsch waren; sonst ist der Abbruch für beide kostenlos. Ablauf: Der Partner meldet `cancel_by_partner` mit Grund `scope_impossible` und Fotobeleg (kein T16, 4.4); der Kunde kann der Pauschale widersprechen, im Streit entscheidet admin (`admin-correct`: Journal-Korrektur ohne Statuswechsel, Audit-Log, 4.4). Die Pauschale stellt der Partner dem Kunden außerhalb der App in Rechnung. Der Betrag steht im Snapshot der Revision (5.4); er beträgt 6.900 Cent (69,00 €), vorläufig [Entschieden (Beks, 01.11.2026), Frage 25]. Auf die Pauschale fällt Provision an (9.4, Frage 27).

### 10.4 Partner, der die Provision nicht zahlt [Entschieden (Beks, 01.11.2026): Variante B ohne Sicherheitsleistung]

Stufen: Erinnerung, `payment_hold` nach 14 Tagen nach Fälligkeit der Rechnung, Sperre nach 45 Tagen, danach Inkasso. Phase 1 zahlt der Partner per Überweisung auf Rechnung (9.5); admin setzt `payment_hold` und `suspended` von Hand (Funktion `admin_set_partner_status`, Begründung Pflicht, Audit-Log); beim Wechsel schließt die Funktion in derselben Transaktion die offenen Listings des Partners, setzt dessen `sent`-Angebote auf `withdrawn` (Akteur admin) und wendet bei jeder betroffenen Anfrage T4b bzw. T7 an, mit Outbox-Zeile an den Kunden [R9-9]. Die Automatik mit eigenen Schlüsseln (`hold_after_days`, `block_after_days`) ist **[Phase 2]**. Immer: schriftliche Begründung der Sperre (P2B Art. 4, Frage Recht 4) und Möglichkeit der Stellungnahme; laufende Aufträge werden abgewickelt (`my_job_partner_id()`) oder umgeleitet.

---

## 11. Rechtliche Prüfpunkte (nicht geklärt, Fragen an Anwalt/WKO)

Nichts hier ist beantwortet oder als zulässig dargestellt. **Beks klärt diese Punkte vor dem Bau des Buchungsbuttons** (S9i) [Entschieden (Beks, 01.11.2026)].

1. **FAGG-Informationspflichten und Button-Beschriftung:** Welche Informationen muss der Kunde vor der Bindung sehen (Gesamtpreis, Vertragspartner, Dauer, Widerrufsinformation)? Ist „Zahlungspflichtig buchen“ die richtige Beschriftung, wenn der Kunde direkt an den Partner zahlt und der Vertrag erst mit Annahme entsteht?
2. **Rücktrittsrecht je Leistungsart:** Transport mit festem Termin (Ausnahme nach FAGG § 18 Abs. 1 Z 10?) gegenüber Entrümpelung und Montage; vorzeitiger Leistungsbeginn und Wertersatz; Belehrung und Einwilligung im Ablauf.
3. **Bindungsfrist des Kundenangebots:** § 862 ABGB gegenüber dem Zurückziehen (T2) vor Annahme; ist ein Widerruf bis zur Annahme zulässig oder bindend? Gilt das auch für die automatische Folgeanfrage nach einem Partner-Storno (T16)?
4. **P2B-Verordnung (EU 2019/1150):** Art. 3 (15 Tage Vorlauf für Änderungen der Bedingungen, inklusive Provisionssatz; Entscheidung: 30 Tage), Art. 4 (begründete Sperre), Art. 5 (Ranking/„erste Annahme“), Art. 11 (Beschwerdeverfahren); was muss in den Partner-AGB stehen, auch zur Information der Partner über Gebührenänderungen?
5. **Stornoklauseln:** § 6 KSchG für Kunden-Stornokosten (Abschnitt 10.2).
6. **Omnibus-Hinweis/§ 4a FAGG:** Der Kunde muss vor der Bindung wissen, wer Vertragspartner ist; der Partner steht aber erst nach der Annahme fest. Wie ist der Hinweis zu formulieren?
7. **ZaDiG:** Warum läuft in Phase 1 kein Geld über MoveNow (Kunde zahlt direkt an Partner, der Partner zahlt MoveNow die Provision per Überweisung)? Reicht diese Konstruktion, damit keine Zahlungsdienst-Konzession nötig ist? Gilt dasselbe für **[Phase 2]** mit SEPA und Stripe Connect? Dazu: Meldepflicht nach DPMG/DAC7 (IBAN des Anbieters schon in Phase 1?), Risiko einer Leistungskommission (§ 3a UStG) und Haftung als Vermittler.
8. **Gewerbeberechtigung für die Vermittlung** (und ob Güterbeförderung durch die Partner eine Konzession erfordert); Pflichten bei Entrümpelung (Abfall).
9. **Umsatzsteuer:** Stimmt „inkl. 20 % USt.“ der Provision, wenn der Partner Kleinunternehmer ist oder im EU-Ausland sitzt (Reverse Charge)? Ist MoveNow selbst Kleinunternehmer?
10. **DSGVO:** Rollen zwischen MoveNow und Partner (getrennte Verantwortliche oder Auftragsverarbeitung), Weitergabe von Kontakt und Fotos nach Annahme, Aufbewahrungsfristen (30 Tage Zugriff nach Ende), Mail-Dienstleister (Auftragsverarbeitungsvertrag, EU).
11. **[Phase 2] SEPA:** CORE oder B2B, Vorabankündigung, Gläubiger-ID, Widerruf des Mandats.

---

## 12. Abhängigkeiten zu offenen Entscheidungen

| Entscheidung | Betrifft | Stand |
|---|---|---|
| **Mailanbieter** (Custom SMTP, Auftragsverarbeitungsvertrag, EU) | Benachrichtigungen an Kunden und Partner, Outbox-Versand, Auth-Mails mit Code (`docs/OPEN_ISSUES.md:31`), SPF/DKIM/DMARC | offen; blockiert S9c (ohne ihn keine Annahme-/Fristmeldungen) [B41] |
| **Aufbewahrungsfristen** (Fotos 90 Tage, Aufträge 3 Jahre, Journal 7 Jahre BAO § 132) | Löschjobs, Anonymisierung, Journal | Vorschlag in `docs/ARCHITECTURE.md:62`, Entscheidung offen; Zugriff des Partners ist mit 30 Tagen entschieden |
| **Domain** | `ALLOWED_ORIGINS`, Site URL, Redirects der Auth-Mails, Absender (DMARC), Links in Mails | offen (`docs/OPEN_ISSUES.md:19, 31`) |
| **Zahlungsdienstleister für SEPA** (Stripe oder anderer) | Mandat, Einzug, Connect | **[Phase 2]**; Frage Recht 7 |
| **Steuerberatung** | USt.-Rechenweg der Sammelrechnung, Kleinunternehmer, Reverse Charge | offen; blockiert nur Phase 2 (Phase 1 rechnet Beks manuell ab) |
| **Rechtsprüfung** (Abschnitt 11) | Buchungsbutton, Einwilligungstexte, Storno, Partner-AGB | Beks klärt vor dem Bau des Buchungsbuttons; blockiert S9i (Button), nicht S9a bis S9h |
| **ORS-Vertrag** (Routing) | Preise der Umzüge in der Vorschau und bei `quote` | offen (`docs/OPEN_ISSUES.md:18, 22`) |
| **Partner-AGB und Kunden-AGB** | Button, Einwilligungstexte, Sperre, Storno | offen; Platzhalter `/profil/impressum` |
| **Hosting** | Auslieferung der App, Edge-Function-Regionen | offen (CLAUDE.md) |

---

## 13. Umsetzungsplan (Phase 1)

Namen: **S9a ff.** [Entschieden (Beks, 01.11.2026)]; die ROADMAP-Anpassung ist angewendet (1.3). Jeder Schritt ist eine Session nach CLAUDE.md (Checks grün, Commit, Stopp). Die Reihenfolge ist eine Kette: Jeder Schritt baut nur auf Vorherigem auf. Der Kundenflow aus S8b bleibt nach jedem Schritt benutzbar: S9a enthält das dafür nötige Kunden-UI-Minimum; S9b bis S9h bauen ohne Oberfläche und testen per Integration gegen Edge Functions und RPCs, die E2E-Tests der Abläufe folgen mit den Oberflächen in S9i [R4-10]. Die Regeländerungen aus 1.3 sind angewendet; den Buchungsbutton (S9i) baut die Session erst nach der Rechtsklärung (Abschnitt 11). Nicht in diesem Plan (Phase 2): Miete und Vermieter mit Freigaben, Kilometer, Schäden, automatische Sammelrechnung, SEPA, Zahlungsdienstleister, `payment_hold`-Automatik, Push, pgAudit, Radius-Gebiete, Mehrfach-Mitglieder in der Oberfläche, Admin-Oberfläche.

| Schritt | Umfang | Migrationen (nur benannt) | Tests | Opus-Berater |
|---|---|---|---|---|
| **S9a Fundament** | `published` + `content_hash` + Unveränderlichkeit der Preisversionen; `platform_settings` mit `effective_from`, `fee_notice_days` und den Schlüsseln aus 5.10, `booking_terms()`; `status_events`, `audit_log`; die Admin-Funktionen `admin_create_price_version`, `admin_set_price_config`, `admin_set_setting` und `admin_grant_role` (Abschnitt 3); die admin-Schreib-Policies aus M01:270-299 auf `price_versions`, `price_config` und `platform_settings` werden entzogen (admin nur S, Matrix 6) [R9-2]; Wiener Bezirksgrenzen in PostGIS, eigenes globales Geocode-Kontingent für `quote`, Geocode-Cache mit Bereinigung (5.5) [R9-5, R9-6, R9-10]; Enum neu (ohne `inspection_requested`, `confirmed`, Check `inspection_needs_quote` entfällt), Übergangs-Trigger ohne Rollen-Ausnahme, UPDATE-Grants entzogen, `withdraw`; `price_revisions` (nur Anfragen) und `current_revision` mit Stornostufen im Snapshot; `quote`: `shownTotalCents`/`priceVersion`, Haltefenster 30 Minuten, 409 `price_changed`, `accept_deadline`, `too_late`; Bearbeiten nach Absenden entfällt; Kontaktdaten beim Absenden; **Fotos vor dem Absenden** (Staging-Pfad, neue Storage-Policies, `quote` übernimmt, Aufräumen); **`quote` schreibt kein `fee_splits` mehr, weder für Anfragen (H:259, M10:89-101) noch für Mieten (H:305, M10:136-140; die App liest `fee_splits` nirgends, `src/` ohne Treffer)** [Finding 5, R2-7, R3-12]; `rental_bookings` nutzt das neue Enum, sein Check `status <> 'inspection_requested'` (M01:175) entfällt, seine Übergänge bleiben bis Phase 2 (4.6) [R4-17]; **Kunden-UI-Minimum, damit der Kundenflow aus S8b benutzbar bleibt** [R4-10]: Absenden mit `shownTotalCents`, `priceVersion` und `termsHash`; eigene Texte für 409 `price_changed`/`terms_changed` und für 422 `district_required`, `too_late`, `too_many_photos`, `offer_not_bookable` (ohne „deine Anfrage ist nicht verloren“, es wurde nichts gespeichert); Antwortstatus `awaiting_offer` statt `inspection_requested` (`src/lib/quote.ts:108-115`, `src/lib/draft.ts:105`, Gesendet-Seite ohne Besichtigung `src/screens/anfrage/Gesendet.tsx:19`); Aufträge-Liste mit dem Preis aus der Revision statt `price_snapshot` und mit Texten für die neuen Status (`src/screens/Auftraege.tsx:13, 19, 35`); Foto-Upload in den Staging-Pfad nach der Anmeldung; Bezirk serverseitig aus dem Geocoding (Frage 29, 5.5; Adresssuche mit Einwilligung und Bestätigung auch bei Entrümpelung und Montage, das Feld „Wiener PLZ“ nur als Rückfall); Hinweis vor dem Absenden bei Abholung außerhalb Wiens; Gründe-Texte der Vorschau mit dem Hinweis, dass Partner Angebote senden (Frage 28), und bei `route_missing` der Text „Strecke bestätigen oder später erneut versuchen“ (nur Vorschau; bei der gespeicherten Anfrage `no_route` Hinweis auf das Angebotsverfahren; Ausfall und Limit ergeben 503/429, kein `route_missing`, 5.5) [R9-4]; Texte für 422 `address_mismatch`/`address_point_required`/`address_imprecise` und für 503/429 von `quote` (nichts gespeichert, später erneut senden) [R10-10] sowie Anzeige des kanonischen Labels bei der Adressbestätigung [R9-1]; „Anfrage bearbeiten“ entfernt [R5-5, R6-3]; Anpassung der bestehenden Tests [R4-11]: `tests/rls/rls.test.ts:268-304` (Zurückziehen nur über `withdraw`; `rental_bookings`: Z. 300 auf einen Status des neuen Enums umstellen, Z. 302 bleibt, das direkte Zurückziehen der Miete gilt bis Phase 2), `tests/rls/quote.test.ts:184-188` (Gebührenschlüssel sind ab Anlage unveränderlich, auch für `service_role`; `rls.test.ts:397-446` arbeitet mit einer unveröffentlichten Testversion und bleibt), `tests/rls/uploads.test.ts:48-245` (Staging statt Upload nach dem Absenden; `status: 'confirmed'` in Z. 75 und 210 gibt es nicht mehr), `quote.test.ts:102, 153, 194-235, 320` (`confirmed`, `inspection_requested`, Bearbeiten, direktes Zurückziehen), `quote.test.ts:109-114, 133, 157` (`estimate_cents`, `price_snapshot`, `inputs` an der Anfrage entfallen nach 5.4), `quote.test.ts:136-151, 241-262` (`fee_splits` durch `quote` entfällt), `quote.test.ts:179-191` (500 `fee_rates_missing`: `quote` braucht keinen Satz mehr); für S9b: `quote.test.ts:307-311` und `rls.test.ts:360-395` (Vermieter liest Satz bzw. `fee_splits`; Ersatz: die Journal-Tests aus S9b); neuer Negativtest: admin-UPDATE auf `status` → 42501 | `…_versions_published`, `…_settings`, `…_revisions`, `…_status_machine`, `…_request_contacts`, `…_photo_staging` | Unit (Haltefenster, Version, Hash, Rundung, Fristformel, `splitFee` unverändert), RLS (Version unveränderlich, Hash, Satzvorlauf und Unveränderlichkeit, Statusübergänge, direktes UPDATE verweigert, `current_revision`-Zeiger, Staging-Policies, Einstellungen), E2E (Preis ändert sich zwischen Vorschau und Absenden; Fotos vor dem Absenden) | **ja** (Geld, Schema, RLS) |
| **S9b Partner und Journal** | `partners`, `partner_members` (`unique (user_id)`), Kategorien, Bezirke, Dokumente; `partner_vat_rules`; Helfer `my_partner_id()` (annehmen) und `my_job_partner_id()` (abwickeln), beide mit `aal2`; Registrierung mit Prüfung durch admin; `admin_approve_partner`, `admin_set_partner_status` (Admin-Funktionen, nie direktes DML), lokales Aufruf-Skript für die admin-Edge-Functions (ohne Oberfläche); MFA (TOTP) für Partner und admin; `become_rental_provider` entfiel schon in S9a-4c (Migration 0022), Policy „lesen nur rental_provider/admin“ auf `platform_settings` entfällt; **Journal `commission_entries` (Trigger append-only, `ON DELETE RESTRICT`) ersetzt `fee_splits`** | `…_partners`, `…_partner_registration`, `…_commission_journal` | RLS (Spalten-Grants, pending/suspended, `aal1`/`aal2`, Auflage 6a, Journal append-only, Kunde liest Journal nicht, Querzugriff, `unique (user_id)`), Unit (Registrierung, Gegenbuchung = Negation als reine Funktion), Integration (Registrierung bis Freigabe; die Partner-Oberfläche folgt in S9i) | **ja** (Rollen, RLS, Auth, Geld) |
| **S9c Verteilung und Annahme** | `job_listings` (Kategorie, Bezirk der Abholadresse, Termin), `assignments`, `accept` (Compare-and-Set, Limit `partner_open_jobs_max`), `decline_listing`, Frist und `expired` per pg_cron (T7 für `requested`/`awaiting_offer`, T8), Outbox und Mail-Versand, `job_contact`, `admin-contact`, `my_job_partner(job)`, `start` (T9) und `complete` (T10) [R3-6c, e] | `…_job_listings`, `…_assignments`, `…_accept`, `…_deadlines_cron`, `…_outbox` | RLS (Listing-Spalten, fremde Listings, Kontakt, 30 Tage Zugriff), **Nebenläufigkeit** (10 parallele Annahmen = 1; Annahme gegen Rücknahme; Annahme nach Fristende), Unit (Verteilung, Limit), Integration (Kunde bucht, Partner nimmt an) | **ja** |
| **S9d Fotos für Partner** | `photo-publish` (Prüfen, Neu-Kodieren, Metadaten entfernen, Beleg-Upload des Partners), Bucket `job-photos`, `job_photos`, `job-photo` mit signierten URLs, `admin-photo` (Art A, Audit-Log), Verteilung erst nach den Foto-Endzuständen, Aufräumen für beide Buckets; Messung CPU/Speicher | `…_job_photos` | RLS/Storage (Partner ohne Direktzugriff), Unit (Neu-Kodierung ohne EXIF), Integration (Foto im Listing, Original unzugänglich) | **ja** (Sicherheit) |
| **S9e Festangebot** | `partner_offers`, `send_offer` (innerhalb der Spanne, ohne Spanne freier Betrag [Frage 28]; 48 h, höchstens 3 offene, höchstens eines je Partner), `confirm_offer` mit Statusprüfung des anbietenden Partners (R7-1) und Bestätigung nur durch den Kunden, `reject_offers`, `withdraw_offer`, `superseded`, T4b und der `offered`-Zweig von T7 (setzt S9c voraus) | `…_partner_offers` | RLS (Unveränderlichkeit, Kunde sieht keine Auszahlung), Nebenläufigkeit (4 parallele Angebote = 3; neues Angebot nach abgelaufenem `sent`-Angebot), `partner_not_active` bei `confirm_offer` (mit `withdrawn`, Outbox, T4b/T7, R9-3), `admin_set_partner_status` (R9-9), `offer_limit`/`offer_exists`, Auslandsziel 422, Integration | **ja** |
| **S9f Nachtrag** | `propose_change` (Differenzregel 5.6 mit gebuchter Version, nur bei Differenz > 0, kein Nachtrag bei Festangebot), `decide_change`, Ablauf-Job für Nachträge (N3, `change_valid_hours`), Beleg-Fotos über `photo-publish` (**setzt S9d voraus**) | `…_change_orders` | Unit (Differenzregel mit gebuchter Version, Mindestpreis, nur erhöhend), RLS (kein freier Betrag, ein offener Nachtrag), Integration | **ja** (Geld) |
| **S9g Abschluss und Export** | T15 und „Hat der Auftrag stattgefunden?“ (Mail und Liste, `report_not_done`, `not_done_reported_at`), `export_commissions` (CSV, Abrechnungsmonat aus `status_events`), Journal-Liste für Partner als Funktion für die eigene Firma mit `aal2`, die den Abrechnungsmonat wie `export_commissions` berechnet (Partner lesen `status_events` nicht; setzt S9b, S9c voraus) | `…_completion` | Unit (T15 nach 7 Tagen, Abrechnungsmonat), RLS (Partner sieht nur eigene Zeilen, Export nur admin), Integration | **ja** (Geld) |
| **S9h Storno, Qualität, Konto** | `cancel_by_customer` (Stornostufen aus der Revision, `cancel_fee_waived`), `cancel_by_partner` mit `scope_impossible`/Pauschale, T16 (`reissued_from`, kopierte Revision und Fotos, Ausschluss), `partner_quality`, `admin-correct` (T14, Edge Function mit Gebührenzeile), Konto löschen mit Anonymisierung (Frage 24, entschieden) [R3-6e] | `…_cancellation`, `…_account_deletion` | Unit (Stufen, Rundung, Gegenbuchungen), RLS (Kaskade verweigert, 23503, Neuverteilung nur einmal), Integration | **ja** (Geld) |
| **S9i Oberflächen** | Kunde: Fotos vor dem Absenden, Button und Texte nach Rechtsklärung, Aufträge-Detail (14) mit Status, Angebote, Nachtrag, Frage nach dem Termin, Storno mit Stufen; Partner-Portal (Registrierung mit MFA-Einrichtung, Listings, Annahme, Angebot, Nachtrag, Journal-Liste mit CSV); `formatEuro` für alle verbindlichen Beträge; Tab „Miete“ in Phase 1 ausgeblendet (Frage 26; Tab-Bar dann Start · Aufträge · Profil, bis die Miete in Phase 2 kommt) | – | E2E mit Tastatur für alle Abläufe aus S9a bis S9h, `shots` (Reviewer mit Bildsicht, Regel in CLAUDE.md) | nein (nur UI), Geld-Anzeige durch Reviewer |

**Reihenfolge:** S9a → S9b → S9c → S9d → S9e → S9f → S9g → S9h → S9i. S9c verteilt zunächst ohne Foto-Wartezeit und ohne Festangebot-Funktion; S9d ergänzt die Foto-Pipeline und die Wartebedingung der Verteilung, S9e das Angebot. Vor S9d und S9e geht S9c nicht in Produktion. Das Journal liegt in S9b (nach `partners`, vor S9c), damit `accept` (S9c), `confirm_offer` (S9e) und der Nachtrag (S9f) schon Zeilen schreiben können; S9a entfernt nur die `fee_splits`-Schreibung in `quote`. Spalten an `service_requests` kommen mit dem Schritt, der sie braucht: `accept_deadline` (S9a), `not_done_reported_at` (S9g), `reissued_from` und `cancel_fee_waived` (S9h). Alle Übergänge mit Preis oder Gebühr (Art A in 4.5) sind Edge Function + SQL-Funktion, das Muster von `quote`. Voraussetzung vor dem Produktivstart: Die Werte aus Frage 25 sind gesetzt (`window_start_*` einschließlich `flexible` ist entschieden und Voraussetzung für S9a, weil `quote` ohne sie fail closed antwortet) (`photo_staging_hours` und `window_start_*` ab S9a, `call_out_fee_cents` ab S9a, weil der Snapshot ihn ab T1 trägt; `change_valid_hours` ab S9f) [R4-16]. Voraussetzung für S9e ist außerdem `offer_max_cents` (entschieden: 800000; fehlt der Schlüssel, antwortet `send_offer` bei Angeboten ohne Spanne fail closed, 5.10) [R9-7]. Ab S9c lassen sich Testnutzer mit Vertragsaufträgen nicht mehr löschen (Journal unveränderlich, `ON DELETE RESTRICT`): Die Tests tragen ein Präfix je Lauf, das Dev-Projekt wird bei Bedarf zurückgesetzt; die Anonymisierung folgt in S9h [R4-12]. S9a setzt bei der Migration `published` und den Hash für die bestehenden Preisversionen (über die interne Funktion ohne `p_actor`, die nur der Eigentümer ausführt, nicht über `publish_version(p_actor, …)`, R7-2, R11-2), sonst liefert `current_price_version` nichts und `quote` bricht ab; fehlt ein Wert aus Frage 25, antwortet `quote` fail closed, statt `termin_at` oder die Pauschale mit NULL einzufrieren. Integrationstests ab S9c legen ihre Fixtures über einen SQL-Helfer an, den nur `service_role` ausführen darf und der Anfrage, Revision 1 und `current_revision` in einer Transaktion schreibt (Status `requested`, `termin_at` frei wählbar), weil getrennte Inserts den Zeiger nicht setzen können, Statuswechsel den Marker brauchen und Termine in der Vergangenheit nicht buchbar sind. Der Seed (`supabase/seed.sql`) nutzt `on conflict … do nothing` für `price_versions`, `price_config` und `platform_settings` und veröffentlicht die Version über eine interne Funktion ohne `p_actor`, die nur der Eigentümer ausführen darf (derselbe Hash wie `publish_version`); „Ausnahme nur die erste Version“ in 5.1 gilt für den Vorlauf beim INSERT, nicht für die Unveränderlichkeit [R6-5].

---

## 14. Fragen an Beks

### 14.1 Entschieden (Beks, 01.11.2026)

Die Nummern sind die Nummern dieses Abschnitts; Beks' Zählung vom 01.11.2026 weicht ab Frage 18 ab (seine F18/F19 sind hier Fragen 18 und 21, seine F20 ist hier Frage 19, F21 ist hier Frage 20).

| Frage | Entscheidung | Wirkung |
|---|---|---|
| 1 Namen | Schritte heißen S9a ff.; ROADMAP-Anpassung (angewendet) | 1.3, 13 |
| 3 Bearbeiten nach Absenden | gestrichen: zurückziehen bzw. stornieren und neu senden | R2 |
| 4 Haltefenster und E2 | 30 Minuten (`price_hold_minutes`); E2 „nie stillschweigend“ bestätigt | R1, 5.4 |
| 5 Festangebot | innerhalb der Spanne, ohne Spanne frei (Frage 28); höchstens 3 offene je Anfrage; 48 Stunden gültig, höchstens bis zum Termin | 4.3, 5.5, 5.7 |
| 6 Besichtigung | gestrichen | 4.1, U13 |
| 7 Vermieter-Freigabe, 13 Miete | Phase 2 (mit der Miete) | 5.3, 8.8 |
| 8 Festpreis und Nachträge | Festpreis gilt in beide Richtungen; Nachtrag nur erhöhend und nur mit Zustimmung des Kunden | 5.6 |
| 8b Nachtrag bei Festangebot | kein Nachtrag | 5.6 |
| 9 Kontakt und Fotos nach dem Auftrag | 30 Tage nach `completed` bzw. Storno | 5.5, 7.2 |
| 10 Partner-Firma | Datenmodell mit `partner_members` (`unique (user_id)`), Oberfläche nur Inhaber; MFA (TOTP) Pflicht für Partner, nicht für Kunden | 5.2, R19 |
| 11 Gebiet | Liste der Wiener Bezirke 1–23, maßgeblich die Abholadresse; Radius Phase 2 | 5.2, 5.5 |
| 12 Weitervermittlung | automatisch zum gleichen Preis, wenn der Termin mindestens 24 Stunden entfernt ist; Kunde wird informiert und darf kostenlos stornieren; sonst neue Anfrage über `quote` | T16, 8.6 |
| 12b Festangebot und Miete bei T16 | nicht erlaubt, Kunde entscheidet neu | T16 |
| 14 USt. der Sammelrechnung | Steuerberatung klärt; blockiert nur Phase 2 | 9.5, 12 |
| 15 Gebührenänderung | 30 Tage Vorlauf, die Datenbank erzwingt es | 5.1 |
| 16 Zahlungsdienstleister | Phase 1 ohne; Phase 2 | 1.4 |
| 17 Partner-Qualität | höchstens 5 offene angenommene Aufträge je Partner; Prüfung ab 3 Partner-Stornos in 30 Tagen | 10.2, 5.10 |
| 18, 21 Fertigmeldung | Kunde wird nach dem Termin gefragt, Antwortfrist 7 Tage; ohne Meldung gilt der Auftrag 7 Tage nach dem Termin als durchgeführt | T15, 8.5b |
| 19 Push | nur Mail und Liste in der App | R14, 5.9 |
| 20 Rechtsprüfung | Beks klärt die Fragen aus Abschnitt 11 vor dem Bau des Buchungsbuttons | 11, 12 |
| 22 Admin-Einsicht | reicht für Phase 1; pgAudit Phase 2 | 7.2 |
| 23 Foto-Fenster | Fotos nur vor dem Absenden; Absenden bedeutet „Fotos fertig“; kein eigener Schritt, kein Timeout-Job | 7.1 |
| 10.1 bis 10.4 | Annahmefrist Variante B; Storno Kunde 48 h / 50 % / Termintag 100 %, Partner ohne Geld mit Qualitätszähler und Weitervermittlung; Pauschale Variante C; Zahlungsverzug Variante B ohne Sicherheitsleistung, Phase 1 per Überweisung auf Rechnung | Abschnitt 10 |
| MVP-Schnitt | Phase 1 und Phase 2 wie in 1.4 | 1.4, 13 |

### 14.2 Entschieden (Beks, 01.11.2026)

2. **Regeländerungen (1.3):** freigegeben und angewendet (1.3).
24. **Konto löschen mit Anonymisierung** bleibt in S9h, weil das Journal `ON DELETE RESTRICT` hat und die bisherige Kaskade (M01:107, 174) sonst das Löschen eines Kontos mit bestätigten Aufträgen blockiert.
25. **Zahlenwerte:** `change_valid_hours` = 2; `call_out_fee_cents` = 6900 (vorläufig); `photo_staging_hours` = 24 (5.10). `offer_max_cents` = 800000. **`window_start_<fenster>`** (Wiener Ortszeit): `morning` 08:00, `midday` 11:00, `afternoon` 14:00, `flexible` 08:00 (Beginn des Termintags) [Entschieden (Beks, 01.11.2026)]. **Ergänzung für S9i:** Die App zeigt dem Kunden die Spannen `morning` 8–11, `midday` 11–14, `afternoon` 14–18, `flexible` „ganzer Tag ab 8 Uhr“.
26. **Admin ohne Oberfläche in Phase 1:** Admin-Aktionen nur über Admin-Funktionen (RPC) oder benannte Skripte, nie direktes INSERT/UPDATE/DELETE auf Tabellen, auch nicht in der SQL-Konsole (Abschnitt 3). Der Tab „Miete“ ist in Phase 1 ausgeblendet (S9i, Abschnitt 13). Die Admin-Oberfläche bleibt Phase 2.
27. **Provision auf die Anfahrtspauschale:** Die Provision fällt auch auf die Anfahrtspauschale an (9.4, 10.3).
28. **Festangebot ohne Spanne (Teil von S9e):** Anfragen mit `needsQuote` ohne Spanne sind über ein Festangebot mit freiem Betrag buchbar: höchstens 3 offene Angebote (höchstens eines je Partner), gültig 48 h, höchstens bis zum Termin; der Kunde sieht alle Angebote und bestätigt eines (nur der Kunde, `confirm_offer` prüft den Partnerstatus, R7-1). **Ausnahme Auslandsziel:** in Phase 1 nicht buchbar, 422 `offer_not_bookable` nur noch dafür (T1, 5.5, 8.2).
29. **Wiener Bezirk der Abholadresse:** Geprüft: Die serverseitige Geokodierung liefert eine PLZ (`provider.ts:69`, `facts.ts:7`, `handler.ts:74-75`); `quote` leitet den Bezirk serverseitig aus den Wiener Bezirksgrenzen ab (Punkt im Polygon), **kein neues Pflichtfeld** und kein Rückfallfeld „Wiener PLZ“ (Entscheidung Beks, 02.11.2026; die PLZ spielt keine Rolle). Abholung außerhalb Wiens ist in Phase 1 nicht buchbar, mit klarer Meldung; ein Ziel im Inland außerhalb Wiens ist erlaubt (Einzelheiten und Belege 5.5).
30. **Rechenregel des Nachtrags:** neuer Preis = gebuchter Preis + Modul(neue Eingaben, gebuchte `price_version`) − Modul(alte Eingaben, gebuchte `price_version`), aktueller Code; nur bei Differenz > 0 (F8), sonst kein Nachtrag. Versionsverzweigung des Moduls, Golden-Tests je Version und `price_basis_changed` entfallen (5.6).
R7-1. **`confirm_offer` und Partnerstatus:** Fix in S9e (T5, 8.2): Ist der anbietende Partner nicht `active`, ist das Angebot ungültig und der Kunde wird informiert; `docs/OPEN_ISSUES.md`: „im Konzept gelöst, Umsetzung S9e“.

### 14.3 Offen (Beks) [R10-13]

| Punkt | Was Beks nennt | Blockiert |
|---|---|---|
| `window_start_<fenster>` | entschieden (Beks, 01.11.2026): 08:00 / 11:00 / 14:00 / 08:00, Frage 25, 5.10 | – |
| `offer_max_cents` | entschieden (Beks, 01.11.2026): 800000, 5.5, 5.10 | – |
| `route_missing` buchbar | Bestätigung: Eine Anfrage mit `no_route` (Punkt unerreichbar) und bekannter Inlandsregion wird als Anfrage ohne Spanne gespeichert und geht ins Angebotsverfahren (5.5, 6.1); Ausfall und Limit sind nie buchbar | S9a |
| Bezirk nur aus dem Polygon | Empfehlung des Beraters: Rückfallfeld „Wiener PLZ“ entfällt (Entscheidung 29 gilt bis zur Antwort) | S9a |

**Zurückgestellt auf Phase 2** (nicht mehr offen für Phase 1): Frage 14 (USt. der Sammelrechnung, Steuerberatung) und Frage 16 (Zahlungsdienstleister), beide in 14.1 beschrieben.
