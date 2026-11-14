---
paths:
  - "src/**"
  - "public/**"
  - "index.html"
  - "tests/e2e/**"
  - "tests/shots/**"
---
# UI

- Deutsch (de-AT), per Du, kurz und ruhig. Beträge `de-AT` mit `tabular-nums`, formatiert nur über `formatEuro` (`src/lib/money.ts`, Ausgabe wie in der Referenz: „1.175,00 €“).
- Beträge brechen nie um: Zahl und € bleiben in einer Zeile (`white-space: nowrap`), lange Beschreibungen umbrechen stattdessen. Die Referenz zeigt solche Umbrüche in 05 („354,00 €“) und 14 („689,61 €“); diesen Fehler nicht übernehmen.
- Kein Gerätemockup, keine Intro-Spalte, keine „Prototyp“/„Konzeptdemo“-Texte.
- Tab-Bar: Start · Aufträge · Profil (Phase 1; „Miete“ kommt erst in Phase 2 zurück). In Buchungsflows ausgeblendet, dort die fixierte Aktionsleiste.
- Icons und Illustrationen aus der Referenz als SVG-Komponenten, Pfade unverändert: Pfaddaten tippt kein Modell ab, sie werden aus `tmp/svg/` kopiert (`npm run svg:extract`). Icons über `currentColor` und Tokens. Illustrationen in den natürlichen Materialfarben der Palette `illustration` aus `tokens.json`, Teal nur als Marken-Akzent, Dark-Varianten aus `02_Start_Dark.html`. Keine Emojis, keine Rasterbilder, wo Vektor reicht.
- Kein Hinweis auf „15 %“, „Plattformgebühr“, „Provision“ oder „MoveNow-Gebühr“ in Kunden-Screens.
- Für Zustände ohne Referenz-Screen: im selben Stil ergänzen, `frontend-design`-Skill nutzen, falls installiert.
- Touch-Ziele ≥ 44 px, Fokus sichtbar, jedes Feld mit Label, Kontrast AA, `prefers-reduced-motion` (dann nur Fades).
- Mobile-first PWA, später per Capacitor in den App Store. Nichts bauen, was nativ nicht funktioniert.
- Jede UI-Änderung: Konsole ohne Fehler, Tastaturbedienung des Hauptflows als E2E-Test.

## Bildsicht
- Screenshots beurteilt nur der `reviewer` (öffnet die Bilder mit Read). Jede Zeile einer Shot-Tabelle enthält eine eigene Beobachtung, die nur mit Bildsicht möglich ist (Farbe, Position oder Text eines Elements); „kein Überlauf“, „wie Light“ oder „wie 390 px“ zählt nicht. Fehlt das, gilt die Zeile als ungeprüft.
- Maße (Breiten, Abstände, Überlauf) nur per Playwright `boundingBox()` oder `getComputedStyle`, nie aus dem Bild geschätzt.
- Vergleich mit `docs/reference/design/screens/` bei 390 px (Faktor 2). Größen je Stufe: Skill `/schritt`.
