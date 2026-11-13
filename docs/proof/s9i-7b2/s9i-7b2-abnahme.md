Modell: claude-fable-5-2

# Abnahme s9i-7b2 (Geld, Rechte): Absage durch die Firma, Kontaktsperre 0060

- Datum: 2026-11-13
- Branch: `s9i-7b2`, Stand `1c5ed3f`
- Werkzeuge: nur Read, Grep, Glob, Write. Das eingebaute `advisor`-Tool stand in meiner Tool-Liste und wurde nicht aufgerufen.
- Ich habe keine Tests ausgeführt (kein Shell-Zugang). Aussagen zu Testläufen stammen aus den Logs unter `tmp/proof/`.

## Geprüfter Umfang

Vollständig gelesen:
- `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql`
- `tests/rls/job-contact-after-cancel.test.ts`
- `src/lib/partnerCancel.ts`, `src/screens/partner/Absage.tsx`, `src/screens/partner/Auftraege.tsx`, `src/lib/partnerJobs.ts`
- `src/lib/cancel.ts`, `src/screens/auftrag/Absage.tsx`
- Gegenprobe: `supabase/functions/_shared/cancel/partner.ts`, `supabase/functions/_shared/cancel/db.ts`, `supabase/functions/cancel-partner/index.ts`, `supabase/functions/_shared/pricing/fee.ts`, Migration 0059, 0057, 0058, 0050, 0047
- Tests: `tests/e2e/partner-absage.spec.ts`, `tests/e2e/auftrag-absage.spec.ts`, `tests/unit/partner-cancel.test.ts`
- Planprüfung `tmp/proof/s9i-7b2-fable-plan.md`

In Ausschnitten gelesen: 0028, 0030, 0032, 0040, 0046, `src/lib/jobs.ts`, `src/lib/partnerChange.ts`, `src/screens/Auftrag.tsx`, `tests/e2e/jobs-helpers.ts`, `tests/rls/partner-functions-live.test.ts`, `docs/S9_KONZEPT.md`, `docs/AUTOPILOT.md`, `docs/OPEN_ISSUES.md`, `docs/GOLIVE.md`.

Nicht geprüft: `src/screens/partner/Belege.tsx`, die Function `photo-receipt`, das Innere von `Sheet` (nur die Eigenschaft `locked`), Screenshots, der tatsächliche Stand der Funktion auf Dev (nur `s9i-7b2-dbpush.log`, EXIT=0). Das Ja von Beks zu 0060 kann ich nicht nachprüfen; siehe M2.

## Ergebnis

Kein Finding der Stufe hoch. Geldpfad, Sendeablauf und Migration 0060 stimmen. Drei mittlere Findings betreffen einen sachlich falschen Firmentext, die fehlende Entscheidung 104 und eine Abweichung von der Regel in CLAUDE.md, wo die Gebühr angezeigt wird. Auflagen 2 bis 5 der Planprüfung sind umgesetzt.

## Findings

### Hoch

Keine.

### Mittel

**M1** `src/screens/partner/Absage.tsx:216` und `:241` – Problem: „Seine Anfrage geht an andere Firmen" steht als sichere Folge da. Die Weitervermittlung entfällt aber, wenn der Termin weniger als `reissue_min_hours` entfernt ist (24 laut `supabase/seed.sql:98`), bei einem Festangebot oder wenn es schon eine Folgeanfrage gibt (`0047:25-29`). Die Pauschale gibt es nur nach abgelehntem oder abgelaufenem Nachtrag bei `scope_impossible` (`0059:10-13`), also typischerweise vor Ort. Genau dort ist der Satz im Weg „Ohne Pauschale" falsch: die Firma verzichtet auf die Pauschale unter einer Annahme, die nicht eintritt. Ab Terminbeginn (`started`) ist er immer falsch. Der Kundentext ist in diesem Fall richtig (`src/screens/auftrag/Absage.tsx:43`). – Fix: an beiden Stellen bedingt formulieren, z. B. „Der Kunde zahlt nichts. Wenn der Termin es zulässt, geht seine Anfrage an andere Firmen." Bei `started` den Halbsatz weglassen.

**M2** `docs/AUTOPILOT.md:208` – Problem: Die letzte Entscheidung ist 103. Entscheidung 104 fehlt, obwohl `docs/OPEN_ISSUES.md:589` schon auf sie verweist und `docs/S9_KONZEPT.md:469` die Ausnahme Beks zuschreibt. Auflage 1 der Planprüfung („0060 nur mit Beks' Ja") ist damit nur durch die Aussage der Hauptsession belegt; den Auftragstext habe ich nicht gesehen. 0060 ändert eine Entscheidung von Beks vom 01.11. und liegt schon auf Dev. – Fix: vor dem Commit Entscheidung 104 mit dem Wortlaut aus dem Auftrag (Umfang D) eintragen und im Abschlussbericht ausdrücklich als „zur Durchsicht durch Beks" nennen. Lehnt Beks ab: Migration zurücknehmen, die Sätze zur Sperre in `src/screens/partner/Absage.tsx:216`, `:248` und `src/screens/partner/Auftraege.tsx:258` sowie den rls-Test streichen, `S9_KONZEPT.md:405`, `:469`, `:516`, `:678` zurückstellen.

**M3** `src/screens/partner/Absage.tsx:221` – Problem: Die Zeile „Gebühr" zeigt die Plattformgebühr in der Absage-Maske. CLAUDE.md, Abschnitt Geld, nennt als Anzeigeorte nur die Vermieter-Abrechnung, die Rechnung und die Auszahlungsübersicht des Partner-Portals. Die Auftragskarte der Firma zeigt bisher keine Gebührenzeile (`src/screens/partner/Auftraege.tsx:214-215`: nur Betrag und „Du erhältst"). Ein Leck zum Kunden besteht nicht: die Zahl kommt nur aus `cancel-partner` (Zuordnung und aal2 über `change_gate`, `0040:311-322`), und die Firma darf Satz und eigenes Journal ohnehin lesen. Es ist ein Widerspruch zur Regel, kein Rechteproblem. – Fix: entweder die Zeile streichen (Pauschale und „Du erhältst" genügen, die Differenz ist dieselbe Information) oder Beks ergänzt die Liste in CLAUDE.md um die Absage-Maske. Bis dahin als offene Frage an Beks in `docs/OPEN_ISSUES.md` führen.

### Niedrig

**N1** `src/screens/partner/Absage.tsx:174-176` – Problem: Meldet der Server beim Senden `too_late_for_reason`, bleibt die Vorschau mit dem nun unzulässigen Grund stehen; der Knopf sendet beim nächsten Klick denselben Aufruf und scheitert wieder. In der Vorschau wird dieser Fall richtig behandelt (`:113-115`). Kein Geldrisiko: für die anderen Gründe ist die Pauschale 0, und der Server lehnt ab. – Fix: beim Senden wie in `check`: Grund auf `scope_impossible`, Vorschau und Auswahl verwerfen.

**N2** `src/screens/partner/Absage.tsx:144-150` mit `src/lib/partnerChange.ts:190-196` – Problem: Geht die Antwort eines Uploads verloren, liegt der Beleg beim Server, die App kennt seine ID nicht, und `touched` bleibt falsch. Schließt die Firma danach, wird nicht neu geladen; ein neuer Versuch lädt dasselbe Foto noch einmal hoch (zählt gegen die Grenze von 8). – Fix: `touched` schon vor dem ersten Upload setzen oder bei jedem Upload-Fehler der Art Netz.

**N3** `tests/rls/job-contact-after-cancel.test.ts:69-135` – Problem: Aus der Risikoliste der Planprüfung fehlen weiter `admin_correct cancel_partner` mit und ohne Pauschale (dort bleibt `ended_at` einer als `completed` beendeten Zuordnung stehen, `0050:99-103`) und Firma B auf der Folgeanfrage (erlaubt) gegen Firma A (verweigert). E3 und E6 stellen das Ende per direktem UPDATE mit abgeschalteten Triggern her (`:84`, `:130`), nicht über die Funktionen. – Fix: zwei Proben ergänzen; die Logik selbst ist durch E1, E2 und E4 abgedeckt.

**N4** `tests/e2e/jobs-helpers.ts:307`, `:314` – Problem: Der Mock rechnet die Auszahlung mit festem Satz und der eingebauten Rundung statt mit `splitFee`. Für 6.900 und 8.000 ct stimmt das; bei Beträgen mit halbem Cent könnte der Mock vom Server abweichen. – Fix: `splitFee` aus `@pricing` mit dem Testsatz verwenden.

**N5** `tests/e2e/partner-absage.spec.ts` – Problem: Kein Test für „Netzfehler in der Vorschau darf wiederholt werden" (zweite Hälfte von Auflage 5) und kein Doppelklick-Test auf dem Weg mit Pauschale und Upload. Der Code ist richtig (`src/screens/partner/Absage.tsx:109-116`, `:133-136`). – Fix: je einen Test ergänzen.

**N6** `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql:34-36` – Problem: Die Sperre greift, sobald irgendeine Zuordnung derselben Firma zu diesem Auftrag mit `cancelled_by_partner` endete. Bekäme dieselbe Firma später eine zweite, aktive Zuordnung zum selben Auftrag, wäre auch sie gesperrt. Heute nicht erreichbar: der Status ist ein Endzustand, die Weitervermittlung legt einen neuen Auftrag an (`0047:36-40`) und schließt die stornierende Firma aus. – Fix: keiner jetzt; bei einem künftigen Ablauf mit Wiederzuordnung die Bedingung auf die letzte Zuordnung beschränken.

**N7** `src/lib/partnerJobs.ts:313` – Problem: `contactLocked` nimmt die Summe aller Journalzeilen aus `my_jobs` (`0057:42-44`), der Server nur die Gebührenzeile und ihre Gegenbuchungen (`0060:10-15`). Beides ist gleich, solange jede `booking`- und `change`-Zeile gegengebucht ist (`0046:278-286`). Weichen sie je ab oder ist der Betrag nicht lesbar (`null`), zeigt die Karte den Knopf, und der Server antwortet `not_assigned` (Text „Das ist nicht mehr verfügbar."). Der Server entscheidet, es gibt kein Leck. – Fix: keiner nötig; nur als Hinweis.

## Prüffragen

### (1) Stimmen alle Betragsanzeigen mit Server und `splitFee` überein?

Ja.

Rechenbeispiel 6.900 ct bei 15 % und 20 % USt. nach `supabase/functions/_shared/pricing/fee.ts:22-24`:
- Gebühr = floor((2 × 6.900 × 1.500 + 10.000) / 20.000) = floor(1.035,5) = **1.035**
- Netto = floor((2 × 1.035 × 10.000 + 12.000) / 24.000) = floor(863,0) = 863; USt. = 172
- Auszahlung = 6.900 − 1.035 = **5.865**

Firma:
- Pauschale: `callOutCents` der Vorschau = `call_out_base` (höchstens der Gesamtpreis, `0046:375`), nur bei Berechtigung, sonst 0 (`0059:70`). Anzeige `src/screens/partner/Absage.tsx:220`.
- Auszahlung: der Server rechnet `splitOf(callOutCents)` mit dem eingefrorenen Satz der `booking`-Zeile (`partner.ts:64`, `0059:68-73`). Anzeige `:223`.
- Gebühr: `callOutCents − payoutCents` (`:221`). Weil `payoutCents = totalCents − feeCents` (`fee.ts:24`), ist das exakt `feeCents`: 1.035.
- Gezeigter Betrag beim Senden: Knopftext und gesendeter Wert stammen aus demselben Objekt `preview.callOutCents` (`:262`, `:161`). Der Server vergleicht ihn mit seiner eigenen Grundlage und antwortet sonst mit 409 ohne Buchung (`partner.ts:69-70`); die Datenbank prüft Basis und Satz noch einmal (`0059:98-105`).
- Gebucht wird dieselbe Aufteilung aus derselben Funktion (`partner.ts:72`). Der Live-Test belegt die Zeile im Journal gegen `splitFee` (`tests/rls/partner-functions-live.test.ts:140-150`).
- Auftragskarte nach der Absage: „Pauschale" = Summe `total_cents`, „Du erhältst" = Summe `payout_cents` der eigenen Journalzeilen (`0057:42-44`, `Auftraege.tsx:214-215`). Nach Gegenbuchung aller Zeilen bleiben 6.900 und 5.865.
- Die Auszahlung wird vom Server nicht gegen einen gezeigten Wert verglichen. Das ist in Ordnung: der Satz ist an die `booking`-Zeile gebunden, die Auszahlung ist damit eine feste Funktion der Pauschale.

Kunde:
- Nur die Pauschale: `my_cancel_info` liefert eine einzige Zahl, die Summe `total_cents` der Gebührenzeile und ihrer Gegenbuchungen (`0059:151-154`), nur dem Kunden des Auftrags und nur bei `cancelled_by_partner` (`:148`). `src/lib/cancel.ts:83-85` prüft sie streng; ein unlesbarer Wert ist ein Fehler, nie „keine Kosten".
- Im Kunden-Screen steht kein Wort zur Gebühr (`src/screens/auftrag/Absage.tsx:24-49`); der E2E-Test schließt 10,35, 58,65, Gebühr, Plattform, Provision und 15 % im ganzen Dokument aus (`tests/e2e/auftrag-absage.spec.ts:54`).

### (2) Kann die App einen Betrag senden, den der Nutzer nicht gesehen hat?

Nein.

- **409:** `amount_changed`, `call_out_not_allowed` und `retry` holen nur eine neue Vorschau; `check` setzt die Auswahl zurück (`Absage.tsx:106-107`, `:166-168`). Gesendet wird erst nach neuer Wahl und neuem Klick. Belegt in `partner-absage.spec.ts:103-127` und `:129-137`.
- **Grundwechsel:** `pickReason` verwirft Vorschau und Auswahl (`:94-99`). Gesendet wird `preview.reason`, nicht der Zustand `reason` (`:161`). Solange eine Vorschau steht, ist die Grund-Auswahl nicht sichtbar (`:196`); während einer Anfrage sind alle Eingaben gesperrt (`:203`, `:229`, `:238`, `:270`).
- **Netzfehler beim Senden:** `offline` und `unavailable` (auch jeder 500) schließen das Sheet mit dem Hinweis „Wir wissen nicht …" und laden die Aufträge neu (`:171-173`); kein zweiter Aufruf. Ein späterer Klick von Hand trifft serverseitig auf `change_gate` (`0040:319-322`) und kann nicht doppelt buchen; belegt in `partner-functions-live.test.ts:128-139`.
- **Netzfehler in der Vorschau:** zurück zu Schritt 1 mit Fehlertext, wiederholbar (`:109-116`).
- **Doppelklick:** `running.current` wird synchron vor dem ersten `await` gesetzt (`:133-136`, `:123-124`).
- **Belege hochgeladen, dann Abbruch:** Es wird nichts gesendet. Beim Schließen lädt die Liste neu (`:84-87`). Wählt die Firma danach „Ohne Pauschale", gehen `shownCallOutCents: 0` und keine `photoIds` (`partnerCancel.ts:46-47`); der Server bucht dann 0 (`partner.ts:69`). Einschränkung: N2.
- **Pauschale ohne Auswahl oder ohne Beleg:** Knopf gesperrt (`:185`), `send` bricht ohne Auswahl ab (`:135`). Ein Aufruf mit Betrag ohne Belege wäre serverseitig `invalid_input` (`partner.ts:54`).
- Eine manipulierte App kann keine Pauschale erzwingen: Berechtigung und Belege prüft die Datenbank (`0059:39-47`).

### (3) Kontaktsperre: Randfälle der Migration

- **Mehrere Zuordnungen:** Hilfsfunktion und Sperre filtern nach Auftrag und Firma (`0060:12`, `:35`). Höchstens eine aktive Zuordnung je Auftrag (`0030:64`). Eine andere Firma ist nie betroffen. Gleiche Firma zweimal am selben Auftrag: N6, heute nicht erreichbar.
- **Gegenbuchung:** Gezählt werden die Gebührenzeile und Zeilen, die genau sie gegenbuchen (`0060:13-15`). Höchstens eine Gegenbuchung je Zeile (`0028:43`), exakt negiert (`0050:71-72`). Die Summe ist also die Pauschale oder 0. `negate_fee` bucht mit derselben Firma (`0050:45`, `:71`), der Filter trifft sie. Gegenbuchungen der `booking`- und `change`-Zeilen zählen nicht mit, weil sie nicht auf die Gebührenzeile zeigen. Zeilen ohne Bezug fallen über NULL heraus. Belegt durch E4 (`job-contact-after-cancel.test.ts:86-89`, `:114-116`).
- **`admin_correct cancel_partner`:** setzt denselben Grund der Beendigung (`0050:99-103`); ohne Pauschale sofort gesperrt, mit Pauschale offen bis zum Ende des Fensters ab dem ursprünglichen `ended_at`. Fachlich gewollt, nicht getestet (N3).
- **Andere Beendigungen:** `completed` und `cancelled_by_customer` unverändert (`0060:34-35`), auch wenn beim Kundenstorno eine Gebührenzeile existiert. Belegt durch E3 und E6.
- **Fenster:** Die Sperre steht hinter `assignment_access` (`0060:33`), verlängert also nichts. Belegt durch E5 (Tag 29 offen, Tag 31 gesperrt).
- **Rollen:** Die Hilfsfunktion ist `public`, `anon` und `authenticated` entzogen (`0060:18`) und läuft nur innerhalb von `job_contact` (SECURITY DEFINER, leerer `search_path`, alle Namen voll qualifiziert). `job_contact` bleibt `authenticated` mit aal2 und aktiver Firma (`:29-32`, `:48-49`). Belegt: Firma 42501 auf der Hilfsfunktion, fremde Firma `not_assigned`, Kunde `partner_not_active`, aal1 `mfa_required`, anon 42501 (`test:119-123`).
- **Kein Orakel:** gleicher Fehlercode wie „nie zugeordnet" (`0060:37`). Die Sperre steht vor der Audit-Zeile; ein verweigerter Abruf schreibt nichts (`test:110`).
- **Körper sonst wie 0032:** Zeile für Zeile verglichen (`0032:57-77` gegen `0060:21-46`); `job_contact` wurde dazwischen nicht neu definiert (Suche über alle Migrationen).
- **Andere Wege zu Kontakt und Adresse:** `service_requests` und `request_contacts` liest per RLS nur der Kunde bzw. admin (`0001:305-306`, `0018:221-224`). `assignment_access` steht sonst nur in Listings, Fotos, `my_jobs` und `my_job_changes`, alle ohne Kontaktfelder. Dass Fotos ihr Fenster behalten, ist als S9i7b2-3 offen geführt (`docs/OPEN_ISSUES.md:589`).
- **Nebenläufigkeit:** `job_contact` liest nur; ein gleichzeitiges Storno oder eine Gegenbuchung wirkt ab ihrem Commit. Kein Zwischenzustand, der mehr freigibt als vorher.
- **Rot-Beweis:** `s9i-7b2-rot-1.log` und `-rot-2.log` scheitern mit dem Ist-Wert „ok" an der Stelle, die `not_assigned` erwartet. Gemessen wird also die Wirkung (Abruf erfolgreich), wie CLAUDE.md es verlangt. `s9i-7b2-gruen-1.log`: 6 Dateien, 28 Tests, EXIT=0.

### (4) Kundentexte gegen Auflagen 2 und 3 und gegen die Fälle

| Fall | Text (`src/screens/auftrag/Absage.tsx`) | Urteil |
|---|---|---|
| Pauschale > 0 | `:27` „Die Firma macht eine Pauschale von … geltend. Die Firma stellt sie dir außerhalb der App in Rechnung. Wir vermitteln diese Anfrage nicht weiter." | Auflage 3 erfüllt: kein Nebensatz zum Grund. „Nicht weiter" stimmt für `cancel_by_partner` (`0059:119`) und für `admin_correct` (vermittelt nie weiter). |
| 0 ct, Folgeanfrage läuft | `:35` „Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben." mit Link zur neuen Anfrage | richtig, auch wenn die Folgeanfrage später abläuft oder angenommen wird |
| 0 ct, Folgeanfrage `unmatched` | `:43` „… Wir haben leider keine andere Firma gefunden. Du kannst jederzeit eine neue Anfrage stellen." | richtig, nur in diesem Fall |
| 0 ct, keine Folgeanfrage (Termin zu nah, Festangebot, nach `negate_fee`, `admin_correct` ohne Pauschale) | `:43` „Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen." | Auflage 2 wörtlich erfüllt |
| Betrag nicht lesbar | Fehlerzustand mit „Erneut versuchen" (`:16`) | richtig, nie „keine Kosten" |

- Pauschale > 0 und zugleich eine Folgeanfrage kann nicht entstehen (`0059:119`); je Quelle höchstens eine Folgeanfrage (`0046:11`), `maybeSingle` ist damit sicher.
- Die Folgeanfrage liest der Kunde über die eigene Zeile (`0001:302`, `:305-306`); die Spalte ist nicht gesondert gesperrt.
- Alle vier Fälle und der Fehlerfall sind in `tests/e2e/auftrag-absage.spec.ts:57-105` belegt.
- Offen und richtig dokumentiert: Texte vorläufig bis zur Rechtsprüfung, ein Widerspruchsweg fehlt (`docs/GOLIVE.md:67`, Punkt 33).

## Stand der Auflagen aus der Planprüfung

| Auflage | Stand |
|---|---|
| 1 Ja von Beks, Konzept nachziehen | Konzept nachgezogen (`S9_KONZEPT.md:405`, `:469`, `:516`, `:678`). Entscheidung 104 fehlt noch: M2. |
| 2 Kundentext 0 ct ohne Folgeanfrage | erfüllt (`auftrag/Absage.tsx:43`) |
| 3 Kundentext > 0 ct ohne Grund-Nebensatz | erfüllt (`auftrag/Absage.tsx:27`) |
| 4 Toter Kontakt-Knopf | erfüllt (`Auftraege.tsx:222`, `:257-258`; E2E `partner-absage.spec.ts:49-50`). `gone` navigiert nicht weg, das Sheet zeigt nur den Text (`Auftraege.tsx:309-318`). |
| 5 Vorschau gilt nur für ihren Grund | erfüllt (`partner/Absage.tsx:94-99`, `:161`); Testlücke N5 |

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/functions/_shared/pricing/fee.ts:22-24` | Ganzzahlrechnung half-up; 6.900 → 1.035 / 863 / 172 / 5.865 nachgerechnet |
| `supabase/functions/_shared/cancel/partner.ts:62-65` | Vorschau schreibt nichts, liefert nur Pauschale und Auszahlung |
| `supabase/functions/_shared/cancel/partner.ts:48-55` | Belege und Betrag > 0 gehören zusammen; Vorschau ohne Belege und ohne Betrag |
| `supabase/functions/_shared/cancel/partner.ts:69-70` | abweichender gezeigter Betrag: 409, keine Buchung |
| `supabase/functions/_shared/cancel/db.ts:10-11`, `:25-27` | `p_actor` und aal aus dem geprüften Token, nie aus dem Body |
| `supabase/migrations/…0059…sql:77-78`, `:135-138` | Grundlage und Storno nur für `service_role` |
| `supabase/migrations/…0059…sql:98-105` | Datenbank prüft Basis und eingefrorenen Satz erneut |
| `supabase/migrations/…0059…sql:119-123` | Weitervermittlung nur ohne Pauschale |
| `supabase/migrations/…0059…sql:148-154` | `my_cancel_info`: nur Kunde, nur Firmen-Storno, nur eine Summe |
| `supabase/migrations/…0060…sql:7-18` | Hilfsfunktion: Summe nach Auftrag und Firma, leerer `search_path`, drei Rollen entzogen |
| `supabase/migrations/…0060…sql:33-38` | Sperre nach dem Fenster, vor der Audit-Zeile, gleicher Fehlercode |
| `supabase/migrations/…0032…sql:57-77` | Körper von `job_contact` sonst unverändert |
| `supabase/migrations/…0028…sql:43` | höchstens eine Gegenbuchung je Journalzeile |
| `supabase/migrations/…0030…sql:64`, `:87-95` | eine aktive Zuordnung je Auftrag; Fenster über `partner_access_days` |
| `supabase/migrations/…0040…sql:311-322` | `change_gate`: aal2, Mitglied, Firma aktiv, aktive Zuordnung, Status |
| `supabase/migrations/…0046…sql:278-286` | alle `booking`- und `change`-Zeilen werden exakt negiert |
| `supabase/migrations/…0047…sql:25-29` | Bedingungen, unter denen die Weitervermittlung entfällt (Grundlage M1) |
| `supabase/migrations/…0050…sql:64-72`, `:99-103` | `negate_fee` und `cancel_partner` des Admins |
| `supabase/migrations/…0057…sql:42-46` | `my_jobs`: Journalsummen der eigenen Firma, keine Kontaktfelder |
| `supabase/migrations/…0058…sql:32-33` | `receipt_ids`: nur bereite Belege der eigenen Firma zum Auftrag (passt zur Prüfung in `0059:43-44`) |
| `supabase/migrations/…0001…sql:302-306`, `…0018…sql:221-224` | Kontakt und Adresse per RLS nur Kunde bzw. admin |
| `src/lib/partnerCancel.ts:40` | strenge Prüfung der Vorschau; Auszahlung über der Pauschale ist ein Fehler |
| `src/lib/partnerCancel.ts:46-47` | ohne Pauschale gehen keine `photoIds` |
| `src/screens/partner/Absage.tsx:133-136` | Doppelklick-Sperre synchron |
| `src/screens/partner/Absage.tsx:161` | gesendet wird Grund und Betrag der Vorschau |
| `src/screens/partner/Absage.tsx:166-173` | 409: neue Vorschau; Netzfehler: schließen und neu laden; nie erneut senden |
| `src/screens/partner/Absage.tsx:188` | Sheet während der Anfrage gesperrt (`Sheet.tsx:14`, `:65`, `:109`) |
| `src/screens/partner/Auftraege.tsx:208-217` | `Betraege`: nach Storno Pauschale bzw. „es fällt kein Betrag an", keine Gebührenzeile |
| `src/screens/partner/Auftraege.tsx:257-258` | Kontakt-Knopf und Hinweistext folgen `contactLocked` |
| `src/lib/cancel.ts:82-89` | Betrag streng geprüft; Folgeanfrage nur des eigenen Kunden |
| `src/screens/Auftrag.tsx:105` | Absage-Karte nur bei `cancelled_by_partner` |
| `tests/rls/job-contact-after-cancel.test.ts:104-123` | Erwartungen decken ohne/mit Pauschale, Gegenbuchung, Fenster, Rollen |
| `tests/e2e/partner-absage.spec.ts:85-101`, `:152-158` | Weg „Ohne Pauschale" sendet 0 ohne Belege; Doppelklick ein Aufruf |
| `tests/unit/partner-cancel.test.ts:57-75` | Fehlerzuordnung je Servercode |
| `tests/rls/partner-functions-live.test.ts:140-157` | Live: Vorschau, Journalzeile wie `splitFee`, Kunde sieht 6.900, fremder Kunde Fehler |
| `docs/S9_KONZEPT.md:405`, `:469`, `:516`, `:678` | Ausnahme Kontakt nach Firmen-Storno nachgezogen |
| `docs/AUTOPILOT.md:205-208` | Entscheidungen enden bei 103 (M2) |
| `docs/GOLIVE.md:67` | Pauschale vorläufig, Widerspruchsweg fehlt: dokumentiert |
| `tmp/proof/s9i-7b2-rot-1.log:24`, `-rot-2.log:25` | Rot-Beweis misst den Ist-Wert „ok" (Abruf erfolgreich) |
| `tmp/proof/s9i-7b2-gruen-1.log:58-64`, `-dbpush.log:21` | 28 Tests bestanden, EXIT=0; Push EXIT=0 |

Der Bericht enthält keine Suchmuster aus `scripts/scan-proof.mjs` und keine Schlüssel, Tokens oder Verbindungsdaten.

Offene Findings hoch: 0
