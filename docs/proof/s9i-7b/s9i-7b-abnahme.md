Modell: claude-fable-5-2

# Abnahme s9i-7b (Geld, Rechte, Schema)

- Datum: 2026-11-12
- Branch `s9i-7b`, Stand laut Auftrag HEAD 6c99166 (Commits ab 3f23e25)
- Geprüfter Umfang (vollständig gelesen): `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql`, `supabase/migrations/20261109200000_0048_partner_cancel_rules.sql`, `supabase/functions/_shared/cancel/partner.ts`, `supabase/functions/_shared/cancel/db.ts`, `supabase/functions/cancel-partner/index.ts`, `tests/rls/cancellation-partner-preview.test.ts`, `tests/rls/partner-functions-live.test.ts`, `tests/unit/cancel-partner-handler.test.ts`, `tmp/proof/s9i-7b-plan.md`, `tmp/proof/s9i-7b-fable-plan.md`
- In Ausschnitten nachgeschlagen: 0001, 0018, 0040, 0041, 0046, 0049, 0058, `tests/rls/rls.test.ts:437-507`, `tests/rls/cancellation-partner.test.ts:60-299`, `_shared/jobs/handlers.ts`, `_shared/jobs/db.ts`, `_shared/database.types.ts:1608-1644`, Logs `tmp/proof/s9i-7b-*.log`
- Methode: nur Lesen. Ich habe keinen Test, kein git und keinen Deploy ausgeführt; Aussagen zu Läufen stammen aus den Logdateien.
- Das eingebaute `advisor`-Werkzeug ohne Parameter steht in meiner Werkzeugliste. Ich habe es nach CLAUDE.md nicht benutzt.

## Entscheidung

**Abgenommen mit Auflagen.** Kein Fund „hoch“. Migration 0059 und der Handler setzen M1, M2, N1 und N2 der Planprüfung um. Der Rumpf von `cancel_by_partner` stimmt ab der Betragsprüfung wörtlich mit 0048:41-73 überein. Offen sind zwei mittlere Funde zu Nachweis und Testabdeckung (M1, M2) und acht niedrige.

## Findings

### hoch

Keine.

### mittel

- **M1** `tmp/proof/s9i-7b-gruen-rls-3.log:1`, `tmp/proof/s9i-7b-live-4.log:1` – Die beiden Grün-Läufe liefen auf 33c3e59 mit unsauberem Arbeitsbaum („nein“ bzw. „nein (Test geändert)“), nicht auf dem Endstand. Ein Grün-Log der Unit-Tests fehlt ganz (es gibt nur `s9i-7b-rot-unit.log`, EXIT=1). `gruen-rls-3` deckt nur eine Datei ab (3 Tests); `cancellation-partner.test.ts` und `rls.test.ts` liefen zuletzt in `gruen-rls-1` (EXIT=1, 44 von 45). – Fix: vor dem Abschluss-Commit auf dem committeten Endstand `check` und `test:rls` (voll, mit Live-Datei) laufen lassen, je mit EXIT=0 im Log. Zusätzlich prüfen, dass `supabase/functions/` seit dem Deploy-Stand 33c3e59 unverändert ist (`git diff 33c3e59 HEAD -- supabase/functions`); sonst `cancel-partner` neu deployen und Version plus Hash neu ablegen.
- **M2** `tests/rls/partner-functions-live.test.ts:108-118` – Der Live-Test führt den Geldpfad nie aus. Vorschau und Betragsabgleich laufen nur gegen einen Auftrag ohne Nachtrag (Grundlage 0 gegen gezeigte 6900). Damit ist nicht belegt, dass die deployte Function eine Pauschale größer 0 zeigt, mit `splitFee` aufteilt und über `db.ts:25-40` bucht. Vor s9i-7b gab es dafür keinen Live-Test (S9f-8). – Fix: ein weiterer Auftrag mit Beleg und abgelehntem Nachtrag (als Fixture per `propose_change` und `decide_change`). Messen: Vorschau liefert exakt `{ callOutCents: 6900, payoutCents: <splitFee> }`; echter Aufruf mit `photoIds` und `shownCallOutCents: 6900` liefert 200; danach genau eine Zeile `cancellation_fee` mit `total_cents`, `fee_cents`, `payout_cents` wie `splitFee`, keine Folgeanfrage, Outbox `partner_cancelled_fee` = 1; `my_cancel_info` über PostgREST mit dem Kunden-JWT = 6900, mit `cust2` Fehler. Wenn das in dieser Session nicht mehr passt: Eintrag in OPEN_ISSUES mit Begründung und Erledigung spätestens in 7b2, bevor die Oberfläche den Pfad nutzt.

### niedrig

- **N1** `tests/rls/cancellation-partner-preview.test.ts:104` – Die NULL-Sicherheit aus Planfund M2 ist nicht direkt gemessen. „Grund fehlt“ scheitert schon in `partner_cancel_check` (0059:27), `call_out_eligible` und `partner_cancel_fee` erreichen NULL nie. – Fix: zwei Schritte als Eigentümer: `private.call_out_eligible(E1, null)` ergibt `false` (nicht NULL), `private.partner_cancel_fee(Firma a, E1, null, Belege)` wirft `call_out_not_allowed`.
- **N2** `tests/rls/cancellation-partner-preview.test.ts:190` – „nur bei cancelled_by_partner“ ist nur gegen `accepted` gemessen. Der aussagekräftige Fall ist ein Kundenstorno mit Gebührenzeile (`cancelled_by_customer` und `cancellation_fee` vorhanden). – Fix: ein Auftrag mit spätem Kundenstorno, `my_cancel_info` muss `not_found` liefern.
- **N3** `tests/rls/partner-functions-live.test.ts:129` – `followups` wird nur mit „höchstens 1“ geprüft. Bei Termin in 14 Tagen und Grundlage 0 muss genau eine Folgeanfrage entstehen (0046:398-400); der Test bemerkt eine fehlende Weitervermittlung nicht. – Fix: `toBe(1)` und Outbox je Art genau 1.
- **N4** `tmp/proof/s9i-7b-lockerung-1.log:1-6` – Die Lockerungsprobe misst die Wirkung richtig (Ist-Wert 6900 statt 0), das Log enthält aber keine EXIT-Zeile (CLAUDE.md, Arbeits-Loop). – Fix: Probe neu laufen lassen und als neue Datei mit EXIT ablegen; die alte Datei nicht ändern.
- **N5** `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:70` – Die Grundlage ruft `call_out_base` bei jeder Berechtigung auf, auch beim echten Aufruf ohne Belege. Fehlen im Snapshot die Stornobedingungen, endet ein kostenloser Storno mit Grund `scope_impossible` als 500 (`terms_missing`). Vor 0059 traf das jeden Storno, es ist also enger geworden. – Fix: keiner in 0059; als Hinweis nach OPEN_ISSUES (betrifft nur Altdaten ohne `terms`).
- **N6** `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:65` – Auch die Storno-Vorschau sperrt den Auftrag kurz (`change_gate`, `for update`, 0040:315), `cancel-partner` hat kein Rate-Limit. – Fix: OPEN_ISSUES S9i7-4 um `cancel-partner` ergänzen, nichts bauen.
- **N7** `docs/PROGRESS.md:6-10` – Die Entscheidung zu Frage 3 der Planprüfung (erster Kundenzugriff auf einen Journalwert über `my_cancel_info`) steht noch in keiner Doku-Datei (Suche in `docs/*.md` ohne Treffer). – Fix: im PROGRESS-Eintrag zu s9i-7b und als Entscheidung in AUTOPILOT festhalten.
- **N8** `tests/rls/cancellation-partner-preview.test.ts:120-140` – Aus der Testliste der Planprüfung fehlen: Grundlage bei Firma in `payment_hold` (das Tor ist geteilt und für `propose_change` in `tests/rls/change-orders.test.ts:151-157` belegt), echter Storno mit Pauschale im Fall „angenommen, dann abgelehnt“ (E5: Gebührenzeile auf der Nachtrags-Revision, Journalsummen), einzelner zurückgezogener Nachtrag ohne Vorgänger (erwartet 0). – Fix: drei Schritte ergänzen.

## Prüffragen

### 1. Migration 0059

- **Rumpf von `cancel_by_partner`:** 0059:99-131 ist Zeile für Zeile gleich 0048:41-73 (Betragsprüfung, Buchungszeile, Satzvergleich, Statuswechsel, Zuordnung, Gegenbuchung, Gebührenzeile, Audit, Weitervermittlung, drei Outbox-Zweige, Rückgabe). Ersetzt sind nur die Prüfungen 0048:25-40 durch `partner_cancel_check` (0059:97) und `partner_cancel_fee` (0059:98). Einzige weitere Abweichung: `base bigint` ohne Startwert 0 (0059:92). Das ist unschädlich, weil `partner_cancel_fee` nie NULL liefert (0 bei fehlenden Belegen, sonst `call_out_base`, das bei fehlendem Betrag `terms_missing` wirft, 0046:370-375).
- **Prüfreihenfolge:** Tor, Meldung, Grund, Zeitgrenze, Berechtigung, Belege, Betrag, Satz. Wie 0048:7. Die Grundlage nutzt Tor, Meldung, Grund, Zeitgrenze in derselben Reihenfolge (0059:65-66).
- **Attribute:** alle sechs Funktionen `security definer set search_path = ''`, alle Verweise schemaqualifiziert. `stable` nur dort, wo nichts gesperrt oder geschrieben wird; die Grundlage ist zu Recht nicht `stable` (Sperre im Tor).
- **Rechte:** `private.*` nur `revoke all from public` (0059:16, 32, 51); im Schema `private` gibt es keine Standardrechte für API-Rollen, `service_role` hat dort keine Nutzung (0001:13-14), der Listentest in `rls.test.ts:451-484` schlägt bei jeder offenen `private`-Funktion an. `cancel_by_partner_basis` und `cancel_by_partner` nur `service_role` (0059:77-78, 135-138; `rls.test.ts:497`). `my_cancel_info` nur `authenticated`, `anon` entzogen (0059:158-159; `rls.test.ts:457`). `service_role` behält dort das Standardrecht, erhält ohne `auth.uid()` aber `not_found`.
- **NULL-Sicherheit:** `is not distinct from 'scope_impossible'` (0059:10), `coalesce(..., false)` (0059:11-13), `is not true` (0059:40) und `is true` (0059:70). Umgesetzt wie Planfund M2.
- **Berechtigung der Pauschale:** eine Abfrage, höchstes `n` mit Status ungleich `withdrawn`, nur `declined` oder `expired` (0059:11-13). `n` ist je Anfrage eindeutig (0018:23), Nachträge haben immer einen Status (0040:19). Ein offener Nachtrag hat das höchste `n` und sperrt. Ausgewertet wird unter der Auftragssperre des Tors; `decide_change`, `withdraw_change` und `expire_changes` nehmen dieselbe Sperre (0041:71, 138, 162). Umgesetzt wie Planfund M1.
- **`my_cancel_info`:** nur der Kunde der Anfrage und nur Status `cancelled_by_partner`, sonst einheitlich `not_found` (0059:148-150). Rückgabe ein `bigint`: Summe `total_cents` der Zeile `cancellation_fee` und ihrer Gegenbuchungen ohne Filter auf die Art (0059:151-154). Keine Gebühr, kein Satz, keine Journalzeile, keine Folgeanfrage. Nach `negate_fee` (0049:125-133) ergibt die Summe 0. Umgesetzt wie Planfund N1.

### 2. Edge Function

- **Eingaberegeln:** Schlüsselliste geschlossen (`partner.ts:57`). `preview` nur fehlend oder boolean (`:49`). Vorschau ohne `photoIds` und ohne `shownCallOutCents` (`:51`). Echt: `photoIds` fehlend oder höchstens 8 UUIDs (`:52`), `shownCallOutCents` sichere Ganzzahl ab 0 (`:53`), Belege und Betrag größer 0 nur gemeinsam (`:54`, Planfund N2). Sonst 400 vor jedem Datenbankzugriff.
- **Vergleich in jeder Schleife:** nach jedem `basis` (`:68-70`), auch im zweiten Durchlauf nach einem Satz- oder Betragscode. Abweichung ergibt 409 `amount_changed` (`:86`), `cancel` wird dann nicht aufgerufen.
- **Vorschau-Antwort:** exakt `{ callOutCents, payoutCents }` (`:64`), keine Gebührenzeile, kein Satz. Die echte Antwort ist `{ status, callOutCents }` (`:73`).
- **Geld:** Aufteilung über `splitFee` mit dem Satz der Buchungszeile aus der Grundlage (`:31`), kein fester Satz im Code, Integer-Cent. `p_actor` und `p_aal` stammen aus dem geprüften Token (`:63`, `:68`, `:72`; `db.ts:11`, `:26-27`).

### 3. Tests

- **Wirkung gemessen:** ja. RLS: Ist-Werte der Grundlage je Fall, Status und Journalzahl nach abgelehnten Aufrufen (`:113`, `:151`), Schnappschuss aus Status, Journal, Outbox, Audit und Revisionen vor und nach der Vorschau (`:165-173`), Ergebnistyp und Beträge von `my_cancel_info` (`:200-210`). Unit: exakte Antwortkörper, Zahl der `basis`- und `cancel`-Aufrufe (`:69-70`, `:113-114`, `:130`). Live: Zustand vor und nach abgelehnten Aufrufen, eine Gegenbuchung und ein Audit-Eintrag nach drei Aufrufen (`:127-128`).
- **Matrix der Planprüfung:** alle neun Fälle vorhanden (E0 bis E7 und „anderer Grund“).
- **Fehlende Fälle:** siehe M2, N1, N2, N3, N8.

### Bezug zur Planprüfung

| Fund | Stand | Beleg |
|---|---|---|
| M1 (Sortierung nach `n`) | umgesetzt | 0059:11-13; Test `:109-111`, `:143-148` |
| M2 (NULL-Sicherheit) | umgesetzt, nicht direkt getestet (N1) | 0059:10, :40, :70 |
| N1 (`my_cancel_info` nur `bigint`, kein Art-Filter) | umgesetzt | 0059:142, :151-154; Test `:207` |
| N2 (Belege und Betrag gemeinsam) | umgesetzt | `partner.ts:54`; Unit `:117-132` |
| Frage 7 (keine Gebührenzeile in der Vorschau) | umgesetzt | `partner.ts:64`; Unit `:68` |
| Frage 6 (Rumpf ausgeschrieben, Testlisten, Typen) | umgesetzt | 0059:95-131; `rls.test.ts:457`, `:497`; `database.types.ts:1627-1644` |
| Deploy aus sauberem Stand mit Version und Hash | umgesetzt für 33c3e59, gegen HEAD offen (M1) | `s9i-7b-deploy-cancel-partner-1.log:1-2`, `:10` |
| M3, Frage 4 | nicht Teil dieser Session | OPEN_ISSUES S9i7-11, S9i7-12 |

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| 0048:41-73 gegen 0059:99-131 | wörtlich gleich |
| 0048:25-27 gegen 0059:26-28 | Meldung, Grund, Zeitgrenze wörtlich gleich |
| 0048:33-37 gegen 0059:41-45 | Belegprüfung gleich, `pid` heißt `p_partner` |
| 0040:303-325 | Tor: aal2, Mitglied, Auftrag `for update`, Firma `active` oder `payment_hold`, aktive Zuordnung, Status |
| 0040:19-21 | Nachtrag hat immer einen Status aus fünf Werten |
| 0040:221-240 | Gegenbuchung einer `cancellation_fee` als `cancellation` oder `correction` zulässig, exakte Negation |
| 0040:284-295 | Gebührenzeile: Betrag größer 0, höchstens Revisionspreis, alle Vorzeilen gegengebucht, Rundungsgrenze 0,5 Cent |
| 0018:23 | `(request_id, n)` eindeutig |
| 0041:183-199 | offene Nachträge laufen erst beim Statuswechsel ab, also nach der Berechtigungsprüfung |
| 0041:71, :138, :162 | Entscheidung, Rückzug und Ablauf sperren den Auftrag |
| 0046:362-377 | `call_out_base`: ganzzahlig, nicht negativ, höchstens Gesamtpreis, sonst `terms_missing` |
| 0046:272-288 | Gegenbuchung nur für `booking` und `change` |
| 0049:125-133 | `negate_fee` bucht `correction` auf die lebende Gebührenzeile |
| 0049:138-167 | Admin-Storno kann Status `cancelled_by_partner` mit Gebührenzeile setzen; `my_cancel_info` zeigt auch diese Summe richtig |
| 0001:13-14 | Schema `private`: Nutzung nur `authenticated` |
| `rls.test.ts:444-447` | Eigentümer und leerer `search_path` für jede Definer-Funktion geprüft |
| `jobs/handlers.ts:34-48` | Codes `amount_changed`, `under_review`, `call_out_not_allowed`, `too_late_for_reason`, `reason_required`, `receipt_required` haben HTTP-Status |
| `jobs/handlers.ts:53-58` | 401 ohne gültiges Token, 403 `mfa_required` ohne aal2 |
| `jobs/db.ts:15-24` | aal aus der Nutzlast des von Auth geprüften Tokens |
| `cancel-partner/index.ts:14-17` | Secret nur aus der Umgebung der Function, nichts davon im Log |
| `src/` | kein Aufruf von `cancel-partner` oder `my_cancel_info` (Oberfläche folgt in 7b2) |
| `s9i-7b-lockerung-1.log:4` | Ist-Wert 6900 statt 0: misst die Wirkung der gelockerten Regel |
| `s9i-7b-rot-rls.log`, `-rot-unit.log` | EXIT=1 (5 von 6 bzw. 9 von 11 rot) |
| `s9i-7b-gruen-rls-3.log`, `-live-4.log` | EXIT=0 (3 bzw. 10 Tests), Arbeitsbaum nicht sauber |

Offene Findings hoch: 0
