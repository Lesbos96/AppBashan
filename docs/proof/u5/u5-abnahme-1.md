Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme Schritt u5, Runde 1

- Datum: 2026-11-16
- Stufe: R3 (Arbeitssystem; kein Geld, keine Datenbank, keine Edge Function)
- Umfang: Abnahme-Runden (`leseAbnahme`, Gate, Bericht, Guard, Agent-Anweisung), Lauf-Sperre in `npm run t`, `sauber()`
- Vollständig gelesen: die sieben Dateien unten, dazu `scripts/sys/gate-db-lib.mjs` (parseFreigabe, Zeile 39-51), `.claude/settings.json`, `.claude/skills/schritt/SKILL.md`, `tests/unit/sys-abnahme.test.ts`, `tests/unit/sys-sauber.test.ts`, `tests/unit/sys-run.test.ts`; in Auszügen `tests/unit/sys-guard.test.ts`, `tests/unit/sys-fertig.test.ts`, `docs/OFFEN.md` (u5-1, u5-2), `tmp/proof/u5/runs.jsonl` und die Logs 003 bis 012
- Grenze dieser Prüfung: Ich habe kein Werkzeug für `git diff` und keines zum Hashen. Die Hashes unten sind aus dem Auftrag abgeschrieben. „Nichts abgeschwächt“ im Guard habe ich über den Endstand, die Tests und die Zeilenangaben früherer Abnahmen geprüft (siehe Prüffrage 6), nicht über einen Byte-Vergleich mit `main`.

SHA256: fabb6916267ce2ef386a28cf32c5e9ef68a02a346fc038692280f6b48b4acc44 scripts/sys/run.mjs
SHA256: 80e99bfe5ca2780912dc36c503745e1878c8bf004a51599c09a82b7a74c4fbef scripts/sys/fertig.mjs
SHA256: bf006e2ee7540405c8953c14ab0fcf1d0ddf25a3d6e3d2c77eccef35cc886570 scripts/sys/bericht.mjs
SHA256: 02ad0f9b437c605f10ae858bc98f12443da1474e50dcacb8f601b201b1dec95f scripts/sys/lib.mjs
SHA256: ee788efb38f70b025f658efff4acf89a917675b67faef6cb8f9121edb59eaca1 scripts/sys/abnahme-lib.mjs
SHA256: 56e06f03f536ab3d20d9dc9a7101a3ba490214f5febad383048f424c1d9846ee .claude/hooks/guard.mjs
SHA256: 4d62aa41607d62f27cf05c9ae88b56ffc0e33ab04baf4cd2a0e2bba03b8be4ab .claude/agents/advisor-report.md

Gelöschte Dateien der Mindestmenge: keine (laut Auftrag).

## Ergebnis in Kürze

Kein hoher Fund. Über das Gate rutscht keine Abnahme mit offenem hohem Fund durch: Es zählt allein die höchste Runde, sie muss genau eine Zeile mit „hoch: 0“ haben, alle geänderten Pflichtdateien nennen und zum Endstand passen. Zwei mittlere Funde betreffen den Verlauf der Runden (Löschen und neu schreiben ist nicht gesperrt; der Bericht kann im Missbrauchsfall die falsche Kopie nennen), nicht die Freigabe des Endstands.

Wichtig für das weitere Vorgehen: Wer M1 oder M2 im Code behebt, ändert `guard.mjs` bzw. `bericht.mjs` und braucht danach Runde 2. Ein Eintrag in `docs/OFFEN.md` ändert keinen Hash.

## Findings

### hoch

Keine.

### mittel

- M1 · `.claude/hooks/guard.mjs:374`, `.claude/settings.json:79`, `:91` – Löschen oder Wegschieben einer Abnahme oder Freigabe unter `tmp/proof` ist nicht gesperrt. Der Guard prüft bei Kopieren, Schreiben und Umbenennen nur das Ziel; ein Löschbefehl oder ein Verschieben aus `tmp/proof` heraus trifft kein Muster. Auf `ask` stehen nur `rm` (Bash) und `Remove-Item` (PowerShell), nicht die PowerShell-Kurzformen (`del`, `erase`, `ri`, `rm` als Alias; schon in der Abnahme u4 als N6 vermerkt). Folge: Runde 1 löschen, die Kontrollrunde als neue „Runde 1“ mit `Vorgaenger: keiner` schreiben lassen. Das ist der st1-Fehler auf einem zweiten Weg, und das Gate erkennt ihn nicht, weil die Kette nur Pfade vergleicht (`scripts/sys/abnahme-lib.mjs:22-23`). Warum nicht hoch: Die neue Datei ist eine vollständige Abnahme des Endstands durch `advisor-report` mit Hash-Bindung; verloren geht der Verlauf und die Pflicht, offene Funde der Vorrunde mitzuzählen. – Fix: im Guard jedes Segment verweigern, das einen Löschbefehl (alle Schreibweisen wie in Zeile 362) oder ein Verschieben/Umbenennen mit einer Quelle nach dem Berater- oder Skript-Muster unter `tmp/proof` enthält; `lauf.lock` davon ausnehmen oder die Räumung Beks überlassen (SKILL.md:59). Tests mit Rot-Beweis. Alternativ als `u5-3` nach `docs/OFFEN.md`.

- M2 · `scripts/sys/bericht.mjs:63` (mit `:23` und `:51`) – `abnahmeKopie` wird aus dem Namen gebildet statt aus dem Rückgabewert von `kopiere`. Liegt in `docs/proof/<schritt>/` schon eine Kopie gleichen Namens mit anderem Inhalt, legt `kopiere` die neue unter einem Namen mit Kurz-Hash ab; `bericht.json` und `bericht.md` nennen dann die alte Kopie, während `hoch` und `runde` aus der neuen Datei stammen. Erreichbar nur, wenn eine Abnahme nach einem früheren `npm run bericht` ersetzt wurde (M1 oder ein Node-Skript), also genau in dem Fall, für den der Nachweis stimmen muss. `fertig` liest das Feld nicht, das Gate ist nicht betroffen. – Fix: in der Schleife den Rückgabewert merken (`if (f === c.abnahmeName) abnahmeKopie = z`); besser zusätzlich: weicht bei einer Abnahme-Datei der Zielname vom Quellnamen ab, als Grund melden (zweite Ebene zu M1). Der Kommentar in `:19` („z. B. zweite Abnahme-Runde“) ist überholt.

### niedrig

- N1 · `scripts/sys/run.mjs:84-90`, `tests/unit/sys-run.test.ts:82-87` – Zwei Eigenschaften der Sperre haben keinen Rot-Beweis: „unlesbare Sperre zählt als aktiv“ bleibt unter beiden genannten Mutationen grün (Log 003: nur die zwei PID-Tests rot; Log 004: nur der Räum-Test), und „Freigabe nur bei eigener pid“ hat keinen Test. Das Verhalten selbst stimmt laut Code (`:70-81`, `:86`). – Fix: dritte Mutation (Lesefehler als „tot“ werten, erwartet ein roter Test) und ein Test mit lang laufendem Fixture, das während des Laufs eine fremde Sperre vorfindet und sie nach dem Ende stehen lässt.

- N2 · `scripts/sys/run.mjs:118` – Die Sperre wird nach dem Start des Kinds ungeprüft neu geschrieben. Im (benannten) Fall zweier Räumer überschreibt ein Lauf damit die Sperre des anderen; endet dann der eingetragene Lauf zuerst, ist der Ordner frei, obwohl der zweite noch läuft. Liegt innerhalb der Grenze „zwei Räumer“ aus u5-2. – Fix: nur neu schreiben, wenn die Datei noch die eigene pid nennt.

- N3 · `scripts/sys/run.mjs:49-53`, `docs/OFFEN.md:58` – Die Sperre gilt je Arbeitsordner (`tmp/proof` relativ). Ein zweiter Worktree hat eine eigene; Ports und Dev-Datenbank sind über Worktrees hinweg nicht geschützt. Der Kommentar verspricht „höchstens ein Lauf zugleich“. – Fix: Grenze in u5-2 und im Kommentar ergänzen (CLAUDE.md erlaubt die zweite Session ohnehin nur ohne Datenbank).

- N4 · `scripts/sys/fertig.mjs:66` – `c.abnahmeRunden ?? []`: Fehlt das Feld, gilt das als „keine Gründe“. `sammle` setzt es immer (`:183`), die reine Prüfung ist an dieser Stelle aber offen statt geschlossen (anders als `jetzt`, `:21-25`). – Fix: bei vorhandener Abnahme und fehlendem Array einen Grund melden, Typ in `fertig.d.mts` verpflichtend.

- N5 · `scripts/sys/lib.mjs:25` – Nur der M-Zweig ist an den Schritt gebunden. Der A-Zweig lässt weiter neue Index-Dateien in jedem Unterordner von `docs/proof/` zu, obwohl `bericht.mjs` nur nach `docs/proof/<schritt>/` schreibt (`bericht.mjs:16`, `:22`, `:60`); `tests/unit/sys-sauber.test.ts:43-49` erwartet den fremden Ordner als sauber. Kein Fingerabdruck liest `docs/proof/`, eine Wirkung auf Läufe gibt es nicht. – Fix: A-Zweig auf den laufenden Schritt binden oder die Absicht im Kommentar festhalten.

- N6 · `.claude/hooks/guard.mjs:382-387` – Schreibweisen, die Windows auf dieselbe Datei abbildet, die Muster aber verfehlen können (Punkt oder Leerzeichen am Namensende, Datenstrom-Suffix), werden vor dem Vergleich nicht bereinigt. Vorbestehend, gilt für alle Muster, von mir nicht durch Ausführung belegt. – Fix: Namensende bereinigen und Pfade mit Doppelpunkt hinter dem Laufwerk verweigern; Test dazu.

- N7 · `.claude/agents/advisor-report.md:22` – Es fehlt, was der Berater tut, wenn der genannte Pfad schon existiert oder nicht der Form entspricht. – Fix: ein Satz „dann nichts schreiben, der Hauptsession melden; nie selbst einen anderen Namen wählen“.

- N8 · Auftrag gegen Log – Der Auftrag nennt drei rote Guard-Tests, `tmp/proof/u5/006-tests_unit_sys-guard.test.ts.log:101` zeigt vier. Der vierte (`:80-81`, Gegenprobe „echo supabase db query“) ist ein Absturz des Kindprozesses mit Windows-Code für Zugriffsverletzung, ohne Bezug zur Mutation, im Lauf 007 nicht wiederholt. – Fix: in der Bewertung richtig nennen; tritt es wieder auf, als Umgebungsfehler nach `docs/OFFEN.md`.

## Prüffragen

1. `abnahme-lib.mjs`
   - Namensprüfung: Präfix als Zeichenkette, nie als Muster (`:9`); „fremd“ ist alles, was ohne Beachtung der Schreibweise mit dem Präfix beginnt und auf `.md` endet (`:13`); gültig nur die strenge Form mit Ziffernfolge ab 1 ohne führende Null und kleingeschriebener Endung (`:14`), alles andere ist ein Grund (`:16`). In Ordnung.
   - Lückenprüfung (`:18-19`), Vorgänger je Runde, genau eine Zeile, Rückstriche normalisiert (`:21-23`), höchste Runde zählt (`:25-28`). In Ordnung.
   - Durchrutschen eines offenen hohen Funds: keinen Weg gefunden.
     - Andere Endung oder Unterordner: Die Datei zählt nicht als Abnahme. Sie kann keine höhere Runde ersetzen; ohne gültige Datei meldet das Gate „Abnahme-Datei fehlt“ (`fertig.mjs:67`).
     - Groß-/Kleinschreibung: blockiert als fremder Name (Test `sys-abnahme.test.ts:57`).
     - Zeilenenden: CRLF wird in beiden Parsern behandelt (`abnahme-lib.mjs:21`, `gate-db-lib.mjs:40`); eine Datei nur mit CR hat keine verankerte Hoch-Zeile und blockiert.
     - Mehrere oder keine Hoch-Zeile: kein Zahlenwert, `fertig.mjs:70` blockiert (`gate-db-lib.mjs:43`, `:49`).
     - Ältere Runde mit „hoch: 0“ nach Entfernen der höchsten: zählt nur, wenn ihre Hashes dem Endstand entsprechen und sie alle geänderten Pflichtdateien nennt (`fertig.mjs:72-73`, `:184-185`); dann ist sie eine gültige Abnahme genau dieses Stands.
     - Ordner mit Abnahme-Namen: Lesefehler, Gate bricht ab (geschlossen).
   - Die Position „zweite Zeile“ wird nicht erzwungen, die Zeile darf irgendwo stehen; eine zweite Zeile mit diesem Anfang blockiert. Unkritisch.

2. `fertig.mjs` – Import (`:7`), Aufruf mit festem `PROOF_ROOT` (`:162`), Felder (`:180-183`), Gründe mit Präfix „R3:“ im R3-Block vor der Prüfung der Abnahme (`:66`). Alle bisherigen Prüfungen der Abnahme stehen unverändert dahinter (`:67-73`). In Ordnung, siehe N4.

3. `bericht.mjs` – Alle Runden kopiert die Schleife in `:51`; `runde` steht in `bericht.json` (`:88`) und `bericht.md` (`:122`). Abweichung: M2.

4. `run.mjs` – Reihenfolge stimmt: Zielprüfung mit Exit 2 (`:41-47`) vor der Sperre (`:63-83`), Log (`:92-101`) und `runs.jsonl` (`:135-138`) danach; ein blockierter Lauf endet in `:81`, bevor der Exit-Handler angemeldet ist (`:84`), und fasst die fremde Sperre nicht an. `wx` (`:66`), unlesbar gilt als aktiv (`:70-75`, auch während des kurzen Fensters beim Schreiben), eine tote Sperre wird genau einmal geräumt (`:76-79`), Zugriffsverweigerung gilt als lebend (`:60`), Freigabe nur bei eigener pid (`:86`). Ein Abbruch nach dem Holen der Sperre (Ausnahme) gibt sie über das Exit-Ereignis frei; ein hartes Beenden hinterlässt sie, der nächste Lauf räumt sie, sofern auch das Kind tot ist. Die benannten Grenzen (PID-Wiederverwendung, Enkel, zwei Räumer, umgelenkter Ordner) sind im Code (`:51-52`) und in `docs/OFFEN.md:58` richtig beschrieben und führen höchstens zum Zustand vor u5 (kein Schutz) bzw. zu einer hängenden Sperre (geschlossen). Ergänzungen: N1 bis N3. `tmp/` ist ignoriert (`.gitignore:14`), die Sperrdatei ändert `sauber()` nicht.

5. `lib.mjs` – `gitRoh` ungekürzt (`:13`, `:24`); der Schrittname ist maskiert und der M-Zweig am Ende verankert (`:25`); jede ungestagete oder umbenannte Zeile bleibt unsauber (`:26`, Tests `sys-sauber.test.ts:64-84`). In Ordnung, siehe N5.

6. `guard.mjs`
   - Nichts abgeschwächt, soweit prüfbar: Das Berater-Muster (`:12`) ist eine Obermenge des alten (der alte Name ohne Nummer trifft weiter; Tests `sys-guard.test.ts:78`, `:96`, `:294`, `:411`, `:508`), das Skript-Muster (`:11`) ist nur um `lauf.lock` erweitert, die neue Zeile `:387` sperrt zusätzlich. Die Zeilen, die die Abnahmen u4 und u3b zitieren (`:252`, `:259`, `:356-364`, `:374`, `:384`), stehen noch an derselben Stelle mit demselben Inhalt; davor ist also keine Zeile hinzugekommen oder entfallen. Eine Änderung innerhalb einer anderen Zeile kann ich ohne Diff nicht ausschließen; beim vollständigen Lesen fiel keine auf.
   - Legitimfall offen: Für `advisor-report` und einen noch nicht vorhandenen Pfad liefern `:386` und `:387` keinen Grund (Test `sys-guard.test.ts:107-108`). Dieser Bericht ist selbst der Fall.
   - Der Hook läuft für `Write` und `Edit` und blockiert bei eigenem Fehler (`.claude/settings.json:7-9`).
   - Rot-Beweis: Die drei Zieltests messen den Ist-Wert (Exit 0 statt 2, Log 006 `:24`, `:43`, `:62`).

7. `advisor-report.md:22` – Rundenpfad, Verbot des Überschreibens, Kopfzeile, Mitzählen offener Funde der Vorrunde und erneute Nennung aller Pflichtdateien stimmen mit `abnahme-lib.mjs` und `SKILL.md:18` überein. Siehe N7.

### Ergänzende Frage: Ist der st1-Fehler technisch ausgeschlossen?

Auf dem Weg, auf dem er geschah (der Berater schreibt die Kontrollrunde mit dem Schreibwerkzeug in die Datei der ersten Runde): ja. Den Ausschluss leistet aber die Guard-Zeile `guard.mjs:387`, nicht die drei Prüfungen im Gate. Diese erkennen ein Überschreiben mit stimmiger Kopfzeile nicht, weil die Kette Pfade vergleicht und keinen Inhalt bindet.

Was die drei Prüfungen im Gate leisten:
- Kontrollrunde unter freiem Namen (alte Schreibweisen): blockiert.
- Übersprungene Nummer: blockiert.
- Kontrollrunde, die sich als Runde 1 ausgibt, aber in Datei n > 1 steht, oder umgekehrt: blockiert.
- Kontrollrunde, die nur die Korrektur prüft: blockiert über die Pflichtmenge (`fertig.mjs:73`), nicht über die Runden-Prüfung.

Restlücken:
1. Löschen oder Wegschieben und neu schreiben (M1); vom Gate nicht erkennbar.
2. Schreiben per Node-Skript am Guard vorbei (bekannte Grenze, `guard.mjs:360`).
3. Vorabrunde unter einem Namen oder in einem Ordner außerhalb des Musters; sie steht nicht in der Kette. Die gezählte Runde bleibt eine volle Abnahme des Endstands.
4. Das Gate liest `tmp/proof` (unversioniert). Unveränderlich werden die Runden erst mit der Kopie durch `npm run bericht`; bis dahin gibt es keine zweite Ebene (M2 nennt eine billige).
5. Der Guard ist laut eigenem Kopf keine Sicherheitsgrenze (`guard.mjs:2`); Pfadschreibweisen siehe N6.

Wer die Kette inhaltlich binden will: Der Auftrag könnte den Hash der Vorrunde nennen und die Kopfzeile ihn tragen. Das war in der Planprüfung zugunsten des Pfads entschieden; mit M1 und M2 behoben halte ich den Pfad für ausreichend.

### Arbeitsweise

Die Sperre wurde vor ihren Tests gebaut; das ist offengelegt. Die Rot-Beweise über Mutation messen die Wirkung (Exit-Code des blockierten Laufs, Inhalt des Ordners), mit den Lücken aus N1. Das Gate verlangt Rot-vor-Grün nur für neue Dateien unter `tests/rls/`; hier gibt es keine.

## Stichproben

- `scripts/sys/abnahme-lib.mjs:13-16` – fremde Namen ohne Beachtung der Schreibweise, strenge Form: stimmt
- `scripts/sys/abnahme-lib.mjs:19` – Lücke und fehlende Runde 1: stimmt
- `scripts/sys/abnahme-lib.mjs:21-23` – genau eine Vorgänger-Zeile, Sollwert je Runde: stimmt
- `scripts/sys/gate-db-lib.mjs:39-51` – parseFreigabe wie beschrieben, mehrere Hoch-Zeilen ergeben keinen Zahlenwert: stimmt
- `scripts/sys/fertig.mjs:66-73`, `:162`, `:183` – Runden-Gründe und unveränderte Prüfungen: stimmt
- `scripts/sys/fertig.mjs:16` – alle sieben Dateien des Auftrags gehören zur Mindestmenge; `fertig.d.mts` und `abnahme-lib.d.mts` nicht: stimmt
- `scripts/sys/bericht.mjs:51`, `:63` – alle Runden kopiert, Pfad der höchsten aus dem Namen: M2
- `scripts/sys/run.mjs:41-47`, `:63-83`, `:92-101` – Reihenfolge Zielprüfung, Sperre, Log: stimmt
- `scripts/sys/run.mjs:84-90` – Freigabe nur bei eigener pid: stimmt, ohne Test (N1)
- `scripts/sys/lib.mjs:24-26` – ungekürzte Statuszeilen, Schrittname maskiert: stimmt
- `.claude/hooks/guard.mjs:11-12`, `:385-388` – Muster und Reihenfolge der Sperren: stimmt
- `.claude/hooks/guard.mjs:374` – nur das Ziel wird geprüft: M1
- `.claude/settings.json:79`, `:91` – Löschbefehle auf `ask` nur in zwei Schreibweisen: M1
- `.claude/agents/advisor-report.md:22` – Anweisung zu Rundenpfad und Kopfzeile: stimmt
- `.claude/skills/schritt/SKILL.md:18`, `:59` – Punkt 8 und Lauf-Sperre passen zum Code: stimmt
- `docs/OFFEN.md:58` – u5-2 nennt die Grenzen der Sperre: stimmt, Worktree fehlt (N3)
- `tests/unit/sys-abnahme.test.ts:28-39`, `:57` – höchste Runde zählt in beide Richtungen, sechs fremde Namen: stimmt
- `tests/unit/sys-guard.test.ts:102-109` – Überschreibschutz und Legitimfall: stimmt
- `tests/unit/sys-fertig.test.ts:146-149` – Runden-Gründe blockieren bei gültiger höchster Runde: stimmt
- `tmp/proof/u5/runs.jsonl` Zeile 3 bis 11 – rot vor grün je Testdatei (2, 1, 4, 17, 1 rot): stimmt, Guard 4 statt 3 (N8)
- `tmp/proof/u5/runs.jsonl` Zeile 12 und 13 – `check` erst Exit 2 (Typfehler in `sys-run.test.ts:94`), dann Exit 0; beide auf unsauberem Baum, zählen nicht als Endstand: zur Kenntnis
- `tmp/proof` – vor dem Schreiben lag keine Datei mit dem Präfix des Schritts im Ordner: stimmt

Offene Findings hoch: 0
