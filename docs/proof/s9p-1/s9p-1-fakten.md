# s9p-1 Fakten (Kennung p1-1411-a), Stand main 364aeb7, lesend erhoben (Explore + eigene Lektüre)

## Rechenstellen vorher
- TS: `supabase/functions/_shared/pricing/fee.ts:17-25` `splitFee(total,{feeRate,vatRate})` (Skalar, `basisPoints` :7-11); `pricing/change.ts:33` `splitChange` (Differenz der Komponenten, Konzept 9.3).
- Aufrufer: `jobs/handlers.ts:100` (Annahme), `:153` (Angebot bestätigen); `change/handlers.ts:120,187`; `cancel/handlers.ts:56` (Kundenstorno); `cancel/partner.ts:31,70` (`splitOf`, Pauschale); `admin/correct.ts:75`.
- DB-Adapter (lesen `fee_rate`, `fee_rate_version`, übergeben `p_fee_rate*`): `jobs/db.ts:34-85`, `change/db.ts:51-75`, `cancel/db.ts:17-72`, `admin/db.ts:17-41`.
- SQL Satzquelle: `private.current_fee()` 0038:262 (liest `platform_settings` fee_rate/fee_vat_rate); View `current_fee_rates` 0028:199.
- Journal: `commission_entries` 0028:11 (Spalten fee_rate, fee_vat_rate, *_version); `private.commission_book` neueste 0030:183; `private.guard_commission_insert` neueste 0040:204 (Satzvergleich booking gegen current, andere Arten gegen booking-Zeile).
- Basis-/Ausführungsfunktionen (neueste Definition): partner_accept_basis 0061:4 (älter 0038:359), partner_accept 0038:386, confirm_offer_basis 0038:624, confirm_offer 0039:87, send_offer 0039:25, decide_change_basis 0040:393, decide_change 0041:51, propose_change_basis 0058:54, cancel_by_customer_basis 0046:293, cancel_by_customer 0046:314, cancel_by_partner_basis 0059:56, cancel_by_partner 0059:81, admin_correct_basis 0049:62, admin_correct 0050:24.
- Lesen: `commission_row`-Typ 0042:79 (Spalte fee_rate), `commission_rows` 0042:100, `my_commissions` 0042:133, `export_commissions` 0042:120. CSV `_shared/commission/csv.ts` (Spalte fee_rate :13, :94, :105).
- Client: `src/lib/partnerJobs.ts:111-127` (`currentRates()` liest View `current_fee_rates`, `payoutCents` mit splitFee), verwendet in `src/screens/partner/Anfragen.tsx:101,233`; `src/screens/partner/Absage.tsx:231-233` (Gebühr = callOutCents − payoutCents, Differenz aus Serverwerten); `src/lib/partnerJournal.ts:14` (Spaltenliste).
## Feste 15 %
- Seeds `supabase/seed.sql:86`, `seed.prod.sql:86` (`fee_rate` 0.15 Version 1); Migrationen: kein Literal.
- Tests: ~60 Dateien mit fee_rate/splitFee (siehe Grep), Doku: S9_KONZEPT 9.1-9.3, ARCHITECTURE, CLAUDE.md Anzeigeliste.
## Angebot/Auftrag
- `partner_offers` 0038:17 (amount_cents, kein Satz); Satz wird erst in confirm_offer aus current_fee() gelesen und gegen p_fee_rate* verglichen (0039). `service_requests`/`price_revisions` ohne Satzspalten; fest steht der Satz nur in `commission_entries` (booking-Zeile).
## Doppelschutz
- 409: `payout_changed` (accept, shownPayoutCents), `fee_rate_changed` (rate_mismatch/amount_mismatch nach einem Retry), `amount_changed` (Angebot, Nachtrag, Pauschale, Admin), `cancel_fee_changed` (Kundenstorno).
