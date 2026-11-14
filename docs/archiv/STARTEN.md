# MoveNow · So starten Sie

## Was im Ordner liegt

```
MoveNow/
├── STARTEN.md                 ← diese Datei
├── CLAUDE.md                  ← Regeln für Claude Code (lädt automatisch)
├── .claude/                   ← Standardmodell Sonnet, Effort medium, gesperrte .env-Dateien, 5 Subagents (Opus-Berater inklusive)
├── .env.example               ← Namen der Zugangsdaten, ohne Werte
├── .gitignore                 ← hält .env.local aus Git heraus
└── docs/
    ├── SESSION_PROMPTS.md     ← Kickoff S1 und Standard-Prompt ab S2
    ├── ROADMAP.md             ← 10 Sessions mit Akzeptanzkriterien, Erweiterungen unter „Später"
    ├── DESIGN_BRIEF.md        ← Briefing von Claude Design, Anpassungen mit [MoveNow] markiert
    ├── PROGRESS.md            ← Stand nach jeder Session
    └── reference/
        ├── MoveNow_Prototyp.html   ← Inhalt, Ablauf, Preislogik
        └── design/                 ← verbindliches Design (Screens, HTML, Tokens)
```

## Einmalig

1. Ordner an einen festen Platz legen, z. B. `C:\Users\gesch\Projekte\MoveNow`.
2. Ihre `.env.local` hineinlegen. Die Namen müssen denen in `.env.example` entsprechen; die zwei App-Variablen beginnen mit `NEXT_PUBLIC_`.
3. Claude-Desktop-App → Code → diesen Ordner öffnen.
4. MCP-Server, die das Projekt nicht braucht (z. B. REA), für dieses Projekt abschalten: `/mcp` eingeben und den Server dort deaktivieren. Claude Code merkt sich das nur für dieses Projekt.

GitHub ist optional. Ohne Repo committet Claude Code lokal und bietet am Ende von S1 an, ein privates Repo anzulegen.

## Session S1 (einmal mit Opus)

1. `/model opus` eingeben. Effort steht über die Projekteinstellungen schon auf medium.
2. Erste Nachricht:
   `Arbeite den Abschnitt „Kickoff · Session S1" in docs/SESSION_PROMPTS.md vollständig ab.`

## Ab Session S2 (Sonnet, Standard)

1. Neue Session starten. Sonnet 5.5 und Effort medium kommen aus den Projekteinstellungen. Hat Claude Code nach S1 Opus behalten: `/model sonnet`.
2. Erste Nachricht (Nummer anpassen):
   `Starte Session S2 nach dem Standard-Prompt in docs/SESSION_PROMPTS.md.`

## Während der Arbeit

- Eine Session pro Abschnitt. Nach dem Commit am Ende einer Session starten Sie neu. Es geht nichts verloren, der Stand steht in Git und in `docs/PROGRESS.md`.
- Zeigt die Kontextanzeige im Composer (oder `/context`) etwa 150.000 Tokens, schreiben Sie: `Zwischenstand sichern und stoppen.` Danach eine neue Session mit demselben Standard-Prompt und derselben Nummer; Claude Code macht an der notierten Stelle weiter.
- Opus ist der Kopf: In S1 plant er selbst, ab S2 fragt Sonnet ihn als `advisor` gebündelt: Plan-Freigabe für Architektur-, Geld- und Sicherheitsentscheidungen, Abnahme vor dem Commit in S2, S8a und S9, und bei hartnäckigen Fehlern. Sie müssen dafür nichts umstellen. Effort bleibt medium, außer in S8a (`/effort high`); sonst nur bei einem wirklich harten Problem erhöhen.

## Wichtig

- `.env.local` nie weitergeben und nie von Claude Code anlegen oder lesen lassen.
- Die Plattformgebühr (15 %) sehen Kunden nirgends. Sie erscheint nur in der Abrechnung von Partnern und Vermietern und später auf der Rechnung.
- Design ansehen: `docs/reference/design/html/01_Start_Light.html` im Browser öffnen.
