# s9i-7b2 A: Tool-Listen der Berater (Selbstauskunft, wörtlich)

Frontmatter heute (unverändert, schon vor dieser Session eine feste Liste):
- `.claude/agents/advisor.md`: `tools: Read, Grep, Glob`, `model: claude-fable-5-2`
- `.claude/agents/advisor-report.md`: `tools: Read, Grep, Glob, Write`, `model: claude-fable-5-2`

Aufruf 1 (Frontmatter wie oben), Auftrag: nur Selbstauskunft, kein Tool aufrufen.
- advisor: "Modell: claude-fable-5-2 / Tools: Read, Grep, Glob, advisor – darunter ein Tool namens 'advisor': ja"
- advisor-report: "Modell: claude-fable-5-2 / Tools: Read, Grep, Glob, Write, advisor – darunter ein Tool namens 'advisor': ja (ohne Parameter, gibt den ganzen Verlauf weiter; nicht aufgerufen)"

Aufruf 2 (Versuch mit zusätzlichem Frontmatter `disallowedTools: advisor` in beiden Dateien, danach zurückgenommen, weil wirkungslos):
- advisor: "Modell: claude-fable-5-2 / Tools: Read, Grep, Glob, advisor – Tool namens 'advisor' vorhanden: ja (ohne Parameter, gibt den ganzen Verlauf weiter; nicht aufgerufen)"
- advisor-report: "Modell: claude-fable-5-2 / Tools: Read, Grep, Glob, Write, advisor – Tool namens 'advisor' darunter: ja (ohne Parameter, gibt den ganzen Verlauf weiter)"

Ergebnis: Das eingebaute `advisor`-Tool steht trotz fester `tools:`-Liste und `disallowedTools` in der Liste beider Subagents (Harness fügt es hinzu; möglich ist auch, dass Agent-Definitionen erst mit neuer Session neu geladen werden, nicht belegt).
Folge nach Auftrag: OPEN_ISSUES-Eintrag, und jeder Auftrag an einen Berater verbietet das Tool ausdrücklich. Aufgerufen wurde es in den vier Probeaufrufen nicht (je 0 Tool-Aufrufe laut Nutzungsangabe).
