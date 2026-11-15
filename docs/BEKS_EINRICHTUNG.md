# Einrichtung durch Beks (Schritt u1, Kennung u1-1411-a)

Alles hier liegt außerhalb des Repos und wurde von der Session bewusst nicht angefasst. Jeder Schritt sagt, wie du prüfst, dass er geklappt hat. Reihenfolge einhalten.

## 1. Hook `trim-output.js` für MoveNow abschalten
**Befund (echter Lauf, `docs/proof/u1/u1-probe-hook-1.log`):** Die gedruckte EXIT-Zeile stimmt auch mit Hook (`; echo EXIT=$?` zeigt `EXIT=1`, ein roter Befehl ohne Zusatz hat Status 1 in Bash und PowerShell). Die Aussage „der Hook fälscht das EXIT“ aus dem Vorschlag ist damit nicht belegt. Belegt sind drei andere Dinge: (a) er fängt reine Lesebefehle ab, die nur ein Stichwort wie `vitest` im Text tragen, und kürzt sie auf 30 Zeilen; (b) er stellt der PowerShell-Ausgabe ein unsichtbares BOM-Zeichen voran; (c) er baut den Befehl um, und die Berechtigungsregeln gelten laut Doku für den umgebauten Befehl (code.claude.com/docs/en/hooks: „evaluates permission rules … against the input your hook returns“).

**Änderung:** Datei `C:\Users\gesch\.claude\hooks\trim-output.js` im Editor öffnen. In Zeile 23 steht `let j; try { j = JSON.parse(...); } catch { return; }`. Direkt darunter (neue Zeile 24) einfügen:

```js
    if ((j.cwd || '').includes('MoveNow')) return;
```

Die Zeile gehört in den `else`-Zweig (eingerückt wie die Zeile darüber), nicht in den `--filter`-Zweig. Das Feld `cwd` liefert Claude Code laut Hook-Doku in jeder Hook-Eingabe.

**Prüfen:** In einer neuen MoveNow-Session diesen Befehl ausführen lassen: `Get-ChildItem -Recurse src | Select-Object -First 80 # vitest`. Die Ausgabe muss vollständig sein; die Zeile `[trim-output hook: … earlier lines trimmed …]` darf nicht erscheinen. In einem anderen Projekt kürzt der Hook weiter wie bisher.

## 2. Das eingebaute advisor-Tool abschalten
Stand heute: Das Tool `advisor` steht in der Tool-Liste dieser Session (und laut Fable auch in der ihres Subagents). Die Session hat es nicht benutzt.

1. `C:\Users\gesch\.claude\settings.json` im Editor öffnen und auf oberster Ebene ergänzen (Komma beachten):
   ```json
   "env": { "CLAUDE_CODE_DISABLE_ADVISOR_TOOL": "1" }
   ```
   Gibt es schon einen `env`-Block, die Zeile dort hinzufügen. Doku (code.claude.com/docs/en/env-vars): „The `/advisor` command becomes unavailable, any configured `advisorModel` is ignored.“ Laut Doku greift der Wert in einer laufenden Session beim Speichern der Datei.
2. In einer Session einmal `/advisor off` eingeben.

**Prüfen:** In einer neuen Session `/advisor` eintippen: Der Befehl ist nicht mehr verfügbar. Frage die Session „Steht ein Tool namens advisor ohne Parameter in deiner Liste?“: Antwort nein. Der Subagent `advisor` (Fable, aus `.claude/agents/advisor.md`) bleibt unverändert nutzbar; das ist ein anderes Ding.

## 3. Auto-Modus als Standard (optional; freigegeben seit Schritt u1b: M17 und M18 sind behoben, Abnahme `docs/proof/u1b/u1b-abnahme.md`)
Stand bei u1b: `defaultMode: "auto"` steht in `C:\Users\gesch\.claude\settings.json` bereits. Der Guard erkennt Pipes, verschachtelte Shells (`bash -c`, `powershell -Command`, `cmd /c`), Skriptdateien (`bash x.sh`, `pwsh -File x.ps1`) und Lösch-Skripte am Gate vorbei; Grenzen (nicht prüfbar: ein Skript schreiben und mit `node tmp/x.mjs` ausführen; seit u2b erkannt: Befehle hinter einer PowerShell-Zuweisung `$out = befehl`, in der Bedingung `if befehl; then` und in Klammern `if (befehl) { … }`; offen: seltene Schreibweisen) stehen in `docs/OFFEN.md`, Punkte u1b-3 und u1b-6 (Archiv: `docs/archiv/OPEN_ISSUES.md`). Freigegeben mit diesem Vorbehalt. Der Guard ist laut Doku keine Sicherheitsgrenze; die zweite Ebene sind `npm run t`, `fertig` und der pre-push-Hook.

Doku (code.claude.com/docs/en/permission-modes): `defaultMode: "auto"` wirkt nur in `~/.claude/settings.json`, nicht in `.claude/settings.json` des Projekts.

1. In `C:\Users\gesch\.claude\settings.json` ergänzen: `"permissions": { "defaultMode": "auto" }` (gibt es `permissions` schon, nur `defaultMode` setzen).

**Prüfen:** In der Desktop-App unter dem Eingabefeld zeigt der Modus-Wähler „Auto“ (erscheint nur, wenn dein Plan und Modell ihn erlauben).

**Wichtig, weicht vom Vorschlag ab:** Im Auto-Modus fragt Claude Code bei Schreibzugriffen auf `.claude/` nicht nach, sondern der Klassifizierer entscheidet („Routed to the classifier, which decides“). Der Vorschlag ging vom Gegenteil aus. Darum stehen in `.claude/settings.json` zusätzlich `ask`-Regeln auf `Edit(./.claude/**)`, `./scripts/sys/**`, `./.githooks/**` und `package.json`; Ask-Regeln gelten laut Doku in jedem Modus. Allow-Regeln für `npm run …` werden im Auto-Modus verworfen; harte Sperren sind `deny`, der Guard-Hook und `dev-guard`, nicht der Klassifizierer.

## 4. Git-Hook `pre-push` aktivieren
Einmal im Repo-Ordner im Terminal:

```bash
npm run prepare
```

(setzt `git config core.hooksPath .githooks`; läuft sonst nur bei `npm install`). Die u1-Session hat das schon getan; die Prüfung bleibt für jeden frischen Klon nötig.

**Prüfen:** `git config core.hooksPath` gibt `.githooks` aus. `npm run fertig` und `npm run start-schritt` brechen ab, wenn es nicht so ist.

## 5. Hooks und Berechtigungen in einer neuen Session prüfen
Die Hooks stehen in `.claude/settings.json` (Teil des u1-Commits). Die Felder `args` (Exec-Form) und `onFailure` belegt die Doku (code.claude.com/docs/en/hooks), `onFailure` ab Claude Code 2.1.295. Nacheinander prüfen:
1. Version: im Terminal `claude --version` muss mindestens 2.1.295 zeigen (die Desktop-App brachte beim Bau dieser Session 2.1.325 mit).
2. Alte Sperre gilt noch (Datei wird nicht verworfen): neue Session im Ordner MoveNow, eintippen: „Lies `.env.local`.“ Erwartet: verweigert.
3. Guard lädt: eintippen „Führe `npx vitest run` direkt aus.“ Erwartet: verweigert mit `GUARD: Tests nur über das Start-Programm: …`. Läuft er durch, hat die Session den Hook nicht geladen.
4. Absturz-Probe: im Terminal `.claude/hooks/guard.mjs` kurz in `guard.mjs.aus` umbenennen, in der Session einen harmlosen Befehl (`git status`) anfordern. Erwartet: blockiert (wegen `onFailure: block`). Danach zurückbenennen.
5. `agent_type`: in einer Session „Lass den Subagenten advisor-report die Datei `tmp/proof/probe-abnahme.md` mit dem Inhalt `x` schreiben.“ Erwartet: geschrieben. Dann dieselbe Datei aus der Hauptsession mit Write: Erwartet: verweigert (`Freigaben und Abnahmen schreibt nur der Subagent advisor-report`). Danach die Datei löschen.

## 6. Rettungsweg, falls der Guard-Hook die Arbeit blockiert
Nicht über Claude, sondern selbst im Terminal im Repo:
1. Eine Session mit abgeschalteten Hooks starten: `claude --settings '{"disableAllHooks": true}'` (Doku: hooks.md, „Disable or remove hooks“).
2. Oder in `.claude/settings.json` den Block `"hooks": {…}` mit dem Editor löschen.
3. Oder `git revert` der u1-Commits. Die Skripte in `scripts/sys/` kannst du jederzeit selbst im Terminal ausführen; es gibt bewusst keinen Schalter, der ein Gate abschaltet.

## 7. Wenn der pre-push-Hook nach dem Merge den Push blockiert
`npm run fertig` merged zuerst nach `main` und pusht danach; prüft der Hook beim Push anders als das Gate davor, steht lokal ein gemergtes `main` ohne Push. Im Terminal: Grund aus der Meldung beheben (meist fehlt ein Nachweis), dann `git push`; oder den Merge zurücknehmen mit `git checkout main` und `git reset --hard origin/main` (der Schritt-Branch bleibt unberührt; `git reset` ist für Claude gesperrt, für dich nicht).

## 8. Später (kein Teil von u1)
- `/usage` notieren (Ausgangswert für die Fable-Grenze unter 50 %).
- Stand nach u4: Die `ask`-Regeln für `git commit` und `git merge` sind entfallen (Vorschlag a7, Probe bestanden). `git push`, `rm`, `npx dotenv` und `npm run loesch` bleiben auf `ask` (ENTSCHEIDUNGEN Nr. 174).
- Lösch-Gate (u1b): Skripte, die auf Dev löschen oder Status ändern (Register `scripts/sys/loesch-register.json`), starten für Claude nur über `npm run loesch -- <skript.mjs>`, mit Fable-Freigabe (Pfad + SHA-256) aus `docs/freigaben/`. `npm run admin:call`, `setup:photo-cleanup`, `setup:photo-publish` sind für Claude gesperrt; im eigenen Terminal laufen sie unverändert. Freigabe erteilen: `advisor-report` schreibt `tmp/proof/<schritt>/loesch-freigabe-N.md`, dann `npm run loesch -- uebernehme <datei>` (kopiert nach `docs/freigaben/`), dann committen.
- Offen für dich: Schritt 1 (trim-output) und Schritt 2 (`CLAUDE_CODE_DISABLE_ADVISOR_TOOL`) sind laut Prüfung in u1b nicht wirksam (`docs/proof/u1b/u1b-ausgangslage.log`).
