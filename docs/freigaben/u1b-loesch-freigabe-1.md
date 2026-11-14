Modell: claude-fable-5-2
SHA256: d63d73f7133fffada101e1be34e5f7d30a7ba9ab54867595f849c8180ca8dfee tests/support/sweep.ts
SHA256: 1f72a00bbc085ae8af2ac4b7b609b6686e00b7b141ba0f20aee9733b98a6593a tests/support/marker.ts
Urteil: frei

# Lösch-Freigabe 1, Schritt u1b (Kennung u1b-1411-a)

Datum: 2026-11-14
Geprüft (vollständig gelesen): `tests/support/sweep.ts` (105 Zeilen), `tests/support/marker.ts` (11 Zeilen).
Zur Einordnung gelesen: `tests/support/owner.ts`, `tests/support/partner.ts`, `tests/support/db.ts`, `tests/support/dev-guard-setup.ts`, `scripts/dev-guard.mjs`, `scripts/dev-ref.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/sys/gate-loesch.mjs`, `scripts/sys/gate-db-lib.mjs`, `scripts/sys/loesch-register.json`, `tests/unit/sys-gate-loesch.test.ts`, `tests/rls/sweep.test.ts`, Ausschnitte aus `tests/rls/flow-live.test.ts` und den Migrationen 0001, 0023, 0024, 0030, 0035, 0039.

Hinweise zum Nachweis:
- Die beiden Hash-Zeilen oben sind unverändert aus dem Auftrag übernommen und von mir nicht nachgerechnet (kein Shell-Werkzeug). Ich habe beide Dateien einmal gelesen und keinen Anlass, sie für verändert zu halten. `npm run loesch -- uebernehme` rechnet die Hashes gegen die Dateien nach; weicht einer ab, blockiert das Gate.
- Das eingebaute advisor-Werkzeug ohne Parameter stand in meiner Werkzeugliste; ich habe es nicht aufgerufen.
- Nichts außer dieser Datei wurde geschrieben. Keine `.env*`, keine `.claude/settings.local.json` gelesen.

## Ergebnis in einem Satz

Die Logik löscht und sperrt nur Zeilen, die an zwei unabhängigen Merkmalen als Testdaten erkennbar sind (verankertes Kontaktadress-Muster plus kein Mitglied außerhalb der Testkonten; Nutzer nur mit Testadresse auf einer nie zustellbaren Domain), nimmt die Abdeckungsfirma und ihre Mitglieder aus, bricht bei zu vielen Treffern vor dem ersten Löschen ab und prüft die Freigabe vor jeder Aktion, auch bei `final`. Kein Finding der Stufe hoch.

## Findings hoch

Keine.

## Findings mittel

M1. `tests/support/sweep.ts:54` und `:83` – `final` wird ohne Laufzeitprüfung in das SQL eingesetzt. `admin` ist per UUID-Prüfung abgesichert (`:56`), `final` nur durch den TypeScript-Typ. Alle 13 Aufrufstellen übergeben das Literal `true` oder nichts (selbst nachgeschlagen), ein Missbrauch bräuchte also eine Codeänderung in einer Testdatei, die ohnehin `ownerSql` direkt aufrufen könnte; darum nicht hoch. Es ist aber die einzige Stelle, an der das SQL des freigegebenen Moduls nicht allein aus freigegebenen Bytes und geprüfter Eingabe besteht. Fix: `if (typeof final !== 'boolean') throw …` direkt nach der UUID-Prüfung, oder `${final === true}` einsetzen. Ändert den Hash, braucht dann eine neue Freigabe; kann mit dem nächsten Anlass erledigt werden.

M2. `tests/support/sweep.ts:91-95` – Das Lauf-Log enthält für `sweepTestResidue` nur die Restzahlen (aktive und ungebundene Testfirmen danach), nicht, wie viele Firmen gelöscht, wie viele gesperrt und wie viele Nutzer gelöscht wurden, und nicht die Zahl der Kandidaten davor. Für ein Lösch-Protokoll fehlt damit die eigentliche Löschzahl; ein unerwartet großer Lauf wäre im Log nicht zu sehen. Fix: im DO-Block drei Zähler führen (Firma gelöscht, Firma gesperrt, Nutzer gelöscht), am Ende per `set_config(…, false)` als JSON ablegen und im abschließenden `select` mit `current_setting` zurückgeben; dazu die beiden Kandidatenzahlen aus `:62-63`. Alles in `loeschLog` schreiben.

M3. `scripts/sys/loesch-register.json:3` und `tests/unit/sys-gate-loesch.test.ts:143` – `tests/support/owner.ts` ist weder an `sweep.ts` gebunden noch unter `ausgenommen` mit Hash festgehalten (das Suchmuster des Registers trifft die Datei nicht). `owner.ts` führt jedes SQL des Aufräumens aus; eine Änderung dort (anderes Ziel, verändertes SQL) bräuchte heute weder eine neue Freigabe noch macht sie einen Test rot. Fix, ohne die Hashes der beiden freigegebenen Dateien zu berühren: `tests/support/owner.ts` mit Grund und SHA-256 unter `ausgenommen` eintragen (wie `db.ts` in Zeile 26), dann macht jede Änderung den Vollständigkeits-Test rot. Die strengere Variante (Bindung an `sweep.ts` in Zeile 3) verlangt eine Freigabe, die auch `owner.ts` nennt. Bewertung der Tragbarkeit: siehe Abschnitt „Was die Freigabe nicht bindet“.

## Findings niedrig

N1. `tests/support/sweep.ts:15` und `:62-65` – Die Obergrenze zählt alle Treffer, auch die dauerhaft unlöschbaren (Kunden mit Aufträgen, gebundene und gesperrte Firmen; Kopfkommentar `:4-5`). Diese Reste wachsen mit jedem Lauf; irgendwann überschreitet die Zahl 1000 und jedes Aufräumen ohne `final` wirft. Das ist geschlossen im Fehlerfall (nichts wird gelöscht), aber dann darf die Grenze nicht einfach angehoben werden. Fix: Kandidatenzahlen ins Log (M2), damit der Trend sichtbar ist; Altbestand bei Bedarf über ein eigenes, freigegebenes Skript bereinigen.

N2. `tests/support/sweep.ts:26` – `UUID_FILE` lässt auch einen Pfad ohne `.jpg` zu; die Tabelle verlangt die Endung (`supabase/migrations/20261108180000_0035_job_photos.sql:21`). Ohne Wirkung, weil ein solcher Pfad nicht existieren kann. Fix: Endung im Muster verpflichtend machen.

N3. `tests/support/sweep.ts:66-76` – Auswahl (Schleifenabfrage) und Löschen sind getrennte Anweisungen; `delete from public.partners where id = f.id` prüft die Testfirma-Bedingung nicht erneut. Ein zwischenzeitlich hinzugekommenes echtes Mitglied oder eine neue Bindung wird nur teilweise abgefangen (eine neue Bindung scheitert am RESTRICT, der Unterblock rollt zurück). Auf Dev mit nur einem Lauf praktisch ohne Belang. Fix: zu Beginn des Unterblocks `perform 1 from public.partners p where p.id = f.id and <Testfirma-Bedingung> for update; if not found then continue; end if;`.

N4. `tests/support/sweep.ts:76` mit `supabase/migrations/20261108130000_0030_job_listings.sql:33` – Das Löschen einer ungebundenen Testfirma löscht per Kaskade auch ihre Zeilen in `job_listings`. Das sind Zeilen der Testfirma selbst; die Anfragen bleiben. Der Kopfkommentar nennt die Kaskade nicht. Fix: einen Satz im Kommentar ergänzen.

N5. `tests/support/sweep.ts:71` – Zeilen in `partner_documents` einer Testfirma werden gelöscht, die zugehörigen Storage-Objekte nicht (Reste im Dokumenten-Bucket, kein Zuviel-Löschen). Fix: entweder im Kommentar festhalten oder, falls committete Testfirmen je Dokumente hochladen, eine API-Löschung wie bei den Belegen ergänzen (dann neue Freigabe).

N6. `tests/support/sweep.ts:83-84` mit `tests/support/partner.ts:60-64` – Der Admin, der die Abdeckungsfirma freigibt, ist kein Mitglied und trägt eine Testadresse; er ist Löschkandidat fremder Aufräumläufe. `marker.ts:10` verspricht nur „sie und ihre Mitglieder“, das stimmt. Die Firma hängt nicht an diesem Konto; ohne Wirkung auf die Abdeckung. Kein Fix nötig, nur festgehalten.

N7. `tests/support/sweep.ts:41-44` – Scheitert der Storage-Aufruf (auch teilweise), wird geworfen, bevor eine Logzeile entsteht. Fix: vor dem `throw` eine Logzeile mit Trefferzahl und Fehlerhinweis schreiben.

N8. `tests/support/sweep.ts:20`, `:62`, `:83` – Das Nutzer-Muster steht dreimal als Literal in `sweep.ts`, das Firmen-Muster als Konstante in `marker.ts`. Beide Dateien sind gebunden, also kein Loch. Fix (Lesbarkeit): eine Konstante für das Nutzer-Muster in `marker.ts`.

## Antworten auf die Prüffragen

**Nur Testdaten, nie reale Daten?** Ja.
- Testfirma (`sweep.ts:19-20`): Kontaktadresse muss dem Muster aus `marker.ts:8` entsprechen. Das Muster ist an Anfang und Ende verankert, verlangt genau acht kleine Hex-Zeichen, der Punkt ist als Zeichenklasse wörtlich, der Operator unterscheidet Groß- und Kleinschreibung. Zusätzlich darf kein Mitglied eine Adresse außerhalb der Testkonten haben; Mitglieder ohne Adresse zählen dank `coalesce` als fremd und schützen die Firma. Beide Bedingungen sind durch `tests/rls/sweep.test.ts:54-67` abgedeckt (Firma mit echtem Mitglied bleibt, Firma mit fremder Kontaktadresse bleibt).
- Testnutzer (`sweep.ts:83`): `LIKE` muss die ganze Adresse treffen, also Anfang mit dem Test-Präfix und Ende mit der Testdomain. Die Domain ist reserviert und nie zustellbar; ein echtes Konto mit Magic-Link kann darauf nicht entstehen. `supabase/seed.sql` enthält weder das Präfix noch die Domain (Suche ohne Treffer). Andere Testdateien nutzen andere Präfixe (`tests/support/db.ts:31` mit Tags wie `quote-`, `status-`, `doc-`), nur die Wettlauf- und Live-Tests nutzen bewusst das Test-Präfix (`tests/rls/flow-live.test.ts:99`, `:105`, `:108`).
- Belegobjekte (`sweep.ts:36-41`): nur Pfade aus `job_photos` mit Art `receipt`, hochgeladen von einer Testfirma, die im Bucket `job-photos` wirklich existieren.
- Das Ganze läuft nur gegen Dev (siehe unten).

**Nie die Abdeckungsfirma?** Ja. Die Firma ist über den Namen ausgenommen (`sweep.ts:19`, Name aus `marker.ts:11`); das ist nötig, weil sie selbst eine Marker-Kontaktadresse trägt (`tests/support/partner.ts:22` und `:63`). Der Name ist ohne eigenen Marker unveränderlich (`supabase/migrations/20261107100000_0023_partners.sql:178-183`). Ihre Mitglieder sind von der Nutzerlöschung ausgenommen (`sweep.ts:84`). Ein `NULL`-Name kann nicht vorkommen (`not null`, 0023:16) und würde die Zeile ohnehin ausschließen.

**Begrenzt?** Ja. Mehr als 1000 Testnutzer oder Testfirmen: `raise exception` vor der ersten Löschung, außerhalb der Unterblöcke, also nicht verschluckt (`sweep.ts:62-65`). Belege: mehr als 50 Treffer oder ein Pfad außerhalb des UUID-Musters: Abbruch vor dem Storage-Aufruf (`sweep.ts:39`). `admin` muss eine UUID sein, sonst Abbruch vor jedem SQL (`sweep.ts:56`).

**Überdehnung von Regex und LIKE?** Keine gefunden. Regex: beidseitig verankert, feste Länge, kein Platzhalter außer der Hex-Klasse; im Standardmodus von PostgreSQL treffen die Anker nur Anfang und Ende der Zeichenkette. LIKE: ein einziger Platzhalter in der Mitte, kein Unterstrich, Punkt und Bindestrich sind in LIKE wörtlich. Das Dollarzeichen am Ende des Musters beendet den Dollar-Quote-Block nicht (der Block endet nur mit seinem vollen Tag) und bildet im Template-Literal keine Ersetzung.

**SQL-Einschleusung über `admin`?** Nein. `sweep.ts:14` ist beidseitig verankert, nur Kleinbuchstaben-Hex und Bindestriche; JavaScript trifft `$` ohne Mehrzeilen-Schalter nur am Ende, ein angehängter Zeilenumbruch fällt durch. Die Prüfung steht vor dem `try` und vor jedem SQL. `COVER_FIRM`, das Firmen-Muster und `MAX_LOESCHEN` sind Konstanten aus gebundenen Dateien ohne Anführungszeichen. Übrig bleibt `final` (M1).

**Reihenfolge?** Stimmig. (1) Freigabe, (2) UUID-Prüfung, (3) Obergrenze, (4) je Firma in eigenem Unterblock: ungebunden → Kindtabellen, dann Firma, mit dem an genau diese Firma gebundenen Lösch-Marker (transaktionslokal; Wächter 0023:188-197, 0023:227, 0024:153-164); gebunden und aktiv oder zahlungsgesperrt → Sperre über `admin_set_partner_status` mit festem Akteur (0039:157-193: Admin-Prüfung, Akteur kein Mitglied, Begründung mindestens 10 Zeichen, Übergang erlaubt laut 0023:112-114), kein direktes UPDATE auf Status. (5) Erst danach die Nutzer; der Akteur bleibt bis dahin bestehen, auch bei `final` wird er erst nach allen Sperren versucht. Ein Fehler bei einer Firma rollt nur ihren Unterblock zurück (keine halb gelöschte Firma). Die Liste der Bindungen in `sweep.ts:22-24` deckt alle fünf RESTRICT-Verweise auf `partners` außerhalb der Kindtabellen ab (0030:57, 0038:20, 0028:13, 0035:20, 0040:11; Gegenprobe per Suche über alle Migrationen: sonst nur die vier Kindtabellen, `partner_documents` und die Kaskade in 0030:33).

**Storage nur über die API, nur UUID-Pfade?** Ja. Einziger Löschweg ist `service.storage.from('job-photos').remove(paths)` (`sweep.ts:41`), Bucket als Literal. `storage.objects` wird per SQL nur gelesen (`sweep.ts:36`). Jeder Pfad muss das UUID-Muster erfüllen, sonst wird gar nichts gelöscht; Schrägstriche und Punktfolgen sind damit ausgeschlossen. Danach Gegenzählung, Rest ungleich 0 wirft.

**dev-guard als erster Import?** Ja, `sweep.ts:9` ist die erste Import-Anweisung; `marker.ts` hat keine Importe und keine Seiteneffekte. Der Guard prüft drei Quellen der Projekt-Ref, bricht bei jeder Abweichung oder fehlenden Angabe ab und legt die Ref für Kindprozesse fest (`scripts/dev-guard.mjs:7-22`). Zusätzlich läuft er im `globalSetup` des Projekts (`tests/support/dev-guard-setup.ts:3`, `vite.config.ts:29`).

**Selbstprüfung vor dem ersten Löschen, auch bei `final`?** Ja. `sweepReceiptObjects`: erste Anweisung (`sweep.ts:34`), vor dem Nachladen von `db.ts` und vor jeder Abfrage. `sweepTestResidue`: erste Anweisung (`sweep.ts:55`), vor dem `try`; ein Fehler dort wird bei `final` nicht zur Warnung. Die Prüfung verlangt den Lauf über das Start-Programm, den Registereintrag und für `sweep.ts` und `marker.ts` je eine Freigabe aus dem Commit mit dem aktuellen Hash (`scripts/sys/gate-loesch-lib.mjs:37-44`); jede passende Freigabe muss von Fable stammen, „frei“ lauten und 0 hohe Findings haben (`scripts/sys/gate-db-lib.mjs:52-63`). Fehlt der Ordner im Commit, gibt es keine Freigabe und es wird blockiert. Die Stellung der Aufrufe ist per Unit-Test festgehalten (`tests/unit/sys-gate-loesch.test.ts:153-158`).

## Was die Freigabe nicht bindet, und ob das tragbar ist

- `tests/support/owner.ts` (führt das SQL aus): nicht gebunden, nicht per Hash festgehalten (M3). Tragbar, weil die Datei das SQL nur durchreicht (Argumentliste ohne Shell, `--linked`, Fehler werden geworfen, `owner.ts:20-37`), die gesamte Löschbedingung in den beiden gebundenen Dateien steht und das Ziel zusätzlich durch den Guard festgelegt ist. Nicht tragbar wäre es auf Dauer ohne jede Sicherung; darum M3 (Hash unter `ausgenommen`) zeitnah.
- `tests/support/db.ts` (liefert den Service-Client für den Storage-Aufruf): nicht gebunden, aber mit Hash im Register (`scripts/sys/loesch-register.json:26`); eine Änderung macht den Unit-Test rot (`tests/unit/sys-gate-loesch.test.ts:127-131`). Tragbar: der Client nimmt URL und Schlüssel nur aus der Umgebung (`db.ts:14-15`), die URL prüft der Guard, und was gelöscht wird, bestimmen Bucket-Literal und geprüfte Pfade in `sweep.ts`. Einschränkung: Das Nachführen des Hashes im Register braucht keine Fable-Freigabe, nur die Abnahme laut Testmeldung.
- `tests/support/partner.ts` (erzeugt Test-Adressen, `ownerDeletePartner`): Hash im Register (Zeile 28). Weicht der Erzeuger vom Muster ab, findet das Aufräumen weniger, nie mehr. `ownerDeletePartner` löscht nur per übergebener ID und ist nicht Teil dieser Freigabe.
- `scripts/dev-guard.mjs`, `scripts/dev-ref.mjs`: Hash im Register (Zeilen 19-20). `scripts/sys/gate-loesch-lib.mjs`, `gate-db-lib.mjs`: nicht gebunden; sie sind das Gate selbst und durch eigene Unit-Tests gedeckt.
- Datenbankseite (`admin_set_partner_status`, Lösch-Wächter, Fremdschlüssel): durch das Datenbank-Gate gebunden, nicht durch diese Freigabe. Eine neue Tabelle mit Verweis auf `partners` ändert die Wirkung des Löschens (Kaskade) oder macht die Bindungsliste unvollständig (dann scheitert das Löschen am RESTRICT, geschlossen im Fehlerfall). Bei jeder solchen Migration `sweep.ts:22-24` mitprüfen.
- Aufrufer in `tests/rls/*.test.ts`: nicht gebunden und vom Register nicht erfasst (es sucht nur in `scripts/` und `tests/support/`). Dort gibt es eigene direkte Löschungen außerhalb des Gates, zum Beispiel `tests/rls/sweep.test.ts:28`, `:33`, `:39`. Diese Freigabe sagt darüber nichts aus.
- Die Umgebungsvariable des Start-Programms ist eine Prozessregel, keine Sicherheitsgrenze; wer sie von Hand setzt, umgeht nur die Laufbindung, nicht die Hash-Prüfung.
- Verhalten der Supabase-CLI (Transaktionsgrenzen mehrerer Anweisungen, Vorrang der Ref aus der Umgebung): nicht nachprüfbar aus dem Code. Die Logik hängt nicht daran: der DO-Block ist für sich atomar je Unterblock, und der Guard prüft auch die verlinkte Ref.
- Nebenläufigkeit: Die Regel „nur ein RLS-Lauf gleichzeitig auf Dev“ (`sweep.ts:6`) erzwingt der Code nicht. Ein zweiter Lauf würde Testdaten des ersten wegräumen (rote Tests), aber weiterhin nur Testdaten.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tests/support/sweep.ts:9` | Guard ist die erste Import-Anweisung: in Ordnung |
| `tests/support/sweep.ts:34`, `:55` | Freigabeprüfung ist jeweils die erste Anweisung, in `sweepTestResidue` vor dem `try`: in Ordnung |
| `tests/support/sweep.ts:14`, `:56` | UUID-Muster beidseitig verankert, Prüfung vor jedem SQL: in Ordnung |
| `tests/support/sweep.ts:19-20` | Testfirma = Muster und nicht Abdeckungsfirma und kein fremdes Mitglied; `coalesce` schützt bei fehlender Adresse: in Ordnung |
| `tests/support/sweep.ts:62-65` | Obergrenze vor der ersten Löschung, außerhalb der Unterblöcke: in Ordnung |
| `tests/support/sweep.ts:83` | `final` ohne Laufzeitprüfung eingesetzt: M1 |
| `tests/support/sweep.ts:91-95` | Log nur mit Restzahlen: M2 |
| `tests/support/sweep.ts:26`, `:39`, `:41` | Pfadprüfung vor dem Storage-Aufruf, Bucket als Literal, nur API: in Ordnung (N2 zur Endung) |
| `tests/support/marker.ts:8` | Muster verankert, acht Hex-Zeichen, Punkt wörtlich: in Ordnung |
| `tests/support/marker.ts:11` | Name ohne Anführungszeichen, als Literal einsetzbar: in Ordnung |
| `tests/support/partner.ts:12`, `:15` | Erzeugte Firmen- und Nutzeradressen passen zu den Mustern: in Ordnung |
| `tests/support/partner.ts:22`, `:63` | Abdeckungsfirma trägt eine Marker-Adresse, Schutz also allein über den Namen: bestätigt, Ausschluss in `sweep.ts:19` vorhanden |
| `tests/support/owner.ts:20-37` | SQL als Argument ohne Shell, `--linked`, Fehler werden geworfen: in Ordnung |
| `tests/support/db.ts:14-15`, `:31` | Service-Client nur aus der Umgebung; Standard-Testkonten mit anderen Präfixen: in Ordnung |
| `scripts/dev-guard.mjs:7-22` | Drei Ref-Quellen, Abbruch bei Abweichung oder Fehlen, Ref für Kindprozesse festgelegt: in Ordnung |
| `scripts/sys/gate-loesch-lib.mjs:37-44` | Laufbindung, Register, Freigaben aus dem Commit, geschlossen im Fehlerfall: in Ordnung |
| `scripts/sys/gate-db-lib.mjs:52-63` | Jede passende Freigabe muss Fable, frei und 0 sein: in Ordnung |
| `scripts/sys/loesch-register.json:3`, `:26`, `:28` | `marker.ts` gebunden; `db.ts` und `partner.ts` mit Hash; `owner.ts` fehlt: M3 |
| `tests/unit/sys-gate-loesch.test.ts:143`, `:153-158`, `:163-166` | `owner.ts` und `db.ts` als unkritisch geführt; Stellung der Freigabeprüfung und Importliste getestet: in Ordnung, M3 |
| `tests/rls/sweep.test.ts:44-67` | Drei Fälle (verwaiste Testfirma wird gelöscht, echtes Mitglied schützt, fremde Kontaktadresse schützt): decken die Löschbedingung |
| `tests/rls/flow-live.test.ts:85-87`, `:134` | Reihenfolge der Aufrufe, `final` als Literal: in Ordnung |
| `vite.config.ts:29-30` | Guard im `globalSetup`, Dateien nacheinander: in Ordnung |
| `supabase/migrations/20261107100000_0023_partners.sql:26` | Kontaktadresse frei wählbar, nicht eindeutig: darum die zweite Bedingung (Mitglieder) nötig und vorhanden |
| `supabase/migrations/20261107100000_0023_partners.sql:41-42` | Mitgliedschaft: Firma RESTRICT, Nutzer Kaskade; kein Lösch-Wächter auf `partner_members`: Kommentar in `sweep.ts:18` stimmt |
| `supabase/migrations/20261107100000_0023_partners.sql:188-206`, `:227` | Löschen nur mit Marker genau dieser Firma: `sweep.ts:70` setzt ihn je Firma, transaktionslokal |
| `supabase/migrations/20261107110000_0024_partner_admin.sql:153-164` | Dokumente löschbar mit Firmen-Marker: in Ordnung (N5 zu den Objekten) |
| `supabase/migrations/20261108130000_0030_job_listings.sql:33`, `:57` | Listings Kaskade (N4), Zuordnung RESTRICT (in der Bindungsliste) |
| `supabase/migrations/20261108180000_0035_job_photos.sql:20-21` | Beleg-Verweis RESTRICT, Pfad flach mit UUID und Endung: passt zu `sweep.ts:26` (N2) |
| `supabase/migrations/20261109110000_0039_s9e_abnahme.sql:157-193` | Sperre nur über Funktion mit Admin-Prüfung und Audit-Eintrag: in Ordnung |
| `supabase/seed.sql` (Suche nach Präfix und Domain) | kein Treffer: Seed-Daten kollidieren nicht mit den Mustern |

Offene Findings hoch: 0
