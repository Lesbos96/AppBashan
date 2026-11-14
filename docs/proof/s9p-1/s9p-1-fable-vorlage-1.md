# s9p-1 Planprüfung (Kennung p1-1411-a) – Vorlage 1

WICHTIG: Das eingebaute `advisor`-Tool NICHT aufrufen. Schreibe deinen Bericht ausschließlich nach `tmp/proof/s9p-1-fable-plan.md` (im Repo C:\Users\gesch\Music\MoveNow). Lies selbst: die Migration, den Funktionsdiff, die Fakten. Ändere nichts anderes.

## Gegenstand
- Migration `supabase/migrations/20261114100000_0062_fee_schedule.sql` (SHA-256 `39196729feb72282b771d3441e4dcf79e6bac64af1483fde23e9e6fe7a45a690`, erzeugt aus `tmp/p1/hand.mjs` + `tmp/p1/build.mjs`, Quelle der mechanisch umgestellten Funktionen = jeweils neueste Definition).
- Textdiff je Funktion gegen die neueste Definition: `tmp/proof/s9p-1-funktionsdiff.log`.
- Fakten: `tmp/proof/s9p-1-fakten.md`. Konzept: `docs/S9_KONZEPT.md` 9.1–9.4.
- Nicht in dieser Migration (folgt, nach deiner Freigabe): Edge Functions (`splitFee` bekommt Stufen + `fee_tiers jsonb` aus den Basisfunktionen, Parameter `p_fee_schedule_version` statt `p_fee_rate`/`p_fee_rate_version`), Client (`payout_preview`-RPC statt `splitFee`), CSV-Spalte „Staffel“.

## Fachliche Vorgabe (Beks, verbindlich)
Basis = Kundenbrutto in Cent. Progressiv: 0–50000 ct 1200 bp; 50001–100000 ct 1000 bp; über 100000 ct 700 bp; Grenze gehört zur unteren Stufe. Provision = Summe der Stufenanteile, einmal half-up auf Cent (Ganzzahl). Inkl. USt.; Aufteilung netto/USt wie bisher. Nachtrag: Provision(Gesamt nach) − Provision(Gesamt vor). Storno ohne Pauschale: exakte Negation. Pauschale: Staffel auf die Pauschale allein. Version 1 = 15 % flach (Bestand), Version 2 = 12/10/7 ab Einspielen; Angebot speichert Version bei Abgabe, Auftrag erbt beim Zuschlag; Nachtrag/Pauschale nutzen die Version der booking-Zeile; geschriebene Journalzeilen nie ändern; Kunden sehen nichts.

Erwartungswerte (v2): 30000→3600, 50000→6000, 50001→6000, 68961→7896, 76041→8604, 80000→9000, 100000→11000, 100001→11000, 150000→14500, 300000→25000, 6900→828. v1: 68961→10344, 7080→1062, 6900→1035 (je half-up). Nachtrag: Buchung 68961 → Prov 7896, Auszahlung 61065; Nachtrag +7080 (Gesamt 76041) → Prov 708 (8604−7896), Auszahlung 6372.

## Ablaufübersicht (Soll)
| Ablauf | Version kommt aus | Gebühr berechnet | DB-Prüfung |
|---|---|---|---|
| Festpreis annehmen (partner_accept) | `private.current_fee_schedule()` zur Annahme (Basisfunktion liefert `fee_tiers`+Version) | Edge: splitFee(total, Stufen) | partner_accept: Version = geltende (sonst rate_mismatch, Edge lädt einmal neu, dann 409); Guard booking: fee_cents = `private.fee_cents(Version,total)` exakt |
| Angebot abgeben (send_offer) | geltende Version → `partner_offers.fee_schedule_version` | – | – |
| Angebot bestätigen (confirm_offer) | Version des Angebots (`confirm_offer_basis` liefert sie) | Edge | confirm_offer: übergebene Version = Version des Angebots; Guard booking wie oben |
| Nachtrag annehmen (decide_change) | Version der booking-Zeile | Edge: splitChange(neuer Gesamtpreis, Stufen, prior) | Guard change: kumulierte Gebühr = fee_cents(V, Gesamtpreis der Revision) exakt |
| Storno ohne Pauschale (cancel_by_customer/partner, cancel_reverse_all) | negiert jede Zeile exakt | – | Guard cancellation: alle Beträge = −orig, gleiche Version |
| Stornogebühr/Pauschale (cancellation_fee) | Version der booking-Zeile | Edge: splitFee(Basis allein, Stufen) | Guard: fee_cents = fee_cents(V, Basis) exakt |
| admin-correct | wie Storno (correction = Negation; Gebühr auf Pauschale mit booking-Version) | | Guard wie oben |

## Entwurfsentscheidungen, zu denen ich dein Urteil will
1. Spalten `commission_entries.fee_rate` und `fee_rate_version` werden GELÖSCHT (Version 1 in `fee_schedules` hält die 15 %; `fee_schedule_version int not null default 1` beim Hinzufügen, dann Vorgabe entfernt; kein Zeilen-UPDATE, der append_only-Trigger feuert nicht). Alternative wäre „behalten, nullable“. Spricht gegen das Löschen etwas (Journal = Beweis, „nie ändern“)?
2. Gleiches für `partner_offers.fee_schedule_version` (Bestand = 1, auch offene Angebote).
3. Guard prüft die Gebühr jetzt EXAKT gegen die Staffel (vorher 0,5-Cent-Toleranz am Float-Satz). Netto weiter mit 0,5-Toleranz. Ist exakt hier riskant (z. B. Nachtrag mit prior aus alten v1-Zeilen, die nach v2 gebucht werden – kann nicht passieren, da Version je Auftrag fix)?
4. `partner_accept` bekommt eine neue Prüfung „übergebene Version = geltende“ (früher hat das der Guard über current_fee_rates geleistet), `confirm_offer` prüft gegen die Angebotsversion. Der Guard prüft für booking nur noch USt.-Satz + Gebühr = Staffel(Version). Lücke? (Ein service_role-Aufruf von commission_book ist ohnehin nicht möglich: kein Grant.)
5. `platform_settings`-Schlüssel `fee_rate` (Version 1, 0,15) bleibt bestehen, ohne Wirkung, und bleibt für Partnerkonten lesbar (Policy aus 0027). Soll die Migration das bereinigen oder ist das eine spätere Aufräumaufgabe (OPEN_ISSUES)? Die View `current_fee_rates` wird gelöscht.
6. `fee_schedules`/`fee_schedule_tiers`: nur Migration/service_role schreiben (Grant insert an service_role für Tests/Betrieb), append-only-Trigger, Lesen für Partner-Mitglieder (jeder Status) und admin; Kunden nichts. Ausreichend? Die Version 2 hat `valid_from` = Wiener Einspieltag.
7. `payout_preview(p_total)` (authenticated, jedes Firmenmitglied, kein aal2) liefert Auszahlung zur geltenden Version. Angemessen oder aal2/aktiv verlangen? (Heute lesen alle Firmenkonten den Satz ohne aal2, Migration 0027.)
8. Der Typ `commission_row` ändert sich (Spalte `fee_schedule text` statt `fee_rate numeric`); `export_commissions`, `my_commissions`, `private.commission_rows` werden gelöscht und neu angelegt, Grants wie vorher.
9. Gibt es Funktionen/Policies/Views außerhalb der 14 neu definierten, die noch `commission_entries.fee_rate`, `fee_rate_version`, `private.current_fee()` (altes Rückgabeformat) oder `current_fee_rates` benutzen? Bitte selbst über `supabase/migrations/` prüfen (jeweils die NEUESTE Definition zählt).
10. Rundung: `private.fee_cents` rechnet Σ(Anteil×bp) in bigint, Ergebnis `(2*s+10000)/20000` (half-up, entspricht TS `Math.floor((2*total*bp+10000)/20000)` bei einer Stufe). Prüfe die Erwartungswerte oben von Hand gegen den SQL-Text.

## Bitte liefern
Antwort in `tmp/proof/s9p-1-fable-plan.md`: je Punkt 1–10 Entscheidung + Begründung; zusätzliche Funde (hoch/mittel/niedrig) mit Datei:Zeile der Migration; und als LETZTE Zeile entweder
`Freigabe SQL SHA-256 39196729feb72282b771d3441e4dcf79e6bac64af1483fde23e9e6fe7a45a690` (nur wenn genau dieser Text so bleiben kann; Auflagen ohne SQL-Änderung dürfen dabei stehen) oder `Keine Freigabe: <Grund>`.
