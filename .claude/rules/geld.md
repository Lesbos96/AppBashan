---
paths:
  - "supabase/**"
  - "scripts/**"
  - "src/**"
  - "tests/**"
---
# Geld

- Beträge als Integer-Cent in DB und API. Rechnen wie der Prototyp, erst am Ende auf Cent runden (wie `cents()` dort).
- Den gespeicherten Preis berechnet der Server (Edge Function `quote`) aus `price_config`. Die App nutzt dasselbe Modul (`@pricing`) nur für die Vorschau. Gespeichert wird ein Snapshot mit `price_version`.
- Plattformgebühr (Provisionsstaffel, s9p-1): progressiv auf den Brutto-Gesamtpreis in Integer-Cent, Provision inkl. USt.: bis 50.000 ct 12 %, 50.001 bis 100.000 ct 10 %, darüber 7 % (Version 2); die Stufenanteile werden summiert und einmal kaufmännisch gerundet: fee = round(Σ Stufenanteil); netto = round(fee / 1,2); USt. = fee − netto; Partner = total − fee. Version 1 (15 % flach) gilt nur für Bestandszeilen. Nachtrag = Provision(Gesamt nach) − Provision(Gesamt vor); Pauschale: Staffel auf die Pauschale allein. Die Version wird beim Angebot bzw. bei der Annahme gespeichert, der Auftrag erbt sie.
- Kunden können die Gebühr weder sehen noch per API lesen. Die Gebührenaufteilung liegt im Journal `commission_entries` (entsteht bei der Annahme, nur anfügen), die Staffel in den eigenen Tabellen `fee_schedules` und `fee_schedule_tiers`, nicht in der öffentlich lesbaren `price_config`. Journal lesen nur die eigene Partner-Firma (mit aal2) und admin (mit aal2); die Staffel lesen alle Partner-Konten unabhängig vom Status (P2B-Transparenz) und admin; Kunden ohne Partner-Konto nichts. Beides per RLS-Test abgesichert.
- Die Gebührenfunktion bekommt die Stufen als Parameter. Im App-Code steht kein fester Satz; „Du erhältst“ liefert der Server (`payout_preview`). Kundenpreise brauchen die Staffel nicht, weil die Gebühr im Gesamtpreis enthalten ist.
- Angezeigt wird die Gebühr nur in der Vermieter-Abrechnung und später auf der Rechnung (und in der Auszahlungsübersicht des Partner-Portals, sobald es freigegeben ist). Die `feeHTML`-Hinweise des Prototyps werden nicht übernommen.
- Kaution und Kraftstoff sind nie Teil der Berechnungsbasis.
- Keine erfundenen Preise, Partner, Bewertungen oder Verfügbarkeiten. Beispieldaten aus der Design-Referenz kommen nicht in die App.
- Kein Hinweis auf „15 %“, „Plattformgebühr“, „Provision“ oder „MoveNow-Gebühr“ in Kunden-Screens.
- Beträge formatiert nur `formatEuro` (`src/lib/money.ts`), Ausgabe wie in der Referenz: „1.175,00 €“.
