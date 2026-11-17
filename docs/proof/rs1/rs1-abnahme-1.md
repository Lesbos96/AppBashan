Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme 1 für Schritt rs1 (R2)

Datum: 2026-11-17
Umfang: Endstand laut Auftrag (Branch rs1, HEAD 852b1e9, Arbeitsbaum laut Startstatus sauber). Vollständig gelesen: `src/screens/partner/Anfragen.tsx`, `src/screens/partner/Absage.tsx`, `src/screens/partner/Auftraege.tsx`, `src/screens/auftrag/Angebote.tsx`, `src/screens/Auftrag.tsx`, `src/lib/jobs.ts`, `src/lib/partnerJobs.ts`, `src/lib/cancel.ts`, dazu `src/lib/partnerChange.ts`, `src/lib/partnerCancel.ts`, `src/lib/orders.ts`, `src/screens/auftrag/Bestaetigen.tsx`, `src/screens/auftrag/Absage.tsx`, `src/screens/auftrag/Zurueckziehen.tsx`, Migration 0072, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `docs/BEKS.md`, `tmp/proof/rs1-review.md`, `tmp/proof/rs1/runs.jsonl` (10 Zeilen), `tmp/proof/rs1/010-check.log`. Abschnittsweise: Migrationen 0038, 0047, 0058, 0059, 0062, 0065, `supabase/functions/_shared/change/handlers.ts:55-129`, `supabase/functions/_shared/pricing/transport.ts:50-99`, `docs/ENTSCHEIDUNGEN.md:203`, `docs/GOLIVE.md:66-67`, `docs/OFFEN.md:23, 83`, E2E-Specs an den Stellen zu Festangebot und „Alle Angebote ablehnen“.

SHA256-Zeilen: keine (laut Auftrag keine Pflichtdateien).

Ergebnis: nicht abgenommen. Die acht Dateien sind in Geld, Sicherheit und Aussage gegenüber dem Server in Ordnung; der Pflichtlauf `check` ist am committeten Endstand rot (H1). Der Fix liegt in einer Testdatei außerhalb der acht Dateien.

## Grenzen der Prüfung
- Ich habe nur Lese- und Suchwerkzeuge, keine Shell. `git diff main...rs1` konnte ich nicht ausführen; geprüft ist der Endstand der acht Dateien, nicht der Diff. Dass keine Datei der Pflichtmenge geändert wurde (Functions, `money*`, `scripts/sys`, `tests/support`, `.claude`, `package.json`), ist von mir nicht geprüft. Die Hauptsession muss `git diff main...rs1 --stat` selbst ausführen und das Ergebnis in der Bewertung nennen.
- Die Plan-Antwort der Fable-Planprüfung liegt nicht als Datei vor (unter `tmp/proof/` gibt es zu rs1 nur `rs1-review.md` und den Ordner der Läufe). Frage 4 habe ich gegen die Stichpunkte im Auftrag und gegen `docs/ENTSCHEIDUNGEN.md:203` (Nr. 196) geprüft.
- Serververhalten ist aus den Migrationen und Handlern hergeleitet, nicht gemessen. Für die Invariante „Festangebot gibt nie eine Pauschale“ gibt es keinen rls-Test (schon vermerkt, `docs/OFFEN.md:83`).
- Der Volllauf `e2e` (Log 011) lief beim Lesen noch (Kopf vorhanden, keine Exit-Zeile, kein Eintrag in `runs.jsonl`). Die Läufe 1 bis 9 liefen auf dem Vorgänger-Commit mit unsauberem Baum (gezielte Läufe); die Logs der roten Zwischenläufe 1, 4 und 8 habe ich nicht geöffnet, dieselben Ziele sind in den Läufen 3, 6 und 9 grün.

## Findings

### hoch
- H1 `tests/e2e/partner-anfragen.spec.ts:177` – Der Pflichtlauf `check` ist am committeten Endstand rot: `tmp/proof/rs1/runs.jsonl:10` (Lauf 10, Commit 852b1e9, Baum sauber, Exit 1), `tmp/proof/rs1/010-check.log:17-18` (ESLint `no-irregular-whitespace`, Zeile 177, Spalte 108: das geschützte Leerzeichen steht als rohes Zeichen im Regex-Literal), `:25` (Exit 1). Weil `check` die Teile mit „und dann“ verkettet (`010-check.log:10`), liefen Typecheck, Deno-Check und alle Unit-Tests auf dem Endstand gar nicht; darunter die Prüfung der Fehlertexte auf Gebühren- und Sperrwörter (`tests/unit/jobs-client.test.ts:207` ff.) und die Tests zu `cancel.ts`. Der Auftrag nennt diesen Lauf nicht. – Fix: in `tests/e2e/partner-anfragen.spec.ts:177` das rohe Zeichen durch die Escape-Folge für U+00A0 ersetzen (im Regex ` `), committen, `npm run t -- check` auf dem committeten Stand mit Exit 0, danach `e2e` auf demselben Stand. Am besten im selben Zug N4. Danach Abnahme 2.

### mittel
Keine.

### niedrig
- N1 `src/screens/partner/Absage.tsx:197` mit `src/screens/partner/Auftraege.tsx:265` – `fixedOffer` ist zweiwertig: fehlt die Preisgrundlage (zweite Abfrage `my_job_changes` beim ersten Laden gescheitert, `Auftraege.tsx:70-73`, oder Zeile unlesbar, `partnerChange.ts:67`), gilt der Auftrag als „kein Festangebot“. Die Maske sagt dann auch bei einem Festangebot „Weitervermittlung, wenn der Termin es zulässt“, obwohl der Server ein Festangebot nie weitervermittelt (0047:26). Der Kommentar an der Prop (`Absage.tsx:51`) nennt nur das Entfallen der Zeile, nicht diese Folge; der E2E-Fall „changes leer“ (`tests/e2e/partner-absage.spec.ts:66-71`) prüft die Zusage nicht. Entspricht dem Stand vor rs1 (bedingte Zusage), kein Geldweg. – Fix: dreiwertig übergeben (`change ? change.source === 'partner_offer' : undefined`) und die Zusage nur bei `fixedOffer === false` zeigen; E2E-Fall um „keine Weitervermittlung“ ergänzen.
- N2 `docs/ENTSCHEIDUNGEN.md:203` und `docs/GOLIVE.md:66` – beide verweisen für die Montage in Transport und Umzug auf „BEKS Frage 2“; in `docs/BEKS.md:24` ist das Frage 1, Frage 2 ist die rls-Laufzeit (`docs/BEKS.md:25`). `docs/OFFEN.md:23` nennt richtig Frage 1. Beks antwortet mit Nummern: ein „2 ja“ träfe die falsche Frage. – Fix: an beiden Stellen „BEKS Frage 1“.
- N3 `src/screens/partner/Absage.tsx:196` – Der Kommentar nennt `reissue_request` in 0046:399; die geltende Fassung steht in 0047:26 (`create or replace`, Bedingung gleich). – Fix: Verweis auf 0047:26.
- N4 `src/lib/partnerJobs.ts:179`, `src/screens/auftrag/Angebote.tsx:9` – Das geschützte Leerzeichen steht als rohes Zeichen im Quelltext (wie im Review, `tmp/proof/rs1-review.md:10`); dieselbe Schreibweise hat in der Testdatei H1 ausgelöst. Ein Formatter, der es normalisiert, macht das Ersetzen wirkungslos, und auf der Kundenseite prüft das kein Test. Die Formatierung liegt doppelt vor. – Fix: Escape-Folge schreiben, `until` in `Angebote.tsx` durch `viennaTime` ersetzen, in `auftrag-aktionen.spec.ts` die Kundenseite prüfen.

### Hinweise ohne Fix
- `reject_offers` lehnt alle zu dem Zeitpunkt gesendeten Angebote ab (0072:59), auch eines, das nach dem Laden der Liste dazukam und das der Kunde nie gesehen hat. Der Text „Alle Angebote werden abgelehnt, die Anfrage ist danach beendet“ bleibt wahr; es wird nichts gebucht.
- Der Satz auf der Karte endet mit „vor deiner Annahme“, obwohl die Firma bei einem Festangebot ein Angebot abgibt. Der Wortlaut ist von Beks so freigegeben (`docs/ENTSCHEIDUNGEN.md:203`, Punkt a) und vorläufig bis zur Rechtsprüfung (`docs/GOLIVE.md:67`).

## Prüffragen

1. **Widerspricht eine neue Anzeige dem Server?** Nein, mit der Einschränkung N1.
   - Karte, Angebot-Sheet, Bestätigung: Der Satz hängt nur an `l.totalCents === null` (`Anfragen.tsx:153, 202, 247, 275`). `null` kommt nur vom Server (`partnerJobs.ts:87`: ein ungültiger Wert verwirft die Zeile). Ein Listing ohne Gesamtpreis lässt sich nicht annehmen (0062:364, 370, 414), es bleibt nur das Festangebot; die Annahme durch den Kunden legt eine Revision mit Quelle `partner_offer` an (0062:497). Für diese Quelle verweigert der Server jeden Nachtrag (0058:63, `change/handlers.ts:113`), und ohne Nachtrag gibt es keine Pauschale (0065:13-17: nur mit abgelehntem oder abgelaufenem Nachtrag). Beide Hälften des Satzes stimmen. Alle Gründe für ein Angebot im Transport (Sonderware, Großer Lkw, Einpacken, Ausland, fehlende Route; `pricing/transport.ts:54-62, 81-82`) laufen über denselben Weg.
   - Absage-Maske: Der Satz steht nur im Zweig `preview.callOutCents === 0` und nur bei `fixedOffer` (`Absage.tsx:230-233`), `fixedOffer` kommt aus `my_job_changes.source` (`Auftraege.tsx:265`, 0058:30). Lieferte der Server wider Erwarten eine Pauschale über 0, erschiene der Satz nicht; die Anzeige folgt dem Betrag des Servers. Bei Festpreis mit Pauschale 0 erscheint er nicht (E2E `partner-absage.spec.ts:40`).
   - Weitervermittlung: Bei `fixedOffer` entfällt die Zusage (`Absage.tsx:197`), passend zu 0047:26. Ohne geladene Preisgrundlage bleibt die bedingte Zusage stehen (N1).
   - „Kontakt und Adresse sind danach für dich gesperrt“ stimmt für jede Absage ohne Pauschale (0065:21-29).
   - Kunde: „Du hast alle Angebote abgelehnt.“ als Endtext für `declined` (`cancel.ts:100`) stimmt: nur `reject_offers` setzt diesen Status an der Anfrage (0038:605, 0072:60; kein anderer Aufruf in den Migrationen).

2. **Hinweis auf Gebühr, Provision, 15 % in Kunden-Screens?** Nein. Suche über `src/screens` nach Gebühr, Provision, Plattform, Prozentsatz, Auszahlung und Journalnamen: Treffer nur in Firmen-Screens (`partner/Absage.tsx:239` Zeile „Gebühr“ bei der Pauschale, nach `geld.md` erlaubt; `partner/Anfragen.tsx`, `partner/Auftraege.tsx` „Du erhältst“) und in einem Kommentar (`auftrag/Absage.tsx:10`). `Angebote.tsx` zeigt nur Firma, Betrag, Frist; die Quelle `my_request_offers` liefert nur diese Spalten (0038:610-621). Die Fehlertexte, die ein Kunde über die Kunden-Zuordnung erreichen kann (`jobs.ts:77-92`), nennen keine Gebühr. Beträge laufen über `formatEuro`.

3. **`reject_offers`?** In Ordnung.
   - Aufruf: nur `{ p_request }` (`jobs.ts:112-114, 205`), kein Betrag, kein Akteur aus Anfragedaten; der Server nimmt den Akteur aus dem Token und prüft Eigentum und Status (0072:46-58). Keine neue Funktion, kein neues Recht.
   - Fehler: über die bestehende Zuordnung (`jobs.ts:98, 116`): `not_found` und `invalid_transition` werden „closed“ (Sheet zu, Hinweis, neu laden: `Bestaetigen.tsx:28-30`, `Angebote.tsx:48`), alles Unbekannte „unavailable“ (wiederholbar). Nach verlorener Antwort liefert die Wiederholung Erfolg ohne zweite Wirkung (0072:54-57).
   - Texte: „Alle Angebote werden abgelehnt, die Anfrage ist danach beendet. Das lässt sich nicht rückgängig machen.“ und „Du hast alle Angebote abgelehnt. Die Anfrage ist beendet.“ passen: gesendete Angebote werden `rejected`, die Anfrage `declined` (0072:59-60), `declined` ist Endzustand in der Anzeige (`orders.ts:12`, `cancel.ts:100`); danach verschwinden Angebote und „Zurückziehen“ (`Auftrag.tsx:110-111`).
   - Der Knopf erscheint nur mit mindestens einem gültigen Angebot (`Angebote.tsx:37`), gesendet wird erst nach der Bestätigung, Doppelklick sperrt `Bestaetigen` (`Bestaetigen.tsx:20, 52`).

4. **Abweichung vom Plan?** In den acht Dateien keine.
   - Auslöser `totalCents === null`: erfüllt (`Anfragen.tsx:153, 202`).
   - Absage-Maske bei Quelle `partner_offer` und Pauschale 0: erfüllt (`Auftraege.tsx:265`, `Absage.tsx:230-233`).
   - `cancel.ts`-Text: `cancel.ts:100`, deckt sich mit Hinweis und Sheet.
   - GOLIVE-Vermerk: `docs/GOLIVE.md:66` (Punkt 32) und `:67` (Punkt 33) nennen die drei Stellen und die Vorläufigkeit; der Verweis auf die BEKS-Nummer ist falsch (N2).
   - BEKS-Frage zur Montage: vorhanden (`docs/BEKS.md:24`), sachlich richtig (Montage in Transport und Umzug ist Festpreis mit möglichem Nachtrag und Pauschale: `pricing/transport.ts:96`, 0065:13-17).

## Stichproben
- `src/screens/partner/Anfragen.tsx:35, 153, 247, 275` – ein Satz, drei Stellen, alle hinter `totalCents === null`. In Ordnung.
- `src/screens/partner/Anfragen.tsx:102-113, 158` – „Du erhältst“ nur vom Server (`payout_preview`), ohne Wert keine Annahme. Unverändert in Ordnung.
- `src/lib/partnerJobs.ts:87, 100` – `total_cents` nur `null` oder positiv, sonst entfällt die Zeile. In Ordnung.
- `src/screens/partner/Absage.tsx:197, 230-233, 266` – Zusage und Satz wie beschrieben; N1 für den Fall ohne Preisgrundlage.
- `src/screens/partner/Auftraege.tsx:265` – `fixedOffer` aus der Serverquelle, nicht aus der Leistungsart. In Ordnung.
- `src/screens/auftrag/Angebote.tsx:37-51` – Knopf, Sheet, Erfolgstext; Fehlertext wird durchgereicht. In Ordnung.
- `src/lib/jobs.ts:112-121, 204-205` – nur `p_request`, Fehler über `asKind`. In Ordnung.
- `src/lib/cancel.ts:95-102` – Endtexte; `declined` passt zum Server. In Ordnung.
- `src/screens/Auftrag.tsx:72-76, 110-111` – Hinweis mit Fokus, Angebote nur bei `offered`. In Ordnung.
- `supabase/migrations/20261117111227_0072_replay_ablehnen.sql:42-62` – Eigentum, Sperre, Replay, Statuswechsel. In Ordnung.
- `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:10-18` – Pauschale nur mit Grund „vor Ort anders“, ab Termin und mit abgelehntem oder abgelaufenem Nachtrag. In Ordnung.
- `supabase/migrations/20261112110000_0058_my_job_changes.sql:30, 63-64` – Quelle der gültigen Revision; Festangebot ohne Nachtrag. In Ordnung.
- `supabase/migrations/20261109190000_0047_s9h2_abnahme.sql:26` – keine Weitervermittlung bei Festangebot. In Ordnung; Kommentar im Code zeigt auf die Vorfassung (N3).
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:364, 370, 497, 766, 813-817` – Annahme nur mit Festpreis, Quelle `partner_offer` bei Bestätigung, Pauschale nur bei Berechtigung, Weitervermittlung nur ohne Pauschale. In Ordnung.
- `supabase/functions/_shared/change/handlers.ts:113` – `change_not_allowed` bei Festangebot schon in der Vorschau. In Ordnung.
- `supabase/migrations/20261109100000_0038_partner_offers.sql:610-621` – Kundenlesung der Angebote ohne Gebührenspalte. In Ordnung.
- `tests/e2e/partner-absage.spec.ts:55-71`, `tests/e2e/partner-anfragen.spec.ts:136-153`, `tests/e2e/auftrag-aktionen.spec.ts:194-235` – decken Satz, fehlende Zusage, Aufrufkörper, Fokus und `invalid_transition`; Lücke siehe N1.
- `tmp/proof/rs1/runs.jsonl:10`, `tmp/proof/rs1/010-check.log:17-25` – `check` rot am Endstand (H1).
- `docs/BEKS.md:24-25`, `docs/ENTSCHEIDUNGEN.md:203`, `docs/GOLIVE.md:66`, `docs/OFFEN.md:23` – Nummer der BEKS-Frage uneinheitlich (N2).

Offene Findings hoch: 1
