# s9i-7a: Antworten des Beraters (Fable 5.2) zur Planprüfung, Deploy-Stand der Change-Functions, Abweichung vom Auftrag

Nachtrag vom 2026-11-12 zu `docs/proof/s9i-7/`. Nur Doku, kein Code, keine Tests. Die Datei ist neu angelegt; bestehende Nachweise bleiben unverändert.

## 1. Planprüfung durch den Berater (Wortlaut)

- **Quelle:** Transcript der Session `06c6aa37-a5d2-4b3d-ab29-56c49033ab92` (`C:\Users\gesch\.claude\projects\C--Users-gesch-Music-MoveNow\06c6aa37-a5d2-4b3d-ab29-56c49033ab92.jsonl`), Zeile 294 (zweimal wiederholt in den Zeilen 297 und 302, derselbe Text).
- **Zeitpunkt:** 2026-11-12, 04:46:18 UTC (05:46 Wiener Zeit). Subagent „Planprüfung s9i-7a“, Typ `advisor`, Modell laut Antwort `claude-fable-5-2`, 32 Werkzeugaufrufe, 116 741 Tokens, 390,9 s.
- **Fragen:** Plan und Fragen stehen in `docs/proof/s9i-7/s9i-7-plan.md` (Fragen 1 bis 4). Frage 4 lautete: „Schnitt: 7a vollständig in einer Session, oder 7a in zwei Teile (Nachtrag, Storno)?“
- **Antwort:** In dieser Datei gibt es nur diese eine Antwort der Planprüfung. Die Abnahme steht in `docs/proof/s9i-7/s9i-7-abnahme.md`; das ist ein anderer Bericht.
- **Wortlaut:** Der Text unten ist die Antwort aus dem Transcript. Verändert habe ich nur die Kodierung der JSON-Datei: `\n` ist ein Zeilenumbruch, `\\` ist `\` (z. B. `cancel\partner.ts`), `&gt;` ist `>`. Der Berater schrieb die Pfade selbst ohne führendes `supabase/`; „alle Stellen“ liegen unter `supabase/migrations/` bzw. `supabase/functions/_shared/`. Kürzel wie `0046` und `0048` sind die Migrationen `20261109180000_0046_cancel_by_partner.sql` und `20261109200000_0048_partner_cancel_rules.sql`.

````text
Modell: claude-fable-5-2

**Entscheidung: ja mit Änderungen.** Kein Fund „hoch“. 0058 gibt nichts Neues preis; die Storno-Vorschau ist so aber nicht tragfähig, und die Beleg-Obergrenze braucht einen geänderten Ablauf. Alle Stellen unter `C:\Users\gesch\Music\MoveNow\supabase\` (`migrations\` bzw. `functions\_shared\`).

1. **Frage 1 (0058): freigegeben.** `inputs` ist dieselbe Kopie, die die Firma über `job_listings` schon im gleichen Fenster liest (0046:250-251, 0030:121, 0030:129). Der Entwurf liefert weder Snapshot, Fotos, `decided_by` noch Gebühr; `proposed_by = a.partner_id` plus `assignment_access` reicht, Attribute und Grants wie 0057.
2. **Frage 2, Nachtrag: Vorschau ja.** Rückzug ersetzt sie nicht, weil das Anlegen sofort die Kundenmail auslöst und den einzigen offenen Platz belegt (0041:23, 0041:45). Der Wettlauf ist durch `revision_changed` zu (0041:20), der Vergleich von `shownTotalCents` in der Edge Function genügt.
3. **Frage 2, Storno: Vorschau nur mit Migration.** Siehe M1.
4. **Frage 3:** Die Wiederholung ist sicher. `changes` sind absolute Werte, ein zweiter Aufruf endet `change_open`, nach Annahme `change_not_increasing`. Ein zweites Storno endet immer `not_found` (0040:319 vor 0040:322). Rundung ist in Ordnung, die App rechnet nichts.
5. **Frage 4: teilen.** Erst Nachtrag mit 0058, dann Storno mit 0059; die Pauschale hängt an den Nachtrag-Zuständen, und beide Hälften tragen Geldlogik.

**Funde**
- **M1 (mittel)** `20261109180000_0046_cancel_by_partner.sql:436-452` – Die Grundlage prüft nur das Gate; `under_review`, `too_late_for_reason`, `call_out_not_allowed` und Belege stehen nur in `20261109200000_0048_partner_cancel_rules.sql:25-38`. Die Vorschau zeigte also eine Pauschale, die der Server danach ablehnt. – Fix: eine private Prüffunktion für Grundlage und `cancel_by_partner`; die Grundlage bekommt Grund und „mit Pauschale“ (ohne Foto-IDs) und liefert `callOutCents` und `callOutEligible`.
- **M2 (mittel)** `cancel\partner.ts:49-55` – `shownCallOutCents` muss in der Schleife nach jedem `basis` verglichen werden (wie `change\handlers.ts:176`), sonst bucht Versuch 2 einen unbestätigten Betrag.
- **M3 (mittel)** `20261108180000_0035_job_photos.sql:298` – Höchstens 8 Belege je Auftrag auf Lebenszeit, ohne Löschweg, und der Kunde sieht jeden sofort (`20261108200000_0037_s9d_abnahme.sql:108-111`). – Fix: Vorschau ohne `photoIds` (`change\handlers.ts:94`), Upload erst nach gezeigtem Betrag; das Sheet listet vorhandene Belege über `job-photo` und verwendet die IDs wieder (keine Einmal-Prüfung in 0041:26-31).
- **M4 (mittel)** 0048:30 – Die Pauschale gilt bei irgendeinem `declined|expired`-Nachtrag, 0058 liefert nur den letzten. Die Berechtigung darf die App nicht daraus ableiten, sie kommt aus der Storno-Vorschau (M1).
- **N1 (niedrig)** `20261109120000_0040_change_orders.sql:330-341` – `change_not_allowed`, `not_fixed_price` und `change_open` prüft erst `propose_change`. – Fix: in 0058 per `create or replace` in `propose_change_basis` vorziehen.
- **N2 (niedrig)** `change\handlers.ts:91`, `cancel\partner.ts:43` – Schlüssellisten erweitern: `preview` nur boolean, `shown*` beim echten Aufruf Pflicht und mit `preview` verboten, sichere Ganzzahl (Betrag > 0, Pauschale ≥ 0).
- **N3 (niedrig)** `pricing\clearance.ts:57-60` – Entrümpelung hat fast immer eine Spanne und läuft dann über das Festangebot, dort gibt es keinen Nachtrag. Felder für Entrümpelung streichen; bei `source = 'partner_offer'` Knopf weg und Hinweis.

**Zwei Fakten im Plan sind falsch:** `suspended` zieht einen offenen Nachtrag nicht selbst zurück, das passiert erst bei Zustimmung des Kunden (0041:89-97); die Firma kann ihn aber selbst zurückziehen (0041:135). Und `invalid_transition` kommt bei wiederholtem Storno nie (siehe Frage 3).

**Testen:** Vorschau schreibt nichts (keine Revision, Outbox- oder Audit-Zeile); `amount_changed` und `revision_changed` führen zu Neuladen ohne automatisches Neusenden; 9. Beleg (`receipt_limit`) und Wiederverwendung; Pauschale nach `declined` → neuer Nachtrag → `withdrawn`; Vorschau bei `under_review` und nach `termin_at`; 0058 mit Fremdfirma, aal1, `suspended` und abgelaufenem Fenster. In `docs\ROADMAP.md` fand ich keinen eigenen Eintrag s9i-7 (nur Z. 105), bitte den Umfang dort bestätigen.
````

### Was aus den Funden wurde (Stand 908aefd)
| Fund | Stand |
|---|---|
| M1, M2, M4 (Storno) | nicht in 7a gebaut; für s9i-7b mit Migration 0059 vorgemerkt: `docs/AUTOPILOT.md` Entscheidung 88, `docs/OPEN_ISSUES.md` S9i7-8 |
| M3 (Belege) | in 7a umgesetzt: Vorschau ohne `photoIds`, Upload erst nach gezeigtem Betrag, vorhandene Belege werden wiederverwendet (`src/screens/partner/Nachtrag.tsx`, `tests/e2e/partner-nachtrag.spec.ts`) |
| N1, N2, N3 | in 7a umgesetzt (`propose_change_basis` in 0058, Schlüsselliste und `preview` in `handlers.ts`, keine Felder für Entrümpelung); Entscheidungen 87 bis 93 in `docs/AUTOPILOT.md` |
| Fakten zu `suspended` und `invalid_transition` | Der Plan (`s9i-7-plan.md`, Zeilen zu 3b und 3d) war in diesen zwei Punkten falsch. Die Datei bleibt unverändert (Nachweisdatei); die Korrektur steht nur hier und in dieser Antwort, nicht in `docs/AUTOPILOT.md` |
| ROADMAP | Der Berater fand dort keinen Eintrag s9i-7 und bat um Bestätigung des Umfangs. `docs/ROADMAP.md` enthält auch jetzt keinen Eintrag „s9i-7“ (Suche ohne Treffer); eine Bestätigung des Umfangs gibt es in den Dokumenten nicht |

## 2. Deploy von `change-propose` auf Dev

- **Befehl** (Transcript Zeile 564): `cd /c/Users/gesch/Music/MoveNow && npx dotenv -e .env.local -- supabase functions deploy change-propose --use-api --project-ref vcpbbzdyltvffvzjrzdi 2>&1 | tail -4; echo EXIT=$?` (Ausgabe auf die letzten vier Zeilen gekürzt).
- **Zeit:** Aufruf 2026-11-12 05:06:49 UTC, Ergebnis 05:06:59 UTC (06:06:49 und 06:06:59 Wiener Zeit).
- **Ergebnis:** „Deployed Functions“, `EXIT=0`.
- **Stand danach** (`supabase functions list --project-ref vcpbbzdyltvffvzjrzdi`, lesend, am selben Tag abgefragt): `change-propose`, Status ACTIVE, **Version 4**, `updated_at` 1794460019265 ms = 2026-11-12 05:06:59 UTC, `ezbr_sha256` `1477b05d9b810378b8b1e6d2aad82ef64356aead04c3ac8549e4793bd08e3526`.
- **Quell-Commit:** `a4f6157` (2026-11-12 06:06:46 +01:00, „s9i-7a WIP: Migration 0058 my_job_changes(), Vorschau und gezeigter Betrag in change-propose, Tests“), drei Sekunden vor dem Deploy. Danach hat sich unter `supabase/functions` bis `908aefd` nichts mehr geändert (`git diff --stat a4f6157 HEAD -- supabase/functions` ist leer). Ob der Arbeitsbaum beim Deploy mehr als `a4f6157` enthielt, habe ich nicht gesondert geprüft.
- **Kein Smoke-Test, kein Lauf mit echten Tokens.** Nach dem Deploy habe ich weder die Function ohne JWT aufgerufen (erwartet 401) noch mit einem echten Token. Der Handler ist nur mit nachgebauten Abhängigkeiten getestet (`tests/unit/change-handlers.test.ts`), die Oberfläche gegen Mocks (`tests/e2e/partner-nachtrag.spec.ts`). Ein Lauf mit echten Partner-Tokens (aal2) fehlt seit S9f (`docs/OPEN_ISSUES.md` S9f-8).
- **Weitere Function dieser Session:** `photo-receipt` (Version 2) und `cancel-partner` (Version 2) habe ich nicht neu deployt.

## 3. `change-decide` auf Dev

- **Stand:** Version 3, `updated_at` 1794221628915 ms = 2026-11-09 10:53:48 UTC, `ezbr_sha256` `e9ef95599e2aa1988f3ee356420ab42fb3a743ce2ea500cf35fd2eb897e2c6bc`. In s9i-7a habe ich sie nicht neu deployt.
- **Herkunft:** Der letzte Commit vor `a4f6157`, der `supabase/functions/change-decide` oder `supabase/functions/_shared/change/handlers.ts` änderte, ist `1f9198d` („S9f Nachtrag: Migrationen 0040 und 0041 …“, 2026-11-09 12:13:31 +01:00). Der Deploy (10:53:48 UTC = 11:53:48 Wiener Zeit) liegt etwa 20 Minuten vor diesem Commit. Er stammt also aus dem Arbeitsbaum, der kurz danach als `1f9198d` committet wurde. Dass beide Stände gleich sind, habe ich nicht verglichen.
- **Bündel:** Das Bündel von `change-decide` enthält die ältere `_shared/change/handlers.ts` aus diesem Stand. Die Änderungen von s9i-7a an dieser Datei (`a4f6157`) betreffen nur `handleProposeChange`; `handleDecideChange` blieb unverändert.

## 4. Abweichung vom Auftrag: Storno durch die Firma nicht in 7a

Der Auftrag (Abschnitt 2) nannte „Nachtrag erstellen (mit Belegen) und Storno durch den Partner“ als s9i-7a und erlaubte eine Teilung, ohne den Schnitt vorzugeben. Ich habe in 7a nur den Nachtrag gebaut. Das Storno durch die Firma habe ich auf s9i-7b verschoben, den Schnitt hat der Berater vorgeschlagen (Frage 4: „teilen“, siehe oben; `docs/AUTOPILOT.md` Entscheidung 88). Das ist eine Abweichung vom Auftrag: 7a enthält das Storno nicht.

Im Abschlussbericht stand die Verschiebung als „Schnitt des Beraters“, nicht als Abweichung vom Auftrag. Die ROADMAP führt keinen eigenen Eintrag s9i-7; deshalb gibt es dort nichts abzuhaken. Der nächste Schritt ist s9i-7b (`docs/AUTOPILOT.md`, „WEITER MIT“).
