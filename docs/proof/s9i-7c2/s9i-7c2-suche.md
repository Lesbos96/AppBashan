Kennung 7c2-1311-c · Teil S: SQL-Funktionen mit Zeilenrückgabe, die App oder Edge Functions aufrufen
Quelle: Explore-Suche (Haiku-Agent, nur lesend), Stichproben der Belegzeilen vom Hauptagenten gelesen (Datei:Zeile unten). Kriterium: echter Aufruf gegen Dev UND mindestens eine gelieferte Zeile (42804 tritt erst beim Liefern einer Zeile auf).
Korrekturen an der Agentenliste (vom Hauptagenten nachgeprüft): `quote_save_booking` und `quote_save_request` haben Tests mit Zeile (live über die Edge `quote`, Status 200 und Zeile gelesen); der Agent hatte sie als Lücke bzw. „unklar“ geführt. `photo_claim` und `my_job_partner` haben keinen Aufrufer in `src/` oder `supabase/functions/` (Cron bzw. nur SQL), Test mit Zeile ist trotzdem vorhanden.

| Funktion | Aufrufer | Test mit Zeile ja/nein (Datei:Zeile) | neu ergänzt | Ergebnis |
|---|---|---|---|---|
| partner_accept_basis | functions/_shared/jobs/db.ts:29 | ja: flow-live.test.ts W1 (Edge accept 200), listings.test.ts:187 | nein (7c2 Teil 1) | war der Fehler 42804, behoben mit 0061 |
| confirm_offer_basis | _shared/jobs/db.ts:63 | ja: offers.test.ts:210 (SQL, Zeile); Edge live: flow-live W5 | W5 offer-confirm live | grün |
| cancel_by_customer_basis | _shared/cancel/db.ts:48 | ja: cancellation.test.ts:91 (SQL, Zeile); Edge live: flow-live W4 | W4 cancel-customer live | grün |
| admin_correct_basis | _shared/admin/db.ts:10 | ja: admin-correct.test.ts:125 (SQL, Zeile) | nein | Edge admin-correct ohne Live-Aufruf, OPEN_ISSUES S9i7c2-2 (Rest) |
| cancel_by_partner_basis | _shared/cancel/db.ts:11 | ja: journal-live.test.ts:106, flow-live W2/W3 | nein | grün |
| propose_change_basis | _shared/change/db.ts:16 | ja: flow-live W1 (Edge change-propose 200) | nein | grün |
| decide_change_basis | _shared/change/db.ts:46 | ja: flow-live W1 (Edge change-decide 200) | nein | grün |
| my_jobs | src/lib/partnerJobs.ts:261 | ja: partner-my-jobs.test.ts:113 | nein | grün |
| my_job_changes | src/lib/partnerChange.ts:62 | ja: partner-my-job-changes.test.ts:109 | nein | grün |
| my_commissions | src/lib/partnerJournal.ts:29 | ja: flow-live (Summen aus Zeilen) | nein | grün |
| export_commissions | scripts/export-commissions.mjs:19 | ja: completion.test.ts:236 | nein | grün |
| job_contact | src/lib/partnerJobs.ts:299 | ja: partner-my-jobs.test.ts:212, flow-live W2A/W3/W4/W5 | nein | grün |
| my_request_offers | src/lib/jobs.ts:128 | ja: offers.test.ts:180 | nein | grün |
| my_job_partner | kein Aufrufer in src/ oder functions/ | ja: listings.test.ts:389 | nein | grün (nur SQL) |
| admin_contact | _shared/jobs/db.ts:95 | ja: account-deletion.test.ts:196 | nein | grün (Edge admin-contact nicht live) |
| outbox_claim | _shared/jobs/db.ts:113 | ja: outbox.test.ts:40 | nein | grün |
| photo_orphans | functions/photo-cleanup/index.ts:34 | ja: uploads.test.ts:661 | nein | grün |
| photo_purge | functions/photo-cleanup/index.ts:50 | ja: admin-correct.test.ts:91 | nein | grün |
| photo_claim | kein Aufrufer in src/ oder functions/ (Cron/SQL) | ja: job-photos.test.ts:447 (geclaimt = 1) | nein | grün |
| job_photo_list | _shared/photo/db.ts:68 | ja: job-photos.test.ts:245 | nein | grün |
| admin_photo | _shared/photo/db.ts:77 | ja: job-photos.test.ts:293 | nein | grün |
| route_geo_facts | _shared/route/db.ts:24 | ja: route.test.ts:104 | nein | grün |
| quote_district | _shared/quote/db.ts:71 | ja: quote-hardening.test.ts:286 | nein | grün |
| price_version_hold | _shared/quote/db.ts:44 | ja: quote-hardening.test.ts:288 | nein | grün |
| quote_save_request | _shared/quote/db.ts:153 | ja: quote.test.ts:122 (Edge quote 200, Zeile gelesen), tests/support/db.ts:69 | nein | grün |
| quote_save_booking | _shared/quote/db.ts:183 | ja: quote.test.ts:235-237 (Edge quote 200, rental_bookings-Zeile über die gelieferte id) | nein | grün |

Neu ergänzt in `tests/rls/flow-live.test.ts` (alle auf Dev grün, Lauf `tmp/proof/s9i-7c2-flow-run-9.log`, 16 Tests):
- W4: Edge `cancel-customer` (401, 404 für Firma, Vorschau 0, `cancel_fee_changed` 409, Storno 200 `cancelled_by_customer`, Gegenbuchung, Summe 0). Ist: `job_contact` bleibt nach Kundenstorno im Zugriffsfenster (0060 sperrt nur nach Firmenstorno, Entscheidung 104).
- W5: Edge `offer-confirm` (send_offer aal1 `mfa_required`, aal2 ok; 401, 404 für Firma, `amount_changed` 409, 200, genau eine Buchungszeile 150000/22500/18750/3750/127500, Status `accepted`).
- Offen: `admin-correct` live (Edge). Grund: braucht ein drittes MFA-Konto (admin, aal2; Auth-Rate-Limit je Lauf) und einen Zustand je Aktion; mehr als wenige Zeilen. SQL-Seite `admin_correct_basis` liefert in admin-correct.test.ts:125 eine Zeile.

Neue Funde: keine echten Fehler. Zwei Erwartungen waren falsch und wurden an den Ist-Wert angepasst, beide Verhalten laut Entwurf: Firma auf `cancel-customer` und `offer-confirm` ergibt 404 (nicht 403, kein Hinweis auf die Anfrage); `job_contact` nach Kundenstorno bleibt offen; `my_commissions` zeigt die Buchung eines angenommenen, nicht abgeschlossenen Auftrags noch nicht (W5 Summe 0).
