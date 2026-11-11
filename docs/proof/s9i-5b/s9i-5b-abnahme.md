Modell: claude-fable-5-2

# Abnahme s9i-5b (Partner-Portal 1b: MFA/TOTP-Schranke, Dokumente der Firma)

- Datum: 2026-11-11
- Berater: advisor-report (Geld, Sicherheit, Schema). Kein Geld in dieser Session; geprüft wurde Sicherheitslogik und Testbeweis.
- Geprüfter Umfang (vollständig gelesen): `src/lib/mfa.ts`, `src/lib/partnerDocs.ts`, `src/screens/partner/Mfa.tsx`, `src/screens/partner/Dokumente.tsx`, `src/screens/Partner.tsx`, `tests/support/totp.ts`, `tests/e2e/mfa-helpers.ts`, `tests/rls/partner-documents.test.ts`, `tests/e2e/partner-mfa.spec.ts`, `tests/unit/mfa-client.test.ts`, `tests/unit/partner-docs.test.ts`, `docs/GOLIVE.md` Punkte 25 und 31, `docs/OPEN_ISSUES.md` (S9h4-1, S9i5b-1 bis S9i5b-4, dazu S2-M2), `tmp/proof/s9i-5b-plan.md`, `tmp/proof/s9i-5b-bildsicht.md`.
- Zum Gegenlesen nachgeschlagen: Migrationen 0015, 0023, 0024, 0025, 0026 (nur die Stellen zu Dokumenten, aal2, `audit_log`), `src/lib/photos.ts`, `src/lib/prices.ts` (`useLoad`), `src/lib/partner.ts`, `src/lib/supabase.ts`, `src/lib/session.tsx`, `src/app/router.tsx`, `tests/support/db.ts`, `owner.ts`, `partner.ts`, `tests/e2e/auth-helpers.ts`, `tests/shots/partner.spec.ts`, `supabase/config.toml` (Auth), `node_modules/@supabase/auth-js/src/GoTrueClient.ts` (QR-Präfix), Logs `tmp/proof/s9i-5b-*.log`.
- Nicht ausgeführt: Ich habe keinen Test und keinen Build laufen lassen und Dev nicht abgefragt. Aussagen zu Läufen stammen aus den Logs; Aussagen zum Verhalten der App und der Tests aus dem Quelltext.

## Ergebnis in Kürze

Die Sicherheitslogik hält: Die Schranke ist richtig als reine Bedienführung gebaut, die Durchsetzung liegt in der Datenbank und im Bucket. Schlüssel und QR bleiben im Komponentenzustand. Verifizierte Faktoren fasst die App nicht an. Kein Befund zu Rechten, RLS oder Secrets.

Ein hoher Befund, kein Sicherheitsloch, aber ein Ablauffehler mit nicht umkehrbarer Wirkung auf dem Server: Wiederholtes „Hochladen“ nach gescheitertem Upload legt jedes Mal eine neue, für die Firma unlöschbare Zeile an (H1). Der Fix ist klein, liegt aber in `run()`, derselben Funktion, die die 42501-Zuordnung trägt; ich will ihn vor dem Commit noch einmal sehen (nur `Dokumente.tsx` und den neuen E2E-Test).

Dazu offen: kein grünes E2E-Log für den Endstand (M1; die E2E-Tests habe ich nur gelesen), drei Testlücken (M2 bis M4), ein fehlender Schritt im Reset-Ablauf (M5), Aufräumlücken (M6).

## Findings

### hoch

**H1 – `src/screens/partner/Dokumente.tsx:36-41` und `:59-62` – Wiederholtes „Hochladen“ verbrennt Plätze.**
Scheitert der Upload nach angelegter Zeile (Netzabbruch während der Übertragung, 413, 415), bleibt die Datei im Formular gewählt (`setFile(null)` nur im Erfolgsfall, Zeile 40) und der Knopf aktiv. Ein zweiter Klick ruft `run(file, null)` und damit erneut `createDocument` (Zeile 37): neue Zeile, neue `id`. Der Fehlertext lädt dazu ein („versuche es erneut“). Fünf Fehlversuche füllen alle fünf Plätze mit Zeilen ohne Datei und der zufällig gewählten Art; die Firma kann sie nicht löschen (0024:181-186), frei gibt sie nur admin per Skript (eine Admin-Oberfläche gibt es nicht). Ein großer Upload im Mobilnetz scheitert deutlich eher als das kleine Insert davor, der Fall ist also der normale Fehlerfall, nicht ein Randfall. Es ist genau der Zustand, den der Plan mit „kein Limit-Deadlock“ vermeiden wollte. Kein E2E deckt den zweiten Klick ab (der 415-Test geht über „Erneut hochladen“, `partner-mfa.spec.ts:328-345`).
Einstufung hoch, weil die Wirkung auf dem Server bleibt (nur anfügen) und der Auslöser normales Nutzerverhalten ist; nicht wegen eines Sicherheitsrisikos.
Fix (einfachste Variante): In `run` merken, ob in diesem Lauf eine Zeile entstand (Flag nach erfolgreichem `createDocument`, nur wenn `existing` leer war). Im `catch`, wenn eine Zeile entstand: Auswahl leeren (`setFile(null)`, `setFileKey((k) => k + 1)`) und den Fehlertext um „Tippe beim Eintrag auf ‚Erneut hochladen‘.“ ergänzen. Damit führt der einzige Weg auf dieselbe `id`. Der Zweig `denied` (Zeile 43-50) bleibt unverändert davor. E2E dazu: nach 415 und nach Netzabbruch ist „Hochladen“ gesperrt, `docs.inserts` bleibt bei 1, „Erneut hochladen“ lädt auf dieselbe `id`. In S9i5b-4 (`docs/OPEN_ISSUES.md:549`) den Satz ergänzen, dass ein gescheiterter Upload nur über „Erneut hochladen“ wiederholt wird.

### mittel

**M1 – Nachweis: kein grünes E2E-Log für den Endstand.**
Unter `tmp/proof/` liegen `s9i-5b-check-1.log` (923 Tests, EXIT=0), `s9i-5b-rls-doc-1.log` (9 Tests, EXIT=0, nichts übersprungen) und `s9i-5b-rot.log` (23 rot, EXIT=1). Ein grüner Lauf von `tests/e2e/partner-mfa.spec.ts` fehlt. Laut Git-Status sind `Mfa.tsx`, `Dokumente.tsx`, `Surfaces.tsx`, `Registrierung.tsx`, `mfa-helpers.ts` und `partner-mfa.spec.ts` nach dem WIP-Commit geändert; ob `check-1` den Endstand misst, ist aus dem Log nicht ablesbar.
Fix: Nach H1 (und den Test-Fixes unten) `check`, `test:e2e` (mindestens `partner-mfa.spec.ts`, dann voll) und `test:rls` (voll) über den `test-runner` laufen lassen, je mit EXIT im Log, und die Logs nennen. Ohne diese drei Logs kein Commit auf main. Benannte Vorbedingung, wie in 5a (Volllauf nach der Abnahme).

**M2 – `tests/e2e/partner-mfa.spec.ts:71-73` – QR-Darstellung ist nicht belegt.**
Der Test prüft nur Sichtbarkeit und den Anfang von `src`. Ein kaputtes Bild mit fester Breite und Höhe (`Mfa.tsx:142`, 176 px) besteht beides. Genau das zeigt die Bildsicht in Runde 1 und Runde 2 (kaputtes Bild-Icon statt Quadrat; dort als mittel offen). Im heutigen Mock steht kein Rautezeichen mehr (`mfa-helpers.ts:59`), die Aufnahme ist danach aber nicht wiederholt; ob das Bild jetzt lädt, ist offen. Dass die echte Antwort ohne Escapen lädt, steht nur als Kommentar da (`mfa-helpers.ts:58`); supabase-js hängt den Rohtext unverändert an das Präfix (`GoTrueClient.ts:5830`).
Fix: (a) im Test `expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)`; (b) Shot `einrichtung-qr` (320 hell/dunkel, 390 hell) neu aufnehmen und vom `reviewer` sichten lassen; (c) robust machen in `src/lib/mfa.ts:71`: den Rohtext hinter dem Präfix neu verpacken, `'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(rohtext)`, dann hängt die Darstellung nicht mehr am Inhalt des SVG. Der Schlüssel zum Abtippen bleibt als Ausweichweg, darum mittel.

**M3 – `src/screens/partner/Dokumente.tsx:43-49` – Der Weg „verweigert und nicht mehr aal2 → zurück zur Schranke“ ist ungetestet.**
Es gibt nur den Gegenfall („42501 trotz aal2, keine Schleife“, `partner-mfa.spec.ts:380-389`). `onDenied` wird in keinem Test ausgelöst. Dazu prüft der RLS-Test die Ablehnungen des Storage-Dienstes nur auf „Fehler vorhanden“: den aal1-Upload (`partner-documents.test.ts:82-83`) und den zweiten Upload auf einen belegten Pfad (`:96-97`). Welchen Status der Dienst dort liefert, den `storageFailure` als `denied` bzw. `exists` liest (`partnerDocs.ts:96-97`), ist damit nicht belegt. Antwortet er anders als 401/403, greift der Rückweg nie und niemand merkt es.
Fix: (a) E2E: mit aal2 öffnen, dann die gespeicherte Sitzung auf ein aal1-Token setzen (oder den Refresh mit aal1 beantworten), Insert mit 42501 beantworten; erwartet: Überschrift „Code eingeben“, keine Dokumente, `mfa.log` ohne `enroll`. (b) RLS: in Zeile 83 und 97 den Status des Fehlers als Ist-Wert verlangen (erwartet 403 bzw. 409) und `storageFailure` daran ausrichten, falls er abweicht.

**M4 – `tests/rls/partner-documents.test.ts:151-153, :158, :166, :169` – Fremdes Schreiben wird nie auf einem freien Platz gemessen.**
Alle vier Fälle scheitern auch ohne die Firmenprüfung: 151 und 169 zielen auf Pfade ohne Zeile, 158 und 166 auf schon belegte Pfade (kein Upsert). Der Fall, den die Policy `partner_document_slot` (0024:169-177, `d.partner_id = my_member_partner_id()`) eigentlich abwehrt, ein fremdes aal2-Token auf einen freien Platz der Firma A (Zeile da, Datei fehlt), kommt mit echten Token nicht vor. Lesen ist dagegen sauber belegt (Zeile 136 gegen 137, 146, 157).
Fix: Firma A legt eine fünfte Zeile ohne Datei an (`free`). Dann `up(b.jwt2, aFirm/free)` und `up(cust.user.jwt2, aFirm/free)`: Fehler und `exists` falsch; danach `up(a.jwt2, aFirm/free)`: klappt, `exists` wahr. Zeile 158 auf eine freie Zeile von B umstellen und `exists` prüfen. Die Zeilenzahl im Admin-Test (Zeile 177) anpassen.

**M5 – `docs/GOLIVE.md:56` (Punkt 25) – Der Reset-Ablauf beendet keine Sitzungen.**
Geräteverlust heißt oft: das Gerät mit laufender Sitzung ist weg. Eine aal2-Sitzung läuft heute unbegrenzt (S9i5b-1, `config.toml:274-278` auskommentiert), ein ausgestelltes Token gilt bis zu 3600 s (`config.toml:166`). Der Ablauf beschreibt Rückruf und Faktor löschen, aber nicht das Beenden der Sitzungen. Ob das Löschen des Faktors im Dashboard bestehende aal2-Sitzungen herabstuft, ist nicht belegt (die Probe deckt nur `verify` ab, S9i5b-3). Bis zum Beweis des Gegenteils behält ein gefundenes oder gestohlenes Gerät den Zugriff auf Dokumente und später auf das Portal.
Fix (nur Doku und Probe, kein Code): In Punkt 25 als festen Schritt aufnehmen: vor dem Löschen des Faktors alle Sitzungen des Kontos beenden (Dashboard, Konto abmelden; sonst als Eigentümer die Sitzungen des Kontos löschen). Die Prüfspalte ergänzen: „in der Probe liest eine vorher geöffnete aal2-Sitzung nach dem Reset und nach Ablauf des Tokens (höchstens eine Stunde) keine Datei mehr“. Die Restlaufzeit des Tokens im Text nennen.

**M6 – Aufräumen der Tests: „0 Reste“ ist nur für den grünen Lauf plausibel und nirgends gemessen.**
- `tests/rls/partner-documents.test.ts:15` mit `tests/support/totp.ts:30, :38, :48`: Wirft `tryAal2User` auf oberster Ebene (Rate-Limit beim Einrichten ist der wahrscheinlichste Auslöser), bricht das Modul ab, bevor `afterAll` (Zeile 45) registriert ist. Das Konto `doc-a-…` bleibt auf Dev. Der Sweep in `beforeAll` (Zeile 38-43) kennt nur Firmen mit Namensanfang, keine Konten; `tests/support/sweep.ts` nur `pt-…`-Adressen.
  Fix: in `tryAal2User` den Rumpf nach `makeUser` in `try { … } catch (e) { await deleteUsers(); throw e }` fassen. Zusätzlich im `beforeAll` der Datei Konten mit `doc-`-Anfang aus früheren Läufen entfernen.
- `tests/support/db.ts:44-46` und `partner-documents.test.ts:31-34`: `deleteUser`, `list` und `remove` verwerfen Fehler. Schlägt das Aufräumen fehl, bleibt der Lauf grün.
  Fix: Fehler werfen (`if (error) throw error`).
- `partner-documents.test.ts:175`: `admin_remove_partner_document` läuft committet über `service.rpc`. Die Zeile in `audit_log` (0024:116-118, mit Firmen-ID und Pfad) bleibt für immer (nur anfügen, Trigger 0015:40-43; `actor_id` ohne Fremdschlüssel, 0015:22, das Konto lässt sich also löschen). Je Lauf mindestens eine Zeile. `partner-admin.test.ts` vermeidet das per Rollback.
  Fix: entweder so belassen und in `docs/PROGRESS.md` festhalten, dass dieser Test je Lauf eine Audit-Zeile auf Dev hinterlässt, oder den Fall als Rollback-Probe nach `partner-admin.test.ts` verlegen. „0 Reste“ dann nicht mehr ohne diesen Zusatz behaupten.
- Es gibt keine Messung nach dem Lauf.
  Fix: am Ende von `afterAll` zählen und prüfen: Firmen mit dem Namensanfang 0, Objekte in den Firmenordnern 0, Konten des Laufs 0 (Ist-Werte ins Log).
Ich kann „0 Reste auf Dev“ nicht bestätigen: Ich habe Dev nicht abgefragt, und für `audit_log` gilt es schon vom Aufbau her nicht.

### niedrig

**N1 – `docs/GOLIVE.md:56` – Formulierung zu `unenroll`/`enroll` ist zu breit.** „Supabase verweigert `unenroll` und `enroll` bei `aal1`“ gilt laut Probe nur, sobald ein verifizierter Faktor existiert; unverifizierte entfernt die App selbst mit aal1 (`mfa.ts:6-7, :67`). Fix: „… verweigert bei vorhandenem verifiziertem Faktor …“ und „kein Weg, der verifizierte Faktoren ohne aal2 entfernt“.

**N2 – `docs/OPEN_ISSUES.md:340` (S2-M2) – Stand nicht nachgezogen.** Der neue Test erledigt „echte aal2-Token über die Storage-API, zu große Datei, falscher Content-Type“. Offen bleibt „mit und ohne 0025“ und die Entscheidung Policy gegen signierte Upload-URL. Dazu neu: `loadDocuments` braucht die Select-Policy aus 0025 jetzt für „Datei fehlt“ (`partnerDocs.ts:118`), die Frage „ist die Policy nötig“ ist damit von der App beantwortet. Fix: Zeile S2-M2 mit diesem Stand ergänzen (Edit), nicht schließen.

**N3 – `src/lib/partnerDocs.ts:62` – Zuordnung „zu groß“ per Suche im deutschen Fehlertext von `PhotoError`.** Ändert jemand den Text in `photos.ts:23`, wird daraus still `bad_type` (der Text wird dann immerhin durchgereicht). Fix: die Größe vor `preparePhoto` selbst prüfen (`file.size > MAX_DOC_BYTES`) oder `PhotoError` um ein Feld `kind` ergänzen.

**N4 – `src/screens/partner/Mfa.tsx:101` – `factor_gone` in der Einrichtung führt stumm zurück zum Start.** Der Text `mfaErrorText.factor_gone` existiert, wird hier aber nicht gezeigt. Fix: zusätzlich `setStartError(mfaErrorText.factor_gone)`.

**N5 – `src/lib/mfa.ts:63-67` – Zeitfenster zwischen `listFactors` und `unenroll` (nur selber Browser).** Von einem zweiten Gerät aus schützt der Server (aal1 darf keinen verifizierten Faktor entfernen). Teilen sich zwei Tabs eine Sitzung und bestätigt der eine genau zwischen Liste und `unenroll` des anderen, trägt die gemeinsame Sitzung aal2 und der gerade bestätigte Faktor würde entfernt. Fenster im Millisekundenbereich, Schaden: eigener Faktor weg, Einrichtung von vorn. Fix (optional, eine Zeile): am Anfang von `startEnrollment` das Niveau lesen und bei aal2 mit `insufficient_aal` abbrechen; sonst als bekannt stehen lassen.

**N6 – `src/screens/partner/Dokumente.tsx:43-51` – Verweigerung bei bestehendem aal2 zeigt nur den allgemeinen Text, die Statuskarte bleibt alt.** Betrifft: Firma inzwischen gesperrt oder abgelehnt (Nachladen auf eine alte Zeile), Zeile von admin entfernt. Richtig ist, dass keine Schleife entsteht. Fix: bei `denied` mit aal2 und bei `not_active` zusätzlich die Firma neu laden (Rückruf an `Firma`, `retry` aus `Partner.tsx:31`); dann zeigt die Karte den neuen Status und die Dokumente verschwinden.

**N7 – Hinweis, keine Änderung: Metadaten sind mit aal1 lesbar.** `partner_documents_select` hängt an `partner_of_user()` ohne aal (0024:195-196, 0023:76-78); der RLS-Test hält das fest (`partner-documents.test.ts:138`). Wer nur das Postfach hat, sieht über die API Art und Datum der Dokumente der Firma (kein Pfad, keine Datei) sowie die Firmenzeile (0023:240, :244-245). Das war die Entscheidung aus 0024 und 5a; der Satz „die Datenbank verlangt aal2“ gilt für Dateien und für jedes Schreiben, nicht für diese Metadaten.

**N8 – `supabase/config.toml:198-210, :298-311` – Kein Wert für das Limit von MFA-Versuchen im Repo.** Die Datei kennt für MFA nur die Schalter und die Höchstzahl der Faktoren, kein eigenes Limit für Challenge/Verify. Die App begrenzt Code-Versuche nicht selbst (richtig, das wäre umgehbar); die Grenze setzt allein das Projekt, und `config.toml` wird nie gepusht. Fix: in GOLIVE 31 aufnehmen: Limit für Challenge/Verify im Produktiv-Dashboard ablesen und notieren.

**N9 – `tests/e2e/mfa-helpers.ts:189-192` – `noSecret` sieht nur `localStorage` und `sessionStorage`.** Cache Storage und IndexedDB fehlen. In den fünf Dateien gibt es dorthin keinen Schreibweg (kein Treffer für Speicher- oder Konsolenaufrufe), darum niedrig. Fix: beide in die Prüfung aufnehmen, sobald ein Service Worker mit Laufzeit-Caching dazukommt.

**N10 – Bildsicht, Rest aus Runde 2 (alle niedrig):** Leerraum unter „Erneut hochladen“ und Stapelung auch bei 1280 px; eckiger Fokusrahmen an der runden Kartenecke der Zeile „Datei“; blasser Titel in der Kopfleiste zweier Shots; Kontrast des gesperrten Knopfs. Kein Sicherheitsbezug; in `docs/OPEN_ISSUES.md` aufnehmen oder beheben.

## Antworten auf die Prüffragen

**(1) Umgehbarkeit der Schranke.** Die Aussage stimmt: Die App entscheidet nur die Anzeige (`mfa.ts:45-53` liest das Niveau aus dem Token; `Mfa.tsx:21` rendert die Dokumente nur bei `done`; `Partner.tsx:65` ist die einzige Stelle, die `Dokumente` einhängt; nur fünf Dateien unter `src/` berühren MFA oder Dokumente). Ein manipuliertes Token im Browser ändert die Anzeige, nicht die Daten: Insert der Zeile verlangt aal2 (0024:139-142 über 0023:81-86), Upload und Lesen der Datei ebenso (0024:169-177, 204-205; 0025:5-6), der Statusfilter liegt im Server (0024:144, :175). Ein App-Weg ohne aal2 zu Dateien oder zum Schreiben existiert nicht. Ohne aal2 erreichbar sind nur die Statuskarte und, über die API, die Metadaten der eigenen Dokumente (N7, so entschieden). `rejected` und `suspended` bekommen keine Abfrage und keine Dokumente (`Partner.tsx:15, :65`), der Server verweigert dort ohnehin. Die Kontaktfelder der Firma (auch die Rückrufnummer aus GOLIVE 25) lassen sich nur mit aal2 ändern (0023:242, :247-249); wer nur das Postfach hat, kann die Nummer also nicht umstellen, solange ein verifizierter Faktor besteht. Restrisiko nach Bauart: Ein Konto ohne verifizierten Faktor richtet der ein, der zuerst mit dem Postfach kommt; die Faktor-Mails aus GOLIVE 31 sind dafür die richtige Gegenmaßnahme.

**(2) Secret und QR.** Erfüllt. Beides liegt nur in `useState` der Einrichtung (`Mfa.tsx:96`), verschwindet mit dem Neuladen der Schranke nach der Bestätigung (`Mfa.tsx:22-25`, die Komponente wird ausgehängt) und beim Abmelden (`Partner.tsx:24`). Der QR steht nur als `src` eines `img` (`Mfa.tsx:142`), nie als eingefügtes Markup; der Schlüssel als Text zum Abtippen (`Mfa.tsx:144`, gewollt). `MfaError` trägt nur die Art, nie Text oder Antwort des Dienstes (`mfa.ts:12-16, :30-37`). Kein Speicher-, kein Konsolenaufruf in den geprüften Dateien. Der E2E prüft Speicher und Konsole auf den Schlüssel (`partner-mfa.spec.ts:96, :103`). Offen ist nur, ob der QR überhaupt lädt (M2).

**(3) 42501 ohne Schleife.** Die Logik ist richtig: Bei `denied` liest `run` erst das Niveau (`Dokumente.tsx:45`); nur wenn die Sitzung nachweislich nicht aal2 ist, geht es zur Schranke, sonst (auch bei Lesefehler) bleibt der allgemeine Text. Die Schranke zeigt danach Code-Abfrage oder Einrichtung und kommt erst mit aal2 zurück; ein Pendeln ist nicht möglich. `finally` läuft auch nach `return` (Zeile 52-56), das Neuladen der Liste trifft dann eine ausgehängte Komponente und bleibt folgenlos. Getestet ist nur der Zweig „bleibt“ (M3).

**(4) Races.** Doppelklick: synchron gesperrt über Refs (`Dokumente.tsx:30-31`, `Mfa.tsx:45-46, :104-105`), dazu `disabled`. Zwei Geräte bei der Einrichtung: Das zweite räumt den unverifizierten Faktor des ersten weg, dort folgt `factor_gone` und Neustart (`Mfa.tsx:101`, N4); hat das andere Gerät schon bestätigt, kommt `insufficient_aal` und die Code-Abfrage (`mfa.ts:65`, `Mfa.tsx:113`). Zwei Geräte beim Upload: Limit 5 unter Advisory-Lock im Server (0024:145-146); ein zweiter Upload auf denselben Pfad scheitert (RLS-Test Zeile 96-99, die Datei bleibt), die App erwartet dafür 409 und zeigt „liegt schon vor“ (`partnerDocs.ts:97`), der Status selbst ist nicht belegt (M3 b). Zeile ohne Datei: Nachladen auf dieselbe `id` ist richtig gebaut und getestet; nicht bedacht ist der zweite Klick auf „Hochladen“ (H1).

**(5) Aufräumen unverifizierter Faktoren.** Einen verifizierten Faktor kann es praktisch nicht treffen: Abbruch, sobald die Liste einen verifizierten TOTP-Faktor zeigt (`mfa.ts:65`), entfernt werden nur Einträge mit Status unverifiziert (`mfa.ts:67`), und der Server verweigert das Entfernen eines verifizierten mit aal1 (Probe im Plan). Unit- und E2E-Test belegen „kein `unenroll`, kein `enroll`“ bei vorhandenem verifiziertem Faktor (`mfa-client.test.ts:61-65`, `partner-mfa.spec.ts:183-188, :190-198`). Rest: das Millisekundenfenster im selben Browser (N5).

**(6) Tests.**
- Ist-Wert: Der RLS-Test misst das Objekt im Bucket mit dem Dienstschlüssel (`exists`, Zeile 25-30) und hat je Verbot einen Gegenfall auf demselben Pfad (84/88, 109/111, 123/125). Typ und Größe sind mit dem Status belegt (415, 413). Nicht vakuös für aal1 gegen aal2, Typ, Größe, Lesen fremder Firmen. Nicht trennscharf für fremdes Schreiben (M4). Der Lauf im Log hat alle 9 Tests ausgeführt, nichts übersprungen; die Skip-Weiche greift nur bei abgeschaltetem TOTP und bricht bei jedem anderen Fehler ab (`totp.ts:29-30`), das ist richtig.
- TOTP-Zeitfenster: beide Helfer warten bei weniger als 6 s Rest auf das nächste Fenster (`totp.ts:19-23`, `mfa-helpers.ts:32-36`); der E2E-Mock prüft wirklich mit Fenster plus/minus eins (`mfa-helpers.ts:83`), es gibt keinen festen Code. Regel eingehalten.
- Rate-Limit: je Lauf drei Einrichtungen mit Challenge und Verify und fünf Anmeldungen, je 400 ms Pause; gegen 30 Anmeldungen je 5 Minuten (`config.toml:208`) unkritisch, im Volllauf addieren sich die Dateien. Die Werte auf Dev können abweichen (Datei wird nie gepusht). Ein Limit-Fehler führt heute zu einem liegengebliebenen Konto (M6).
- Aufräumen: im grünen Lauf nach Quelltext vollständig für Konten, Firmen, Dateien; nicht gemessen, Fehler werden verschluckt, eine Audit-Zeile bleibt (M6).
- E2E: Abdeckung der Abläufe ist breit und prüft Aufruf-Reihenfolgen am Mock (`mfa.log`), nicht nur Texte. Lücken: H1 (zweiter Klick), M2 (QR lädt), M3 (Rückweg zur Schranke). Kein grünes Log (M1).
- Unit: Fehlerzuordnung, Pfad, kein Upsert, Spaltenliste sind geprüft; keine Auffälligkeit.

**(7) Bildsicht.** Stand laut Bericht: Runde 1 ein hoher Befund (Überlagerung Name/Knopf bei 320 px), in Runde 2 behoben, dort hoch 0. Offen mittel: QR-Aufnahme zeigt ein kaputtes Bild (hier M2). Offen niedrig: vier Punkte (N10). Die Tabelle der Runde 2 enthält je Zeile eine eigene Bildbeobachtung; zwei Zeilen der Runde 1 („nicht einzeln geprüft“) gelten nach Projektregel als ungeprüft, `dokumente-liste` 1280 hell ist durch Runde 2 ersetzt, `code-zu-viele-versuche` 1280 hell bleibt ungeprüft (niedrig).

## Doku-Abgleich

- GOLIVE 25 (`docs/GOLIVE.md:56`): Entscheidung des Vorgängers richtig wiedergegeben (kein App-Weg, Rückruf der gespeicherten Nummer, Protokoll von Hand, Verweis aufs Impressum; die Route existiert, `router.tsx:72`, der Hinweis steht in `Mfa.tsx:84-90`). Ergänzen: Sitzungen beenden (M5), Formulierung (N1).
- GOLIVE 31 (`docs/GOLIVE.md:65`): deckt sich mit S9i5b-1 und `config.toml:274-278`. Ergänzen: Limit für MFA-Versuche (N8).
- OPEN_ISSUES S9h4-1 (`:483`): Erweiterung um Bewerber ohne Aufträge passt zu S9i5-2 (`:541`). S9i5b-1 bis -4 (`:546-549`) decken sich mit Code und Plan (S9i5b-4 mit `partnerDocs.ts:50-56`, S9i5b-3 mit `totp.ts:9`). S2-M2 (`:340`) fehlt der neue Stand (N2).

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `supabase/migrations/…0023_partners.sql:81-86` | `my_member_partner_id` verlangt `aal2` aus dem Token; passt zur Aussage in `mfa.ts:5` |
| `…0023_partners.sql:76-78`, `:240`, `:244-245`, `:251-252` | Firmenzeile und Mitgliedschaft mit jedem aal lesbar (Statuskarte), wie in 5a entschieden |
| `…0023_partners.sql:242`, `:247-249` | Ändern nur der drei Kontaktfelder, nur mit aal2 und in den drei offenen Status |
| `…0024_partner_admin.sql:135-151` | Trigger: Mitglied mit aal2, Status, Limit 5 unter Lock, Server setzt Firma und Pfad; passt zu `createDocument` (nur `id`, `kind`) |
| `…0024_partner_admin.sql:169-177`, `:204-205` | Upload nur auf Pfad einer eigenen Zeile, aal2, Status; passt zu `uploadDocument` |
| `…0024_partner_admin.sql:191-198` | Spaltenrechte ohne Pfad; Select-Policy ohne aal (N7) |
| `…0025_…read_own.sql:5-6` | Firma liest eigene Objekte nur über den Slot (aal2); `loadDocuments` hängt daran |
| `…0026_document_slot_taken.sql:19` | `slot_taken` bei liegender Datei; im Client als allgemeiner Fehler zugeordnet (`partner-docs.test.ts:81`), richtig |
| `…0024_partner_admin.sql:116-118`, `…0015…:22, :40-43` | Audit-Zeile bleibt nach dem committeten Admin-Test, nur anfügen, kein Fremdschlüssel auf den Akteur (M6) |
| `src/lib/mfa.ts:65-67` | Abbruch bei verifiziertem Faktor vor jedem `unenroll`; Filter auf unverifiziert |
| `src/lib/mfa.ts:30-37` | Fehlerart ohne Text des Dienstes; 429 vor allem anderen |
| `src/screens/partner/Mfa.tsx:96, :142, :144` | Schlüssel und QR nur im Zustand; QR als `img src`; Schlüssel als Text |
| `src/screens/partner/Mfa.tsx:45-46`, `Dokumente.tsx:30-31` | Sperre gegen Doppelklick synchron per Ref |
| `src/screens/partner/Dokumente.tsx:36-41` | Auswahl bleibt nach Fehler stehen, zweiter Klick legt neue Zeile an (H1) |
| `src/screens/partner/Dokumente.tsx:43-51` | Niveau wird vor dem Rückweg gelesen; keine Schleife |
| `src/screens/Partner.tsx:15, :65` | Schranke nur für pending, active, payment_hold; sonst nur Karte |
| `src/lib/partnerDocs.ts:105` | Upload ohne Upsert auf `{firma}/{id}` |
| `src/lib/partnerDocs.ts:118` | Liste mit Grenze 10; reicht, weil die Policy nur Objekte mit Zeile zeigt (höchstens 5) |
| `src/lib/photos.ts:16-47` | Neu-Kodierung über Canvas, Format- und Größenprüfung; EXIF fällt weg |
| `src/lib/supabase.ts:5-10` | nur URL und Publishable Key; keine Sonderablage für MFA |
| `src/app/router.tsx:72` | Route `/profil/impressum` existiert |
| `node_modules/@supabase/auth-js/src/GoTrueClient.ts:5830` | QR-Rohtext wird unverändert hinter das Präfix gehängt (M2) |
| `tests/support/totp.ts:19-23`, `tests/e2e/mfa-helpers.ts:32-36` | 6-s-Regel umgesetzt |
| `tests/support/totp.ts:29-30` | nur „TOTP abgeschaltet“ überspringt, alles andere wirft (ohne Aufräumen, M6) |
| `tests/rls/partner-documents.test.ts:82-88` | aal1 scheitert und Objekt fehlt, aal2 klappt und Objekt liegt: Ist-Wert mit Gegenfall |
| `tests/rls/partner-documents.test.ts:96-99` | zweiter Upload scheitert, Datei bleibt JPEG; Status des Fehlers nicht geprüft (M3 b) |
| `tests/rls/partner-documents.test.ts:136-139` | Lesen aal2 vier Dateien, aal1 keine; Metadaten mit beiden |
| `tests/rls/partner-documents.test.ts:151-158, :166, :169` | nicht trennscharf (M4) |
| `tests/e2e/partner-mfa.spec.ts:71-73` | Sichtbarkeit und `src`-Anfang, kein Beleg, dass das Bild lädt (M2) |
| `tests/e2e/partner-mfa.spec.ts:380-389` | nur der Zweig „keine Schleife“ (M3) |
| `tests/e2e/mfa-helpers.ts:83` | Mock prüft den Code mit Fenster plus/minus eins, kein fester Code |
| `supabase/config.toml:166, :198-210, :274-278, :298-311` | Token 3600 s; kein MFA-Limit im Repo; Sitzungsgrenzen auskommentiert; TOTP an, Telefon aus |
| `tmp/proof/s9i-5b-check-1.log:100-106` | 46 Dateien, 923 Tests, EXIT=0 |
| `tmp/proof/s9i-5b-rls-doc-1.log:5-10` | 1 Datei, 9 Tests bestanden, EXIT=0 |
| `tmp/proof/s9i-5b-rot.log:20-24` | 23 rot, 5 grün, EXIT=1 (Rot-Lauf vor dem Bau); kein grünes Gegenstück (M1) |
| `tmp/proof/s9i-5b-bildsicht.md` (Schluss Runde 2) | hoch 0, mittel 1 (QR), niedrig 4 |

## Weg zur Freigabe

1. H1 beheben, mit E2E; danach kurze Nachprüfung durch den Berater (nur `Dokumente.tsx` und der neue Test).
2. M2 bis M4 und M6 (erster und zweiter Punkt) in den Tests nachziehen; M5, N1, N2, N8 in der Doku.
3. `check`, `test:e2e`, `test:rls` (voll) auf dem Endstand, je EXIT=0 im Log (M1).
4. Niedrige Punkte, die nicht behoben werden, nach `docs/OPEN_ISSUES.md`.

## Kontrollrunde

- Datum: 2026-11-11
- Umfang: nur die Behebung der Funde oben (H1, M2 bis M6, N1 bis N4, N8) und was die Fixes neu berühren. Vollständig gelesen: `src/screens/partner/Dokumente.tsx`, `src/lib/mfa.ts`, `src/lib/partnerDocs.ts`, `src/screens/partner/Mfa.tsx`, `src/screens/Partner.tsx`, `tests/e2e/partner-mfa.spec.ts`, `tests/e2e/mfa-helpers.ts`, `tests/e2e/auth-helpers.ts`, `tests/rls/partner-documents.test.ts`, `tests/support/totp.ts`, `tests/support/db.ts`, `tests/support/owner.ts`, `tests/unit/mfa-client.test.ts`, `vite.config.ts`, Migration 0026. In Auszügen: `docs/GOLIVE.md` Punkte 25 und 31, `docs/OPEN_ISSUES.md` (S2-M2, S9i5b-1 bis -8), `tests/unit/partner-docs.test.ts`, `src/lib/prices.ts` (`useLoad`), Migration 0024 (Trigger, Zeile 135-151), `GoTrueClient.ts` (Sitzung aus dem Speicher, QR-Präfix), `tmp/proof/s9i-5b-bildsicht.md` Runde 3, `tmp/proof/s9i-5b-rls-doc-2.log`.
- Nicht ausgeführt: kein Test, kein Build, keine Abfrage auf Dev. Unten heißt „gelaufen“: im Log belegt; „gelesen“: nur am Quelltext geprüft.
- Zeilenangaben in diesem Abschnitt beziehen sich auf den heutigen Stand der Dateien, nicht auf den Stand der Abnahme oben.

### Ergebnis

H1 ist im Code behoben. Kein neuer hoher Befund. Die Fixes haben keinen Fehler in Rechten, RLS oder Secrets erzeugt.

Zwei Bedingungen vor dem Commit:
1. K1 beheben (mittel, Rest von H1 im harten Offline-Fall; eine Zeile und ein E2E-Fall).
2. M1 bleibt offen: Für den Endstand gibt es nur das Log des einen RLS-Tests. Die Beweise für H1, M2 und M3 (a) sind E2E- und Unit-Tests, die ich gelesen habe; ein Log, dass sie grün laufen, fehlt.

### Stand der Funde

| Fund | Stand | Beleg |
|---|---|---|
| H1 | im Code behoben (gelesen); E2E gelesen, nicht gelaufen | `Dokumente.tsx:36-49, :58`; `partner-mfa.spec.ts:331-352, :398-408` |
| M1 | offen | nur `s9i-5b-rls-doc-2.log`; kein Log von `check` und von `partner-mfa.spec.ts` nach den Fixes |
| M2 | behoben (gelesen); Bildsicht Runde 3 belegt das Quadrat des Mocks | `mfa.ts:71-73`; `partner-mfa.spec.ts:76`; `mfa-client.test.ts:50-57`; `s9i-5b-bildsicht.md:120-127` |
| M3 (a) | Test vorhanden und trennscharf (gelesen), nicht gelaufen | `partner-mfa.spec.ts:410-426` |
| M3 (b) | behoben, gelaufen | `partner-documents.test.ts:105, :120`; Log 10 von 10 |
| M4 | behoben, gelaufen | `partner-documents.test.ts:158-171, :193-198` |
| M5, N1 | Doku erledigt, kleiner Rest K5 | `docs/GOLIVE.md:56` |
| M6 | behoben bis auf K3; gelaufen | `partner-documents.test.ts:16-19, :36-43, :53-56, :68-73`; `docs/OPEN_ISSUES.md:552` |
| N2 | erledigt | `docs/OPEN_ISSUES.md:340` |
| N3 | erledigt (gelesen) | `partnerDocs.ts:52`; `partner-docs.test.ts:52-62` |
| N4 | erledigt (gelesen) | `Mfa.tsx:102-104` |
| N8 | erledigt | `docs/GOLIVE.md:65` |
| N5, N6, N10 | als bekannt vermerkt | `docs/OPEN_ISSUES.md:549-551` |
| N7 | Hinweis, unverändert | – |
| N9 | kein Eintrag (K4) | – |

### Zu den gestellten Fragen

**`created` bei `existing`.** Richtig. Das Flag wird erst nach erfolgreichem `createDocument` gesetzt und nur, wenn `existing` leer war (`Dokumente.tsx:43-44`). Ein Lauf über „Erneut hochladen“ leert die Auswahl des Formulars nicht und hängt keinen Hinweis an; das ist gewollt, die Auswahl gehört dort zu einem anderen, neuen Dokument. Scheitert `prepareDocument` oder `createDocument`, ist keine Zeile entstanden, die Auswahl bleibt, ein zweiter Klick ist unschädlich (Ausnahme K2).

**`finally` mit Neuladen.** Im Zweig `denied` mit Rückweg (`:50-56`) folgt auf `onDenied()` noch `reload()` (`:62`). Beide Zustandsänderungen landen im selben Durchlauf; die Schranke zeigt den Ladezustand, `Dokumente` wird ausgehängt, der Effekt von `useLoad` läuft nicht mehr (`prices.ts:49-60`). Keine Anfrage, kein Fehler. `clearChoice()` vor dem Rückweg (`:49`) ist ebenfalls folgenlos. Der Reihenfolge nach bleibt die Regel aus der Abnahme erhalten: erst Niveau lesen, dann zurück.
Neu sichtbar wird durch das Neuladen aber K1: Schlägt es fehl, fehlt der Eintrag, auf den der neue Hinweis zeigt.

**Fehlertext.** `:58` hängt den Hinweis nur an, wenn in diesem Lauf eine Zeile entstand. Stimmt für 413, 415, Netzabbruch und für `denied` bei bestehendem aal2.

**E2E „verweigert und nur noch aal1“ (`partner-mfa.spec.ts:410-426`).** Der Aufbau trägt: supabase-js liest die Sitzung bei jedem Aufruf aus dem Speicher (`GoTrueClient.ts:3044`), das Niveau kommt aus dem dort liegenden Token (`:6130-6150`); die Liste der Faktoren liefert der Mock mit dem verifizierten Faktor (`mfa-helpers.ts:40-41`), also folgt die Code-Abfrage. Trennscharf: Die Schranke lädt nur beim Einhängen und über `recheck` (`Mfa.tsx:16-21`, `Partner.tsx:65`); ohne `onDenied` erschiene die Überschrift nicht. Der Gegenfall steht daneben (`:387-396`).

**RLS-Log.** `s9i-5b-rls-doc-2.log:5-10`: 1 Datei, 10 Tests bestanden, EXIT=0. Die Datei hat zehn `it`-Blöcke (Zeile 96, 113, 125, 137, 151, 158, 173, 181, 203, 212), übersprungen ist also nichts. Die Messung in `afterAll` (`:68-73`) ist Teil dieses Laufs.

### Neue Findings der Kontrollrunde

#### mittel

**K1 – `src/screens/partner/Dokumente.tsx:70, :81, :144, :160` – Rest von H1: Bei echtem Netzausfall ist der Eintrag nicht zu sehen, das Formular aber offen.**
Bricht das Netz während des Uploads ab, scheitert in der Regel auch das Neuladen in `finally` (`:62`). Die Liste zeigt dann den Fehlerzustand statt der Einträge (`:81`); der Hinweis „Tippe beim Eintrag in der Liste auf ‚Erneut hochladen‘“ zeigt auf etwas, das nicht da ist. `full` ist nur bei geladener Liste wahr (`:70`), Feld und Knopf sperren nur bei `busy || full` (`:144, :160`): Das Formular bleibt bedienbar. Wer die Datei neu wählt und „Hochladen“ tippt, legt eine zweite Zeile an; die erste bleibt ohne Datei stehen.
Gegenüber H1 deutlich entschärft (die Auswahl ist leer, es braucht eine bewusste neue Wahl, und die verwaiste Zeile bleibt über „Erneut hochladen“ nutzbar), darum mittel. Die Wirkung ist aber dieselbe (unlöschbare Zeile), und der Auslöser ist der Fall, mit dem H1 begründet war.
Der Offline-Test deckt das nicht: Er bricht nur die Objekt-Route ab (`partner-mfa.spec.ts:400`), die Listen-Route antwortet weiter (`mfa-helpers.ts:126-129`); „Datei fehlt“ in `:407` ist nur wegen des Mocks zu sehen.
Fix: Formular sperren, solange die Liste nicht geladen ist: eine Variable aus `busy || full || docs.status !== 'ready'` für Auswahlfeld, Dateifeld und Knopf (`:127, :144, :160`). Dann führt nach einem Netzausfall nur der Wiederholen-Knopf der Liste weiter, danach steht der Eintrag mit „Erneut hochladen“ da. Nebenbei ist damit auch die Grenze von fünf vor dem Laden nicht mehr offen. E2E: Upload und Liste abbrechen; erwartet: Dateifeld und „Hochladen“ gesperrt, `docs.inserts` bei 1; nach Freigabe der Liste und Wiederholen: „Datei fehlt“, „Erneut hochladen“ lädt auf dieselbe `id`.
Vor dem Commit beheben.

#### niedrig

**K2 – `src/lib/partnerDocs.ts:80` mit `Dokumente.tsx:43-44` – Verlorene Antwort beim Anlegen der Zeile.** Ist die Zeile gespeichert, die Antwort aber verloren, gilt der Lauf als „keine Zeile entstanden“: Auswahl bleibt, kein Hinweis, der zweite Klick legt mit neuer `id` eine zweite Zeile an. Selten (kleine Anfrage), die erste Zeile bleibt nutzbar. Fix (optional): die `id` einmal je Dateiauswahl erzeugen und an `createDocument` geben; der zweite Versuch trifft dann den Primärschlüssel (der Trigger lässt ihn ohne liegende Datei durch, 0026:13-21) und die App lädt auf dieselbe `id` weiter. Sonst als Eintrag nach `docs/OPEN_ISSUES.md`.

**K3 – `tests/support/db.ts:44-46` – `deleteUsers` verwirft weiterhin Fehler.** In dieser Testdatei fängt das die Messung auf (`partner-documents.test.ts:69-72`), in allen anderen RLS-Dateien nicht. Der Punkt aus M6 ist damit nur für diese Datei erledigt. Fix: `if (error) throw error` in `deleteUsers`, in einem eigenen Schritt mit RLS-Volllauf; bis dahin Eintrag in `docs/OPEN_ISSUES.md`.

**K4 – N9 fehlt in `docs/OPEN_ISSUES.md`.** S9i5b-5 bis -8 decken N5, N6, N10 und die Audit-Zeile ab; `noSecret` ohne Cache Storage und IndexedDB steht nirgends. Fix: eine Zeile ergänzen.

**K5 – `docs/GOLIVE.md:56` – „Dashboard, Konto abmelden“ ist der einzige genannte Weg.** Ob das Dashboard diese Funktion je Konto bietet, ist nicht belegt. Die Prüfspalte fängt es mit der Probe ab. Fix: den Ausweichweg aus M5 dazuschreiben (als Eigentümer die Sitzungen des Kontos löschen).

**K6 – `src/lib/mfa.ts:72` – Hinweis: Das Präfix wird wörtlich abgeschnitten, und ein echter QR war in der App noch nie zu sehen.** Ändert supabase-js das Präfix, würde doppelt verpackt und das Bild bräche; der E2E mit `naturalWidth` (`partner-mfa.spec.ts:76`) fängt das, weil dort die echte Bibliothek das Präfix setzt (`mfa-helpers.ts:59-60`). Kein Fix nötig. Der Mock ist ein schwarzes Quadrat (`s9i-5b-bildsicht.md:133`); dass ein echter Code lädt und sich scannen lässt, belegt erst die Probe aus GOLIVE 25. Fix: dort in der Prüfspalte „QR mit einer Authenticator-App gescannt“ ergänzen.

**K7 – Hinweise zum RLS-Test, kein Handlungsbedarf.** `partner-documents.test.ts:105` lässt 401 und 403 zu; welcher Wert kam, steht nicht im Log. Das passt zur App, die beide gleich behandelt (`partnerDocs.ts:96`). Die Messung in `afterAll` prüft die Werte, schreibt sie aber nicht ins Log. Der Kunde entsteht im Test „freier Platz“ (`:162-164`) und wird im Test „Kunde“ gebraucht (`:203-207`); scheitert der erste, scheitert der zweite mit.

### Stichproben der Kontrollrunde

| Stelle | Ergebnis |
|---|---|
| `src/screens/partner/Dokumente.tsx:43-44` | Flag erst nach Erfolg von `createDocument`, nur ohne `existing` |
| `src/screens/partner/Dokumente.tsx:47, :49` | Auswahl geleert bei Erfolg und bei Fehler nach angelegter Zeile; Dateifeld wird neu eingehängt (`:140`) |
| `src/screens/partner/Dokumente.tsx:50-57` | Niveau wird weiter vor dem Rückweg gelesen; Lesefehler führt nicht zur Schranke |
| `src/screens/partner/Dokumente.tsx:59-63` | `finally` mit Neuladen, im Rückweg folgenlos (mit `prices.ts:49-64`) |
| `src/screens/partner/Dokumente.tsx:70, :144, :160` | Sperre nur über `busy` und `full`; `full` nur bei geladener Liste (K1) |
| `src/lib/mfa.ts:71-73` | Präfix entfernt, Rohtext mit `encodeURIComponent` neu verpackt |
| `node_modules/@supabase/auth-js/src/GoTrueClient.ts:5830` | Präfix stimmt Zeichen für Zeichen mit dem Muster in `mfa.ts:72` überein |
| `tests/unit/mfa-client.test.ts:50, :57` | Antwort mit Rautezeichen im SVG; erwartet wird die maskierte Fassung |
| `tests/e2e/partner-mfa.spec.ts:76` | `complete` und `naturalWidth > 0`; mit `mfa-helpers.ts:59` (Rohtext ohne Präfix) |
| `tests/e2e/partner-mfa.spec.ts:336-343` | 415: Hinweis im Fehlertext, „Hochladen“ gesperrt, ein Insert; trennscharf, weil der Knopf hier nur über die leere Auswahl sperrt |
| `tests/e2e/partner-mfa.spec.ts:345-351` | „Erneut hochladen“ lädt auf dieselbe `id`, weiter ein Insert |
| `tests/e2e/partner-mfa.spec.ts:400-407` | nur die Objekt-Route bricht ab, die Liste lädt (K1) |
| `tests/e2e/partner-mfa.spec.ts:413-425` | aal1-Token im Speicher, Insert mit 42501, erwartet „Code eingeben“ und kein `enroll` |
| `node_modules/@supabase/auth-js/src/GoTrueClient.ts:3044, :6130-6150` | Sitzung je Aufruf aus dem Speicher; Niveau aus dem Token der Sitzung |
| `tests/rls/partner-documents.test.ts:103-110` | aal1: Fehler, Status 401 oder 403, Objekt fehlt; aal2 auf dieselbe Zeile klappt |
| `tests/rls/partner-documents.test.ts:118-122` | zweiter Upload: Status 409, Datei bleibt JPEG |
| `tests/rls/partner-documents.test.ts:158-171` | freier Platz von A: B, Kunde mit aal2 und A mit aal1 scheitern je mit „Objekt fehlt“; A mit aal2 klappt |
| `tests/rls/partner-documents.test.ts:193-198` | A auf freien Platz von B scheitert, Objekt fehlt; B selbst klappt |
| `tests/rls/partner-documents.test.ts:16-19` | Probe auf oberster Ebene räumt das Konto ab und wirft weiter |
| `tests/rls/partner-documents.test.ts:36-43, :53-56` | Aufräumen wirft bei Fehlern; Sweep der Konten früherer Läufe, das Konto dieses Laufs ausgenommen |
| `tests/rls/partner-documents.test.ts:59-74` | Aufräumen in `try/finally`, danach Messung: Firmen 0, Konten 0, Ordner leer |
| `vite.config.ts:28-29` | RLS-Tests mit Dev-Schranke als globalem Setup, Dateien nacheinander; der Sweep trifft keinen parallelen Lauf |
| `tests/support/db.ts:44-46` | `deleteUsers` ohne Fehlerprüfung (K3) |
| `src/lib/partnerDocs.ts:52` | Größe wird vor allem anderen selbst geprüft (N3) |
| `src/screens/partner/Mfa.tsx:102-104` | `factor_gone` setzt den Text am Start (N4) |
| `docs/GOLIVE.md:56` | Sitzungen beenden vor dem Löschen des Faktors, Restlaufzeit 3600 s, Probe in der Prüfspalte; Formulierung zu `unenroll`/`enroll` eingegrenzt |
| `docs/GOLIVE.md:65` | Limit für Challenge und Verify ablesen und notieren |
| `docs/OPEN_ISSUES.md:340` | S2-M2 mit Stand s9i-5b, nicht geschlossen; Offenes benannt |
| `docs/OPEN_ISSUES.md:549-553` | S9i5b-5 bis -8 vorhanden; S9i5b-4 um den Satz zu H1 ergänzt |
| `supabase/migrations/…0026_document_slot_taken.sql:13-21` | Trigger lässt eine schon vorhandene `id` ohne liegende Datei bis zum Primärschlüssel durch (Grundlage für K2) |
| `tmp/proof/s9i-5b-rls-doc-2.log:5-10` | 1 Datei, 10 Tests bestanden, EXIT=0 |
| `tmp/proof/s9i-5b-bildsicht.md:120-127` | Runde 3: vier QR-Aufnahmen zeigen das Quadrat, kein kaputtes Bild |

### Weg zur Freigabe (Stand Kontrollrunde)

1. K1 beheben, mit E2E.
2. `check`, `test:e2e` (mindestens `partner-mfa.spec.ts`, dann voll) und `test:rls` (voll) auf dem Endstand, je EXIT=0 im Log (M1). Erst diese Logs belegen H1, M2 und M3 (a).
3. K2 bis K5 beheben oder nach `docs/OPEN_ISSUES.md`; K6 in GOLIVE 25 ergänzen.

Offene Findings hoch: 0
