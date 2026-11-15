# MoveNow

Vermittlungsplattform, Start Wien: Möbeltransport, Umzug, Entrümpelung, Montage/Demontage, Transportermiete. Kunden bekommen einen Richtpreis und senden eine verbindliche Buchungsanfrage; der Partner nimmt in der App an (`docs/S9_KONZEPT.md`). MoveNow behält eine gestaffelte Provision vom Gesamtpreis (inkl. 20 % USt.) als Plattformgebühr ein. Keine Zusatzgebühr für Kunden, und Kunden sehen die Gebühr nirgends.

Umfang dieser Phase: genau das Briefing in `docs/DESIGN_BRIEF.md`. Was unter „Später“ in `docs/ROADMAP.md` steht (z. B. Admin-Oberfläche, Zahlung, Miete), baust du nur nach meiner Freigabe.

## Arbeitssystem (Beschluss Beks 2026-11-14, `docs/SYSTEM_VORSCHLAG.md`)
- Was ein Skript prüfen kann, prüft ein Skript; Text bleibt nur, wo Urteil nötig ist. Ein Lauf, der nicht über das Start-Programm lief, zählt nicht.
- Jeder Schritt läuft über `/schritt <name>` (`.claude/skills/schritt/SKILL.md`): Ablauf, Risikostufen R0 bis R3, Pflichten, Agents. Ohne `/schritt` nur Fragen beantworten und lesen.
- Eine Session = ein Schritt = ein Branch. Sessions startet nur Beks. Nach `npm run fertig`: Bericht, Stopp.
- Eine Session pro Arbeitsordner. Parallel nur mit eigenem Worktree: eine R3-Session neben einer R0/R1-Session ohne Datenbank, vor dem Merge Rebase und `npm run t -- check`.
- Modell der Hauptsession: Sonnet 5.5 (Effort hoch bei R3, sonst mittel). Ein anderes Modell nur auf mein Wort; läufst du mit einem anderen, sag es im ersten Satz.
- Fragen an mich stehen in `docs/BEKS.md`, nicht verstreut. Ändert ein Schritt eine frühere Entscheidung von mir, braucht er mein wörtliches Ja im Prompt, sonst hältst du an.
- Gates (`scripts/sys/**`, `.claude/**`, `.githooks/**`, `package.json`, diese Datei) nie abschwächen. Blockiert eines zu Unrecht: anhalten, berichten. Rettungswege: `docs/BEKS_EINRICHTUNG.md`.
- Die `ask`-Regeln für `git commit` und `git merge` entfielen nach dem Probe-Schritt (u4); push, rm und dotenv bleiben auf `ask` (ENTSCHEIDUNGEN Nr. 174).

## Quellen und Rangfolge
- **Optik:** `docs/reference/design/` (Screens, HTML-Quelltext, `tokens.json`, `README.md`). Verbindlich.
- **Design-Sprache, Inhalt, Ablauf:** `docs/DESIGN_BRIEF.md`. Der Kopf der Datei sagt, welche Abschnitte gelten.
- **Preise:** Code im Prototyp `docs/reference/MoveNow_Prototyp.html`. Optik und Seitenstruktur des Prototyps sind nicht maßgeblich.
- **Stand:** `docs/STAND.md` (wo wir stehen, nächster Schritt) · Plan: `docs/ROADMAP.md` · Start: `docs/GOLIVE.md`
- **Offenes:** `docs/OFFEN.md` · Fragen an Beks: `docs/BEKS.md` · Entscheidungen: `docs/ENTSCHEIDUNGEN.md` (nur bei Bedarf)
- **Nachschlagen, nur abschnittsweise über `Explore`:** `docs/S9_KONZEPT.md`, `docs/ARCHITECTURE.md`, `docs/PRICING.md`
- `docs/archiv/` liest niemand mehr. Verweise im Code auf `docs/OPEN_ISSUES.md`, `PROGRESS.md` oder `AUTOPILOT.md` meinen die Dateien dort.
- Bei Widerspruch gilt diese Datei mit den Regeln in `.claude/rules/`. Danach: für die Optik die Design-Referenz, für Inhalt und Ablauf DESIGN_BRIEF, für Preise der Prototyp-Code (Abweichungen in `docs/PRICING.md` melden).
- Große Referenzdateien nie komplett in den Hauptkontext laden.

## Feste Regeln (`.claude/rules/`, laden bei passenden Dateien; für Pläne und Abnahmen selbst lesen)
- `geld.md`: Integer-Cent, Server rechnet, Provisionsstaffel, Gebühr für Kunden unsichtbar und unlesbar.
- `daten.md`: RLS, Rollen, Schlüssel, `.env*`, Datenbank-Weg mit Freigabe.
- `karten.md`: Routing nur über `route`, Einwilligung, Attribution.
- `ui.md`: Sprache, Beträge, Icons, Barrierefreiheit, Bildsicht.
- `tests.md`: Start-Programm, Nachweise, Rot-Beweis.

## Stack
- Vite + React + TypeScript strict, React Router mit Seitenübergängen im iOS-Stil
- Tailwind CSS mit Theme aus `tokens.json` (CSS-Variablen, Light und Dark), Motion für Federanimationen
- Mobile-first PWA, später per Capacitor in den App Store
- Supabase (EU-Region): Postgres + PostGIS, Auth (E-Mail-Magic-Link, dieselbe Mail enthält zusätzlich einen Code), Storage, Edge Functions. Reine Client-App; alle Geschäftslogik mit Vertrauensbedarf läuft in Supabase.
- Vitest (Unit, Integration), Playwright (E2E, Screenshots). Statischer Build; den Hosting-Anbieter lege ich vor dem Launch fest.

## Befehle
- `npm run dev`, `npm run build`
- `npm run start-schritt -- <name>`, `npm run bericht`, `npm run fertig`
- `npm run t -- check|e2e|rls|shots|shots:all|build|<testdatei>` (einziger Weg für Tests; `shots` = 390×844, Faktor 2, Light und Dark, nach `tmp/shots/`; `shots:all` zusätzlich 430×932, 768×1024, 1280×800)
- `npm run db:antrag`, `npm run db:push`, `npm run db:types`; neue Migration: `npx supabase migration new <name>`
- `npm run loesch -- <skript.mjs>` (Lösch- und Aufräumskripte, nur mit Freigabe)
- `npm run env:check` (nur Variablennamen), `npm run scan:proof`, `npm run svg:extract` (SVGs byte-genau nach `tmp/svg/`)

## Werkzeuge und Ausgaben
- Kein Python über stdin-Heredoc (`python3 - <<EOF`), das hängt unter Windows. Stattdessen Node-Skript oder temporäre Datei unter `tmp/`.
- `.env*` (außer `.env.example`) nie lesen, ausgeben oder committen, auch nicht über Skripte, `node -e` oder andere Umwege. Werte gehen nur über die npm-Skripte (dotenv-cli) an Befehle. Ein blockierter Tool-Aufruf ist endgültig.
- Doku- und Markdown-Dateien nur mit Write und Edit ändern, nie per Skript oder Shell-Umleitung. Verschieben mit `git mv` ist erlaubt, außer in `docs/proof/` und `docs/freigaben/`.
- Befehlsausgaben nur bei Fehlern im Wortlaut zeigen, sonst nur „bestanden“. Logs nie komplett lesen, nur nach Fehlern greppen.
- Dateien per Edit ändern statt komplett neu ausgeben.
