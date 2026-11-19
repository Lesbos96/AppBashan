Modell: claude-fable-5-2
Vorgaenger: tmp/proof/ts1-abnahme-1.md
SHA256: fe7133d33c693ffec3a92a27e97e0856376d33baa70d0bbee28bf6b1d18000da supabase/functions/_shared/route/handler.ts
SHA256: 091d7846f2478f9afe059a2d862b278641a0f2fc73e194a3ae008232ad735695 supabase/functions/_shared/turnstile.ts
SHA256: 40d895b5ed429f882b492f233142e465e9468edae44908294ec6fc27d9293f61 supabase/functions/route/index.ts
SHA256: c77d7926f5f7226f49e343e618f4e5c20448678455c662101e00be8ad544fab5 tests/support/db.ts
SHA256: de007571db8d57e835e50d772f0adcd8f29c7aa1fd02d3f6f14877ff4c3ed022 scripts/sys/loesch-register.json
SHA256: e12be033a9c8d90c7db55f45a67ae5903a75aad6ad3b65619a6d5b881421616c docs/freigaben/ts1-loesch-freigabe-1.md
SHA256: 2d9cbb690427cf7fb74929b09cac41e557de032468afd594155438abc7eb1d06 src/components/CaptchaHost.tsx

# Abnahme Runde 2, Schritt ts1 (R3): Kontrollrunde nach Runde 1

Datum: 2026-11-19
Stand laut Auftrag: Branch `ts1`, Commit d79c3be (Arbeitsbaum laut Git-Status sauber).

Geprüft (vollständig gelesen): die sechs Pflichtdateien, dazu `src/components/CaptchaHost.tsx` und `tests/e2e/captcha.spec.ts` (beide seit Runde 1 geändert), `src/lib/auth.ts`, `src/lib/turnstile.ts`, `src/lib/route.ts`, `tests/rls/captcha-live.test.ts`, `tests/e2e/captcha-helpers.ts`, der Vorgänger `tmp/proof/ts1-abnahme-1.md`.
Zur Einordnung gelesen: `.claude/rules/geld.md`, `.claude/rules/daten.md`, `supabase/config.toml:213-219`, `src/app/Shell.tsx:98-115`, `tmp/proof/ts1/runs.jsonl` (ganz), Log 021 (ganz), Log 024 (ganz), Kopf der Logs 022 und 023, in Log 023 die Fehlerliste `:4615-4722`, alle Zeilen mit dem Ort der Abfrage und der erste Fehlerblock `:755-792`, Schlusszeilen der Logs 025 bis 029, `tmp/probe-captcha.mjs`, `tmp/probe-route.mjs`, `tmp/probe-leftover.mjs`, `docs/GOLIVE.md:14-67` und `:86-107`, `docs/ARCHITECTURE.md:189-200`, `docs/OFFEN.md:78`, `docs/ENTSCHEIDUNGEN.md:222-223`, `docs/STAND.md:1-25`, `docs/BEKS.md:26-45`, `scripts/sys/fertig.mjs:10-20`, `scripts/sys/abnahme-lib.mjs`, `scripts/sys/gate-db-lib.mjs:34-66`, `scripts/scan-proof.mjs`. Suchen über `tests/e2e/` (Rollen-Abfragen nach Dialogen), `tests/unit/` und `src/` (Host, weitere Auth-Einstiege), `tmp/` (Laufprotokolle des Lösch-Gates).

Hinweise zum Nachweis:
- Die sieben Hash-Zeilen sind aus dem Auftrag abgeschrieben, nicht nachgerechnet (kein Shell-Werkzeug). Die ersten sechs sind Zeichen für Zeichen gleich den Zeilen der Runde 1. Für `tests/e2e/captcha.spec.ts` nennt der Auftrag keinen Hash, deshalb keine Zeile; die Datei fällt nicht unter die Mindestmenge (`scripts/sys/fertig.mjs:16`), ebenso wenig `CaptchaHost.tsx`, deren Zeile ich trotzdem führe, damit das Gate eine spätere Änderung meldet.
- „Unverändert seit Runde 1“ für `src/lib/auth.ts`, `src/lib/turnstile.ts`, `src/lib/route.ts`, `supabase/config.toml` habe ich durch Lektüre geprüft: Alle Zeilenverweise der Runde 1 treffen weiter dieselben Stellen. Ein Byte-Vergleich ist das nicht. Für `tests/rls/captcha-live.test.ts` belegt es der Datei-Hash in `runs.jsonl:16`, `:17`, `:21` (dreimal derselbe Wert).
- Die Ausgaben der drei Messproben und der Durchgang im Browser liegen mir nur als Text des Auftrags vor, nicht als Datei. Die Skripte der Proben habe ich gelesen. Wo ein Lauf dieselbe Aussage unabhängig trägt, nenne ich ihn.
- Keine `.env*` gelesen. Geschrieben wurde nur diese Datei. Testschlüssel und Dummy-Wert zitiere ich nicht wörtlich.

## Ergebnis in einem Satz

Kein hoher Fund, auch keiner aus Runde 1; die Änderung an `CaptchaHost.tsx` ist richtig und stört die offene Karte nicht, der Auth-Weg ist jetzt live belegt (Lauf 021), die Doku-Funde M1, M4, N3, N4, N6 sind richtig eingearbeitet; offen bleiben die Volläufe auf dem Endstand (einschließlich `check`, weil sich nach Lauf 022 eine Datei unter `src/` geändert hat), ein kurzer Durchgang im Browser auf dem Endstand und veraltete Stellen in STAND, BEKS und OFFEN. Die Abnahme gilt für die sieben Hashes und mit den Auflagen unten.

## Findings hoch

Keine. Runde 1 hatte keinen hohen Fund; keiner der mittleren oder niedrigen ist durch die neuen Messungen hoch geworden.

## Findings mittel

M2 (aus Runde 1, zum Teil behoben). `src/components/CaptchaHost.tsx:26-27` gegen den Durchgang im Browser laut Auftrag – Der unsichtbare Weg mit dem echten Cloudflare-Skript ist jetzt gelaufen (Skript geladen, Anforderung an Auth ging raus und wurde an der Adresse abgelehnt, nicht am Token; Adresssuche 200 mit Kandidat; Konsole ohne Captcha-Fehler). Zwei Lücken bleiben:
- Der Durchgang lag vor dem Commit d79c3be (er steht in der Reihenfolge des Auftrags vor Lauf 023, die Änderung kam danach). Der einzige Beleg mit echtem Skript deckt also den Stand ohne das neue Attribut am Host des Widgets. Das Attribut wirkt nur auf den Zugänglichkeitsbaum, nicht auf Darstellung, Skript oder iframe; ich erwarte keinen Unterschied. Belegt ist es nicht. – Fix: Auflage 2 (kurze Wiederholung auf dem Endstand).
- Die Karte mit Eingabe ist mit echtem Skript nie erschienen („öffnete sich nie“). Öffnen als Modal, Größe des iframes in der Karte und Schließen nach der Eingabe sind nur mit dem Stub belegt (`tests/e2e/captcha.spec.ts:68-95`, `:128-139`). Folge bei einem Fehler: Wer von Cloudflare eine Eingabe verlangt bekommt, kann sich nicht anmelden (fail closed, Startrisiko, kein Sicherheitsrisiko). – Fix (nur Doku): Prüfweg in `docs/GOLIVE.md:90` (Punkt 49) um einen Durchgang mit erzwungener Eingabe ergänzen (Cloudflare bietet dafür einen eigenen Test-Site-Key; oder mit dem echten Widget im verwalteten Modus), Eintrag in OFFEN ts1-1. Wer es schon jetzt misst, nimmt es in die Bewertung; Pflicht für ts1 ist nur der Doku-Eintrag (Auflage 3).

M3 (aus Runde 1, zum Teil behoben). `tmp/proof/ts1/runs.jsonl:21-29` – Erledigt: `captcha-live` grün bei scharfem Auth-Captcha (Lauf 021, sauberer Baum, ohne Argumente und Schalter, Datei-Hash wie die roten Läufe 16 und 17), `check` grün (Lauf 022). Offen:
- Kein grüner Volllauf `e2e` (Lauf 023 rot mit 101 Fehlern, Ursache behoben, bisher nur gezielt nachgeprüft: Läufe 024 bis 029, alle mit unsauberem Baum auf f9cfebb) und kein Volllauf `rls` seit dem Deploy von `route` und `quote` (Auflage 9 des Plans, Geldweg `quote` mit dem neuen Bündel).
- `check` Lauf 022 lief auf f9cfebb. Danach änderte d79c3be `src/components/CaptchaHost.tsx`. Der Auftrag kündigt nur `e2e` und `rls` neu an. Nach `.claude/rules/tests.md` zählt ein Lauf nur mit dem Fingerabdruck des Endstands; ob Lauf 022 noch passt, rechnet das Gate, ich rechne nicht damit. – Fix: Auflage 1 (alle drei Suiten auf dem Endstand, es sei denn, das Gate übernimmt `check` von sich aus).

M4 (aus Runde 1, Doku-Teil behoben, Rest eingetragen). `docs/GOLIVE.md:37`, `:47`, `:90`, `docs/OFFEN.md:78` (d) – Die Prüfwege in Punkt 13, 18 und 49 sind auf die wirkungsfreie Probe umgestellt, OFFEN (d) nennt die offene Richtung (Testsecret im Produktivprojekt) und die zwei Proben für `golive-check`. Die technische Probe selbst fehlt weiter (eigener R3-Schritt, Register-Pin); `docs/GOLIVE.md:107` sagt zutreffend, dass `golive-check` Turnstile nicht prüft. Bis dahin Handarbeit nach Checkliste. Kein Hindernis für ts1.

M1 (aus Runde 1): behoben, siehe Prüffragen.

## Findings niedrig

N8 (neu). `docs/STAND.md:7`, `:9`, `:22`, `docs/BEKS.md:37-38`, `docs/OFFEN.md:78` (d2), (g) – Veraltet gegenüber dem gemessenen Stand: STAND nennt den Auth-Teil noch rot und das Dashboard-Captcha „nicht scharf“; BEKS bittet Beks weiter um einen Handgriff, der erledigt ist; OFFEN (d2) will die Kommentare „mit dem Testsecret gilt jedes Token“ kürzen, „sobald die Probe gemessen ist“ (sie ist gemessen und bestätigt den Kommentar für ein anderes Token, `:78` (b)); OFFEN (g) nennt „`captcha-live` grün bei scharfem Auth-Captcha“ als offene Voraussetzung. – Fix: vor `fertig` nachziehen (STAND schreibt der Schritt am Ende ohnehin neu; BEKS-Block „Zuerst“ entfernen; in (d2) den Kommentar-Punkt streichen und dafür den Kommentar zur IP in `supabase/functions/_shared/turnstile.ts:2` aufnehmen, N6). Nur Doku, keine neue Runde.

N9 (neu). `src/components/CaptchaHost.tsx:6-8` – Der Kommentar begründet das Attribut auch mit Screenreadern. Gemessen ist nur die Rollen-Abfrage von Playwright (Log `023-e2e.log:759-768`, `:917-919`); aktuelle Browser nehmen ein Element mit `inert` nach meiner Kenntnis selbst aus dem Zugänglichkeitsbaum. Das Attribut schadet nicht und ist als zweite Sicherung vertretbar. – Fix: Kommentar beim nächsten Anfassen auf das Gemessene kürzen (jetzt nicht, sonst neue Runde).

N10 (bestand schon in Runde 1, dort nicht genannt). `tests/e2e/captcha.spec.ts:68`, `:76-78` – Der Titel sagt „Karte mit Fokus“, der Test setzt den Fokus aber selbst (`:77`). Dass der Fokus beim Öffnen von allein in der Karte landet, prüft kein Test; es folgt aus dem Verhalten eines modalen Dialogs im Browser. – Fix beim nächsten Anfassen: vor `:77` prüfen, dass das fokussierte Element in der Karte liegt.

N11 (neu). `src/lib/auth.ts:58`, `tests/rls/captcha-live.test.ts:64-68` – Live belegt ist das Captcha an Passwort-Anmeldung und Mail-Anforderung. Die Auth-API bietet weitere offene Einstiege, die die App nicht nutzt (Suche in `src/`: keine Registrierung mit Passwort, kein Passwort-Reset, kein anonymes Konto, kein erneutes Senden), die ein Angreifer aber direkt aufrufen kann. Dass das Dashboard-Captcha sie alle deckt, sagt die Dokumentation von Supabase; gemessen ist es nicht. Das Ziel von GOLIVE 18 (keine Konten und Mails an Fremde ohne Captcha) hängt daran. – Fix: OFFEN ts1-1 und Prüfweg GOLIVE 18 um eine Probe ergänzen: Passwort-Reset für eine erfundene Adresse ohne Token muss `captcha_failed` liefern (wirkungsfrei, es entsteht nie ein Konto); die Registrierung mit Passwort nur auf Dev und nur mit reservierter Endung proben. Kein Hindernis für ts1.

N12 (neu). `tmp/probe-captcha.mjs:11` – Die Probe fordert ohne Token eine Mail mit Konto-Anlage an. Ist das Captcha aus, ist sie nicht wirkungsfrei; genau diese Form schließt `docs/GOLIVE.md:47` für Produktion aus. Auf Dev ohne Folge (reservierte Endung; laut Auftrag 0 Konten mit dem Präfix der Probe). – Fix: das Skript nie gegen ein anderes Projekt als Dev richten; für Produktion gilt die Passwort-Probe aus GOLIVE 18.

Aus Runde 1:
- N1: erledigt durch Messung (anderes, kurzes Token an `route` auf Dev: 200; `tmp/probe-route.mjs:4-11`, `docs/OFFEN.md:78` (b)). Der Kommentar in `tests/support/db.ts:18` stimmt. Rest: N8.
- N2: offen, eingetragen (`docs/OFFEN.md:78` (d2)); nach Lauf 021 laut Auftrag 0 Konten mit dem Präfix des Tests.
- N3: behoben (`docs/GOLIVE.md:59` nennt „BEKS Frage 1“, passend zu `docs/BEKS.md:41`).
- N4: behoben (`docs/ENTSCHEIDUNGEN.md:223` trägt den Satz als wörtliches Zitat). Den Prompt selbst kann ich nicht einsehen.
- N5: offen, eingetragen ((d2), Testfall gemischte Codes).
- N6: Doku behoben (`docs/GOLIVE.md:92`); Kommentar in `turnstile.ts:2` beim nächsten Anfassen (in (d2) aufnehmen, N8).
- N7: gilt jetzt praktisch (Auth-Captcha scharf): Ein roter `rls`-Lauf wegen eines Ausfalls bei Cloudflare ist kein Code-Fehler; nicht wiederholen, bevor die Ursache klar ist.

## Auflagen bis `fertig` (bindend)

1. Volläufe `check`, `e2e`, `rls` nacheinander auf dem committeten Endstand mit sauberem Baum, ohne Argumente und Schalter. `check` neu, weil `src/components/CaptchaHost.tsx` nach Lauf 022 geändert wurde; übernimmt das Gate Lauf 022 von sich aus, genügt das. `rls` deckt `quote` nach dem Deploy und die MFA-Wege ohne Token. Ist ein Lauf rot: anhalten, nichts an Tests lockern.
2. Ein kurzer Durchgang im Browser gegen Dev auf dem Endstand mit dem echten Cloudflare-Skript (unsichtbarer Weg: Code anfordern, eine Adresse suchen, Konsole ohne Fehler und ohne Warnung zu `aria-hidden`). Ergebnis mit Datum und Commit in der Bewertung. Scheitert er: anhalten, neue Runde.
3. Doku vor `fertig`: N8 (STAND, BEKS, OFFEN (d2) und (g)), M2 zweiter Punkt (GOLIVE 49, OFFEN), N11 (GOLIVE 18, OFFEN). Keine neue Runde dafür.
4. Die Bewertung nennt im Wortlaut: die Ausgaben der drei Proben (Status, Code und Meldung von Auth je Weg; Status der zwei Token an `route`; die zwei Zählerstände der Restkonten), den Zustand von Auth bei Lauf 021, den Durchgang aus Auflage 2 und die Ausgabe von `git diff --stat main -- <die vier Skripte> scripts/sys/loesch-register.json` (Auflage 6 der Lösch-Freigabe).
5. Ändert sich bis `fertig` eine der sieben Dateien mit Hash-Zeile oder `src/lib/auth.ts`, `src/lib/turnstile.ts`, `src/lib/route.ts`, `supabase/config.toml`, `tests/rls/captcha-live.test.ts`, `tests/e2e/captcha.spec.ts`: Runde 3 mit dieser Datei als Vorgänger.
6. Die Auflagen der Lösch-Freigabe (`docs/freigaben/ts1-loesch-freigabe-1.md:60-65`) gelten weiter. Keines der vier Skripte ist in ts1 gelaufen (kein Laufprotokoll des Lösch-Gates unter `tmp/proof/ts1/`); ts1 braucht keinen Lauf. Vor einem ersten Lauf: grüner `rls`-Volllauf auf dem Endstand (enthält `captcha-live`), `redproof-s9a4.mjs` bleibt bis zu einer Freigabe der gebundenen Dateien gesperrt.

## Antworten auf die Prüffragen

**Stört `aria-hidden` am `<dialog>` den Weg bei offener Karte?** Nein.
- Reihenfolge beim Öffnen: Wird `open` wahr, entfernt React im selben Commit `inert` und `aria-hidden` (`CaptchaHost.tsx:26-27`: `undefined` entfernt das Attribut) und setzt die Klassen der Karte; erst danach, noch vor dem Zeichnen, läuft der Layout-Effekt mit `showModal()` (`:16-21`). Das Element ist beim Öffnen also weder gesperrt noch verborgen; Fokus in die Karte, Fokusfalle und Esc kommen wie zuvor vom Browser.
- Reihenfolge beim Schließen: Commit setzt `inert` und `aria-hidden`, der Layout-Effekt ruft `close()` in derselben Aufgabe; der Browser gibt den Fokus an das vorher fokussierte Element zurück, weil der Dialog modal war. Zwischen Setzen des Attributs und `close()` wird nichts gezeichnet und nichts ausgewertet.
- Beleg mit dem geänderten Host: `tests/e2e/captcha.spec.ts:76` und `:136` suchen den Knopf in der offenen Karte über seine Rolle. Playwright schließt bei Rollen-Abfragen alles unter einem Vorfahren mit `aria-hidden` aus; bliebe das Attribut an der offenen Karte, fänden beide Tests den Knopf nicht. Dazu `:84-95` (Esc schließt, keine Anfrage, Fokus zurück im Feld) und `:128-139` (Karte über dem offenen Sheet, echter Klick). Alle grün in Lauf 024 (`024-…log:23-24`, `:27`, `:34`). Einschränkung: Lauf 024 lief mit unsauberem Baum vor dem Commit; den Endstand bestätigt der Volllauf (Auflage 1).
- Ruhezustand: `:33` prüft, dass die Rollen-Abfrage 0 Dialoge zählt. Der Rot-Beweis dazu ist Lauf 023 selbst: ohne das Attribut zählte dieselbe Abfrage 1 (`023-e2e.log:759-768`) bzw. traf zwei Elemente, das zweite der ruhende Host (`:917-919`).
- Die Behebung ändert das Produkt, nicht die 101 Tests; keine Erwartung wurde gelockert. Alle 95 Fehlerblöcke mit Ortsangabe in Log 023 betreffen dieselbe Rollen-Abfrage, die Fehlerliste (`:4616-4716`) nennt nur die fünf genannten Dateien (51 im Handy-Projekt, 50 im Desktop-Projekt).
- Nicht gemessen: echter Screenreader. Chrome verweigert `aria-hidden` an einem Element, das den Fokus enthält, und meldet das in der Konsole; hier gibt `close()` den Fokus in derselben Aufgabe zurück, ich erwarte deshalb keine Meldung. Auflage 2 sieht es in der Konsole.

**Stimmen die Fixes der Doku-Funde?**
- M1: ja. `docs/GOLIVE.md:19` und `:54` nennen den Site Key für die Build-Umgebung (mit Folge bei Fehlen), `:33` nennt sechs Secrets und prüft sechs Namen, `docs/ARCHITECTURE.md:190` nennt Feld, Reihenfolge (Methode, `apikey`, Body, Modus und Eingaben, Captcha, Zähler, Anbieter: gleich `handler.ts:42-86`) und die Antworten 403 und 503, `:195` das Secret mit dem Hinweis, dass `route` ohne es nicht startet (`route/index.ts:22`). `:200` (Secrets von `quote`) bleibt richtig: `quote` braucht das Turnstile-Secret nicht.
- M4: ja, siehe oben. Die Probe ist richtig gewählt: Passwort-Anmeldung mit erfundenen Zugangsdaten und Dummy-Wert liefert bei echtem Secret `captcha_failed`, bei Testsecret oder ausgeschaltetem Captcha `invalid_credentials`; in keinem Fall entsteht ein Konto oder eine Mail. Die Live-Messung auf Dev (ohne Token: `captcha_failed` vor jeder Prüfung der Zugangsdaten) stützt die Reihenfolge.
- N3, N4, N6: ja, siehe Liste oben.
- Neu aufgefallen: N8 (STAND, BEKS, OFFEN hinken dem Stand hinterher).

**Sind die Auflagen 1 bis 6 der Runde 1 erfüllt?**
1. Erfüllt. Lauf 021: `runs.jsonl:21` (Exit 0, 6 von 6, sauber, keine Argumente, keine Schalter, Datei-Hash wie `:16-17`), Log `021-…log:1-5`, `:15-25`, `:33`. Zustand von Auth: scharf; das belegt der Lauf selbst, weil `captcha-live.test.ts:65` und `:68` nur bestehen, wenn Auth ohne Token `captcha_failed` meldet. Damit zählen jetzt auch die Positivfälle (`:71-73`, `:90-93`).
2. (a) Erfüllt nach Auftrag (Status 400, Code `captcha_failed`, beide Wege), in der Sache unabhängig durch Lauf 021 belegt: Der Client liest den Code, also kommt die Antwort als auswertbarer Fehler an, und `src/lib/auth.ts:38-39` prüft den Code vor dem Status. Der Durchgang im Browser zeigt die Gegenprobe (Adressfehler statt Captcha-Text, `auth.ts:39`). (b) Erfüllt (200, N1). (c) Erfüllt nach Auftrag (0 und 0); `tmp/probe-leftover.mjs:6-14` zählt nur lesend nach Präfix, das Präfix des Tests deckt auch die Adresse der Mail-Anforderung (`captcha-live.test.ts:67`). Wortlaut in die Bewertung: Auflage 4.
3. Erfüllt für den unsichtbaren Weg, mit den zwei Lücken aus M2.
4. Offen (M3, Auflage 1).
5. Erfüllt: Diese Runde ist die Folge der Änderung an `CaptchaHost.tsx`; die übrigen genannten Dateien sind nach Lektüre unverändert.
6. Eingehalten: kein Lauf eines der vier Skripte. Der Diff-Auszug aus Auflage 6 der Lösch-Freigabe steht noch aus (Auflage 4).

**Bleibt ein Fund der Vorrunde hoch?** Nein. Runde 1: hoch 0. Stand der mittleren: M1 behoben, M2 und M3 zum Teil offen (Auflagen 1 bis 3), M4 als OFFEN eingetragen.

**Geld, Sicherheit, Schema (Kontrolle der unveränderten Dateien).** Unverändert richtig. `handler.ts`: Eingabe (`:57`) vor Formprüfung des Tokens (`:60-61`), Prüfung bei Cloudflare (`:62-69`), erst dann IP und Zähler (`:71-86`); jeder Wurf der Prüfung wird 503 ohne Wirkung, geloggt nur der Bezeichner (`:67`). `turnstile.ts`: `true` nur bei exakt `success === true` (`:34`), 403 nur bei ausschließlich Token-Codes (`:36`), alles andere wirft (`:37`); Secret nur im POST-Body (`:23`). `route/index.ts`: Secret Pflicht beim Start (`:22`), Log nur das Eintragsobjekt (`:32`). `tests/support/db.ts`: Dummy-Wert als Konstante (`:19`), Anmeldung mit Token (`:41`), gelöscht wird nur die eigene Liste (`:47-49`); Pin im Register gleich dem Hash des Auftrags (`loesch-register.json:30`). Geld ist nicht berührt (kein Preis, keine Gebühr, kein Journal in den geprüften Dateien); kein Schema, keine Migration, keine RLS-Änderung in diesem Schritt. Keine Rechte-Ausweitung: Die Änderung seit Runde 1 betrifft nur ein Attribut der Oberfläche und eine Testzeile.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `src/components/CaptchaHost.tsx:16-21` | Layout-Effekt: `showModal()` bzw. `close()` nach dem Commit der Attribute |
| `src/components/CaptchaHost.tsx:26-28` | `inert` und `aria-hidden` nur im Ruhezustand, Name des Dialogs bleibt |
| `src/components/CaptchaHost.tsx:29-32`, `:39-45` | Esc wird zu Abbrechen; Text und Knopf nur bei offener Karte; unverändert gegenüber Runde 1 |
| `src/app/Shell.tsx:112` | Host einmal in der Shell, außerhalb der Seiten und Sheets |
| `tests/e2e/captcha.spec.ts:33` | neue Prüfung: 0 Dialoge per Rolle im Ruhezustand |
| `tests/e2e/captcha.spec.ts:14`, `:73-80`, `:134-138` | offene Karte per CSS gesucht, Knopf darin per Rolle gefunden und bedient |
| `tests/e2e/captcha.spec.ts:84-95` | Esc: Karte zu, Text, keine Anfrage, Fokus im Feld |
| `tests/e2e/captcha-helpers.ts:23-37`, `:46` | Stub mit derselben Schnittstelle; Cloudflare-Skript ersetzt (M2) |
| `tmp/proof/ts1/024-tests_e2e_captcha.spec.ts.log:1-2`, `:20-28`, `:34` | 9 von 9, Exit 0; Baum unsauber, Commit f9cfebb |
| `tmp/proof/ts1/runs.jsonl:21` | Lauf 021 grün, sauber, Datei-Hash gleich `:16-17` |
| `tmp/proof/ts1/021-tests_rls_captcha-live.test.ts.log:1-5`, `:15-25`, `:33` | Kopf ohne Argumente und Schalter; sechs Tests grün; Exit 0 |
| `tmp/proof/ts1/runs.jsonl:22-23` | `check` grün und `e2e` rot, beide auf f9cfebb mit sauberem Baum |
| `tmp/proof/ts1/runs.jsonl:24-29` | sechs gezielte e2e-Läufe grün (9, 38, 82, 60, 48, 46), alle unsauber auf f9cfebb |
| `tmp/proof/ts1/023-e2e.log:4615-4722` | 101 Fehler, nur fünf Dateien, 631 bestanden, Exit 1 |
| `tmp/proof/ts1/023-e2e.log:755-768`, `:917-919` | Rollen-Abfrage zählt 1 statt 0 bzw. trifft zwei Elemente, das zweite der ruhende Host mit `inert` |
| Suche in `023-e2e.log` nach dem Ort der Abfrage | 95 Blöcke, alle dieselbe Rollen-Abfrage |
| Logs 025 bis 029, Schlusszeilen | je Exit 0 mit den Zahlen aus dem Auftrag |
| `tests/rls/captcha-live.test.ts:29-50`, `:58-74`, `:76-93` | unverändert: vier Formfälle, Positivkontrolle, Auth ohne und mit Token, Code-Weg ohne Token |
| `src/lib/auth.ts:27-39`, `:42-49`, `:55-60` | unverändert: Code vor Status, Abbildung der Widget-Fehler, Adresse zuerst |
| `src/lib/turnstile.ts:59-74`, `:76-110`, `:113-117` | unverändert: Laden im Aufruf, Reset, Zeitgrenze, Warteschlange |
| `src/lib/route.ts:26-41` | unverändert: frisches Token, 403 wird Text der Sicherheitsprüfung |
| `supabase/config.toml:214-219` | unverändert: Abschnitt mit `env(...)`, kein Wert |
| `supabase/functions/_shared/route/handler.ts:42-69`, `:71-86`, `:99-104` | Reihenfolge und Fehlerwege wie in Runde 1 |
| `supabase/functions/_shared/turnstile.ts:16-17`, `:20-38` | Code-Listen und Abbildung wie in Runde 1 |
| `supabase/functions/route/index.ts:12-16`, `:22`, `:31-32` | wie in Runde 1 |
| `tests/support/db.ts:18-19`, `:33-49` | wie in Runde 1 |
| `scripts/sys/loesch-register.json:8-10`, `:14`, `:30` | vier Skripte, Bindung, Pin gleich Auftrag |
| `docs/freigaben/ts1-loesch-freigabe-1.md:1-6`, `:58-65`, `:134` | Kopf, Auflagen, Schlusszeile unverändert |
| `tmp/probe-captcha.mjs:7-11` | zwei Aufrufe ohne Token, Ausgabe nur Name, Status, Code, Meldung (N12) |
| `tmp/probe-route.mjs:4-11` | ein anderes Token und der Dummy-Wert an `route`, Ausgabe nur Status |
| `tmp/probe-leftover.mjs:4-14` | nur lesend, zählt zwei Präfixe |
| `docs/GOLIVE.md:19`, `:33`, `:54` | M1 behoben |
| `docs/GOLIVE.md:37`, `:47`, `:90` | M4: wirkungsfreie Probe in 13, 18, 49 |
| `docs/GOLIVE.md:59`, `:92` | N3 und N6 behoben |
| `docs/GOLIVE.md:107` | `golive-check` prüft Turnstile nicht (M4-Rest, zutreffend beschrieben) |
| `docs/ARCHITECTURE.md:190`, `:195`, `:200` | M1 behoben; `quote` ohne Turnstile-Secret richtig |
| `docs/OFFEN.md:78` | (b) mit Messung, (d) erweitert, (d2) und (g) zum Teil veraltet (N8) |
| `docs/ENTSCHEIDUNGEN.md:223` | N4 behoben |
| `docs/STAND.md:7-9`, `:22`, `docs/BEKS.md:37-38` | veraltet (N8) |
| `scripts/sys/fertig.mjs:16` | Mindestmenge: die sechs Pflichtdateien ja, `src/components/` und `tests/e2e/` nein |
| `scripts/sys/abnahme-lib.mjs:20-23`, `scripts/sys/gate-db-lib.mjs:39-50` | Format dieser Datei: eine Vorgänger-Zeile, Hash-Zeilen, eine Schlusszeile |
| Suche `tmp/` nach Laufprotokollen des Lösch-Gates | keines unter `tmp/proof/ts1/`: kein Lauf der vier Skripte |
| Suche `src/` nach weiteren Auth-Einstiegen | keine Registrierung mit Passwort, kein Reset, kein anonymes Konto, kein erneutes Senden (N11) |
| Suche `tests/e2e/` nach Rollen-Abfragen nach Dialogen | neun Dateien; die fünf roten nutzen die Abfrage ohne Namen |

Offene Findings hoch: 0
