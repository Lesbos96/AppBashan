# Plan u2b (R3) · Kennung u2b-1411-a

## Fakten (Datei:Zeile, Stand vor u2b)
- `.claude/hooks/guard.mjs:28` `kern` entfernt `then|do|else|elif|exec…`, nicht `if|while|until`; `:26` `zuweisung` kennt nur `NAME=`, keine PowerShell-Zuweisung `$x = …`; `:102` `segmente` trennt nicht an `{`/`}`.
- `guard.mjs:249` `core.hooksPath` ohne Schalter `i` (N19); `:269` Ausnahme `-ItemType Directory` am unmaskierten `seg` (N20b).
- `.claude/hooks/session.mjs:29` `modell = e.model ?? null`; `tmp/proof/session.json` dieser Sitzung: `modell: null`, `quelle: startup` → die Hook-Eingabe liefert in dieser Umgebung kein Feld `model`. Das Transkript `~/.claude/projects/<slug>/<session_id>.jsonl` enthält je Assistenten-Eintrag `message.model` (hier `claude-sonnet-5-5`, 44 Einträge, keine Sidechain).
- `scripts/sys/bericht.mjs:42` übernommene Läufe (aus `gruen.json`) erscheinen nur, wenn kein gültiger Lauf existiert; ein gültiger Lauf eines früheren Schritts (u2: Läufe aus u1b) steht unter „Läufe auf dem Endstand“; `:109`/`:84` Abnahme zeigt `tmp\proof\…` statt der Kopie unter `docs/proof/<schritt>/`; `:88-90` `bericht.json` wird vor dem Scan nicht entfernt (N24).
- `scripts/sys/fertig.mjs:37` Pflichtlauf entfällt bei gleichem Fingerabdruck in `gruen.json`, ohne Altersgrenze; `:14` Mindestmenge ohne `.claude/agents/` (N23); `:137` gelöschte Pfade der Mindestmenge fallen durch `existsSync` (N22); `lib.mjs:26` `hooksAktiv` prüft nur den Konfigurationswert (N22); `fertig.mjs:116` prüft nur `bericht.json` im Commit, nicht die genannten Kopien (N25).
- N21 (Wortliste) ist behoben (`guard.mjs:14`), der Rest (globale Option mit Wert vor dem Unterbefehl) steht als AN1 in OFFEN; N29 behoben (Matcher `mcp__.*`, `MCP_DB`, deny-Regel); N26: Rettungsweg fehlt in `BEKS_EINRICHTUNG.md` (kein Treffer „Marke“).

## Änderungen
1. Guard: `kern` + `if|while|until`, + PowerShell-Zuweisung (optionaler `[typ]`, `$name`, `=`, `+=` …) + `&` und `@(` in der Schleife; `segmente` trennt zusätzlich an `{` und `}` (für `if (npm run check) { … }`). Neue Fassung zuerst `tmp/a/guard.mjs`, Batterie `tmp/a/am10.mjs` (acht Formen verweigert, Gegenproben erlaubt), dann einspielen.
2. N19: Schalter `i`; `git config --remove-section|--edit|-e` verweigert. N20b: Ausnahme an `kahl` prüfen.
3. Modell: `session.mjs` schreibt zusätzlich `transcript` (`transcript_path`) und `felder` (Schlüssel der Eingabe); `lib.mjs` `modellAusTranskript(pfad)` (häufigstes `message.model` ohne Sidechain); `bericht.mjs`: Modell = Hook-Feld, sonst Transkript (Pfad aus `session.json` oder aus Konfigurationsordner/Projekt-Slug/Session-ID), sonst „unbekannt“; `session.json` wird als Beleg nach `docs/proof/<schritt>/` kopiert. Der Blockierer für falsches Modell greift ohne Feld weiter nicht (bekannt, in der Bewertung).
4. `bericht.mjs`: Lauf eines anderen Schritts → `uebernommen: { hash, schritt }`, eigener Abschnitt „Übernommen (Fingerabdruck der Suite unverändert)“; Abnahme-Datei = Kopie unter `docs/proof/<schritt>/`; `bericht.json` vor dem Scan löschen (N24); `gruen.json` bekommt je Suite `zeit` (Start des Laufs).
5. `fertig.mjs`: R3 und Suite `rls`: Übernahme aus `gruen.json` nur, wenn `zeit` höchstens 7 Tage vor „jetzt“ liegt (fehlendes `zeit` = abgelaufen); `c.jetzt` für Tests; `.claude/agents/` in die Mindestmenge (N23); gelöschte Pfade der Mindestmenge blockieren, `hooksAktiv` verlangt die Hook-Datei (N22); Kopien und Logs aus `bericht.json` müssen im Commit liegen (N25).
6. SKILL.md: Pflichttabelle rls R3, Mindestmenge, Ablauf 8. Doku: ENTSCHEIDUNGEN, BEKS, OFFEN, STAND.

## Tests (zuerst rot)
`tests/unit/sys-guard.test.ts` (AM10, N19, N20b), `sys-fertig.test.ts` (rls 7 Tage, N22, N23, N25), `sys-session.test.ts` (transcript, felder), neuer kleiner Test für `modellAusTranskript`.

## Nicht Teil
u3, Migrationen, `sweep.ts`, App-Code, `package.json` (kein Eingriff geplant).
