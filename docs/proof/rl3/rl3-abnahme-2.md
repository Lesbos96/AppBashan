Modell: claude-fable-5-2
Vorgaenger: tmp/proof/rl3-abnahme-1.md

# Abnahme rl3, Kontrollrunde 2 (R3, Kennung rl3-2011-a)

Datum: 2026-11-20
Umfang: Branch `rl3`, Commit 076eda7 (Behebung der Runde 1). Geprüft: die sieben Dateien unten gegen `tmp/proof/rl3-abnahme-1.md`, `tmp/proof/rl3-plan.md`, `.claude/rules/geld.md`, `daten.md`, `tests.md`, die Migrationen 0023, 0024, 0053, 0066, `tests/support/totp.ts`, `supabase/config.toml` (Abschnitt Auth), Lauf 004 und `runs.jsonl` unter `tmp/proof/rl3/`.
Grenzen der Prüfung: Ich habe kein Shell-Werkzeug. Die Hashes sind aus dem Auftrag abgeschrieben, nicht nachgerechnet; für die zwei Testdateien stimmen sie mit `dateiSha` in `runs.jsonl` überein (Zeilen 1, 2 und 4). Den Diff von 076eda7 habe ich nicht gesehen; „kein Geld- und kein Rechtepfad im Diff“ stützt sich auf den Auftrag und auf den Inhalt der sieben Dateien. `docs/OFFEN.md` habe ich bis Zeile 79 gelesen und den Rest nach den Stichworten des Schritts durchsucht (kein weiterer Treffer zu rl3).

SHA256: b3a834a2e5c2fea829e9d867411c07051f4a4524c0d2d825e22027a2424bc49d tests/rls/partner-limits.test.ts
SHA256: 8f295b6c646369d6e861cf887dd0defcf201b762da2f0390ec9b0dcb8ec9d770 tests/rls/partner-documents.test.ts
SHA256: 3f7406ad4c2b4bde999ec1ec62e179eabb167f889beefefe66831c3726ebc981 docs/ENTSCHEIDUNGEN.md
SHA256: 2bdf1160ec0817e5242120605fd2bc718bbba1b189fa4d6bd294bb1e34f246d4 docs/GOLIVE.md
SHA256: 6d09e92047dccd85855b3f69b77d11e4fb34419a7bca8546d0cd4765d51e01c2 docs/OFFEN.md
SHA256: 5e4baee67837e421274c0ee9f11effcfdb73b24af23eeee10ba7be75f084627b docs/BEKS.md
SHA256: e3aa5cd544119d5f12e7ce4bb838664cdbd18f753dddb3b6aaccb63b6ed53051 docs/STAND.md

## Ergebnis

Der hohe Fund H1 der Runde 1 ist behoben, die Verweise stimmen. M1, M2 und M3 sind behoben bzw. ehrlich als Grenze festgehalten. Kein neuer hoher oder mittlerer Fund. Keine neue Sicherheitswirkung: geändert sind zwei strengere Erwartungen in einem Test und Doku-Text; der Test ruft einen verweigerten Endpunkt auf und schreibt nichts. Kein Betrag, keine Gebühr, kein Journal, kein Recht berührt.

## Stand der Funde aus Runde 1

- H1 (hoch): behoben. `docs/ENTSCHEIDUNGEN.md:226` nennt jetzt: Mitglieder können ihr Konto nicht löschen (`role_not_allowed`, 0053:14-15, heute 0066:20-21), Löschweg und verwaiste Firma in OFFEN S9h4-1. Nachgeschlagen: beide Stellen tragen die Sperre wörtlich gleich; 0066 ist die letzte Fassung von `delete_account` (spätere Migrationen definieren die Funktion nicht neu). Mitglieder können die Mitgliedschaft auch nicht selbst verlassen (für `partner_members` nur SELECT, 0023:238-251). Rest: N7.
- M1 (mittel): erledigt nach Weg (b). Testdatei unverändert (Hash wie Runde 1, `runs.jsonl` Zeilen 1 und 2). Nr. 219 sagt jetzt, was das rote Log zeigt: nur den Bezirks-Check, die Folgefälle enden in `already_member`, der Test bricht an der ersten Erwartung ab, PK, Namens-Check und Zählung sind im roten Log nicht einzeln sichtbar. Das deckt sich mit Lauf 001 (Zeile 22: Ist-Wert `ok` für „Bezirke 1 bis 24“, Exit 1, Schalter im Kopf). Der Rot-Beweis zählt nach `tests.md` (Ist-Wert „Aufruf erfolgreich“). Ausreichend; Weg (a) bleibt eine Verbesserung beim nächsten Anfassen der Datei.
- M2 (mittel): behoben im verlangten Teil. `tests/rls/partner-documents.test.ts:157-158` verlangt `data` null und Status 403. Lauf 004: Exit 0, „10 passed (10)“, alle zehn Tests einzeln gelistet, kein Treffer für Überspringen, Argumente und Schalter leer; `dateiSha` in `runs.jsonl` Zeile 4 gleich dem Hash oben. Dass der Token gültig ist, zeigt dieselbe Suite (Upload mit demselben aal2-Token gelingt, Zeile 108). Der Gegenfall (eigener freier Platz) fehlt bewusst und steht in `docs/OFFEN.md:43`. Rest: N8.
- M3 (mittel): behoben. `docs/GOLIVE.md:94` (Punkt 53) knüpft die Mail an die E-Mail-Bestätigung und verlangt den Ist-Wert vor Livegang; der Verweis `config.toml:228` stimmt (Bestätigung lokal aus). Nr. 219 nennt dieselbe Bedingung und „nicht belegt“. Passt zu `docs/GOLIVE.md:82` (Punkt 46 verlangt beide Auth-Einstellungen im Bericht).
- N1 (niedrig): zum Teil behoben. `docs/STAND.md:26` nennt GOLIVE 26 (BEKS Frage 1) im nächsten Schritt. Rest: N11.
- N4 (niedrig): behoben. Nr. 219 nennt „Nr. 216 und 217“; 216 ist ts1 (Turnstile), 217 „GOLIVE 18 genügt“.
- N5 (niedrig): behoben. `docs/OFFEN.md:43` (rl3-1) führt die ungemessene signierte Upload-URL für den eigenen freien Platz als zu messenden Punkt, mit dem Vorbehalt „im Repo nicht belegt“. Rest: N9.
- N2, N3 (niedrig): unverändert, kein Fix verlangt (Testdatei bewusst nicht angefasst).
- N6 (niedrig): unverändert, siehe N13.

## Findings

### hoch

Keine.

### mittel

Keine.

### niedrig

N7. `docs/ENTSCHEIDUNGEN.md:226` gegen `docs/OFFEN.md:33-34` – Der Verweis „verwaiste Firma nach einer Löschung im Dashboard steht in OFFEN S9h4-1“ trifft nur den Löschweg: der Eintrag nennt den fehlenden Löschweg und die Anonymisierung, den Fall „Firma ohne Mitglied“ nicht in Worten (nur der Archiv-Eintrag S1-N2 verweist dafür auf S9h4-1). Der Mechanismus: `partner_members.user_id` kaskadiert (0023:42), die Firma und ihre Dateien bleiben (`docs/GOLIVE.md:57`). Nicht ausgeschrieben ist die Folge für die Zahl: jede Löschung eines Mitglied-Kontos im Dashboard gibt demselben Postfach eine neue Firma mit neuen 50 MiB, wie beim Admin-Zyklus nur durch eine Admin-Handlung. – Fix: beim Bau des Löschwegs (GOLIVE 38) in OFFEN S9h4-1 einen Halbsatz ergänzen („Konto im Dashboard gelöscht: Firma und Dateien bleiben ohne Mitglied, vor dem Löschen Dateien und Firma behandeln“). Kein Fix in rl3 nötig.

N8. `tests/rls/partner-documents.test.ts:155` – Der Kommentar nennt als Grund „die INSERT-Policy gilt dort ebenso“. Gemessen ist nur die Verweigerung (403) für einen Pfad ohne Zeile; ohne Gegenfall bleibt offen, ob die Policy prüft oder der Endpunkt diesem Konto immer absagt. Nr. 219 formuliert es richtig („gemessen verweigert“, Rest „nicht belegt“). – Fix: zusammen mit dem Gegenfall aus OFFEN rl3-1 (dann neuer Hash und neuer Lauf); jetzt nicht anfassen.

N9. `docs/OFFEN.md:43` gegen `docs/OFFEN.md:39` – Zwei Einträge zur signierten Upload-URL mit verschiedener Frist und ohne Querverweis: S2-M2 „vor Livegang“, rl3-1 „vor dem Öffnen der Buchung ansehen“. Registrierung und Uploads hängen nicht an `booking_open`; RPC und Bucket sind erreichbar, sobald das Produktivprojekt steht (`docs/GOLIVE.md:66`: „Route und RPC bleiben offen“). Wirkung begrenzt (10 MiB, Typen, eigene Zeile oder Admin-Handlung). – Fix: in rl3-1 die Frist auf „vor GOLIVE 30“ stellen und auf S2-M2 verweisen, beim nächsten Schritt, der OFFEN anfasst.

N10. `docs/BEKS.md:42` – Frage 1 nennt als Prüfinhalt von GOLIVE 53 nur die Auth-Limits; die Bedingung „Mail bremst nur mit E-Mail-Bestätigung“ steht nur in Punkt 53 und Nr. 219. Kein Widerspruch, die Empfehlung bleibt richtig (ein Zähler an `register_partner` bremst die Kontenanlage in keinem Fall). – Fix: nur falls die Frage noch einmal angefasst wird, „Auth-Limits und E-Mail-Bestätigung“ schreiben.

N11. `docs/STAND.md:23` und `docs/GOLIVE.md:65` (Rest von N1) – Die Listen, wann `booking_open` geöffnet wird, nennen Punkt 26 weiter nicht (ebenso wenig 32 und 48a bis 48c, die sich selbst als Pflicht davor bezeichnen). `docs/STAND.md:7,26` und `docs/GOLIVE.md:59` tragen den Status von Punkt 26, darum kein Widerspruch im Status, nur eine unvollständige Liste. – Fix: die Liste in GOLIVE Punkt 29 einmal vollständig führen und STAND darauf verweisen; eigener kleiner Doku-Schritt.

N12. `tmp/proof/rl3/004-tests_rls_partner-documents.test.ts.log:34` – Vitest meldet nach dem Bericht eine Zeitüberschreitung beim Beenden des Worker-Prozesses. Exit 0, alle Tests bestanden, in Lauf 003 nicht vorhanden. Keine Wirkung auf das Ergebnis. – Fix: im Volllauf beobachten; bleibt ein Kindprozess stehen, vor dem nächsten Lauf beenden (`docs/STAND.md:35`).

N13. `tmp/proof/rl3/runs.jsonl:4` – Lauf 004 stammt von Commit 41d0918 mit unsauberem Baum (gezielter Lauf vor dem Commit 076eda7, zulässig; die Datei ist die des Endstands). Pflichtläufe auf dem Endstand stehen dort noch nicht; das prüft das Gate.

## Prüffragen

1. H1, stimmen die Verweise? Ja. 0053:14-15 und 0066:20-21 enthalten die Sperre (Rolle ungleich Kunde oder Mitgliedschaft vorhanden, dann `role_not_allowed`). OFFEN S9h4-1 besteht (`docs/OFFEN.md:33-34`) und führt den fehlenden Löschweg; die verwaiste Firma ist dort nur der Sache nach gedeckt (N7). Auflage 6 des Plans ist damit vollständig erfüllt.

2. M1, ehrlich und ausreichend? Ja. Der Text in Nr. 219 beschreibt genau, was Lauf 001 zeigt, und nennt, was nicht sichtbar ist. Der Kopfkommentar der Testdatei (Zeile 5) sagt, was der Schalter lockert, nicht, was das Log zeigt; das ist richtig. Die Wirkung von PK und Namens-Check ist im grünen Lauf über die erwarteten Fehlercodes belegt, nicht im roten.

3. M2. Exit 0, 10 bestanden, nichts übersprungen, `dateiSha` gleich dem Hash des Auftrags: alles bestätigt. Die Aussage „für einen Pfad ohne eigene Zeile gibt es keine signierte Upload-URL“ ist jetzt mit Status belegt. Der fehlende Gegenfall ist offen geführt und kein Hindernis (N8, N9).

4. M3. Punkt 53 und Nr. 219 knüpfen die Mail an die E-Mail-Bestätigung im Produktivprojekt, Punkt 53 verlangt den Ist-Wert vor Livegang. Bestätigt.

5. N1, N4, N5. Bestätigt wie oben; Rest von N1 in N11.

6. Widersprüche zwischen den Dateien. Keine in Zahlen oder Status: 1 Firma, 23 Bezirke, 5 Dokumente à 10 MiB, 50 MiB je Konto stehen gleich in `ENTSCHEIDUNGEN.md:226`, `GOLIVE.md:59,94`, `BEKS.md:42`, `STAND.md:6`; GOLIVE 26 „durch Strukturgrenzen erledigt, Bestätigung offen, bis dahin offen für `booking_open`“ gleich in `GOLIVE.md:59`, `BEKS.md:42`, `STAND.md:7,30` und Nr. 219; „Aufrufrate je Konto nicht begrenzt und nicht belegt“ gleich in `OFFEN.md:43`, `GOLIVE.md:94`, `STAND.md:6` und Nr. 219, nirgends als Grenze der Plattform behauptet (Auflage 1). Unschärfen: N7, N9, N10, N11. `docs/STAND.md` hat 39 Zeilen (Grenze 40).

7. Neue Sicherheitswirkung. Keine. Der ergänzte Testaufruf wird verweigert und hinterlässt nichts (Aufräumprüfung der Suite unverändert, Zeilen 59-74). Die Doku nennt keine Schlüsselwerte. Geld: nichts berührt.

## Stichproben

- `supabase/migrations/20261110110000_0053_delete_account_fix.sql:14-15` – Sperre für Mitglieder. Stimmt.
- `supabase/migrations/20261116022741_0066_execute_entzug.sql:20-21` – dieselbe Sperre in der heutigen Fassung. Stimmt.
- Suche über `supabase/migrations` nach der Definition von `delete_account` – 0052, 0053, 0054, 0064, 0066; keine spätere. „heute 0066“ stimmt.
- `supabase/migrations/20261107100000_0023_partners.sql:42,46` – Mitgliedschaft kaskadiert mit dem Konto, `unique (user_id)`. Stimmt (Grundlage für N7).
- `...0023_partners.sql:238-251` – für `partner_members` nur SELECT für angemeldete Konten, kein DELETE. Stimmt.
- `supabase/migrations/20261107110000_0024_partner_admin.sql:102-120` – Admin entfernt nur die Zeile, Kommentar Zeile 102. Stimmt mit Nr. 219.
- `...0024_partner_admin.sql:201-205` – Bucket und INSERT-Policy. Stimmt.
- `supabase/config.toml:208,223,228` – Grenze je IP, Anmeldung per E-Mail an, Bestätigung aus. Stimmt mit Punkt 53.
- `tests/rls/partner-documents.test.ts:45,151-159` – Hilfsfunktion liest den Statuscode des Fehlers; Erwartung `data` null und 403. Stimmt.
- `tests/support/totp.ts:10-14` – Client mit genau dem übergebenen Token. Stimmt.
- Suche nach Aufrufen der signierten Upload-URL in `src`, `tests`, `supabase`, `scripts` – einziger Treffer ist der Test; die App nutzt den Weg nicht.
- `tmp/proof/rl3/004-…log:1-5,15-29,34,38` – Kopf ohne Argumente und Schalter, 10 bestanden, Warnung zum Worker (N12), Exit 0.
- `tmp/proof/rl3/runs.jsonl:1-4` – `dateiSha` Zeilen 1 und 2 gleich dem Hash von `partner-limits.test.ts`, Zeile 4 gleich dem Hash von `partner-documents.test.ts`; Zeile 3 trägt den alten Hash der Runde 1.
- `tmp/proof/rl3/001-…log:5,22,50` – Schalter gesetzt, Ist-Wert `ok`, Exit 1. Deckt den neuen Satz in Nr. 219.
- `docs/ENTSCHEIDUNGEN.md:223-224` – Nr. 216 ts1, Nr. 217 „GOLIVE 18 genügt“. Stimmt (N4).
- `docs/OFFEN.md:33-34,39,43` – S9h4-1, S2-M2, rl3-1 (N7, N9).
- `docs/GOLIVE.md:59,65,66,82,94` – Punkte 26, 29, 30, 46, 53 (N9, N11, M3).
- `docs/STAND.md:6-7,23,26,30` und `docs/BEKS.md:42` – Status und Zahlen gleich (N10, N11).

Offene Findings hoch: 0
