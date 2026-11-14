# s9p-1 Planprüfung (Kennung p1-1411-a) – Vorlage 2 (Nachprüfung deiner Auflagen aus s9p-1-fable-plan.md)

WICHTIG: Das eingebaute `advisor`-Tool NICHT aufrufen. Schreibe den Bericht ausschließlich nach `tmp/proof/s9p-1-fable-plan-2.md` (Repo C:\Users\gesch\Music\MoveNow). Ändere nichts anderes.

Gegenstand: `supabase/migrations/20261114100000_0062_fee_schedule.sql`, SHA-256 `1786631c064d0c10fd92cf24ab17d07cecc238dc8793eb3987070ecf8db8e334` (vorher 39196729…). Funktionsdiff aktualisiert: `tmp/proof/s9p-1-funktionsdiff.log`.

Umgesetzt aus deinem Bericht (bitte jeweils gegen den SQL-Text prüfen, nicht gegen diese Liste):
- H1: `grant insert` an service_role entfernt (nur `grant select`); Kommentar angepasst.
- M1: `do`-Block vor dem Löschen der Spalten, bricht ab, wenn `commission_entries.fee_rate <> 0.15` (Meldung `fee_rate_not_flat`).
- M2: Guard (booking) bestimmt die zulässige Version selbst: `rev.source = 'partner_offer'` → Version des bestätigten Angebots (`rev.snapshot ->> 'offerId'`, gleicher Auftrag, gleiche Firma, Status confirmed), sonst `private.current_fee_schedule()`; Abweichung `rate_mismatch`.
- M3: `private.guard_partner_offer` neu (create or replace), `fee_schedule_version` in beiden Zeilenlisten.
- N1: `private.fee_cents` fail closed (`setting_missing`): steigende Grenzen, genau eine offene Stufe, und zwar die letzte.
- N2: `payout_preview` prüft aal2 (`mfa_required`) vor der Mitgliedschaft.
- N3: Policy `platform_settings_select`: Partner lesen nur noch `fee_vat_rate` (Zeile `fee_rate` bleibt unveränderlich als Historie).
- N4 nicht geändert; N5 (Konzept-Doku) und N6 folgen im Doku-Schritt.

Prüfe: (1) jede dieser Änderungen richtig und vollständig, keine neue Lücke (z. B. Reihenfolge `confirm_offer`: Angebotsstatus `confirmed` wird vor `commission_book` gesetzt; der Guard-Join auf `rev.snapshot ->> 'offerId'` bei Revisionen anderer Herkunft; Verhalten des `do`-Blocks auf einer leeren Datenbank); (2) die Erwartungswerte (30000→3600 … 6900→828, v1 68961→10344) gelten weiter mit der geänderten `fee_cents`; (3) sonst nichts Neues.

LETZTE Zeile des Berichts: `Offene Findings hoch: N`, davor oder danach als allerletzte Zeile entweder `Freigabe SQL SHA-256 1786631c064d0c10fd92cf24ab17d07cecc238dc8793eb3987070ecf8db8e334` oder `Keine Freigabe: <Grund>`.
